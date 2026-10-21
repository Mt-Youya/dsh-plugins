import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { readClaudeSession } from "@cyrus/dsh-session-readers"

let scratch: string | undefined

afterEach(() => {
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true })
  scratch = undefined
})

interface Fixture {
  /** Lines of the parent transcript. */
  lines: unknown[]
  /** Subagent transcripts keyed by agent id. */
  subagents?: Record<string, unknown[]>
}

/** Write a transcript (and its subagent siblings) into a throwaway directory. */
function fixture(name: string, body: Fixture): string {
  // A test may build two fixtures (calibrate, then measure); drop the first.
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true })
  scratch = mkdtempSync(join(tmpdir(), "claude-fixture-"))
  const file = join(scratch, `${name}.jsonl`)
  writeFileSync(file, body.lines.map((line) => JSON.stringify(line)).join("\n") + "\n")
  if (body.subagents !== undefined) {
    const directory = join(scratch, name, "subagents")
    mkdirSync(directory, { recursive: true })
    for (const [agentId, lines] of Object.entries(body.subagents)) {
      writeFileSync(
        join(directory, `agent-${agentId}.jsonl`),
        lines.map((line) => JSON.stringify(line)).join("\n") + "\n"
      )
    }
  }
  return file
}

let clock = 0
/** Timestamp that advances one second per record. */
function at(): string {
  clock += 1
  return new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString()
}

function user(text: string, extra: Record<string, unknown> = {}): unknown {
  return {
    type: "user",
    uuid: `u-${Math.random().toString(16).slice(2)}`,
    timestamp: at(),
    sessionId: "session-1",
    cwd: "/tmp/work",
    message: { role: "user", content: text },
    ...extra,
  }
}

function assistant(
  messageId: string,
  blocks: unknown[],
  usage: Record<string, number>,
  extra: Record<string, unknown> = {}
): unknown {
  return {
    type: "assistant",
    uuid: `a-${Math.random().toString(16).slice(2)}`,
    timestamp: at(),
    sessionId: "session-1",
    cwd: "/tmp/work",
    message: {
      id: messageId,
      role: "assistant",
      model: "claude-test",
      usage: {
        input_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 0,
        ...usage,
      },
      content: blocks,
    },
    ...extra,
  }
}

function toolResult(toolUseId: string, content: unknown, extra: Record<string, unknown> = {}): unknown {
  return {
    type: "user",
    uuid: `u-${Math.random().toString(16).slice(2)}`,
    timestamp: at(),
    sessionId: "session-1",
    cwd: "/tmp/work",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: toolUseId, content }] },
    ...extra,
  }
}

describe("uuid de-duplication", () => {
  it("collapses resume copies written with the same uuid", async () => {
    const copied = user("hello")
    const file = fixture("dedupe", {
      lines: [
        copied,
        assistant("msg-1", [{ type: "text", text: "hi" }], { cache_read_input_tokens: 100 }),
        copied,
        copied,
      ],
    })
    const { stats, session } = await readClaudeSession(file)
    expect(stats.duplicates).toBe(2)
    expect(stats.deduped).toBe(stats.parsed - 2)
    expect(session.turns).toHaveLength(1)
    expect(session.dataQuality).toContain("uuid-duplicates-dropped")
  })
})

describe("usage normalization", () => {
  it("counts one response once even when every content block repeats its usage", async () => {
    const usage = { input_tokens: 1, cache_creation_input_tokens: 20, cache_read_input_tokens: 900 }
    const file = fixture("usage", {
      lines: [
        user("do it"),
        assistant("msg-1", [{ type: "thinking", thinking: "plan" }], usage),
        assistant("msg-1", [{ type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "/a" } }], usage),
        assistant("msg-1", [{ type: "text", text: "done" }], usage),
      ],
    })
    const { stats, session } = await readClaudeSession(file)
    expect(stats.naiveContextTokens).toBe(921 * 3)
    expect(stats.normalizedContextTokens).toBe(921)
    expect(stats.messageIds).toBe(1)
    expect(session.turns[0]?.usage?.totalContext).toBe(921)
  })

  it("keeps the largest reading when the repeated usage disagrees", async () => {
    const file = fixture("usage-disagree", {
      lines: [
        user("go"),
        assistant("msg-1", [{ type: "text", text: "a" }], { cache_read_input_tokens: 100 }),
        assistant("msg-1", [{ type: "text", text: "b" }], { cache_read_input_tokens: 400 }),
      ],
    })
    const { stats, session } = await readClaudeSession(file)
    expect(stats.inconsistentUsage).toBe(1)
    expect(session.turns[0]?.usage?.totalContext).toBe(400)
    expect(stats.normalizedContextTokens).toBe(400)
    expect(session.dataQuality).toContain("usage-inconsistent-across-blocks")
  })
})

