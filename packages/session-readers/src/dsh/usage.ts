/**
 * Token accounting for DSH model requests.
 *
 * DSH records four counters per response and one derived total. The recorded
 * arithmetic is `totalTokens = inputTokens + cacheReadTokens + cacheWriteTokens
 * + outputTokens`, and `inputTokens` is the *uncached remainder*, not the whole
 * prompt: once the prefix is cached it falls to a few hundred while
 * `cacheReadTokens` carries the window. The prompt a request actually sent is
 * therefore `input + cacheRead + cacheWrite`, which is the same normalization
 * Claude Code needs and the opposite of Codex (where `cached` is already inside
 * `input`).
 *
 * Verified against `contextPressure.pressureTokens`, which the harness derives
 * from the same usage: the two agree exactly on every sampled session.
 */

import { numberField, objectField, type JsonObject } from "./records.ts"

/** One request's token accounting, normalized to this adapter's definition. */
export interface DshUsageReading {
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
  /** Everything the request sent: `input + cacheRead + cacheWrite`. */
  prompt: number
  /** The log's own `totalTokens`: prompt plus output. */
  total: number
}

/**
 * Read one `assistant/message.data.usage` object.
 * @param usage - the recorded usage object.
 * @returns undefined when the object carries no usable counters.
 */
export function readDshUsage(usage: JsonObject | undefined): DshUsageReading | undefined {
  if (usage === undefined) return undefined
  const input = numberField(usage, "inputTokens") ?? 0
  const cacheRead = numberField(usage, "cacheReadTokens") ?? 0
  const cacheWrite = numberField(usage, "cacheWriteTokens") ?? 0
  const output = numberField(usage, "outputTokens") ?? 0
  const recorded = numberField(usage, "totalTokens")
  if (input === 0 && cacheRead === 0 && cacheWrite === 0 && output === 0) return undefined
  const prompt = input + cacheRead + cacheWrite
  return { input, cacheRead, cacheWrite, output, prompt, total: recorded ?? prompt + output }
}

/** Read the usage of one `assistant/message` event. */
export function readEventUsage(data: JsonObject): DshUsageReading | undefined {
  return readDshUsage(objectField(data, "usage"))
}

/**
 * Accumulates a turn's requests and watches the recorded arithmetic.
 *
 * Every reading is kept, because a turn's context is the size of its *largest*
 * request while its usage is the sum over requests; conflating the two is how a
 * window gets counted N times.
 */
export class DshUsageNormalizer {
  private input = 0
  private cacheRead = 0
  private cacheWrite = 0
  private output = 0
  private peak = 0
  private requests = 0
  private mismatched = 0

  /** Fold one request into the turn. */
  observe(reading: DshUsageReading): void {
    this.input += reading.input
    this.cacheRead += reading.cacheRead
    this.cacheWrite += reading.cacheWrite
    this.output += reading.output
    this.requests += 1
    if (reading.prompt > this.peak) this.peak = reading.prompt
    // The recorded total is prompt + output; a disagreement means the log's own
    // arithmetic changed and every downstream figure needs re-checking.
    if (reading.total !== reading.prompt + reading.output) this.mismatched += 1
  }

  /** Requests folded so far. */
  get requestCount(): number {
    return this.requests
  }

  /** Largest prompt this turn sent; the turn's context size. */
  get peakContext(): number {
    return this.peak
  }

  /** Requests whose `totalTokens` did not equal prompt + output. */
  get inconsistentTotal(): number {
    return this.mismatched
  }

  /** True when at least one request was folded. */
  get seen(): boolean {
    return this.requests > 0
  }

  /** The turn's summed counters with the peak as its context size. */
  toUsage(): { input: number; cacheRead: number; cacheWrite: number; output: number; totalContext: number } {
    return {
      input: this.input,
      cacheRead: this.cacheRead,
      cacheWrite: this.cacheWrite,
      output: this.output,
      totalContext: this.peak,
    }
  }
}
