import { describe, expect, it } from "vitest"
import type { Turn } from "@cyrus/dsh-session-contract"
import { formatShortTime, tildePath } from "../src/client/format.ts"
import { sessionStats } from "../src/client/state/session-stats.ts"
import { filterProjects, type TreeProject } from "../src/client/state/tree.ts"

function turn(index: number, tokens: number, extra: Partial<Turn> = {}): Turn {
  return {
    index,
    startedAt: 0,
    userInput: [],
    toolCalls: [],
    subagents: [],
    compactions: [],
    attribution: {
      total: { tokens, precision: "exact", basis: "usage" },
      parts: [],
      windowSize: 200_000,
    },
    ...extra,
  } as unknown as Turn
}

describe("sessionStats", () => {
  it("reads current from the last turn that reported a total", () => {
    const stats = sessionStats([turn(1, 50_000), turn(2, 150_000), turn(3, 0)])
    expect(stats.current).toBe(150_000)
    expect(stats.windowShare).toBeCloseTo(0.75)
    expect(stats.peak).toBe(150_000)
    expect(stats.peakTurn).toBe(2)
  })

  it("sums compactions and tool calls across loaded turns", () => {
    const stats = sessionStats([
      turn(1, 10, { toolCalls: [{}, {}] as Turn["toolCalls"], compactions: [{}] as Turn["compactions"] }),
      turn(2, 20, { toolCalls: [{}] as Turn["toolCalls"] }),
    ])
    expect(stats.toolCalls).toBe(3)
    expect(stats.compactions).toBe(1)
  })

  it("answers zeros for an empty session", () => {
    expect(sessionStats([])).toEqual({ current: 0, peak: 0, compactions: 0, toolCalls: 0 })
  })
})

describe("filterProjects", () => {
  const projects = [{ workdir: "/Users/me/codes/dsh-plugins" }, { workdir: "/Users/me/portfolio" }] as TreeProject[]

  it("keeps everything for a blank query", () => {
    expect(filterProjects(projects, "  ")).toHaveLength(2)
  })

  it("matches the path case-insensitively", () => {
    expect(filterProjects(projects, "DSH").map((project) => project.workdir)).toEqual(["/Users/me/codes/dsh-plugins"])
  })
})

describe("short labels", () => {
  it("collapses the home directory", () => {
    expect(tildePath("/Users/me/codes/x")).toBe("~/codes/x")
    expect(tildePath("/home/me")).toBe("~")
    expect(tildePath("/opt/tools")).toBe("/opt/tools")
  })

  it("drops the date for today and the time for another year", () => {
    const now = new Date(2026, 9, 21, 18, 0).getTime()
    expect(formatShortTime(new Date(2026, 9, 21, 9, 5).getTime(), now)).toBe("09:05")
    expect(formatShortTime(new Date(2026, 2, 3, 9, 5).getTime(), now)).toBe("03-03 09:05")
    expect(formatShortTime(new Date(2025, 2, 3, 9, 5).getTime(), now)).toBe("2025-03-03")
    expect(formatShortTime(0, now)).toBe("—")
  })
})
