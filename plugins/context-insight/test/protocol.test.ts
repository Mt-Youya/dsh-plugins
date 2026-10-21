import { describe, expect, it } from "vitest"
import { PLUGIN_VERSION } from "../src/version.ts"
import {
  CONTEXT_SOURCES,
  DEFAULT_TURN_LIMIT,
  HEALTH_PATH,
  HEALTH_URL,
  MAX_TURN_LIMIT,
  browserUrl,
  isAttribution,
  isContextSource,
  isHealthResponse,
  isHealthValue,
  isMeasure,
  isSafeId,
  isSessionDetail,
  isTurn,
  parseTurnWindow,
  type HealthOk,
} from "../src/protocol.ts"

describe("health wire guards", () => {
  it("accepts the payload the Host actually answers with", () => {
    const answer: HealthOk = {
      ok: true,
      value: { version: PLUGIN_VERSION, sources: CONTEXT_SOURCES },
    }
    expect(isHealthResponse(answer)).toBe(true)
  })

  it("accepts an empty source list and ignores unknown extra fields", () => {
    expect(isHealthValue({ version: "1.2.3", sources: [] })).toBe(true)
    expect(isHealthValue({ version: "1.2.3", sources: ["dsh"], note: "extra" })).toBe(true)
  })

  it("rejects malformed bodies", () => {
    expect(isHealthValue(undefined)).toBe(false)
    expect(isHealthValue(null)).toBe(false)
    expect(isHealthValue([])).toBe(false)
    expect(isHealthValue({ sources: [] })).toBe(false)
    expect(isHealthValue({ version: 1, sources: [] })).toBe(false)
    expect(isHealthValue({ version: "1.2.3", sources: "dsh" })).toBe(false)
    expect(isHealthValue({ version: "1.2.3", sources: ["claude", "x"] })).toBe(false)
    expect(isHealthValue({ version: "1.2.3", sources: [undefined] })).toBe(false)
  })

  it("admits both response variants and nothing else", () => {
    expect(isHealthResponse({ ok: false, error: "forbidden" })).toBe(true)
    expect(isHealthResponse({ ok: false, error: "" })).toBe(false)
    expect(isHealthResponse({ ok: false })).toBe(false)
    expect(isHealthResponse({ ok: "true", value: { version: "1", sources: [] } })).toBe(false)
    expect(isHealthResponse({ value: { version: "1", sources: [] } })).toBe(false)
  })

  it("narrows only the announced source tokens", () => {
    expect(CONTEXT_SOURCES.every(isContextSource)).toBe(true)
    expect(isContextSource("codex")).toBe(true)
    expect(isContextSource("Codex")).toBe(false)
    expect(isContextSource("claude-code")).toBe(false)
    expect(isContextSource(0)).toBe(false)
  })

  it("spells the route absolutely on the Host and relatively in the page", () => {
    expect(HEALTH_PATH.startsWith("/")).toBe(true)
    expect(HEALTH_URL).toBe(HEALTH_PATH.slice(1))
    expect(HEALTH_URL.startsWith("/")).toBe(false)
    expect(browserUrl("//api/x")).toBe("api/x")
  })
})

