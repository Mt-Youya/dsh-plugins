/**
 * Per-session cost, from the IR's own usage.
 *
 * The three adapters already normalized usage into the same four fields, with
 * one rule each that this module must not undo:
 *
 * - Claude: `input` is uncached input, `cacheRead` is cache reads and
 *   `cacheWrite` cache writes — three disjoint buckets.
 * - DSH: `inputTokens` is the *non-cached remainder* while `cacheReadTokens`
 *   carries the window; the adapter mapped them to the same two fields, so they
 *   are added **side by side, never nested**.
 * - Codex: `input_tokens` already contains the cached tokens; the adapter
 *   subtracted them, so `input` is again the non-cached part.
 *
 * Adding `cacheRead` on top of `input` would therefore double-count DSH and
 * Codex windows; the formula below never does.
 *
 * The primary price is chosen **per model** (see `primaryTableFor`): DeepSeek is
 * paid to the provider in USD, so `official` is the only primary table. Every
 * answer therefore carries its `tableId`, and session totals are grouped by
 * `(tableId, currency)` — never merged, never converted. The OpenRouter table is
 * the reference column only, so Claude/GPT turns carry no primary amount.
 *
 * @module @cyrus/dsh-context-insight/host/cost
 */

import type { Session, Usage } from "@cyrus/dsh-session-contract"
import type { ContextSource } from "../../protocol.ts"
import type { Currency, PricingTable, TableId } from "./pricing.ts"
import { PRIMARY_ORDER, TABLES, TABLE_IDS, displayKey, lookupPrice, primaryTableFor } from "./pricing.ts"

/** One `(table, currency)` subtotal. Never merged with its neighbours. */
export interface CostGroup {
  tableId: TableId
  currency: Currency
  amount: number
  pricedTurns: number
}

/** The reference column's line for one turn. */
export interface TurnReference {
  tableId: TableId
  currency: Currency
  amount: number
  partial: boolean
}

/** One turn's cost. */
export interface TurnCost {
  index: number
  /** `<provider>/<model>` when the turn named one. */
  model?: string
  /** True when a primary table covered the model and a number could be computed. */
  priced: boolean
  /** Amount in `currency`; 0 when the turn hit an unlisted channel. */
  amount: number | null
  /** Currency of `amount`. */
  currency?: Currency
  /** Which table answered as primary for this turn. */
  tableId?: TableId
  /** USD amount, kept for USD-only aggregates; null for other currencies. */
  usd: number | null
  /** True when some bucket was counted as 0 because the channel lists no rate. */
  partial?: boolean
  /** Channels counted as 0 for this turn, e.g. `openai/gpt-6.1-sol#cacheRead`. */
  unlistedChannels?: string[]
  /** The OpenRouter reference price for the same turn, when it differs. */
  reference?: TurnReference
  usage?: Usage
  /** `cacheRead / (input + cacheRead + cacheWrite)`, 0..1. */
  cacheHitRate: number | null
  /** True when this turn's rates include a derived number (see the price table). */
  provisional?: boolean
  /** What exactly is derived, shown in the panel's tooltip. */
  provisionalNote?: string
}

/** One currency's slice of a session inside one table. */
export interface CurrencyTotal {
  amount: number
  pricedTurns: number
}

/** One table's answer for one session. */
export interface TableCost {
  id: TableId
  pricing: { version: string; asOf: string; currency: Currency; source: string }
  byCurrency: Partial<Record<Currency, CurrencyTotal>>
  turns: TurnCost[]
  unpricedModels: string[]
  partial: boolean
  unlistedChannels: string[]
  provisionalModels: string[]
  provisional: boolean
}

/** One session's cost. */
export interface SessionCost {
  source: ContextSource
  sessionId: string
  /** The primary table when every priced turn shares one; null for a mixed session. */
  tableId: TableId | null
  /** Primary provenance: that table's, or the official table's when nothing priced. */
  pricing: TableCost["pricing"]
  totals: {
    usd: number | null
    byCurrency: Partial<Record<Currency, CurrencyTotal>>
    pricedTurns: number
    unpricedTurns: number
    input: number
    cacheRead: number
    cacheWrite: number
    output: number
    cacheHitRate: number | null
  }
  /** `(table, currency)` subtotals of the primary prices; never merged. */
  groups: CostGroup[]
  /** The OpenRouter column, when that table was computed. */
  reference: {
    tableId: TableId
    pricing: TableCost["pricing"]
    byCurrency: Partial<Record<Currency, CurrencyTotal>>
  } | null
  /** Every computed table, for provenance and per-table details. */
  tables: Partial<Record<TableId, TableCost>>
  turns: TurnCost[]
  unpricedModels: string[]
  partial: boolean
  unlistedChannels: string[]
  provisionalModels: string[]
  provisional: boolean
  note: string
}

/** Caller overrides, used by tests. */
export interface CostOptions {
  /** Tables to price against; defaults to every shipped table. */
  tables?: Partial<Record<TableId, PricingTable>>
  /** Override the primary-table order (tests only). */
  primaryOrder?: readonly TableId[]
}

