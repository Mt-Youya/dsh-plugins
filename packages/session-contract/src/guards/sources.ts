/**
 * The source vocabulary and the answers built on it: which sources exist, and
 * whether they are healthy.
 *
 * @module @cyrus/dsh-session-contract/guards/sources
 */

import { CONTEXT_SOURCES } from "../types.ts"
import type { ContextSource, HealthFailure, HealthOk, HealthResponse, HealthValue, SourcesValue } from "../types.ts"
import { isRecord } from "./shared.ts"

/**
 * Whether a value is a well-formed sources answer.
 * @param value - any decoded JSON value.
 * @returns true when every entry names a source and its availability.
 */
export function isSourcesValue(value: unknown): value is SourcesValue {
  if (!isRecord(value) || !Array.isArray(value.sources)) return false
  return value.sources.every((entry) => {
    if (!isRecord(entry)) return false
    if (!CONTEXT_SOURCES.includes(entry.source as ContextSource)) return false
    if (typeof entry.available !== "boolean") return false
    if (entry.reason !== undefined && typeof entry.reason !== "string") return false
    if (entry.root !== undefined && typeof entry.root !== "string") return false
    return true
  })
}

/**
 * Whether a wire value is a well-formed health body.
 * @param value - any decoded JSON value.
 * @returns true when every field is present and typed; extra fields are ignored.
 */
export function isHealthValue(value: unknown): value is HealthValue {
  if (!isRecord(value)) return false
  const { version, sources } = value
  return typeof version === "string" && Array.isArray(sources) && sources.every(isContextSource)
}

/**
 * Whether a wire value names a known source.
 * @param value - any decoded JSON value.
 * @returns true when the value is a member of {@link CONTEXT_SOURCES}.
 */
export function isContextSource(value: unknown): value is ContextSource {
  return value === "claude" || value === "dsh" || value === "codex"
}

/**
 * Whether a wire value is a health response this client can act on. The guard
 * admits both variants: the panel renders the failure reason instead of
 * treating a refused request as a malformed one.
 * @param value - any decoded JSON value.
 * @returns true for a well-formed {@link HealthOk} or {@link HealthFailure}.
 */
export function isHealthResponse(value: unknown): value is HealthResponse {
  if (!isRecord(value)) return false
  if (value.ok === true) return isHealthValue(value.value)
  if (value.ok === false) return typeof value.error === "string" && value.error !== ""
  return false
}
