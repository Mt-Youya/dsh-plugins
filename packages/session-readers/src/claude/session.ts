/**
 * Session assembly for Claude Code transcripts.
 *
 * The streaming pass lives in ./read.ts; this module turns its output into the
 * IR `Session`: title, workdir, physical segments (subagent transcripts), the
 * data-quality vocabulary and the probe counters. Nothing here re-reads a file.
 *
 * @see docs/IR.md
 */

import { basename } from "node:path"
import type { Session } from "@cyrus/dsh-session-contract"
import { readTranscript } from "./read.ts"
import { listSubagentFiles, resolveSubagentFile } from "./subagents.ts"
export interface ClaudeReadStats {
  path: string
  /** Physical lines in the file. */
  lines: number
  /** Lines that decoded into records. */
  parsed: number
  /** Lines that did not decode; a non-zero value is a real defect. */
  invalid: number
  /** Records left after uuid de-duplication. */
  deduped: number
  /** Rows dropped as resume/fork copies. */
  duplicates: number
  /** Distinct `message.id` values seen. */
  messageIds: number
  /** Message ids whose repeated usage disagreed. */
  inconsistentUsage: number
  /** Sum of every assistant record's context size: the ~3.3x trap. */
  naiveContextTokens: number
  /** Sum over distinct message ids: the normalized number. */
  normalizedContextTokens: number
  /** Tool calls paired with a result. */
  pairedToolCalls: number
  /** Tool results that had no call in their turn. */
  orphanToolResults: number
  /** Compaction boundaries found. */
  compactions: number
  /** Subagent transcripts this session links to. */
  subagentFiles: string[]
  /** Turns whose slices were scaled onto their exact total. */
  scaledTurns: number
  /** Turns that kept an explicit `residual` instead of being scaled. */
  residualTurns: number
  /** Turns missing a whole category (no snapshot, stale snapshot, no usage). */
  structuralGapTurns: number
  /** Must be 0: negative residual without a structural gap means a broken rule. */
  overCountedWithoutGap: number
  /** Sum of every turn's slices before reconciliation to usage. */
  rawAttributionTokens: number
  /** Per-turn raw slice totals, index-aligned with `session.turns`. */
  rawByTurn: number[]
  /** Wall-clock milliseconds spent on this file. */
  elapsedMs: number
}

/** A parsed session plus the counters behind it. */
export interface ClaudeReadResult {
  session: Session
  stats: ClaudeReadStats
}

/** Options for {@link readClaudeSession}. */
export interface ClaudeReadOptions {
  /** Resolve `agent-<id>.jsonl` siblings into `Session.segments`. Default true. */
  includeSubagents?: boolean
}

/**
 * Largest context any single request can plausibly have had.
 *
 * Some subagent transcripts log `cache_read_input_tokens` in the millions for
 * one request (see `agent-aef853762a830a8fb.jsonl`: 2,595,574 tokens). The
 * number is copied verbatim — it is what the log says — but a turn above this
 * ceiling is flagged instead of being presented as a real window.
 */

/**
 * Parse one Claude session file.
 *
 * Subagent transcripts are *not* merged into the turns: they are returned as
 * additional `Session.segments` and referenced by `Turn.subagents`, which is
 * what the IR requires.
 * @param path - a `<project>/<sessionId>.jsonl` transcript.
 * @param options - see {@link ClaudeReadOptions}.
 */
export async function readClaudeSession(path: string, options: ClaudeReadOptions = {}): Promise<ClaudeReadResult> {
  const started = Date.now()
  const {
    turns,
    dataQuality,
    stream,
    duplicates,
    deduped,
    messageIds,
    inconsistentUsage,
    usageWithoutMessageId,
    naiveContextTokens,
    normalizedContextTokens,
    pairedToolCalls,
    orphanToolResults,
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
    window,
  } = await readTranscript(path)

  const subagentFiles: string[] = []
  if (options.includeSubagents !== false) {
    for (const agentId of subagentIds) {
      const file = resolveSubagentFile(path, agentId)
      if (file !== undefined) subagentFiles.push(file)
    }
    if (subagentFiles.length === 0 && subagentIds.size === 0) {
      for (const file of listSubagentFiles(path)) subagentFiles.push(file)
    }
  }

  if (duplicates > 0) dataQuality.add("uuid-duplicates-dropped")
  if (inconsistentUsage > 0) dataQuality.add("usage-inconsistent-across-blocks")
  if (usageWithoutMessageId > 0) dataQuality.add("usage-without-message-id")
  if (!window.sawSnapshot) dataQuality.add("prompt-snapshot-missing")
  if (window.reusedSnapshotTurns > 0) dataQuality.add("prompt-snapshot-carried-forward")
  if (window.staleSnapshotTurns2 > 0) {
    dataQuality.add(`prompt-snapshot-stale-tools:turns=${window.staleSnapshotTurns2}`)
  }
  if (sidechainFile) dataQuality.add("sidechain-transcript")
  if (sidechainRecords > 0) dataQuality.add("sidechain-records-excluded")
  if (compactions > 0) dataQuality.add("compaction-summary-continues-history")
  if (prefixOverruns.length > 0) {
    dataQuality.add(
      `compaction-post-tokens-exclude-prefix:count=${prefixOverruns.length}:first=${prefixOverruns[0] ?? ""}`
    )
  }

  const attributed = turns.reduce((sum, turn) => {
    let tokens = 0
    for (const slice of turn.attribution.parts) tokens += slice.measure.tokens
    return sum + tokens
  }, 0)
  const totalContext = turns.reduce((sum, turn) => sum + turn.attribution.total.tokens, 0)
  void attributed
  if (window.scaledTurnCount > 0 && Math.abs(window.worstReconciliation - 1) > 0.05) {
    dataQuality.add(`attribution-reconciled:worst-factor=${window.worstReconciliation.toFixed(3)}`)
  }
  if (window.worstResidual > 0) {
    // The share a view must paint as unknown rather than spread over the rest.
    dataQuality.add(`attribution-residual:share=${window.worstResidual.toFixed(2)}`)
  }
  if (window.worstOverCount > 0) {
    // The opposite failure: the calipers claimed more than the request could hold.
    dataQuality.add(`attribution-over-counted:share=${window.worstOverCount.toFixed(2)}`)
  }

  const startedAt = Number.isFinite(createdAt) ? createdAt : (turns[0]?.startedAt ?? 0)
  const session: Session = {
    id: sessionId ?? basename(path, ".jsonl"),
    source: "claude",
    workdir: workdir ?? "",
    createdAt: startedAt,
    updatedAt: updatedAt === 0 ? startedAt : updatedAt,
    turns,
    segments: [path, ...subagentFiles],
    dataQuality: [...dataQuality].sort(),
  }
  if (title !== undefined) session.title = title

  return {
    session,
    stats: {
      path,
      lines: stream.lines,
      parsed: stream.parsed,
      invalid: stream.invalid,
      deduped,
      duplicates,
      messageIds,
      inconsistentUsage,
      naiveContextTokens,
      normalizedContextTokens,
      pairedToolCalls,
      orphanToolResults,
      scaledTurns: window.scaledTurnCount,
      residualTurns: window.residualTurnCount,
      structuralGapTurns: window.structuralGapTurnCount,
      overCountedWithoutGap: window.overCountedWithoutGap,
      rawAttributionTokens,
      rawByTurn,
      compactions,
      subagentFiles,
      elapsedMs: Date.now() - started,
    },
  }
}
