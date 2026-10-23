import { expect, it } from "vitest"
import { handoffProgress } from "../src/host/handoff/progress.ts"

it("reports pending tools and replaces them with completed activity", () => {
  const call = { type: "tool/call", seq: 5, time: 1000, data: { callId: "a", name: "bash" } }
  expect(handoffProgress([call])).toEqual({ seq: 5, updatedAt: 1000, toolsCompleted: 0, tool: "bash" })
  expect(
    handoffProgress([call, { type: "tool/result", seq: 8, time: 2000, data: { message: { toolCallId: "a" } } }])
  ).toEqual({ seq: 8, updatedAt: 2000, toolsCompleted: 1 })
  expect(handoffProgress([])).toBeUndefined()
})
