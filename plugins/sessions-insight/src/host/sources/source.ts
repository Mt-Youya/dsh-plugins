/**
 * The one shape every corpus reader implements.
 *
 * Three adapters (Claude, Codex, DSH) produce the same IR, so the routes talk to
 * them through one interface: availability, the workdir aggregation, the light
 * list, the paged parse, and the search candidate list. A source that cannot
 * read its corpus answers with a state instead of throwing, and a source that
 * *does* throw is caught by the route layer and demoted to one failed badge.
 *
 * @module @cyrus/dsh-sessions-insight/host/source
 */

import type { ContextSource, SegmentInfo, SessionSummary, SourceStatus, WorkdirEntry } from "../../protocol.ts"
import { isIdShaped } from "../../protocol.ts"
import type { Session } from "@cyrus/dsh-session-contract"

/** A failure any reader route may answer with. */
export interface SourceFailure {
  ok: false
  error: "bad-request" | "forbidden" | "not-found" | "read-limit" | "parse-failed" | "source-unavailable"
  detail: string
}

/** One parsed session plus the facts around the parse. */
export interface ParsedSession {
  ok: true
  session: Session
  /** Bytes read for this session; the sum over its physical files. */
  bytes: number
  /** Milliseconds the parse itself took (0 on a cache hit). */
  elapsedMs: number
  /** True when the answer came from the LRU rather than a fresh parse. */
  cached: boolean
}

/** One session the search route may scan, newest first. */
export interface SearchCandidate {
  id: string
  workdir: string
  updatedAt: number
  title?: string
  firstInput?: string
}

/** Options every list-shaped read accepts. */
export interface WorkdirOptions {
  /**
   * Include subagent conversations (`delegationDepth > 0`).
   *
   * Off by default: a subagent runs inside its parent's work, so listing it as a
   * sibling session inflates every count and hides the real conversation.
   */
  includeSubagents?: boolean
}

/** A reader for one corpus. */
export interface SessionSource {
  /** Source name; the panel's badge and the route's `source` parameter. */
  readonly id: ContextSource
  /** Availability, root, session count and last scan. */
  status(): Promise<SourceStatus>
  /** This source's share of the workdir tree. */
  workdirs(options?: WorkdirOptions): Promise<WorkdirEntry[]>
  /** Header-level rows for one workdir. */
  list(workdir: string, options?: WorkdirOptions): Promise<SessionSummary[]>
  /** Parse (or serve from the LRU) one session. */
  detail(id: string): Promise<ParsedSession | SourceFailure>
  /** Physical files behind a parsed session, by name and size. */
  segmentInfo(session: Session): Promise<SegmentInfo[]>
  /** Delete the original logs, when this adapter supports deletion. */
  remove?(id: string): Promise<{ ok: true } | SourceFailure>
  /** Drop every cache this source holds. */
  invalidate(): void
  /** Sessions a search may scan, newest first. */
  candidates(): Promise<SearchCandidate[]>
}

/**
 * Drop a title that is really an identifier.
 * @param title - the raw title an adapter produced, if any.
 * @param id - the session id, also refused as a title.
 * @returns the usable title, or undefined when the panel should fall back.
 */
export function cleanTitle(title: string | undefined, id: string): string | undefined {
  if (title === undefined) return undefined
  const trimmed = title.trim()
  if (trimmed === "") return undefined
  if (trimmed === id) return undefined
  if (isIdShaped(trimmed)) return undefined
  return trimmed
}

/**
 * The first human input of a parsed session.
 * @param session - a parsed session.
 * @returns the first turn's first user text, trimmed to a readable length.
 */
export function firstInputOf(session: Session): string | undefined {
  const text = session.turns[0]?.userInput[0]
  if (text === undefined) return undefined
  const trimmed = text.trim()
  if (trimmed === "") return undefined
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed
}

/**
 * Bounded snippet around the first case-insensitive match.
 * @param haystack - text to search.
 * @param needle - already-lowercased query.
 * @param width - characters of context on each side.
 * @returns the snippet, or undefined when the haystack does not contain it.
 */
export function snippetAround(haystack: string, needle: string, width = 80): string | undefined {
  const index = haystack.toLowerCase().indexOf(needle)
  if (index < 0) return undefined
  const start = Math.max(0, index - width)
  const end = Math.min(haystack.length, index + needle.length + width)
  const prefix = start > 0 ? "…" : ""
  const suffix = end < haystack.length ? "…" : ""
  return prefix + haystack.slice(start, end).replace(/\s+/g, " ").trim() + suffix
}

/**
 * Total bytes across a session's physical files.
 * @param sizes - one entry per file.
 */
export function totalBytes(sizes: readonly number[]): number {
  let sum = 0
  for (const size of sizes) sum += size
  return sum
}
