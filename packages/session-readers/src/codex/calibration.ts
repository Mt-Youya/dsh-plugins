/**
 * Codex's own characters-per-token calipers.
 *
 * The shared table in src/core/attribution.ts was fitted on this machine's
 * Claude corpus: 214 turns across 33 transcripts that are mostly code, diffs and
 * file contents, which tokenise near 2.6 characters per token. A Codex request
 * is dominated by prose instructions instead — session_meta.base_instructions is
 * 17.7-21.8 K characters, and developer messages and AGENTS.md add more — and
 * prose tokenises at roughly 3.3 characters per token. Reusing the Claude text
 * caliper therefore over-counts every Codex window by about 20-30%, which the
 * reconcile factor reported directly (median total/estimate 0.795).
 *
 * The value below is fitted, not chosen: over the 32 usage-bearing turns whose
 * tool schemas were logged (so no category is structurally missing) and whose
 * tool-results stay under 5% of the estimate (so elided tool output cannot bias
 * the ratio), the median total/estimate is 0.795, and 2.6 / 0.795 = 3.27. The
 * unfiltered schema-visible group (39 turns, 5 sessions) gives 3.36, so 3.27 is
 * inside the sensitivity band rather than a single-point fit.
 *
 * Limitations, stated rather than hidden:
 * - 32 turns from 2 sessions is a small fit; scripts/probe-codex.mjs re-reports
 *   the calibration block so it can be re-measured as the corpus grows.
 * - The schema caliper could not be refit: only 7 additional_tools records exist
 *   corpus-wide, so 2.26 is inherited unchanged, as is the CJK caliper (no
 *   Codex-only CJK evidence).
 * - Tool results are logged in full but sent elided (a 519 K-968 K character
 *   output is followed by a prompt that grew only 2.6 K-7.4 K tokens), so a
 *   tool-heavy turn still over-counts whichever text caliper is used.
 */

import { CHARS_PER_TOKEN_CJK, CHARS_PER_TOKEN_SCHEMA, type CharCounts } from "../attribution.ts"
import type { Measure } from "@cyrus/dsh-session-contract"

/** Fitted prose/code mix coefficient for Codex instructions (see the header). */
export const CODEX_CHARS_PER_TOKEN_TEXT = 3.27

/** Human-readable provenance, printed by the probe next to the shared note. */
export const CODEX_CALIBRATION_NOTE =
  "codex calipers: text " +
  CODEX_CHARS_PER_TOKEN_TEXT +
  " (fitted, see src/core/codex/calibration.ts), " +
  "schema " +
  CHARS_PER_TOKEN_SCHEMA +
  " and cjk " +
  CHARS_PER_TOKEN_CJK +
  " inherited from the shared table"

/** The dataQuality token that tells a reader which caliper produced the numbers. */
export const CODEX_CALIPER_TOKEN = "calipers=codex-text-" + CODEX_CHARS_PER_TOKEN_TEXT

/** Convert an accumulator to tokens with the Codex text caliper. */
export function codexTokensOf(counts: CharCounts): number {
  return Math.round(
    counts.text / CODEX_CHARS_PER_TOKEN_TEXT +
      counts.cjk / CHARS_PER_TOKEN_CJK +
      counts.schema / CHARS_PER_TOKEN_SCHEMA +
      counts.projected
  )
}

/** Turn the accumulator into a chars-per-token Measure. */
export function codexMeasureOf(counts: CharCounts): Measure {
  return { tokens: codexTokensOf(counts), precision: "estimate", basis: "chars-per-token" }
}

/** Turn an image accumulator into a harness-projection Measure. */
export function codexProjectedMeasure(counts: CharCounts): Measure {
  return { tokens: codexTokensOf(counts), precision: "estimate", basis: "harness-projection" }
}
