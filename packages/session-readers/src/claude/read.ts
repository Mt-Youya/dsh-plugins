/**
 * Streaming pass over one Claude Code transcript.
 *
 * This module owns the single walk over the file: de-duplication, usage
 * normalization, tool pairing, compaction tracking and the per-turn window are
 * all accumulated here. Assembling the IR `Session` is the caller's job, so the
 * loop never has to know about segments, titles or data-quality summaries.
 *
 * @see docs/PLAN.md (各来源的归一化红线 · Claude)
 */

import { exactMeasure } from "@cyrus/dsh-session-contract"
import type { Turn, Usage } from "@cyrus/dsh-session-contract"
import { ContextWindow } from "./attribution.ts"
import { isCompactSummary, readCompactionBoundary, toCompactionPoint, type CompactionBoundary } from "./compaction.ts"
import {
  arrayField,
  booleanField,
  epochOf,
  isObject,
  objectField,
  streamRecords,
  stringField,
  UuidDeduplicator,
  type JsonObject,
  type StreamStats,
} from "./records.ts"
import { ToolLedger, recordTime, toolInvocations, toolOutcomes } from "./tools.ts"
import { humanText, isInjectedUserMessage } from "./turns.ts"
import { UsageNormalizer, readUsage, type UsageReading } from "./usage.ts"
import { agentIdOf, isSubagentPath } from "./subagents.ts"

/** Window facts a caller needs to describe the session; all derived from the loop. */
export interface WindowFacts {
  sawSnapshot: boolean
  reusedSnapshotTurns: number
  staleSnapshotTurns2: number
  scaledTurnCount: number
  residualTurnCount: number
  structuralGapTurnCount: number
  overCountedWithoutGap: number
  worstReconciliation: number
  worstResidual: number
  worstOverCount: number
}

/** Everything one streaming pass produces, before any session assembly. */
export interface TranscriptRead {
  turns: Turn[]
  dataQuality: Set<string>
  stream: StreamStats
  duplicates: number
  deduped: number
  messageIds: number
  inconsistentUsage: number
  usageWithoutMessageId: number
  naiveContextTokens: number
  normalizedContextTokens: number
  pairedToolCalls: number
  orphanToolResults: number
  rawAttributionTokens: number
  rawByTurn: number[]
  compactions: number
  /** Compactions whose `postTokens` sits far below the window actually observed. */
  prefixOverruns: string[]
  sidechainFile: boolean
  sidechainRecords: number
  subagentIds: Set<string>
  sessionId?: string
  workdir?: string
  title?: string
  createdAt: number
  updatedAt: number
  window: WindowFacts
}
const MAX_PLAUSIBLE_CONTEXT = 1_000_000

/** Mutable per-turn accumulator, finalized when the next turn starts. */
interface OpenTurn {
  startedAt: number
  endedAt: number
  userInput: string[]
  assistantText: string[]
  thinking: string[]
  usageByMessage: Map<string, UsageReading>
  ledger: ToolLedger
  compactions: Turn["compactions"]
  subagents: string[]
  model?: { provider: string; model: string }
  peakContext: number
}

function emptyTurn(startedAt: number): OpenTurn {
  return {
    startedAt,
    endedAt: startedAt,
    userInput: [],
    assistantText: [],
    thinking: [],
    usageByMessage: new Map(),
    ledger: new ToolLedger(),
    compactions: [],
    subagents: [],
    peakContext: 0,
  }
}

/** Aggregate one turn's unique message usages into the IR shape. */
function turnUsage(usageByMessage: Map<string, UsageReading>, peak: number): Usage | undefined {
  if (usageByMessage.size === 0) return undefined
  let input = 0
  let cacheRead = 0
  let cacheWrite = 0
  let output = 0
  for (const reading of usageByMessage.values()) {
    input += reading.input
    cacheRead += reading.cacheRead
    cacheWrite += reading.cacheWrite
    output += reading.output
  }
  return { input, cacheRead, cacheWrite, output, totalContext: peak }
}

/**
 * Parse one Claude session file.
 *
 * Subagent transcripts are *not* merged into the turns: they are returned as
 * additional `Session.segments` and referenced by `Turn.subagents`, which is
 * what the IR requires.
 * @param path - a `<project>/<sessionId>.jsonl` transcript.
 * @param options - see {@link ClaudeReadOptions}.
 */
