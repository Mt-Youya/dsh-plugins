/**
 * Token accounting for Claude Code records.
 *
 * A response is written as one record per content block, and every one of them
 * repeats the same `usage`. Summing per record inflates the corpus by ~3.3x
 * (7,816 assistant rows carry only 2,354 distinct `message.id`s), so usage is
 * always normalized by message id first.
 */

import { numberField, objectField, type JsonObject } from "./records.ts"

/** One request's token accounting, already normalized. */
export interface UsageReading {
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
  /** Context size as this source defines it: everything sent, cache included. */
  totalContext: number
}

/**
 * Read the usage object of an assistant message.
 *
 * Only the scalar `cache_creation_input_tokens` is used: the split
 * `cache_creation.ephemeral_*` counters are 0 in 76% of records, so they would
 * silently drop three quarters of the cache-write cost. `output_tokens`
 * details are ignored for the same reason: `thinking_tokens` is non-zero in 16
 * records corpus-wide and always 997, i.e. a constant rather than a measure.
 * Thinking volume is estimated from the thinking text instead.
 * @param usage - the `message.usage` object.
 * @returns undefined when the object carries no usable counters.
 */
export function readUsage(usage: JsonObject | undefined): UsageReading | undefined {
  if (usage === undefined) return undefined
  const input = numberField(usage, "input_tokens") ?? 0
  const cacheRead = numberField(usage, "cache_read_input_tokens") ?? 0
  const cacheWrite = numberField(usage, "cache_creation_input_tokens") ?? 0
  const output = numberField(usage, "output_tokens") ?? 0
  if (input === 0 && cacheRead === 0 && cacheWrite === 0 && output === 0) return undefined
  return { input, cacheRead, cacheWrite, output, totalContext: input + cacheRead + cacheWrite }
}

/** Read the usage attached to an assistant record, if any. */
export function readRecordUsage(record: JsonObject): UsageReading | undefined {
  return readUsage(objectField(objectField(record, "message") ?? {}, "usage"))
}

/**
 * Collapses the per-block duplicates of one message into one reading.
 *
 * 817 message ids carry different usage across their blocks. The later block
 * of a streamed response holds the complete counters, so the largest
 * `totalContext` wins; the disagreement itself is reported as data quality
 * instead of being silently averaged.
 */
export class UsageNormalizer {
  private readonly byMessageId = new Map<string, UsageReading>()
  private inconsistent = 0
  private uncounted = 0

  /** @param messageId - `message.id`; records without one are counted, not stored. */
  observe(messageId: string | undefined, reading: UsageReading): UsageReading {
    if (messageId === undefined) {
      this.uncounted += 1
      return reading
    }
    const previous = this.byMessageId.get(messageId)
    if (previous === undefined) {
      this.byMessageId.set(messageId, reading)
      return reading
    }
    if (previous.totalContext !== reading.totalContext || previous.output !== reading.output) {
      this.inconsistent += 1
    }
    if (reading.totalContext > previous.totalContext) {
      this.byMessageId.set(messageId, reading)
      return reading
    }
    return previous
  }

  /** Distinct message ids seen. */
  get distinctMessages(): number {
    return this.byMessageId.size
  }

  /** Observations that carried no message id and could not be de-duplicated. */
  get withoutMessageId(): number {
    return this.uncounted
  }

  /** Message ids whose repeated usage disagreed. */
  get inconsistentMessages(): number {
    return this.inconsistent
  }
}
