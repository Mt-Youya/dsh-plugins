import { useEffect, useSyncExternalStore } from "react"

import { type Settings, SETTINGS_DEFAULTS, settingsFrom, type SettingsKey } from "../../protocol/settings.ts"
import type { Api } from "../api.ts"

/** rc.5 configForms face. The provider owns the form's write queue and lifetime. */
export interface ConfigFormSnapshot {
  status: "loading" | "ready" | "unavailable"
  value?: unknown
  writable: boolean
}
export interface ConfigForm {
  getSnapshot(): ConfigFormSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: boolean): Promise<boolean>
}
export interface ConfigForms {
  get(entryId: string): ConfigForm
  whileServed(entries: readonly string[], register: (served: Set<string>) => () => void): () => void
}

/** The one Host read this bridge needs; the panel and the bundle page share it. */
export type SettingsApi = Pick<Api, "settings">

/** The four surfaces the settings page renders. */
export type SettingsState = "loading" | "ready" | "unavailable" | "save-failed"

export interface SettingsSnapshot {
  value: Settings
  status: "loading" | "ready" | "unavailable"
  writable: boolean
  pending: boolean
  /** Which operation failed last; a successful retry clears it. */
  failure: "read" | "save" | null
  /** Read-failure text from the Host answer, retained for the retry row. */
  detail: string | null
}

/**
 * Collapse the bridge snapshot into the page's four states.
 *
 * `unavailable` covers both a failed read and a form that is served but not
 * writable, so a page that can only read still shows the values it read.
 * @param snapshot - the latest bridge snapshot.
 * @returns the state the surface renders.
 */
export function settingsState(snapshot: SettingsSnapshot): SettingsState {
  if (snapshot.failure === "save" && snapshot.status === "ready" && snapshot.writable) return "save-failed"
  if (snapshot.status === "loading") return "loading"
  if (snapshot.status === "ready" && snapshot.writable) return "ready"
  return "unavailable"
}

/** One bridge shared by the main panel and both package details. Never persists locally. */
export class SettingsStore {
  private snapshot: SettingsSnapshot = {
    value: { ...SETTINGS_DEFAULTS },
    status: "loading",
    writable: false,
    pending: false,
    failure: null,
    detail: null,
  }
  private listeners = new Set<() => void>()
  private form: ConfigForm | undefined
  /** Last read endpoint, so the retry row can read again without being handed one. */
  private api: SettingsApi | undefined
  private lastWrite: { key: SettingsKey; value: boolean } | undefined
  getSnapshot = (): SettingsSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(next: SettingsSnapshot): void {
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
  attach(form: ConfigForm): () => void {
    this.form = form
    const sync = (): void => {
      if (this.form !== form) return
      const current = form.getSnapshot()
      const ready = current.status === "ready"
      this.publish({
        ...this.snapshot,
        status: current.status,
        writable: ready && current.writable,
        value: ready ? settingsFrom(current.value) : this.snapshot.value,
        // A served form replaces whatever the GET reported, failure included.
        failure: ready ? null : this.snapshot.failure,
        detail: ready ? null : this.snapshot.detail,
      })
    }
    const off = form.subscribe(sync)
    sync()
    return () => {
      off()
      if (this.form !== form) return
      this.form = undefined
      this.publish({ ...this.snapshot, status: "unavailable", writable: false, pending: false })
    }
  }
  async load(api: SettingsApi, signal: AbortSignal): Promise<void> {
    this.api = api
    const form = this.form
    // The served form is the only writable source; a GET would only race it.
    if (form !== undefined && form.getSnapshot().status === "ready" && form.getSnapshot().writable) return
    await this.read(api, signal)
  }
  private async read(api: SettingsApi, signal: AbortSignal): Promise<void> {
    let result: Awaited<ReturnType<SettingsApi["settings"]>>
    try {
      result = await api.settings(signal)
    } catch {
      result = { ok: false, error: "network" }
    }
    if (signal.aborted) return
    // A form that became ready while the GET was in flight wins every field.
    if (this.form !== undefined && this.form.getSnapshot().status === "ready") return
    this.publish(
      result.ok
        ? { ...this.snapshot, status: "ready", writable: false, value: result.value, failure: null, detail: null }
        : {
            ...this.snapshot,
            status: "unavailable",
            writable: false,
            failure: "read",
            detail: result.detail ?? result.error,
          },
    )
  }
  async set(key: SettingsKey, value: boolean): Promise<boolean> {
    const form = this.form
    if (form === undefined || !this.snapshot.writable || this.snapshot.pending) return false
    this.lastWrite = { key, value }
    this.publish({ ...this.snapshot, pending: true, failure: null, detail: null })
    let accepted = false
    try {
      accepted = await form.set(key, value)
    } catch {
      accepted = false
    }
    if (this.form === form) this.publish({ ...this.snapshot, pending: false, failure: accepted ? null : "save" })
    return accepted
  }
  /** Retry whatever failed: the last write, otherwise the read that populated the page. */
  async retry(): Promise<void> {
    if (settingsState(this.snapshot) === "save-failed") {
      const last = this.lastWrite
      if (last !== undefined) await this.set(last.key, last.value)
      return
    }
    const api = this.api
    if (api === undefined) return
    this.publish({ ...this.snapshot, status: "loading", failure: null, detail: null })
    await this.load(api, new AbortController().signal)
  }
}

export function useSettings(store: SettingsStore, api?: SettingsApi): SettingsSnapshot {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => {
    if (api === undefined) return
    const controller = new AbortController()
    void store.load(api, controller.signal)
    return () => controller.abort()
  }, [store, api])
  return snapshot
}
