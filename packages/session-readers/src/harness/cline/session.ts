/**
 * Reading one Cline / Roo Code task into the shared IR.
 *
 * Both extensions keep one directory per task under
 * `<app>/User/globalStorage/<ext-id>/tasks/<taskId>/` and write the same two
 * files: `api_conversation_history.json` (the messages actually sent to the
 * model) and `ui_messages.json` (what the webview showed, including the only
 * per-request usage Cline ever records).
 *
 * The conversation itself is therefore read from the API history — it is the
 * only file with real `tool_use` / `tool_result` pairing — while the UI log
 * supplies what the history does not: usage, user feedback, and compaction
 * points. The two are joined by request order, and the number of requests is
 * cross-checked against the number of assistant messages so a mismatch is
 * visible instead of smeared over the turns.
 *
 * @see docs/IR.md (adapter 必须遵守)
 * @module @cyrusdoyle/dsh-session-readers/harness/cline
 */

import { access, readFile } from "node:fs/promises"
import { basename, join } from "node:path"

import type { Session } from "@cyrusdoyle/dsh-session-contract"

import { type HarnessEntry, HarnessSessionBuilder } from "../turns.ts"

/** Files a task directory may hold; only these two are required. */
const HISTORY_FILE = "api_conversation_history.json"
const UI_FILE = "ui_messages.json"

/** Environment block Cline appends to the last user message; it is not human input. */
const ENV_OPEN = "<environment_details>"
const ENV_CLOSE = "</environment_details>"

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

/** Read a JSON file, answering undefined when it is absent or unreadable. */
async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown
  } catch {
    return undefined
  }
}

/** Text of a content value that may be a string or an Anthropic block array. */
function textOfContent(content: unknown): string[] {
  if (typeof content === "string") return [content]
  if (!Array.isArray(content)) return []
  const parts: string[] = []
  for (const block of content) {
    if (typeof block === "string") {
      parts.push(block)
      continue
    }
    if (!isRecord(block)) continue
    if (block["type"] === "text" && typeof block["text"] === "string") parts.push(block["text"])
  }
  return parts
}

/** True for the harness-written environment block, which is not human text. */
function isEnvironmentBlock(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.startsWith(ENV_OPEN) && trimmed.endsWith(ENV_CLOSE)
}

/** Human text of one message: environment blocks stripped. */
function humanTextOf(content: unknown): string | undefined {
  const parts = textOfContent(content).filter((part) => !isEnvironmentBlock(part))
  const text = parts.join("\n").trim()
  return text === "" ? undefined : text
}

/** Tool calls and results carried by one message. */
function blocksOf(content: unknown): {
  tools: { id: string; name: string; input: unknown }[]
  results: { id: string; output?: string; failed: boolean }[]
  thinking: string | undefined
} {
  const tools: { id: string; name: string; input: unknown }[] = []
  const results: { id: string; output?: string; failed: boolean }[] = []
  const thinking: string[] = []
  if (!Array.isArray(content)) return { tools, results, thinking: undefined }
  for (const block of content) {
    if (!isRecord(block)) continue
    const type = block["type"]
    if (type === "tool_use") {
      tools.push({
        id: stringField(block, "id") ?? `tool-${String(tools.length)}`,
        name: stringField(block, "name") ?? "tool",
        input: block["input"],
      })
      continue
    }
    if (type === "tool_result") {
      const id = stringField(block, "tool_use_id")
      if (id === undefined) continue
      const output = textOfContent(block["content"]).join("\n")
      results.push({ id, failed: block["is_error"] === true, ...(output === "" ? {} : { output }) })
      continue
    }
    if (type === "thinking" && typeof block["thinking"] === "string") thinking.push(block["thinking"])
    if (type === "reasoning" && typeof block["text"] === "string") thinking.push(block["text"])
    if (type === "reasoning_content" && typeof block["text"] === "string") thinking.push(block["text"])
  }
  return { tools, results, thinking: thinking.length === 0 ? undefined : thinking.join("\n") }
}

/** One request's usage, as `api_req_started` records it. */
interface RequestUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  /** The full prompt Cline counted, which already includes the cache buckets. */
  contextTokens: number
}

/**
 * Decode every completed `api_req_started` record.
 *
 * The entry is rewritten in place when the request finishes, so the file on
 * disk holds the final numbers; `partial` rows and rows without `tokensIn`
 * never ran to completion and are skipped.
 * @param messages - the UI message array.
 * @returns usage per completed request, in file order.
 */
