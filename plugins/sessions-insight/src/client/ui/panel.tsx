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
 * Settings opens as an overlay above that layout, so the session tree and its
 * scroll state stay mounted while the overlay is open.
 * This module only orchestrates — every view lives in its own file.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/client/panel
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactElement } from "react"

import type {
  ContextSource,
  CostTurnValue,
  SessionMetadataValue,
  SessionSummary,
  SourceProblem,
  SourceStatus,
  WorkdirEntry,
} from "../../protocol.ts"
import type { Api, ApiFailure } from "../api.ts"
import { createApi, failureText } from "../api.ts"
import { LOCALE_NS, t } from "../locale/index.ts"
import { compactTokens } from "../model/format.ts"
import { toggleSourceFilter } from "../model/tree.ts"
import { clientListCache } from "../state/list-cache.ts"
import { SettingsStore, useSettings } from "../state/settings.ts"
import { applySessionMetadata, sameSession, useSessionDetail } from "../state/use-session-detail.ts"
import type { SessionRef } from "../state/use-session-detail.ts"
import { UtilityStore } from "../state/utilities.ts"
import { Toolbar } from "./chrome/toolbar.tsx"
import { HandoffDialog } from "./overlays/handoff.tsx"
import { SearchPalette, type SearchTarget } from "./overlays/search-palette.tsx"
import { SettingsOverlay } from "./overlays/settings-overlay.tsx"
import { PANEL_ROOT_STYLE } from "./panel-style.ts"
import { SessionPane } from "./session/session-pane.tsx"
import type { SettingsSections } from "./settings/settings.tsx"
import { makeUtilitySections, UtilityStrip } from "./settings/utilities.tsx"
import { EmptyBlock, ErrorBlock, Notice, SessionSkeleton, TreeSkeleton } from "./shared/states.tsx"
import { ProjectTree } from "./tree/project-tree.tsx"

export { PAGE_SIZE } from "../state/use-session-detail.ts"

type Boot =
  | { kind: "loading" }
  | { kind: "failed"; error: string; detail?: string }
  | { kind: "ready"; sources: SourceStatus[]; workdirs: WorkdirEntry[]; failures: SourceProblem[] }

type SessionListState =
  | { kind: "idle" }
  | { kind: "loading"; workdir: string }
  | { kind: "failed"; workdir: string; failure: ApiFailure }
  | { kind: "ready"; workdir: string; sessions: SessionSummary[]; failures: SourceProblem[] }

/** Panel props; every dependency can be injected so tests and the shell share one surface. */
export interface ContextInsightPanelProps {
  onOpenSession?: (id: string) => void | Promise<void>
  settingsStore?: SettingsStore
  settingsSections?: SettingsSections
  utilityStore?: UtilityStore
  initialPage?: "sessions" | "settings"
}

/**
 * The panel. Fetches on mount, then follows the workdir → session → turn
 * selection; ⌘K opens the search palette over it and settings opens as an
 * overlay above it.
 * @returns the panel page.
 */
