import { describe, expect, it, vi } from "vitest"

import { SettingsStore } from "../src/client/state/settings.ts"
import { UtilityStore, useUtilities } from "../src/client/state/utilities.ts"
import { SETTINGS_DEFAULTS } from "../src/protocol/settings.ts"

vi.mock("react", () => ({
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useEffect: (effect: () => unknown) => {
    effect()
  },
}))
describe("utility settings effects", () => {
  it("does not query while settings are loading or both utilities disabled, but enables independently", async () => {
    const api = {
      balance: vi.fn(async () => ({
        ok: true as const,
        value: { status: "missing-credentials" as const, checkedAt: 1 },
      })),
      version: vi.fn(async () => ({
        ok: true as const,
        value: {
          packageName: "@cyrusdoyle/dsh-sessions-insight" as const,
          status: "current" as const,
          currentVersion: "1.0.0",
          latestVersion: "1.0.0",
          checkedAt: 1,
        },
      })),
    }
    const store = new UtilityStore(api),
      settings = new SettingsStore()
    useUtilities(store, settings)
    expect(api.balance).not.toHaveBeenCalled()
    expect(api.version).not.toHaveBeenCalled()
    const attach = (balance: boolean, version: boolean) =>
      settings.attach({
        getSnapshot: () => ({
          status: "ready",
          writable: true,
          value: { ...SETTINGS_DEFAULTS, deepseekBalance: balance, autoCheckVersion: version },
        }),
        subscribe: () => () => {},
        set: async () => true,
      })
    attach(false, false)
    useUtilities(store, settings)
    expect(api.balance).not.toHaveBeenCalled()
    expect(api.version).not.toHaveBeenCalled()
    attach(true, false)
    useUtilities(store, settings)
    await store.refreshBalance(false)
    expect(api.balance).toHaveBeenCalledTimes(1)
    expect(api.version).not.toHaveBeenCalled()
    attach(false, true)
    useUtilities(store, settings)
    await store.checkVersion(false)
    expect(api.version).toHaveBeenCalledTimes(1)
    attach(false, false)
    useUtilities(store, settings)
    await store.checkVersion(true)
    expect(api.version).toHaveBeenCalledTimes(2)
    store.dispose()
  })
})
