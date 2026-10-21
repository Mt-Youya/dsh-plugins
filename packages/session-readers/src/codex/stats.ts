/**
 * Accounting for one Codex session read.
 *
 * Everything the probe prints that the IR has no field for, plus the
 * dataQuality vocabulary that says what this adapter could not tell. The parser
 * (session.ts) owns the record flow; this file owns the numbers, so the flow
 * stays readable and the accounting is testable through a session read.
 *
 * @see docs/IR.md (dataQuality 的词表)
 */

import type { Session, Turn } from "@cyrus/dsh-session-contract"
import type { AttributionReport } from "./attribution.ts"
import { CODEX_CALIPER_TOKEN } from "./calibration.ts"
import {
  lastUsageSignatureOf,
  readCumulativeInput,
  readTokenCountInfo,
  usageSignatureOf,
  type UsageReading,
} from "./usage.ts"
import type { JsonObject } from "./records.ts"

/** Everything the probe wants to print that the IR has no field for. */
export interface CodexReadStats {
  /** The file the caller named. */
  path: string
  /** Segment files parsed, in history order. */
  segmentFiles: string[]
  /** Subagent rollout files linked to this session. */
  childFiles: string[]
  /** Lines read across all segment files. */
  lines: number
  /** Lines that decoded to records. */
  parsed: number
  /** Lines that did not decode; a non-zero value is a real defect. */
  invalid: number
  /** zstd frames decompressed (0 for plaintext files). */
  frames: number
  /** Decompressed bytes read. */
  bytes: number
  /** Distinct responses, i.e. distinct token_usage_record.response_id values. */
  requests: number
  /** Usage records dropped as repeated response ids. */
  duplicateResponseIds: number
  /** turn_context records seen. */
  turnContexts: number
  /** Turns emitted. */
  turns: number
  /** Turns that never logged usage (aborted or truncated). */
  turnsWithoutUsage: number
  /** Sum of usage.input_tokens: the one legal total. */
  exactInputTokens: number
  /** Sum of input - cached: the IR Usage.input figure. */
  nonCachedInputTokens: number
  /** Sum of cached_input_tokens: a subset of the above, never added to it. */
  cachedInputTokens: number
  /** Sum of output_tokens. */
  outputTokens: number
  /** Sum of input + cached: the 1.961x trap. */
  naiveCachedAddedTokens: number
  /** Sum of token_count.info.last_token_usage.input_tokens. */
  lastTokenUsageTokens: number
  /** token_count events whose last_token_usage repeats a usage object verbatim. */
  lastTokenUsageEchoes: number
  /** token_count events whose last_token_usage.input matches some usage record's input. */
  lastTokenUsageInputMatches: number
  /** token_count events seen. */
  tokenCounts: number
  /** Sum of thread_token_usage.input_tokens: the 402.8x trap. */
  threadCumulativeTokens: number
  /** Sum of turn_token_usage.input_tokens: the 20.5x trap. */
  turnCumulativeTokens: number
  /** Tool calls emitted. */
  toolCalls: number
  /** Tool calls paired with a result. */
  pairedToolCalls: number
  /** Results that had no call in their turn. */
  orphanToolResults: number
  /** Compaction boundaries. */
  compactions: number
  /** Boundaries whose exact prompt size actually dropped. */
  compactionDrops: number
  /** Reasoning records seen. */
  reasoningRecords: number
  /** Reasoning records whose content is encrypted. */
  encryptedReasoningRecords: number
  /** model_context_window as token_count stated it, when stated. */
  windowSize?: number
  /** Subagent thread ids linked from this session's turns. */
  subagentThreads: string[]
  /** Whether any real tool schema was logged. */
  sawToolSchemas: boolean
  /** Sum of every turn's slices before reconciliation. */
  rawAttributionTokens: number
  /** Per-turn raw slice totals, index-aligned with session.turns. */
  rawByTurn: number[]
  /** Per-turn residual tokens, aligned with session.turns (0 when absent). */
  residualByTurn: number[]
  /** Per-turn reconcile factor, aligned with session.turns (1 when none). */
  factorByTurn: number[]
  /** Turns whose parts were scaled to the exact total. */
  reconciledTurns: number
  /** Turns whose gap was reported as residual instead. */
  residualTurns: number
  /** Turns whose tool-result estimate alone exceeds the whole exact prompt. */
  toolResultsAboveWindow: number
  /** Wall-clock milliseconds spent on this session. */
  elapsedMs: number
}

