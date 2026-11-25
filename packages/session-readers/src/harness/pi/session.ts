/**
 * Reading one pi session file into the shared IR.
 *
 * pi (`@earendil-works/pi-coding-agent`) writes one JSONL file per session under
 * `~/.pi/agent/sessions/--<cwd>--/<timestamp>_<uuid>.jsonl`. The header line
 * carries `cwd`, `id` and the format version; every following line is an entry,
 * and entries link through `id`/`parentId` into a tree because `/tree` branches
 * in place instead of starting a new file.
 *
 * Three facts shape the fold:
 * - the live conversation is the **path from the current leaf to the root**
 *   (`buildSessionContext`), so abandoned branches must not be counted twice;
 * - `cacheRead` is *not* included in `input` in pi's usage struct, so the four
 *   counters add up the same way Claude's do;
 * - compaction stores `tokensBefore` and a summary, never `tokensAfter`, so the
 *   summary's own length is the only honest "after" estimate.
 *
 * @see docs/IR.md (adapter 必须遵守)
 * @module @cyrusdoyle/dsh-session-readers/harness/pi
 */

import { open } from "node:fs/promises"

import type { Session } from "@cyrusdoyle/dsh-session-contract"

import { type HarnessEntry, HarnessSessionBuilder } from "../turns.ts"

/** Entry types this reader routes on; unknown ones are ignored, never guessed. */
const ENTRY_SESSION = "session"
const ENTRY_MESSAGE = "message"
const ENTRY_MODEL_CHANGE = "model_change"
const ENTRY_COMPACTION = "compaction"
const ENTRY_BRANCH_SUMMARY = "branch_summary"
const ENTRY_CUSTOM_MESSAGE = "custom_message"
const ENTRY_SESSION_INFO = "session_info"

/** Longest line this reader will try to parse, so one corrupt line cannot stall it. */
const MAX_LINE_BYTES = 8 * 1024 * 1024

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

/** One parsed entry plus the line's order, for the v1 fallback and the leaf walk. */
interface Entry {
  /** Entry id, or a synthetic ordinal for v1 files without ids. */
  id: string
  parentId?: string
  at: number
  value: Record<string, unknown>
}

/** Millisecond time of an ISO timestamp string. */
function epochOf(text: string | undefined, fallback: number): number {
  if (text === undefined) return fallback
  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? fallback : parsed
}

/** Text blocks joined, so a multi-part message stays one string. */
function textOfContent(content: unknown): string | undefined {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return undefined
  const parts: string[] = []
  for (const block of content) {
    if (typeof block === "string") {
      parts.push(block)
      continue
    }
    if (!isRecord(block)) continue
    if (block["type"] === "text" && typeof block["text"] === "string") parts.push(block["text"])
  }
  return parts.length === 0 ? undefined : parts.join("\n")
}

/** Thinking blocks joined; pi stores them as a content block, not a field. */
function thinkingOfContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined
  const parts: string[] = []
  for (const block of content) {
    if (!isRecord(block)) continue
    if (block["type"] === "thinking" && typeof block["thinking"] === "string") parts.push(block["thinking"])
  }
  return parts.length === 0 ? undefined : parts.join("\n")
}

/** Tool calls carried by one assistant content array. */
function toolCallsOfContent(content: unknown): { id: string; name: string; input: unknown }[] {
  if (!Array.isArray(content)) return []
  const calls: { id: string; name: string; input: unknown }[] = []
  for (const block of content) {
    if (!isRecord(block) || block["type"] !== "toolCall") continue
    const id = stringField(block, "id") ?? `tool-${String(calls.length)}`
    calls.push({ id, name: stringField(block, "name") ?? "tool", input: block["arguments"] })
  }
  return calls
}

/**
 * Read the whole file and split it into entries.
 *
 * Long lines are read in chunks rather than by `readFile`, because a single
 * pasted image can push one line past the string limit.
 * @param path - session file.
 * @returns header entry and the entries in file order.
 */
async function readEntries(path: string): Promise<{ header: Record<string, unknown>; entries: Entry[] }> {
  const handle = await open(path, "r")
  try {
    const chunks: string[] = []
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
      for (const line of lines) chunks.push(line)
      if (chunks.length > 1_000_000) break
    }
    if (carry.trim() !== "") chunks.push(carry)
    let header: Record<string, unknown> = {}
    const entries: Entry[] = []
    let ordinal = 0
    for (const line of chunks) {
      if (line.trim() === "") continue
      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch {
        continue
      }
      if (!isRecord(parsed)) continue
      if (header["type"] === undefined && parsed["type"] === ENTRY_SESSION) {
        header = parsed
        continue
      }
      ordinal += 1
      const id = stringField(parsed, "id") ?? `entry-${String(ordinal)}`
      const parentId = stringField(parsed, "parentId")
      const entry: Entry = { id, at: epochOf(stringField(parsed, "timestamp"), 0), value: parsed }
      if (parentId !== undefined) entry.parentId = parentId
      entries.push(entry)
    }
    return { header, entries }
  } finally {
    await handle.close()
  }
}

/**
 * The entries on the live branch: from the last line back to the root.
 * @param entries - every parsed entry, in file order.
 * @returns the path in chronological order.
 */
