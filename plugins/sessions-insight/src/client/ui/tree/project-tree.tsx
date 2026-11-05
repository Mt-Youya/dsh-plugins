/**
 * The left column: one project tree instead of two flat lists.
 *
 * Projects fold open in place, each session sits under the project it belongs to
 * with its source mark, and a big project shows one page plus a "show all" row.
 * Only the expanded projects are fetched, so opening the panel costs one list
 * request rather than one per workdir; the rows themselves are decided by the
 * pure functions in `tree.ts`.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/client/project-tree
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { ReactElement } from "react"

import type { ContextSource, SessionSummary, WorkdirEntry } from "../../../protocol.ts"
import type { SessionMetadataValue } from "../../../protocol/management.ts"
import type { Api } from "../../api.ts"
import { t } from "../../locale/index.ts"
import { formatShortTime, splitPath, tildePath } from "../../model/format.ts"
import { selectedSessions, selectSessions, toggleSelection, visibleSessions } from "../../model/selection.ts"
import {
  buildProjects,
  DEFAULT_SESSION_LIMIT,
  filterProjects,
  flattenTree,
  nextIndex,
  readExpanded,
  sessionKey,
  type TreeProject,
  type TreeRow,
  type TreeSession,
  writeExpanded,
} from "../../model/tree.ts"
import { clientListCache } from "../../state/list-cache.ts"
import { applySessionMetadata } from "../../state/management.ts"
import { useSessionManagement } from "../../state/use-session-management.ts"
import { ManagementControls, SessionManagement } from "../session/session-management.tsx"
import { SessionRow } from "../session/session-row.tsx"
import { Glyph, SOURCE_MARKS, SourceIcon } from "../shared/icons.tsx"
import { TreeSkeleton } from "../shared/states.tsx"

/** What the panel needs to open a session. */
export interface TreeSelection {
  source: ContextSource
  id: string
  /** Present when the caller knows which project the session belongs to. */
  workdir?: string
}