/** A parsed session plus the counters behind it. */
export interface CodexReadResult {
  session: Session
  stats: CodexReadStats
}

/** What the parser hands over once the record stream is exhausted. */
export interface SessionFacts {
  path: string
  /** Segment files parsed, in history order. */
  segmentFiles: string[]
  childFiles: string[]
  /** Thread ids of the subagent rollouts linked into Session.segments. */
  childThreadIds: string[]
  parentThreadId?: string
  subagentHistoryStartOrdinal?: number
  forkedFrom?: string
  /** Files of this thread that no history_base link reached. */
  chainBroken: number
  /** 1 when the chain has no first segment, i.e. earlier history is gone. */
  chainMissingBase: number
  firstOrdinal?: number
  /** Subagent thread ids seen in this thread's turns. */
  subagentThreads: string[]
  turns: Turn[]
  /** Distinct responses read. */
  requests: number
  /** Repeated response ids dropped. */
  duplicateResponses: number
  windowSize?: number
  sawToolSchemas: boolean
  sawPermissionsHash: boolean
  reasoningRecords: number
  encryptedReasoningRecords: number
  elapsedMs: number
}

/** Mutable counters for one session read. */
export class SessionStats {
  private lines = 0
  private parsed = 0
  private invalid = 0
  private frames = 0
  private bytes = 0
  private exactInputTokens = 0
  private nonCachedInputTokens = 0
  private cachedInputTokens = 0
  private outputTokens = 0
  private naiveCachedAddedTokens = 0
  private lastTokenUsageTokens = 0
  private lastTokenUsageEchoes = 0
  private lastTokenUsageInputMatches = 0
  private tokenCounts = 0
  private threadCumulativeTokens = 0
  private turnCumulativeTokens = 0
  private turnContexts = 0
  private unclassified = 0
  private interAgentRecords = 0
  private worldStates = 0
  private compactions = 0
  private compactionDrops = 0
  private compactionUnresolved = 0
  private abortedTurns = 0
  private turnsWithoutUsage = 0
  private toolCalls = 0
  private pairedToolCalls = 0
  private orphanToolResults = 0
  private rawAttributionTokens = 0
  private reconciledTurns = 0
  private residualTurns = 0
  private toolResultsAboveWindow = 0
  private overCountedTurns = 0
  private worstResidualShare = 0
  private worstOverCountShare = 0
  private worstFactor = 1
  private readonly usageJson = new Set<string>()
  private readonly usageInputs = new Set<number>()
  private readonly rawByTurn: number[] = []
  private readonly residualByTurn: number[] = []
  private readonly factorByTurn: number[] = []

  /** Fold one file's stream counters in. */
  noteStream(stream: { lines: number; parsed: number; invalid: number; frames: number; bytes: number }): void {
    this.lines += stream.lines
    this.parsed += stream.parsed
    this.invalid += stream.invalid
    this.frames += stream.frames
    this.bytes += stream.bytes
  }

  /** Fold one response's usage in; the caller has already de-duplicated it. */
  noteUsage(reading: UsageReading, payload: JsonObject): void {
    this.exactInputTokens += reading.input
    this.nonCachedInputTokens += reading.nonCachedInput
    this.cachedInputTokens += reading.cachedInput
    this.outputTokens += reading.output
    this.naiveCachedAddedTokens += reading.input + reading.cachedInput
    this.threadCumulativeTokens += readCumulativeInput(payload, "thread_token_usage") ?? 0
    this.turnCumulativeTokens += readCumulativeInput(payload, "turn_token_usage") ?? 0
    this.usageInputs.add(reading.input)
    const json = usageSignatureOf(payload)
    if (json !== undefined) this.usageJson.add(json)
  }

  /** Fold one token_count event in: it may echo a usage record verbatim. */
  noteTokenCount(payload: JsonObject): void {
    this.tokenCounts += 1
    const info = readTokenCountInfo(payload)
    if (info?.lastInput !== undefined) {
      this.lastTokenUsageTokens += info.lastInput
      if (this.usageInputs.has(info.lastInput)) this.lastTokenUsageInputMatches += 1
    }
    const lastSignature = lastUsageSignatureOf(payload)
    if (lastSignature !== undefined && this.usageJson.has(lastSignature)) this.lastTokenUsageEchoes += 1
  }

