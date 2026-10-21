/**
 * Accumulating what one Codex turn's window was made of.
 *
 * The window is measured at the turn's *peak request*: a Codex turn carries
 * 10-90 requests (4,726 responses over 473 usage-bearing turns), and each
 * request only sees the content written before it. Summing a whole turn's tool
 * output describes everything the agent ever produced, which can exceed the
 * prompt it was sent in by an order of magnitude (the largest single logged
 * output on this corpus is 3.49 MB). Every contribution therefore carries the
 * record ordinal it came from, and the attribution sums only what existed at
 * the ordinal of the largest request.
 *
 * The ingredients are Codex's own:
 * - prefix: session_meta.base_instructions (each segment repeats it verbatim,
 *   so it is counted once per logical session) plus developer messages;
 * - tool definitions: only additional_tools carries real schemas, and only 7
 *   records in this corpus do. world_state.state.tools holds names plus schema
 *   hashes, so an ordinary session's tool block is invisible and must become
 *   residual, never a scaled guess;
 * - memory: AGENTS.md, skill and plugin blocks are user messages, counted once
 *   each; world_state.state.agents_md duplicates that text verbatim (115 of 115
 *   files) and is used only when no message form exists;
 * - history, tool results, images, user input and assistant output as usual;
 * - thinking: encrypted (response_item.reasoning.encrypted_content), so it is
 *   never counted and Turn.thinking stays undefined.
 *
 * Reconciliation follows docs/IR.md 对账的边界 and
 * docs/adr/0005-honest-attribution-residual.md.
 */

import { addImage, addSchema, addText, emptyCharCounts, isEmptyCounts, type CharCounts } from "../attribution.ts"
import {
  estimateMeasure,
  residualMeasure,
  type Attribution,
  type ContextSlice,
  type ContextPart,
  type Measure,
} from "@cyrus/dsh-session-contract"
import { codexMeasureOf, codexProjectedMeasure } from "./calibration.ts"
import { isObject, type JsonObject } from "./records.ts"
import { isToolCallItem, toolInput } from "./tools.ts"
import type { InjectedKind } from "./turns.ts"

/** Largest upward fit; shrinking has no bound (docs/IR.md, 对账的边界). */
export const MAX_RECONCILE_FACTOR = 1.25

/** What happened when the estimates were compared with the exact total. */
export interface ReconcileDecision {
  /** total / sum(parts) before any scaling. */
  factor: number
  /** Whether the parts were scaled to the total. */
  scaled: boolean
  /** The unattributed gap, present only when scaling was refused. */
  residual?: Measure
  /** Sum of the parts as estimated, before scaling. */
  rawTokens: number
}

/**
 * Fit the slices onto the exact total — asymmetrically, per docs/IR.md.
 *
 * - A structural gap forbids scaling in either direction: the tool schemas are
 *   never in a Codex log, so an undershoot may be that invisible category and
 *   an overshoot cannot be attributed either. The gap stays residual.
 * - Without a gap, growing past {@link MAX_RECONCILE_FACTOR} is more likely a
 *   missing category than measurement noise, so it stays residual too.
 * - Without a gap, shrinking has no lower bound: an overshoot is the caliper
 *   reading high, and correcting that invents nothing.
 *
 * A turn with no logged usage (total 0) is not reconciled at all: there is no
 * exact anchor to fit, and residual = -sum(parts) would assert the model
 * received nothing. The turn is marked turn-without-usage instead.
 * @param parts - slices to adjust in place.
 * @param totalTokens - exact prompt size of the turn's largest request.
 * @param structuralGap - a whole category is missing, so scaling is forbidden.
 */
