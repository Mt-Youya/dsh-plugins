/**
 * Folding one session's events into turns.
 *
 * This is the only place that knows how a DSH event becomes IR: turn boundaries
 * (explicit `turn/start`/`turn/end`, or degraded step/human-input boundaries
 * when a log has none), tool pairing, subagent links, compaction points, and
 * what each turn contributes to the attribution window.
 *
 * Kept apart from {@link readDshSession} because that function is about *where
 * the events came from* — file, frames, projection checkpoint — while this one
 * is about what they mean. The split is also what keeps both modules inside a
 * size a reviewer can hold in their head.
 *
 * @see docs/IR.md (adapter 必须遵守)
 * @see docs/adr/0005-honest-attribution-residual.md
 */

import type { Turn } from "@cyrus/dsh-session-contract"
import { DshAttributionWindow } from "./attribution.ts"
import { isCompactionConsistent, isCompactionEvent, readCompaction } from "./compaction.ts"
import type { DshProjection, ProjectionRequest } from "./projection.ts"
import { arrayField, numberField, objectField, stringField, type LogEvent } from "./records.ts"
import { readSessionTitle } from "./session-meta.ts"
import { SubagentTracker } from "./subagents.ts"
import { DshToolLedger } from "./tools.ts"
import { contentImages, contentTexts, isHumanUserMessage, messageContent } from "./turns.ts"
import { DshUsageNormalizer, readEventUsage } from "./usage.ts"

/** What a fold needs from the caller before it can interpret events. */
export interface FoldInput {
  /** The checkpoint whose request split turns may use, or undefined when unusable. */
  projection: DshProjection | undefined
  /** True when `projection` passed the freshness gate. */
  usable: boolean
  /** Shared with the caller: the fold appends to it and so does the caller's tail. */
  dataQuality: Set<string>
  /** Facts from the session header line. */
  header: {
    id?: string
    cwd?: string
    createdAt?: number
  }
}

/** Mutable per-turn accumulator, finalized when the turn closes. */
interface OpenTurn {
  startedAt: number
  endedAt: number
  startSeq: number
  endSeq: number
  declared: number
  userInput: string[]
  assistantText: string[]
  thinking: string[]
  callIds: string[]
  subagents: string[]
  compactions: Turn["compactions"]
  usage: DshUsageNormalizer
  model?: { provider: string; model: string }
}

function emptyTurn(at: number, seq: number): OpenTurn {
  return {
    startedAt: at,
    endedAt: at,
    startSeq: seq,
    endSeq: seq,
    declared: 0,
    userInput: [],
    assistantText: [],
    thinking: [],
    callIds: [],
    subagents: [],
    compactions: [],
    usage: new DshUsageNormalizer(),
  }
}

/** Pick the request a turn peaked at, and the one before it. */
function requestsForTurn(
  requests: readonly ProjectionRequest[],
  turn: OpenTurn
): { peak?: ProjectionRequest; previous?: ProjectionRequest } {
  let bestIndex = -1
  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index]
    if (request === undefined) continue
    if (request.seq < turn.startSeq || request.seq > turn.endSeq) continue
    if (bestIndex < 0 || request.prompt > (requests[bestIndex]?.prompt ?? 0)) bestIndex = index
  }
  if (bestIndex < 0) {
    // Some sessions record the request before the turn's start event; fall back
    // to the projection's own turn numbering rather than losing the split.
    for (let index = 0; index < requests.length; index += 1) {
      const request = requests[index]
      if (request === undefined || turn.declared === 0) continue
      if (request.turn !== turn.declared) continue
      if (bestIndex < 0 || request.prompt > (requests[bestIndex]?.prompt ?? 0)) bestIndex = index
    }
  }
  if (bestIndex < 0) return {}
  const peak = requests[bestIndex]
  const previous = bestIndex > 0 ? requests[bestIndex - 1] : undefined
  return previous === undefined ? { peak } : { peak, previous }
}

/**
 * The accumulating state of one session being folded.
 *
 * A class rather than a bag of closures so the caller can read the finished
 * figures — turn count, request count, data-quality additions — without the
 * fold having to return a dozen values.
 */
export class SessionFold {
  readonly window = new DshAttributionWindow()
  readonly ledger = new DshToolLedger()
  readonly subagents = new SubagentTracker()
  readonly turns: Turn[] = []
  readonly rawByTurn: number[] = []
  rawAttributionTokens = 0
  requests = 0
  compactions = 0
  sawTurnEvents = false
  title: string | undefined
  sessionId: string | undefined
  workdir: string | undefined
  createdAt: number
  updatedAt = 0

