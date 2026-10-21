/**
 * Reading one Claude Code `.jsonl` transcript as a stream of JSON records.
 *
 * Nothing here trusts the file: lines are parsed defensively, every field is
 * narrowed at the point of use, and no line is kept after it has been folded
 * into the extracting adapter. A session file can be 50 MB with a single
 * 1.2 MB line, so materializing the file is not an option.
 */

/** JSON as `JSON.parse` can produce it. */
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject

/** A decoded JSON object. */
export interface JsonObject {
  [key: string]: JsonValue
}

/** Whether a decoded value is a plain object (not an array, not null). */
export function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Narrow an object field to a nested object. */
export function objectField(record: JsonObject, key: string): JsonObject | undefined {
  const value = record[key]
  return isObject(value) ? value : undefined
}

/** Narrow an object field to a string. */
export function stringField(record: JsonObject, key: string): string | undefined {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

/** Narrow an object field to a finite number. */
export function numberField(record: JsonObject, key: string): number | undefined {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/** Narrow an object field to a boolean. */
export function booleanField(record: JsonObject, key: string): boolean | undefined {
  const value = record[key]
  return typeof value === "boolean" ? value : undefined
}

/** Narrow an object field to an array. */
export function arrayField(record: JsonObject, key: string): JsonValue[] | undefined {
  const value = record[key]
  return Array.isArray(value) ? value : undefined
}

/** Every object element of an array field, dropping the rest. */
export function objectArrayField(record: JsonObject, key: string): JsonObject[] {
  const value = arrayField(record, key)
  if (value === undefined) return []
  const result: JsonObject[] = []
  for (const item of value) if (isObject(item)) result.push(item)
  return result
}

/**
 * Read a record's ISO timestamp as epoch milliseconds.
 *
 * `undefined` for records that carry no timestamp (mode switches, file-history
 * snapshots), so callers must decide whether to skip them rather than treating
 * them as 1970.
 */
export function epochOf(record: JsonObject, key = "timestamp"): number | undefined {
  const value = stringField(record, key)
  if (value === undefined) return undefined
  const epoch = Date.parse(value)
  return Number.isFinite(epoch) ? epoch : undefined
}

/** Counters that a probe can print without exposing session content. */
export interface StreamStats {
  /** Physical lines read. */
  lines: number
  /** Lines that decoded to a JSON object. */
  parsed: number
  /** Lines that were blank, truncated or not objects. */
  invalid: number
}

/**
 * Stream one transcript, handing each decoded object to `visit`.
 *
 * Uses `node:readline` over a byte stream so peak memory stays proportional to
 * the longest line rather than the file, and so a 50 MB transcript costs the
 * same as a 50 KB one.
 * @param path - transcript file.
 * @param visit - called once per decoded record, in file order.
 * @returns line counters for the probe report.
 */
export async function streamRecords(path: string, visit: (record: JsonObject) => void): Promise<StreamStats> {
  const { createReadStream } = await import("node:fs")
  const { createInterface } = await import("node:readline")
  const stats: StreamStats = { lines: 0, parsed: 0, invalid: 0 }
  const reader = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity })
  try {
    for await (const line of reader) {
      if (line.length === 0) continue
      stats.lines += 1
      const record = decodeLine(line)
      if (record === undefined) {
        stats.invalid += 1
        continue
      }
      stats.parsed += 1
      visit(record)
    }
  } finally {
    reader.close()
  }
  return stats
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

/**
 * Record uuids already seen.
 *
 * Resume and fork copy the whole history into a new file with the very same
 * uuids, so a corpus-wide pass reads 26.5 K rows for 17.6 K distinct records.
 * First occurrence wins: later copies carry identical content by construction.
 */
export class UuidDeduplicator {
  private readonly seen = new Set<string>()
  private duplicates = 0

  /** @returns true when the record is new and should be processed. */
  accept(record: JsonObject): boolean {
    const uuid = stringField(record, "uuid")
    // Records without a uuid (custom-title, mode, …) are not duplicated.
    if (uuid === undefined) return true
    if (this.seen.has(uuid)) {
      this.duplicates += 1
      return false
    }
    this.seen.add(uuid)
    return true
  }

  /** How many rows were dropped as copies. */
  get dropped(): number {
    return this.duplicates
  }

  /** How many distinct uuids were seen. */
  get distinct(): number {
    return this.seen.size
  }
}
