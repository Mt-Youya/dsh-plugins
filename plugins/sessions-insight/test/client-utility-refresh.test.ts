import { describe, expect, it, vi } from "vitest"

import { UtilityStore } from "../src/client/state/utilities.ts"

const ok = <T>(value: T) => ({ ok: true as const, value })
/** Let the store's settle handlers (and the queued forced request) run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const version = {
  packageName: "@cyrusdoyle/dsh-sessions-insight" as const,
  status: "update" as const,
  currentVersion: "0.0.5",
  latestVersion: "0.0.6",
  checkedAt: 1,
}

describe("utility refresh semantics", () => {
  it("joins a non-forced in-flight read, then forces exactly one refresh after it settles", async () => {
    const forces: boolean[] = []
    const resolve: ((value: { ok: true; value: unknown }) => void)[] = []
    const api = {
      balance: vi.fn((force = false) => {
        forces.push(force)
        return new Promise<{ ok: true; value: unknown }>((done) => {
          resolve.push(done)
        })
      }),
      version: vi.fn(),
    }
    const store = new UtilityStore(api as never)
    const automatic = store.refreshBalance(false)
    expect(store.refreshBalance(false)).toBe(automatic)
    const forced = store.refreshBalance(true)
    expect(forced).not.toBe(automatic)
    expect(store.refreshBalance(true)).toBe(forced)
    expect(forces).toEqual([false])

    resolve[0]!(ok({ status: "missing-credentials", checkedAt: 1 }))
    await flush()
    expect(forces).toEqual([false, true])

    resolve[1]!(ok({ status: "missing-credentials", checkedAt: 2 }))
    await Promise.all([automatic, forced])
    expect(store.getSnapshot().balance).toMatchObject({ status: "missing-credentials", checkedAt: 2 })
    expect(store.getSnapshot().balancePending).toBe(false)
    store.dispose()
  })
  it("merges concurrent manual version checks into one forced check after the automatic one settles", async () => {
    const manuals: boolean[] = []
    const resolve: ((value: { ok: true; value: unknown }) => void)[] = []
    const api = {
      balance: vi.fn(),
      version: vi.fn((manual = false) => {
        manuals.push(manual)
        return new Promise<{ ok: true; value: unknown }>((done) => {
          resolve.push(done)
        })
      }),
    }
    const store = new UtilityStore(api as never)
    const automatic = store.checkVersion(false)
    const forced = store.checkVersion(true)
    expect(store.checkVersion(true)).toBe(forced)
    expect(manuals).toEqual([false])

    resolve[0]!(ok(version))
    await flush()
    expect(manuals).toEqual([false, true])

    resolve[1]!(ok({ ...version, status: "current", latestVersion: version.currentVersion }))
    await Promise.all([automatic, forced])
    expect(store.getSnapshot()).toMatchObject({ version: { status: "current" }, versionPending: false })
    store.dispose()
  })
  it("keeps the last successful value when a transport answer is aborted", async () => {
    const ready = {
      status: "ready" as const,
      checkedAt: 1,
      source: "api-key" as const,
      available: true,
      value: [{ currency: "USD", balance: "1.00" }],
      bonusWallets: [],
    }
    const answers: unknown[] = [ok(ready), { ok: false, error: "aborted" }]
    const api = { balance: vi.fn(async () => answers.shift()), version: vi.fn() }
    const store = new UtilityStore(api as never)
    await store.refreshBalance()
    expect(store.getSnapshot().balance).toMatchObject({ status: "ready" })
    await store.refreshBalance()
    expect(store.getSnapshot().balance).toMatchObject({ status: "ready", value: ready.value })
    expect(store.getSnapshot().balancePending).toBe(false)
    expect(store.getSnapshot().balance).not.toMatchObject({ status: "failed" })
    store.dispose()
  })
  it("gives each request its own cancellation and stops publishing after dispose", async () => {
    const signals: AbortSignal[] = []
    const resolve: ((value: unknown) => void)[] = []
    const api = {
      balance: vi.fn((_force = false, signal?: AbortSignal) => {
        signals.push(signal as AbortSignal)
        return new Promise((done) => {
          resolve.push(done)
        })
      }),
      version: vi.fn(),
    }
    const store = new UtilityStore(api as never)
    const first = store.refreshBalance()
    resolve[0]!(ok({ status: "missing-credentials", checkedAt: 1 }))
    await first
    const second = store.refreshBalance()
    expect(signals).toHaveLength(2)
    expect(signals[0]).not.toBe(signals[1])
    expect(signals[0]!.aborted).toBe(false)

    store.dispose()
    expect(signals[1]!.aborted).toBe(true)
    resolve[1]!({ ok: false, error: "late-failure" })
    await second
    expect(store.getSnapshot().balance).toMatchObject({ status: "missing-credentials", checkedAt: 1 })
    // A call after dispose resolves instead of hanging on a dead store.
    await expect(store.refreshBalance()).resolves.toBeUndefined()
    expect(api.balance).toHaveBeenCalledTimes(2)
  })
})
