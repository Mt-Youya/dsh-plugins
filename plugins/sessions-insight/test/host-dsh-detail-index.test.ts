import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { zstdCompressSync } from "node:zlib"

import { LIST_META_BYTE_LIMIT, LIST_META_FRAME_LIMIT, readDshListMeta } from "@cyrusdoyle/dsh-session-readers"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DshSource } from "../src/host/sources/dsh.ts"

const WORKDIR = "/Users/example/mykaoyan"
const TITLE = "重构 cli 目录实现客户端依赖耦合"
const INPUT = "请检查客户端依赖"
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fixture(title = TITLE) {
  const root = await mkdtemp(join(tmpdir(), "dsh-detail-index-"))
  roots.push(root)
  const indexPath = join(root, "index.json")
  const logs = new Map<string, string>()
  for (const id of ["late", "other1", "other2", "other3", "other4"]) {
    const dir = join(root, "--Users-example-mykaoyan--", `session-${id}`)
    await mkdir(dir, { recursive: true })
    const events = [
      { type: "session", version: 4, id: `session-${id}`, cwd: WORKDIR, createdAt: 1, delegationDepth: 0 },
      ...Array.from({ length: 13 }, (_, i) => ({ type: "session/test-padding", seq: i + 1, time: i + 1, data: {} })),
      { type: "turn/start", seq: 14, time: 14, data: { turn: 1 } },
      {
        type: "user/message",
        seq: 15,
        time: 15,
        data: { role: "user", id: "u1", content: [{ type: "text", text: INPUT }], source: { kind: "user" } },
      },
      { type: "session/title", seq: 16, time: 16, data: { title, messageSeqs: [15], source: { kind: "provider" } } },
    ]
    const log = join(dir, "session.v4.jsonl.zstd")
    await writeFile(
      log,
      Buffer.concat(events.map((event) => zstdCompressSync(Buffer.from(`${JSON.stringify(event)}\n`)))),
    )
    logs.set(id, log)
  }
  const readMeta = vi.fn(readDshListMeta)
  return { root, indexPath, logs, readMeta }
}

async function assertLabels(source: DshSource, title: string | undefined, firstInput: string | undefined) {
  for (const rows of [await source.list(WORKDIR), await source.candidates()]) {
    const row = rows.find((entry) => entry.id === "late")
    expect(row).toBeDefined()
    expect(row?.title).toBe(title)
    expect(row?.firstInput).toBe(firstInput)
  }
}

describe("DSH detail-confirmed light metadata", () => {
  it("keeps late title and input after default LRU eviction, rescan and restart", async () => {
    const config = await fixture()
    const source = new DshSource(config)
    await assertLabels(source, undefined, undefined)
    const bounded = await readDshListMeta(config.logs.get("late")!)
    expect(bounded.framesRead).toBe(LIST_META_FRAME_LIMIT)
    expect(bounded.bytesRead).toBeLessThanOrEqual(LIST_META_BYTE_LIMIT)
    expect(bounded.title).toBeUndefined()
    const detail = await source.detail("late")
    expect(detail.ok).toBe(true)
    if (!detail.ok) return
    expect(detail.session.title).toBe(TITLE)
    await assertLabels(source, TITLE, INPUT)
    // Persistence must be complete when detail returns, not eventual.
    const saved = JSON.parse(await readFile(config.indexPath, "utf8"))
    expect(saved.entries.find((entry: { id: string }) => entry.id === "late")).toMatchObject({
      title: TITLE,
      firstInput: INPUT,
    })
    for (const id of ["other1", "other2", "other3", "other4"]) expect((await source.detail(id)).ok).toBe(true)
    await assertLabels(source, TITLE, INPUT)
    expect((await source.list(WORKDIR)).find((entry) => entry.id === "late")?.dataQuality).toContain(
      "list-item-unparsed",
    )
    source.invalidate()
    await assertLabels(source, TITLE, INPUT)
    const noHead = vi.fn(readDshListMeta)
    const restarted = new DshSource({ ...config, readMeta: noHead })
    await assertLabels(restarted, TITLE, INPUT)
    expect(noHead).not.toHaveBeenCalled()
    expect(config.readMeta).toHaveBeenCalledTimes(5)
  })

  it("repairs a titleless version-1 index on detail without rereading heads or changing logs", async () => {
    const config = await fixture()
    await new DshSource(config).list(WORKDIR)
    const noHead = vi.fn(readDshListMeta)
    const source = new DshSource({ ...config, readMeta: noHead })
    await assertLabels(source, undefined, undefined)
    const log = config.logs.get("late")!
    const original = await readFile(log)
    expect((await source.detail("late")).ok).toBe(true)
    await assertLabels(source, TITLE, INPUT)
    await assertLabels(new DshSource({ ...config, readMeta: noHead }), TITLE, INPUT)
    expect(noHead).not.toHaveBeenCalled()
    expect(await readFile(log)).toEqual(original)
  })

  it("keeps labels in memory after eviction even when index persistence is unavailable", async () => {
    const config = await fixture()
    // A file cannot be the parent directory of the optional index.
    const source = new DshSource({ ...config, indexPath: join(config.logs.get("late")!, "index.json") })
    expect((await source.detail("late")).ok).toBe(true)
    for (const id of ["other1", "other2", "other3", "other4"]) expect((await source.detail(id)).ok).toBe(true)
    await assertLabels(source, TITLE, INPUT)
  })

  it("drops body-derived labels when only mtime changes and the light head still has no title", async () => {
    const config = await fixture()
    const source = new DshSource({ ...config, scanTtlMs: 0 })
    expect((await source.detail("late")).ok).toBe(true)
    await assertLabels(source, TITLE, INPUT)
    const later = new Date("2030-01-01T00:00:00Z")
    await utimes(config.logs.get("late")!, later, later)
    // Do not clear the parsed LRU: its fingerprint must prevent stale reuse.
    await assertLabels(source, undefined, undefined)
    await assertLabels(new DshSource(config), undefined, undefined)
    expect(config.readMeta).toHaveBeenCalledTimes(6)
  })

  it("never promotes an identifier title but returns the raw title in detail", async () => {
    const uuid = "78189b83-b196-42f1-943f-d4b78896b227"
    const config = await fixture(uuid)
    const source = new DshSource(config)
    const detail = await source.detail("late")
    expect(detail.ok).toBe(true)
    if (detail.ok) expect(detail.session.title).toBe(uuid)
    await assertLabels(source, undefined, INPUT)
    source.invalidate()
    await assertLabels(new DshSource(config), undefined, INPUT)
  })

  it("serializes concurrent detail promotions without losing index rows", async () => {
    const config = await fixture()
    const source = new DshSource(config)
    await source.list(WORKDIR)
    const results = await Promise.all(["late", "other1", "other2"].map((id) => source.detail(id)))
    expect(results.every((result) => result.ok)).toBe(true)
    const saved = JSON.parse(await readFile(config.indexPath, "utf8"))
    for (const id of ["late", "other1", "other2"]) {
      expect(saved.entries.find((entry: { id: string }) => entry.id === id)).toMatchObject({
        title: TITLE,
        firstInput: INPUT,
      })
    }
  })
})
