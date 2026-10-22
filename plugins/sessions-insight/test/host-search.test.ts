import { describe, expect, it } from "vitest"
import type { Session, Turn } from "@cyrus/dsh-session-contract"
import { searchSessions } from "../src/host/views/search.ts"
import type { ParsedSession, SearchCandidate, SessionSource, SourceFailure } from "../src/host/sources/source.ts"
import type { ContextSource, SegmentInfo, SessionSummary, SourceStatus, WorkdirEntry } from "../src/protocol.ts"
import { parseSearchQuery, isSearchValue } from "../src/protocol.ts"

const WORKDIR = "/Users/example/project"

function turn(index: number, user: string, assistant: string): Turn {
  return {
    index,
    startedAt: index * 1000,
    userInput: [user],
    assistantText: [assistant],
    toolCalls: [],
    compactions: [],
    subagents: [],
    attribution: { total: { tokens: 10, precision: "exact", basis: "usage" }, parts: [] },
  }
}

function session(source: ContextSource, id: string, turns: Turn[], extra: Partial<Session> = {}): Session {
  return {
    id,
    source,
    workdir: WORKDIR,
    createdAt: 1,
    updatedAt: 2,
    turns,
    segments: [],
    dataQuality: [],
    ...extra,
  }
}

const PARSE_COST_MS = 5

/** A source with fixed sessions; `delayMs` simulates a cold parse. */
class StaticSource implements SessionSource {
  readonly id: ContextSource
  readonly #sessions: Session[]
  readonly #delayMs: number
  readonly #failDetail?: string

  constructor(id: ContextSource, sessions: Session[], options: { delayMs?: number; failDetail?: string } = {}) {
    this.id = id
    this.#sessions = sessions
    this.#delayMs = options.delayMs ?? 0
    this.#failDetail = options.failDetail
  }

