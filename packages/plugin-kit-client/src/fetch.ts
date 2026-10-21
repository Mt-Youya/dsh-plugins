/**
 * The browser half's only door to the Host.
 *
 * Every answer is decoded through a guard the caller supplies, so a drifted
 * Host produces a typed failure the panel can render instead of a crash deep in
 * a component. URLs are document-relative on purpose: the page carries
 * `<base href="./">` and the routes are mounted at the site root.
 *
 * The failure vocabulary stays the caller's: `codes` names what that plugin can
 * answer with, and anything else degrades to `fallback`.
 *
 * @module @cyrus/dsh-plugin-kit-client/fetch
 */

import { decodeEnvelope } from "@cyrus/dsh-plugin-kit"

/** One failed call, already classified. */
export interface ApiFailure {
  ok: false
  /** A protocol code, or `network` / `aborted` when no answer arrived. */
  error: string
  detail?: string
  /** HTTP status when one was received. */
  status?: number
}

/** A decoded answer. */
export type ApiResult<T> = { ok: true; value: T } | ApiFailure

/** One request, already resolved to a URL and a payload guard. */
export interface JsonRequest<T> {
  /** Document-relative route. */
  url: string
  /** Payload guard. */
  guard: (payload: unknown) => payload is T
  /** Failure codes this caller understands. */
  codes: readonly string[]
  /** Code an unrecognised envelope degrades to; `parse-failed` by default. */
  fallback?: string
  /** Cancellation. */
  signal?: AbortSignal
  /** Defaults to GET. */
  method?: "GET" | "POST"
  /** JSON body; only sent with a method that carries one. */
  body?: unknown
}

/**
 * Perform one request and decode its envelope.
 * @param request - url, guard, vocabulary and optional body/cancellation.
 * @returns the decoded payload or a classified failure.
 */
export async function requestJson<T>(request: JsonRequest<T>): Promise<ApiResult<T>> {
  const method = request.method ?? "GET"
  let response: Response
  try {
    response = await fetch(request.url, {
      method,
      signal: request.signal ?? null,
      credentials: "same-origin",
      headers:
        method === "POST"
          ? { accept: "application/json", "content-type": "application/json" }
          : { accept: "application/json" },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, error: "aborted" }
    return { ok: false, error: "network" }
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { ok: false, error: "parse-failed", detail: "not-json", status: response.status }
  }
  const decoded = decodeEnvelope(payload, request.guard, request.codes, request.fallback ?? "parse-failed")
  if (decoded.ok) return { ok: true, value: decoded.value }
  return {
    ok: false,
    error: decoded.error,
    status: response.status,
    ...(decoded.detail === undefined ? {} : { detail: decoded.detail }),
  }
}
