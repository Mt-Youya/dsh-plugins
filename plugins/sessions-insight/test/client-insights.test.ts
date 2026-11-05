import type { Session, SessionDetail, Turn } from "@cyrusdoyle/dsh-session-contract"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { fillParams, setRuntimeTranslate, zh } from "../src/client/locale/index.ts"
import { INSIGHT_EN, INSIGHT_ZH, insightLabel } from "../src/client/locale/insights.ts"
import { SessionHead } from "../src/client/ui/session/session-head.tsx"
import { SessionOverview } from "../src/client/ui/session/session-overview.tsx"
import { SessionPane } from "../src/client/ui/session/session-pane.tsx"
import { SkillUsage, visibleSkills } from "../src/client/ui/session/skill-usage.tsx"
import { insightsOfSession } from "../src/host/views/insights.ts"
import type { SkillInsight } from "../src/protocol/insights.ts"

function turn(index: number): Turn {
  return {
    index,
    startedAt: index * 1000,
    endedAt: index * 1000 + 500,
    userInput: ["question"],
    assistantText: ["answer"],
    compactions: [],
    subagents: [],
    toolCalls: [],
    attribution: { total: { tokens: index * 1000, precision: "exact", basis: "usage" }, parts: [] },
  }
}

function detail(turns: Turn[], turnCount = turns.length): SessionDetail {
  return {
    session: {
      id: "s",
      source: "claude",
      workdir: "/work",
      createdAt: 1000,
      updatedAt: 2000,
      turns,
      dataQuality: [],
      segments: [],
    },
    turnCount,
    offset: 0,
    limit: 40,
    meta: { cached: false, elapsedMs: 0, bytes: 1, residualTurns: 0, reconciledTurns: 0 },
  }
}

function full(turns: Turn[]): Session {
  return { ...detail(turns).session, segments: [] }
}

function skill(id: string, name: string, count: number, lastTurnIndex: number, path?: string): SkillInsight {
  return { id, name, count, lastTurnIndex, evidence: [], ...(path === undefined ? {} : { path }) }
}

describe("insight labels", () => {
  it("exports matching bilingual keys with the insights prefix", () => {
    expect(Object.keys(INSIGHT_EN).sort()).toEqual(Object.keys(INSIGHT_ZH).sort())
    expect(Object.keys(INSIGHT_ZH).every((key) => key.startsWith("insights."))).toBe(true)
    expect(insightLabel("insights.jump", { index: 41 })).toBe("Go to turn 41")
  })

  it("falls back safely before the preview dictionary is merged and follows the runtime language", () => {
    setRuntimeTranslate((key, params) => fillParams(zh[key as keyof typeof zh], params))
    try {
      expect(insightLabel("insights.jump", { index: 41 })).toBe("定位第 41 轮")
    } finally {
      setRuntimeTranslate(() => "")
    }
  })
})

