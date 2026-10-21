/**
 * Guards for the session inventory views: one session's detail page, the
 * workdir roll-up and the session list.
 *
 * @module @cyrus/dsh-session-contract/guards/session
 */

import { CONTEXT_SOURCES } from "../types.ts"
import type { ContextSource, SessionDetail, SessionsValue, WorkdirsValue } from "../types.ts"
import { isNumber, isRecord, isStringArray } from "./shared.ts"
import { isTurn } from "./turns.ts"

/**
 * Whether a wire value is a well-formed session detail page.
 * @param value - any decoded JSON value.
 * @returns true when the pager fields and every turn pass their guards.
 */
export function isSessionDetail(value: unknown): value is SessionDetail {
  if (!isRecord(value)) return false
  if (!isNumber(value.turnCount) || !isNumber(value.offset) || !isNumber(value.limit)) return false
  const meta = value.meta
  if (!isRecord(meta) || typeof meta.cached !== "boolean" || !isNumber(meta.elapsedMs) || !isNumber(meta.bytes)) {
    return false
  }
  const session = value.session
  if (!isRecord(session)) return false
  if (typeof session.id !== "string" || typeof session.workdir !== "string") return false
  if (!CONTEXT_SOURCES.includes(session.source as ContextSource)) return false
  if (!isNumber(session.createdAt) || !isNumber(session.updatedAt)) return false
  if (!isStringArray(session.dataQuality)) return false
  if (!Array.isArray(session.segments)) return false
  if (!Array.isArray(session.turns) || !session.turns.every(isTurn)) return false
  return true
}

/**
 * Whether a value is a well-formed workdirs answer.
 * @param value - any decoded JSON value.
 * @returns true when every row has a workdir, counts and source groups.
 */
export function isWorkdirsValue(value: unknown): value is WorkdirsValue {
  if (!isRecord(value) || !isNumber(value.scannedAt)) return false
  if (!Array.isArray(value.workdirs)) return false
  return value.workdirs.every((row) => {
    if (!isRecord(row)) return false
    if (typeof row.workdir !== "string" || !isNumber(row.sessions) || !isNumber(row.lastUpdatedAt)) return false
    if (!Array.isArray(row.sources)) return false
    return row.sources.every(
      (group) =>
        isRecord(group) &&
        CONTEXT_SOURCES.includes(group.source as ContextSource) &&
        isNumber(group.sessions) &&
        isNumber(group.lastUpdatedAt)
    )
  })
}

/**
 * Whether a value is a well-formed sessions answer.
 * @param value - any decoded JSON value.
 * @returns true when every row carries its source badge facts.
 */
export function isSessionsValue(value: unknown): value is SessionsValue {
  if (!isRecord(value) || typeof value.workdir !== "string") return false
  if (!Array.isArray(value.sessions)) return false
  return value.sessions.every((row) => {
    if (!isRecord(row)) return false
    if (typeof row.id !== "string" || typeof row.workdir !== "string") return false
    if (!CONTEXT_SOURCES.includes(row.source as ContextSource)) return false
    if (!isNumber(row.updatedAt) || !isNumber(row.bytes)) return false
    if (!isStringArray(row.dataQuality)) return false
    if (row.title !== undefined && typeof row.title !== "string") return false
    return true
  })
}
