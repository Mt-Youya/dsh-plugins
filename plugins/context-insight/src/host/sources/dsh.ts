/**
 * DSH corpus reader.
 *
 * Layout: `~/.dsh/sessions/<cwd-bucket>/session-<uuid>/session.v4.jsonl.zstd`.
 * The bucket name is a lossy encoding of the workdir, so the authoritative cwd
 * comes from the log's own header line — decoding it costs only the first
 * zstd frames, not the body. A body parse happens when a session is opened.
 *
 * @see docs/PLAN.md (DSH 归一化红线)
 * @module @cyrus/dsh-context-insight/host/dsh
 */

import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { homedir } from "node:os"
import { DEFAULT_PROJECTION_ROOT, readDshSession } from "@cyrus/dsh-session-readers"
import { decodeSessionLog, splitLogLines } from "@cyrus/dsh-session-readers"
import type { DshListMeta } from "@cyrus/dsh-session-readers"
import { readDshListMeta } from "@cyrus/dsh-session-readers"
import type { Session } from "@cyrus/dsh-session-contract"
import type { SegmentInfo, SessionSummary, SourceStatus, WorkdirEntry } from "../../protocol.ts"
import { LIST_ITEM_UNPARSED, isSafeId } from "../../protocol.ts"
import type { ParsedSession, SearchCandidate, SessionSource, SourceFailure, WorkdirOptions } from "./source.ts"
import { cleanTitle, firstInputOf } from "./source.ts"
import { Lru } from "@cyrus/dsh-plugin-kit-host"

/** Default sessions root. */
export function defaultDshRoot(): string {
  return join(homedir(), ".dsh", "sessions")
}

/** File name every session directory holds. */
export const DSH_LOG_NAME = "session.v4.jsonl.zstd"

/** Milliseconds the directory walk is reused. */
export const DEFAULT_DSH_SCAN_TTL_MS = 30_000

/** Bytes read from a log head for its header line. */
export const DEFAULT_DSH_HEADER_BYTES = 64 * 1024

/** Parsed sessions kept live. */
export const DEFAULT_DSH_CACHE_ENTRIES = 4

/** Configuration of one DSH reader. */
export interface DshSourceConfig {
  root?: string
  projectionRoot?: string
  scanTtlMs?: number
  headerBytes?: number
  /** Light-index path override (tests). */
  indexPath?: string
  /** Header reader override (tests count calls / avoid zstd fixtures). */
  readMeta?: (logPath: string) => Promise<DshListMeta>
  cacheEntries?: number
}

/** One discovered session log. */
/** One row of the on-disk list index: header facts only, never a body. */
export interface DshIndexEntry {
  path: string
  mtimeMs: number
  size: number
  id: string
  cwd: string
  createdAt: number
  delegationDepth: number
  title?: string
  firstInput?: string
}

/** On-disk index envelope. */
interface DshIndexFile {
  version: 1
  scannedAt: number
  entries: DshIndexEntry[]
}

/**
 * Where the panel's list index lives.
 * @param env - process environment (honours `DSH_HOME`).
 */
export function dshIndexPath(env: NodeJS.ProcessEnv = process.env): string {
  const home = env["DSH_HOME"]
  const root = home !== undefined && home.trim() !== "" ? home : join(homedir(), ".dsh")
  return join(root, "dsh-context-insight", "index.json")
}

/** Read the index if it exists and parses. */
async function loadDshIndex(path: string): Promise<Map<string, DshIndexEntry>> {
  const map = new Map<string, DshIndexEntry>()
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as DshIndexFile
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return map
    for (const entry of parsed.entries) {
      if (typeof entry.path === "string") map.set(entry.path, entry)
    }
  } catch {
    // A missing or corrupt index is just a cold start.
  }
  return map
}

