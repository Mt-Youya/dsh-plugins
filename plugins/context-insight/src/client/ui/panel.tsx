/**
 * The panel: workdir → session → turn, with the five views the milestone asks
 * for (composition, cumulative level, tool detail, compaction boundaries,
 * subagent tree) plus ⌘K search.
 *
 * Rules that shape this component:
 * - one source failing never blanks the page: its pill says why, its rows are
 *   missing from the merged tree, and a `failures` notice names it;
 * - a session is identified by `source + id`, because three corpora hand out
 *   uuids and they are not interchangeable;
 * - the page is loaded a window of turns at a time and appended, so a session
 *   with hundreds of turns never renders in one go;
 * - every number printed comes from a `Measure`, through `MeasureValue`.
 *
 * Layout: the panel fills the Host's main slot and never sets a pixel height of
 * its own. The tree and the two session columns each scroll on their own; below
 * the container breakpoint the session pane collapses to one scrolling column.
 * This module only orchestrates — every view lives in its own file.
 *
 * @module @cyrus/dsh-context-insight/client/panel
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactElement } from "react"
import type {
  ContextSource,
  CostTurnValue,
  CostValue,
  SessionsValue,
  SessionSummary,
  SourceProblem,
  SourceStatus,
  WorkdirEntry,
  WorkdirsValue,
} from "../../protocol.ts"
import type { Api, ApiFailure } from "../api.ts"
import { createApi, failureText } from "../api.ts"
import { compactTokens } from "../format.ts"
import { LOCALE_NS, t } from "../locale.ts"
import { HandoffDialog } from "./handoff.tsx"
import { ProjectTree } from "./project-tree.tsx"
import { SearchPalette, type SearchTarget } from "./search-palette.tsx"
import { SessionPane, type LoadedSession } from "./session-pane.tsx"
import { EmptyBlock, ErrorBlock, Notice, SessionSkeleton, TreeSkeleton } from "./states.tsx"
import { Toolbar } from "./toolbar.tsx"

/**
 * Last successful list answers, kept at module scope.
 *
 * Remounting the panel (switching away and back) must not look like a cold
 * start: the cached rows paint on the first frame and a background refresh
 * updates them. The Host does the same thing server-side with its TTL cache, so
 * the two are stale-while-revalidate end to end.
 */
const LIST_CACHE: {
  workdirs?: WorkdirsValue
  sessions: Map<string, SessionsValue>
} = { sessions: new Map() }

/** Turns fetched per request; the strip appends one page at a time. */
export const PAGE_SIZE = 40

/** A session's identity across three corpora. */
interface SessionRef {
  source: ContextSource
  id: string
  /** Needed by the tree to keep the owning project open; absent when unknown. */
  workdir?: string
}

type Boot =
  | { kind: "loading" }
  | { kind: "failed"; error: string; detail?: string }
  | { kind: "ready"; sources: SourceStatus[]; workdirs: WorkdirEntry[]; failures: SourceProblem[] }

type SessionListState =
  | { kind: "idle" }
  | { kind: "loading"; workdir: string }
  | { kind: "failed"; workdir: string; failure: ApiFailure }
  | { kind: "ready"; workdir: string; sessions: SessionSummary[]; failures: SourceProblem[] }

type DetailState =
  | { kind: "idle" }
  | { kind: "loading"; ref: SessionRef }
  | { kind: "failed"; ref: SessionRef; failure: ApiFailure }
  | ({ kind: "ready"; ref: SessionRef } & LoadedSession)


/**
 * The root's own box, as an inline style.
 *
 * The stylesheet is compiled inside `@scope (.ci-panel)`, and a scoped selector
 * only matches the root's descendants — so no class on the root element itself
 * ever applies (which is why an earlier `h-full` there seemed to do nothing).
 * The root fills the Host's main slot, a flex column with a definite height, the
 * same contract the task board and dsh-context panels rely on; it never sets a
 * pixel height of its own, and the inner columns scroll instead of the page.
 */
const ROOT_STYLE = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  flex: "1 1 auto",
  inlineSize: "100%",
  blockSize: "100%",
  minBlockSize: 0,
  minInlineSize: 0,
  overflow: "hidden",
  containerType: "inline-size",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
  fontSize: "12.5px",
  lineHeight: 1.55,
} as const

/**
 * The panel. Fetches on mount, then follows the workdir → session → turn
 * selection; ⌘K opens the search palette over it.
 * @returns the panel page.
 */
