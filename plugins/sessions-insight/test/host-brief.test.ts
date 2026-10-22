import { describe, expect, it } from "vitest"
import type { Session, ToolCall, Turn } from "@cyrus/dsh-session-contract"
import { BRIEF_LIMIT, NO_RECORD, extractBrief } from "../src/host/views/brief.ts"

const WORKDIR = "/Users/example/project"

function call(over: Partial<ToolCall> & { name: string }): ToolCall {
  return { id: "call-" + over.name + String(Math.random()), status: "ok", startedAt: 1, input: {}, ...over }
}

function turn(index: number, user: string, assistant: string, calls: ToolCall[] = []): Turn {
  return {
    index,
    startedAt: index * 1000,
    endedAt: index * 1000 + 500,
    userInput: [user],
    assistantText: [assistant],
    toolCalls: calls,
    compactions: [],
    subagents: [],
    attribution: { total: { tokens: 10, precision: "exact", basis: "usage" }, parts: [] },
  }
}

function session(turns: Turn[], extra: Partial<Session> = {}): Session {
  return {
    id: "s1",
    source: "claude",
    workdir: WORKDIR,
    title: "会话标题",
    createdAt: 1,
    updatedAt: 2,
    turns,
    segments: [],
    dataQuality: [],
    ...extra,
  }
}

const RICH = session([
  turn(
    1,
    "把上下文面板做出来",
    [
      "## 已完成",
      "- 决定采用 slots.inject 包住 register，避免加载顺序问题",
      "- 下一步：补上成本视图",
      "- 未决：DSH 侧 cacheRead 口径还需复核",
      "- 风险：Codex 分段失效可能漏掉",
    ].join("\n"),
    [
      call({ name: "Edit", input: { file_path: "/Users/example/project/src/a.ts" } }),
      call({ name: "Write", input: { file_path: "/Users/example/project/src/a.ts" } }),
      call({ name: "Write", input: { file_path: "/Users/example/project/src/b.ts" } }),
      call({ name: "Bash", input: { command: "pnpm test --filter handoff" } }),
      call({ name: "Bash", input: { command: "ls -la" } }),
      call({ name: "Bash", input: { command: "pnpm typecheck" }, status: "error", output: "error TS2345: bad type" }),
    ]
  ),
])

describe("handoff brief extraction", () => {
  it("produces the six sections in the documented order", () => {
    const brief = extractBrief(RICH)
    expect(brief.sections.map((section) => section.title)).toEqual([
      "背景与目标",
      "已改动文件",
      "已定决策",
      "未决与风险",
      "下一步",
      "验证命令",
    ])
  })

  it("lifts files from tool inputs, deduplicated and counted", () => {
    const brief = extractBrief(RICH)
    expect(brief.files).toHaveLength(2)
    expect(brief.files[0]).toContain("/Users/example/project/src/a.ts")
    expect(brief.files[0]).toContain("×2")
    expect(brief.files[1]).toContain("/Users/example/project/src/b.ts")
  })

  it("extracts decisions, open items and next steps from assistant bullets only", () => {
    const brief = extractBrief(RICH)
    const decisions = brief.sections[2]?.lines ?? []
    const open = brief.sections[3]?.lines ?? []
    const next = brief.sections[4]?.lines ?? []
    expect(decisions.some((line) => line.includes("决定采用 slots.inject"))).toBe(true)
    expect(open.some((line) => line.includes("未决：DSH 侧 cacheRead"))).toBe(true)
    // A tool failure becomes an open item with its error text.
    expect(open.some((line) => line.includes("工具 Bash 报错") && line.includes("TS2345"))).toBe(true)
    expect(next.some((line) => line.includes("补上成本视图"))).toBe(true)
    // The user's own words are not turned into decisions.
    expect(decisions.some((line) => line.includes("把上下文面板做出来"))).toBe(false)
  })

  it("keeps only verification-like commands, deduplicated", () => {
    const brief = extractBrief(RICH)
    const commands = brief.sections[5]?.lines ?? []
    expect(commands).toContain("pnpm test --filter handoff")
    expect(commands).toContain("pnpm typecheck")
    expect(commands).not.toContain("ls -la")
  })

  it("says 日志中无记录 instead of inventing an empty section", () => {
    const sparse = session([turn(1, "只问了一句", "好的。")])
    const brief = extractBrief(sparse)
    expect(brief.sections[1]?.lines).toEqual([NO_RECORD])
    expect(brief.sections[2]?.lines).toEqual([NO_RECORD])
    expect(brief.sections[4]?.lines).toEqual([NO_RECORD])
    expect(brief.sections[1]?.empty).toBe(true)
  })

  it("stays inside the 2000 character contract", () => {
    const longPath = (index: number): string =>
      "/Users/example/project/" + "deeply/".repeat(20) + "file-" + String(index) + ".ts"
    const calls = Array.from({ length: 12 }, (_, index) =>
      call({ name: "Write", input: { file_path: longPath(index) } })
    )
    const long = session([
      turn(
        1,
        "x".repeat(500),
        Array.from(
          { length: 8 },
          (_, index) => `- 决定采用方案 ${String(index)} 并在较长的一行里记录它的完整理由`
        ).join("\n"),
        calls
      ),
    ])
    const brief = extractBrief(long)
    expect(brief.chars).toBeLessThanOrEqual(BRIEF_LIMIT)
    expect(brief.text).toContain("已达 2000 字上限")
  })
})
