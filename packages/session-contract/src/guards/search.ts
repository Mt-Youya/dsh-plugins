/**
 * The `/search` contract: paging, both tiers, and the guards for a hit page.
 *
 * @module @cyrus/dsh-session-contract/guards/search
 */

import { CONTEXT_SOURCES } from "../types.ts"
import type { ContextSource, SourceProblem } from "../types.ts"
import { isRecord, isNumber } from "./shared.ts"
import { isContextSource } from "./sources.ts"

/** Default number of search hits one call returns. */
export const DEFAULT_SEARCH_LIMIT = 30
/** Hard ceiling on one search page. */
export const MAX_SEARCH_LIMIT = 100

/**
 * Wall-clock budget one search may spend scanning.
 *
 * A cold corpus (108 Codex sessions, 136 DSH logs, 49 Claude transcripts) cannot
 * be parsed end to end inside the 3 s gate, so the route stops at this budget
 * and reports `truncated`, `scanned` and `remaining` rather than pretending the
 * scan was complete.
 */
export const SEARCH_DEADLINE_MS = 2500

/** Where inside a turn (or its metadata) the query was found. */
export type SearchField = "user" | "assistant" | "tool" | "metadata"

/**
 * Which scan produced a hit.
 *
 * `fast` reads metadata only (title, first input, workdir) and always completes;
 * `deep` parses bodies inside a wall-clock budget and therefore may be partial.
 */
export type SearchTier = "fast" | "deep"

/** One search result: a session, a turn, and the text around the match. */
export interface SearchHit {
  source: ContextSource
  sessionId: string
  workdir: string
  /** 1-based turn index, so the panel can open that turn. */
  turnIndex: number
  /** Turn start, epoch milliseconds. */
  at: number
  title?: string
  firstInput?: string
  field: SearchField
  /** Up to ~180 characters around the first match in that field. */
  snippet: string
  /** Which scan produced this hit. */
  tier: SearchTier
}

/** `/search` body. */
export interface SearchValue {
  query: string
  hits: SearchHit[]
  /** Sessions fully examined (parsed or served from the LRU). */
  scanned: number
  /** Candidate sessions in scope that the budget did not reach. */
  remaining: number
  elapsedMs: number
  /** True when the budget or the limit stopped the scan early. */
  truncated: boolean
  failures: SourceProblem[]
  /** Which scan answered. */
  tier: SearchTier
  /** Deep scans only: the cursor to pass back to continue the sweep. */
  nextCursor?: number
}

/** A decoded search request. */
export interface SearchQuery {
  q: string
  /** Sources to scan; every available source when the request names none. */
  sources: ContextSource[]
  limit: number
  /** Defaults to `fast`: metadata only, always complete. */
  tier: SearchTier
  /** Deep scans only: where the previous page stopped. */
  cursor: number
}

/**
 * Decode `?q=&source=&limit=` for the search route.
 * @param params - the request's search parameters.
 * @returns the request, or undefined when a value is present but invalid.
 */
export function parseSearchQuery(params: URLSearchParams): SearchQuery | undefined {
  const q = (params.get("q") ?? "").trim()
  if (q.length === 0 || q.length > 200) return undefined
  const rawLimit = params.get("limit")
  let limit = DEFAULT_SEARCH_LIMIT
  if (rawLimit !== null && rawLimit !== "") {
    if (!/^\d{1,3}$/.test(rawLimit)) return undefined
    limit = Number(rawLimit)
    if (limit < 1) return undefined
    if (limit > MAX_SEARCH_LIMIT) limit = MAX_SEARCH_LIMIT
  }
  const rawTier = params.get("tier")
  const tier: SearchTier =
    rawTier === "deep" ? "deep" : rawTier === null || rawTier === "" || rawTier === "fast" ? "fast" : "fast"
  if (rawTier !== null && rawTier !== "" && rawTier !== "fast" && rawTier !== "deep") return undefined
  const rawCursor = params.get("cursor")
  let cursor = 0
  if (rawCursor !== null && rawCursor !== "") {
    if (!/^\d{1,7}$/.test(rawCursor)) return undefined
    cursor = Number(rawCursor)
  }
  const named = params
    .getAll("source")
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
  const sources: ContextSource[] = []
  for (const entry of named) {
    if (!isContextSource(entry)) return undefined
    if (!sources.includes(entry)) sources.push(entry)
  }
  return { q, sources: sources.length === 0 ? [...CONTEXT_SOURCES] : sources, limit, tier, cursor }
}

/**
 * Whether a wire value is a well-formed search hit.
 * @param value - any decoded JSON value.
 * @returns true when every field the panel renders is present and typed.
 */
export function isSearchHit(value: unknown): value is SearchHit {
  if (!isRecord(value)) return false
  if (!CONTEXT_SOURCES.includes(value.source as ContextSource)) return false
  if (typeof value.sessionId !== "string" || typeof value.workdir !== "string") return false
  if (!isNumber(value.turnIndex) || !isNumber(value.at)) return false
  if (value.field !== "user" && value.field !== "assistant" && value.field !== "tool" && value.field !== "metadata")
    return false
  if (value.tier !== "fast" && value.tier !== "deep") return false
  if (typeof value.snippet !== "string") return false
  if (value.title !== undefined && typeof value.title !== "string") return false
  if (value.firstInput !== undefined && typeof value.firstInput !== "string") return false
  return true
}

/**
 * Whether a wire value is a well-formed search answer.
 * @param value - any decoded JSON value.
 * @returns true when the counters and every hit pass their guards.
 */
export function isSearchValue(value: unknown): value is SearchValue {
  if (!isRecord(value)) return false
  if (typeof value.query !== "string") return false
  if (!isNumber(value.scanned) || !isNumber(value.remaining) || !isNumber(value.elapsedMs)) return false
  if (typeof value.truncated !== "boolean") return false
  if (!Array.isArray(value.hits) || !value.hits.every(isSearchHit)) return false
  if (!Array.isArray(value.failures)) return false
  return value.failures.every(
    (entry) =>
      isRecord(entry) && CONTEXT_SOURCES.includes(entry.source as ContextSource) && typeof entry.error === "string"
  )
}