/** Local storage handle, absent outside a browser. */
function storageOf(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function treeSessions(sessions: readonly SessionSummary[]): TreeSession[] {
  return sessions.map((summary) => ({
    ...summary,
    title: summary.title ?? summary.firstInput ?? t("sessions.untitled"),
    named: (summary.title?.trim().length ?? 0) > 0,
  }))
}

function cachedSessions(): Map<string, TreeSession[]> {
  return new Map([...clientListCache().sessions].map(([workdir, value]) => [workdir, treeSessions(value.sessions)]))
}

/** One source count: glyph plus number, tinted by the source's brand. */
function SourceCount({ source, count }: { source: ContextSource; count: number }): ReactElement {
  const mark = SOURCE_MARKS[source]
  return (
    <span
      className="ci-src"
      style={{ ["--ci-src-color" as string]: mark.text, ["--ci-src-brand" as string]: mark.brand }}
      title={`${mark.label.zh} · ${t("sources.sessions", { count })}`}
    >
      <SourceIcon source={source} size={10} />
      <span>{String(count)}</span>
    </span>
  )
}

/** A project row. */
function ProjectRow({
  row,
  index,
  onToggle,
  onFocus,
}: {
  row: Extract<TreeRow, { kind: "project" }>
  index: number
  onToggle: () => void
  onFocus: () => void
}): ReactElement {
  const project: TreeProject = row.project
  return (
    <button
      type="button"
      className="ci-row px-2 py-1.5"
      data-focus={index}
      aria-expanded={row.expanded}
      onClick={onToggle}
      onFocus={onFocus}
      title={project.workdir}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Glyph name="chevron" size={11} className="ci-chevron shrink-0 text-fg-3" />
        <Glyph name="folder" size={14} className={row.expanded ? "shrink-0 text-accent" : "shrink-0 text-fg-dim"} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{project.leaf}</span>
        <span className="shrink-0 text-[10.5px] text-fg-3 tabular-nums">{formatShortTime(project.lastUpdatedAt)}</span>
      </span>
      <span className="mt-1 flex min-w-0 items-center gap-1.5 ps-9.25">
        <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-fg-3">
          {project.parent === "" ? "" : tildePath(project.parent)}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {project.counts.map((group) => (
            <SourceCount key={group.source} source={group.source} count={group.sessions} />
          ))}
        </span>
      </span>
    </button>
  )
}

/**
 * The tree column: a header with the project count and a filter, then the
 * scrolling rows.
 * @param props.api - client API.
 * @param props.workdirs - project rows from `/workdirs`.
 * @param props.selected - currently open session.
 * @param props.onSelect - open one session.
 * @param props.loading - true while the first `/workdirs` answer is pending.
 * @returns the tree column, filling its parent's height.
 */
export function ProjectTree({
  api,
  workdirs,
  selected,
  onSelect,
  loading,
  onDeleted,
  revision,
  onMetadataChanged,
}: {
  api: Api
  workdirs: readonly WorkdirEntry[]
  selected: TreeSelection | null
  onSelect: (selection: TreeSelection) => void
  loading: boolean
  onDeleted: (session: TreeSession) => void
  revision: number
  onMetadataChanged?: (value: SessionMetadataValue) => void
}): ReactElement {
  const cache = clientListCache()
  const deletion = useSyncExternalStore(cache.subscribe, cache.deletionVersion, cache.deletionVersion)
  const allProjects = useMemo(() => buildProjects(workdirs, splitPath), [workdirs])
  const [query, setQuery] = useState("")
  const projects = useMemo(() => filterProjects(allProjects, query), [allProjects, query])
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const saved = new Set(readExpanded(storageOf()))
    const first = selected?.workdir ?? workdirs[0]?.workdir
    return saved.size > 0 || first === undefined ? saved : new Set([first])
  })
  const [sessions, setSessions] = useState<Map<string, TreeSession[]>>(cachedSessions)
  const management = useSessionManagement(
    api,
    (deleted) => {
      setSessions(
        (current) =>
          new Map(
            [...current].map(([workdir, list]) => [
              workdir,
              list.filter(
                (session) => sessionKey(session.source, session.id) !== sessionKey(deleted.source, deleted.id),
              ),
            ]),
          ),
      )
      onDeleted(deleted)
    },
    onMetadataChanged,
  )
  const displaySessions = applySessionMetadata(sessions, management.metadata, management.groupFilter)
  const chosen = selectedSessions(management.selection, applySessionMetadata(sessions, management.metadata, ""))
  const [loadingWorkdirs, setLoadingWorkdirs] = useState<Set<string>>(() => new Set())
  const [limits, setLimits] = useState<Map<string, number>>(() => new Map())
  const [focus, setFocus] = useState(-1)
  const navRef = useRef<HTMLDivElement | null>(null)
  const requested = useRef(new Set<string>())
  const generation = useRef(revision)
  const controller = useRef(new AbortController())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const visited = useRef(new Set<string>())
  const visible = useRef(expanded)
  visible.current = expanded

  useEffect(() => setSessions(cachedSessions()), [deletion])

  useEffect(() => {
    generation.current = revision
    controller.current = new AbortController()
    requested.current.clear()
    visited.current.clear()
    setLoadingWorkdirs(new Set())
    return () => {
      controller.current.abort()
      for (const timer of timers.current.values()) clearTimeout(timer)
      timers.current.clear()
    }
  }, [revision])

  // Default: open the project that holds the selection, else the first one.
  useEffect(() => {
    if (projects.length === 0) return
    setExpanded((current) => {
      if (current.size > 0) return current
      const target = selected?.workdir ?? projects[0]?.workdir
      return target === undefined ? current : new Set([target])
    })
  }, [projects, selected])

  const load = useCallback(
    async (workdir: string) => {
      if (requested.current.has(workdir)) return
      requested.current.add(workdir)
      clearTimeout(timers.current.get(workdir))
      timers.current.delete(workdir)
      const signal = controller.current.signal
      if (!clientListCache().sessions.has(workdir)) setLoadingWorkdirs((current) => new Set(current).add(workdir))
      const result = await api.sessions(workdir, signal)
      if (signal.aborted || generation.current !== revision) return
      requested.current.delete(workdir)
      setLoadingWorkdirs((current) => {
        const next = new Set(current)
        next.delete(workdir)
        return next
      })
      // A failed read leaves the project empty rather than skeletal forever.
      if (!result.ok) {
        if (result.error === "aborted") return
        setSessions((current) => (current.has(workdir) ? current : new Map(current).set(workdir, [])))
        return
      }
      setSessions((current) => new Map(current).set(workdir, treeSessions(result.value.sessions)))
      if (result.value.refreshing) {
        const timer = setTimeout(() => {
          timers.current.delete(workdir)
          if (!signal.aborted && visible.current.has(workdir)) void load(workdir)
        }, 500)
        timers.current.set(workdir, timer)
      }
    },
    [api, revision],
  )

  useEffect(() => {
    const known = new Set(workdirs.map((row) => row.workdir))
    for (const workdir of visited.current) {
      if (expanded.has(workdir) && known.has(workdir)) continue
      visited.current.delete(workdir)
      clearTimeout(timers.current.get(workdir))
      timers.current.delete(workdir)
    }
    for (const workdir of expanded) {
      if (!known.has(workdir) || visited.current.has(workdir)) continue
      visited.current.add(workdir)
      void load(workdir)
    }
  }, [expanded, load, workdirs])

  const rows = flattenTree({
    projects,
    sessions: displaySessions,
    loading: loadingWorkdirs,
    expanded,
    selected: selected === null ? null : sessionKey(selected.source, selected.id),
    limits,
  })

  function toggle(workdir: string): void {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(workdir)) next.delete(workdir)
      else next.add(workdir)
      writeExpanded(storageOf(), [...next])
      return next
    })
  }

  function openRow(row: TreeRow | undefined, shift = false): void {
    if (row === undefined) return
    if (row.kind === "project") {
      toggle(row.project.workdir)
      return
    }
    if (row.kind === "more") {
      setLimits((current) => new Map(current).set(row.workdir, Number.MAX_SAFE_INTEGER))
      return
    }
    if (row.kind === "session") {
      if (management.editing) {
        if (!management.busy)
          management.setSelection((current) => toggleSelection(current, row.key, visibleSessions(rows), shift))
        return
      }
      onSelect({ source: row.session.source, id: row.session.id, workdir: row.workdir })
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
    const row = rows[focus]
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault()
      const next = nextIndex(rows, focus, event.key)
      setFocus(next)
      navRef.current?.querySelector<HTMLElement>(`[data-focus="${String(next)}"]`)?.focus()
      return
    }
    if (event.key === "ArrowRight") {
      if (row?.kind === "project" && !row.expanded) {
        event.preventDefault()
        toggle(row.project.workdir)
      }
      return
    }
    if (event.key === "ArrowLeft") {
      if (row?.kind === "project" && row.expanded) {
        event.preventDefault()
        toggle(row.project.workdir)
      } else if (row?.kind === "session" || row?.kind === "more" || row?.kind === "skeleton") {
        event.preventDefault()
        const workdir = row.kind === "session" ? row.workdir : row.workdir
        toggle(workdir)
      }
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openRow(row, event.shiftKey)
    }
  }

  if (loading && allProjects.length === 0) {
    return (
      <nav className="ci-scroll h-full overflow-y-auto" aria-label={t("workdirs.title")} aria-busy="true">
        <TreeSkeleton label={t("tree.loadingIndex")} />
      </nav>
    )
  }

  return (
    <nav className="flex h-full min-h-0 flex-col" aria-label={t("workdirs.title")}>
      <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 text-[12px] font-semibold">
          <span>{t("tree.title")}</span>
          <span className="rounded-full bg-bg-2 px-1.5 text-[10.5px] leading-4.25 font-medium text-fg-dim tabular-nums">
            {query.trim() === "" ? allProjects.length : `${String(projects.length)} / ${String(allProjects.length)}`}
          </span>
          <button
            type="button"
            className="ci-btn ci-btn--quiet ms-auto active:bg-hover"
            disabled={management.busy}
            onClick={management.toggleEditing}
          >
            {t(management.editing ? "management.done" : "management.edit")}
          </button>
        </div>
        <ManagementControls
          state={management}
          visible={() => management.setSelection((current) => selectSessions(current, visibleSessions(rows)))}
        />
        <label className="flex h-7 items-center gap-1.5 rounded-[7px] border border-line-soft bg-bg px-2 text-fg-3 focus-within:border-accent">
          <Glyph name="search" size={12} />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-fg outline-none placeholder:text-fg-3"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              management.clearSelection()
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("")
                management.clearSelection()
              }
            }}
            placeholder={t("tree.filter")}
            aria-label={t("tree.filter")}
            type="search"
          />
        </label>
      </div>
      <div
        className="ci-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3"
        ref={navRef}
        onKeyDown={onKeyDown}
        role="tree"
      >
        {projects.length === 0 ? (
          <p className="m-0 px-2 py-3 text-[12px] leading-relaxed text-fg-dim">
            {allProjects.length === 0 ? t("tree.emptyAll") : t("tree.noMatch", { query: query.trim() })}
          </p>
        ) : null}
        {rows.map((row, index) => {
          if (row.kind === "project") {
            return (
              <div className="mt-1 first:mt-0" key={row.key}>
                <ProjectRow
                  row={row}
                  index={index}
                  onToggle={() => toggle(row.project.workdir)}
                  onFocus={() => setFocus(index)}
                />
                {management.editing &&
                displaySessions.has(row.project.workdir) &&
                !loadingWorkdirs.has(row.project.workdir) ? (
                  <button
                    type="button"
                    className="ci-btn ci-btn--quiet ms-3 active:bg-hover"
                    disabled={management.busy}
                    onClick={() =>
                      management.setSelection((current) =>
                        selectSessions(current, displaySessions.get(row.project.workdir) ?? []),
                      )
                    }
                  >
                    {t("management.selectDirectory", { count: displaySessions.get(row.project.workdir)?.length ?? 0 })}
                  </button>
                ) : null}
              </div>
            )
          }
          if (row.kind === "skeleton") {
            return (
              <div className="ms-3.25 flex flex-col gap-1 border-s border-line-soft py-1 ps-2.5" key={row.key}>
                {Array.from({ length: row.rows }, (_, order) => (
                  <div
                    className="h-8 rounded-lg bg-[linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))] bg-size-[200%_100%] motion-safe:animate-[ci-skel_1.4s_var(--ease-in-out)_infinite]"
                    key={row.key + String(order)}
                  />
                ))}
              </div>
            )
          }
          if (row.kind === "more") {
            return (
              <div className="ms-3.25 border-s border-line-soft py-0.5 ps-1.5" key={row.key}>
                <button
                  type="button"
                  className="ci-btn ci-btn--quiet h-7 w-full justify-start"
                  data-focus={index}
                  onClick={() => openRow(row)}
                  onFocus={() => setFocus(index)}
                >
                  {t("tree.showAll", { count: row.hidden + DEFAULT_SESSION_LIMIT })}
                </button>
              </div>
            )
          }
          return (
            <SessionRow
              key={row.key}
              api={api}
              onDeleted={management.deleted}
              editing={management.editing}
              checked={management.selection.keys.has(row.key)}
              busy={management.busy}
              onCheck={(shift) => openRow(row, shift)}
              onRename={() => void management.openDialog("rename", [row.session])}
              onMove={() => void management.openDialog("group", [row.session])}
              onAiRename={() => void management.openAiDialog([row.session], false)}
              row={row}
              index={index}
              onOpen={() => openRow(row)}
              onFocus={() => setFocus(index)}
            />
          )
        })}
      </div>
      <SessionManagement state={management} selected={chosen} />
    </nav>
  )
}
