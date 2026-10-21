/**
 * The handoff contract: the prepared brief, the apply/status answers and the
 * two request bodies the Host decodes.
 *
 * @module @cyrus/dsh-session-contract/guards/handoff
 */

import { CONTEXT_SOURCES } from "../types.ts"
import type { ContextSource } from "../types.ts"
import { isSafeId } from "./ids.ts"
import { isNumber, isRecord, isStringArray } from "./shared.ts"
import { isContextSource } from "./sources.ts"

/** One section of a prepared brief, as the panel renders it. */
export interface BriefSectionValue {
  title: string
  lines: string[]
  /** True when the transcript had no evidence for this section. */
  empty: boolean
}

/** `/handoff/prepare` body: the brief plus what it was extracted from. */
export interface BriefValue {
  source: ContextSource
  sessionId: string
  workdir: string
  title?: string
  turns: number
  /** Directory the panel offers for the new session (the source's workdir). */
  defaultCwd: string
  /** The brief text that would be delivered. */
  brief: string
  chars: number
  sections: BriefSectionValue[]
  fileCount: number
  decisionCount: number
  openCount: number
  commandCount: number
}

/** Where a handoff stands. Only `succeeded`/`failed` are terminal. */
export type HandoffState = "delivered" | "running" | "succeeded" | "failed"

/** `/handoff/apply` body. */
export interface HandoffApplyValue {
  sessionId: string
  /** Always `delivered`: the RPC only proves the brief was queued. */
  state: "delivered"
  pollAfterMs: number
}

/** `/handoff/status` body. */
export interface HandoffStatusValue {
  sessionId: string
  state: HandoffState
  /** Failure code (e.g. `MISSING_CREDENTIAL`) or the turn/end reason. */
  reason?: string
  /** `seq` of the observed `turn/end`, the evidence for a terminal state. */
  seq?: number
  /** Human sentence: what happened and what to do about it. */
  detail?: string
  elapsedMs: number
}

/** `/handoff/prepare` request. */
export interface HandoffPrepareRequest {
  source: ContextSource
  id: string
}

/** `/handoff/apply` request. */
export interface HandoffApplyRequest extends HandoffPrepareRequest {
  cwd: string
  brief: string
  sessionId?: string
}

function readSourceId(body: unknown): HandoffPrepareRequest | undefined {
  if (!isRecord(body)) return undefined
  const source = body["source"]
  const id = body["id"]
  if (!isContextSource(source)) return undefined
  if (typeof id !== "string" || !isSafeId(id)) return undefined
  return { source, id }
}

/**
 * Decode a `/handoff/prepare` body.
 * @param body - parsed JSON.
 * @returns the request, or undefined when a field is missing or malformed.
 */
export function parseHandoffPrepare(body: unknown): HandoffPrepareRequest | undefined {
  return readSourceId(body)
}

/**
 * Decode a `/handoff/apply` body.
 *
 * `cwd` is mandatory and must be absolute: the Host inherits its own launch
 * directory when it is omitted, which silently files the session under the wrong
 * bucket (docs/HANDOFF.md).
 * @param body - parsed JSON.
 * @returns the request, or undefined when malformed.
 */
export function parseHandoffApply(body: unknown): HandoffApplyRequest | undefined {
  const base = readSourceId(body)
  if (base === undefined) return undefined
  if (!isRecord(body)) return undefined
  const cwd = body["cwd"]
  const brief = body["brief"]
  if (typeof cwd !== "string" || cwd.trim() === "" || !cwd.trim().startsWith("/")) return undefined
  if (typeof brief !== "string" || brief.trim() === "" || brief.length > 8_000) return undefined
  const sessionId = body["sessionId"]
  if (sessionId !== undefined && (typeof sessionId !== "string" || !isSafeId(sessionId))) return undefined
  const request: HandoffApplyRequest = { ...base, cwd: cwd.trim(), brief }
  if (typeof sessionId === "string") request.sessionId = sessionId
  return request
}

/**
 * Whether a wire value is a well-formed brief answer.
 * @param value - any decoded JSON value.
 */
export function isBriefValue(value: unknown): value is BriefValue {
  if (!isRecord(value)) return false
  if (!CONTEXT_SOURCES.includes(value.source as ContextSource)) return false
  if (typeof value.sessionId !== "string" || typeof value.workdir !== "string") return false
  if (typeof value.brief !== "string" || typeof value.defaultCwd !== "string") return false
  if (!isNumber(value.chars) || !isNumber(value.turns)) return false
  if (!Array.isArray(value.sections)) return false
  return value.sections.every(
    (section) =>
      isRecord(section) &&
      typeof section.title === "string" &&
      isStringArray(section.lines) &&
      typeof section.empty === "boolean"
  )
}

/**
 * Whether a wire value is a well-formed handoff apply answer.
 * @param value - any decoded JSON value.
 */
export function isHandoffApplyValue(value: unknown): value is HandoffApplyValue {
  if (!isRecord(value)) return false
  return typeof value.sessionId === "string" && value.state === "delivered" && isNumber(value.pollAfterMs)
}

/**
 * Whether a wire value is a well-formed handoff status answer.
 * @param value - any decoded JSON value.
 */
export function isHandoffStatusValue(value: unknown): value is HandoffStatusValue {
  if (!isRecord(value)) return false
  if (typeof value.sessionId !== "string") return false
  if (
    value.state !== "delivered" &&
    value.state !== "running" &&
    value.state !== "succeeded" &&
    value.state !== "failed"
  )
    return false
  if (!isNumber(value.elapsedMs)) return false
  if (value.reason !== undefined && typeof value.reason !== "string") return false
  if (value.detail !== undefined && typeof value.detail !== "string") return false
  if (value.seq !== undefined && !isNumber(value.seq)) return false
  return true
}
