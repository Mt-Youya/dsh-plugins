import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { zstdCompressSync } from "node:zlib"
import { afterEach, describe, expect, it } from "vitest"
import { CodexWindow, reconcile, sumSlices } from "@cyrus/dsh-session-readers"
import { CODEX_CHARS_PER_TOKEN_TEXT, codexMeasureOf } from "@cyrus/dsh-session-readers"
import { readCodexSession } from "@cyrus/dsh-session-readers"
import { indexCodexCorpus } from "@cyrus/dsh-session-readers"
import { classifyUserMessage } from "@cyrus/dsh-session-readers"
import { decompressFrames, frameOffsets } from "@cyrus/dsh-session-readers"
import type { Attribution, ContextSlice, Turn } from "@cyrus/dsh-session-contract"

let scratch: string | undefined

afterEach(() => {
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true })
  scratch = undefined
})

let clock = 0
/** Timestamp that advances one second per record. */
function at(): string {
  clock += 1
  return new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString()
}

/** The session id and thread id a fixture uses. */
const SESSION = "01a00000-0000-7000-8000-000000000001"

interface Envelope {
  timestamp: string
  ordinal: number
  type: string
  payload: unknown
  metadata?: unknown
}

function envelope(ordinal: number, type: string, payload: unknown, metadata?: unknown): Envelope {
  const record: Envelope = { timestamp: at(), ordinal, type, payload }
  if (metadata !== undefined) record.metadata = metadata
  return record
}

function sessionMeta(overrides: Record<string, unknown> = {}, ordinal = 0): Envelope {
  return envelope(ordinal, "session_meta", {
    session_id: SESSION,
    id: SESSION,
    timestamp: at(),
    cwd: "/tmp/work",
    model_provider: "openai",
    base_instructions: { text: "SYSTEM PROMPT TEXT" },
    ...overrides,
  })
}

function turnContext(ordinal: number, turnId: string, model = "gpt-test"): Envelope {
  return envelope(ordinal, "turn_context", { turn_id: turnId, model, cwd: "/tmp/work" })
}

function userMessage(ordinal: number, turnId: string, text: string): Envelope {
  return envelope(ordinal, "response_item", {
    type: "message",
    role: "user",
    id: "msg-" + ordinal,
    content: [{ type: "input_text", text }],
    internal_chat_message_metadata_passthrough: { turn_id: turnId },
  })
}

function assistantMessage(ordinal: number, turnId: string, text: string): Envelope {
  return envelope(ordinal, "response_item", {
    type: "message",
    role: "assistant",
    id: "msg-" + ordinal,
    content: [{ type: "output_text", text }],
    internal_chat_message_metadata_passthrough: { turn_id: turnId },
  })
}

function usage(
  ordinal: number,
  turnId: string,
  counters: { input: number; cached?: number; output?: number },
  responseId = "resp-" + ordinal
): Envelope {
  const cached = counters.cached ?? 0
  const output = counters.output ?? 0
  return envelope(ordinal, "token_usage_record", {
    response_id: responseId,
    turn_id: turnId,
    session_id: SESSION,
    thread_id: SESSION,
    usage: {
      input_tokens: counters.input,
      cached_input_tokens: cached,
      cache_write_input_tokens: 0,
      output_tokens: output,
      reasoning_output_tokens: 0,
      total_tokens: counters.input + output,
    },
    turn_token_usage: {
      input_tokens: counters.input,
      cached_input_tokens: cached,
      cache_write_input_tokens: 0,
      output_tokens: output,
      reasoning_output_tokens: 0,
      total_tokens: counters.input + output,
    },
    thread_token_usage: {
      input_tokens: counters.input * 10,
      cached_input_tokens: cached,
      cache_write_input_tokens: 0,
      output_tokens: output,
      reasoning_output_tokens: 0,
      total_tokens: counters.input * 10,
    },
  })
}

function tokenCount(
  ordinal: number,
  last: { input: number; cached?: number; output?: number },
  contextWindow = 258400
): Envelope {
  const cached = last.cached ?? 0
  const output = last.output ?? 0
  return envelope(ordinal, "event_msg", {
    type: "token_count",
    info: {
      total_token_usage: {
        input_tokens: last.input * 100,
        cached_input_tokens: cached,
        cache_write_input_tokens: 0,
        output_tokens: output,
        reasoning_output_tokens: 0,
        total_tokens: last.input * 100,
      },
      last_token_usage: {
        input_tokens: last.input,
        cached_input_tokens: cached,
        cache_write_input_tokens: 0,
        output_tokens: output,
        reasoning_output_tokens: 0,
        total_tokens: last.input + output,
      },
      model_context_window: contextWindow,
    },
  })
}

