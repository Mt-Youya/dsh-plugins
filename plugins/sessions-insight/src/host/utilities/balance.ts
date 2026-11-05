import {
  isAmount,
  isRecord,
  isWallets,
  type BalanceSource,
  type BalanceValue,
  type BalanceWallet,
  type UtilityFailureReason,
} from "../../protocol/utilities.ts"
import {
  BALANCE_TIMEOUT_MS,
  UtilityRequestError,
  requestUtilityJson,
  withUtilityTimeout,
  type UtilityRequest,
} from "./https.ts"

export interface CredentialsFace {
  resolve(
    ref: string,
  ): { value: string; source: unknown } | undefined | Promise<{ value: string; source: unknown } | undefined>
}
export interface AccountFace {
  getBalance(args: { version: string; locale: string; timezoneOffsetSeconds: number }): Promise<unknown>
}
export interface UtilityServices {
  credentials?: CredentialsFace
  deepseekAccount?: AccountFace
}
export interface BalanceDeps {
  credentialsSupported: boolean
  credentials: () => CredentialsFace | undefined
  account: () => AccountFace | undefined
  /** Only consulted for old Hosts without the credentials child-injection capability. */
  envKey?: () => string | undefined
  version: string
}
export interface BalanceOptions {
  locale: string
  timezoneOffsetSeconds: number
}
export const BALANCE_TTL_MS = 30_000

function officialWallets(response: unknown): { available: boolean; value: BalanceWallet[] } | undefined {
  if (
    !isRecord(response) ||
    typeof response.is_available !== "boolean" ||
    !Array.isArray(response.balance_infos) ||
    response.balance_infos.length === 0 ||
    response.balance_infos.length > 32
  )
    return undefined
  const value: BalanceWallet[] = []
  for (const row of response.balance_infos) {
    if (
      !isRecord(row) ||
      (row.currency !== "CNY" && row.currency !== "USD") ||
      !isAmount(row.total_balance) ||
      !isAmount(row.granted_balance) ||
      !isAmount(row.topped_up_balance)
    )
      return undefined
    value.push({
      currency: row.currency,
      balance: row.total_balance,
      grantedBalance: row.granted_balance,
      toppedUpBalance: row.topped_up_balance,
    })
  }
  return { available: response.is_available, value }
}
function projectWallets(rows: BalanceWallet[]): BalanceWallet[] {
  return rows.map(({ currency, balance }) => ({ currency, balance }))
}
export class BalanceReader {
  private cached: BalanceValue | undefined
  private inflight: Promise<BalanceValue> | undefined
  private generation = 0
  constructor(
    private deps: BalanceDeps,
    private request: UtilityRequest = requestUtilityJson,
  ) {}
  invalidate(): void {
    this.generation++
    this.cached = undefined
    this.inflight = undefined
  }
  read(options: BalanceOptions, force = false): Promise<BalanceValue> {
    if (this.inflight !== undefined) return this.inflight
    if (!force && this.cached !== undefined) {
      const age = Date.now() - this.cached.checkedAt
      // A negative age means the clock moved backwards; treat that as stale.
      if (age >= 0 && age < BALANCE_TTL_MS) return Promise.resolve(this.cached)
    }
    const generation = this.generation
    const pending = this.load(options).then((value) => {
      // Only a ready balance is worth caching: after a failure or a missing
      // credential the next request must re-read, so a freshly written API key
      // is visible immediately instead of after the TTL.
      if (generation === this.generation) this.cached = value.status === "ready" ? value : undefined
      return value
    })
    this.inflight = pending
    void pending.finally(() => {
      if (this.inflight === pending) this.inflight = undefined
    })
    return pending
  }
  private async load(options: BalanceOptions): Promise<BalanceValue> {
    let source: BalanceSource = "api-key"
    let fallback: UtilityFailureReason = "credential-error"
    try {
      const credentials = this.deps.credentials()
      const resolved =
        credentials === undefined ? undefined : await withUtilityTimeout(() => credentials.resolve("DEEPSEEK_API_KEY"))
      const key =
        resolved?.value ??
        (!this.deps.credentialsSupported && credentials === undefined
          ? (this.deps.envKey ?? (() => process.env.DEEPSEEK_API_KEY))()
          : undefined)
      if (typeof key === "string" && key.trim() !== "") {
        fallback = "network"
        const wallets = officialWallets(await this.request("balance", key))
        if (wallets === undefined) throw new UtilityRequestError("invalid-response")
        return { status: "ready", checkedAt: Date.now(), source: "api-key", ...wallets, bonusWallets: [] }
      }
      source = "account"
      fallback = "account-error"
      const account = this.deps.account()
      if (account === undefined) return { status: "missing-credentials", checkedAt: Date.now() }
      const result = await withUtilityTimeout(
        () => account.getBalance({ version: this.deps.version, ...options }),
        BALANCE_TIMEOUT_MS,
      )
      if (result === null) return { status: "missing-credentials", checkedAt: Date.now() }
      if (isRecord(result) && result.status === "failed") throw new UtilityRequestError("account-error")
      if (!isRecord(result) || result.status !== "ready" || !isWallets(result.value))
        throw new UtilityRequestError("invalid-response")
      // Only known monetary fields cross the wire; never forward arbitrary service data.
      const bonuses = Array.isArray(result.bonusWallets)
        ? result.bonusWallets.filter((row) => isWallets([row])).slice(0, 32)
        : []
      return {
        status: "ready",
        checkedAt: Date.now(),
        source: "account",
        available: null,
        value: projectWallets(result.value),
        bonusWallets: projectWallets(bonuses as BalanceWallet[]),
      }
    } catch (error) {
      return {
        status: "failed",
        checkedAt: Date.now(),
        source,
        reason: error instanceof UtilityRequestError ? error.reason : fallback,
      }
    }
  }
}