/** Write the index atomically (temp file + rename), never touching source data. */
async function saveDshIndex(path: string, entries: DshIndexEntry[]): Promise<void> {
  try {
    await mkdir(join(path, ".."), { recursive: true })
    const body: DshIndexFile = { version: 1, scannedAt: Date.now(), entries }
    const temp = path + ".tmp-" + String(process.pid)
    await writeFile(temp, JSON.stringify(body))
    await rename(temp, path)
  } catch {
    // The index is an optimisation; failing to persist it changes nothing else.
  }
}

export interface DshEntry {
  /** Canonical id: the header's id with any `session-` prefix removed. */
  id: string
  /** Directory name, which keeps its `session-` prefix. */
  dirName: string
  path: string
  workdir: string
  workdirDecoded: boolean
  createdAt: number
  bytes: number
  updatedAt: number
  /** Header delegation depth; > 0 means a subagent conversation. */
  delegationDepth: number
  /** Title read from the log head, if the Host wrote one that early. */
  title?: string
  /** First human-looking user message from the log head. */
  firstInput?: string
}

interface DshScan {
  root: string
  state: "ok" | "missing" | "unreadable"
  entries: DshEntry[]
  scannedAt: number
}

interface CachedSession {
  session: Session
  bytes: number
  elapsedMs: number
}

/**
 * Canonical session id.
 * @param raw - the header's id or the directory name.
 * @returns the uuid without the `session-` prefix.
 */
export function canonicalDshId(raw: string): string {
  return raw.startsWith("session-") ? raw.slice("session-".length) : raw
}

/**
 * Decode a bucket directory name back into a path.
 *
 * DSH names a bucket by wrapping the encoded workdir in `--`; `-` stands for a
 * separator, which cannot be inverted (`auto-chat` vs `auto/chat`). The log's
 * own `cwd` is therefore authoritative and this is only the fallback.
 * @param bucket - one directory name under the sessions root.
 * @returns the naive decoded path.
 */
export function decodeBucketName(bucket: string): string {
  if (!bucket.startsWith("--")) return bucket
  let inner = bucket.slice(2)
  if (inner.endsWith("--")) inner = inner.slice(0, -2)
  // The wrapper's first hyphen stood for the root separator.
  return "/" + inner.replace(/-/g, "/")
}

/** One header line's facts. */
export interface DshHeaderFacts {
  id?: string
  cwd?: string
  createdAt?: number
}

/**
 * Decode just enough of a session log to read its header line.
 * @param path - `session.v4.jsonl.zstd`.
 * @param limit - bytes read from offset 0.
 * @returns the header facts, or an empty object when none was found.
 */
export async function readDshHeaderFacts(path: string, limit: number): Promise<DshHeaderFacts> {
  const buffer = await readFile(path)
  const head = buffer.subarray(0, Math.min(buffer.length, limit))
  const decoded = decodeSessionLog(head)
  const lines = splitLogLines(decoded.text)
  for (const line of lines) {
    if (!line.includes('"type":"session"')) continue
    let record: unknown
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }
    if (typeof record !== "object" || record === null) continue
    const row = record as Record<string, unknown>
    if (row["type"] !== "session") continue
    const facts: DshHeaderFacts = {}
    if (typeof row["id"] === "string") facts.id = row["id"]
    if (typeof row["cwd"] === "string") facts.cwd = row["cwd"]
    if (typeof row["createdAt"] === "number") facts.createdAt = row["createdAt"]
    return facts
  }
  return {}
}

/** DSH corpus reader. One instance per Host fiber. */
export class DshSource implements SessionSource {
  readonly id = "dsh" as const
  readonly #root: string
  readonly #projectionRoot: string
  readonly #scanTtlMs: number
  readonly #headerBytes: number
  readonly #parsed: Lru<CachedSession>
  #scan: DshScan | undefined
  #index: Map<string, DshIndexEntry> | undefined
  readonly #indexPath: string
  readonly #readMeta: (logPath: string) => Promise<DshListMeta>
  #inflight: Promise<DshScan> | undefined