export async function readTranscript(path: string): Promise<TranscriptRead> {
  const started = Date.now()
  const dedupe = new UuidDeduplicator()
  const normalizer = new UsageNormalizer()
  const window = new ContextWindow()
  const dataQuality = new Set<string>()

  let sessionId: string | undefined
  let workdir: string | undefined
  let title: string | undefined
  let createdAt = Number.POSITIVE_INFINITY
  let updatedAt = 0
  let sidechainRecords = 0

  let naiveContextTokens = 0
  let normalizedContextTokens = 0
  const normalizedByMessage = new Map<string, number>()
  let pairedToolCalls = 0
  let orphanCount = 0
  let rawAttributionTokens = 0
  const rawByTurn: number[] = []
  /** Compactions whose `postTokens` is far below the window actually observed. */
  const prefixOverruns: string[] = []
  let compactions = 0

  const turns: Turn[] = []
  let open: OpenTurn | undefined
  let pendingCompaction: CompactionBoundary | undefined
  /** Set at a boundary so the next observed request can be compared with it. */
  let expectationAfterCompaction: { turn: number; postTokens: number; before: number } | undefined
  /** Highest context seen so far, used to detect a boundary that did not shrink. */
  let lastPeakContext = 0

  const subagentIds = new Set<string>()

  const closeTurn = (): void => {
    if (open === undefined) return
    orphanCount += open.ledger.orphans
    const usage = turnUsage(open.usageByMessage, open.peakContext)
    const attribution = window.attribution(open.peakContext)
    rawByTurn.push(window.lastRawTokens)
    rawAttributionTokens += window.lastRawTokens
    const index = turns.length + 1
    if (usage !== undefined && usage.totalContext > MAX_PLAUSIBLE_CONTEXT) {
      dataQuality.add(`context-above-model-window:turn=${index}:tokens=${usage.totalContext}`)
    }
    const turn: Turn = {
      index,
      startedAt: open.startedAt,
      endedAt: open.endedAt,
      userInput: open.userInput,
      assistantText: open.assistantText,
      toolCalls: open.ledger.toCalls(),
      attribution,
      compactions: open.compactions,
      subagents: open.subagents,
    }
    if (open.thinking.length > 0) turn.thinking = open.thinking
    if (usage !== undefined) turn.usage = usage
    if (open.model !== undefined) turn.model = open.model
    turns.push(turn)
    if (usage === undefined) dataQuality.add("turn-without-usage")
    open = undefined
    window.endTurn()
  }

  // Where a transcript lives says what it is: only `<session>/subagents/agent-*.jsonl`
  // belongs to a child. A parent can still hold copied sidechain records, and
  // those describe the child's prompt, so they are not part of this session.
  const sidechainFile = isSubagentPath(path)

  const stats = await streamRecords(path, (record) => {
    if (!dedupe.accept(record)) return

    const type = stringField(record, "type")
    if (type === undefined) return
    const sidechain = booleanField(record, "isSidechain") === true
    if (sidechain && !sidechainFile) {
      sidechainRecords += 1
      return
    }

    const id = stringField(record, "sessionId")
    if (id !== undefined && sessionId === undefined) sessionId = id
    const cwd = stringField(record, "cwd")
    if (cwd !== undefined && workdir === undefined) workdir = cwd
    const at = epochOf(record)
    if (at !== undefined) {
      if (at < createdAt) createdAt = at
      if (at > updatedAt) updatedAt = at
    }

    if (type === "custom-title") {
      const value = stringField(record, "customTitle")
      if (value !== undefined) title = value
      return
    }
    if (type === "agent-name") {
      // Holds the *session* title, not a subagent name.
      const value = stringField(record, "agentName")
      if (value !== undefined && title === undefined) title = value
      return
    }

    if (type === "system") {
      const boundary = readCompactionBoundary(record)
      if (boundary === undefined) return
      compactions += 1
      window.startSegment()
      if (open !== undefined) {
        open.compactions.push(toCompactionPoint(boundary, exactMeasure(boundary.preTokens)))
        expectationAfterCompaction = {
          turn: turns.length + 1,
          postTokens: boundary.postTokens,
          before: lastPeakContext,
        }
      } else {
        // Between turns: the next turn reports it, so it is not lost.
        pendingCompaction = boundary
      }
      return
    }

    if (type === "attachment") {
      window.addAttachmentRecord(record)
      return
    }

    if (type === "user") {
      const agentId = agentIdOf(record)
      if (agentId !== undefined && open !== undefined) open.subagents.push(agentId)
      if (agentId !== undefined) subagentIds.add(agentId)

      const message = objectField(record, "message")
      const content = message?.["content"]
      if (typeof content === "string") {
        if (isCompactSummary(record)) {
          // The summary replaces the history it was written from.
          window.addSummaryText(content)
          return
        }
        const human = humanText(content)
        if (human !== undefined) {
          closeTurn()
          window.beginTurn()
          open = emptyTurn(recordTime(record))
          open.userInput.push(human)
          window.addUserText(human)
          if (pendingCompaction !== undefined) {
            open.compactions.push(toCompactionPoint(pendingCompaction, exactMeasure(pendingCompaction.preTokens)))
            pendingCompaction = undefined
          }
          return
        }
        if (isInjectedUserMessage(content)) {
          // Harness-written user message: part of the window, never human input.
          window.addSummaryText(content)
        }
        return
      }
      if (!Array.isArray(content)) return

      // Tool results continue the turn that issued the call.
      const outcomes = toolOutcomes(record, recordTime(record))
      for (const outcome of outcomes) {
        if (open !== undefined) open.ledger.addOutcome(outcome)
        const blocks = outcome.output
        if (typeof blocks === "string") {
          window.addToolResultText(blocks)
        } else if (Array.isArray(blocks)) {
          for (const block of blocks) {
            if (!isObject(block)) continue
            const blockType = stringField(block, "type")
            if (blockType === "text") {
              const text = stringField(block, "text")
              if (text !== undefined) window.addToolResultText(text)
            } else if (blockType === "image") {
              const source = objectField(block, "source")
              if (source !== undefined) {
                window.addImage(source["data"], stringField(source, "media_type"))
              }
            }
          }
        }
      }
      return
    }

    if (type !== "assistant") return

    const message = objectField(record, "message")
    if (message === undefined) return
    const messageId = stringField(message, "id")
    const reading = readUsage(objectField(message, "usage"))
    if (reading !== undefined) {
      naiveContextTokens += reading.totalContext
      const winner = normalizer.observe(messageId, reading)
      // One response is written as one record per content block, each repeating
      // the same usage; the normalized total counts a message id once and keeps
      // the largest reading if a later block carries more.
      if (messageId !== undefined) {
        const previous = normalizedByMessage.get(messageId) ?? 0
        normalizedContextTokens += winner.totalContext - previous
        normalizedByMessage.set(messageId, winner.totalContext)
      }
      if (open !== undefined) {
        if (messageId !== undefined) open.usageByMessage.set(messageId, winner)
        if (winner.totalContext > open.peakContext) open.peakContext = winner.totalContext
      }
    }

    if (open !== undefined) {
      const model = stringField(message, "model")
      if (model !== undefined && open.model === undefined) {
        open.model = { provider: "anthropic", model }
      }
      const ended = recordTime(record)
      if (ended > open.endedAt) open.endedAt = ended
    }

    const invocations = toolInvocations(record, recordTime(record))
    if (open !== undefined) for (const invocation of invocations) open.ledger.addInvocation(invocation)

    const blocks = arrayField(message, "content")
    if (blocks === undefined) return
    for (const block of blocks) {
      if (!isObject(block)) continue
      const blockType = stringField(block, "type")
      if (blockType === "text") {
        const text = stringField(block, "text")
        if (text === undefined) continue
        if (open !== undefined) open.assistantText.push(text)
        window.addAssistantText(text)
      } else if (blockType === "thinking") {
        const text = stringField(block, "thinking")
        if (text === undefined) continue
        if (open !== undefined) open.thinking.push(text)
        window.addThinking(text)
      } else if (blockType === "tool_use") {
        // The input is model output that is replayed on every later request.
        window.addAssistantPayload(block["input"])
      }
    }

    if (expectationAfterCompaction !== undefined && open !== undefined && open.peakContext > 0) {
      const { turn, postTokens, before } = expectationAfterCompaction
      // `postTokens` never matches the next request: on this corpus the fixed
      // prefix alone is already ~420 K tokens of tool schemas, which the
      // metadata does not count. Reported with both numbers so it can be
      // checked against the transcript instead of believed.
      if (turn === turns.length + 1 && open.peakContext > postTokens * 1.5) {
        if (prefixOverruns.length === 0) {
          prefixOverruns.push(`turn=${turn}:post=${postTokens}:observed=${open.peakContext}`)
        } else {
          prefixOverruns.push("")
        }
        void before
      }
      expectationAfterCompaction = undefined
    }
    if (open !== undefined && open.peakContext > lastPeakContext) lastPeakContext = open.peakContext
  })

  closeTurn()

  for (const turn of turns) {
    for (const call of turn.toolCalls) if (call.endedAt !== undefined) pairedToolCalls += 1
  }

  return {
    turns,
    dataQuality,
    stream: stats,
    duplicates: dedupe.dropped,
    deduped: stats.parsed - dedupe.dropped,
    messageIds: normalizer.distinctMessages,
    inconsistentUsage: normalizer.inconsistentMessages,
    usageWithoutMessageId: normalizer.withoutMessageId,
    naiveContextTokens,
    normalizedContextTokens,
    pairedToolCalls,
    orphanToolResults: orphanCount,
    rawAttributionTokens,
    rawByTurn,
    compactions,
    prefixOverruns,
    sidechainFile,
    sidechainRecords,
    subagentIds,
    sessionId,
    workdir,
    title,
    createdAt,
    updatedAt,
    window: {
      sawSnapshot: window.sawSnapshot,
      reusedSnapshotTurns: window.reusedSnapshotTurns,
      staleSnapshotTurns2: window.staleSnapshotTurns2,
      scaledTurnCount: window.scaledTurnCount,
      residualTurnCount: window.residualTurnCount,
      structuralGapTurnCount: window.structuralGapTurnCount,
      overCountedWithoutGap: window.overCountedWithoutGap,
      worstReconciliation: window.worstReconciliation,
      worstResidual: window.worstResidual,
      worstOverCount: window.worstOverCount,
    },
  }
}
