import { describe, expect, it } from "vitest"
import { apply, type HostContext } from "../src/index.ts"
import type { WebRoute } from "../src/host/http/server.ts"
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

describe("apply", () => {
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
  Object.assign(ctx, { effect: (setup: () => () => void) => { onDispose = setup(); return onDispose } })
  apply(ctx)
  expect(table.has(HEALTH_PATH)).toBe(true)
  expect(onDispose).toBeTypeOf("function")
  onDispose?.()
  expect(table.size).toBe(0)
})
