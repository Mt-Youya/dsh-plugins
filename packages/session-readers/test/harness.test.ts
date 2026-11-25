/**
 * The harness readers: one fixture per storage family, shaped like the formats
 * the four tools actually write (see `.scratch/harness-research/`).
 *
 * These tests are the only place the formats are pinned: the parsers are
 * deliberately tolerant, so what is asserted here is the contract — turn
 * boundaries, tool pairing, honest usage, and the quality tokens that say what
 * a log could not tell us.
 */

import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { readAntigravityTranscript } from "../src/harness/antigravity/session.ts"
import { readClineTask, usagesOfUi } from "../src/harness/cline/session.ts"
import { readCursorComposer } from "../src/harness/cursor/session.ts"
import { readPiSession } from "../src/harness/pi/session.ts"
import { decodeChatFile, readVscodeChat } from "../src/harness/vscode/session.ts"

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "harness-test-"))
}

describe("pi", () => {
  it("folds the live branch into turns with usage and tool pairing", async () => {
    const dir = await tempDir()
    const path = join(dir, "2026-11-23T17-01-02-345Z_01932abc.jsonl")
    const lines = [
      { type: "session", version: 3, id: "pi-1", timestamp: "2026-11-23T09:00:00.000Z", cwd: "/work/demo" },
      {
        type: "model_change",
        id: "e0",
        parentId: null,
        timestamp: "2026-11-23T09:00:00.500Z",
        provider: "anthropic",
        modelId: "claude-sonnet-4-5",
      },
      {
        type: "message",
        id: "e1",
        parentId: "e0",
        timestamp: "2026-11-23T09:00:01.000Z",
        message: { role: "user", content: "先把 a.ts 读一下" },
      },
      {
        type: "message",
        id: "e2",
        parentId: "e1",
        timestamp: "2026-11-23T09:00:02.000Z",
        message: {
          role: "assistant",
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          content: [
            { type: "thinking", thinking: "需要读文件" },
            { type: "text", text: "我看一下。" },
            { type: "toolCall", id: "call_1", name: "read", arguments: { path: "a.ts" } },
          ],
          usage: { input: 1200, output: 60, cacheRead: 800, cacheWrite: 0, totalTokens: 2060 },
        },
      },
      {
        type: "message",
        id: "e3",
        parentId: "e2",
        timestamp: "2026-11-23T09:00:03.000Z",
        message: {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "read",
          content: [{ type: "text", text: "export const a = 1" }],
          isError: false,
        },
      },
      {
        type: "compaction",
        id: "e4",
        parentId: "e3",
        timestamp: "2026-11-23T09:00:04.000Z",
        summary: "之前聊过 a.ts",
        tokensBefore: 2000,
      },
      {
        type: "message",
        id: "e5",
        parentId: "e4",
        timestamp: "2026-11-23T09:00:05.000Z",
        message: { role: "user", content: "继续" },
      },
      {
        type: "message",
        id: "e6",
        parentId: "e5",
        timestamp: "2026-11-23T09:00:06.000Z",
        message: {
          role: "assistant",
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          content: [{ type: "text", text: "好" }],
        },
      },
    ]
    await writeFile(path, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8")
    const session = await readPiSession(path)
    expect(session.id).toBe("pi-1")
    expect(session.workdir).toBe("/work/demo")
    expect(session.turns).toHaveLength(2)
    const [first, second] = session.turns
    expect(first?.userInput).toEqual(["先把 a.ts 读一下"])
    expect(first?.assistantText).toEqual(["我看一下。"])
    expect(first?.thinking).toEqual(["需要读文件"])
    expect(first?.toolCalls.map((call) => call.name)).toEqual(["read"])
    expect(first?.toolCalls[0]?.status).toBe("ok")
    expect(first?.usage).toEqual({ input: 1200, cacheRead: 800, cacheWrite: 0, output: 60, totalContext: 2000 })
    expect(first?.compactions).toHaveLength(1)
    expect(first?.compactions[0]?.replacedHistory).toBe(true)
    expect(second?.usage).toBeUndefined()
    expect(session.dataQuality).toContain("turn-without-usage")
    expect(session.dataQuality).toContain("attribution-prompt-unknown")
    // The logged total is the anchor; the unknown prefix stays a residual.
    expect(first?.attribution.total).toEqual({ tokens: 2000, precision: "exact", basis: "usage" })
    expect(first?.attribution.residual).toBeDefined()
  })

  it("keeps only the live branch when the tree forks", async () => {
    const dir = await tempDir()
    const path = join(dir, "s.jsonl")
    const lines = [
      { type: "session", version: 3, id: "pi-2", timestamp: "2026-11-23T09:00:00.000Z", cwd: "/work" },
      {
        type: "message",
        id: "a",
        parentId: null,
        timestamp: "2026-11-23T09:00:01.000Z",
        message: { role: "user", content: "问题" },
      },
      {
        type: "message",
        id: "b",
        parentId: "a",
        timestamp: "2026-11-23T09:00:02.000Z",
        message: { role: "assistant", content: [{ type: "text", text: "旧分支" }] },
      },
      {
        type: "message",
        id: "c",
        parentId: "a",
        timestamp: "2026-11-23T09:00:03.000Z",
        message: { role: "assistant", content: [{ type: "text", text: "新分支" }] },
      },
    ]
    await writeFile(path, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8")
    const session = await readPiSession(path)
    expect(session.turns).toHaveLength(1)
    expect(session.turns[0]?.assistantText).toEqual(["新分支"])
    expect(session.dataQuality).toContain("branch-entries-skipped")
  })
})

describe("Cline / Roo", () => {
  it("reads turns from the API history and usage from the UI log", async () => {
    const dir = await tempDir()
    const environment =
      "<environment_details>\n# Current Workspace Directory (/work/demo) Files\na.ts\n</environment_details>"
    const history = [
      {
        role: "user",
        ts: 1_700_000_000_000,
        content: [
          { type: "text", text: "把 foo 改名" },
          { type: "text", text: environment },
        ],
      },
      {
        role: "assistant",
        ts: 1_700_000_001_000,
        content: [
          { type: "thinking", thinking: "先读文件" },
          { type: "text", text: "先看一下。" },
          { type: "tool_use", id: "toolu_1", name: "read_file", input: { path: "a.ts" } },
        ],
      },
      {
        role: "user",
        ts: 1_700_000_002_000,
        content: [{ type: "tool_result", tool_use_id: "toolu_1", content: [{ type: "text", text: "foo = 1" }] }],
      },
      { role: "assistant", ts: 1_700_000_003_000, content: [{ type: "text", text: "改好了。" }] },
    ]
    const ui = [
      { ts: 1_700_000_000_000, type: "say", say: "task", text: "把 foo 改名" },
      {
        ts: 1_700_000_000_500,
        type: "say",
        say: "api_req_started",
        text: JSON.stringify({
          apiProtocol: "anthropic",
          tokensIn: 5000,
          tokensOut: 80,
          cacheWrites: 1000,
          cacheReads: 2000,
          cost: 0.02,
        }),
      },
      { ts: 1_700_000_003_000, type: "say", say: "completion_result", text: "改好了。" },
      { ts: 1_700_000_004_000, type: "say", say: "user_feedback", text: "测试也改" },
    ]
    const metadata = {
      model_usage: [{ ts: 1, model_id: "claude-sonnet-4-5", model_provider_id: "anthropic", mode: "act" }],
    }
    await writeFile(join(dir, "api_conversation_history.json"), JSON.stringify(history), "utf8")
    await writeFile(join(dir, "ui_messages.json"), JSON.stringify(ui), "utf8")
    await writeFile(join(dir, "task_metadata.json"), JSON.stringify(metadata), "utf8")
    const session = await readClineTask(dir)
    expect(session.workdir).toBe("/work/demo")
    expect(session.title).toBe("把 foo 改名")
    expect(session.turns).toHaveLength(2)
    const [first] = session.turns
    expect(first?.userInput).toEqual(["把 foo 改名"])
    expect(first?.assistantText).toEqual(["先看一下。", "改好了。"])
    expect(first?.thinking).toEqual(["先读文件"])
    expect(first?.toolCalls[0]).toMatchObject({ name: "read_file", status: "ok" })
    // tokensIn 5000 already includes the 2000+1000 cache buckets.
    expect(first?.usage).toEqual({ input: 2000, cacheRead: 2000, cacheWrite: 1000, output: 80, totalContext: 5000 })
    expect(first?.model).toEqual({ provider: "anthropic", model: "claude-sonnet-4-5" })
    expect(session.turns[1]?.userInput).toEqual(["测试也改"])
  })

  it("drops incomplete api_req_started rows", () => {
    const usages = usagesOfUi([
      { ts: 1, type: "say", say: "api_req_started", text: JSON.stringify({ apiProtocol: "anthropic" }) },
      {
        ts: 2,
        type: "say",
        say: "api_req_started",
        text: JSON.stringify({ tokensIn: 10, tokensOut: 2 }),
        partial: true,
      },
      { ts: 3, type: "say", say: "api_req_started", text: JSON.stringify({ tokensIn: 20, tokensOut: 3 }) },
    ])
    expect(usages).toHaveLength(1)
    expect(usages[0]).toMatchObject({ input: 20, output: 3, contextTokens: 20 })
  })
})

describe("VS Code chatSessions", () => {
  it("replays the JSONL mutation log into one session", async () => {
    const dir = await tempDir()
    const path = join(dir, "abc.jsonl")
    const snapshot = {
      version: 3,
      sessionId: "chat-1",
      requests: [
        {
          requestId: "r1",
          timestamp: 1_700_000_000_000,
          message: { text: "解释一下 a.ts" },
          followups: [{ id: "f1", message: "还要吗" }],
          promptTokens: 900,
          completionTokens: 40,
          response: [{ kind: "markdownContent", content: { value: "它是常量" } }],
          result: {
            metadata: {
              modelId: "gpt-5",
              toolCallRounds: [{ toolCalls: [{ id: "call-1", name: "read_file", arguments: '{"path":"a.ts"}' }] }],
              toolCallResults: { "call-1": { content: [{ value: "export const a = 1" }] } },
            },
          },
        },
      ],
    }
    const lines = [
      JSON.stringify({ kind: 0, v: snapshot }),
      JSON.stringify({ kind: 1, k: ["requests", 0, "response", 0, "content", "value"], v: "它是常量 1" }),
      JSON.stringify({
        kind: 2,
        k: ["requests"],
        i: 1,
        v: [
          {
            requestId: "r2",
            timestamp: 1_700_000_010_000,
            message: { text: "再改一下" },
            response: [{ kind: "thinking", value: "需要编辑" }, { value: "好了" }],
          },
        ],
      }),
      JSON.stringify({ kind: 3, k: ["requests", 0, "followups"] }),
    ]
    await writeFile(path, `${lines.join("\n")}\n`, "utf8")
    const decoded = decodeChatFile(lines.join("\n")) ?? {}
    const requests = (decoded["requests"] as Record<string, unknown>[]) ?? []
    expect(requests[0]?.["followups"]).toBeUndefined()
    const session = await readVscodeChat(path, "/work/demo")
    expect(session.id).toBe("chat-1")
    expect(session.workdir).toBe("/work/demo")
    expect(session.turns).toHaveLength(2)
    const [first, second] = session.turns
    expect(first?.userInput).toEqual(["解释一下 a.ts"])
    expect(first?.assistantText).toEqual(["它是常量 1"])
    expect(first?.toolCalls[0]).toMatchObject({
      name: "read_file",
      status: "ok",
      output: [{ value: "export const a = 1" }],
    })
    expect(first?.usage).toEqual({ input: 900, cacheRead: 0, cacheWrite: 0, output: 40, totalContext: 900 })
    expect(second?.assistantText).toEqual(["好了"])
    expect(second?.thinking).toEqual(["需要编辑"])
    expect(second?.usage).toBeUndefined()
  })

  it("decodes the legacy single-object file", () => {
    const snapshot = decodeChatFile(JSON.stringify({ sessionId: "legacy", requests: [] }))
    expect(snapshot?.["sessionId"]).toBe("legacy")
  })
})

describe("Cursor", () => {
  it("orders by the composer headers and pairs tool results", () => {
    const composer = {
      composerId: "composer-1",
      name: "重命名 foo",
      createdAt: 1_700_000_000_000,
      lastUpdatedAt: 1_700_000_009_000,
      fullConversationHeadersOnly: [
        { bubbleId: "b1", type: 1 },
        { bubbleId: "b2", type: 2 },
      ],
    }
    const bubbles = [
      {
        bubbleId: "b2",
        value: {
          type: 2,
          text: "改好了",
          modelInfo: { modelName: "claude-sonnet-4-5" },
          toolFormerData: {
            toolCallId: "tool_1",
            name: "edit_file",
            params: '{"path":"a.ts"}',
            result: "ok",
            status: "completed",
          },
          tokenCount: { inputTokens: 0, outputTokens: 0 },
        },
      },
      { bubbleId: "b1", value: { type: 1, text: "把 foo 改名" } },
    ]
    const session = readCursorComposer({ composer, bubbles, workdir: "/work/demo", segment: "cursorDiskKV/composer-1" })
    expect(session.title).toBe("重命名 foo")
    expect(session.turns).toHaveLength(1)
    const [turn] = session.turns
    expect(turn?.userInput).toEqual(["把 foo 改名"])
    expect(turn?.assistantText).toEqual(["改好了"])
    expect(turn?.toolCalls[0]).toMatchObject({ name: "edit_file", status: "unknown" })
    // Cursor zeroes tokenCount: the turn must be estimated, not "exact 0".
    expect(turn?.usage).toBeUndefined()
    expect(turn?.attribution.total.precision).toBe("estimate")
    expect(session.dataQuality).toContain("turn-without-usage")
  })
})

describe("Antigravity", () => {
  it("unwraps USER_REQUEST, pairs tool results and keeps usage", async () => {
    const dir = await tempDir()
    const path = join(dir, "transcript_full.jsonl")
    const lines = [
      {
        step_index: 0,
        source: "USER_EXPLICIT",
        type: "USER_INPUT",
        created_at: "2026-11-20T10:00:00.000Z",
        content: "<USER_REQUEST>\n读一下 a.txt\n</USER_REQUEST>\n<ADDITIONAL_METADATA>ws</ADDITIONAL_METADATA>",
      },
      {
        step_index: 1,
        source: "MODEL",
        type: "PLANNER_RESPONSE",
        created_at: "2026-11-20T10:00:01.000Z",
        thinking: "先读文件",
        content: "我看看。",
        input_tokens: 1500,
        cache_read_tokens: 500,
        output_tokens: 50,
        tool_calls: [{ name: "read_file", args: { Path: "a.txt" } }],
      },
      {
        step_index: 2,
        source: "MODEL",
        type: "GENERIC",
        created_at: "2026-11-20T10:00:02.000Z",
        content: "Created At: 2026-11-20\nCompleted At: 2026-11-20\n1: hi",
      },
      {
        step_index: 3,
        source: "MODEL",
        type: "PLANNER_RESPONSE",
        created_at: "2026-11-20T10:00:03.000Z",
        content: "文件里是 hi。",
      },
    ]
    await writeFile(path, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8")
    const session = await readAntigravityTranscript(path, {
      id: "ag-1",
      workdir: "/work/demo",
      createdAt: 0,
      title: "读文件",
    })
    expect(session.title).toBe("读文件")
    expect(session.turns).toHaveLength(1)
    const [turn] = session.turns
    expect(turn?.userInput).toEqual(["读一下 a.txt"])
    expect(turn?.thinking).toEqual(["先读文件"])
    expect(turn?.assistantText).toEqual(["我看看。", "文件里是 hi。"])
    expect(turn?.toolCalls[0]).toMatchObject({ name: "read_file", status: "ok", output: "1: hi" })
    expect(turn?.usage).toEqual({ input: 1500, cacheRead: 500, cacheWrite: 0, output: 50, totalContext: 2000 })
  })
})
