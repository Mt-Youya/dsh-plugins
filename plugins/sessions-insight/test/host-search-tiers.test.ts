import { describe, expect, it } from "vitest"
import type { Session, Turn } from "@cyrus/dsh-session-contract"
import { searchSessions } from "../src/host/views/search.ts"
import type { ParsedSession, SearchCandidate, SessionSource, SourceFailure } from "../src/host/sources/source.ts"
import type { ContextSource, SegmentInfo, SessionSummary, SourceStatus, WorkdirEntry } from "../src/protocol.ts"
import { isSearchHit, isSearchValue } from "../src/protocol.ts"

function turn(index: number, user: string, assistant: string): Turn {
  return {
    index,
    startedAt: index,
    userInput: [user],
    assistantText: [assistant],
    toolCalls: [],
    compactions: [],
    subagents: [],
    attribution: { total: { tokens: 1, precision: "exact", basis: "usage" }, parts: [] },
  }
}

function session(id: string, turns: Turn[], workdir = "/w"): Session {
  return { id, source: "claude", workdir, createdAt: 1, updatedAt: 2, turns, segments: [], dataQuality: [] }
}

/** Metadata-rich source: titles and first inputs, with bodies that differ. */
class TierSource implements SessionSource {
  readonly id: ContextSource
  readonly #rows: { summary: SessionSummary; candidate: SearchCandidate; session: Session }[]
  #parsed = 0

  constructor(
    id: ContextSource,
    rows: { id: string; title?: string; firstInput?: string; workdir?: string; turns: Turn[] }[]
  ) {
    this.id = id
    this.#rows = rows.map((row) => {
      const workdir = row.workdir ?? "/w"
      const summary: SessionSummary = {
        source: id,
        id: row.id,
        workdir,
        updatedAt: 100,
        bytes: 10,
        dataQuality: [],
        ...(row.title === undefined ? {} : { title: row.title }),
        ...(row.firstInput === undefined ? {} : { firstInput: row.firstInput }),
      }
      const candidate: SearchCandidate = { id: row.id, workdir, updatedAt: 100 }
      if (row.title !== undefined) candidate.title = row.title
      if (row.firstInput !== undefined) candidate.firstInput = row.firstInput
      return { summary, candidate, session: session(row.id, row.turns, workdir) }
    })
  }

  get parsed(): number {
    return this.#parsed
  }

  async status(): Promise<SourceStatus> {
    return { source: this.id, available: true, sessions: this.#rows.length, lastScanAt: 1 }
  }

  async workdirs(): Promise<WorkdirEntry[]> {
    return []
  }

  async list(): Promise<SessionSummary[]> {
    return this.#rows.map((row) => row.summary)
  }

  async detail(id: string): Promise<ParsedSession | SourceFailure> {
    const row = this.#rows.find((candidate) => candidate.summary.id === id)
    if (row === undefined) return { ok: false, error: "not-found", detail: "missing" }
    this.#parsed += 1
    return { ok: true, session: row.session, bytes: 10, elapsedMs: 1, cached: false }
  }

  async segmentInfo(): Promise<SegmentInfo[]> {
    return []
  }

  invalidate(): void {}

  async candidates(): Promise<SearchCandidate[]> {
    return this.#rows.map((row) => row.candidate)
  }
}

const ROWS = [
  { id: "a", title: "微信聊天记录逆向", firstInput: "帮我解析聊天记录", turns: [turn(1, "zebra", "ok")] },
  { id: "b", title: "上下文面板", firstInput: "做上下文面板", turns: [turn(1, "zebra appears in body only", "ok")] },
  { id: "c", firstInput: "nothing to see", turns: [turn(1, "unrelated", "zebra")] },
  { id: "d", title: "普通会话", firstInput: "普通问题", turns: [turn(1, "plain", "plain")] },
]