describe("tool pairing", () => {
  it("pairs a call with its result and keeps the status", async () => {
    const file = fixture("tools", {
      lines: [
        user("read it"),
        assistant("msg-1", [{ type: "tool_use", id: "tool-ok", name: "Read", input: { file_path: "/a" } }], {
          cache_read_input_tokens: 10,
        }),
        toolResult("tool-ok", "file body"),
        assistant("msg-2", [{ type: "tool_use", id: "tool-bad", name: "Bash", input: { command: "x" } }], {
          cache_read_input_tokens: 20,
        }),
        toolResult("tool-bad", "boom", {
          message: {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "tool-bad", content: "boom", is_error: true }],
          },
        }),
        assistant("msg-3", [{ type: "text", text: "finished" }], { cache_read_input_tokens: 30 }),
      ],
    })
    const { session, stats } = await readClaudeSession(file)
    const calls = session.turns[0]?.toolCalls ?? []
    expect(calls.map((call) => call.name)).toEqual(["Read", "Bash"])
    expect(calls[0]?.status).toBe("ok")
    expect(calls[1]?.status).toBe("error")
    expect(calls[0]?.output).toBe("file body")
    expect(calls[0]?.endedAt).toBeGreaterThan(calls[0]?.startedAt ?? 0)
    expect(stats.orphanToolResults).toBe(0)
  })

  it("keeps an unanswered call as unknown instead of dropping it", async () => {
    const file = fixture("tools-open", {
      lines: [
        user("start"),
        assistant("msg-1", [{ type: "tool_use", id: "tool-open", name: "Bash", input: { command: "sleep" } }], {
          cache_read_input_tokens: 10,
        }),
      ],
    })
    const { session } = await readClaudeSession(file)
    expect(session.turns[0]?.toolCalls[0]?.status).toBe("unknown")
    expect(session.turns[0]?.toolCalls[0]?.output).toBeUndefined()
  })
})

describe("compaction", () => {
  it("reads preTokens/postTokens from the boundary metadata, not from usage", async () => {
    const file = fixture("compaction", {
      lines: [
        user("first"),
        assistant("msg-1", [{ type: "text", text: "one" }], { cache_read_input_tokens: 5_000 }),
        {
          type: "system",
          subtype: "compact_boundary",
          uuid: "c-1",
          timestamp: at(),
          sessionId: "session-1",
          compactMetadata: { trigger: "auto", preTokens: 424_056, postTokens: 6_610, durationMs: 12 },
        },
        {
          type: "user",
          uuid: "c-2",
          timestamp: at(),
          sessionId: "session-1",
          isCompactSummary: true,
          message: { role: "user", content: "summary of everything" },
        },
        user("second"),
        assistant("msg-2", [{ type: "text", text: "two" }], { cache_read_input_tokens: 6_000 }),
      ],
    })
    const { session, stats } = await readClaudeSession(file)
    expect(stats.compactions).toBe(1)
    const point = session.turns[0]?.compactions[0]
    expect(point?.before).toEqual({ tokens: 424_056, precision: "exact", basis: "usage" })
    expect(point?.after).toEqual({ tokens: 6_610, precision: "exact", basis: "usage" })
    expect(point?.trigger).toBe("auto")
    expect(point?.replacedHistory).toBe(false)
  })
})

