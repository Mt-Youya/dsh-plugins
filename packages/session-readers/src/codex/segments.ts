/**
 * Rollout files are segments, not sessions.
 *
 * A session that is reopened keeps its session_id but is written to a new
 * rollout file with a fresh uuid, and the new file starts with a
 * session_meta.history_base pointing back at the previous file's uuid and the
 * ordinal where the previous file's history ends. On this corpus 259 rollout
 * files hold 108 logical sessions; one session alone spans 8 files (7
 * continuation segments). Filename shape is therefore never identity:
 * - rollout-<ts>-<uuidA>              first segment of session uuidA
 * - rollout-<ts>-<uuidA>_<uuidB>      continuation, its own file uuid is uuidB
 * - a subagent thread is a separate rollout whose first session_meta carries
 *   parent_thread_id (its own uuid is the agent_thread_id) and piggybacks a
 *   copy of the parent's session_meta later in the same file.
 *
 * Grouping is by session_id, which every segment and every subagent thread
 * shares with its parent; the first session_meta of each file is the file's
 * identity (later copies describe another thread).
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join } from "node:path"
import { zstdDecompressSync } from "node:zlib"
import { epochOfValue, isObject, numberField, objectField, stringField, type JsonObject } from "./records.ts"
import { frameOffsets } from "./zstd.ts"

/** Prefix every rollout file name carries. */
const ROLLOUT_PREFIX = "rollout-"

/** File-name pattern: timestamp prefix plus one or two uuids. */
const ROLLOUT_STEM = /^rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-(.+)$/

/** Where a segment says the previous segment's history ends. */
export interface HistoryBase {
  /** File uuid of the previous segment. */
  threadId: string
  /** Ordinal at which the previous segment's history stops being authoritative. */
  endOrdinalExclusive: number
  /** Byte offset of the same boundary, kept for evidence. */
  endByteOffset: number
}

/** The parts of session_meta this adapter needs. */
export interface SessionMeta {
  /** Logical session id; identical across segments and subagent threads. */
  sessionId: string
  /** Thread id of this file (the base thread for root segments). */
  threadId: string
  /** Set on a subagent rollout: the thread that spawned it. */
  parentThreadId?: string
  /** Set when the thread was forked from another thread. */
  forkedFromId?: string
  agentNickname?: string
  agentPath?: string
  agentRole?: string
  /** Parent ordinal at which a subagent's inherited history starts. */
  subagentHistoryStartOrdinal?: number
  workdir?: string
  modelProvider?: string
  originator?: string
  cliVersion?: string
  historyMode?: string
  threadSource?: string
  /** The system prompt as text, repeated verbatim in every segment. */
  baseInstructions?: string
  historyBase?: HistoryBase
  /** session_meta's own timestamp, epoch ms. */
  timestamp?: number
}

/** Read a session_meta payload. */
export function readSessionMeta(payload: JsonObject): SessionMeta | undefined {
  const sessionId = stringField(payload, "session_id")
  const threadId = stringField(payload, "id")
  if (sessionId === undefined || threadId === undefined) return undefined
  const meta: SessionMeta = { sessionId, threadId }
  const parentThreadId = stringField(payload, "parent_thread_id")
  if (parentThreadId !== undefined) meta.parentThreadId = parentThreadId
  const forkedFromId = stringField(payload, "forked_from_id")
  if (forkedFromId !== undefined) meta.forkedFromId = forkedFromId
  const agentNickname = stringField(payload, "agent_nickname")
  if (agentNickname !== undefined) meta.agentNickname = agentNickname
  const agentPath = stringField(payload, "agent_path")
  if (agentPath !== undefined) meta.agentPath = agentPath
  const agentRole = stringField(payload, "agent_role")
  if (agentRole !== undefined) meta.agentRole = agentRole
  const subagentHistoryStartOrdinal = numberField(payload, "subagent_history_start_ordinal")
  if (subagentHistoryStartOrdinal !== undefined) meta.subagentHistoryStartOrdinal = subagentHistoryStartOrdinal
  const workdir = stringField(payload, "cwd")
  if (workdir !== undefined) meta.workdir = workdir
  const modelProvider = stringField(payload, "model_provider")
  if (modelProvider !== undefined) meta.modelProvider = modelProvider
  const originator = stringField(payload, "originator")
  if (originator !== undefined) meta.originator = originator
  const cliVersion = stringField(payload, "cli_version")
  if (cliVersion !== undefined) meta.cliVersion = cliVersion
  const historyMode = stringField(payload, "history_mode")
  if (historyMode !== undefined) meta.historyMode = historyMode
  const threadSource = stringField(payload, "thread_source")
  if (threadSource !== undefined) meta.threadSource = threadSource
  const timestamp = epochOfValue(payload["timestamp"])
  if (timestamp !== undefined) meta.timestamp = timestamp
  const base = payload["base_instructions"]
  if (typeof base === "string") meta.baseInstructions = base
  else if (isObject(base)) {
    const instructions = stringField(base, "text")
    if (instructions !== undefined) meta.baseInstructions = instructions
  }
  const historyBase = objectField(payload, "history_base")
  if (historyBase !== undefined) {
    const threadId = stringField(historyBase, "thread_id")
    const endOrdinalExclusive = numberField(historyBase, "end_ordinal_exclusive")
    if (threadId !== undefined && endOrdinalExclusive !== undefined) {
      meta.historyBase = {
        threadId,
        endOrdinalExclusive,
        endByteOffset: numberField(historyBase, "end_byte_offset") ?? 0,
      }
    }
  }
  return meta
}