function customCall(
  ordinal: number,
  turnId: string,
  callId: string,
  name = "exec",
  input = "await tools.shell()"
): Envelope {
  return envelope(ordinal, "response_item", {
    type: "custom_tool_call",
    call_id: callId,
    name,
    input,
    status: "completed",
    internal_chat_message_metadata_passthrough: { turn_id: turnId },
  })
}

function customOutput(ordinal: number, turnId: string, callId: string, output = "stdout: ok"): Envelope {
  return envelope(ordinal, "response_item", {
    type: "custom_tool_call_output",
    call_id: callId,
    output,
    internal_chat_message_metadata_passthrough: { turn_id: turnId },
  })
}

function additionalTools(ordinal: number, schema: unknown): Envelope {
  return envelope(ordinal, "response_item", { type: "additional_tools", tools: [schema] })
}

interface Fixture {
  /** File uuid suffix after the timestamp, e.g. the session uuid. */
  name: string
  lines: Envelope[]
}

/** Write rollout files into a throwaway corpus root and return that root. */
function fixture(name: string, files: Fixture[]): { root: string; path: string } {
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true })
  scratch = mkdtempSync(join(tmpdir(), "codex-fixture-" + name + "-"))
  let first = ""
  for (const file of files) {
    const path = join(scratch, "rollout-2026-01-01T00-00-0" + (first === "" ? "0" : "1") + "-" + file.name + ".jsonl")
    writeFileSync(path, file.lines.map((line) => JSON.stringify(line)).join("\n") + "\n")
    if (first === "") first = path
  }
  return { root: scratch, path: first }
}

describe("zstd frames", () => {
  it("splits and decodes concatenated frames instead of stopping at the first", () => {
    const first = zstdCompressSync(Buffer.from('{"a":1}\n'))
    const second = zstdCompressSync(Buffer.from('{"b":2}\n'))
    const combined = Buffer.concat([first, second])
    expect(frameOffsets(combined)).toHaveLength(2)
    const { data, frames } = decompressFrames(combined)
    expect(frames).toBe(2)
    expect(data.toString("utf8")).toBe('{"a":1}\n{"b":2}\n')
  })
})

describe("user message blocks", () => {
  it("keeps the human remainder and strips the environment block", () => {
    const blocks = classifyUserMessage("<environment_context>cwd=/tmp</environment_context>\n\n  fix the bug  ")
    expect(blocks.human).toBe("fix the bug")
    expect(blocks.injected).toHaveLength(1)
    expect(blocks.injected[0]?.kind).toBe("environment")
  })

  it("treats an AGENTS.md block as instructions, not as a human turn", () => {
    const blocks = classifyUserMessage("# AGENTS.md instructions for /tmp\n\nuse tabs")
    expect(blocks.human).toBeUndefined()
    expect(blocks.injected[0]?.kind).toBe("instructions")
  })
})

describe("usage normalization", () => {
  it("keeps cached_input_tokens a subset of input instead of adding it", async () => {
    const { root, path } = fixture("cached", [
      {
        name: SESSION,
        lines: [
          sessionMeta(),
          turnContext(1, "turn-1"),
          userMessage(2, "turn-1", "do it"),
          usage(3, "turn-1", { input: 1000, cached: 900, output: 20 }),
        ],
      },
    ])
    const { session, stats } = await readCodexSession(path, { root })
    const turn = session.turns[0]
    expect(turn?.usage).toEqual({ input: 100, cacheRead: 900, cacheWrite: 0, output: 20, totalContext: 1000 })
    expect(turn?.attribution.total.tokens).toBe(1000)
    expect(stats.exactInputTokens).toBe(1000)
    // The naive sum is the 1.9x trap the panel must never show.
    expect(stats.naiveCachedAddedTokens).toBe(1900)
  })

  it("reads usage only from token_usage_record, never from token_count echoes", async () => {
    const { root, path } = fixture("three-calibers", [
      {
        name: SESSION,
        lines: [
          sessionMeta(),
          turnContext(1, "turn-1"),
          userMessage(2, "turn-1", "do it"),
          usage(3, "turn-1", { input: 700, cached: 500, output: 10 }),
          tokenCount(4, { input: 700, cached: 500, output: 10 }),
          tokenCount(5, { input: 700, cached: 500, output: 10 }),
          usage(6, "turn-1", { input: 800, cached: 600, output: 12 }),
          tokenCount(7, { input: 800, cached: 600, output: 12 }),
        ],
      },
    ])
    const { stats, session } = await readCodexSession(path, { root })
    // Only the two usage records count.
    expect(stats.requests).toBe(2)
    expect(stats.exactInputTokens).toBe(1500)
    expect(stats.naiveCachedAddedTokens).toBe(2600)
    // The echo is recognised, and its sum is never used as a total.
    expect(stats.lastTokenUsageEchoes).toBe(3)
    expect(stats.lastTokenUsageInputMatches).toBe(3)
    expect(stats.lastTokenUsageTokens).toBe(2200)
    // Cumulative counters stay in the report, out of the IR.
    expect(stats.threadCumulativeTokens).toBe(15000)
    expect(session.turns[0]?.usage?.totalContext).toBe(800)
  })
})

