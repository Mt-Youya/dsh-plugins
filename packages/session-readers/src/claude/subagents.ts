/**
 * Linking a parent turn to the subagent session it spawned.
 *
 * The chain is: parent `Agent` tool_use → the `toolUseResult.agentId` on the
 * user record that carries its result → `agent-<agentId>.jsonl` next to the
 * session file. All 72 subagent files on this machine resolve this way.
 *
 * Note that `agent-name` records hold the *session* title, not a subagent name;
 * using them here would attach the parent's title to a child.
 */

import { existsSync, readdirSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { isObject, objectField, stringField, type JsonObject } from "./records.ts"

/** Prefix and suffix of a subagent transcript file name. */
const AGENT_PREFIX = "agent-"
const JSONL_SUFFIX = ".jsonl"

/**
 * Whether a path is a subagent transcript.
 *
 * The layout is the classification: `<session>/subagents/agent-<id>.jsonl` is a
 * child, anything else under the project directory is a parent that may still
 * contain copied `isSidechain` records.
 */
export function isSubagentPath(path: string): boolean {
  const directory = basename(dirname(path))
  return directory === "subagents" && basename(path).startsWith(AGENT_PREFIX)
}

/** `<project>/<sessionId>/subagents` for a session file. */
export function subagentDirectory(sessionPath: string): string {
  const stem = basename(sessionPath, JSONL_SUFFIX)
  return join(dirname(sessionPath), stem, "subagents")
}

/**
 * Read the subagent id carried by a tool result record.
 * @param record - any record; only user records with `toolUseResult` qualify.
 */
export function agentIdOf(record: JsonObject): string | undefined {
  const toolUseResult = objectField(record, "toolUseResult")
  if (toolUseResult !== undefined) {
    const agentId = stringField(toolUseResult, "agentId")
    if (agentId !== undefined) return agentId
  }
  const toolUseResultList = record["toolUseResult"]
  if (Array.isArray(toolUseResultList)) {
    for (const item of toolUseResultList) {
      if (!isObject(item)) continue
      const agentId = stringField(item, "agentId")
      if (agentId !== undefined) return agentId
    }
  }
  return undefined
}

/** Absolute path of a subagent transcript, when that file exists. */
export function resolveSubagentFile(sessionPath: string, agentId: string): string | undefined {
  const candidate = join(subagentDirectory(sessionPath), `${AGENT_PREFIX}${agentId}${JSONL_SUFFIX}`)
  return existsSync(candidate) ? candidate : undefined
}

/** Every subagent transcript sitting next to a session file. */
export function listSubagentFiles(sessionPath: string): string[] {
  const directory = subagentDirectory(sessionPath)
  if (!existsSync(directory)) return []
  const names = readdirSync(directory)
  const files: string[] = []
  for (const name of names) {
    if (!name.startsWith(AGENT_PREFIX) || !name.endsWith(JSONL_SUFFIX)) continue
    files.push(join(directory, name))
  }
  return files.sort()
}

/** Agent id encoded in a subagent transcript file name. */
export function agentIdFromFile(file: string): string {
  return basename(file, JSONL_SUFFIX).slice(AGENT_PREFIX.length)
}
