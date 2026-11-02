/**
 * The loaded session pane: header and tiles on top, then the turn strip beside
 * the open turn.
 *
 * At container widths of 48rem and up the two columns scroll independently
 * under a fixed header; below that the pane is one column that scrolls as a
 * whole, so nothing is ever clipped out of reach.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/client/session-pane
 */

import type { Turn } from "@cyrusdoyle/dsh-session-contract"
import { useId, useState } from "react"
import type { ReactElement } from "react"

import type { CostTurnValue, CostValue, SessionDetail } from "../../protocol.ts"
import type { SessionInsights } from "../../protocol/insights.ts"
import { skillsOfTurns } from "../../shared/skill-evidence.ts"
import type { ApiFailure } from "../api.ts"
import { failureText } from "../api.ts"
import { insightLabel } from "../insight-labels.ts"
import { t } from "../locale.ts"
import { sessionOverviewState } from "../state/session-insights.ts"
import { SessionHead } from "./session-head.tsx"
import { SessionOverview } from "./session-overview.tsx"
import { SkillUsage } from "./skill-usage.tsx"
import { EmptyBlock, Notice } from "./states.tsx"
import { TurnDetail } from "./turn-detail.tsx"
import { TurnList } from "./turn-list.tsx"
import { Waterfall } from "./waterfall.tsx"

/** One session as far as it has been read: the first page plus appends. */
export interface LoadedSession {
  data: SessionDetail & { insights?: SessionInsights }
  turns: Turn[]
  loadingMore: boolean
  moreFailure?: ApiFailure
}

/**
 * The loaded session: header on top, the turn strip and the open turn below.
 * @param props.session - the loaded page(s) of one session.
 * @param props.title - accessible name for the article.
 * @returns the pane body.
 */
