/**
 * The price tables.
 *
 * Two tables coexist because they answer two different questions:
 *
 * - `xogpu` — what the user actually pays, in CNY, per the relay station's page;
 * - `openrouter` — the public USD reference price, plus DeepSeek's own USD page
 *   (the DSH sessions in this corpus connect to `deepseek-official`, so their
 *   price comes from the provider rather than the relay).
 *
 * The two are **never** added or converted: there is no exchange rate in this
 * build, and inventing one would be a fabricated number. The panel shows the
 * primary table's amount and, beside it, the other table's reference amount.
 *
 * A `null` bucket means **that channel is not listed** — not free. The cost
 * module counts it as 0, marks the result `partial`, and names the channel in
 * `unlistedChannels`, so a reader sees "at least this much" (the panel's `≥`).
 * A model absent from a table prices as `null` and lands in `unpricedModels`.
 *
 * @module @cyrus/dsh-context-insight/host/pricing
 */

/** ISO-4217 codes these tables can express. */
export type Currency = "USD" | "CNY"

/** Which table to read. */
export type TableId = "xogpu" | "official" | "openrouter"

/** One model's rates, per 1M tokens, in its table's currency. */
export interface ModelPrice {
  /** Uncached input tokens. */
  input: number
  /** Output tokens. */
  output: number
  /** Cache-read tokens; `null` when the channel lists no rate. */
  cacheRead: number | null
  /** Cache-write tokens; `null` when the channel lists no rate. */
  cacheWrite: number | null
  /** Currency of the numbers above; defaults to the table's `currency`. */
  currency?: Currency
  /** Pricing tier the numbers came from (DeepSeek publishes peak/off-peak). */
  rate?: string
  /** True when a number is derived rather than published as such. */
  provisional?: boolean
  /** What exactly is derived, and from what. Shown in the panel's tooltip. */
  provisionalNote?: string
}

/** One table plus its provenance. */
export interface PricingTable {
  /** Which table this is; echoed in every answer. */
  id: TableId
  /** Table revision; bump on every edit. */
  version: string
  /** Date the rates were read, ISO `YYYY-MM-DD`. */
  asOf: string
  /** Currency for every entry that does not name its own. */
  currency: Currency
  /** Where the numbers came from, in one line, for the panel's tooltip. */
  source: string
  /** Keyed `<provider>/<model>`, exactly as the IR reports them. */
  models: Record<string, ModelPrice>
}

/**
 * Normalise a model id for table lookup.
 *
 * Providers publish versioned ids with dots (`claude-sonnet-5.5`) while the
 * tables spell them with dashes, and prefixes vary in case; folding both to one
 * spelling keeps the tables from needing duplicate rows.
 * @param model - model id as the IR reports it.
 * @returns lowercase, dots replaced by dashes.
 */
export function normalizeModelId(model: string): string {
  return model.toLowerCase().replace(/\./g, "-")
}

/**
 * Table key for a provider/model pair.
 * @param provider - provider as the IR reports it.
 * @param model - model id as the IR reports it.
 * @returns `<provider>/<normalised-model>`, or undefined when either is missing.
 */
export function modelKey(provider: string | undefined, model: string | undefined): string | undefined {
  if (provider === undefined || model === undefined) return undefined
  return `${provider.toLowerCase()}/${normalizeModelId(model)}`
}

/**
 * Key as the conversation log spells it, for display and for naming unlisted
 * channels: `anthropic/claude-sonnet-5.5`, not the folded table spelling.
 * @param provider - provider as the IR reports it.
 * @param model - model id as the IR reports it.
 * @returns `<provider>/<model>` lowercased, or undefined when either is missing.
 */
export function displayKey(provider: string | undefined, model: string | undefined): string | undefined {
  if (provider === undefined || model === undefined) return undefined
  return `${provider.toLowerCase()}/${model.toLowerCase()}`
}

const XOGPU_SOURCE = "中转站 xogpu 报价页（CNY，per 1M tokens，用户实付）"
const OPENROUTER_SOURCE = "OpenRouter /api/v1/models（USD，per 1M tokens，公开参考价）"
const DEEPSEEK_SOURCE = "DeepSeek 官方页（USD，peak 档作保守上界）"

