/**
 * The envelope decoder is the kit's; the binding below supplies this contract's
 * code vocabulary so callers keep the two-argument form.
 *
 * @module @cyrus/dsh-session-contract/guards/envelope
 */

import { decodeEnvelope as decodeEnvelopeOf } from "@cyrus/dsh-plugin-kit"
import { API_ERROR_CODES } from "../types.ts"
import type { ApiErrorCode } from "../types.ts"

/**
 * Read an envelope without trusting its payload type.
 * @param value - any decoded JSON value.
 * @returns the payload when `ok` and a guard passed, otherwise a failure code.
 */
export function decodeEnvelope<T>(
  value: unknown,
  guard: (payload: unknown) => payload is T
): { ok: true; value: T } | { ok: false; error: ApiErrorCode; detail?: string } {
  return decodeEnvelopeOf(value, guard, API_ERROR_CODES, "parse-failed")
}
