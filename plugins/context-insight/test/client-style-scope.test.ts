import { expect, it } from "vitest"
import { TAILWIND_CSS } from "../src/client/theme/generated.css.ts"

it("keeps Tailwind tokens local and handoff spacing scoped with priority", () => {
  expect(TAILWIND_CSS).not.toContain(":root,:host{")
  expect(TAILWIND_CSS).toContain("@layer theme{.ci-panel{")
  const scope = TAILWIND_CSS.indexOf("@scope (.ci-panel)")
  expect(scope).toBeGreaterThan(0)
  expect(TAILWIND_CSS.indexOf(".p-5{padding:calc(var(--spacing) * 5)!important}")).toBeGreaterThan(scope)
})
