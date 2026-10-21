/**
 * Cross-source search, in two tiers.
 *
 * `fast` (the default) never opens a body: it greps each session's metadata —
 * title, first input, workdir — which is everything the list views already hold.
 * That makes it complete by construction (`remaining: 0`, never truncated) and
 * costs a few milliseconds over the whole corpus.
 *
 * `deep` parses bodies through the same LRU the panel uses and stops at a
 * wall-clock budget. It therefore reports its own coverage: `scanned`,
 * `remaining`, `truncated` and a `nextCursor` the caller can send back to keep
 * sweeping from where the budget ran out.
 *
 * @module @cyrus/dsh-context-insight/host/search
 */

import type { SearchHit, SearchQuery, SearchValue, SourceProblem } from "../../protocol.ts"
import { SEARCH_DEADLINE_MS } from "../../protocol.ts"
import type { Session } from "@cyrus/dsh-session-contract"
import type { SearchCandidate, SessionSource } from "../sources/source.ts"
import { cleanTitle, snippetAround } from "../sources/source.ts"

/** Longest tool-input text one turn contributes to the haystack. */
const TOOL_INPUT_LIMIT = 2000

/** Everything the search function needs. */
export interface SearchDeps {
  sources: readonly SessionSource[]
  /** Budget override; tests use a tiny value to force truncation. */
  deadlineMs?: number
}

function problemOf(source: SessionSource, error: unknown): SourceProblem {
  const message = error instanceof Error ? error.message : String(error)
  return { source: source.id, error: "adapter-error", detail: message.slice(0, 200) }
}

interface Queued {
  source: SessionSource
  candidate: SearchCandidate
}

/**
 * Collect every in-scope candidate, newest first, plus the sources that failed
 * to list themselves.
 * @param deps - sources.
 * @param query - decoded request.
 */
async function collect(
  deps: SearchDeps,
  query: SearchQuery
): Promise<{ queue: Queued[]; failures: SourceProblem[]; failed: Set<string> }> {
  const inScope = deps.sources.filter((source) => query.sources.includes(source.id))
  const failures: SourceProblem[] = []
  const failed = new Set<string>()
  const listings = await Promise.all(
    inScope.map(async (source) => {
      try {
        return { source, candidates: await source.candidates() }
      } catch (error) {
        if (!failed.has(source.id)) {
          failed.add(source.id)
          failures.push(problemOf(source, error))
        }
        return { source, candidates: [] as SearchCandidate[] }
      }
    })
  )
  const queue: Queued[] = []
  for (const listing of listings) {
    for (const candidate of listing.candidates) queue.push({ source: listing.source, candidate })
  }
  queue.sort((left, right) => right.candidate.updatedAt - left.candidate.updatedAt)
  return { queue, failures, failed }
}

/**
 * Metadata-only scan: complete by construction.
 * @param deps - sources.
 * @param query - decoded request.
 */
async function fastSearch(deps: SearchDeps, query: SearchQuery): Promise<SearchValue> {
  const started = Date.now()
  const needle = query.q.toLowerCase()
  const { queue, failures } = await collect(deps, query)
  const hits: SearchHit[] = []
  for (const item of queue) {
    if (hits.length >= query.limit) break
    const candidate = item.candidate
    const fields: string[] = []
    const title = cleanTitle(candidate.title, candidate.id)
    if (title !== undefined) fields.push(title)
    if (candidate.firstInput !== undefined) fields.push(candidate.firstInput)
    if (candidate.workdir !== "") fields.push(candidate.workdir)
    const matched = fields.find((field) => field.toLowerCase().includes(needle))
    if (matched === undefined) continue
    const snippet = snippetAround(matched, needle) ?? matched
    const hit: SearchHit = {
      source: item.source.id,
      sessionId: candidate.id,
      workdir: candidate.workdir,
      // Metadata hits have no turn; 0 means "open the session, no specific turn".
      turnIndex: 0,
      at: candidate.updatedAt,
      field: "metadata",
      snippet,
      tier: "fast",
    }
    if (title !== undefined) hit.title = title
    if (candidate.firstInput !== undefined) hit.firstInput = candidate.firstInput
    hits.push(hit)
  }
  return {
    query: query.q,
    hits,
    scanned: queue.length,
    remaining: 0,
    elapsedMs: Date.now() - started,
    truncated: false,
    failures,
    tier: "fast",
  }
}

