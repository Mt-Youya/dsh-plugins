import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createApi } from "../src/client/api.ts"
import { fillParams, setRuntimeTranslate, en, zh } from "../src/client/locale.ts"
import { SETTINGS_EN, SETTINGS_ZH } from "../src/client/settings-labels.ts"
import { SettingsStore } from "../src/client/state/settings.ts"
import { UtilityStore } from "../src/client/state/utilities.ts"
import { SettingsPage } from "../src/client/ui/settings.tsx"
import { BalanceDisplay, VersionDisplay, UtilityStrip, makeUtilitySections } from "../src/client/ui/utilities.tsx"
import { SETTINGS_DEFAULTS, type Settings } from "../src/protocol/settings.ts"
import {
  BALANCE_URL,
  VERSION_URL,
  RECHARGE_LINK,
  UPDATE_LINKS,
  isBalanceValue,
  isVersionValue,
  UTILITY_FAILURE_REASONS,
} from "../src/protocol/utilities.ts"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setRuntimeTranslate(() => "")
})
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

/** A settings bridge whose Host form is already served and writable. */
function readySettings(overrides: Partial<Settings> = {}): SettingsStore {
  const settings = new SettingsStore()
  settings.attach({
    getSnapshot: () => ({ status: "ready", writable: true, value: { ...SETTINGS_DEFAULTS, ...overrides } }),
    subscribe: () => () => {},
    set: async () => true,
  })
  return settings
}

