/**
 * Cursor's composer corpus, read from the global `state.vscdb`.
 *
 * Every conversation on the machine lives in one SQLite database: a
 * `composerData:<id>` row describes it and `bubbleId:<composerId>:<bubbleId>`
 * rows hold its messages. The per-workspace databases only keep an index, so
 * discovery opens `globalStorage/state.vscdb` read-only and never writes to it.
 *
 * A composer whose workspace cannot be resolved keeps an empty workdir: Cursor
 * stores the folder as an object (`workspaceIdentifier.uri.fsPath`) on newer
 * builds, as a workspace hash on older ones, and not at all on cloud-only
 * composers.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/host/harness/cursor
 */

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import type { Session } from "@cyrusdoyle/dsh-session-contract"
import { type CursorBubble, readCursorComposer } from "@cyrusdoyle/dsh-session-readers"

import { bytesOf, closeQuietly, numberOf, openReadOnly, query, textOf } from "./sqlite.ts"
import type { HarnessCorpus, HarnessRow, HarnessScan } from "./store.ts"

/** Value of a KV row as text, whatever the driver returns. */
function valueText(row: Record<string, unknown>): string | undefined {
  const value = row["value"]
  if (typeof value === "string") return value
  const bytes = bytesOf(row, "value")
  return bytes === undefined ? undefined : Buffer.from(bytes).toString("utf8")
}

/** Path Cursor stored inside `workspaceIdentifier`/`configPath`. */
function pathOf(record: Record<string, unknown>): string | undefined {
  const identifier = record["workspaceIdentifier"]
  if (typeof identifier !== "object" || identifier === null) return undefined
  const container = identifier as Record<string, unknown>
  for (const key of ["uri", "configPath"]) {
    const candidate = container[key]
    if (typeof candidate !== "object" || candidate === null) continue
    const path = (candidate as Record<string, unknown>)["fsPath"]
    if (typeof path === "string" && path !== "") return path
  }
  return undefined
}

/** Workspace folder from one workspace's `workspace.json`. */
async function folderOfUserWorkspace(user: string, hash: string): Promise<string | undefined> {
  try {
    const raw = await readFile(join(user, "workspaceStorage", hash, "workspace.json"), "utf8")
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return undefined
    const folder = (parsed as Record<string, unknown>)["folder"]
    if (typeof folder !== "string" || !folder.startsWith("file://")) return undefined
    return decodeURIComponent(folder.slice("file://".length))
  } catch {
    return undefined
  }
}

/** Cursor's chat store. */
export class CursorCorpus implements HarnessCorpus {
  readonly app = "Cursor"
  readonly root: string
  readonly #user: string

  constructor(userDir: string) {
    this.#user = userDir
    this.root = join(userDir, "globalStorage")
  }

  async scan(): Promise<HarnessScan> {
    const scannedAt = Date.now()
    const dbPath = join(this.root, "state.vscdb")
    const db = openReadOnly(dbPath)
    if (db === undefined) {
      return { state: "missing", rows: [], scannedAt }
    }
    try {
      const composers = query(db, "SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'")
      if (composers === undefined) return { state: "unreadable", rows: [], scannedAt }
      const bubbleSizes = new Map<string, number>()
      const bubbles = query(db, "SELECT key, length(value) AS size FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'")
      for (const row of bubbles ?? []) {
        const key = textOf(row, "key")
        if (key === undefined) continue
        const parts = key.split(":")
        const composerId = parts[1]
        if (composerId === undefined) continue
        bubbleSizes.set(composerId, (bubbleSizes.get(composerId) ?? 0) + (numberOf(row, "size") ?? 0))
      }
      const rows: HarnessRow[] = []
      for (const row of composers) {
        const key = textOf(row, "key")
        const value = valueText(row)
        if (key === undefined || value === undefined) continue
        const composerId = key.slice("composerData:".length)
        let composer: unknown
        try {
          composer = JSON.parse(value)
        } catch {
          continue
        }
        if (typeof composer !== "object" || composer === null) continue
        const record = composer as Record<string, unknown>
        // A composer with no bubbles and no inline map is a draft the user
        // typed but never sent; listing it would fill the tree with empty chats.
        const inline = record["conversationMap"]
        const headers = record["fullConversationHeadersOnly"]
        const hasInline =
          (typeof inline === "object" &&
            inline !== null &&
            Object.keys(inline as Record<string, unknown>).length > 0) ||
          (Array.isArray(headers) && headers.length > 0)
        if ((bubbleSizes.get(composerId) ?? 0) === 0 && !hasInline) continue
        const workdir = (await this.#workdirOf(record)) ?? ""
        const created = numberOf(record, "createdAt")
        const updated = numberOf(record, "lastUpdatedAt") ?? created
        const row_: HarnessRow = {
          id: composerId,
          locator: `composerData:${composerId}`,
          workdir,
          bytes: value.length + (bubbleSizes.get(composerId) ?? 0),
          updatedAt: updated ?? scannedAt,
        }
        const name = record["name"]
        if (typeof name === "string" && name.trim() !== "") row_.title = name.trim()
        rows.push(row_)
      }
      rows.sort((a, b) => b.updatedAt - a.updatedAt)
      return { state: "ok", rows, scannedAt }
    } finally {
      closeQuietly(db)
    }
  }

  /** Resolve the folder the composer was opened in, when Cursor recorded one. */
  async #workdirOf(composer: Record<string, unknown>): Promise<string | undefined> {
    const direct = pathOf(composer)
    if (direct !== undefined) return direct
    const headers = composer["composerHeaders"]
    if (typeof headers === "object" && headers !== null) {
      const id = (headers as Record<string, unknown>)["workspaceId"]
      if (typeof id === "string" && id !== "" && id !== "empty-window") {
        return folderOfUserWorkspace(this.#user, id)
      }
    }
    return undefined
  }

  async read(row: HarnessRow): Promise<Session> {
    const dbPath = join(this.root, "state.vscdb")
    const db = openReadOnly(dbPath)
    if (db === undefined) throw new Error("cursor-database-unreadable")
    try {
      const composerId = row.id
      const composerRows = query(db, "SELECT value FROM cursorDiskKV WHERE key = ?", `composerData:${composerId}`)
      const rawComposer = composerRows?.[0] === undefined ? undefined : valueText(composerRows[0])
      if (rawComposer === undefined) throw new Error("cursor-composer-missing")
      const composer: unknown = JSON.parse(rawComposer)
      if (typeof composer !== "object" || composer === null) throw new Error("cursor-composer-invalid")
      const bubbleRows = query(db, "SELECT key, value FROM cursorDiskKV WHERE key LIKE ?", `bubbleId:${composerId}:%`)
      const bubbles: CursorBubble[] = []
      for (const bubble of bubbleRows ?? []) {
        const key = textOf(bubble, "key")
        const value = valueText(bubble)
        if (key === undefined || value === undefined) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(value)
        } catch {
          continue
        }
        bubbles.push({ bubbleId: key.split(":").slice(2).join(":"), value: parsed })
      }
      return readCursorComposer({
        composer: composer as Record<string, unknown>,
        bubbles,
        workdir: row.workdir,
        segment: `cursorDiskKV/${composerId}`,
        now: row.updatedAt,
      })
    } finally {
      closeQuietly(db)
    }
  }
}
