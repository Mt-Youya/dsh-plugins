import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { HandoffRunner } from "../src/host/handoff/handoff.ts"
import type { HandoffDeps, SessionCommandsFace } from "../src/host/handoff/handoff.ts"
import type { ObservedEvent } from "../src/host/sources/dsh-events.ts"

interface Recorded {
  call: "create" | "prompt"
  payload: unknown
}

/** In-process controller stub: records calls and replays scripted failures. */
class FakeCommands implements SessionCommandsFace {
  readonly calls: Recorded[] = []
  readonly #createError?: string
  readonly #promptError?: string

  constructor(options: { createError?: string; promptError?: string } = {}) {
    this.#createError = options.createError
    this.#promptError = options.promptError
  }

  async create(request: { cwd: string; sessionId?: string; agentPreset?: string }): Promise<unknown> {
    this.calls.push({ call: "create", payload: request })
    if (this.#createError !== undefined) throw new Error(this.#createError)
    return { sessionId: "new-session-1", agentPreset: "standard" }
  }

  async prompt(
    request: { requestId: string; sessionId: string; mode: "queue"; content: { type: "text"; text: string }[] },
    source: { kind: "user"; rpcId: string }
  ): Promise<unknown> {
    this.calls.push({ call: "prompt", payload: { request, source } })
    if (this.#promptError !== undefined) throw new Error(this.#promptError)
    return { accepted: true }
  }
}

/**
 * Observer stub.
 *
 * The first call happens during `apply` (the baseline), the rest during
 * `status`. `first` defaults to the same list, i.e. "this session already had
 * these events before the prompt".
 */
function observerOf(list: ObservedEvent[] | undefined, first?: ObservedEvent[] | undefined): HandoffDeps["observe"] {
  let calls = 0
  return async () => {
    calls += 1
    return calls === 1 ? (first ?? list) : list
  }
}

/** A session that was empty when the prompt was sent. */
function freshObserver(list: ObservedEvent[] | undefined): HandoffDeps["observe"] {
  return observerOf(list, [])
}

function events(entries: { type: string; seq: number; time?: number; data?: unknown }[]): ObservedEvent[] {
  return entries.map((entry) => ({
    type: entry.type,
    seq: entry.seq,
    time: entry.time ?? Date.now(),
    data: entry.data ?? {},
  }))
}

describe("handoff apply", () => {
  it("requires an explicit, absolute, existing cwd", async () => {
    const commands = new FakeCommands()
    const runner = new HandoffRunner({ commands, observe: observerOf([]) })
    expect(await runner.apply({ source: "claude", id: "s1", cwd: "   ", brief: "x" })).toMatchObject({
      ok: false,
      error: "bad-request",
      detail: "cwd-required",
    })
    expect(await runner.apply({ source: "claude", id: "s1", cwd: "relative/dir", brief: "x" })).toMatchObject({
      ok: false,
      error: "bad-request",
      detail: "cwd-not-absolute",
    })
    expect(await runner.apply({ source: "claude", id: "s1", cwd: "/definitely/not/here", brief: "x" })).toMatchObject({
      ok: false,
      error: "bad-request",
      detail: "cwd-missing",
    })
    expect(commands.calls).toHaveLength(0)
  })

  it("creates with cwd in-process and then queues the brief", async () => {
    const commands = new FakeCommands()
    const runner = new HandoffRunner({ commands, observe: observerOf([]) })
    const dir = await mkdtemp(join(tmpdir(), "m7-handoff-"))
    const result = await runner.apply({ source: "claude", id: "s1", cwd: dir, brief: "THE BRIEF" })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ sessionId: "new-session-1", state: "delivered" })
    expect(result.value.pollAfterMs).toBeGreaterThan(0)
    // In-process controller: no args.request wrapper, plain parameter names.
    expect(commands.calls[0]).toEqual({ call: "create", payload: { cwd: dir } })
    const prompt = commands.calls[1]?.payload as {
      request: { sessionId: string; mode: string; content: { type: string; text: string }[] }
      source: { kind: string }
    }
    expect(prompt.request.sessionId).toBe("new-session-1")
    expect(prompt.request.mode).toBe("queue")
    expect(prompt.request.content).toEqual([{ type: "text", text: "THE BRIEF" }])
    expect(prompt.source.kind).toBe("user")
  })

  it("maps controller rejections onto the documented failure codes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "m7-handoff-"))
    const notFound = new HandoffRunner({
      commands: new FakeCommands({ promptError: "session/not-found" }),
      observe: observerOf([]),
    })
    expect(await notFound.apply({ source: "claude", id: "s1", cwd: dir, brief: "x" })).toMatchObject({
      ok: false,
      error: "not-found",
    })
    const preset = new HandoffRunner({
      commands: new FakeCommands({ createError: "agent-preset/not-found presets" }),
      observe: observerOf([]),
    })
    expect(await preset.apply({ source: "claude", id: "s1", cwd: dir, brief: "x" })).toMatchObject({
      ok: false,
      error: "bad-request",
      detail: "agent-preset-not-found",
    })
    const unavailable = new HandoffRunner({
      commands: new FakeCommands({ createError: "gateway/internal" }),
      observe: observerOf([]),
    })
    expect(await unavailable.apply({ source: "claude", id: "s1", cwd: dir, brief: "x" })).toMatchObject({
      ok: false,
      error: "handoff-unavailable",
    })
  })

