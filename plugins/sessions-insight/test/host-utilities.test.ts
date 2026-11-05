import { afterEach, describe, expect, it, vi } from "vitest"

import { createPluginConfig } from "../../../tooling/tsdown/plugin-config.ts"
import { BalanceReader, BALANCE_TTL_MS, type BalanceDeps } from "../src/host/utilities/balance.ts"
import { BALANCE_TIMEOUT_MS, UTILITY_TIMEOUT_MS, UtilityRequestError } from "../src/host/utilities/https.ts"
import { compareVersions } from "../src/host/utilities/semver.ts"
import { VersionChecker, VERSION_FAILED_TTL_MS, VERSION_TTL_MS } from "../src/host/utilities/version.ts"
import { apply, type HostContext, watchCredentialUpdates } from "../src/index.ts"
import { isAmount, isBalanceValue, isVersionValue } from "../src/protocol/utilities.ts"

vi.mock("node:timers", () => ({
  setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer),
}))

const official = {
  is_available: false,
  balance_infos: [
    { currency: "CNY", total_balance: "12.34", granted_balance: "2.34", topped_up_balance: "10.00" },
    { currency: "USD", total_balance: "3.00", granted_balance: "0.00", topped_up_balance: "3.00" },
  ],
}
const deps = (patch: Partial<BalanceDeps> = {}): BalanceDeps => ({
  credentialsSupported: true,
  credentials: () => undefined,
  account: () => undefined,
  envKey: () => undefined,
  version: "0.0.5",
  ...patch,
})
const options = { locale: "zh-CN", timezoneOffsetSeconds: 28800 }
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("SemVer precedence", () => {
  it("compares release, prerelease, numeric identifiers and ignores build metadata", () => {
    const versions = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "1.0.1",
      "1.1.0",
      "2.0.0",
    ]
    for (let i = 1; i < versions.length; i++) {
      expect(compareVersions(versions[i]!, versions[i - 1]!)).toBe(1)
      expect(compareVersions(versions[i - 1]!, versions[i]!)).toBe(-1)
    }
    expect(compareVersions("1.0.0+abc", "1.0.0+xyz")).toBe(0)
    expect(compareVersions("1.0.0-rc.5", "1.0.0-rc.5")).toBe(0)
    expect(compareVersions("999999999999999999999.0.0", "999999999999999999998.0.0")).toBe(1)
    for (const version of ["latest", "v1.0.0", "01.0.0", "1.0.0-01", "1.0", "1.0.0-", "1.0.0+", "1.0.0\n"])
      expect(compareVersions(version, "1.0.0")).toBeUndefined()
  })
})

