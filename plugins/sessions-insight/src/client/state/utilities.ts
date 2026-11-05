import { useEffect, useSyncExternalStore } from "react"

import {
  isBalanceValue,
  type BalanceFailureReason,
  type BalanceValue,
  type VersionValue,
} from "../../protocol/utilities.ts"
import { PLUGIN_NAME } from "../../version.ts"
import type { Api, ApiResult } from "../api.ts"
import { SettingsStore, useSettings } from "./settings.ts"

export interface UtilitySnapshot {
  balance: BalanceValue | null
  version: VersionValue | null
  balancePending: boolean
  versionPending: boolean
}

/**
 * One auxiliary read's in-flight rule, its cancellation, and the guard that
 * decides whether a settle is still worth publishing.
 *
 * A non-forced call reuses whatever is in flight; a forced call queues a single
 * retry behind it, so a refresh click always produces a fresh request without
 * flooding the provider. Each request owns its own `AbortController`, and a
 * settle from a superseded or disposed lane is dropped here instead of in every
 * caller — the store only projects values onto the snapshot.
 */
class UtilityLane<T> {
  private flight: Promise<void> | undefined
  private queued: Promise<void> | undefined
  private controller: AbortController | undefined
  private generation = 0
  constructor(
    private readonly read: (force: boolean, signal: AbortSignal) => Promise<T | undefined>,
    private readonly apply: (value: T) => void,
    private readonly pending: (value: boolean) => void,
    private readonly disposed: () => boolean,
  ) {}
  request(force: boolean, throttled: () => boolean): Promise<void> {
    if (this.disposed()) return Promise.resolve()
    if (this.flight !== undefined) {
      if (!force) return this.flight
      return this.enqueue()
    }
    if (!force && throttled()) return Promise.resolve()
    return this.launch(force)
  }
  /** Wait for the current request to settle, then run one forced request; callers merge. */
  private enqueue(): Promise<void> {
    if (this.queued !== undefined) return this.queued
    const queued = (this.flight ?? Promise.resolve()).then(() => {
      this.queued = undefined
      return this.request(true, () => false)
    })
    this.queued = queued
    return queued
  }
  private launch(force: boolean): Promise<void> {
    const generation = ++this.generation
    const controller = new AbortController()
    this.controller = controller
    this.pending(true)
    const flight = this.read(force, controller.signal)
      .then((value) => {
        if (this.current(generation) && value !== undefined) this.apply(value)
      })
      // The read converts transport failures itself; nothing may escape the lane.
      .catch(() => {})
      .finally(() => {
        if (this.controller === controller) this.controller = undefined
        if (this.flight === flight) this.flight = undefined
        if (this.current(generation)) this.pending(false)
      })
    this.flight = flight
    return flight
  }
  /** Whether a settle from `generation` still belongs to the newest request. */
  private current(generation: number): boolean {
    return !this.disposed() && generation === this.generation
  }
  dispose(): void {
    this.controller?.abort()
  }
}

interface BalanceAnswer {
  value: BalanceValue
  /** False when the transport itself failed, so the automatic-check window is not reset. */
  answered: boolean
}
interface VersionAnswer {
  value: VersionValue
  answered: boolean
}

/**
 * The last balance failure reason the Host answer implies.
 * @param error - classification of the failed answer.
 * @param status - HTTP status when one was received.
 * @returns the reason the panel renders.
 */
function balanceFailureReason(error: string, status: number | undefined): BalanceFailureReason {
  if (status === 404 || status === 401 || status === 403 || error === "network") return "host-unavailable"
  if (status === 429) return "rate-limited"
  if (status !== undefined && status >= 400) return "http-error"
  return "invalid-response"
}

/** Shared by panel and package details, with no local persistence or credential data. */
export class UtilityStore {
  private snapshot: UtilitySnapshot = { balance: null, version: null, balancePending: false, versionPending: false }
  private listeners = new Set<() => void>()
  private balanceAt = 0
  private versionAt = 0
  private disposed = false
  private readonly balance: UtilityLane<BalanceAnswer>
  private readonly version: UtilityLane<VersionAnswer>
  constructor(private api: Pick<Api, "balance" | "version">) {
    this.balance = new UtilityLane(
      this.readBalance,
      (answer) => {
        if (answer.answered) this.balanceAt = Date.now()
        this.publish({ balance: answer.value })
      },
      (pending) => this.publish({ balancePending: pending }),
      () => this.disposed,
    )
    this.version = new UtilityLane(
      this.readVersion,
      (answer) => {
        if (answer.answered) this.versionAt = Date.now()
        this.publish({ version: answer.value })
      },
      (pending) => this.publish({ versionPending: pending }),
      () => this.disposed,
    )
  }
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
  private readBalance = async (
    force: boolean,
    signal: AbortSignal,
  ): Promise<BalanceAnswer | undefined> => await this.read(this.api.balance(force, signal), (result) => {
    if (!result.ok) return { value: { status: "failed", checkedAt: Date.now(), reason: balanceFailureReason(result.error, result.status) }, answered: true }
    if (!isBalanceValue(result.value)) return { value: { status: "failed", checkedAt: Date.now(), reason: "invalid-response" }, answered: true }
    if (result.value.status === "failed") {
      const { checkedAt, reason, source } = result.value
      return { value: { status: "failed", checkedAt, reason, source }, answered: true }
    }
    return { value: result.value, answered: true }
  })
  private readVersion = async (
    manual: boolean,
    signal: AbortSignal,
  ): Promise<VersionAnswer | undefined> => await this.read(this.api.version(manual, signal), (result) => {
    if (result.ok) return { value: result.value, answered: true }
    return {
      value: {
        status: "failed",
        packageName: this.snapshot.version?.packageName ?? PLUGIN_NAME,
        currentVersion: this.snapshot.version?.currentVersion ?? "",
        checkedAt: Date.now(),
      },
      answered: true,
    }
  })
  /**
   * Shared transport settlement: a rejected transport and an aborted answer are
   * both "not an answer" for the panel, so neither overwrites the last success.
   * @param request - the pending Host read.
   * @param project - maps one accepted answer onto the snapshot value.
   * @returns the projected answer, or undefined when nothing may be published.
   */
  private async read<T, A>(
    request: Promise<ApiResult<T>>,
    project: (result: ApiResult<T>) => A,
  ): Promise<A | undefined> {
    let answered = true
    const result = await request.catch(() => {
      answered = false
      return { ok: false as const, error: "network" as const }
    })
    // A cancelled request is not an answer: keep the last successful value.
    if (!result.ok && result.error === "aborted") return undefined
    const answer = project(result) as A & { answered: boolean }
    return { ...answer, answered: answered && answer.answered }
  }
  /** Automatic checks reuse the 30s balance window; manual refreshes always read. */
  refreshBalance = (force = true): Promise<void> =>
    this.balance.request(force, () => this.balanceAt > 0 && Date.now() - this.balanceAt < 30_000)
  /** Automatic checks reuse the 1h version window; manual checks always read. */
  checkVersion = (manual = true): Promise<void> =>
    this.version.request(manual, () => this.versionAt > 0 && Date.now() - this.versionAt < 3_600_000)
  dispose(): void {
    this.disposed = true
    this.balance.dispose()
    this.version.dispose()
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