describe("overview and header", () => {
  it("defaults the pane to the overview even when an initial turn is selected", () => {
    const turns = [turn(1)]
    const html = renderToStaticMarkup(
      createElement(SessionPane, {
        session: { data: { ...detail(turns), insights: insightsOfSession(full(turns)) }, turns, loadingMore: false },
        title: "Session",
        cost: null,
        costs: undefined,
        selectedTurn: 1,
        onSelectTurn() {},
        toolsExpanded: false,
        onToggleTools() {},
        onLoadMore() {},
        onHandoff() {},
      }),
    )
    expect(html).toContain('role="tablist"')
    expect(html).toContain('role="tabpanel"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain("Cumulative token usage")
    expect(html).not.toContain("ci-ask__text")
  })

  it("uses the full report, not the last loaded page turn", () => {
    const turns = Array.from({ length: 65 }, (_, index) => turn(index + 1))
    const data = { ...detail(turns.slice(0, 40), 65), insights: insightsOfSession(full(turns)) }
    const html = renderToStaticMarkup(
      createElement(SessionHead, { data, turns: turns.slice(0, 40), cost: null, onHandoff() {} }),
    )
    expect(html).toContain(">65k</span>")
    expect(html).not.toContain(">40k</span>")
    expect(html).toContain("0 compactions · 0 tool calls")
  })

  it("marks partial-page statistics unknown when no full report was supplied", () => {
    const turns = [turn(1)]
    const html = renderToStaticMarkup(
      createElement(SessionHead, { data: detail(turns, 65), turns, cost: null, onHandoff() {} }),
    )
    expect(html).toContain("Not recorded · unknown")
    expect(html).not.toContain(">1.0k</span>")
  })

  it("does not turn absent usage, timestamps and attribution into numeric charts", () => {
    const source = turn(1)
    source.startedAt = 0
    delete source.endedAt
    source.attribution.total.tokens = 0
    const html = renderToStaticMarkup(createElement(SessionOverview, { insights: insightsOfSession(full([source])) }))
    expect(html).toContain("Not recorded · unknown")
    expect(html).toContain("0 turns with usage · 1 not recorded (unknown)")
    expect(html).not.toContain("stroke-dasharray")
    expect(html).not.toContain("data-part=")
    expect(html).toContain("does not represent model thinking")
  })

  it("renders a recorded tiny share as 0.0%, not as an unknown window", () => {
    const source = turn(1)
    source.attribution.total.tokens = 1
    source.attribution.windowSize = 200000
    const html = renderToStaticMarkup(createElement(SessionOverview, { insights: insightsOfSession(full([source])) }))
    expect(html).toContain("0.0%")
    expect(html).not.toContain("Window not recorded · share unknown")
    expect(html).not.toContain("NaN")
  })

  it("preserves the explicit unknown context slice and separates usage from context", () => {
    const source = turn(1)
    source.attribution.parts = [
      { part: "history", measure: { tokens: 800, precision: "estimate", basis: "chars-per-token" } },
    ]
    source.attribution.residual = { tokens: 200, precision: "estimate", basis: "unattributed" }
    source.usage = { input: 10, cacheRead: 20, cacheWrite: 30, output: 40, totalContext: 60 }
    const html = renderToStaticMarkup(createElement(SessionOverview, { insights: insightsOfSession(full([source])) }))
    expect(html).toContain('data-part="unknown"')
    expect(html).toContain("Cumulative billing usage, not the sum of context slices")
    expect(html).toContain("Window not recorded · share unknown")
    expect(html).toContain("stroke-dasharray")
    expect(html).toContain("repeat(auto-fit,minmax(min(100%,19rem),1fr))")
  })
})

describe("skill usage", () => {
  const skills = [skill("name:a", "a", 5, 1), skill("path:b", "b", 2, 65, "/skills/b/SKILL.md")]
  it("filters name and path, sorts without mutating report order", () => {
    expect(visibleSkills(skills, "", "recent").map((item) => item.name)).toEqual(["b", "a"])
    expect(visibleSkills(skills, "", "count").map((item) => item.name)).toEqual(["a", "b"])
    expect(visibleSkills(skills, "SKILL.md", "count").map((item) => item.name)).toEqual(["b"])
    expect(visibleSkills(skills, " A ", "count").map((item) => item.name)).toEqual(["a"])
    expect(skills.map((item) => item.name)).toEqual(["a", "b"])
  })

  it("renders accessible search, sort and disabled navigation without a jump callback", () => {
    const html = renderToStaticMarkup(createElement(SkillUsage, { skills }))
    expect(html).toContain('type="search"')
    expect(html).toContain("Sort skills")
    expect(html).toContain('role="combobox"')
    expect(html).toContain('data-slot="select-trigger"')
    expect(html).not.toMatch(/<select[^>]*class=/)
    expect(html).toContain("Go to turn 65")
    expect(html).toContain('disabled=""')
    expect(html).toContain("not an available-skills list")
    expect(renderToStaticMarkup(createElement(SkillUsage, {}))).toContain("Not recorded · unknown")
  })
})
