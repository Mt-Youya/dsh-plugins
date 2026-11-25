/**
 * Folding a third-party harness log into turns.
 *
 * The three built-in adapters each own their record flow because their formats
 * share nothing. The harness readers do share one problem instead: none of
 * these tools logs the prompt it sent, so the fixed overhead (system prompt,
 * tool schemas, memory) is invisible, and only the conversation itself can be
 * attributed.
 *
 * This module is therefore a small fold over normalized entries: a parser turns
 * its own format into {@link HarnessEntry} values, and the builder answers the
 * same questions the panel asks of every source — where a turn starts, which
 * tool call belongs to it, what the window was made of, and what could not be
 * known.
 *
 * The accounting follows `docs/IR.md` exactly:
 * - a turn is one human input plus everything the model did in response;
 * - `total` is the logged context size when the harness recorded one, and the
 *   `Σparts` estimate otherwise (never zero, never `exact` without a log field);
 * - what the log does not contain stays outside `parts`: with a logged total it
 *   is `residual`, without one it is named in `dataQuality`;
 * - the fixed prefix is never invented, so every session carries
 *   `attribution-prompt-unknown`.
 *
 * @see docs/IR.md (adapter 必须遵守, 对账的边界)
 * @see docs/adr/0011-storage-family-sources.md
 * @module @cyrusdoyle/dsh-session-readers/harness/turns
 */

import {
  type Attribution,
  type ContextPart,
  type ContextSlice,
  estimateMeasure,
  exactMeasure,
  residualMeasure,
  type Session,
  type ToolCall,
  type Turn,
  type Usage,
} from "@cyrusdoyle/dsh-session-contract"

import { addSchema, addText, type CharCounts, emptyCharCounts, isEmptyCounts, measureOf } from "../attribution.ts"

/** Session-level facts every harness parser can state before its first entry. */
export interface HarnessFacts {
  /** Which source badge this session belongs to. */
  source: Session["source"]
  /** Stable id; must satisfy the contract's `isSafeId`. */
  id: string
  /** Real directory the session belongs to; `''` when the log does not say. */
  workdir: string
  /** Only a title the tool itself stores; never the id. */
  title?: string
  createdAt: number
  /** Physical files behind this session, as the panel lists them. */
  segments?: readonly string[]
  /** Extra quality tokens the parser found while reading its own format. */
  quality?: readonly string[]
}

/** Provider/model as the log names them. */
export interface HarnessModel {
  provider: string
  model: string
}

/** The normalized vocabulary a parser emits, in log order. */
export type HarnessEntry =
  | { kind: "user"; at: number; text: string }
  | { kind: "assistant"; at: number; text?: string; thinking?: string; model?: HarnessModel }
  | {
      kind: "tool-call"
      at: number
      id: string
      name: string
      input: unknown
      output?: unknown
      status?: ToolCall["status"]
      endedAt?: number
    }
  | { kind: "tool-result"; at?: number; id: string; output?: unknown; status?: ToolCall["status"] }
  | {
      kind: "usage"
      at?: number
      input?: number
      output?: number
      cacheRead?: number
      cacheWrite?: number
      /** Context size the harness recorded, when it records one. */
      contextTokens?: number
    }
  | {
      kind: "compaction"
      at: number
      trigger?: string
      replacedHistory?: boolean
      /** Summary text that replaced the history, when the log keeps it. */
      summary?: string
    }
  /** Context that is carried without being this turn's input (summaries, injected notes). */
  | { kind: "carried"; text: string }
  | { kind: "quality"; token: string }

/** Per-turn character buckets, folded into `carried` when the turn closes. */
interface Buckets {
  userInput: CharCounts
  assistantOutput: CharCounts
  thinking: CharCounts
  toolResults: CharCounts
}

function emptyBuckets(): Buckets {
  return {
    userInput: emptyCharCounts(),
    assistantOutput: emptyCharCounts(),
    thinking: emptyCharCounts(),
    toolResults: emptyCharCounts(),
  }
}

function mergeInto(target: CharCounts, source: CharCounts): void {
  target.text += source.text
  target.cjk += source.cjk
  target.schema += source.schema
  target.projected += source.projected
}

/** One usage reading; a turn may hold several when it looped over tools. */
interface UsageReading {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  contextTokens?: number
}

interface OpenTurn {
  startedAt: number
  endedAt: number
  userInput: string[]
  assistantText: string[]
  thinking: string[]
  buckets: Buckets
  calls: ToolCall[]
  usage: UsageReading[]
  compactions: Turn["compactions"]
  model?: HarnessModel
}

function openTurn(at: number): OpenTurn {
  return {
    startedAt: at,
    endedAt: at,
    userInput: [],
    assistantText: [],
    thinking: [],
    buckets: emptyBuckets(),
    calls: [],
    usage: [],
    compactions: [],
  }
}

/**
 * Fold normalized entries into one session.
 *
 * Entries must arrive in log order; a parser that has to sort does so before
 * pushing, because turn boundaries are decided by arrival order.
 */