describe("human input filtering", () => {
  it("drops harness wrappers and keeps the human text", async () => {
    const file = fixture("injected", {
      lines: [
        user("<local-command-caveat>the command below does things</local-command-caveat>"),
        user("<command-name>/compact</command-name>"),
        user("<local-command-stdout>Compacted</local-command-stdout>"),
        user("<task-notification>done</task-notification>"),
        user("real question<system-reminder>injected reminder</system-reminder>"),
        assistant("msg-1", [{ type: "text", text: "answer" }], { cache_read_input_tokens: 100 }),
      ],
    })
    const { session } = await readClaudeSession(file)
    expect(session.turns).toHaveLength(1)
    expect(session.turns[0]?.userInput).toEqual(["real question"])
  })

  it("starts a turn on human input only, never on a tool result", async () => {
    const file = fixture("boundaries", {
      lines: [
        user("one"),
        assistant("msg-1", [{ type: "tool_use", id: "tool-1", name: "Read", input: {} }], {
          cache_read_input_tokens: 10,
        }),
        toolResult("tool-1", "body"),
        assistant("msg-2", [{ type: "text", text: "done" }], { cache_read_input_tokens: 20 }),
        user("two"),
        assistant("msg-3", [{ type: "text", text: "ok" }], { cache_read_input_tokens: 30 }),
      ],
    })
    const { session } = await readClaudeSession(file)
    expect(session.turns.map((turn) => turn.userInput)).toEqual([["one"], ["two"]])
  })
})

describe("precision marks", () => {
  it("keeps the total exact and every slice an estimate", async () => {
    const file = fixture("precision", {
      lines: [
        user("hello"),
        assistant("msg-1", [{ type: "text", text: "hi there" }], {
          input_tokens: 3,
          cache_creation_input_tokens: 7,
          cache_read_input_tokens: 90,
        }),
      ],
    })
    const { session } = await readClaudeSession(file)
    const attribution = session.turns[0]?.attribution
    expect(attribution?.total).toEqual({ tokens: 100, precision: "exact", basis: "usage" })
    for (const slice of attribution?.parts ?? []) {
      expect(slice.measure.precision).toBe("estimate")
      expect(slice.measure.basis).toBe("chars-per-token")
    }
  })

  it("falls back to an estimated total when a turn has no usage", async () => {
    const file = fixture("no-usage", {
      lines: [user("nobody answered"), assistant("msg-1", [{ type: "text", text: "partial answer" }], {})],
    })
    const { session } = await readClaudeSession(file)
    const attribution = session.turns[0]?.attribution
    const summed = attribution?.parts.reduce((total, slice) => total + slice.measure.tokens, 0) ?? 0
    expect(session.turns[0]?.usage).toBeUndefined()
    // A 0 here would be read as "the window was empty" by every view.
    expect(attribution?.total.tokens).toBe(summed)
    expect(attribution?.total.tokens).toBeGreaterThan(0)
    expect(attribution?.total.precision).toBe("estimate")
    expect(attribution?.total.basis).toBe("chars-per-token")
    expect(attribution?.residual).toBeUndefined()
    expect(attribution?.windowSize).toBeUndefined()
    expect(session.dataQuality).toContain("turn-without-usage")
  })
})

