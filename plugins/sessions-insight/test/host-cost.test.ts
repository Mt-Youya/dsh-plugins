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
const DEEPSEEK = { provider: "deepseek-official", model: "deepseek-flash" }

describe("two tables", () => {
  it("ships official (USD) and openrouter (USD reference)", () => {
    expect(Object.keys(TABLES).sort()).toEqual(["official", "openrouter"])
    expect(TABLES.official.currency).toBe("USD")
    expect(TABLES.openrouter.currency).toBe("USD")
    expect(TABLES.official.source).toContain("DeepSeek")
    expect(TABLES.openrouter.source).toContain("OpenRouter")
    // DeepSeek lives in its own table, not in the OpenRouter one.
    expect(lookupPrice(TABLES.official, "deepseek-official", "deepseek-flash")).toBeDefined()
    expect(lookupPrice(TABLES.openrouter, "deepseek-official", "deepseek-flash")).toBeUndefined()
  })

  it("normalises dotted ids in the tables", () => {
    expect(normalizeModelId("claude-sonnet-5.5")).toBe("claude-sonnet-5-5")
    expect(modelKey("Anthropic", "claude-sonnet-5.5")).toBe("anthropic/claude-sonnet-5-5")
    expect(lookupPrice(TABLES.openrouter, "anthropic", "claude-sonnet-5.5")).toMatchObject({
      input: 2,
      currency: "USD",
    })
    expect(lookupPrice(TABLES.openrouter, "anthropic", "claude-sonnet-5-5")).toMatchObject({
      input: 2,
      currency: "USD",
    })
  })

  it("picks official as the only primary table", () => {
    expect(primaryTableFor("deepseek-official", "deepseek-flash")).toBe("official")
    // Claude/GPT have no primary price: openrouter is the reference column only.
    expect(primaryTableFor("anthropic", "claude-opus-5-5")).toBeNull()
    expect(primaryTableFor("openai", "gpt-6.1-sol")).toBeNull()
    expect(primaryTableFor("openai", "gpt-reserve")).toBeNull()
    expect(primaryTableFor("anthropic", "<synthetic>")).toBeNull()
  })
})

describe("primary price and the reference column", () => {
  it("leaves a Claude session unpriced, keeping the OpenRouter reference", () => {
    const report = costOfSession(session([turn(1, OPUS_5_5, usage(1_000_000, 0, 0, 1_000_000))]), "claude")
    expect(report.tableId).toBeNull()
    expect(report.groups).toEqual([])
    expect(report.turns[0]).toMatchObject({ priced: false, amount: null })
    expect(report.unpricedModels).toEqual(["anthropic/claude-opus-5-5"])
    // The session keeps its USD reference column from OpenRouter.
    expect(report.reference?.tableId).toBe("openrouter")
    expect(report.tables.openrouter?.turns[0]?.amount).toBeCloseTo(24, 6)
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

  it("prices only the DeepSeek turn when a session mixes Claude and DeepSeek", () => {
    const report = costOfSession(
      session([turn(1, OPUS_5_5, usage(1_000_000, 0, 0, 0)), turn(2, DEEPSEEK, usage(1_000_000, 0, 0, 0))]),
      "claude"
    )
    expect(report.groups).toEqual([{ tableId: "official", currency: "USD", amount: 0.3, pricedTurns: 1 }])
    expect(report.turns[0]?.priced).toBe(false)
    expect(report.turns[0]?.reference).toBeUndefined()
    expect(report.tables.openrouter?.turns[0]?.amount).toBeCloseTo(4, 6)
    expect(report.turns[1]?.tableId).toBe("official")
    expect(report.tableId).toBe("official")
    expect(report.totals.usd).toBeCloseTo(0.3, 6)
    expect(report.totals.pricedTurns).toBe(1)
  })
})

describe("unlisted channels", () => {
  it("marks a null bucket partial and names the channel", () => {
    const table: PricingTable = {
      id: "official",
      version: "t",
      asOf: "2026-01-01",
      currency: "USD",
      source: "test table",
      models: { "a/m": { input: 1, output: 2, cacheRead: null, cacheWrite: 3 } },
    }
    const report = costOfSession(
      session([turn(1, { provider: "a", model: "m" }, usage(0, 2_000_000, 1_000_000, 0))]),
      "claude",
      table
    )
    expect(report.partial).toBe(true)
    expect(report.unlistedChannels).toEqual(["a/m#cacheRead"])
    expect(report.groups[0]?.amount).toBeCloseTo(3, 6)
  })

  it("does not mark the same turn partial in the openrouter table", () => {
    const report = costOfSession(session([turn(1, OPUS_5_5, usage(0, 2_000_000, 1_000_000, 0))]), "claude")
    expect(report.tables.openrouter?.partial).toBe(false)
    expect(report.tables.openrouter?.turns[0]?.amount).toBeCloseTo((2_000_000 * 0.2 + 1_000_000 * 5) / 1e6, 6)
  })

  it("records both missing buckets of a hand-made table", () => {
    const table: PricingTable = {
      id: "official",
      version: "t",
      asOf: "2026-01-01",
      currency: "USD",
      source: "test table",
      models: { "a/m": { input: 14, output: 70, cacheRead: null, cacheWrite: null } },
    }
    const report = costOfSession(
      session([turn(1, { provider: "a", model: "m" }, usage(1_000_000, 500_000, 500_000, 1_000_000))]),
      "codex",
      table
    )
    expect(report.unlistedChannels).toEqual(["a/m#cacheRead", "a/m#cacheWrite"])
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
    const report = costOfSession(session([turn(1, DEEPSEEK, usage(1_000_000, 1_000_000, 0, 0))]), "dsh")
    expect(report.turns[0]).toMatchObject({ priced: true, currency: "USD", tableId: "official" })
    expect(report.turns[0]?.usd).toBeCloseTo(0.306, 6)
    expect(report.turns[0]?.cacheHitRate).toBeCloseTo(0.5, 6)
    expect(report.totals.cacheHitRate).toBeCloseTo(0.5, 6)
  })

  it("prices against a single hand-made table", () => {
    const table: PricingTable = {
      id: "official",
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
    expect(report.groups).toEqual([{ tableId: "official", currency: "USD", amount: 3, pricedTurns: 1 }])
  })
})
