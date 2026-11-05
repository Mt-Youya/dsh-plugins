import { EventEmitter } from "node:events"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("node:https", () => ({ get: mock.get }))
vi.mock("node:timers", () => ({
  setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer),
}))
import { BalanceReader } from "../src/host/utilities/balance.ts"
import {
  requestUtilityJson,
  UTILITY_ENDPOINTS,
  UTILITY_MAX_BYTES,
  UTILITY_TIMEOUT_MS,
  UtilityRequestError,
  withUtilityTimeout,
} from "../src/host/utilities/https.ts"

let request: EventEmitter & { destroy: ReturnType<typeof vi.fn> }
let response: EventEmitter & { statusCode: number; destroy: ReturnType<typeof vi.fn> }
beforeEach(() => {
  request = Object.assign(new EventEmitter(), { destroy: vi.fn(() => request.emit("close")) })
  response = Object.assign(new EventEmitter(), { statusCode: 200, destroy: vi.fn() })
  mock.get.mockImplementation((_url, _options, callback) => {
    queueMicrotask(() => callback(response))
    return request
  })
})
afterEach(() => {
  vi.useRealTimers()
  mock.get.mockReset()
})
describe("bounded fixed-address HTTPS", () => {
  it("only sends authorization to official balance endpoint and never follows registry URLs", async () => {
    const pending = requestUtilityJson("balance", "synthetic-only")
    await Promise.resolve()
    response.emit("data", Buffer.from('{"is_available":true}'))
    response.emit("end")
    request.emit("close")
    expect(await pending).toEqual({ is_available: true })
    expect(mock.get.mock.calls[0]![0]).toBe(UTILITY_ENDPOINTS.balance)
    expect(mock.get.mock.calls[0]![1].headers.authorization).toBe("Bearer synthetic-only")
    const version = requestUtilityJson("@cyrusdoyle/dsh-sessions-insight", "synthetic-only")
    await Promise.resolve()
    response.emit("data", Buffer.from('{"version":"1.0.0"}'))
    response.emit("end")
    request.emit("close")
    await version
    expect(mock.get.mock.calls[1]![0]).toBe(UTILITY_ENDPOINTS["@cyrusdoyle/dsh-sessions-insight"])
    expect(mock.get.mock.calls[1]![1].headers.authorization).toBeUndefined()
  })
  it("selects only the root registry allowlist endpoint, without authorization or arbitrary URLs", async () => {
    const pending = requestUtilityJson("@cyrusdoyle/dsh-plugins", "synthetic-only")
    await Promise.resolve()
    response.emit("data", Buffer.from('{"version":"0.0.5"}'))
    response.emit("end")
    request.emit("close")
    await pending
    expect(mock.get.mock.calls[0]![0]).toBe(UTILITY_ENDPOINTS["@cyrusdoyle/dsh-plugins"])
    expect(mock.get.mock.calls[0]![1].headers.authorization).toBeUndefined()
    await expect(requestUtilityJson("https://evil.example" as never)).rejects.toThrow("utility-request-failed")
    expect(mock.get).toHaveBeenCalledTimes(1)
  })
  it("refuses redirects and any non-200 without exposing response bodies", async () => {
    for (const status of [301, 302, 401, 500]) {
      response.statusCode = status
      const pending = requestUtilityJson("balance")
      await expect(pending).rejects.toThrow("utility-request-failed")
      expect(response.destroy).toHaveBeenCalled()
    }
  })
  it("destroys oversized responses and sanitizes malformed JSON and request errors", async () => {
    const oversized = requestUtilityJson("@cyrusdoyle/dsh-sessions-insight")
    await Promise.resolve()
    response.emit("data", Buffer.alloc(UTILITY_MAX_BYTES + 1))
    await expect(oversized).rejects.toThrow("utility-request-failed")
    expect(request.destroy).toHaveBeenCalled()
    const malformed = requestUtilityJson("@cyrusdoyle/dsh-sessions-insight")
    await Promise.resolve()
    response.emit("data", Buffer.from("not-json-secret"))
    response.emit("end")
    request.emit("close")
    await expect(malformed).rejects.toThrow("utility-request-failed")
    const error = requestUtilityJson("balance")
    request.emit("error", new Error("synthetic-key-private-details"))
    request.emit("close")
    await expect(error).rejects.toThrow("utility-request-failed")
  })
  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [429, "rate-limited"],
    [500, "http-error"],
  ])("classifies HTTPS status %s through the actual request path", async (status, reason) => {
    response.statusCode = status as number
    const error = await requestUtilityJson("balance", "synthetic-only").catch((error: unknown) => error)
    expect(error).toMatchObject({ message: "utility-request-failed", reason })
    expect(JSON.stringify(error)).not.toContain("synthetic-only")
  })
  it("classifies the actual HTTPS deadline without exposing diagnostics", async () => {
    vi.useFakeTimers()
    const settled = vi.fn()
    const pending = requestUtilityJson("balance").catch((error: unknown) => {
      settled(error)
      return error
    })
    await vi.advanceTimersByTimeAsync(29_999)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toMatchObject({ message: "utility-request-failed", reason: "timeout" })
    expect(request.destroy).toHaveBeenCalled()
  })
  it.each([
    [401, "unauthorized"],
    [429, "rate-limited"],
  ])("propagates HTTPS %s to BalanceReader without account fallback", async (status, reason) => {
    response.statusCode = status as number
    const getBalance = vi.fn()
    const reader = new BalanceReader({
      credentialsSupported: true,
      credentials: () => ({ resolve: () => ({ value: "synthetic-only", source: "test" }) }),
      account: () => ({ getBalance }),
      version: "0.0.6",
    })
    const value = await reader.read({ locale: "zh-CN", timezoneOffsetSeconds: 0 })
    expect(value).toMatchObject({ status: "failed", reason, source: "api-key" })
    expect(getBalance).not.toHaveBeenCalled()
    expect(JSON.stringify(value)).not.toContain("synthetic-only")
  })
  it("propagates the actual HTTPS timeout to BalanceReader at 30 seconds", async () => {
    vi.useFakeTimers()
    const reader = new BalanceReader({
      credentialsSupported: true,
      credentials: () => ({ resolve: () => ({ value: "synthetic-only", source: "test" }) }),
      account: () => undefined,
      version: "0.0.6",
    })
    const pending = reader.read({ locale: "zh-CN", timezoneOffsetSeconds: 0 })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(await pending).toMatchObject({ status: "failed", reason: "timeout", source: "api-key" })
    expect(request.destroy).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it("classifies malformed JSON and network events without forwarding diagnostics", async () => {
    const malformed = requestUtilityJson("balance").catch((error: unknown) => error)
    await Promise.resolve()
    response.emit("data", Buffer.from("synthetic-secret-not-json"))
    response.emit("end")
    expect(await malformed).toMatchObject({ message: "utility-request-failed", reason: "invalid-response" })
    const network = requestUtilityJson("balance").catch((error: unknown) => error)
    request.emit("error", new Error("synthetic-secret-network"))
    const error = await network
    expect(error).toMatchObject({ message: "utility-request-failed", reason: "network" })
    expect(JSON.stringify(error)).not.toContain("synthetic-secret")
  })
  it("sanitizes synchronous HTTPS errors with a fixed exception class", async () => {
    mock.get.mockImplementation(() => {
      throw new Error("synthetic-secret-provider-diagnostics")
    })
    const error = await requestUtilityJson("balance").catch((error: unknown) => error)
    expect(error).toBeInstanceOf(UtilityRequestError)
    expect(error).toMatchObject({ message: "utility-request-failed", reason: "network" })
    expect(String(error)).not.toContain("synthetic-secret")
    expect(JSON.stringify(error)).not.toContain("synthetic-secret")
  })
  it("allows a custom helper deadline while retaining generic toThrow compatibility", async () => {
    vi.useFakeTimers()
    const settled = vi.fn()
    const pending = withUtilityTimeout(() => new Promise(() => {}), 30_000)
    const rejected = expect(pending).rejects.toThrow("utility-request-failed")
    void pending.catch(settled)
    await vi.advanceTimersByTimeAsync(8_001)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(21_999)
    await rejected
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({ reason: "timeout" }))
  })
  it("bounds absolute time including slow responses and destroys the request", async () => {
    vi.useFakeTimers()
    const pending = requestUtilityJson("@cyrusdoyle/dsh-sessions-insight")
    const rejected = expect(pending).rejects.toThrow("utility-request-failed")
    await vi.advanceTimersByTimeAsync(UTILITY_TIMEOUT_MS)
    await rejected
    expect(request.destroy).toHaveBeenCalled()
  })
})
