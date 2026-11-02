import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Session } from "@cyrusdoyle/dsh-session-contract"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createRoutes, type RouteDeps } from "../src/host/http/routes.ts"
import { SessionMetadataStore } from "../src/host/management/store.ts"
import type { SearchCandidate, SessionSource, SourceFailure } from "../src/host/sources/source.ts"
import { SEARCH_PATH, SESSION_DELETE_PATH, SESSION_PATH, SESSIONS_PATH, type SessionSummary } from "../src/protocol.ts"
import { isMetadataValue, isSessionMetadataValue, SESSION_METADATA_PATH } from "../src/protocol/management.ts"

const ref = { source: "claude", id: "session-1" } as const
const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

async function fixture(cacheTtlMs = 60_000, available = true) {
  const root = await mkdtemp(join(tmpdir(), "insight-management-http-"))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  const store = new SessionMetadataStore(join(root, "metadata.json"))
  const session = Object.freeze<Session>({
    ...ref,
    title: "Original title",
    workdir: "/work",
    createdAt: 1,
    updatedAt: 2,
    turns: [
      {
        index: 1,
        startedAt: 1,
        userInput: ["first input"],
        assistantText: ["body needle"],
        toolCalls: [],
        compactions: [],
        subagents: [],
        attribution: { total: { tokens: 1, precision: "exact", basis: "usage" }, parts: [] },
      },
    ],
    segments: [],
    dataQuality: [],
  })
  const row: SessionSummary = Object.freeze({
    ...ref,
    title: "Original title",
    workdir: "/work",
    updatedAt: 2,
    bytes: 1,
    dataQuality: [],
  })
  const candidate: SearchCandidate = Object.freeze({
    id: ref.id,
    title: "Original title",
    workdir: "/work",
    updatedAt: 2,
  })
  const source: SessionSource = {
    id: "claude",
    status: async () => ({ source: "claude", available: true, sessions: 1, lastScanAt: 1 }),
    workdirs: async () => [],
    list: vi.fn(async () => [row]),
    candidates: async () => [candidate],
    detail: vi.fn(async (id: string) =>
      id === ref.id
        ? { ok: true as const, session, bytes: 1, elapsedMs: 0, cached: true }
        : { ok: false as const, error: "not-found" as const, detail: "missing" },
    ),
    segmentInfo: async () => [],
    invalidate: vi.fn(),
    remove: vi.fn(async () => ({ ok: true as const })),
  }
  const deps: RouteDeps = { sources: [source], version: "test", cacheTtlMs, ...(available ? { metadata: store } : {}) }
  const routes = createRoutes(deps)
  const server = createServer((req, res) => {
    const route = routes.find((item) => item.path === new URL(req.url!, "http://localhost").pathname)
    if (route === undefined) {
      res.writeHead(404)
      res.end()
      return
    }
    route.handler(req, res)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  cleanup.push(
    () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  )
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const get = async (path: string) => (await fetch(base + path)).json()
  const post = (body: unknown, path = SESSION_METADATA_PATH, headers: Record<string, string> = {}) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  return { store, source, session, row, candidate, deps, base, get, post }
}

const listPath = `${SESSIONS_PATH}?workdir=%2Fwork`
const detailPath = `${SESSION_PATH}?source=claude&id=session-1`

function searchPath(q: string, tier = "fast") {
  return `${SEARCH_PATH}?q=${encodeURIComponent(q)}&source=claude&tier=${tier}`
}

describe("session management HTTP", () => {
  it.each([60_000, 0])("projects current aliases onto fresh and stale list answers (ttl %s)", async (ttl) => {
    const { source, store, get, post, row, candidate, session } = await fixture(ttl)
    expect((await get(listPath)).value.sessions[0].title).toBe("Original title")
    const patched = await (await post({ ...ref, title: "Manual alias", group: "Logical group" })).json()
    expect(isSessionMetadataValue(patched.value)).toBe(true)
    expect(patched.value).toEqual({
      metadata: { ...ref, title: "Manual alias", group: "Logical group" },
      displayTitle: "Manual alias",
    })
    expect((await get(listPath)).value.sessions[0]).toMatchObject({ title: "Manual alias", workdir: "/work" })
    if (ttl !== 0) expect(source.list).toHaveBeenCalledTimes(1)
    expect(source.invalidate).not.toHaveBeenCalled()
    expect((await get(detailPath)).value.session.title).toBe("Manual alias")
    expect(row.title).toBe("Original title")
    expect(session.title).toBe("Original title")
    expect(candidate.title).toBe("Original title")
    expect(isMetadataValue((await get(SESSION_METADATA_PATH)).value)).toBe(true)
    await store.patch({ ...ref, source: "dsh", title: "Other source" })
    const restored = await (await post({ ...ref, title: null })).json()
    expect(restored.value).toEqual({ metadata: { ...ref, group: "Logical group" }, displayTitle: "Original title" })
    expect((await get(listPath)).value.sessions[0].title).toBe("Original title")
    expect((await get(detailPath)).value.session.title).toBe("Original title")
  })

  it("searches aliases in both tiers, keeps original title searchable, and projects body hits", async () => {
    const { get, post } = await fixture()
    await post({ ...ref, title: "Manual alias" })
    for (const tier of ["fast", "deep"]) {
      expect((await get(searchPath("manual", tier))).value.hits[0]).toMatchObject({
        sessionId: ref.id,
        title: "Manual alias",
        field: "metadata",
      })
    }
    expect((await get(searchPath("original"))).value.hits[0].title).toBe("Manual alias")
    expect((await get(searchPath("needle", "deep"))).value.hits[0]).toMatchObject({
      title: "Manual alias",
      field: "assistant",
    })
    await post({ ...ref, title: null })
    expect((await get(searchPath("manual"))).value.hits).toEqual([])
    expect((await get(searchPath("needle", "deep"))).value.hits[0].title).toBe("Original title")
  })

  it("guards methods, origin, content type, references and unknown sessions", async () => {
    const { base, post, get } = await fixture()
    expect((await fetch(base + SESSION_METADATA_PATH, { method: "DELETE" })).status).toBe(405)
    expect((await fetch(base + SESSION_METADATA_PATH, { method: "HEAD" })).status).toBe(200)
    expect(
      (await post({ ...ref, title: "x" }, SESSION_METADATA_PATH, { origin: "https://attacker.example" })).status,
    ).toBe(403)
    expect((await post({ ...ref, title: "x" }, SESSION_METADATA_PATH, { "sec-fetch-site": "cross-site" })).status).toBe(
      403,
    )
    expect((await post({ ...ref, title: "x" }, SESSION_METADATA_PATH, { "content-type": "text/plain" })).status).toBe(
      400,
    )
    for (const body of [
      { ...ref, id: "../escape", title: "x" },
      { ...ref, title: " " },
      { ...ref, title: "x", cwd: "/fake" },
    ]) {
      expect((await post(body)).status).toBe(400)
    }
    expect((await post({ ...ref, id: "missing", title: "x" })).status).toBe(404)
    expect((await post({ ...ref, source: "codex", title: "x" })).status).toBe(503)
    expect((await get(SESSION_METADATA_PATH)).value.entries).toEqual([])
  })

  it("keeps metadata on deletion refusal and removes only its source key on success", async () => {
    const { store, source, post } = await fixture()
    await store.patch({ ...ref, title: "manual", group: "group" })
    await store.patch({ ...ref, source: "dsh", title: "keep" })
    vi.mocked(source.remove!).mockResolvedValueOnce({
      ok: false,
      error: "forbidden",
      detail: "shared-session-logs",
    } satisfies SourceFailure)
    expect((await post(ref, SESSION_DELETE_PATH)).status).toBe(403)
    expect((await store.read()).entries).toHaveLength(2)
    expect((await post(ref, SESSION_DELETE_PATH)).status).toBe(200)
    expect(await store.read()).toEqual({ entries: [{ ...ref, source: "dsh", title: "keep" }] })
  })

  it("reports original-log deletion success even when metadata cleanup fails", async () => {
    const { store, post } = await fixture()
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {})
    const remove = vi.spyOn(store, "remove").mockRejectedValueOnce(new Error("disk-failure"))
    try {
      const response = await post(ref, SESSION_DELETE_PATH)
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        ok: true,
        value: { ...ref, metadataWarning: "metadata-cleanup-failed" },
      })
    } finally {
      remove.mockRestore()
      warning.mockRestore()
    }
  })

  it("reports unavailable metadata and storage failures without invalidating readers", async () => {
    const absent = await fixture(60_000, false)
    expect((await fetch(absent.base + SESSION_METADATA_PATH)).status).toBe(503)
    const { store, source, post } = await fixture()
    vi.spyOn(store, "patch").mockRejectedValueOnce(new Error("disk-failure"))
    expect((await post({ ...ref, title: "x" })).status).toBe(422)
    expect(await store.read()).toEqual({ entries: [] })
    expect(source.invalidate).not.toHaveBeenCalled()
  })
})
