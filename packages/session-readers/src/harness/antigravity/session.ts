/**
 * Reading one Antigravity conversation into the shared IR.
 *
 * Antigravity (Google's agent IDE + `agy` CLI) keeps a per-conversation folder
 * `~/.gemini/antigravity{,-ide,-cli}/brain/<uuid>/` whose
 * `.system_generated/logs/transcript_full.jsonl` is the step log the app itself
 * displays. Each line is one step:
 *
 * ```json
 * {"step_index":0,"source":"USER_EXPLICIT","type":"USER_INPUT","created_at":"…",
 *  "content":"<USER_REQUEST>hi</USER_REQUEST><ADDITIONAL_METADATA>…"}
 * {"step_index":1,"source":"MODEL","type":"PLANNER_RESPONSE","created_at":"…",
 *  "input_tokens":1500,"cache_read_tokens":500,"output_tokens":50,
 *  "thinking":"…","content":"…","tool_calls":[{"name":"read_file","args":{…}}]}
 * ```
 *
 * A step's `source`/`type` decides what it said: a user request is wrapped in
 * `<USER_REQUEST>`, a planner response carries thinking + text + tool calls, and
 * every other MODEL step with `content` is the **result** of the call before it
 * — Antigravity does not give tool results their own type, so they are paired
 * with the oldest unanswered call in order.
 *
 * Older builds without a transcript keep the same steps as protobuf blobs in
 * `conversations/<uuid>.db`; that path is read only as a fallback, because its
 * field numbers are reverse-engineered rather than published.
 *
 * @see docs/IR.md (adapter 必须遵守)
 * @module @cyrusdoyle/dsh-session-readers/harness/antigravity
 */

import { open } from "node:fs/promises"

import type { Session } from "@cyrusdoyle/dsh-session-contract"

import { type HarnessEntry, HarnessSessionBuilder } from "../turns.ts"
import { findField, parseFields, printableOf, scanToolCall, timestampOf } from "./proto.ts"

/** Step kinds the protobuf fallback routes on. */
export const STEP_USER_INPUT = 14
export const STEP_PLANNER_RESPONSE = 15
export const STEP_CHECKPOINT = 23

/** Lines longer than this are skipped rather than buffered without bound. */
const MAX_LINE_BYTES = 4 * 1024 * 1024

/** One row of `SELECT idx, step_type, status, metadata, step_payload FROM steps`. */
export interface AntigravityStep {
  idx: number
  stepType: number
  status: number
  metadata: Uint8Array
  payload: Uint8Array
}

/** Everything the protobuf fallback needs, already read out of the database. */
export interface AntigravityConversation {
  id: string
  workdir: string
  /** Absolute path of the `.db` file, as the panel lists it. */
  segment: string
  steps: readonly AntigravityStep[]
  /** `executor_metadata.data` blob, when the database has one. */
  executor?: Uint8Array
  /** Creation time from the summaries index; used when the steps carry none. */
  createdAt: number
  title?: string
}

/**
 * One transcript line. Fields are optional because a step is written
 * progressively and an interrupted run may stop mid-record.
 */
