/**
 * Pairing DSH tool calls with their results.
 *
 * The log writes them as two independent events that never touch: `tool/call`
 * carries `callId`, `tool/result` carries `message.toolCallId`. A result can
 * arrive in a later step than its call, and a call can end the session with no
 * result at all, which is a legitimate outcome ("unknown") rather than an
 * error. Pairing by id — never by order or by turn — is the only rule that
 * survives retries and parallel calls.
 */

import type { ToolCall } from "@cyrus/dsh-session-contract"
import { arrayField, booleanField, isObject, objectField, stringField, type JsonObject } from "./records.ts"

/** One assembled call, possibly still open. */
interface Pending {
  id: string
  name: string
  input: unknown
  startedAt: number
  output?: unknown
  status: "ok" | "error" | "unknown"
  endedAt?: number
}

/**
 * Parse recorded tool arguments.
 *
 * `tool/call.data.arguments` is a JSON *string*, not an object, so it is parsed
 * once here; a payload that is not JSON is kept verbatim rather than dropped,
 * because it is still what the model sent.
 * @param raw - the recorded argument string.
 */
function parseArguments(raw: string | undefined): unknown {
  if (raw === undefined) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/** Read the text payload of a `tool/result` message. */
function resultOutput(message: JsonObject | undefined): unknown {
  const blocks = arrayField(message, "content")
  if (blocks === undefined) return undefined
  const texts: string[] = []
  for (const block of blocks) {
    if (!isObject(block)) continue
    if (stringField(block, "type") !== "text") continue
    const text = stringField(block, "text")
    if (text !== undefined) texts.push(text)
  }
  if (texts.length === 0) return undefined
  return texts.length === 1 ? texts[0] : texts
}

/** Accumulates the calls of one session. */
export class DshToolLedger {
  private readonly calls: Pending[] = []
  private readonly byId = new Map<string, Pending>()
  private orphanResults = 0
  private errorResults = 0

  /**
   * Register one `tool/call`.
   * @param data - the event's `data`.
   * @param at - the event's timestamp.
   */
  addCall(data: JsonObject, at: number): void {
    const id = stringField(data, "callId")
    const name = stringField(data, "name")
    if (id === undefined || name === undefined) return
    const existing = this.byId.get(id)
    if (existing !== undefined) return
    const call: Pending = {
      id,
      name,
      input: parseArguments(stringField(data, "arguments")),
      startedAt: at,
      status: "unknown",
    }
    this.calls.push(call)
    this.byId.set(id, call)
  }

  /**
   * Attach one `tool/result` to its call.
   * @param data - the event's `data`.
   * @param at - the event's timestamp.
   * @returns true when the result found its call.
   */
  addResult(data: JsonObject, at: number): boolean {
    const message = objectField(data, "message")
    const id = stringField(message, "toolCallId")
    if (id === undefined) {
      this.orphanResults += 1
      return false
    }
    const call = this.byId.get(id)
    if (call === undefined) {
      this.orphanResults += 1
      return false
    }
    const isError = booleanField(message, "isError") === true || objectField(data, "error") !== undefined
    call.output = resultOutput(message)
    call.status = isError ? "error" : "ok"
    call.endedAt = at
    if (isError) this.errorResults += 1
    return true
  }

  /** Results that named no call of this session. */
  get orphans(): number {
    return this.orphanResults
  }

  /** Results that reported an error. */
  get errors(): number {
    return this.errorResults
  }

  /** Calls that received a result. */
  get paired(): number {
    let count = 0
    for (const call of this.calls) if (call.endedAt !== undefined) count += 1
    return count
  }

  /** Calls recorded so far. */
  get size(): number {
    return this.calls.length
  }

  /** Materialize one call, or undefined when the id is unknown. */
  get(id: string): ToolCall | undefined {
    const call = this.byId.get(id)
    if (call === undefined) return undefined
    const out: ToolCall = {
      id: call.id,
      name: call.name,
      input: call.input,
      status: call.status,
      startedAt: call.startedAt,
    }
    if (call.output !== undefined) out.output = call.output
    if (call.endedAt !== undefined) out.endedAt = call.endedAt
    return out
  }

  /** Materialize the calls one turn issued, in call order. */
  callsOf(ids: readonly string[]): ToolCall[] {
    const out: ToolCall[] = []
    for (const id of ids) {
      const call = this.get(id)
      if (call !== undefined) out.push(call)
    }
    return out
  }
}
