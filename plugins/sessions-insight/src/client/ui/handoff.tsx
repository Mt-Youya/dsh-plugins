/**
 * The handoff dialog: preview the brief, pick the cwd, deliver it, and watch.
 *
 * The status line is the point of this component. `session.prompt` answers with
 * `accepted` long before any model has run, so the dialog shows
 * 「已投递，等待模型响应」 until a `turn/end` is observed, and only then either
 * 成功 (with the event's seq) or 失败 with the model-side reason and the fix
 * (docs/adr/0007-accepted-is-not-success.md).
 *
 * @module @cyrusdoyle/dsh-sessions-insight/client/handoff
 */

import { useEffect, useRef, useState } from "react"
import type { ReactElement } from "react"

import type { BriefValue, CostValue, HandoffStatusValue } from "../../protocol.ts"
import type { Api, ApiFailure } from "../api.ts"
import { formatMoney, formatTime } from "../format.ts"
import { t } from "../locale.ts"
import { Skeleton } from "./states.tsx"

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
  const base = "m-0 px-2.5 py-2 rounded-lg bg-bg-2 text-xs "
  if (state === "succeeded") return `${base}text-ok`
  if (state === "failed") return `${base}text-err`
  return `${base}text-warn`
}

export function HandoffDialog({
  api,
  source,
  id,
  onClose,
  onOpenSession,
}: {
  api: Api
  source: string
  id: string
  onClose: () => void
  onOpenSession?: (id: string) => void | Promise<void>
}): ReactElement {
  const [phase, setPhase] = useState<Phase>({ kind: "preparing" })
  const [cwd, setCwd] = useState("")
  const [briefText, setBriefText] = useState("")
  const [progressError, setProgressError] = useState("")
  const [openError, setOpenError] = useState("")
  const alive = useRef(true)
  const pollTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    alive.current = true
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
      alive.current = false
      controller.abort()
      if (pollTimer.current !== undefined) window.clearTimeout(pollTimer.current)
    }
  }, [api, source, id])

  function apply(brief: BriefValue): void {
    setPhase({ kind: "applying", brief })
    void api.handoffApply({ source, id, cwd, brief: briefText }).then((result) => {
      if (!alive.current) return
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
          if (!alive.current) return
          if (!next.ok) {
            setProgressError(next.detail ?? next.error)
            pollTimer.current = window.setTimeout(poll, afterMs)
            return
          }
          setProgressError("")
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
      className="fixed inset-0 z-60 flex items-center justify-center bg-[rgb(0_0_0/55%)] p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="grid max-h-[90dvh] w-[min(820px,94vw)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[10px] border-[0.5px] border-line bg-bg-1 shadow-[0_18px_48px_rgb(0_0_0/50%)]"
        role="dialog"
        aria-modal="true"
        aria-label={t("handoff.title")}
      >
        <header className="flex items-center gap-3 border-b border-line-soft px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[16px] font-semibold text-fg">{t("handoff.title")}</span>
            <span className="text-[11px] text-fg-dim">
              {source} · {id.slice(0, 8)}
            </span>
          </div>
          <button
            type="button"
            className="ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50"
            onClick={onClose}
          >
            Esc
          </button>
        </header>

        {phase.kind === "preparing" ? (
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-5" role="status" aria-busy="true">
            <p className="m-0 flex items-center gap-2 text-[12px] text-fg-dim">
              <span className="size-1.5 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden="true" />
              {t("handoff.preparing")}
            </p>
            <Skeleton className="h-10 shrink-0 rounded-lg" />
            <Skeleton className="h-3 w-3/4 shrink-0 rounded-sm" />
            <Skeleton className="h-5 w-1/2 shrink-0 rounded-sm" />
            <Skeleton className="h-[min(300px,42dvh)] shrink-0 rounded-lg" />
            <div className="border-t border-line-soft pt-3" aria-hidden="true">
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>
          </div>
        ) : null}
        {phase.kind === "preview-failed" ? (
          <p>{t("session.error", { detail: phase.failure.detail ?? phase.failure.error })}</p>
        ) : null}

        {phase.kind === "ready" || phase.kind === "applying" || phase.kind === "apply-failed" ? (
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-5">
            <label className="flex flex-col gap-2 text-[12px] text-fg">
              <span>{t("handoff.cwd")}</span>
              <input
                className="w-full min-w-0 rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-[12px] text-fg"
                value={cwd}
                onChange={(event) => setCwd(event.target.value)}
                spellCheck={false}
                aria-describedby="ci-handoff-cwd-hint"
              />
            </label>
            <p className="m-0 text-[11px] leading-relaxed text-fg-dim" id="ci-handoff-cwd-hint">
              {t("handoff.cwdHint")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim">
                {t("handoff.files", { count: phase.brief.fileCount })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim">
                {t("handoff.decisions", { count: phase.brief.decisionCount })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim">
                {t("handoff.open", { count: phase.brief.openCount })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim">
                {t("handoff.commands", { count: phase.brief.commandCount })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim">
                {t("handoff.chars", { count: phase.brief.chars })}
              </span>
            </div>
            <label className="flex flex-col gap-2 text-[12px] text-fg">
              <span>{t("handoff.brief")}</span>
              <textarea
                className="box-border max-h-[42dvh] min-h-40 w-full resize-y rounded-lg border border-line bg-bg p-3 font-mono text-[12px] leading-relaxed text-fg"
                value={briefText}
                onChange={(event) => setBriefText(event.target.value)}
                spellCheck={false}
                rows={14}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-accent bg-accent px-4 py-2.5 font-[inherit] text-[12px] font-medium text-white enabled:hover:brightness-110 disabled:cursor-default disabled:opacity-50"
                onClick={() => apply(phase.brief)}
                disabled={phase.kind === "applying" || cwd.trim() === "" || briefText.trim() === ""}
              >
                {phase.kind === "applying" ? t("handoff.applying") : t("handoff.apply")}
              </button>
              <button
                type="button"
                className="ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50"
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
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-5">
            <p className={stateClass(phase.status.state)} data-state={phase.status.state}>
              {stateLabel(phase.status)} · {phase.sessionId.slice(0, 12)}
            </p>
            <p className="m-0 text-[12px] text-fg-dim" role="status">
              {t("handoff.progress", {
                seconds: Math.floor(phase.status.elapsedMs / 1000),
                count: phase.status.progress?.toolsCompleted ?? 0,
              })}
            </p>
            {phase.status.state === "running" ? (
              <p className="m-0 text-[12px] text-fg">
                {phase.status.progress?.tool === "ask_user_question"
                  ? t("handoff.waiting")
                  : phase.status.progress?.tool
                    ? t("handoff.tool", { tool: phase.status.progress.tool })
                    : t("handoff.thinking")}
              </p>
            ) : null}
            {phase.status.progress === undefined ? null : (
              <p className="m-0 text-[11px] text-fg-dim">
                {t("handoff.updated", {
                  time: new Date(phase.status.progress.updatedAt).toLocaleTimeString(
                    t("handoff.language") === "zh" ? "zh-CN" : "en-US",
                  ),
                })}
              </p>
            )}
            {progressError === "" ? null : (
              <p className="m-0 text-[12px] text-warn" role="alert">
                {t("handoff.pollError", { detail: progressError })}
              </p>
            )}
            {openError === "" ? null : (
              <p className="m-0 text-[12px] text-err" role="alert">
                {t("handoff.openFailed", { detail: openError })}
              </p>
            )}
            {phase.status.reason === undefined ? null : (
              <p className="m-0 font-mono text-[11px] text-err">
                {t("handoff.reason", { reason: phase.status.reason })}
              </p>
            )}
            {phase.status.detail === undefined ? null : (
              <p className="my-1.5 text-[10.5px] text-fg-dim">{phase.status.detail}</p>
            )}
            {phase.status.seq === undefined ? null : (
              <p className="my-1.5 text-[10.5px] text-fg-dim">{t("handoff.evidence", { seq: phase.status.seq })}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-accent bg-accent px-4 py-2.5 text-[12px] text-white disabled:opacity-50"
                disabled={onOpenSession === undefined}
                onClick={() => {
                  setOpenError("")
                  void Promise.resolve()
                    .then(() => onOpenSession?.(phase.sessionId))
                    .then(onClose)
                    .catch((error: unknown) => {
                      if (alive.current) setOpenError(error instanceof Error ? error.message : String(error))
                    })
                }}
              >
                {t("handoff.openSession")}
              </button>
              <button
                type="button"
                className="ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50"
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
 * Amounts are never converted or added — a provider-billed USD turn and an
 * OpenRouter reference amount stay two numbers, each labelled by its symbol, with
 * every table's provenance and every unlisted channel in the tooltip. A `≥`
 * prefix marks a lower bound when the session's primary prices hit an unlisted
 * channel.
 * @param props.cost - the Host's cost answer.
 * @returns the chip row.
 */
export function CostBadge({ cost, plain = false }: { cost: CostValue; plain?: boolean }): ReactElement {
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
      className={
        plain
          ? "relative inline-flex items-baseline gap-1.5 whitespace-nowrap [&>span+span]:text-[11px] [&>span+span]:font-normal [&>span+span]:text-fg-dim"
          : "relative inline-flex items-center gap-1 rounded-sm border-[0.5px] border-line bg-transparent px-1.5 font-mono text-[10px] leading-4.25 whitespace-nowrap text-fg-dim data-[state=provisional]:border-dashed"
      }
      data-tip={tip}
      tabIndex={0}
      aria-label={tip === "" ? "cost" : tip}
    >
      {groups.length === 0 ? "—" : materialise()}
      {reference === undefined ? null : <span>{reference}</span>}
      {cost.provisional === true ? (
        <span className="ms-1 inline-flex items-center gap-1 rounded-sm border-[0.5px] border-dashed border-line bg-bg-2 px-1.25 text-[9.5px] leading-4.25 tracking-[0.02em] whitespace-nowrap text-fg-dim normal-case">
          {t("cost.provisional")}
        </span>
      ) : null}
    </span>
  )
}

/** Format a timestamp for the dialog footer. */
export const handoffTime = formatTime
