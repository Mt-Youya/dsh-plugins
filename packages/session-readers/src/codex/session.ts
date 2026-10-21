/**
 * One logical Codex session -> IR.
 *
 * The root thread's segment files are read in history_base order; every record
 * is folded into turns keyed by turn_id. The rules that keep the numbers honest
 * (docs/PLAN.md 各来源的归一化红线):
 * - usage only from token_usage_record.usage, de-duplicated by response_id;
 *   cached_input_tokens stays a subset of input and is never added;
 * - base_instructions counted once per logical session, not once per segment;
 * - item_completed items are the event view of the same content response_item
 *   already carries (52,459 events against 97,074 response items), so they only
 *   contribute SubAgentActivity; using them for text would double the window;
 * - compaction replaces history (replacedHistory = true) and the fixed prefix
 *   survives;
 * - reasoning is encrypted, so Turn.thinking stays undefined and the session
 *   says reasoning-encrypted instead of inventing a thought length.
 *
 * Accounting lives in stats.ts so this file stays the record flow.
 *
 * @see docs/IR.md (adapter 必须遵守, 对账的边界)
 * @see docs/adr/0005-honest-attribution-residual.md
 */

import { exactMeasure } from "@cyrus/dsh-session-contract"
import type { Session, Turn, Usage } from "@cyrus/dsh-session-contract"
import type { ResolvedRead } from "./assemble.ts"
import { CodexWindow } from "./attribution.ts"
import { readCompacted, toCompactionPoint } from "./compaction.ts"
import {
  epochOfValue,
  isObject,
  objectField,
  readEnvelope,
  streamRecords,
  stringField,
  type Envelope,
  type JsonObject,
} from "./records.ts"
import { SessionStats, type CodexReadResult, type SessionFacts } from "./stats.ts"
import { subagentActivityOf } from "./subagents.ts"
import { ToolLedger, isToolCallItem, isToolOutputItem, toolInvocationOf, toolOutcomeOf } from "./tools.ts"
import { classifyUserMessage, messageText, turnIdOf } from "./turns.ts"
import { UsageTally, readTokenCountInfo, readUsageRecord, type UsageReading } from "./usage.ts"

/** Mutable per-turn accumulator, finalized when the next turn starts. */
interface OpenTurn {
  key: string
  startedAt: number
  endedAt: number
  userInput: string[]
  assistantText: string[]
  ledger: ToolLedger
  compactions: Turn["compactions"]
  subagents: string[]
  usage: UsageReading[]
  peakContext: number
  /** Ordinal of the request that set peakContext. */
  peakOrdinal: number
  model?: string
}

/** Aggregate one turn's responses into the IR shape. */
function turnUsage(readings: readonly UsageReading[], peak: number): Usage | undefined {
  if (readings.length === 0) return undefined
  let input = 0
  let cacheRead = 0
  let cacheWrite = 0
  let output = 0
  for (const reading of readings) {
    input += reading.nonCachedInput
    cacheRead += reading.cachedInput
    cacheWrite += reading.cacheWrite
    output += reading.output
  }
  return { input, cacheRead, cacheWrite, output, totalContext: peak }
}

/**
 * Parse one resolved thread, segment by segment.
 *
 * Pass the first segment and the index resolves the continuation chain; pass a
 * subagent rollout and the child thread is parsed instead (its Session.id is
 * the child thread id, so the panel never merges a child into its parent).
 * @param path - any rollout file of the session.
 * @param resolved - the thread, its files and the session-level facts.
 * @param started - wall-clock start, for the elapsed counter.
 */
