/**
 * Field narrowing shared by the three adapters.
 *
 * Claude, Codex and DSH each decode a different log, but they ask the same
 * seven questions of every decoded line: is this a plain object, and what is
 * under this key — an object, a string, a finite number, a boolean, an array,
 * or the array's object elements. Those helpers used to be copied near-verbatim
 * into each adapter; they live here so a fix lands once.
 *
 * What is deliberately *not* shared is the envelope around them: `epochOf` in
 * the Claude adapter reads ISO strings only, its Codex twin also accepts epoch
 * milliseconds, and DSH has no timestamp helper at all. Those differences are
 * facts about the logs, not duplication.
 *
 * `JsonObject` is the loose `Record<string, unknown>` rather than a recursive
 * JSON union: the DSH log is not typed JSON, and every adapter narrows at the
 * point of use, so a renamed key degrades one column instead of throwing the
 * session away. The record argument is allowed to be `undefined` because the
 * DSH reader reads optional nested objects; the other two adapters never pass
 * one, and for them the extra branch is unreachable.
 *
 * @module records/fields
 */

/** A decoded JSON object, with values still unvalidated. */
export type JsonObject = Record<string, unknown>

/** Whether a decoded value is a plain object (not an array, not null). */
export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Narrow an object field to a nested object. */
export function objectField(record: JsonObject | undefined, key: string): JsonObject | undefined {
  if (record === undefined) return undefined
  const value = record[key]
  return isObject(value) ? value : undefined
}

/** Narrow an object field to a string. */
export function stringField(record: JsonObject | undefined, key: string): string | undefined {
  if (record === undefined) return undefined
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

/** Narrow an object field to a finite number. */
export function numberField(record: JsonObject | undefined, key: string): number | undefined {
  if (record === undefined) return undefined
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/** Narrow an object field to a boolean. */
export function booleanField(record: JsonObject | undefined, key: string): boolean | undefined {
  if (record === undefined) return undefined
  const value = record[key]
  return typeof value === "boolean" ? value : undefined
}

/** Narrow an object field to an array. */
export function arrayField(record: JsonObject | undefined, key: string): unknown[] | undefined {
  if (record === undefined) return undefined
  const value = record[key]
  return Array.isArray(value) ? value : undefined
}

/** Every object element of an array field, dropping the rest. */
export function objectArrayField(record: JsonObject | undefined, key: string): JsonObject[] {
  const value = arrayField(record, key)
  if (value === undefined) return []
  const result: JsonObject[] = []
  for (const item of value) if (isObject(item)) result.push(item)
  return result
}
