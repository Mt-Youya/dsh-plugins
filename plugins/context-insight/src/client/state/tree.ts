/**
 * The project tree's pure core.
 *
 * The left column used to be two flat lists (workdirs above, sessions below),
 * which forced the reader to hold the relationship in their head. This module
 * turns the same two inputs into one ordered row list: a project row, then its
 * sessions when expanded, with a "show all" row when a project is truncated.
 *
 * Everything here is pure so it can be tested without a DOM: the component only
 * paints what `flattenTree` returns and moves the cursor with `nextIndex`.
 *
 * @module @cyrus/dsh-context-insight/client/tree
 */

import type { ContextSource, WorkdirEntry } from "../../protocol.ts"

/** One session as the tree shows it. */
export interface TreeSession {
  source: ContextSource
  id: string
  workdir: string
  title: string
  detail?: string
  updatedAt: number
  bytes: number
}

/** One project (a workdir) with its per-source counts. */
export interface TreeProject {
  workdir: string
  /** Last path segment, shown in full and bold. */
  leaf: string
  /** Everything above the leaf, dimmed; may be empty. */
  parent: string
  counts: { source: ContextSource; sessions: number }[]
  lastUpdatedAt: number
}

/** A visible row. */
export type TreeRow =
  | { kind: "project"; key: string; project: TreeProject; expanded: boolean }
  | { kind: "session"; key: string; workdir: string; session: TreeSession; selected: boolean }
  | { kind: "more"; key: string; workdir: string; hidden: number }
  | { kind: "skeleton"; key: string; workdir: string; rows: number }

/** Session rows a project shows before the "show all" row. */
export const DEFAULT_SESSION_LIMIT = 20

/** localStorage key for the expanded set. */
export const TREE_STORAGE_KEY = "dsh-context-insight.tree"

/** Identity of one session row. */
export function sessionKey(source: ContextSource, id: string): string {
  return source + ":" + id
}

/**
 * Build project rows from the workdir answer, newest first.
 * @param workdirs - the Host's workdir entries.
 * @param split - path splitter (injected so the tests stay DOM-free).
 */
export function buildProjects(
  workdirs: readonly WorkdirEntry[],
  split: (path: string) => { parent: string; leaf: string }
): TreeProject[] {
  return workdirs.map((entry) => {
    const parts = split(entry.workdir)
    return {
      workdir: entry.workdir,
      leaf: parts.leaf === "" ? entry.workdir : parts.leaf,
      parent: parts.parent,
      counts: entry.sources.map((group) => ({ source: group.source, sessions: group.sessions })),
      lastUpdatedAt: entry.lastUpdatedAt,
    }
  })
}

/** Everything the flattener needs. */
export interface FlattenInput {
  projects: readonly TreeProject[]
  /** Loaded sessions per workdir; a missing entry means "not loaded yet". */
  sessions: ReadonlyMap<string, readonly TreeSession[]>
  /** Workdirs whose sessions are being fetched right now. */
  loading: ReadonlySet<string>
  expanded: ReadonlySet<string>
  /** Selected session key (`source:id`) or null. */
  selected: string | null
  /** Per-workdir "show all" overrides. */
  limits: ReadonlyMap<string, number>
  /** Default page size. */
  pageSize?: number
}

/**
 * Flatten projects and their sessions into the visible row list.
 *
 * A collapsed project contributes exactly one row, so keyboard movement and the
 * "20 rows then show all" truncation are decided here rather than in the view.
 * @param input - projects, sessions and view state.
 * @returns the rows in paint order.
 */
export function flattenTree(input: FlattenInput): TreeRow[] {
  const pageSize = input.pageSize ?? DEFAULT_SESSION_LIMIT
  const rows: TreeRow[] = []
  for (const project of input.projects) {
    const expanded = input.expanded.has(project.workdir)
    rows.push({ kind: "project", key: "p:" + project.workdir, project, expanded })
    if (!expanded) continue
    if (input.loading.has(project.workdir)) {
      rows.push({ kind: "skeleton", key: "l:" + project.workdir, workdir: project.workdir, rows: 4 })
      continue
    }
    const sessions = input.sessions.get(project.workdir)
    if (sessions === undefined) {
      rows.push({ kind: "skeleton", key: "l:" + project.workdir, workdir: project.workdir, rows: 4 })
      continue
    }
    const limit = input.limits.get(project.workdir) ?? pageSize
    const shown = sessions.slice(0, limit)
    for (const session of shown) {
      const key = sessionKey(session.source, session.id)
      rows.push({ kind: "session", key, workdir: project.workdir, session, selected: key === input.selected })
    }
    if (sessions.length > shown.length) {
      rows.push({
        kind: "more",
        key: "m:" + project.workdir,
        workdir: project.workdir,
        hidden: sessions.length - shown.length,
      })
    }
  }
  return rows
}

/**
 * Move the row cursor.
 * @param rows - visible rows.
 * @param from - current index (-1 when nothing is focused).
 * @param key - the arrow/Home/End key.
 * @returns the next index, clamped to the row list.
 */
export function nextIndex(rows: readonly TreeRow[], from: number, key: string): number {
  if (rows.length === 0) return -1
  if (key === "Home") return 0
  if (key === "End") return rows.length - 1
  const delta = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0
  if (delta === 0) return from
  const start = from < 0 ? (delta > 0 ? -1 : rows.length) : from
  return Math.min(rows.length - 1, Math.max(0, start + delta))
}

/**
 * Read the persisted expanded set.
 *
 * Storage can be absent (SSR, private mode) or hold junk; both mean "no saved
 * state", never a crash.
 * @param storage - `localStorage`-like object, or undefined.
 */
export function readExpanded(storage: Pick<Storage, "getItem"> | undefined): string[] {
  if (storage === undefined) return []
  try {
    const raw = storage.getItem(TREE_STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === "string")
  } catch {
    return []
  }
}

/**
 * Persist the expanded set.
 * @param storage - `localStorage`-like object, or undefined.
 * @param workdirs - expanded workdirs.
 */
export function writeExpanded(storage: Pick<Storage, "setItem"> | undefined, workdirs: readonly string[]): void {
  if (storage === undefined) return
  try {
    storage.setItem(TREE_STORAGE_KEY, JSON.stringify(workdirs))
  } catch {
    // A full or blocked store must not break the tree.
  }
}

/**
 * Keep the projects whose name or path contains the query.
 *
 * Case-insensitive and whitespace-trimmed; an empty query keeps everything, so
 * clearing the field restores the full tree without a second code path.
 * @param projects - all projects, in display order.
 * @param query - what the reader typed.
 * @returns the matching projects, order preserved.
 */
export function filterProjects(projects: readonly TreeProject[], query: string): TreeProject[] {
  const needle = query.trim().toLowerCase()
  if (needle === "") return [...projects]
  return projects.filter((project) => project.workdir.toLowerCase().includes(needle))
}
