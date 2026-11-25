/**
 * The generic reader every harness family shares.
 *
 * Claude, Codex and DSH each need their own record flow, but the harness
 * families — Cursor's SQLite composers, pi's JSONL, the VS Code
 * `chatSessions` JSON and the Cline/Roo task directories — differ only in how
 * one session is discovered and parsed. Everything around that (the scan TTL,
 * the session LRU, the workdir aggregation, the list rows, the failure shape)
 * is the same problem four times, so it lives here once.
 *
 * A family plugs in as a {@link HarnessCorpus}: a whitelisted root, a scan that
 * answers rows without parsing bodies, and a read that turns one row into the
 * shared IR. One {@link HarnessSource} can hold several corpora when one badge
 * covers several apps (VS Code's forks, Cline and Roo), which is also why each
 * corpus names the app it read.
 *
 * Every new family is read-only: none of these tools documents a safe deletion
 * path, so the sources implement no `remove` and the delete route answers
 * `source-unavailable` instead of writing into a live application database.
 *
 * @see docs/adr/0011-storage-family-sources.md
 * @module @cyrusdoyle/dsh-sessions-insight/host/harness
 */

import { stat } from "node:fs/promises"
import { basename } from "node:path"

import { Lru } from "@cyrusdoyle/dsh-plugin-kit-host"
import type { Session } from "@cyrusdoyle/dsh-session-contract"

import type { ContextSource, SegmentInfo, SessionSummary, SourceStatus, WorkdirEntry } from "../../../protocol.ts"
import { LIST_ITEM_UNPARSED } from "../../../protocol.ts"
import type { ParsedSession, SearchCandidate, SessionSource, SourceFailure } from "../source.ts"

/** Milliseconds a corpus scan is reused before walking the store again. */
export const HARNESS_SCAN_TTL_MS = 30_000

/** Largest single session the harness readers will parse. */
export const HARNESS_MAX_SESSION_BYTES = 64 * 1024 * 1024

/** Parsed sessions kept live across sources; each holds every turn's IR. */
export const HARNESS_CACHE_ENTRIES = 4

/** One session as a scan can describe it without parsing a body. */
export interface HarnessRow {
  /** Id the panel shows and the routes receive; must satisfy the contract's `isSafeId`. */
  id: string
  /** The file (or database key) the row is read from, for cache keys and segment info. */
  locator: string
  /** Real directory the session belongs to; `''` when the store does not say. */
  workdir: string
  title?: string
  firstInput?: string
  bytes: number
  updatedAt: number
}

/** One corpus scan. */
export interface HarnessScan {
  state: "ok" | "missing" | "unreadable"
  rows: HarnessRow[]
  scannedAt: number
}

/** One storage family, as the generic source drives it. */
export interface HarnessCorpus {
  /** Application name for diagnostics, e.g. `Kiro` or `Roo Code`. */
  readonly app: string
  /** Whitelisted root; every read must still resolve inside it. */
  readonly root: string
  /** Discover sessions without parsing their bodies. */
  scan(): Promise<HarnessScan>
  /** Parse one row into the shared IR. */
  read(row: HarnessRow): Promise<Session>
}

/** One discovered row plus the corpus that owns it. */
interface LocatedRow {
  row: HarnessRow
  corpus: HarnessCorpus
}

interface MergedScan {
  state: "ok" | "missing" | "unreadable"
  rows: LocatedRow[]
  scannedAt: number
  /** Root of the first corpus that answered, for the status tooltip. */
  root: string
}

interface CachedSession {
  session: Session
  bytes: number
  elapsedMs: number
}

/**
 * One or more corpora behind one source badge.
 *
 * Reads are lazy: a scan only stats files and reads headers, and the IR parse
 * happens when a session is opened, cached by locator + mtime + size so a
 * rewritten log is never served from a stale slot.
 */
export class HarnessSource implements SessionSource {
  readonly id: ContextSource
  readonly #corpora: readonly HarnessCorpus[]
  readonly #maxSessionBytes: number
  readonly #scanTtlMs: number
  readonly #parsed: Lru<CachedSession>
  #scan: MergedScan | undefined
  #inflight: Promise<MergedScan> | undefined

  constructor(options: {
    id: ContextSource
    corpora: readonly HarnessCorpus[]
    scanTtlMs?: number
    maxSessionBytes?: number
    cacheEntries?: number
  }) {
    this.id = options.id
    this.#corpora = options.corpora
    this.#scanTtlMs = options.scanTtlMs ?? HARNESS_SCAN_TTL_MS
    this.#maxSessionBytes = options.maxSessionBytes ?? HARNESS_MAX_SESSION_BYTES
    this.#parsed = new Lru<CachedSession>(options.cacheEntries ?? HARNESS_CACHE_ENTRIES)
  }

  /** Whitelisted roots this reader is confined to. */
  get roots(): string[] {
    return this.#corpora.map((corpus) => corpus.root)
  }