  noteTurnContext(): void {
    this.turnContexts += 1
  }

  noteWorldState(): void {
    this.worldStates += 1
  }

  noteInterAgentMessage(): void {
    this.interAgentRecords += 1
  }

  noteUnclassifiedRecord(): void {
    this.unclassified += 1
  }

  noteAbortedTurn(): void {
    this.abortedTurns += 1
  }

  noteCompaction(): void {
    this.compactions += 1
  }

  noteCompactionDrop(): void {
    this.compactionDrops += 1
  }

  noteCompactionUnresolved(count = 1): void {
    this.compactionUnresolved += count
  }

  /** Count results that had no call; the turn may still be discarded as empty. */
  noteOrphanResults(count: number): void {
    this.orphanToolResults += count
  }

  /** Fold one finished turn and its reconciliation in. */
  noteTurn(input: { usageLogged: boolean; report: AttributionReport; peakContext: number }): void {
    const { report, peakContext } = input
    if (!input.usageLogged) this.turnsWithoutUsage += 1
    this.rawByTurn.push(report.decision.rawTokens)
    this.rawAttributionTokens += report.decision.rawTokens
    this.residualByTurn.push(report.decision.residual?.tokens ?? 0)
    this.factorByTurn.push(report.decision.factor)
    if (report.decision.scaled) {
      this.reconciledTurns += 1
      if (Math.abs(report.decision.factor - 1) > Math.abs(this.worstFactor - 1))
        this.worstFactor = report.decision.factor
    }
    // Codex logs full tool output (largest single output: 3.49 MB) while the
    // prompt that carried it peaked at 303 K tokens, so a turn's tool-result
    // estimate can exceed the whole window. That is a measurement defect of the
    // estimate, not unknown content, and it is counted instead of being capped.
    const tools = report.attribution.parts.find((slice) => slice.part === "tool-results")
    if (tools !== undefined && peakContext > 0 && tools.measure.tokens > peakContext) {
      this.toolResultsAboveWindow += 1
    }
    if (report.decision.residual !== undefined) {
      this.residualTurns += 1
      const residual = report.decision.residual.tokens
      if (residual < 0) {
        this.overCountedTurns += 1
        if (peakContext > 0) {
          const share = -residual / peakContext
          if (share > this.worstOverCountShare) this.worstOverCountShare = share
        }
      } else if (peakContext > 0) {
        const share = residual / peakContext
        if (share > this.worstResidualShare) this.worstResidualShare = share
      }
    }
  }

  /** Count the pairs among the emitted calls once the session is complete. */
  noteToolCalls(turns: readonly Turn[]): void {
    for (const turn of turns) {
      for (const call of turn.toolCalls) {
        this.toolCalls += 1
        if (call.endedAt !== undefined) this.pairedToolCalls += 1
      }
    }
  }

