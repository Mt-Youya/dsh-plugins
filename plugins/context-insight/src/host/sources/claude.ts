/**
 * Claude corpus reader: discovery, header facts, and the session LRU.
 *
 * Discovery never parses a body. A directory walk plus a bounded header read
 * gives the list views their whole content (workdir, title, first input, size,
 * mtime), and the expensive IR parse happens only when one session is opened —
 * cached by `id + mtimeMs + size`, so a rewritten transcript is never served
 * from a stale slot.
 *
 * @see docs/API.md (缓存与失效)
 * @module @cyrus/dsh-context-insight/host/claude
 */

import { fingerprintOf, readSnapshot, snapshotPath, walkFingerprint, writeSnapshot } from "./snapshot.ts"
import { open, readdir, stat } from "node:fs/promises"
import { basename, join } from "node:path"
import { readClaudeSession } from "@cyrus/dsh-session-readers"
import { humanText } from "@cyrus/dsh-session-readers"
import type { Session } from "@cyrus/dsh-session-contract"
import type { SegmentInfo, SessionSummary, SourceStatus, WorkdirEntry } from "../../protocol.ts"
import { LIST_ITEM_UNPARSED, isSafeId } from "../../protocol.ts"
import type { ParsedSession, SearchCandidate, SessionSource, SourceFailure } from "./source.ts"
import { cleanTitle, firstInputOf } from "./source.ts"
import { Lru } from "@cyrus/dsh-plugin-kit-host"
import { decodeProjectDirName, resolveInside } from "./paths.ts"

/** Milliseconds a directory scan is reused before walking the tree again. */
export const DEFAULT_SCAN_TTL_MS = 30_000

/** Largest session file the reader will parse. */
export const DEFAULT_MAX_SESSION_BYTES = 128 * 1024 * 1024

/** How much of a transcript's head is scanned for cwd/title/sessionId. */
export const DEFAULT_HEADER_BYTES = 64 * 1024

/** Parsed sessions kept live; each one holds every turn's IR. */
export const DEFAULT_CACHE_ENTRIES = 6

/** Configuration of one Claude reader. */
export interface ClaudeSourceConfig {
  /** Absolute projects root; every read is containment-checked against it. */
  root: string
  scanTtlMs?: number
  maxSessionBytes?: number
  headerBytes?: number
  cacheEntries?: number
}

/** Facts a header scan can state without parsing a body. */
export interface HeaderFacts {
  cwd?: string
  sessionId?: string
  title?: string
  firstInput?: string
}

/** One discovered transcript. */
export interface ClaudeSessionFile {
  id: string
  path: string
  projectDir: string
  workdir: string
  workdirDecoded: boolean
  title?: string
  firstInput?: string
  bytes: number
  updatedAt: number
}

/** One directory scan. */
export interface ClaudeScan {
  root: string
  state: "ok" | "missing" | "unreadable"
  sessions: ClaudeSessionFile[]
  scannedAt: number
}

interface CachedSession {
  session: Session
  bytes: number
  elapsedMs: number
}

interface CachedHeader {
  mtimeMs: number
  size: number
  header: HeaderFacts
}

/** Longest first-input excerpt kept in memory. */
const FIRST_INPUT_LIMIT = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Read a transcript's first bytes and pull out the facts a list view needs.
 * @param path - transcript path.
 * @param limit - bytes to read from offset 0.
 * @returns the facts found; every field is optional.
 */
export async function readHeaderFacts(path: string, limit: number): Promise<HeaderFacts> {
  const handle = await open(path, "r")
  try {
    const buffer = Buffer.allocUnsafe(limit)
    const { bytesRead } = await handle.read(buffer, 0, limit, 0)
    const text = buffer.subarray(0, bytesRead).toString("utf8")
    const lines = text.split("\n")
    if (bytesRead === limit) lines.pop()
    let cwd: string | undefined
    let sessionId: string | undefined
    let title: string | undefined
    let firstInput: string | undefined
    for (const line of lines) {
      if (line.length === 0) continue
      let record: unknown
      try {
        record = JSON.parse(line)
      } catch {
        continue
      }
      if (!isRecord(record)) continue
      if (cwd === undefined && typeof record["cwd"] === "string") cwd = record["cwd"]
      if (sessionId === undefined && typeof record["sessionId"] === "string") sessionId = record["sessionId"]
      // Renames append a custom-title record, so the last one wins.
      if (record["type"] === "custom-title" && typeof record["customTitle"] === "string") title = record["customTitle"]
      if (record["type"] === "agent-name" && title === undefined && typeof record["agentName"] === "string") {
        title = record["agentName"]
      }
      if (firstInput === undefined && record["type"] === "user") {
        const message = record["message"]
        const content = isRecord(message) ? message["content"] : undefined
        if (typeof content === "string") {
          const human = humanText(content)
          if (human !== undefined) {
            const trimmed = human.trim()
            if (trimmed !== "")
              firstInput = trimmed.length > FIRST_INPUT_LIMIT ? trimmed.slice(0, FIRST_INPUT_LIMIT) : trimmed
          }
        }
      }
    }
    const facts: HeaderFacts = {}
    if (cwd !== undefined) facts.cwd = cwd
    if (sessionId !== undefined) facts.sessionId = sessionId
    if (title !== undefined) facts.title = title
    if (firstInput !== undefined) facts.firstInput = firstInput
    return facts
  } finally {
    await handle.close()
  }
}

