import { isAttribution } from "@cyrusdoyle/dsh-session-contract"
import type { Session, ToolCall, Turn } from "@cyrusdoyle/dsh-session-contract"

import type { SessionInsights } from "../protocol/insights.ts"
import { INSIGHT_MESSAGE_LIMIT } from "../protocol/insights.ts"
import { skillsOfTurns } from "./skill-evidence.ts"

function timestamp(value: number | undefined): value is number {
  // Readers use zero for an absent timestamp. It is not a real recorded interval.
  return value !== undefined && Number.isFinite(value) && value > 0
}

function interval(start: number, end: number | undefined): [number, number] | undefined {
  return timestamp(start) && timestamp(end) && end >= start ? [start, end] : undefined
}

function unionMs(intervals: [number, number][]): number | null {
  if (intervals.length === 0) return null
  intervals.sort((a, b) => a[0] - b[0])
  let total = 0
  let start = intervals[0]![0]
  let end = intervals[0]![1]
  for (const next of intervals.slice(1)) {
    if (next[0] <= end) end = Math.max(end, next[1])
    else {
      total += end - start
      ;[start, end] = next
    }
  }
  return total + end - start
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined
}

function lastText(chunks: readonly string[]): string | undefined {
  for (let i = chunks.length - 1; i >= 0; i--) {
    const value = text(chunks[i])
    if (value !== undefined) return value
  }
  return undefined
}

/** Pure projection of the existing full IR; does not read logs or paginate. */
export function insightsOfSession(session: Session): SessionInsights {
  const report: SessionInsights = {
    turnCount: session.turns.length,
    toolCalls: 0,
    compactions: 0,
    currentAttribution: null,
    peak: null,
    usage: { input: null, cacheRead: null, cacheWrite: null, output: null, coveredTurns: 0, missingTurns: 0 },
    lastMessage: null,
    timing: {
      spanMs: null,
      completedTurnMs: null,
      completedTurns: 0,
      missingTurnDurations: 0,
      toolUnionMs: null,
      timedToolCalls: 0,
      missingToolDurations: 0,
    },
    skills: [],
  }
  let first: number | undefined
  let last: number | undefined
  const observe = (at: number | undefined): void => {
    if (!timestamp(at)) return
    first = first === undefined ? at : Math.min(first, at)
    last = last === undefined ? at : Math.max(last, at)
  }
  const calls = new Map<string, { tool: ToolCall; turn: Turn }>()
  for (const turn of session.turns) {
    observe(turn.startedAt)
    observe(turn.endedAt)
    const duration = interval(turn.startedAt, turn.endedAt)
    if (duration === undefined) report.timing.missingTurnDurations++
    else {
      report.timing.completedTurns++
      report.timing.completedTurnMs = (report.timing.completedTurnMs ?? 0) + duration[1] - duration[0]
    }
    const attribution = turn.attribution
    if (isAttribution(attribution) && attribution.total.tokens > 0) {
      if (report.currentAttribution === null || turn.index > report.currentAttribution.turnIndex) {
        report.currentAttribution = { turnIndex: turn.index, attribution }
      }
      if (report.peak === null || attribution.total.tokens > report.peak.measure.tokens) {
        report.peak = { turnIndex: turn.index, measure: attribution.total }
      }
    }
    report.compactions += turn.compactions.length
    for (const point of turn.compactions) observe(point.at)
    const usage = turn.usage
    if (
      usage === undefined ||
      ![usage.input, usage.cacheRead, usage.cacheWrite, usage.output].every(
        (value) => Number.isFinite(value) && value >= 0,
      )
    )
      report.usage.missingTurns++
    else {
      report.usage.coveredTurns++
      for (const key of ["input", "cacheRead", "cacheWrite", "output"] as const) {
        report.usage[key] = (report.usage[key] ?? 0) + usage[key]
      }
    }
    const assistant = lastText(turn.assistantText)
    const user = lastText(turn.userInput)
    if (
      (assistant !== undefined || user !== undefined) &&
      (report.lastMessage === null || turn.index >= report.lastMessage.turnIndex)
    ) {
      const time = assistant === undefined ? turn.startedAt : turn.endedAt
      const message = assistant ?? user!
      report.lastMessage = {
        role: assistant === undefined ? "user" : "assistant",
        text: message.length > INSIGHT_MESSAGE_LIMIT ? `${message.slice(0, INSIGHT_MESSAGE_LIMIT)}…` : message,
        turnIndex: turn.index,
        ...(timestamp(time) ? { time } : {}),
      }
    }
    turn.toolCalls.forEach((tool, ordinal) => {
      observe(tool.startedAt)
      observe(tool.endedAt)
      const key = tool.id === "" ? `anonymous:${turn.index}:${ordinal}` : `id:${tool.id}`
      const prior = calls.get(key)
      // A repeated outcome can complete an existing invocation, but cannot count it twice.
      if (prior === undefined) calls.set(key, { tool, turn })
      else if (
        interval(prior.tool.startedAt, prior.tool.endedAt) === undefined &&
        interval(tool.startedAt, tool.endedAt) !== undefined
      ) {
        calls.set(key, { tool: { ...prior.tool, endedAt: tool.endedAt }, turn: prior.turn })
      }
    })
  }
  const intervals: [number, number][] = []
  report.toolCalls = calls.size
  for (const { tool } of calls.values()) {
    const duration = interval(tool.startedAt, tool.endedAt)
    if (duration === undefined) report.timing.missingToolDurations++
    else {
      intervals.push(duration)
      report.timing.timedToolCalls++
    }
  }
  report.skills = skillsOfTurns(session.turns, session.workdir)
  report.timing.toolUnionMs = unionMs(intervals)
  if (first !== undefined && last !== undefined) {
    report.timing.startedAt = first
    report.timing.endedAt = last
    report.timing.spanMs = last - first
  }
  return report
}
