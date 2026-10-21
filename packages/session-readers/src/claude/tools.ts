/**
 * Pairing `tool_use` with `tool_result`.
 *
 * The transcript stores the call in an assistant record and the result in the
 * next user record, so a turn's tool list can only be closed by walking both.
 * The corpus pairs 4,145 calls with zero orphans by `tool_use.id`; anything
 * that does not pair stays `unknown` rather than being dropped.
 */

import type { ToolCall } from "@cyrus/dsh-session-contract"
import {
  arrayField,
  booleanField,
  epochOf,
  isObject,
  objectArrayField,
  objectField,
  stringField,
  type JsonObject,
} from "./records.ts"

/** A `tool_use` content block. */
export interface ToolInvocation {
  id: string
  name: string
  input: unknown
  startedAt: number
}

/** A `tool_result` content block. */
export interface ToolOutcome {
  toolUseId: string
  isError: boolean
  output: unknown
  endedAt: number
}

/** Every `tool_use` block of an assistant record. */
export function toolInvocations(record: JsonObject, at: number): ToolInvocation[] {
  const message = objectField(record, "message")
  if (message === undefined) return []
  const list = arrayField(message, "content")
  if (list === undefined) return []
  const result: ToolInvocation[] = []
  for (const block of list) {
    if (!isObject(block) || stringField(block, "type") !== "tool_use") continue
    const id = stringField(block, "id")
    if (id === undefined) continue
    result.push({
      id,
      name: stringField(block, "name") ?? "unknown",
      input: block["input"] ?? null,
      startedAt: at,
    })
  }
  return result
}

/** Every `tool_result` block of a user record. */
export function toolOutcomes(record: JsonObject, at: number): ToolOutcome[] {
  const message = objectField(record, "message")
  if (message === undefined) return []
  const list = arrayField(message, "content")
  if (list === undefined) return []
  const result: ToolOutcome[] = []
  for (const block of list) {
    if (!isObject(block) || stringField(block, "type") !== "tool_result") continue
    const toolUseId = stringField(block, "tool_use_id")
    if (toolUseId === undefined) continue
    result.push({
      toolUseId,
      isError: booleanField(block, "is_error") === true,
      output: block["content"] ?? null,
      endedAt: at,
    })
  }
  return result
}

/**
 * Collect calls and results for one turn and emit them in call order.
 *
 * Kept as a ledger (rather than pairing two arrays after the fact) because a
 * turn can contain any number of assistant records and results arrive in the
 * user records that follow each of them.
 */
export class ToolLedger {
  private readonly order: string[] = []
  private readonly calls = new Map<
    string,
    { invocation: ToolInvocation; output?: unknown; isError?: boolean; endedAt?: number }
  >()
  private orphanResults = 0

  /** Record a call. */
  addInvocation(invocation: ToolInvocation): void {
    if (this.calls.has(invocation.id)) return
    this.order.push(invocation.id)
    this.calls.set(invocation.id, { invocation })
  }

  /** Record its result; results without a call are counted, not invented. */
  addOutcome(outcome: ToolOutcome): void {
    const entry = this.calls.get(outcome.toolUseId)
    if (entry === undefined) {
      this.orphanResults += 1
      return
    }
    entry.output = outcome.output
    entry.isError = outcome.isError
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
        status: entry.isError === undefined ? "unknown" : entry.isError ? "error" : "ok",
        startedAt: entry.invocation.startedAt,
      }
      if (entry.output !== undefined) call.output = entry.output
      if (entry.endedAt !== undefined) call.endedAt = entry.endedAt
      result.push(call)
    }
    return result
  }
}

/** Timestamp of a record, defaulting to 0 when the record carries none. */
export function recordTime(record: JsonObject): number {
  return epochOf(record) ?? 0
}

/** Every `toolUseResult` object payload, which is where subagent ids live. */
export function toolUseResults(record: JsonObject): JsonObject[] {
  const direct = objectField(record, "toolUseResult")
  if (direct !== undefined) return [direct]
  return objectArrayField(record, "toolUseResult")
}