export function ContextInsightPanel(): ReactElement {
  const api: Api = useMemo(() => createApi(), [])
  const [boot, setBoot] = useState<Boot>({ kind: "loading" })
  const [workdir, setWorkdir] = useState<string | null>(null)
  const [selected, setSelected] = useState<SessionRef | null>(null)
  const [pendingJump, setPendingJump] = useState<{ ref: SessionRef; turn: number } | null>(null)
  const [sessionList, setSessionList] = useState<SessionListState>({ kind: "idle" })
  const [detail, setDetail] = useState<DetailState>({ kind: "idle" })
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null)
  const [toolsExpanded, setToolsExpanded] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [cost, setCost] = useState<CostValue | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [handoffFor, setHandoffFor] = useState<SessionRef | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [reading, setReading] = useState(true)

  // ⌘K / Ctrl+K anywhere in the page.
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Boot: sources + workdirs together; the panel cannot render either alone.
  useEffect(() => {
    const controller = new AbortController()
    // A refresh keeps the last answer on screen (and the tree's open projects)
    // until the new one lands; only a cold start shows the skeleton.
    setBoot((current) => (current.kind === "ready" ? current : { kind: "loading" }))
    setReading(true)
    const refresh = reloadToken > 0
    void Promise.all([api.sources(controller.signal), api.workdirs(controller.signal, refresh)]).then(
      ([sources, workdirs]) => {
        if (controller.signal.aborted) return
        setReading(false)
        if (!sources.ok) {
          setBoot({
            kind: "failed",
            error: sources.error,
            ...(sources.detail === undefined ? {} : { detail: sources.detail }),
          })
          return
        }
        if (!workdirs.ok) {
          setBoot({
            kind: "failed",
            error: workdirs.error,
            ...(workdirs.detail === undefined ? {} : { detail: workdirs.detail }),
          })
          return
        }
        LIST_CACHE.workdirs = workdirs.value
        setRefreshing(workdirs.value.refreshing === true)
        setBoot({
          kind: "ready",
          sources: sources.value.sources,
          workdirs: workdirs.value.workdirs,
          failures: workdirs.value.failures,
        })
        setWorkdir((current) => {
          if (current !== null && workdirs.value.workdirs.some((row) => row.workdir === current)) return current
          return workdirs.value.workdirs[0]?.workdir ?? null
        })
      }
    )
    return () => {
      controller.abort()
      setRefreshing(false)
      setReading(false)
    }
  }, [api, reloadToken])

  // Sessions for the selected workdir, merged across sources.
  useEffect(() => {
    if (workdir === null) {
      setSessionList({ kind: "idle" })
      return
    }
    const controller = new AbortController()
    setSessionList({ kind: "loading", workdir })
    void api.sessions(workdir, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      if (!result.ok) {
        setSessionList({ kind: "failed", workdir, failure: result })
        return
      }
      setSessionList({ kind: "ready", workdir, sessions: result.value.sessions, failures: result.value.failures })
      setSelected((current) => {
        const rows = result.value.sessions
        if (
          pendingJump !== null &&
          rows.some((row) => row.id === pendingJump.ref.id && row.source === pendingJump.ref.source)
        ) {
          return pendingJump.ref
        }
        if (current !== null && rows.some((row) => row.id === current.id && row.source === current.source))
          return current
        const first = rows[0]
        return first === undefined ? null : { source: first.source, id: first.id }
      })
    })
    return () => {
      controller.abort()
    }
  }, [api, workdir, reloadToken, pendingJump])

  // One session's first page.
  useEffect(() => {
    if (selected === null) {
      setDetail({ kind: "idle" })
      return
    }
    const controller = new AbortController()
    setCost(null)
    setDetail({ kind: "loading", ref: selected })
    void api.cost(selected.source, selected.id, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setCost(result.ok ? result.value : null)
    })
    if (pendingJump === null) {
      setSelectedTurn(null)
      setToolsExpanded(false)
    }
    void api.session(selected.id, 0, PAGE_SIZE, selected.source, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      if (!result.ok) {
        setDetail({ kind: "failed", ref: selected, failure: result })
        return
      }
      setDetail({
        kind: "ready",
        ref: selected,
        data: result.value,
        turns: result.value.session.turns,
        loadingMore: false,
      })
      const turns = result.value.session.turns
      if (pendingJump !== null && pendingJump.ref.id === selected.id && pendingJump.ref.source === selected.source) {
        setSelectedTurn(pendingJump.turn)
        setPendingJump(null)
        return
      }
      // Open the first turn that has something to explain: a residual gap if
      // there is one, otherwise the first turn.
      const withResidual = turns.find((turn) => turn.attribution.residual !== undefined)
      setSelectedTurn(withResidual?.index ?? turns[0]?.index ?? null)
    })
    return () => {
      controller.abort()
    }
  }, [api, selected, pendingJump])

  const loadMore = useCallback(() => {
    if (detail.kind !== "ready" || detail.loadingMore) return
    const offset = detail.turns.length
    if (offset >= detail.data.turnCount) return
    const ref = detail.ref
    setDetail({ ...detail, loadingMore: true })
    void api.session(ref.id, offset, PAGE_SIZE, ref.source).then((result) => {
      setDetail((current) => {
        if (current.kind !== "ready" || current.ref.id !== ref.id || current.ref.source !== ref.source) return current
        if (!result.ok) return { ...current, loadingMore: false, moreFailure: result }
        const seen = new Set(current.turns.map((turn) => turn.index))
        const appended = [...current.turns, ...result.value.session.turns.filter((turn) => !seen.has(turn.index))]
        return { ...current, turns: appended, loadingMore: false }
      })
    })
  }, [api, detail])

  const jumpTo = useCallback((target: SearchTarget) => {
    setSearchOpen(false)
    setWorkdir(target.workdir)
    setPendingJump({ ref: { source: target.source, id: target.sessionId }, turn: target.turnIndex })
    setSelected({ source: target.source, id: target.sessionId })
  }, [])

  // Keep the open turn in view when it changes from outside the list (search
  // jump, chart click), without yanking the list when it is already visible.
  useEffect(() => {
    if (selectedTurn === null) return
    document
      .querySelector<HTMLElement>(`.ci-panel [data-turn="${String(selectedTurn)}"] [data-turn-row]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [selectedTurn, detail.kind])

  const retry = useCallback(() => setReloadToken((token) => token + 1), [])

  const costs = useMemo(() => {
    if (cost === null) return undefined
    const map = new Map<number, CostTurnValue>()
    for (const line of cost.turns) map.set(line.index, line)
    return map
  }, [cost])
  const sourceEntries = boot.kind === "ready" ? boot.sources : []
  const anySource = sourceEntries.some((entry) => entry.available)
  const failures = [
    ...(boot.kind === "ready" ? boot.failures : []),
    ...(sessionList.kind === "ready" ? sessionList.failures : []),
  ]

  const tree =
    boot.kind === "ready" ? (
      <ProjectTree
        api={api}
        workdirs={boot.workdirs}
        selected={selected}
        onSelect={(next) => {
          setSelected(next)
          setPendingJump(null)
          if (next.workdir !== undefined) setWorkdir(next.workdir)
        }}
        loading={false}
      />
    ) : (
      <TreeSkeleton label={t("tree.loadingIndex")} />
    )

  let pane: ReactElement | null = null
  if (boot.kind === "loading") pane = <SessionSkeleton label={t("panel.loading")} />
  else if (boot.kind === "failed")
    pane = <ErrorBlock title={t("session.error", { detail: boot.detail ?? boot.error })} onRetry={retry} />
  else if (boot.workdirs.length === 0)
    pane = (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <EmptyBlock title={t("workdirs.empty")} hint={t("empty.noData")} center />
        {anySource ? null : <Notice>{t("empty.noSources")}</Notice>}
      </div>
    )
  else if (detail.kind === "idle") pane = <EmptyBlock title={t("sessions.pick")} hint={t("sessions.pickHint")} center />
  else if (detail.kind === "loading") pane = <SessionSkeleton label={t("session.loading")} />
  else if (detail.kind === "failed")
    pane = (
      <ErrorBlock
        title={t("session.error", { detail: failureText(detail.failure) })}
        onRetry={() => {
          const ref = detail.ref
          setSelected(null)
          window.setTimeout(() => setSelected(ref), 0)
        }}
      />
    )
  else
    pane = (
      <SessionPane
        session={detail}
        title={detail.data.session.title ?? detail.ref.id}
        cost={cost}
        costs={costs}
        selectedTurn={selectedTurn}
        onSelectTurn={setSelectedTurn}
        toolsExpanded={toolsExpanded}
        onToggleTools={setToolsExpanded}
        onLoadMore={loadMore}
        onHandoff={() => setHandoffFor({ source: detail.ref.source, id: detail.ref.id })}
      />
    )

  return (
    <div className="ci-panel" style={ROOT_STYLE} data-dsh-context-insight-view="">
      <Toolbar
        sources={sourceEntries}
        busy={reading || refreshing}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onSearch={() => setSearchOpen(true)}
        onRefresh={retry}
      />
      {failures.length === 0 ? null : (
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-line-soft px-3 py-2">
          {failures.map((problem) => (
            <Notice key={`${problem.source}-${problem.error}`}>
              {problem.source}: {problem.error}
            </Notice>
          ))}
        </div>
      )}
      <div
        className={
          sidebarOpen
            ? "grid min-h-0 flex-1 grid-cols-[clamp(220px,30cqw,300px)_minmax(0,1fr)]"
            : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)]"
        }
      >
        {sidebarOpen ? (
          <aside className="min-h-0 min-w-0 border-e border-line-soft bg-sidebar">{tree}</aside>
        ) : null}
        <main className="@container min-h-0 min-w-0">{pane}</main>
      </div>

      {searchOpen ? <SearchPalette api={api} onClose={() => setSearchOpen(false)} onOpenTurn={jumpTo} /> : null}
      {handoffFor === null ? null : (
        <HandoffDialog api={api} source={handoffFor.source} id={handoffFor.id} onClose={() => setHandoffFor(null)} />
      )}
    </div>
  )
}

/** Locale namespace the panel reads; exported for tests and the registration. */
export const PANEL_LOCALE_NS = LOCALE_NS

/** Tokens the panel prints for a total; re-exported so tests can assert formats. */
export { compactTokens }
