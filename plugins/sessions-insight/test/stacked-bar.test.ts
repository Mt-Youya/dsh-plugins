import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Attribution } from "@cyrus/dsh-session-contract"
import { t } from "../src/client/locale.ts"
import { PartLegend, StackedBar } from "../src/client/ui/stacked-bar.tsx"

const attribution: Attribution = {
  total: { tokens: 1000, precision: "exact", basis: "usage" },
  parts: [
    { part: "history", measure: { tokens: 800, precision: "estimate", basis: "chars-per-token" } },
    { part: "images", measure: { tokens: 0, precision: "estimate", basis: "harness-projection" } },
  ],
}

describe("composition display", () => {
  it("gives known and unknown segments focusable tips with their shares and provenance", () => {
    const html = renderToStaticMarkup(createElement(StackedBar, { attribution, label: "context" }))
    expect(html).toContain('role="group"')
    expect(html.match(/tabindex="0"/g)).toHaveLength(2)
    expect(html).toContain('data-tip="' + t("part.history") + " · 80.0%")
    expect(html).toContain('data-tip="' + t("turns.unknown") + " · 20.0%")
    expect(html).toContain("800 tokens")
    expect(html).toContain("200 tokens")
    expect(html).toContain(t("basis.chars-per-token"))
    expect(html).toContain(t("basis.unattributed"))
  })

  it("keeps the dense turn-list bar out of the tab order", () => {
    const html = renderToStaticMarkup(createElement(StackedBar, { attribution, label: "context", dense: true }))
    expect(html).toContain('role="img"')
    expect(html).toContain('title="')
    expect(html).not.toContain("tabindex")
    expect(html).not.toContain("data-tip")
  })

  it("keeps the unknown gap visible without repeating precision badges", () => {
    const html = renderToStaticMarkup(createElement(PartLegend, { attribution }))
    expect(html).toContain(t("part.history"))
    expect(html).toContain(t("turns.unknownNote"))
    expect(html).not.toContain(t("part.images"))
    expect(html).not.toContain('data-precision="estimate">' + t("precision.estimate") + "</span>")
  })
})
