/**
 * Precision made visible.
 *
 * Every number this panel prints is a `Measure`, and a measure that hides its
 * basis is a number pretending to be a fact. These components therefore attach
 * three things to each value: a mark that separates `exact` from `estimate` at
 * a glance, a badge with the same word for screen readers, and a hover/focus
 * tooltip that states the basis and, where the basis is a caliper, its
 * coefficient.
 *
 * The coefficients mirror `src/core/attribution.ts`; they are copied rather
 * than imported so the browser bundle never pulls a module that decodes images
 * with Node's Buffer. `CHAR_CALIBRATION_NOTE` there is the source of truth.
 *
 * @module @cyrus/dsh-context-insight/client/precision
 */

import type { ReactElement } from "react"
import type { Basis, Measure } from "@cyrus/dsh-session-contract"
import { formatTokens } from "../format.ts"
import { t } from "../locale.ts"

/** Calipers of the current adapters; see `src/core/attribution.ts`. */
export const CALIBRATION = {
  /** Characters per token for Latin-script text. */
  text: 2.6,
  /** Characters per token for CJK text. */
  cjk: 1.24,
  /** Characters per token for serialized tool schemas. */
  schema: 2.26,
  /** Pixels per token for an image. */
  pixelsPerToken: 750,
} as const

/**
 * Human sentence for one basis, used as the tooltip body.
 * @param basis - the measure's basis tag.
 */
export function basisTip(basis: Basis): string {
  switch (basis) {
    case "usage":
      return t("basis.tip.usage")
    case "chars-per-token":
      return t("basis.tip.chars-per-token", {
        text: CALIBRATION.text,
        cjk: CALIBRATION.cjk,
        schema: CALIBRATION.schema,
      })
    case "harness-projection":
      return t("basis.tip.harness-projection", { px: CALIBRATION.pixelsPerToken })
    case "byte-length":
      return t("basis.tip.byte-length")
    case "unattributed":
      return t("basis.tip.unattributed")
  }
}

/** The tooltip body for one measure: precision word, basis, calipers, value. */
export function measureTip(measure: Measure): string {
  const precision = measure.precision === "exact" ? t("precision.exact") : t("precision.estimate")
  return `${precision} · ${t(`basis.${measure.basis}`)} — ${basisTip(measure.basis)} (${formatTokens(measure.tokens)} tokens)`
}

/**
 * Small badge carrying the precision word.
 * @param props - the measure's precision.
 * @returns the badge.
 */
export function PrecisionBadge({ precision }: { precision: Measure["precision"] }): ReactElement {
  // Two literals rather than one interpolated name: Tailwind only sees class
  // strings that are spelled out in the source.
  const skin =
    precision === "exact"
      ? "px-1 rounded-[3px] font-[inherit] text-[9.5px] leading-[15px] tracking-[0.02em] border-[0.5px] border-current text-ok"
      : "px-1 rounded-[3px] font-[inherit] text-[9.5px] leading-[15px] tracking-[0.02em] border-[0.5px] border-current text-fg-dim"
  return (
    <span className={skin} data-precision={precision}>
      {precision === "exact" ? t("precision.exact") : t("precision.estimate")}
    </span>
  )
}

/**
 * A token count that carries its own provenance.
 * @param props.measure - the measure to print.
 * @param props.share - optional pre-computed share text, e.g. `20.3%`.
 * @param props.dense - drop the visible badge (the mark still separates them).
 * @returns the value with its mark and tooltip.
 */
export function MeasureValue({
  measure,
  share,
  dense = false,
}: {
  measure: Measure
  share?: string
  dense?: boolean
}): ReactElement {
  const mark = measure.precision === "exact" ? "=" : "≈"
  const label = measureTip(measure)
  return (
    <span
      className="inline-flex items-baseline gap-1 relative font-mono text-[11px] outline-offset-2"
      data-precision={measure.precision}
      data-tip={label}
      tabIndex={0}
      aria-label={label}
    >
      <span className={measure.precision === "exact" ? "text-fg" : "text-fg-dim italic"}>
        {formatTokens(measure.tokens)}
      </span>
      <span className="text-fg-dim text-[10px]" aria-hidden="true">
        {mark}
      </span>
      {dense ? null : <PrecisionBadge precision={measure.precision} />}
      {share === undefined ? null : <span className="text-fg-dim text-[10px]">{share}</span>}
    </span>
  )
}
