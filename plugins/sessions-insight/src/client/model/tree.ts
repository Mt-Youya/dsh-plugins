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
 * @module @cyrusdoyle/dsh-sessions-insight/client/tree
 */

import type { ContextSource, WorkdirEntry } from "../../protocol.ts"

/** One session as the tree shows it. */
export interface TreeSession {
  source: ContextSource
  id: string
  workdir: string
  title: string
  named?: boolean
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
export const TREE_STORAGE_KEY = "dsh-sessions-insight.tree"

/** Identity of one session row. */
export function sessionKey(source: ContextSource, id: string): string {
  return `${source}:${id}`
}

/**
 * Build project rows from the workdir answer, newest first.
 * @param workdirs - the Host's workdir entries.
 * @param split - path splitter (injected so the tests stay DOM-free).
 */
export function buildProjects(
  workdirs: readonly WorkdirEntry[],
  split: (path: string) => { parent: string; leaf: string },
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
    rows.push({ kind: "project", key: `p:${project.workdir}`, project, expanded })
    if (!expanded) continue
    if (input.loading.has(project.workdir)) {
      rows.push({ kind: "skeleton", key: `l:${project.workdir}`, workdir: project.workdir, rows: 4 })
      continue
    }
    const sessions = input.sessions.get(project.workdir)
    if (sessions === undefined) {
      rows.push({ kind: "skeleton", key: `l:${project.workdir}`, workdir: project.workdir, rows: 4 })
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
        key: `m:${project.workdir}`,
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

/**
 * Toggle one source in the toolbar's filter.
 *
 * The filter is a plain list because an empty list is the "all sources" state;
 * the panel passes it straight down to both the toolbar and the tree.
 * @param current - sources already selected.
 * @param source - the source whose pill was clicked.
 * @returns a new list, insertion order preserved.
 */
export function toggleSourceFilter(current: readonly ContextSource[], source: ContextSource): ContextSource[] {
  return current.includes(source) ? current.filter((entry) => entry !== source) : [...current, source]
}

/**
 * Keep projects that have sessions from the selected sources, and drop the
 * per-source counts of the sources left out.
 *
 * Counts come from `/workdirs`, so a project can be judged without loading its
 * sessions; the counts that remain are what the project row shows, keeping the
 * badge row consistent with the filtered session list below it.
 * @param projects - all projects, in display order.
 * @param sources - selected sources; empty means "no source filter".
 * @returns the matching projects, order preserved.
 */
export function filterProjectsBySources(
  projects: readonly TreeProject[],
  sources: readonly ContextSource[],
): TreeProject[] {
  if (sources.length === 0) return [...projects]
  const wanted = new Set(sources)
  const kept: TreeProject[] = []
  for (const project of projects) {
    const counts = project.counts.filter((count) => wanted.has(count.source) && count.sessions > 0)
    if (counts.length === 0) continue
    kept.push({ ...project, counts })
  }
  return kept
}

/**
 * Keep only sessions from the selected sources.
 *
 * The map shape is kept so the tree's flatten step and the session management
 * tools read filtered rows exactly as they read unfiltered ones.
 * @param sessions - loaded sessions per workdir.
 * @param sources - selected sources; empty means "no source filter".
 * @returns the same map when there is no filter, otherwise a filtered copy.
 */
export function filterSessionsBySources(
  sessions: ReadonlyMap<string, readonly TreeSession[]>,
  sources: readonly ContextSource[],
): ReadonlyMap<string, readonly TreeSession[]> {
  if (sources.length === 0) return sessions
  const wanted = new Set(sources)
  const filtered = new Map<string, readonly TreeSession[]>()
  for (const [workdir, list] of sessions)
    filtered.set(
      workdir,
      list.filter((session) => wanted.has(session.source)),
    )
  return filtered
}
