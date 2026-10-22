/**
 * Flattening turns into strip rows.
 *
 * Kept out of the component so the one rule worth testing — every compaction of
 * a turn collapses into a single row, never one row per boundary — needs no DOM.
 *
 * @module @cyrus/dsh-sessions-insight/client/turn-rows
 */

import type { CompactionPoint, Turn } from "@cyrus/dsh-session-contract"

/** One row of the flattened strip. */
export type TurnRow =
  | { kind: "turn"; key: string; turn: Turn }
  | { kind: "compactions"; key: string; turn: Turn; points: CompactionPoint[] }

/**
 * Build the strip's rows: one compaction row per turn that has any, then the
 * turn itself.
 * @param turns - the loaded page(s) of turns, in order.
 * @returns the rows.
 */
export function buildTurnRows(turns: readonly Turn[]): TurnRow[] {
  const rows: TurnRow[] = []
  for (const turn of turns) {
    if (turn.compactions.length > 0) {
      rows.push({ kind: "compactions", key: `c-${String(turn.index)}`, turn, points: turn.compactions })
    }
    rows.push({ kind: "turn", key: `t-${String(turn.index)}`, turn })
  }
  return rows
}
