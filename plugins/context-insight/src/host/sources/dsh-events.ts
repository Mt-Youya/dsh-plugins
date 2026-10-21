/**
 * Read a DSH session's own event log, for post-handoff observation.
 *
 * The status machine needs the `turn/end` event and any `assistant/attempt`
 * failure, and the log is the only place they exist (the RPC never carries
 * them). Reading it directly keeps observation independent of the gateway's
 * peer-scoped `follow` stream, and works exactly the same in an isolated
 * `DSH_HOME`.
 *
 * @module @cyrus/dsh-context-insight/host/dsh-events
 */

import { access, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { decodeSessionLog, splitLogLines } from "@cyrus/dsh-session-readers"
import { parseLogLine } from "@cyrus/dsh-session-readers"

/** One observed event. */
export interface ObservedEvent {
  type: string
  seq: number
  time: number
  data: unknown
}

/** File name every DSH session directory holds. */
const LOG_NAME = "session.v4.jsonl.zstd"

/**
 * Locate one session's log under a sessions root.
 * @param root - sessions root (`~/.dsh/sessions` or an isolated equivalent).
 * @param sessionId - the session id, with or without the `session-` prefix.
 * @returns the log path, or undefined when no bucket holds it.
 */
export async function findSessionLog(root: string, sessionId: string): Promise<string | undefined> {
  // The controller returns ids that already carry the `session-` prefix, while
  // our own readers canonicalise them away; normalise once so the directory is
  // never addressed as `session-session-…`.
  const bare = sessionId.startsWith("session-") ? sessionId.slice("session-".length) : sessionId
  const dirName = `session-${bare}`
  let buckets
  try {
    buckets = await readdir(root, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const bucket of buckets) {
    if (!bucket.isDirectory()) continue
    const candidate = join(root, bucket.name, dirName, LOG_NAME)
    try {
      await access(candidate)
      return candidate
    } catch {
      continue
    }
  }
  return undefined
}

/**
 * Decode a session's whole event list.
 *
 * A missing or undecodable log answers `undefined` rather than an exception:
 * a handoff that just started may not have written its first frame yet.
 * @param path - the session log.
 * @returns every parsed event, in file order.
 */
export async function readSessionEvents(path: string): Promise<ObservedEvent[] | undefined> {
  let buffer: Buffer
  try {
    buffer = await readFile(path)
  } catch {
    return undefined
  }
  let text: string
  try {
    text = decodeSessionLog(buffer).text
  } catch {
    return undefined
  }
  const events: ObservedEvent[] = []
  for (const line of splitLogLines(text)) {
    const event = parseLogLine(line)
    if (event === undefined || event.seq < 0) continue
    events.push({ type: event.type, seq: event.seq, time: event.time, data: event.data })
  }
  return events.sort((left, right) => left.seq - right.seq)
}

/**
 * Observe one session by id under a sessions root.
 * @param root - sessions root.
 * @param sessionId - target session.
 * @returns its events, or undefined when the log is not there yet.
 */
export async function observeSession(root: string, sessionId: string): Promise<ObservedEvent[] | undefined> {
  const path = await findSessionLog(root, sessionId)
  if (path === undefined) return undefined
  return readSessionEvents(path)
}
