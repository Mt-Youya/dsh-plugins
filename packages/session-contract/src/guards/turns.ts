/**
 * The turn window request and the turn guard.
 *
 * @module @cyrus/dsh-session-contract/guards/turns
 */

import type { CompactionPoint, Turn, Usage } from "../ir.ts"
import { DEFAULT_TURN_LIMIT, MAX_TURN_LIMIT } from "../types.ts"
import type { TurnWindow } from "../types.ts"
import { isAttribution, isMeasure } from "./attribution.ts"
import { isNumber, isRecord, isStringArray } from "./shared.ts"

export function parseTurnWindow(params: URLSearchParams): TurnWindow | undefined {
  const rawOffset = params.get("turnOffset")
  const rawLimit = params.get("turnLimit")
  let offset = 0
  let limit = DEFAULT_TURN_LIMIT
  if (rawOffset !== null && rawOffset !== "") {
    if (!/^\d{1,7}$/.test(rawOffset)) return undefined
    offset = Number(rawOffset)
  }
  if (rawLimit !== null && rawLimit !== "") {
    if (!/^\d{1,4}$/.test(rawLimit)) return undefined
    limit = Number(rawLimit)
    if (limit < 1) return undefined
    if (limit > MAX_TURN_LIMIT) limit = MAX_TURN_LIMIT
  }
  return { offset, limit }
}

function isUsage(value: unknown): value is Usage {
  if (!isRecord(value)) return false
  return (
    isNumber(value.input) &&
    isNumber(value.cacheRead) &&
    isNumber(value.cacheWrite) &&
    isNumber(value.output) &&
    isNumber(value.totalContext)
  )
}

function isCompaction(value: unknown): value is CompactionPoint {
  if (!isRecord(value)) return false
  return (
    isNumber(value.at) &&
    isMeasure(value.before) &&
    isMeasure(value.after) &&
    typeof value.replacedHistory === "boolean"
  )
}

/**
 * Whether a wire value is a well-formed turn.
 * @param value - any decoded JSON value.
 * @returns true when the fields the panel renders are all present and typed.
 */
export function isTurn(value: unknown): value is Turn {
  if (!isRecord(value)) return false
  if (!isNumber(value.index) || !isNumber(value.startedAt)) return false
  if (!isStringArray(value.userInput) || !isStringArray(value.assistantText)) return false
  if (!isStringArray(value.subagents)) return false
  if (!isAttribution(value.attribution)) return false
  if (!Array.isArray(value.toolCalls) || !Array.isArray(value.compactions)) return false
  if (!value.compactions.every(isCompaction)) return false
  if (value.usage !== undefined && !isUsage(value.usage)) return false
  return true
}