describe("subagent linkage", () => {
  it("links Agent tool calls to their transcript instead of merging turns", async () => {
    const agentId = "abc123"
    const file = fixture("parent", {
      lines: [
        user("delegate this"),
        assistant("msg-1", [{ type: "tool_use", id: "tool-agent", name: "Agent", input: { prompt: "go" } }], {
          cache_read_input_tokens: 10,
        }),
        toolResult("tool-agent", "subagent finished", { toolUseResult: { agentId } }),
        assistant("msg-2", [{ type: "text", text: "done" }], { cache_read_input_tokens: 20 }),
      ],
      subagents: {
        [agentId]: [
          user("go"),
          assistant("msg-child", [{ type: "text", text: "child" }], { cache_read_input_tokens: 5 }),
        ],
      },
    })
    const { session } = await readClaudeSession(file)
    expect(session.turns).toHaveLength(1)
    expect(session.turns[0]?.subagents).toEqual([agentId])
    expect(session.segments).toHaveLength(2)
    expect(session.segments[1]?.endsWith(`agent-${agentId}.jsonl`)).toBe(true)
  })
})
describe("bounded reconciliation", () => {
  /** A prefix snapshot small enough that it never looks stale. */
  function snapshotAttachment(): unknown {
    return {
      type: "attachment",
      uuid: `snap-${Math.random().toString(16).slice(2)}`,
      timestamp: at(),
      sessionId: "session-1",
      cwd: "/tmp/work",
      attachment: {
        type: "prompt_snapshot",
        systemPrompt: ["system text"],
        tools: [{ name: "Read", schema: { type: "object", properties: { path: { type: "string" } } } }],
      },
    }
  }

  /** A snapshot whose tool schema alone dwarfs any window it claims to describe. */
  function hugeSnapshotAttachment(): unknown {
    return {
      type: "attachment",
      uuid: `snap-${Math.random().toString(16).slice(2)}`,
      timestamp: at(),
      sessionId: "session-1",
      cwd: "/tmp/work",
      attachment: {
        type: "prompt_snapshot",
        systemPrompt: ["system text"],
        tools: [{ name: "Big", schema: { payload: "x".repeat(22_600) } }],
      },
    }
  }

  function sessionWithSnapshot(cacheRead: number): unknown[] {
    return [
      snapshotAttachment(),
      // Long enough that the fixed prefix never dominates the window: a prefix
      // larger than the request would (rightly) mark the snapshot as stale.
      user("x".repeat(2_000)),
      assistant("msg-1", [{ type: "text", text: "hi" }], { cache_read_input_tokens: cacheRead }),
    ]
  }

  /** Raw slice total for a body, measured with a window nothing can look stale in. */
  async function rawOf(lines: unknown[]): Promise<number> {
    const file = fixture("calibrate", { lines })
    const { stats } = await readClaudeSession(file)
    return stats.rawByTurn[0] ?? 0
  }

  it("keeps the gap visible instead of scaling when no prompt snapshot exists", async () => {
    const file = fixture("no-snapshot", {
      lines: [user("hello"), assistant("msg-1", [{ type: "text", text: "hi" }], { cache_read_input_tokens: 5_000 })],
    })
    const { session } = await readClaudeSession(file)
    const attribution = session.turns[0]?.attribution
    const summed = attribution?.parts.reduce((total, slice) => total + slice.measure.tokens, 0) ?? 0
    expect(attribution?.reconciled).toBeUndefined()
    expect(attribution?.residual?.basis).toBe("unattributed")
    expect(attribution?.residual?.precision).toBe("estimate")
    expect(attribution?.residual?.tokens).toBe(5_000 - summed)
    expect(summed).toBeLessThan(1_000)
    expect(session.dataQuality).toContain("prompt-snapshot-missing")
    expect(session.dataQuality.some((entry) => entry.startsWith("attribution-residual:share="))).toBe(true)
  })

  it("keeps the gap visible when the only snapshot is stale", async () => {
    const file = fixture("stale-snapshot", {
      lines: [
        hugeSnapshotAttachment(),
        user("hello"),
        assistant("msg-1", [{ type: "text", text: "hi" }], { cache_read_input_tokens: 1_000 }),
      ],
    })
    const { session } = await readClaudeSession(file)
    const attribution = session.turns[0]?.attribution
    expect(attribution?.parts.some((slice) => slice.part === "tool-definitions")).toBe(false)
    expect(attribution?.reconciled).toBeUndefined()
    expect(attribution?.residual).toBeDefined()
    expect(session.dataQuality.some((entry) => entry.startsWith("prompt-snapshot-stale-tools"))).toBe(true)
  })

  it("scales a 10% gap and records the factor without a residual", async () => {
    const raw = await rawOf(sessionWithSnapshot(10_000_000))
    const file = fixture("scale-up", { lines: sessionWithSnapshot(Math.round(raw * 1.1)) })
    const { session } = await readClaudeSession(file)
    const attribution = session.turns[0]?.attribution
    const summed = attribution?.parts.reduce((total, slice) => total + slice.measure.tokens, 0) ?? 0
    expect(attribution?.residual).toBeUndefined()
    expect(attribution?.reconciled?.factor).toBeCloseTo(1.1, 1)
    expect(attribution?.reconciled?.factor).toBeLessThanOrEqual(1.25)
    expect(summed).toBe(attribution?.total.tokens)
  })

  it("scales a shrink and records the factor without a residual", async () => {
    const raw = await rawOf(sessionWithSnapshot(10_000_000))
    const file = fixture("scale-down", { lines: sessionWithSnapshot(Math.round(raw * 0.85)) })
    const { session } = await readClaudeSession(file)
    const attribution = session.turns[0]?.attribution
    const summed = attribution?.parts.reduce((total, slice) => total + slice.measure.tokens, 0) ?? 0
    expect(attribution?.residual).toBeUndefined()
    expect(attribution?.reconciled?.factor).toBeCloseTo(0.85, 1)
    expect(attribution?.reconciled?.factor).toBeGreaterThanOrEqual(0.8)
    expect(summed).toBe(attribution?.total.tokens)
  })

  it("holds Σparts + residual === total on every turn, scaled or not", async () => {
    const body = (cacheRead: number): unknown[] => [
      snapshotAttachment(),
      user("one"),
      assistant("msg-1", [{ type: "text", text: "first" }], { cache_read_input_tokens: cacheRead }),
      user("two"),
      // A turn whose request was interrupted: no usage, so a structural gap.
      assistant("msg-2", [{ type: "text", text: "second" }], {}),
    ]
    const raw = await rawOf(body(10_000_000))
    const file = fixture("identity", { lines: body(Math.round(raw * 1.05)) })
    const { session } = await readClaudeSession(file)
    expect(session.turns).toHaveLength(2)
    for (const turn of session.turns) {
      const summed = turn.attribution.parts.reduce((total, slice) => total + slice.measure.tokens, 0)
      expect(summed + (turn.attribution.residual?.tokens ?? 0)).toBe(turn.attribution.total.tokens)
    }
    expect(session.turns[0]?.attribution.reconciled).toBeDefined()
    expect(session.turns[0]?.attribution.residual).toBeUndefined()
    // No usage: the total falls back to the estimate, so there is no gap to keep.
    expect(session.turns[1]?.attribution.reconciled).toBeUndefined()
    expect(session.turns[1]?.attribution.residual).toBeUndefined()
    expect(session.turns[1]?.attribution.total.precision).toBe("estimate")
  })
})
describe("asymmetric reconciliation bounds", () => {
  function snapshotAttachment(): unknown {
    return {
      type: "attachment",
      uuid: `snap-${Math.random().toString(16).slice(2)}`,
      timestamp: at(),
      sessionId: "session-1",
      cwd: "/tmp/work",
      attachment: {
        type: "prompt_snapshot",
        systemPrompt: ["system text"],
        tools: [{ name: "Read", schema: { type: "object", properties: { path: { type: "string" } } } }],
      },
    }
  }

  function body(cacheRead: number): unknown[] {
    return [
      snapshotAttachment(),
      // Same reason as above: keep the window content-dominated.
      user("x".repeat(2_000)),
      assistant("msg-1", [{ type: "text", text: "hi" }], { cache_read_input_tokens: cacheRead }),
    ]
  }

  async function rawOf(lines: unknown[]): Promise<number> {
    const file = fixture("calibrate-asymmetric", { lines })
    const { stats } = await readClaudeSession(file)
    return stats.rawByTurn[0] ?? 0
  }

  it("scales a factor of 0.5 with no residual: over-counting is never a missing category", async () => {
    const raw = await rawOf(body(10_000_000))
    const file = fixture("scale-half", { lines: body(Math.round(raw * 0.5)) })
    const { session } = await readClaudeSession(file)
    const attribution = session.turns[0]?.attribution
    const summed = attribution?.parts.reduce((total, slice) => total + slice.measure.tokens, 0) ?? 0
    expect(attribution?.residual).toBeUndefined()
    expect(attribution?.reconciled?.factor).toBeCloseTo(0.5, 1)
    expect(summed).toBe(attribution?.total.tokens)
  })

  it("keeps a positive residual at factor 1.4 instead of scaling the gap away", async () => {
    const raw = await rawOf(body(10_000_000))
    const file = fixture("scale-over", { lines: body(Math.round(raw * 1.4)) })
    const { session } = await readClaudeSession(file)
    const attribution = session.turns[0]?.attribution
    const summed = attribution?.parts.reduce((total, slice) => total + slice.measure.tokens, 0) ?? 0
    expect(attribution?.reconciled).toBeUndefined()
    expect(attribution?.residual?.tokens).toBeGreaterThan(0)
    expect(summed + (attribution?.residual?.tokens ?? 0)).toBe(attribution?.total.tokens)
    expect(session.dataQuality.some((entry) => entry.startsWith("attribution-residual:share="))).toBe(true)
  })
})
