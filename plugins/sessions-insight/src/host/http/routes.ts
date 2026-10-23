/**
 * The Host routes: `/sources`, `/workdirs`, `/sessions`, `/session`, `/search`.
 *
 * Every handler sits behind the same origin/method gate, answers inside the
 * shared envelope, and talks to the readers through {@link SessionSource}. The
 * cross-cutting rule is failure isolation: a source that throws is caught here
 * and demoted to one entry in a `failures` array (or one `available:false`
 * badge), while every other source keeps answering. A broken adapter must never
 * blank the page.
 *
 * @see docs/API.md
 * @module @cyrus/dsh-sessions-insight/host/routes
 */

import type {
  ContextSource,
  CostValue,
  SessionDetail,
  SessionSummary,
  SessionsValue,
  SourceProblem,
  SourceStatus,
  SourcesValue,
  WorkdirEntry,
  WorkdirsValue,
} from "../../protocol.ts"
import {
  CONTEXT_SOURCES,
  COST_PATH,
  HANDOFF_APPLY_PATH,
  HANDOFF_REVEAL_PATH,
  HANDOFF_PREPARE_PATH,
  HANDOFF_STATUS_PATH,
  SEARCH_PATH,
  SESSION_PATH,
  SESSIONS_PATH,
  SOURCES_PATH,
  WORKDIRS_PATH,
  isContextSource,
  parseSearchQuery,
  parseTurnWindow,
} from "../../protocol.ts"
import { costOfSession } from "../views/cost.ts"
import type { HandoffRunner } from "../handoff/handoff.ts"
import type { PricingTable } from "../views/pricing.ts"
import { searchSessions } from "../views/search.ts"
import type { SessionSource } from "../sources/source.ts"
import type { RouteHandler, WebRoute } from "./server.ts"
import { guardRequest, writeFail, writeOk } from "./server.ts"
import { ask, route } from "./route-utils.ts"
import { clearListCache, listOptions, serveList } from "./list-cache.ts"
import { handleHandoffReveal, handleHandoffApply, handleHandoffPrepare, handleHandoffStatus } from "./handoff-routes.ts"
import { handleDeleteSession } from "./delete-route.ts"
import { SESSION_DELETE_PATH } from "../../protocol.ts"
export { clearListCache, listOptions, LIST_TTL_MS } from "./list-cache.ts"
export { handleHandoffApply, handleHandoffPrepare, handleHandoffStatus } from "./handoff-routes.ts"

/** Everything the routes need. */
export interface RouteDeps {
  /** One reader per source; order determines nothing, CONTEXT_SOURCES does. */
  sources: readonly SessionSource[]
  /** Version string reported by `/health`. */
  version: string
  /** Search budget override (tests). */
  searchDeadlineMs?: number
  /** Handoff runner; absent when the Host serves no gateway. */
  handoff?: HandoffRunner
  /** Price table override (tests). */
  pricing?: PricingTable
  /** How long a list answer stays fresh before it is served stale (ms). */
  cacheTtlMs?: number
}

/**
 * `/sources`: per-source availability. A source whose adapter throws answers
 * `available:false` with `adapter-error`, never a 500.
 * @param deps - route dependencies.
 * @returns the handler.
 */
export function handleSources(deps: RouteDeps): RouteHandler {
  return route(async (req, res) => {
    if (!guardRequest(req, res, ["GET", "HEAD"])) return
    const bySource = new Map<ContextSource, SourceStatus>()
    const answers = await Promise.all(
      deps.sources.map(async (source) => ({ source, result: await ask(source, () => source.status()) }))
    )
    for (const { source, result } of answers) {
      if (result.ok) {
        bySource.set(source.id, result.value)
        continue
      }
      const status: SourceStatus = {
        source: source.id,
        available: false,
        reason: "adapter-error",
        errorDetail: result.problem.detail ?? "",
      }
      bySource.set(source.id, status)
    }
    for (const source of CONTEXT_SOURCES) {
      if (bySource.has(source)) continue
      bySource.set(source, { source, available: false, reason: "root-missing" })
    }
    const value: SourcesValue = { sources: CONTEXT_SOURCES.map((source) => bySource.get(source) as SourceStatus) }
    writeOk(res, value)
  })
}