describe("tool pairing", () => {
  it("pairs by call_id and counts results that have no call", async () => {
    const { root, path } = fixture("tools", [
      {
        name: SESSION,
        lines: [
          sessionMeta(),
          turnContext(1, "turn-1"),
          userMessage(2, "turn-1", "run it"),
          customCall(3, "turn-1", "call-1"),
          customOutput(4, "turn-1", "call-1", "exit 0"),
          customOutput(5, "turn-1", "call-orphan", "stray"),
          usage(6, "turn-1", { input: 500, cached: 100 }),
        ],
      },
    ])
    const { session, stats } = await readCodexSession(path, { root })
    const calls = session.turns[0]?.toolCalls ?? []
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ id: "call-1", name: "exec", status: "ok", output: "exit 0" })
    expect(calls[0]?.input).toBe("await tools.shell()")
    expect(stats.orphanToolResults).toBe(1)
    expect(stats.pairedToolCalls).toBe(1)
  })
})

describe("compaction", () => {
  it("reports the exact drop and marks the history as replaced", async () => {
    const { root, path } = fixture("compaction", [
      {
        name: SESSION,
        lines: [
          sessionMeta(),
          turnContext(1, "turn-1"),
          userMessage(2, "turn-1", "long task"),
          usage(3, "turn-1", { input: 200000, cached: 190000, output: 50 }),
          envelope(4, "compacted", {
            message: "",
            window_number: 1,
            replacement_history: [
              { type: "message", role: "assistant", content: [{ type: "output_text", text: "earlier work" }] },
            ],
            latest_token_usage_record: {
              response_id: "resp-compaction",
              turn_id: "turn-1",
              usage: {
                input_tokens: 200000,
                cached_input_tokens: 190000,
                cache_write_input_tokens: 0,
                output_tokens: 50,
                reasoning_output_tokens: 0,
                total_tokens: 200050,
              },
            },
          }),
          usage(5, "turn-1", { input: 50000, cached: 40000, output: 30 }),
        ],
      },
    ])
    const { session, stats } = await readCodexSession(path, { root })
    const point = session.turns[0]?.compactions[0]
    expect(point?.before.tokens).toBe(200000)
    expect(point?.after.tokens).toBe(50000)
    expect(point?.replacedHistory).toBe(true)
    expect(stats.compactions).toBe(1)
    expect(stats.compactionDrops).toBe(1)
  })
})

describe("turn boundaries", () => {
  it("splits on turn_id and gives records without one to the open turn", async () => {
    const { root, path } = fixture("turns", [
      {
        name: SESSION,
        lines: [
          sessionMeta(),
          turnContext(1, "turn-1"),
          userMessage(2, "turn-1", "first"),
          assistantMessage(3, "turn-1", "answer one"),
          envelope(4, "response_item", { type: "reasoning", encrypted_content: "cipher", summary: [] }),
          turnContext(5, "turn-2"),
          userMessage(6, "turn-2", "second"),
          usage(7, "turn-2", { input: 900, cached: 100 }),
        ],
      },
    ])
    const { session } = await readCodexSession(path, { root })
    expect(session.turns).toHaveLength(2)
    expect(session.turns[0]?.userInput).toEqual(["first"])
    expect(session.turns[0]?.assistantText).toEqual(["answer one"])
    expect(session.turns[1]?.userInput).toEqual(["second"])
    expect(session.turns[0]?.usage).toBeUndefined()
    expect(session.dataQuality.some((entry) => entry.startsWith("turn-without-usage"))).toBe(true)
  })
})

