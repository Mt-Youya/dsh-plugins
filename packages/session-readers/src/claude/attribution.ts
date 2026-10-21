/**
 * Accumulating what one turn's window was made of.
 *
 * The model receives, on every request: a fixed prefix (system prompt, tool
 * schemas, injected reminders) plus every message of the current segment. The
 * window therefore grows by itself, and attribution has to mirror that — a
 * turn's context is not the turn's own text, it is the whole carried window.
 *
 * Parts are partitioned, never double counted: `history` holds everything the
 * earlier turns contributed, the typed parts hold what this turn added, and the
 * prefix parts hold what is re-sent every time.
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
import { estimateMeasure, residualMeasure, type Attribution, type ContextPart, type Measure } from "@cyrus/dsh-session-contract"
import { reconcile } from "./reconcile.ts"
import { arrayField, isObject, objectField, stringField, type JsonObject } from "./records.ts"

/** Attachment types that carry instructions rather than prompt scaffolding. */
const MEMORY_TYPES = new Set(["instructions", "skill_listing", "agent_listing_delta", "mcp_instructions_delta"])

/** Attachment types whose payload is file content the agent pulled in. */
const REFERENCE_TYPES = new Set(["file"])

/** Attachment types that carry a human command delivered through the queue. */
const HUMAN_TYPES = new Set(["queued_command"])

/** Per-turn buckets that belong to the turn itself. */
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

/** Concatenate a `rendered` attachment payload into text. */
function renderedText(record: JsonObject): string[] {
  const rendered = record["rendered"]
  const parts: string[] = []
  if (typeof rendered === "string") parts.push(rendered)
  else if (Array.isArray(rendered)) {
    for (const item of rendered) {
      if (!isObject(item)) continue
      const content = stringField(item, "content")
      if (content !== undefined) parts.push(content)
    }
  }
  return parts
}

/**
 * One segment's window, fed record by record.
 *
 * A segment ends at a compaction boundary: from there the model no longer sees
 * the earlier messages, only the summary. The prefix survives a compaction
 * because the system prompt and tool schemas are re-sent with every request.
 */
/**
 * How far the recorded prefix may overshoot a request before the snapshot is
 * treated as describing another tool set rather than as estimation noise.
 */
const STALE_PREFIX_RATIO = 1.2


export class ContextWindow {
  private system: CharCounts = emptyCharCounts()
  private schema: CharCounts = emptyCharCounts()
  private referenced: CharCounts = emptyCharCounts()
  /**
   * Latest rendered text per injected reminder type.
   *
   * Reminders are state, not messages: `environment`, `date`, the skill and
   * agent listings and the MCP instructions are re-rendered when they change
   * and *replace* their previous rendering. Summing them per occurrence
   * inflated one 430 K-token session by 60%. Latest-wins per type is what the
   * window actually holds.
   */
  private readonly injected = new Map<string, CharCounts>()
  private carried: CharCounts = emptyCharCounts()
  private current: TurnBuckets = emptyBuckets()
  /** Worst factor among turns that were actually scaled. */
  private worstFactor = 1
  private rawTokens = 0
  private staleSnapshotTurns = 0
  /** Turns whose slices were scaled onto the exact total. */
  private scaledTurns = 0
  /** Turns whose gap was left visible as `residual`. */
  private residualTurns = 0
  /** Largest positive residual / total: the window we could not explain. */
  private worstResidualShare = 0
  /** Largest negative residual / total: the window we over-explained. */
  private worstOverCountShare = 0
  /** Turns that hit one of the structural-gap conditions. */
  private structuralGapTurns = 0
  /**
   * Turns that produced a negative residual without a structural gap.
   *
   * Must stay 0: a missing category is the only way to over-shoot the window,
   * and the asymmetric rule scales every non-gap turn down.
   */
  private negativeResidualWithoutGap = 0

  /** True once a snapshot was shown to describe a different tool set. */
  private schemaStale = false
  /** Last snapshot seen; also what a per-turn report falls back to. */
  private hasSnapshot = false
  private snapshotTurn = 0
  private turnCounter = 0
  /** Turns whose figures came from a snapshot recorded on an earlier turn. */
  private carriedSnapshotTurns = 0
  private snapshotMissingTurns = 0

  /**
   * Fold the open turn's own content into the carried window.
   *
   * Called at the turn boundary: what was "this turn" becomes "history" for
   * every later turn in the same segment.
   */
  endTurn(): void {
    mergeInto(this.carried, this.current.userInput)
    mergeInto(this.carried, this.current.assistantOutput)
    mergeInto(this.carried, this.current.thinking)
    mergeInto(this.carried, this.current.toolResults)
    mergeInto(this.carried, this.current.images)
    this.current = emptyBuckets()
  }

