/**
 * The handoff dialog: preview the brief, pick the cwd, deliver it, and watch.
 *
 * The status line is the point of this component. `session.prompt` answers with
 * `accepted` long before any model has run, so the dialog shows
 * 「已投递，等待模型响应」 until a `turn/end` is observed, and only then either
 * 成功 (with the event's seq) or 失败 with the model-side reason and the fix
 * (docs/adr/0007-accepted-is-not-success.md).
 *
 * @module @cyrus/dsh-context-insight/client/handoff
 */

import { useEffect, useRef, useState } from "react"
import type { ReactElement } from "react"
import type { BriefValue, CostValue, HandoffStatusValue } from "../../protocol.ts"
import type { Api, ApiFailure } from "../api.ts"
import { formatMoney, formatTime } from "../format.ts"
import { t } from "../locale.ts"

/** Where the dialog is in the handoff lifecycle. */
type Phase =
  | { kind: "preparing" }
  | { kind: "ready"; brief: BriefValue }
  | { kind: "preview-failed"; failure: ApiFailure }
  | { kind: "applying"; brief: BriefValue }
  | { kind: "applied"; sessionId: string; status: HandoffStatusValue }
  | { kind: "apply-failed"; brief: BriefValue; failure: ApiFailure }

const TERMINAL = new Set(["succeeded", "failed"])

/**
 * One handoff, start to finish.
 * @param props.api - client API.
 * @param props.source - source of the session being handed off.
 * @param props.id - that session's id.
 * @param props.onClose - close request.
 * @returns the dialog.
 */
/**
 * Colour the status line by state without a stylesheet.
 * @param state - delivered / running / succeeded / failed.
 */
function stateClass(state: string): string {
  const base = "m-0 px-2.5 py-2 rounded-lg border-s-[3px] bg-bg-2 text-xs "
  if (state === "succeeded") return base + "border-s-ok text-ok"
  if (state === "failed") return base + "border-s-err text-err"
  return base + "border-s-warn text-warn"
}

