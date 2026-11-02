/**
 * The token-measure vocabulary and its guard.
 *
 * Precision, basis and context part are closed sets here as well as in the IR:
 * the guard is what a browser sees before it trusts a number.
 *
 * @module @cyrusdoyle/dsh-session-contract/guards/attribution
 */

import type { Attribution, Basis, ContextPart, Measure, Precision } from "../ir.ts"
import { isRecord } from "./shared.ts"

const PRECISIONS: ReadonlySet<Precision> = new Set(["exact", "estimate"])
const BASES: ReadonlySet<Basis> = new Set([
  "usage",
  "harness-projection",
  "chars-per-token",
  "byte-length",
  "unattributed",
])

/** Context parts, duplicated from the IR as a closed set for the guard. */
const PARTS: ReadonlySet<ContextPart> = new Set([
  "system-prompt",
  "tool-definitions",
  "memory-instructions",
  "referenced-files",
  "history",
  "tool-results",
  "images",
  "user-input",
  "assistant-output",
  "thinking",
])

/**
 * Whether a wire value is a well-formed measure.
 * @param value - any decoded JSON value.
 * @returns true when tokens is finite and both tags are known. Negative tokens
 *   are legal: a residual is `total − Σparts` and can run either way.
 */
export function isMeasure(value: unknown): value is Measure {
  if (!isRecord(value)) return false
  const { tokens, precision, basis } = value
  return (
    typeof tokens === "number" &&
    Number.isFinite(tokens) &&
    PRECISIONS.has(precision as Precision) &&
    BASES.has(basis as Basis)
  )
}

/**
 * Whether a wire value is a well-formed attribution.
 * @param value - any decoded JSON value.
 * @returns true for a total, at least zero parts, and optional residual/factor.
 */
export function isAttribution(value: unknown): value is Attribution {
  if (!isRecord(value)) return false
  if (!isMeasure(value.total)) return false
  if (value.windowSize !== undefined && (typeof value.windowSize !== "number" || !Number.isFinite(value.windowSize))) {
    return false
  }
  const parts = value.parts
  if (!Array.isArray(parts)) return false
  for (const slice of parts) {
    if (!isRecord(slice)) return false
    if (!PARTS.has(slice.part as ContextPart)) return false
    if (!isMeasure(slice.measure)) return false
  }
  if (value.residual !== undefined && !isMeasure(value.residual)) return false
  if (value.reconciled !== undefined) {
    if (!isRecord(value.reconciled)) return false
    const factor = value.reconciled.factor
    if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0) return false
  }
  return true
}
