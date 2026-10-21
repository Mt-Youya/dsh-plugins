import { describe, expect, it } from "vitest"
import type { Session, Turn, Usage } from "@cyrus/dsh-session-contract"
import { costOfSession } from "../src/host/views/cost.ts"
import {
  TABLES,
  lookupPrice,
  modelKey,
  normalizeModelId,
  primaryTableFor,
  type PricingTable,
} from "../src/host/views/pricing.ts"

function usage(input: number, cacheRead: number, cacheWrite: number, output: number): Usage {
  return { input, cacheRead, cacheWrite, output, totalContext: input + cacheRead + cacheWrite }
}

function turn(index: number, model: { provider: string; model: string } | undefined, use?: Usage): Turn {
  const base: Turn = {
    index,
    startedAt: index,
    userInput: [],
    assistantText: [],
    toolCalls: [],
    compactions: [],
    subagents: [],
    attribution: { total: { tokens: 1, precision: "exact", basis: "usage" }, parts: [] },
  }
  if (model !== undefined) base.model = model
  if (use !== undefined) base.usage = use
  return base
}

function session(turns: Turn[]): Session {
  return {
    id: "s1",
    source: "claude",
    workdir: "/tmp/x",
    createdAt: 1,
    updatedAt: 2,
    turns,
    segments: [],
    dataQuality: [],
  }
}

const OPUS_5_5 = { provider: "anthropic", model: "claude-opus-5-5" }
const SONNET_5_DOTTED = { provider: "anthropic", model: "claude-sonnet-5.5" }
const DEEPSEEK = { provider: "deepseek-official", model: "deepseek-flash" }
const GPT_6_1 = { provider: "openai", model: "gpt-6.1-sol" }

describe("three tables", () => {
  it("ships xogpu (CNY), official (USD) and openrouter (USD reference)", () => {
    expect(Object.keys(TABLES).sort()).toEqual(["official", "openrouter", "xogpu"])
    expect(TABLES.xogpu.currency).toBe("CNY")
    expect(TABLES.official.currency).toBe("USD")
    expect(TABLES.openrouter.currency).toBe("USD")
    expect(TABLES.official.source).toContain("DeepSeek")
    expect(TABLES.openrouter.source).toContain("OpenRouter")
    // DeepSeek lives in its own table, not in the OpenRouter one.
    expect(lookupPrice(TABLES.official, "deepseek-official", "deepseek-flash")).toBeDefined()
    expect(lookupPrice(TABLES.openrouter, "deepseek-official", "deepseek-flash")).toBeUndefined()
  })

  it("normalises dotted ids in both priced tables", () => {
    expect(normalizeModelId("claude-sonnet-5.5")).toBe("claude-sonnet-5-5")
    expect(modelKey("Anthropic", "claude-sonnet-5.5")).toBe("anthropic/claude-sonnet-5-5")
    expect(lookupPrice(TABLES.xogpu, "anthropic", "claude-sonnet-5.5")).toMatchObject({ input: 14, currency: "CNY" })
    expect(lookupPrice(TABLES.openrouter, "anthropic", "claude-sonnet-5.5")).toMatchObject({
      input: 2,
      currency: "USD",
    })
  })

  it("picks the primary table per model", () => {
    expect(primaryTableFor("anthropic", "claude-opus-5-5")).toBe("xogpu")
    expect(primaryTableFor("openai", "gpt-6.1-sol")).toBe("xogpu")
    expect(primaryTableFor("deepseek-official", "deepseek-flash")).toBe("official")
    expect(primaryTableFor("openai", "gpt-reserve")).toBeNull()
    expect(primaryTableFor("anthropic", "<synthetic>")).toBeNull()
  })
})

