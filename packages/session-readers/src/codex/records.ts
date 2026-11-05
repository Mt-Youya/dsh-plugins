/**
 * The Codex record envelope, decoded defensively.
 *
 * Every line is {timestamp, ordinal, type, payload} with an optional metadata,
 * but nothing here trusts that: a line that does not decode to an object is
 * counted as invalid instead of aborting the session, and every field is
 * narrowed where it is read.
 *
 * The field helpers come from `records/fields.ts`, which the Claude and DSH
 * adapters also use: the three logs share the questions ("what is under this
 * key"), not the answers, and the envelopes around them stay per-adapter.
 */

import { type JsonObject, numberField, objectField, stringField } from "../records/fields.ts"
import { streamLines } from "./zstd.ts"

export {
  arrayField,
  booleanField,
  isObject,
  numberField,
  objectArrayField,
  objectField,
  stringField,
} from "../records/fields.ts"
export type { JsonObject } from "../records/fields.ts"

/**
 * A timestamp as epoch milliseconds.
 *
 * Accepts ISO strings (every envelope timestamp, and the session metadata) and
 * numbers that are plainly milliseconds. Small numbers are rejected rather than
 * being read as 1970: Codex writes durations into similarly named fields, and a
 * 300 ms duration must not become a start time.
 */
export function epochOfValue(value: unknown): number | undefined {
  if (typeof value === "string") {
    const epoch = Date.parse(value)
    return Number.isFinite(epoch) ? epoch : undefined
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 1e11) return value
  return undefined
}

/** Read a timestamp field of an object. */
export function epochOf(record: JsonObject, key = "timestamp"): number | undefined {
  return epochOfValue(record[key])
}

/** One decoded record, with the envelope fields pulled apart. */
export interface Envelope {
  /** The whole decoded line, for readers that need an unmodelled field. */
  record: JsonObject
  /** Envelope type. */
  type: string
  /** Envelope payload, or an empty object when it is missing. */
  payload: JsonObject
  /** Monotonic record counter; global across a session's segment files. */
  ordinal?: number
  /** Envelope timestamp, or the payload's for session_meta. */
  at?: number
}

/** Decode one line, returning undefined for anything that is not an object. */
export function decodeLine(line: string): JsonObject | undefined {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  return value as JsonObject
}

/** Split a decoded record into envelope fields. */
export function readEnvelope(record: JsonObject): Envelope | undefined {
  const type = stringField(record, "type")
  if (type === undefined) return undefined
  const payload = objectField(record, "payload") ?? {}
  const envelope: Envelope = { record, type, payload }
  const ordinal = numberField(record, "ordinal")
  if (ordinal !== undefined) envelope.ordinal = ordinal
  const at = epochOf(record) ?? epochOf(payload)
  if (at !== undefined) envelope.at = at
  return envelope
}

/** Counters a probe can print without exposing session content. */
export interface StreamStats {
  /** Non-empty physical lines read. */
  lines: number
  /** Lines that decoded to a JSON object. */
  parsed: number
  /** Lines that were blank, truncated or not objects. */
  invalid: number
  /** zstd frames decompressed; 0 for a plain file. */
  frames: number
  /** Decompressed bytes (zstd) or raw bytes (plain). */
  bytes: number
}

/**
 * Stream one rollout file, handing each decoded record to visit.
 *
 * One pass per file, streaming: a 38 MB rollout costs the same as a small one
 * except for the single decompressed frame it lives in, and the longest line in
 * this corpus (5.6 MB, a compaction's replacement history) stays one line in
 * memory rather than the file around it.
 * @param path - rollout file, plain or zstd.
 * @param visit - called once per decoded record, in file order.
 */
export async function streamRecords(path: string, visit: (record: JsonObject) => void): Promise<StreamStats> {
  const stats: StreamStats = { lines: 0, parsed: 0, invalid: 0, frames: 0, bytes: 0 }
  const lines = await streamLines(path, (line) => {
    stats.lines += 1
    const record = decodeLine(line)
    if (record === undefined) {
      stats.invalid += 1
      return
    }
    stats.parsed += 1
    visit(record)
  })
  stats.frames = lines.frames
  stats.bytes = lines.bytes
  return stats
}