describe("turns without usage", () => {
  it("falls back to an estimated total instead of claiming a zero window", async () => {
    const { root, path } = fixture("no-usage", [
      {
        name: SESSION,
        lines: [
          sessionMeta(),
          turnContext(1, "turn-1"),
          userMessage(2, "turn-1", "no usage record for this one"),
          // token_count states the model window, but it is not a usage record.
          tokenCount(3, { input: 1000 }),
        ],
      },
    ])
    const { session } = await readCodexSession(path, { root })
    const attribution = (session.turns[0] as Turn).attribution
    // docs/IR.md rule 6: total falls back to sum(parts), not zero.
    expect(attribution.total.precision).toBe("estimate")
    expect(attribution.total.basis).toBe("chars-per-token")
    expect(attribution.total.tokens).toBe(sumSlices(attribution.parts))
    expect(attribution.total.tokens).toBeGreaterThan(0)
    expect(attribution.residual).toBeUndefined()
    expect(attribution.windowSize).toBeUndefined()
    expect(session.dataQuality.some((entry) => entry.startsWith("turn-without-usage"))).toBe(true)
  })
})

describe("codex calibration", () => {
  it("uses the fitted Codex text caliper rather than the shared Claude one", () => {
    expect(CODEX_CHARS_PER_TOKEN_TEXT).toBeGreaterThan(2.6)
    const counts = { text: 327, cjk: 0, schema: 0, projected: 0 }
    expect(codexMeasureOf(counts).tokens).toBe(100)
    expect(codexMeasureOf(counts).basis).toBe("chars-per-token")
  })
})

describe("reasoning", () => {
  it("leaves thinking undefined and records the encryption", async () => {
    const { root, path } = fixture("reasoning", [
      {
        name: SESSION,
        lines: [
          sessionMeta(),
          turnContext(1, "turn-1"),
          userMessage(2, "turn-1", "think"),
          envelope(3, "response_item", {
            type: "reasoning",
            encrypted_content: "gAAAA",
            summary: [],
            internal_chat_message_metadata_passthrough: { turn_id: "turn-1" },
          }),
          usage(4, "turn-1", { input: 600 }),
        ],
      },
    ])
    const { session } = await readCodexSession(path, { root })
    expect(session.turns[0]?.thinking).toBeUndefined()
    expect(session.dataQuality).toContain("reasoning-encrypted:count=1")
  })
})

describe("segment chains", () => {
  it("stitches a history_base continuation into one session, counting the prompt once", async () => {
    const continuation = "01a00000-0000-7000-8000-000000000002"
    const { root, path } = fixture("chain", [
      {
        name: SESSION,
        lines: [
          sessionMeta(),
          turnContext(1, "turn-1"),
          userMessage(2, "turn-1", "one"),
          usage(3, "turn-1", { input: 1000 }),
        ],
      },
      {
        name: SESSION + "_" + continuation,
        lines: [
          sessionMeta({ history_base: { thread_id: SESSION, end_ordinal_exclusive: 4, end_byte_offset: 100 } }, 4),
          turnContext(5, "turn-2"),
          userMessage(6, "turn-2", "two"),
          usage(7, "turn-2", { input: 2000 }),
        ],
      },
    ])
    const index = indexCodexCorpus(root)
    expect(index.sessions.size).toBe(1)
    const { session } = await readCodexSession(path, { index })
    expect(session.id).toBe(SESSION)
    expect(session.segments).toHaveLength(2)
    expect(session.turns).toHaveLength(2)
    // base_instructions appears in both files but is counted once per session.
    const system = session.turns[0]?.attribution.parts.find((slice) => slice.part === "system-prompt")
    expect(system?.measure.tokens).toBe(Math.round("SYSTEM PROMPT TEXT".length / CODEX_CHARS_PER_TOKEN_TEXT))

    // Opening the continuation file must resolve the same session, not a fork.
    const continuationPath = index.files.find((file) => file.path.includes(continuation))?.path
    expect(continuationPath).toBeDefined()
    const fromContinuation = await readCodexSession(continuationPath as string, { index })
    expect(fromContinuation.session.id).toBe(SESSION)
    expect(fromContinuation.session.turns).toHaveLength(2)
    expect(fromContinuation.session.segments).toHaveLength(2)
  })
})

