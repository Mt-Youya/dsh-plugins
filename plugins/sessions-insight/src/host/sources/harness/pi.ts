/**
 * pi's session corpus: one JSONL file per conversation.
 *
 * The directory name is a lossy encoding of the cwd (`/` becomes `-`), so it is
 * never decoded back: the file header carries the real `cwd`, and a session
 * whose header cannot be read is still listed with an empty workdir instead of
 * a guessed one.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/host/harness/pi
 */

import { open, readdir, stat } from "node:fs/promises"
import { basename, join } from "node:path"

import type { Session } from "@cyrusdoyle/dsh-session-contract"
import { readPiSession } from "@cyrusdoyle/dsh-session-readers"

import type { HarnessCorpus, HarnessRow, HarnessScan } from "./store.ts"

/** Bytes read from a session file to resolve its header. */
const HEADER_BYTES = 64 * 1024

/** Facts a pi header states, all optional because a truncated file may lack them. */
interface PiHeader {
  id?: string
  cwd?: string
  createdAt?: number
}

/** Read and decode the first line of one session file. */
async function readHeader(path: string): Promise<PiHeader> {
  const handle = await open(path, "r")
  try {
    const buffer = Buffer.allocUnsafe(HEADER_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, HEADER_BYTES, 0)
    const text = buffer.subarray(0, bytesRead).toString("utf8")
    const line = text.split("\n")[0] ?? ""
    if (!line.startsWith("{")) return {}
    const parsed: unknown = JSON.parse(line)
    if (typeof parsed !== "object" || parsed === null) return {}
    const record = parsed as Record<string, unknown>
    const header: PiHeader = {}
    if (typeof record["id"] === "string") header.id = record["id"]
    if (typeof record["cwd"] === "string") header.cwd = record["cwd"]
    if (typeof record["timestamp"] === "string") {
      const parsedAt = Date.parse(record["timestamp"])
      if (!Number.isNaN(parsedAt)) header.createdAt = parsedAt
    }
    return header
  } finally {
    await handle.close()
  }
}

/** pi's `~/.pi/agent/sessions` reader. */
export class PiCorpus implements HarnessCorpus {
  readonly app = "Pi"
  readonly root: string

  constructor(root: string) {
    this.root = root
  }

  async scan(): Promise<HarnessScan> {
    const scannedAt = Date.now()
    let dirs
    try {
      dirs = await readdir(this.root, { withFileTypes: true })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      return { state: code === "ENOENT" ? "missing" : "unreadable", rows: [], scannedAt }
    }
    const rows: HarnessRow[] = []
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue
      let entries
      try {
        entries = await readdir(join(this.root, dir.name), { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue
        const path = join(this.root, dir.name, entry.name)
        let info
        try {
          info = await stat(path)
        } catch {
          continue
        }
        if (info.size === 0) continue
        let header: PiHeader = {}
        try {
          header = await readHeader(path)
        } catch {
          // An unreadable header still lists: the row keeps its size and mtime.
        }
        const fallback = basename(entry.name, ".jsonl")
        const named = fallback.slice(fallback.indexOf("_") + 1)
        const row: HarnessRow = {
          id: header.id ?? (named === "" ? fallback : named),
          locator: path,
          workdir: header.cwd ?? "",
          bytes: info.size,
          updatedAt: Math.round(info.mtimeMs),
        }
        rows.push(row)
      }
    }
    rows.sort((a, b) => b.updatedAt - a.updatedAt)
    return { state: "ok", rows, scannedAt }
  }

  async read(row: HarnessRow): Promise<Session> {
    return readPiSession(row.locator, row.updatedAt)
  }
}