/** Whether a path is a rollout session file (plain or zstd), not a stray note. */
export function isRolloutFile(path: string): boolean {
  return fileThreadId(path) !== undefined
}

/**
 * The uuid a segment's successors point back at.
 *
 * For a continuation segment this is the part after the underscore; for a first
 * segment it is the whole uuid. history_base.thread_id matches exactly this.
 */
export function fileThreadId(path: string): string | undefined {
  const stem = stemOf(path)
  if (stem === undefined) return undefined
  const match = ROLLOUT_STEM.exec(stem)
  if (match === null) return undefined
  const uuids = (match[2] ?? "").split("_")
  return uuids[uuids.length - 1]
}

/** File-name timestamp, used only to order files whose chain link is missing. */
export function fileTimestamp(path: string): number | undefined {
  const stem = stemOf(path)
  if (stem === undefined) return undefined
  const match = ROLLOUT_STEM.exec(stem)
  if (match === null) return undefined
  return Date.parse((match[1] ?? "").replace(/-/g, ":") + "Z")
}

function stemOf(path: string): string | undefined {
  const name = basename(path)
  if (name.endsWith(".jsonl.zst")) return name.slice(0, -".jsonl.zst".length)
  if (name.endsWith(".jsonl")) return name.slice(0, -".jsonl".length)
  return undefined
}

/** One physical rollout file with the metadata of its first session_meta. */
export interface CodexFile {
  path: string
  /** File uuid: the link target of the next segment's history_base. */
  threadId: string
  size: number
  /** First session_meta of the file. */
  meta: SessionMeta
}

/** Chain resolution result. */
export interface ChainOrder {
  /** Files in history order: first segment first. */
  ordered: CodexFile[]
  /** Files that could not be reached through history_base links. */
  broken: number
  /** 1 when no segment claims to be the first, i.e. earlier history is gone. */
  missingBase: number
}

/**
 * Order one thread's segments by following history_base backwards.
 *
 * The chain is authoritative because it is written by the host: a segment
 * states the uuid and the ordinal boundary of its predecessor. Timestamps are
 * only a fallback for files whose link is missing.
 */
export function orderChain(files: CodexFile[]): ChainOrder {
  const ordered: CodexFile[] = []
  const used = new Set<string>()
  const successor = new Map<string, CodexFile>()
  for (const file of files) {
    const base = file.meta.historyBase
    if (base !== undefined) successor.set(base.threadId, file)
  }
  let missingBase = 0
  let cursor = files.find((file) => file.meta.historyBase === undefined)
  if (cursor === undefined) {
    missingBase = 1
    cursor = [...files].sort(byTimestamp)[0]
  }
  let broken = 0
  while (cursor !== undefined && !used.has(cursor.path)) {
    ordered.push(cursor)
    used.add(cursor.path)
    cursor = successor.get(cursor.threadId)
  }
  if (ordered.length < files.length) {
    for (const file of [...files].sort(byTimestamp)) {
      if (used.has(file.path)) continue
      broken += 1
      ordered.push(file)
      used.add(file.path)
    }
  }
  return { ordered, broken, missingBase }
}

/** Fallback ordering, used only for files whose history_base link is missing. */
function byTimestamp(left: CodexFile, right: CodexFile): number {
  return fileTime(left) - fileTime(right)
}

function fileTime(file: CodexFile): number {
  return file.meta.timestamp ?? fileTimestamp(file.path) ?? 0
}

/** One thread (root or subagent) and its ordered files. */
export interface CodexThread {
  threadId: string
  parentThreadId?: string
  files: CodexFile[]
  chain: ChainOrder
}

/** One logical session: the root thread plus the subagent threads it spawned. */
export interface CodexSessionPlan {
  id: string
  workdir: string
  root: CodexThread
  children: CodexThread[]
}

