import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { mkdtemp, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import type { Session } from "@cyrus/dsh-session-contract"
import { ClaudeSource, readHeaderFacts } from "../src/host/sources/claude.ts"
import { codexChainKey } from "../src/host/sources/codex.ts"
import { canonicalDshId, decodeBucketName } from "../src/host/sources/dsh.ts"
import { createRoutes, mergeWorkdirs } from "../src/host/http/routes.ts"
import type { ParsedSession, SearchCandidate, SessionSource, SourceFailure } from "../src/host/sources/source.ts"
import { cleanTitle } from "../src/host/sources/source.ts"
import type { WebRoute } from "../src/host/http/server.ts"
import {
  SESSIONS_PATH,
  SESSION_PATH,
  SOURCES_PATH,
  WORKDIRS_PATH,
  type ContextSource,
  type SessionSummary,
  type SourceStatus,
  type WorkdirEntry,
} from "../src/protocol.ts"

const WORKDIR = "/Users/example/project"

function sessionOf(over: Partial<Session> & { id: string; source: ContextSource }): Session {
  return {
    workdir: WORKDIR,
    createdAt: 1,
    updatedAt: 2,
    turns: [],
    segments: [],
    dataQuality: [],
    ...over,
  }
}

/** One in-memory source; `broken` makes every call throw like a real adapter bug. */
class FakeSource implements SessionSource {
  readonly id: ContextSource
  #rows: SessionSummary[]
  #broken: boolean
  #candidates: SearchCandidate[]

  constructor(id: ContextSource, rows: SessionSummary[], options: { broken?: boolean } = {}) {
    this.id = id
    this.#rows = rows
    this.#broken = options.broken === true
    this.#candidates = rows.map((row) => ({ id: row.id, workdir: row.workdir, updatedAt: row.updatedAt }))
  }

  #guard(): void {
    if (this.#broken) throw new Error("adapter exploded")
  }

  async status(): Promise<SourceStatus> {
    this.#guard()
    return { source: this.id, available: true, sessions: this.#rows.length, lastScanAt: 1 }
  }

  async workdirs(): Promise<WorkdirEntry[]> {
    this.#guard()
    const grouped = new Map<string, WorkdirEntry>()
    for (const row of this.#rows) {
      const at = grouped.get(row.workdir)
      if (at === undefined) {
        grouped.set(row.workdir, {
          workdir: row.workdir,
          sessions: 1,
          lastUpdatedAt: row.updatedAt,
          sources: [{ source: this.id, sessions: 1, lastUpdatedAt: row.updatedAt }],
        })
      } else {
        at.sessions += 1
        at.sources[0]!.sessions += 1
        at.lastUpdatedAt = Math.max(at.lastUpdatedAt, row.updatedAt)
      }
    }
    return [...grouped.values()]
  }

  async list(workdir: string): Promise<SessionSummary[]> {
    this.#guard()
    return this.#rows.filter((row) => row.workdir === workdir)
  }

  async detail(id: string): Promise<ParsedSession | SourceFailure> {
    this.#guard()
    const row = this.#rows.find((candidate) => candidate.id === id)
    if (row === undefined) return { ok: false, error: "not-found", detail: "session-not-found" }
    return {
      ok: true,
      session: sessionOf({ id: row.id, source: this.id, workdir: row.workdir }),
      bytes: row.bytes,
      elapsedMs: 1,
      cached: false,
    }
  }

  async segmentInfo(): Promise<{ name: string; bytes: number }[]> {
    return []
  }

  invalidate(): void {}

  async candidates(): Promise<SearchCandidate[]> {
    this.#guard()
    return this.#candidates
  }
}

function row(
  source: ContextSource,
  id: string,
  updatedAt: number,
  extra: Partial<SessionSummary> = {}
): SessionSummary {
  return { source, id, workdir: WORKDIR, updatedAt, bytes: 10, dataQuality: [], ...extra }
}

async function startHost(sources: SessionSource[]): Promise<{ base: string; close: () => Promise<void> }> {
  const routes: WebRoute[] = createRoutes({ sources, version: "test" })
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    const route = routes.find((candidate) => candidate.kind === "exact" && candidate.path === url.pathname)
    if (route === undefined) {
      res.writeHead(404)
      res.end('{"ok":false,"error":"not-found"}')
      return
    }
    route.handler(req, res)
  })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  const { port } = server.address() as AddressInfo
  return {
    base: `http://127.0.0.1:${String(port)}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined || error === null ? resolve() : reject(error)))
      }),
  }
}

describe("cross-source workdir merge", () => {
  it("merges the same directory from two sources into one node with both badges", () => {
    const merged = mergeWorkdirs([
      [
        {
          workdir: WORKDIR,
          sessions: 2,
          lastUpdatedAt: 10,
          sources: [{ source: "claude", sessions: 2, lastUpdatedAt: 10 }],
        },
      ],
      [
        {
          workdir: WORKDIR,
          sessions: 3,
          lastUpdatedAt: 20,
          sources: [{ source: "dsh", sessions: 3, lastUpdatedAt: 20 }],
        },
        {
          workdir: "/other",
          sessions: 1,
          lastUpdatedAt: 1,
          sources: [{ source: "dsh", sessions: 1, lastUpdatedAt: 1 }],
        },
      ],
    ])
    expect(merged).toHaveLength(2)
    expect(merged[0]?.workdir).toBe(WORKDIR)
    expect(merged[0]?.sessions).toBe(5)
    expect(merged[0]?.lastUpdatedAt).toBe(20)
    expect(merged[0]?.sources.map((group) => group.source)).toEqual(["claude", "dsh"])
    expect(merged[0]?.sources.map((group) => group.sessions)).toEqual([2, 3])
  })

  it("serves the merged tree over HTTP", async () => {
    const host = await startHost([
      new FakeSource("claude", [row("claude", "c1", 10)]),
      new FakeSource("dsh", [row("dsh", "d1", 20)]),
    ])
    try {
      const response = await fetch(host.base + WORKDIRS_PATH)
      const body = (await response.json()) as { value: { workdirs: WorkdirEntry[]; failures: unknown[] } }
      expect(response.status).toBe(200)
      expect(body.value.workdirs).toHaveLength(1)
      expect(body.value.workdirs[0]?.sources.map((group) => group.source)).toEqual(["claude", "dsh"])
      expect(body.value.failures).toEqual([])
    } finally {
      await host.close()
    }
  })
})

describe("single-source failure isolation", () => {
  it("reports a throwing adapter as unavailable instead of failing the page", async () => {
    const host = await startHost([
      new FakeSource("claude", [row("claude", "c1", 10)]),
      new FakeSource("dsh", [], { broken: true }),
    ])
    try {
      const sources = await fetch(host.base + SOURCES_PATH)
      const sourcesBody = (await sources.json()) as { value: { sources: SourceStatus[] } }
      expect(sources.status).toBe(200)
      const dsh = sourcesBody.value.sources.find((entry) => entry.source === "dsh")
      expect(dsh).toMatchObject({ available: false, reason: "adapter-error" })
      expect(dsh?.errorDetail).toContain("adapter exploded")
      // The healthy source still reports itself.
      expect(sourcesBody.value.sources.find((entry) => entry.source === "claude")?.available).toBe(true)

      const sessions = await fetch(`${host.base}${SESSIONS_PATH}?workdir=${encodeURIComponent(WORKDIR)}`)
      const sessionsBody = (await sessions.json()) as {
        value: { sessions: SessionSummary[]; failures: { source: string; error: string }[] }
      }
      expect(sessions.status).toBe(200)
      expect(sessionsBody.value.sessions.map((entry) => entry.id)).toEqual(["c1"])
      expect(sessionsBody.value.failures).toHaveLength(1)
      expect(sessionsBody.value.failures[0]).toMatchObject({ source: "dsh", error: "adapter-error" })
    } finally {
      await host.close()
    }
  })

  it("merges rows from every source and marks their origin", async () => {
    const host = await startHost([
      new FakeSource("claude", [row("claude", "c1", 10)]),
      new FakeSource("dsh", [row("dsh", "d1", 30)]),
    ])
    try {
      const response = await fetch(`${host.base}${SESSIONS_PATH}?workdir=${encodeURIComponent(WORKDIR)}`)
      const body = (await response.json()) as { value: { sessions: SessionSummary[] } }
      // Newest first across sources, each row keeping its own badge.
      expect(body.value.sessions.map((entry) => `${entry.source}:${entry.id}`)).toEqual(["dsh:d1", "claude:c1"])
    } finally {
      await host.close()
    }
  })

  it("dispatches a session read to the requested source", async () => {
    const host = await startHost([
      new FakeSource("claude", [row("claude", "same-id", 10)]),
      new FakeSource("dsh", [row("dsh", "same-id", 20)]),
    ])
    try {
      const dsh = await fetch(`${host.base}${SESSION_PATH}?source=dsh&id=same-id`)
      const dshBody = (await dsh.json()) as { value: { session: { source: string } } }
      expect(dshBody.value.session.source).toBe("dsh")

      const claude = await fetch(`${host.base}${SESSION_PATH}?source=claude&id=same-id`)
      const claudeBody = (await claude.json()) as { value: { session: { source: string } } }
      expect(claudeBody.value.session.source).toBe("claude")
    } finally {
      await host.close()
    }
  })
})

describe("title and id hygiene", () => {
  it("never lets an identifier travel as a title", () => {
    expect(cleanTitle("184d3a05-6c0d-4d68-a379-d4c1de581472", "x")).toBeUndefined()
    expect(cleanTitle("session-c086b68b-7c3c-4565-90fc-bc023ae81c1c", "x")).toBeUndefined()
    expect(cleanTitle("same-id", "same-id")).toBeUndefined()
    expect(cleanTitle("   ", "x")).toBeUndefined()
    expect(cleanTitle("可复用的微信聊天记录逆向提取", "x")).toBe("可复用的微信聊天记录逆向提取")
  })

  it("canonicalises DSH ids and decodes bucket names", () => {
    expect(canonicalDshId("session-c086b68b")).toBe("c086b68b")
    expect(canonicalDshId("c086b68b")).toBe("c086b68b")
    expect(decodeBucketName("--Users-me-codes-app--")).toBe("/Users/me/codes/app")
    expect(decodeBucketName("plain")).toBe("plain")
  })

  it("keys a Codex session on its whole chain", () => {
    const base = { id: "abc", updatedAt: 100, bytes: 1000 }
    expect(codexChainKey(base)).toBe("codex:abc:100:1000")
    // A second segment extends the chain: bytes change, key changes.
    expect(codexChainKey({ ...base, bytes: 2000 })).not.toBe(codexChainKey(base))
    // A touched segment moves the newest mtime: key changes.
    expect(codexChainKey({ ...base, updatedAt: 200 })).not.toBe(codexChainKey(base))
  })
})

describe("Claude header scan", () => {
  it("reads cwd, title and the first human input without parsing the body", async () => {
    const root = await mkdtemp(join(tmpdir(), "m6-header-"))
    const dir = join(root, "-Users-example-project")
    await mkdir(dir)
    const path = join(dir, "s1.jsonl")
    await writeFile(
      path,
      [
        JSON.stringify({
          type: "user",
          uuid: "u1",
          sessionId: "s1",
          cwd: WORKDIR,
          timestamp: "2026-01-01T00:00:00.000Z",
          message: { role: "user", content: "how do I shard this index?\nsecond line" },
        }),
        JSON.stringify({
          type: "assistant",
          uuid: "a1",
          sessionId: "s1",
          cwd: WORKDIR,
          timestamp: "2026-01-01T00:00:01.000Z",
          message: { id: "m1", role: "assistant", content: [{ type: "text", text: "reply" }] },
        }),
      ].join("\n") + "\n"
    )
    const facts = await readHeaderFacts(path, 64 * 1024)
    expect(facts).toMatchObject({ cwd: WORKDIR, sessionId: "s1" })
    expect(facts.firstInput).toContain("how do I shard this index?")
  })

  it("lists a Claude row with its first input and no fake title", async () => {
    const root = await mkdtemp(join(tmpdir(), "m6-list-"))
    const dir = join(root, "-Users-example-project")
    await mkdir(dir)
    await writeFile(
      join(dir, "s1.jsonl"),
      JSON.stringify({
        type: "user",
        uuid: "u1",
        sessionId: "s1",
        cwd: WORKDIR,
        timestamp: "2026-01-01T00:00:00.000Z",
        message: { role: "user", content: "first human question" },
      }) + "\n"
    )
    const source = new ClaudeSource({ root, scanTtlMs: 0 })
    const rows = await source.list(WORKDIR)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toBeUndefined()
    expect(rows[0]?.firstInput).toContain("first human question")
  })
})
