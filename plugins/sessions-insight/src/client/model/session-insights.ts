import type { Turn } from "@cyrusdoyle/dsh-session-contract"

import type { CostValue } from "../../protocol.ts"
import type { SessionInsights } from "../../protocol/insights.ts"
import { insightsOfSession } from "../../shared/session-insights.ts"

export type OverviewReport = Omit<SessionInsights, "skills">
export interface OverviewState {
  report: SessionInsights
  source: "host" | "client-complete" | "client-partial"
  usageSource: "turns" | "cost"
  loadedTurns: number
  totalTurns: number
}

const BUCKETS = ["input", "cacheRead", "cacheWrite", "output"] as const

/** Adapt the shared calculator to loaded pages without claiming complete coverage. */
export function sessionOverviewState({
  insights,
  turns,
  turnCount,
  cost = null,
  workdir = "",
}: {
  insights?: SessionInsights
  turns: readonly Turn[]
  turnCount: number
  cost?: CostValue | null
  workdir?: string
}): OverviewState {
  const base = { loadedTurns: turns.length, totalTurns: turnCount }
  if (insights !== undefined) return { ...base, report: insights, source: "host", usageSource: "turns" }
  const report = insightsOfSession({
    id: "",
    source: "claude",
    workdir,
    createdAt: 0,
    updatedAt: 0,
    turns: [...turns].sort((a, b) => a.index - b.index),
    segments: [],
    dataQuality: [],
  })
  const costUsage =
    cost !== null &&
    cost.turns.length === turnCount &&
    turnCount > 0 &&
    BUCKETS.every((key) => Number.isFinite(cost.totals[key]) && cost.totals[key] >= 0)
  if (costUsage) {
    for (const key of BUCKETS) report.usage[key] = cost.totals[key]
  }
  return {
    ...base,
    source: turns.length === turnCount ? "client-complete" : "client-partial",
    usageSource: costUsage ? "cost" : "turns",
    report,
  }
}
