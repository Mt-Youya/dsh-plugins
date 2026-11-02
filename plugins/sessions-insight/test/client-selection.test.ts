import { describe, expect, it } from "vitest"

import {
  emptySelection,
  removeSelection,
  selectedSessions,
  selectSessions,
  toggleSelection,
  visibleSessions,
} from "../src/client/state/selection.ts"
import { buildProjects, flattenTree, sessionKey, type TreeSession } from "../src/client/state/tree.ts"

function session(id: string, workdir = "/a", source: TreeSession["source"] = "claude"): TreeSession {
  return { id, source, workdir, title: id, bytes: 1, updatedAt: 1 }
}
const list = [session("a"), session("b"), session("c", "/b"), session("d", "/b")]
const key = (item: TreeSession) => sessionKey(item.source, item.id)

describe("session selection", () => {
  it("toggles without mutating its input and distinguishes sources", () => {
    const initial = emptySelection()
    const sameId = [session("a"), session("a", "/a", "codex")]
    let selected = toggleSelection(initial, key(sameId[0]!), sameId)
    selected = toggleSelection(selected, key(sameId[1]!), sameId)
    expect(initial.keys.size).toBe(0)
    expect(selected.keys.size).toBe(2)
    expect(toggleSelection(selected, key(sameId[0]!), sameId).keys.size).toBe(1)
  })

  it("selects a Shift range across working directories in either direction", () => {
    const initial = toggleSelection(emptySelection(), "claude:b", list)
    const forward = toggleSelection(initial, "claude:d", list, true)
    expect([...forward.keys]).toEqual(["claude:b", "claude:c", "claude:d"])
    const backward = toggleSelection(toggleSelection(emptySelection(), "claude:d", list), "claude:a", list, true)
    expect(backward.keys.size).toBe(4)
    expect(backward.anchor).toBe("claude:d")
  })

  it("removes a checked Shift range and ignores hidden endpoints and anchors", () => {
    const all = selectSessions(emptySelection(), list)
    const anchored = { ...all, anchor: "claude:b" }
    expect([...toggleSelection(anchored, "claude:d", list, true).keys]).toEqual(["claude:a"])
    expect(toggleSelection(all, "claude:hidden", list, true)).toBe(all)
    const fallback = toggleSelection({ ...emptySelection(), anchor: "claude:hidden" }, "claude:b", list, true)
    expect([...fallback.keys]).toEqual(["claude:b"])
  })

  it("select-visible excludes collapsed and truncated rows, directory-all is explicit", () => {
    const many = Array.from({ length: 25 }, (_, index) => session(String(index)))
    const projects = buildProjects(
      ["/a", "/b"].map((workdir) => ({ workdir, sessions: 25, sources: [], lastUpdatedAt: 1 })),
      (path) => ({ leaf: path, parent: "" }),
    )
    const rows = flattenTree({
      projects,
      sessions: new Map([
        ["/a", many],
        ["/b", list],
      ]),
      expanded: new Set(["/a"]),
      loading: new Set(),
      selected: null,
      limits: new Map(),
    })
    expect(selectSessions(emptySelection(), visibleSessions(rows)).keys.size).toBe(20)
    expect(selectSessions(emptySelection(), many).keys.size).toBe(25)
  })

  it("clears anchor after deletion and deduplicates the loaded selection", () => {
    const selected = toggleSelection(emptySelection(), "claude:a", list)
    expect(removeSelection(selected, "claude:a")).toEqual(emptySelection())
    expect(
      selectedSessions(
        selected,
        new Map([
          ["/a", list],
          ["/duplicate", list],
        ]),
      ),
    ).toEqual([list[0]])
    expect(emptySelection().keys.size).toBe(0)
  })
})
