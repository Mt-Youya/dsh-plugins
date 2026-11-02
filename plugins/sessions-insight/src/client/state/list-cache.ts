import type { ContextSource, SessionSummary, SessionsValue, SourcesValue, WorkdirsValue } from "../../protocol.ts"
import type { SessionMetadataValue } from "../../protocol/management.ts"
import type { ApiResult } from "../api.ts"

interface PendingRead {
  promise: Promise<ApiResult<unknown>>
  controller: AbortController
  readers: number
}

/** Metadata only, shared by preload, panel and tree for one API origin. */
export class ClientListCache {
  sources?: SourcesValue
  workdirs?: WorkdirsValue
  readonly sessions = new Map<string, SessionsValue>()
  readonly #metadata = new Map<string, SessionMetadataValue>()
  readonly #labels = new Map<string, Pick<SessionSummary, "title" | "firstInput" | "bytes" | "updatedAt">>()

  projectSessions(value: SessionsValue): SessionsValue {
    return {
      ...value,
      sessions: value.sessions.map((row) => {
        const key = `${row.source}:${row.id}`
        const label = this.#labels.get(key)
        const next =
          label !== undefined && label.bytes === row.bytes && label.updatedAt === row.updatedAt
            ? {
                ...row,
                ...(label.title === undefined ? {} : { title: label.title }),
                ...(label.firstInput === undefined ? {} : { firstInput: label.firstInput }),
              }
            : row
        const update = this.#metadata.get(key)
        if (update === undefined) return next
        const projected = { ...next }
        if (update.displayTitle === undefined) delete projected.title
        else projected.title = update.displayTitle
        return projected
      }),
    }
  }
  readonly #pending = new Map<string, PendingRead>()
  readonly #listeners = new Set<() => void>()
  #deletion = 0
  readonly deletionVersion = (): number => this.#deletion
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /** Keep visible rows, but prevent superseded requests from restoring them. */
  invalidateRequests(keys: Iterable<string> = this.#pending.keys()): void {
    for (const key of keys) {
      const pending = this.#pending.get(key)
      this.#pending.delete(key)
      pending?.controller.abort()
    }
  }

