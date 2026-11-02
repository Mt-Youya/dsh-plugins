import { isAttribution, isMeasure, isSessionDetail } from "@cyrusdoyle/dsh-session-contract"
import type { Attribution, Measure, SessionDetail } from "@cyrusdoyle/dsh-session-contract"

/** Maximum excerpt length before the optional trailing ellipsis. */
export const INSIGHT_MESSAGE_LIMIT = 500

export type InsightSessionDetail = SessionDetail & { insights?: SessionInsights }

export function isInsightSessionDetail(value: unknown): value is InsightSessionDetail {
  return isSessionDetail(value) && (!("insights" in value) || isSessionInsights(value.insights))
}

/** A complete-session report; null means unknown, never a synthetic zero. */
export interface SessionInsights {
  turnCount: number
  toolCalls: number
  compactions: number
  currentAttribution: InsightAttribution | null
  peak: { turnIndex: number; measure: Measure } | null
  usage: InsightUsage
  lastMessage: InsightMessage | null
  timing: InsightTiming
  skills: SkillInsight[]
}

export interface InsightAttribution {
  turnIndex: number
  attribution: Attribution
}

/** Billing buckets only, not the sum of context attribution slices. */
export interface InsightUsage {
  input: number | null
  cacheRead: number | null
  cacheWrite: number | null
  output: number | null
  coveredTurns: number
  missingTurns: number
}

export interface InsightMessage {
  role: "user" | "assistant"
  /** Bounded excerpt, not the full message body. */
  text: string
  turnIndex: number
  time?: number
}

export interface InsightTiming {
  /** Elapsed wall-clock span from recorded IR event timestamps, not file mtime. */
  spanMs: number | null
  startedAt?: number
  endedAt?: number
  /** Sum of completed turn intervals; overlapping turns can overlap this sum. */
  completedTurnMs: number | null
  completedTurns: number
  missingTurnDurations: number
  /** Union of recorded tool intervals across the session, not their sum. */
  toolUnionMs: number | null
  timedToolCalls: number
  missingToolDurations: number
}

export type SkillEvidenceKind = "skill-tool" | "skill-file" | "skill-reference" | "skill-injection"

export interface SkillEvidence {
  turnIndex: number
  /** Real tool id, or event:<kind>:<turn>:<ordinal> for non-tool evidence. */
  toolCallId: string
  kind: SkillEvidenceKind
  name: string
  path?: string
  time?: number
}