  private readonly projection: DshProjection | undefined
  private readonly usable: boolean
  private readonly dataQuality: Set<string>
  private contextWindow: number | undefined
  private open: OpenTurn | undefined

  constructor(input: FoldInput) {
    this.projection = input.projection
    this.usable = input.usable
    this.dataQuality = input.dataQuality
    this.sessionId = input.header.id
    this.workdir = input.header.cwd
    this.createdAt = input.header.createdAt ?? Number.POSITIVE_INFINITY
  }

  /**
   * Interpret every event of one session.
   * @param events - the log's parsed events, header included.
   */
  fold(events: readonly LogEvent[]): void {
    for (const event of events) {
      const { type, data, time, seq } = event
      if (type === "session") continue

      if (time > this.updatedAt) this.updatedAt = time
      const declaredTurn = numberField(data, "turn")

      if (type === "turn/start") {
        this.sawTurnEvents = true
        this.closeTurn()
        const opened = emptyTurn(time, seq)
        opened.declared = declaredTurn ?? 0
        this.open = opened
        continue
      }
      if (type === "turn/end") {
        const open = this.open
        if (open !== undefined) {
          open.endSeq = seq
          if (time > open.endedAt) open.endedAt = time
        }
        this.closeTurn()
        continue
      }

      if (!this.sawTurnEvents && declaredTurn !== undefined && declaredTurn > 0) {
        this.ensureDegradedTurn(time, seq, declaredTurn)
        const open = this.open
        if (open !== undefined) {
          open.endSeq = seq
          if (time > open.endedAt) open.endedAt = time
        }
      }

      const subagentId = this.subagents.observe(type, data)
      if (subagentId !== undefined) {
        const current = this.ensureTurn(time, seq)
        if (!current.subagents.includes(subagentId)) current.subagents.push(subagentId)
      }

      if (type === "session/title") {
        // Titles are a mutation (fallback first, provider later), so the last one
        // wins — the same rule the list reader applies to the file head.
        const value = readSessionTitle(data)
        if (value !== undefined) this.title = value
        continue
      }

      if (type === "request/context") {
        const size = numberField(data, "contextWindow")
        if (size !== undefined && size > 0) this.contextWindow = size
        continue
      }

      if (type === "request/header") {
        const headerBody = objectField(data, "header")
        const tools = arrayField(headerBody, "tools")
        if (tools !== undefined) this.window.setToolSchemas(tools)
        const config = objectField(headerBody, "config")
        const provider = stringField(config, "provider")
        const model = stringField(config, "model")
        const current = this.ensureTurn(time, seq)
        if (provider !== undefined && model !== undefined && current.model === undefined) {
          current.model = { provider, model }
        }
        continue
      }

      if (isCompactionEvent(type)) {
        this.compactions += 1
        const observed = this.open === undefined ? 0 : this.open.usage.peakContext
        const point = readCompaction(type, data, time, observed)
        if (point !== undefined) {
          if (!isCompactionConsistent(point)) {
            this.dataQuality.add(`compaction-values-inconsistent:${this.compactions}`)
          }
          if (this.open !== undefined) this.open.compactions.push(point)
          // A compaction replaces the carried surface with a summary.
          this.window.startSegment(stringField(data, "summary"))
        }
        continue
      }

      if (type === "system/message") {
        const texts = contentTexts(messageContent(objectField(data, "message")))
        for (const entry of texts) if (!entry.reasoning) this.window.setSystemText(entry.text)
        continue
      }

      if (type === "user/message") {
        const human = isHumanUserMessage(data)
        const blocks = messageContent(data)
        if (human) {
          // The IR defines a turn as one human input, so this is also where a
          // degraded (turn-event-less) log starts a new turn.
          if (!this.sawTurnEvents) {
            const open = this.open
            if (open === undefined || open.userInput.length > 0) {
              this.closeTurn()
              this.open = emptyTurn(time, seq)
            }
          }
          const current = this.ensureTurn(time, seq)
          current.endSeq = seq
          if (time > current.endedAt) current.endedAt = time
          for (const entry of contentTexts(blocks)) {
            if (entry.reasoning) continue
            current.userInput.push(entry.text)
            this.window.addUserText(entry.text)
          }
          for (const image of contentImages(blocks)) this.window.addImage(image.data, image.mediaType)
        } else {
          // Harness-written user message: part of the window, never human input.
          for (const entry of contentTexts(blocks)) {
            if (entry.reasoning) continue
            this.window.addInjectedText(entry.text)
          }
        }
        continue
      }

      if (type === "tool/call") {
        const current = this.ensureTurn(time, seq)
        current.endSeq = seq
        const id = stringField(data, "callId")
        this.ledger.addCall(data, time)
        if (id !== undefined && !current.callIds.includes(id)) current.callIds.push(id)
        continue
      }

      if (type === "tool/result") {
        const current = this.ensureTurn(time, seq)
        current.endSeq = seq
        if (time > current.endedAt) current.endedAt = time
        this.ledger.addResult(data, time)
        const message = objectField(data, "message")
        for (const entry of contentTexts(messageContent(message))) {
          if (!entry.reasoning) this.window.addToolResultText(entry.text)
        }
        for (const image of contentImages(messageContent(message))) {
          this.window.addImage(image.data, image.mediaType)
        }
        continue
      }

      if (type !== "assistant/message") continue

      this.requests += 1
      const current = this.ensureTurn(time, seq)
      current.endSeq = seq
      if (time > current.endedAt) current.endedAt = time
      const usage = readEventUsage(data)
      if (usage !== undefined) current.usage.observe(usage)

      const message = objectField(data, "message")
      const source = objectField(message, "source")
      const provider = stringField(source, "provider")
      const model = stringField(source, "model")
      if (provider !== undefined && model !== undefined && current.model === undefined) {
        current.model = { provider, model }
      }
      for (const entry of contentTexts(messageContent(message))) {
        if (entry.reasoning) {
          current.thinking.push(entry.text)
          this.window.addThinking(entry.text)
        } else {
          current.assistantText.push(entry.text)
          this.window.addAssistantText(entry.text)
        }
      }
      for (const image of contentImages(messageContent(message))) {
        this.window.addImage(image.data, image.mediaType)
      }
    }
    this.closeTurn()
  }

