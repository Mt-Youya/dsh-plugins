/**
 * Token accounting for Codex rollouts.
 *
 * There is exactly one legal source: token_usage_record.payload.usage, one
 * record per response, identified by a response_id that is unique across this
 * corpus (4,708 records, 4,708 ids). Three neighbouring numbers look usable and
 * are not:
 * - cached_input_tokens is a subset of input_tokens (4,672 of 4,708 records;
 *   mean share 0.959), so adding them inflates input by 1.961x;
 * - event_msg.token_count.info.last_token_usage repeats the same counters and
 *   is written far more often (30,080 events), so reading both is not a 2x
 *   duplicate but a 5.69x one;
 * - turn_token_usage / thread_token_usage are cumulative (summing them inflates
 *   by 20.5x and 402.8x respectively).
 * Some sessions also log cache_write_input_tokens; on this corpus it is 0 in
 * every record, and when it is non-zero it is part of input_tokens as well.
 */

import { numberField, objectField, stringField, type JsonObject } from "./records.ts"

/** One response's token accounting, verbatim from the record. */
export interface UsageReading {
  /** Unique per response; the only de-duplication key. */
  responseId: string
  turnId?: string
  /** input_tokens as logged: the whole prompt, cached part included. */
  input: number
  /** Prompt tokens served from cache; a subset of input, never additive. */
  cachedInput: number
  cacheWrite: number
  output: number
  reasoningOutput: number
  /** total_tokens as logged; equals input + output in all 4,707 non-zero rows. */
  total: number
  /** Prompt tokens actually processed: input - cached. */
  nonCachedInput: number
}

/** Read a token_usage_record payload. */
export function readUsageRecord(payload: JsonObject): UsageReading | undefined {
  const usage = objectField(payload, "usage")
  if (usage === undefined) return undefined
  const responseId = stringField(payload, "response_id")
  if (responseId === undefined) return undefined
  const input = numberField(usage, "input_tokens") ?? 0
  const cachedInput = numberField(usage, "cached_input_tokens") ?? 0
  const reading: UsageReading = {
    responseId,
    input,
    cachedInput,
    cacheWrite: numberField(usage, "cache_write_input_tokens") ?? 0,
    output: numberField(usage, "output_tokens") ?? 0,
    reasoningOutput: numberField(usage, "reasoning_output_tokens") ?? 0,
    total: numberField(usage, "total_tokens") ?? 0,
    nonCachedInput: Math.max(0, input - cachedInput),
  }
  const turnId = stringField(payload, "turn_id")
  if (turnId !== undefined) reading.turnId = turnId
  return reading
}

/** Read a cumulative counter a usage record also carries, for the trap report. */
export function readCumulativeInput(payload: JsonObject, key: string): number | undefined {
  const cumulative = objectField(payload, key)
  return cumulative === undefined ? undefined : numberField(cumulative, "input_tokens")
}

/** The numbers a token_count event states. */
export interface TokenCountInfo {
  /** The same counters as the matching usage record. */
  lastInput?: number
  /** The model's context window as the host states it. */
  contextWindow?: number
}

/** Read the info block of a token_count event. */
export function readTokenCountInfo(payload: JsonObject): TokenCountInfo | undefined {
  const info = objectField(payload, "info")
  if (info === undefined) return undefined
  const result: TokenCountInfo = {}
  const last = objectField(info, "last_token_usage")
  if (last !== undefined) {
    const input = numberField(last, "input_tokens")
    if (input !== undefined) result.lastInput = input
  }
  const contextWindow = numberField(info, "model_context_window")
  if (contextWindow !== undefined) result.contextWindow = contextWindow
  return result
}

/**
 * The usage object of a usage record, serialized.
 *
 * Used to prove that token_count.info.last_token_usage repeats a usage record
 * verbatim instead of describing a different request.
 */
export function usageSignatureOf(payload: JsonObject, key = "usage"): string | undefined {
  const value = objectField(payload, key)
  return value === undefined ? undefined : JSON.stringify(value)
}

/** The last_token_usage object of a token_count event, serialized. */
export function lastUsageSignatureOf(payload: JsonObject): string | undefined {
  const info = objectField(payload, "info")
  if (info === undefined) return undefined
  const last = objectField(info, "last_token_usage")
  return last === undefined ? undefined : JSON.stringify(last)
}

/** Aggregate counters per response id. */
export class UsageTally {
  private readonly byResponse = new Map<string, UsageReading>()
  private readonly byTurn = new Map<string, UsageReading[]>()
  private duplicates = 0

  /**
   * Record one reading. The first observation of a response id wins: a repeat
   * carries the same counters, so counting it twice would inflate the turn.
   */
  observe(reading: UsageReading): boolean {
    if (this.byResponse.has(reading.responseId)) {
      this.duplicates += 1
      return false
    }
    this.byResponse.set(reading.responseId, reading)
    if (reading.turnId !== undefined) {
      const list = this.byTurn.get(reading.turnId)
      if (list === undefined) this.byTurn.set(reading.turnId, [reading])
      else list.push(reading)
    }
    return true
  }

  /** Distinct responses read. */
  get requests(): number {
    return this.byResponse.size
  }

  /** Repeated response ids dropped. */
  get duplicateResponses(): number {
    return this.duplicates
  }

  /** Readings recorded for one turn, in file order. */
  turnReadings(turnId: string): UsageReading[] {
    return this.byTurn.get(turnId) ?? []
  }
}
