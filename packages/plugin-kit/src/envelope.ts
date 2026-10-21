/**
 * The JSON envelope every route answers with, and the decoder both halves share.
 *
 * The shape is deliberately generic: a route either carries a payload or a
 * stable string code, and the code vocabulary belongs to the plugin that
 * defines it. `Code` is therefore a type parameter here rather than a union
 * imported from somewhere above — this module knows nothing about which plugins
 * exist.
 *
 * @module @cyrus/dsh-plugin-kit/envelope
 */

/** A successful answer. */
export interface Ok<T> {
  ok: true
  value: T
}

/**
 * A failed answer.
 *
 * `detail` never replaces the code: it carries the specific that made this
 * particular failure different from another one with the same code.
 */
export interface Fail<Code extends string = string> {
  ok: false
  error: Code
  detail?: string
}

/** Either half. */
export type Envelope<T, Code extends string = string> = Ok<T> | Fail<Code>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Read an envelope without trusting its payload type.
 * @param value - any decoded JSON value.
 * @param guard - payload guard, supplied by the caller that knows the payload.
 * @param codes - the failure codes this caller understands.
 * @param fallback - the code an unrecognised or malformed envelope degrades to.
 * @returns the payload when `ok` and the guard passed, otherwise a failure code.
 */
export function decodeEnvelope<T, Code extends string>(
  value: unknown,
  guard: (payload: unknown) => payload is T,
  codes: readonly Code[],
  fallback: Code
): Ok<T> | Fail<Code> {
  if (!isRecord(value)) return { ok: false, error: fallback, detail: "envelope-not-an-object" }
  if (value.ok === true) {
    if (guard(value.value)) return { ok: true, value: value.value }
    return { ok: false, error: fallback, detail: "payload-shape" }
  }
  if (value.ok === false) {
    const error = typeof value.error === "string" ? value.error : fallback
    const code = (codes as readonly string[]).includes(error) ? (error as Code) : fallback
    const detail = typeof value.detail === "string" ? value.detail : undefined
    return detail === undefined ? { ok: false, error: code } : { ok: false, error: code, detail }
  }
  return { ok: false, error: fallback, detail: "envelope-without-ok" }
}
