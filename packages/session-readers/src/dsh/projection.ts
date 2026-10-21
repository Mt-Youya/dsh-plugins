/**
 * Reading the harness's own per-session projection checkpoint.
 *
 * DSH folds every durable session log into projections and checkpoints them
 * under `~/.dsh/storages/session_projcache/sessions/<id>.json`. Those rows are
 * *the harness's own answer* to "what was in the prompt", computed with the
 * harness's tokenizer and its own view of the surface — a strictly better basis
 * than counting characters here. The log stays authoritative: the cache can lag
 * after a crash but never runs ahead of committed events, so a row whose
 * `seq` is behind the log's last `seq` is treated as stale and ignored.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { arrayField, isObject, numberField, objectField, type JsonObject } from "./records.ts"

/** One projection row: its schema version, the log seq it describes, and the value. */
export interface ProjectionRow {
  ver: number
  seq: number
  val: JsonObject
}

/** One request as `contextTimeline` recorded it: the harness's own slice math. */
export interface ProjectionRequest {
  /** Log seq of the `assistant/message` this request produced. */
  seq: number
  time: number
  turn: number
  step: number
  /** Prompt size the provider counted for this request. */
  prompt: number
  /** Sum of the part counters below. Always `<= prompt`; the gap is real. */
  total: number
  system: number
  tools: number
  user: number
  /** Injected reminders. */
  inject: number
  /** Skill listings folded into the request. */
  skill: number
  assistant: number
  tool: number
  cacheRead: number
  output: number
  /** Wall-clock milliseconds the request was in flight. */
  activeMs: number
}

/** The projection rows this adapter reads. Everything else is ignored. */
export interface DshProjection {
  /** Schema version of the checkpoint document. */
  version: number
  /** Highest `seq` across every row: the log position this checkpoint describes. */
  maxSeq: number
  /** Per-request slice math, oldest first. */
  requests: ProjectionRequest[]
  /** Pressure at the checkpoint: `pressureTokens` is the exact prompt size. */
  pressure?: { surfaceTokens: number; contextWindow: number; pressureTokens: number }
  /** Coarse split: system, tool definitions, and the message surface. */
  breakdown?: { systemTokens: number; toolsTokens: number; messageTokens: number }
  /** Whole-session clocks and counts. */
  stats?: {
    turns: number
    steps: number
    llmMs: number
    toolMs: number
    ttftMs: number
    decodeMs: number
    decodeTokens: number
  }
}

/** Why a session has no usable projection. */
export type ProjectionAbsence = "missing" | "unreadable" | "no-rows"

/** Result of looking a session's projection up. */
export interface ProjectionLookup {
  projection?: DshProjection
  absent?: ProjectionAbsence
}

/** Read one row, tolerating any shape the checkpoint uses. */
function rowOf(rows: JsonObject, key: string): ProjectionRow | undefined {
  const row = objectField(rows, key)
  if (row === undefined) return undefined
  const val = objectField(row, "val")
  if (val === undefined) return undefined
  return { ver: numberField(row, "ver") ?? 0, seq: numberField(row, "seq") ?? -1, val }
}

function numberOr(value: number | undefined): number {
  return value ?? 0
}

/** Convert one `contextTimeline.requests[]` entry. */
function toRequest(value: unknown): ProjectionRequest | undefined {
  if (!isObject(value)) return undefined
  const seq = numberField(value, "seq")
  if (seq === undefined) return undefined
  return {
    seq,
    time: numberOr(numberField(value, "time")),
    turn: numberOr(numberField(value, "turn")),
    step: numberOr(numberField(value, "step")),
    prompt: numberOr(numberField(value, "prompt")),
    total: numberOr(numberField(value, "total")),
    system: numberOr(numberField(value, "system")),
    tools: numberOr(numberField(value, "tools")),
    user: numberOr(numberField(value, "user")),
    inject: numberOr(numberField(value, "inject")),
    skill: numberOr(numberField(value, "skill")),
    assistant: numberOr(numberField(value, "assistant")),
    tool: numberOr(numberField(value, "tool")),
    cacheRead: numberOr(numberField(value, "cacheRead")),
    output: numberOr(numberField(value, "output")),
    activeMs: numberOr(numberField(value, "activeMs")),
  }
}

