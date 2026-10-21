import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { zstdCompressSync } from "node:zlib"
import { readDshSession } from "@cyrus/dsh-session-readers"
import { decodeSessionLog } from "@cyrus/dsh-session-readers"
import { parseProjection, isProjectionFresh, type DshProjection } from "@cyrus/dsh-session-readers"

let scratch: string | undefined

afterEach(() => {
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true })
  scratch = undefined
})

let clock = 0
/** Timestamp that advances one second per event. */
function at(): number {
  clock += 1
  return Date.UTC(2026, 0, 1, 0, 0, clock)
}

/** Build the header line every log starts with. */
function header(id = "session-1", cwd = "/tmp/work"): unknown {
  return {
    type: "session",
    version: 4,
    id,
    createdAt: at(),
    cwd,
    isSeeded: false,
    delegationDepth: 0,
    agentPreset: "standard",
  }
}

/** Wrap one event in the envelope the log uses. */
function event(seq: number, type: string, data: Record<string, unknown>, time = at()): unknown {
  return { type, seq, time, data }
}

function usage(input: number, cacheRead: number, cacheWrite: number, output: number): Record<string, number> {
  return {
    inputTokens: input,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    outputTokens: output,
    totalTokens: input + cacheRead + cacheWrite + output,
  }
}

/** One assistant response carrying usage. */
function assistant(
  seq: number,
  turn: number,
  step: number,
  counters: Record<string, number>,
  blocks: unknown[] = [{ type: "text", text: "ok" }]
): unknown {
  return event(seq, "assistant/message", {
    turn,
    step,
    message: {
      role: "assistant",
      id: `m-${seq}`,
      content: blocks,
      source: { kind: "model", provider: "deepseek-official", model: "deepseek-flash" },
    },
    usage: counters,
  })
}

/** One human user message. */
function user(seq: number, turn: number, step: number, text: string, kind = "user"): unknown {
  return event(seq, "user/message", {
    turn,
    step,
    role: "user",
    id: `u-${seq}`,
    content: [{ type: "text", text }],
    source: { kind },
  })
}

/** Write a log as `frames` separately compressed Zstandard frames. */
function fixture(name: string, lines: unknown[], frames = 1): string {
  // One scratch directory per test file, one subdirectory per fixture: a test
  // that builds two logs must still be able to read both.
  scratch ??= mkdtempSync(join(tmpdir(), "dsh-fixture-"))
  const directory = join(scratch, name)
  const file = join(directory, "session.v4.jsonl.zstd")
  mkdirSync(directory, { recursive: true })
  const text = lines.map((line) => JSON.stringify(line)).join("\n") + "\n"
  const size = Math.max(1, Math.ceil(text.length / frames))
  const pieces: Buffer[] = []
  for (let index = 0; index < text.length; index += size) {
    pieces.push(zstdCompressSync(Buffer.from(text.slice(index, index + size))))
  }
  writeFileSync(file, Buffer.concat(pieces))
  return file
}

/** A projection document with a request list and the rows the adapter reads. */
function projectionDocument(requests: unknown[], maxSeq: number): unknown {
  return {
    version: 7,
    record: {
      identity: { formatVersion: 4, createdAt: 1, cwd: "/tmp/work", isSeeded: false, inheritedEventCount: 0 },
      rows: {
        contextTimeline: { ver: 28, seq: maxSeq, val: { requests } },
        contextPressure: {
          ver: 5,
          seq: maxSeq,
          val: { surfaceTokens: 0, contextWindow: 1_000_000, pressureTokens: 0 },
        },
      },
    },
  }
}

describe("multi-frame zstd", () => {
  it("decodes every frame, not just the first", () => {
    const lines = [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "hi"),
      assistant(3, 1, 1, usage(10, 20, 0, 5)),
    ]
    const file = fixture("s", lines, 3)
    const decoded = decodeSessionLog(readFileSync(file))
    expect(decoded.frames).toBeGreaterThanOrEqual(3)
    expect(decoded.badFrames).toBe(0)
    // The single-call trap returns only the first frame, i.e. a prefix.
    expect(decoded.text.trim().split("\n")).toHaveLength(lines.length)
  })

  it("concatenates frames into the same text as one frame", () => {
    const lines = [header(), event(1, "turn/start", { turn: 1 })]
    const split = fixture("split", lines, 3)
    const whole = fixture("whole", lines, 1)
    const a = decodeSessionLog(readFileSync(split)).text
    const b = decodeSessionLog(readFileSync(whole)).text
    expect(a).toBe(b)
  })
})

