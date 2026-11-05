export const BALANCE_PATH = "/api/dsh-sessions-insight/balance"
export const VERSION_PATH = "/api/dsh-sessions-insight/version"
export const BALANCE_URL = BALANCE_PATH.slice(1)
export const VERSION_URL = VERSION_PATH.slice(1)
export const UPDATE_LINKS = {
  "@cyrusdoyle/dsh-plugins": "https://www.npmjs.com/package/@cyrusdoyle/dsh-plugins",
  "@cyrusdoyle/dsh-sessions-insight": "https://www.npmjs.com/package/@cyrusdoyle/dsh-sessions-insight",
} as const
export type PluginName = keyof typeof UPDATE_LINKS
export function isPluginName(value: unknown): value is PluginName {
  return value === "@cyrusdoyle/dsh-plugins" || value === "@cyrusdoyle/dsh-sessions-insight"
}
export const RECHARGE_LINK = "https://platform.deepseek.com/top_up"

export interface BalanceWallet {
  currency: "CNY" | "USD"
  balance: string
  grantedBalance?: string
  toppedUpBalance?: string
}
export const UTILITY_FAILURE_REASONS = [
  "credential-error",
  "unauthorized",
  "rate-limited",
  "timeout",
  "network",
  "http-error",
  "invalid-response",
  "account-error",
] as const
export type UtilityFailureReason = (typeof UTILITY_FAILURE_REASONS)[number]
export type BalanceFailureReason = UtilityFailureReason | "host-unavailable"
export type BalanceSource = "api-key" | "account"
export function isUtilityFailureReason(value: unknown): value is UtilityFailureReason {
  return UTILITY_FAILURE_REASONS.some((reason) => value === reason)
}
export function isBalanceSource(value: unknown): value is BalanceSource {
  return value === "api-key" || value === "account"
}
export type BalanceValue =
  | { status: "disabled" | "missing-credentials"; checkedAt: number }
  | { status: "failed"; checkedAt: number; reason?: BalanceFailureReason; source?: BalanceSource }
  | {
      status: "ready"
      checkedAt: number
      source: BalanceSource
      available: boolean | null
      value: BalanceWallet[]
      bonusWallets: BalanceWallet[]
    }
export type VersionValue = { packageName: PluginName } & (
  | { status: "unchecked" | "disabled" | "failed"; currentVersion: string; checkedAt: number | null }
  | { status: "current" | "update"; currentVersion: string; latestVersion: string; checkedAt: number }
)

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
export function isAmount(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 80 &&
    /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.exec(value)?.[0] === value
  )
}
export function isBalanceWallet(value: unknown): value is BalanceWallet {
  return (
    isRecord(value) &&
    (value.currency === "CNY" || value.currency === "USD") &&
    isAmount(value.balance) &&
    (value.grantedBalance === undefined || isAmount(value.grantedBalance)) &&
    (value.toppedUpBalance === undefined || isAmount(value.toppedUpBalance))
  )
}
export function isWallets(value: unknown): value is BalanceWallet[] {
  return Array.isArray(value) && value.length <= 32 && value.every(isBalanceWallet)
}
function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}
export function isBalanceValue(value: unknown): value is BalanceValue {
  if (!isRecord(value) || !isTimestamp(value.checkedAt)) return false
  if (value.status === "disabled" || value.status === "missing-credentials") return true
  if (value.status === "failed")
    return (
      (value.reason === undefined || value.reason === "host-unavailable" || isUtilityFailureReason(value.reason)) &&
      (value.source === undefined || isBalanceSource(value.source))
    )
  return (
    value.status === "ready" &&
    (value.source === "api-key" || value.source === "account") &&
    (value.available === null || typeof value.available === "boolean") &&
    isWallets(value.value) &&
    (value.source === "account" || value.value.length > 0) &&
    isWallets(value.bonusWallets)
  )
}
export function isVersionValue(value: unknown): value is VersionValue {
  if (
    !isRecord(value) ||
    !isPluginName(value.packageName) ||
    typeof value.currentVersion !== "string" ||
    value.currentVersion.length > 128
  )
    return false
  if (value.status === "unchecked" || value.status === "disabled" || value.status === "failed")
    return value.checkedAt === null || isTimestamp(value.checkedAt)
  return (
    (value.status === "current" || value.status === "update") &&
    isTimestamp(value.checkedAt) &&
    typeof value.latestVersion === "string" &&
    value.latestVersion.length <= 128
  )
}