describe("fast tier", () => {
  it("searches metadata only and covers the whole corpus", async () => {
    const source = new TierSource("claude", ROWS)
    const value = await searchSessions(
      { sources: [source] },
      { q: "上下文", sources: ["claude"], limit: 10, tier: "fast", cursor: 0 }
    )
    expect(value.tier).toBe("fast")
    expect(value.truncated).toBe(false)
    expect(value.remaining).toBe(0)
    expect(value.scanned).toBe(ROWS.length)
    expect(value.hits).toHaveLength(1)
    expect(value.hits[0]).toMatchObject({ sessionId: "b", field: "metadata", turnIndex: 0, tier: "fast" })
    // Fast search never parses a body.
    expect(source.parsed).toBe(0)
  })

  it("matches the workdir and the first input, and always reports remaining 0", async () => {
    const source = new TierSource("claude", ROWS)
    const byInput = await searchSessions(
      { sources: [source] },
      { q: "帮我解析", sources: ["claude"], limit: 10, tier: "fast", cursor: 0 }
    )
    expect(byInput.hits.map((hit) => hit.sessionId)).toEqual(["a"])
    expect(byInput.remaining).toBe(0)

    const workdirRows = [{ id: "w", firstInput: "x", workdir: "/Users/me/codes/auto-chat", turns: [] }]
    const workdir = await searchSessions(
      { sources: [new TierSource("claude", workdirRows)] },
      { q: "auto-chat", sources: ["claude"], limit: 10, tier: "fast", cursor: 0 }
    )
    expect(workdir.hits).toHaveLength(1)
    expect(workdir.hits[0]?.field).toBe("metadata")
    expect(workdir.remaining).toBe(0)
  })

  it("caps hits at the limit but still reports a complete scan", async () => {
    const source = new TierSource("claude", ROWS)
    const value = await searchSessions(
      { sources: [source] },
      { q: "e", sources: ["claude"], limit: 1, tier: "fast", cursor: 0 }
    )
    expect(value.hits).toHaveLength(1)
    expect(value.remaining).toBe(0)
    expect(value.truncated).toBe(false)
    expect(value.scanned).toBe(ROWS.length)
  })
})

describe("deep tier", () => {
  it("finds body text that fast tier cannot see, and flags its own coverage", async () => {
    const source = new TierSource("claude", ROWS)
    const value = await searchSessions(
      { sources: [source] },
      { q: "zebra", sources: ["claude"], limit: 10, tier: "deep", cursor: 0 }
    )
    expect(value.tier).toBe("deep")
    expect(value.hits.map((hit) => hit.sessionId).sort()).toEqual(["a", "b", "c"])
    expect(value.scanned).toBe(ROWS.length)
    expect(value.remaining).toBe(0)
    expect(value.truncated).toBe(false)
    expect(value.nextCursor).toBeUndefined()
  })

  it("resumes from the cursor returned by a truncated page", async () => {
    const source = new TierSource("claude", ROWS)
    const first = await searchSessions(
      { sources: [source], deadlineMs: 0 },
      { q: "zebra", sources: ["claude"], limit: 10, tier: "deep", cursor: 0 }
    )
    expect(first.truncated).toBe(true)
    expect(first.scanned).toBe(0)
    expect(first.remaining).toBe(ROWS.length)
    expect(first.nextCursor).toBe(0)

    const second = await searchSessions(
      { sources: [source] },
      { q: "zebra", sources: ["claude"], limit: 10, tier: "deep", cursor: 2 }
    )
    // Starts where the cursor pointed: only the last two sessions are scanned.
    expect(second.scanned).toBe(2)
    expect(second.hits.map((hit) => hit.sessionId).sort()).toEqual(["c"])
    expect(second.remaining).toBe(0)
  })
})

describe("search wire guards", () => {
  it("admits a metadata hit from the fast tier and a body hit from the deep tier", () => {
    const metadata = {
      source: "claude",
      sessionId: "s1",
      workdir: "/w",
      turnIndex: 0,
      at: 1,
      field: "metadata",
      snippet: "微信聊天记录",
      tier: "fast",
    }
    expect(isSearchHit(metadata)).toBe(true)
    expect(isSearchHit({ ...metadata, tier: "deep", field: "user", turnIndex: 3 })).toBe(true)
    expect(isSearchHit({ ...metadata, tier: undefined })).toBe(false)
    expect(isSearchHit({ ...metadata, field: "guess" })).toBe(false)
  })

  it("admits a full fast-tier answer", async () => {
    const source = new TierSource("claude", ROWS)
    const value = await searchSessions(
      { sources: [source] },
      { q: "上下文", sources: ["claude"], limit: 10, tier: "fast", cursor: 0 }
    )
    expect(isSearchValue(value)).toBe(true)
  })
})
