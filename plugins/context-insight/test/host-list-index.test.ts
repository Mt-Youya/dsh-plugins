import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import type { DshListMeta } from "@cyrus/dsh-session-readers"
import { DshSource } from "../src/host/sources/dsh.ts"
import { listOptions } from "../src/host/http/routes.ts"

const WORKDIR = "/Users/example/repo"

/** Build one fake log plus its bucket directory; returns the log path. */
async function fixture(size = 64): Promise<{ root: string; index: string; log: string; mtime: number }> {
  const root = await mkdtemp(join(tmpdir(), "m13-dsh-"))
  const bucket = join(root, "--Users-example-repo--")
  const dir = join(bucket, "session-abc")
  await mkdir(dir, { recursive: true })
  const log = join(dir, "session.v4.jsonl.zstd")
  await writeFile(log, Buffer.alloc(size))
  const when = new Date("2026-10-20T00:00:00Z")
  await utimes(log, when, when)
  return { root, index: join(root, "index.json"), log, mtime: Math.round(when.getTime()) }
}

function meta(over: Partial<DshListMeta> = {}): DshListMeta {
  return {
    id: "session-abc",
    cwd: WORKDIR,
    createdAt: 1,
    delegationDepth: 0,
    bytes: 64,
    bytesRead: 12,
    framesRead: 2,
    title: "一个真实的标题",
    firstInput: "帮我看看这个仓库",
    ...over,
  }
}

describe("light index", () => {
  it("serves a row from the index without reading the log head", async () => {
    const { root, index, log, mtime } = await fixture()
    await writeFile(
      index,
      JSON.stringify({
        version: 1,
        scannedAt: 1,
        entries: [
          {
            path: log,
            mtimeMs: mtime,
            size: 64,
            id: "abc",
            cwd: WORKDIR,
            createdAt: 1,
            delegationDepth: 0,
            title: "索引里的标题",
          },
        ],
      })
    )
    const readMeta = vi.fn(async () => meta())
    const source = new DshSource({ root, indexPath: index, readMeta, scanTtlMs: 0 })
    const rows = await source.list(WORKDIR)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toBe("索引里的标题")
    expect(readMeta).not.toHaveBeenCalled()
  })

  it("rescan and re-reads the head after the log changes", async () => {
    const { root, index, log, mtime } = await fixture()
    await writeFile(
      index,
      JSON.stringify({
        version: 1,
        scannedAt: 1,
        entries: [
          {
            path: log,
            mtimeMs: mtime,
            size: 64,
            id: "abc",
            cwd: WORKDIR,
            createdAt: 1,
            delegationDepth: 0,
            title: "旧标题",
          },
        ],
      })
    )
    const readMeta = vi.fn(async () => meta({ title: "新标题" }))
    const source = new DshSource({ root, indexPath: index, readMeta, scanTtlMs: 0 })
    await source.list(WORKDIR)
    const later = new Date("2026-10-20T01:00:00Z")
    await utimes(log, later, later)
    source.invalidate()
    const rows = await source.list(WORKDIR)
    expect(readMeta).toHaveBeenCalledTimes(1)
    expect(rows[0]?.title).toBe("新标题")
  })
})

describe("subagent conversations are not siblings", () => {
  it("hides delegationDepth > 0 by default and shows it on request", async () => {
    const root = await mkdtemp(join(tmpdir(), "m13-sub-"))
    const bucket = join(root, "--Users-example-repo--")
    for (const name of ["session-main", "session-sub"]) {
      const dir = join(bucket, name)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, "session.v4.jsonl.zstd"), Buffer.alloc(64))
    }
    const readMeta = vi.fn(async (path: string) =>
      meta({
        id: path.includes("session-sub") ? "session-sub" : "session-main",
        delegationDepth: path.includes("session-sub") ? 1 : 0,
        title: path.includes("session-sub") ? "你是实现者。任务：…" : "主会话标题",
      })
    )
    const source = new DshSource({ root, indexPath: join(root, "none.json"), readMeta, scanTtlMs: 0 })
    const visible = await source.list(WORKDIR)
    expect(visible.map((row) => row.id)).toEqual(["main"])
    const all = await source.list(WORKDIR, { includeSubagents: true })
    expect(all.map((row) => row.id).sort()).toEqual(["main", "sub"])
    expect(all.find((row) => row.id === "sub")?.delegationDepth).toBe(1)
    expect(all.find((row) => row.id === "sub")?.title).toContain("你是实现者")
  })

  it("counts workdirs the same way it lists sessions", async () => {
    const root = await mkdtemp(join(tmpdir(), "m13-wd-"))
    const bucket = join(root, "--Users-example-repo--")
    for (const name of ["session-main", "session-sub"]) {
      const dir = join(bucket, name)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, "session.v4.jsonl.zstd"), Buffer.alloc(64))
    }
    const readMeta = vi.fn(async (path: string) =>
      meta({ id: path.includes("sub") ? "session-sub" : "session-main", delegationDepth: path.includes("sub") ? 1 : 0 })
    )
    const source = new DshSource({ root, indexPath: join(root, "none.json"), readMeta, scanTtlMs: 0 })
    const rows = await source.workdirs()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.sessions).toBe(1)
    const all = await source.workdirs({ includeSubagents: true })
    expect(all[0]?.sessions).toBe(2)
  })
})

describe("list query flags", () => {
  it("reads includeSubagents only as 1", () => {
    expect(listOptions(new URL("http://x/sessions?workdir=/a")).includeSubagents).toBe(false)
    expect(listOptions(new URL("http://x/sessions?workdir=/a&includeSubagents=1")).includeSubagents).toBe(true)
    expect(listOptions(new URL("http://x/sessions?workdir=/a&includeSubagents=0")).includeSubagents).toBe(false)
  })
})
