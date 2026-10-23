import { expect, it } from "vitest"
import { parseHandoffPrepare, isHandoffStatusValue } from "../src/protocol.ts"

it("passes the current language through preparation and rejects malformed locales", () => {
  expect(parseHandoffPrepare({ source: "codex", id: "s1", locale: "en-US" })).toEqual({
    source: "codex",
    id: "s1",
    locale: "en-US",
  })
  expect(parseHandoffPrepare({ source: "codex", id: "s1", locale: 42 })).toBeUndefined()
})

it("accepts observed progress while rejecting malformed activity", () => {
  const status = { sessionId: "s1", state: "running", elapsedMs: 2000 }
  expect(isHandoffStatusValue(status)).toBe(true)
  expect(
    isHandoffStatusValue({ ...status, progress: { seq: 4, updatedAt: 1000, toolsCompleted: 2, tool: "bash" } })
  ).toBe(true)
  expect(isHandoffStatusValue({ ...status, progress: { seq: "4" } })).toBe(false)
})