export class HarnessSessionBuilder {
  readonly #facts: HarnessFacts
  readonly #turns: Turn[] = []
  readonly #quality = new Set<string>()
  /** Characters every earlier turn contributes to the next window. */
  #carried: CharCounts = emptyCharCounts()
  #open: OpenTurn | undefined

  constructor(facts: HarnessFacts) {
    this.#facts = facts
    // These tools never record the prompt they assembled; saying so once beats
    // letting a reader assume the parts are the whole window.
    this.#quality.add("attribution-prompt-unknown")
    for (const token of facts.quality ?? []) this.#quality.add(token)
  }

  /** Feed one normalized entry. */
  push(entry: HarnessEntry): void {
    switch (entry.kind) {
      case "user":
        this.#user(entry)
        return
      case "assistant":
        this.#assistant(entry)
        return
      case "tool-call":
        this.#toolCall(entry)
        return
      case "tool-result":
        this.#toolResult(entry)
        return
      case "usage":
        this.#usage(entry)
        return
      case "compaction":
        this.#compaction(entry)
        return
      case "carried":
        addText(this.#carried, entry.text)
        return
      default:
        this.#quality.add(entry.token)
    }
  }

  /** Feed every entry, in order. */
  pushAll(entries: readonly HarnessEntry[]): void {
    for (const entry of entries) this.push(entry)
  }

  #turnAt(at: number): OpenTurn {
    this.#open ??= openTurn(at)
    if (at > this.#open.startedAt) this.#open.endedAt = Math.max(this.#open.endedAt, at)
    return this.#open
  }

  #user(entry: Extract<HarnessEntry, { kind: "user" }>): void {
    const text = entry.text.trim()
    if (text === "") return
    const current = this.#open
    // A second human input closes the previous turn: the model had already
    // answered (or acted) before this message arrived.
    if (current !== undefined && this.#hasResponse(current)) this.#close()
    const turn = this.#turnAt(entry.at)
    turn.userInput.push(text)
    addText(turn.buckets.userInput, text)
  }

  #hasResponse(turn: OpenTurn): boolean {
    return (
      turn.assistantText.length > 0 ||
      turn.thinking.length > 0 ||
      turn.calls.length > 0 ||
      turn.usage.length > 0 ||
      turn.userInput.length > 0
    )
  }

