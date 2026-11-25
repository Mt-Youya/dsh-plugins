/**
 * Read-only SQLite access for the harness corpora.
 *
 * Cursor, Antigravity and the Cline/Roo index are SQLite files owned by live
 * applications. Every open is `readOnly`, every statement is a plain SELECT, and
 * a database that cannot be read (locked by a running app, half-written WAL)
 * answers `undefined` so the caller can report a bounded failure instead of
 * throwing through the route. Only `node:sqlite` is used: the plugin runs on the
 * Host's Node (>= 24.22), so no native dependency is added.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/host/harness/sqlite
 */

import { DatabaseSync } from "node:sqlite"

/** A row as the driver returns it: column name to primitive or bytes. */
export type SqlRow = Record<string, unknown>

/**
 * Open a database read-only.
 * @param path - absolute path of the `.db`/`.vscdb` file.
 * @returns the connection, or undefined when it cannot be opened.
 */
export function openReadOnly(path: string): DatabaseSync | undefined {
  try {
    return new DatabaseSync(path, { readOnly: true })
  } catch {
    return undefined
  }
}

/**
 * Run one SELECT and return its rows.
 * @param db - open connection.
 * @param sql - statement text.
 * @param params - bound parameters.
 * @returns the rows, or undefined when the statement fails.
 */
export function query(db: DatabaseSync, sql: string, ...params: (string | number)[]): SqlRow[] | undefined {
  try {
    const statement = db.prepare(sql)
    return statement.all(...params) as SqlRow[]
  } catch {
    return undefined
  }
}

/** Close a connection without letting a close error escape. */
export function closeQuietly(db: DatabaseSync | undefined): void {
  if (db === undefined) return
  try {
    db.close()
  } catch {
    // A connection whose file vanished must not fail the read that already has
    // its answer.
  }
}

/** String column, or undefined for NULL and non-strings. */
export function textOf(row: SqlRow, column: string): string | undefined {
  const value = row[column]
  return typeof value === "string" ? value : undefined
}

/** Number column, accepting the driver's bigint and numeric strings. */
export function numberOf(row: SqlRow, column: string): number | undefined {
  const value = row[column]
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "bigint") return Number(value)
  return undefined
}

/** Blob column as bytes. */
export function bytesOf(row: SqlRow, column: string): Uint8Array | undefined {
  const value = row[column]
  if (value instanceof Uint8Array) return value
  return undefined
}
