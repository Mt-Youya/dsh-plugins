/**
 * What one DSH turn's prompt was made of.
 *
 * Two bases are available and they are not equivalent, so the adapter prefers
 * the stronger one and says which it used:
 *
 * 1. **harness-projection** — `contextTimeline.requests[]` records, per request,
 *    the harness's own token split (system, tools, user, inject, skill,
 *    assistant, tool) plus the exact `prompt` the provider counted. These
 *    numbers are the harness's measurement, not ours, so they keep
 *    `precision: 'exact'`.
 * 2. **chars-per-token** — when no fresh projection covers the turn, the slices
 *    are counted from the log text with the shared calipers.
 *
 * Neither closes the books. The harness's own parts sum to `request.total`,
 * which is systematically **below** the `prompt` the provider actually billed
 * (measured: 55-74% coverage across samples). That difference is not a caliper
 * problem we may scale away — it is context the harness itself does not
 * attribute — so it stays visible as `residual`.
 *
 * @see docs/adr/0005-honest-attribution-residual.md
 * @see docs/IR.md (对账的边界)
 */

import {
  addImage,
  addSchema,
  addText,
  emptyCharCounts,
  isEmptyCounts,
  measureOf,
  projectedMeasure,
  type CharCounts,
} from "../attribution.ts"
import { exactMeasure, residualMeasure, type Attribution, type ContextPart, type Measure } from "@cyrus/dsh-session-contract"
import type { ProjectionRequest } from "./projection.ts"

/**
 * Upper bound of a correction that can still be called measurement error.
 *
 * Deliberately asymmetric, exactly as the Claude adapter's window is: shrinking
 * always means our calipers over-counted, while growing past this bound is far
 * more likely a whole category we cannot see than a 25% caliper error.
 */
const MAX_RECONCILE_FACTOR = 1.25

/** A token count the harness itself measured. Exact, but not a `usage` field. */
export function projectionMeasure(tokens: number): Measure {
  return { tokens, precision: "exact", basis: "harness-projection" }
}

/** Projection evidence a caller hands to {@link DshAttributionWindow.attribution}. */
export interface AttributionOptions {
  /** The harness's record of this turn's peak request. */
  request?: ProjectionRequest
  /** The request immediately before it, used to separate carried from new. */
  previous?: ProjectionRequest
  /** Context window size, only from the log's own `request/context`. */
  windowSize?: number
}

/** Per-turn buckets, folded into `carried` when the turn closes. */
interface TurnBuckets {
  userInput: CharCounts
  assistantOutput: CharCounts
  thinking: CharCounts
  toolResults: CharCounts
  images: CharCounts
}

function emptyBuckets(): TurnBuckets {
  return {
    userInput: emptyCharCounts(),
    assistantOutput: emptyCharCounts(),
    thinking: emptyCharCounts(),
    toolResults: emptyCharCounts(),
    images: emptyCharCounts(),
  }
}

function mergeInto(target: CharCounts, source: CharCounts): void {
  target.text += source.text
  target.cjk += source.cjk
  target.schema += source.schema
  target.projected += source.projected
}

/** Outcome of fitting the character slices onto the exact total. */
interface ReconcileOutcome {
  factor?: number
  residual?: number
}

/**
 * Fit the character slices to the exact total, but only when the difference can
 * be measurement error.
 *
 * Same rule as elsewhere in this codebase: a structural gap forbids scaling,
 * and growth beyond {@link MAX_RECONCILE_FACTOR} is treated as a missing
 * category rather than noise.
 */
function reconcile(
  parts: { part: ContextPart; measure: Measure }[],
  totalTokens: number,
  structuralGap: boolean
): ReconcileOutcome {
  let estimated = 0
  for (const slice of parts) estimated += slice.measure.tokens
  if (structuralGap || totalTokens <= 0 || estimated <= 0) return { residual: totalTokens - estimated }
  const factor = totalTokens / estimated
  if (factor > MAX_RECONCILE_FACTOR) return { residual: totalTokens - estimated }

  let scaled = 0
  let largest = 0
  for (let index = 0; index < parts.length; index += 1) {
    const slice = parts[index]
    if (slice === undefined) continue
    slice.measure = { ...slice.measure, tokens: Math.round(slice.measure.tokens * factor) }
    scaled += slice.measure.tokens
    const heaviest = parts[largest]
    if (heaviest === undefined || slice.measure.tokens > heaviest.measure.tokens) largest = index
  }
  // Rounding each slice drifts a few tokens; the identity has to hold exactly,
  // so the drift lands on the heaviest slice.
  const heaviest = parts[largest]
  const drift = totalTokens - scaled
  if (heaviest !== undefined && drift !== 0) {
    heaviest.measure = { ...heaviest.measure, tokens: heaviest.measure.tokens + drift }
  }
  return { factor: Math.round(factor * 10_000) / 10_000 }
}

