import { describe, expect, it } from "vitest"

import {
  buildProjects,
  DEFAULT_SESSION_LIMIT,
  filterProjectsBySources,
  filterSessionsBySources,
  flattenTree,
  nextIndex,
  readExpanded,
  sessionKey,
  toggleSourceFilter,
  type TreeSession,
  writeExpanded,
} from "../src/client/model/tree.ts"
import type { ContextSource, WorkdirEntry } from "../src/protocol.ts"

function split(path: string) {
  const index = path.lastIndexOf("/")
  return index <= 0 ? { parent: "", leaf: path } : { parent: path.slice(0, index + 1), leaf: path.slice(index + 1) }
}

function workdir(path: string, counts: [ContextSource, number][], at = 1): WorkdirEntry {
  return {
    workdir: path,
    sessions: counts.reduce((sum, [, n]) => sum + n, 0),
    lastUpdatedAt: at,
    sources: counts.map(([source, sessions]) => ({ source, sessions, lastUpdatedAt: at })),
  }
}

function session(source: ContextSource, id: string, workdir: string, at = 1): TreeSession {
  return { source, id, workdir, title: `T-${id}`, updatedAt: at, bytes: 10 }
}

const PROJECTS = buildProjects(
  [
    workdir(
      "/Users/me/postgraduate",
      [
        ["claude", 8],
        ["dsh", 115],
        ["codex", 5],
      ],
      300,
    ),
    workdir("/Users/me/auto-chat", [["claude", 2]], 200),
  ],
  split,
)

function flatten(over: Partial<Parameters<typeof flattenTree>[0]> = {}) {
  return flattenTree({
    projects: PROJECTS,
    sessions: new Map(),
    loading: new Set<string>(),
    expanded: new Set<string>(),
    selected: null,
    limits: new Map(),
    ...over,
  })
}

describe("project rows", () => {
  it("shows one row per project with a bold leaf, a dimmed parent and per-source counts", () => {
    const rows = flatten()
    expect(rows).toHaveLength(2)
    const first = rows[0]
    expect(first?.kind).toBe("project")
    if (first?.kind !== "project") return
    expect(first.project.leaf).toBe("postgraduate")
    expect(first.project.parent).toBe("/Users/me/")
    expect(first.project.counts).toEqual([
      { source: "claude", sessions: 8 },
      { source: "dsh", sessions: 115 },
      { source: "codex", sessions: 5 },
    ])
    expect(first.expanded).toBe(false)
  })
})

describe("folding", () => {
  it("contributes no child rows while collapsed and the full list when expanded", () => {
    const sessions = new Map([
      [
        "/Users/me/auto-chat",
        [session("claude", "a", "/Users/me/auto-chat"), session("dsh", "b", "/Users/me/auto-chat")],
      ],
    ])
    const closed = flatten({ sessions })
    expect(closed.map((row) => row.kind)).toEqual(["project", "project"])

    const open = flatten({ sessions, expanded: new Set(["/Users/me/auto-chat"]) })
    expect(open.map((row) => row.kind)).toEqual(["project", "project", "session", "session"])
    expect(
      open.filter((row) => row.kind === "session").map((row) => (row.kind === "session" ? row.session.id : "")),
    ).toEqual(["a", "b"])
  })

  it("keeps project order stable regardless of which project is expanded", () => {
    const sessions = new Map([
      ["/Users/me/postgraduate", [session("dsh", "p1", "/Users/me/postgraduate")]],
      ["/Users/me/auto-chat", [session("claude", "a1", "/Users/me/auto-chat")]],
    ])
    const rows = flatten({ sessions, expanded: new Set(["/Users/me/postgraduate", "/Users/me/auto-chat"]) })
    expect(
      rows.filter((row) => row.kind === "project").map((row) => (row.kind === "project" ? row.project.workdir : "")),
    ).toEqual(["/Users/me/postgraduate", "/Users/me/auto-chat"])
  })
})

describe("truncation", () => {
  it('renders one page plus a "show all" row, then everything once the limit is raised', () => {
    const many = Array.from({ length: 115 }, (_, index) =>
      session("dsh", `s${String(index)}`, "/Users/me/postgraduate"),
    )
    const sessions = new Map([["/Users/me/postgraduate", many]])
    const page = flatten({ sessions, expanded: new Set(["/Users/me/postgraduate"]) })
    expect(page.filter((row) => row.kind === "session")).toHaveLength(DEFAULT_SESSION_LIMIT)
    const more = page.find((row) => row.kind === "more")
    expect(more?.kind === "more" ? more.hidden : 0).toBe(115 - DEFAULT_SESSION_LIMIT)

    const all = flatten({
      sessions,
      expanded: new Set(["/Users/me/postgraduate"]),
      limits: new Map([["/Users/me/postgraduate", 10_000]]),
    })
    expect(all.filter((row) => row.kind === "session")).toHaveLength(115)
    expect(all.some((row) => row.kind === "more")).toBe(false)
  })

  it("shows a skeleton row group while a project is still loading", () => {
    const rows = flatten({
      expanded: new Set(["/Users/me/auto-chat"]),
      loading: new Set(["/Users/me/auto-chat"]),
    })
    // postgraduate stays collapsed, so only auto-chat contributes a child row.
    expect(rows.map((row) => row.kind)).toEqual(["project", "project", "skeleton"])
  })
})