function livePath(entries: readonly Entry[]): Entry[] {
  if (entries.length === 0) return []
  const byId = new Map<string, Entry>()
  for (const entry of entries) byId.set(entry.id, entry)
  const leaf = entries[entries.length - 1]
  const path: Entry[] = []
  const seen = new Set<string>()
  let cursor: Entry | undefined = leaf
  while (cursor !== undefined && !seen.has(cursor.id)) {
    seen.add(cursor.id)
    path.push(cursor)
    cursor = cursor.parentId === undefined ? undefined : byId.get(cursor.parentId)
  }
  // Anything unreachable means the log was truncated mid-tree; file order is
  // the only fallback that keeps every message the user actually saw.
  const first = entries[0]
  if (first !== undefined && !seen.has(first.id) && first.parentId !== undefined) return [...entries]
  return path.reverse()
}

/** Turn one message entry into builder entries. */
function pushMessage(entry: Entry, builder: HarnessSessionBuilder, currentModel: { provider: string; model: string }) {
  const message = entry.value["message"]
  if (!isRecord(message)) return
  const role = stringField(message, "role")
  const at = entry.at
  if (role === "user") {
    const text = textOfContent(message["content"])
    if (text !== undefined) builder.push({ kind: "user", at, text })
    return
  }
  if (role === "assistant") {
    const provider = stringField(message, "provider") ?? currentModel.provider
    const model = stringField(message, "model") ?? currentModel.model
    const text = textOfContent(message["content"])
    const thinking = thinkingOfContent(message["content"])
    const assistant: HarnessEntry = { kind: "assistant", at }
    if (text !== undefined) assistant.text = text
    if (thinking !== undefined) assistant.thinking = thinking
    if (provider !== "" || model !== "") assistant.model = { provider, model }
    builder.push(assistant)
    for (const call of toolCallsOfContent(message["content"])) {
      builder.push({ kind: "tool-call", at, id: call.id, name: call.name, input: call.input })
    }
    const usage = message["usage"]
    if (isRecord(usage)) {
      const reading: HarnessEntry = { kind: "usage", at }
      const input = numberField(usage, "input")
      const output = numberField(usage, "output")
      const cacheRead = numberField(usage, "cacheRead")
      const cacheWrite = numberField(usage, "cacheWrite")
      if (input !== undefined) reading.input = input
      if (output !== undefined) reading.output = output
      if (cacheRead !== undefined) reading.cacheRead = cacheRead
      if (cacheWrite !== undefined) reading.cacheWrite = cacheWrite
      builder.push(reading)
    }
    return
  }
  if (role === "toolResult") {
    const id = stringField(message, "toolCallId")
    if (id === undefined) return
    const output = textOfContent(message["content"])
    const failed = message["isError"] === true
    builder.push({
      kind: "tool-result",
      at,
      id,
      status: failed ? "error" : "ok",
      ...(output === undefined ? {} : { output }),
    })
    return
  }
  if (role === "bashExecution") {
    const command = stringField(message, "command") ?? ""
    const output = stringField(message, "output")
    const exitCode = numberField(message, "exitCode")
    const id = `bash-${String(at)}`
    builder.push({ kind: "tool-call", at, id, name: "bash", input: { command } })
    builder.push({
      kind: "tool-result",
      at,
      id,
      status: exitCode === undefined || exitCode === 0 ? "ok" : "error",
      ...(output === undefined ? {} : { output }),
    })
  }
}

/**
 * Parse one pi session file.
 * @param path - absolute path to the `.jsonl` file.
 * @param now - fallback timestamp when the header has none.
 * @returns the session in the shared IR.
 */
export async function readPiSession(path: string, now = Date.now()): Promise<Session> {
  const { header, entries } = await readEntries(path)
  const createdAt = epochOf(stringField(header, "timestamp"), now)
  const id =
    stringField(header, "id") ??
    path
      .split("/")
      .pop()
      ?.replace(/\.jsonl$/, "") ??
    "pi-session"
  const workdir = stringField(header, "cwd") ?? ""
  const quality: string[] = []
  const parent = stringField(header, "parentSession")
  if (parent !== undefined) quality.push("forked-session")
  const builder = new HarnessSessionBuilder({
    source: "pi",
    id,
    workdir,
    createdAt,
    segments: [path],
    quality,
  })
  const model = { provider: "", model: "" }
  let title: string | undefined
  const live = livePath(entries)
  if (live.length !== entries.length) builder.push({ kind: "quality", token: "branch-entries-skipped" })
  for (const entry of live) {
    const type = stringField(entry.value, "type")
    if (type === ENTRY_MESSAGE) {
      pushMessage(entry, builder, model)
      continue
    }
    if (type === ENTRY_MODEL_CHANGE) {
      model.provider = stringField(entry.value, "provider") ?? model.provider
      model.model = stringField(entry.value, "modelId") ?? model.model
      continue
    }
    if (type === ENTRY_COMPACTION) {
      const summary = stringField(entry.value, "summary")
      builder.push({
        kind: "compaction",
        at: entry.at,
        replacedHistory: true,
        ...(summary === undefined ? {} : { summary }),
      })
      continue
    }
    if (type === ENTRY_BRANCH_SUMMARY) {
      const summary = stringField(entry.value, "summary")
      if (summary !== undefined) builder.push({ kind: "carried", text: summary })
      continue
    }
    if (type === ENTRY_CUSTOM_MESSAGE) {
      // Extension-injected context: it reaches the model but is not the human's
      // turn, so it joins the carried window instead of opening a turn.
      const text = textOfContent(entry.value["content"])
      if (text !== undefined) builder.push({ kind: "carried", text })
      continue
    }
    if (type === ENTRY_SESSION_INFO) {
      title = stringField(entry.value, "name") ?? title
    }
  }
  // Compaction summaries that replaced history are not in `path`, but the
  // builder was told about them through the compaction entries themselves.
  const built = builder.finish()
  if (title !== undefined && title.trim() !== "") built.title = title.trim()
  return built
}