export function SessionPane({
  session,
  title,
  cost,
  costs,
  selectedTurn,
  onSelectTurn,
  toolsExpanded,
  onToggleTools,
  onLoadMore,
  onHandoff,
  onOpenSession,
  onJumpTurn,
  revealTurns = false,
}: {
  session: LoadedSession
  title: string
  cost: CostValue | null
  costs: ReadonlyMap<number, CostTurnValue> | undefined
  selectedTurn: number | null
  onSelectTurn: (index: number) => void
  onJumpTurn?: (index: number) => void
  revealTurns?: boolean
  toolsExpanded: boolean
  onToggleTools: (next: boolean) => void
  onLoadMore: () => void
  onHandoff: () => void
  onOpenSession?: (id: string) => void | Promise<void>
}): ReactElement {
  const id = useId()
  const sessionKey = `${session.data.session.source}:${session.data.session.id}`
  const [view, setView] = useState({ sessionKey, selectedTurn, tab: revealTurns ? "turns" : "overview" })
  // Ignore the automatic first selection; subsequent external jumps reveal turns.
  let tab = view.tab
  if (view.sessionKey !== sessionKey) {
    tab = "overview"
    setView({ sessionKey, selectedTurn, tab })
  } else if (view.selectedTurn !== selectedTurn) {
    if (view.selectedTurn !== null && selectedTurn !== null) tab = "turns"
    setView({ sessionKey, selectedTurn, tab })
  }
  const jump = (index: number): void => {
    setView({ sessionKey, selectedTurn, tab: "turns" })
    if (onJumpTurn !== undefined) onJumpTurn(index)
    else onSelectTurn(index)
  }
  const currentTurn = session.turns.find((turn) => turn.index === selectedTurn)
  const tabs = ["overview", "turns", "skills"] as const
  return (
    <article className="flex h-full min-h-0 flex-col overflow-y-auto @3xl:overflow-hidden" aria-label={title}>
      <SessionHead
        onOpenSession={onOpenSession}
        data={session.data}
        turns={session.turns}
        cost={cost}
        onHandoff={onHandoff}
      />
      <div
        role="tablist"
        aria-label={insightLabel("insights.tabs")}
        className="flex shrink-0 gap-2 overflow-x-auto border-b border-line-soft px-5 py-2"
      >
        {tabs.map((name, position) => (
          <button
            key={name}
            id={`${id}-${name}`}
            type="button"
            role="tab"
            aria-selected={tab === name}
            aria-controls={`${id}-content`}
            tabIndex={tab === name ? 0 : -1}
            className={
              tab === name ? "ci-btn min-h-10 bg-bg-2 text-accent active:bg-bg-3" : "ci-btn min-h-10 active:bg-bg-3"
            }
            onClick={() => setView({ sessionKey, selectedTurn, tab: name })}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (position + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (position + tabs.length - 1) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : undefined
              if (next === undefined) return
              event.preventDefault()
              setView({ sessionKey, selectedTurn, tab: tabs[next]! })
              const target =
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]
              target?.focus()
            }}
          >
            {insightLabel(`insights.${name}`)}
          </button>
        ))}
      </div>
      <div
        id={`${id}-content`}
        role="tabpanel"
        aria-labelledby={`${id}-${tab}`}
        tabIndex={0}
        className="ci-scroll flex min-h-0 min-w-0 flex-1 flex-col @3xl:overflow-y-auto"
      >
        {tab === "overview" ? (
          <SessionOverview
            insights={session.data.insights}
            overview={sessionOverviewState({
              insights: session.data.insights,
              turns: session.turns,
              turnCount: session.data.turnCount,
              cost,
            })}
            onJumpTurn={jump}
            onLoadMore={onLoadMore}
            loadingMore={session.loadingMore}
            pagingFailure={
              session.moreFailure === undefined ? undefined : <Notice>{failureText(session.moreFailure)}</Notice>
            }
          />
        ) : tab === "skills" ? (
          <SkillUsage
            key={sessionKey}
            skills={session.data.insights?.skills ?? skillsOfTurns(session.turns, session.data.session.workdir)}
            onJumpTurn={jump}
            loadedTurns={session.data.insights === undefined ? session.turns.length : undefined}
            totalTurns={session.data.turnCount}
            onLoadMore={onLoadMore}
            loadingMore={session.loadingMore}
          />
        ) : session.turns.length === 0 ? (
          <EmptyBlock title={t("session.noTurns")} hint={t("session.noTurnsHint")} center />
        ) : (
          <div className="flex flex-col @3xl:grid @3xl:min-h-0 @3xl:flex-1 @3xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
            {/* Chart and paging footer stay put; only the turn list scrolls. */}
            <div className="flex min-w-0 flex-col border-line-soft @3xl:min-h-0 @3xl:border-e">
              <div className="shrink-0 border-b border-line-soft">
                <Waterfall turns={session.turns} selected={selectedTurn} onSelect={onSelectTurn} />
              </div>
              <div className="ci-scroll @3xl:min-h-0 @3xl:flex-1 @3xl:overflow-y-auto @3xl:overscroll-contain">
                <TurnList turns={session.turns} selected={selectedTurn} onSelect={onSelectTurn} costs={costs} />
              </div>
              <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-line-soft px-3.5 py-2 text-[11px] text-fg-dim">
                <span className="tabular-nums">
                  {t("session.paging", {
                    from: session.turns.length === 0 ? 0 : 1,
                    to: session.turns.length,
                    total: session.data.turnCount,
                  })}
                </span>
                {session.turns.length < session.data.turnCount ? (
                  <button type="button" className="ci-btn" onClick={onLoadMore} disabled={session.loadingMore}>
                    {session.loadingMore ? t("session.loadingMore") : t("session.loadMore")}
                  </button>
                ) : null}
              </footer>
              {session.moreFailure === undefined ? null : (
                <div className="px-3 pb-3">
                  <Notice>{failureText(session.moreFailure)}</Notice>
                </div>
              )}
            </div>
            <div className="ci-scroll min-w-0 border-t border-line-soft @3xl:min-h-0 @3xl:overflow-y-auto @3xl:overscroll-contain @3xl:border-t-0">
              {currentTurn === undefined ? (
                <EmptyBlock title={t("turns.hint")} center />
              ) : (
                <TurnDetail
                  turn={currentTurn}
                  segments={session.data.session.segments}
                  expandedTools={toolsExpanded}
                  onToggleTools={onToggleTools}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
