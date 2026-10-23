import { readFile } from "node:fs/promises"
import { decodeSessionLog, splitLogLines } from "@cyrus/dsh-session-readers"

/** One header line's facts. */
export interface DshHeaderFacts {
  id?: string
  cwd?: string
  createdAt?: number
}

/**
 * Decode just enough of a session log to read its header line.
 * @param path - `session.v4.jsonl.zstd`.
 * @param limit - bytes read from offset 0.
 * @returns the header facts, or an empty object when none was found.
 */
export async function readDshHeaderFacts(path: string, limit: number): Promise<DshHeaderFacts> {
  const buffer = await readFile(path)
  const head = buffer.subarray(0, Math.min(buffer.length, limit))
  const decoded = decodeSessionLog(head)
  const lines = splitLogLines(decoded.text)
  for (const line of lines) {
    if (!line.includes('"type":"session"')) continue
    let record: unknown
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }
    if (typeof record !== "object" || record === null) continue
    const row = record as Record<string, unknown>
    if (row["type"] !== "session") continue
    const facts: DshHeaderFacts = {}
    if (typeof row["id"] === "string") facts.id = row["id"]
    if (typeof row["cwd"] === "string") facts.cwd = row["cwd"]
    if (typeof row["createdAt"] === "number") facts.createdAt = row["createdAt"]
    return facts
  }
  return {}
}
