/**
 * The panel: workdir → session → turn, with the five views the milestone asks
 * for (composition, cumulative level, tool detail, compaction boundaries,
 * subagent tree) plus ⌘K search.
 *
 * Rules that shape this component:
 * - one source failing never blanks the page: its badge says why, its rows are
 *   missing from the merged column, and a `failures` notice names it;
 * - a session is identified by `source + id`, because three corpora hand out
 *   uuids and they are not interchangeable;
 * - the page is loaded a window of turns at a time and appended, so a session
 *   with hundreds of turns never renders in one go;
 * - every number printed comes from a `Measure`, through `MeasureValue`.
 *
 * @module @cyrus/dsh-context-insight/client/panel
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactElement } from "react"
import type { ContextSource, CostTurnValue, CostValue } from "../../protocol.ts"
import type { Turn } from "@cyrus/dsh-session-contract"
import type {
  SegmentInfo,
  SessionDetail,
  SessionSummary,
  SourceProblem,
  SourceStatus,
  WorkdirEntry,
} from "../../protocol.ts"
import type { Api, ApiFailure } from "../api.ts"
import { createApi } from "../api.ts"
import { compactTokens, formatBytes, formatFactor, formatTime } from "../format.ts"
import { CostBadge, HandoffDialog } from "./handoff.tsx"
import { ProjectTree } from "./project-tree.tsx"
import type { SessionsValue, WorkdirsValue } from "../../protocol.ts"

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
import { sessionLabel } from "../labels.ts"
import { LOCALE_NS, t } from "../locale.ts"
import { MeasureValue } from "./precision.tsx"
import { SearchPalette, type SearchTarget } from "./search-palette.tsx"
import { EmptyBlock, ErrorBlock, Notice, SkeletonDetail } from "./states.tsx"
import { PartLegend } from "./stacked-bar.tsx"
import { SubagentTree } from "./subagent-tree.tsx"
import { ToolCalls } from "./tool-detail.tsx"
import { TurnList } from "./turn-list.tsx"
import { Waterfall } from "./waterfall.tsx"

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
  | {
      kind: "ready"
      ref: SessionRef
      data: SessionDetail
      turns: Turn[]
      loadingMore: boolean
      moreFailure?: ApiFailure
    }

function failureText(failure: ApiFailure): string {
  return failure.detail === undefined ? failure.error : `${failure.error}: ${failure.detail}`
}

function reasonText(reason: string | undefined): string | undefined {
  if (reason === undefined) return undefined
  if (reason === "root-missing") return t("sources.reason.root-missing")
  if (reason === "root-unreadable") return t("sources.reason.root-unreadable")
  if (reason === "adapter-error") return t("sources.reason.adapter-error")
  return reason
}

/**
 * Per-source availability strip.
 * @param props.sources - one entry per announced source.
 * @returns the strip.
 */
