import { afterEach, describe, expect, it, vi } from "vitest"

import { createPluginConfig } from "../../../tooling/tsdown/plugin-config.ts"
import { compareVersions } from "../src/host/utilities/semver.ts"
import { VersionChecker, VERSION_FAILED_TTL_MS, VERSION_TTL_MS } from "../src/host/utilities/version.ts"
import { isVersionValue } from "../src/protocol/utilities.ts"

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
