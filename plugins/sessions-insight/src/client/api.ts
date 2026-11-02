/**
 * The panel's only door to the Host.
 *
 * Every answer is decoded through a protocol guard, so a drifted Host produces
 * a typed failure the panel can render instead of a crash deep in a component.
 * The transport — fetch, JSON decoding, envelope decoding and failure
 * classification — is `@cyrusdoyle/dsh-plugin-kit-client`; what this module adds is the
 * endpoint list and the guards each endpoint's payload is checked against.
 *
 * URLs are document-relative on purpose: the page carries `<base href="./">`
 * and the routes are mounted at the site root.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/client/api
 */

import { type ApiFailure, type ApiResult, requestJson } from "@cyrusdoyle/dsh-plugin-kit-client"

import {
  type AiTitleValue,
  API_ERROR_CODES,
  type BriefValue,
  COST_URL,
  type CostValue,
  type DeleteSessionValue,
  HANDOFF_APPLY_URL,
  HANDOFF_PREPARE_URL,
  HANDOFF_REVEAL_URL,
  HANDOFF_STATUS_URL,
  type HandoffApplyValue,
  type HandoffRevealValue,
  type HandoffStatusValue,
  type InsightSessionDetail,
  isAiTitleValue,
  isBriefValue,
  isCostValue,
  isDeleteSessionValue,
  isHandoffApplyValue,
  isHandoffRevealValue,
  isHandoffStatusValue,
  isInsightSessionDetail,
  isMetadataValue,
  isSearchValue,
  isSessionMetadataValue,
  isSessionsValue,
  isSourcesValue,
  isWorkdirsValue,
  type MetadataPatch,
  type MetadataValue,
  SEARCH_URL,
  type SearchTier,
  type SearchValue,
  SESSION_AI_TITLE_URL,
  SESSION_DELETE_URL,
  SESSION_METADATA_URL,
  SESSION_URL,
  type SessionMetadataValue,
  SESSIONS_URL,
  type SessionsValue,
  SOURCES_URL,
  type SourcesValue,
  WORKDIRS_URL,
  type WorkdirsValue,
} from "../protocol.ts"
import { t } from "./locale.ts"
import { clientListCache } from "./state/list-cache.ts"

export type { ApiFailure, ApiResult } from "@cyrusdoyle/dsh-plugin-kit-client"

/** The reads the panel performs. */
export interface Api {
  deleteSession(source: string, id: string): Promise<ApiResult<DeleteSessionValue>>
  metadata(signal?: AbortSignal): Promise<ApiResult<MetadataValue>>
  updateMetadata(patch: MetadataPatch): Promise<ApiResult<SessionMetadataValue>>
  suggestTitle(source: string, id: string, signal?: AbortSignal): Promise<ApiResult<AiTitleValue>>
  sources(signal?: AbortSignal): Promise<ApiResult<SourcesValue>>
  workdirs(signal?: AbortSignal, refresh?: boolean): Promise<ApiResult<WorkdirsValue>>
  sessions(workdir: string, signal?: AbortSignal): Promise<ApiResult<SessionsValue>>
  session(
    id: string,
    offset: number,
    limit: number,
    source: string,
    signal?: AbortSignal,
  ): Promise<ApiResult<InsightSessionDetail>>
  search(
    query: string,
    limit: number,
    tier: SearchTier,
    cursor: number,
    signal?: AbortSignal,
  ): Promise<ApiResult<SearchValue>>
  cost(source: string, id: string, signal?: AbortSignal): Promise<ApiResult<CostValue>>
  handoffPrepare(source: string, id: string, signal?: AbortSignal): Promise<ApiResult<BriefValue>>
  handoffApply(
    body: { source: string; id: string; cwd: string; brief: string },
    signal?: AbortSignal,
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
  const cache = clientListCache(base)
  return {
    deleteSession: (source, id) => post(base + SESSION_DELETE_URL, { source, id }, isDeleteSessionValue),
    metadata: (signal) => get(base + SESSION_METADATA_URL, isMetadataValue, signal),
    updateMetadata: (patch) => post(base + SESSION_METADATA_URL, patch, isSessionMetadataValue),
    suggestTitle: (source, id, signal) => post(base + SESSION_AI_TITLE_URL, { source, id }, isAiTitleValue, signal),
    sources: (signal) =>
      cache.read(
        "sources",
        (sharedSignal) => get(base + SOURCES_URL, isSourcesValue, sharedSignal),
        (value) => {
          cache.sources = value
        },
        signal,
      ),
    workdirs: (signal, refresh = false) =>
      cache.read(
        `workdirs:${String(refresh)}`,
        (sharedSignal) => get(base + WORKDIRS_URL + (refresh ? "?refresh=1" : ""), isWorkdirsValue, sharedSignal),
        (value) => {
          cache.workdirs = value
        },
        signal,
      ),
    sessions: (workdir, signal) =>
      cache.read(
        `sessions:${workdir}`,
        (sharedSignal) =>
          get(`${base}${SESSIONS_URL}?workdir=${encodeURIComponent(workdir)}`, isSessionsValue, sharedSignal).then(
            (result) => (result.ok ? { ok: true as const, value: cache.projectSessions(result.value) } : result),
          ),
        (value) => {
          cache.sessions.set(workdir, value)
        },
        signal,
      ),
    session: (id, offset, limit, source, signal) =>
      get(
        `${base}${SESSION_URL}?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}&turnOffset=${String(offset)}&turnLimit=${String(limit)}`,
        isInsightSessionDetail,
        signal,
      ),
    search: (query, limit, tier, cursor, signal) =>
      get(
        `${base}${SEARCH_URL}?q=${encodeURIComponent(query)}&limit=${String(limit)}&tier=${tier}&cursor=${String(cursor)}`,
        isSearchValue,
        signal,
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

/** Preload only navigation metadata; session bodies remain on demand. */
export async function preloadSessionLists(api: Api = createApi(), signal?: AbortSignal): Promise<void> {
  const [, workdirs] = await Promise.all([api.sources(signal), api.workdirs(signal)])
  if (signal?.aborted || !workdirs.ok) return
  const first = workdirs.value.workdirs[0]
  if (first !== undefined) await api.sessions(first.workdir, signal)
}

/**
 * One line for a failed request: the classified error, then its detail.
 * @param failure - the failed result.
 * @returns printable text.
 */
export function failureText(failure: ApiFailure): string {
  return failure.detail === undefined ? failure.error : `${failure.error}: ${failure.detail}`
}