export function reconcile(parts: ContextSlice[], totalTokens: number, structuralGap: boolean): ReconcileDecision {
  const rawTokens = sumSlices(parts)
  if (totalTokens <= 0 || parts.length === 0 || rawTokens <= 0) {
    return { factor: 1, scaled: false, rawTokens }
  }
  const factor = totalTokens / rawTokens
  if (structuralGap || factor > MAX_RECONCILE_FACTOR) {
    return { factor, scaled: false, rawTokens, residual: residualMeasure(totalTokens - rawTokens) }
  }
  let largest = 0
  for (let index = 0; index < parts.length; index += 1) {
    const slice = parts[index]
    if (slice === undefined) continue
    slice.measure = { ...slice.measure, tokens: Math.round(slice.measure.tokens * factor) }
    if (slice.measure.tokens > (parts[largest]?.measure.tokens ?? 0)) largest = index
  }
  // Rounding each slice can drift a few tokens; sum(parts) === total must hold
  // exactly, so the drift lands on the heaviest slice.
  const drift = totalTokens - sumSlices(parts)
  const target = parts[largest]
  if (drift !== 0 && target !== undefined) {
    target.measure = { ...target.measure, tokens: target.measure.tokens + drift }
  }
  return { factor, scaled: true, rawTokens }
}

/** Sum the slice tokens. */
export function sumSlices(parts: readonly ContextSlice[]): number {
  let tokens = 0
  for (const slice of parts) tokens += slice.measure.tokens
  return tokens
}

/** One piece of the current turn, with the ordinal it was written at. */
interface WindowEntry {
  part: ContextPart
  counts: CharCounts
  /** Record ordinal; entries above the peak request's ordinal are not counted. */
  ordinal: number
}

function textCounts(text: string): CharCounts {
  const counts = emptyCharCounts()
  addText(counts, text)
  return counts
}

function mergeInto(target: CharCounts, source: CharCounts): void {
  target.text += source.text
  target.cjk += source.cjk
  target.schema += source.schema
  target.projected += source.projected
}

/** Injected kinds that are developer-level state rather than memory. */
const SYSTEM_INJECTIONS = new Set<InjectedKind>(["environment", "browser"])
/** Injected kinds that are reference material the agent pulled in. */
const REFERENCE_INJECTIONS = new Set<InjectedKind>(["files", "documentation"])

/** Which part an injected user-message block belongs to. */
function partOfInjection(kind: InjectedKind): ContextPart {
  if (REFERENCE_INJECTIONS.has(kind)) return "referenced-files"
  if (SYSTEM_INJECTIONS.has(kind)) return "system-prompt"
  return "memory-instructions"
}

/** One turn's attribution and the decision behind it. */
export interface AttributionReport {
  attribution: Attribution
  decision: ReconcileDecision
}

/**
 * One session's window, fed record by record.
 *
 * Contributions are kept with their ordinals so a turn can be measured at its
 * peak request rather than after everything it ever produced. A compaction
 * replaces the carried history; the fixed prefix survives because Codex
 * re-sends it.
 */
export class CodexWindow {
  /** base_instructions, counted once however many segments repeat them. */
  private readonly base: CharCounts = emptyCharCounts()
  /** Tool schemas from additional_tools; latest-wins, absent in most sessions. */
  private schemas: CharCounts = emptyCharCounts()
  private hasSchemas = false
  /** memory fallback from world_state.state.agents_md. */
  private worldMemory: CharCounts = emptyCharCounts()
  /** Whether an AGENTS/instructions message was already counted. */
  private sawInstructionMessage = false
  /** Whether world_state stated the permissions instructions as a bare hash. */
  private permissionsHashOnly = false
  private carried: CharCounts = emptyCharCounts()
  private entries: WindowEntry[] = []
  private windowSizeValue?: number
  private reasoningRecords = 0
  private encryptedCount = 0

  /** Store the system prompt; later segments repeat it, so only the first wins. */
  setBaseInstructions(text: string): void {
    if (!isEmptyCounts(this.base)) return
    addText(this.base, text)
  }

  /** Store tool schemas (latest-wins: the tool set is state, not a log). */
  applyToolSchemas(tools: unknown): void {
    if (!Array.isArray(tools)) return
    const counts = emptyCharCounts()
    for (const tool of tools) if (isObject(tool)) addSchema(counts, tool)
    if (isEmptyCounts(counts)) return
    this.schemas = counts
    this.hasSchemas = true
  }

