/**
 * Linking a parent turn to the subagent threads it spawned.
 *
 * Two independent witnesses are available and both are used:
 * - event_msg.item_completed with item.type SubAgentActivity states kind,
 *   agent_thread_id and agent_path inside the parent's turn;
 * - the subagent's own rollout starts with a session_meta carrying
 *   parent_thread_id, agent_nickname, agent_role and
 *   subagent_history_start_ordinal.
 * Matching agent_thread_id to the child's session_meta.id is exact on this
 * corpus: 116 files carry agent_nickname and every one of them names a thread.
 */

import { isObject, stringField, type JsonObject } from "./records.ts"

/** One SubAgentActivity item, as the parent session saw it. */
export interface SubagentActivity {
  /** started | interacted | interrupted | completed. */
  kind: string
  /** Thread id of the child; equals its rollout's session_meta.id. */
  threadId: string
  /** Agent path, e.g. /root/media_code_audit. */
  agentPath?: string
}

/**
 * Read a SubAgentActivity item out of an item_completed payload.
 * @param payload - the event_msg payload, not the item.
 */
export function subagentActivityOf(payload: JsonObject): SubagentActivity | undefined {
  const item = payload["item"]
  if (!isObject(item)) return undefined
  if (stringField(item, "type") !== "SubAgentActivity") return undefined
  const threadId = stringField(item, "agent_thread_id")
  if (threadId === undefined) return undefined
  const activity: SubagentActivity = { kind: stringField(item, "kind") ?? "unknown", threadId }
  const agentPath = stringField(item, "agent_path")
  if (agentPath !== undefined) activity.agentPath = agentPath
  return activity
}
