/**
 * The Cline / Roo Code task corpus: one directory per task.
 *
 * Both extensions live in VS Code's `globalStorage`, under
 * `saoudrizwan.claude-dev/tasks` and `rooveterinaryinc.roo-cline/tasks`. Cline's
 * id never changed (a new id would orphan every user's history), and Roo keeps
 * the Cline layout, so one reader serves both; the label only says which app's
 * directory the row came from.
 *
 * A scan reads file sizes and the first kilobyte of `ui_messages.json` (the
 * task text), never the conversation: opening a task is the reader's job.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/host/harness/cline
 */

import { open, readdir, stat } from "node:fs/promises"
import { join } from "node:path"

import type { Session } from "@cyrusdoyle/dsh-session-contract"
import { readClineTask } from "@cyrusdoyle/dsh-session-readers"

import { excerptOf } from "./store.ts"
import type { HarnessCorpus, HarnessRow, HarnessScan } from "./store.ts"

/** Bytes scanned for the task text and the workspace line. */
const HEADER_BYTES = 64 * 1024

/** Files whose mtime and size describe a task. */
const TASK_FILES = ["ui_messages.json", "api_conversation_history.json"] as const

/** Decode the JSON string body of the first `"say":"task"` record. */
export function taskTextOf(text: string): string | undefined {
  const match = /"say"\s*:\s*"task"[^{}]*?"text"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text)
  if (match?.[1] === undefined) return undefined
  try {
    return JSON.parse(`"${match[1]}"`) as string
  } catch {
    return undefined
  }
}

/** Workspace directory Cline recorded in its environment block. */
export function workspaceOf(text: string): string | undefined {
  const match = /# Current Workspace Directory \((.+?)\)/.exec(text)
  return match?.[1]
}

/** Read the first bytes of a file, or undefined when it does not exist. */
async function headOf(path: string): Promise<string | undefined> {
  let handle
  try {
    handle = await open(path, "r")
  } catch {
    return undefined
  }
  try {
    const buffer = Buffer.allocUnsafe(HEADER_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, HEADER_BYTES, 0)
    return buffer.subarray(0, bytesRead).toString("utf8")
  } finally {
    await handle.close()
  }
}

/** One app extension's `tasks` directory. */
export class ClineCorpus implements HarnessCorpus {
  readonly app: string
  readonly root: string

  constructor(app: string, tasksDir: string) {
    this.app = app
    this.root = tasksDir
  }

  async scan(): Promise<HarnessScan> {
    const scannedAt = Date.now()
    let entries
    try {
      entries = await readdir(this.root, { withFileTypes: true })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      return { state: code === "ENOENT" ? "missing" : "unreadable", rows: [], scannedAt }
    }
    const rows: HarnessRow[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dir = join(this.root, entry.name)
      let bytes = 0
      let updatedAt = 0
      for (const name of TASK_FILES) {
        try {
          const info = await stat(join(dir, name))
          bytes += info.size
          updatedAt = Math.max(updatedAt, Math.round(info.mtimeMs))
        } catch {
          // A task interrupted before its first request has no history file.
        }
      }
      if (bytes === 0) continue
      const head = (await headOf(join(dir, "ui_messages.json"))) ?? ""
      const historyHead = (await headOf(join(dir, "api_conversation_history.json"))) ?? ""
      // The workspace line lives in the environment block of the API history;
      // the UI log only has it when Cline echoed a tool result that carried it.
      const workdir = workspaceOf(historyHead) ?? workspaceOf(head) ?? ""
      const row: HarnessRow = { id: entry.name, locator: dir, workdir, bytes, updatedAt }
      const task = taskTextOf(head)
      if (task !== undefined) {
        const excerpt = excerptOf(task)
        if (excerpt !== undefined) {
          row.title = excerpt
          row.firstInput = excerpt
        }
      }
      rows.push(row)
    }
    rows.sort((a, b) => b.updatedAt - a.updatedAt)
    return { state: "ok", rows, scannedAt }
  }

  async read(row: HarnessRow): Promise<Session> {
    return readClineTask(row.locator, row.updatedAt)
  }
}
