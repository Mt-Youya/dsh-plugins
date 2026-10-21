/**
 * The left column: one project tree instead of two flat lists.
 *
 * Projects fold open in place, each session sits under the project it belongs to
 * with its source mark, and a big project shows one page plus a "show all" row.
 * Only the expanded projects are fetched, so opening the panel costs one list
 * request rather than one per workdir; the rows themselves are decided by the
 * pure functions in `tree.ts`.
 *
 * @module @cyrus/dsh-context-insight/client/project-tree
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactElement } from "react"
import type { ContextSource, SessionSummary, WorkdirEntry } from "../../protocol.ts"
import type { Api } from "../api.ts"
import { formatBytes, formatTime, splitPath } from "../format.ts"
import { SourceIcon, SOURCE_MARKS } from "./icons.tsx"
import { t } from "../locale.ts"
import {
  DEFAULT_SESSION_LIMIT,
  buildProjects,
  flattenTree,
  nextIndex,
  readExpanded,
  sessionKey,
  writeExpanded,
  type TreeProject,
  type TreeRow,
  type TreeSession,
} from "../state/tree.ts"

/** One skeleton bar; the two shapes differ only in width, height and margin. */
const SKEL =
  "rounded-md bg-[linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))] bg-[length:200%_100%] motion-safe:animate-[ci-skel_1.4s_var(--ease-in-out)_infinite]"

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

/** One source chip: glyph plus count or label. */
function SourceChip({ source, count }: { source: ContextSource; count?: number }): ReactElement {
  const mark = SOURCE_MARKS[source]
  return (
    <span
      className="ci-src"
      style={{ ["--ci-src-color" as string]: mark.text, ["--ci-src-brand" as string]: mark.brand }}
      data-tip={mark.label.zh}
    >
      <SourceIcon source={source} size={11} />
      <span>{count === undefined ? mark.label.zh : String(count)}</span>
    </span>
  )
}

/** A session row. */
function SessionRow({
  row,
  index,
  onOpen,
  onFocus,
}: {
  row: Extract<TreeRow, { kind: "session" }>
  index: number
  onOpen: () => void
  onFocus: () => void
}): ReactElement {
  const mark = SOURCE_MARKS[row.session.source]
  return (
    <button
      type="button"
      className="flex w-full min-w-0 cursor-pointer flex-col items-stretch gap-0.5 rounded-md border-0 bg-transparent px-1.5 py-1.5 text-start font-[inherit] text-fg transition-colors duration-150 ease-out hover:bg-bg-1 active:bg-fg/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent data-[selected=true]:bg-accent/15"
      data-key={row.key}
      data-selected={row.selected}
      data-focus={index}
      aria-current={row.selected}
      onClick={onOpen}
      onFocus={onFocus}
      title={row.session.title}
      style={{
        ["--ci-src-brand" as string]: mark.brand,
        ["--ci-src-color" as string]: mark.text,
      }}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="inline-flex w-3.5 shrink-0 justify-center">
          <SourceIcon source={row.session.source} size={13} />
        </span>
        <span className="min-w-0 flex-1 truncate">{row.session.title}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-fg-dim">
        <span className="ci-src__word">{mark.label.zh}</span>
        <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-fg-dim">
          {formatTime(row.session.updatedAt)} · {formatBytes(row.session.bytes)}
        </span>
      </span>
    </button>
  )
}

/**
 * The tree.
 * @param props.api - client API.
 * @param props.workdirs - project rows from `/workdirs`.
 * @param props.selected - currently open session.
 * @param props.onSelect - open one session.
 * @param props.loading - true while the first `/workdirs` answer is pending.
 * @param props.refreshing - true while a cached answer is being revalidated.
 * @returns the tree column.
 */
