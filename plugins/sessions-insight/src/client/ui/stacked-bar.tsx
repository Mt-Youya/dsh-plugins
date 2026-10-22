/**
 * The composition bar.
 *
 * The denominator is the turn's exact `total` whenever there is one. When the
 * slices were deliberately not scaled (docs/IR.md 对账的边界), the difference
 * is painted as its own hatched `未知` slice — it is never folded into a known
 * category, and it is never silently dropped.
 *
 * A turn with no usage at all (total 0) has no honest denominator; the bar then
 * normalizes by the parts and says so in the legend instead of pretending the
 * total is real.
 *
 * @module @cyrus/dsh-sessions-insight/client/stacked-bar
 */

import type { ReactElement } from "react"
import type { Attribution, ContextPart } from "@cyrus/dsh-session-contract"
import { barLayout } from "../state/bar-layout.ts"
import { compactTokens, formatShare, formatTokens } from "../format.ts"
import { t } from "../locale.ts"
import { MeasureValue, PrecisionBadge } from "./precision.tsx"

export type { BarLayout, BarSegment } from "../state/bar-layout.ts"

/**
 * A part's identity colour, as the theme declares it (`--color-part-*`).
 *
 * Painted inline rather than through a class: a colour utility on the same
 * element would out-rank a component rule, and every part must keep its own
 * colour in the bar and in the legend alike.
 * @param part - the context part.
 * @returns a CSS colour reference.
 */
export function partColor(part: ContextPart): string {
  return `var(--color-part-${part})`
}
export { barLayout } from "../state/bar-layout.ts"

/**
 * The bar itself.
 * @param props.attribution - one turn's attribution.
 * @param props.label - accessible name, e.g. `第 5 轮上下文`.
 * @param props.dense - the row-sized variant used inside the turn list.
 * @returns the bar.
 */
export function StackedBar({
  attribution,
  label,
  dense = false,
}: {
  attribution: Attribution
  label: string
  dense?: boolean
}): ReactElement {
  const layout = barLayout(attribution)
  return (
    <div
      className={`flex w-full overflow-hidden bg-bg-3 ${dense ? "h-1.5 rounded-full" : "h-3 rounded-sm"}`}
      role="img"
      aria-label={label}
    >
      {layout.segments.map((segment) => (
        <span
          key={segment.key}
          className={
            segment.kind === "unknown"
              ? "h-full flex-none bg-[repeating-linear-gradient(45deg,var(--color-fg-dim)_0_2px,transparent_2px_5px)] shadow-[inset_0_0_0_1px_var(--color-fg-dim)]"
              : "h-full flex-none"
          }
          data-part={segment.part ?? "unknown"}
          style={
            segment.part === undefined
              ? { width: `${segment.width.toFixed(3)}%` }
              : { width: `${segment.width.toFixed(3)}%`, background: partColor(segment.part) }
          }
          title={`${segment.part === undefined ? t("turns.unknown") : t(`part.${segment.part}`)} ${formatTokens(segment.tokens)} · ${segment.share}`}
        />
      ))}
    </div>
  )
}

/**
 * The bar's legend: every slice with its number, share and precision, plus the
 * two honesty notices (unknown share, over-count, part-normalized bar).
 * @param props.attribution - one turn's attribution.
 * @returns the legend.
 */
export function PartLegend({ attribution }: { attribution: Attribution }): ReactElement {
  const layout = barLayout(attribution)
  return (
    <div>
      <ul className="mt-3 mb-0 p-0 list-none">
        {attribution.parts
          .filter((slice) => slice.measure.tokens !== 0)
          .map((slice) => (
            <li
              className="grid grid-cols-[10px_minmax(0,1fr)_auto] gap-2.5 items-center py-1.5 text-[12px] border-t border-line-soft first:border-t-0"
              key={slice.part}
              data-part={slice.part}
            >
              <span
                className="w-2.5 h-2.5 rounded-[3px]"
                style={{ background: partColor(slice.part) }}
                aria-hidden="true"
              />
              <span className="flex flex-col gap-px min-w-0">{t(`part.${slice.part}`)}</span>
              <span className="text-right whitespace-nowrap">
                <MeasureValue measure={slice.measure} share={formatShare(slice.measure.tokens, layout.denominator)} />
              </span>
            </li>
          ))}
        {layout.residual > 0 ? (
          <li
            className="grid grid-cols-[10px_minmax(0,1fr)_auto] gap-2.5 items-center py-1.5 text-[12px] border-t border-line-soft first:border-t-0"
            data-part="unknown"
          >
            <span
              className="w-2.5 h-2.5 rounded-[3px] bg-[repeating-linear-gradient(45deg,var(--color-fg-dim)_0_1px,transparent_1px_3px)]"
              aria-hidden="true"
            />
            <span className="flex flex-col gap-px min-w-0">
              {t("turns.unknown")}
              <span className="text-[10px] text-fg-dim">{t("turns.unknownNote")}</span>
            </span>
            <span className="text-right whitespace-nowrap">
              <span
                className="inline-flex items-baseline gap-1 relative font-mono text-[11px] outline-offset-2"
                data-precision="estimate"
              >
                <span className="text-fg-dim italic">{formatTokens(layout.residual)}</span>
                <span className="text-fg-dim text-[10px]" aria-hidden="true">
                  ≈
                </span>
                <PrecisionBadge precision="estimate" />
                <span className="text-fg-dim text-[10px]">{formatShare(layout.residual, layout.denominator)}</span>
              </span>
            </span>
          </li>
        ) : null}
      </ul>
      {layout.overCounted > 0 ? (
        <p className="mt-2 mb-0 px-2 py-1 border-s-2 border-warn bg-bg-1 text-[10.5px] text-warn" role="note">
          {t("turns.overCounted", { tokens: formatTokens(layout.overCounted) })}
        </p>
      ) : null}
      {layout.normalizedByParts ? (
        <p className="mt-2 mb-0 px-2 py-1 border-s-2 border-warn bg-bg-1 text-[10.5px] text-warn" role="note">
          {t("turns.normalizedByParts")}
        </p>
      ) : null}
      <p className="mt-2.5 mb-0 text-[11px] text-fg-dim">
        {t("turns.total")} <span className="font-mono text-fg">{compactTokens(attribution.total.tokens)}</span>
        {attribution.windowSize === undefined ? null : (
          <>
            {" · "}
            {t("turns.window", { size: compactTokens(attribution.windowSize) })}
          </>
        )}
        {attribution.reconciled === undefined ? (
          <>
            {" · "}
            {t("turns.notReconciled")}
          </>
        ) : (
          <>
            {" · "}
            {t("turns.reconciled", { factor: attribution.reconciled.factor.toFixed(3) })}
          </>
        )}
      </p>
    </div>
  )
}