/**
 * The accumulating window of one DSH session.
 *
 * Fed event by event; produces one `Attribution` per turn. It answers the same
 * question the Claude window does — "what did this request carry" — so a turn's
 * context is the carried window plus what the turn added, never the turn's own
 * text alone.
 */
export class DshAttributionWindow {
  /** The system prompt as the log recorded it (a `system/message` surface event). */
  private system: CharCounts = emptyCharCounts()
  /** Tool definitions, serialized from the latest `request/header`. */
  private schema: CharCounts = emptyCharCounts()
  /** Injected reminders and notices: the harness's own scaffolding. */
  private injected: CharCounts = emptyCharCounts()
  /** Everything earlier turns of this segment contributed. */
  private carried: CharCounts = emptyCharCounts()
  private current: TurnBuckets = emptyBuckets()

  private projectionTurns = 0
  private estimateTurns = 0
  private residualTurns = 0
  private scaledTurns = 0
  private worstFactor = 1
  private worstResidualShare = 0
  private worstOverCountShare = 0
  private negativeResidualWithoutGap = 0
  private deltaRegressions = 0
  private rawTokens = 0

  /** Turns whose slices came from the harness projection. */
  get projectionTurnCount(): number {
    return this.projectionTurns
  }

  /** Turns that fell back to character counts. */
  get estimateTurnCount(): number {
    return this.estimateTurns
  }

  /** Turns that kept an explicit unknown share. */
  get residualTurnCount(): number {
    return this.residualTurns
  }

  /** Turns whose character slices were scaled onto the total. */
  get scaledTurnCount(): number {
    return this.scaledTurns
  }

  /** Worst scaling factor applied to any character-scaled turn. */
  get worstReconciliation(): number {
    return this.worstFactor
  }

  /** Largest share of a window left unattributed. */
  get worstResidual(): number {
    return this.worstResidualShare
  }

  /** Largest share by which the slices claimed more than the window held. */
  get worstOverCount(): number {
    return this.worstOverCountShare
  }

  /** Must stay 0: a negative residual without a structural gap is a broken rule. */
  get overCountedWithoutGap(): number {
    return this.negativeResidualWithoutGap
  }

  /** Projection requests whose category deltas went backwards (a compaction). */
  get negativeDeltaTurns(): number {
    return this.deltaRegressions
  }

  /** Sum of the last turn's slices before reconciliation. */
  get lastRawTokens(): number {
    return this.rawTokens
  }

  /** Record the system prompt the harness sends. Replaces any previous one. */
  setSystemText(text: string): void {
    const counts = emptyCharCounts()
    addText(counts, text)
    this.system = counts
  }

  /** Record the tool definitions of one `request/header`. */
  setToolSchemas(tools: readonly unknown[]): void {
    const counts = emptyCharCounts()
    for (const tool of tools) addSchema(counts, tool)
    this.schema = counts
  }

  /** A compaction replaced the carried history with a summary. */
  startSegment(summaryText?: string): void {
    this.carried = emptyCharCounts()
    if (summaryText !== undefined) addText(this.carried, summaryText)
  }

  /** Fold the open turn into the carried window. */
  endTurn(): void {
    mergeInto(this.carried, this.current.userInput)
    mergeInto(this.carried, this.current.assistantOutput)
    mergeInto(this.carried, this.current.thinking)
    mergeInto(this.carried, this.current.toolResults)
    mergeInto(this.carried, this.current.images)
    this.current = emptyBuckets()
  }

  /** Add one human user message. */
  addUserText(text: string): void {
    addText(this.current.userInput, text)
  }

  /** Add one harness-injected user-side message (approval, notice, reminder). */
  addInjectedText(text: string): void {
    addText(this.injected, text)
  }

  /** Add one tool result's text. */
  addToolResultText(text: string): void {
    addText(this.current.toolResults, text)
  }

  /** Add assistant prose. */
  addAssistantText(text: string): void {
    addText(this.current.assistantOutput, text)
  }

  /** Add a reasoning block. */
  addThinking(text: string): void {
    addText(this.current.thinking, text)
  }

  /** Add an image payload; the bytes are read for their header and dropped. */
  addImage(data: unknown, mediaType?: string): void {
    addImage(this.current.images, data, mediaType)
  }

  /**
   * Build one turn's attribution.
   *
   * When a projection request covers the turn, its split is used verbatim and
   * the difference against the exact prompt becomes `residual`. Otherwise the
   * character counts are reconciled under the usual asymmetric rule.
   * @param totalTokens - the turn's exact context size, from its own usage.
   * @param options - projection evidence for this turn, if any.
   */
  attribution(totalTokens: number, options: AttributionOptions = {}): Attribution {
    const { request, previous, windowSize } = options
    // A turn that never issued a request (a seeded or interrupted session) has
    // nothing to attribute; counting it as an estimate would inflate the
    // fallback share with a turn that has no window at all.
    const empty: Attribution = { total: exactMeasure(0), parts: [] }
    let attribution: Attribution
    if (totalTokens <= 0 && request === undefined) attribution = empty
    else if (request !== undefined && request.total > 0)
      attribution = this.projectionAttribution(totalTokens, request, previous)
    else attribution = this.estimateAttribution(totalTokens)
    // Only the log's own `request/context` may state this; never inferred.
    if (windowSize !== undefined && windowSize > 0) attribution.windowSize = windowSize
    return attribution
  }