/**
 * Merge the per-source workdir rows into one tree.
 *
 * The workdir string is the join key on purpose: the panel's navigation axis is
 * the real directory, and the source is only a badge on it.
 * @param lists - one workdir list per source.
 * @returns the merged tree, newest first.
 */
export function mergeWorkdirs(lists: readonly WorkdirEntry[][]): WorkdirEntry[] {
  const merged = new Map<string, WorkdirEntry>()
  for (const list of lists) {
    for (const row of list) {
      const existing = merged.get(row.workdir)
      if (existing === undefined) {
        merged.set(row.workdir, {
          workdir: row.workdir,
          sessions: row.sessions,
          lastUpdatedAt: row.lastUpdatedAt,
          sources: [...row.sources],
        })
        continue
      }
      existing.sessions += row.sessions
      if (row.lastUpdatedAt > existing.lastUpdatedAt) existing.lastUpdatedAt = row.lastUpdatedAt
      for (const group of row.sources) {
        const known = existing.sources.find((candidate) => candidate.source === group.source)
        if (known === undefined) {
          existing.sources.push({ ...group })
          continue
        }
        known.sessions += group.sessions
        if (group.lastUpdatedAt > known.lastUpdatedAt) known.lastUpdatedAt = group.lastUpdatedAt
      }
    }
  }
  const rows = [...merged.values()]
  for (const row of rows)
    row.sources.sort((a, b) => CONTEXT_SOURCES.indexOf(a.source) - CONTEXT_SOURCES.indexOf(b.source))
  return rows.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt)
}

/**
 * `/workdirs`: the navigation axis, merged across sources.
 * @param deps - route dependencies.
 * @returns the handler.
 */
function maybeRefresh(deps: RouteDeps, url: URL): void {
  if (url.searchParams.get("refresh") !== "1") return
  for (const source of deps.sources) source.invalidate()
}

export function handleWorkdirs(deps: RouteDeps): RouteHandler {
  return route(async (req, res, url) => {
    if (!guardRequest(req, res, ["GET", "HEAD"])) return
    maybeRefresh(deps, url)
    const forced = url.searchParams.get("refresh") === "1"
    const options = listOptions(url)
    const key = "workdirs:" + String(options.includeSubagents === true)
    await serveList(deps, key, forced, res, async () => {
      const answers = await Promise.all(
        deps.sources.map(async (source) => ({ source, result: await ask(source, () => source.workdirs(options)) }))
      )
      const lists: WorkdirEntry[][] = []
      const failures: SourceProblem[] = []
      let scannedAt = Date.now()
      for (const { result } of answers) {
        if (result.ok) lists.push(result.value)
        else failures.push(result.problem)
      }
      const value: WorkdirsValue = { workdirs: mergeWorkdirs(lists), scannedAt, failures }
      void scannedAt
      return value
    })
  })
}

/**
 * `/sessions?workdir=&source=`: one workdir's sessions, merged across sources.
 *
 * `workdir` is required and may be the empty string, which selects the sessions
 * whose workdir could not be decoded — a real bucket, not an error.
 * @param deps - route dependencies.
 * @returns the handler.
 */
export function handleSessions(deps: RouteDeps): RouteHandler {
  return route(async (req, res, url) => {
    if (!guardRequest(req, res, ["GET", "HEAD"])) return
    const workdir = url.searchParams.get("workdir")
    if (workdir === null) {
      writeFail(res, "bad-request", "workdir-required")
      return
    }
    maybeRefresh(deps, url)
    const forced = url.searchParams.get("refresh") === "1"
    const requested = url.searchParams.get("source")
    if (requested !== null && !isContextSource(requested)) {
      writeFail(res, "bad-request", "invalid-source")
      return
    }
    const options = listOptions(url)
    const key = "sessions:" + workdir + ":" + (requested ?? "*") + ":" + String(options.includeSubagents === true)
    await serveList(deps, key, forced, res, async () => {
      const inScope = requested === null ? deps.sources : deps.sources.filter((source) => source.id === requested)
      const answers = await Promise.all(
        inScope.map(async (source) => ({ source, result: await ask(source, () => source.list(workdir, options)) }))
      )
      const sessions: SessionSummary[] = []
      const failures: SourceProblem[] = []
      for (const { result } of answers) {
        if (result.ok) sessions.push(...result.value)
        else failures.push(result.problem)
      }
      sessions.sort((a, b) => b.updatedAt - a.updatedAt)
      const value: SessionsValue = { workdir, sessions, failures }
      return value
    })
  })
}