describe("keyboard mapping", () => {
  const rows = flatten({
    sessions: new Map([["/Users/me/auto-chat", [session("claude", "a", "/Users/me/auto-chat")]]]),
    expanded: new Set(["/Users/me/auto-chat"]),
  })

  it("moves down and up across visible rows and clamps at both ends", () => {
    expect(nextIndex(rows, -1, "ArrowDown")).toBe(0)
    expect(nextIndex(rows, 0, "ArrowDown")).toBe(1)
    expect(nextIndex(rows, rows.length - 1, "ArrowDown")).toBe(rows.length - 1)
    expect(nextIndex(rows, 0, "ArrowUp")).toBe(0)
    expect(nextIndex(rows, 2, "ArrowUp")).toBe(1)
    expect(nextIndex(rows, 1, "Home")).toBe(0)
    expect(nextIndex(rows, 0, "End")).toBe(rows.length - 1)
    expect(nextIndex([], 0, "ArrowDown")).toBe(-1)
  })

  it("maps a selected session to its row index", () => {
    const key = sessionKey("claude", "a")
    const rowsWithSelection = flatten({
      sessions: new Map([["/Users/me/auto-chat", [session("claude", "a", "/Users/me/auto-chat")]]]),
      expanded: new Set(["/Users/me/auto-chat"]),
      selected: key,
    })
    const index = rowsWithSelection.findIndex((row) => row.kind === "session" && row.selected)
    expect(index).toBe(2)
    expect(nextIndex(rowsWithSelection, index, "ArrowUp")).toBe(1)
  })
})

describe("persisted expansion", () => {
  it("round-trips through storage and tolerates junk or a missing store", () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    }
    writeExpanded(storage, ["/a", "/b"])
    expect(readExpanded(storage)).toEqual(["/a", "/b"])

    store.set("dsh-sessions-insight.tree", "{not json")
    expect(readExpanded(storage)).toEqual([])
    store.set("dsh-sessions-insight.tree", JSON.stringify({ nope: true }))
    expect(readExpanded(storage)).toEqual([])
    store.set("dsh-sessions-insight.tree", JSON.stringify(["/a", 7, null]))
    expect(readExpanded(storage)).toEqual(["/a"])
    expect(readExpanded(undefined)).toEqual([])
    expect(() => writeExpanded(undefined, ["/a"])).not.toThrow()
    expect(() =>
      writeExpanded(
        {
          setItem: () => {
            throw new Error("quota")
          },
        },
        ["/a"],
      ),
    ).not.toThrow()
  })
})

describe("source filter", () => {
  const sessions = new Map<string, TreeSession[]>([
    [
      "/Users/me/postgraduate",
      [
        session("claude", "p-c", "/Users/me/postgraduate"),
        session("dsh", "p-d", "/Users/me/postgraduate"),
        session("codex", "p-x", "/Users/me/postgraduate"),
      ],
    ],
    ["/Users/me/auto-chat", [session("claude", "a-c", "/Users/me/auto-chat")]],
  ])

  it("toggles a source in and out, keeping the click order", () => {
    const both = toggleSourceFilter(toggleSourceFilter([], "dsh"), "claude")
    expect(both).toEqual(["dsh", "claude"])
    expect(toggleSourceFilter(both, "dsh")).toEqual(["claude"])
    expect(toggleSourceFilter([], "codex")).toEqual(["codex"])
    expect(toggleSourceFilter(["claude"], "claude")).toEqual([])
  })

  it("keeps only projects with sessions from the selected sources and drops the other counts", () => {
    expect(filterProjectsBySources(PROJECTS, [])).toEqual(PROJECTS)
    const dsh = filterProjectsBySources(PROJECTS, ["dsh"])
    expect(dsh.map((project) => project.workdir)).toEqual(["/Users/me/postgraduate"])
    expect(dsh[0]?.counts).toEqual([{ source: "dsh", sessions: 115 }])

    const claude = filterProjectsBySources(PROJECTS, ["claude"])
    expect(claude.map((project) => project.workdir)).toEqual(["/Users/me/postgraduate", "/Users/me/auto-chat"])
    expect(claude[1]?.counts).toEqual([{ source: "claude", sessions: 2 }])

    const both = filterProjectsBySources(PROJECTS, ["codex", "claude"])
    expect(both.map((project) => project.workdir)).toEqual(["/Users/me/postgraduate", "/Users/me/auto-chat"])
    expect(both[0]?.counts).toEqual([
      { source: "claude", sessions: 8 },
      { source: "codex", sessions: 5 },
    ])
  })

  it("passes sessions through untouched without a filter and narrows them with one", () => {
    expect(filterSessionsBySources(sessions, [])).toBe(sessions)
    const claude = filterSessionsBySources(sessions, ["claude"])
    expect([...claude.keys()]).toEqual(["/Users/me/postgraduate", "/Users/me/auto-chat"])
    expect(claude.get("/Users/me/postgraduate")?.map((row) => row.id)).toEqual(["p-c"])
    expect(claude.get("/Users/me/auto-chat")?.map((row) => row.id)).toEqual(["a-c"])
  })

  it("feeds the flattened tree only the rows of the chosen source", () => {
    const rows = flatten({
      projects: filterProjectsBySources(PROJECTS, ["dsh"]),
      sessions: filterSessionsBySources(sessions, ["dsh"]),
      expanded: new Set(["/Users/me/postgraduate", "/Users/me/auto-chat"]),
      loading: new Set<string>(),
      selected: null,
      limits: new Map(),
    })
    expect(rows.filter((row) => row.kind === "project")).toHaveLength(1)
    expect(
      rows.filter((row) => row.kind === "session").map((row) => (row.kind === "session" ? row.session.id : "")),
    ).toEqual(["p-d"])
  })
})