describe("subagents", () => {
  it("links a child rollout to the turn that spawned it without merging its turns", async () => {
    const child = "01a00000-0000-7000-8000-000000000003"
    const { root, path } = fixture("subagent", [
      {
        name: SESSION,
        lines: [
          sessionMeta(),
          turnContext(1, "turn-1"),
          userMessage(2, "turn-1", "delegate"),
          envelope(3, "event_msg", {
            type: "item_completed",
            turn_id: "turn-1",
            item: { type: "SubAgentActivity", kind: "started", agent_thread_id: child, agent_path: "/root/worker" },
          }),
          usage(4, "turn-1", { input: 1200 }),
        ],
      },
      {
        name: child,
        lines: [
          sessionMeta({ id: child, parent_thread_id: SESSION, agent_nickname: "worker", agent_role: "explorer" }),
          turnContext(1, "child-turn"),
          userMessage(2, "child-turn", "child work"),
          usage(3, "child-turn", { input: 400 }),
        ],
      },
    ])
    const { session } = await readCodexSession(path, { root })
    expect(session.turns).toHaveLength(1)
    expect(session.turns[0]?.subagents).toEqual([child])
    // The child file is a segment of the parent, never a turn in it.
    expect(session.segments).toHaveLength(2)

    // The child thread is its own session when opened directly.
    const childPath = session.segments.find((file) => file.includes(child))
    expect(childPath).toBeDefined()
    const childSession = await readCodexSession(childPath as string, { root })
    expect(childSession.session.id).toBe(child)
    expect(childSession.session.turns).toHaveLength(1)
    expect(childSession.session.segments).toHaveLength(1)
    expect(childSession.session.dataQuality).toContain("subagent-thread")
  })
})

describe("attribution reconciliation", () => {
  it("scales inside the 25% band and reports the factor", () => {
    const parts: ContextSlice[] = [
      { part: "system-prompt", measure: { tokens: 100, precision: "estimate", basis: "chars-per-token" } },
      { part: "user-input", measure: { tokens: 20, precision: "estimate", basis: "chars-per-token" } },
    ]
    const decision = reconcile(parts, 130, false)
    expect(decision.scaled).toBe(true)
    expect(decision.factor).toBeCloseTo(130 / 120, 5)
    expect(decision.residual).toBeUndefined()
    // Rounding is absorbed so the partition is exact.
    expect(sumSlices(parts)).toBe(130)
  })

  it("refuses any scaling while a category is missing, overshoot included", () => {
    const parts: ContextSlice[] = [
      { part: "system-prompt", measure: { tokens: 120, precision: "estimate", basis: "chars-per-token" } },
    ]
    const decision = reconcile(parts, 110, true)
    expect(decision.scaled).toBe(false)
    expect(decision.residual?.tokens).toBe(-10)
    expect(decision.residual?.basis).toBe("unattributed")
    // Nothing moved: the slices keep their raw estimates.
    expect(sumSlices(parts)).toBe(120)
  })

  it("scales an overshoot down without a gap, with no lower bound", () => {
    const parts: ContextSlice[] = [
      { part: "system-prompt", measure: { tokens: 300, precision: "estimate", basis: "chars-per-token" } },
    ]
    const decision = reconcile(parts, 120, false)
    expect(decision.scaled).toBe(true)
    expect(decision.factor).toBeCloseTo(0.4, 5)
    expect(decision.residual).toBeUndefined()
    expect(sumSlices(parts)).toBe(120)
  })

  it("refuses to scale an undershoot when a category is missing and keeps the identity", async () => {
    const { root, path } = fixture("residual", [
      {
        name: SESSION,
        lines: [
          sessionMeta(),
          turnContext(1, "turn-1"),
          userMessage(2, "turn-1", "x".repeat(260)),
          usage(4, "turn-1", { input: 5000 }),
        ],
      },
    ])
    const { session } = await readCodexSession(path, { root })
    const attribution = (session.turns[0] as Turn).attribution
    // No tool schema was logged, so the undershoot cannot be spread over the
    // known slices; it stays a residual and the identity still holds.
    expect(attribution.reconciled).toBeUndefined()
    expect(attribution.residual?.basis).toBe("unattributed")
    // total = sum(parts) + residual, exactly, without spreading the gap.
    expect(sumSlices(attribution.parts) + (attribution.residual?.tokens ?? 0)).toBe(attribution.total.tokens)
  })

  it("scales when the tool schemas were actually logged", () => {
    const window = new CodexWindow()
    window.setBaseInstructions("x".repeat(260))
    window.applyToolSchemas([
      { type: "namespace", name: "functions", description: "", tools: [{ type: "custom", name: "exec" }] },
    ])
    expect(window.sawToolSchemas).toBe(true)
    window.addHumanText("y".repeat(26), 0)
    // Calibrate on the raw estimate, then ask for a total 10% above it.
    const raw = window.attribution(0).decision.rawTokens
    const report = window.attribution(Math.round(raw * 1.1))
    const attribution: Attribution = report.attribution
    expect(report.decision.scaled).toBe(true)
    expect(report.decision.residual).toBeUndefined()
    expect(attribution.reconciled?.factor).toBeCloseTo(report.decision.factor, 5)
    expect(sumSlices(attribution.parts)).toBe(Math.round(raw * 1.1))
  })
})