  async read<T>(
    key: string,
    load: (signal: AbortSignal) => Promise<ApiResult<T>>,
    save: (value: T) => void,
    signal?: AbortSignal,
  ): Promise<ApiResult<T>> {
    if (signal?.aborted) return { ok: false, error: "aborted" }
    let pending = this.#pending.get(key)
    if (pending === undefined) {
      const controller = new AbortController()
      const promise = load(controller.signal)
        .then((result): ApiResult<T> => {
          if (this.#pending.get(key) !== pending) return { ok: false, error: "aborted" }
          if (result.ok) save(result.value)
          return result
        })
        .finally(() => {
          if (this.#pending.get(key) === pending) this.#pending.delete(key)
        })
      pending = { controller, promise, readers: 0 }
      this.#pending.set(key, pending)
    }
    const entry = pending
    entry.readers += 1
    return new Promise<ApiResult<T>>((resolve, reject) => {
      let finished = false
      const finish = (result?: ApiResult<T>, error?: unknown): void => {
        if (finished) return
        finished = true
        signal?.removeEventListener("abort", abort)
        entry.readers -= 1
        if (entry.readers === 0 && this.#pending.get(key) === entry) {
          this.#pending.delete(key)
          entry.controller.abort()
        }
        if (result !== undefined) resolve(result)
        else reject(error)
      }
      const abort = (): void => finish({ ok: false, error: "aborted" })
      signal?.addEventListener("abort", abort, { once: true })
      entry.promise.then(
        (result) => finish(result as ApiResult<T>),
        (error: unknown) => finish(undefined, error),
      )
      if (signal?.aborted) abort()
    })
  }

  /** Share labels learned by opening a log without reloading directory lists. */
  learnSessionLabel(
    session: Pick<SessionSummary, "source" | "id" | "workdir" | "bytes" | "updatedAt" | "title" | "firstInput">,
  ): void {
    const key = `${session.source}:${session.id}`
    const list = this.sessions.get(session.workdir)
    const row = list?.sessions.find((item) => item.source === session.source && item.id === session.id)
    const prior = this.#labels.get(key)
    const updatedAt = row?.updatedAt ?? session.updatedAt
    const unchanged = prior?.bytes === session.bytes && prior.updatedAt === updatedAt
    const title = session.title?.trim() || (unchanged ? prior.title : undefined)
    const firstInput = session.firstInput?.trim() || (unchanged ? prior.firstInput : undefined)
    if (unchanged && prior.title === title && prior.firstInput === firstInput) return
    if (title === undefined && firstInput === undefined) return
    this.#labels.set(key, {
      bytes: session.bytes,
      updatedAt,
      ...(title === undefined ? {} : { title }),
      ...(firstInput === undefined ? {} : { firstInput }),
    })
    if (list === undefined) return
    this.sessions.set(session.workdir, this.projectSessions(list))
    this.#deletion += 1
    for (const listener of this.#listeners) listener()
  }

  rename(value: SessionMetadataValue): void {
    const { source, id } = value.metadata
    this.#metadata.set(`${source}:${id}`, value)
    for (const [workdir, list] of this.sessions) {
      if (!list.sessions.some((row) => row.source === source && row.id === id)) continue
      this.invalidateRequests([`sessions:${workdir}`])
      this.sessions.set(workdir, {
        ...list,
        sessions: list.sessions.map((row) => {
          if (row.source !== source || row.id !== id) return row
          const next = { ...row }
          if (value.displayTitle === undefined) delete next.title
          else next.title = value.displayTitle
          return next
        }),
      })
    }
    this.#deletion += 1
    for (const listener of this.#listeners) listener()
  }

  remove(deleted: { source: ContextSource; id: string; workdir: string }): void {
    this.#labels.delete(`${deleted.source}:${deleted.id}`)
    this.invalidateRequests(["sources", "workdirs:false", "workdirs:true", `sessions:${deleted.workdir}`])
    for (const [workdir, value] of this.sessions) {
      this.sessions.set(workdir, {
        ...value,
        sessions: value.sessions.filter((row) => row.source !== deleted.source || row.id !== deleted.id),
      })
    }
    if (this.sources !== undefined) {
      this.sources = {
        sources: this.sources.sources.map((row) =>
          row.source === deleted.source && row.sessions !== undefined
            ? { ...row, sessions: Math.max(0, row.sessions - 1) }
            : row,
        ),
      }
    }
    if (this.workdirs !== undefined) {
      this.workdirs = {
        ...this.workdirs,
        workdirs: this.workdirs.workdirs
          .map((row) => {
            if (row.workdir !== deleted.workdir) return row
            const remaining = this.sessions.get(row.workdir)?.sessions
            const sources = row.sources
              .map((group) => {
                if (group.source !== deleted.source) return group
                const entries = remaining?.filter((session) => session.source === group.source)
                return {
                  ...group,
                  sessions: Math.max(0, group.sessions - 1),
                  lastUpdatedAt:
                    entries === undefined
                      ? group.lastUpdatedAt
                      : Math.max(0, ...entries.map((entry) => entry.updatedAt)),
                }
              })
              .filter((group) => group.sessions > 0)
            return {
              ...row,
              sessions: sources.reduce((sum, group) => sum + group.sessions, 0),
              lastUpdatedAt: Math.max(0, ...sources.map((group) => group.lastUpdatedAt)),
              sources,
            }
          })
          .filter((row) => row.sessions > 0),
      }
    }
    this.#deletion += 1
    for (const listener of this.#listeners) listener()
  }
}

const CACHES = new Map<string, ClientListCache>()
export function clientListCache(base = ""): ClientListCache {
  let cache = CACHES.get(base)
  if (cache === undefined) {
    cache = new ClientListCache()
    CACHES.set(base, cache)
  }
  return cache
}