  #assistant(entry: Extract<HarnessEntry, { kind: "assistant" }>): void {
    const turn = this.#turnAt(entry.at)
    turn.endedAt = Math.max(turn.endedAt, entry.at)
    if (entry.text !== undefined && entry.text.trim() !== "") {
      turn.assistantText.push(entry.text)
      addText(turn.buckets.assistantOutput, entry.text)
    }
    if (entry.thinking !== undefined && entry.thinking.trim() !== "") {
      turn.thinking.push(entry.thinking)
      addText(turn.buckets.thinking, entry.thinking)
    }
    if (entry.model !== undefined) turn.model = entry.model
  }

  #toolCall(entry: Extract<HarnessEntry, { kind: "tool-call" }>): void {
    const turn = this.#turnAt(entry.at)
    const call: ToolCall = {
      id: entry.id,
      name: entry.name,
      input: entry.input,
      status: entry.status ?? "unknown",
      startedAt: entry.at,
    }
    if (entry.output !== undefined) {
      call.output = entry.output
      addSchema(turn.buckets.toolResults, entry.output)
    }
    if (entry.endedAt !== undefined) call.endedAt = entry.endedAt
    if (entry.status === undefined) this.#quality.add("tool-call-unfinished")
    addSchema(turn.buckets.toolResults, entry.input)
    turn.calls.push(call)
  }

  #toolResult(entry: Extract<HarnessEntry, { kind: "tool-result" }>): void {
    const at = entry.at ?? this.#open?.endedAt ?? this.#facts.createdAt
    const turn = this.#turnAt(at)
    const call = turn.calls.find((candidate) => candidate.id === entry.id)
    if (call === undefined) {
      // A result without its call means the log lost a record; pretending the
      // pair existed would invent a tool call the model never made.
      this.#quality.add("tool-result-without-call")
      return
    }
    if (entry.output !== undefined) {
      call.output = entry.output
      addSchema(turn.buckets.toolResults, entry.output)
    }
    call.status = entry.status ?? "ok"
    call.endedAt = at
    if (at > turn.endedAt) turn.endedAt = at
  }

  #usage(entry: Extract<HarnessEntry, { kind: "usage" }>): void {
    const at = entry.at ?? this.#open?.endedAt ?? this.#facts.createdAt
    const turn = this.#turnAt(at)
    const reading: UsageReading = {
      input: Math.max(0, entry.input ?? 0),
      output: Math.max(0, entry.output ?? 0),
      cacheRead: Math.max(0, entry.cacheRead ?? 0),
      cacheWrite: Math.max(0, entry.cacheWrite ?? 0),
    }
    if (entry.contextTokens !== undefined && entry.contextTokens > 0) reading.contextTokens = entry.contextTokens
    turn.usage.push(reading)
  }

  #compaction(entry: Extract<HarnessEntry, { kind: "compaction" }>): void {
    const turn = this.#turnAt(entry.at)
    const before = measureOf(this.#carried)
    const after = entry.summary === undefined ? estimateMeasure(0) : measureOf(countOf(entry.summary))
    turn.compactions.push({
      at: entry.at,
      before,
      after,
      ...(entry.trigger === undefined ? {} : { trigger: entry.trigger }),
      replacedHistory: entry.replacedHistory ?? true,
    })
    this.#quality.add("compaction-values-estimated")
    // From here the model no longer sees the earlier messages: the summary is
    // the new carried context.
    this.#carried = entry.summary === undefined ? emptyCharCounts() : countOf(entry.summary)
    if (entry.summary === undefined) this.#quality.add("compaction-summary-missing")
  }

  #close(): void {
    const turn = this.#open
    if (turn === undefined) return
    this.#open = undefined
    const usage = usageOf(turn.usage)
    const attribution = this.#attribution(turn, usage)
    if (usage === undefined) this.#quality.add("turn-without-usage")
    const finished: Turn = {
      index: this.#turns.length + 1,
      startedAt: turn.startedAt,
      endedAt: turn.endedAt,
      userInput: turn.userInput,
      assistantText: turn.assistantText,
      toolCalls: turn.calls,
      attribution,
      compactions: turn.compactions,
      subagents: [],
    }
    if (turn.thinking.length > 0) finished.thinking = turn.thinking
    if (usage !== undefined) finished.usage = usage
    if (turn.model !== undefined) finished.model = { provider: turn.model.provider, model: turn.model.model }
    this.#turns.push(finished)
    // The next window carries everything this turn contributed.
    mergeInto(this.#carried, turn.buckets.userInput)
    mergeInto(this.#carried, turn.buckets.assistantOutput)
    mergeInto(this.#carried, turn.buckets.thinking)
    mergeInto(this.#carried, turn.buckets.toolResults)
  }

  #attribution(turn: OpenTurn, usage: Usage | undefined): Attribution {
    const parts: ContextSlice[] = []
    if (!isEmptyCounts(this.#carried)) parts.push({ part: "history", measure: measureOf(this.#carried) })
    for (const [part, counts] of [
      ["user-input", turn.buckets.userInput],
      ["assistant-output", turn.buckets.assistantOutput],
      ["thinking", turn.buckets.thinking],
      ["tool-results", turn.buckets.toolResults],
    ] as const) {
      if (isEmptyCounts(counts)) continue
      parts.push({ part: part as ContextPart, measure: measureOf(counts) })
    }
    const sum = sumOf(parts)
    if (usage === undefined) {
      const attribution: Attribution = { total: estimateMeasure(sum), parts }
      return attribution
    }
    const attribution: Attribution = { total: exactMeasure(usage.totalContext), parts }
    const gap = usage.totalContext - sum
    if (gap !== 0) {
      attribution.residual = residualMeasure(gap)
      this.#quality.add(gap > 0 ? "attribution-residual" : "attribution-over-counted")
    }
    return attribution
  }

  /** Close the open turn and answer the session. */
  finish(): Session {
    this.#close()
    if (this.#turns.length === 0) this.#quality.add("log-without-turns")
    const last = this.#turns[this.#turns.length - 1]
    const updatedAt = last?.endedAt ?? this.#facts.createdAt
    const session: Session = {
      id: this.#facts.id,
      source: this.#facts.source,
      workdir: this.#facts.workdir,
      createdAt: this.#facts.createdAt,
      updatedAt,
      turns: this.#turns,
      segments: [...(this.#facts.segments ?? [])],
      dataQuality: [...this.#quality],
    }
    if (this.#facts.title !== undefined && this.#facts.title.trim() !== "") session.title = this.#facts.title.trim()
    return session
  }
}

function countOf(text: string): CharCounts {
  const counts = emptyCharCounts()
  addText(counts, text)
  return counts
}

function sumOf(parts: readonly ContextSlice[]): number {
  let tokens = 0
  for (const slice of parts) tokens += slice.measure.tokens
  return tokens
}

/**
 * Fold one turn's usage readings into the IR shape.
 *
 * The harness may record one reading per request inside a turn; the panel shows
 * one turn, so the billing fields add up while the context size is the peak the
 * turn actually reached.
 * @param readings - every usage record seen inside the turn.
 * @returns the turn's usage, or undefined when the log carried none.
 */
export function usageOf(readings: readonly UsageReading[]): Usage | undefined {
  if (readings.length === 0) return undefined
  let input = 0
  let cacheRead = 0
  let cacheWrite = 0
  let output = 0
  let peak = 0
  for (const reading of readings) {
    input += reading.input
    cacheRead += reading.cacheRead
    cacheWrite += reading.cacheWrite
    output += reading.output
    const context = reading.contextTokens ?? reading.input + reading.cacheRead + reading.cacheWrite
    if (context > peak) peak = context
  }
  return { input, cacheRead, cacheWrite, output, totalContext: peak }
}