/** Claude corpus reader. One instance per Host fiber. */
export class ClaudeSource implements SessionSource {
  readonly id = "claude" as const
  readonly #config: Required<ClaudeSourceConfig>
  readonly #headers = new Map<string, CachedHeader>()
  readonly #parsed: Lru<CachedSession>
  #scan: ClaudeScan | undefined
  readonly #indexPath: string = snapshotPath()
  #inflight: Promise<ClaudeScan> | undefined

  constructor(config: ClaudeSourceConfig) {
    this.#config = {
      root: config.root,
      scanTtlMs: config.scanTtlMs ?? DEFAULT_SCAN_TTL_MS,
      maxSessionBytes: config.maxSessionBytes ?? DEFAULT_MAX_SESSION_BYTES,
      headerBytes: config.headerBytes ?? DEFAULT_HEADER_BYTES,
      cacheEntries: config.cacheEntries ?? DEFAULT_CACHE_ENTRIES,
    }
    this.#parsed = new Lru<CachedSession>(this.#config.cacheEntries)
  }

  /** The root this reader is confined to. */
  get root(): string {
    return this.#config.root
  }

  /**
   * Walk the corpus, reusing the last scan inside its TTL. Concurrent callers
   * share one walk: the panel fires workdirs and sessions together on open.
   * @returns the scan.
   */
  async scan(): Promise<ClaudeScan> {
    const fresh = this.#scan
    if (fresh !== undefined && Date.now() - fresh.scannedAt < this.#config.scanTtlMs) return fresh
    const inflight = this.#inflight
    if (inflight !== undefined) return inflight
    const started = (async (): Promise<ClaudeScan> => {
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
    this.#headers.clear()
    this.#parsed.clear()
  }

  async #walk(): Promise<ClaudeScan> {
    const fingerprint = fingerprintOf(await walkFingerprint(this.root, (name) => name.endsWith(".jsonl")))
    const cachedSessions = await readSnapshot<ClaudeSessionFile>(this.#indexPath, "claude", fingerprint)
    if (cachedSessions !== undefined) {
      return { root: this.root, state: "ok", sessions: cachedSessions, scannedAt: Date.now() }
    }
    const scannedAt = Date.now()
    let dirs
    try {
      dirs = await readdir(this.#config.root, { withFileTypes: true })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      return { root: this.#config.root, state: code === "ENOENT" ? "missing" : "unreadable", sessions: [], scannedAt }
    }
    const byId = new Map<string, ClaudeSessionFile>()
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue
      const dirPath = join(this.#config.root, dir.name)
      let entries
      try {
        entries = await readdir(dirPath, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue
        const path = join(dirPath, entry.name)
        let info
        try {
          info = await stat(path)
        } catch {
          continue
        }
        if (info.size === 0) continue
        let header: HeaderFacts = {}
        try {
          header = await this.#headerFacts(path, info.mtimeMs, info.size)
        } catch {
          // An unreadable header still lists: the row keeps its size and mtime.
        }
        const id = header.sessionId ?? basename(entry.name, ".jsonl")
        const decoded = decodeProjectDirName(dir.name)
        const file: ClaudeSessionFile = {
          id,
          path,
          projectDir: dir.name,
          workdir: header.cwd ?? decoded,
          workdirDecoded: header.cwd === undefined,
          bytes: info.size,
          updatedAt: Math.round(info.mtimeMs),
        }
        const title = cleanTitle(header.title, id)
        if (title !== undefined) file.title = title
        if (header.firstInput !== undefined) file.firstInput = header.firstInput
        const previous = byId.get(id)
        // A copied transcript exists twice; the newer copy is the live one.
        if (previous === undefined || previous.updatedAt < file.updatedAt) byId.set(id, file)
      }
    }
    const sessions = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
    return { root: this.#config.root, state: "ok", sessions, scannedAt }
  }

  async #headerFacts(path: string, mtimeMs: number, size: number): Promise<HeaderFacts> {
    const cached = this.#headers.get(path)
    if (cached !== undefined && cached.mtimeMs === mtimeMs && cached.size === size) return cached.header
    const header = await readHeaderFacts(path, this.#config.headerBytes)
    if (this.#headers.size > 4096) this.#headers.clear()
    this.#headers.set(path, { mtimeMs, size, header })
    return header
  }

  async status(): Promise<SourceStatus> {
    const scan = await this.scan()
    if (scan.state !== "ok") {
      return {
        source: "claude",
        available: false,
        reason: scan.state === "missing" ? "root-missing" : "root-unreadable",
        root: scan.root,
        lastScanAt: scan.scannedAt,
      }
    }
    return {
      source: "claude",
      available: true,
      root: scan.root,
      sessions: scan.sessions.length,
      lastScanAt: scan.scannedAt,
    }
  }

  async workdirs(): Promise<WorkdirEntry[]> {
    const scan = await this.scan()
    const grouped = new Map<string, WorkdirEntry>()
    for (const file of scan.sessions) {
      const existing = grouped.get(file.workdir)
      if (existing === undefined) {
        grouped.set(file.workdir, {
          workdir: file.workdir,
          sessions: 1,
          lastUpdatedAt: file.updatedAt,
          sources: [{ source: "claude", sessions: 1, lastUpdatedAt: file.updatedAt }],
        })
        continue
      }
      existing.sessions += 1
      if (file.updatedAt > existing.lastUpdatedAt) existing.lastUpdatedAt = file.updatedAt
      const group = existing.sources[0]
      if (group !== undefined) {
        group.sessions += 1
        if (file.updatedAt > group.lastUpdatedAt) group.lastUpdatedAt = file.updatedAt
      }
    }
    return [...grouped.values()].sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt)
  }

  async list(workdir: string): Promise<SessionSummary[]> {
    const scan = await this.scan()
    const rows: SessionSummary[] = []
    for (const file of scan.sessions) {
      if (file.workdir !== workdir) continue
      const cached = this.#parsed.get(this.#key(file.id, file.bytes, file.updatedAt))
      const summary: SessionSummary = {
        source: "claude",
        id: file.id,
        workdir: file.workdir,
        updatedAt: file.updatedAt,
        bytes: file.bytes,
        dataQuality: cached === undefined ? [LIST_ITEM_UNPARSED] : cached.session.dataQuality,
      }
      const title = file.title ?? cleanTitle(cached?.session.title, file.id)
      if (title !== undefined) summary.title = title
      const firstInput = cached === undefined ? file.firstInput : (firstInputOf(cached.session) ?? file.firstInput)
      if (firstInput !== undefined) summary.firstInput = firstInput
      rows.push(summary)
    }
    return rows
  }

  async candidates(): Promise<SearchCandidate[]> {
    const scan = await this.scan()
    return scan.sessions.map((file) => {
      const cached = this.#parsed.get(this.#key(file.id, file.bytes, file.updatedAt))
      const candidate: SearchCandidate = { id: file.id, workdir: file.workdir, updatedAt: file.updatedAt }
      const title = file.title ?? cleanTitle(cached?.session.title, file.id)
      if (title !== undefined) candidate.title = title
      const firstInput = cached === undefined ? file.firstInput : (firstInputOf(cached.session) ?? file.firstInput)
      if (firstInput !== undefined) candidate.firstInput = firstInput
      return candidate
    })
  }

  #key(id: string, bytes: number, updatedAt: number): string {
    return `claude:${id}:${String(updatedAt)}:${String(bytes)}`
  }

  async detail(id: string): Promise<ParsedSession | SourceFailure> {
    if (!isSafeId(id)) return { ok: false, error: "bad-request", detail: "invalid-session-id" }
    const scan = await this.scan()
    if (scan.state !== "ok") {
      return { ok: false, error: "source-unavailable", detail: `root-${scan.state}` }
    }
    const file = scan.sessions.find((candidate) => candidate.id === id)
    if (file === undefined) return { ok: false, error: "not-found", detail: "session-not-found" }

    let info
    try {
      info = await stat(file.path)
    } catch {
      return { ok: false, error: "not-found", detail: "session-file-missing" }
    }
    // The id whitelist already refuses separators; this is the second line, and
    // the one that catches a symlinked transcript pointing outside the corpus.
    const real = await resolveInside(this.#config.root, file.path)
    if (real === undefined) return { ok: false, error: "forbidden", detail: "path-escape" }
    if (info.size > this.#config.maxSessionBytes) {
      return { ok: false, error: "read-limit", detail: `bytes=${String(info.size)}` }
    }

    const key = this.#key(id, info.size, Math.round(info.mtimeMs))
    const hit = this.#parsed.get(key)
    if (hit !== undefined) {
      return { ok: true, session: hit.session, bytes: hit.bytes, elapsedMs: 0, cached: true }
    }

    const started = Date.now()
    try {
      const result = await readClaudeSession(real)
      const record: CachedSession = { session: result.session, bytes: info.size, elapsedMs: Date.now() - started }
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
