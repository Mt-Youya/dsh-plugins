import type { ServerResponse } from "node:http"
import type { RouteDeps } from "./routes.ts"
import type { WorkdirOptions } from "../sources/source.ts"
import { writeOk } from "./server.ts"

/** Default freshness window for list answers. */
export const LIST_TTL_MS = 15_000

/**
 * Answers kept for stale-while-revalidate, keyed by request.
 *
 * Scoped per `RouteDeps` (i.e. per Host instance) rather than module-wide: two
 * instances in one process — the tests do this — must never see each other's
 * rows.
 */
const LIST_CACHES = new WeakMap<RouteDeps, Map<string, { at: number; value: unknown }>>()

function cacheOf(deps: RouteDeps): Map<string, { at: number; value: unknown }> {
  let cache = LIST_CACHES.get(deps)
  if (cache === undefined) {
    cache = new Map()
    LIST_CACHES.set(deps, cache)
  }
  return cache
}

/**
 * Drop cached list answers, so a freshly parsed session shows its new row.
 * @param deps - route dependencies.
 */
export function clearListCache(deps: RouteDeps): void {
  // Detach the map so an older in-flight revalidation cannot restore deleted rows.
  LIST_CACHES.delete(deps)
}

/**
 * Decode the list-shaped query flags.
 * @param url - request URL.
 */
export function listOptions(url: URL): WorkdirOptions {
  return { includeSubagents: url.searchParams.get("includeSubagents") === "1" }
}

/**
 * Serve a list answer from cache, or answer stale and rescan behind the reply.
 *
 * Opening the panel used to wait for a full three-source scan. Now the first
 * answer is cached, later requests inside the TTL are instant, and a request
 * after the TTL gets the previous answer immediately (`stale: true,
 * refreshing: true`) while the rescan runs in the background.
 * @param deps - route dependencies (TTL override).
 * @param key - cache key.
 * @param forced - true when the caller asked for a refresh (`refresh=1`).
 * @param res - response to write.
 * @param compute - the expensive read.
 */
export async function serveList<T>(
  deps: RouteDeps,
  key: string,
  forced: boolean,
  res: ServerResponse,
  compute: () => Promise<T>
): Promise<void> {
  const ttl = deps.cacheTtlMs ?? LIST_TTL_MS
  const cache = cacheOf(deps)
  const hit = cache.get(key)
  const now = Date.now()
  if (!forced && hit !== undefined && now - hit.at < ttl) {
    writeOk(res, hit.value)
    return
  }
  if (!forced && hit !== undefined) {
    writeOk(res, Object.assign({}, hit.value as object, { stale: true, refreshing: true }))
    void compute()
      .then((value) => cache.set(key, { at: Date.now(), value }))
      .catch(() => undefined)
    return
  }
  const value = await compute()
  cache.set(key, { at: Date.now(), value })
  writeOk(res, value)
}
