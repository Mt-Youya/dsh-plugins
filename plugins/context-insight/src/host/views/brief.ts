/**
 * The handoff brief, extracted from the IR by rules.
 *
 * Six sections, ordered by how hard the receiving model could rebuild them
 * (docs/HANDOFF.md): what the work was, which files it touched, the decisions
 * already made, what is still open, what to do next, and how to verify. The
 * middle two cannot be reconstructed from the repository, which is why they
 * come before "next steps".
 *
 * Nothing here is generated: every line is lifted from a turn's text or a tool
 * call's input. A section with no evidence says 日志中无记录 rather than filling
 * the gap with plausible prose.
 *
 * @module @cyrus/dsh-context-insight/host/brief
 */

import type { Session, ToolCall, Turn } from "@cyrus/dsh-session-contract"

/** Hard cap on the brief, in characters. */
export const BRIEF_LIMIT = 2000

/** What a section says when the transcript held no evidence for it. */
export const NO_RECORD = "日志中无记录"

/** Longest one extracted line may be. */
const LINE_LIMIT = 160

/** One section of the brief. */
export interface BriefSection {
  /** Fixed Chinese heading, e.g. 已改动文件. */
  title: string
  lines: string[]
  /** True when the transcript had nothing to say about this section. */
  empty: boolean
}

/** The brief plus the facts its caller reports. */
export interface BriefResult {
  /** The markdown-ish text that will be sent to the model. */
  text: string
  sections: BriefSection[]
  files: string[]
  decisionCount: number
  openCount: number
  commandCount: number
  chars: number
}

const SECTION_TITLES = ["背景与目标", "已改动文件", "已定决策", "未决与风险", "下一步", "验证命令"] as const

const DECISION = /(决定|决策|采用|选定|结论|定为|已确认|decided|decision|chose|we will use)/i
const OPEN = /(未决|待定|风险|遗留|待确认|尚未|阻塞|TODO|follow-?up|open question|blocked|risk)/i
const NEXT = /(下一步|接下来|后续|next step|next:)/i
const COMMAND_TOOL = /^(bash|exec|shell|terminal|run_command|shell_command)$/i
const VERIFY_COMMAND =
  /(pnpm|npm|yarn|vitest|jest|pytest|go test|cargo test|tsc|eslint|make|build|test|lint|typecheck)/i
const FILE_FIELDS = ["file_path", "path", "notebook_path", "filePath"] as const

function clip(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length <= limit ? flat : flat.slice(0, limit - 1) + "…"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Lines of an assistant message that look like list items or headings. */
function bulletLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && /^([-*+]\s|\d+[.)]\s|#{1,4}\s|>\s)/.test(line))
    .map((line) => clip(line.replace(/^([-*+]\s|\d+[.)]\s|#{1,4}\s|>\s)/, ""), LINE_LIMIT))
}

function collect(texts: readonly string[], pattern: RegExp, limit: number): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const text of texts) {
    for (const line of bulletLines(text)) {
      if (!pattern.test(line)) continue
      const key = line.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(line)
      if (out.length >= limit) return out
    }
  }
  return out
}

function commandOf(call: ToolCall): string | undefined {
  if (!isRecord(call.input)) return undefined
  for (const field of ["command", "cmd", "script"]) {
    const value = call.input[field]
    if (typeof value === "string" && value.trim() !== "") return value.trim()
  }
  return undefined
}

function pathOf(call: ToolCall): string | undefined {
  if (!isRecord(call.input)) return undefined
  for (const field of FILE_FIELDS) {
    const value = call.input[field]
    if (typeof value === "string" && value.trim() !== "") return value.trim()
  }
  return undefined
}

function firstLine(text: string): string {
  return clip(text.split("\n")[0] ?? "", 100)
}

function outputText(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    return value
      .map((entry) => (isRecord(entry) && typeof entry["text"] === "string" ? entry["text"] : ""))
      .filter((part) => part !== "")
      .join("\n")
  }
  if (isRecord(value) && typeof value["text"] === "string") return value["text"]
  return ""
}

