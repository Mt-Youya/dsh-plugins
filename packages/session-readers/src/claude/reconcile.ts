/**
 * Fitting the slices onto the one number that is exact.
 *
 * Kept apart from the window itself because it is policy, not measurement: the
 * window decides *what* the context was made of, this module decides how much
 * of the difference between that estimate and the logged usage may be hidden by
 * scaling. The rule is asymmetric on purpose — see docs/IR.md（对账的边界）.
 *
 * @see docs/adr/0005-honest-attribution-residual.md
 */

import type { ContextPart, Measure } from "@cyrus/dsh-session-contract"

/**
 * Upper bound of a correction that can still be called measurement error.
 *
 * The bound is deliberately asymmetric. Shrinking always means our calipers
 * over-counted — nothing can be *missing* when we already claim more than the
 * window held — so any factor below 1 is applied. Growing past this bound is
 * more likely a whole category we cannot see (no `prompt_snapshot`, a stale
 * one) than a 25% caliper error, so that gap stays visible.
 * @see docs/IR.md (对账的边界)
 */
const MAX_RECONCILE_FACTOR = 1.25

/** Outcome of fitting the slices onto the exact total. */
interface ReconcileOutcome {
  /** Set when the slices were scaled; the bound is enforced before it is set. */
  factor?: number
  /** Set when the gap was left visible instead of being redistributed. */
  residual?: number
}

/**
 * Fit the slices to the one number that is exact — but only when the difference
 * can be measurement error.
 *
 * Scaling a partition that is missing a whole category is not a correction, it
 * is a lie: 56 of 121 Claude transcripts carry no `prompt_snapshot`, so the tool
 * schemas — 95%+ of a 430 K-token window — are simply absent, and proportional
 * scaling would paint history as 94% of the window. A structural gap, or growth
 * past {@link MAX_RECONCILE_FACTOR}, therefore returns `residual` and leaves the
 * slices untouched. Shrinking has no lower bound: over-counting is a caliper
 * problem, never a missing category.
 * @see docs/adr/0005-honest-attribution-residual.md
 * @param parts - slices to adjust in place.
 * @param totalTokens - exact context size for this turn.
 * @param structuralGap - a whole category is missing, so scaling is forbidden.
 */
export function reconcile(
  parts: { part: ContextPart; measure: Measure }[],
  totalTokens: number,
  structuralGap: boolean
): ReconcileOutcome {
  let estimated = 0
  for (const slice of parts) estimated += slice.measure.tokens
  if (structuralGap || totalTokens <= 0 || estimated <= 0) {
    return { residual: totalTokens - estimated }
  }
  const factor = totalTokens / estimated
  if (factor > MAX_RECONCILE_FACTOR) {
    return { residual: totalTokens - estimated }
  }

  let scaled = 0
  let largest = 0
  for (let index = 0; index < parts.length; index += 1) {
    const slice = parts[index]
    if (slice === undefined) continue
    const tokens = Math.round(slice.measure.tokens * factor)
    slice.measure = { ...slice.measure, tokens }
    scaled += tokens
    const heaviest = parts[largest]
    if (heaviest === undefined || slice.measure.tokens > heaviest.measure.tokens) largest = index
  }
  // Rounding each slice can drift a few tokens; the identity Σparts === total
  // has to hold exactly, so the drift lands on the heaviest slice.
  const drift = totalTokens - scaled
  const heaviest = parts[largest]
  if (heaviest !== undefined && drift !== 0) {
    heaviest.measure = { ...heaviest.measure, tokens: heaviest.measure.tokens + drift }
  }
  return { factor: Math.round(factor * 10_000) / 10_000 }
}
