/**
 * Reading one VS Code-family chat session into the shared IR.
 *
 * VS Code persists Copilot Chat (and the forks that reuse the workbench chat
 * service) as one file per conversation under
 * `workspaceStorage/<hash>/chatSessions/`. Older builds wrote a single JSON
 * object; current builds write a JSONL mutation log whose first `kind: 0` line
 * is the whole snapshot and whose `kind: 1` / `kind: 2` lines patch it — a
 * value set and an array replace-from-index respectively. The same `requests[]`
 * turn list drives both shapes once the log is replayed.
 *
 * The format is not published, so every read below is defensive: response parts
 * are walked for their markdown and thinking payloads, tool calls come from
 * `result.metadata.toolCallRounds` when present and from the serialized
 * invocation parts otherwise, and usage is only used when the metadata actually
 * carries token counts.
 *
 * @see docs/IR.md (adapter 必须遵守)
 * @module @cyrusdoyle/dsh-session-readers/harness/vscode
 */

import { readFile } from "node:fs/promises"

import type { Session } from "@cyrusdoyle/dsh-session-contract"

import { type HarnessEntry, HarnessSessionBuilder } from "../turns.ts"

/** Longest chat file this reader will load. */
const MAX_FILE_BYTES = 64 * 1024 * 1024

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

/** Split a mutation key into path segments; supports arrays, dots and slashes. */
function pathOf(key: unknown): (string | number)[] {
  if (Array.isArray(key))
    return key.filter((part): part is string | number => typeof part === "string" || typeof part === "number")
  if (typeof key === "number") return [key]
  if (typeof key !== "string") return []
  const trimmed = key.replace(/^\//, "")
  if (trimmed === "") return []
  return trimmed.split(/[./]/).filter((part) => part !== "")
}

/** Walk to the parent of a path, creating objects on the way. */
function parentAt(root: unknown, path: readonly (string | number)[]): unknown {
  let cursor = root
  for (const segment of path.slice(0, -1)) {
    if (Array.isArray(cursor)) {
      const index = typeof segment === "number" ? segment : Number(segment)
      if (!Number.isInteger(index)) return undefined
      cursor = cursor[index]
      continue
    }
    if (!isRecord(cursor)) return undefined
    cursor = cursor[String(segment)]
  }
  return cursor
}

/** Apply one `kind: 1` mutation. */
function setAt(root: unknown, key: unknown, value: unknown): void {
  const path = pathOf(key)
  const last = path[path.length - 1]
  if (last === undefined) return
  const parent = parentAt(root, path)
  if (Array.isArray(parent)) {
    const index = typeof last === "number" ? last : Number(last)
    if (Number.isInteger(index) && index >= 0) parent[index] = value
    return
  }
  if (isRecord(parent)) parent[String(last)] = value
}

/** The value at a path, when the container holds one. */
function valueAt(root: unknown, path: readonly (string | number)[]): unknown {
  if (path.length === 0) return root
  const container = parentAt(root, path)
  const last = path[path.length - 1]
  if (last === undefined) return undefined
  if (Array.isArray(container)) {
    const index = typeof last === "number" ? last : Number(last)
    return Number.isInteger(index) ? container[index] : undefined
  }
  return isRecord(container) ? container[String(last)] : undefined
}

/** Apply one `kind: 3` mutation: drop the value at the path. */
function deleteAt(root: unknown, key: unknown): void {
  const path = pathOf(key)
  const last = path[path.length - 1]
  if (last === undefined) return
  const parent = parentAt(root, path)
  if (Array.isArray(parent)) {
    const index = typeof last === "number" ? last : Number(last)
    if (Number.isInteger(index) && index >= 0) parent.splice(index, 1)
    return
  }
  if (isRecord(parent)) delete parent[String(last)]
}

/** Apply one `kind: 2` mutation: truncate the array at `index`, then append. */
function replaceArrayFrom(root: unknown, key: unknown, index: unknown, value: unknown): void {
  const path = pathOf(key)
  const target = valueAt(root, path)
  if (!Array.isArray(target)) return
  const at = typeof index === "number" ? index : Number(index)
  if (!Number.isInteger(at) || at < 0) return
  const appended = Array.isArray(value) ? value : [value]
  target.length = at
  target.push(...appended)
}

/**
 * Decode a chat file into the session snapshot.
 *
 * A single JSON object is returned as-is; a JSONL mutation log is replayed in
 * file order. Anything unparseable answers undefined instead of a guess.
 * @param text - file contents.
 * @returns the snapshot, or undefined when no session shape was found.
 */
export function decodeChatFile(text: string): Record<string, unknown> | undefined {
  const trimmed = text.trim()
  if (trimmed === "") return undefined
  try {
    const whole: unknown = JSON.parse(trimmed)
    if (isRecord(whole)) return whole
    if (Array.isArray(whole)) return { requests: whole }
  } catch {
    // Not one JSON document: this is the event-sourced log.
  }
  let snapshot: Record<string, unknown> | undefined
  let failed = 0
  for (const line of trimmed.split("\n")) {
    if (line.trim() === "") continue
    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      failed += 1
      continue
    }
    if (!isRecord(entry)) continue
    const kind = numberField(entry, "kind")
    if (kind === 0) {
      const value = entry["v"]
      if (isRecord(value)) snapshot = value
      continue
    }
    if (snapshot === undefined) continue
    if (kind === 1) setAt(snapshot, entry["k"], entry["v"])
    else if (kind === 2) replaceArrayFrom(snapshot, entry["k"], entry["i"], entry["v"])
    else if (kind === 3) deleteAt(snapshot, entry["k"])
  }
  if (snapshot !== undefined && failed > 0) {
    // The log replayed despite unreadable lines; keep the session and let the
    // caller mark it truncated.
    return { ...snapshot, __truncated: true }
  }
  return snapshot
}