export interface SkillInsight {
  /** Path identity when known; a bare name is kept distinct from all paths. */
  id: string
  name: string
  path?: string
  count: number
  lastTurnIndex: number
  lastTime?: number
  evidence: SkillEvidence[]
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function number(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function count(value: unknown): value is number {
  return number(value) && Number.isInteger(value)
}

function index(value: unknown): value is number {
  return count(value) && value > 0
}

function optionalTime(value: unknown): boolean {
  return value === undefined || (number(value) && value > 0)
}

function optionalPath(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.length > 0)
}

function nullableNumber(value: unknown): boolean {
  return value === null || number(value)
}

export function isSkillEvidence(value: unknown): value is SkillEvidence {
  return (
    record(value) &&
    index(value.turnIndex) &&
    typeof value.toolCallId === "string" &&
    value.toolCallId.length > 0 &&
    (value.kind === "skill-tool" ||
      value.kind === "skill-file" ||
      ((value.kind === "skill-reference" || value.kind === "skill-injection") &&
        new RegExp(`^event:${value.kind}:${value.turnIndex}:[1-9][0-9]*$`).test(value.toolCallId) &&
        typeof value.path === "string" &&
        value.path.endsWith("/SKILL.md") &&
        !/[\r\n\0]/.test(value.path) &&
        (!/^[a-z][\w+.-]*:/i.test(value.path) || /^[A-Za-z]:\//.test(value.path)) &&
        value.path.split("/").at(-2) === value.name)) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    optionalPath(value.path) &&
    optionalTime(value.time)
  )
}

export function isSkillInsight(value: unknown): value is SkillInsight {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.name !== "string" ||
    value.name.length === 0 ||
    !optionalPath(value.path) ||
    !index(value.count) ||
    !index(value.lastTurnIndex) ||
    !optionalTime(value.lastTime) ||
    !Array.isArray(value.evidence) ||
    !value.evidence.every(isSkillEvidence)
  )
    return false
  const lastTurnIndex = value.evidence.reduce((last, item) => Math.max(last, item.turnIndex), 0)
  const lastTime = value.evidence.reduce<number | undefined>(
    (last, item) => (item.time === undefined ? last : Math.max(last ?? item.time, item.time)),
    undefined,
  )
  return (
    value.id === (value.path === undefined ? `name:${value.name}` : `path:${value.path}`) &&
    value.count === value.evidence.length &&
    value.evidence.every((item) => item.name === value.name && item.path === value.path) &&
    value.lastTurnIndex === lastTurnIndex &&
    value.lastTime === lastTime &&
    new Set(value.evidence.map((item) => item.toolCallId)).size === value.count
  )
}

export function isInsightUsage(value: unknown): value is InsightUsage {
  if (!record(value) || !count(value.coveredTurns) || !count(value.missingTurns)) return false
  const buckets = [value.input, value.cacheRead, value.cacheWrite, value.output]
  return value.coveredTurns === 0 ? buckets.every((item) => item === null) : buckets.every(number)
}

export function isInsightTiming(value: unknown): value is InsightTiming {
  if (!record(value)) return false
  return (
    nullableNumber(value.spanMs) &&
    optionalTime(value.startedAt) &&
    optionalTime(value.endedAt) &&
    nullableNumber(value.completedTurnMs) &&
    count(value.completedTurns) &&
    count(value.missingTurnDurations) &&
    nullableNumber(value.toolUnionMs) &&
    count(value.timedToolCalls) &&
    count(value.missingToolDurations) &&
    (value.completedTurns === 0 ? value.completedTurnMs === null : number(value.completedTurnMs)) &&
    (value.timedToolCalls === 0 ? value.toolUnionMs === null : number(value.toolUnionMs)) &&
    (value.spanMs === null
      ? value.startedAt === undefined && value.endedAt === undefined
      : number(value.startedAt) && number(value.endedAt) && value.endedAt - value.startedAt === value.spanMs)
  )
}

export function isInsightMessage(value: unknown): value is InsightMessage {
  return (
    record(value) &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.text === "string" &&
    value.text.trim().length > 0 &&
    (value.text.length <= INSIGHT_MESSAGE_LIMIT ||
      (value.text.length === INSIGHT_MESSAGE_LIMIT + 1 && value.text.endsWith("…"))) &&
    index(value.turnIndex) &&
    optionalTime(value.time)
  )
}

export function isInsightAttribution(value: unknown): value is InsightAttribution {
  return (
    record(value) && index(value.turnIndex) && isAttribution(value.attribution) && value.attribution.total.tokens > 0
  )
}

function isInsightPeak(value: unknown): value is NonNullable<SessionInsights["peak"]> {
  return record(value) && index(value.turnIndex) && isMeasure(value.measure) && value.measure.tokens > 0
}

export function isSessionInsights(value: unknown): value is SessionInsights {
  if (!record(value) || !count(value.turnCount) || !count(value.toolCalls) || !count(value.compactions)) return false
  if (value.currentAttribution !== null && !isInsightAttribution(value.currentAttribution)) return false
  if (value.peak !== null && !isInsightPeak(value.peak)) return false
  if (
    !isInsightUsage(value.usage) ||
    !isInsightTiming(value.timing) ||
    (value.lastMessage !== null && !isInsightMessage(value.lastMessage)) ||
    !Array.isArray(value.skills) ||
    !value.skills.every(isSkillInsight)
  )
    return false
  const { turnCount, timing } = value
  const inRange = (turnIndex: number): boolean => turnIndex <= turnCount
  const inSpan = (time: number | undefined): boolean =>
    time === undefined || (timing.spanMs !== null && time >= timing.startedAt! && time <= timing.endedAt!)
  const evidence = value.skills.flatMap((skill) => skill.evidence)
  return (
    (value.currentAttribution === null
      ? value.peak === null
      : value.peak !== null &&
        inRange(value.currentAttribution.turnIndex) &&
        value.peak.turnIndex <= value.currentAttribution.turnIndex &&
        value.peak.measure.tokens >= value.currentAttribution.attribution.total.tokens) &&
    (value.peak === null || inRange(value.peak.turnIndex)) &&
    (value.lastMessage === null || (inRange(value.lastMessage.turnIndex) && inSpan(value.lastMessage.time))) &&
    evidence.every((item) => inRange(item.turnIndex) && inSpan(item.time)) &&
    new Set(evidence.map((item) => item.toolCallId)).size === evidence.length &&
    evidence.filter((item) => item.kind === "skill-tool" || item.kind === "skill-file").length <= value.toolCalls &&
    (value.timing.toolUnionMs === null ||
      (value.timing.spanMs !== null && value.timing.toolUnionMs <= value.timing.spanMs)) &&
    value.usage.coveredTurns + value.usage.missingTurns === value.turnCount &&
    value.timing.completedTurns + value.timing.missingTurnDurations === value.turnCount &&
    value.timing.timedToolCalls + value.timing.missingToolDurations === value.toolCalls &&
    new Set(value.skills.map((skill) => skill.id)).size === value.skills.length
  )
}
