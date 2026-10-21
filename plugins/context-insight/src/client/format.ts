/**
 * Presentation arithmetic. Nothing here decides meaning: it only turns the IR's
 * numbers into text the panel can print without losing precision, and keeps
 * every rounding rule in one place.
 *
 * @module @cyrus/dsh-context-insight/client/format
 */

const GROUPED = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

/** The currency sign, kept out of the literals so no tooling mangles it. */
const DOLLAR = String.fromCharCode(36)

/**
 * Group-separated integer, the form used wherever a token count is a claim.
 * @param value - token count; may be negative (an over-counted defect).
 */
export function formatTokens(value: number): string {
  return GROUPED.format(Math.round(value))
}

/**
 * Short form for a bar label: 980 / 4.2k / 423k / 1.1M.
 * @param value - token count.
 */
export function compactTokens(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs < 1000) return sign + String(Math.round(abs))
  if (abs < 10_000) return sign + (abs / 1000).toFixed(1) + "k"
  if (abs < 1_000_000) return sign + String(Math.round(abs / 1000)) + "k"
  return sign + (abs / 1_000_000).toFixed(1) + "M"
}

/**
 * US-dollar amount, with enough decimals to keep a single turn readable.
 * @param usd - amount in USD.
 */
export function formatUsd(usd: number): string {
  return DOLLAR + usd.toFixed(usd < 0.01 ? 4 : 3)
}

/**
 * Money in its own currency, never converted.
 * @param amount - amount in `currency`.
 * @param currency - ISO code; unknown codes fall back to the code itself.
 */
export function formatMoney(amount: number, currency: string | undefined): string {
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? DOLLAR : ""
  const decimals = Math.abs(amount) >= 1 ? 2 : 4
  return symbol + amount.toFixed(decimals)
}

/**
 * Share of a whole, as a percentage string with one decimal.
 * @param part - numerator.
 * @param whole - denominator; a non-positive whole answers `—`.
 */
export function formatShare(part: number, whole: number): string {
  if (!Number.isFinite(whole) || whole <= 0) return "—"
  return (Math.round((part / whole) * 1000) / 10).toFixed(1) + "%"
}

/**
 * Reconciliation factor, printed the way the ADR talks about it.
 * @param factor - `reconciled.factor`.
 */
export function formatFactor(factor: number): string {
  return "×" + (Math.round(factor * 1000) / 1000).toFixed(3)
}

/**
 * File size.
 * @param bytes - byte count.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return String(bytes) + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

const TIME = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

/**
 * Local wall-clock time of an epoch value.
 * @param epoch - milliseconds since the Unix epoch.
 */
export function formatTime(epoch: number): string {
  if (!Number.isFinite(epoch) || epoch <= 0) return "—"
  return TIME.format(new Date(epoch))
}

/**
 * Duration between two epoch values, in the unit a reader scans fastest.
 * @param from - start, epoch milliseconds.
 * @param to - end, epoch milliseconds; omitted means "unknown".
 */
/**
 * A tree row has one narrow line to share with the title, so the timestamp is
 * reduced to the parts that still tell two sessions apart.
 * @param epoch - milliseconds since the Unix epoch.
 * @returns `MM-DD HH:mm` in local time.
 */
export function formatShortTime(epoch: number): string {
  const date = new Date(epoch)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDuration(from: number, to?: number): string {
  if (to === undefined || !Number.isFinite(to) || to < from) return "—"
  const ms = to - from
  if (ms < 1000) return String(Math.round(ms)) + " ms"
  if (ms < 60_000) return (ms / 1000).toFixed(1) + " s"
  const minutes = Math.floor(ms / 60_000)
  return String(minutes) + " min " + String(Math.round((ms % 60_000) / 1000)) + " s"
}

/** A path split into the part a two-line label shows. */
export interface PathParts {
  /** Everything above the leaf, with a trailing separator; '' for a bare name. */
  parent: string
  /** The leaf directory, always shown in full. */
  leaf: string
}

/**
 * Split a workdir so the leaf survives truncation.
 *
 * A column 300px wide cannot show `/Users/me/codes/hubs/portfolio` whole, and
 * truncating its tail hides exactly the segment that identifies the project. The
 * panel therefore renders the parent dimmed on one line and the leaf on the
 * next, so the leaf is never the part that gets cut.
 * @param path - a filesystem path.
 */
export function splitPath(path: string): PathParts {
  if (path === "") return { parent: "", leaf: "" }
  const trimmed = path.replace(/[\\/]+$/, "")
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"))
  if (index <= 0) return { parent: "", leaf: trimmed }
  return { parent: trimmed.slice(0, index + 1), leaf: trimmed.slice(index + 1) }
}

/**
 * Last path segment.
 * @param path - a filesystem path.
 */
export function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "")
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"))
  return index < 0 ? trimmed : trimmed.slice(index + 1)
}

/**
 * Longest text a cell prints before the caller has to offer an expansion.
 * @param text - candidate.
 * @param limit - maximum characters.
 */
export function clip(text: string, limit: number): string {
  return text.length <= limit ? text : text.slice(0, limit)
}
