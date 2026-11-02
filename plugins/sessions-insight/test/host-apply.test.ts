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
      expect(services).toEqual(["llm", "agentDefaultModel"])
      activate = callback
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
