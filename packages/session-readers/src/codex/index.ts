/**
 * Codex adapter entry point.
 *
 * The adapter is split by responsibility: segments.ts reads rollout files and
 * their history_base chain, assemble.ts resolves a path into the files to parse,
 * session.ts runs the record stream into turns, stats.ts accounts for it and
 * attribution.ts measures the window. This module is the barrel that keeps the
 * names callers already import, plus the public read entry.
 *
 * @see docs/IR.md (adapter 必须遵守, 对账的边界)
 * @module @cyrus/dsh-sessions-insight/core/codex
 */

import { resolveRead, type CodexReadOptions } from "./assemble.ts"
import { openCodexSession } from "./session.ts"
import type { CodexReadResult } from "./stats.ts"

export type { CodexReadOptions, Planned, ResolvedRead } from "./assemble.ts"
export type { CodexReadResult, CodexReadStats, SessionFacts } from "./stats.ts"

/**
 * Parse one Codex session.
 *
 * Pass the first segment and the index resolves the continuation chain; pass a
 * subagent rollout and the child thread is parsed instead (its Session.id is
 * the child thread id, so the panel never merges a child into its parent).
 * @param path - any rollout file of the session.
 * @param options - see CodexReadOptions.
 */
export async function readCodexSession(path: string, options: CodexReadOptions = {}): Promise<CodexReadResult> {
  const started = Date.now()
  return openCodexSession(path, resolveRead(path, options), started)
}