function rateOf(usage: Usage): number | null {
  const prompt = usage.input + usage.cacheRead + usage.cacheWrite
  if (prompt <= 0) return null
  return usage.cacheRead / prompt
}

function round(amount: number): number {
  return Math.round(amount * 1e6) / 1e6
}

/**
 * Price one usage block against one entry.
 * @param usage - the turn's four token buckets.
 * @param price - resolved table entry (null buckets mean "unlisted").
 * @param key - log-spelled model key, used to name unlisted channels.
 * @returns the amount, plus the channels that were counted as 0.
 */
function amountOf(
  usage: Usage,
  price: { input: number; output: number; cacheRead: number | null; cacheWrite: number | null },
  key: string
): { amount: number; unlisted: string[] } {
  const unlisted: string[] = []
  const bucket = (tokens: number, rate: number | null, name: string): number => {
    if (tokens <= 0) return 0
    if (rate === null) {
      unlisted.push(`${key}#${name}`)
      return 0
    }
    return tokens * rate
  }
  const amount =
    bucket(usage.input, price.input, "input") +
    bucket(usage.cacheWrite, price.cacheWrite, "cacheWrite") +
    bucket(usage.cacheRead, price.cacheRead, "cacheRead") +
    bucket(usage.output, price.output, "output")
  return { amount: amount / 1_000_000, unlisted }
}

/**
 * Price every turn of a session against one table.
 * @param session - the session IR.
 * @param table - the table to read.
 * @returns that table's answer, index-aligned with `session.turns`.
 */
function priceWithTable(session: Session, table: PricingTable): TableCost {
  const turns: TurnCost[] = []
  const unpriced = new Set<string>()
  const provisionalModels = new Set<string>()
  const unlistedChannels = new Set<string>()
  const byCurrency: Partial<Record<Currency, CurrencyTotal>> = {}
  let provisional = false
  for (const turn of session.turns) {
    const usage = turn.usage
    const key = displayKey(turn.model?.provider, turn.model?.model)
    const price = lookupPrice(table, turn.model?.provider, turn.model?.model)
    const hitRate = usage === undefined ? null : rateOf(usage)
    if (usage === undefined || price === undefined) {
      if (key !== undefined && price === undefined) unpriced.add(key)
      const line: TurnCost = { index: turn.index, priced: false, amount: null, usd: null, cacheHitRate: hitRate }
      if (key !== undefined) line.model = key
      if (usage !== undefined) line.usage = usage
      turns.push(line)
      continue
    }
    const { amount, unlisted } = amountOf(usage, price, key ?? "unknown")
    const currency = price.currency
    const slice = byCurrency[currency] ?? { amount: 0, pricedTurns: 0 }
    slice.amount = round(slice.amount + amount)
    slice.pricedTurns += 1
    byCurrency[currency] = slice
    const line: TurnCost = {
      index: turn.index,
      priced: true,
      amount: round(amount),
      usd: currency === "USD" ? round(amount) : null,
      currency,
      tableId: table.id,
      usage,
      cacheHitRate: hitRate,
    }
    if (key !== undefined) line.model = key
    if (unlisted.length > 0) {
      line.partial = true
      line.unlistedChannels = unlisted
      for (const channel of unlisted) unlistedChannels.add(channel)
    }
    if (price.provisional === true) {
      line.provisional = true
      provisional = true
      if (key !== undefined) provisionalModels.add(key)
      if (price.provisionalNote !== undefined) line.provisionalNote = price.provisionalNote
    }
    turns.push(line)
  }
  return {
    id: table.id,
    pricing: { version: table.version, asOf: table.asOf, currency: table.currency, source: table.source },
    byCurrency,
    turns,
    unpricedModels: [...unpriced].sort(),
    partial: unlistedChannels.size > 0,
    unlistedChannels: [...unlistedChannels].sort(),
    provisionalModels: [...provisionalModels].sort(),
    provisional,
  }
}

/**
 * Price one parsed session.
 *
 * The third argument also accepts a single {@link PricingTable}, which is how a
 * caller injects a test table: a bare table is used as the only primary source.
 * @param session - the session IR.
 * @param source - which corpus it came from (echoed in the answer).
 * @param options - tables to use, or one table.
 * @returns primary turns, the `(table, currency)` groups, and every table's detail.
 */
