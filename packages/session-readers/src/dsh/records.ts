/**
 * Reading the loosely-typed JSON of a DSH session log.
 *
 * The log is a public-enough format to read but not a typed one: every field
 * below is checked rather than assumed, because a single renamed key must
 * degrade one column, not throw away a session.
 */

import type { JsonObject } from "../records/fields.ts"
import { isObject, numberField, objectField, stringField } from "../records/fields.ts"

/**
 * The field helpers are shared with the Claude and Codex adapters; this module
 * keeps re-exporting them so the DSH readers keep importing one path. All of
 * them accept an `undefined` record here — a DSH event may be missing the
 * nested object a field would be read from.
 */
export { arrayField, booleanField, isObject, numberField, objectField, stringField } from "../records/fields.ts"
export type { JsonObject } from "../records/fields.ts"

/** One line as the log wrote it: the envelope plus whatever `data` holds. */
export interface LogEvent {
  type: string
  seq: number
  time: number
  data: JsonObject
  /** The line's whole object. The session header keeps its fields at top level. */
  raw: JsonObject
}

/**
 * Parse one log line into its envelope.
 *
 * The first line is the session header and carries no `seq`; it is returned
 * with `seq: -1` so the caller can tell it apart from an event.
 * @param line - one newline-delimited line of decoded plaintext.
 */
export function parseLogLine(line: string): LogEvent | undefined {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return undefined
  }
  if (!isObject(value)) return undefined
  const type = stringField(value, "type")
  if (type === undefined) return undefined
  const data = objectField(value, "data") ?? {}
  const seq = numberField(value, "seq") ?? -1
  const time = numberField(value, "time") ?? 0
  return { type, seq, time, data, raw: value }
}
