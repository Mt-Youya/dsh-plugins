/**
 * The loaded session pane: header and tiles on top, then the turn strip beside
 * the open turn.
 *
 * At container widths of 48rem and up the two columns scroll independently
 * under a fixed header; below that the pane is one column that scrolls as a
 * whole, so nothing is ever clipped out of reach.
 *
 * @module @cyrus/dsh-context-insight/client/session-pane
 */

import type { ReactElement } from "react"
import type { Turn } from "@cyrus/dsh-session-contract"
import type { CostTurnValue, CostValue, SessionDetail } from "../../protocol.ts"
import type { ApiFailure } from "../api.ts"
import { failureText } from "../api.ts"
import { t } from "../locale.ts"
import { SessionHead } from "./session-head.tsx"
import { EmptyBlock, Notice } from "./states.tsx"
import { TurnDetail } from "./turn-detail.tsx"
import { TurnList } from "./turn-list.tsx"
import { Waterfall } from "./waterfall.tsx"

/** One session as far as it has been read: the first page plus appends. */
export interface LoadedSession {
  data: SessionDetail
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
}: {
  session: LoadedSession
  title: string
  cost: CostValue | null
  costs: ReadonlyMap<number, CostTurnValue> | undefined
  selectedTurn: number | null
  onSelectTurn: (index: number) => void
  toolsExpanded: boolean
  onToggleTools: (next: boolean) => void
  onLoadMore: () => void
  onHandoff: () => void
}): ReactElement {
  const currentTurn = session.turns.find((turn) => turn.index === selectedTurn)
  return (
    <article
      className="flex h-full min-h-0 flex-col overflow-y-auto @3xl:overflow-hidden"
      aria-label={title}
    >
      <SessionHead data={session.data} turns={session.turns} cost={cost} onHandoff={onHandoff} />
      {session.turns.length === 0 ? (
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
    </article>
  )
}