export async function openCodexSession(
  path: string,
  resolved: ResolvedRead,
  started: number
): Promise<CodexReadResult> {
  const { planned, files, thread } = resolved

  /** Model provider for every turn, taken from the session metadata. */
  let provider = planned.meta?.modelProvider ?? "openai"
  const window = new CodexWindow()
  const stats = new SessionStats()
  const tally = new UsageTally()
  const turns: Turn[] = []
  const subagentThreads = new Set<string>()

  let firstOrdinal: number | undefined
  let lastAt = 0
  let lastUsageInput = 0
  let segmentIndex = 0
  let createdAt = Number.POSITIVE_INFINITY
  let updatedAt = 0

  /** Boundaries waiting for the first request that follows them. */
  const pendingAfter: Array<{ point: Turn["compactions"][number]; before: number; segment: number }> = []

  let open: OpenTurn | undefined
  let currentKey: string | undefined
  let synthetic = 0

  const closeTurn = (): void => {
    if (open === undefined) return
    // Results with no call are counted even when the turn itself is scaffolding.
    stats.noteOrphanResults(open.ledger.orphans)
    const calls = open.ledger.toCalls()
    const usage = turnUsage(open.usage, open.peakContext)
    // Scaffolding-only windows (a compaction between turns, a world state
    // update) are not turns: nothing was asked and nothing was answered.
    const empty =
      open.userInput.length === 0 &&
      open.assistantText.length === 0 &&
      calls.length === 0 &&
      usage === undefined &&
      open.compactions.length === 0 &&
      open.subagents.length === 0
    if (empty) {
      window.endTurn()
      open = undefined
      return
    }
    // Measure the window at the peak request; a turn without usage has no peak,
    // so it is measured at its end (and marked turn-without-usage).
    const report = window.attribution(
      open.peakContext,
      open.peakContext > 0 ? open.peakOrdinal : Number.POSITIVE_INFINITY
    )
    const turn: Turn = {
      index: turns.length + 1,
      startedAt: open.startedAt,
      endedAt: open.endedAt,
      userInput: open.userInput,
      assistantText: open.assistantText,
      toolCalls: calls,
      attribution: report.attribution,
      compactions: open.compactions,
      subagents: open.subagents,
    }
    if (usage !== undefined) turn.usage = usage
    if (open.model !== undefined) turn.model = { provider, model: open.model }
    turns.push(turn)
    stats.noteTurn({ usageLogged: usage !== undefined, report, peakContext: open.peakContext })
    window.endTurn()
    open = undefined
  }

  const startTurn = (key: string, at: number | undefined): OpenTurn => {
    if (key !== currentKey) {
      closeTurn()
      currentKey = key
    }
    if (open !== undefined) return open
    const startedAt = at ?? lastAt
    open = {
      key,
      startedAt,
      endedAt: startedAt,
      userInput: [],
      assistantText: [],
      ledger: new ToolLedger(),
      compactions: [],
      subagents: [],
      usage: [],
      peakContext: 0,
      peakOrdinal: 0,
    }
    return open
  }

  const ensureTurn = (key: string | undefined, at: number | undefined): OpenTurn => {
    if (key !== undefined) return startTurn(key, at)
    if (open !== undefined) return open
    synthetic += 1
    return startTurn("untracked:" + synthetic, at)
  }

  const touch = (at: number | undefined): void => {
    if (at === undefined) return
    if (at > lastAt) lastAt = at
    if (at < createdAt) createdAt = at
    if (at > updatedAt) updatedAt = at
  }

  const noteUsage = (reading: UsageReading, payload: JsonObject, at: number | undefined, ordinal: number): void => {
    stats.noteUsage(reading, payload)
    lastUsageInput = reading.input
    const turn = ensureTurn(reading.turnId, at)
    turn.usage.push(reading)
    if (reading.input > turn.peakContext) {
      turn.peakContext = reading.input
      turn.peakOrdinal = ordinal
    }
    if (at !== undefined && at > turn.endedAt) turn.endedAt = at
    for (const pending of pendingAfter) {
      // Only a request from the same segment can be the post-compaction one: a
      // segment boundary is a resume hours later, not the next request.
      if (pending.segment !== segmentIndex) {
        stats.noteCompactionUnresolved()
        continue
      }
      const after = reading.input
      pending.point.after = exactMeasure(after)
      if (after > 0 && after < pending.before) stats.noteCompactionDrop()
    }
    pendingAfter.length = 0
  }

  const handleResponseItem = (envelope: Envelope, at: number | undefined): void => {
    const payload = envelope.payload
    const type = stringField(payload, "type") ?? ""
    const turn = ensureTurn(turnIdOf(envelope), at)
    if (type === "message") {
      const role = stringField(payload, "role")
      const text = messageText(payload)
      if (role === "assistant") {
        if (text.length > 0) {
          turn.assistantText.push(text)
          window.addAssistantText(text, envelope.ordinal ?? 0)
        }
      } else if (role === "developer") {
        window.addDeveloperText(text, envelope.ordinal ?? 0)
      } else if (role === "user") {
        const blocks = classifyUserMessage(text)
        if (blocks.human !== undefined) {
          turn.userInput.push(blocks.human)
          window.addHumanText(blocks.human, envelope.ordinal ?? 0)
        }
        for (const block of blocks.injected) window.addInjection(block.kind, block.text, envelope.ordinal ?? 0)
      }
      const content = payload["content"]
      if (Array.isArray(content)) {
        for (const block of content) {
          if (!isObject(block)) continue
          if (stringField(block, "type") !== "input_image") continue
          window.addImageUrl(block["image_url"], envelope.ordinal ?? 0)
        }
      }
      return
    }
    if (type === "reasoning") {
      const encrypted = typeof payload["encrypted_content"] === "string"
      window.noteReasoning(encrypted)
      const summary = payload["summary"]
      if (Array.isArray(summary)) {
        for (const entry of summary) {
          if (!isObject(entry)) continue
          const text = stringField(entry, "text")
          if (text !== undefined) window.addThinking(text, envelope.ordinal ?? 0)
        }
      }
      return
    }
    if (isToolCallItem(payload)) {
      const invocation = toolInvocationOf(payload, at ?? lastAt)
      if (invocation !== undefined) {
        turn.ledger.addInvocation(invocation)
        window.addAssistantPayload(invocation.input, envelope.ordinal ?? 0)
      }
      return
    }
    if (isToolOutputItem(payload)) {
      const outcome = toolOutcomeOf(payload, at ?? lastAt)
      if (outcome !== undefined) {
        turn.ledger.addOutcome(outcome)
        window.addToolResult(outcome.output, envelope.ordinal ?? 0)
      }
      return
    }
    if (type === "additional_tools") {
      window.applyToolSchemas(payload["tools"])
      return
    }
    if (type === "agent_message") {
      const text = messageText(payload)
      const recipient = stringField(payload, "recipient")
      if (recipient === "/root") window.addToolResult(text, envelope.ordinal ?? 0)
      else window.addAssistantText(text, envelope.ordinal ?? 0)
      return
    }
    if (type === "compaction") return
    stats.noteUnclassifiedRecord()
  }

  const handleEvent = (envelope: Envelope, at: number | undefined): void => {
    const payload = envelope.payload
    const type = stringField(payload, "type") ?? ""
    if (type === "token_count") {
      stats.noteTokenCount(payload)
      const info = readTokenCountInfo(payload)
      if (info?.contextWindow !== undefined) window.setWindowSize(info.contextWindow)
      return
    }
    if (type === "item_completed") {
      const activity = subagentActivityOf(payload)
      if (activity !== undefined) {
        subagentThreads.add(activity.threadId)
        const turn = ensureTurn(turnIdOf(envelope), at)
        if (!turn.subagents.includes(activity.threadId)) turn.subagents.push(activity.threadId)
      }
      return
    }
    if (type === "task_started") {
      ensureTurn(stringField(payload, "turn_id"), epochOfValue(payload["started_at"]) ?? at)
      return
    }
    if (type === "task_complete") {
      const turn = ensureTurn(stringField(payload, "turn_id"), at)
      const completed = epochOfValue(payload["completed_at"]) ?? at
      if (completed !== undefined && completed > turn.endedAt) turn.endedAt = completed
      return
    }
    if (type === "turn_aborted") {
      stats.noteAbortedTurn()
      const turn = ensureTurn(stringField(payload, "turn_id"), at)
      if (at !== undefined && at > turn.endedAt) turn.endedAt = at
      return
    }
    if (type === "thread_settings_applied" || type === "thread_goal_updated") return
    stats.noteUnclassifiedRecord()
  }

  const handleCompacted = (envelope: Envelope, at: number | undefined): void => {
    const compacted = readCompacted(envelope.payload)
    stats.noteCompaction()
    // The boundary's own usage snapshot is the request that triggered it, i.e.
    // the size that must fall. The post-compaction size is the next request's.
    const before = compacted.latestUsage?.input ?? lastUsageInput
    const trigger = compacted.windowNumber === undefined ? undefined : "window=" + compacted.windowNumber
    const point = toCompactionPoint(at ?? lastAt, before, 0, trigger)
    const turn = ensureTurn(undefined, at)
    turn.compactions.push(point)
    pendingAfter.push({ point, before, segment: segmentIndex })
    window.replaceHistory(compacted.replacementHistory, envelope.ordinal ?? 0)
  }

  for (let position = 0; position < files.length; position += 1) {
    const file = files[position]
    if (file === undefined) continue
    segmentIndex = position
    stats.noteCompactionUnresolved(pendingAfter.length)
    pendingAfter.length = 0
    const stream = await streamRecords(file.path, (record) => {
      const envelope = readEnvelope(record)
      if (envelope === undefined) return
      if (envelope.ordinal !== undefined && firstOrdinal === undefined) firstOrdinal = envelope.ordinal
      const at = envelope.at
      touch(at)
      if (envelope.type === "session_meta") {
        const instructions = objectField(record, "payload")
        if (instructions !== undefined) {
          const text = baseInstructionsOf(instructions)
          if (text !== undefined) window.setBaseInstructions(text)
        }
        return
      }
      if (envelope.type === "token_usage_record") {
        const reading = readUsageRecord(envelope.payload)
        if (reading === undefined) return
        if (!tally.observe(reading)) return
        noteUsage(reading, envelope.payload, at, envelope.ordinal ?? 0)
        return
      }
      if (envelope.type === "event_msg") {
        handleEvent(envelope, at)
        return
      }
      if (envelope.type === "turn_context") {
        stats.noteTurnContext()
        const turn = ensureTurn(stringField(envelope.payload, "turn_id"), at)
        const model = stringField(envelope.payload, "model")
        if (model !== undefined && turn.model === undefined) turn.model = model
        return
      }
      if (envelope.type === "world_state") {
        stats.noteWorldState()
        window.applyWorldState(envelope.payload)
        return
      }
      if (envelope.type === "compacted") {
        handleCompacted(envelope, at)
        return
      }
      if (envelope.type === "inter_agent_communication_metadata") {
        stats.noteInterAgentMessage()
        return
      }
      if (envelope.type === "response_item") {
        handleResponseItem(envelope, at)
        return
      }
      stats.noteUnclassifiedRecord()
    })
    stats.noteStream(stream)
  }

  stats.noteCompactionUnresolved(pendingAfter.length)
  pendingAfter.length = 0
  closeTurn()
  stats.noteToolCalls(turns)

  const facts: SessionFacts = {
    path,
    segmentFiles: files.map((file) => file.path),
    childFiles: planned.childFiles,
    childThreadIds: planned.childThreadIds,
    parentThreadId: thread.parentThreadId,
    subagentHistoryStartOrdinal: planned.meta?.subagentHistoryStartOrdinal,
    forkedFrom: planned.forkedFrom,
    chainBroken: thread.chain.broken,
    chainMissingBase: thread.chain.missingBase,
    firstOrdinal,
    subagentThreads: [...subagentThreads],
    turns,
    requests: tally.requests,
    duplicateResponses: tally.duplicateResponses,
    windowSize: window.windowSize,
    sawToolSchemas: window.sawToolSchemas,
    sawPermissionsHash: window.sawPermissionsHash,
    reasoningRecords: window.reasoningCount,
    encryptedReasoningRecords: window.encryptedReasoningRecords,
    elapsedMs: Date.now() - started,
  }
  const finished = stats.finalize(facts)

  const firstAt = Number.isFinite(createdAt) ? createdAt : (turns[0]?.startedAt ?? 0)
  const session: Session = {
    id: planned.id,
    source: "codex",
    workdir: planned.workdir,
    createdAt: firstAt,
    updatedAt: updatedAt === 0 ? firstAt : updatedAt,
    turns,
    segments: planned.segments,
    dataQuality: finished.dataQuality,
  }
  return { session, stats: finished.stats }
}

/** Read base_instructions.text from a session_meta payload. */
function baseInstructionsOf(payload: JsonObject): string | undefined {
  const base = payload["base_instructions"]
  if (typeof base === "string") return base
  if (!isObject(base)) return undefined
  const text = base["text"]
  return typeof text === "string" ? text : undefined
}