function toolHaystack(session: Session, turnIndex: number): string | undefined {
  const turn = session.turns.find((candidate) => candidate.index === turnIndex)
  if (turn === undefined) return undefined
  const parts: string[] = []
  for (const call of turn.toolCalls) {
    parts.push(call.name)
    if (call.input !== undefined) {
      try {
        parts.push(JSON.stringify(call.input).slice(0, TOOL_INPUT_LIMIT))
      } catch {
        // A cyclic input cannot be serialized; the name alone still counts.
      }
    }
  }
  return parts.length === 0 ? undefined : parts.join(" ")
}

/**
 * First matching turn of one session.
 * @param session - the parsed session.
 * @param source - which corpus it came from.
 * @param candidate - the listing row (title/first input for the result header).
 * @param needle - lowercased query.
 * @returns the hit, or undefined when the session does not contain it.
 */
function firstHit(
  session: Session,
  source: SessionSource,
  candidate: SearchCandidate,
  needle: string
): SearchHit | undefined {
  for (const turn of session.turns) {
    const user = turn.userInput.join(" ")
    const assistant = turn.assistantText.join(" ")
    const tool = toolHaystack(session, turn.index) ?? ""
    const fields: { field: "user" | "assistant" | "tool"; text: string }[] = [
      { field: "user", text: user },
      { field: "assistant", text: assistant },
      { field: "tool", text: tool },
    ]
    for (const { field, text } of fields) {
      if (text === "") continue
      const snippet = snippetAround(text, needle)
      if (snippet === undefined) continue
      const hit: SearchHit = {
        source: source.id,
        sessionId: session.id,
        workdir: session.workdir,
        turnIndex: turn.index,
        at: turn.startedAt,
        field,
        snippet,
        tier: "deep",
      }
      const title = cleanTitle(candidate.title ?? session.title, session.id)
      if (title !== undefined) hit.title = title
      if (candidate.firstInput !== undefined) hit.firstInput = candidate.firstInput
      return hit
    }
  }
  return undefined
}

/**
 * Body scan inside a budget, resumable through `cursor`.
 * @param deps - sources plus an optional budget.
 * @param query - decoded request.
 */
async function deepSearch(deps: SearchDeps, query: SearchQuery): Promise<SearchValue> {
  const started = Date.now()
  const deadline = started + (deps.deadlineMs ?? SEARCH_DEADLINE_MS)
  const needle = query.q.toLowerCase()
  const { queue, failures, failed } = await collect(deps, query)
  const hits: SearchHit[] = []
  const from = Math.min(Math.max(query.cursor, 0), queue.length)
  let cursor = from
  let truncated = false
  while (cursor < queue.length) {
    if (hits.length >= query.limit) {
      truncated = true
      break
    }
    if (Date.now() >= deadline) {
      truncated = true
      break
    }
    const item = queue[cursor]
    cursor += 1
    if (item === undefined) break
    let parsed
    try {
      parsed = await item.source.detail(item.candidate.id)
    } catch (error) {
      if (!failed.has(item.source.id)) {
        failed.add(item.source.id)
        failures.push(problemOf(item.source, error))
      }
      continue
    }
    if (!parsed.ok) continue
    const hit = firstHit(parsed.session, item.source, item.candidate, needle)
    if (hit !== undefined) hits.push(hit)
  }
  const remaining = Math.max(0, queue.length - cursor)
  if (remaining > 0) truncated = true
  const value: SearchValue = {
    query: query.q,
    hits,
    scanned: cursor - from,
    remaining,
    elapsedMs: Date.now() - started,
    truncated,
    failures,
    tier: "deep",
  }
  if (remaining > 0) value.nextCursor = cursor
  return value
}

/**
 * Run one search in the requested tier.
 * @param deps - sources plus an optional budget.
 * @param query - decoded request.
 * @returns hits plus the counters that describe how complete the scan was.
 */
export async function searchSessions(deps: SearchDeps, query: SearchQuery): Promise<SearchValue> {
  return query.tier === "deep" ? deepSearch(deps, query) : fastSearch(deps, query)
}
