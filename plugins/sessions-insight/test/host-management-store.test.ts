import { mkdirSync, renameSync } from "node:fs"
import * as fs from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { metadataPathFrom, SessionMetadataStore } from "../src/host/management/store.ts"
import {
  isMetadataPatch,
  isMetadataValue,
  isSessionMetadata,
  isSessionMetadataValue,
  SESSION_METADATA_PATH,
} from "../src/protocol/management.ts"

const ref = { source: "claude", id: "session-1" } as const
const cleanup: string[] = []
afterEach(async () => {
  for (const path of cleanup.splice(0)) await fs.rm(path, { recursive: true, force: true })
})

async function fixture() {
  const root = await fs.mkdtemp(join(tmpdir(), "insight-metadata-"))
  cleanup.push(root)
  const path = join(root, "plugin", "metadata.json")
  return { root, path, store: new SessionMetadataStore(path) }
}

describe("management wire guards", () => {
  it("uses a browser-relative path and strict patch shapes", () => {
    expect(SESSION_METADATA_PATH).toBe("/api/dsh-sessions-insight/session/metadata")
    expect(isMetadataPatch({ ...ref, title: "x".repeat(80), group: null })).toBe(true)
    expect(isMetadataPatch({ ...ref, title: null })).toBe(true)
    for (const value of [
      null,
      [],
      ref,
      { ...ref, title: "" },
      { ...ref, title: "   " },
      { ...ref, title: "x".repeat(81) },
      { ...ref, group: "x".repeat(81) },
      { ...ref, title: undefined },
      { ...ref, group: false },
      { ...ref, title: "a", extra: true },
      { ...ref, id: "../bad", title: "a" },
      { ...ref, source: "other", title: "a" },
    ]) {
      expect(isMetadataPatch(value), JSON.stringify(value)).toBe(false)
    }
    expect(isSessionMetadata({ ...ref, title: null })).toBe(false)
    expect(isSessionMetadata({ ...ref, group: "work" })).toBe(true)
    expect(isMetadataValue({ entries: [ref, ref] })).toBe(false)
    expect(isMetadataValue({ entries: [ref, { ...ref, source: "dsh" }] })).toBe(true)
    expect(isMetadataValue({ entries: [], extra: 1 })).toBe(false)
    expect(isSessionMetadataValue({ metadata: ref, displayTitle: "original" })).toBe(true)
    expect(isSessionMetadataValue({ metadata: ref, displayTitle: null })).toBe(false)
  })
})

describe("plugin-owned metadata store", () => {
  it("defaults to DSH_HOME independently of corpus overrides", () => {
    expect(metadataPathFrom({ DSH_HOME: "/isolated", DSH_CONTEXT_INSIGHT_DSH_ROOT: "/logs" })).toBe(
      "/isolated/dsh-sessions-insight/metadata.json",
    )
    expect(metadataPathFrom({ DSH_HOME: " " })).toMatch(/\.dsh\/dsh-sessions-insight\/metadata.json$/)
  })

  it("persists partial patches, separates sources and restores null fields", async () => {
    const { store, path } = await fixture()
    expect(await store.read()).toEqual({ entries: [] })
    expect(await store.patch({ ...ref, title: "  manual  ", group: " work " })).toEqual({
      ...ref,
      title: "manual",
      group: "work",
    })
    await store.patch({ ...ref, source: "dsh", title: "other" })
    await store.patch({ ...ref, title: null })
    expect(await new SessionMetadataStore(path).read()).toEqual({
      entries: [
        { ...ref, source: "dsh", title: "other" },
        { ...ref, group: "work" },
      ],
    })
    expect(await store.patch({ ...ref, group: null })).toEqual(ref)
    await store.remove("dsh", ref.id)
    expect(await store.read()).toEqual({ entries: [] })
    await expect(store.patch({ ...ref, title: "" })).rejects.toThrow("invalid-metadata-patch")
  })

  it("serializes concurrent reads and writes even across instances", async () => {
    const { store, path } = await fixture()
    const other = new SessionMetadataStore(path)
    const title = store.patch({ ...ref, title: "manual" })
    const group = other.patch({ ...ref, group: "work" })
    const read = store.read()
    await Promise.all([title, group])
    expect(await read).toEqual({ entries: [{ ...ref, title: "manual", group: "work" }] })
    await Promise.all(Array.from({ length: 12 }, (_, index) => other.patch({ ...ref, id: `row-${index}`, title: "x" })))
    expect((await store.read()).entries).toHaveLength(13)
  })

  it("does not overwrite corrupt existing data", async () => {
    const { store, path } = await fixture()
    await fs.mkdir(join(path, ".."), { recursive: true })
    for (const text of ["{broken", JSON.stringify({ entries: [{ ...ref, title: null }] })]) {
      await fs.writeFile(path, text)
      await expect(store.read()).rejects.toThrow()
      await expect(store.patch({ ...ref, title: "replacement" })).rejects.toThrow()
      expect(await fs.readFile(path, "utf8")).toBe(text)
    }
  })

  it("leaves the old file intact on replacement failure and recovers its queue", async () => {
    const { store, path } = await fixture()
    await store.patch({ ...ref, title: "old" })
    const before = await fs.readFile(path, "utf8")
    const backup = `${path}.old`
    let blockReplacement = false
    const pending = store.patch({
      ...ref,
      get title() {
        // Validation is synchronous; apply the fault after the queued disk read,
        // before the real temporary-file rename. A file cannot replace a directory.
        if (blockReplacement) {
          blockReplacement = false
          renameSync(path, backup)
          mkdirSync(path)
        }
        return "new"
      },
    })
    blockReplacement = true
    await expect(pending).rejects.toMatchObject({ code: "EISDIR" })
    expect(await fs.readFile(backup, "utf8")).toBe(before)
    expect((await fs.readdir(join(path, ".."))).sort()).toEqual(["metadata.json", "metadata.json.old"])
    await fs.rmdir(path)
    await fs.rename(backup, path)
    expect(await fs.readFile(path, "utf8")).toBe(before)
    expect(await store.read()).toEqual({ entries: [{ ...ref, title: "old" }] })
    await store.patch({ ...ref, group: "next" })
    expect(await store.read()).toEqual({ entries: [{ ...ref, title: "old", group: "next" }] })
  })
})
