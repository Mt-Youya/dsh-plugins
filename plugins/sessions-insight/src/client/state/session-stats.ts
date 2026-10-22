/**
 * The session header's headline numbers, computed from the loaded turns.
 *
 * Pure so the one judgement worth testing — which turn counts as "current" and
 * what share of the window it fills — needs no DOM. Only loaded turns count:
 * the header says so by naming the loaded range next to the numbers.
 *
 * @module @cyrus/dsh-sessions-insight/client/session-stats
 */

import type { Turn } from "@cyrus/dsh-session-contract"

/** What the header tiles print. */
export interface SessionStats {
  /** Total context of the last loaded turn that reported one. */
  current: number
  /** That turn's window size, when the log stated one. */
  window?: number
  /** `current / window`, 0..1+, when both are known. */
  windowShare?: number
  /** Largest total among loaded turns. */
  peak: number
  /** Index of the peak turn, for the "第 N 轮" hint. */
  peakTurn?: number
  /** Compaction boundaries across loaded turns. */
  compactions: number
  /** Tool calls across loaded turns. */
  toolCalls: number
}

/**
 * Summarise the loaded turns.
 * @param turns - loaded page(s), in order.
 * @returns the header numbers; zeros for an empty list.
 */
export function sessionStats(turns: readonly Turn[]): SessionStats {
  let peak = 0
  let peakTurn: number | undefined
  let compactions = 0
  let toolCalls = 0
  let last: Turn | undefined
  for (const turn of turns) {
    const total = turn.attribution.total.tokens
    if (total > peak) {
      peak = total
      peakTurn = turn.index
    }
    if (total > 0) last = turn
    compactions += turn.compactions.length
    toolCalls += turn.toolCalls.length
  }
  const current = last?.attribution.total.tokens ?? 0
  const window = last?.attribution.windowSize
  return {
    current,
    ...(window === undefined ? {} : { window }),
    ...(window === undefined || window <= 0 ? {} : { windowShare: current / window }),
    peak,
    ...(peakTurn === undefined ? {} : { peakTurn }),
    compactions,
    toolCalls,
  }
}
