/**
 * One DSH session log assembled into the IR.
 *
 * The job here is *provenance*, not meaning: read the file, split it into its
 * Zstandard frames, parse the lines, find the checkpoint that describes it and
 * decide whether that checkpoint is still current. Everything about what the
 * events mean lives in {@link SessionFold}.
 *
 * A DSH session is a single append-only log of JSON lines split across many
 * frames, plus an optional projection checkpoint the harness folds from it.
 * Everything this adapter knows to be lossy is either normalized (multi-frame
 * decode, turn boundaries, tool pairing, usage arithmetic) or reported in
 * `Session.dataQuality` — never smoothed over.
 *
 * @see docs/PLAN.md (各来源的归一化红线 · DSH)
 * @see docs/IR.md (adapter 必须遵守)
 * @see docs/adr/0004-multiframe-zstd.md
 */

import { readFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { homedir } from "node:os"
import type { Session } from "@cyrus/dsh-session-contract"
import { SessionFold } from "./fold.ts"
import { decodeSessionLog, splitLogLines } from "./frames.ts"
import { isProjectionFresh, readProjection, type DshProjection, type ProjectionAbsence } from "./projection.ts"
import { parseLogLine, type LogEvent } from "./records.ts"
import { readSessionHeader } from "./session-meta.ts"

/** Where DSH keeps its projection checkpoints on this machine. */
export const DEFAULT_PROJECTION_ROOT = join(homedir(), ".dsh", "storages", "session_projcache", "sessions")

/** How well the checkpoint matched the log it was folded from. */
export type ProjectionStatus = "fresh" | "stale" | "missing" | "unreadable" | "no-rows"

/** Everything the probe wants to print that the IR has no field for. */
export interface DshReadStats {
  path: string
  /** Zstandard frames decoded. */
  frames: number
  /** Frames that were found but failed to decode. Must be 0 on a healthy log. */
  badFrames: number
  /** True when the final frame was incomplete and was dropped. */
  tornTail: boolean
  /** Bytes before the first frame magic. */
  leadingBytes: number
  /** JSON lines in the decoded plaintext. */
  lines: number
  /** Lines that decoded into an event envelope. */
  parsed: number
  /** Lines that did not decode; a non-zero value is a real defect. */
  invalid: number
  /** Highest `seq` in the log. */
  lastLogSeq: number
  /** Whether the projection could be used. */
  projectionStatus: ProjectionStatus
  /** Highest `seq` across the checkpoint's rows, when one was read. */
  projectionMaxSeq: number
  /** Per-request records the projection carried. */
  projectionRequests: number
  /** Model requests folded into turns. */
  requests: number
  /** Tool calls that found their result. */
  pairedToolCalls: number
  /** Tool results that named no call of this session. */
  orphanToolResults: number
  /** Compaction boundaries found. */
  compactions: number
  /** Distinct child sessions linked. */
  subagentLinks: number
  /** Turns whose slices came from the harness projection. */
  projectionTurns: number
  /** Turns that fell back to character counts. */
  estimateTurns: number
  /** Character-scaled turns (always 0 while projections are fresh). */
  scaledTurns: number
  /** Turns that kept an explicit `residual`. */
  residualTurns: number
  /** Must be 0: negative residual without a structural gap means a broken rule. */
  overCountedWithoutGap: number
  /** Projection requests whose category deltas went backwards. */
  negativeDeltaTurns: number
  /** Sum of every turn's slices before reconciliation. */
  rawAttributionTokens: number
  /** Per-turn raw slice totals, index-aligned with `session.turns`. */
  rawByTurn: number[]
  /** Wall-clock milliseconds spent on this file. */
  elapsedMs: number
}

/** A parsed session plus the counters behind it. */
export interface DshReadResult {
  session: Session
  stats: DshReadStats
}

/** Options for {@link readDshSession}. */
export interface DshReadOptions {
  /** Directory holding `<sessionId>.json` checkpoints. */
  projectionRoot?: string
  /**
   * Pre-read projection, bypassing the disk.
   *
   * Tests use this to exercise the fresh and stale paths without writing to
   * `~/.dsh`, which this plugin never does.
   */
  projection?: DshProjection | { absent: ProjectionAbsence }
}

/** Decode a log and parse its lines, counting everything that did not survive. */
function loadEvents(path: string): {
  decoded: ReturnType<typeof decodeSessionLog>
  lines: string[]
  events: LogEvent[]
  invalid: number
} {
  const decoded = decodeSessionLog(readFileSync(path))
  const lines = splitLogLines(decoded.text)
  const events: LogEvent[] = []
  let invalid = 0
  for (const line of lines) {
    const event = parseLogLine(line)
    if (event === undefined) invalid += 1
    else events.push(event)
  }
  return { decoded, lines, events, invalid }
}

/** Highest `seq` in one log. */
function lastSeqOf(events: readonly LogEvent[]): number {
  let lastLogSeq = -1
  for (const event of events) if (event.seq > lastLogSeq) lastLogSeq = event.seq
  return lastLogSeq
}

/**
 * Resolve the checkpoint that describes this log, or say why there is none.
 *
 * Freshness decides which basis every turn may use, and a stale checkpoint is
 * discarded whole rather than half-used: its request list would silently drop
 * the newest turns.
 */
function resolveProjection(
  path: string,
  sessionId: string | undefined,
  lastLogSeq: number,
  options: DshReadOptions
): { projection: DshProjection | undefined; status: ProjectionStatus } {
  const supplied = options.projection
  if (supplied !== undefined) {
    if ("absent" in supplied) {
      // A caller that injected an absence means "pretend the file is not there".
      return { projection: undefined, status: supplied.absent === "missing" ? "missing" : supplied.absent }
    }
    return isProjectionFresh(supplied, lastLogSeq)
      ? { projection: supplied, status: "fresh" }
      : { projection: undefined, status: "stale" }
  }
  const lookup = readProjection(sessionId ?? basename(dirname(path)), options.projectionRoot ?? DEFAULT_PROJECTION_ROOT)
  if (lookup.projection === undefined) {
    return { projection: undefined, status: lookup.absent ?? "missing" }
  }
  return isProjectionFresh(lookup.projection, lastLogSeq)
    ? { projection: lookup.projection, status: "fresh" }
    : { projection: undefined, status: "stale" }
}

/**
 * Parse one DSH session log into the IR.
 * @param path - a `<cwd bucket>/<sessionId>/session.v4.jsonl.zstd` file.
 * @param options - see {@link DshReadOptions}.
 */
export async function readDshSession(path: string, options: DshReadOptions = {}): Promise<DshReadResult> {
  const started = Date.now()
  const dataQuality = new Set<string>()

  const { decoded, lines, events, invalid } = loadEvents(path)
  if (decoded.tornTail) dataQuality.add("torn-final-frame-dropped")
  if (decoded.badFrames > 0) dataQuality.add(`bad-frames:${decoded.badFrames}`)
  if (decoded.leadingBytes > 0) dataQuality.add(`bytes-before-first-frame:${decoded.leadingBytes}`)
  if (invalid > 0) dataQuality.add(`invalid-lines:${invalid}`)

  const header = readSessionHeader(events[0])
  const headerVersion = header.version
  if (headerVersion !== undefined && headerVersion !== 4) dataQuality.add(`format-version:${headerVersion}`)

  const lastLogSeq = lastSeqOf(events)
  const resolved = resolveProjection(path, header.id, lastLogSeq, options)
  const projectionStatus = resolved.status
  let projection = resolved.projection
  const usable = projection !== undefined && projectionStatus === "fresh"
  if (!usable) {
    if (projectionStatus === "stale") dataQuality.add("projection-stale")
    else dataQuality.add(`projection-${projectionStatus}`)
    projection = undefined
  }

  const fold = new SessionFold({ projection, usable, dataQuality, header })
  fold.fold(events)

  if (!fold.sawTurnEvents) dataQuality.add("turn-events-absent")

  // A turn whose slices could not be measured at all is flagged once here
  // rather than guessed at inside the attribution.
  const estimateTurns = fold.window.estimateTurnCount
  if (estimateTurns > 0 && fold.turns.length > 0) {
    dataQuality.add(`attribution-estimated-turns:${estimateTurns}`)
  }
  if (fold.window.negativeDeltaTurns > 0) {
    dataQuality.add(`projection-delta-negative:${fold.window.negativeDeltaTurns}`)
  }
  if (fold.turns.some((turn) => turn.attribution.residual !== undefined)) dataQuality.add("attribution-residual")
  // A negative residual means the slices claimed more than the window held; the
  // rule that forbids it without a structural gap is asserted in the tests.
  if (fold.turns.some((turn) => (turn.attribution.residual?.tokens ?? 0) < 0)) {
    dataQuality.add("attribution-over-counted")
  }

  const session: Session = {
    id: fold.sessionId ?? basename(dirname(path)),
    source: "dsh",
    workdir: fold.workdir ?? "",
    createdAt: Number.isFinite(fold.createdAt) ? fold.createdAt : (fold.turns[0]?.startedAt ?? 0),
    updatedAt: fold.updatedAt === 0 ? (fold.turns.at(-1)?.endedAt ?? 0) : fold.updatedAt,
    turns: fold.turns,
    segments: [path],
    dataQuality: [...dataQuality],
  }
  if (fold.title !== undefined) session.title = fold.title

  const stats: DshReadStats = {
    path,
    frames: decoded.frames,
    badFrames: decoded.badFrames,
    tornTail: decoded.tornTail,
    leadingBytes: decoded.leadingBytes,
    lines: lines.length,
    parsed: events.length,
    invalid,
    lastLogSeq,
    projectionStatus,
    projectionMaxSeq: projection?.maxSeq ?? -1,
    projectionRequests: projection?.requests.length ?? 0,
    requests: fold.requests,
    pairedToolCalls: fold.ledger.paired,
    orphanToolResults: fold.ledger.orphans,
    compactions: fold.compactions,
    subagentLinks: fold.subagents.size,
    projectionTurns: fold.window.projectionTurnCount,
    estimateTurns: fold.window.estimateTurnCount,
    scaledTurns: fold.window.scaledTurnCount,
    residualTurns: fold.window.residualTurnCount,
    overCountedWithoutGap: fold.window.overCountedWithoutGap,
    negativeDeltaTurns: fold.window.negativeDeltaTurns,
    rawAttributionTokens: fold.rawAttributionTokens,
    rawByTurn: fold.rawByTurn,
    elapsedMs: Date.now() - started,
  }
  return { session, stats }
}
