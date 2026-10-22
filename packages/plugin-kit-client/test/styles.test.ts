import { afterEach, expect, it, vi } from "vitest"
import { injectStylesOnce } from "../src/styles.ts"

afterEach(() => vi.unstubAllGlobals())

it("updates an existing stylesheet without adding a second node", () => {
  const style = { textContent: "old CSS" }
  const append = vi.fn()
  vi.stubGlobal("document", { getElementById: () => style, head: { append } })
  injectStylesOnce("plugin-styles", "new CSS")
  expect(style.textContent).toBe("new CSS")
  expect(append).not.toHaveBeenCalled()
})

it("creates the stylesheet once and leaves identical CSS untouched", () => {
  const style = { id: "", textContent: "" }
  let existing: typeof style | null = null
  const append = vi.fn((node) => {
    existing = node
  })
  vi.stubGlobal("document", {
    getElementById: () => existing,
    createElement: () => style,
    head: { append },
  })
  injectStylesOnce("plugin-styles", "CSS")
  injectStylesOnce("plugin-styles", "CSS")
  expect(style).toEqual({ id: "plugin-styles", textContent: "CSS" })
  expect(append).toHaveBeenCalledTimes(1)
})
