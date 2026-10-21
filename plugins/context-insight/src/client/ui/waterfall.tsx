/**
 * The cumulative water line.
 *
 * One point per turn: the exact total context that turn was answered with.
 * Compaction boundaries are drawn as dashed verticals, because the interesting
 * shape in a long session is the sawtooth they cut — a level that climbs for
 * twenty turns and then drops to a few thousand tokens.
 *
 * The line and area are SVG stretched to the box; the points are HTML buttons
 * placed by percentage, so they stay round at any aspect ratio and a click on
 * one opens that turn.
 *
 * @module @cyrus/dsh-context-insight/client/waterfall
 */

import type { ReactElement } from "react"
import type { Turn } from "@cyrus/dsh-session-contract"
import { compactTokens } from "../format.ts"
import { t } from "../locale.ts"

/** viewBox of the chart; CSS scales it to the box. */
const WIDTH = 1000
const HEIGHT = 100
/** Head room above the peak, as a share of the height. */
const HEADROOM = 0.12

/**
 * @param props.turns - the turns loaded so far, in order.
 * @param props.selected - turn index to mark, if any.
 * @param props.onSelect - open one turn.
 * @returns the chart, or null when there is nothing to plot.
 */
export function Waterfall({
  turns,
  selected,
  onSelect,
}: {
  turns: Turn[]
  selected: number | null
  onSelect: (index: number) => void
}): ReactElement | null {
  if (turns.length === 0) return null
  const values = turns.map((turn) => Math.max(0, turn.attribution.total.tokens))
  const peak = Math.max(1, ...values)
  /** Horizontal position, 0..1. */
  const xOf = (index: number): number => (turns.length === 1 ? 0.5 : index / (turns.length - 1))
  /** Vertical position from the top, 0..1. */
  const yOf = (value: number): number => 1 - (value / peak) * (1 - HEADROOM)
  const line = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${(xOf(index) * WIDTH).toFixed(1)},${(yOf(value) * HEIGHT).toFixed(1)}`)
    .join(" ")
  const area = `${line} L${(xOf(turns.length - 1) * WIDTH).toFixed(1)},${HEIGHT} L${(xOf(0) * WIDTH).toFixed(1)},${HEIGHT} Z`
  const compactions = turns.flatMap((turn, index) => turn.compactions.map((point) => ({ index, point })))
  const marked = selected === null ? -1 : turns.findIndex((turn) => turn.index === selected)

  return (
    <figure className="m-0 px-3.5 pt-3 pb-3">
      <figcaption className="flex items-baseline gap-2 text-[11px] text-fg-dim">
        <span className="text-[12px] font-semibold text-fg">{t("waterfall.title")}</span>
        <span className="tabular-nums">{t("waterfall.peak", { tokens: compactTokens(peak) })}</span>
        <span className="ms-auto truncate text-fg-3">{t("waterfall.hint")}</span>
      </figcaption>
      <div className="relative mt-2.5 h-24" role="group" aria-label={`${t("waterfall.title")} — ${t("waterfall.caption")}`}>
        <svg
          className="absolute inset-0 block h-full w-full overflow-visible"
          viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[0.25, 0.5, 0.75].map((level) => (
            <line
              key={level}
              className="stroke-line-soft [vector-effect:non-scaling-stroke]"
              x1={0}
              x2={WIDTH}
              y1={level * HEIGHT}
              y2={level * HEIGHT}
            />
          ))}
          <path className="fill-accent opacity-[0.14]" d={area} />
          <path
            className="fill-none stroke-accent stroke-[1.6] [stroke-linejoin:round] [vector-effect:non-scaling-stroke]"
            d={line}
          />
          {compactions.map(({ index, point }, order) => (
            <line
              key={`${String(index)}-${String(order)}`}
              className="stroke-[var(--color-warn)] stroke-[1] [stroke-dasharray:3_3] opacity-80 [vector-effect:non-scaling-stroke]"
              x1={xOf(index) * WIDTH}
              x2={xOf(index) * WIDTH}
              y1={0}
              y2={HEIGHT}
            >
              <title>{`${t("turns.compaction")}: ${compactTokens(point.before.tokens)} → ${compactTokens(point.after.tokens)}`}</title>
            </line>
          ))}
          {marked < 0 ? null : (
            <line
              className="stroke-[var(--color-fg-dim)] stroke-[1] opacity-50 [vector-effect:non-scaling-stroke]"
              x1={xOf(marked) * WIDTH}
              x2={xOf(marked) * WIDTH}
              y1={0}
              y2={HEIGHT}
            />
          )}
        </svg>
        {turns.map((turn, index) => (
          <button
            key={turn.index}
            type="button"
            className="ci-dot"
            data-selected={index === marked}
            style={{ left: `${(xOf(index) * 100).toFixed(2)}%`, top: `${(yOf(values[index] ?? 0) * 100).toFixed(2)}%` }}
            title={`${t("turns.selected", { index: turn.index })} · ${compactTokens(turn.attribution.total.tokens)}`}
            aria-label={`${t("turns.selected", { index: turn.index })} · ${compactTokens(turn.attribution.total.tokens)}`}
            onClick={() => onSelect(turn.index)}
          />
        ))}
      </div>
    </figure>
  )
}