/** Markdown and thinking text carried by one response part. */
function partTexts(part: unknown): { text?: string; thinking?: string; tool?: { id: string; name: string } } {
  if (!isRecord(part)) return {}
  const kind = stringField(part, "kind")
  if (kind === "thinking") {
    const value = part["value"]
    if (typeof value === "string") return { thinking: value }
    if (isRecord(value)) {
      const nested = stringField(value, "value") ?? stringField(value, "text")
      if (nested !== undefined) return { thinking: nested }
    }
    return {}
  }
  if (kind === "markdownContent") {
    const content = part["content"]
    if (isRecord(content)) {
      const value = content["value"]
      if (typeof value === "string") return { text: value }
    }
    const value = part["value"]
    if (typeof value === "string") return { text: value }
    return {}
  }
  if (kind === "toolInvocationSerialized") {
    const id = stringField(part, "toolCallId")
    const name = stringField(part, "toolId")
    if (id !== undefined && name !== undefined) return { tool: { id, name } }
    return {}
  }
  // Parts without a discriminator are bare MarkdownString values.
  if (kind === undefined) {
    const value = part["value"]
    if (typeof value === "string") return { text: value }
  }
  return {}
}

/** One tool call inside `metadata.toolCallRounds`. */
interface RoundCall {
  id: string
  name: string
  input: unknown
}

/** Flatten the tool calls of every round in one request's metadata. */
function roundCalls(metadata: Record<string, unknown>): RoundCall[] {
  const rounds = metadata["toolCallRounds"]
  if (!Array.isArray(rounds)) return []
  const calls: RoundCall[] = []
  for (const round of rounds) {
    if (!isRecord(round)) continue
    const list = round["toolCalls"]
    if (!Array.isArray(list)) continue
    for (const call of list) {
      if (!isRecord(call)) continue
      const id = stringField(call, "id") ?? `call-${String(calls.length)}`
      const name = stringField(call, "name") ?? "tool"
      const raw = call["arguments"]
      let input: unknown = raw
      if (typeof raw === "string") {
        try {
          input = JSON.parse(raw) as unknown
        } catch {
          input = raw
        }
      }
      calls.push({ id, name, input })
    }
  }
  return calls
}

/** Tool results keyed by call id, from `metadata.toolCallResults`. */
function resultOf(metadata: Record<string, unknown>, id: string): { output?: unknown; failed: boolean } | undefined {
  const results = metadata["toolCallResults"]
  if (isRecord(results)) {
    const entry = results[id]
    if (isRecord(entry)) {
      return {
        ...(entry["content"] === undefined ? {} : { output: entry["content"] }),
        failed: entry["isError"] === true,
      }
    }
    return undefined
  }
  if (Array.isArray(results)) {
    for (const entry of results) {
      if (!isRecord(entry)) continue
      if (stringField(entry, "toolCallId") !== id && stringField(entry, "id") !== id) continue
      return {
        ...(entry["content"] === undefined ? {} : { output: entry["content"] }),
        failed: entry["isError"] === true,
      }
    }
  }
  return undefined
}

/** Token counts VS Code writes on the request itself (`promptTokens`/`completionTokens`). */
function usageOfRequest(
  request: Record<string, unknown>,
): { input: number; output: number; contextTokens?: number } | undefined {
  const input = numberField(request, "promptTokens")
  const output = numberField(request, "completionTokens")
  if (input === undefined && output === undefined) return undefined
  const reading: { input: number; output: number; contextTokens?: number } = { input: input ?? 0, output: output ?? 0 }
  if (input !== undefined) reading.contextTokens = input
  return reading
}

