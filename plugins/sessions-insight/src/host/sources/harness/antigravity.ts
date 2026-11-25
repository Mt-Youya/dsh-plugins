/**
 * Antigravity's conversation corpus.
 *
 * Antigravity keeps a per-conversation folder under
 * `~/.gemini/antigravity{,-ide,-cli}/brain/<uuid>/`; the transcript the app
 * displays is `.system_generated/logs/transcript_full.jsonl`. The index beside
 * it — `conversation_summaries.db` — is the only place with titles, timestamps
 * and workspace URIs, so discovery reads that database and the body is left to
 * the reader. Older builds without a transcript still have the same steps as
 * protobuf blobs in `conversations/<uuid>.db`, which the reader falls back to.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/host/harness/antigravity
 */

import { access, stat } from "node:fs/promises"
import { join } from "node:path"

import type { Session } from "@cyrusdoyle/dsh-session-contract"
import {
  type AntigravityStep,
  readAntigravityConversation,
  readAntigravityTranscript,
} from "@cyrusdoyle/dsh-session-readers"

import { bytesOf, closeQuietly, numberOf, openReadOnly, query, textOf } from "./sqlite.ts"
import type { HarnessCorpus, HarnessRow, HarnessScan } from "./store.ts"

/** Transcript paths Antigravity has used, newest first. */
const TRANSCRIPTS = ["transcript_full.jsonl", "transcript.jsonl"] as const

/** Decode `last_modified_time`, which the driver may return as text. */
export function timeOfSummary(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string" || value.trim() === "") return undefined
  const normalized = value
    .trim()
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1")
  const parsed = Date.parse(normalized)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** First local folder named by the `workspace_uris` JSON array. */
export function folderOfUris(raw: string | undefined): string {
  if (raw === undefined) return ""
  let list: unknown
  try {
    list = JSON.parse(raw)
  } catch {
    return ""
  }
  if (!Array.isArray(list)) return ""
  for (const uri of list) {
    if (typeof uri !== "string" || !uri.startsWith("file://")) continue
    try {
      const path = decodeURIComponent(uri.slice("file://".length))
      if (path !== "") return path
    } catch {
      continue
    }
  }
  return ""
}

/** One Antigravity data folder. */
export class AntigravityCorpus implements HarnessCorpus {
  readonly app = "Antigravity"
  readonly root: string

  constructor(dataDir: string) {
    this.root = dataDir
  }

  async scan(): Promise<HarnessScan> {
    const scannedAt = Date.now()
    const db = openReadOnly(join(this.root, "conversation_summaries.db"))
    if (db === undefined) return { state: "missing", rows: [], scannedAt }
    try {
      const rows = query(
        db,
        "SELECT conversation_id, title, preview, workspace_uris, last_modified_time FROM conversation_summaries",
      )
      if (rows === undefined) return { state: "unreadable", rows: [], scannedAt }
      const out: HarnessRow[] = []
      for (const row of rows) {
        const id = textOf(row, "conversation_id")
        if (id === undefined || id === "") continue
        const title = textOf(row, "title")
        const preview = textOf(row, "preview")
        const updatedAt = timeOfSummary(row["last_modified_time"]) ?? 0
        const bytes = await this.#sizeOf(id)
        const row_: HarnessRow = {
          id,
          locator: id,
          workdir: folderOfUris(textOf(row, "workspace_uris")),
          bytes,
          updatedAt,
        }
        const label = title !== undefined && title.trim() !== "" ? title : preview
        if (label !== undefined && label.trim() !== "") row_.title = label.trim()
        out.push(row_)
      }
      out.sort((a, b) => b.updatedAt - a.updatedAt)
      return { state: "ok", rows: out, scannedAt }
    } finally {
      closeQuietly(db)
    }
  }

  /** Size of whatever stores this conversation's body. */
  async #sizeOf(id: string): Promise<number> {
    for (const path of [
      ...TRANSCRIPTS.map((name) => join(this.root, "brain", id, ".system_generated", "logs", name)),
      join(this.root, "conversations", `${id}.db`),
    ]) {
      try {
        const info = await stat(path)
        return info.size
      } catch {
        continue
      }
    }
    return 0
  }

  /** Absolute path of the transcript, when this conversation has one. */
  async #transcriptOf(id: string): Promise<string | undefined> {
    for (const name of TRANSCRIPTS) {
      const path = join(this.root, "brain", id, ".system_generated", "logs", name)
      try {
        await access(path)
        return path
      } catch {
        continue
      }
    }
    return undefined
  }

  async read(row: HarnessRow): Promise<Session> {
    const transcript = await this.#transcriptOf(row.id)
    if (transcript !== undefined) {
      return readAntigravityTranscript(transcript, {
        id: row.id,
        workdir: row.workdir,
        createdAt: row.updatedAt,
        ...(row.title === undefined ? {} : { title: row.title }),
      })
    }
    return this.#readDatabase(row)
  }

  /** Pre-transcript fallback: the conversation's own SQLite step log. */
  async #readDatabase(row: HarnessRow): Promise<Session> {
    const path = join(this.root, "conversations", `${row.id}.db`)
    const db = openReadOnly(path)
    if (db === undefined) throw new Error("antigravity-conversation-unreadable")
    try {
      const stepRows = query(db, "SELECT idx, step_type, status, metadata, step_payload FROM steps ORDER BY idx")
      if (stepRows === undefined) throw new Error("antigravity-steps-unreadable")
      const steps: AntigravityStep[] = []
      for (const step of stepRows) {
        const payload = bytesOf(step, "step_payload")
        const metadata = bytesOf(step, "metadata")
        steps.push({
          idx: numberOf(step, "idx") ?? 0,
          stepType: numberOf(step, "step_type") ?? 0,
          status: numberOf(step, "status") ?? 0,
          metadata: metadata ?? new Uint8Array(0),
          payload: payload ?? new Uint8Array(0),
        })
      }
      const executor = query(db, "SELECT data FROM executor_metadata ORDER BY idx LIMIT 1")
      const executorBlob = executor?.[0] === undefined ? undefined : bytesOf(executor[0], "data")
      return readAntigravityConversation({
        id: row.id,
        workdir: row.workdir,
        segment: path,
        steps,
        ...(executorBlob === undefined ? {} : { executor: executorBlob }),
        createdAt: row.updatedAt,
        ...(row.title === undefined ? {} : { title: row.title }),
      })
    } finally {
      closeQuietly(db)
    }
  }
}