  /**
   * Start a fresh segment: everything that travelled as a message is gone.
   *
   * The prefix survives — the system prompt and tool schemas are re-sent with
   * every request — while reminders, referenced files and history do not.
   */
  startSegment(): void {
    this.carried = emptyCharCounts()
    this.referenced = emptyCharCounts()
    this.injected.clear()
  }

  /** Start counting a turn, remembering whether its prefix is first-hand. */
  beginTurn(): void {
    this.turnCounter += 1
    if (!this.hasSnapshot) this.snapshotMissingTurns += 1
    else if (this.snapshotTurn < this.turnCounter) this.carriedSnapshotTurns += 1
  }

  /** How many turns had to reuse an earlier turn's prompt snapshot. */
  get reusedSnapshotTurns(): number {
    return this.carriedSnapshotTurns
  }

  /** How many turns had no prompt snapshot anywhere before them. */
  get missingSnapshotTurns(): number {
    return this.snapshotMissingTurns
  }

  /** Whether any prompt snapshot was seen at all. */
  get sawSnapshot(): boolean {
    return this.hasSnapshot
  }

  /**
   * Apply a `prompt_snapshot` attachment.
   *
   * Snapshots are written only when the prefix changes (65 of 121 files carry
   * any, ~0.08 per assistant record), and some of them omit `tools` to mean
   * "unchanged". A missing field therefore keeps the previous value instead of
   * resetting the tool cost to zero.
   */
  applySnapshot(attachment: JsonObject): void {
    const sections = arrayField(attachment, "systemPrompt") ?? []
    const system = emptyCharCounts()
    for (const section of sections) if (typeof section === "string") addText(system, section)
    const prefix = stringField(attachment, "cliPrefix")
    if (prefix !== undefined) addText(system, prefix)
    if (!isEmptyCounts(system)) this.system = system

    const tools = arrayField(attachment, "tools") ?? []
    if (tools.length > 0) {
      const schema = emptyCharCounts()
      for (const tool of tools) {
        if (!isObject(tool)) continue
        // `description` mirrors `schema.description`; counting the serialized
        // schema alone keeps the 952 KB prefix from landing twice.
        addSchema(schema, tool["schema"] ?? tool)
      }
      if (!isEmptyCounts(schema)) this.schema = schema
    }
    this.hasSnapshot = true
    this.snapshotTurn = this.turnCounter
    this.schemaStale = false
  }

  /**
   * Add an attachment record, using its rendered form.
   *
   * `rendered` is the text that actually reached the model; the typed payloads
   * (`attachment.content`, `attachment.systemPrompt`) are their sources, and
   * counting both would double the prefix.
   * @param record - a record whose `attachment` field is set.
   */
  addAttachmentRecord(record: JsonObject): void {
    const attachment = objectField(record, "attachment")
    if (attachment === undefined) return
    const type = stringField(attachment, "type") ?? "unknown"
    if (type === "prompt_snapshot") {
      this.applySnapshot(attachment)
      return
    }
    const texts = renderedText(record)
    if (texts.length === 0) return
    if (HUMAN_TYPES.has(type)) {
      for (const text of texts) addText(this.current.userInput, text)
      return
    }
    if (REFERENCE_TYPES.has(type)) {
      // An @-mention is a message: it accumulates until the segment is compacted.
      for (const text of texts) addText(this.referenced, text)
      return
    }
    const counts = emptyCharCounts()
    for (const text of texts) addText(counts, text)
    this.injected.set(type, counts)
  }

  /** Sum the injected reminders whose type belongs to one part. */
  private injectedTotal(memory: boolean): CharCounts {
    const total = emptyCharCounts()
    for (const [type, counts] of this.injected) {
      if (MEMORY_TYPES.has(type) !== memory) continue
      mergeInto(total, counts)
    }
    return total
  }

  /** Add one user message's text. */
  addUserText(text: string): void {
    addText(this.current.userInput, text)
  }

  /** Add a compact summary, which stands in for the history it replaced. */
  addSummaryText(text: string): void {
    addText(this.carried, text)
  }

  /** Add a tool result's text. */
  addToolResultText(text: string): void {
    addText(this.current.toolResults, text)
  }

  /** Largest |estimate − usage| / usage this window had to absorb. */
  get worstReconciliation(): number {
    return this.worstFactor
  }