describe("measure guards keep precision attached", () => {
  it("admits exact and estimate measures, including negative residuals", () => {
    expect(isMeasure({ tokens: 10, precision: "exact", basis: "usage" })).toBe(true)
    expect(isMeasure({ tokens: -4200, precision: "estimate", basis: "unattributed" })).toBe(true)
    expect(isMeasure({ tokens: 0, precision: "estimate", basis: "chars-per-token" })).toBe(true)
  })

  it("refuses a bare number, an unknown basis or a non-finite count", () => {
    expect(isMeasure(42)).toBe(false)
    expect(isMeasure({ tokens: 42 })).toBe(false)
    expect(isMeasure({ tokens: 42, precision: "exact", basis: "guess" })).toBe(false)
    expect(isMeasure({ tokens: Number.NaN, precision: "exact", basis: "usage" })).toBe(false)
    expect(isMeasure({ tokens: 1, precision: "exact" })).toBe(false)
  })

  it("accepts an attribution with a residual and one with a factor, but not both shapes broken", () => {
    const parts = [{ part: "history", measure: { tokens: 10, precision: "estimate", basis: "chars-per-token" } }]
    expect(
      isAttribution({
        total: { tokens: 100, precision: "exact", basis: "usage" },
        parts,
        residual: { tokens: 90, precision: "estimate", basis: "unattributed" },
      })
    ).toBe(true)
    expect(
      isAttribution({ total: { tokens: 100, precision: "exact", basis: "usage" }, parts, reconciled: { factor: 1.2 } })
    ).toBe(true)
    expect(
      isAttribution({ total: { tokens: 100, precision: "exact", basis: "usage" }, parts, reconciled: { factor: 0 } })
    ).toBe(false)
    expect(isAttribution({ total: 100, parts })).toBe(false)
    expect(
      isAttribution({
        total: { tokens: 1, precision: "exact", basis: "usage" },
        parts: [{ part: "mystery", measure: { tokens: 1, precision: "estimate", basis: "chars-per-token" } }],
      })
    ).toBe(false)
  })
})

describe("turn window decoding", () => {
  it("defaults to the first page and clamps a large limit", () => {
    expect(parseTurnWindow(new URLSearchParams(""))).toEqual({ offset: 0, limit: DEFAULT_TURN_LIMIT })
    expect(parseTurnWindow(new URLSearchParams("turnLimit=500"))).toEqual({ offset: 0, limit: MAX_TURN_LIMIT })
    expect(parseTurnWindow(new URLSearchParams("turnOffset=120&turnLimit=20"))).toEqual({ offset: 120, limit: 20 })
  })

  it("refuses values it cannot honour", () => {
    expect(parseTurnWindow(new URLSearchParams("turnLimit=0"))).toBeUndefined()
    expect(parseTurnWindow(new URLSearchParams("turnLimit=abc"))).toBeUndefined()
    expect(parseTurnWindow(new URLSearchParams("turnOffset=-1"))).toBeUndefined()
    expect(parseTurnWindow(new URLSearchParams("turnOffset=1.5"))).toBeUndefined()
    expect(parseTurnWindow(new URLSearchParams("turnLimit=99999"))).toBeUndefined()
  })
})

describe("turn and session detail guards", () => {
  const measure = { tokens: 5, precision: "estimate", basis: "chars-per-token" }
  const attribution = { total: { tokens: 10, precision: "exact", basis: "usage" }, parts: [] }

  it("admits a minimal turn and refuses one missing its attribution", () => {
    expect(
      isTurn({
        index: 1,
        startedAt: 1,
        userInput: [],
        assistantText: [],
        toolCalls: [],
        compactions: [],
        subagents: [],
        attribution,
      })
    ).toBe(true)
    expect(
      isTurn({
        index: 1,
        startedAt: 1,
        userInput: [],
        assistantText: [],
        toolCalls: [],
        compactions: [],
        subagents: [],
      })
    ).toBe(false)
    expect(
      isTurn({
        index: 1,
        startedAt: 1,
        userInput: [],
        assistantText: [],
        toolCalls: [],
        compactions: [],
        subagents: [],
        attribution,
        usage: { input: 1 },
      })
    ).toBe(false)
  })

  it("admits a paged session and refuses one whose turns are not turns", () => {
    const detail = {
      session: {
        id: "s1",
        source: "claude",
        workdir: "/tmp/x",
        createdAt: 1,
        updatedAt: 2,
        turns: [],
        dataQuality: [],
        segments: [{ name: "s1.jsonl", bytes: 1 }],
      },
      turnCount: 0,
      offset: 0,
      limit: 20,
      meta: { cached: false, elapsedMs: 1, bytes: 1, residualTurns: 0, reconciledTurns: 0 },
    }
    expect(isSessionDetail(detail)).toBe(true)
    expect(isSessionDetail({ ...detail, session: { ...detail.session, turns: [{ nope: true }] } })).toBe(false)
    expect(isSessionDetail({ ...detail, meta: { cached: "no" } })).toBe(false)
    expect(isSessionDetail({ ...detail, session: { ...detail.session, source: "claude-code" } })).toBe(false)
    void measure
  })
})
