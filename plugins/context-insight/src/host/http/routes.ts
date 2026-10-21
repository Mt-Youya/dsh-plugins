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
 * @module @cyrus/dsh-context-insight/host/routes
 */

import type { IncomingMessage, ServerResponse } from "node:http"
import type {
  BriefValue,
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
  HANDOFF_PREPARE_PATH,
  HANDOFF_STATUS_PATH,
  SEARCH_PATH,
  SESSION_PATH,
  SESSIONS_PATH,
  SOURCES_PATH,
  WORKDIRS_PATH,
  isContextSource,
  parseHandoffApply,
  parseHandoffPrepare,
  parseSearchQuery,
  parseTurnWindow,
} from "../../protocol.ts"
import { extractBrief } from "../views/brief.ts"
import { costOfSession } from "../views/cost.ts"
import type { HandoffRunner } from "../handoff/handoff.ts"
import type { PricingTable } from "../views/pricing.ts"
import { PRICING } from "../views/pricing.ts"
import { searchSessions } from "../views/search.ts"
import type { SessionSource, WorkdirOptions } from "../sources/source.ts"
import type { RouteHandler, WebRoute } from "./server.ts"
import { guardRequest, isJsonContentType, readJsonBody, requestUrl, writeFail, writeOk } from "./server.ts"

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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function problemOf(source: SessionSource, error: unknown): SourceProblem {
  return { source: source.id, error: "adapter-error", detail: messageOf(error).slice(0, 200) }
}

/** One source's answer, or the failure that replaced it. */
type Sourced<T> = { ok: true; value: T } | { ok: false; problem: SourceProblem }

/**
 * Run one source call, converting a thrown adapter into a problem.
 * @param source - the reader being asked.
 * @param run - the call.
 * @returns the value, or the failure to report.
 */
async function ask<T>(source: SessionSource, run: () => Promise<T>): Promise<Sourced<T>> {
  try {
    return { ok: true, value: await run() }
  } catch (error) {
    return { ok: false, problem: problemOf(source, error) }
  }
}

/**
 * Wrap an async handler so no branch can escape as a naked exception.
 * @param handler - async handler receiving the parsed URL.
 * @returns the synchronous handler the web server calls.
 */
function route(handler: (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>): RouteHandler {
  return (req, res) => {
    const url = requestUrl(req)
    void handler(req, res, url).catch((error: unknown) => {
      if (res.headersSent) {
        res.end()
        return
      }
      writeFail(res, "parse-failed", messageOf(error).slice(0, 200))
    })
  }
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
  cacheOf(deps).clear()
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
async function serveList<T>(
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
 * `POST /handoff/prepare`: extract the six-section brief from a session.
 * @param deps - route dependencies.
 * @returns the handler.
 */
export function handleHandoffPrepare(deps: RouteDeps): RouteHandler {
  return route(async (req, res) => {
    if (!guardRequest(req, res, ["POST"])) return
    if (!isJsonContentType(req)) {
      writeFail(res, "bad-request", "content-type-json-required")
      return
    }
    const body = await readJsonBody(req)
    const request = parseHandoffPrepare(body)
    if (request === undefined) {
      writeFail(res, "bad-request", "invalid-handoff-request")
      return
    }
    const reader = deps.sources.find((candidate) => candidate.id === request.source)
    if (reader === undefined) {
      writeFail(res, "source-unavailable", "source-not-configured")
      return
    }
    const answer = await ask(reader, () => reader.detail(request.id))
    if (!answer.ok) {
      writeFail(res, "source-unavailable", answer.problem.detail ?? "adapter-error")
      return
    }
    if (!answer.value.ok) {
      writeFail(res, answer.value.error, answer.value.detail)
      return
    }
    const session = answer.value.session
    if (session.workdir === "") {
      writeFail(res, "bad-request", "workdir-unknown:cwd-must-be-typed")
      return
    }
    const brief = extractBrief(session)
    const value: BriefValue = {
      source: reader.id,
      sessionId: session.id,
      workdir: session.workdir,
      turns: session.turns.length,
      defaultCwd: session.workdir,
      brief: brief.text,
      chars: brief.chars,
      sections: brief.sections,
      fileCount: brief.files.length,
      decisionCount: brief.decisionCount,
      openCount: brief.openCount,
      commandCount: brief.commandCount,
    }
    if (session.title !== undefined) value.title = session.title
    writeOk(res, value)
  })
}

/**
 * `POST /handoff/apply`: create the DSH session and queue the brief.
 * @param deps - route dependencies.
 * @returns the handler.
 */
export function handleHandoffApply(deps: RouteDeps): RouteHandler {
  return route(async (req, res) => {
    if (!guardRequest(req, res, ["POST"])) return
    if (!isJsonContentType(req)) {
      writeFail(res, "bad-request", "content-type-json-required")
      return
    }
    const body = await readJsonBody(req)
    const request = parseHandoffApply(body)
    if (request === undefined) {
      writeFail(res, "bad-request", "invalid-handoff-apply")
      return
    }
    if (deps.handoff === undefined) {
      writeFail(res, "handoff-unavailable", "runner-missing")
      return
    }
    const answer = await deps.handoff.apply({
      source: request.source,
      id: request.id,
      cwd: request.cwd,
      brief: request.brief,
      ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }),
    })
    if (!answer.ok) {
      writeFail(res, answer.error, answer.detail)
      return
    }
    writeOk(res, answer.value)
  })
}

/**
 * `GET /handoff/status?sessionId=`: observe until a terminal `turn/end`.
 * @param deps - route dependencies.
 * @returns the handler.
 */
export function handleHandoffStatus(deps: RouteDeps): RouteHandler {
  return route(async (req, res, url) => {
    if (!guardRequest(req, res, ["GET", "HEAD"])) return
    const sessionId = url.searchParams.get("sessionId") ?? ""
    if (sessionId === "") {
      writeFail(res, "bad-request", "sessionId-required")
      return
    }
    if (deps.handoff === undefined) {
      writeFail(res, "handoff-unavailable", "runner-missing")
      return
    }
    const answer = await deps.handoff.status(sessionId)
    if (!answer.ok) {
      writeFail(res, answer.error, answer.detail)
      return
    }
    writeOk(res, answer.value)
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
    { kind: "exact", path: SEARCH_PATH, handler: handleSearch(deps) },
    { kind: "exact", path: COST_PATH, handler: handleCost(deps) },
    { kind: "exact", path: HANDOFF_PREPARE_PATH, handler: handleHandoffPrepare(deps) },
    { kind: "exact", path: HANDOFF_APPLY_PATH, handler: handleHandoffApply(deps) },
    { kind: "exact", path: HANDOFF_STATUS_PATH, handler: handleHandoffStatus(deps) },
  ]
}