describe("usage semantics", () => {
  it("treats inputTokens as the uncached remainder", async () => {
    const file = fixture("usage", [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "hello"),
      assistant(3, 1, 1, {
        inputTokens: 300,
        cacheReadTokens: 5000,
        cacheWriteTokens: 40,
        outputTokens: 60,
        totalTokens: 5400,
      }),
    ])
    const { session } = await readDshSession(file)
    const turn = session.turns[0]
    expect(turn?.usage).toEqual({ input: 300, cacheRead: 5000, cacheWrite: 40, output: 60, totalContext: 5340 })
    expect(turn?.attribution.total.tokens).toBe(5340)
  })

  it("flags a recorded total that disagrees with prompt + output", async () => {
    const file = fixture("drift", [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "hi"),
      assistant(3, 1, 1, {
        inputTokens: 10,
        cacheReadTokens: 10,
        cacheWriteTokens: 0,
        outputTokens: 10,
        totalTokens: 999,
      }),
    ])
    const { session, stats } = await readDshSession(file)
    expect(stats.requests).toBe(1)
    expect(session.dataQuality).toContain("usage-total-mismatch:turn=1")
  })
})

describe("tool pairing", () => {
  it("pairs a call with a result that arrives later in the turn", async () => {
    const file = fixture("tools", [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "run it"),
      assistant(3, 1, 1, usage(1, 2, 0, 3)),
      event(4, "tool/call", { turn: 1, step: 1, callId: "c1", name: "bash", arguments: '{"command":"ls"}' }),
      event(5, "tool/result", {
        turn: 1,
        step: 1,
        message: { role: "tool", toolCallId: "c1", content: [{ type: "text", text: "a.txt" }], isError: false },
      }),
      event(6, "turn/end", { turn: 1 }),
    ])
    const { session, stats } = await readDshSession(file)
    const call = session.turns[0]?.toolCalls[0]
    expect(call?.name).toBe("bash")
    expect(call?.input).toEqual({ command: "ls" })
    expect(call?.output).toBe("a.txt")
    expect(call?.status).toBe("ok")
    expect(stats.pairedToolCalls).toBe(1)
    expect(stats.orphanToolResults).toBe(0)
  })

  it("counts a result whose call is missing instead of inventing one", async () => {
    const file = fixture("orphan", [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "x"),
      event(3, "tool/result", {
        turn: 1,
        step: 1,
        message: { role: "tool", toolCallId: "ghost", content: [], isError: true },
      }),
    ])
    const { session, stats } = await readDshSession(file)
    expect(stats.orphanToolResults).toBe(1)
    expect(session.turns[0]?.toolCalls).toHaveLength(0)
  })
})

describe("turn boundaries", () => {
  it("splits on turn/start..turn/end", async () => {
    const file = fixture("turns", [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "first"),
      assistant(3, 1, 1, usage(1, 0, 0, 1)),
      event(4, "turn/end", { turn: 1 }),
      event(5, "turn/start", { turn: 2 }),
      user(6, 2, 1, "second"),
      assistant(7, 2, 1, usage(1, 0, 0, 1)),
      event(8, "turn/end", { turn: 2 }),
    ])
    const { session, stats } = await readDshSession(file)
    expect(session.turns).toHaveLength(2)
    expect(session.turns[0]?.userInput).toEqual(["first"])
    expect(session.turns[1]?.userInput).toEqual(["second"])
    expect(stats.requests).toBe(2)
  })

  it("degrades to human user messages when the log has no turn events", async () => {
    const file = fixture("degraded", [
      header(),
      user(1, 1, 1, "first"),
      assistant(2, 1, 1, usage(1, 0, 0, 1)),
      user(3, 2, 1, "second"),
      assistant(4, 2, 1, usage(1, 0, 0, 1)),
    ])
    const { session } = await readDshSession(file)
    expect(session.turns).toHaveLength(2)
    expect(session.dataQuality).toContain("turn-events-absent")
    expect(session.turns[1]?.userInput).toEqual(["second"])
  })

  it("keeps harness-written user messages out of the human input", async () => {
    const file = fixture("injected", [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "批准", "user-approval"),
      user(3, 1, 1, "真的我打的"),
      assistant(4, 1, 1, usage(1, 0, 0, 1)),
    ])
    const { session } = await readDshSession(file)
    expect(session.turns[0]?.userInput).toEqual(["真的我打的"])
  })
})

