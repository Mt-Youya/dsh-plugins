import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Session, ToolCall, Turn } from "@cyrusdoyle/dsh-session-contract"
import { readClaudeSession } from "@cyrusdoyle/dsh-session-readers"
import { describe, expect, it, vi } from "vitest"

import { ClaudeSource } from "../src/host/sources/claude.ts"

vi.mock("@cyrusdoyle/dsh-session-readers", async (importOriginal) => {
  const readers = await importOriginal<typeof import("@cyrusdoyle/dsh-session-readers")>()
  return { ...readers, readClaudeSession: vi.fn(readers.readClaudeSession) }
})

import { insightsOfSession } from "../src/host/views/insights.ts"
import { isSessionInsights } from "../src/protocol/insights.ts"

function turn(index: number): Turn {
  return {
    index,
    startedAt: index * 1000,
    endedAt: index * 1000 + 900,
    userInput: [`question ${index}`],
    assistantText: [`answer ${index}`],
    toolCalls: [],
    compactions: [],
    subagents: [],
    attribution: { total: { tokens: index * 100, precision: "exact", basis: "usage" }, parts: [] },
  }
}

function session(turns: Turn[]): Session {
  return {
    id: "s",
    source: "claude",
    workdir: "/work",
    createdAt: 1,
    updatedAt: 9999999,
    turns,
    segments: [],
    dataQuality: [],
  }
}

function tool(id: string, name: string, input: unknown, startedAt = 1100, endedAt?: number): ToolCall {
  return { id, name, input, status: "ok", startedAt, ...(endedAt === undefined ? {} : { endedAt }) }
}

