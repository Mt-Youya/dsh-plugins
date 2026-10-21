/**
 * Wire types shared by both halves.
 *
 * The envelope shape itself is not this package's: it is generic over the code
 * vocabulary and lives in `@cyrus/dsh-plugin-kit`. What stays here is the vocabulary —
 * the codes a context-insight route may answer with — and the payload types.
 *
 * @module @cyrus/dsh-session-contract/types
 */

import type { Envelope as GenericEnvelope, Fail as GenericFail, Ok as GenericOk } from "@cyrus/dsh-plugin-kit"
import type { Attribution, CompactionPoint, ContextPart, Measure, Turn, Usage } from "./ir.ts"

/**
 * Session sources the panel attributes context for.
 *
 * `codex` and `dsh` are announced ahead of their adapters: the panel renders
 * whatever the Host reports as available, so a source may be listed before its
 * reader exists.
 */
export type ContextSource = "claude" | "dsh" | "codex"

/** Every announced source, in the order the panel renders them. */
export const CONTEXT_SOURCES: readonly ContextSource[] = ["claude", "dsh", "codex"]

/**
 * Stable failure codes. `detail` carries the human-readable specific, this
 * carries the machine-readable class.
 */
export type ApiErrorCode =
  | "bad-request"
  | "method-not-allowed"
  | "forbidden"
  | "not-found"
  | "read-limit"
  | "parse-failed"
  | "source-unavailable"
  | "handoff-unavailable"

/** Every failure code, as one list the decoders can check membership against. */
export const API_ERROR_CODES: readonly ApiErrorCode[] = [
  "bad-request",
  "method-not-allowed",
  "forbidden",
  "not-found",
  "read-limit",
  "parse-failed",
  "source-unavailable",
  "handoff-unavailable",
]

/** Successful answer. */
export type Ok<T> = GenericOk<T>

/** Refusal. `detail` never replaces the code; it refines it. */
export type Fail = GenericFail<ApiErrorCode>

/** The one envelope every route answers with. */
export type Envelope<T> = GenericEnvelope<T, ApiErrorCode>

/** Successful health payload body. */
export interface HealthValue {
  /** Version of the plugin whose Host half answered. */
  version: string
  /** Sources that Host can read; a subset of the announced sources. */
  sources: readonly ContextSource[]
}

/** Health answered; the Host is up and its route is reachable. */
export type HealthOk = Ok<HealthValue>

/** Health refused or unanswered, with a machine-readable reason. */
export type HealthFailure = Omit<Fail, "error"> & { error: string }

/** Everything the health route may answer with. */
export type HealthResponse = HealthOk | HealthFailure

/** One source's availability. */
export interface SourceStatus {
  source: ContextSource
  /** Whether this Host can read the source right now. */
  available: boolean
  /** Why it cannot: `root-missing`, `root-unreadable`, or `adapter-error`. */
  reason?: string
  /** Detail behind `adapter-error`: the adapter's message, bounded. */
  errorDetail?: string
  /** Absolute root the source is read from, when it has one. */
  root?: string
  /** Sessions discovered on the last scan. */
  sessions?: number
  /** Epoch milliseconds of the last scan. */
  lastScanAt?: number
}

/** `/sources` body. One entry per announced source, never fewer. */
export interface SourcesValue {
  sources: SourceStatus[]
}

/** One source's share of a workdir. */
export interface WorkdirSourceGroup {
  source: ContextSource
  sessions: number
  lastUpdatedAt: number
}

/** One workdir row: the panel's navigation axis. */
export interface WorkdirEntry {
  workdir: string
  sessions: number
  lastUpdatedAt: number
  sources: WorkdirSourceGroup[]
}

/** `/workdirs` body. */
export interface WorkdirsValue {
  /** True when this answer is a cached one and a rescan is running. */
  stale?: boolean
  /** True when a rescan was started because the cache was older than the TTL. */
  refreshing?: boolean
  workdirs: WorkdirEntry[]
  /** Epoch milliseconds of the scan that produced this answer. */
  scannedAt: number
  /** Sources that failed for this call; the tree above is still valid. */
  failures: SourceProblem[]
}

/**
 * The token every unparsed session list row carries in `dataQuality`: the row
 * was described from its file header, so its quality tokens are unknown until
 * the session is opened.
 */
export const LIST_ITEM_UNPARSED = "list-item-unparsed"

/** One session row. */
export interface SessionSummary {
  /** 0/absent = a real conversation; > 0 = a subagent run inside its parent. */
  delegationDepth?: number
  source: ContextSource
  id: string
  /** Real filesystem directory the session belongs to; '' when undecodable. */
  workdir: string
  /** Real title only; an id-shaped or absent title is left out. */
  title?: string
  /**
   * First human input, when the header scan could read it (Claude: yes; DSH and
   * Codex: only once the session is parsed). The panel shows it instead of a
   * bare id for an untitled session.
   */
  firstInput?: string
  /** Latest mtime across the session's physical files, epoch milliseconds. */
  updatedAt: number
  /** File size in bytes, the only size fact a header scan has. */
  bytes: number
  /** Quality tokens, or `list-item-unparsed` when only the header was read. */
  dataQuality: string[]
}

/** One source that could not answer, with a stable class and a bounded detail. */
export interface SourceProblem {
  source: ContextSource
  /** `adapter-error`, `root-missing`, `root-unreadable`, `read-limit`, … */
  error: string
  detail?: string
}

/** `/sessions` body. */
export interface SessionsValue {
  /** True when this answer is a cached one and a rescan is running. */
  stale?: boolean
  /** True when a rescan was started because the cache was older than the TTL. */
  refreshing?: boolean
  workdir: string
  /** Rows from every readable source, newest first. */
  sessions: SessionSummary[]
  /** Sources that failed for this call; the rows above are still valid. */
  failures: SourceProblem[]
}

/** One physical file behind a logical session. Basename only, never a path. */
export interface SegmentInfo {
  name: string
  bytes: number
}

/** The session as the panel receives it: turns paged, paths reduced to names. */
export interface SessionDetail {
  session: {
    id: string
    source: ContextSource
    workdir: string
    title?: string
    /** First human input of the session, when one was read. */
    firstInput?: string
    createdAt: number
    updatedAt: number
    /** The requested page of turns, never the whole session. */
    turns: Turn[]
    dataQuality: string[]
    segments: SegmentInfo[]
  }
  /** Turns in the whole session; the pager's denominator. */
  turnCount: number
  offset: number
  limit: number
  meta: {
    /** True when the IR came from the process LRU instead of a fresh parse. */
    cached: boolean
    /** Milliseconds spent producing this answer (parse or cache lookup). */
    elapsedMs: number
    /** Session file size in bytes (sum over segments for multi-file sessions). */
    bytes: number
    /** Turns in the whole session that carry a residual slice. */
    residualTurns: number
    /** Turns in the whole session that were scaled to fit their total. */
    reconciledTurns: number
  }
}

/** Default and maximum page size of `/session`. */
export const DEFAULT_TURN_LIMIT = 60
/** Hard ceiling on one page, so a hand-written URL cannot ask for everything. */
export const MAX_TURN_LIMIT = 200

/** A decoded `turnOffset`/`turnLimit` pair. */
export interface TurnWindow {
  offset: number
  limit: number
}