  /** Build the session's dataQuality tokens and its stats snapshot. */
  finalize(facts: SessionFacts): { dataQuality: string[]; stats: CodexReadStats } {
    const quality = new Set<string>()
    if (facts.chainBroken > 0) quality.add("segment-chain-broken:files=" + facts.chainBroken)
    if (facts.chainMissingBase > 0) quality.add("history-base-missing")
    if (facts.firstOrdinal !== undefined && facts.firstOrdinal > 0) {
      quality.add("partial-history:first-ordinal=" + facts.firstOrdinal)
    }
    quality.add(CODEX_CALIPER_TOKEN)
    if (facts.parentThreadId !== undefined) {
      quality.add("subagent-thread")
      quality.add("parent-thread=" + facts.parentThreadId)
    }
    // The child's inherited history starts at a parent ordinal, but this adapter
    // does not trim the parent's messages out of the child's first turn. Say so
    // instead of letting the extra context pass as the child's own input.
    if (facts.subagentHistoryStartOrdinal !== undefined) {
      quality.add("subagent-history-inherited:start=" + facts.subagentHistoryStartOrdinal)
    }
    if (facts.forkedFrom !== undefined) quality.add("forked-from=" + facts.forkedFrom)
    if (facts.childThreadIds.length > 0 && facts.parentThreadId === undefined) {
      const unlinked = facts.childThreadIds.filter((id) => !facts.subagentThreads.includes(id))
      if (unlinked.length > 0) quality.add("subagent-thread-unlinked:count=" + unlinked.length)
    }
    if (facts.encryptedReasoningRecords > 0) quality.add("reasoning-encrypted:count=" + facts.encryptedReasoningRecords)
    if (facts.reasoningRecords > 0 && facts.encryptedReasoningRecords === 0) quality.add("reasoning-readable")
    if (facts.sawToolSchemas) quality.add("tool-definitions-partial")
    else quality.add("tool-definitions-missing")
    if (facts.sawPermissionsHash) quality.add("permissions-instructions-hash-only")
    if (this.worldStates > 0) quality.add("world-state-not-attributed:count=" + this.worldStates)
    if (this.compactions > 0) quality.add("compaction-replaced-history:count=" + this.compactions)
    if (this.compactionUnresolved > 0) quality.add("compaction-sizes-unresolved:count=" + this.compactionUnresolved)
    if (facts.requests === 0 && facts.turns.length > 0) quality.add("usage-records-missing")
    if (this.abortedTurns > 0) quality.add("turn-aborted:count=" + this.abortedTurns)
    if (this.turnsWithoutUsage > 0) quality.add("turn-without-usage:count=" + this.turnsWithoutUsage)
    if (this.residualTurns > 0) quality.add("attribution-residual:share=" + this.worstResidualShare.toFixed(2))
    if (this.overCountedTurns > 0) quality.add("attribution-over-counted:share=" + this.worstOverCountShare.toFixed(2))
    if (this.toolResultsAboveWindow > 0) quality.add("tool-output-above-window:count=" + this.toolResultsAboveWindow)
    if (this.reconciledTurns > 0) quality.add("attribution-reconciled:worst-factor=" + this.worstFactor.toFixed(3))
    if (this.unclassified > 0) quality.add("unclassified-records:count=" + this.unclassified)
    if (this.interAgentRecords > 0) quality.add("inter-agent-messages:count=" + this.interAgentRecords)

    const stats: CodexReadStats = {
      path: facts.path,
      segmentFiles: facts.segmentFiles,
      childFiles: facts.childFiles,
      lines: this.lines,
      parsed: this.parsed,
      invalid: this.invalid,
      frames: this.frames,
      bytes: this.bytes,
      requests: facts.requests,
      duplicateResponseIds: facts.duplicateResponses,
      turnContexts: this.turnContexts,
      turns: facts.turns.length,
      turnsWithoutUsage: this.turnsWithoutUsage,
      exactInputTokens: this.exactInputTokens,
      nonCachedInputTokens: this.nonCachedInputTokens,
      cachedInputTokens: this.cachedInputTokens,
      outputTokens: this.outputTokens,
      naiveCachedAddedTokens: this.naiveCachedAddedTokens,
      lastTokenUsageTokens: this.lastTokenUsageTokens,
      lastTokenUsageEchoes: this.lastTokenUsageEchoes,
      lastTokenUsageInputMatches: this.lastTokenUsageInputMatches,
      tokenCounts: this.tokenCounts,
      threadCumulativeTokens: this.threadCumulativeTokens,
      turnCumulativeTokens: this.turnCumulativeTokens,
      toolCalls: this.toolCalls,
      pairedToolCalls: this.pairedToolCalls,
      orphanToolResults: this.orphanToolResults,
      compactions: this.compactions,
      compactionDrops: this.compactionDrops,
      reasoningRecords: facts.reasoningRecords,
      encryptedReasoningRecords: facts.encryptedReasoningRecords,
      windowSize: facts.windowSize,
      subagentThreads: facts.subagentThreads,
      sawToolSchemas: facts.sawToolSchemas,
      rawAttributionTokens: this.rawAttributionTokens,
      rawByTurn: this.rawByTurn,
      residualByTurn: this.residualByTurn,
      factorByTurn: this.factorByTurn,
      reconciledTurns: this.reconciledTurns,
      residualTurns: this.residualTurns,
      toolResultsAboveWindow: this.toolResultsAboveWindow,
      elapsedMs: facts.elapsedMs,
    }
    return { dataQuality: [...quality].sort(), stats }
  }
}