function SourceStrip({ sources }: { sources: SourceStatus[] }): ReactElement {
  return (
    <ul className="flex gap-2 m-0 p-0 list-none min-w-0 overflow-hidden" aria-label={t("sources.title")}>
      {sources.map((entry) => (
        <li
          key={entry.source}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap border-[0.5px] border-line text-fg-dim"
          title={entry.errorDetail ?? entry.root ?? reasonText(entry.reason) ?? ""}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${entry.available ? "bg-ok" : "bg-fg-dim opacity-50"}`}
            aria-hidden="true"
          />
          <span className="text-fg font-semibold">{entry.source}</span>
          <span>
            {entry.available ? t("sources.available") : t("sources.unavailable")}
          </span>
          {entry.available && entry.sessions !== undefined ? (
            <span>{t("sources.sessions", { count: entry.sessions })}</span>
          ) : (
            <span className="opacity-80">{reasonText(entry.reason) ?? ""}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
/**
 * Session head: identity, provenance, and the quality tokens the Host reported.
 * @param props.data - the detail page.
 * @param props.turnCount - turns in the whole session.
 * @returns the header.
 */
function SessionHead({
  data,
  cost,
  onHandoff,
}: {
  data: SessionDetail
  cost: CostValue | null
  onHandoff: () => void
}): ReactElement {
  const session = data.session
  const label = sessionLabel({ title: session.title, firstInput: session.firstInput })
  return (
    <header className="relative min-w-0 px-4 pt-3 pb-2.5 border-b-[0.5px] border-line bg-bg-1">
      <h2 className="mt-0 mb-0.5 text-[13.5px] font-semibold truncate" title={session.id}>
        {label.title}
      </h2>
      {label.detail === undefined ? null : (
        <p className="mt-0 mb-1 text-[11.5px] text-fg-dim truncate" title={label.detail}>
          {label.detail}
        </p>
      )}
      <p className="mt-0 mb-1.5 font-mono text-[11px] text-fg-dim truncate" title={session.workdir}>
        {session.workdir === "" ? t("workdirs.unknown") : session.workdir}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
        <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-fg border-[0.5px] border-line">{session.source}</span>
        <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-bg-2 text-fg-dim">{t("session.turnCount", { count: data.turnCount })}</span>
        <span className="text-fg-dim text-[10.5px] my-1.5">{formatTime(session.updatedAt)}</span>
        <span className="text-fg-dim text-[10.5px] my-1.5">{formatBytes(data.meta.bytes)}</span>
        <span className="text-fg-dim text-[10.5px] my-1.5">{data.meta.cached ? "cached" : `${String(data.meta.elapsedMs)} ms`}</span>
        {data.meta.residualTurns > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-warn border-[0.5px] border-dashed border-warn" title={t("turns.unknownNote")}>
            {t("turns.unknown")} × {data.meta.residualTurns}
          </span>
        ) : null}
        {data.meta.reconciledTurns > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-fg-dim border-[0.5px] border-line">×{data.meta.reconciledTurns}</span>
        ) : null}
        {cost === null ? null : <CostBadge cost={cost} />}
        {cost === null || cost.totals.unpricedTurns === 0 ? null : (
          <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-warn border-[0.5px] border-dashed border-warn">{t("cost.unpriced", { count: cost.totals.unpricedTurns })}</span>
        )}
        <button type="button" className="px-2.5 py-1 rounded-[6px] border-[0.5px] border-line bg-transparent text-fg font-[inherit] text-[11px] cursor-pointer enabled:hover:border-accent disabled:opacity-50 disabled:cursor-default ms-auto" onClick={onHandoff}>
          {t("handoff.button")}
        </button>
      </div>
      {session.dataQuality.length > 0 ? (
        <details className="mt-2 text-[11px] text-fg-dim [&>summary]:cursor-pointer">
          <summary>
            {t("session.quality")} ({session.dataQuality.length})
          </summary>
          <ul className="mt-1.5 mb-0 ps-4 font-mono text-[10.5px] break-all">
            {session.dataQuality.map((token) => (
              <li key={token}>
                <code>{token}</code>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </header>
  )
}

/**
 * The open turn's detail column.
 * @param props.turn - the open turn.
 * @param props.segments - session files, for the subagent tree.
 * @param props.expandedTools - whether the tool cap is lifted.
 * @param props.onToggleTools - lift/lower the tool cap.
 * @returns the column.
 */
function TurnDetail({
  turn,
  segments,
  expandedTools,
  onToggleTools,
}: {
  turn: Turn
  segments: SegmentInfo[]
  expandedTools: boolean
  onToggleTools: (next: boolean) => void
}): ReactElement {
  const attribution = turn.attribution
  return (
    <div>
      <section className="px-4 pt-3 pb-1 border-b-[0.5px] border-line-soft" aria-label={t("turns.title")}>
        <h3 className="flex items-baseline gap-2 mt-0 mb-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-dim">
          {t("turns.selected", { index: turn.index })}
          <span className="font-mono text-[10px] normal-case tracking-normal">{formatTime(turn.startedAt)}</span>
        </h3>
        {turn.userInput.length === 0 ? null : (
          <div className="ci-ask">
            <span className="ci-ask__label">{t("detail.userInput")}</span>
            <p className="ci-ask__text">{turn.userInput.join("\n")}</p>
          </div>
        )}
        <PartLegend attribution={attribution} />
        {attribution.reconciled === undefined ? null : (
          <p className="mt-1.5 mb-0 me-4 font-mono text-[10.5px] text-fg-dim">{formatFactor(attribution.reconciled.factor)}</p>
        )}
      </section>

      {turn.compactions.length === 0 ? null : (
        <section className="px-4 pt-3 pb-1 border-b-[0.5px] border-line-soft" aria-label={t("turns.compaction")}>
          <h3 className="flex items-baseline gap-2 mt-0 mb-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-dim">{t("turns.compaction")}</h3>
          <ul className="m-0 p-0 list-none">
            {turn.compactions.map((point, order) => (
              <li className="flex flex-wrap items-baseline gap-2 py-1 text-[11px] border-b-[0.5px] border-line-soft" key={`${String(point.at)}-${String(order)}`}>
                <span className="font-mono text-[10px] text-fg-dim">{formatTime(point.at)}</span>
                <MeasureValue measure={point.before} />
                <span aria-hidden="true">→</span>
                <MeasureValue measure={point.after} />
                <span className="text-fg-dim text-[10.5px] my-1.5">
                  {point.replacedHistory ? t("turns.compactionReplaced") : t("turns.compactionContinued")}
                </span>
                {point.trigger === undefined ? null : <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-bg-2 text-fg-dim">{point.trigger}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="px-4 pt-3 pb-1 border-b-[0.5px] border-line-soft" aria-label={t("turns.tools")}>
        <h3 className="flex items-baseline gap-2 mt-0 mb-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-dim">
          {t("turns.tools")}
          <span className="font-mono text-[10px] normal-case tracking-normal">{turn.toolCalls.length}</span>
        </h3>
        <ToolCalls calls={turn.toolCalls} expanded={expandedTools} onToggleExpanded={onToggleTools} />
      </section>

      <SubagentTree segments={segments} turnSubagents={turn.subagents} />
    </div>
  )
}

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
    setBoot({ kind: "loading" })
    const refresh = reloadToken > 0
    void Promise.all([api.sources(controller.signal), api.workdirs(controller.signal, refresh)]).then(
      ([sources, workdirs]) => {
        if (controller.signal.aborted) return
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

  const retry = useCallback(() => setReloadToken((token) => token + 1), [])

  const costs = useMemo(() => {
    if (cost === null) return undefined
    const map = new Map<number, CostTurnValue>()
    for (const line of cost.turns) map.set(line.index, line)
    return map
  }, [cost])
  const currentTurn = detail.kind === "ready" ? detail.turns.find((turn) => turn.index === selectedTurn) : undefined
  const sourceEntries = boot.kind === "ready" ? boot.sources : []
  const anySource = sourceEntries.some((entry) => entry.available)
  const failures = [
    ...(boot.kind === "ready" ? boot.failures : []),
    ...(sessionList.kind === "ready" ? sessionList.failures : []),
  ]

  return (
    <div
      className="ci-panel grid grid-rows-[auto_minmax(0,1fr)] h-full min-h-0 bg-bg text-fg text-[12.5px] leading-[1.55]"
      data-dsh-context-insight-view=""
    >
      <header className="flex items-center gap-3 px-4 py-2.5 border-b-[0.5px] border-line bg-bg-1 min-w-0">
        <h1 className="m-0 text-[13px] font-semibold tracking-[0.01em] whitespace-nowrap">{t("entry.label")}</h1>
        {boot.kind === "ready" ? <SourceStrip sources={sourceEntries} /> : null}
        <button type="button" className="px-2.5 py-1 rounded-[6px] border-[0.5px] border-line bg-transparent text-fg font-[inherit] text-[11px] cursor-pointer enabled:hover:border-accent disabled:opacity-50 disabled:cursor-default ms-auto" onClick={() => setSearchOpen(true)}>
          {t("search.open")}
        </button>
        <button type="button" className="px-2.5 py-1 rounded-[6px] border-[0.5px] border-line bg-transparent text-fg font-[inherit] text-[11px] cursor-pointer enabled:hover:border-accent disabled:opacity-50 disabled:cursor-default ms-auto" onClick={retry}>
          {t("panel.refresh")}
        </button>
      </header>

      {boot.kind === "loading" ? (
        <div className="grid grid-cols-[300px_minmax(0,1fr)] min-h-0">
          <aside className="grid grid-rows-[minmax(0,1fr)] border-e-[0.5px] border-line bg-sidebar min-h-0">
            <ProjectTree api={api} workdirs={[]} selected={selected} onSelect={setSelected} loading />
          </aside>
          <main className="min-w-0 min-h-0 overflow-hidden">
            <SkeletonDetail label={t("panel.loading")} />
          </main>
        </div>
      ) : null}
      {boot.kind === "failed" ? (
        <ErrorBlock title={t("session.error", { detail: boot.detail ?? boot.error })} onRetry={retry} />
      ) : null}

      {boot.kind === "ready" ? (
        boot.workdirs.length === 0 ? (
          <div className="p-2">
            <EmptyBlock title={t("workdirs.empty")} hint={t("empty.noData")} />
            {anySource ? null : <Notice>{t("empty.noSources")}</Notice>}
            {failures.map((problem) => (
              <Notice key={`boot-${problem.source}`}>
                {problem.source}: {problem.error}
              </Notice>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-[300px_minmax(0,1fr)] min-h-0">
            <aside className="grid grid-rows-[minmax(0,1fr)] border-e-[0.5px] border-line bg-sidebar min-h-0">
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
            </aside>

            <main className="min-w-0 min-h-0 overflow-hidden">
              {detail.kind === "idle" ? <EmptyBlock title={t("sessions.empty")} /> : null}
              {detail.kind === "loading" ? <SkeletonDetail label={t("session.loading")} /> : null}
              {detail.kind === "failed" ? (
                <ErrorBlock
                  title={t("session.error", { detail: failureText(detail.failure) })}
                  onRetry={() => {
                    const ref = detail.ref
                    setSelected(null)
                    window.setTimeout(() => setSelected(ref), 0)
                  }}
                />
              ) : null}
              {detail.kind === "ready" ? (
                <article className="grid grid-rows-[auto_minmax(0,1fr)] h-full min-h-0" aria-label={detail.data.session.title ?? detail.ref.id}>
                  <SessionHead
                    data={detail.data}
                    cost={cost}
                    onHandoff={() => setHandoffFor({ source: detail.ref.source, id: detail.ref.id })}
                  />
                  {detail.turns.length === 0 ? (
                    <EmptyBlock title={t("session.noTurns")} hint={t("session.noTurnsHint")} />
                  ) : (
                    <div className="grid grid-cols-[380px_minmax(0,1fr)] min-h-0">
                      <div className="grid grid-rows-[auto_minmax(0,1fr)_auto] border-e-[0.5px] border-line min-h-0 min-w-0">
                        <Waterfall turns={detail.turns} selected={selectedTurn} />
                        <TurnList
                          turns={detail.turns}
                          selected={selectedTurn}
                          onSelect={setSelectedTurn}
                          costs={costs}
                        />
                        <footer className="flex items-center justify-between gap-2 px-3.5 py-1.5 border-t-[0.5px] border-line-soft text-[10.5px]">
                          <span className="text-fg-dim text-[10.5px] my-1.5">
                            {t("session.paging", {
                              from: detail.turns.length === 0 ? 0 : 1,
                              to: detail.turns.length,
                              total: detail.data.turnCount,
                            })}
                          </span>
                          {detail.turns.length < detail.data.turnCount ? (
                            <button type="button" className="px-2.5 py-1 rounded-[6px] border-[0.5px] border-line bg-bg-2 text-fg font-[inherit] text-[11px] cursor-pointer enabled:hover:border-accent disabled:opacity-50 disabled:cursor-default" onClick={loadMore} disabled={detail.loadingMore}>
                              {detail.loadingMore ? t("session.loadingMore") : t("session.loadMore")}
                            </button>
                          ) : null}
                        </footer>
                        {detail.moreFailure === undefined ? null : <Notice>{failureText(detail.moreFailure)}</Notice>}
                      </div>
                      <div className="overflow-y-auto min-h-0 pt-1 pb-6">
                        {currentTurn === undefined ? (
                          <EmptyBlock title={t("turns.hint")} />
                        ) : (
                          <TurnDetail
                            turn={currentTurn}
                            segments={detail.data.session.segments}
                            expandedTools={toolsExpanded}
                            onToggleTools={setToolsExpanded}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </article>
              ) : null}
            </main>
          </div>
        )
      ) : null}

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
