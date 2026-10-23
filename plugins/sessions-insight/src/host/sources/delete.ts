import { lstat, unlink } from "node:fs/promises"
import { resolveInside } from "./paths.ts"
import type { SourceFailure } from "./source.ts"

/** Validate the entire set before unlinking any file; never recursively remove a directory. */
export async function deleteLogs(root: string, paths: readonly string[]): Promise<{ ok: true } | SourceFailure> {
  if (paths.length === 0) return { ok: false, error: "not-found", detail: "session-not-found" }
  const targets: string[] = []
  for (const path of paths) {
    const target = await resolveInside(root, path)
    if (target === undefined || !(await lstat(path)).isFile()) {
      return { ok: false, error: "forbidden", detail: "unsafe-session-path" }
    }
    targets.push(target)
  }
  for (const target of new Set(targets)) await unlink(target)
  return { ok: true }
}
