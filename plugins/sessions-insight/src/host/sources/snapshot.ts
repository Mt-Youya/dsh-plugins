/**
 * Cross-source scan snapshots.
 *
 * A cold panel start used to walk and *head-read* every corpus: ~1.5 s for the
 * Codex rollouts alone, plus ~50 Claude headers and ~138 DSH headers. None of
 * that work changes when no file changed, so each source stores its listing
 * entries next to a fingerprint of the file set it walked. On the next start the
 * fingerprint — a cheap `readdir` + `stat`, no file reads — either matches and
 * the entries are reused, or it does not and the source rescans.
 *
 * The snapshot holds listing metadata only (ids, workdirs, sizes, mtimes and the
 * header facts the list shows). Bodies are never stored, and a changed file
 * always invalidates its source's snapshot.
 *
 * @module @cyrus/dsh-sessions-insight/host/snapshot
 */

import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { createHash } from "node:crypto"

/** One file as the fingerprint sees it. */
export interface FingerprintFile {
  path: string
  mtimeMs: number
  size: number
}

/** One source's cached scan. */
interface SourceSnapshot {
  fingerprint: string
  savedAt: number
  entries: unknown[]
}

interface SnapshotFile {
  version: 2
  sources: Record<string, SourceSnapshot>
}

/** Where the snapshot lives. */
export function snapshotPath(env: NodeJS.ProcessEnv = process.env): string {
  const home = env["DSH_HOME"]
  const root = home !== undefined && home.trim() !== "" ? home : join(homedir(), ".dsh")
  // Separate file from DSH's own per-log index: the two formats differ and used
  // to overwrite each other at the same path.
  return join(root, "dsh-sessions-insight", "snapshot.json")
}

async function readFileSnapshot(path: string): Promise<SnapshotFile> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as SnapshotFile
    if (parsed.version === 2 && typeof parsed.sources === "object" && parsed.sources !== null) return parsed
  } catch {
    // Missing or unreadable: a cold start is fine.
  }
  return { version: 2, sources: {} }
}

/**
 * Walk a tree and fingerprint every matching file.
 *
 * `readdir` + `stat` only — no file is opened, which is what keeps this cheap
 * enough to run on every start.
 * @param root - directory to walk.
 * @param match - which file names belong to the source.
 * @param depth - remaining directory depth.
 */
export async function walkFingerprint(
  root: string,
  match: (name: string) => boolean,
  depth = 3
): Promise<FingerprintFile[]> {
  const out: FingerprintFile[] = []
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      if (depth > 1) out.push(...(await walkFingerprint(path, match, depth - 1)))
      continue
    }
    if (!entry.isFile() || !match(entry.name)) continue
    try {
      const info = await stat(path)
      out.push({ path, mtimeMs: Math.round(info.mtimeMs), size: info.size })
    } catch {
      // A file that vanished mid-walk simply is not part of this fingerprint.
    }
  }
  return out
}

/**
 * Stable fingerprint for a file set.
 * @param files - the walked files.
 */
export function fingerprintOf(files: FingerprintFile[]): string {
  const hash = createHash("sha1")
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path)
    hash.update(":")
    hash.update(String(file.mtimeMs))
    hash.update(":")
    hash.update(String(file.size))
    hash.update("\n")
  }
  hash.update("count:" + String(files.length))
  return hash.digest("hex")
}

/**
 * Read one source's snapshot when the fingerprint still matches.
 * @param path - snapshot file.
 * @param source - source id.
 * @param fingerprint - fingerprint of the current file set.
 * @returns the cached entries, or undefined when a rescan is needed.
 */
export async function readSnapshot<T>(path: string, source: string, fingerprint: string): Promise<T[] | undefined> {
  const file = await readFileSnapshot(path)
  const entry = file.sources[source]
  if (entry === undefined || entry.fingerprint !== fingerprint) return undefined
  return entry.entries as T[]
}

/**
 * Store one source's snapshot atomically.
 * @param path - snapshot file.
 * @param source - source id.
 * @param fingerprint - fingerprint the entries correspond to.
 * @param entries - listing entries to cache.
 */
export async function writeSnapshot<T>(path: string, source: string, fingerprint: string, entries: T[]): Promise<void> {
  try {
    const file = await readFileSnapshot(path)
    file.sources[source] = { fingerprint, savedAt: Date.now(), entries }
    await mkdir(join(path, ".."), { recursive: true })
    const temp = path + ".tmp-" + String(process.pid)
    await writeFile(temp, JSON.stringify(file))
    await rename(temp, path)
  } catch {
    // Caching is an optimisation; failing to persist changes nothing.
  }
}
