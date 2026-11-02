import type { ServerResponse } from "node:http"

import type { ContextSource } from "../../protocol.ts"
import type { WorkdirOptions } from "../sources/source.ts"
import { computeSessions, computeWorkdirs, type RouteDeps } from "./routes.ts"
import { writeOk } from "./server.ts"

/** Default freshness window for list answers. */
export const LIST_TTL_MS = 15_000

interface ListEntry {
  at: number
  value?: unknown
  inflight?: Promise<unknown>
}
type ListCache = Map<string, ListEntry>

/** Per Host instance, including in-flight reads shared by preload and HTTP. */
const LIST_CACHES = new WeakMap<RouteDeps, ListCache>()

function cacheOf(deps: RouteDeps): ListCache {
  let cache = LIST_CACHES.get(deps)
  if (cache === undefined) {
    cache = new Map()
    LIST_CACHES.set(deps, cache)
  }
  return cache
}

/** Detach the map so old reads cannot restore invalidated/deleted rows. */
export function clearListCache(deps: RouteDeps): void {
  LIST_CACHES.delete(deps)
}

export function workdirsListKey(options: WorkdirOptions): string {
  return `workdirs:${String(options.includeSubagents === true)}`
}

export function sessionsListKey(workdir: string, source: ContextSource | null, options: WorkdirOptions): string {
  return `sessions:${JSON.stringify(workdir)}:${source ?? "*"}:${String(options.includeSubagents === true)}`
}

/** Drop every source/subagent variant for just the parsed session's workdir. */
export function clearSessionListCache(deps: RouteDeps, workdir: string): void {
  const cache = LIST_CACHES.get(deps)
  if (cache === undefined) return
  const prefix = `sessions:${JSON.stringify(workdir)}:`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

/** Decode the list-shaped query flags. */
export function listOptions(url: URL): WorkdirOptions {
  return { includeSubagents: url.searchParams.get("includeSubagents") === "1" }
}

function readList<T>(cache: ListCache, key: string, compute: () => Promise<T>): Promise<T> {
  let entry = cache.get(key)
  if (entry?.inflight !== undefined) return entry.inflight as Promise<T>
  if (entry === undefined) {
    entry = { at: 0 }
    cache.set(key, entry)
  }
  const target = entry
  const pending = compute()
    .then((value) => {
      // A detail read can detach just this entry while preserving other lists.
      if (cache.get(key) === target) {
        target.value = value
        target.at = Date.now()
      }
      return value
    })
    .finally(() => {
      if (target.inflight === pending) target.inflight = undefined
      if (cache.get(key) === target && target.value === undefined) cache.delete(key)
    })
  target.inflight = pending
  return pending
}

/** Serve fresh or stale metadata, coalescing cold reads and revalidations. */
export async function serveList<T>(
  deps: RouteDeps,
  key: string,
  forced: boolean,
  res: ServerResponse,
  compute: () => Promise<T>,
  project: (value: T) => Promise<T> = async (value) => value,
): Promise<void> {
  const ttl = deps.cacheTtlMs ?? LIST_TTL_MS
  const cache = cacheOf(deps)
  const hit = cache.get(key)
  if (!forced && hit?.value !== undefined) {
    if (Date.now() - hit.at < ttl) {
      writeOk(res, await project(hit.value as T))
      return
    }
    writeOk(res, { ...(await project(hit.value as T)), stale: true, refreshing: true })
    void readList(cache, key, compute).catch(() => undefined)
    return
  }
  writeOk(res, await project(await readList(cache, key, compute)))
}

/** One-shot metadata preload, using the same computation and cache as routes. */
export async function preloadLists(deps: RouteDeps, signal?: Pick<AbortSignal, "aborted">): Promise<void> {
  if (signal?.aborted) return
  const cache = cacheOf(deps)
  const options: WorkdirOptions = { includeSubagents: false }
  const key = workdirsListKey(options)
  const hit = cache.get(key)
  const value =
    hit?.value !== undefined && Date.now() - hit.at < (deps.cacheTtlMs ?? LIST_TTL_MS)
      ? (hit.value as Awaited<ReturnType<typeof computeWorkdirs>>)
      : await readList(cache, key, () => computeWorkdirs(deps, options))
  if (signal?.aborted || LIST_CACHES.get(deps) !== cache) return
  const first = value.workdirs[0]
  if (first === undefined) return
  const sessionsKey = sessionsListKey(first.workdir, null, options)
  const sessions = cache.get(sessionsKey)
  if (sessions?.value !== undefined && Date.now() - sessions.at < (deps.cacheTtlMs ?? LIST_TTL_MS)) return
  await readList(cache, sessionsKey, () => computeSessions(deps, first.workdir, null, options))
}