describe("balance credentials and cache", () => {
  it("accepts rc.5 numeric strings without relaxing bounds or accepting non-numbers", () => {
    for (const value of ["1e-7", "2E+3", ".5", "1.", "-.5", "0E-16"]) expect(isAmount(value)).toBe(true)
    for (const value of ["", "+1.5", "NaN", "Infinity", "0x10", "1e", " 1", "1\n", "1".repeat(81)])
      expect(isAmount(value)).toBe(false)
  })
  it("accepts bonus-only and empty ready account wallets", async () => {
    for (const bonusWallets of [[{ currency: "CNY", balance: "1e-7" }], []]) {
      const reader = new BalanceReader(
        deps({ account: () => ({ getBalance: async () => ({ status: "ready", value: [], bonusWallets }) }) }),
        vi.fn(),
      )
      const value = await reader.read(options)
      expect(value).toMatchObject({ status: "ready", value: [], bonusWallets })
      expect(isBalanceValue(value)).toBe(true)
    }
  })
  it("never uses env on a modern Host without credentials or makes an HTTP request", async () => {
    const envKey = vi.fn(() => "synthetic-env"),
      request = vi.fn()
    const reader = new BalanceReader(deps({ envKey }), request)
    expect((await reader.read(options)).status).toBe("missing-credentials")
    expect(envKey).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  })
  it("resolves the string reference, prioritizes API key and preserves currencies", async () => {
    const resolve = vi.fn(async () => ({ value: "synthetic-test-key", source: "host" }))
    const getBalance = vi.fn(),
      request = vi.fn(async () => official)
    const reader = new BalanceReader(
      deps({ credentials: () => ({ resolve }), account: () => ({ getBalance }) }),
      request,
    )
    const value = await reader.read(options)
    expect(resolve).toHaveBeenCalledWith("DEEPSEEK_API_KEY")
    expect(request).toHaveBeenCalledWith("balance", "synthetic-test-key")
    expect(getBalance).not.toHaveBeenCalled()
    expect(isBalanceValue(value)).toBe(true)
    expect(value).toMatchObject({
      status: "ready",
      source: "api-key",
      available: false,
      value: [
        { currency: "CNY", balance: "12.34", grantedBalance: "2.34", toppedUpBalance: "10.00" },
        { currency: "USD", balance: "3.00" },
      ],
    })
    expect(JSON.stringify(value)).not.toContain("synthetic-test-key")
  })
  it("uses account when resolve is empty, passing version/locale/timezone and projecting fields", async () => {
    const getBalance = vi.fn(async () => ({
      status: "ready",
      value: [{ currency: "USD", balance: "8.00", secret: "hidden" }],
      bonusWallets: [{ currency: "CNY", balance: "2.00" }, { unknown: "ignored" }],
      secret: "hidden",
    }))
    const request = vi.fn()
    const reader = new BalanceReader(
      deps({ credentials: () => ({ resolve: () => undefined }), account: () => ({ getBalance }) }),
      request,
    )
    const value = await reader.read(options)
    expect(getBalance).toHaveBeenCalledWith({ version: "0.0.5", ...options })
    expect(value).toMatchObject({
      status: "ready",
      source: "account",
      available: null,
      value: [{ currency: "USD", balance: "8.00" }],
      bonusWallets: [{ currency: "CNY", balance: "2.00" }],
    })
    expect(JSON.stringify(value)).not.toContain("hidden")
    expect(request).not.toHaveBeenCalled()
  })
  it("only uses env fallback on old Hosts without an installed credentials service", async () => {
    const envKey = vi.fn(() => "synthetic-env"),
      request = vi.fn(async () => official)
    await new BalanceReader(deps({ credentialsSupported: false, envKey }), request).read(options)
    expect(request).toHaveBeenCalledWith("balance", "synthetic-env")
    envKey.mockClear()
    request.mockClear()
    await new BalanceReader(
      deps({ credentialsSupported: false, credentials: () => ({ resolve: () => undefined }), envKey }),
      request,
    ).read(options)
    expect(envKey).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  })
  it("deduplicates, expires short cache, invalidates and bypasses cache on manual refresh", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    const request = vi.fn(async () => official)
    const reader = new BalanceReader(
      deps({ credentials: () => ({ resolve: () => ({ value: "synthetic", source: "test" }) }) }),
      request,
    )
    const first = reader.read(options)
    expect(reader.read(options, true)).toBe(first)
    await first
    await reader.read(options)
    expect(request).toHaveBeenCalledTimes(1)
    await reader.read(options, true)
    expect(request).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(BALANCE_TTL_MS)
    await reader.read(options)
    expect(request).toHaveBeenCalledTimes(3)
    reader.invalidate()
    await reader.read(options)
    expect(request).toHaveBeenCalledTimes(4)
  })
  it("does not cache failures or missing credentials, so a written key is read next time", async () => {
    let key: string | undefined
    const request = vi.fn(async () => official)
    const reader = new BalanceReader(
      deps({
        credentials: () => ({ resolve: () => (key === undefined ? undefined : { value: key, source: "test" }) }),
      }),
      request,
    )
    expect((await reader.read(options)).status).toBe("missing-credentials")
    expect(request).not.toHaveBeenCalled()
    key = "synthetic-test-key"
    expect((await reader.read(options)).status).toBe("ready")
    expect(request).toHaveBeenCalledTimes(1)
    const failing = vi
      .fn()
      .mockRejectedValueOnce(new UtilityRequestError("unauthorized"))
      .mockResolvedValueOnce(official)
    const rereads = new BalanceReader(
      deps({ credentials: () => ({ resolve: () => ({ value: "synthetic-test-key", source: "test" }) }) }),
      failing,
    )
    expect(await rereads.read(options)).toMatchObject({ status: "failed", reason: "unauthorized" })
    expect(await rereads.read(options)).toMatchObject({ status: "ready" })
    expect(failing).toHaveBeenCalledTimes(2)
  })
  it("treats a cached balance checked in the future as stale", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    const request = vi.fn(async () => official)
    const reader = new BalanceReader(
      deps({ credentials: () => ({ resolve: () => ({ value: "synthetic", source: "test" }) }) }),
      request,
    )
    await reader.read(options)
    expect(request).toHaveBeenCalledTimes(1)
    vi.setSystemTime(50_000)
    await reader.read(options)
    expect(request).toHaveBeenCalledTimes(2)
  })
  it("sanitizes errors, malformed balances and distinguishes absent accounts", async () => {
    for (const result of [
      { status: "failed", detail: "secret" },
      { status: "ready", value: [{ currency: "USD", balance: "NaN" }] },
    ]) {
      const reader = new BalanceReader(deps({ account: () => ({ getBalance: async () => result }) }), vi.fn())
      expect((await reader.read(options)).status).toBe("failed")
    }
    const absent = new BalanceReader(deps({ account: () => ({ getBalance: async () => null }) }), vi.fn())
    expect((await absent.read(options)).status).toBe("missing-credentials")
    const reader = new BalanceReader(
      deps({
        credentials: () => ({
          resolve: () => {
            throw new Error("synthetic-secret")
          },
        }),
      }),
      vi.fn(),
    )
    expect(JSON.stringify(await reader.read(options))).not.toContain("synthetic-secret")
  })
  it("keeps an account request pending after 8 seconds and ready at 20 seconds", async () => {
    vi.useFakeTimers()
    const getBalance = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ status: "ready", value: [{ currency: "CNY", balance: "8.00" }] }), 20_000)
        }),
    )
    const reader = new BalanceReader(deps({ account: () => ({ getBalance }) }), vi.fn())
    const settled = vi.fn()
    const pending = reader.read(options).then((value) => {
      settled(value)
      return value
    })
    await vi.advanceTimersByTimeAsync(8_001)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(11_999)
    expect(await pending).toMatchObject({ status: "ready", source: "account" })
  })
  it("classifies credential exceptions without leaking diagnostics or switching accounts", async () => {
    const getBalance = vi.fn()
    const request = vi.fn()
    const reader = new BalanceReader(
      deps({
        credentials: () => ({
          resolve: () => {
            throw new Error("synthetic-secret-private-diagnostics")
          },
        }),
        account: () => ({ getBalance }),
      }),
      request,
    )
    const value = await reader.read(options)
    expect(value).toMatchObject({ status: "failed", reason: "credential-error", source: "api-key" })
    expect(JSON.stringify(value)).not.toContain("synthetic-secret")
    expect(getBalance).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  })
  it("keeps API key failures explicit without using another account", async () => {
    const getBalance = vi.fn()
    const reader = new BalanceReader(
      deps({
        credentials: () => ({ resolve: () => ({ value: "synthetic", source: "test" }) }),
        account: () => ({ getBalance }),
      }),
      async () => {
        throw new UtilityRequestError("unauthorized")
      },
    )
    expect(await reader.read(options)).toMatchObject({ status: "failed", reason: "unauthorized", source: "api-key" })
    expect(getBalance).not.toHaveBeenCalled()
  })
  it("distinguishes account failure, account exception and invalid payloads without diagnostics", async () => {
    for (const [result, reason] of [
      [{ status: "failed", detail: "synthetic-secret" }, "account-error"],
      [{ status: "ready", value: [{ currency: "CNY", balance: "NaN" }] }, "invalid-response"],
    ] as const) {
      const reader = new BalanceReader(deps({ account: () => ({ getBalance: async () => result }) }), vi.fn())
      expect(await reader.read(options)).toMatchObject({ status: "failed", source: "account", reason })
    }
    const reader = new BalanceReader(
      deps({
        account: () => ({
          getBalance: async () => {
            throw new Error("synthetic-secret")
          },
        }),
      }),
      vi.fn(),
    )
    const value = await reader.read(options)
    expect(value).toMatchObject({ status: "failed", reason: "account-error", source: "account" })
    expect(JSON.stringify(value)).not.toContain("synthetic-secret")
    const malformed = new BalanceReader(
      deps({
        credentials: () => ({ resolve: () => ({ value: "synthetic", source: "test" }) }),
      }),
      async () => ({ balance_infos: "synthetic-secret" }),
    )
    expect(await malformed.read(options)).toMatchObject({
      status: "failed",
      reason: "invalid-response",
      source: "api-key",
    })
  })
  it("bounds hanging credentials and account services", async () => {
    vi.useFakeTimers()
    const reader = new BalanceReader(deps({ credentials: () => ({ resolve: () => new Promise(() => {}) }) }), vi.fn())
    const pending = reader.read(options)
    await vi.advanceTimersByTimeAsync(UTILITY_TIMEOUT_MS)
    expect(await pending).toMatchObject({ status: "failed", reason: "timeout", source: "api-key" })
    const account = new BalanceReader(deps({ account: () => ({ getBalance: () => new Promise(() => {}) }) }), vi.fn())
    const next = account.read(options)
    const settled = vi.fn()
    void next.then(settled)
    await vi.advanceTimersByTimeAsync(BALANCE_TIMEOUT_MS - 1)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await next).toMatchObject({ status: "failed", reason: "timeout", source: "account" })
  })
})

