/**
 * Reading one Cursor composer into the shared IR.
 *
 * Cursor keeps every conversation in the `cursorDiskKV` table of the global
 * `state.vscdb`: one `composerData:<id>` row describes the conversation and one
 * `bubbleId:<composerId>:<bubbleId>` row holds each message. The composer's
 * `fullConversationHeadersOnly` array is the authoritative order — bubbles can
 * be reordered or rewritten in place — and `conversationMap` sometimes carries
 * the bubble bodies inline.
 *
 * Two limits are structural, and the reader says so instead of hiding them:
 * - Cursor zeroes the per-bubble `tokenCount` on almost every real session
 *   (3 of 275 bubbles measured), so most turns have no usage and fall back to
 *   the IR's estimated total;
 * - system prompt and tool schemas are never persisted, so the fixed prefix
 *   stays unknown.
 *
 * @see docs/IR.md (adapter 必须遵守)
 * @module @cyrusdoyle/dsh-session-readers/harness/cursor
 */

import type { Session } from "@cyrusdoyle/dsh-session-contract"

import { type HarnessEntry, type HarnessModel, HarnessSessionBuilder } from "../turns.ts"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/** Milliseconds from either an ISO string or an epoch number. */
function epochOf(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** Model name a bubble or the composer states, skipping Cursor's `default`. */
function modelOf(...records: (Record<string, unknown> | undefined)[]): HarnessModel | undefined {
  for (const record of records) {
    if (record === undefined) continue
    const info = record["modelInfo"]
    const config = record["modelConfig"]
    const name =
      (isRecord(info) ? stringField(info, "modelName") : undefined) ??
      stringField(record, "modelName") ??
      (isRecord(config) ? stringField(config, "modelName") : undefined) ??
      stringField(record, "model")
    if (name !== undefined && name !== "" && name !== "default") {
      const provider = (isRecord(info) ? stringField(info, "providerId") : undefined) ?? ""
      return { provider, model: name }
    }
  }
  return undefined
}

/** Tool calls Cursor attached to one assistant bubble. */
function callsOfBubble(
  bubble: Record<string, unknown>,
): { id: string; name: string; input: unknown; output?: unknown; failed?: boolean }[] {
  const calls: { id: string; name: string; input: unknown; output?: unknown; failed?: boolean }[] = []
  const former = bubble["toolFormerData"]
  if (isRecord(former)) {
    const id = stringField(former, "toolCallId") ?? `tool-${stringField(former, "tool") ?? "unknown"}`
    let input: unknown = former["params"]
    if (typeof input === "string") {
      try {
        input = JSON.parse(input) as unknown
      } catch {
        input = former["params"]
      }
    }
    const status = stringField(former, "status")
    calls.push({
      id,
      name: stringField(former, "name") ?? stringField(former, "tool") ?? "tool",
      input,
      ...(former["result"] === undefined ? {} : { output: former["result"] }),
      ...(status === "error" || status === "failed" ? { failed: true } : {}),
    })
  }
  const list = bubble["toolCalls"]
  if (Array.isArray(list)) {
    for (const call of list) {
      if (!isRecord(call)) continue
      const id = stringField(call, "id") ?? `tool-${String(calls.length)}`
      calls.push({
        id,
        name: stringField(call, "name") ?? "tool",
        input: call["arguments"],
        ...(call["status"] === "error" ? { failed: true } : {}),
      })
    }
  }
  return calls
}

/** Results Cursor stored separately from the calls. */
function resultsOfBubble(bubble: Record<string, unknown>): { id: string; output?: unknown; failed: boolean }[] {
  const list = bubble["toolResults"]
  if (!Array.isArray(list)) return []
  const results: { id: string; output?: unknown; failed: boolean }[] = []
  for (const entry of list) {
    if (!isRecord(entry)) continue
    const id = stringField(entry, "callId") ?? stringField(entry, "toolCallId")
    if (id === undefined) continue
    results.push({
      id,
      ...(entry["output"] === undefined ? {} : { output: entry["output"] }),
      failed: entry["success"] === false || entry["isError"] === true,
    })
  }
  return results
}

/** Thinking text Cursor keeps on a separate bubble kind. */
function thinkingOfBubble(bubble: Record<string, unknown>): string | undefined {
  const thinking = bubble["thinking"]
  if (isRecord(thinking)) {
    const text = stringField(thinking, "text")
    if (text !== undefined) return text
  }
  if (typeof thinking === "string") return thinking
  if (bubble["capabilityType"] === 30) {
    const text = stringField(bubble, "text")
    if (text !== undefined) return text
  }
  return undefined
}

/** Token usage a bubble logged, when it is not the zero placeholder. */
function usageOfBubble(bubble: Record<string, unknown>): { input: number; output: number } | undefined {
  const counts = bubble["tokenCount"]
  if (!isRecord(counts)) return undefined
  const input = numberField(counts, "inputTokens") ?? 0
  const output = numberField(counts, "outputTokens") ?? 0
  if (input <= 0 && output <= 0) return undefined
  return { input, output }
}

/** One bubble, as the host read it out of `cursorDiskKV`. */
export interface CursorBubble {
  bubbleId: string
  value: unknown
}

/** Everything one composer needs, already decoded from SQLite. */
export interface CursorComposerInput {
  composer: Record<string, unknown>
  bubbles: readonly CursorBubble[]
  /** Workspace path the host resolved from `workspaceIdentifier`/`workspace.json`. */
  workdir: string
  /** File or row locator the panel lists as the session's segment. */
  segment: string
  now?: number
}

/**
 * Parse one composer.
 * @param input - the composer row, its bubbles and the resolved workdir.
 * @returns the session in the shared IR.
 */
export function readCursorComposer(input: CursorComposerInput): Session {
  const { composer } = input
  const now = input.now ?? Date.now()
  const createdAt = epochOf(composer["createdAt"]) ?? now
  const id = stringField(composer, "composerId") ?? input.segment
  const quality: string[] = []
  const byId = new Map<string, Record<string, unknown>>()
  for (const bubble of input.bubbles) {
    if (isRecord(bubble.value)) byId.set(bubble.bubbleId, bubble.value)
  }
  // Some builds inline the bodies into the composer instead of separate rows.
  const map = composer["conversationMap"]
  if (isRecord(map)) {
    for (const [bubbleId, value] of Object.entries(map)) {
      if (isRecord(value) && !byId.has(bubbleId)) byId.set(bubbleId, value)
    }
  }
  const headers = composer["fullConversationHeadersOnly"]
  const order: { bubbleId: string; type?: number }[] = []
  if (Array.isArray(headers)) {
    for (const header of headers) {
      if (!isRecord(header)) continue
      const bubbleId = stringField(header, "bubbleId")
      if (bubbleId === undefined) continue
      const type = numberField(header, "type")
      order.push({ bubbleId, ...(type === undefined ? {} : { type }) })
    }
  }
  if (order.length === 0) {
    for (const [bubbleId, value] of byId) {
      const type = numberField(value, "type")
      order.push({ bubbleId, ...(type === undefined ? {} : { type }) })
    }
    if (order.length > 0) quality.push("composer-order-derived")
  }
  const missing = order.filter((entry) => !byId.has(entry.bubbleId)).length
  if (missing > 0) quality.push("bubbles-missing")
  const contextUsed = numberField(composer, "contextTokensUsed")
  const contextLimit = numberField(composer, "contextTokenLimit")
  if (contextUsed !== undefined && contextLimit !== undefined && contextLimit > 0 && contextUsed > contextLimit) {
    quality.push("context-above-model-window")
  }
  const builder = new HarnessSessionBuilder({
    source: "cursor",
    id,
    workdir: input.workdir,
    createdAt,
    segments: [input.segment],
    quality,
  })
  const composerModel = modelOf(composer)
  let lastAt = createdAt
  for (const entry of order) {
    const bubble = byId.get(entry.bubbleId)
    if (bubble === undefined) continue
    const at = epochOf(bubble["createdAt"]) ?? lastAt
    lastAt = at
    const type = numberField(bubble, "type") ?? entry.type
    const text = stringField(bubble, "text")
    if (type === 1) {
      if (text !== undefined && text.trim() !== "") builder.push({ kind: "user", at, text })
      continue
    }
    if (type !== 2) continue
    const thinking = thinkingOfBubble(bubble)
    const assistant: HarnessEntry = { kind: "assistant", at }
    // A thinking bubble's text is the thought, not a visible reply.
    if (text !== undefined && text.trim() !== "" && !(bubble["capabilityType"] === 30)) assistant.text = text
    if (thinking !== undefined) assistant.thinking = thinking
    const model = modelOf(bubble) ?? composerModel
    if (model !== undefined) assistant.model = model
    builder.push(assistant)
    for (const call of callsOfBubble(bubble)) {
      const start: HarnessEntry = { kind: "tool-call", at, id: call.id, name: call.name, input: call.input }
      if (call.output !== undefined) start.output = call.output
      if (call.failed === true) start.status = "error"
      builder.push(start)
    }
    for (const result of resultsOfBubble(bubble)) {
      const done: HarnessEntry = { kind: "tool-result", at, id: result.id, status: result.failed ? "error" : "ok" }
      if (result.output !== undefined) done.output = result.output
      builder.push(done)
    }
    const usage = usageOfBubble(bubble)
    if (usage !== undefined) builder.push({ kind: "usage", at, input: usage.input, output: usage.output })
  }
  const session = builder.finish()
  const title = stringField(composer, "name")
  if (title !== undefined && title.trim() !== "") session.title = title.trim()
  return session
}
