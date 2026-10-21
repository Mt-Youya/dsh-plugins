/**
 * Codex corpus reader.
 *
 * One Codex session is a *chain* of rollout files linked by `history_base`, not
 * one file — the corpus here holds a 9-file session. Two consequences shape
 * this reader:
 *
 * - discovery reuses `indexCodexCorpus`, which reads only each rollout's first
 *   record (decompressing just its first zstd frame), so 260 files are indexed
 *   without parsing bodies;
 * - invalidation keys on the whole chain: the newest mtime and the summed byte
 *   count across every segment, so touching *any* segment drops the parse.
 *
 * @see docs/PLAN.md (Codex 归一化红线)
 * @module @cyrus/dsh-context-insight/host/codex
 */

import { fingerprintOf, readSnapshot, snapshotPath, walkFingerprint, writeSnapshot } from "./snapshot.ts"
import { readdir, stat } from "node:fs/promises"
import { basename } from "node:path"
import { readCodexSession } from "@cyrus/dsh-session-readers"
import {
  defaultCodexRoot,
  indexCodexCorpus,
  type CodexCorpusIndex,
  type CodexFile,
  type CodexSessionPlan,
} from "@cyrus/dsh-session-readers"
import type { Session } from "@cyrus/dsh-session-contract"
import type { SegmentInfo, SessionSummary, SourceStatus, WorkdirEntry } from "../../protocol.ts"
import { LIST_ITEM_UNPARSED, isSafeId } from "../../protocol.ts"
import type { ParsedSession, SearchCandidate, SessionSource, SourceFailure } from "./source.ts"
import { cleanTitle, firstInputOf } from "./source.ts"
import { Lru } from "@cyrus/dsh-plugin-kit-host"

/** Milliseconds the corpus index is reused before re-indexing. */
export const DEFAULT_CODEX_SCAN_TTL_MS = 30_000

/** Largest summed session size this reader will parse. */
export const DEFAULT_CODEX_MAX_BYTES = 128 * 1024 * 1024

/** Parsed sessions kept live. */
export const DEFAULT_CODEX_CACHE_ENTRIES = 4

/** Configuration of one Codex reader. */
export interface CodexSourceConfig {
  /** Corpus root; every rollout under it belongs to this reader. */
  root?: string
  scanTtlMs?: number
  /** Snapshot path override (tests). */
  indexPath?: string
  maxSessionBytes?: number
  cacheEntries?: number
}

/** One physical segment with the facts invalidation needs. */
export interface CodexSegmentFile {
  path: string
  bytes: number
  mtimeMs: number
}

/** One logical session ready for listing. */
export interface CodexEntry {
  /** Logical session id, shared by every segment and subagent thread. */
  id: string
  workdir: string
  /** First file of the chain in history order. */
  firstPath: string
  segments: CodexSegmentFile[]
  bytes: number
  /** Newest mtime across the chain. */
  updatedAt: number
}

interface CodexScan {
  root: string
  state: "ok" | "missing" | "unreadable"
  entries: CodexEntry[]
  index?: CodexCorpusIndex
  scannedAt: number
}

interface CachedSession {
  session: Session
  bytes: number
  elapsedMs: number
}

/**
 * Invalidation key for one session.
 *
 * Every segment contributes: a session is one chain of files, so a new segment,
 * a touched segment or a longer chain must all miss the cache.
 * @param entry - the session's chain facts.
 * @returns the key the LRU is addressed with.
 */
export function codexChainKey(entry: { id: string; updatedAt: number; bytes: number }): string {
  return `codex:${entry.id}:${String(entry.updatedAt)}:${String(entry.bytes)}`
}

function filesOf(plan: CodexSessionPlan): CodexFile[] {
  const files: CodexFile[] = [...plan.root.files]
  for (const child of plan.children) files.push(...child.files)
  // A subagent file can also be listed as a root segment of its own thread; keep
  // each path once so the byte count is not doubled.
  const seen = new Set<string>()
  return files.filter((file) => (seen.has(file.path) ? false : (seen.add(file.path), true)))
}

/** Codex corpus reader. One instance per Host fiber. */
export class CodexSource implements SessionSource {
  readonly id = "codex" as const
  readonly #root: string
  readonly #scanTtlMs: number
  readonly #maxSessionBytes: number
  readonly #parsed: Lru<CachedSession>
  #scan: CodexScan | undefined
  readonly #indexPath: string

