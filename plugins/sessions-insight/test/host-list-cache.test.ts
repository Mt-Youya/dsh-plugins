import type { IncomingMessage, ServerResponse } from "node:http"

import { afterEach, describe, expect, it, vi } from "vitest"

import * as lists from "../src/host/http/list-cache.ts"
import { handleSession, handleSessions, handleWorkdirs, type RouteDeps } from "../src/host/http/routes.ts"
import type { RouteHandler } from "../src/host/http/server.ts"
import type { SessionSource } from "../src/host/sources/source.ts"
import { SESSION_PATH, SESSIONS_PATH, type WorkdirEntry, WORKDIRS_PATH } from "../src/protocol.ts"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}

function response() {
  let body = ""
  const done = deferred<Record<string, any>>()
  const mock = {
    headersSent: false,
    writeHead() {
      mock.headersSent = true
      return mock
    },
    end(value?: string) {
      body += value ?? ""
      done.resolve(JSON.parse(body))
      return mock
    },
  }
  return { res: mock as unknown as ServerResponse, done: done.promise }
}

function request(handler: RouteHandler, url: string) {
  const { res, done } = response()
  handler({ method: "GET", url, headers: { host: "localhost" } } as IncomingMessage, res)
  return done
}

function workdir(path: string, at: number): WorkdirEntry {
  return {
    workdir: path,
    sessions: 1,
    lastUpdatedAt: at,
    sources: [{ source: "codex", sessions: 1, lastUpdatedAt: at }],
  }
}

function fixture() {
  const source: SessionSource = {
    id: "codex",
    status: vi.fn<SessionSource["status"]>(async () => ({ source: "codex", available: true })),
    workdirs: vi.fn(async () => [workdir("/older", 1), workdir("/newest", 2)]),
    list: vi.fn<SessionSource["list"]>(async (path) => [
      { source: "codex", id: "one", workdir: path, bytes: 1, updatedAt: 1, dataQuality: [] },
    ]),
    detail: vi.fn<SessionSource["detail"]>(async () => ({
      ok: true,
      session: {
        source: "codex",
        id: "one",
        workdir: "/newest",
        createdAt: 1,
        updatedAt: 1,
        turns: [],
        segments: [],
        dataQuality: [],
      },
      bytes: 1,
      elapsedMs: 1,
      cached: false,
    })),
    segmentInfo: vi.fn(async () => []),
    candidates: vi.fn(async () => []),
    invalidate: vi.fn(),
  }
  const deps: RouteDeps = { sources: [source], version: "test" }
  return { source, deps }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("list cache concurrency", () => {
  it("coalesces cold requests and stale revalidations", async () => {
    const { deps } = fixture()
    const cold = deferred<{ rows: number[] }>()
    const compute = vi.fn(() => cold.promise)
    const a = response(),
      b = response()
    const requests = [
      lists.serveList(deps, "key", false, a.res, compute),
      lists.serveList(deps, "key", false, b.res, compute),
    ]
    expect(compute).toHaveBeenCalledTimes(1)
    cold.resolve({ rows: [1] })
    await Promise.all(requests)
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + lists.LIST_TTL_MS + 1)
    const stale = deferred<{ rows: number[] }>()
    compute.mockImplementation(() => stale.promise)
    const c = response(),
      d = response()
    await Promise.all([
      lists.serveList(deps, "key", false, c.res, compute),
      lists.serveList(deps, "key", false, d.res, compute),
    ])
    expect(await c.done).toMatchObject({ value: { stale: true, refreshing: true } })
    expect(compute).toHaveBeenCalledTimes(2)
    stale.resolve({ rows: [2] })
    await stale.promise
  })

  it("retries after a failed shared read instead of keeping rejected inflight", async () => {
    const { deps } = fixture()
    const compute = vi.fn(async () => {
      throw new Error("read failed")
    })
    await expect(lists.serveList(deps, "key", false, response().res, compute)).rejects.toThrow("read failed")
    const answer = response()
    await lists.serveList(deps, "key", false, answer.res, async () => ({ rows: [2] }))
    expect(await answer.done).toMatchObject({ value: { rows: [2] } })
  })

  it("does not restore a detached cache after deletion invalidates it", async () => {
    const { deps } = fixture()
    const old = deferred<{ rows: number[] }>()
    const pending = lists.serveList(deps, "key", false, response().res, () => old.promise)
    lists.clearListCache(deps)
    await lists.serveList(deps, "key", false, response().res, async () => ({ rows: [2] }))
    old.resolve({ rows: [1] })
    await pending
    const result = response()
    const compute = vi.fn(async () => ({ rows: [3] }))
    await lists.serveList(deps, "key", false, result.res, compute)
    expect(await result.done).toMatchObject({ value: { rows: [2] } })
    expect(compute).not.toHaveBeenCalled()
  })

  it("refresh detaches all old inflight lists, not just the refreshed key", async () => {
    const { deps, source } = fixture()
    const old = deferred<WorkdirEntry[]>()
    vi.mocked(source.workdirs).mockImplementationOnce(() => old.promise)
    const pending = request(handleWorkdirs(deps), WORKDIRS_PATH)
    await request(handleSessions(deps), `${SESSIONS_PATH}?workdir=/newest&refresh=1`)
    old.resolve([workdir("/deleted", 9)])
    await pending
    const answer = await request(handleWorkdirs(deps), WORKDIRS_PATH)
    expect(answer.value.workdirs[0].workdir).toBe("/newest")
    expect(source.workdirs).toHaveBeenCalledTimes(2)
  })

  it("detail invalidates only its workdir sessions, including filtered variants and inflight", async () => {
    const { deps, source } = fixture()
    await request(handleWorkdirs(deps), WORKDIRS_PATH)
    const handler = handleSessions(deps)
    await request(handler, `${SESSIONS_PATH}?workdir=/older`)
    await request(handler, `${SESSIONS_PATH}?workdir=/newest&source=codex&includeSubagents=1`)
    const old = deferred<Awaited<ReturnType<SessionSource["list"]>>>()
    vi.mocked(source.list).mockImplementationOnce(() => old.promise)
    const pending = request(handler, `${SESSIONS_PATH}?workdir=/newest`)
    await request(handleSession(deps), `${SESSION_PATH}?source=codex&id=one`)
    old.resolve([])
    await pending
    await request(handleWorkdirs(deps), WORKDIRS_PATH)
    await request(handler, `${SESSIONS_PATH}?workdir=/older`)
    expect(source.workdirs).toHaveBeenCalledTimes(1)
    expect(source.list).toHaveBeenCalledTimes(3)
    const answer = await request(handler, `${SESSIONS_PATH}?workdir=/newest`)
    expect(answer.value.sessions).toHaveLength(1)
    await request(handler, `${SESSIONS_PATH}?workdir=/newest&source=codex&includeSubagents=1`)
    expect(source.list).toHaveBeenCalledTimes(5)
  })
})