  /** Whether any real tool schema was logged. */
  get sawToolSchemas(): boolean {
    return this.hasSchemas
  }

  /** Whether the permissions instructions were unreadable (hash only). */
  get sawPermissionsHash(): boolean {
    return this.permissionsHashOnly
  }

  /** Whether any reasoning record was encrypted rather than readable. */
  get encryptedReasoningRecords(): number {
    return this.encryptedCount
  }

  /** Whether any reasoning record was seen at all. */
  get reasoningCount(): number {
    return this.reasoningRecords
  }

  /** The context window the log stated, if it stated one. */
  get windowSize(): number | undefined {
    return this.windowSizeValue
  }

  /**
   * Fold a world_state snapshot in as a fallback, never as extra context.
   *
   * The snapshot is state, not a request: its agents_md text is duplicated in a
   * user message whenever it reached the model, and its skills/apps blobs have
   * no evidence of being rendered. Only the AGENTS.md text is kept, and only
   * when no message form was seen.
   */
  applyWorldState(payload: JsonObject): void {
    const state = payload["state"]
    if (!isObject(state)) return
    const agents = state["agents_md"]
    if (isObject(agents)) {
      const text = agents["text"]
      if (typeof text === "string" && text.length > 0) {
        const counts = emptyCharCounts()
        addText(counts, text)
        this.worldMemory = counts
      }
    }
    const permissions = state["permissions"]
    if (isObject(permissions)) {
      const instructions = permissions["instructions"]
      if (typeof instructions === "string" && !instructions.includes(" ")) this.permissionsHashOnly = true
    }
  }

  /** Record the model's context window as a token_count event stated it. */
  setWindowSize(tokens: number): void {
    if (tokens > 0) this.windowSizeValue = tokens
  }

  private push(part: ContextPart, counts: CharCounts, ordinal: number): void {
    if (isEmptyCounts(counts)) return
    this.entries.push({ part, counts, ordinal })
  }

  /** Add a developer message: system-level instructions re-sent every request. */
  addDeveloperText(text: string, ordinal: number): void {
    this.push("system-prompt", textCounts(text), ordinal)
  }

  /** Add one injected user-message block where its kind belongs. */
  addInjection(kind: InjectedKind, text: string, ordinal: number): void {
    this.push(partOfInjection(kind), textCounts(text), ordinal)
    if (kind === "instructions") this.sawInstructionMessage = true
  }

  /** Add what a person typed. */
  addHumanText(text: string, ordinal: number): void {
    this.push("user-input", textCounts(text), ordinal)
  }

  /** Add assistant prose. */
  addAssistantText(text: string, ordinal: number): void {
    this.push("assistant-output", textCounts(text), ordinal)
  }

  /** Add a replayed tool input, which every later request carries again. */
  addAssistantPayload(value: unknown, ordinal: number): void {
    const counts = emptyCharCounts()
    addSchema(counts, value)
    this.push("assistant-output", counts, ordinal)
  }

  /** Add a tool result, measured by its serialized shape. */
  addToolResult(value: unknown, ordinal: number): void {
    const counts = emptyCharCounts()
    if (typeof value === "string") addText(counts, value)
    else addSchema(counts, value)
    this.push("tool-results", counts, ordinal)
  }

  /** Add an image content block; its base64 is read for the header and dropped. */
  addImageUrl(url: unknown, ordinal: number): void {
    if (typeof url !== "string" || url.length === 0) return
    const counts = emptyCharCounts()
    const comma = url.startsWith("data:") ? url.indexOf(",") : -1
    if (comma < 0) addImage(counts, url)
    else addImage(counts, url.slice(comma + 1), url.slice(5, comma).split(";")[0])
    this.push("images", counts, ordinal)
  }

  /** Add readable reasoning text (rare: 13 items corpus-wide). */
  addThinking(text: string, ordinal: number): void {
    this.push("thinking", textCounts(text), ordinal)
  }

