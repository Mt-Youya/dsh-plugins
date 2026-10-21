/**
 * Compaction points in a DSH session.
 *
 * DSH registers four compaction event types (`compaction/start`, `compaction/end`,
 * `compaction/prune`, `compaction/summary`) but this machine's corpus contains
 * none of them, so the field names below are read defensively rather than
 * assumed: several plausible spellings are accepted and a missing token count
 * degrades to a zero-width point instead of dropping the boundary.
 *
 * A compaction in DSH *replaces* the carried surface with a summary rather than
 * continuing from it, so `replacedHistory` is true.
 */

import { exactMeasure, type CompactionPoint } from "@cyrus/dsh-session-contract"
import { numberField, stringField, type JsonObject } from "./records.ts"

/** Event types that mark a compaction boundary. */
const COMPACTION_TYPES = new Set(["compaction/start", "compaction/end", "compaction/prune", "compaction/summary"])

/** Whether an event type is a compaction boundary. */
export function isCompactionEvent(type: string): boolean {
  return COMPACTION_TYPES.has(type)
}

/** First numeric field among the candidate names. */
function firstNumber(data: JsonObject, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = numberField(data, key)
    if (value !== undefined) return value
  }
  return undefined
}

/** First string field among the candidate names. */
function firstString(data: JsonObject, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = stringField(data, key)
    if (value !== undefined) return value
  }
  return undefined
}

/**
 * Build a compaction point from one event.
 * @param type - the event type.
 * @param data - the event's `data`.
 * @param at - the event's timestamp.
 * @param observedTokens - context size the log recorded around the boundary, used
 *   when the event itself carries no counters.
 * @returns undefined when the event carries no usable number at all.
 */
export function readCompaction(
  type: string,
  data: JsonObject,
  at: number,
  observedTokens: number
): CompactionPoint | undefined {
  if (!COMPACTION_TYPES.has(type)) return undefined
  const before = firstNumber(data, ["beforeTokens", "preTokens", "before", "tokensBefore", "beforeSize"])
  const after = firstNumber(data, ["afterTokens", "postTokens", "after", "tokensAfter", "afterSize"])
  const trigger = firstString(data, ["trigger", "reason", "cause", "kind"])
  const point: CompactionPoint = {
    at,
    before: exactMeasure(before ?? observedTokens),
    after: exactMeasure(after ?? 0),
    replacedHistory: true,
  }
  if (trigger !== undefined) point.trigger = trigger
  return point
}

/**
 * Whether a compaction point's counters are self-consistent.
 *
 * A boundary whose `after` is zero or larger than its `before` did not shrink
 * anything, which means the fields were read from the wrong keys. Callers
 * report it through `Session.dataQuality` instead of trusting the pair.
 */
export function isCompactionConsistent(point: CompactionPoint): boolean {
  return point.after.tokens > 0 && point.after.tokens <= point.before.tokens
}
