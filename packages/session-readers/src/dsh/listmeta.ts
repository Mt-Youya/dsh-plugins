/**
 * The cheap label a session list needs, without parsing the session.
 *
 * A row wants six things: which session, where it runs, when it started,
 * whether it is a subagent, a title, and something to show when there is no
 * title. All six live in the first few kilobytes of the log — the header line
 * and the first handful of events — so a list can label 138 sessions in a few
 * milliseconds instead of folding every log into the full IR.
 *
 * Why a frame budget rather than "read until found": the title arrives at
 * frame 5-6 on this corpus (measured across 138 logs: min 5, max 14, none
 * earlier) because the harness writes the system prompt, the request header and
 * the first turn before it writes the title. A 3-frame budget would therefore
 * return no title at all, which is exactly the bug this module removes.
 *
 * @see docs/PLAN.md (索引：按需解析 + mtime 失效)
 */

import { closeSync, fstatSync, openSync, readSync } from "node:fs"
import { basename, dirname } from "node:path"
import { decodeSessionLog, splitLogLines } from "./frames.ts"
import { parseLogLine } from "./records.ts"
import { firstUserInput, readSessionHeader, readSessionTitle } from "./session-meta.ts"

/**
 * Frames to decode by default.
 *
 * The corpus maximum for a title is frame 14 and for the first user message
 * frame 13, so this window covers every session on this machine with no
 * fallback. It is also the point of diminishing returns: 14 frames is ~20 KB of
 * a median 470 KB file.
 */
export const LIST_META_FRAME_LIMIT = 14

/** Bytes to read by default. Binds only for files with unusually tiny frames. */
export const LIST_META_BYTE_LIMIT = 128 * 1024

/**
 * Frames decoded on the first attempt.
 *
 * 88% of this corpus writes its title by frame 8, so a first pass at this size
 * settles nearly every row; only the stragglers pay for the full window. The
 * buffer is read once either way, so this trades decompression, not I/O.
 */
const FIRST_PASS_FRAMES = 8

/** What a list row can be built from. */
export interface DshListMeta {
  /** Session id from the header, or the log's directory name when it is unreadable. */
  id: string
  /** Working directory the session runs in; absent when the header was not read. */
  cwd?: string
  /** Session start, milliseconds since the epoch. */
  createdAt?: number
  /** 0 for a session a human started, 1+ for a subagent's own log. */
  delegationDepth: number
  /** `session/title` value; the last one written inside the window wins. */
  title?: string
  /** First human message, whitespace-collapsed and truncated, when there is no title. */
  firstInput?: string
  /** Full size of the log on disk, whether or not it was read. */
  bytes: number
  /** Bytes actually read from disk. Always `<= maxBytes`; proves no full read. */
  bytesRead: number
  /** Frames actually decoded. Always `<= maxFrames`. */
  framesRead: number
  /** Set when nothing usable could be decoded; the row must render as unknown. */
  degraded?: true
}

/** Bounds for {@link readDshListMeta}. */
export interface DshListMetaOptions {
  /** Frames to decode; defaults to {@link LIST_META_FRAME_LIMIT}. */
  maxFrames?: number
  /** Bytes to read; defaults to {@link LIST_META_BYTE_LIMIT}. */
  maxBytes?: number
}

/** Read at most `maxBytes` from the start of a file. */
function readHead(path: string, maxBytes: number): { head: Buffer; bytes: number } | undefined {
  let fd: number | undefined
  try {
    fd = openSync(path, "r")
    const size = fstatSync(fd).size
    const want = Math.min(size, maxBytes)
    const buffer = Buffer.allocUnsafe(want)
    let filled = 0
    while (filled < want) {
      const read = readSync(fd, buffer, filled, want - filled, filled)
      if (read <= 0) break
      filled += read
    }
    return { head: buffer.subarray(0, filled), bytes: size }
  } catch {
    return undefined
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd)
      } catch {
        // Closing a descriptor we already failed to use is not worth a throw.
      }
    }
  }
}

/**
 * Read a session's list metadata from the head of its log.
 *
 * Never throws: a corrupt, empty or unreadable file yields `degraded` plus
 * whatever identity can be recovered from the path, because one broken log must
 * not take the session list down with it.
 * @param logPath - a `<cwd bucket>/<sessionId>/session.v4.jsonl.zstd` file.
 * @param options - see {@link DshListMetaOptions}.
 */
export async function readDshListMeta(logPath: string, options: DshListMetaOptions = {}): Promise<DshListMeta> {
  const maxFrames = options.maxFrames ?? LIST_META_FRAME_LIMIT
  const maxBytes = options.maxBytes ?? LIST_META_BYTE_LIMIT
  const fallbackId = basename(dirname(logPath))

  const opened = readHead(logPath, maxBytes)
  if (opened === undefined) {
    return { id: fallbackId, delegationDepth: 0, bytes: 0, bytesRead: 0, framesRead: 0, degraded: true }
  }

  let decoded = decodeSessionLog(opened.head, { maxFrames: Math.min(FIRST_PASS_FRAMES, maxFrames) })
  if (decoded.frames === 0) {
    return {
      id: fallbackId,
      delegationDepth: 0,
      bytes: opened.bytes,
      bytesRead: opened.head.length,
      framesRead: 0,
      degraded: true,
    }
  }

  let header: ReturnType<typeof readSessionHeader> = {}
  let title: string | undefined
  let firstInput: string | undefined
  let sawHeader = false

  const scan = (text: string): void => {
    for (const line of splitLogLines(text)) {
      const event = parseLogLine(line)
      if (event === undefined) continue
      if (!sawHeader && event.type === "session") {
        header = readSessionHeader(event)
        sawHeader = true
        continue
      }
      if (event.type === "session/title") {
        // Titles are a mutation — the harness writes a fallback title and may
        // replace it with a provider one a few events later — so the last title
        // inside the window is the current one.
        const value = readSessionTitle(event.data)
        if (value !== undefined) title = value
        continue
      }
      if (firstInput === undefined && event.type === "user/message") firstInput = firstUserInput(event.data)
    }
  }
  scan(decoded.text)

  // Stop as soon as the row can be labelled: the remaining frames are only
  // decoded for the minority of sessions whose title arrives late.
  if ((title === undefined || firstInput === undefined) && maxFrames > FIRST_PASS_FRAMES) {
    decoded = decodeSessionLog(opened.head, { maxFrames })
    scan(decoded.text)
  }

  const meta: DshListMeta = {
    id: header.id ?? fallbackId,
    delegationDepth: header.delegationDepth ?? 0,
    bytes: opened.bytes,
    bytesRead: opened.head.length,
    framesRead: decoded.frames,
  }
  if (header.cwd !== undefined) meta.cwd = header.cwd
  if (header.createdAt !== undefined) meta.createdAt = header.createdAt
  if (title !== undefined) meta.title = title
  if (firstInput !== undefined) meta.firstInput = firstInput
  // No header line means the first frames did not hold a session log at all.
  if (!sawHeader) meta.degraded = true
  return meta
}
