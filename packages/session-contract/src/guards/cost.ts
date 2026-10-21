/**
 * The `/cost` contract: priced turns, price tables and the reference column.
 *
 * @module @cyrus/dsh-session-contract/guards/cost
 */

import { CONTEXT_SOURCES } from "../types.ts"
import type { ContextSource } from "../types.ts"
import { isNumber, isRecord, isStringArray } from "./shared.ts"

/** One turn's priced line. */
export interface CostTurnValue {
  index: number
  model?: string
  priced: boolean
  /** USD, or null when the model is not in the table. */
  usd: number | null
  input?: number
  cacheRead?: number
  cacheWrite?: number
  output?: number
  cacheHitRate: number | null
  /** Amount in `currency`; 0 when the turn hit an unlisted channel. */
  amount?: number | null
  /** Currency of `amount`. */
  currency?: string
  /** Which table answered as primary for this turn. */
  tableId?: string
  /** True when some bucket was counted as 0 (channel not listed). */
  partial?: boolean
  /** Channels counted as 0 for this turn. */
  unlistedChannels?: string[]
  /** True when this turn's rates include a derived number. */
  provisional?: boolean
}

/** One price table's answer for a session. */
export interface CostTableValue {
  id: string
  pricing: { version: string; asOf: string; currency: string; source?: string }
  /** Per-currency subtotals inside this table; never summed across currencies. */
  byCurrency: Record<string, { amount: number; pricedTurns: number }>
  unpricedModels: string[]
  partial: boolean
  unlistedChannels: string[]
  provisionalModels?: string[]
  provisional?: boolean
  turns: CostTurnValue[]
}

/** One `(table, currency)` subtotal; never merged with its neighbours. */
export interface CostGroupValue {
  tableId: string
  currency: string
  amount: number
  pricedTurns: number
}

/** The OpenRouter reference column. */
export interface CostReferenceValue {
  tableId: string
  pricing: { version: string; asOf: string; currency: string; source?: string }
  byCurrency: Record<string, { amount: number; pricedTurns: number }>
}

/** `/cost` body. */
export interface CostValue {
  source: ContextSource
  sessionId: string
  /** Primary table when every priced turn shares one; null for a mixed session. */
  tableId?: string | null
  /** `(table, currency)` subtotals of the primary prices; never merged. */
  groups?: CostGroupValue[]
  /** The OpenRouter reference column. */
  reference?: CostReferenceValue | null
  /** One entry per computed table; never combined. */
  tables?: Record<string, CostTableValue>
  pricing: { version: string; asOf: string; currency: string; source?: string }
  totals: {
    usd: number | null
    pricedTurns: number
    unpricedTurns: number
    input: number
    cacheRead: number
    cacheWrite: number
    output: number
    cacheHitRate: number | null
  }
  /** Per-currency subtotals; never summed across currencies. */
  byCurrency?: Record<string, { amount: number; pricedTurns: number }>
  unpricedModels: string[]
  /** True when any priced turn counted an unlisted channel as 0. */
  partial?: boolean
  /** Every channel counted as 0, deduplicated. */
  unlistedChannels?: string[]
  /** Priced models whose rates are preview/derived rather than settled. */
  provisionalModels: string[]
  /** True when any priced turn used a provisional rate. */
  provisional: boolean
  turns: CostTurnValue[]
  note: string
}

/**
 * Whether a wire value is a well-formed cost answer.
 * @param value - any decoded JSON value.
 */
export function isCostValue(value: unknown): value is CostValue {
  if (!isRecord(value)) return false
  if (!CONTEXT_SOURCES.includes(value.source as ContextSource)) return false
  if (typeof value.sessionId !== "string") return false
  const pricing = value.pricing
  if (!isRecord(pricing) || typeof pricing.version !== "string" || typeof pricing.asOf !== "string") return false
  const totals = value.totals
  if (!isRecord(totals)) return false
  if (totals.usd !== null && !isNumber(totals.usd)) return false
  if (!isNumber(totals.pricedTurns) || !isNumber(totals.unpricedTurns)) return false
  if (!Array.isArray(value.unpricedModels) || !isStringArray(value.unpricedModels)) return false
  if (!Array.isArray(value.provisionalModels) || !isStringArray(value.provisionalModels)) return false
  if (typeof value.provisional !== "boolean") return false
  if (value.partial !== undefined && typeof value.partial !== "boolean") return false
  if (value.unlistedChannels !== undefined && !isStringArray(value.unlistedChannels)) return false
  if (!Array.isArray(value.turns)) return false
  const turnsOk = value.turns.every(
    (turn) =>
      isRecord(turn) &&
      isNumber(turn.index) &&
      typeof turn.priced === "boolean" &&
      (turn.usd === null || isNumber(turn.usd))
  )
  if (!turnsOk) return false
  if (value.tableId !== undefined && value.tableId !== null && typeof value.tableId !== "string") return false
  if (value.tables === undefined) return true
  if (!isRecord(value.tables)) return false
  return Object.values(value.tables).every(
    (table) =>
      isRecord(table) &&
      typeof table.id === "string" &&
      isRecord(table.byCurrency) &&
      typeof table.partial === "boolean" &&
      Array.isArray(table.turns)
  )
}