/**
 * `/session?source=&id=&turnOffset=&turnLimit=`: one paged session IR.
 *
 * The page is sliced after parsing, so paging bounds the response and the
 * render, not the disk read; a page past the end is an empty page, not an
 * error, and the echoed offset is the clamped one the client should trust.
 * @param deps - route dependencies.
 * @returns the handler.
 */
export function handleSession(deps: RouteDeps): RouteHandler {
  return route(async (req, res, url) => {
    if (!guardRequest(req, res, ["GET", "HEAD"])) return
    const params = url.searchParams
    const rawSource = params.get("source") ?? "claude"
    if (!isContextSource(rawSource)) {
      writeFail(res, "bad-request", "invalid-source")
      return
    }
    const source = deps.sources.find((candidate) => candidate.id === rawSource)
    if (source === undefined) {
      writeFail(res, "source-unavailable", "source-not-configured")
      return
    }
    const id = params.get("id") ?? ""
    if (id === "") {
      writeFail(res, "bad-request", "id-required")
      return
    }
    const window = parseTurnWindow(params)
    if (window === undefined) {
      writeFail(res, "bad-request", "invalid-turn-window")
      return
    }

    const answer = await ask(source, () => source.detail(id))
    if (!answer.ok) {
      writeFail(res, "source-unavailable", answer.problem.detail ?? "adapter-error")
      return
    }
    const detail = answer.value
    if (!detail.ok) {
      writeFail(res, detail.error, detail.detail)
      return
    }

    const session = detail.session
    const turnCount = session.turns.length
    const offset = Math.min(Math.max(window.offset, 0), turnCount)
    const turns = session.turns.slice(offset, offset + window.limit)
    const segments = await ask(source, () => source.segmentInfo(session))
    let residualTurns = 0
    let reconciledTurns = 0
    for (const turn of session.turns) {
      if (turn.attribution.residual !== undefined) residualTurns += 1
      if (turn.attribution.reconciled !== undefined) reconciledTurns += 1
    }

    const value: SessionDetail = {
      session: {
        id: session.id,
        source: source.id,
        workdir: session.workdir,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        turns,
        dataQuality: session.dataQuality,
        segments: segments.ok ? segments.value : [],
      },
      turnCount,
      offset,
      limit: window.limit,
      meta: {
        cached: detail.cached,
        elapsedMs: detail.elapsedMs,
        bytes: detail.bytes,
        residualTurns,
        reconciledTurns,
      },
    }
    if (session.title !== undefined) value.session.title = session.title
    const firstInput = session.turns[0]?.userInput[0]
    if (firstInput !== undefined && firstInput.trim() !== "") value.session.firstInput = firstInput.trim().slice(0, 200)
    // The parse may add a title/first input the list should show next time.
    clearListCache(deps)
    writeOk(res, value)
  })
}

/**
 * `/search?q=&source=&limit=`: bounded full-text scan across sources.
 * @param deps - route dependencies.
 * @returns the handler.
 */
export function handleSearch(deps: RouteDeps): RouteHandler {
  return route(async (req, res, url) => {
    if (!guardRequest(req, res, ["GET", "HEAD"])) return
    const query = parseSearchQuery(url.searchParams)
    if (query === undefined) {
      writeFail(res, "bad-request", "invalid-search-query")
      return
    }
    const value = await searchSessions(
      {
        sources: deps.sources,
        ...(deps.searchDeadlineMs === undefined ? {} : { deadlineMs: deps.searchDeadlineMs }),
      },
      query
    )
    writeOk(res, value)
  })
}

