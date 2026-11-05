import {
  type BalanceSource,
  type BalanceValue,
  type BalanceWallet,
  isAmount,
  isRecord,
  isWallets,
  type UtilityFailureReason,
} from "../../protocol/utilities.ts"
import { normalizeCredentialRef, type SettingsFace } from "./credential-ref.ts"
import {
  BALANCE_TIMEOUT_MS,
  requestUtilityJson,
  type UtilityRequest,
  UtilityRequestError,
  withUtilityTimeout,
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
  /** Host settings service; the balance read follows its DeepSeek `apiKeyEnv`. */
  settings?: SettingsFace
}
export interface BalanceDeps {
  credentialsSupported: boolean
  /**
   * Resolved fresh on every read: the Host may change the DeepSeek adapter's
   * `apiKeyEnv` while the panel is open, and a cached reference would keep
   * reading the previous one until restart. Absent on old Hosts and test
   * doubles, where the default reference applies.
   */
  credentialRef?: () => string
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
/** The balance surface the `/balance` route needs; tests supply their own. */
export interface BalanceReadSource {
  read(options: BalanceOptions, force?: boolean): Promise<BalanceValue>
  /** Whether `read(options, force)` answers from the cache or an in-flight request. */
  wouldReuse(force?: boolean): boolean
}
export const BALANCE_TTL_MS = 30_000

function officialWallets(response: unknown): { available: boolean; value: BalanceWallet[] } | undefined {
  // An empty `balance_infos` list means "no wallets" — the official API answers
  // it when the account holds no balance at all — so it is a ready empty state,
  // not a malformed response.
  if (
    !isRecord(response) ||
    typeof response.is_available !== "boolean" ||
    !Array.isArray(response.balance_infos) ||
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
  private queued: Promise<BalanceValue> | undefined
  private generation = 0
  constructor(
    private deps: BalanceDeps,
    private request: UtilityRequest = requestUtilityJson,
  ) {}
  invalidate(): void {
    this.generation++
    this.cached = undefined
    this.inflight = undefined
    this.queued = undefined
  }
  /** Whether `read(options, force)` would answer without touching the provider. */
  wouldReuse(force = false): boolean {
    // A forced read either queues a fresh request behind the in-flight one or
    // bypasses the cache, so only non-forced calls can answer without work.
    return !force && (this.inflight !== undefined || this.fresh() !== undefined)
  }
  private fresh(): BalanceValue | undefined {
    if (this.cached === undefined) return undefined
    const age = Date.now() - this.cached.checkedAt
    // A negative age means the clock moved backwards; treat that as stale.
    return age >= 0 && age < BALANCE_TTL_MS ? this.cached : undefined
  }
  /** Never cache the reference: a renamed `apiKeyEnv` applies to the next read. */
  private ref(): string {
    return normalizeCredentialRef(this.deps.credentialRef?.())
  }
  read(options: BalanceOptions, force = false): Promise<BalanceValue> {
    // Mirror the browser store's force rule: a refresh click never answers with
    // the request that was already running; it queues one fresh read behind it.
    if (this.inflight !== undefined) return force ? this.enqueue(options) : this.inflight
    const cached = force ? undefined : this.fresh()
    if (cached !== undefined) return Promise.resolve(cached)
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
  /** Wait for the in-flight read, then run one forced read; concurrent callers merge. */
  private enqueue(options: BalanceOptions): Promise<BalanceValue> {
    if (this.queued !== undefined) return this.queued
    const queued = (this.inflight ?? Promise.resolve()).then(() => {
      this.queued = undefined
      return this.read(options, true)
    })
    this.queued = queued
    return queued
  }
  private async load(options: BalanceOptions): Promise<BalanceValue> {
    let source: BalanceSource = "api-key"
    let fallback: UtilityFailureReason = "credential-error"
    try {
      const credentials = this.deps.credentials()
      const resolved =
        credentials === undefined ? undefined : await withUtilityTimeout(() => credentials.resolve(this.ref()))
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