/**
 * Parse a checkpoint document into the rows this adapter uses.
 * @param document - parsed JSON of one `session_projcache/sessions/<id>.json`.
 */
export function parseProjection(document: unknown): ProjectionLookup {
  if (!isObject(document)) return { absent: "unreadable" }
  const record = objectField(document, "record")
  const rows = objectField(record, "rows")
  if (rows === undefined) return { absent: "no-rows" }

  let maxSeq = -1
  for (const key of Object.keys(rows)) {
    const row = objectField(rows, key)
    const seq = numberField(row, "seq") ?? -1
    if (seq > maxSeq) maxSeq = seq
  }

  const requests: ProjectionRequest[] = []
  const timeline = rowOf(rows, "contextTimeline")
  if (timeline !== undefined) {
    for (const entry of arrayField(timeline.val, "requests") ?? []) {
      const request = toRequest(entry)
      if (request !== undefined) requests.push(request)
    }
  }

  let pressure: DshProjection["pressure"]
  const pressureRow = rowOf(rows, "contextPressure")
  if (pressureRow !== undefined) {
    pressure = {
      surfaceTokens: numberOr(numberField(pressureRow.val, "surfaceTokens")),
      contextWindow: numberOr(numberField(pressureRow.val, "contextWindow")),
      pressureTokens: numberOr(numberField(pressureRow.val, "pressureTokens")),
    }
  }

  let breakdown: DshProjection["breakdown"]
  const breakdownRow = rowOf(rows, "contextBreakdown")
  if (breakdownRow !== undefined) {
    const split = objectField(breakdownRow.val, "breakdown")
    if (split !== undefined) {
      breakdown = {
        systemTokens: numberOr(numberField(split, "systemTokens")),
        toolsTokens: numberOr(numberField(split, "toolsTokens")),
        messageTokens: numberOr(numberField(split, "messageTokens")),
      }
    }
  }

  let stats: DshProjection["stats"]
  const statsRow = rowOf(rows, "sessionStats")
  if (statsRow !== undefined) {
    stats = {
      turns: numberOr(numberField(statsRow.val, "turns")),
      steps: numberOr(numberField(statsRow.val, "steps")),
      llmMs: numberOr(numberField(statsRow.val, "llmMs")),
      toolMs: numberOr(numberField(statsRow.val, "toolMs")),
      ttftMs: numberOr(numberField(statsRow.val, "ttftMs")),
      decodeMs: numberOr(numberField(statsRow.val, "decodeMs")),
      decodeTokens: numberOr(numberField(statsRow.val, "decodeTokens")),
    }
  }

  // A checkpoint whose rows carry no `seq` describes nothing: calling it stale
  // would blame a lagging cache for what is really an empty document.
  if (maxSeq < 0) return { absent: "no-rows" }

  return {
    projection: {
      version: numberOr(numberField(document, "version")),
      maxSeq,
      requests,
      ...(pressure === undefined ? {} : { pressure }),
      ...(breakdown === undefined ? {} : { breakdown }),
      ...(stats === undefined ? {} : { stats }),
    },
  }
}

/**
 * Look a session's checkpoint up on disk.
 *
 * Read-only and silent on failure: a missing checkpoint is an ordinary state
 * (a session that was never folded, or one from another machine), not an error.
 * @param sessionId - session id, which is also the checkpoint's file name.
 * @param root - the `session_projcache/sessions` directory.
 */
export function readProjection(sessionId: string, root: string): ProjectionLookup {
  let raw: string
  try {
    raw = readFileSync(join(root, `${sessionId}.json`), "utf8")
  } catch {
    return { absent: "missing" }
  }
  let document: unknown
  try {
    document = JSON.parse(raw)
  } catch {
    return { absent: "unreadable" }
  }
  return parseProjection(document)
}

/**
 * Whether a checkpoint still describes the log it was folded from.
 *
 * The cache may lag behind the log (a crash between the log write and the
 * checkpoint write) but never lead it, so `maxSeq >= lastLogSeq` is the whole
 * test. A stale checkpoint is not partially usable: its request list would
 * silently drop the newest turns.
 * @param projection - parsed checkpoint.
 * @param lastLogSeq - the highest `seq` in the log.
 */
export function isProjectionFresh(projection: DshProjection, lastLogSeq: number): boolean {
  return projection.maxSeq >= lastLogSeq
}
