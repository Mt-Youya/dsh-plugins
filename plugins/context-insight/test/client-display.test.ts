import { describe, expect, it } from "vitest"
import type { CompactionPoint, Turn } from "@cyrus/dsh-session-contract"
import { FIRST_INPUT_CHARS, sessionLabel } from "../src/client/labels.ts"
import { splitPath } from "../src/client/format.ts"
import { buildTurnRows } from "../src/client/state/turn-rows.ts"

function turn(index: number, compactions: CompactionPoint[]): Turn {
  return {
    index,
    startedAt: index * 1000,
    userInput: [],
    assistantText: [],
    toolCalls: [],
    compactions,
    subagents: [],
    attribution: { total: { tokens: 10, precision: "exact", basis: "usage" }, parts: [] },
  }
}

function point(at: number): CompactionPoint {
  return {
    at,
    before: { tokens: 100, precision: "exact", basis: "usage" },
    after: { tokens: 10, precision: "exact", basis: "usage" },
    replacedHistory: false,
  }
}

describe("session labels", () => {
  it("uses a real title when there is one", () => {
    expect(sessionLabel({ title: "可复用的微信聊天记录逆向提取" }).title).toBe("可复用的微信聊天记录逆向提取")
  })

  it("falls back to 未命名会话 plus the clipped first input, never an id", () => {
    const long = "x".repeat(200)
    const label = sessionLabel({ firstInput: long })
    expect(label.title).toBe("Untitled session")
    expect(label.detail).toBe("x".repeat(FIRST_INPUT_CHARS))
  })

  it("shows only 未命名会话 when nothing identifies the session", () => {
    expect(sessionLabel({})).toEqual({ title: "Untitled session" })
  })

  it("prefers the title even when a first input is present", () => {
    expect(sessionLabel({ title: "T", firstInput: "first" })).toEqual({ title: "T" })
  })
})

describe("workdir labels", () => {
  it("keeps the leaf whole and puts the rest on the parent line", () => {
    expect(splitPath("/Users/me/codes/hubs/auto-chat")).toEqual({
      parent: "/Users/me/codes/hubs/",
      leaf: "auto-chat",
    })
  })

  it("handles a bare name and an empty path", () => {
    expect(splitPath("auto-chat")).toEqual({ parent: "", leaf: "auto-chat" })
    expect(splitPath("")).toEqual({ parent: "", leaf: "" })
    expect(splitPath("/trailing/slash/")).toEqual({ parent: "/trailing/", leaf: "slash" })
  })
})

describe("compaction folding", () => {
  it("collapses every boundary of a turn into exactly one row", () => {
    const rows = buildTurnRows([turn(1, [point(1), point(2), point(3), point(4)]), turn(2, [])])
    expect(rows.map((row) => row.kind)).toEqual(["compactions", "turn", "turn"])
    const first = rows[0]
    expect(first?.kind === "compactions" ? first.points.length : 0).toBe(4)
  })

  it("omits the row entirely for turns without compactions", () => {
    const rows = buildTurnRows([turn(1, []), turn(2, [point(9)])])
    expect(rows.map((row) => row.key)).toEqual(["t-1", "c-2", "t-2"])
  })
})
