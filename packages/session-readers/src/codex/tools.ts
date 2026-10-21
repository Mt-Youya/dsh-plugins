/**
 * Pairing Codex tool calls with their results.
 *
 * Two families share one pairing key, call_id:
 * - response_item.custom_tool_call {name: 'exec', input: <free-form JS>}
 * - response_item.function_call {name, namespace, arguments: <JSON string>}
 * Their results arrive as *_output records with the same call_id. Unlike
 * Claude, the tool name lives on the payload itself, never inside a content
 * array. On this corpus every custom/function call pairs (19,230 + 6,017 with
 * the same number of outputs), so anything unpaired is reported as unknown
 * rather than guessed.
 *
 * web_search_call and tool_search_call ride along: tool_search carries a
 * call_id, web_search does not and gets a synthetic id from its own id.
 */

import type { ToolCall } from "@cyrus/dsh-session-contract"
import { booleanField, isObject, stringField, type JsonObject, type JsonValue } from "./records.ts"

/** A call the model made. */
export interface ToolInvocation {
  id: string
  name: string
  input: unknown
  startedAt: number
}

/** A result the harness wrote back. */
export interface ToolOutcome {
  callId: string
  status: "ok" | "error" | "unknown"
  output: unknown
  endedAt: number
}

/** Response item types that carry a call. */
const CALL_TYPES = new Set(["custom_tool_call", "function_call", "tool_search_call", "web_search_call"])

/** Response item types that carry a result. */
const OUTPUT_TYPES = new Set(["custom_tool_call_output", "function_call_output", "tool_search_output"])

/** Whether a response item is a tool call. */
export function isToolCallItem(payload: JsonObject): boolean {
  const type = stringField(payload, "type")
  return type !== undefined && CALL_TYPES.has(type)
}

/** Whether a response item is a tool result. */
export function isToolOutputItem(payload: JsonObject): boolean {
  const type = stringField(payload, "type")
  return type !== undefined && OUTPUT_TYPES.has(type)
}

/** Read a call, or undefined when the item is not one. */
export function toolInvocationOf(payload: JsonObject, at: number): ToolInvocation | undefined {
  if (!isToolCallItem(payload)) return undefined
  const type = stringField(payload, "type") ?? ""
  const callId = stringField(payload, "call_id")
  const name = toolName(payload)
  if (type === "web_search_call") {
    const id = stringField(payload, "id") ?? "web_search"
    return { id: "web_search:" + id, name, input: payload["action"] ?? null, startedAt: at }
  }
  if (callId === undefined) return undefined
  return { id: callId, name, input: toolInput(payload), startedAt: at }
}

/** The name the panel shows: namespace-qualified when the payload carries one. */
export function toolName(payload: JsonObject): string {
  const type = stringField(payload, "type") ?? ""
  if (type === "web_search_call") return "web_search"
  if (type === "tool_search_call") return "tool_search"
  const name = stringField(payload, "name") ?? "unknown"
  const namespace = stringField(payload, "namespace")
  return namespace === undefined || namespace.length === 0 ? name : namespace + "." + name
}

/** The model's input: free-form JavaScript for exec, JSON text otherwise. */
export function toolInput(payload: JsonObject): unknown {
  const type = stringField(payload, "type")
  if (type === "tool_search_call") return payload["arguments"] ?? null
  const input = payload["input"]
  if (input !== undefined) return input
  const args = payload["arguments"]
  if (typeof args === "string") return parseArguments(args)
  return args ?? null
}

/** Function-call arguments are a JSON string; decode when it is JSON. */
function parseArguments(args: string): unknown {
  const trimmed = args.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return args
  try {
    return JSON.parse(trimmed)
  } catch {
    return args
  }
}

/** Read a result, or undefined when the item is not one. */
export function toolOutcomeOf(payload: JsonObject, at: number): ToolOutcome | undefined {
  if (!isToolOutputItem(payload)) return undefined
  const callId = stringField(payload, "call_id")
  if (callId === undefined) return undefined
  const type = stringField(payload, "type") ?? ""
  const output = type === "tool_search_output" ? (payload["tools"] ?? null) : (payload["output"] ?? null)
  return { callId, status: statusOf(payload, output), output, endedAt: at }
}

/**
 * Whether a result says it failed.
 *
 * A written result means the call completed, so the default is ok: Codex's
 * custom_tool_call_output carries no status field at all, and calling 19,230
 * delivered results "unknown" would hide every tool call behind a question mark.
 * Only explicit failure markers (a failed status, an error payload, success:false)
 * override that, and exec failures that are only text stay read as delivered.
 */
function statusOf(payload: JsonObject, output: JsonValue): "ok" | "error" | "unknown" {
  const status = stringField(payload, "status")
  if (status === "failed" || status === "error") return "error"
  if (status === "cancelled") return "unknown"
  if (status === "completed" || status === "success") return "ok"
  if (isObject(output)) {
    if (output["error"] !== undefined) return "error"
    const success = booleanField(output, "success")
    if (success !== undefined) return success ? "ok" : "error"
  }
  return "ok"
}

/**
 * Collect calls and results for one turn and emit them in call order.
 *
 * A turn can contain any number of requests, so calls and their results are
 * interleaved; a ledger keeps the model's own order and never invents a call
 * for a result that has none.
 */
export class ToolLedger {
  private readonly order: string[] = []
  private readonly calls = new Map<
    string,
    { invocation: ToolInvocation; output?: unknown; status?: "ok" | "error" | "unknown"; endedAt?: number }
  >()
  private orphanResults = 0

  /** Record a call. */
  addInvocation(invocation: ToolInvocation): void {
    if (this.calls.has(invocation.id)) return
    this.order.push(invocation.id)
    this.calls.set(invocation.id, { invocation })
  }

  /** Record its result; a result without a call is counted, not invented. */
  addOutcome(outcome: ToolOutcome): void {
    const entry = this.calls.get(outcome.callId)
    if (entry === undefined) {
      this.orphanResults += 1
      return
    }
    entry.output = outcome.output
    entry.status = outcome.status
    entry.endedAt = outcome.endedAt
  }

  /** How many results had no call in this turn. */
  get orphans(): number {
    return this.orphanResults
  }

  /** The turn's calls, in the order the model made them. */
  toCalls(): ToolCall[] {
    const result: ToolCall[] = []
    for (const id of this.order) {
      const entry = this.calls.get(id)
      if (entry === undefined) continue
      const call: ToolCall = {
        id: entry.invocation.id,
        name: entry.invocation.name,
        input: entry.invocation.input,
        status: entry.status ?? (entry.output === undefined ? "unknown" : "ok"),
        startedAt: entry.invocation.startedAt,
      }
      if (entry.output !== undefined) call.output = entry.output
      if (entry.endedAt !== undefined) call.endedAt = entry.endedAt
      result.push(call)
    }
    return result
  }
}