  async status(): Promise<SourceStatus> {
    if (this.#failDetail !== undefined) throw new Error(this.#failDetail)
    return { source: this.id, available: true, sessions: this.#sessions.length, lastScanAt: 1 }
  }

  async workdirs(): Promise<WorkdirEntry[]> {
    return []
  }

  async list(): Promise<SessionSummary[]> {
    return []
  }

  async detail(id: string): Promise<ParsedSession | SourceFailure> {
    const session = this.#sessions.find((candidate) => candidate.id === id)
    if (session === undefined) return { ok: false, error: "not-found", detail: "missing" }
    if (this.#delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.#delayMs))
    return { ok: true, session, bytes: 1, elapsedMs: this.#delayMs, cached: false }
  }

  async segmentInfo(): Promise<SegmentInfo[]> {
    return []
  }

  invalidate(): void {}

  async candidates(): Promise<SearchCandidate[]> {
    if (this.#failDetail !== undefined) throw new Error(this.#failDetail)
    return this.#sessions.map((session) => ({ id: session.id, workdir: session.workdir, updatedAt: session.updatedAt }))
  }
}

describe("search request decoding", () => {
  it("defaults to every source and clamps the limit", () => {
    expect(parseSearchQuery(new URLSearchParams("q=shard"))).toEqual({
      q: "shard",
      sources: ["claude", "dsh", "codex"],
      limit: 30,
      tier: "fast",
      cursor: 0,
    })
    expect(parseSearchQuery(new URLSearchParams("q=shard&source=dsh&limit=999"))).toEqual({
      q: "shard",
      sources: ["dsh"],
      limit: 100,
      tier: "fast",
      cursor: 0,
    })
    expect(parseSearchQuery(new URLSearchParams("q=shard&tier=deep&cursor=42"))).toMatchObject({
      tier: "deep",
      cursor: 42,
    })
    expect(parseSearchQuery(new URLSearchParams("q=shard&source=dsh,claude"))?.sources).toEqual(["dsh", "claude"])
  })

  it("refuses an empty query, an unknown source or a zero limit", () => {
    expect(parseSearchQuery(new URLSearchParams(""))).toBeUndefined()
    expect(parseSearchQuery(new URLSearchParams("q=%20%20"))).toBeUndefined()
    expect(parseSearchQuery(new URLSearchParams("q=x&source=nope"))).toBeUndefined()
    expect(parseSearchQuery(new URLSearchParams("q=x&limit=0"))).toBeUndefined()
    expect(parseSearchQuery(new URLSearchParams(`q=${"x".repeat(201)}`))).toBeUndefined()
  })
})

describe("cross-source search", () => {
  it("finds turns in two sources and reports what it scanned", async () => {
    const claude = new StaticSource("claude", [
      session("claude", "c1", [turn(1, "how do I shard the index?", "use a hash ring")], { updatedAt: 10 }),
    ])
    const dsh = new StaticSource("dsh", [
      session("dsh", "d1", [turn(1, "unrelated", "the shard boundary moved")], { updatedAt: 20 }),
    ])
    const value = await searchSessions(
      { sources: [claude, dsh] },
      { q: "shard", sources: ["claude", "dsh"], limit: 30, tier: "deep", cursor: 0 }
    )
    expect(isSearchValue(value)).toBe(true)
    expect(value.hits.map((hit) => `${hit.source}:${hit.sessionId}:${hit.turnIndex}`)).toEqual([
      "dsh:d1:1",
      "claude:c1:1",
    ])
    expect(value.hits[0]?.field).toBe("assistant")
    expect(value.hits[1]?.field).toBe("user")
    expect(value.hits[1]?.snippet).toContain("shard")
    expect(value.scanned).toBe(2)
    expect(value.remaining).toBe(0)
    expect(value.truncated).toBe(false)
    expect(value.failures).toEqual([])
  })

  it("stops at the result limit and says it was truncated", async () => {
    const source = new StaticSource("claude", [
      session("claude", "c1", [turn(1, "shard one", "a")], { updatedAt: 30 }),
      session("claude", "c2", [turn(1, "shard two", "b")], { updatedAt: 20 }),
    ])
    const value = await searchSessions(
      { sources: [source] },
      { q: "shard", sources: ["claude"], limit: 1, tier: "deep", cursor: 0 }
    )
    expect(value.hits).toHaveLength(1)
    expect(value.truncated).toBe(true)
    expect(value.scanned).toBe(1)
    expect(value.remaining).toBe(1)
  })

  it("stops at the deadline instead of running to the end of the corpus", async () => {
    const source = new StaticSource(
      "claude",
      [
        session("claude", "c1", [turn(1, "shard one", "a")], { updatedAt: 30 }),
        session("claude", "c2", [turn(1, "shard two", "b")], { updatedAt: 20 }),
        session("claude", "c3", [turn(1, "shard three", "c")], { updatedAt: 10 }),
      ],
      { delayMs: PARSE_COST_MS }
    )
    const value = await searchSessions(
      { sources: [source], deadlineMs: 0 },
      { q: "shard", sources: ["claude"], limit: 30, tier: "deep", cursor: 0 }
    )
    expect(value.truncated).toBe(true)
    expect(value.scanned).toBe(0)
    expect(value.remaining).toBe(3)
    expect(value.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it("keeps a failing source out of the hits but in the failures list", async () => {
    const good = new StaticSource("claude", [session("claude", "c1", [turn(1, "shard", "a")])])
    const broken = new StaticSource("codex", [], { failDetail: "zstd frame exploded" })
    const value = await searchSessions(
      { sources: [good, broken] },
      { q: "shard", sources: ["claude", "codex"], limit: 30, tier: "deep", cursor: 0 }
    )
    expect(value.hits).toHaveLength(1)
    expect(value.failures).toHaveLength(1)
    expect(value.failures[0]).toMatchObject({ source: "codex", error: "adapter-error" })
    expect(value.failures[0]?.detail).toContain("zstd frame exploded")
  })

  it("ignores tool output and searches the tool input", async () => {
    const withTool = session("claude", "t1", [
      {
        ...turn(1, "run it", "done"),
        toolCalls: [
          {
            id: "call-1",
            name: "Bash",
            input: { command: "pnpm test --filter shard" },
            output: "secret-output-marker",
            status: "ok",
            startedAt: 1,
            endedAt: 2,
          },
        ],
      },
    ])
    const source = new StaticSource("claude", [withTool])
    const byInput = await searchSessions(
      { sources: [source] },
      { q: "pnpm test", sources: ["claude"], limit: 5, tier: "deep", cursor: 0 }
    )
    expect(byInput.hits[0]?.field).toBe("tool")
    const byOutput = await searchSessions(
      { sources: [source] },
      { q: "secret-output-marker", sources: ["claude"], limit: 5, tier: "deep", cursor: 0 }
    )
    expect(byOutput.hits).toHaveLength(0)
  })
})
