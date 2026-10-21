/**
 * Route paths this plugin owns.
 *
 * The Host owns every projection of the IR; the browser only decodes. Route
 * paths are the one part of the wire nobody else can name, so they stay here;
 * the IR, the payload types and their guards come from
 * `@cyrus/dsh-session-contract`, and the document-relative spelling comes from
 * `@cyrus/dsh-plugin-kit`.
 *
 * Rules that shaped this file (docs/API.md):
 * - every number travels as a `Measure`, never as a bare token count;
 * - errors are stable string codes, never exceptions;
 * - a source that cannot answer says `available:false` with a reason instead
 *   of failing the whole page.
 *
 * @module @cyrus/dsh-context-insight/protocol/paths
 */

import { browserUrl } from "@cyrus/dsh-plugin-kit"

/** Root every route hangs off. The listener mounts it at the site root. */
export const API_ROOT = "/api/dsh-context-insight"

/** Liveness and version handshake (M1). */
export const HEALTH_PATH = `${API_ROOT}/health`
/** Per-source availability, root, session count, last scan. */
export const SOURCES_PATH = `${API_ROOT}/sources`
/** Workdir aggregation: the navigation axis. */
export const WORKDIRS_PATH = `${API_ROOT}/workdirs`
/** Light session list for one workdir: header + mtime only, no body parse. */
export const SESSIONS_PATH = `${API_ROOT}/sessions`
/** One session's IR, paged by turn. */
export const SESSION_PATH = `${API_ROOT}/session`
/** Full-text search across every readable source. */
export const SEARCH_PATH = `${API_ROOT}/search`
/** Build the handoff brief for one session (POST). */
export const HANDOFF_PREPARE_PATH = `${API_ROOT}/handoff/prepare`
/** Create a DSH session and deliver the brief (POST). */
export const HANDOFF_APPLY_PATH = `${API_ROOT}/handoff/apply`
/** Observe a delivered handoff (GET). */
export const HANDOFF_STATUS_PATH = `${API_ROOT}/handoff/status`
/** Per-session cost from the price table (GET). */
export const COST_PATH = `${API_ROOT}/cost`

/**
 * The same route as the browser must spell it. The page carries
 * `<base href="./">`, so a document-relative request has to drop the leading
 * slash; keeping both spellings here makes the difference explicit at the one
 * place it matters.
 *
 * Re-exported so the plugin's protocol module still names it once.
 */
export { browserUrl }

/** Health, spelled for the browser. */
export const HEALTH_URL: string = browserUrl(HEALTH_PATH)
/** Sources, spelled for the browser. */
export const SOURCES_URL: string = browserUrl(SOURCES_PATH)
/** Workdirs, spelled for the browser. */
export const WORKDIRS_URL: string = browserUrl(WORKDIRS_PATH)
/** Sessions, spelled for the browser. */
export const SESSIONS_URL: string = browserUrl(SESSIONS_PATH)
/** One session, spelled for the browser. */
export const SESSION_URL: string = browserUrl(SESSION_PATH)
/** Search, spelled for the browser. */
export const SEARCH_URL: string = browserUrl(SEARCH_PATH)
/** Handoff brief, spelled for the browser. */
export const HANDOFF_PREPARE_URL: string = browserUrl(HANDOFF_PREPARE_PATH)
/** Handoff apply, spelled for the browser. */
export const HANDOFF_APPLY_URL: string = browserUrl(HANDOFF_APPLY_PATH)
/** Handoff status, spelled for the browser. */
export const HANDOFF_STATUS_URL: string = browserUrl(HANDOFF_STATUS_PATH)
/** Cost, spelled for the browser. */
export const COST_URL: string = browserUrl(COST_PATH)
