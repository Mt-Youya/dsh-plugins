/**
 * Primitives every decoder in this folder shares.
 *
 * Object shape, finite numbers and string arrays: the checks each view guard
 * would otherwise repeat.
 *
 * @module @cyrus/dsh-session-contract/guards/shared
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

// Exported for the sibling decoders only: the package barrel does not publish them.
export { isNumber, isRecord, isStringArray }
