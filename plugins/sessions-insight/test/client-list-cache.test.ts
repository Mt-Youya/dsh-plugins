import { afterEach, describe, expect, it, vi } from "vitest"

import { createApi, preloadSessionLists } from "../src/client/api.ts"
import { ClientListCache, clientListCache } from "../src/client/state/list-cache.ts"
import type { SessionsValue } from "../src/protocol.ts"

const row = { source: "claude" as const, id: "s1", workdir: "/tmp/a", updatedAt: 10, bytes: 10, dataQuality: [] }
const value: SessionsValue = { workdir: row.workdir, sessions: [row, { ...row, source: "codex" }], failures: [] }
afterEach(() => vi.restoreAllMocks())

describe("client metadata cache", () => {
  it("coalesces panel and tree requests without one abort cancelling the other", async () => {
    const cache = new ClientListCache()
    let finish!: (value: { ok: true; value: SessionsValue }) => void
    const load = vi.fn(
      () =>
        new Promise<{ ok: true; value: SessionsValue }>((resolve) => {
          finish = resolve
        }),
    )
    const save = vi.fn()
    const controller = new AbortController()
    const first = cache.read("sessions", load, save, controller.signal)
    const second = cache.read("sessions", load, save)
    controller.abort()
    finish({ ok: true, value })
    expect(await first).toEqual({ ok: false, error: "aborted" })
    expect(await second).toEqual({ ok: true, value })
    expect(load).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledOnce()
  })

  it("locally removes only the matching source and updates directory/source counts", () => {
    const cache = new ClientListCache()
    cache.sessions.set(row.workdir, value)
    cache.workdirs = {
      scannedAt: 1,
      failures: [],
      workdirs: [
        {
          workdir: row.workdir,
          sessions: 2,
          lastUpdatedAt: 10,
          sources: [
            { source: "claude", sessions: 1, lastUpdatedAt: 10 },
            { source: "codex", sessions: 1, lastUpdatedAt: 10 },
          ],
        },
      ],
    }
    cache.sources = { sources: [{ source: "claude", available: true, sessions: 1 }] }
    cache.remove(row)
    expect(cache.sessions.get(row.workdir)?.sessions).toEqual([{ ...row, source: "codex" }])
    expect(cache.workdirs.workdirs[0]).toMatchObject({ sessions: 1, sources: [{ source: "codex", sessions: 1 }] })
    expect(cache.sources.sources[0]?.sessions).toBe(0)
    cache.remove({ ...row, source: "codex" })
    expect(cache.workdirs.workdirs).toEqual([])
  })

  it("does not restore deleted sessions from an older in-flight response", async () => {
    const cache = new ClientListCache()
    let finish!: (value: { ok: true; value: SessionsValue }) => void
    const pending = cache.read(
      `sessions:${row.workdir}`,
      () =>
        new Promise<{ ok: true; value: SessionsValue }>((resolve) => {
          finish = resolve
        }),
      (result) => cache.sessions.set(row.workdir, result),
    )
    cache.sessions.set(row.workdir, value)
    cache.remove(row)
    finish({ ok: true, value })
    expect(await pending).toEqual({ ok: false, error: "aborted" })
    expect(cache.sessions.get(row.workdir)?.sessions).toHaveLength(1)
  })

  it("does not interrupt another directory when deleting a session", async () => {
    const cache = new ClientListCache()
    let finish!: (value: { ok: true; value: SessionsValue }) => void
    const pending = cache.read(
      "sessions:/tmp/b",
      () =>
        new Promise<{ ok: true; value: SessionsValue }>((resolve) => {
          finish = resolve
        }),
      (result) => cache.sessions.set("/tmp/b", result),
    )
    cache.remove(row)
    finish({ ok: true, value })
    expect(await pending).toEqual({ ok: true, value })
  })

  it("aborts an unused shared request immediately so reopening can retry", async () => {
    const cache = new ClientListCache()
    const controller = new AbortController()
    let shared!: AbortSignal
    const pending = cache.read(
      "sessions",
      (signal) => {
        shared = signal
        return new Promise(() => {})
      },
      () => {},
      controller.signal,
    )
    controller.abort()
    expect(await pending).toEqual({ ok: false, error: "aborted" })
    expect(shared.aborted).toBe(true)
    expect(
      await cache.read(
        "sessions",
        async () => ({ ok: true, value }),
        () => {},
      ),
    ).toEqual({ ok: true, value })
  })

  it("notifies a remounted tree about completed deletions", () => {
    const cache = new ClientListCache()
    const listener = vi.fn()
    const unsubscribe = cache.subscribe(listener)
    cache.remove(row)
    expect(listener).toHaveBeenCalledOnce()
    expect(cache.deletionVersion()).toBe(1)
    unsubscribe()
    cache.remove(row)
    expect(listener).toHaveBeenCalledOnce()
  })

  it("projects the latest name over a cold response that started before renaming", () => {
    const cache = new ClientListCache()
    cache.rename({ metadata: { source: "claude", id: row.id, title: "New" }, displayTitle: "New" })
    expect(cache.projectSessions(value).sessions[0]?.title).toBe("New")
    expect(cache.projectSessions(value).sessions[1]?.title).toBeUndefined()
  })

  it("does not turn a display fallback into a real name after moving or restoring", () => {
    const cache = new ClientListCache()
    cache.sessions.set(row.workdir, { ...value, sessions: [{ ...row, title: "Alias" }] })
    cache.rename({ metadata: { source: "claude", id: row.id, group: "Group" } })
    expect(cache.sessions.get(row.workdir)?.sessions[0]?.title).toBeUndefined()
  })

  it("publishes a detail title to the visible list and keeps it over a stale list response", () => {
    const cache = new ClientListCache()
    cache.sessions.set(row.workdir, value)
    const listener = vi.fn()
    cache.subscribe(listener)
    cache.learnSessionLabel({ ...row, title: "Actual session title", firstInput: "Question" })
    expect(cache.sessions.get(row.workdir)?.sessions[0]?.title).toBe("Actual session title")
    expect(cache.sessions.get(row.workdir)?.sessions[1]?.title).toBeUndefined()
    expect(cache.projectSessions(value).sessions[0]?.title).toBe("Actual session title")
    expect(listener).toHaveBeenCalledOnce()
    cache.learnSessionLabel({ ...row, title: "Actual session title", firstInput: "Question" })
    expect(listener).toHaveBeenCalledOnce()
    expect(cache.projectSessions({ ...value, sessions: [{ ...row, bytes: 20 }] }).sessions[0]?.title).toBeUndefined()
  })

  it("keeps explicit rename and restore decisions above learned detail labels", () => {
    const cache = new ClientListCache()
    cache.sessions.set(row.workdir, value)
    cache.learnSessionLabel({ ...row, title: "Original" })
    cache.rename({ metadata: { source: "claude", id: row.id, title: "Alias" }, displayTitle: "Alias" })
    cache.learnSessionLabel({ ...row, title: "Delayed original" })
    expect(cache.projectSessions(value).sessions[0]?.title).toBe("Alias")
    cache.rename({ metadata: { source: "claude", id: row.id } })
    expect(cache.projectSessions(value).sessions[0]?.title).toBeUndefined()
  })

  it("learns a title before its list arrives, but never turns first input into a name", () => {
    const cache = new ClientListCache()
    cache.learnSessionLabel({ ...row, title: "", firstInput: "Prompt excerpt" })
    expect(cache.projectSessions(value).sessions[0]).toMatchObject({ firstInput: "Prompt excerpt" })
    expect(cache.projectSessions(value).sessions[0]?.title).toBeUndefined()
    cache.learnSessionLabel({ ...row, title: "Title" })
    expect(cache.projectSessions(value).sessions[0]?.title).toBe("Title")
    cache.remove(row)
    expect(cache.projectSessions(value).sessions[0]?.title).toBeUndefined()
  })

  it("learns decoded detail labels without requesting the directory again", async () => {
    const base = "/detail-label-test/"
    const cache = clientListCache(base)
    cache.sessions.set(row.workdir, value)
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          value: {
            session: { ...row, title: "Full log title", createdAt: 1, turns: [], segments: [], firstInput: "Question" },
            turnCount: 0,
            offset: 0,
            limit: 40,
            meta: { cached: false, elapsedMs: 1, bytes: row.bytes, residualTurns: 0, reconciledTurns: 0 },
          },
        }),
      ),
    )
    const learn = vi.spyOn(cache, "learnSessionLabel")
    const result = await createApi(base).session(row.id, 0, 40, row.source)
    expect(result.ok).toBe(true)
    expect(learn).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Full log title", bytes: row.bytes, workdir: row.workdir }),
    )
    expect(cache.sessions.get(row.workdir)?.sessions[0]?.title).toBe("Full log title")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it("uses the requested DSH list identity when the log header retains a session- prefix", async () => {
    const base = "/dsh-title-identity/"
    const cache = clientListCache(base)
    const dsh = { ...row, source: "dsh" as const }
    cache.sessions.set(row.workdir, { ...value, sessions: [dsh] })
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          value: {
            session: {
              ...dsh,
              id: `session-${row.id}`,
              title: "Late DSH title",
              createdAt: 1,
              turns: [],
              segments: [],
            },
            turnCount: 0,
            offset: 0,
            limit: 40,
            meta: { cached: false, elapsedMs: 1, bytes: row.bytes, residualTurns: 0, reconciledTurns: 0 },
          },
        }),
      ),
    )
    expect((await createApi(base).session(row.id, 0, 40, "dsh")).ok).toBe(true)
    expect(cache.sessions.get(row.workdir)?.sessions[0]?.title).toBe("Late DSH title")
  })

  it("preloads navigation before mounting and never requests session bodies", async () => {
    const base = "/preload-test/"
    const workdirs = {
      scannedAt: 1,
      failures: [],
      workdirs: [
        {
          workdir: row.workdir,
          sessions: 2,
          lastUpdatedAt: 10,
          sources: [{ source: "claude", sessions: 2, lastUpdatedAt: 10 }],
        },
      ],
    }
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const data = String(url).includes("/sources")
        ? { sources: [] }
        : String(url).includes("/workdirs")
          ? workdirs
          : value
      return new Response(JSON.stringify({ ok: true, value: data }))
    })
    await preloadSessionLists(createApi(base))
    expect(clientListCache(base).workdirs).toEqual(workdirs)
    expect(clientListCache(base).sessions.get(row.workdir)).toEqual(value)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls.map(([url]) => String(url))).not.toContain(expect.stringContaining("/session?"))
  })
})
