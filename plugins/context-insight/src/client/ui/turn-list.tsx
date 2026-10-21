/**
 * The turn strip: one row per turn, with compaction boundaries interleaved.
 *
 * Compactions arrive in bursts — the demo session logs 34 of them across 10
 * turns — so all boundaries of one turn collapse into a single row showing the
 * count and the net transition; the individual before/after pairs are one
 * disclosure away.
 *
 * Two honesty rules live in the row itself: a turn that kept a `residual` shows
 * its unknown share as a chip (never folded into the bar), and a turn whose
 * slices were scaled shows the factor. When the Host priced the session, the row
 * also carries that turn's cost, with the price-table provenance in its tooltip.
 *
 * Rows are real buttons, so keyboard navigation costs nothing; Arrow/Home/End
 * move the focus ring. The list only ever receives one page of turns (the Host
 * slices), which keeps a several-hundred-turn session from rendering in one go.
 *
 * @module @cyrus/dsh-context-insight/client/turn-list
 */

import type { KeyboardEvent, ReactElement } from "react"
import type { CompactionPoint, Turn } from "@cyrus/dsh-session-contract"
import type { CostTurnValue } from "../../protocol.ts"
import { compactTokens, formatShare, formatTime, formatUsd } from "../format.ts"
import { t } from "../locale.ts"
import { StackedBar, barLayout } from "./stacked-bar.tsx"
import { buildTurnRows } from "../state/turn-rows.ts"

/**
 * One turn's compaction boundaries, collapsed.
 * @param props.points - every boundary recorded in this turn.
 * @param props.turn - the turn that carries them.
 * @returns the divider row.
 */
