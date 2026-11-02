import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Session, Turn } from "@cyrusdoyle/dsh-session-contract"
import { classifyUserMessage, readCodexSession } from "@cyrusdoyle/dsh-session-readers"
import { describe, expect, it } from "vitest"

import { insightsOfSession } from "../src/host/views/insights.ts"
import { isSessionInsights, isSkillEvidence } from "../src/protocol/insights.ts"
import { skillsOfTurns } from "../src/shared/skill-evidence.ts"

function turn(userInput: string[], index = 1): Turn {
  return {
    index,
    startedAt: index * 1000,
    endedAt: index * 1000 + 900,
    userInput,
    assistantText: [],
    toolCalls: [],
    compactions: [],
    subagents: [],
    attribution: { total: { tokens: 0, precision: "exact", basis: "usage" }, parts: [] },
  }
}

function session(turns: Turn[], source: Session["source"] = "codex"): Session {
  return { id: "s", source, workdir: "/work", createdAt: 1000, updatedAt: 2900, turns, segments: [], dataQuality: [] }
}

const injection =
  "<skill>\n<name>implement</name>\n<path>/skills/implement/SKILL.md</path>\nprivate skill body\n</skill>"

describe("explicit user skill references", () => {
  it("does not extract nested catalog or instruction skills as loaded blocks", () => {
    for (const value of [
      `<available_skills>${injection}</available_skills>`,
      `<INSTRUCTIONS>${injection}</INSTRUCTIONS>`,
      `# AGENTS.md instructions\n${injection}`,
    ]) {
      expect(classifyUserMessage(value).injected.some((block) => block.kind === "skills")).toBe(false)
    }
    expect(classifyUserMessage(injection).injected.map((block) => block.kind)).toEqual(["skills"])
  })

  it.runIf(process.env.SESSION_INSIGHTS_REAL_CODEX_PATH !== undefined)(
    "checks an authorized real Codex rollout without publishing text",
    async () => {
      const result = await readCodexSession(process.env.SESSION_INSIGHTS_REAL_CODEX_PATH!, {
        root: process.env.SESSION_INSIGHTS_REAL_CODEX_ROOT!,
      })
      const report = insightsOfSession(result.session)
      expect(result.session.workdir === process.env.SESSION_INSIGHTS_REAL_WORKDIR).toBe(true)
      expect(isSessionInsights(JSON.parse(JSON.stringify(report)))).toBe(true)
      const expected = process.env.SESSION_INSIGHTS_REAL_SKILL
      if (expected !== undefined) expect(report.skills.some((skill) => skill.name === expected)).toBe(true)
      console.info(
        JSON.stringify({
          id: result.session.id,
          turns: report.turnCount,
          toolCalls: report.toolCalls,
          skills: report.skills.map((skill) => ({
            name: skill.name,
            path: skill.path,
            count: skill.count,
            kinds: [...new Set(skill.evidence.map((item) => item.kind))],
          })),
        }),
      )
    },
  )

  it.each(["codex", "claude", "dsh"] as const)(
    "recognizes markdown citations for %s with spaces, unicode and encoded paths",
    (source) => {
      const report = insightsOfSession(
        session(
          [
            turn([
              "[实现](</技能/My Skill/SKILL.md>) [implement](/skills/implement/SKILL.md)",
              "[实现](/%E6%8A%80%E8%83%BD/My%20Skill/SKILL.md) [relative](skills/实现/SKILL.md)",
            ]),
          ],
          source,
        ),
      )
      expect(report.skills.map((skill) => skill.path).toSorted()).toEqual(
        ["/skills/implement/SKILL.md", "/work/skills/实现/SKILL.md", "/技能/My Skill/SKILL.md"].toSorted(),
      )
      expect(report.skills.every((skill) => skill.count === 1)).toBe(true)
      expect(report.skills.every((skill) => skill.evidence[0]?.kind === "skill-reference")).toBe(true)
      expect(isSessionInsights(JSON.parse(JSON.stringify(report)))).toBe(true)
    },
  )

  it("recognizes raw skill injection identity without inspecting its body or available lists", () => {
    const report = insightsOfSession(session([turn([injection])]))
    expect(report.skills).toMatchObject([
      { name: "implement", path: "/skills/implement/SKILL.md", count: 1, evidence: [{ kind: "skill-injection" }] },
    ])
    expect(JSON.stringify(report.skills)).not.toContain("private skill body")
    expect(isSessionInsights(report)).toBe(true)
    const excluded = turn([
      `<available_skills>[implement](/skills/implement/SKILL.md)${injection}</available_skills>`,
      "<INSTRUCTIONS>[implement](/skills/implement/SKILL.md)</INSTRUCTIONS>",
      "# AGENTS.md instructions\n[implement](/skills/implement/SKILL.md)",
      "`[implement](/skills/implement/SKILL.md)`\n```sh\n$implement\n```",
      "$implement and cat /skills/implement/SKILL.md; available: /skills/implement/SKILL.md",
      "[site](https://example.com/skills/implement/SKILL.md)",
    ])
    expect(insightsOfSession(session([excluded])).skills).toEqual([])
  })

  it("counts reference, injection and structured read once per turn, not once per representation", () => {
    const first = turn(["[implement](/skills/implement/SKILL.md)", injection, injection])
    first.toolCalls = ["read-1", "read-2"].map((id) => ({
      id,
      name: "Read",
      input: { file_path: "/skills/implement/SKILL.md" },
      startedAt: 1100,
      status: "ok",
    }))
    const report = insightsOfSession(session([first, turn([injection], 2)]))
    expect(skillsOfTurns([first, turn([injection], 2)], "/work")).toEqual(report.skills)
    expect(report.toolCalls).toBe(2)
    expect(report.skills).toMatchObject([{ count: 2, lastTurnIndex: 2 }])
    expect(report.skills[0]?.evidence.map((item) => item.kind)).toEqual(["skill-file", "skill-injection"])
    expect(new Set(report.skills[0]?.evidence.map((item) => item.toolCallId)).size).toBe(2)
    expect(isSessionInsights(report)).toBe(true)
  })

  it("requires strict non-tool identities and bounds only tool-backed evidence by toolCalls", () => {
    const report = insightsOfSession(session([turn([injection])]))
    expect(isSessionInsights(report)).toBe(true)
    const evidence = report.skills[0]?.evidence[0]
    expect(evidence).toBeDefined()
    expect(isSkillEvidence({ ...evidence, kind: "skill-injection", toolCallId: "read-1" })).toBe(false)
    expect(isSkillEvidence({ ...evidence, kind: "skill-injection", path: undefined })).toBe(false)
    expect(isSkillEvidence({ ...evidence, kind: "skill-reference", path: "/skills/README.md" })).toBe(false)
    expect(isSkillEvidence({ ...evidence, name: "other" })).toBe(false)
    expect(isSkillEvidence({ ...evidence, path: "https://example.com/implement/SKILL.md" })).toBe(false)
    expect(isSkillEvidence({ ...evidence, kind: "unknown" })).toBe(false)
    const skill = report.skills[0]!
    expect(
      isSessionInsights({
        ...report,
        skills: [{ ...skill, lastTurnIndex: 2, evidence: [{ ...evidence, turnIndex: 2 }] }],
      }),
    ).toBe(false)
  })

  it("preserves only name/path from a stripped Codex skill injection through reader to report", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-skill-"))
    const path = join(root, "rollout.jsonl")
    const records = [
      { type: "session_meta", payload: { id: "s", session_id: "s", cwd: "/work" } },
      { type: "turn_context", payload: { turn_id: "t", cwd: "/work" } },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "$implement" }],
          internal_chat_message_metadata_passthrough: { turn_id: "t" },
        },
      },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: injection }],
          internal_chat_message_metadata_passthrough: { turn_id: "t" },
        },
      },
    ].map((record, ordinal) => ({
      type: record.type,
      payload: record.payload,
      ordinal,
      timestamp: new Date(1000 + ordinal * 100).toISOString(),
    }))
    try {
      await writeFile(path, records.map((record) => JSON.stringify(record)).join("\n"))
      const result = await readCodexSession(path, { root })
      expect(result.session.turns[0]?.userInput).toEqual(["$implement"])
      expect(result.session.turns[0]).toHaveProperty("skillInjections", [
        { name: "implement", path: "/skills/implement/SKILL.md" },
      ])
      expect(JSON.stringify(result.session)).not.toContain("private skill body")
      const report = insightsOfSession(result.session)
      expect(report.skills).toMatchObject([{ name: "implement", count: 1 }])
      expect(isSessionInsights(report)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