interface TranscriptLine {
  stepIndex?: number
  source?: string
  type?: string
  createdAt?: string
  content?: string
  thinking?: string
  inputTokens?: number
  cacheReadTokens?: number
  outputTokens?: number
  cacheWriteTokens?: number
  toolCalls?: { name: string; args: unknown }[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function textOf(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

function countOf(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/** Parse one transcript line, or undefined when it is not a step. */
function lineOf(raw: string): TranscriptLine | undefined {
  if (raw.trim() === "") return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (!isRecord(parsed)) return undefined
  const line: TranscriptLine = {}
  const index = countOf(parsed, "step_index")
  if (index !== undefined) line.stepIndex = index
  const source = textOf(parsed, "source")
  if (source !== undefined) line.source = source
  const type = textOf(parsed, "type")
  if (type !== undefined) line.type = type
  const createdAt = textOf(parsed, "created_at")
  if (createdAt !== undefined) line.createdAt = createdAt
  const content = textOf(parsed, "content")
  if (content !== undefined) line.content = content
  const thinking = textOf(parsed, "thinking")
  if (thinking !== undefined) line.thinking = thinking
  const input = countOf(parsed, "input_tokens")
  if (input !== undefined) line.inputTokens = input
  const cacheRead = countOf(parsed, "cache_read_tokens")
  if (cacheRead !== undefined) line.cacheReadTokens = cacheRead
  const output = countOf(parsed, "output_tokens")
  if (output !== undefined) line.outputTokens = output
  const cacheWrite = countOf(parsed, "cache_write_tokens")
  if (cacheWrite !== undefined) line.cacheWriteTokens = cacheWrite
  const calls = parsed["tool_calls"]
  if (Array.isArray(calls)) {
    const list: { name: string; args: unknown }[] = []
    for (const call of calls) {
      if (!isRecord(call)) continue
      list.push({ name: textOf(call, "name") ?? "tool", args: call["args"] })
    }
    if (list.length > 0) line.toolCalls = list
  }
  return line
}

/** Epoch milliseconds of a `created_at` string. */
function timeOf(line: TranscriptLine): number | undefined {
  if (line.createdAt === undefined) return undefined
  const parsed = Date.parse(line.createdAt)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** The user's own words inside Antigravity's `<USER_REQUEST>` wrapper. */
export function userRequestOf(content: string): string | undefined {
  const open = content.indexOf("<USER_REQUEST>")
  if (open < 0) return undefined
  const start = open + "<USER_REQUEST>".length
  const close = content.indexOf("</USER_REQUEST>", start)
  const text = (close < 0 ? content.slice(start) : content.slice(start, close)).trim()
  return text === "" ? undefined : text
}

/** Strip the `Created At:` / `Completed At:` header Antigravity puts on tool output. */
function toolResultOf(content: string): string {
  let text = content
  for (const head of ["Created At:", "Completed At:"]) {
    if (text.startsWith(head)) {
      const newline = text.indexOf("\n")
      text = newline < 0 ? "" : text.slice(newline + 1)
    }
  }
  return text.trim()
}

/**
 * Parse one `transcript_full.jsonl`.
 * @param path - transcript file.
 * @param facts - id, workdir, title and fallback creation time.
 * @returns the session in the shared IR.
 */
export async function readAntigravityTranscript(
  path: string,
  facts: { id: string; workdir: string; title?: string; createdAt: number },
): Promise<Session> {
  const handle = await open(path, "r")
  const steps: TranscriptLine[] = []
  try {
    const buffer = Buffer.allocUnsafe(1 << 20)
    let carry = ""
    let position = 0
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position)
      if (bytesRead === 0) break
      position += bytesRead
      const text = carry + buffer.subarray(0, bytesRead).toString("utf8")
      const lines = text.split("\n")
      carry = lines.pop() ?? ""
      if (carry.length > MAX_LINE_BYTES) carry = ""
      for (const line of lines) {
        const step = lineOf(line)
        if (step !== undefined) steps.push(step)
      }
    }
    if (carry.trim() !== "") {
      const step = lineOf(carry)
      if (step !== undefined) steps.push(step)
    }
  } finally {
    await handle.close()
  }
  // A step is rewritten in place while it streams; the last write wins and the
  // first position holds its place in the conversation.
  const byIndex = new Map<number, TranscriptLine>()
  const order: number[] = []
  const loose: TranscriptLine[] = []
  for (const step of steps) {
    if (step.stepIndex === undefined) {
      loose.push(step)
      continue
    }
    if (!byIndex.has(step.stepIndex)) order.push(step.stepIndex)
    byIndex.set(step.stepIndex, step)
  }
  const ordered: TranscriptLine[] = order
    .map((index) => byIndex.get(index))
    .filter((line): line is TranscriptLine => line !== undefined)
  ordered.push(...loose)
  const builder = new HarnessSessionBuilder({
    source: "antigravity",
    id: facts.id,
    workdir: facts.workdir,
    createdAt: timeOf(ordered[0] ?? {}) ?? facts.createdAt,
    segments: [path],
    quality: [],
  })
  const pending: string[] = []
  let created = facts.createdAt
  for (const step of ordered) {
    const at = timeOf(step) ?? created
    created = at
    if (step.source === "USER_EXPLICIT" && step.type === "USER_INPUT") {
      const text = step.content === undefined ? undefined : userRequestOf(step.content)
      if (text !== undefined) builder.push({ kind: "user", at, text })
      continue
    }
    if (step.source === "MODEL" && step.type === "PLANNER_RESPONSE") {
      const assistant: HarnessEntry = { kind: "assistant", at }
      if (step.thinking !== undefined && step.thinking.trim() !== "") assistant.thinking = step.thinking
      if (step.content !== undefined && step.content.trim() !== "") assistant.text = step.content
      builder.push(assistant)
      const usage: HarnessEntry = { kind: "usage", at }
      let hasUsage = false
      if (step.inputTokens !== undefined) {
        usage.input = step.inputTokens
        hasUsage = true
      }
      if (step.outputTokens !== undefined) {
        usage.output = step.outputTokens
        hasUsage = true
      }
      if (step.cacheReadTokens !== undefined) {
        usage.cacheRead = step.cacheReadTokens
        hasUsage = true
      }
      if (step.cacheWriteTokens !== undefined) {
        usage.cacheWrite = step.cacheWriteTokens
        hasUsage = true
      }
      if (hasUsage) builder.push(usage)
      for (const call of step.toolCalls ?? []) {
        const id = `call-${String(at)}-${String(pending.length)}`
        pending.push(id)
        builder.push({ kind: "tool-call", at, id, name: call.name, input: call.args })
      }
      continue
    }
    if (step.source === "MODEL" && step.content !== undefined) {
      const text = toolResultOf(step.content)
      const id = pending.shift()
      if (id !== undefined) builder.push({ kind: "tool-result", at, id, status: "ok", output: text })
      else if (text !== "") builder.push({ kind: "carried", text })
    }
  }
  const session = builder.finish()
  if (facts.title !== undefined && facts.title.trim() !== "") session.title = facts.title.trim()
  return session
}

/** Text at `payload[field] → sub[subField]`, the shape user and planner text share. */
function nestedText(payload: Uint8Array, field: number, subField: number): string | undefined {
  const outer = findField(parseFields(payload), field)
  if (outer === undefined) return undefined
  const inner = findField(parseFields(outer.bytes), subField)
  if (inner === undefined) return undefined
  return printableOf(inner.bytes)
}

/** Per-call usage carried by `steps.metadata` field 9. */
function usageOfMetadata(
  metadata: Uint8Array,
): { input: number; output: number; cacheRead: number; cacheWrite: number } | undefined {
  const stats = findField(parseFields(metadata), 9)
  if (stats === undefined) return undefined
  const fields = parseFields(stats.bytes)
  const valueOf = (number: number): number => {
    const field = findField(fields, number)
    return field === undefined || field.wire !== 0 ? 0 : field.value
  }
  const input = valueOf(2)
  const output = valueOf(3)
  const cacheWrite = valueOf(4)
  const cacheRead = valueOf(5)
  if (input === 0 && output === 0 && cacheRead === 0 && cacheWrite === 0) return undefined
  return { input, output, cacheRead, cacheWrite }
}

/**
 * Model name from `executor_metadata` (`10 → 1 → 28`).
 * @param blob - the executor metadata blob, when the database has one.
 */
export function modelOfExecutor(blob: Uint8Array | undefined): { provider: string; model: string } | undefined {
  if (blob === undefined) return undefined
  const config = findField(parseFields(blob), 10)
  if (config === undefined) return undefined
  const variant = findField(parseFields(config.bytes), 1)
  if (variant === undefined) return undefined
  const nameField = findField(parseFields(variant.bytes), 28)
  if (nameField === undefined) return undefined
  const name = printableOf(nameField.bytes)
  if (name === undefined || name.trim() === "") return undefined
  return { provider: "", model: name.trim() }
}

/** Milliseconds of the step's event time, when the metadata carries one. */
function stepTime(step: AntigravityStep): number | undefined {
  const field = findField(parseFields(step.metadata), 1)
  return field === undefined ? undefined : timestampOf(field.bytes)
}

/**
 * Parse one conversation database (the pre-transcript fallback).
 * @param conversation - steps, executor blob and the resolved workdir.
 * @returns the session in the shared IR.
 */
export function readAntigravityConversation(conversation: AntigravityConversation): Session {
  const quality: string[] = []
  const steps = [...conversation.steps].sort((a, b) => a.idx - b.idx)
  const firstTime = steps.map(stepTime).find((time) => time !== undefined)
  const createdAt = firstTime ?? conversation.createdAt
  const builder = new HarnessSessionBuilder({
    source: "antigravity",
    id: conversation.id,
    workdir: conversation.workdir,
    createdAt,
    segments: [conversation.segment],
    quality,
  })
  const model = modelOfExecutor(conversation.executor)
  if (model === undefined) quality.push("model-unknown")
  let last = createdAt
  let unclassified = 0
  for (const step of steps) {
    const at = stepTime(step) ?? last
    last = at
    const usage = usageOfMetadata(step.metadata)
    if (usage !== undefined) {
      builder.push({
        kind: "usage",
        at,
        input: usage.input,
        output: usage.output,
        cacheRead: usage.cacheRead,
        cacheWrite: usage.cacheWrite,
        contextTokens: usage.input + usage.cacheRead + usage.cacheWrite,
      })
    }
    if (step.stepType === STEP_USER_INPUT) {
      const text = nestedText(step.payload, 19, 2)
      if (text !== undefined && text.trim() !== "") builder.push({ kind: "user", at, text })
      else unclassified += 1
      continue
    }
    if (step.stepType === STEP_PLANNER_RESPONSE) {
      const text = nestedText(step.payload, 20, 1) ?? nestedText(step.payload, 20, 8)
      const assistant: HarnessEntry = { kind: "assistant", at }
      if (text !== undefined) assistant.text = text
      if (model !== undefined) assistant.model = model
      builder.push(assistant)
      continue
    }
    if (step.stepType === STEP_CHECKPOINT) continue
    const call = scanToolCall(step.payload)
    if (call !== undefined) {
      builder.push({ kind: "tool-call", at, id: `step-${String(step.idx)}`, name: call.name, input: call.args })
      continue
    }
    unclassified += 1
  }
  if (unclassified > 0) builder.push({ kind: "quality", token: "steps-unclassified" })
  const session = builder.finish()
  const title = conversation.title
  if (title !== undefined && title.trim() !== "") session.title = title.trim()
  return session
}