describe("full-session insights", () => {
  it("uses turns beyond page 40 for current, peak, compactions and last message", () => {
    const turns = Array.from({ length: 65 }, (_, index) => turn(index + 1))
    turns[59]!.attribution.total.tokens = 100000
    turns[60]!.compactions.push({
      at: 61001,
      before: turns[59]!.attribution.total,
      after: turns[60]!.attribution.total,
      replacedHistory: true,
    })
    turns[64]!.attribution.total.tokens = 0
    const report = insightsOfSession(session(turns))
    expect(report.turnCount).toBe(65)
    expect(report.currentAttribution?.turnIndex).toBe(64)
    expect(report.peak).toMatchObject({ turnIndex: 60, measure: { tokens: 100000 } })
    expect(report.compactions).toBe(1)
    expect(report.lastMessage).toEqual({ role: "assistant", text: "answer 65", turnIndex: 65, time: 65900 })
    expect(report.timing.spanMs).toBe(64900)
    expect(isSessionInsights(report)).toBe(true)
  })

  it("sums only billing usage and exposes missing coverage, never sums context parts", () => {
    const first = turn(1)
    first.usage = { input: 10, cacheRead: 20, cacheWrite: 30, output: 40, totalContext: 60 }
    first.attribution.parts = [
      { part: "history", measure: { tokens: 99999, precision: "estimate", basis: "chars-per-token" } },
    ]
    const second = turn(2)
    second.usage = { input: 1, cacheRead: 2, cacheWrite: 3, output: 4, totalContext: 6 }
    const report = insightsOfSession(session([first, second, turn(3)]))
    expect(report.usage).toEqual({
      input: 11,
      cacheRead: 22,
      cacheWrite: 33,
      output: 44,
      coveredTurns: 2,
      missingTurns: 1,
    })
    expect(isSessionInsights(report)).toBe(true)
  })

  it("does not invent timestamps, durations or usage zeros when no data was recorded", () => {
    const first = turn(1)
    first.startedAt = 0
    delete first.endedAt
    first.attribution.total.tokens = 0
    first.toolCalls = [tool("no-time", "Read", { file_path: "/skills/css/SKILL.md" }, 0)]
    const report = insightsOfSession(session([first]))
    expect(report.usage).toEqual({
      input: null,
      cacheRead: null,
      cacheWrite: null,
      output: null,
      coveredTurns: 0,
      missingTurns: 1,
    })
    expect(report.currentAttribution).toBeNull()
    expect(report.peak).toBeNull()
    expect(report.timing).toEqual({
      spanMs: null,
      completedTurnMs: null,
      completedTurns: 0,
      missingTurnDurations: 1,
      toolUnionMs: null,
      timedToolCalls: 0,
      missingToolDurations: 1,
    })
    expect(report.lastMessage).not.toHaveProperty("time")
    expect(report.skills[0]!.evidence[0]).not.toHaveProperty("time")
    expect(isSessionInsights(report)).toBe(true)
  })

  it("merges parallel intervals and repeated call outcomes, excluding incomplete and reversed intervals", () => {
    const first = turn(1)
    first.toolCalls = [
      tool("a", "Skill", { skill: "css" }, 1100),
      tool("b", "Read", { file_path: "/skills/css/SKILL.md" }, 1200, 1600),
      tool("a", "Skill", { skill: "css" }, 1100, 1500),
      tool("c", "Read", {}, 2000, 2100),
      tool("d", "Read", {}, 3000, 2900),
    ]
    const second = turn(2)
    second.toolCalls = [tool("b", "Read", { file_path: "/skills/css/SKILL.md" }, 1200, 1600)]
    const report = insightsOfSession(session([first, second]))
    expect(report.toolCalls).toBe(4)
    expect(report.timing).toMatchObject({ toolUnionMs: 600, timedToolCalls: 3, missingToolDurations: 1 })
    expect(report.skills.map((skill) => skill.count)).toEqual([1, 1])
    expect(isSessionInsights(report)).toBe(true)
  })

  it("keeps genuine recorded zero duration and zero billing separate from unknown", () => {
    const first = turn(1)
    first.endedAt = first.startedAt
    first.usage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, totalContext: 0 }
    first.toolCalls = [tool("a", "Skill", { skill: "css" }, 1000, 1000)]
    const report = insightsOfSession(session([first]))
    expect(report.timing.completedTurnMs).toBe(0)
    expect(report.timing.toolUnionMs).toBe(0)
    expect(report.usage.input).toBe(0)
    expect(isSessionInsights(report)).toBe(true)
  })

  it("falls back to the last real user message, not earlier assistant text or mtime", () => {
    const second = turn(2)
    second.assistantText = ["", " "]
    second.userInput = ["first", "last"]
    const report = insightsOfSession(session([turn(1), second]))
    expect(report.lastMessage).toEqual({ role: "user", text: "last", turnIndex: 2, time: 2000 })
    expect(insightsOfSession(session([])).lastMessage).toBeNull()
  })

  it("bounds the last message excerpt without leaking the remainder or mutating text", () => {
    const first = turn(1)
    first.assistantText = [`${"a".repeat(500)}private tail`]
    const report = insightsOfSession(session([first]))
    expect(report.lastMessage?.text).toBe(`${"a".repeat(500)}…`)
    expect(JSON.stringify(report)).not.toContain("private tail")
    expect(first.assistantText[0]).toContain("private tail")
    expect(isSessionInsights(report)).toBe(true)
    first.assistantText = ["a".repeat(500)]
    expect(insightsOfSession(session([first])).lastMessage?.text).toBe(first.assistantText[0])
  })

  it("excludes non-finite usage, attribution and timestamps from numeric statistics", () => {
    const first = turn(1)
    first.startedAt = NaN
    first.endedAt = Infinity
    first.attribution.parts = [{ part: "history", measure: { tokens: NaN, precision: "exact", basis: "usage" } }]
    first.usage = { input: NaN, cacheRead: 0, cacheWrite: 0, output: 0, totalContext: 0 }
    first.toolCalls = [tool("a", "Skill", { skill: "css" }, NaN, Infinity)]
    const report = insightsOfSession(session([first]))
    expect(report.currentAttribution).toBeNull()
    expect(report.peak).toBeNull()
    expect(report.usage.coveredTurns).toBe(0)
    expect(report.timing.spanMs).toBeNull()
    expect(report.timing.toolUnionMs).toBeNull()
    expect(isSessionInsights(report)).toBe(true)
    expect(isSessionInsights(JSON.parse(JSON.stringify(report)))).toBe(true)
  })

  it("counts late repeated skill outcomes once and keeps anonymous calls distinct from real ids", () => {
    const turns = Array.from({ length: 65 }, (_, index) => turn(index + 1))
    turns[0]!.toolCalls = [tool("a", "Skill", { skill: "css" }, 1100), tool("", "Read", {}, 1100)]
    turns[64]!.toolCalls = [
      tool("a", "Skill", { skill: "css" }, 1100, 1500),
      tool("anonymous:1:1", "Read", {}, 65000, 65100),
    ]
    const report = insightsOfSession(session(turns))
    expect(report.toolCalls).toBe(3)
    expect(report.skills[0]).toMatchObject({ count: 1, lastTurnIndex: 1 })
    expect(report.timing).toMatchObject({ timedToolCalls: 2, missingToolDurations: 1, toolUnionMs: 500 })
    expect(isSessionInsights(report)).toBe(true)
  })

  it("does not mutate full IR or inspect any tool output", () => {
    const first = turn(1)
    const call = tool("a", "Read", { file_path: "/skills/css/SKILL.md" })
    Object.defineProperty(call, "output", {
      get() {
        throw new Error("must not inspect body")
      },
    })
    first.toolCalls = [call]
    const source = session([first])
    Object.freeze(source.turns)
    Object.freeze(first.toolCalls)
    expect(insightsOfSession(source).skills[0]?.name).toBe("css")
  })
})