describe("credential reference invalidation", () => {
  it("drops the ready cache when the Host reports a credential update and removes the listener on dispose", async () => {
    const request = vi.fn(async () => official)
    const reader = new BalanceReader(
      deps({ credentials: () => ({ resolve: () => ({ value: "synthetic", source: "test" }) }) }),
      request,
    )
    const stop = vi.fn()
    let listener: ((ref: string) => void) | undefined
    const dispose = watchCredentialUpdates(
      {
        on: (name, onChange) => {
          expect(name).toBe("credentials/reference-updated")
          listener = onChange
          return stop
        },
      },
      reader,
    )
    await reader.read(options)
    await reader.read(options)
    expect(request).toHaveBeenCalledTimes(1)
    expect(listener).toBeTypeOf("function")
    listener!("DEEPSEEK_API_KEY")
    await reader.read(options)
    expect(request).toHaveBeenCalledTimes(2)
    dispose()
    expect(stop).toHaveBeenCalledTimes(1)
  })
  it("tolerates a Host without an event bus", () => {
    const dispose = watchCredentialUpdates({}, { invalidate: vi.fn() })
    expect(() => dispose()).not.toThrow()
  })
  it("apply subscribes the balance cache to Host credential updates and releases the listener", () => {
    vi.useFakeTimers()
    const invalidate = vi.spyOn(BalanceReader.prototype, "invalidate")
    let listener: ((ref: string) => void) | undefined
    const stop = vi.fn()
    const table = new Map<string, unknown>()
    const ctx: HostContext = {
      webServer: {
        register: (route) => {
          table.set(route.path, route)
          return () => {
            table.delete(route.path)
          }
        },
      },
      on: (name, onChange) => {
        expect(name).toBe("credentials/reference-updated")
        listener = onChange
        return stop
      },
    }
    const dispose = apply(ctx)
    expect(listener).toBeTypeOf("function")
    const before = invalidate.mock.calls.length
    listener!("DEEPSEEK_API_KEY")
    expect(invalidate.mock.calls.length).toBe(before + 1)
    dispose()
    expect(stop).toHaveBeenCalledTimes(1)
    expect(table.size).toBe(0)
  })
})

