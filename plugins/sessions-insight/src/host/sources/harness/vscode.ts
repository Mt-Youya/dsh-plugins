/**
 * The VS Code-family chat corpus: one file per conversation under
 * `workspaceStorage/<hash>/chatSessions/`, plus the window-less sessions in
 * `globalStorage/emptyWindowChatSessions/`.
 *
 * The format is owned by the workbench, not by an extension, so this corpus is
 * deliberately built from two facts only: the `chat.ChatSessionStore.index`
 * entry in the workspace's `state.vscdb` (title and last activity), and the
 * sibling `workspace.json` (the folder the conversation belongs to). The
 * conversation body is left to the reader.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/host/harness/vscode
 */

import { readdir, readFile, stat } from "node:fs/promises"
import { basename, join } from "node:path"

import type { Session } from "@cyrusdoyle/dsh-session-contract"
import { readVscodeChat } from "@cyrusdoyle/dsh-session-readers"

import { closeQuietly, openReadOnly, query, textOf } from "./sqlite.ts"
import type { HarnessCorpus, HarnessRow, HarnessScan } from "./store.ts"

/** File names the workbench uses for one chat session. */
const SESSION_SUFFIXES = [".jsonl", ".json"] as const

/** One entry of `chat.ChatSessionStore.index`. */
interface IndexEntry {
  title?: string
  lastMessageDate?: number
}

/** Decode a `workspace.json` folder URI into a local path. */
export function folderOfWorkspace(raw: string | undefined): string {
  if (raw === undefined) return ""
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return ""
    const folder = (parsed as Record<string, unknown>)["folder"]
    if (typeof folder !== "string") return ""
    if (!folder.startsWith("file://")) return ""
    return decodeURIComponent(folder.slice("file://".length))
  } catch {
    return ""
  }
}

/** Read one workspace's chat index, keyed by session id. */
async function readIndex(stateDb: string): Promise<Map<string, IndexEntry>> {
  const entries = new Map<string, IndexEntry>()
  const db = openReadOnly(stateDb)
  if (db === undefined) return entries
  try {
    const rows = query(db, "SELECT value FROM ItemTable WHERE key = ?", "chat.ChatSessionStore.index")
    const raw = rows?.[0] === undefined ? undefined : textOf(rows[0], "value")
    if (raw === undefined) return entries
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return entries
    }
    if (typeof parsed !== "object" || parsed === null) return entries
    const map = (parsed as Record<string, unknown>)["entries"]
    if (typeof map !== "object" || map === null) return entries
    for (const [id, value] of Object.entries(map as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue
      const record = value as Record<string, unknown>
      const entry: IndexEntry = {}
      if (typeof record["title"] === "string") entry.title = record["title"]
      if (typeof record["lastMessageDate"] === "number") entry.lastMessageDate = record["lastMessageDate"]
      entries.set(id, entry)
    }
    return entries
  } finally {
    closeQuietly(db)
  }
}

/** One VS Code build's chat store. */
export class VscodeChatCorpus implements HarnessCorpus {
  readonly app: string
  readonly root: string

  constructor(app: string, userDir: string) {
    this.app = app
    this.root = userDir
  }

  async scan(): Promise<HarnessScan> {
    const scannedAt = Date.now()
    const rows: HarnessRow[] = []
    let sawAnyDir = false
    let unreadable = 0
    let workspaces: { dir: string; hash: string }[]
    try {
      const entries = await readdir(join(this.root, "workspaceStorage"), { withFileTypes: true })
      workspaces = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
          dir: join(this.root, "workspaceStorage", entry.name),
          hash: entry.name,
        }))
      sawAnyDir = workspaces.length > 0
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === "ENOENT") return { state: "missing", rows: [], scannedAt }
      return { state: "unreadable", rows: [], scannedAt }
    }
    for (const workspace of workspaces) {
      const [files, index, workspaceJson] = await Promise.all([
        readdir(join(workspace.dir, "chatSessions"), { withFileTypes: true }).catch(() => undefined),
        readIndex(join(workspace.dir, "state.vscdb")),
        readFile(join(workspace.dir, "workspace.json"), "utf8").catch(() => undefined),
      ])
      if (files === undefined) continue
      const workdir = folderOfWorkspace(workspaceJson)
      for (const file of files) {
        if (!file.isFile()) continue
        const suffix = SESSION_SUFFIXES.find((candidate) => file.name.endsWith(candidate))
        if (suffix === undefined) continue
        const path = join(workspace.dir, "chatSessions", file.name)
        let info
        try {
          info = await stat(path)
        } catch {
          continue
        }
        const id = basename(file.name, suffix)
        const entry = index.get(id)
        const row: HarnessRow = {
          id,
          locator: path,
          workdir,
          bytes: info.size,
          updatedAt: Math.round(entry?.lastMessageDate ?? info.mtimeMs),
        }
        // "New Chat" is the index's placeholder until the auto-title runs; it is
        // not a name the reader should show twenty times.
        if (entry?.title !== undefined && entry.title.trim() !== "" && entry.title.trim() !== "New Chat") {
          row.title = entry.title
        }
        rows.push(row)
      }
    }
    // Window-less chats: one directory, no workspace.
    const emptyDir = join(this.root, "globalStorage", "emptyWindowChatSessions")
    try {
      const files = await readdir(emptyDir, { withFileTypes: true })
      sawAnyDir = true
      for (const file of files) {
        if (!file.isFile()) continue
        const suffix = SESSION_SUFFIXES.find((candidate) => file.name.endsWith(candidate))
        if (suffix === undefined) continue
        const path = join(emptyDir, file.name)
        let info
        try {
          info = await stat(path)
        } catch {
          continue
        }
        const id = basename(file.name, suffix)
        rows.push({ id, locator: path, workdir: "", bytes: info.size, updatedAt: Math.round(info.mtimeMs) })
      }
    } catch {
      // An install that never opened a window without a folder simply has none.
    }
    if (!sawAnyDir) return { state: "missing", rows: [], scannedAt: scannedAt }
    if (unreadable > 0 && rows.length === 0) return { state: "unreadable", rows: [], scannedAt }
    rows.sort((a, b) => b.updatedAt - a.updatedAt)
    return { state: "ok", rows, scannedAt }
  }

  async read(row: HarnessRow): Promise<Session> {
    return readVscodeChat(row.locator, row.workdir, row.updatedAt)
  }
}
