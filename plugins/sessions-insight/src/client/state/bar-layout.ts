/**
 * Turns an attribution into paintable slices. Pure arithmetic, no JSX, so the
 * honesty rules below are unit-testable without a DOM.
 *
 * The denominator is the turn's exact `total` whenever the log stated one. The
 * difference between that total and the sum of the parts is either
 * - a positive residual: a real unknown slice, painted as its own hatched band;
 * - a negative one: the calipers overshot an exact total, which is reported as
 *   `overCounted` and never silently subtracted from a category;
 * - zero: the bar closes.
 *
 * A turn with no usage has no honest denominator; the bar then normalizes by
 * the parts and says so (`normalizedByParts`).
 *
 * @see docs/IR.md (对账的边界)
 * @see docs/adr/0005-honest-attribution-residual.md
 * @module @cyrus/dsh-sessions-insight/client/bar-layout
 */

import type { Attribution, ContextPart } from "@cyrus/dsh-session-contract"
import { formatShare } from "../format.ts"

/** One paintable slice. */
export interface BarSegment {
  /** Stable key: the part name, or `unknown`. */
  key: string
  kind: "part" | "unknown"
  part?: ContextPart
  tokens: number
  /** Percent of the bar's denominator, 0..100. */
  width: number
  share: string
}

/** Everything a bar and its legend need, computed once. */
export interface BarLayout {
  segments: BarSegment[]
  /** The exact total when the log stated one, otherwise the parts' sum. */
  denominator: number
  /** `total − Σparts`; positive means a real unknown slice. */
  residual: number
  /** How far the estimates overshoot an exact total, when they do. */
  overCounted: number
  /** True when the turn had no usage, so the bar is normalized by parts. */
  normalizedByParts: boolean
  /**
   * True when the parts add up to more than an exact total. The bar then
   * normalizes by the parts (no slice can exceed 100%), and the legend states
   * by how much the calipers overshot.
   */
  overflowingParts: boolean
}

/**
 * Turn an attribution into paintable slices.
 * @param attribution - one turn's attribution.
 * @returns the layout shared by the bar and the legend.
 */
export function barLayout(attribution: Attribution): BarLayout {
  const total = attribution.total.tokens
  const parts = attribution.parts.filter((slice) => slice.measure.tokens > 0)
  const sumParts = parts.reduce((sum, slice) => sum + slice.measure.tokens, 0)
  const residual = total - sumParts
  const normalizedByParts = total <= 0
  const overflowingParts = !normalizedByParts && sumParts > total
  // Three denominators, in order of preference: the exact total (the honest
  // one), the parts sum when there is no total at all, and the parts sum again
  // when the estimates overshoot — a 400%-wide slice would be a drawing error,
  // not a measurement.
  const denominator = normalizedByParts || overflowingParts ? Math.max(sumParts, 1) : total
  const segments: BarSegment[] = parts.map((slice) => ({
    key: slice.part,
    kind: "part",
    part: slice.part,
    tokens: slice.measure.tokens,
    width: (slice.measure.tokens / denominator) * 100,
    share: formatShare(slice.measure.tokens, denominator),
  }))
  if (residual > 0) {
    segments.push({
      key: "unknown",
      kind: "unknown",
      tokens: residual,
      width: (residual / denominator) * 100,
      share: formatShare(residual, denominator),
    })
  }
  return {
    segments,
    denominator,
    residual,
    // A missing total is not an over-count: when there is no exact anchor, the
    // parts cannot have exceeded anything, and the legend only says the bar was
    // normalized by parts.
    overCounted: residual < 0 && !normalizedByParts ? -residual : 0,
    normalizedByParts,
    overflowingParts,
  }
}
