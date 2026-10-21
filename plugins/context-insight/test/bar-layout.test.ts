import { describe, expect, it } from "vitest"
import type { Attribution, Measure } from "@cyrus/dsh-session-contract"
import { barLayout } from "../src/client/state/bar-layout.ts"

const exact = (tokens: number): Measure => ({ tokens, precision: "exact", basis: "usage" })
const estimate = (tokens: number): Measure => ({ tokens, precision: "estimate", basis: "chars-per-token" })

function attribution(over: Partial<Attribution> & { total: Measure; parts: Attribution["parts"] }): Attribution {
  return { ...over }
}

describe("composition bar arithmetic", () => {
  it("closes on the exact total when the parts sum to it", () => {
    const layout = barLayout(
      attribution({
        total: exact(1000),
        parts: [
          { part: "history", measure: estimate(600) },
          { part: "user-input", measure: estimate(400) },
        ],
      })
    )
    expect(layout.residual).toBe(0)
    expect(layout.overCounted).toBe(0)
    expect(layout.normalizedByParts).toBe(false)
    expect(layout.segments.map((segment) => segment.key)).toEqual(["history", "user-input"])
    expect(layout.segments.reduce((sum, segment) => sum + segment.width, 0)).toBeCloseTo(100, 6)
  })

  it("paints a positive residual as its own unknown slice, never inside a category", () => {
    const layout = barLayout(
      attribution({
        total: exact(1000),
        parts: [{ part: "history", measure: estimate(800) }],
        residual: estimate(200),
      })
    )
    expect(layout.residual).toBe(200)
    const unknown = layout.segments.find((segment) => segment.kind === "unknown")
    expect(unknown?.tokens).toBe(200)
    expect(unknown?.width).toBeCloseTo(20, 6)
    // The known slice keeps its own value: no spreading.
    expect(layout.segments.find((segment) => segment.key === "history")?.tokens).toBe(800)
    expect(layout.segments.at(-1)?.key).toBe("unknown")
  })

  it("reports an over-count instead of inventing a negative slice", () => {
    const layout = barLayout(attribution({ total: exact(0), parts: [{ part: "history", measure: estimate(5231) }] }))
    expect(layout.normalizedByParts).toBe(true)
    expect(layout.denominator).toBe(5231)
    expect(layout.segments.some((segment) => segment.kind === "unknown")).toBe(false)
    expect(layout.overCounted).toBe(0)

    const overshoot = barLayout(
      attribution({ total: exact(100), parts: [{ part: "history", measure: estimate(400) }] })
    )
    expect(overshoot.overCounted).toBe(300)
    expect(overshoot.residual).toBe(-300)
    expect(overshoot.overflowingParts).toBe(true)
    // No slice may claim more than the whole bar.
    expect(overshoot.segments.every((segment) => segment.width <= 100)).toBe(true)
  })

  it("drops zero-token parts so the legend never lists an empty row", () => {
    const layout = barLayout(
      attribution({
        total: exact(10),
        parts: [
          { part: "history", measure: estimate(10) },
          { part: "images", measure: estimate(0) },
        ],
      })
    )
    expect(layout.segments.map((segment) => segment.key)).toEqual(["history"])
  })
})