describe("primary price follows the model", () => {
  it("bills a Claude session from xogpu in CNY", () => {
    const report = costOfSession(session([turn(1, OPUS_5_5, usage(1_000_000, 0, 0, 1_000_000))]), "claude")
    expect(report.tableId).toBe("xogpu")
    expect(report.groups).toEqual([{ tableId: "xogpu", currency: "CNY", amount: 168, pricedTurns: 1 }])
    expect(report.turns[0]?.tableId).toBe("xogpu")
    // The same turn has a USD reference from OpenRouter.
    expect(report.turns[0]?.reference).toMatchObject({ tableId: "openrouter", currency: "USD", amount: 24 })
    expect(report.reference?.tableId).toBe("openrouter")
  })

  it("bills a DSH session from the official table in USD", () => {
    const report = costOfSession(session([turn(1, DEEPSEEK, usage(1_000_000, 2_000_000, 0, 1_000_000))]), "dsh")
    expect(report.tableId).toBe("official")
    expect(report.pricing.currency).toBe("USD")
    expect(report.groups).toEqual([{ tableId: "official", currency: "USD", amount: 1.512, pricedTurns: 1 }])
    expect(report.totals.usd).toBeCloseTo(1.512, 6)
    // No OpenRouter row for DeepSeek, so this turn has no reference column.
    expect(report.turns[0]?.reference).toBeUndefined()
    expect(report.partial).toBe(false)
  })

  it("keeps Claude and DeepSeek in separate (table, currency) groups", () => {
    const report = costOfSession(
      session([turn(1, OPUS_5_5, usage(1_000_000, 0, 0, 0)), turn(2, DEEPSEEK, usage(1_000_000, 0, 0, 0))]),
      "claude"
    )
    expect(report.groups).toHaveLength(2)
    const xogpu = report.groups.find((g) => g.tableId === "xogpu")
    const official = report.groups.find((g) => g.tableId === "official")
    expect(xogpu).toMatchObject({ currency: "CNY", amount: 28, pricedTurns: 1 })
    expect(official).toMatchObject({ currency: "USD", amount: 0.3, pricedTurns: 1 })
    // Mixed session: no single primary table, and no merged money.
    expect(report.tableId).toBeNull()
    expect(report.totals.usd).toBeNull()
    expect(report.totals.pricedTurns).toBe(2)
  })
})

describe("unlisted channels", () => {
  it("marks xogpu claude-opus-5-5 partial for its unlisted cacheRead", () => {
    const report = costOfSession(session([turn(1, OPUS_5_5, usage(0, 2_000_000, 1_000_000, 0))]), "claude")
    expect(report.partial).toBe(true)
    expect(report.unlistedChannels).toEqual(["anthropic/claude-opus-5-5#cacheRead"])
    expect(report.groups[0]?.amount).toBeCloseTo(35, 6)
  })

  it("does not mark the same turn partial in the openrouter table", () => {
    const report = costOfSession(session([turn(1, OPUS_5_5, usage(0, 2_000_000, 1_000_000, 0))]), "claude")
    expect(report.tables.openrouter?.partial).toBe(false)
    expect(report.tables.openrouter?.turns[0]?.amount).toBeCloseTo((2_000_000 * 0.2 + 1_000_000 * 5) / 1e6, 6)
  })

  it("records both missing buckets of gpt-6.1-sol in xogpu", () => {
    const report = costOfSession(session([turn(1, GPT_6_1, usage(1_000_000, 500_000, 500_000, 1_000_000))]), "codex")
    expect(report.unlistedChannels).toEqual(["openai/gpt-6.1-sol#cacheRead", "openai/gpt-6.1-sol#cacheWrite"])
    expect(report.partial).toBe(true)
    expect(report.groups[0]?.amount).toBeCloseTo(14 + 70, 6)
  })

  it("answers null when no primary table lists the model", () => {
    const report = costOfSession(
      session([turn(1, { provider: "openai", model: "gpt-reserve" }, usage(1_000, 0, 0, 10))]),
      "codex"
    )
    expect(report.turns[0]).toMatchObject({ priced: false, amount: null })
    expect(report.unpricedModels).toEqual(["openai/gpt-reserve"])
    expect(report.groups).toEqual([])
    expect(report.tableId).toBeNull()
    // OpenRouter does not list it either.
    expect(report.tables.openrouter?.unpricedModels).toEqual(["openai/gpt-reserve"])
  })
})

describe("per-turn lines and caller tables", () => {
  it("carries currency, table, amount and the cache hit rate", () => {
    const report = costOfSession(session([turn(1, OPUS_5_5, usage(1_000_000, 1_000_000, 0, 0))]), "claude")
    expect(report.turns[0]).toMatchObject({ priced: true, currency: "CNY", tableId: "xogpu", usd: null })
    expect(report.turns[0]?.cacheHitRate).toBeCloseTo(0.5, 6)
    expect(report.totals.cacheHitRate).toBeCloseTo(0.5, 6)
  })

  it("prices against a single hand-made table", () => {
    const table: PricingTable = {
      id: "xogpu",
      version: "t",
      asOf: "2026-01-01",
      currency: "USD",
      source: "test table",
      models: { "a/m": { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 } },
    }
    const report = costOfSession(
      session([turn(1, { provider: "a", model: "m" }, usage(1_000_000, 0, 0, 1_000_000))]),
      "claude",
      table
    )
    expect(report.totals.usd).toBeCloseTo(3, 6)
    expect(report.groups).toEqual([{ tableId: "xogpu", currency: "USD", amount: 3, pricedTurns: 1 }])
  })
})