  /** Slices the harness measured itself. */
  private projectionAttribution(
    totalTokens: number,
    request: ProjectionRequest,
    previous: ProjectionRequest | undefined
  ): Attribution {
    this.projectionTurns += 1
    const parts: { part: ContextPart; measure: Measure }[] = []
    const push = (part: ContextPart, tokens: number): void => {
      if (tokens > 0) parts.push({ part, measure: projectionMeasure(tokens) })
    }

    // The fixed prefix is re-sent with every request, so it is always counted in
    // full rather than as a delta against the previous request.
    push("system-prompt", request.system)
    push("tool-definitions", request.tools)

    const conversational = ["user", "inject", "skill", "assistant", "tool"] as const
    let monotonic = previous !== undefined
    if (previous !== undefined) {
      for (const key of conversational) {
        if (request[key] < previous[key]) monotonic = false
      }
    }

    if (previous !== undefined && monotonic) {
      // What the earlier requests of this segment already carried is `history`;
      // only the growth over the previous request belongs to this turn.
      push("history", previous.user + previous.inject + previous.skill + previous.assistant + previous.tool)
      push("user-input", request.user - previous.user)
      push("memory-instructions", request.inject - previous.inject + (request.skill - previous.skill))
      push("assistant-output", request.assistant - previous.assistant)
      push("tool-results", request.tool - previous.tool)
    } else {
      // No predecessor, or the carried set shrank under a compaction: the
      // conversational mass cannot be split, and claiming it was all new would
      // be worse than calling it history.
      if (previous !== undefined) this.deltaRegressions += 1
      push("history", request.user + request.inject + request.skill + request.assistant + request.tool)
    }

    let raw = 0
    for (const slice of parts) raw += slice.measure.tokens
    this.rawTokens = raw

    const attribution: Attribution = { total: { tokens: totalTokens, precision: "exact", basis: "usage" }, parts }
    const gap = totalTokens - raw
    if (gap !== 0) {
      attribution.residual = residualMeasure(gap)
      this.residualTurns += 1
      if (totalTokens > 0) {
        const share = gap / totalTokens
        if (share >= 0) {
          if (share > this.worstResidualShare) this.worstResidualShare = share
        } else if (-share > this.worstOverCountShare) {
          this.worstOverCountShare = -share
        }
      }
    }
    return attribution
  }

  /**
   * Slices counted from the log text, reconciled under the asymmetric rule.
   *
   * Reaching this path at all means a whole category is unmeasured — there is
   * no fresh projection to say what the prefix cost — so the gap is always
   * structural and scaling is never allowed.
   */
  private estimateAttribution(totalTokens: number): Attribution {
    this.estimateTurns += 1
    const systemPrompt = emptyCharCounts()
    mergeInto(systemPrompt, this.system)
    const buckets: [ContextPart, CharCounts][] = [
      ["system-prompt", systemPrompt],
      ["tool-definitions", this.schema],
      ["memory-instructions", this.injected],
      ["history", this.carried],
      ["tool-results", this.current.toolResults],
      ["images", this.current.images],
      ["thinking", this.current.thinking],
      ["user-input", this.current.userInput],
      ["assistant-output", this.current.assistantOutput],
    ]
    const parts: { part: ContextPart; measure: Measure }[] = []
    for (const [part, counts] of buckets) {
      if (isEmptyCounts(counts)) continue
      parts.push({ part, measure: part === "images" ? projectedMeasure(counts) : measureOf(counts) })
    }

    let raw = 0
    for (const slice of parts) raw += slice.measure.tokens
    this.rawTokens = raw

    const outcome = reconcile(parts, totalTokens, true)
    const attribution: Attribution = { total: { tokens: totalTokens, precision: "exact", basis: "usage" }, parts }
    if (outcome.factor !== undefined) {
      attribution.reconciled = { factor: outcome.factor }
      this.scaledTurns += 1
      if (Math.abs(outcome.factor - 1) > Math.abs(this.worstFactor - 1)) this.worstFactor = outcome.factor
    }
    if (outcome.residual !== undefined) {
      attribution.residual = residualMeasure(outcome.residual)
      this.residualTurns += 1
      if (totalTokens > 0) {
        const share = outcome.residual / totalTokens
        if (share >= 0) {
          if (share > this.worstResidualShare) this.worstResidualShare = share
        } else if (-share > this.worstOverCountShare) this.worstOverCountShare = -share
      }
    }
    return attribution
  }
}