describe("utility wire guards", () => {
  it("uses matching bilingual user-facing balance and automatic-check hints", () => {
    expect(SETTINGS_ZH["settings.deepseekBalance.hint"]).toContain("已登录账号")
    expect(SETTINGS_EN["settings.deepseekBalance.hint"]).toContain("signed-in account")
    expect(SETTINGS_ZH["settings.autoCheckVersion.hint"]).toContain("手动检查")
    expect(SETTINGS_EN["settings.autoCheckVersion.hint"]).toContain("manually")
    for (const labels of [SETTINGS_EN, SETTINGS_ZH]) {
      expect(labels["settings.deepseekBalance.hint"]).not.toMatch(/扩展模块|extension/)
      expect(labels["settings.autoCheckVersion.hint"]).not.toMatch(/扩展模块|extension/)
    }
  })
  it("accepts legacy failed payloads and only allowlisted reasons and sources", () => {
    expect(isBalanceValue({ status: "failed", checkedAt: 1 })).toBe(true)
    for (const reason of [...UTILITY_FAILURE_REASONS, "host-unavailable"])
      expect(isBalanceValue({ status: "failed", checkedAt: 1, reason, source: "api-key" })).toBe(true)
    for (const extra of [
      { reason: "synthetic-secret" },
      { source: "synthetic-secret" },
      { reason: null },
      { source: null },
    ])
      expect(isBalanceValue({ status: "failed", checkedAt: 1, ...extra })).toBe(false)
  })
  it("rejects malformed amounts, missing timestamps, currencies and states", () => {
    for (const value of [
      null,
      {},
      { status: "failed" },
      { status: "failed", checkedAt: NaN },
      {
        status: "ready",
        checkedAt: 1,
        source: "api-key",
        available: true,
        value: [{ currency: "EUR", balance: "0" }],
        bonusWallets: [],
      },
      {
        status: "ready",
        checkedAt: 1,
        source: "api-key",
        available: true,
        value: [{ currency: "USD", balance: "secret" }],
        bonusWallets: [],
      },
    ])
      expect(isBalanceValue(value)).toBe(false)
    expect(isVersionValue({ ...version, checkedAt: Infinity })).toBe(false)
    expect(isVersionValue({ ...version, latestVersion: 1 })).toBe(false)
    expect(isVersionValue(version)).toBe(true)
  })
})
describe("client utility API/store", () => {
  it("uses same-origin utility routes with manual check and refresh flags", async () => {
    const fetcher = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ok(url.includes("/balance") ? { status: "missing-credentials", checkedAt: 1 } : version),
    }))
    vi.stubGlobal("fetch", fetcher)
    const api = createApi()
    expect((await api.balance(true)).ok).toBe(true)
    expect(fetcher.mock.calls[0]![0]).toContain(BALANCE_URL + "?")
    expect(fetcher.mock.calls[0]![0]).toContain("refresh=1")
    expect(fetcher.mock.calls[0]![0]).toContain("timezoneOffsetSeconds=")
    await api.version(true)
    expect(fetcher.mock.calls[1]![0]).toBe(VERSION_URL + "?check=1")
  })
  it.each([404, 401, 403])("classifies host HTTP %s even when the body is not JSON", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status,
        json: async () => {
          throw new Error("synthetic-secret-body")
        },
      })),
    )
    const store = new UtilityStore(createApi())
    await store.refreshBalance()
    expect(store.getSnapshot().balance).toMatchObject({ status: "failed", reason: "host-unavailable" })
    expect(JSON.stringify(store.getSnapshot())).not.toContain("synthetic-secret")
    store.dispose()
  })
  it("distinguishes host network errors from invalid JSON and guard rejection", async () => {
    for (const [fetcher, reason] of [
      [
        async () => {
          throw new Error("synthetic-secret-network")
        },
        "host-unavailable",
      ],
      [
        async () => ({
          status: 200,
          json: async () => {
            throw new Error("synthetic-secret-json")
          },
        }),
        "invalid-response",
      ],
      [
        async () => ({
          status: 200,
          json: async () => ok({ status: "failed", checkedAt: 1, reason: "synthetic-secret" }),
        }),
        "invalid-response",
      ],
    ] as const) {
      vi.stubGlobal("fetch", vi.fn(fetcher))
      const store = new UtilityStore(createApi())
      await store.refreshBalance()
      expect(store.getSnapshot().balance).toMatchObject({ status: "failed", reason })
      expect(JSON.stringify(store.getSnapshot())).not.toContain("synthetic-secret")
      store.dispose()
    }
  })
  it("does not call providers on construction or SSR when automatic features are disabled", () => {
    const api = { balance: vi.fn(), version: vi.fn() },
      store = new UtilityStore(api),
      settings = new SettingsStore()
    settings.attach({
      getSnapshot: () => ({
        status: "ready",
        writable: true,
        value: { ...SETTINGS_DEFAULTS, deepseekBalance: false, autoCheckVersion: false },
      }),
      subscribe: () => () => {},
      set: async () => true,
    })
    renderToStaticMarkup(
      createElement(SettingsPage, { store: settings, sections: makeUtilitySections(store, settings) }),
    )
    expect(api.balance).not.toHaveBeenCalled()
    expect(api.version).not.toHaveBeenCalled()
    store.dispose()
  })
  it("shares inflight and cache between surfaces, and manual check/refresh bypasses cache", async () => {
    const api = {
      balance: vi.fn(async () => ok({ status: "missing-credentials" as const, checkedAt: Date.now() })),
      version: vi.fn(async () => ok(version)),
    }
    const store = new UtilityStore(api)
    const balance = store.refreshBalance(false),
      check = store.checkVersion(false)
    expect(store.refreshBalance(false)).toBe(balance)
    expect(store.checkVersion(false)).toBe(check)
    await Promise.all([balance, check])
    // Automatic checks inside the 30s / 1h windows are served from the throttle.
    await Promise.all([store.refreshBalance(false), store.checkVersion(false)])
    expect(api.balance).toHaveBeenCalledTimes(1)
    expect(api.version).toHaveBeenCalledTimes(1)
    // Manual checks bypass the throttle.
    await Promise.all([store.refreshBalance(), store.checkVersion()])
    expect(api.balance).toHaveBeenCalledTimes(2)
    expect(api.version).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot()).toMatchObject({ balancePending: false, versionPending: false, version })
    store.dispose()
  })
  it("guards injected responses, projects safe failure fields and catches rejected transports", async () => {
    for (const [balance, reason] of [
      [async () => ok({ status: "failed", checkedAt: 1, source: "synthetic-secret" }), "invalid-response"],
      [
        async () =>
          ok({ status: "failed", checkedAt: 1, reason: "unauthorized", source: "api-key", detail: "synthetic-secret" }),
        "unauthorized",
      ],
      [
        async () => {
          throw new Error("synthetic-secret-transport")
        },
        "host-unavailable",
      ],
    ] as const) {
      const store = new UtilityStore({ balance, version: vi.fn() } as never)
      await store.refreshBalance()
      expect(store.getSnapshot().balance).toMatchObject({ status: "failed", reason })
      expect(JSON.stringify(store.getSnapshot())).not.toContain("synthetic-secret")
      store.dispose()
    }
  })
  it("keeps spacing containers around source, tip and main-strip fields", async () => {
    const value = { status: "failed" as const, checkedAt: 1, reason: "network" as const, source: "api-key" as const }
    const display = renderToStaticMarkup(createElement(BalanceDisplay, { value }))
    expect(display).toMatch(/^<span class="inline-flex flex-wrap items-center gap-3"><span>/)
    const store = new UtilityStore({ balance: async () => ok(value), version: vi.fn() })
    await store.refreshBalance()
    const strip = renderToStaticMarkup(
      createElement(UtilityStrip, { store, settingsStore: readySettings({ deepseekBalance: true }) }),
    )
    expect(strip).toContain('<span class="inline-flex flex-wrap items-center gap-3"><strong>')
    store.dispose()
  })
  it("never prints raw transport failure details and cancels the in-flight request on dispose", async () => {
    let signal: AbortSignal | undefined
    let release!: (value: unknown) => void
    let calls = 0
    const api = {
      balance: vi.fn((_force?: boolean, abort?: AbortSignal) => {
        signal = abort
        calls += 1
        if (calls === 1) return Promise.resolve({ ok: false as const, error: "network", detail: "synthetic-secret" })
        return new Promise((done) => {
          release = done
        })
      }),
      version: vi.fn(async () => ok(version)),
    }
    const store = new UtilityStore(api as never)
    await store.refreshBalance()
    expect(store.getSnapshot().balance?.status).toBe("failed")
    expect(JSON.stringify(store.getSnapshot())).not.toContain("synthetic-secret")
    const pending = store.refreshBalance()
    store.dispose()
    expect(signal?.aborted).toBe(true)
    release({ ok: false, error: "network", detail: "synthetic-secret" })
    await pending
    expect(store.getSnapshot().balance).toMatchObject({ status: "failed" })
    expect(JSON.stringify(store.getSnapshot())).not.toContain("synthetic-secret")
  })
})
describe("utility surfaces", () => {
  it("renders actionable bilingual failure tips and safe sources on both surfaces", async () => {
    const actions = {
      "credential-error": ["检查宿主的凭据设置", "Check Host credential settings"],
      unauthorized: ["检查 API Key", "Check the API key"],
      "rate-limited": ["稍后再刷新", "wait before refreshing"],
      timeout: ["检查网络后重试", "Check the network and retry"],
      network: ["检查网络或代理设置", "Check network or proxy settings"],
      "http-error": ["稍后重试", "retry later"],
      "invalid-response": ["检查宿主与插件版本是否匹配", "Check Host/plugin compatibility"],
      "account-error": ["重新登录 DeepSeek 账号", "Sign in to the DeepSeek account again"],
      "host-unavailable": ["检查插件是否已加载", "Check that the plugin is loaded"],
    } as const
    for (const [language, dict] of [en, zh].entries()) {
      setRuntimeTranslate((key, params) => fillParams(dict[key as keyof typeof dict], params))
      for (const reason of [...UTILITY_FAILURE_REASONS, "host-unavailable"] as const) {
        const value = { status: "failed" as const, checkedAt: 1, reason, source: "api-key" as const }
        const store = new UtilityStore({ balance: vi.fn(async () => ok(value)), version: vi.fn() })
        await store.refreshBalance()
        const settings = readySettings({ deepseekBalance: true })
        for (const surface of [
          renderToStaticMarkup(createElement(UtilityStrip, { store, settingsStore: settings })),
          renderToStaticMarkup(
            createElement(SettingsPage, { store: settings, sections: makeUtilitySections(store, settings) }),
          ),
        ]) {
          expect(surface).toContain(actions[reason][language === 0 ? 1 : 0])
          expect(surface).toContain(dict["utility.balance.source.api-key"])
          expect(surface).toContain("gap-3")
          expect(surface).not.toContain("0.00")
          expect(surface).not.toContain("synthetic-secret")
        }
        store.dispose()
      }
      const account = renderToStaticMarkup(
        createElement(BalanceDisplay, {
          value: { status: "failed", checkedAt: 1, reason: "unauthorized", source: "account" },
        }),
      )
      expect(account).toContain(dict["utility.balance.failure.account-unauthorized"])
      expect(account).toContain(dict["utility.balance.source.account"])
      const legacy = renderToStaticMarkup(createElement(BalanceDisplay, { value: { status: "failed", checkedAt: 1 } }))
      expect(legacy).toContain(dict["utility.balance.failed"])
    }
  })
  it("renders empty balance honestly, while bonus-only remains visible", () => {
    const ready = {
      status: "ready" as const,
      checkedAt: 1,
      source: "account" as const,
      available: null,
      value: [],
      bonusWallets: [],
    }
    expect(isBalanceValue(ready)).toBe(true)
    const html = renderToStaticMarkup(createElement(BalanceDisplay, { value: ready }))
    expect(html).toContain("No balance available")
    expect(html).not.toContain("0.00")
    const bonus = renderToStaticMarkup(
      createElement(BalanceDisplay, { value: { ...ready, bonusWallets: [{ currency: "USD", balance: ".5" }] } }),
    )
    expect(bonus).toContain(".5")
    expect(bonus).not.toContain("No balance available")
  })
  it("shows currencies separately and never makes missing/failed balances look like zero", () => {
    const html = renderToStaticMarkup(
      createElement(BalanceDisplay, {
        value: {
          status: "ready",
          checkedAt: 1,
          source: "api-key",
          available: false,
          value: [
            { currency: "CNY", balance: "12.34" },
            { currency: "USD", balance: "5.00" },
          ],
          bonusWallets: [{ currency: "USD", balance: "2.00" }],
        },
      }),
    )
    expect(html).toContain("CNY 12.34")
    expect(html).toContain("USD 5.00")
    expect(html).toContain("USD 2.00")
    for (const status of ["missing-credentials", "failed"] as const) {
      const unavailable = renderToStaticMarkup(createElement(BalanceDisplay, { value: { status, checkedAt: 1 } }))
      expect(unavailable).not.toContain("0.00")
      expect(unavailable).not.toContain("USD")
    }
  })
  it("renders root package update links without substituting the child package", async () => {
    const root = { ...version, packageName: "@cyrusdoyle/dsh-plugins" as const }
    const store = new UtilityStore({ balance: vi.fn(), version: vi.fn(async () => ok(root)) })
    await store.checkVersion()
    const settings = readySettings()
    const html = renderToStaticMarkup(createElement(UtilityStrip, { store, settingsStore: settings }))
    const detail = renderToStaticMarkup(
      createElement(SettingsPage, { store: settings, sections: makeUtilitySections(store, settings) }),
    )
    for (const surface of [html, detail]) {
      expect(surface).toContain(UPDATE_LINKS[root.packageName])
      expect(surface).not.toContain(UPDATE_LINKS[version.packageName])
    }
    expect(isVersionValue({ ...root, packageName: "https://evil.example" })).toBe(false)
    store.dispose()
  })
  it("renders the detected update on the main panel with a fixed trusted link", async () => {
    const store = new UtilityStore({ balance: vi.fn(), version: vi.fn(async () => ok(version)) })
    await store.checkVersion()
    const settings = new SettingsStore()
    settings.attach({
      getSnapshot: () => ({ status: "ready", writable: true, value: { ...SETTINGS_DEFAULTS, deepseekBalance: false } }),
      subscribe: () => () => {},
      set: async () => true,
    })
    const html = renderToStaticMarkup(createElement(UtilityStrip, { store, settingsStore: settings }))
    expect(html).toContain("0.0.6")
    expect(html).toContain(UPDATE_LINKS[version.packageName])
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).not.toContain("Top up")
    store.dispose()
  })
  it("embeds refresh, status and manual version check into settings sections, with bilingual labels", () => {
    for (const dict of [en, zh]) {
      setRuntimeTranslate((key, params) => fillParams(dict[key as keyof typeof dict], params))
      const settings = readySettings(),
        store = new UtilityStore({ balance: vi.fn(), version: vi.fn() })
      const html = renderToStaticMarkup(
        createElement(SettingsPage, { store: settings, sections: makeUtilitySections(store, settings) }),
      )
      expect(html).toContain(dict["utility.balance.refresh"])
      expect(html).toContain(dict["utility.version.check"])
      expect(html).toContain(RECHARGE_LINK)
      expect(html).toContain(UPDATE_LINKS[version.packageName])
      expect(renderToStaticMarkup(createElement(VersionDisplay, { value: version }))).toContain("0.0.6")
      store.dispose()
    }
  })
})
