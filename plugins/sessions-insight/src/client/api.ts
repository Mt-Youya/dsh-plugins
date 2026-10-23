/**
 * The panel's only door to the Host.
 *
 * Every answer is decoded through a protocol guard, so a drifted Host produces
 * a typed failure the panel can render instead of a crash deep in a component.
 * The transport — fetch, JSON decoding, envelope decoding and failure
 * classification — is `@cyrus/dsh-plugin-kit-client`; what this module adds is the
 * endpoint list and the guards each endpoint's payload is checked against.
 *
 * URLs are document-relative on purpose: the page carries `<base href="./">`
 * and the routes are mounted at the site root.
 *
 * @module @cyrus/dsh-sessions-insight/client/api
 */

import { HANDOFF_REVEAL_URL, isHandoffRevealValue, type HandoffRevealValue } from "../protocol.ts"
import { t } from "./locale.ts"
import { requestJson, type ApiFailure, type ApiResult } from "@cyrus/dsh-plugin-kit-client"
import type {
  BriefValue,
  DeleteSessionValue,
  CostValue,
  HandoffApplyValue,
  HandoffStatusValue,
  SearchTier,
  SearchValue,
  SessionDetail,
  SessionsValue,
  SourcesValue,
  WorkdirsValue,
} from "../protocol.ts"
import {
  API_ERROR_CODES,
  SESSION_DELETE_URL,
  isDeleteSessionValue,
  COST_URL,
  HANDOFF_APPLY_URL,
  HANDOFF_PREPARE_URL,
  HANDOFF_STATUS_URL,
  SEARCH_URL,
  SESSIONS_URL,
  SESSION_URL,
  SOURCES_URL,
  WORKDIRS_URL,
  isBriefValue,
  isCostValue,
  isHandoffApplyValue,
  isHandoffStatusValue,
  isSearchValue,
  isSessionDetail,
  isSessionsValue,
  isSourcesValue,
  isWorkdirsValue,
} from "../protocol.ts"

export type { ApiFailure, ApiResult } from "@cyrus/dsh-plugin-kit-client"

/** The reads the panel performs. */
export interface Api {
  deleteSession(source: string, id: string): Promise<ApiResult<DeleteSessionValue>>
  sources(signal?: AbortSignal): Promise<ApiResult<SourcesValue>>
  workdirs(signal?: AbortSignal, refresh?: boolean): Promise<ApiResult<WorkdirsValue>>
  sessions(workdir: string, signal?: AbortSignal): Promise<ApiResult<SessionsValue>>
  session(
    id: string,
    offset: number,
    limit: number,
    source: string,
    signal?: AbortSignal
  ): Promise<ApiResult<SessionDetail>>
  search(
    query: string,
    limit: number,
    tier: SearchTier,
    cursor: number,
    signal?: AbortSignal
  ): Promise<ApiResult<SearchValue>>
  cost(source: string, id: string, signal?: AbortSignal): Promise<ApiResult<CostValue>>
  handoffPrepare(source: string, id: string, signal?: AbortSignal): Promise<ApiResult<BriefValue>>
  handoffApply(
    body: { source: string; id: string; cwd: string; brief: string },
    signal?: AbortSignal
  ): Promise<ApiResult<HandoffApplyValue>>
  handoffReveal(sessionId: string): Promise<ApiResult<HandoffRevealValue>>
  handoffStatus(sessionId: string, signal?: AbortSignal): Promise<ApiResult<HandoffStatusValue>>
}

type Guard<T> = (value: unknown) => value is T

/**
 * Perform one GET and decode its envelope.
 * @param url - document-relative route.
 * @param guard - payload guard.
 * @param signal - cancellation.
 * @returns the decoded payload or a classified failure.
 */
function get<T>(url: string, guard: Guard<T>, signal?: AbortSignal): Promise<ApiResult<T>> {
  return requestJson({ url, guard, codes: API_ERROR_CODES, signal })
}

/**
 * Perform one POST and decode its envelope.
 * @param url - document-relative route.
 * @param body - JSON body.
 * @param guard - payload guard.
 * @param signal - cancellation.
 * @returns the decoded payload or a classified failure.
 */
function post<T>(url: string, body: unknown, guard: Guard<T>, signal?: AbortSignal): Promise<ApiResult<T>> {
  return requestJson({ url, guard, codes: API_ERROR_CODES, signal, method: "POST", body })
}

/**
 * Build the API surface.
 * @param base - prefix prepended to every route ('' keeps it document-relative).
 * @returns the four reads.
 */
export function createApi(base = ""): Api {
  return {
    deleteSession: (source, id) => post(base + SESSION_DELETE_URL, { source, id }, isDeleteSessionValue),
    sources: (signal) => get(base + SOURCES_URL, isSourcesValue, signal),
    workdirs: (signal, refresh = false) =>
      get(base + WORKDIRS_URL + (refresh ? "?refresh=1" : ""), isWorkdirsValue, signal),
    sessions: (workdir, signal) =>
      get(`${base}${SESSIONS_URL}?workdir=${encodeURIComponent(workdir)}`, isSessionsValue, signal),
    session: (id, offset, limit, source, signal) =>
      get(
        `${base}${SESSION_URL}?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}&turnOffset=${String(offset)}&turnLimit=${String(limit)}`,
        isSessionDetail,
        signal
      ),
    search: (query, limit, tier, cursor, signal) =>
      get(
        `${base}${SEARCH_URL}?q=${encodeURIComponent(query)}&limit=${String(limit)}&tier=${tier}&cursor=${String(cursor)}`,
        isSearchValue,
        signal
      ),
    cost: (source, id, signal) =>
      get(`${base}${COST_URL}?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`, isCostValue, signal),
    handoffPrepare: (source, id, signal) =>
      post(base + HANDOFF_PREPARE_URL, { source, id, locale: t("handoff.language") }, isBriefValue, signal),
    handoffApply: (body, signal) => post(base + HANDOFF_APPLY_URL, body, isHandoffApplyValue, signal),
    handoffReveal: (sessionId) =>
      post(base + HANDOFF_REVEAL_URL, { source: "dsh", id: sessionId }, isHandoffRevealValue),
    handoffStatus: (sessionId, signal) =>
      get(`${base}${HANDOFF_STATUS_URL}?sessionId=${encodeURIComponent(sessionId)}`, isHandoffStatusValue, signal),
  }
}

/**
 * One line for a failed request: the classified error, then its detail.
 * @param failure - the failed result.
 * @returns printable text.
 */
export function failureText(failure: ApiFailure): string {
  return failure.detail === undefined ? failure.error : `${failure.error}: ${failure.detail}`
}
