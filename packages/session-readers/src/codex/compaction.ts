/**
 * Compaction boundaries.
 *
 * Codex compacts by *replacing* history: a compacted record carries the
 * complete replacement_history, an empty message (it is empty in all 281
 * records on this corpus), the window numbering, and — when present — the exact
 * usage snapshot taken at the boundary. The window really did get smaller:
 * input falls from 177k-241k to 43k-67k tokens at every boundary that states
 * both numbers, which is a substitution, never an append.
 */

import type { CompactionPoint } from "@cyrus/dsh-session-contract"
import { numberField, objectArrayField, objectField, type JsonObject } from "./records.ts"
import { readUsageRecord, type UsageReading } from "./usage.ts"

/** What a compacted payload says. */
export interface CompactedRecord {
  /** Window counter, when the record states one. */
  windowNumber?: number
  /** Exact usage at the boundary. */
  latestUsage?: UsageReading
  /** The history that replaces everything before the boundary. */
  replacementHistory: JsonObject[]
  /** Messages the boundary claims to keep, for evidence. */
  retainedUserMessages?: number
  retainedAssistantMessages?: number
}

/** Read a compacted payload. */
export function readCompacted(payload: JsonObject): CompactedRecord {
  const result: CompactedRecord = { replacementHistory: objectArrayField(payload, "replacement_history") }
  const windowNumber = numberField(payload, "window_number")
  if (windowNumber !== undefined) result.windowNumber = windowNumber
  const latest = objectField(payload, "latest_token_usage_record")
  if (latest !== undefined) {
    const reading = readUsageRecord(latest)
    if (reading !== undefined) result.latestUsage = reading
  }
  const retained = objectField(payload, "retained_context")
  if (retained !== undefined) {
    const userMessages = retained["user_messages"]
    if (Array.isArray(userMessages)) result.retainedUserMessages = userMessages.length
    const assistantMessages = retained["assistant_messages"]
    if (Array.isArray(assistantMessages)) result.retainedAssistantMessages = assistantMessages.length
  }
  return result
}

/**
 * Build the IR compaction point.
 *
 * replacedHistory is true: unlike a Claude summary, this record hands the model
 * a stored history it must use instead of the transcript before it.
 * @param at - boundary timestamp, epoch ms.
 * @param beforeTokens - exact prompt size of the last request before the boundary.
 * @param afterTokens - exact prompt size recorded at or after the boundary.
 * @param trigger - window number as the host numbered it.
 */
export function toCompactionPoint(
  at: number,
  beforeTokens: number,
  afterTokens: number,
  trigger?: string
): CompactionPoint {
  const point: CompactionPoint = {
    at,
    before: { tokens: beforeTokens, precision: "exact", basis: "usage" },
    after: { tokens: afterTokens, precision: "exact", basis: "usage" },
    replacedHistory: true,
  }
  if (trigger !== undefined) point.trigger = trigger
  return point
}