  /** Note a reasoning record; encrypted content is not measurable. */
  noteReasoning(encrypted: boolean): void {
    this.reasoningRecords += 1
    if (encrypted) this.encryptedCount += 1
  }

  /** Close a turn: what was "this turn" becomes history for the next one. */
  endTurn(): void {
    for (const entry of this.entries) mergeInto(this.carried, entry.counts)
    this.entries = []
  }

  /**
   * Replace the carried history with a compaction's replacement_history.
   *
   * Codex substitutes stored history instead of summarizing in place, so the
   * carried text is rebuilt from the replacement and this turn's earlier
   * contributions are dropped: they are now represented by the replacement, and
   * counting both would double the window.
   * @param items - replacement_history, as logged.
   * @param ordinal - ordinal of the compacted record.
   */
  replaceHistory(items: readonly JsonObject[], ordinal: number): void {
    const counts = emptyCharCounts()
    for (const item of items) countReplacementItem(counts, item)
    this.carried = counts
    this.entries = this.entries.filter((entry) => entry.ordinal >= ordinal)
  }

  /**
   * Render one turn's attribution and reconcile it with the exact total.
   * @param totalTokens - exact prompt size of the turn's largest request.
   * @param peakOrdinal - ordinal of that request; later content is excluded.
   */
  attribution(totalTokens: number, peakOrdinal = Number.POSITIVE_INFINITY): AttributionReport {
    const parts: ContextSlice[] = []
    const push = (part: ContextPart, counts: CharCounts): void => {
      if (isEmptyCounts(counts)) return
      parts.push({ part, measure: part === "images" ? codexProjectedMeasure(counts) : codexMeasureOf(counts) })
    }
    const current = (part: ContextPart): CharCounts => {
      const counts = emptyCharCounts()
      for (const entry of this.entries)
        if (entry.part === part && entry.ordinal <= peakOrdinal) mergeInto(counts, entry.counts)
      return counts
    }

    const systemPrompt = emptyCharCounts()
    mergeInto(systemPrompt, this.base)
    mergeInto(systemPrompt, current("system-prompt"))
    push("system-prompt", systemPrompt)
    push("tool-definitions", this.schemas)
    const memory = current("memory-instructions")
    // The state snapshot is a fallback: the message form wins whenever it exists.
    if (!this.sawInstructionMessage) mergeInto(memory, this.worldMemory)
    push("memory-instructions", memory)
    push("referenced-files", current("referenced-files"))
    push("history", this.carried)
    push("tool-results", current("tool-results"))
    push("images", current("images"))
    push("thinking", current("thinking"))
    push("user-input", current("user-input"))
    push("assistant-output", current("assistant-output"))

    // A whole category is invisible unless additional_tools logged a schema.
    const decision = reconcile(parts, totalTokens, !this.hasSchemas)
    // docs/IR.md rule 6: a turn with no usage must not claim a zero window. Its
    // total falls back to the estimate, carries no residual, and states no
    // window size it cannot know.
    const hasUsage = totalTokens > 0
    const total: Measure = hasUsage
      ? { tokens: totalTokens, precision: "exact", basis: "usage" }
      : estimateMeasure(sumSlices(parts), "chars-per-token")
    const attribution: Attribution = { total, parts }
    if (hasUsage && this.windowSizeValue !== undefined) attribution.windowSize = this.windowSizeValue
    if (decision.scaled) attribution.reconciled = { factor: decision.factor }
    if (decision.residual !== undefined) attribution.residual = decision.residual
    return { attribution, decision }
  }
}

/** Count one replacement_history item as carried history. */
function countReplacementItem(counts: CharCounts, item: JsonObject): void {
  if (item["type"] === "compaction") return
  const content = item["content"]
  if (Array.isArray(content)) {
    for (const block of content) {
      if (!isObject(block)) continue
      const text = block["text"]
      if (typeof text === "string") addText(counts, text)
      const image = block["image_url"]
      if (typeof image === "string") addImage(counts, image)
    }
  }
  if (isToolCallItem(item)) addSchema(counts, toolInput(item))
}