  /** Turns whose recorded tool snapshot could not describe that request. */
  get staleSnapshotTurns2(): number {
    return this.staleSnapshotTurns
  }

  /** How many turns were scaled onto their exact total. */
  get scaledTurnCount(): number {
    return this.scaledTurns
  }

  /** How many turns kept an explicit unknown share instead. */
  get residualTurnCount(): number {
    return this.residualTurns
  }

  /** Largest share of a window that stayed unattributed. */
  get worstResidual(): number {
    return this.worstResidualShare
  }

  /** Largest share by which the slices claimed more than the window held. */
  get worstOverCount(): number {
    return this.worstOverCountShare
  }

  /** Turns that were missing a whole category. */
  get structuralGapTurnCount(): number {
    return this.structuralGapTurns
  }

  /** Must be 0; a non-zero value means the asymmetric rule is broken. */
  get overCountedWithoutGap(): number {
    return this.negativeResidualWithoutGap
  }

  /** Sum of the slices before the last reconciliation, for the probe report. */
  get lastRawTokens(): number {
    return this.rawTokens
  }

  /** Add an image payload; the bytes themselves are never retained. */
  addImage(data: unknown, mediaType?: string): void {
    addImage(this.current.images, data, mediaType)
  }

  /** Add assistant prose or a replayed `tool_use` input. */
  addAssistantText(text: string): void {
    addText(this.current.assistantOutput, text)
  }

  /** Add assistant prose that is really a tool input payload. */
  addAssistantPayload(value: unknown): void {
    addSchema(this.current.assistantOutput, value)
  }

  /** Add a thinking block. */
  addThinking(text: string): void {
    addText(this.current.thinking, text)
  }

  /**
   * Render the current turn's attribution.
   * @param totalTokens - the exact context size logged for this turn.
   */
  attribution(totalTokens: number): Attribution {
    const systemPrompt = emptyCharCounts()
    mergeInto(systemPrompt, this.system)
    mergeInto(systemPrompt, this.injectedTotal(false))
    const buckets: [ContextPart, CharCounts][] = [
      ["system-prompt", systemPrompt],
      ["tool-definitions", this.schema],
      ["memory-instructions", this.injectedTotal(true)],
      ["referenced-files", this.referenced],
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
    // A turn with no snapshot at all is missing a whole category: nothing may be
    // redistributed over the categories we did see.
    let structuralGap = !this.hasSnapshot

    // A snapshot that cannot fit inside the request it claims to describe is
    // evidence about a different tool set (sessions resumed against another MCP
    // configuration keep the older snapshot in the same file). It is dropped
    // rather than scaled, and the turn is reported as tool-definitions-unknown.
    if (totalTokens > 0) {
      let prefix = 0
      for (const slice of parts) {
        if (slice.part === "system-prompt" || slice.part === "tool-definitions") prefix += slice.measure.tokens
      }
      // 20% margin: a prefix that merely rounds past the total is estimation
      // noise, not a different tool set.
      if (prefix > totalTokens * STALE_PREFIX_RATIO) {
        this.schemaStale = true
        this.staleSnapshotTurns += 1
        structuralGap = true
        const tools = parts.findIndex((slice) => slice.part === "tool-definitions")
        if (tools >= 0) parts.splice(tools, 1)
      }
    }

    let raw = 0
    for (const slice of parts) raw += slice.measure.tokens
    this.rawTokens = raw

    if (totalTokens <= 0) {
      // IR rule 6: a turn with no usage must not claim a zero-sized window. The
      // total falls back to the estimate, `residual` is 0 by construction, and
      // the caller marks `turn-without-usage`. `windowSize` stays empty.
      this.structuralGapTurns += 1
      return { total: estimateMeasure(raw), parts }
    }

    if (structuralGap) this.structuralGapTurns += 1
    const outcome = reconcile(parts, totalTokens, structuralGap)
    if (outcome.residual !== undefined && outcome.residual < 0 && !structuralGap) {
      this.negativeResidualWithoutGap += 1
    }
    const total: Measure = { tokens: totalTokens, precision: "exact", basis: "usage" }
    const attribution: Attribution = { total, parts }
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
        } else if (-share > this.worstOverCountShare) {
          this.worstOverCountShare = -share
        }
      }
    }
    return attribution
  }
}

/** Sum the estimated parts, so a caller can compare them with the exact total. */
export function sumParts(attribution: Attribution): number {
  let tokens = 0
  for (const slice of attribution.parts) tokens += slice.measure.tokens
  return tokens
}