  private closeTurn(): void {
    const open = this.open
    if (open === undefined) return
    const index = this.turns.length + 1
    const hasUsage = open.usage.seen
    const usage = hasUsage ? open.usage.toUsage() : undefined
    if (open.usage.inconsistentTotal > 0) this.dataQuality.add(`usage-total-mismatch:turn=${index}`)
    if (!hasUsage) this.dataQuality.add("turn-without-usage")
    if (open.endSeq < open.startSeq) open.endSeq = open.startSeq

    const picked = this.usable && this.projection !== undefined ? requestsForTurn(this.projection.requests, open) : {}
    const attribution = this.window.attribution(usage === undefined ? 0 : usage.totalContext, {
      ...(picked.peak === undefined ? {} : { request: picked.peak }),
      ...(picked.previous === undefined ? {} : { previous: picked.previous }),
      ...(this.contextWindow === undefined ? {} : { windowSize: this.contextWindow }),
    })
    this.rawByTurn.push(this.window.lastRawTokens)
    this.rawAttributionTokens += this.window.lastRawTokens

    const turn: Turn = {
      index,
      startedAt: open.startedAt,
      endedAt: open.endedAt,
      userInput: open.userInput,
      assistantText: open.assistantText,
      toolCalls: this.ledger.callsOf(open.callIds),
      attribution,
      compactions: open.compactions,
      subagents: open.subagents,
    }
    if (open.thinking.length > 0) turn.thinking = open.thinking
    if (usage !== undefined) turn.usage = usage
    if (open.model !== undefined) turn.model = open.model
    this.turns.push(turn)
    this.open = undefined
    this.window.endTurn()
  }

  private ensureTurn(at: number, seq: number): OpenTurn {
    if (this.open === undefined) this.open = emptyTurn(at, seq)
    return this.open
  }

  /** Open a turn at a step boundary when the log carries no `turn/start`. */
  private ensureDegradedTurn(at: number, seq: number, turnNumber: number): void {
    if (this.open === undefined) {
      const opened = emptyTurn(at, seq)
      opened.declared = turnNumber
      this.open = opened
      return
    }
    if (this.open.declared !== turnNumber) {
      this.closeTurn()
      const opened = emptyTurn(at, seq)
      opened.declared = turnNumber
      this.open = opened
    }
  }
}