  constructor(config: DshSourceConfig = {}) {
    this.#root = config.root ?? defaultDshRoot()
    this.#indexPath = config.indexPath ?? dshIndexPath()
    this.#readMeta = config.readMeta ?? ((path) => readDshListMeta(path))
    this.#projectionRoot = config.projectionRoot ?? DEFAULT_PROJECTION_ROOT
    this.#scanTtlMs = config.scanTtlMs ?? DEFAULT_DSH_SCAN_TTL_MS
    this.#headerBytes = config.headerBytes ?? DEFAULT_DSH_HEADER_BYTES
    this.#parsed = new Lru<CachedSession>(config.cacheEntries ?? DEFAULT_DSH_CACHE_ENTRIES)
  }

  /** The sessions root this reader walks. */
  get root(): string {
    return this.#root
  }

  /** Drop every cache; the next call re-walks and re-parses. */
  invalidate(): void {
    this.#scan = undefined
    this.#parsed.clear()
  }

  /**
   * Walk the corpus inside the TTL.
   * @returns the scan; a missing root is a state, not an exception.
   */
  async scan(): Promise<DshScan> {
    const fresh = this.#scan
    if (fresh !== undefined && Date.now() - fresh.scannedAt < this.#scanTtlMs) return fresh
    const inflight = this.#inflight
    if (inflight !== undefined) return inflight
    const started = (async (): Promise<DshScan> => {
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

  async #walk(): Promise<DshScan> {
    const scannedAt = Date.now()
    if (this.#index === undefined) this.#index = await loadDshIndex(this.#indexPath)
    const previous = this.#index
    const next: DshIndexEntry[] = []
    let changed = false
    let buckets
    try {
      buckets = await readdir(this.#root, { withFileTypes: true })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      return { root: this.#root, state: code === "ENOENT" ? "missing" : "unreadable", entries: [], scannedAt }
    }
    const entries: DshEntry[] = []
    for (const bucket of buckets) {
      if (!bucket.isDirectory()) continue
      const bucketPath = join(this.#root, bucket.name)
      let sessions
      try {
        sessions = await readdir(bucketPath, { withFileTypes: true })
      } catch {
        continue
      }
      for (const session of sessions) {
        if (!session.isDirectory()) continue
        const path = join(bucketPath, session.name, DSH_LOG_NAME)
        let info
        try {
          info = await stat(path)
        } catch {
          continue
        }
        if (info.size === 0) continue
        const cachedIndex = previous.get(path)
        let meta: DshListMeta = { id: "", delegationDepth: 0, bytes: info.size, bytesRead: 0, framesRead: 0 }
        if (
          cachedIndex !== undefined &&
          cachedIndex.mtimeMs === Math.round(info.mtimeMs) &&
          cachedIndex.size === info.size
        ) {
          meta = {
            id: cachedIndex.id,
            cwd: cachedIndex.cwd,
            createdAt: cachedIndex.createdAt,
            delegationDepth: cachedIndex.delegationDepth,
            bytes: info.size,
            bytesRead: 0,
            framesRead: 0,
            ...(cachedIndex.title === undefined ? {} : { title: cachedIndex.title }),
            ...(cachedIndex.firstInput === undefined ? {} : { firstInput: cachedIndex.firstInput }),
          }
        } else {
          changed = true
          try {
            meta = await this.#readMeta(path)
          } catch {
            // An undecodable head still lists: id from the directory, workdir decoded.
          }
        }
        const decoded = decodeBucketName(bucket.name)
        const entry: DshEntry = {
          id: canonicalDshId(meta.id ?? session.name),
          dirName: session.name,
          path,
          workdir: meta.cwd ?? decoded,
          workdirDecoded: meta.cwd === undefined,
          createdAt: meta.createdAt ?? Math.round(info.birthtimeMs),
          bytes: info.size,
          updatedAt: Math.round(info.mtimeMs),
          delegationDepth: meta.delegationDepth,
        }
        const title = cleanTitle(meta.title, entry.id)
        if (title !== undefined) entry.title = title
        if (meta.firstInput !== undefined) entry.firstInput = meta.firstInput
        entries.push(entry)
        const indexEntry: DshIndexEntry = {
          path,
          mtimeMs: Math.round(info.mtimeMs),
          size: info.size,
          id: entry.id,
          cwd: entry.workdir,
          createdAt: entry.createdAt,
          delegationDepth: entry.delegationDepth,
        }
        if (entry.title !== undefined) indexEntry.title = entry.title
        if (entry.firstInput !== undefined) indexEntry.firstInput = entry.firstInput
        next.push(indexEntry)
      }
    }
    entries.sort((a, b) => b.updatedAt - a.updatedAt)
    this.#index = new Map(next.map((entry) => [entry.path, entry]))
    if (changed || previous.size !== next.length) {
      void saveDshIndex(this.#indexPath, next)
    }
    return { root: this.#root, state: "ok", entries, scannedAt }
  }

  async status(): Promise<SourceStatus> {
    const scan = await this.scan()
    if (scan.state !== "ok") {
      return {
        source: "dsh",
        available: false,
        reason: scan.state === "missing" ? "root-missing" : "root-unreadable",
        root: scan.root,
        lastScanAt: scan.scannedAt,
      }
    }
    return {
      source: "dsh",
      available: true,
      root: scan.root,
      sessions: scan.entries.length,
      lastScanAt: scan.scannedAt,
    }
  }

  async workdirs(options: WorkdirOptions = {}): Promise<WorkdirEntry[]> {
    const scan = await this.scan()
    const grouped = new Map<string, WorkdirEntry>()
    for (const entry of scan.entries) {
      if (!options.includeSubagents && entry.delegationDepth > 0) continue
      const existing = grouped.get(entry.workdir)
      if (existing === undefined) {
        grouped.set(entry.workdir, {
          workdir: entry.workdir,
          sessions: 1,
          lastUpdatedAt: entry.updatedAt,
          sources: [{ source: "dsh", sessions: 1, lastUpdatedAt: entry.updatedAt }],
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

  #key(entry: DshEntry): string {
    return `dsh:${entry.id}:${String(entry.updatedAt)}:${String(entry.bytes)}`
  }

  async list(workdir: string, options: WorkdirOptions = {}): Promise<SessionSummary[]> {
    const scan = await this.scan()
    const rows: SessionSummary[] = []
    for (const entry of scan.entries) {
      if (entry.workdir !== workdir) continue
      if (!options.includeSubagents && entry.delegationDepth > 0) continue
      const cached = this.#parsed.get(this.#key(entry))
      const summary: SessionSummary = {
        source: "dsh",
        id: entry.id,
        workdir: entry.workdir,
        updatedAt: entry.updatedAt,
        bytes: entry.bytes,
        dataQuality: cached === undefined ? [LIST_ITEM_UNPARSED] : cached.session.dataQuality,
        delegationDepth: entry.delegationDepth,
      }
      // Header meta first; a session that has been opened keeps its parsed title
      // and first input as the authority.
      const title = cleanTitle(cached?.session.title ?? entry.title, entry.id)
      if (title !== undefined) summary.title = title
      const firstInput = cached === undefined ? entry.firstInput : (firstInputOf(cached.session) ?? entry.firstInput)
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
      const title = cleanTitle(cached?.session.title ?? entry.title, entry.id)
      if (title !== undefined) candidate.title = title
      const firstInput = cached === undefined ? entry.firstInput : (firstInputOf(cached.session) ?? entry.firstInput)
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
    const key = this.#key(entry)
    const hit = this.#parsed.get(key)
    if (hit !== undefined) {
      return { ok: true, session: hit.session, bytes: hit.bytes, elapsedMs: 0, cached: true }
    }
    const started = Date.now()
    try {
      const result = await readDshSession(entry.path, { projectionRoot: this.#projectionRoot })
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
