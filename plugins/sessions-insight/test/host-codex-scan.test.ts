import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import * as readers from "@cyrusdoyle/dsh-session-readers"
import { afterEach, describe, expect, it, vi } from "vitest"

import { type CodexEntry, CodexSource } from "../src/host/sources/codex.ts"
import * as snapshots from "../src/host/sources/snapshot.ts"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const roots: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function source() {
  const root = await mkdtemp(join(tmpdir(), "host-codex-scan-"))
  roots.push(root)
  return new CodexSource({ root, indexPath: join(root, "snapshot.json") })
}

function row(id: string): CodexEntry {
  return { id, workdir: "/repo", firstPath: "", segments: [], bytes: 1, updatedAt: 1 }
}

describe("Codex scan concurrency", () => {
  it("merges simultaneous sources, workdirs and sessions into one expensive index", async () => {
    const reader = await source()
    const index = vi.spyOn(readers, "indexCodexCorpus")
    const [status, workdirs, sessions] = await Promise.all([reader.status(), reader.workdirs(), reader.list("/repo")])
    expect(status.available).toBe(true)
    expect(workdirs).toEqual([])
    expect(sessions).toEqual([])
    expect(index).toHaveBeenCalledTimes(1)
  })

  it("does not publish an invalidated scan or let its finally clear a newer scan", async () => {
    const reader = await source()
    const old = deferred<CodexEntry[] | undefined>()
    const current = deferred<CodexEntry[] | undefined>()
    const read = vi
      .spyOn(snapshots, "readSnapshot")
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => current.promise)
    const first = reader.scan()
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1))
    reader.invalidate()
    const second = reader.scan()
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    old.resolve([row("old")])
    await first
    const third = reader.scan()
    current.resolve([row("new")])
    const [fresh, joined] = await Promise.all([second, third])
    expect(joined).toBe(fresh)
    expect(joined.entries[0]?.id).toBe("new")
    expect((await reader.scan()).entries[0]?.id).toBe("new")
    expect(read).toHaveBeenCalledTimes(2)
  })

  it("clears inflight on failure so the next call retries", async () => {
    const reader = await source()
    const failure = deferred<CodexEntry[] | undefined>()
    const read = vi.spyOn(snapshots, "readSnapshot").mockImplementationOnce(() => failure.promise)
    const first = reader.scan()
    const second = reader.scan()
    const results = Promise.allSettled([first, second])
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1))
    failure.reject(new Error("snapshot failed"))
    expect((await results).map((result) => result.status)).toEqual(["rejected", "rejected"])
    expect((await reader.scan()).state).toBe("ok")
    expect(read).toHaveBeenCalledTimes(2)
  })
})