function CompactionsRow({ points, turn }: { points: CompactionPoint[]; turn: Turn }): ReactElement {
  const first = points[0]
  const last = points[points.length - 1]
  const range =
    first === undefined || last === undefined
      ? ""
      : t("compactions.range", {
          before: compactTokens(first.before.tokens),
          after: compactTokens(last.after.tokens),
        })
  return (
    <li className="py-0.5 pe-2 ps-[30px] text-[10px] text-fg-dim" data-turn={turn.index}>
      <details className="border-s border-dashed border-warn ps-2">
        <summary className="flex flex-wrap items-baseline gap-1.5 cursor-pointer min-w-0">
          {/* Empty span kept on purpose: it is one of the summary's flex items,
              so removing it would shift the row by one gap. */}
          <span aria-hidden="true" />
          <span className="text-warn font-semibold">{t("compactions.count", { count: points.length })}</span>
          <span className="font-mono text-warn">{range}</span>
          <span className="opacity-75">
            {first?.replacedHistory === true ? t("turns.compactionReplaced") : t("turns.compactionContinued")}
          </span>
        </summary>
        <ul className="mt-1 mb-0.5 p-0 list-none">
          {points.map((point, order) => (
            <li className="flex flex-wrap gap-2 py-px" key={`${String(point.at)}-${String(order)}`}>
              <span className="font-mono">{formatTime(point.at)}</span>
              <span className="font-mono">
                {t("compactions.range", {
                  before: compactTokens(point.before.tokens),
                  after: compactTokens(point.after.tokens),
                })}
              </span>
              <span className="text-fg-dim text-[10.5px] my-1.5">
                {point.replacedHistory ? t("turns.compactionReplaced") : t("turns.compactionContinued")}
                {point.trigger === undefined ? "" : ` · ${point.trigger}`}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  )
}

/**
 * One turn row.
 * @param props.turn - the turn.
 * @param props.selected - whether this row is the open one.
 * @param props.onSelect - selection callback.
 * @param props.onKeyNav - arrow-key handler, shared by every row.
 * @param props.cost - this turn's priced line, when the Host returned one.
 * @returns the row button.
 */
function TurnRow({
  turn,
  selected,
  onSelect,
  onKeyNav,
  cost,
}: {
  turn: Turn
  selected: boolean
  onSelect: (index: number) => void
  onKeyNav: (event: KeyboardEvent<HTMLElement>, delta: number | "first" | "last") => void
  cost?: CostTurnValue
}): ReactElement {
  const layout = barLayout(turn.attribution)
  const unknown = layout.residual > 0 ? formatShare(layout.residual, layout.denominator) : undefined
  const tools = turn.toolCalls.length
  const summary = `${t("turns.selected", { index: turn.index })}: ${compactTokens(turn.attribution.total.tokens)}`
  return (
    <li data-turn={turn.index}>
      <button
        type="button"
        className={
          selected
            ? "grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2 w-full border-0 rounded-[6px] px-2 py-1.5 my-px text-left cursor-pointer pointer-fine:hover:bg-bg-2 bg-bg-2 shadow-[inset_2px_0_0_var(--color-accent)]"
            : "grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2 w-full border-0 rounded-[6px] px-2 py-1.5 my-px text-left cursor-pointer pointer-fine:hover:bg-bg-2"
        }
        aria-pressed={selected}
        onClick={() => onSelect(turn.index)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") onKeyNav(event, 1)
          else if (event.key === "ArrowUp") onKeyNav(event, -1)
          else if (event.key === "Home") onKeyNav(event, "first")
          else if (event.key === "End") onKeyNav(event, "last")
        }}
      >
        <span className="font-mono text-[11px] text-fg-dim text-right">{turn.index}</span>
        <span className="flex flex-col gap-[3px] min-w-0">
          <span className="flex items-center gap-[5px] text-[10px] text-fg-dim overflow-hidden">
            <span className="whitespace-nowrap">{formatTime(turn.startedAt)}</span>
            {turn.userInput.length === 0 ? null : (
              <span className="truncate opacity-80">{turn.userInput.join(" ").slice(0, 48)}</span>
            )}
            {unknown === undefined ? null : (
              <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-warn border-[0.5px] border-dashed border-warn" title={t("turns.unknownNote")}>
                {t("turns.unknown")} {unknown}
              </span>
            )}
            {turn.attribution.reconciled === undefined ? null : (
              <span
                className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-fg-dim border-[0.5px] border-line"
                title={t("turns.reconciled", { factor: turn.attribution.reconciled.factor.toFixed(3) })}
              >
                ×{turn.attribution.reconciled.factor.toFixed(2)}
              </span>
            )}
            {tools === 0 ? null : (
              <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-fg-dim border-[0.5px] border-line-soft">
                {t("turns.tools")} {tools}
              </span>
            )}
            {turn.subagents.length === 0 ? null : (
              <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-fg-dim border-[0.5px] border-line-soft">
                {t("turns.subagents")} {turn.subagents.length}
              </span>
            )}
            {cost === undefined ? null : (
              <span
                className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-fg-dim font-mono border-[0.5px] border-line data-[state=provisional]:border-dashed"
                data-state={cost.provisional === true ? "provisional" : "settled"}
                data-tip={
                  t("cost.turnTip", {
                    index: turn.index,
                    model: cost.model ?? "—",
                    rate: cost.cacheHitRate === null ? "—" : Math.round(cost.cacheHitRate * 100) + "%",
                  }) + (cost.provisional === true ? " · " + t("cost.provisional") : "")
                }
                tabIndex={0}
              >
                {cost.usd === null ? t("cost.null") : (cost.provisional === true ? "~" : "") + formatUsd(cost.usd)}
              </span>
            )}
          </span>
          <StackedBar attribution={turn.attribution} label={summary} dense />
        </span>
        <span className="font-mono text-[11px] text-fg-dim">{compactTokens(turn.attribution.total.tokens)}</span>
      </button>
    </li>
  )
}

/**
 * The strip.
 * @param props.turns - the loaded page(s) of turns.
 * @param props.selected - open turn index.
 * @param props.onSelect - selection callback.
 * @param props.costs - per-turn priced lines, when available.
 * @returns the list.
 */
export function TurnList({
  turns,
  selected,
  onSelect,
  costs,
}: {
  turns: Turn[]
  selected: number | null
  onSelect: (index: number) => void
  costs?: ReadonlyMap<number, CostTurnValue>
}): ReactElement {
  const rows = buildTurnRows(turns)
  function move(event: KeyboardEvent<HTMLElement>, delta: number | "first" | "last"): void {
    event.preventDefault()
    const list = event.currentTarget.closest("ul")
    if (list === null) return
    const buttons = [...list.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")]
    const current = buttons.indexOf(event.currentTarget as HTMLButtonElement)
    if (current < 0) return
    const target =
      delta === "first"
        ? 0
        : delta === "last"
          ? buttons.length - 1
          : Math.min(buttons.length - 1, Math.max(0, current + delta))
    buttons[target]?.focus()
  }
  return (
    <ul className="m-0 pt-1 px-2 pb-2 list-none overflow-y-auto min-h-0" role="list" aria-label={t("turns.title")}>
      {rows.map((row) => {
        if (row.kind === "compactions") {
          return <CompactionsRow key={row.key} points={row.points} turn={row.turn} />
        }
        const cost = costs?.get(row.turn.index)
        return (
          <TurnRow
            key={row.key}
            turn={row.turn}
            selected={selected === row.turn.index}
            onSelect={onSelect}
            onKeyNav={move}
            {...(cost === undefined ? {} : { cost })}
          />
        )
      })}
    </ul>
  )
}