  it("refuses when the session controller or the observer is missing", async () => {
    const noCommands = new HandoffRunner({ observe: observerOf([]) })
    expect(await noCommands.apply({ source: "claude", id: "s1", cwd: tmpdir(), brief: "x" })).toMatchObject({
      ok: false,
      error: "handoff-unavailable",
      detail: "session-controller-missing",
    })
    const noObserver = new HandoffRunner({ commands: new FakeCommands() })
    expect(await noObserver.status("s1")).toMatchObject({
      ok: false,
      error: "handoff-unavailable",
      detail: "observer-missing",
    })
  })
})

describe("handoff status machine (accepted is not success)", () => {
  it("stays delivered while the log has no turn at all", async () => {
    const runner = new HandoffRunner({ commands: new FakeCommands(), observe: observerOf([]) })
    expect(await runner.status("s1")).toMatchObject({ ok: true, value: { state: "delivered" } })
  })

  it("stays delivered when the log is not on disk yet", async () => {
    const runner = new HandoffRunner({ commands: new FakeCommands(), observe: observerOf(undefined) })
    expect(await runner.status("s1")).toMatchObject({ ok: true, value: { state: "delivered" } })
  })

  it("reports running once turn/start is observed", async () => {
    const runner = new HandoffRunner({
      commands: new FakeCommands(),
      observe: observerOf(events([{ type: "turn/start", seq: 3 }])),
    })
    expect(await runner.status("s1")).toMatchObject({ ok: true, value: { state: "running" } })
  })

  it("reports succeeded only on a completed turn/end, with its seq", async () => {
    const runner = new HandoffRunner({
      commands: new FakeCommands(),
      observe: observerOf(
        events([
          { type: "turn/start", seq: 3, time: 0 },
          { type: "turn/end", seq: 9, time: 0, data: { reason: { kind: "completed" } } },
        ])
      ),
    })
    expect(await runner.status("s1")).toMatchObject({ ok: true, value: { state: "succeeded", seq: 9 } })
  })

  it("reports failed with MISSING_CREDENTIAL and the fix hint", async () => {
    const runner = new HandoffRunner({
      commands: new FakeCommands(),
      observe: observerOf(
        events([
          { type: "turn/start", seq: 3, time: 0 },
          { type: "assistant/attempt", seq: 5, time: 0, data: { error: { code: "MISSING_CREDENTIAL" } } },
          { type: "turn/end", seq: 6, time: 0, data: { reason: { kind: "error" } } },
        ])
      ),
    })
    const status = await runner.status("s1")
    expect(status).toMatchObject({ ok: true, value: { state: "failed", reason: "MISSING_CREDENTIAL", seq: 6 } })
    if (status.ok) expect(status.value.detail).toContain("API Key")
  })

  it("ignores a turn/end that predates the delivery", async () => {
    let now = 1_000
    // The event already existed at prompt time, so the baseline equals its seq.
    const runner = new HandoffRunner({
      commands: new FakeCommands(),
      observe: observerOf(events([{ type: "turn/end", seq: 2, time: 10, data: { reason: { kind: "completed" } } }])),
      now: () => now,
    })
    const dir = await mkdtemp(join(tmpdir(), "m7-handoff-"))
    await runner.apply({ source: "claude", id: "s1", cwd: dir, brief: "x" })
    now = 2_000
    expect(await runner.status("new-session-1")).toMatchObject({ ok: true, value: { state: "delivered" } })
  })
})