function timeRange(turns: readonly Turn[]): string {
  const first = turns[0]?.startedAt
  const lastTurn = turns[turns.length - 1]
  const last = lastTurn?.endedAt ?? lastTurn?.startedAt
  if (first === undefined || last === undefined) return NO_RECORD
  const iso = (value: number): string => new Date(value).toISOString().replace("T", " ").slice(0, 16)
  return `${iso(first)} → ${iso(last)}`
}

/**
 * Extract the six sections from one parsed session.
 * @param session - the source session's IR.
 * @returns the brief and the counts its caller reports.
 */
export function extractBrief(session: Session): BriefResult {
  const assistantTexts = session.turns.flatMap((turn) => turn.assistantText)
  const calls = session.turns.flatMap((turn) => turn.toolCalls)

  const fileCounts = new Map<string, { count: number; tools: Set<string> }>()
  for (const call of calls) {
    const path = pathOf(call)
    if (path === undefined) continue
    const entry = fileCounts.get(path)
    if (entry === undefined) fileCounts.set(path, { count: 1, tools: new Set([call.name]) })
    else {
      entry.count += 1
      entry.tools.add(call.name)
    }
  }
  const files = [...fileCounts.entries()]
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 12)
    .map(([path, meta]) => `${path}（${[...meta.tools].join("/")}，×${String(meta.count)}）`)

  const decisions = collect(assistantTexts, DECISION, 6)
  const errors = calls
    .filter((call) => call.status === "error")
    .slice(0, 3)
    .map((call) => `工具 ${call.name} 报错：${firstLine(outputText(call.output)) || "无输出"}`)
  const openItems = [...errors, ...collect(assistantTexts, OPEN, 6)].slice(0, 6)
  const next = collect(assistantTexts, NEXT, 4)
  const commands: string[] = []
  const seenCommands = new Set<string>()
  for (const call of calls) {
    if (!COMMAND_TOOL.test(call.name)) continue
    const command = commandOf(call)
    if (command === undefined || !VERIFY_COMMAND.test(command)) continue
    const line = firstLine(command)
    if (seenCommands.has(line)) continue
    seenCommands.add(line)
    commands.push(line)
    if (commands.length >= 6) break
  }

  const background: string[] = []
  const title = session.title?.trim()
  if (title !== undefined && title !== "") background.push(`会话标题：${clip(title, LINE_LIMIT)}`)
  const firstInput = session.turns[0]?.userInput[0]
  if (firstInput !== undefined && firstInput.trim() !== "") {
    background.push(`首条输入：${clip(firstInput, LINE_LIMIT)}`)
  }
  background.push(
    `来源：${session.source} · ${session.workdir || "(未知工作目录)"} · ${String(session.turns.length)} 轮`
  )
  background.push(`时间范围：${timeRange(session.turns)}`)
  if (session.dataQuality.length > 0) {
    background.push(`数据质量：${session.dataQuality.slice(0, 3).join(" / ")}`)
  }

  const raw: { title: string; lines: string[] }[] = [
    { title: SECTION_TITLES[0], lines: background },
    { title: SECTION_TITLES[1], lines: files },
    { title: SECTION_TITLES[2], lines: decisions },
    { title: SECTION_TITLES[3], lines: openItems },
    { title: SECTION_TITLES[4], lines: next },
    { title: SECTION_TITLES[5], lines: commands },
  ]

  const sections: BriefSection[] = raw.map((section) => ({
    title: section.title,
    lines: section.lines.length === 0 ? [NO_RECORD] : section.lines,
    empty: section.lines.length === 0,
  }))

  const header = `# 交接简报${title === undefined || title === "" ? "" : "：" + clip(title, 60)}`
  let text = header + "\n"
  sections.forEach((section, index) => {
    text += `\n## ${String(index + 1)}. ${section.title}\n`
    for (const line of section.lines) text += `- ${line}\n`
  })
  if (text.length > BRIEF_LIMIT) {
    const marker = "\n- （已达 2000 字上限，后续内容省略）\n"
    text = text.slice(0, BRIEF_LIMIT - marker.length) + marker
  }

  return {
    text,
    sections,
    files,
    decisionCount: decisions.length,
    openCount: openItems.length,
    commandCount: commands.length,
    chars: text.length,
  }
}
