import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { zstdCompressSync } from "node:zlib"
import { readDshListMeta, LIST_META_BYTE_LIMIT, LIST_META_FRAME_LIMIT } from "@cyrus/dsh-session-readers"

let scratch: string | undefined

afterEach(() => {
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true })
  scratch = undefined
})

let clock = 0
function at(): number {
  clock += 1
  return Date.UTC(2026, 0, 1, 0, 0, clock)
}

function header(extra: Record<string, unknown> = {}): unknown {
  return {
    type: "session",
    version: 4,
    id: "session-1",
    createdAt: at(),
    cwd: "/tmp/work",
    isSeeded: false,
    delegationDepth: 0,
    agentPreset: "standard",
    ...extra,
  }
}

function event(seq: number, type: string, data: Record<string, unknown>): unknown {
  return { type, seq, time: at(), data }
}

function title(seq: number, text: string, kind = "fallback"): unknown {
  return event(seq, "session/title", { title: text, messageSeqs: [10], source: { kind } })
}

function user(seq: number, text: string, kind = "user"): unknown {
  return event(seq, "user/message", {
    role: "user",
    id: `u-${seq}`,
    content: [{ type: "text", text }],
    source: { kind },
  })
}

/** Write a log split into one frame per supplied chunk. */
function writeLog(name: string, chunks: unknown[][]): string {
  scratch ??= mkdtempSync(join(tmpdir(), "dsh-listmeta-"))
  const directory = join(scratch, name)
  mkdirSync(directory, { recursive: true })
  const path = join(directory, "session.v4.jsonl.zstd")
  const pieces: Buffer[] = []
  for (const chunk of chunks) {
    const text = chunk.map((line) => JSON.stringify(line)).join("\n") + "\n"
    pieces.push(zstdCompressSync(Buffer.from(text)))
  }
  writeFileSync(path, Buffer.concat(pieces))
  return path
}

/** Filler events that push everything after them into later frames. */
function filler(from: number, count: number): unknown[] {
  return Array.from({ length: count }, (_, index) => event(from + index, "step/start", { turn: 1, step: index + 1 }))
}

describe("readDshListMeta", () => {
  it("reads a title that lives in the first frames", async () => {
    const path = writeLog("titled", [
      [header(), event(1, "turn/start", { turn: 1 }), user(2, "把会话列表补上标题")],
      [title(3, "会话列表标题"), event(4, "step/start", { turn: 1, step: 1 })],
    ])
    const meta = await readDshListMeta(path)
    expect(meta.title).toBe("会话列表标题")
    expect(meta.id).toBe("session-1")
    expect(meta.cwd).toBe("/tmp/work")
    expect(meta.delegationDepth).toBe(0)
    expect(meta.degraded).toBeUndefined()
  })

  it("prefers the last title in the window, because titles are a mutation", async () => {
    const path = writeLog("mutated", [
      [header(), user(2, "原始输入"), title(3, "fallback 标题"), title(4, "provider 标题", "provider")],
    ])
    const meta = await readDshListMeta(path)
    expect(meta.title).toBe("provider 标题")
  })

  it("falls back to the first human input when the title is past the frame budget", async () => {
    const chunks: unknown[][] = [[header(), user(2, "第一个用户输入")]]
    for (let index = 0; index < 6; index += 1) chunks.push(filler(10 + index * 10, 9))
    chunks.push([title(200, "来晚了")])
    const path = writeLog("late-title", chunks)
    const bounded = await readDshListMeta(path, { maxFrames: 3 })
    expect(bounded.title).toBeUndefined()
    expect(bounded.firstInput).toBe("第一个用户输入")
    expect(bounded.framesRead).toBe(3)
    // The same file with the default window does reach the title.
    const full = await readDshListMeta(path)
    expect(full.title).toBe("来晚了")
  })

  it("never reads a large file whole", async () => {
    // Filler has to be *incompressible*, or a few hundred KB of repeated text
    // collapses to a few KB and the byte budget would never bind.
    let seed = 12345
    const noise = (): string => {
      let out = ""
      for (let index = 0; index < 240; index += 1) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        out += (seed % 36).toString(36)
      }
      return out
    }
    const chunks: unknown[][] = [[header(), user(2, "大文件")]]
    for (let index = 0; index < 60; index += 1) {
      chunks.push(
        Array.from({ length: 60 }, (_, offset) =>
          event(100 + index * 60 + offset, "step/start", { turn: 1, step: offset, note: noise() })
        )
      )
    }
    const path = writeLog("huge", chunks)
    const size = statSync(path).size
    expect(size).toBeGreaterThan(LIST_META_BYTE_LIMIT)

    const meta = await readDshListMeta(path)
    expect(meta.bytes).toBe(size)
    expect(meta.bytesRead).toBeLessThanOrEqual(LIST_META_BYTE_LIMIT)
    expect(meta.bytesRead).toBeLessThan(size)
    expect(meta.framesRead).toBeLessThanOrEqual(LIST_META_FRAME_LIMIT)
  })

  it("exposes delegationDepth so a subagent row is distinguishable", async () => {
    const subagent = writeLog("sub", [
      [header({ id: "child-1", delegationDepth: 1, agentPreset: "liangshen" }), user(2, "你是实现者。仓库：/x")],
    ])
    const main = writeLog("main", [[header({ id: "main-1" }), user(2, "我的计划是做一个插件")]])
    const child = await readDshListMeta(subagent)
    const parent = await readDshListMeta(main)
    expect(child.delegationDepth).toBe(1)
    expect(parent.delegationDepth).toBe(0)
    expect(child.id).toBe("child-1")
    // A header without the field must default to 0 rather than undefined.
    const bare = await readDshListMeta(
      writeLog("bare", [[{ type: "session", version: 4, id: "bare-1", cwd: "/tmp/work", createdAt: 1 }, user(2, "hi")]])
    )
    expect(bare.delegationDepth).toBe(0)
  })

  it("returns a degraded row instead of throwing on a corrupt file", async () => {
    scratch ??= mkdtempSync(join(tmpdir(), "dsh-listmeta-"))
    const directory = join(scratch, "corrupt")
    mkdirSync(directory, { recursive: true })
    const path = join(directory, "session.v4.jsonl.zstd")
    writeFileSync(path, Buffer.from("this is not a zstandard frame at all"))

    const meta = await readDshListMeta(path)
    expect(meta.degraded).toBe(true)
    expect(meta.id).toBe("corrupt")
    expect(meta.framesRead).toBe(0)
    expect(meta.bytes).toBeGreaterThan(0)
    expect(meta.title).toBeUndefined()
  })

  it("does not throw when the file is missing", async () => {
    const meta = await readDshListMeta("/nonexistent/bucket/some-session/session.v4.jsonl.zstd")
    expect(meta.degraded).toBe(true)
    expect(meta.id).toBe("some-session")
    expect(meta.bytes).toBe(0)
  })

  it("ignores harness-written user messages when picking the first input", async () => {
    const path = writeLog("injected", [[header(), user(2, "【审批通过】", "user-approval"), user(3, "真实的人类输入")]])
    const meta = await readDshListMeta(path)
    expect(meta.firstInput).toBe("真实的人类输入")
  })
})
