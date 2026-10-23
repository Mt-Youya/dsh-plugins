/**
 * Session head: identity and provenance on top, the headline numbers below.
 *
 * The tiles answer the four questions a reader opens a session with — how full
 * is the context now, how high did it get, how many times was it compacted,
 * and what did it cost — before they read a single row.
 *
 * @module @cyrus/dsh-sessions-insight/client/session-head
 */

import { useState } from "react"
import type { ReactElement } from "react"
import type { CostValue, SessionDetail } from "../../protocol.ts"
import type { Turn } from "@cyrus/dsh-session-contract"
import { compactTokens, formatBytes, formatShare, formatTime, tildePath } from "../format.ts"
import { sessionLabel } from "../labels.ts"
import { t } from "../locale.ts"
import { sessionStats } from "../state/session-stats.ts"
import { CostBadge } from "./handoff.tsx"
import { Glyph, SOURCE_MARKS, SourceIcon } from "./icons.tsx"
import { Chip, Stat } from "./primitives.tsx"

/** Window share above which the current-context gauge turns amber. */
const WINDOW_WARN = 0.8

/**
 * The head.
 * @param props.data - the detail page.
 * @param props.turns - turns loaded so far.
 * @param props.cost - the priced session, when the Host returned one.
 * @param props.onHandoff - open the handoff dialog.
 * @returns the header.
 */
export function SessionHead({
  data,
  turns,
  cost,
  onHandoff,
  onOpenSession,
}: {
  data: SessionDetail
  turns: readonly Turn[]
  cost: CostValue | null
  onHandoff: () => void
  onOpenSession?: (id: string) => void | Promise<void>
}): ReactElement {
  const [openError, setOpenError] = useState("")
  const session = data.session
  const label = sessionLabel({ title: session.title, firstInput: session.firstInput })
  const mark = SOURCE_MARKS[session.source]
  const stats = sessionStats(turns)
  const loadedAll = turns.length >= data.turnCount
  return (
    <header className="flex flex-col gap-3 px-5 pt-4 pb-4 border-b border-line-soft min-w-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="m-0 text-[16px] font-semibold leading-snug truncate" title={session.id}>
            {label.title}
          </h2>
          {label.detail === undefined ? null : (
            <p className="m-0 text-[12px] text-fg-dim truncate" title={label.detail}>
              {label.detail}
            </p>
          )}
          <p className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-fg-dim">
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: mark.brand }}>
              <SourceIcon source={session.source} size={12} />
              {mark.label.zh}
            </span>
            <span className="font-mono truncate max-w-[42ch]" title={session.workdir}>
              {session.workdir === "" ? t("workdirs.unknown") : tildePath(session.workdir)}
            </span>
            <span aria-hidden="true" className="text-fg-3">
              ·
            </span>
            <span className="tabular-nums">{formatTime(session.updatedAt)}</span>
            <span aria-hidden="true" className="text-fg-3">
              ·
            </span>
            <span className="tabular-nums">{formatBytes(data.meta.bytes)}</span>
            {data.meta.residualTurns > 0 ? (
              <Chip tone="warn" title={t("turns.unknownNote")}>
                {t("turns.unknown")} × {data.meta.residualTurns}
              </Chip>
            ) : null}
            {data.meta.reconciledTurns > 0 ? (
              <Chip title={t("stats.reconciledTurns", { count: data.meta.reconciledTurns })}>
                ×{data.meta.reconciledTurns}
              </Chip>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          className="ci-btn shrink-0"
          onClick={
            session.source !== "dsh"
              ? onHandoff
              : () => {
                  setOpenError("")
                  void Promise.resolve()
                    .then(() => {
                      if (onOpenSession === undefined) throw new Error("DSH navigation unavailable")
                      return onOpenSession(session.id)
                    })
                    .catch((error: unknown) => setOpenError(error instanceof Error ? error.message : String(error)))
                }
          }
        >
          <Glyph name="handoff" size={13} />
          {session.source === "dsh" ? t("handoff.openExisting") : t("handoff.button")}
        </button>
      </div>

      {openError === "" ? null : (
        <p className="m-0 text-[12px] text-err" role="alert">
          {t("handoff.openFailed", { detail: openError })}
        </p>
      )}
      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-2">
        <Stat
          label={t("stats.current")}
          value={compactTokens(stats.current)}
          {...(stats.windowShare === undefined ? {} : { meter: stats.windowShare })}
          tone={(stats.windowShare ?? 0) >= WINDOW_WARN ? "warn" : "accent"}
          hint={
            stats.window === undefined
              ? t("stats.noWindow")
              : t("stats.windowShare", {
                  share: formatShare(stats.current, stats.window),
                  size: compactTokens(stats.window),
                })
          }
        />
        <Stat
          label={t("stats.peak")}
          value={compactTokens(stats.peak)}
          hint={stats.peakTurn === undefined ? "—" : t("stats.peakAt", { index: stats.peakTurn })}
        />
        <Stat
          label={t("stats.turns")}
          value={String(data.turnCount)}
          hint={
            loadedAll
              ? t("stats.compactionsLine", { count: stats.compactions, tools: stats.toolCalls })
              : t("stats.loaded", { count: turns.length })
          }
        />
        <Stat
          label={t("stats.cost")}
          value={cost === null ? "—" : <CostBadge cost={cost} plain />}
          hint={
            cost === null
              ? t("stats.costPending")
              : cost.totals.unpricedTurns > 0
                ? t("cost.unpriced", { count: cost.totals.unpricedTurns })
                : t("stats.costPriced")
          }
        />
      </div>

      {session.dataQuality.length > 0 ? (
        <details className="ci-fold text-[11px] text-fg-dim">
          <summary className="inline-flex items-center gap-1">
            <Glyph name="chevron" size={11} className="ci-chevron" />
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
