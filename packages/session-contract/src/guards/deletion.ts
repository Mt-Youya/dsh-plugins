import { CONTEXT_SOURCES, type ContextSource } from "../types.ts"
import { isSafeId } from "./ids.ts"
import { isRecord } from "./shared.ts"
import { isContextSource } from "./sources.ts"

/**
 * Sources whose original logs the panel may delete after a confirmation.
 *
 * The three built-in adapters own their files. The harness families read live
 * application databases (Cursor, VS Code, Antigravity, Cline) and are read-only,
 * so the panel hides their delete action instead of offering an action that
 * always fails.
 */
export const DELETABLE_SOURCES = ["claude", "dsh", "codex"] as const satisfies readonly ContextSource[]

/** Whether a source's logs may be deleted through the plugin. */
export function isDeletableSource(source: ContextSource): boolean {
  return (DELETABLE_SOURCES as readonly ContextSource[]).includes(source)
}

/** Sources the panel announces but never writes to. */
export const READ_ONLY_SOURCES = CONTEXT_SOURCES.filter((source) => !isDeletableSource(source))

export interface DeleteSessionValue {
  source: ContextSource
  id: string
}

export function isDeleteSessionValue(value: unknown): value is DeleteSessionValue {
  return isRecord(value) && isContextSource(value["source"]) && typeof value["id"] === "string" && isSafeId(value["id"])
}
