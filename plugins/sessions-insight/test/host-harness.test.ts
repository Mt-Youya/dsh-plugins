/**
 * The harness sources end to end: a temp corpus on disk, the real scan/list/
 * detail path, and the failures that must stay bounded.
 */

import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { describe, expect, it } from "vitest"

import { AntigravityCorpus } from "../src/host/sources/harness/antigravity.ts"
import { ClineCorpus } from "../src/host/sources/harness/cline.ts"
import { CursorCorpus } from "../src/host/sources/harness/cursor.ts"
import { PiCorpus } from "../src/host/sources/harness/pi.ts"
import { harnessRootsFrom } from "../src/host/sources/harness/roots.ts"
import { HarnessSource } from "../src/host/sources/harness/store.ts"
import { VscodeChatCorpus } from "../src/host/sources/harness/vscode.ts"
import { insightsOfSession } from "../src/host/views/insights.ts"

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "harness-host-"))
}

describe("HarnessSource", () => {
  it("reports a missing corpus instead of failing", async () => {
    const root = join(await tempDir(), "nope")
    const source = new HarnessSource({ id: "pi", corpora: [new PiCorpus(root)] })
    const status = await source.status()
    expect(status).toMatchObject({ source: "pi", available: false, reason: "root-missing" })
    await expect(source.list("/work")).resolves.toEqual([])
  })

  it("lists one pi session and parses it on open", async () => {
    const root = await tempDir()
    const dir = join(root, "--work-demo--")
    await mkdir(dir, { recursive: true })
    const path = join(dir, "2026-11-23T09-00-00-000Z_pi-1.jsonl")
    const lines = [
      { type: "session", version: 3, id: "pi-1", timestamp: "2026-11-23T09:00:00.000Z", cwd: "/work/demo" },
      {
        type: "message",
        id: "a",
        parentId: null,
        timestamp: "2026-11-23T09:00:01.000Z",
        message: { role: "user", content: "你好" },
      },
      {
        type: "message",
        id: "b",
        parentId: "a",
        timestamp: "2026-11-23T09:00:02.000Z",
        message: { role: "assistant", content: [{ type: "text", text: "你好！" }] },
      },
    ]
    await writeFile(path, lines.map((line) => JSON.stringify(line)).join("\n"), "utf8")
    const source = new HarnessSource({ id: "pi", corpora: [new PiCorpus(root)] })
    expect(await source.status()).toMatchObject({ source: "pi", available: true, sessions: 1 })
    expect(await source.workdirs()).toEqual([
      {
        workdir: "/work/demo",
        sessions: 1,
        lastUpdatedAt: expect.any(Number),
        sources: [{ source: "pi", sessions: 1, lastUpdatedAt: expect.any(Number) }],
      },
    ])
    const rows = await source.list("/work/demo")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source: "pi",
      id: "pi-1",
      workdir: "/work/demo",
      dataQuality: ["list-item-unparsed"],
    })
    const detail = await source.detail("pi-1")
    expect(detail.ok).toBe(true)
    if (!detail.ok) return
    expect(detail.session.turns).toHaveLength(1)
    expect(detail.session.turns[0]?.assistantText).toEqual(["你好！"])
    // The session-level report must survive a turn with no usage and no model.
    const insights = insightsOfSession(detail.session)
    expect(insights.turnCount).toBe(1)
    expect(insights.usage.missingTurns).toBe(1)
    // Second open is a cache hit keyed by locator + mtime + size.
    const again = await source.detail("pi-1")
    expect(again.ok && again.cached).toBe(true)
    await expect(source.detail("missing")).resolves.toMatchObject({ ok: false, error: "not-found" })
  })

  it("aggregates two VS Code builds behind one badge", async () => {
    const base = await tempDir()
    const hash = "abc123"
    const workspaceDir = join(base, "Code", "User", "workspaceStorage", hash)
    await mkdir(join(workspaceDir, "chatSessions"), { recursive: true })
    await writeFile(join(workspaceDir, "workspace.json"), JSON.stringify({ folder: "file:///work/demo" }), "utf8")
    const snapshot = {
      sessionId: "chat-1",
      requests: [
        { requestId: "r1", timestamp: 1_700_000_000_000, message: { text: "hi" }, response: [{ value: "hello" }] },
      ],
    }
    await writeFile(join(workspaceDir, "chatSessions", "chat-1.json"), JSON.stringify(snapshot), "utf8")
    const kiroDir = join(base, "Kiro", "User", "workspaceStorage", "def456")
    await mkdir(join(kiroDir, "chatSessions"), { recursive: true })
    await writeFile(join(kiroDir, "workspace.json"), JSON.stringify({ folder: "file:///work/other" }), "utf8")
    await writeFile(
      join(kiroDir, "chatSessions", "chat-2.json"),
      JSON.stringify({ sessionId: "chat-2", requests: [] }),
      "utf8",
    )
    const corpus = [
      new VscodeChatCorpus("VS Code", join(base, "Code", "User")),
      new VscodeChatCorpus("Kiro", join(base, "Kiro", "User")),
    ]
    const source = new HarnessSource({ id: "vscode", corpora: corpus })
    const status = await source.status()
    expect(status).toMatchObject({ source: "vscode", available: true, sessions: 2 })
    const rows = await source.list("/work/demo")
    expect(rows.map((row) => row.id)).toEqual(["chat-1"])
    const detail = await source.detail("chat-1")
    expect(detail.ok && detail.session.workdir).toBe("/work/demo")
  })

  it("reads a Cline task directory", async () => {
    const tasksRoot = await tempDir()
    const taskDir = join(tasksRoot, "task-1")
    await mkdir(taskDir, { recursive: true })
    const environment =
      "<environment_details>\n# Current Workspace Directory (/work/cline) Files\na.ts\n</environment_details>"
    await writeFile(
      join(taskDir, "api_conversation_history.json"),
      JSON.stringify([
        {
          role: "user",
          ts: 1_700_000_000_000,
          content: [
            { type: "text", text: "看一下" },
            { type: "text", text: environment },
          ],
        },
        { role: "assistant", ts: 1_700_000_001_000, content: [{ type: "text", text: "好" }] },
      ]),
      "utf8",
    )
    await writeFile(
      join(taskDir, "ui_messages.json"),
      JSON.stringify([
        { ts: 1_700_000_000_000, type: "say", say: "task", text: "看一下" },
        {
          ts: 1_700_000_000_500,
          type: "say",
          say: "api_req_started",
          text: JSON.stringify({ tokensIn: 100, tokensOut: 5 }),
        },
      ]),
      "utf8",
    )
    const source = new HarnessSource({ id: "cline", corpora: [new ClineCorpus("Cline", tasksRoot)] })
    const rows = await source.list("/work/cline")
    expect(rows[0]).toMatchObject({ id: "task-1", title: "看一下" })
    const detail = await source.detail("task-1")
    expect(detail.ok).toBe(true)
    if (!detail.ok) return
    expect(detail.session.turns[0]?.usage).toMatchObject({ input: 100, output: 5, totalContext: 100 })
  })

  it("reads a Cursor composer from its SQLite store", async () => {
    const user = await tempDir()
    const globalStorage = join(user, "globalStorage")
    await mkdir(globalStorage, { recursive: true })
    const db = new DatabaseSync(join(globalStorage, "state.vscdb"))
    db.exec("CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value TEXT)")
    const composer = {
      composerId: "composer-1",
      name: "会话一",
      createdAt: 1_700_000_000_000,
      lastUpdatedAt: 1_700_000_005_000,
      workspaceIdentifier: { uri: { fsPath: "/work/cursor" } },
      fullConversationHeadersOnly: [
        { bubbleId: "b1", type: 1 },
        { bubbleId: "b2", type: 2 },
      ],
    }
    db.prepare("INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)").run(
      "composerData:composer-1",
      JSON.stringify(composer),
    )
    db.prepare("INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)").run(
      "bubbleId:composer-1:b1",
      JSON.stringify({ type: 1, text: "你好" }),
    )
    db.prepare("INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)").run(
      "bubbleId:composer-1:b2",
      JSON.stringify({ type: 2, text: "你好呀" }),
    )
    db.close()
    const source = new HarnessSource({ id: "cursor", corpora: [new CursorCorpus(user)] })
    expect(await source.status()).toMatchObject({ source: "cursor", available: true, sessions: 1 })
    const rows = await source.list("/work/cursor")
    expect(rows[0]).toMatchObject({ id: "composer-1", title: "会话一" })
    const detail = await source.detail("composer-1")
    expect(detail.ok).toBe(true)
    if (!detail.ok) return
    expect(detail.session.turns[0]?.assistantText).toEqual(["你好呀"])
  })

  it("prefers the Antigravity transcript over the step database", async () => {
    const root = await tempDir()
    const db = new DatabaseSync(join(root, "conversation_summaries.db"))
    db.exec(
      "CREATE TABLE conversation_summaries (conversation_id TEXT, title TEXT, preview TEXT, workspace_uris TEXT, last_modified_time TEXT)",
    )
    db.prepare("INSERT INTO conversation_summaries VALUES (?, ?, ?, ?, ?)").run(
      "ag-1",
      "读文件",
      "",
      JSON.stringify(["file:///work/ag"]),
      "2026-11-20 10:00:00.000000+00:00",
    )
    db.close()
    const logs = join(root, "brain", "ag-1", ".system_generated", "logs")
    await mkdir(logs, { recursive: true })
    await writeFile(
      join(logs, "transcript_full.jsonl"),
      [
        {
          step_index: 0,
          source: "USER_EXPLICIT",
          type: "USER_INPUT",
          created_at: "2026-11-20T10:00:00.000Z",
          content: "<USER_REQUEST>\n读 a.txt\n</USER_REQUEST>",
        },
        {
          step_index: 1,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          created_at: "2026-11-20T10:00:01.000Z",
          content: "好",
        },
      ]
        .map((line) => JSON.stringify(line))
        .join("\n"),
      "utf8",
    )
    const source = new HarnessSource({ id: "antigravity", corpora: [new AntigravityCorpus(root)] })
    const rows = await source.list("/work/ag")
    expect(rows[0]).toMatchObject({ id: "ag-1", title: "读文件" })
    const detail = await source.detail("ag-1")
    expect(detail.ok && detail.session.turns[0]?.userInput).toEqual(["读 a.txt"])
  })
})

describe("harnessRootsFrom", () => {
  it("relocates one family without touching the others", () => {
    const roots = harnessRootsFrom({ DSH_CONTEXT_INSIGHT_PI_SESSIONS: "/tmp/pi" }, "darwin")
    expect(roots.piSessions).toBe("/tmp/pi")
    expect(roots.cursorUser.endsWith(join("Cursor", "User"))).toBe(true)
    expect(roots.taskRoots.some((entry) => entry.dir.includes("saoudrizwan.claude-dev"))).toBe(true)
  })
})
