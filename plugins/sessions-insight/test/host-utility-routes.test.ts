import { createServer } from "node:http"
import type { AddressInfo } from "node:net"

import { afterEach, describe, expect, it, vi } from "vitest"

import { createBalanceRateLimiter, type RateLimiter } from "../src/host/http/rate-limit.ts"
import { createUtilityRoutes, type UtilityRouteDeps } from "../src/host/http/utility-routes.ts"
import { BalanceReader } from "../src/host/utilities/balance.ts"
import { VersionChecker } from "../src/host/utilities/version.ts"
import { SETTINGS_DEFAULTS } from "../src/protocol/settings.ts"
import { BALANCE_PATH, VERSION_PATH } from "../src/protocol/utilities.ts"

const official = {
  is_available: true,
  balance_infos: [{ currency: "CNY", total_balance: "12.34", granted_balance: "2.34", topped_up_balance: "10.00" }],
}
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const off of cleanup.splice(0)) await off()
})
interface FixtureOptions {
  /** Overrides the peer address the balance route sees; a test socket is loopback. */
  remoteAddress?: string
  /** A resolvable key makes every uncached read reach the mocked provider. */
  credentialKey?: string
  /** Payload the mocked provider answers for the fixed balance endpoint. */
  balanceResponse?: unknown
  /** Injectable clock, so the rate-limit window is deterministic. */
  balanceLimiter?: RateLimiter
}
async function fixture(options: FixtureOptions = {}) {
  const settings = { ...SETTINGS_DEFAULTS, autoCheckVersion: false, deepseekBalance: false }
  const request = vi.fn(async (endpoint: string) =>
    endpoint === "balance" ? (options.balanceResponse ?? official) : { version: "1.0.0" },
  )
  const credentials = vi.fn(() =>
    options.credentialKey === undefined
      ? undefined
      : { resolve: () => ({ value: options.credentialKey!, source: "test" }) },
  )
  const utilities: UtilityRouteDeps = {
    balance: new BalanceReader(
      {
        credentialsSupported: true,
        credentialRef: () => "DEEPSEEK_API_KEY",
        credentials,
        account: () => undefined,
        envKey: () => undefined,
        version: "0.0.5",
      },
      request,
    ),
    versions: new VersionChecker("0.0.5", request),
    settings: () => settings,
    ...(options.balanceLimiter === undefined ? {} : { balanceLimiter: options.balanceLimiter }),
  }
  const routes = createUtilityRoutes(utilities)
  const server = createServer((req, res) => {
    // The balance route reads the peer address; a test connection is always
    // loopback, so a non-loopback source is injected instead.
    if (options.remoteAddress !== undefined)
      Object.defineProperty(req, "socket", { value: { remoteAddress: options.remoteAddress } })
    const route = routes.find((r) => r.path === new URL(req.url!, "http://localhost").pathname)
    if (route === undefined) {
      res.statusCode = 404
      res.end()
    } else route.handler(req, res)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  cleanup.push(
    () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  )
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, settings, request, credentials }
}
describe("utility routes", () => {
  it("disabled settings make no provider calls; explicit manual version check works", async () => {
    const { base, settings, request, credentials } = await fixture()
    expect((await (await fetch(base + VERSION_PATH)).json()).value.status).toBe("disabled")
    expect((await (await fetch(base + BALANCE_PATH)).json()).value.status).toBe("disabled")
    expect(request).not.toHaveBeenCalled()
    expect(credentials).not.toHaveBeenCalled()
    expect((await (await fetch(`${base + VERSION_PATH}?check=1`)).json()).value.status).toBe("update")
    expect(request).toHaveBeenCalledTimes(1)
    settings.deepseekBalance = true
    expect(
      (await (await fetch(`${base + BALANCE_PATH}?refresh=1&locale=zh-CN&timezoneOffsetSeconds=28800`)).json()).value
        .status,
    ).toBe("missing-credentials")
  })
  it("gates origin, methods and arbitrary URL/query injection before provider calls", async () => {
    const { base, settings, request, credentials } = await fixture()
    settings.deepseekBalance = true
    for (const path of [BALANCE_PATH, VERSION_PATH]) {
      expect((await fetch(base + path, { method: "POST" })).status).toBe(405)
      expect((await fetch(base + path, { headers: { origin: "https://evil.example" } })).status).toBe(403)
      expect((await fetch(`${base + path}?url=https://evil.example`)).status).toBe(400)
    }
    for (const query of [
      "locale=invalid/locale",
      "timezoneOffsetSeconds=NaN",
      "timezoneOffsetSeconds=999999",
      "refresh=false",
    ])
      expect((await fetch(`${base + BALANCE_PATH}?${query}`)).status).toBe(400)
    expect(request).not.toHaveBeenCalled()
    expect(credentials).not.toHaveBeenCalled()
  })
  it("HEAD is passive and automatic mode is checked on every request", async () => {
    const { base, settings, request } = await fixture()
    settings.autoCheckVersion = true
    expect((await fetch(base + VERSION_PATH, { method: "HEAD" })).status).toBe(200)
    expect(request).not.toHaveBeenCalled()
    await fetch(base + VERSION_PATH)
    expect(request).toHaveBeenCalledTimes(1)
    settings.autoCheckVersion = false
    await fetch(`${base + VERSION_PATH}?refresh=1`)
    expect(request).toHaveBeenCalledTimes(1)
  })
  it("rejects a non-loopback balance source with 403 before the provider", async () => {
    for (const remoteAddress of ["192.0.2.10", "10.0.0.1", "::ffff:192.0.2.10"]) {
      const { base, settings, request, credentials } = await fixture({ remoteAddress })
      settings.deepseekBalance = true
      const response = await fetch(base + BALANCE_PATH)
      expect(response.status).toBe(403)
      expect((await response.json()).error).toBe("forbidden")
      expect(credentials).not.toHaveBeenCalled()
      expect(request).not.toHaveBeenCalled()
    }
  })
  it("accepts the whole 127/8 range, ::1 and IPv4-mapped loopback", async () => {
    for (const remoteAddress of ["127.0.0.1", "127.0.0.2", "::1", "::ffff:127.0.0.1"]) {
      const { base, settings } = await fixture({ remoteAddress })
      settings.deepseekBalance = true
      expect((await fetch(base + BALANCE_PATH)).status).toBe(200)
    }
  })
  it("answers HEAD /balance with 405 and never asks the provider", async () => {
    const { base, settings, request, credentials } = await fixture()
    settings.deepseekBalance = true
    expect((await fetch(base + BALANCE_PATH, { method: "HEAD" })).status).toBe(405)
    expect(credentials).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
    // /version keeps accepting HEAD as a passive probe.
    expect((await fetch(base + VERSION_PATH, { method: "HEAD" })).status).toBe(200)
  })
  it("validates the query before the disabled switch short-circuits", async () => {
    const { base, settings, request, credentials } = await fixture()
    expect(settings.deepseekBalance).toBe(false)
    expect(settings.autoCheckVersion).toBe(false)
    for (const path of [BALANCE_PATH, VERSION_PATH])
      expect((await fetch(`${base + path}?url=https://evil.example`)).status).toBe(400)
    for (const query of [
      "locale=invalid/locale",
      "timezoneOffsetSeconds=NaN",
      "timezoneOffsetSeconds=999999",
      "refresh=false",
    ])
      expect((await fetch(`${base + BALANCE_PATH}?${query}`)).status).toBe(400)
    expect(request).not.toHaveBeenCalled()
    expect(credentials).not.toHaveBeenCalled()
  })
  it("passes an empty official wallet list through as a ready empty balance", async () => {
    const { base, settings } = await fixture({
      credentialKey: "synthetic-test-key",
      balanceResponse: { is_available: false, balance_infos: [] },
    })
    settings.deepseekBalance = true
    const response = await fetch(`${base + BALANCE_PATH}?refresh=1`)
    expect(response.status).toBe(200)
    expect((await response.json()).value).toMatchObject({
      status: "ready",
      source: "api-key",
      available: false,
      value: [],
      bonusWallets: [],
    })
  })
  it("allows six provider-triggering refreshes per minute, then answers 429 without a provider call", async () => {
    const clock = { now: 1_000_000 }
    const limiter = createBalanceRateLimiter({ now: () => clock.now })
    const { base, settings, request } = await fixture({ credentialKey: "synthetic-test-key", balanceLimiter: limiter })
    settings.deepseekBalance = true
    for (let i = 0; i < 6; i++) expect((await fetch(`${base + BALANCE_PATH}?refresh=1`)).status).toBe(200)
    expect(request).toHaveBeenCalledTimes(6)
    const limited = await fetch(`${base + BALANCE_PATH}?refresh=1`)
    expect(limited.status).toBe(429)
    expect(await limited.json()).toEqual({ ok: false, error: "rate-limited", detail: "balance-refresh-limited" })
    expect(request).toHaveBeenCalledTimes(6)
    // A cache hit never reaches the provider, so a full window still answers it.
    expect((await fetch(base + BALANCE_PATH)).status).toBe(200)
    expect(request).toHaveBeenCalledTimes(6)
    // The window slides: nothing is freed at 59.999 s; every slot expires at 60 s.
    clock.now += 59_999
    expect((await fetch(`${base + BALANCE_PATH}?refresh=1`)).status).toBe(429)
    clock.now += 1
    expect((await fetch(`${base + BALANCE_PATH}?refresh=1`)).status).toBe(200)
    expect(request).toHaveBeenCalledTimes(7)
  })
  it("does not spend the window on disabled settings, invalid queries or cached reads", async () => {
    const clock = { now: 2_000_000 }
    const limiter = createBalanceRateLimiter({ now: () => clock.now })
    const { base, settings, request } = await fixture({ credentialKey: "synthetic-test-key", balanceLimiter: limiter })
    for (let i = 0; i < 8; i++) expect((await fetch(base + BALANCE_PATH)).status).toBe(200)
    expect((await (await fetch(base + BALANCE_PATH)).json()).value.status).toBe("disabled")
    for (let i = 0; i < 8; i++) expect((await fetch(`${base + BALANCE_PATH}?locale=invalid/locale`)).status).toBe(400)
    expect(request).not.toHaveBeenCalled()
    settings.deepseekBalance = true
    for (let i = 0; i < 6; i++) expect((await fetch(`${base + BALANCE_PATH}?refresh=1`)).status).toBe(200)
    expect(request).toHaveBeenCalledTimes(6)
    expect((await fetch(base + BALANCE_PATH)).status).toBe(200)
    expect(request).toHaveBeenCalledTimes(6)
    expect((await fetch(`${base + BALANCE_PATH}?refresh=1`)).status).toBe(429)
    expect(request).toHaveBeenCalledTimes(6)
  })
})