describe("version cache", () => {
  it("inlines the owning manifest name alongside its version for both build halves", () => {
    for (const [manifestPath, name, version] of [
      ["../../../package.json", "@cyrusdoyle/dsh-plugins", "0.0.5"],
      ["../package.json", "@cyrusdoyle/dsh-sessions-insight", "0.0.6"],
    ]) {
      const configs = createPluginConfig({
        manifestPath: new URL(manifestPath!, import.meta.url).pathname,
        srcDir: "src/",
        outDir: "lib/",
        alias: {},
      })
      for (const config of configs) {
        expect(config.define?.__DSH_PLUGIN_NAME__).toBe(JSON.stringify(name))
        expect(config.define?.__DSH_PLUGIN_VERSION__).toBe(JSON.stringify(version))
      }
    }
  })
  it("compares independently published root and child versions only within their own package", async () => {
    const request = vi.fn(async (name: string) => ({
      name,
      version: name === "@cyrusdoyle/dsh-plugins" ? "0.0.5" : "0.0.6",
    }))
    const root = new VersionChecker("0.0.5", request, "@cyrusdoyle/dsh-plugins")
    const child = new VersionChecker("0.0.6", request, "@cyrusdoyle/dsh-sessions-insight")
    expect(await root.check()).toMatchObject({
      status: "current",
      packageName: "@cyrusdoyle/dsh-plugins",
      latestVersion: "0.0.5",
    })
    expect(await child.check()).toMatchObject({
      status: "current",
      packageName: "@cyrusdoyle/dsh-sessions-insight",
      latestVersion: "0.0.6",
    })
    expect(request.mock.calls.map(([name]) => name)).toEqual([
      "@cyrusdoyle/dsh-plugins",
      "@cyrusdoyle/dsh-sessions-insight",
    ])
    expect(
      (
        await new VersionChecker(
          "0.0.5",
          async () => ({ name: "@cyrusdoyle/dsh-sessions-insight", version: "0.0.6" }),
          "@cyrusdoyle/dsh-plugins",
        ).check()
      ).status,
    ).toBe("failed")
  })
  it("has no eager request; deduplicates, caches for an hour and forces checks", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    const request = vi.fn(async () => ({ version: "1.0.0" }))
    const checker = new VersionChecker("1.0.0-rc.5", request)
    expect(checker.peek().status).toBe("unchecked")
    expect(request).not.toHaveBeenCalled()
    const pending = checker.check()
    expect(checker.check(true)).toBe(pending)
    expect(await pending).toMatchObject({ status: "update", latestVersion: "1.0.0" })
    await checker.check()
    expect(request).toHaveBeenCalledTimes(1)
    await checker.check(true)
    expect(request).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(VERSION_TTL_MS)
    await checker.check()
    expect(request).toHaveBeenCalledTimes(3)
    expect(isVersionValue(checker.peek())).toBe(true)
  })
  it("handles older versions and sanitizes malformed registry responses or exceptions", async () => {
    expect((await new VersionChecker("1.0.0", async () => ({ version: "1.0.0-rc.5" })).check()).status).toBe("current")
    for (const response of [null, {}, { version: "https://evil.example" }, { version: "1.0.0-01" }])
      expect((await new VersionChecker("1.0.0", async () => response).check()).status).toBe("failed")
    const value = await new VersionChecker("1.0.0", async () => {
      throw new Error("private-diagnostics")
    }).check()
    expect(JSON.stringify(value)).not.toContain("private-diagnostics")
  })
  it("retries a failed check after five minutes instead of an hour", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("synthetic-secret"))
      .mockResolvedValueOnce({ version: "1.0.0" })
    const checker = new VersionChecker("1.0.0", request)
    expect(await checker.check()).toMatchObject({ status: "failed" })
    vi.setSystemTime(100_000 + VERSION_FAILED_TTL_MS)
    expect(await checker.check()).toMatchObject({ status: "current", latestVersion: "1.0.0" })
    expect(request).toHaveBeenCalledTimes(2)
  })
  it("treats a cached version checked in the future as stale", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    const request = vi.fn(async () => ({ version: "1.0.0" }))
    const checker = new VersionChecker("1.0.0", request)
    await checker.check()
    expect(request).toHaveBeenCalledTimes(1)
    vi.setSystemTime(50_000)
    await checker.check()
    expect(request).toHaveBeenCalledTimes(2)
  })
})