describe("observation window is log order, not wall clock", () => {
  it("reports running when turn/start predates the delivery timestamp but follows the baseline", async () => {
    let now = 5_000
    const dir = await mkdtemp(join(tmpdir(), "m7-handoff-"))
    const runner = new HandoffRunner({
      commands: new FakeCommands(),
      // The Host emitted turn/start at time 10, long before apply() returned at 5000.
      observe: freshObserver(events([{ type: "turn/start", seq: 3, time: 10 }])),
      now: () => now,
    })
    const applied = await runner.apply({ source: "claude", id: "s1", cwd: dir, brief: "x" })
    expect(applied.ok).toBe(true)
    now = 6_000
    // seq 3 > baseline -1, so the turn is inside the window even though its
    // timestamp is 4,990 ms older than deliveredAt.
    expect(await runner.status("new-session-1")).toMatchObject({ ok: true, value: { state: "running" } })
  })

  it("reports the terminal state when turn/end also predates the delivery timestamp", async () => {
    const dir = await mkdtemp(join(tmpdir(), "m7-handoff-"))
    const runner = new HandoffRunner({
      commands: new FakeCommands(),
      observe: freshObserver(
        events([
          { type: "turn/start", seq: 18, time: 10 },
          { type: "turn/end", seq: 20, time: 11, data: { reason: { kind: "completed" } } },
        ])
      ),
    })
    await runner.apply({ source: "claude", id: "s1", cwd: dir, brief: "x" })
    expect(await runner.status("new-session-1")).toMatchObject({ ok: true, value: { state: "succeeded", seq: 20 } })
  })

  it("never reports delivered once a turn has started", async () => {
    const dir = await mkdtemp(join(tmpdir(), "m7-handoff-"))
    // A long turn: many steps, no turn/end yet.
    const longTurn: ObservedEvent[] = [
      { type: "turn/start", seq: 5, time: 1, data: {} },
      ...Array.from({ length: 28 }, (_, index) => ({ type: "step/start", seq: 6 + index * 2, time: 1, data: {} })),
      ...Array.from({ length: 28 }, (_, index) => ({
        type: "assistant/message",
        seq: 7 + index * 2,
        time: 1,
        data: {},
      })),
    ]
    const runner = new HandoffRunner({ commands: new FakeCommands(), observe: freshObserver(longTurn) })
    await runner.apply({ source: "claude", id: "s1", cwd: dir, brief: "x" })
    expect(await runner.status("new-session-1")).toMatchObject({ ok: true, value: { state: "running" } })
  })

  it("excludes events that already existed when the prompt was sent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "m7-handoff-"))
    const before = events([
      { type: "user/message", seq: 4, time: 1 },
      { type: "turn/start", seq: 5, time: 1 },
      { type: "turn/end", seq: 9, time: 2, data: { reason: { kind: "completed" } } },
    ])
    const runner = new HandoffRunner({
      commands: new FakeCommands(),
      observe: observerOf(before, before),
    })
    await runner.apply({ source: "claude", id: "s1", cwd: dir, brief: "x" })
    // Baseline is 9, so nothing is in the window and no new turn has started.
    expect(await runner.status("new-session-1")).toMatchObject({ ok: true, value: { state: "delivered" } })
  })

  it("falls back to the turn/end that follows the prompt when the window has none", async () => {
    const dir = await mkdtemp(join(tmpdir(), "m7-handoff-"))
    const before = events([{ type: "user/message", seq: 2, time: 1 }])
    const after = events([
      { type: "user/message", seq: 12, time: 5 },
      { type: "assistant/message", seq: 13, time: 5 },
      // Same seq as the baseline: outside the seq window, but after the prompt's
      // user/message, which is exactly the folded-record case.
      { type: "turn/end", seq: 2, time: 6, data: { reason: { kind: "completed" } } },
    ])
    const runner = new HandoffRunner({ commands: new FakeCommands(), observe: observerOf(after, before) })
    await runner.apply({ source: "claude", id: "s1", cwd: dir, brief: "x" })
    const status = await runner.status("new-session-1")
    expect(status).toMatchObject({ ok: true, value: { state: "succeeded" } })
  })
})