export function costOfSession(
  session: Session,
  source: ContextSource,
  options: CostOptions | PricingTable = {}
): SessionCost {
  const resolved: CostOptions =
    "models" in options ? { tables: { [options.id]: options }, primaryOrder: [options.id] } : options
  const tables = resolved.tables ?? TABLES
  const order = resolved.primaryOrder ?? PRIMARY_ORDER
  const computed: Partial<Record<TableId, TableCost>> = {}
  for (const id of TABLE_IDS) {
    const table = tables[id]
    if (table !== undefined) computed[id] = priceWithTable(session, table)
  }
  const referenceTable = computed.openrouter

  const turns: TurnCost[] = []
  const groups = new Map<string, CostGroup>()
  const unpricedModels = new Set<string>()
  const unlisted = new Set<string>()
  const provisionalModels = new Set<string>()
  const primaryTables = new Set<TableId>()
  let partial = false
  let provisional = false
  let usdOnly = true
  let usdTotal = 0
  let priced = 0
  session.turns.forEach((turn, index) => {
    let chosen: { id: TableId; cost: TurnCost } | undefined
    for (const id of order) {
      const candidate = computed[id]?.turns[index]
      if (candidate !== undefined && candidate.priced) {
        chosen = { id, cost: candidate }
        break
      }
    }
    const key = displayKey(turn.model?.provider, turn.model?.model)
    const referenceTurn = referenceTable?.turns[index]
    if (chosen === undefined) {
      if (key !== undefined && primaryTableFor(turn.model?.provider, turn.model?.model, tables) === null) {
        unpricedModels.add(key)
      }
      const line: TurnCost = {
        index: turn.index,
        priced: false,
        amount: null,
        usd: null,
        cacheHitRate: turn.usage === undefined ? null : rateOf(turn.usage),
      }
      if (key !== undefined) line.model = key
      if (turn.usage !== undefined) line.usage = turn.usage
      turns.push(line)
      return
    }
    const line: TurnCost = { ...chosen.cost, tableId: chosen.id }
    if (line.usage === undefined && turn.usage !== undefined) line.usage = turn.usage
    if (
      referenceTurn !== undefined &&
      referenceTurn.priced &&
      referenceTurn.amount !== null &&
      referenceTurn.currency !== undefined &&
      (referenceTurn.amount !== line.amount || referenceTurn.currency !== line.currency)
    ) {
      line.reference = {
        tableId: "openrouter",
        currency: referenceTurn.currency,
        amount: referenceTurn.amount,
        partial: referenceTurn.partial === true,
      }
    }
    priced += 1
    primaryTables.add(chosen.id)
    if (line.currency !== "USD") usdOnly = false
    else usdTotal += line.amount ?? 0
    const groupKey = `${chosen.id}/${line.currency ?? "unknown"}`
    const group = groups.get(groupKey) ?? {
      tableId: chosen.id,
      currency: (line.currency ?? "USD") as Currency,
      amount: 0,
      pricedTurns: 0,
    }
    group.amount = round(group.amount + (line.amount ?? 0))
    group.pricedTurns += 1
    groups.set(groupKey, group)
    if (line.partial === true) {
      partial = true
      for (const channel of line.unlistedChannels ?? []) unlisted.add(channel)
    }
    if (line.provisional === true) {
      provisional = true
      if (line.model !== undefined) provisionalModels.add(line.model)
    }
    turns.push(line)
  })

  let input = 0
  let cacheRead = 0
  let cacheWrite = 0
  let output = 0
  for (const turn of session.turns) {
    const usage = turn.usage
    if (usage === undefined) continue
    input += usage.input
    cacheRead += usage.cacheRead
    cacheWrite += usage.cacheWrite
    output += usage.output
  }
  const promptTokens = input + cacheRead + cacheWrite
  const byCurrency: Partial<Record<Currency, CurrencyTotal>> = {}
  for (const group of groups.values()) {
    const slice = byCurrency[group.currency] ?? { amount: 0, pricedTurns: 0 }
    slice.amount = round(slice.amount + group.amount)
    slice.pricedTurns += group.pricedTurns
    byCurrency[group.currency] = slice
  }
  const single = primaryTables.size === 1 ? ([...primaryTables][0] as TableId) : null
  const pricing =
    (single === null ? undefined : computed[single]?.pricing) ??
    computed.official?.pricing ??
    (referenceTable?.pricing as TableCost["pricing"])
  const baseNote =
    "input 为未缓存余量；cacheRead 单列相加、不嵌套在 input 内（DSH/Codex 的缓存窗口已由 adapter 分离）。未覆盖模型记 null，不猜；未列价通道记 0 并标 partial（UI 用 ≥ 表示下限）。主价格只取 official（DeepSeek→官方 USD；Claude/GPT 无主价，只显示 openrouter 参考列），会话合计按 (tableId, currency) 分组；openrouter 仅作参考列，**不做汇率换算**，任何合计都不跨表、不跨币种。"
  const note = provisional ? `${baseNote} 含预览价：见会话内提示。` : baseNote
  return {
    source,
    sessionId: session.id,
    tableId: single,
    pricing,
    totals: {
      usd: priced > 0 && usdOnly ? round(usdTotal) : null,
      byCurrency,
      pricedTurns: priced,
      unpricedTurns: turns.length - priced,
      input,
      cacheRead,
      cacheWrite,
      output,
      cacheHitRate: promptTokens <= 0 ? null : cacheRead / promptTokens,
    },
    groups: [...groups.values()],
    reference:
      referenceTable === undefined
        ? null
        : { tableId: "openrouter", pricing: referenceTable.pricing, byCurrency: referenceTable.byCurrency },
    tables: computed,
    turns,
    unpricedModels: [...unpricedModels].sort(),
    partial,
    unlistedChannels: [...unlisted].sort(),
    provisionalModels: [...provisionalModels].sort(),
    provisional,
    note,
  }
}