export function usagesOfUi(messages: readonly unknown[]): RequestUsage[] {
  const usages: RequestUsage[] = []
  for (const message of messages) {
    if (!isRecord(message)) continue
    if (message["partial"] === true) continue
    if (message["say"] !== "api_req_started") continue
    const text = stringField(message, "text")
    if (text === undefined) continue
    let info: unknown
    try {
      info = JSON.parse(text)
    } catch {
      continue
    }
    if (!isRecord(info)) continue
    const input = numberField(info, "tokensIn")
    const output = numberField(info, "tokensOut")
    if (input === undefined && output === undefined) continue
    const cacheRead = numberField(info, "cacheReads") ?? 0
    const cacheWrite = numberField(info, "cacheWrites") ?? 0
    const prompt = input ?? 0
    usages.push({
      // Anthropic reports the prompt with cache buckets inside it; subtracting
      // them keeps `input` and `cacheRead` from counting the same tokens twice.
      input: Math.max(0, prompt - cacheRead - cacheWrite),
      output: output ?? 0,
      cacheRead,
      cacheWrite,
      contextTokens: prompt,
    })
  }
  return usages
}

/** One compaction point Cline recorded in the UI log. */
export function condensesOf(messages: readonly unknown[]): { at: number; summary?: string; before?: number }[] {
  const points: { at: number; summary?: string; before?: number }[] = []
  for (const message of messages) {
    if (!isRecord(message) || message["say"] !== "condense_context") continue
    const at = numberField(message, "ts") ?? 0
    const condense = message["contextCondense"]
    if (!isRecord(condense)) continue
    const point: { at: number; summary?: string; before?: number } = { at }
    const summary = stringField(condense, "summary")
    if (summary !== undefined) point.summary = summary
    const before = numberField(condense, "prevContextTokens")
    if (before !== undefined) point.before = before
    points.push(point)
  }
  return points
}

/** The workspace directory Cline wrote into its environment block. */
export function workdirOfHistory(messages: readonly unknown[]): string | undefined {
  for (const message of messages) {
    if (!isRecord(message)) continue
    for (const text of textOfContent(message["content"])) {
      if (!isEnvironmentBlock(text)) continue
      const match = /# Current Workspace Directory \((.+?)\)/.exec(text)
      if (match?.[1] !== undefined) return match[1]
    }
  }
  return undefined
}

/**
 * Parse one task directory.
 * @param dir - absolute path of `tasks/<taskId>`.
 * @param now - fallback time when the task has no timestamps.
 * @returns the session in the shared IR.
 */
