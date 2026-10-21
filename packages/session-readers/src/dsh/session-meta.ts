/**
 * Reading the few fields a session list needs, shared by the full parser and
 * the head-only list reader.
 *
 * Both entry points must agree on what a title is and where the header lives;
 * duplicating that logic is how a list shows one label and the opened session
 * shows another.
 */

import { numberField, stringField, type JsonObject, type LogEvent } from "./records.ts"

/** The fields of a session log's first line. */
export interface SessionHeader {
  id?: string
  /** The directory the session runs in. */
  cwd?: string
  createdAt?: number
  /** Format generation; 4 is the current one. */
  version?: number
  /** 0 for a session a human started, 1+ for a subagent's own log. */
  delegationDepth?: number
  /** `standard` for an ordinary session, the preset name for a subagent. */
  agentPreset?: string
}

/**
 * Read the session header line.
 *
 * The header is the one line whose fields are *not* under `data`: it is
 * `{type:'session', version, id, createdAt, cwd, isSeeded, delegationDepth, …}`
 * at top level.
 * @param event - the log's first event, or undefined when the file is empty.
 */
export function readSessionHeader(event: LogEvent | undefined): SessionHeader {
  if (event === undefined || event.type !== "session") return {}
  const raw = event.raw
  const header: SessionHeader = {}
  const id = stringField(raw, "id")
  const cwd = stringField(raw, "cwd")
  const createdAt = numberField(raw, "createdAt")
  const version = numberField(raw, "version")
  const delegationDepth = numberField(raw, "delegationDepth")
  const agentPreset = stringField(raw, "agentPreset")
  if (id !== undefined) header.id = id
  if (cwd !== undefined) header.cwd = cwd
  if (createdAt !== undefined) header.createdAt = createdAt
  if (version !== undefined) header.version = version
  if (delegationDepth !== undefined) header.delegationDepth = delegationDepth
  if (agentPreset !== undefined) header.agentPreset = agentPreset
  return header
}

/**
 * Read the title a `session/title` event carries.
 *
 * Titles are a mutation: the harness writes a `fallback` title first (the
 * truncated first input) and may replace it later with a `provider` one. A
 * caller scanning several title events must therefore keep the **last** one.
 * @param data - a `session/title` event's `data`.
 */
export function readSessionTitle(data: JsonObject): string | undefined {
  const title = stringField(data, "title")
  if (title === undefined) return undefined
  const trimmed = title.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

/** Longest first-input excerpt a list row carries. */
export const FIRST_INPUT_LIMIT = 120

/**
 * First text block of a human `user/message`, truncated for a list row.
 *
 * Only `source.kind === 'user'` counts: approvals and subagent notices share
 * the same event type but would label a row with the harness talking to itself.
 * @param data - a `user/message` event's `data`.
 */
export function firstUserInput(data: JsonObject): string | undefined {
  const source = data["source"]
  if (typeof source !== "object" || source === null) return undefined
  if (stringField(source as JsonObject, "kind") !== "user") return undefined
  const content = data["content"]
  if (!Array.isArray(content)) return undefined
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue
    const record = block as JsonObject
    if (stringField(record, "type") !== "text") continue
    const text = stringField(record, "text")
    if (text === undefined) continue
    const collapsed = text.replace(/\s+/g, " ").trim()
    if (collapsed.length === 0) continue
    return collapsed.length > FIRST_INPUT_LIMIT ? `${collapsed.slice(0, FIRST_INPUT_LIMIT)}…` : collapsed
  }
  return undefined
}