/**
 * Read one session through its source, mapping a thrown adapter to a refusal.
 * @param deps - route dependencies.
 * @param source - source name from the request.
 * @param id - session id from the request.
 */
async function readSession(
  deps: RouteDeps,
  source: ContextSource,
  id: string
): Promise<
  | { ok: true; session: SessionDetail["session"] }
  | {
      ok: false
      error: "source-unavailable" | "not-found" | "bad-request" | "forbidden" | "read-limit" | "parse-failed"
      detail: string
    }
> {
  const reader = deps.sources.find((candidate) => candidate.id === source)
  if (reader === undefined) return { ok: false, error: "source-unavailable", detail: "source-not-configured" }
  const answer = await ask(reader, () => reader.detail(id))
  if (!answer.ok) return { ok: false, error: "source-unavailable", detail: answer.problem.detail ?? "adapter-error" }
  if (!answer.value.ok) return { ok: false, error: answer.value.error, detail: answer.value.detail }
  const session = answer.value.session
  const detail: SessionDetail["session"] = {
    id: session.id,
    source: reader.id,
    workdir: session.workdir,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    turns: session.turns,
    dataQuality: session.dataQuality,
    segments: [],
  }
  if (session.title !== undefined) detail.title = session.title
  return { ok: true, session: detail }
}

/**
 * `GET /cost?source=&id=`: the session's price, per turn and in total.
 * @param deps - route dependencies.
 * @returns the handler.
 */
export function handleCost(deps: RouteDeps): RouteHandler {
  return route(async (req, res, url) => {
    if (!guardRequest(req, res, ["GET", "HEAD"])) return
    maybeRefresh(deps, url)
    const rawSource = url.searchParams.get("source") ?? "claude"
    if (!isContextSource(rawSource)) {
      writeFail(res, "bad-request", "invalid-source")
      return
    }
    const id = url.searchParams.get("id") ?? ""
    if (id === "") {
      writeFail(res, "bad-request", "id-required")
      return
    }
    const reader = deps.sources.find((candidate) => candidate.id === rawSource)
    if (reader === undefined) {
      writeFail(res, "source-unavailable", "source-not-configured")
      return
    }
    const answer = await ask(reader, () => reader.detail(id))
    if (!answer.ok) {
      writeFail(res, "source-unavailable", answer.problem.detail ?? "adapter-error")
      return
    }
    if (!answer.value.ok) {
      writeFail(res, answer.value.error, answer.value.detail)
      return
    }
    // No override means "price every table": a bare table would price only itself.
    const report = costOfSession(answer.value.session, reader.id, deps.pricing ?? {})
    const value: CostValue = { ...report, turns: report.turns }
    writeOk(res, value)
  })
}

/**
 * Build the full route table.
 * @param deps - route dependencies.
 * @returns one exact route per endpoint.
 */
export function createRoutes(deps: RouteDeps): WebRoute[] {
  return [
    { kind: "exact", path: SOURCES_PATH, handler: handleSources(deps) },
    { kind: "exact", path: WORKDIRS_PATH, handler: handleWorkdirs(deps) },
    { kind: "exact", path: SESSIONS_PATH, handler: handleSessions(deps) },
    { kind: "exact", path: SESSION_PATH, handler: handleSession(deps) },
    { kind: "exact", path: SESSION_DELETE_PATH, handler: handleDeleteSession(deps) },
    { kind: "exact", path: SEARCH_PATH, handler: handleSearch(deps) },
    { kind: "exact", path: COST_PATH, handler: handleCost(deps) },
    { kind: "exact", path: HANDOFF_PREPARE_PATH, handler: handleHandoffPrepare(deps) },
    { kind: "exact", path: HANDOFF_APPLY_PATH, handler: handleHandoffApply(deps) },
    { kind: "exact", path: HANDOFF_REVEAL_PATH, handler: handleHandoffReveal(deps) },
    { kind: "exact", path: HANDOFF_STATUS_PATH, handler: handleHandoffStatus(deps) },
  ]
}