export async function readClineTask(dir: string, now = Date.now()): Promise<Session> {
  const [historyRaw, uiRaw, metadata, historyItem] = await Promise.all([
    readJson(join(dir, HISTORY_FILE)),
    readJson(join(dir, UI_FILE)),
    readJson(join(dir, "task_metadata.json")),
    readJson(join(dir, "history_item.json")),
  ])
  const history = Array.isArray(historyRaw) ? historyRaw : []
  const ui = Array.isArray(uiRaw) ? uiRaw : []
  const segments: string[] = []
  for (const name of [HISTORY_FILE, UI_FILE]) {
    try {
      await access(join(dir, name))
      segments.push(join(dir, name))
    } catch {
      // A missing file is normal: a task interrupted before its first request
      // never writes the history.
    }
  }
  const workdir = workdirOfHistory(history) ?? workspaceOf(historyItem) ?? ""
  const taskText = ui
    .map((message) => (isRecord(message) && message["say"] === "task" ? stringField(message, "text") : undefined))
    .find((text) => text !== undefined && text.trim() !== "")
  const quality: string[] = []
  if (history.length === 0) quality.push("history-missing")
  const firstTs = firstTimestamp(history, ui) ?? now
  const builder = new HarnessSessionBuilder({
    source: "cline",
    id: basename(dir),
    workdir,
    createdAt: firstTs,
    segments,
    quality,
  })
  const usages = usagesOfUi(ui)
  const condenses = condensesOf(ui)
  const lastHistoryAt = history.reduce<number>((latest, message) => {
    if (!isRecord(message)) return latest
    return Math.max(latest, numberField(message, "ts") ?? 0)
  }, 0)
  const model = modelOf(metadata, historyItem)
  let usageIndex = 0
  for (const message of history) {
    if (!isRecord(message)) continue
    const role = stringField(message, "role")
    const at = numberField(message, "ts") ?? firstTs
    const content = message["content"]
    const { tools, results, thinking } = blocksOf(content)
    if (role === "user") {
      // A user message carrying only tool results continues the current turn;
      // one with text starts a new one.
      for (const result of results) {
        const entry: HarnessEntry = { kind: "tool-result", at, id: result.id, status: result.failed ? "error" : "ok" }
        if (result.output !== undefined) entry.output = result.output
        builder.push(entry)
      }
      const text = humanTextOf(content)
      if (text !== undefined) builder.push({ kind: "user", at, text })
      continue
    }
    if (role !== "assistant") continue
    const text = humanTextOf(content)
    const assistant: HarnessEntry = { kind: "assistant", at }
    if (text !== undefined) assistant.text = text
    if (thinking !== undefined) assistant.thinking = thinking
    if (model !== undefined) assistant.model = model
    builder.push(assistant)
    for (const call of tools) {
      builder.push({ kind: "tool-call", at, id: call.id, name: call.name, input: call.input })
    }
    const usage = usages[usageIndex]
    if (usage !== undefined) {
      usageIndex += 1
      builder.push({
        kind: "usage",
        at,
        input: usage.input,
        output: usage.output,
        cacheRead: usage.cacheRead,
        cacheWrite: usage.cacheWrite,
        contextTokens: usage.contextTokens,
      })
    }
  }
  // Requests without a matching assistant message still ran; dropping them
  // would understate the session, so they land on the last turn and say so.
  if (usageIndex < usages.length) {
    builder.push({ kind: "quality", token: "usage-alignment-partial" })
    while (usageIndex < usages.length) {
      const usage = usages[usageIndex]
      usageIndex += 1
      if (usage === undefined) continue
      builder.push({
        kind: "usage",
        input: usage.input,
        output: usage.output,
        cacheRead: usage.cacheRead,
        cacheWrite: usage.cacheWrite,
        contextTokens: usage.contextTokens,
      })
    }
  }
  // A task can end on the user's own words: `user_feedback` is only copied into
  // the API history when the next request starts, so the trailing one is read
  // from the UI log.
  for (const message of ui) {
    if (!isRecord(message) || message["say"] !== "user_feedback") continue
    if (message["partial"] === true) continue
    const at = numberField(message, "ts") ?? lastHistoryAt
    if (at <= lastHistoryAt) continue
    const text = stringField(message, "text")
    if (text !== undefined && text.trim() !== "") builder.push({ kind: "user", at, text })
  }
  for (const point of condenses) {
    const entry: HarnessEntry = { kind: "compaction", at: point.at, replacedHistory: true }
    if (point.summary !== undefined) entry.summary = point.summary
    builder.push(entry)
  }
  const session = builder.finish()
  const title = taskText ?? titleOf(historyItem)
  if (title !== undefined && title.trim() !== "") session.title = title.trim().slice(0, 200)
  return session
}

/** Title from Roo's `history_item.json`. */
function titleOf(item: unknown): string | undefined {
  if (!isRecord(item)) return undefined
  return stringField(item, "title") ?? stringField(item, "task")
}

/** Workspace from Roo's `history_item.json`. */
function workspaceOf(item: unknown): string | undefined {
  if (!isRecord(item)) return undefined
  return stringField(item, "workspace") ?? stringField(item, "cwd")
}

/** Model the task last used, when the metadata files record one. */
function modelOf(metadata: unknown, historyItem: unknown): { provider: string; model: string } | undefined {
  const list = isRecord(metadata) ? metadata["model_usage"] : undefined
  if (Array.isArray(list)) {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const entry = list[index]
      if (!isRecord(entry)) continue
      const model = stringField(entry, "model_id")
      if (model === undefined) continue
      return { provider: stringField(entry, "model_provider_id") ?? "", model }
    }
  }
  if (isRecord(historyItem)) {
    const model = stringField(historyItem, "modelId") ?? stringField(historyItem, "model")
    if (model !== undefined) return { provider: "", model }
  }
  return undefined
}

/** Earliest timestamp across both logs. */
function firstTimestamp(history: readonly unknown[], ui: readonly unknown[]): number | undefined {
  let earliest: number | undefined
  for (const message of [...history, ...ui]) {
    if (!isRecord(message)) continue
    const at = numberField(message, "ts")
    if (at === undefined) continue
    if (earliest === undefined || at < earliest) earliest = at
  }
  return earliest
}