/** Every session found under a corpus root, grouped the way the host groups them. */
export interface CodexCorpusIndex {
  root: string
  sessions: Map<string, CodexSessionPlan>
  files: CodexFile[]
  /** Rollout-prefixed files that are not readable sessions (e.g. a handoff note). */
  skipped: string[]
}

/** Default corpus location. */
export function defaultCodexRoot(): string {
  return join(homedir(), ".codex", "sessions")
}

/**
 * Read only the first record of a rollout.
 *
 * The session_meta is always the first line. For a zstd file only the first
 * frame is decompressed, so indexing 237 compressed rollouts does not pay for
 * their contents.
 * @param path - rollout file.
 */
export function readMetaOnly(path: string): SessionMeta | undefined {
  let line: string | undefined
  if (path.endsWith(".zst")) {
    const compressed = readFileSync(path)
    const offsets = frameOffsets(compressed)
    if (offsets.length === 0) return undefined
    const start = offsets[0] ?? 0
    const end = offsets[1] ?? compressed.length
    const text = zstdDecompressSync(compressed.subarray(start, end)).toString("utf8")
    line = firstLine(text)
  } else {
    line = firstLine(readFileSync(path, "utf8"))
  }
  if (line === undefined) return undefined
  let decoded: unknown
  try {
    decoded = JSON.parse(line)
  } catch {
    return undefined
  }
  if (!isObject(decoded as JsonObject)) return undefined
  const record = decoded as JsonObject
  if (stringField(record, "type") !== "session_meta") return undefined
  const payload = objectField(record, "payload")
  return payload === undefined ? undefined : readSessionMeta(payload)
}

function firstLine(text: string): string | undefined {
  const newline = text.indexOf("\n")
  const line = (newline < 0 ? text : text.slice(0, newline)).trim()
  return line.length === 0 ? undefined : line
}

/** Every rollout file under a directory tree, plus the files that were skipped. */
export function collectRolloutFiles(root: string): { files: string[]; skipped: string[] } {
  const files: string[] = []
  const skipped: string[] = []
  const walk = (directory: string): void => {
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.name.startsWith(ROLLOUT_PREFIX)) continue
      if (isRolloutFile(path)) files.push(path)
      else skipped.push(path)
    }
  }
  walk(root)
  return { files: files.sort(), skipped: skipped.sort() }
}

/**
 * Index a corpus root without parsing session content.
 * @param root - directory to walk, usually ~/.codex/sessions.
 */
export function indexCodexCorpus(root: string): CodexCorpusIndex {
  const collected = collectRolloutFiles(root)
  const files: CodexFile[] = []
  const skipped = [...collected.skipped]
  for (const path of collected.files) {
    const meta = readMetaOnly(path)
    if (meta === undefined) {
      skipped.push(path)
      continue
    }
    const threadId = fileThreadId(path) ?? meta.threadId
    const size = statSync(path).size
    files.push({ path, threadId, size, meta })
  }

  const bySession = new Map<string, CodexFile[]>()
  for (const file of files) {
    const group = bySession.get(file.meta.sessionId)
    if (group === undefined) bySession.set(file.meta.sessionId, [file])
    else group.push(file)
  }

  const sessions = new Map<string, CodexSessionPlan>()
  for (const [id, group] of bySession) {
    const roots = group.filter((file) => file.meta.parentThreadId === undefined)
    const childFiles = new Map<string, CodexFile[]>()
    for (const file of group) {
      if (file.meta.parentThreadId === undefined) continue
      const list = childFiles.get(file.meta.threadId)
      if (list === undefined) childFiles.set(file.meta.threadId, [file])
      else list.push(file)
    }
    const rootThread: CodexThread = {
      threadId: id,
      files: roots,
      chain: orderChain(roots),
    }
    const children: CodexThread[] = []
    for (const [threadId, list] of childFiles) {
      const first = list[0]
      const child: CodexThread = { threadId, files: list, chain: orderChain(list) }
      if (first?.meta.parentThreadId !== undefined) child.parentThreadId = first.meta.parentThreadId
      children.push(child)
    }
    children.sort((left, right) => left.threadId.localeCompare(right.threadId))
    const workdir = group.find((file) => file.meta.workdir !== undefined)?.meta.workdir ?? ""
    sessions.set(id, { id, workdir, root: rootThread, children })
  }
  return { root, sessions, files, skipped }
}

/** Locate the session plan and the thread that own a file. */
export function planForFile(
  index: CodexCorpusIndex,
  path: string
): { plan: CodexSessionPlan; thread: CodexThread } | undefined {
  for (const plan of index.sessions.values()) {
    for (const thread of [plan.root, ...plan.children]) {
      if (thread.files.some((file) => file.path === path)) return { plan, thread }
    }
  }
  return undefined
}