/**
 * Table A — what the user pays, through the relay station.
 *
 * Cache-read/cache-write cells the page renders as "—" are `null` on purpose:
 * they are unlisted, and counting them as 0 with a `partial` marker is the only
 * honest option (treating them as free would understate the bill silently).
 */
const XOGPU: PricingTable = {
  id: "xogpu",
  version: "2026-10-20.2",
  asOf: "2026-10-20",
  currency: "CNY",
  source: XOGPU_SOURCE,
  models: {
    "anthropic/claude-opus-5": { input: 35, output: 175, cacheWrite: 43.75, cacheRead: 3.5 },
    "anthropic/claude-opus-5-5": { input: 28, output: 140, cacheWrite: 35, cacheRead: null },
    "anthropic/claude-fable-5": { input: 70, output: 350, cacheWrite: 87.5, cacheRead: 7 },
    "anthropic/claude-fable-5-1": { input: 70, output: 350, cacheWrite: 87.5, cacheRead: 1.75 },
    "anthropic/claude-sonnet-5": { input: 14, output: 70, cacheWrite: 17.5, cacheRead: 1.4 },
    "anthropic/claude-sonnet-5-5": { input: 14, output: 70, cacheWrite: null, cacheRead: 2.8 },
    "anthropic/claude-sonnet-4": { input: 21, output: 105, cacheWrite: 26.25, cacheRead: 2.1 },
    "anthropic/claude-opus-4-8": { input: 35, output: 175, cacheWrite: 43.75, cacheRead: 3.5 },
    "anthropic/claude-opus-4-7": { input: 35, output: 175, cacheWrite: 43.75, cacheRead: 3.5 },
    "anthropic/claude-opus-4-6": { input: 35, output: 175, cacheWrite: 43.75, cacheRead: 3.5 },
    "anthropic/claude-opus-4-5": { input: 35, output: 175, cacheWrite: 43.75, cacheRead: 3.5 },
    "anthropic/claude-opus-4-5-fixed": { input: 35, output: 175, cacheWrite: 43.75, cacheRead: 3.5 },
    "anthropic/claude-haiku-4": { input: 7, output: 35, cacheWrite: 8.75, cacheRead: 0.7 },
    "anthropic/claude-haiku-5-5": { input: 0.7, output: 3.5, cacheWrite: null, cacheRead: 0.007 },
    "openai/gpt-5-6-sol": { input: 35, output: 210, cacheWrite: 43.75, cacheRead: 3.5 },
    "openai/gpt-5-6-terra": { input: 17.5, output: 105, cacheWrite: 21.88, cacheRead: 1.75 },
    "openai/gpt-6-1-sol": { input: 14, output: 70, cacheWrite: null, cacheRead: null },
    "openai/gpt-6-astra": { input: 70, output: 350, cacheWrite: 87.5, cacheRead: 7 },
    "openai/gpt-5-5": { input: 35, output: 210, cacheWrite: 0, cacheRead: 3.5 },
  },
}

/**
 * Table B — public USD reference.
 *
 * Generated from the OpenRouter `/api/v1/models` response (per-token strings
 * × 1e6, 4 decimals), plus DeepSeek's own page because DSH talks to
 * `deepseek-official` directly rather than through OpenRouter.
 */
const OPENROUTER: PricingTable = {
  id: "openrouter",
  version: "2026-10-20.1",
  asOf: "2026-10-20",
  currency: "USD",
  source: OPENROUTER_SOURCE,
  models: {
    "anthropic/claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
    "anthropic/claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
    "anthropic/claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
    "anthropic/claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
    "anthropic/claude-opus-4-8": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
    "anthropic/claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
    "anthropic/claude-fable-5": { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 },
    "openai/gpt-5-6-sol": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.4 },
    "openai/gpt-5-6-terra": { input: 2, output: 12, cacheWrite: 2.5, cacheRead: 0.2 },
    "openai/gpt-6-1-sol": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
    "openai/gpt-6-astra": { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 },
    "openai/gpt-5-5": { input: 5, output: 30, cacheWrite: null, cacheRead: 0.5 },
  },
}

