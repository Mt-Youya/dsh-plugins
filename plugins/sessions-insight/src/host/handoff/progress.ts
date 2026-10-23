import type { HandoffStatusValue } from "../../protocol.ts"
import type { ObservedEvent } from "../sources/dsh-events.ts"

/** Report observed activity, without treating an unfinished tool as a failed turn. */
export function handoffProgress(events: readonly ObservedEvent[]): HandoffStatusValue["progress"] {
  const last = events[events.length - 1]
  if (last === undefined) return undefined
  const pending = new Map<string, string>()
  let toolsCompleted = 0
  for (const event of events) {
    if (typeof event.data !== "object" || event.data === null) continue
    const data = event.data as Record<string, unknown>
    if (event.type === "tool/call" && typeof data.callId === "string" && typeof data.name === "string") {
      pending.set(data.callId, data.name)
    }
    if (event.type === "tool/result") {
      toolsCompleted += 1
      if (typeof data.callId === "string") pending.delete(data.callId)
      const message = data.message as { toolCallId?: unknown } | undefined
      if (typeof message?.toolCallId === "string") pending.delete(message.toolCallId)
    }
  }
  const tool = [...pending.values()].at(-1)
  return { seq: last.seq, updatedAt: last.time, toolsCompleted, ...(tool === undefined ? {} : { tool }) }
}