export function ProjectTree({
  api,
  workdirs,
  selected,
  onSelect,
  loading,
}: {
  api: Api
  workdirs: readonly WorkdirEntry[]
  selected: TreeSelection | null
  onSelect: (selection: TreeSelection) => void
  loading: boolean
}): ReactElement {
  const projects = useMemo(() => buildProjects(workdirs, splitPath), [workdirs])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(readExpanded(storageOf())))
  const [sessions, setSessions] = useState<Map<string, TreeSession[]>>(() => new Map())
  const [loadingWorkdirs, setLoadingWorkdirs] = useState<Set<string>>(() => new Set())
  const [limits, setLimits] = useState<Map<string, number>>(() => new Map())
  const [focus, setFocus] = useState(-1)
  const navRef = useRef<HTMLElement | null>(null)
  const requested = useRef(new Set<string>())

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
      setLoadingWorkdirs((current) => new Set(current).add(workdir))
      const result = await api.sessions(workdir)
      requested.current.delete(workdir)
      setLoadingWorkdirs((current) => {
        const next = new Set(current)
        next.delete(workdir)
        return next
      })
      if (!result.ok) return
      const rows: TreeSession[] = result.value.sessions.map((summary) => ({
        source: summary.source,
        id: summary.id,
        workdir: summary.workdir,
        title: summary.title ?? summary.firstInput ?? t("sessions.untitled"),
        updatedAt: summary.updatedAt,
        bytes: summary.bytes,
      }))
      setSessions((current) => new Map(current).set(workdir, rows))
    },
    [api]
  )

  useEffect(() => {
    for (const workdir of expanded) {
      if (!sessions.has(workdir)) void load(workdir)
    }
  }, [expanded, load, sessions])

  const rows = flattenTree({
    projects,
    sessions,
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

  function openRow(row: TreeRow | undefined): void {
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
      onSelect({ source: row.session.source, id: row.session.id, workdir: row.workdir })
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
    const row = rows[focus]
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault()
      const next = nextIndex(rows, focus, event.key)
      setFocus(next)
      navRef.current?.querySelector<HTMLElement>('[data-focus="' + String(next) + '"]')?.focus()
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
      openRow(row)
    }
  }

  const skeletonProjects = Array.from({ length: 3 }, (_, index) => index)
  const skeletonSessions = Array.from({ length: 6 }, (_, index) => index)

  if (loading && projects.length === 0) {
    return (
      <nav className="flex flex-col min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] px-2 pb-3" aria-label={t("workdirs.title")} aria-busy="true">
        <p className="mx-1 my-2 text-xs leading-relaxed text-fg-dim">{t("tree.loadingIndex")}</p>
        {skeletonProjects.map((index) => (
          <div className={`${SKEL} w-[78%] h-7 my-1`} key={"p" + String(index)} />
        ))}
        {skeletonSessions.map((index) => (
          <div className={`${SKEL} w-[62%] h-[1.375rem] my-0.5 ms-[1.125rem]`} key={"s" + String(index)} />
        ))}
      </nav>
    )
  }

  if (projects.length === 0) {
    return (
      <nav className="flex flex-col min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] px-2 pb-3" aria-label={t("workdirs.title")}>
        <p className="mx-1 my-2 text-xs leading-relaxed text-fg-dim">{t("tree.emptyAll")}</p>
      </nav>
    )
  }

  return (
    <nav className="flex flex-col min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] px-2 pb-3" aria-label={t("workdirs.title")} ref={navRef} onKeyDown={onKeyDown} role="tree">
      <h2 className="m-0 px-3.5 pt-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-fg-dim flex flex-col gap-0.5">{t("tree.title")}</h2>
      {rows.map((row, index) => {
        if (row.kind === "project") {
          const project: TreeProject = row.project
          return (
            <button
              type="button"
              key={row.key}
              className="flex w-full min-w-0 cursor-pointer flex-col items-stretch gap-0.5 rounded-md border-0 bg-transparent px-1.5 py-1.5 text-start font-[inherit] text-fg transition-colors duration-150 ease-out hover:bg-bg-1 active:bg-fg/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-expanded:bg-bg-1/70"
              data-focus={index}
              aria-expanded={row.expanded}
              onClick={() => toggle(project.workdir)}
              onFocus={() => setFocus(index)}
              title={project.workdir}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={`w-3 shrink-0 text-center text-[10px] text-fg-dim${row.expanded ? " w-3 shrink-0 text-center text-[10px] text-fg-dim--open" : ""}`} aria-hidden="true">
                  ▸
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{project.leaf}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {project.counts.map((group) => (
                    <SourceChip key={group.source} source={group.source} count={group.sessions} />
                  ))}
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-fg-dim">
                {project.parent === "" ? null : <span className="min-w-0 flex-1 truncate">{project.parent}</span>}
                <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-fg-dim">{formatTime(project.lastUpdatedAt)}</span>
              </span>
            </button>
          )
        }
        if (row.kind === "skeleton") {
          return (
            <div className="ms-2.5 flex min-w-0 flex-col gap-px border-s border-line-soft ps-1.5" key={row.key}>
              {Array.from({ length: row.rows }, (_, index_) => (
                <div className={`${SKEL} w-[62%] h-[1.375rem] my-0.5 ms-[1.125rem]`} key={row.key + String(index_)} />
              ))}
            </div>
          )
        }
        if (row.kind === "more") {
          return (
            <button
              type="button"
              key={row.key}
              className="ms-6 self-start rounded px-1.5 py-0.5 text-[11px] text-accent"
              data-focus={index}
              onClick={() => openRow(row)}
              onFocus={() => setFocus(index)}
            >
              {t("tree.showAll", { count: row.hidden + DEFAULT_SESSION_LIMIT })}
            </button>
          )
        }
        return (
          <div className="ms-2.5 flex min-w-0 flex-col gap-px border-s border-line-soft ps-1.5" key={row.key}>
            <SessionRow row={row} index={index} onOpen={() => openRow(row)} onFocus={() => setFocus(index)} />
          </div>
        )
      })}
    </nav>
  )
}
