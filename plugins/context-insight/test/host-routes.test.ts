import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { ClaudeSource } from "../src/host/sources/claude.ts"
import type { WebRoute } from "../src/host/http/server.ts"
import { createRoutes } from "../src/host/http/routes.ts"
import { SESSIONS_PATH, SESSION_PATH, SOURCES_PATH, WORKDIRS_PATH, isSessionDetail } from "../src/protocol.ts"

const WORKDIR = "/tmp/example-project"

/** Four records: two human inputs, each answered with a logged usage. */
function transcript(): string {
  const line = (record: unknown): string => JSON.stringify(record) + "\n"
  return [
    line({
      type: "user",
      uuid: "u1",
      sessionId: "s1",
      cwd: WORKDIR,
      timestamp: "2026-01-01T00:00:00.000Z",
      message: { role: "user", content: "first question" },
    }),
    line({
      type: "assistant",
      uuid: "a1",
      sessionId: "s1",
      cwd: WORKDIR,
      timestamp: "2026-01-01T00:00:01.000Z",
      message: {
        id: "m1",
        role: "assistant",
        model: "claude-test",
        usage: { input_tokens: 1000, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0, output_tokens: 50 },
        content: [{ type: "text", text: "first answer" }],
      },
    }),
    line({
      type: "user",
      uuid: "u2",
      sessionId: "s1",
      cwd: WORKDIR,
      timestamp: "2026-01-01T00:00:02.000Z",
      message: { role: "user", content: "second question" },
    }),
    line({
      type: "assistant",
      uuid: "a2",
      sessionId: "s1",
      cwd: WORKDIR,
      timestamp: "2026-01-01T00:00:03.000Z",
      message: {
        id: "m2",
        role: "assistant",
        model: "claude-test",
        usage: { input_tokens: 10, cache_read_input_tokens: 20, cache_creation_input_tokens: 0, output_tokens: 5 },
        content: [{ type: "text", text: "second answer" }],
      },
    }),
  ].join("")
}

interface Host {
  base: string
  close: () => Promise<void>
}

/**
 * Serve one route table over a real socket: the status codes are part of the
 * contract, so the tests check them instead of a mocked response object.
 */
