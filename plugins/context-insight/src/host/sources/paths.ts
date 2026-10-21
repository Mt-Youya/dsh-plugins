/**
 * Filesystem boundary for every read this plugin performs.
 *
 * Two separate jobs live here: naming the one configurable root, and proving
 * that a candidate path still sits inside it after symlinks and `..` have been
 * resolved. Session ids are additionally whitelisted before they are ever
 * joined, so the containment check is the second line rather than the only one.
 *
 * @see docs/API.md (路径参数只接受白名单根目录下的已存在路径)
 * @module @cyrus/dsh-context-insight/host/paths
 */

import { realpath } from "node:fs/promises"
import { homedir } from "node:os"
import { isAbsolute, join, relative } from "node:path"

/** Environment variable that relocates the Claude corpus (tests, alt installs). */
export const CLAUDE_ROOT_ENV = "DSH_CONTEXT_INSIGHT_CLAUDE_ROOT"
/** Environment variable that relocates the Codex corpus. */
export const CODEX_ROOT_ENV = "DSH_CONTEXT_INSIGHT_CODEX_ROOT"
/** Environment variable that relocates the DSH sessions root. */
export const DSH_ROOT_ENV = "DSH_CONTEXT_INSIGHT_DSH_ROOT"

/**
 * Resolve the Claude projects root.
 * @param env - process environment.
 * @returns the configured root, or `~/.claude/projects`.
 */
export function claudeRootFrom(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env[CLAUDE_ROOT_ENV]
  if (configured !== undefined && configured.trim() !== "") return configured
  return join(homedir(), ".claude", "projects")
}

/**
 * Resolve the Codex sessions root.
 * @param env - process environment.
 * @returns the configured root, or `~/.codex/sessions`.
 */
export function codexRootFrom(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env[CODEX_ROOT_ENV]
  if (configured !== undefined && configured.trim() !== "") return configured
  return join(homedir(), ".codex", "sessions")
}

/**
 * Where *this Host* writes its own sessions — the tree a handoff is observed in.
 *
 * Deliberately separate from {@link dshRootFrom}: the corpus a panel reads may
 * be relocated for evidence collection, but the sessions this instance creates
 * always live under its own `DSH_HOME`.
 * @param env - process environment.
 * @returns `$DSH_HOME/sessions`, or `~/.dsh/sessions` when unset.
 */
export function hostSessionsRoot(env: NodeJS.ProcessEnv = process.env): string {
  const home = env["DSH_HOME"]
  const root = home !== undefined && home.trim() !== "" ? home : join(homedir(), ".dsh")
  return join(root, "sessions")
}

/**
 * Resolve the DSH sessions root.
 * @param env - process environment.
 * @returns the configured root, or `~/.dsh/sessions`.
 */
export function dshRootFrom(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env[DSH_ROOT_ENV]
  if (configured !== undefined && configured.trim() !== "") return configured
  // The Host's own home wins: an isolated `DSH_HOME` instance must read (and be
  // observed in) its own sessions, never the production tree.
  const home = env["DSH_HOME"]
  const root = home !== undefined && home.trim() !== "" ? home : join(homedir(), ".dsh")
  return join(root, "sessions")
}

/**
 * Decode a Claude project directory name back into a path.
 *
 * Claude encodes a workdir by replacing every separator with `-`, which is not
 * invertible: `-Users-me-codes-my-app-v2` could be `/Users/me/codes/my/app/v2`
 * or `/Users/me/codes/my-app-v2`. The transcript's own `cwd` field is therefore
 * the authoritative source whenever it exists; this decoder is the fallback
 * for files whose header scan found none, and the panel marks it as decoded.
 * @param name - a directory name under the projects root, e.g. `-Users-me-proj`.
 * @returns the naive decoded path, or `''` when the name carries no encoding.
 */
export function decodeProjectDirName(name: string): string {
  if (!name.startsWith("-")) return ""
  return name.replace(/-/g, "/")
}

/**
 * Whether a resolved path is inside a resolved root.
 * Pure string logic, split out so the rule is testable without touching disk.
 * @param rootReal - realpath of the whitelisted root.
 * @param candidateReal - realpath of the candidate.
 * @returns true when the candidate is the root itself or a descendant.
 */
export function isWithin(rootReal: string, candidateReal: string): boolean {
  if (candidateReal === rootReal) return true
  const rel = relative(rootReal, candidateReal)
  if (rel === "") return true
  if (isAbsolute(rel)) return false
  return rel !== ".." && !rel.startsWith(`..`)
}

/**
 * Resolve a candidate and prove it stays inside the root.
 * Both sides are realpath'd first, so a symlink pointing outside the corpus is
 * rejected even when its own path is inside.
 * @param root - the whitelisted root as configured.
 * @param candidate - the path to admit (may not exist).
 * @returns the realpath when admitted, undefined when missing or escaping.
 */
export async function resolveInside(root: string, candidate: string): Promise<string | undefined> {
  let rootReal: string
  let candidateReal: string
  try {
    rootReal = await realpath(root)
    candidateReal = await realpath(candidate)
  } catch {
    return undefined
  }
  return isWithin(rootReal, candidateReal) ? candidateReal : undefined
}
