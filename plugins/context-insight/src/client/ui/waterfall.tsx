/**
 * The cumulative water line.
 *
 * One point per turn: the exact total context that turn was answered with.
 * Compaction boundaries are drawn as dashed verticals, because the interesting
 * shape in a long session is the sawtooth they cut — a level that climbs for
 * twenty turns and then drops to a few thousand tokens.
 *
 * @module @cyrus/dsh-context-insight/client/waterfall
 */

import type { ReactElement } from "react"
import type { Turn } from "@cyrus/dsh-session-contract"
import { compactTokens } from "../format.ts"
import { t } from "../locale.ts"

/** viewBox of the chart; CSS scales it to the column. */
const WIDTH = 320
const HEIGHT = 56
const PAD_X = 6
const PAD_Y = 6

/**
 * @param props.turns - the turns loaded so far, in order.
 * @param props.selected - turn index to mark, if any.
 * @returns the chart, or null when there is nothing to plot.
 */
export function Waterfall({ turns, selected }: { turns: Turn[]; selected: number | null }): ReactElement | null {
  if (turns.length === 0) return null
  const values = turns.map((turn) => Math.max(0, turn.attribution.total.tokens))
  const peak = Math.max(1, ...values)
  const innerW = WIDTH - PAD_X * 2
  const innerH = HEIGHT - PAD_Y * 2
  function xOf(index: number): number {
    return turns.length === 1 ? PAD_X + innerW / 2 : PAD_X + (index / (turns.length - 1)) * innerW
  }
  const yOf = (value: number): number => PAD_Y + innerH - (value / peak) * innerH
  const line = turns
    .map((turn, index) => `${index === 0 ? "M" : "L"}${xOf(index).toFixed(1)},${yOf(values[index] ?? 0).toFixed(1)}`)
    .join(" ")
  const area = `${line} L${xOf(turns.length - 1).toFixed(1)},${(PAD_Y + innerH).toFixed(1)} L${xOf(0).toFixed(1)},${(PAD_Y + innerH).toFixed(1)} Z`
  const compactions = turns.flatMap((turn, index) => turn.compactions.map((point) => ({ index, point })))
  const marked = selected === null ? undefined : turns.findIndex((turn) => turn.index === selected)

  return (
    <figure className="m-0 px-3.5 pt-2.5 pb-1.5 border-b-[0.5px] border-line-soft">
      <figcaption className="flex justify-between items-baseline gap-2 text-[11px] text-fg-dim">
        <span className="font-semibold tracking-[0.04em] uppercase text-[10px]">{t("waterfall.title")}</span>
        <span className="text-[11px] text-fg-dim">{t("waterfall.peak", { tokens: compactTokens(peak) })}</span>
      </figcaption>
      <svg
        className="block w-full h-14 mt-1 overflow-visible"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${t("waterfall.title")} — ${t("waterfall.caption")}`}
      >
        <path className="fill-[var(--color-accent)] opacity-[0.12]" d={area} />
        <path className="fill-none stroke-[var(--color-accent)] stroke-[1.4] [vector-effect:non-scaling-stroke]" d={line} />
        {compactions.map(({ index, point }, order) => (
          <line
            key={`${String(index)}-${String(order)}`}
            className="stroke-[var(--color-warn)] stroke-[1] [stroke-dasharray:2_2] opacity-70 [vector-effect:non-scaling-stroke]"
            x1={xOf(index)}
            x2={xOf(index)}
            y1={PAD_Y}
            y2={PAD_Y + innerH}
          >
            <title>{`${t("turns.compaction")}: ${compactTokens(point.before.tokens)} → ${compactTokens(point.after.tokens)}`}</title>
          </line>
        ))}
        {turns.map((turn, index) => (
          <circle
            key={turn.index}
            className={`fill-[var(--color-accent)] ${index === marked ? "opacity-100 stroke-[var(--color-fg)] stroke-[1]" : "opacity-70"}`}
            cx={xOf(index)}
            cy={yOf(values[index] ?? 0)}
            r={index === marked ? 3 : 1.6}
          >
            <title>{`${t("turns.selected", { index: turn.index })}: ${compactTokens(turn.attribution.total.tokens)}`}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-fg-dim">{t("waterfall.caption")}</p>
    </figure>
  )
}
