/**
 * This plugin's binding of the shared HTTP plumbing to its own wire vocabulary.
 *
 * The mechanisms — same-origin gate, envelope writers, bounded body reader —
 * live in `@cyrus/dsh-plugin-kit-host` and know nothing about sessions-insight. What
 * stays here is the part that is genuinely this plugin's: which failure code
 * maps to which status, and which two codes a refused request answers with.
 *
 * A route handler owns its response lifecycle — the Host web server does not
 * touch the response after the call — so every branch writes exactly one and
 * returns.
 *
 * @module @cyrus/dsh-sessions-insight/host/http
 */

import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "node:http"
import {
  guardRequest as kitGuardRequest,
  statusOf as kitStatusOf,
  writeFail as kitWriteFail,
} from "@cyrus/dsh-plugin-kit-host"
import type { ApiErrorCode } from "../../protocol.ts"

export type { RouteHandler, WebRoute } from "@cyrus/dsh-plugin-kit-host"
export {
  MAX_BODY_BYTES,
  isJsonContentType,
  isSameOrigin,
  readJsonBody,
  requestUrl,
  writeJson,
  writeOk,
} from "@cyrus/dsh-plugin-kit-host"

/**
 * HTTP status for each failure code.
 *
 * `source-unavailable` is 503 rather than 500 on purpose: one source being
 * unreadable is a retryable condition of that source, not a broken server, and
 * the panel renders it as a per-source notice.
 */
const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  "bad-request": 400,
  forbidden: 403,
  "not-found": 404,
  "method-not-allowed": 405,
  "read-limit": 413,
  "parse-failed": 422,
  "source-unavailable": 503,
  "handoff-unavailable": 503,
}

/** The codes the origin/method gate answers with. */
const REFUSALS = { forbidden: "forbidden", methodNotAllowed: "method-not-allowed" } as const

/**
 * Status one failure code answers with.
 * @param code - a stable failure code.
 * @returns the HTTP status.
 */
export function statusOf(code: ApiErrorCode): number {
  return kitStatusOf(STATUS_BY_CODE, code)
}

/**
 * Write a failure envelope at the status its code implies.
 * @param res - the response this handler owns.
 * @param code - stable failure code.
 * @param detail - optional specific; never replaces the code.
 * @param headers - extra headers, e.g. `allow`.
 */
export function writeFail(
  res: ServerResponse,
  code: ApiErrorCode,
  detail?: string,
  headers: OutgoingHttpHeaders = {}
): void {
  kitWriteFail(res, STATUS_BY_CODE, code, detail, headers)
}

/**
 * Gate every route on origin, then on method.
 * @param req - the incoming request.
 * @param res - the response this handler owns.
 * @param allowed - methods the route serves.
 * @returns true when the caller may continue; a refusal has been written.
 */
export function guardRequest(req: IncomingMessage, res: ServerResponse, allowed: readonly string[]): boolean {
  return kitGuardRequest(req, res, allowed, STATUS_BY_CODE, REFUSALS)
}