/** Token usage when the metadata carries it; never invented. */
function usageOf(
  metadata: Record<string, unknown>,
): { input: number; output: number; contextTokens?: number } | undefined {
  const usage = metadata["usage"]
  if (!isRecord(usage)) return undefined
  const input = numberField(usage, "promptTokens") ?? numberField(usage, "inputTokens")
  const output = numberField(usage, "completionTokens") ?? numberField(usage, "outputTokens")
  if (input === undefined && output === undefined) return undefined
  const reading: { input: number; output: number; contextTokens?: number } = { input: input ?? 0, output: output ?? 0 }
  const context = numberField(usage, "contextTokens") ?? numberField(usage, "totalTokens")
  if (context !== undefined) reading.contextTokens = context
  return reading
}

/**
 * Parse one chat session file.
 * @param file - the `.json`/`.jsonl` session file.
 * @param workdir - workspace folder the host resolved from `workspace.json`.
 * @param now - fallback timestamp.
 * @returns the session in the shared IR.
 */
export async function readVscodeChat(file: string, workdir: string, now = Date.now()): Promise<Session> {
  const text = await readFile(file, "utf8")
  if (Buffer.byteLength(text, "utf8") > MAX_FILE_BYTES) throw new Error("chat-file-too-large")
  const snapshot = decodeChatFile(text)
  if (snapshot === undefined) throw new Error("chat-session-unreadable")
  const requests = Array.isArray(snapshot["requests"]) ? snapshot["requests"] : []
  const id =
    stringField(snapshot, "sessionId") ??
    file
      .split("/")
      .pop()
      ?.replace(/\.(jsonl|json)$/, "") ??
    "vscode-chat"
  const first = requests.find(isRecord)
  const createdAt = first === undefined ? now : (numberField(first, "timestamp") ?? now)
  const quality: string[] = []
  if (snapshot["__truncated"] === true) quality.push("log-truncated")
  if (requests.length === 0) quality.push("log-without-turns")
  const builder = new HarnessSessionBuilder({
    source: "vscode",
    id,
    workdir,
    createdAt,
    segments: [file],
    quality,
  })
  for (const request of requests) {
    if (!isRecord(request)) continue
    const at = numberField(request, "timestamp") ?? createdAt
    const message = request["message"]
    const userText = isRecord(message) ? stringField(message, "text") : undefined
    if (userText !== undefined && userText.trim() !== "") {
      builder.push({ kind: "user", at, text: userText })
    }
    const response = request["response"]
    const thinking: string[] = []
    const texts: string[] = []
    const serialized: { id: string; name: string }[] = []
    if (Array.isArray(response)) {
      for (const part of response) {
        const decoded = partTexts(part)
        if (decoded.thinking !== undefined) thinking.push(decoded.thinking)
        if (decoded.text !== undefined) texts.push(decoded.text)
        if (decoded.tool !== undefined) serialized.push(decoded.tool)
      }
    }
    const result = request["result"]
    const metadata = isRecord(result) ? result["metadata"] : undefined
    const modelId = isRecord(metadata) ? stringField(metadata, "modelId") : stringField(request, "modelId")
    const assistant: HarnessEntry = { kind: "assistant", at }
    if (texts.length > 0) assistant.text = texts.join("\n")
    if (thinking.length > 0) assistant.thinking = thinking.join("\n")
    if (modelId !== undefined && modelId !== "") assistant.model = { provider: "copilot", model: modelId }
    builder.push(assistant)
    const calls = isRecord(metadata) ? roundCalls(metadata) : []
    for (const call of calls) {
      const entry: HarnessEntry = { kind: "tool-call", at, id: call.id, name: call.name, input: call.input }
      builder.push(entry)
      if (isRecord(metadata)) {
        const outcome = resultOf(metadata, call.id)
        if (outcome !== undefined) {
          const done: HarnessEntry = { kind: "tool-result", at, id: call.id, status: outcome.failed ? "error" : "ok" }
          if (outcome.output !== undefined) done.output = outcome.output
          builder.push(done)
        }
      }
    }
    // Invocation parts name the tool but carry no arguments; only use them when
    // the metadata did not already describe the same call.
    for (const call of serialized) {
      if (calls.some((known) => known.id === call.id)) continue
      builder.push({ kind: "tool-call", at, id: call.id, name: call.name, input: undefined })
    }
    const direct = usageOfRequest(request)
    if (direct !== undefined) {
      builder.push({
        kind: "usage",
        at,
        input: direct.input,
        output: direct.output,
        ...(direct.contextTokens === undefined ? {} : { contextTokens: direct.contextTokens }),
      })
    } else if (isRecord(metadata)) {
      const usage = usageOf(metadata)
      if (usage !== undefined) {
        builder.push({
          kind: "usage",
          at,
          input: usage.input,
          output: usage.output,
          ...(usage.contextTokens === undefined ? {} : { contextTokens: usage.contextTokens }),
        })
      }
    }
  }
  return builder.finish()
}