async function startHost(root: string): Promise<Host> {
  const routes: WebRoute[] = createRoutes({
    sources: [new ClaudeSource({ root, scanTtlMs: 0 })],
    version: "test",
  })
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    const route = routes.find((candidate) => candidate.kind === "exact" && candidate.path === url.pathname)
    if (route === undefined) {
      res.writeHead(404, { "content-type": "application/json" })
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

async function getJson(
  url: string,
  init?: RequestInit
): Promise<{ status: number; body: Record<string, unknown>; headers: Headers }> {
  const response = await fetch(url, init)
  const body = (await response.json()) as Record<string, unknown>
  return { status: response.status, body, headers: response.headers }
}

describe("routes over a real corpus", () => {
  let root: string
  let host: Host

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "m5-routes-"))
    const project = join(root, "-tmp-example-project")
    await mkdir(project)
    await writeFile(join(project, "s1.jsonl"), transcript())
    host = await startHost(root)
  })

  afterAll(async () => {
    await host.close()
  })

  it("reports every announced source, with the unfinished ones explaining themselves", async () => {
    const { status, body } = await getJson(host.base + SOURCES_PATH)
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    const sources = (
      body.value as { sources: { source: string; available: boolean; reason?: string; sessions?: number }[] }
    ).sources
    expect(sources.map((entry) => entry.source)).toEqual(["claude", "dsh", "codex"])
    expect(sources[0]).toMatchObject({ source: "claude", available: true, sessions: 1 })
    // Only Claude is configured in this fixture; the other two report a missing
    // corpus rather than pretending an adapter is pending.
    expect(sources[1]).toMatchObject({ source: "dsh", available: false, reason: "root-missing" })
    expect(sources[2]).toMatchObject({ source: "codex", available: false, reason: "root-missing" })
  })

  it("aggregates workdirs from the transcript cwd", async () => {
    const { status, body } = await getJson(host.base + WORKDIRS_PATH)
    expect(status).toBe(200)
    const workdirs = (body.value as { workdirs: { workdir: string; sessions: number; sources: unknown[] }[] }).workdirs
    expect(workdirs).toHaveLength(1)
    expect(workdirs[0]?.workdir).toBe(WORKDIR)
    expect(workdirs[0]?.sessions).toBe(1)
    expect(workdirs[0]?.sources).toHaveLength(1)
  })

  it("lists sessions from header facts only, then upgrades the row once parsed", async () => {
    const first = await getJson(`${host.base}${SESSIONS_PATH}?workdir=${encodeURIComponent(WORKDIR)}`)
    expect(first.status).toBe(200)
    const rows = (first.body.value as { sessions: { id: string; source: string; dataQuality: string[] }[] }).sessions
    expect(rows.map((row) => row.id)).toEqual(["s1"])
    expect(rows[0]?.source).toBe("claude")
    expect(rows[0]?.dataQuality).toContain("list-item-unparsed")

    // Opening the session fills the LRU, so the next list answer is parsed.
    await getJson(`${host.base}${SESSION_PATH}?source=claude&id=s1`)
    const second = await getJson(`${host.base}${SESSIONS_PATH}?workdir=${encodeURIComponent(WORKDIR)}`)
    const upgraded = (second.body.value as { sessions: { dataQuality: string[] }[] }).sessions
    expect(upgraded[0]?.dataQuality).not.toContain("list-item-unparsed")
  })

  it("requires the workdir parameter instead of silently listing everything", async () => {
    const { status, body } = await getJson(host.base + SESSIONS_PATH)
    expect(status).toBe(400)
    expect(body).toMatchObject({ ok: false, error: "bad-request", detail: "workdir-required" })
  })

  it("returns the IR with exact totals, paging fields and a visible residual", async () => {
    const { status, body } = await getJson(`${host.base}${SESSION_PATH}?source=claude&id=s1`)
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(isSessionDetail(body.value)).toBe(true)
    const detail = body.value as {
      session: {
        turns: {
          attribution: { total: { tokens: number; precision: string; basis: string }; residual?: { tokens: number } }
        }[]
      }
      turnCount: number
      offset: number
      limit: number
      meta: { bytes: number; residualTurns: number }
    }
    expect(detail.turnCount).toBe(2)
    expect(detail.offset).toBe(0)
    expect(detail.limit).toBe(60)
    // total is the logged usage and is never downgraded to a bare number.
    expect(detail.session.turns[0]?.attribution.total).toEqual({ tokens: 3000, precision: "exact", basis: "usage" })
    // Parts are estimates, so the gap stays an explicit residual.
    expect(detail.session.turns[0]?.attribution.residual?.tokens ?? 0).toBeGreaterThan(0)
    expect(detail.meta.residualTurns).toBe(2)
    expect(detail.meta.bytes).toBeGreaterThan(0)
  })

  it("serves the session from the LRU on the second read", async () => {
    const first = await getJson(`${host.base}${SESSION_PATH}?source=claude&id=s1`)
    const second = await getJson(`${host.base}${SESSION_PATH}?source=claude&id=s1`)
    const metaOf = (body: Record<string, unknown>): { cached: boolean; elapsedMs: number } =>
      (body.value as { meta: { cached: boolean; elapsedMs: number } }).meta
    expect(metaOf(second.body).cached).toBe(true)
    expect(metaOf(first.body).elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it("pages by turn and echoes the clamped offset", async () => {
    const page = await getJson(`${host.base}${SESSION_PATH}?source=claude&id=s1&turnOffset=0&turnLimit=1`)
    const value = page.body.value as { session: { turns: unknown[] }; turnCount: number; limit: number }
    expect(value.session.turns).toHaveLength(1)
    expect(value.limit).toBe(1)
    expect(value.turnCount).toBe(2)

    const beyond = await getJson(`${host.base}${SESSION_PATH}?source=claude&id=s1&turnOffset=99`)
    const clamped = beyond.body.value as { session: { turns: unknown[] }; offset: number }
    expect(clamped.session.turns).toHaveLength(0)
    expect(clamped.offset).toBe(2)
  })

  it("refuses an invalid turn window instead of guessing", async () => {
    for (const query of ["turnLimit=0", "turnLimit=abc", "turnLimit=-3", "turnOffset=1.5"]) {
      const { status, body } = await getJson(`${host.base}${SESSION_PATH}?source=claude&id=s1&${query}`)
      expect(status, query).toBe(400)
      expect(body, query).toMatchObject({ ok: false, error: "bad-request" })
    }
  })

  it("answers source-unavailable for a route whose adapter is not ready", async () => {
    const { status, body } = await getJson(`${host.base}${SESSION_PATH}?source=dsh&id=s1`)
    expect(status).toBe(503)
    expect(body).toMatchObject({ ok: false, error: "source-unavailable" })
  })

  it("refuses a traversal id before it can reach the filesystem", async () => {
    const traversal = await getJson(
      `${host.base}${SESSION_PATH}?source=claude&id=${encodeURIComponent("../../etc/passwd")}`
    )
    expect(traversal.status).toBe(400)
    expect(traversal.body).toMatchObject({ ok: false, error: "bad-request", detail: "invalid-session-id" })

    const encoded = await getJson(`${host.base}${SESSION_PATH}?source=claude&id=%2e%2e%2f%2e%2e%2fetc%2fpasswd`)
    expect(encoded.status).toBe(400)
  })

  it("answers not-found for a session that does not exist", async () => {
    const { status, body } = await getJson(`${host.base}${SESSION_PATH}?source=claude&id=does-not-exist`)
    expect(status).toBe(404)
    expect(body).toMatchObject({ ok: false, error: "not-found" })
  })

  it("refuses a non-GET method and names the allowed ones", async () => {
    const { status, body, headers } = await getJson(host.base + SOURCES_PATH, { method: "POST" })
    expect(status).toBe(405)
    expect(body).toMatchObject({ ok: false, error: "method-not-allowed" })
    expect(headers.get("allow")).toBe("GET, HEAD")
  })

  it("refuses a cross-origin request", async () => {
    const { status, body } = await getJson(host.base + SOURCES_PATH, { headers: { origin: "http://evil.example" } })
    expect(status).toBe(403)
    expect(body).toMatchObject({ ok: false, error: "forbidden" })
  })
})

describe("routes when the corpus root is missing", () => {
  it("reports the source as unavailable and keeps the page alive", async () => {
    const missing = join(await mkdtemp(join(tmpdir(), "m5-empty-")), "absent")
    const host = await startHost(missing)
    try {
      const sources = await getJson(host.base + SOURCES_PATH)
      expect(sources.status).toBe(200)
      const claude = (sources.body.value as { sources: { available: boolean; reason?: string }[] }).sources[0]
      expect(claude).toMatchObject({ available: false, reason: "root-missing" })

      const workdirs = await getJson(host.base + WORKDIRS_PATH)
      expect(workdirs.status).toBe(200)
      expect((workdirs.body.value as { workdirs: unknown[] }).workdirs).toEqual([])

      const session = await getJson(`${host.base}${SESSION_PATH}?source=claude&id=s1`)
      // 503, not 500: one source failing is a condition of that source.
      expect(session.status).toBe(503)
      expect(session.body).toMatchObject({ ok: false, error: "source-unavailable", detail: "root-missing" })
    } finally {
      await host.close()
    }
  })
})
