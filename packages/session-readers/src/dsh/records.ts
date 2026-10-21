/**
 * Reading the loosely-typed JSON of a DSH session log.
 *
 * The log is a public-enough format to read but not a typed one: every field
 * below is checked rather than assumed, because a single renamed key must
 * degrade one column, not throw away a session.
 */

/** A decoded JSON object, as the log stores it. */
export type JsonObject = Record<string, unknown>

/** True for a non-null, non-array object. */
export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Read one string field, or undefined when it is absent or another type. */
export function stringField(record: JsonObject | undefined, key: string): string | undefined {
  if (record === undefined) return undefined
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

/** Read one finite number field. */
export function numberField(record: JsonObject | undefined, key: string): number | undefined {
  if (record === undefined) return undefined
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/** Read one boolean field. */
export function booleanField(record: JsonObject | undefined, key: string): boolean | undefined {
  if (record === undefined) return undefined
  const value = record[key]
  return typeof value === "boolean" ? value : undefined
}

/** Read one object field. */
export function objectField(record: JsonObject | undefined, key: string): JsonObject | undefined {
  if (record === undefined) return undefined
  const value = record[key]
  return isObject(value) ? value : undefined
}

/** Read one array field. */
export function arrayField(record: JsonObject | undefined, key: string): unknown[] | undefined {
  if (record === undefined) return undefined
  const value = record[key]
  return Array.isArray(value) ? value : undefined
}

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
