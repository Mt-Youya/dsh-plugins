import type { CostValue, SessionDetail, Turn } from "@cyrusdoyle/dsh-session-contract"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { sessionOverviewState } from "../src/client/model/session-insights.ts"
import { SessionOverview } from "../src/client/ui/session/session-overview.tsx"
import { SessionPane } from "../src/client/ui/session/session-pane.tsx"

function turn(index: number): Turn {
  return {
    index,
    startedAt: index * 1000,
    endedAt: index * 1000 + 500,
    userInput: ["question"],
    assistantText: [`answer ${index}`],
    compactions: [],
    subagents: [],
    toolCalls: [],
    attribution: { total: { tokens: 22000, precision: "exact", basis: "usage" }, parts: [], windowSize: 200000 },
    usage: { input: 100, cacheRead: 200, cacheWrite: 0, output: 50, totalContext: 300 },
  }
}

function pane(turns: Turn[], turnCount = turns.length, loadingMore = false): string {
  const data: SessionDetail = {
    session: {
      id: "old-host",
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
  return renderToStaticMarkup(
    createElement(SessionPane, {
      session: { data, turns, loadingMore },
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
}

describe("client overview projection", () => {
  it("keeps a supplied host report authoritative even with only one loaded turn", () => {
    const fallback = sessionOverviewState({ turns: [turn(1)], turnCount: 1 }).report
    const host = { ...fallback, turnCount: 65, toolCalls: 123, skills: [] }
    const state = sessionOverviewState({ insights: host, turns: [turn(1)], turnCount: 65 })
    expect(state.source).toBe("host")
    expect(state.report).toBe(host)
    const html = renderToStaticMarkup(createElement(SessionOverview, { overview: state }))
    expect(html).not.toContain("Host did not return insights")
    expect(html).not.toContain("Loaded context")
  })

  it("uses full cost usage without pretending loaded context or usage coverage is complete", () => {
    const cost: CostValue = {
      source: "claude",
      sessionId: "old-host",
      pricing: { version: "v", asOf: "today", currency: "USD" },
      totals: {
        usd: 1,
        pricedTurns: 65,
        unpricedTurns: 0,
        input: 10000,
        cacheRead: 20000,
        cacheWrite: 30000,
        output: 40000,
        cacheHitRate: null,
      },
      turns: Array.from({ length: 65 }, (_, i) => ({ index: i + 1, priced: true, usd: 0, cacheHitRate: null })),
      unpricedModels: [],
      provisionalModels: [],
      provisional: false,
      note: "",
    }
    const state = sessionOverviewState({ turns: [turn(1)], turnCount: 65, cost })
    expect(state.source).toBe("client-partial")
    expect(state.usageSource).toBe("cost")
    expect(state.report.usage.input).toBe(10000)
    expect(state.report.usage.coveredTurns).toBe(1)
    expect(state.report.turnCount).toBe(1)
    const html = renderToStaticMarkup(createElement(SessionOverview, { overview: state }))
    expect(html).toContain(">100k</strong>")
    expect(html).toContain("coverage refers only to loaded turns")
  })

  it("retains null for absent records and picks actual current and peak from ordered turns", () => {
    const first = turn(1)
    first.attribution.total.tokens = 50000
    const last = turn(3)
    last.attribution.total.tokens = 0
    last.startedAt = 0
    delete last.endedAt
    delete last.usage
    const input = [last, turn(2), first]
    const state = sessionOverviewState({ turns: input, turnCount: 3 })
    expect(input.map((item) => item.index)).toEqual([3, 2, 1])
    expect(state.report.currentAttribution?.turnIndex).toBe(2)
    expect(state.report.peak?.turnIndex).toBe(1)
    expect(state.report.usage).toMatchObject({ input: 200, coveredTurns: 2, missingTurns: 1 })
    const missing = sessionOverviewState({ turns: [last], turnCount: 1 }).report
    expect(missing.currentAttribution).toBeNull()
    expect(missing.usage.input).toBeNull()
    expect(missing.timing.spanMs).toBeNull()
  })

  it("merges recorded parallel tool intervals and does not invent model timing", () => {
    const source = turn(1)
    const tool: Turn["toolCalls"][number] = {
      id: "a",
      name: "Read",
      input: {},
      output: "",
      status: "ok",
      startedAt: 1100,
      endedAt: 1300,
    }
    source.toolCalls = [tool, { ...tool, id: "b", startedAt: 1200, endedAt: 1400 }, tool]
    const report = sessionOverviewState({ turns: [source], turnCount: 1 }).report
    expect(report.toolCalls).toBe(2)
    expect(report.timing.toolUnionMs).toBe(300)
    expect(report.timing.completedTurnMs).toBe(500)
    expect(report).not.toHaveProperty("llmMs")
  })
})

describe("old-host overview", () => {
  it("renders actual context and usage for a fully loaded one-turn response without insights", () => {
    const html = pane([turn(1)])
    expect(html).toContain("Cumulative token usage")
    expect(html).toContain(">22k</strong>")
    expect(html).toContain(">350</strong>")
    expect(html).toContain("answer 1")
    expect(html).toContain("Host did not return insights")
    expect(html).toContain('role="tablist"')
    expect(html).toContain('tabindex="-1"')
  })

  it("labels a first page as partial and offers loading without claiming it is full-session context", () => {
    const html = pane(
      Array.from({ length: 40 }, (_, i) => turn(i + 1)),
      65,
    )
    expect(html).toContain("Loaded 40 / 65 turns")
    expect(html).toContain("full-session statistics await a Host update")
    expect(html).toContain("Loaded context")
    expect(html).toContain("Latest loaded message")
    expect(html).toContain("Load more")
    expect(html).not.toContain("Last valid attribution:")
  })

  it("keeps the load-more action disabled while loading", () => {
    expect(pane([turn(1)], 65, true)).toContain('disabled=""')
  })
})