describe("projection-first attribution", () => {
  const request = {
    seq: 3,
    time: 2,
    turn: 1,
    step: 1,
    prompt: 5_000,
    total: 3_000,
    system: 500,
    tools: 300,
    user: 100,
    inject: 50,
    skill: 0,
    assistant: 0,
    tool: 0,
    cacheRead: 4_000,
    output: 60,
    activeMs: 10,
  }

  it("uses the harness split with exact precision when the projection is fresh", async () => {
    const file = fixture("fresh", [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "q"),
      assistant(3, 1, 1, usage(1_000, 3_900, 100, 60)),
    ])
    const projection = parseProjection(projectionDocument([request], 3)).projection as DshProjection
    const { session, stats } = await readDshSession(file, { projection })
    const attribution = session.turns[0]?.attribution
    expect(attribution?.total.tokens).toBe(5_000)
    expect(attribution?.parts.every((slice) => slice.measure.basis === "harness-projection")).toBe(true)
    expect(attribution?.parts.every((slice) => slice.measure.precision === "exact")).toBe(true)
    expect(stats.projectionTurns).toBe(1)
    expect(stats.estimateTurns).toBe(0)
  })

  it("falls back to character estimates when no projection exists", async () => {
    const file = fixture("none", [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "q"),
      assistant(3, 1, 1, usage(1_000, 3_900, 100, 60)),
    ])
    const { session, stats } = await readDshSession(file, { projectionRoot: "/nonexistent" })
    const attribution = session.turns[0]?.attribution
    expect(attribution?.parts.length).toBeGreaterThan(0)
    expect(attribution?.parts.every((slice) => slice.measure.basis === "chars-per-token")).toBe(true)
    expect(attribution?.parts.every((slice) => slice.measure.precision === "estimate")).toBe(true)
    expect(stats.estimateTurns).toBe(1)
    expect(session.dataQuality.some((entry) => entry.startsWith("projection-missing"))).toBe(true)
  })

  it("rejects a stale projection and says so", async () => {
    const file = fixture("stale", [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "q"),
      assistant(3, 1, 1, usage(1_000, 3_900, 100, 60)),
    ])
    const projection = parseProjection(projectionDocument([request], 1)).projection as DshProjection
    expect(isProjectionFresh(projection, 3)).toBe(false)
    const { session, stats } = await readDshSession(file, { projection })
    expect(stats.projectionStatus).toBe("stale")
    expect(session.dataQuality).toContain("projection-stale")
    expect(stats.projectionTurns).toBe(0)
  })

  it("splits what the turn added from what it carried", async () => {
    const first = { ...request, seq: 3, prompt: 2_000, total: 1_500, user: 100, assistant: 0, tool: 0 }
    const second = { ...request, seq: 6, prompt: 5_000, total: 3_000, user: 150, assistant: 900, tool: 200 }
    const file = fixture("carried", [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "a"),
      assistant(3, 1, 1, usage(1_000, 990, 10, 60)),
      event(4, "turn/end", { turn: 1 }),
      event(5, "turn/start", { turn: 2 }),
      user(5, 2, 1, "b"),
      assistant(6, 2, 1, usage(1_000, 3_990, 10, 60)),
    ])
    const projection = parseProjection(projectionDocument([first, second], 6)).projection as DshProjection
    const { session } = await readDshSession(file, { projection })
    const turn2 = session.turns[1]?.attribution
    const part = (name: string): number => turn2?.parts.find((slice) => slice.part === name)?.measure.tokens ?? 0
    // Everything the previous request already carried: user 100 + inject 50.
    expect(part("history")).toBe(150)
    expect(part("user-input")).toBe(50)
    expect(part("assistant-output")).toBe(900)
    expect(part("tool-results")).toBe(200)
  })

  it("keeps the identity Σparts + residual = total on every basis", async () => {
    const file = fixture("identity", [
      header(),
      event(1, "turn/start", { turn: 1 }),
      user(2, 1, 1, "q"),
      assistant(3, 1, 1, usage(1_000, 3_900, 100, 60)),
    ])
    for (const projection of [
      undefined,
      parseProjection(projectionDocument([request], 3)).projection as DshProjection,
    ]) {
      const { session } = await readDshSession(
        file,
        projection === undefined ? { projectionRoot: "/nonexistent" } : { projection }
      )
      for (const turn of session.turns) {
        const summed = turn.attribution.parts.reduce((total, slice) => total + slice.measure.tokens, 0)
        const residual = turn.attribution.residual?.tokens ?? 0
        expect(summed + residual).toBe(turn.attribution.total.tokens)
      }
    }
  })
})