export function ContextInsightPanel({
  onOpenSession,
  settingsStore,
  settingsSections,
  utilityStore,
  initialPage = "sessions",
}: ContextInsightPanelProps): ReactElement {
  const api: Api = useMemo(() => createApi(), [])
  const store = useMemo(() => settingsStore ?? new SettingsStore(), [settingsStore])
  const utilities = useMemo(() => utilityStore ?? new UtilityStore(api), [utilityStore, api])
  const sections = useMemo(
    () => settingsSections ?? makeUtilitySections(utilities, store),
    [settingsSections, utilities, store],
  )
  const settings = useSettings(store, api).value
  const [page, setPage] = useState(initialPage)
  // Settings opens above the live panel; only the overlay unmounts on close, so
  // the session tree keeps its scroll positions, selected tab and dialogs.
  const closeSettings = useCallback(() => setPage("sessions"), [])
  const cache = clientListCache()
  const [boot, setBoot] = useState<Boot>(() =>
    cache.sources === undefined || cache.workdirs === undefined
      ? { kind: "loading" }
      : {
          kind: "ready",
          sources: cache.sources.sources,
          workdirs: cache.workdirs.workdirs,
          failures: cache.workdirs.failures,
        },
  )
  const [workdir, setWorkdir] = useState<string | null>(() => cache.workdirs?.workdirs[0]?.workdir ?? null)
  const [selected, setSelected] = useState<SessionRef | null>(null)
  const [pendingJump, setPendingJump] = useState<{ ref: SessionRef; turn: number } | null>(null)
  const [sessionList, setSessionList] = useState<SessionListState>({ kind: "idle" })
  const {
    detail,
    cost,
    selectedTurn,
    setSelectedTurn,
    toolsExpanded,
    setToolsExpanded,
    loadMore,
    jumpTurn,
    overlaySession,
    onMetadataChanged: updateDetailMetadata,
  } = useSessionDetail(api, selected, settings.defaultToolsExpanded)
  const [reloadToken, setReloadToken] = useState(0)
  const [listRevision, setListRevision] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [handoffFor, setHandoffFor] = useState<SessionRef | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [reading, setReading] = useState(true)
  // Source filter shared by the toolbar pills and the project tree; empty = all.
  const [sourceFilter, setSourceFilter] = useState<ContextSource[]>([])
  const toggleSource = useCallback(
    (source: ContextSource) => setSourceFilter((current) => toggleSourceFilter(current, source)),
    [],
  )
  const clearSourceFilter = useCallback(() => setSourceFilter([]), [])

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
    let timer: ReturnType<typeof setTimeout> | undefined
    const read = (forced: boolean): void => {
      const request = forced
        ? api
            .workdirs(controller.signal, true)
            .then(async (workdirs) => [await api.sources(controller.signal), workdirs] as const)
        : Promise.all([api.sources(controller.signal), api.workdirs(controller.signal)])
      void request.then(([sources, workdirs]) => {
        if (controller.signal.aborted) return
        setReading(false)
        if (!sources.ok) {
          if (sources.error === "aborted" || (cache.workdirs !== undefined && cache.sources !== undefined)) return
          setBoot({
            kind: "failed",
            error: sources.error,
            ...(sources.detail === undefined ? {} : { detail: sources.detail }),
          })
          return
        }
        if (!workdirs.ok) {
          if (workdirs.error === "aborted" || (cache.workdirs !== undefined && cache.sources !== undefined)) return
          setBoot({
            kind: "failed",
            error: workdirs.error,
            ...(workdirs.detail === undefined ? {} : { detail: workdirs.detail }),
          })
          return
        }
        if (forced) setListRevision((current) => current + 1)
        setRefreshing(workdirs.value.refreshing === true)
        if (workdirs.value.refreshing) timer = setTimeout(() => read(false), 500)
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
      })
    }
    read(refresh)
    return () => {
      controller.abort()
      clearTimeout(timer)
      setRefreshing(false)
      setReading(false)
    }
  }, [api, reloadToken, cache])

  // Sessions for the selected workdir, merged across sources.
  useEffect(() => {
    if (workdir === null) {
      setSessionList({ kind: "idle" })
      return
    }
    const controller = new AbortController()
    const cached = cache.sessions.get(workdir)
    setSessionList(
      cached === undefined
        ? { kind: "loading", workdir }
        : { kind: "ready", workdir, sessions: cached.sessions, failures: cached.failures },
    )
    let timer: ReturnType<typeof setTimeout> | undefined
    const read = (): void => {
      void api.sessions(workdir, controller.signal).then((result) => {
        if (controller.signal.aborted) return
        if (!result.ok) {
          if (result.error === "aborted" || cached !== undefined) return
          setSessionList({ kind: "failed", workdir, failure: result })
          return
        }
        setSessionList({
          kind: "ready",
          workdir,
          sessions: result.value.sessions.map(overlaySession),
          failures: result.value.failures,
        })
        if (result.value.refreshing) timer = setTimeout(read, 500)
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
    }
    read()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [api, workdir, listRevision, pendingJump, cache, overlaySession])

  // Search waits for page zero before reading the adjoining prefix to its index.
  const readyRef = detail.kind === "ready" ? detail.ref : null
  useEffect(() => {
    if (pendingJump === null || readyRef === null || !sameSession(readyRef, pendingJump.ref)) return
    let cancelled = false
    void jumpTurn(pendingJump.turn).then(() => {
      if (!cancelled) setPendingJump((current) => (current === pendingJump ? null : current))
    })
    return () => {
      cancelled = true
    }
  }, [pendingJump, readyRef, jumpTurn])

  const onMetadataChanged = useCallback(
    (value: SessionMetadataValue): void => {
      updateDetailMetadata(value)
      setSessionList((current) =>
        current.kind !== "ready"
          ? current
          : {
              ...current,
              sessions: current.sessions.map((session) => applySessionMetadata(session, value)),
            },
      )
      cache.rename(value)
    },
    [cache, updateDetailMetadata],
  )

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

  const retry = useCallback(() => {
    clientListCache().invalidateRequests()
    setReloadToken((token) => token + 1)
  }, [])

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
        onMetadataChanged={onMetadataChanged}
        revision={listRevision}
        api={api}
        workdirs={boot.workdirs}
        selected={selected}
        sourceFilter={sourceFilter}
        onClearSourceFilter={clearSourceFilter}
        onSelect={(next) => {
          setSelected(next)
          setPendingJump(null)
          if (next.workdir !== undefined) setWorkdir(next.workdir)
        }}
        onDeleted={(deleted) => {
          setSelected((current) => (current?.source === deleted.source && current.id === deleted.id ? null : current))
          setPendingJump((current) =>
            current?.ref.source === deleted.source && current.ref.id === deleted.id ? null : current,
          )
          cache.remove(deleted)
          setBoot((current) =>
            current.kind !== "ready"
              ? current
              : {
                  ...current,
                  sources: cache.sources?.sources ?? current.sources,
                  workdirs: cache.workdirs?.workdirs ?? current.workdirs,
                },
          )
          setSessionList((current) =>
            current.kind !== "ready"
              ? current
              : {
                  ...current,
                  sessions: current.sessions.filter((row) => row.source !== deleted.source || row.id !== deleted.id),
                },
          )
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
        key={`${detail.ref.source}:${detail.ref.id}`}
        session={detail}
        settings={settings}
        revealTurns={pendingJump !== null}
        title={detail.data.session.title ?? detail.ref.id}
        cost={cost}
        costs={costs}
        selectedTurn={selectedTurn}
        onSelectTurn={setSelectedTurn}
        onJumpTurn={(index) => {
          void jumpTurn(index)
        }}
        toolsExpanded={toolsExpanded}
        onToggleTools={setToolsExpanded}
        onLoadMore={loadMore}
        onOpenSession={onOpenSession}
        onHandoff={() => setHandoffFor({ source: detail.ref.source, id: detail.ref.id })}
      />
    )

  return (
    <div className="ci-panel" style={PANEL_ROOT_STYLE} data-dsh-sessions-insight-view="">
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        data-dsh-sessions-insight-layer="sessions"
        aria-hidden={page === "settings" ? true : undefined}
        inert={page === "settings" ? true : undefined}
      >
        <Toolbar
          sources={sourceEntries}
          activeSources={sourceFilter}
          onToggleSource={toggleSource}
          busy={reading || refreshing}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onSearch={() => setSearchOpen(true)}
          onRefresh={retry}
          onSettings={() => setPage("settings")}
        />
        <UtilityStrip store={utilities} settingsStore={store} />
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
          {sidebarOpen ? <aside className="min-h-0 min-w-0 border-e border-line-soft bg-sidebar">{tree}</aside> : null}
          <main className="@container min-h-0 min-w-0">{pane}</main>
        </div>
      </div>

      <SettingsOverlay open={page === "settings"} store={store} api={api} sections={sections} onClose={closeSettings} />

      {searchOpen ? <SearchPalette api={api} onClose={() => setSearchOpen(false)} onOpenTurn={jumpTo} /> : null}
      {handoffFor === null ? null : (
        <HandoffDialog
          onOpenSession={onOpenSession}
          api={api}
          source={handoffFor.source}
          id={handoffFor.id}
          onClose={() => setHandoffFor(null)}
        />
      )}
    </div>
  )
}

/** Locale namespace the panel reads; exported for tests and the registration. */
export const PANEL_LOCALE_NS = LOCALE_NS

/** Tokens the panel prints for a total; re-exported so tests can assert formats. */
export { compactTokens }