/**
 * Table C — what DeepSeek usage actually costs.
 *
 * DSH sessions talk to `deepseek-official`, which bills in USD; that is real
 * money, not a reference figure, so it gets its own table and its own primary
 * column. DeepSeek charges cache hit vs miss only and has no separate write fee,
 * so `cacheWrite` is 0 by provider design rather than an unlisted channel.
 */
const OFFICIAL: PricingTable = {
  id: "official",
  version: "2026-10-20.1",
  asOf: "2026-10-20",
  currency: "USD",
  source: DEEPSEEK_SOURCE,
  models: {
    // DeepSeek bills cache hit vs miss only; there is no separate write fee, so
    // cache-write is 0 by provider design rather than an unlisted channel.
    "deepseek-official/deepseek-flash": {
      input: 0.3,
      output: 1.2,
      cacheWrite: 0,
      cacheRead: 0.006,
      currency: "USD",
      rate: "peak",
    },
    "deepseek-account/deepseek-flash": {
      input: 0.3,
      output: 1.2,
      cacheWrite: 0,
      cacheRead: 0.006,
      currency: "USD",
      rate: "peak",
    },
    "deepseek-official/deepseek-v4-pro": {
      input: 1.32,
      output: 3.96,
      cacheWrite: 0,
      cacheRead: 0.044,
      currency: "USD",
      rate: "peak",
    },
    "deepseek-account/deepseek-v4-pro": {
      input: 1.32,
      output: 3.96,
      cacheWrite: 0,
      cacheRead: 0.044,
      currency: "USD",
      rate: "peak",
    },
  },
}

/** Both tables, keyed by id. */
export const TABLES: Record<TableId, PricingTable> = { xogpu: XOGPU, official: OFFICIAL, openrouter: OPENROUTER }

/** Table ids in presentation order (primary candidates first). */
export const TABLE_IDS: readonly TableId[] = ["xogpu", "official", "openrouter"]

/**
 * Order in which a model's *primary* price is looked for.
 *
 * A model's primary table is decided per model, not per session: Claude/GPT are
 * paid through the relay (CNY), DeepSeek is paid to the provider (USD), and a
 * session may mix both. `openrouter` is never primary — it is the reference
 * column.
 */
export const PRIMARY_ORDER: readonly TableId[] = ["xogpu", "official"]

/**
 * Which table answers for one model as its primary price.
 * @param provider - provider as the IR reports it.
 * @param model - model id as the IR reports it.
 * @param tables - tables to search; defaults to every shipped table.
 * @returns the first table in {@link PRIMARY_ORDER} that lists the model, else null.
 */
export function primaryTableFor(
  provider: string | undefined,
  model: string | undefined,
  tables: Partial<Record<TableId, PricingTable>> = TABLES
): TableId | null {
  for (const id of PRIMARY_ORDER) {
    const table = tables[id]
    if (table === undefined) continue
    if (lookupPrice(table, provider, model) !== undefined) return id
  }
  return null
}

/**
 * Resolve a table by id.
 * @param id - table id; defaults to the relay table.
 */
export function tableById(id: TableId = "xogpu"): PricingTable {
  return TABLES[id]
}

/** Backwards-compatible alias: the default table. */
export const PRICING: PricingTable = XOGPU

/**
 * Look one model up.
 *
 * An entry that names no currency inherits the table's, so a table can be mostly
 * one currency without repeating it on every row.
 * @param table - the table to read.
 * @param provider - provider as the IR reports it (may be absent).
 * @param model - model id as the IR reports it (may be absent).
 * @returns the rates with a resolved `currency`, or undefined when not covered.
 */
export function lookupPrice(
  table: PricingTable,
  provider: string | undefined,
  model: string | undefined
): (ModelPrice & { currency: Currency }) | undefined {
  if (provider === undefined || model === undefined) return undefined
  // Exact spelling first, then the dot-folded one: the tables keep the spelling
  // of their source page, and the log may spell it either way.
  const entry = table.models[displayKey(provider, model) ?? ""] ?? table.models[modelKey(provider, model) ?? ""]
  if (entry === undefined) return undefined
  return { ...entry, currency: entry.currency ?? table.currency }
}
