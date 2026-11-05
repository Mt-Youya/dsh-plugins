import { useEffect, useSyncExternalStore } from "react"

import {
  isBalanceValue,
  type BalanceFailureReason,
  type BalanceValue,
  type VersionValue,
} from "../../protocol/utilities.ts"
import { PLUGIN_NAME } from "../../version.ts"
import type { Api } from "../api.ts"
import { SettingsStore, useSettings } from "./settings.ts"

export interface UtilitySnapshot {
  balance: BalanceValue | null
  version: VersionValue | null
  balancePending: boolean
  versionPending: boolean
}
/** Shared by panel and package details, with no local persistence or credential data. */
export class UtilityStore {
  private snapshot: UtilitySnapshot = { balance: null, version: null, balancePending: false, versionPending: false }
  private listeners = new Set<() => void>()
  private balanceFlight: Promise<void> | undefined
  private versionFlight: Promise<void> | undefined
  private balanceAt = 0
  private versionAt = 0
  private disposed = false
  private controller = new AbortController()
  constructor(private api: Pick<Api, "balance" | "version">) {}
  getSnapshot = (): UtilitySnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(patch: Partial<UtilitySnapshot>): void {
    if (this.disposed) return
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
  refreshBalance = (force = true): Promise<void> => {
    if (this.disposed) return Promise.resolve()
    if (this.balanceFlight !== undefined) return this.balanceFlight
    if (!force && this.balanceAt > 0 && Date.now() - this.balanceAt < 30_000) return Promise.resolve()
    this.publish({ balancePending: true })
    const failed = (reason: BalanceFailureReason): void => {
      this.publish({ balance: { status: "failed", checkedAt: Date.now(), reason } })
    }
    const pending = this.api
      .balance(force, this.controller.signal)
      .then((result) => {
        this.balanceAt = Date.now()
        if (result.ok) {
          if (!isBalanceValue(result.value)) failed("invalid-response")
          else if (result.value.status === "failed") {
            const { checkedAt, reason, source } = result.value
            this.publish({ balance: { status: "failed", checkedAt, reason, source } })
          } else this.publish({ balance: result.value })
        } else {
          failed(
            result.status === 404 || result.status === 401 || result.status === 403 || result.error === "network"
              ? "host-unavailable"
              : result.status === 429
                ? "rate-limited"
                : result.status !== undefined && result.status >= 400
                  ? "http-error"
                  : "invalid-response",
          )
        }
      })
      .catch(() => {
        failed("host-unavailable")
      })
      .finally(() => {
        this.balanceFlight = undefined
        this.publish({ balancePending: false })
      })
    this.balanceFlight = pending
    return pending
  }
  checkVersion = (manual = true): Promise<void> => {
    if (this.disposed) return Promise.resolve()
    if (this.versionFlight !== undefined) return this.versionFlight
    if (!manual && this.versionAt > 0 && Date.now() - this.versionAt < 3_600_000) return Promise.resolve()
    this.publish({ versionPending: true })
    const failed = (): void =>
      this.publish({
        version: {
          status: "failed",
          packageName: this.snapshot.version?.packageName ?? PLUGIN_NAME,
          currentVersion: this.snapshot.version?.currentVersion ?? "",
          checkedAt: Date.now(),
        },
      })
    const pending = this.api
      .version(manual, this.controller.signal)
      .then((result) => {
        this.versionAt = Date.now()
        if (result.ok) this.publish({ version: result.value })
        else failed()
      })
      .catch(failed)
      .finally(() => {
        this.versionFlight = undefined
        this.publish({ versionPending: false })
      })
    this.versionFlight = pending
    return pending
  }
  dispose(): void {
    this.disposed = true
    this.controller.abort()
    this.listeners.clear()
  }
}
export function useUtilities(store: UtilityStore, settingsStore: SettingsStore): UtilitySnapshot {
  const settings = useSettings(settingsStore)
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => {
    if (settings.status !== "ready") return
    if (settings.value.deepseekBalance) void store.refreshBalance(false)
    if (settings.value.autoCheckVersion) void store.checkVersion(false)
  }, [store, settings.status, settings.value.deepseekBalance, settings.value.autoCheckVersion])
  return snapshot
}
