import { afterEach, describe, expect, it, vi } from "vitest"

import * as lists from "../src/host/http/list-cache.ts"
import * as routes from "../src/host/http/routes.ts"
import type { WebRoute } from "../src/host/http/server.ts"
import type { AiTitleGenerator, AiTitleHost } from "../src/host/management/ai-title.ts"
import { apply, type HostContext } from "../src/index.ts"
import { HEALTH_PATH, SOURCES_PATH } from "../src/protocol.ts"

/** The Host web server's exact-route table: a duplicate path throws, a disposer frees it. */
function webServer(): { table: Map<string, WebRoute>; ctx: HostContext } {
  const table = new Map<string, WebRoute>()
  const register = (route: WebRoute): (() => void) => {
    if (table.has(route.path)) throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`)
    table.set(route.path, route)
    return () => {
      table.delete(route.path)
    }
  }
  return { table, ctx: { webServer: { register } } }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("apply", () => {
  it("isolates optional AI services in a child fiber, makes no background model calls and follows disposal", async () => {
    vi.useFakeTimers()
    vi.spyOn(lists, "preloadLists").mockResolvedValue()
    const mounted = vi.spyOn(routes, "createRoutes")
    const { table, ctx } = webServer()
    const prepareCall = vi.fn()
    let activate: ((child: AiTitleHost & { effect: (setup: () => () => void) => unknown }) => void) | undefined
    let releaseChild: (() => void) | undefined
    ctx.inject = vi.fn((services, callback) => {
      expect([["llm", "agentDefaultModel"], ["credentials"], ["deepseekAccount"], ["settings"]]).toContainEqual(
        services,
      )
      if (services[0] === "llm") activate = callback
    })
    const dispose = apply(ctx)
    expect(table.has(HEALTH_PATH)).toBe(true)
    const generator = (mounted.mock.calls[0]![0] as routes.RouteDeps & { aiTitles: AiTitleGenerator }).aiTitles
    await expect(generator.suggest({ source: "claude", id: "session-1" }, {} as never)).rejects.toMatchObject({
      detail: "ai-naming-unavailable",
    })
    activate?.({
      llm: { prepareCall },
      agentDefaultModel: { currentSelection: () => ({ provider: "p", model: "m" }) },
      effect: (setup) => {
        releaseChild = setup()
      },
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(prepareCall).not.toHaveBeenCalled()
    releaseChild?.()
    await expect(generator.suggest({ source: "claude", id: "session-1" }, {} as never)).rejects.toMatchObject({
      detail: "ai-naming-unavailable",
    })
    dispose()
    expect(table.size).toBe(0)
  })

  it("starts metadata preload just after registration, once rather than periodically", async () => {
    vi.useFakeTimers()
    const preload = vi.spyOn(lists, "preloadLists").mockResolvedValue()
    const { table, ctx } = webServer()
    const dispose = apply(ctx)
    expect(table.has(HEALTH_PATH)).toBe(true)
    expect(preload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)
    expect(preload).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(preload).toHaveBeenCalledTimes(1)
    dispose()
    expect(preload.mock.calls[0]?.[1]?.aborted).toBe(true)
  })

  it("cancels scheduled preload and clears list cache on dispose or failed registration", async () => {
    vi.useFakeTimers()
    const preload = vi.spyOn(lists, "preloadLists").mockResolvedValue()
    const clear = vi.spyOn(lists, "clearListCache")
    const { ctx } = webServer()
    apply(ctx)()
    await vi.runAllTimersAsync()
    expect(preload).not.toHaveBeenCalled()
    expect(clear).toHaveBeenCalledTimes(1)
    ctx.webServer.register({ kind: "exact", path: SOURCES_PATH, handler: () => {} })
    expect(() => apply(ctx)).toThrow("duplicate")
    await vi.runAllTimersAsync()
    expect(preload).not.toHaveBeenCalled()
    expect(clear).toHaveBeenCalledTimes(2)
  })

  it("follows the Host settings service's DeepSeek credential reference on every balance read", async () => {
    vi.useFakeTimers()
    vi.spyOn(lists, "preloadLists").mockResolvedValue()
    const mounted = vi.spyOn(routes, "createRoutes")
    const { table, ctx } = webServer()
    let descriptorValue: unknown = { apiKeyEnv: "SYNTHETIC_DEEPSEEK_REF" }
    let describeThrows = false
    const describe = vi.fn(() => {
      if (describeThrows) throw new Error("synthetic-host-failure")
      return [{ ns: "llm-deepseek", value: descriptorValue }]
    })
    const resolve = vi.fn(() => undefined)
    let releaseSettings: (() => void) | undefined
    ctx.inject = vi.fn((services, callback) => {
      if (services[0] === "credentials")
        callback({ credentials: { resolve }, effect: (setup: () => () => void) => setup() } as never)
      if (services[0] === "settings")
        callback({
          settings: { describe },
          effect: (setup: () => () => void) => {
            releaseSettings = setup()
            return releaseSettings
          },
        } as never)
    })
    const dispose = apply(ctx)
    const balance = (mounted.mock.calls[0]![0] as routes.RouteDeps).utilities!.balance
    const read = (force = false) => balance.read({ locale: "en-US", timezoneOffsetSeconds: 0 }, force)
    expect((await read()).status).toBe("missing-credentials")
    expect(resolve).toHaveBeenLastCalledWith("SYNTHETIC_DEEPSEEK_REF")
    descriptorValue = { apiKeyEnv: "SYNTHETIC_ROTATED_REF" }
    await read(true)
    expect(resolve).toHaveBeenLastCalledWith("SYNTHETIC_ROTATED_REF")
    // A missing entry, an empty or non-string field or a throwing settings
    // service silently falls back to the default reference.
    for (const invalid of [{ apiKeyEnv: "" }, { apiKeyEnv: 42 }, null, {}, "synthetic"]) {
      descriptorValue = invalid
      await read(true)
      expect(resolve).toHaveBeenLastCalledWith("DEEPSEEK_API_KEY")
    }
    describeThrows = true
    expect((await read(true)).status).toBe("missing-credentials")
    expect(resolve).toHaveBeenLastCalledWith("DEEPSEEK_API_KEY")
    // Releasing the settings fiber drops the override with it.
    describeThrows = false
    releaseSettings?.()
    descriptorValue = { apiKeyEnv: "SYNTHETIC_AFTER_RELEASE" }
    await read(true)
    expect(resolve).toHaveBeenLastCalledWith("DEEPSEEK_API_KEY")
    dispose()
    expect(table.size).toBe(0)
  })

  it("uses the default credential reference when the Host settings service is absent", async () => {
    vi.useFakeTimers()
    vi.spyOn(lists, "preloadLists").mockResolvedValue()
    const mounted = vi.spyOn(routes, "createRoutes")
    const { ctx } = webServer()
    const resolve = vi.fn(() => undefined)
    ctx.inject = vi.fn((services, callback) => {
      if (services[0] === "credentials")
        callback({ credentials: { resolve }, effect: (setup: () => () => void) => setup() } as never)
    })
    const dispose = apply(ctx)
    const balance = (mounted.mock.calls[0]![0] as routes.RouteDeps).utilities!.balance
    expect((await balance.read({ locale: "en-US", timezoneOffsetSeconds: 0 })).status).toBe("missing-credentials")
    expect(resolve).toHaveBeenLastCalledWith("DEEPSEEK_API_KEY")
    dispose()
  })

  it("preloads without timer or AbortController globals in the Host VM", async () => {
    const preload = vi.spyOn(lists, "preloadLists").mockResolvedValue()
    const { ctx } = webServer()
    const timeout = globalThis.setTimeout
    const abort = globalThis.AbortController
    let dispose: (() => void) | undefined
    try {
      Object.assign(globalThis, { setTimeout: undefined, AbortController: undefined })
      dispose = apply(ctx)
    } finally {
      Object.assign(globalThis, { setTimeout: timeout, AbortController: abort })
    }
    await Promise.resolve()
    expect(preload).toHaveBeenCalledTimes(1)
    dispose?.()
    expect(preload.mock.calls[0]?.[1]?.aborted).toBe(true)
  })

  it("frees every route on dispose, so a restarted fiber registers cleanly", () => {
    const { table, ctx } = webServer()
    const dispose = apply(ctx)
    expect(table.has(HEALTH_PATH)).toBe(true)
    dispose()
    expect(table.size).toBe(0)
    apply(ctx)()
  })

  it("leaves nothing registered when a later route collides", () => {
    const { table, ctx } = webServer()
    const release = ctx.webServer.register({ kind: "exact", path: SOURCES_PATH, handler: () => {} })
    expect(() => apply(ctx)).toThrow(`duplicate exact route "${SOURCES_PATH}"`)
    expect([...table.keys()]).toEqual([SOURCES_PATH])
    release()
    apply(ctx)()
    expect(table.size).toBe(0)
  })
})

it("binds route cleanup to the Host fiber lifecycle, without relying on the apply return value", () => {
  const { table, ctx } = webServer()
  let onDispose: (() => void) | undefined
  Object.assign(ctx, {
    effect: (setup: () => () => void) => {
      onDispose = setup()
      return onDispose
    },
  })
  apply(ctx)
  expect(table.has(HEALTH_PATH)).toBe(true)
  expect(onDispose).toBeTypeOf("function")
  onDispose?.()
  expect(table.size).toBe(0)
})