describe("metadata preload", () => {
  it("warms default workdirs and only the newest workdir, sharing ordinary requests", async () => {
    const { deps, source } = fixture()
    const gate = deferred<WorkdirEntry[]>()
    vi.mocked(source.workdirs).mockImplementationOnce(() => gate.promise)
    const preload = lists.preloadLists(deps)
    const pending = request(handleWorkdirs(deps), WORKDIRS_PATH)
    gate.resolve([workdir("/older", 1), workdir("/newest", 2)])
    await Promise.all([preload, pending])
    await request(handleWorkdirs(deps), WORKDIRS_PATH)
    await request(handleSessions(deps), `${SESSIONS_PATH}?workdir=/newest`)
    expect(source.workdirs).toHaveBeenCalledTimes(1)
    expect(source.list).toHaveBeenCalledExactlyOnceWith("/newest", { includeSubagents: false })
    expect(source.detail).not.toHaveBeenCalled()
    expect(source.status).not.toHaveBeenCalled()
  })

  it("shares an in-flight sessions request and drops its result when disposed", async () => {
    const { deps, source } = fixture()
    const gate = deferred<Awaited<ReturnType<SessionSource["list"]>>>()
    vi.mocked(source.list).mockImplementationOnce(() => gate.promise)
    const cancelled = { aborted: false }
    const preload = lists.preloadLists(deps, cancelled)
    await vi.waitFor(() => expect(source.list).toHaveBeenCalledTimes(1))
    const pending = request(handleSessions(deps), `${SESSIONS_PATH}?workdir=/newest`)
    expect(source.list).toHaveBeenCalledTimes(1)
    cancelled.aborted = true
    lists.clearListCache(deps)
    gate.resolve([])
    await Promise.all([preload, pending])
    const answer = await request(handleSessions(deps), `${SESSIONS_PATH}?workdir=/newest`)
    expect(answer.value.sessions).toHaveLength(1)
    expect(source.list).toHaveBeenCalledTimes(2)
    expect(source.detail).not.toHaveBeenCalled()
  })

  it("does not preload sessions or resurrect caches after invalidation", async () => {
    const { deps, source } = fixture()
    const gate = deferred<WorkdirEntry[]>()
    vi.mocked(source.workdirs).mockImplementationOnce(() => gate.promise)
    const preload = lists.preloadLists(deps)
    lists.clearListCache(deps)
    gate.resolve([workdir("/deleted", 9)])
    await preload
    expect(source.list).not.toHaveBeenCalled()
    await request(handleWorkdirs(deps), WORKDIRS_PATH)
    expect(source.workdirs).toHaveBeenCalledTimes(2)
  })

  it("cancels before starting and between workdirs and sessions", async () => {
    const { deps, source } = fixture()
    const controller = new AbortController()
    controller.abort()
    await lists.preloadLists(deps, controller.signal)
    expect(source.workdirs).not.toHaveBeenCalled()
    const gate = deferred<WorkdirEntry[]>()
    vi.mocked(source.workdirs).mockImplementationOnce(() => gate.promise)
    const running = new AbortController()
    const preload = lists.preloadLists(deps, running.signal)
    running.abort()
    lists.clearListCache(deps)
    gate.resolve([workdir("/newest", 2)])
    await preload
    expect(source.list).not.toHaveBeenCalled()
  })

  it("isolates failed sources and handles an empty corpus", async () => {
    const { deps, source } = fixture()
    vi.mocked(source.workdirs).mockRejectedValue(new Error("broken"))
    await lists.preloadLists(deps)
    const answer = await request(handleWorkdirs(deps), WORKDIRS_PATH)
    expect(answer.value.failures).toMatchObject([{ source: "codex", error: "adapter-error" }])
    expect(answer.value.workdirs).toEqual([])
    expect(source.list).not.toHaveBeenCalled()
  })
})
