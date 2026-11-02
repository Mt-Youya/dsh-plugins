import type { ToolCall, Turn } from "@cyrusdoyle/dsh-session-contract"

import type { SkillEvidence, SkillInsight } from "../protocol/insights.ts"

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined
}

/** POSIX/Windows identity normalization without Node APIs (also used by client fallback). */
export function skillPath(value: unknown, workdir: string): { name: string; path: string } | undefined {
  const raw = text(value)?.replaceAll("\\", "/")
  if (
    raw === undefined ||
    !raw.endsWith("/SKILL.md") ||
    /[\n\r\0]/.test(raw) ||
    (/^[a-z][\w+.-]*:/i.test(raw) && !/^[A-Za-z]:\//.test(raw))
  )
    return undefined
  const joined =
    raw.startsWith("/") || /^[A-Za-z]:\//.test(raw) || workdir === "" ? raw : `${workdir.replaceAll("\\", "/")}/${raw}`
  const parts: string[] = []
  for (const part of joined.split("/")) {
    if (part === "" || part === ".") continue
    if (part === ".." && parts.length > 0 && parts.at(-1) !== "..") parts.pop()
    else if (part !== ".." || !joined.startsWith("/")) parts.push(part)
  }
  const name = parts.at(-2)
  if (name === undefined || name === ".." || /^[A-Za-z]:$/.test(name)) return undefined
  return { name, path: `${joined.startsWith("/") ? "/" : ""}${parts.join("/")}` }
}

export function toolSkillEvidence(tool: ToolCall, turnIndex: number, workdir: string): SkillEvidence | undefined {
  if (tool.id === "") return undefined
  const input =
    tool.input !== null && typeof tool.input === "object" && !Array.isArray(tool.input)
      ? (tool.input as Record<string, unknown>)
      : undefined
  const toolName = tool.name.split(/[.:/]/).at(-1)?.toLowerCase()
  const isSkill = toolName === "skill"
  if (!isSkill && !["read", "read_file", "readfile"].includes(toolName ?? "")) return undefined
  const location = skillPath(input?.file_path ?? input?.target_file ?? input?.path, workdir)
  const explicit = text(input?.skill) ?? text(input?.name) ?? (isSkill ? text(tool.input) : undefined)
  const name =
    location?.name ?? (isSkill && explicit !== undefined && /^[\w@./:-]+$/.test(explicit) ? explicit : undefined)
  if (name === undefined || (!isSkill && location === undefined)) return undefined
  return {
    turnIndex,
    toolCallId: tool.id,
    kind: isSkill ? "skill-tool" : "skill-file",
    name,
    ...(location === undefined ? {} : { path: location.path }),
    ...(Number.isFinite(tool.startedAt) && tool.startedAt > 0 ? { time: tool.startedAt } : {}),
  }
}

/** Available catalogs, instructions and code are not usage evidence. */
function userText(value: string): string {
  if (
    /^\s*(?:# AGENTS\.md instructions|# Files (?:mentioned|pasted) by the user|The following is the Codex)/.test(value)
  )
    return ""
  return value
    .replace(
      /<(available_skills|available-skills|skills_instructions|agent_skills|INSTRUCTIONS|user_instructions|environment_context|recommended_plugins|instructions|rules)>[\s\S]*?<\/\1>/g,
      " ",
    )
    .replace(/```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~|`[^`\n]*`/g, " ")
}

/** Stable event nonce in the legacy toolCallId slot; never fabricated as a tool invocation. */
export function turnSkillEvidence(turn: Turn, workdir: string): SkillEvidence[] {
  const found = new Map<string, SkillEvidence>()
  const add = (path: unknown, kind: "skill-reference" | "skill-injection"): void => {
    const location = skillPath(path, workdir)
    if (location === undefined) return
    const key = location.path
    if (found.has(key)) return
    found.set(key, {
      ...location,
      kind,
      turnIndex: turn.index,
      toolCallId: `event:${kind}:${turn.index}:${found.size + 1}`,
      ...(Number.isFinite(turn.startedAt) && turn.startedAt > 0 ? { time: turn.startedAt } : {}),
    })
  }
  const metadata = (turn as Turn & { skillInjections?: { name: string; path: string }[] }).skillInjections
  if (Array.isArray(metadata)) {
    for (const identity of metadata) {
      if (identity !== null && typeof identity === "object" && text(identity.name) !== undefined)
        add(identity.path, "skill-injection")
    }
  }
  for (const raw of turn.userInput) {
    const value = userText(raw)
    for (const block of value.matchAll(
      /<skill>\s*<name>([^<>\r\n]+)<\/name>\s*<path>([^<>\r\n]+)<\/path>[\s\S]*?<\/skill>/g,
    )) {
      if (text(block[1]) !== undefined) add(block[2], "skill-injection")
    }
    const human = value.replace(/<skill>[\s\S]*?<\/skill>/g, " ")
    for (const citation of human.matchAll(/(?<!!)\[[^\]\n]+\]\(\s*(?:<([^<>\r\n]+)>|([^\r\n]*?\/SKILL\.md))\s*\)/g)) {
      try {
        add(decodeURIComponent(citation[1] ?? citation[2]!), "skill-reference")
      } catch {
        /* Invalid encoded path is not an identity. */
      }
    }
  }
  return [...found.values()]
}

/** Shared full/fallback projection. Tool outcomes are de-duplicated by invocation id. */
export function skillsOfTurns(turns: readonly Turn[], workdir: string): SkillInsight[] {
  const skills = new Map<string, SkillInsight>()
  const explicit = turns.flatMap((turn) => turnSkillEvidence(turn, workdir))
  const explicitKeys = new Set(explicit.map((item) => `${item.turnIndex}:${item.path}`))
  const represented = new Set<string>()
  const seenCalls = new Set<string>()
  const add = (evidence: SkillEvidence): void => {
    const id = evidence.path === undefined ? `name:${evidence.name}` : `path:${evidence.path}`
    const key = `${evidence.turnIndex}:${evidence.path}`
    // Preserve legacy tool-only counts; collapse representations of a user-requested load.
    if (explicitKeys.has(key) && represented.has(key)) return
    represented.add(key)
    let skill = skills.get(id)
    if (skill === undefined) {
      skill = {
        id,
        name: evidence.name,
        ...(evidence.path === undefined ? {} : { path: evidence.path }),
        count: 0,
        lastTurnIndex: evidence.turnIndex,
        evidence: [],
      }
      skills.set(id, skill)
    }
    skill.count++
    skill.lastTurnIndex = Math.max(skill.lastTurnIndex, evidence.turnIndex)
    if (evidence.time !== undefined) skill.lastTime = Math.max(skill.lastTime ?? evidence.time, evidence.time)
    skill.evidence.push(evidence)
  }
  for (const turn of turns) {
    for (const tool of turn.toolCalls) {
      if (tool.id === "" || seenCalls.has(tool.id)) continue
      seenCalls.add(tool.id)
      const evidence = toolSkillEvidence(tool, turn.index, workdir)
      if (evidence !== undefined) add(evidence)
    }
  }
  for (const evidence of explicit) add(evidence)
  return [...skills.values()].toSorted((a, b) => b.count - a.count || a.id.localeCompare(b.id))
}