export function HandoffDialog({
  api,
  source,
  id,
  onClose,
}: {
  api: Api
  source: string
  id: string
  onClose: () => void
}): ReactElement {
  const [phase, setPhase] = useState<Phase>({ kind: "preparing" })
  const [cwd, setCwd] = useState("")
  const [briefText, setBriefText] = useState("")
  const pollTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    void api.handoffPrepare(source, id, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      if (!result.ok) {
        setPhase({ kind: "preview-failed", failure: result })
        return
      }
      setPhase({ kind: "ready", brief: result.value })
      setCwd(result.value.defaultCwd)
      setBriefText(result.value.brief)
    })
    return () => {
      controller.abort()
      if (pollTimer.current !== undefined) window.clearTimeout(pollTimer.current)
    }
  }, [api, source, id])

  function apply(brief: BriefValue): void {
    setPhase({ kind: "applying", brief })
    void api.handoffApply({ source, id, cwd, brief: briefText }).then((result) => {
      if (!result.ok) {
        setPhase({ kind: "apply-failed", brief, failure: result })
        return
      }
      const sessionId = result.value.sessionId
      const afterMs = result.value.pollAfterMs
      setPhase({
        kind: "applied",
        sessionId,
        status: { sessionId, state: "delivered", elapsedMs: 0 },
      })
      function poll(): void {
        void api.handoffStatus(sessionId).then((next) => {
          if (!next.ok) return
          setPhase({ kind: "applied", sessionId, status: next.value })
          if (!TERMINAL.has(next.value.state)) {
            pollTimer.current = window.setTimeout(poll, afterMs)
          }
        })
      }
      pollTimer.current = window.setTimeout(poll, afterMs)
    })
  }

  function stateLabel(status: HandoffStatusValue) {
    if (status.state === "delivered") return t("handoff.state.delivered")
    if (status.state === "running") return t("handoff.state.running")
    if (status.state === "succeeded") return t("handoff.state.succeeded")
    return t("handoff.state.failed")
  }

  return (
    <div
      className="fixed inset-0 z-60 bg-[rgb(0_0_0/55%)] flex items-start justify-center"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="w-[min(820px,94vw)] max-h-[82vh] grid grid-rows-[auto_minmax(0,1fr)] rounded-[10px] border-[0.5px] border-line bg-bg-1 shadow-[0_18px_48px_rgb(0_0_0/50%)] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t("handoff.title")}
      >
        <header>
          <span>{t("handoff.title")}</span>
          <span className="text-fg-dim text-[10.5px] my-1.5">
            {source} · {id.slice(0, 8)}
          </span>
          <button
            type="button"
            className="px-2.5 py-1 rounded-md border-[0.5px] border-line bg-transparent text-fg font-[inherit] text-[11px] cursor-pointer enabled:hover:border-accent disabled:opacity-50 disabled:cursor-default ms-auto"
            onClick={onClose}
          >
            Esc
          </button>
        </header>

        {phase.kind === "preparing" ? <p>{t("handoff.preparing")}</p> : null}
        {phase.kind === "preview-failed" ? (
          <p>{t("session.error", { detail: phase.failure.detail ?? phase.failure.error })}</p>
        ) : null}

        {phase.kind === "ready" || phase.kind === "applying" || phase.kind === "apply-failed" ? (
          <div className="flex flex-col gap-2 px-3 pt-2.5 pb-3 overflow-y-auto min-h-0">
            <label className="flex flex-col gap-1 text-[11px] text-fg-dim">
              <span>{t("handoff.cwd")}</span>
              <input
                value={cwd}
                onChange={(event) => setCwd(event.target.value)}
                spellCheck={false}
                aria-describedby="ci-handoff-cwd-hint"
              />
            </label>
            <p className="text-fg-dim text-[10.5px] my-1.5" id="ci-handoff-cwd-hint">
              {t("handoff.cwdHint")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-sm px-1.5 text-[10px] leading-4.25 whitespace-nowrap bg-bg-2 text-fg-dim">
                {t("handoff.files", { count: phase.brief.fileCount })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm px-1.5 text-[10px] leading-4.25 whitespace-nowrap bg-bg-2 text-fg-dim">
                {t("handoff.decisions", { count: phase.brief.decisionCount })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm px-1.5 text-[10px] leading-4.25 whitespace-nowrap bg-bg-2 text-fg-dim">
                {t("handoff.open", { count: phase.brief.openCount })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm px-1.5 text-[10px] leading-4.25 whitespace-nowrap bg-bg-2 text-fg-dim">
                {t("handoff.commands", { count: phase.brief.commandCount })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm px-1.5 text-[10px] leading-4.25 whitespace-nowrap bg-bg-2 text-fg-dim">
                {t("handoff.chars", { count: phase.brief.chars })}
              </span>
            </div>
            <label className="flex flex-col gap-1 text-[11px] text-fg-dim">
              <span>{t("handoff.brief")}</span>
              <textarea
                className="font-mono text-[11.5px] leading-normal resize-y min-h-50"
                value={briefText}
                onChange={(event) => setBriefText(event.target.value)}
                spellCheck={false}
                rows={14}
              />
            </label>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                className="px-2.5 py-1 rounded-md border-[0.5px] border-line bg-bg-2 text-fg font-[inherit] text-[11px] cursor-pointer enabled:hover:border-accent disabled:opacity-50 disabled:cursor-default"
                onClick={() => apply(phase.brief)}
                disabled={phase.kind === "applying" || cwd.trim() === "" || briefText.trim() === ""}
              >
                {phase.kind === "applying" ? t("handoff.applying") : t("handoff.apply")}
              </button>
              <button
                type="button"
                className="px-2.5 py-1 rounded-md border-[0.5px] border-line bg-transparent text-fg font-[inherit] text-[11px] cursor-pointer enabled:hover:border-accent disabled:opacity-50 disabled:cursor-default ms-auto"
                disabled
                title={t("handoff.polishUnavailable")}
              >
                {t("handoff.polish")}
              </button>
            </div>
            {phase.kind === "apply-failed" ? (
              <p>{t("handoff.applyFailed", { detail: phase.failure.detail ?? phase.failure.error })}</p>
            ) : null}
          </div>
        ) : null}

        {phase.kind === "applied" ? (
          <div className="flex flex-col gap-2 px-3 pt-2.5 pb-3 overflow-y-auto min-h-0">
            <p className={stateClass(phase.status.state)} data-state={phase.status.state}>
              {stateLabel(phase.status)} · {phase.sessionId.slice(0, 12)}
            </p>
            <p className="text-fg-dim text-[10.5px] my-1.5">{t("handoff.polling")}</p>
            {phase.status.reason === undefined ? null : (
              <p className="m-0 font-mono text-[11px] text-err">
                {t("handoff.reason", { reason: phase.status.reason })}
              </p>
            )}
            {phase.status.detail === undefined ? null : (
              <p className="text-fg-dim text-[10.5px] my-1.5">{phase.status.detail}</p>
            )}
            {phase.status.seq === undefined ? null : (
              <p className="text-fg-dim text-[10.5px] my-1.5">{t("handoff.evidence", { seq: phase.status.seq })}</p>
            )}
            <div className="flex gap-2 items-center">
              <button
                type="button"
                className="px-2.5 py-1 rounded-md border-[0.5px] border-line bg-transparent text-fg font-[inherit] text-[11px] cursor-pointer enabled:hover:border-accent disabled:opacity-50 disabled:cursor-default ms-auto"
                onClick={onClose}
              >
                {t("handoff.close")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Cost line for one session: one amount per `(table, currency)` group, plus the
 * OpenRouter reference amount.
 *
 * Amounts are never converted or added — a relay-billed CNY turn and a
 * provider-billed USD turn stay two numbers, each labelled by its symbol, with
 * every table's provenance and every unlisted channel in the tooltip. A `≥`
 * prefix marks a lower bound when the session's primary prices hit an unlisted
 * channel.
 * @param props.cost - the Host's cost answer.
 * @returns the chip row.
 */
export function CostBadge({ cost }: { cost: CostValue }): ReactElement {
  const groups = cost.groups ?? []
  function materialise(): ReactElement[] {
    return groups.map((group) => (
      <span key={group.tableId + group.currency}>
        {cost.partial === true && groups.length === 1 ? t("cost.partialPrefix") : ""}
        {formatMoney(group.amount, group.currency)}
      </span>
    ))
  }
  const referenceEntries = Object.entries(cost.reference?.byCurrency ?? {})
  const reference =
    referenceEntries.length === 1 && referenceEntries[0] !== undefined
      ? t("cost.reference", { amount: formatMoney(referenceEntries[0][1].amount, referenceEntries[0][0]) })
      : undefined
  const lines: string[] = []
  const used = new Set(groups.map((group) => group.tableId))
  if (cost.reference !== undefined && cost.reference !== null) used.add(cost.reference.tableId)
  for (const id of used) {
    const table = cost.tables?.[id]
    if (table === undefined) continue
    lines.push(t("cost.tableLine", { id, source: table.pricing.source ?? "—", asOf: table.pricing.asOf }))
  }
  const channels = cost.unlistedChannels ?? []
  if (channels.length > 0) lines.push(t("cost.unlistedTip", { channels: channels.join("、") }))
  lines.push(t("cost.noConvert"))
  const tip = lines.join(" · ")
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 text-[10px] leading-4.25 whitespace-nowrap bg-transparent text-fg-dim font-mono border-[0.5px] border-line data-[state=provisional]:border-dashed"
      data-tip={tip}
      tabIndex={0}
      aria-label={tip === "" ? "cost" : tip}
    >
      {groups.length === 0 ? "—" : materialise()}
      {reference === undefined ? null : <span>{reference}</span>}
      {cost.provisional === true ? (
        <span className="inline-flex items-center gap-1 rounded-sm px-1.25 text-[9.5px] leading-[17px] whitespace-nowrap bg-bg-2 text-fg-dim tracking-[0.02em] border-[0.5px] border-dashed border-line normal-case ms-1">
          {t("cost.provisional")}
        </span>
      ) : null}
    </span>
  )
}

/** Format a timestamp for the dialog footer. */
export const handoffTime = formatTime
