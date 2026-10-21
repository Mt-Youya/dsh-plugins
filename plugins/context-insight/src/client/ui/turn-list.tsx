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
import { compactTokens, formatShare, formatShortTime, formatUsd } from "../format.ts"
import { t } from "../locale.ts"
import { Glyph } from "./icons.tsx"
import { Chip } from "./primitives.tsx"
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
    <li className="my-1 px-1 text-[11px] text-warn" data-turn={turn.index}>
      <details className="ci-fold rounded-lg border border-dashed border-warn/50 bg-warn/6">
        <summary className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 py-1.5 min-w-0">
          <Glyph name="chevron" size={10} className="ci-chevron" />
          <span className="font-semibold">{t("compactions.count", { count: points.length })}</span>
          <span className="font-mono tabular-nums">{range}</span>
          <span className="text-fg-dim">
            {first?.replacedHistory === true ? t("turns.compactionReplaced") : t("turns.compactionContinued")}
          </span>
        </summary>
        <ul className="m-0 px-2.5 pb-1.5 list-none text-fg-dim">
          {points.map((point, order) => (
            <li className="flex flex-wrap gap-2 py-0.5" key={`${String(point.at)}-${String(order)}`}>
              <span className="font-mono">{formatShortTime(point.at)}</span>
              <span className="font-mono tabular-nums">
                {t("compactions.range", {
                  before: compactTokens(point.before.tokens),
                  after: compactTokens(point.after.tokens),
                })}
              </span>
              <span>
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
 * Tooltip for one turn's price: model, cache hit rate, and whether it is a
 * preview price.
 * @param index - the turn index.
 * @param cost - that turn's priced line.
 */
function costTip(index: number, cost: CostTurnValue): string {
  const rate = cost.cacheHitRate === null ? "—" : String(Math.round(cost.cacheHitRate * 100)) + "%"
  const line = t("cost.turnTip", { index, model: cost.model ?? "—", rate })
  return cost.provisional === true ? line + " · " + t("cost.provisional") : line
}

/**
 * One turn row: what was asked, how big the context was, what it held.
 * @param props.turn - the turn.
 * @param props.selected - whether this row is the open one.
 * @param props.onSelect - selection callback.
 * @param props.onKeyNav - arrow-key handler, shared by every row.
 * @param props.cost - this turn's priced line, when the Host returned one.
 * @returns the row.
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
  const ask = turn.userInput.join(" ").trim()
  return (
    <li data-turn={turn.index}>
      {/* A div, not a button: role/tabIndex keep the keyboard and a11y
          behaviour, and the surface comes from `.ci-row`, which nothing
          outside the panel can repaint. */}
      <div
        role="button"
        tabIndex={0}
        data-turn-row=""
        className="ci-row px-2.5 py-2"
        data-selected={selected}
        aria-pressed={selected}
        onClick={() => onSelect(turn.index)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") onKeyNav(event, 1)
          else if (event.key === "ArrowUp") onKeyNav(event, -1)
          else if (event.key === "Home") onKeyNav(event, "first")
          else if (event.key === "End") onKeyNav(event, "last")
          else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onSelect(turn.index)
          }
        }}
      >
        {/* Three columns shared by every row — index | content | numbers — so
            tokens and cost line up on the right edge, and the meta line's
            cells keep fixed widths so they line up from row to row. */}
        <span className="grid grid-cols-[22px_minmax(0,1fr)_64px] items-center gap-x-2 gap-y-1.5">
          <span className="font-mono text-[11px] text-fg-3 tabular-nums">{turn.index}</span>
          <span
            className={ask === "" ? "min-w-0 truncate text-[12.5px] text-fg-3" : "min-w-0 truncate text-[12.5px]"}
          >
            {ask === "" ? t("turns.noInput") : ask}
          </span>
          <span className="text-end text-[12.5px] font-semibold tabular-nums">
            {compactTokens(turn.attribution.total.tokens)}
          </span>

          <span aria-hidden="true" />
          <StackedBar attribution={turn.attribution} label={summary} dense />
          <span aria-hidden="true" />

          <span aria-hidden="true" />
          <span className="grid grid-cols-[var(--ci-time-w)_36px_44px_minmax(0,1fr)] items-center gap-x-1.5 text-[10.5px] text-fg-dim tabular-nums">
            <span>{formatShortTime(turn.startedAt)}</span>
            <span className="inline-flex items-center gap-0.5" title={t("turns.tools")}>
              {tools === 0 ? null : (
                <>
                  <Glyph name="tool" size={11} />
                  {tools}
                </>
              )}
            </span>
            <span
              className="font-mono"
              title={
                turn.attribution.reconciled === undefined
                  ? undefined
                  : t("turns.reconciled", { factor: turn.attribution.reconciled.factor.toFixed(3) })
              }
            >
              {turn.attribution.reconciled === undefined ? "" : "×" + turn.attribution.reconciled.factor.toFixed(2)}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              {turn.subagents.length === 0 ? null : (
                <span className="inline-flex items-center gap-0.5" title={t("turns.subagents")}>
                  <Glyph name="branch" size={11} />
                  {turn.subagents.length}
                </span>
              )}
              {unknown === undefined ? null : (
                <Chip tone="warn" title={t("turns.unknownNote")}>
                  {t("turns.unknown")} {unknown}
                </Chip>
              )}
            </span>
          </span>
          <span
            className="relative text-end font-mono text-[10.5px] text-fg-dim tabular-nums"
            data-tip={cost === undefined || cost.usd === null ? undefined : costTip(turn.index, cost)}
            tabIndex={cost === undefined || cost.usd === null ? undefined : 0}
          >
            {cost === undefined || cost.usd === null
              ? ""
              : (cost.provisional === true ? "~" : "") + formatUsd(cost.usd)}
          </span>
        </span>
      </div>
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
  // One time-column width for the whole strip: wide only when some turn is not
  // from today, so `HH:mm` rows are not padded for nothing.
  const timeWidth = turns.some((turn) => formatShortTime(turn.startedAt).length > 5) ? "72px" : "34px"
  function move(event: KeyboardEvent<HTMLElement>, delta: number | "first" | "last"): void {
    event.preventDefault()
    const list = event.currentTarget.closest("ul")
    if (list === null) return
    const rows = [...list.querySelectorAll<HTMLElement>("[data-turn-row]")]
    const current = rows.indexOf(event.currentTarget as HTMLElement)
    if (current < 0) return
    const target =
      delta === "first"
        ? 0
        : delta === "last"
          ? rows.length - 1
          : Math.min(rows.length - 1, Math.max(0, current + delta))
    rows[target]?.focus()
  }
  return (
    <ul
      className="m-0 flex flex-col gap-0.5 p-1.5 list-none"
      role="list"
      aria-label={t("turns.title")}
      style={{ ["--ci-time-w" as string]: timeWidth }}
    >
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
