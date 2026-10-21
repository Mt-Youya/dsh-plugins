/**
 * One stylesheet per plugin, injected once per page.
 *
 * The shell loads a plugin's browser half as a module factory, so the only
 * place a style element may be created is inside that factory (a side effect at
 * module scope would run before the factory is ever called). Injection is
 * idempotent by element id: a duplicated factory run must not stack copies.
 *
 * @module @cyrus/dsh-plugin-kit-client/styles
 */

/**
 * Create the style element once per page.
 * @param id - element id the plugin owns.
 * @param css - compiled stylesheet text.
 * @returns nothing; a document without a head (tests, SSR) is left alone.
 */
export function injectStylesOnce(id: string, css: string): void {
  if (typeof document === "undefined") return
  if (document.getElementById(id) !== null) return
  const style = document.createElement("style")
  style.id = id
  style.textContent = css
  document.head.append(style)
}