  /**
   * Walk every corpus, reusing the last scan inside its TTL.
   * Concurrent callers share one walk: the panel fires workdirs and sessions
   * together on open.
   * @returns the merged scan.
   */
  async scan(): Promise<MergedScan> {
    const fresh = this.#scan
    if (fresh !== undefined && Date.now() - fresh.scannedAt < this.#scanTtlMs) return fresh
    const inflight = this.#inflight
    if (inflight !== undefined) return inflight
    const started = (async (): Promise<MergedScan> => {
      try {
        return await this.#walk()
      } finally {
        this.#inflight = undefined
      }
    })()
    this.#inflight = started
    const scan = await started
    this.#scan = scan
    return scan
  }

  /** Drop every cache; the next call re-walks and re-parses. */
  invalidate(): void {
    this.#scan = undefined
    this.#parsed.clear()
  }

  async #walk(): Promise<MergedScan> {
    const scannedAt = Date.now()
    const rows: LocatedRow[] = []
    let best: HarnessScan["state"] = "missing"
    let root = this.#corpora[0]?.root ?? ""
    for (const corpus of this.#corpora) {
      let scan: HarnessScan
      try {
        scan = await corpus.scan()
      } catch {
        // One app's store failing must not hide the other apps in the family.
        if (best !== "ok") best = "unreadable"
        continue
      }
      if (scan.state === "ok") {
        best = "ok"
        if (root === this.#corpora[0]?.root) root = corpus.root
        for (const row of scan.rows) rows.push({ row, corpus })
        continue
      }
      if (scan.state === "unreadable" && best !== "ok") best = "unreadable"
    }
    // Newest first is the panel's contract for every source.
    rows.sort((a, b) => b.row.updatedAt - a.row.updatedAt)
    return { state: best, rows, scannedAt, root }
  }

  async status(): Promise<SourceStatus> {
    const scan = await this.scan()
    if (scan.state !== "ok") {
      return {
        source: this.id,
        available: false,
        reason: scan.state === "missing" ? "root-missing" : "root-unreadable",
        root: scan.root,
        lastScanAt: scan.scannedAt,
      }
    }
    return {
      source: this.id,
      available: true,
      root: scan.root,
      sessions: scan.rows.length,
      lastScanAt: scan.scannedAt,
    }
  }

  async workdirs(): Promise<WorkdirEntry[]> {
    const scan = await this.scan()
    const byWorkdir = new Map<string, WorkdirEntry>()
    for (const { row } of scan.rows) {
      if (row.workdir === "") continue
      const existing = byWorkdir.get(row.workdir)
      if (existing === undefined) {
        byWorkdir.set(row.workdir, {
          workdir: row.workdir,
          sessions: 1,
          lastUpdatedAt: row.updatedAt,
          sources: [{ source: this.id, sessions: 1, lastUpdatedAt: row.updatedAt }],
        })
        continue
      }
      existing.sessions += 1
      if (row.updatedAt > existing.lastUpdatedAt) existing.lastUpdatedAt = row.updatedAt
      const group = existing.sources[0]
      if (group === undefined) continue
      group.sessions += 1
      if (row.updatedAt > group.lastUpdatedAt) group.lastUpdatedAt = row.updatedAt
    }
    return [...byWorkdir.values()].sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt)
  }

  async list(workdir: string): Promise<SessionSummary[]> {
    const scan = await this.scan()
    const rows: SessionSummary[] = []
    for (const { row } of scan.rows) {
      if (row.workdir !== workdir) continue
      const summary: SessionSummary = {
        source: this.id,
        id: row.id,
        workdir: row.workdir,
        updatedAt: row.updatedAt,
        bytes: row.bytes,
        dataQuality: [LIST_ITEM_UNPARSED],
      }
      if (row.title !== undefined) summary.title = row.title
      if (row.firstInput !== undefined) summary.firstInput = row.firstInput
      rows.push(summary)
    }
    return rows
  }

  async detail(id: string): Promise<ParsedSession | SourceFailure> {
    const scan = await this.scan()
    const located = scan.rows.find((candidate) => candidate.row.id === id)
    if (located === undefined) return { ok: false, error: "not-found", detail: "session-not-found" }
    if (located.row.bytes > this.#maxSessionBytes) {
      return { ok: false, error: "read-limit", detail: "session-too-large" }
    }
    const key = `${located.row.locator}:${String(located.row.updatedAt)}:${String(located.row.bytes)}`
    const cached = this.#parsed.get(key)
    if (cached !== undefined) {
      return { ok: true, session: cached.session, bytes: cached.bytes, elapsedMs: 0, cached: true }
    }
    const started = Date.now()
    let session: Session
    try {
      session = await located.corpus.read(located.row)
    } catch (error) {
      return {
        ok: false,
        error: "parse-failed",
        detail: error instanceof Error ? error.message.slice(0, 200) : "harness-parse-failed",
      }
    }
    const elapsedMs = Date.now() - started
    const bytes = located.row.bytes
    this.#parsed.set(key, { session, bytes, elapsedMs })
    return { ok: true, session, bytes, elapsedMs, cached: false }
  }

  async segmentInfo(session: Session): Promise<SegmentInfo[]> {
    const info: SegmentInfo[] = []
    for (const path of session.segments) {
      try {
        const stat_ = await stat(path)
        info.push({ name: basename(path), bytes: stat_.size })
      } catch {
        // A segment the store no longer has is worth naming without a size.
        info.push({ name: basename(path), bytes: 0 })
      }
    }
    return info
  }

  async candidates(): Promise<SearchCandidate[]> {
    const scan = await this.scan()
    return scan.rows.map(({ row }) => {
      const candidate: SearchCandidate = { id: row.id, workdir: row.workdir, updatedAt: row.updatedAt }
      if (row.title !== undefined) candidate.title = row.title
      if (row.firstInput !== undefined) candidate.firstInput = row.firstInput
      return candidate
    })
  }
}

/** Trim a header excerpt to the same bound Claude and Codex use. */
export const HARNESS_EXCERPT_LIMIT = 200

/**
 * First human line of a session, trimmed for a list row.
 * @param text - raw first input.
 * @returns the excerpt, or undefined when there is none.
 */
export function excerptOf(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  const trimmed = text.replace(/\s+/g, " ").trim()
  if (trimmed === "") return undefined
  return trimmed.length > HARNESS_EXCERPT_LIMIT ? trimmed.slice(0, HARNESS_EXCERPT_LIMIT) : trimmed
}