describe("insights reader boundary", () => {
  it("does not read the transcript when its mtime stat fails after discovery", async () => {
    const root = await mkdtemp(join(tmpdir(), "insights-mtime-"))
    const path = join(root, "s.jsonl")
    const source = new ClaudeSource({ root })
    const scan = vi.spyOn(source, "scan").mockResolvedValue({
      root,
      state: "ok",
      scannedAt: 1,
      sessions: [{ id: "s", path, projectDir: "", workdir: "/work", workdirDecoded: false, bytes: 3, updatedAt: 1 }],
    })
    try {
      await writeFile(path, "{}\n")
      await rm(path)
      const readsBefore = vi.mocked(readClaudeSession).mock.calls.length
      expect(await source.detail("s")).toEqual({ ok: false, error: "not-found", detail: "session-file-missing" })
      expect(vi.mocked(readClaudeSession).mock.calls).toHaveLength(readsBefore)
    } finally {
      scan.mockRestore()
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe("explicit skill evidence", () => {
  it("accepts Skill and SKILL.md reads, canonicalizes relative paths, keeps same-name paths distinct", () => {
    const first = turn(1)
    first.toolCalls = [
      tool("a", "Skill", { skill: "css" }),
      tool("b", "functions.read_file", { target_file: "skills/css/SKILL.md" }),
      tool("c", "Read", { file_path: "/work/skills/./css/SKILL.md" }),
      tool("d", "Read", { file_path: "/elsewhere/css/SKILL.md" }),
      tool("e", "Skill", { skill: "wrong-name", path: "/elsewhere/css/SKILL.md" }),
    ]
    const report = insightsOfSession(session([first]))
    expect(report.skills).toHaveLength(3)
    const local = report.skills.find((skill) => skill.path === "/work/skills/css/SKILL.md")!
    expect(local).toMatchObject({ name: "css", count: 2, lastTurnIndex: 1 })
    expect(local.evidence.map((item) => item.toolCallId)).toEqual(["b", "c"])
    expect(report.skills.find((skill) => skill.path === "/elsewhere/css/SKILL.md")?.count).toBe(2)
    expect(report.skills.find((skill) => skill.id === "name:css")?.count).toBe(1)
    expect(isSessionInsights(report)).toBe(true)
  })

  it("does not mistake injection, shell, output, edits, directory listing or malformed input for skill use", () => {
    const first = turn(1)
    first.userInput = ["<available_skills>css /skills/css/SKILL.md</available_skills>"]
    first.assistantText = ["I will use css"]
    first.toolCalls = [
      tool("a", "Bash", { command: "cat /skills/css/SKILL.md" }),
      tool("b", "Read", { file_path: "/skills/css/README.md" }),
      tool("c", "Write", { file_path: "/skills/css/SKILL.md" }),
      tool("d", "list_dir", { path: "/skills/css/SKILL.md" }),
      tool("e", "Skill", { skill: "css --with args" }),
      tool("f", "Read", { file_path: "/skills/css/SKILL.md\nmalicious" }),
      { ...tool("g", "Read", {}), output: "Read /skills/css/SKILL.md" },
    ]
    expect(insightsOfSession(session([first])).skills).toEqual([])
  })
})

describe("wire guard", () => {
  it("accepts JSON round trips and rejects malformed nested fields and coverage", () => {
    const report = insightsOfSession(session([turn(1)]))
    expect(isSessionInsights(JSON.parse(JSON.stringify(report)))).toBe(true)
    for (const invalid of [
      null,
      {},
      { ...report, toolCalls: -1 },
      { ...report, usage: { ...report.usage, input: 0 } },
      { ...report, currentAttribution: { turnIndex: 1, attribution: { total: { tokens: NaN }, parts: [] } } },
      { ...report, lastMessage: { role: "system", text: "bad", turnIndex: 1 } },
      { ...report, timing: { ...report.timing, completedTurnMs: null } },
      { ...report, usage: { ...report.usage, missingTurns: 0 } },
    ])
      expect(isSessionInsights(invalid)).toBe(false)
  })

  it("rejects shape-valid but semantically inconsistent reports", () => {
    const first = turn(1)
    first.toolCalls = [tool("a", "Skill", { skill: "css" }, 1100, 1500)]
    const report = insightsOfSession(session([first, turn(2)]))
    const skill = report.skills[0]!
    for (const invalid of [
      { ...report, currentAttribution: { ...report.currentAttribution!, turnIndex: 3 } },
      { ...report, peak: { ...report.peak!, measure: { ...report.peak!.measure, tokens: 1 } } },
      { ...report, peak: null },
      { ...report, lastMessage: { ...report.lastMessage!, turnIndex: 3 } },
      { ...report, lastMessage: { ...report.lastMessage!, text: "x".repeat(502) } },
      { ...report, timing: { ...report.timing, toolUnionMs: report.timing.spanMs! + 1 } },
      { ...report, skills: [{ ...skill, lastTurnIndex: 2 }] },
      { ...report, skills: [{ ...skill, lastTime: 1200 }] },
      { ...report, skills: [{ ...skill, id: "name:other" }] },
      {
        ...report,
        skills: [
          skill,
          {
            ...skill,
            id: "path:/skills/css/SKILL.md",
            path: "/skills/css/SKILL.md",
            evidence: skill.evidence.map((item) => ({ ...item, path: "/skills/css/SKILL.md" })),
          },
        ],
      },
    ])
      expect(isSessionInsights(invalid)).toBe(false)
  })

  it("rejects duplicated evidence and malformed skills", () => {
    const first = turn(1)
    first.toolCalls = [tool("a", "Skill", { skill: "css" })]
    const report = insightsOfSession(session([first]))
    const skill = report.skills[0]!
    expect(
      isSessionInsights({
        ...report,
        skills: [{ ...skill, count: 2, evidence: [...skill.evidence, ...skill.evidence] }],
      }),
    ).toBe(false)
    expect(
      isSessionInsights({ ...report, skills: [{ ...skill, evidence: [{ ...skill.evidence[0], time: 0 }] }] }),
    ).toBe(false)
  })
})