  constructor(config: CodexSourceConfig = {}) {
    this.#root = config.root ?? defaultCodexRoot()
    this.#scanTtlMs = config.scanTtlMs ?? DEFAULT_CODEX_SCAN_TTL_MS
    this.#indexPath = config.indexPath ?? snapshotPath()
    this.#maxSessionBytes = config.maxSessionBytes ?? DEFAULT_CODEX_MAX_BYTES
    this.#parsed = new Lru<CachedSession>(config.cacheEntries ?? DEFAULT_CODEX_CACHE_ENTRIES)
  }

  /** The corpus root this reader is confined to. */
  get root(): string {
    return this.#root
  }

  /** Drop every cache; the next call re-indexes and re-parses. */
  invalidate(): void {
    this.#scan = undefined
    this.#parsed.clear()
  }

  /**
   * Index the corpus inside its TTL.
   *
   * `indexCodexCorpus` is synchronous CPU work (~1.5 s for 260 rollouts), so it
   * must not run per request: the panel asks for sources, workdirs and sessions
   * together on open.
   * @returns the scan.
   */
  async scan(): Promise<CodexScan> {
    const fresh = this.#scan
    if (fresh !== undefined && Date.now() - fresh.scannedAt < this.#scanTtlMs) return fresh
    const scannedAt = Date.now()
    // Cheap file-set fingerprint first: when nothing changed, the previous scan
    // is reused without decompressing a single rollout.
    const files = await walkFingerprint(this.#root, (name) => name.endsWith(".jsonl") || name.startsWith("rollout-"))
    const fingerprint = fingerprintOf(files)
    const cachedEntries = await readSnapshot<CodexEntry>(this.#indexPath, "codex", fingerprint)
    if (cachedEntries !== undefined) {
      const scan: CodexScan = { root: this.#root, state: "ok", entries: cachedEntries, scannedAt }
      this.#scan = scan
      return scan
    }
    let entries
    try {
      entries = await readdir(this.#root, { withFileTypes: true })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      const state = code === "ENOENT" ? "missing" : "unreadable"
      const scan: CodexScan = { root: this.#root, state, entries: [], scannedAt }
      this.#scan = scan
      return scan
    }
    void entries
    let index: CodexCorpusIndex
    try {
      index = indexCodexCorpus(this.#root)
    } catch {
      const scan: CodexScan = { root: this.#root, state: "unreadable", entries: [], scannedAt }
      this.#scan = scan
      return scan
    }
    const rows: CodexEntry[] = []
    for (const plan of index.sessions.values()) {
      const files = filesOf(plan)
      if (files.length === 0) continue
      const segments: CodexSegmentFile[] = []
      let updatedAt = 0
      let bytes = 0
      for (const file of files) {
        let info
        try {
          info = await stat(file.path)
        } catch {
          continue
        }
        segments.push({ path: file.path, bytes: info.size, mtimeMs: Math.round(info.mtimeMs) })
        bytes += info.size
        if (info.mtimeMs > updatedAt) updatedAt = Math.round(info.mtimeMs)
      }
      if (segments.length === 0) continue
      rows.push({
        id: plan.id,
        workdir: plan.workdir,
        firstPath: segments[0]?.path ?? files[0]?.path ?? "",
        segments,
        bytes,
        updatedAt,
      })
    }
    rows.sort((a, b) => b.updatedAt - a.updatedAt)
    const scan: CodexScan = { root: this.#root, state: "ok", entries: rows, index, scannedAt }
    this.#scan = scan
    return scan
  }

  async status(): Promise<SourceStatus> {
    const scan = await this.scan()
    if (scan.state !== "ok") {
      return {
        source: "codex",
        available: false,
        reason: scan.state === "missing" ? "root-missing" : "root-unreadable",
        root: scan.root,
        lastScanAt: scan.scannedAt,
      }
    }
    return {
      source: "codex",
      available: true,
      root: scan.root,
      sessions: scan.entries.length,
      lastScanAt: scan.scannedAt,
    }
  }

  async workdirs(): Promise<WorkdirEntry[]> {
    const scan = await this.scan()
    const grouped = new Map<string, WorkdirEntry>()
    for (const entry of scan.entries) {
      const existing = grouped.get(entry.workdir)
      if (existing === undefined) {
        grouped.set(entry.workdir, {
          workdir: entry.workdir,
          sessions: 1,
          lastUpdatedAt: entry.updatedAt,
          sources: [{ source: "codex", sessions: 1, lastUpdatedAt: entry.updatedAt }],
        })
        continue
      }
      existing.sessions += 1
      if (entry.updatedAt > existing.lastUpdatedAt) existing.lastUpdatedAt = entry.updatedAt
      const group = existing.sources[0]
      if (group !== undefined) {
        group.sessions += 1
        if (entry.updatedAt > group.lastUpdatedAt) group.lastUpdatedAt = entry.updatedAt
      }
    }
    return [...grouped.values()].sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt)
  }

  /** Invalidation key: the whole chain contributes. */
  #key(entry: CodexEntry): string {
    return codexChainKey(entry)
  }

  async list(workdir: string): Promise<SessionSummary[]> {
    const scan = await this.scan()
    const rows: SessionSummary[] = []
    for (const entry of scan.entries) {
      if (entry.workdir !== workdir) continue
      const cached = this.#parsed.get(this.#key(entry))
      const summary: SessionSummary = {
        source: "codex",
        id: entry.id,
        workdir: entry.workdir,
        updatedAt: entry.updatedAt,
        bytes: entry.bytes,
        dataQuality: cached === undefined ? [LIST_ITEM_UNPARSED] : cached.session.dataQuality,
      }
      const title = cleanTitle(cached?.session.title, entry.id)
      if (title !== undefined) summary.title = title
      const firstInput = cached === undefined ? undefined : firstInputOf(cached.session)
      if (firstInput !== undefined) summary.firstInput = firstInput
      rows.push(summary)
    }
    return rows
  }

  async candidates(): Promise<SearchCandidate[]> {
    const scan = await this.scan()
    return scan.entries.map((entry) => {
      const cached = this.#parsed.get(this.#key(entry))
      const candidate: SearchCandidate = { id: entry.id, workdir: entry.workdir, updatedAt: entry.updatedAt }
      const title = cleanTitle(cached?.session.title, entry.id)
      if (title !== undefined) candidate.title = title
      const firstInput = cached === undefined ? undefined : firstInputOf(cached.session)
      if (firstInput !== undefined) candidate.firstInput = firstInput
      return candidate
    })
  }

  async detail(id: string): Promise<ParsedSession | SourceFailure> {
    if (!isSafeId(id)) return { ok: false, error: "bad-request", detail: "invalid-session-id" }
    const scan = await this.scan()
    if (scan.state !== "ok") {
      return { ok: false, error: "source-unavailable", detail: `root-${scan.state}` }
    }
    const entry = scan.entries.find((candidate) => candidate.id === id)
    if (entry === undefined) return { ok: false, error: "not-found", detail: "session-not-found" }
    if (entry.bytes > this.#maxSessionBytes) {
      return { ok: false, error: "read-limit", detail: `bytes=${String(entry.bytes)}` }
    }
    const key = this.#key(entry)
    const hit = this.#parsed.get(key)
    if (hit !== undefined) {
      return { ok: true, session: hit.session, bytes: hit.bytes, elapsedMs: 0, cached: true }
    }
    const started = Date.now()
    try {
      const result = await readCodexSession(entry.firstPath, { root: this.#root, index: scan.index })
      const record: CachedSession = { session: result.session, bytes: entry.bytes, elapsedMs: Date.now() - started }
      this.#parsed.set(key, record)
      return { ok: true, session: record.session, bytes: record.bytes, elapsedMs: record.elapsedMs, cached: false }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown"
      return { ok: false, error: "parse-failed", detail: message.slice(0, 200) }
    }
  }

  async segmentInfo(session: Session): Promise<SegmentInfo[]> {
    const rows: SegmentInfo[] = []
    for (const path of session.segments) {
      let bytes = 0
      try {
        bytes = (await stat(path)).size
      } catch {
        bytes = 0
      }
      rows.push({ name: basename(path), bytes })
    }
    return rows
  }
}
