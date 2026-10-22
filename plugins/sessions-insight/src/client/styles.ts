/**
 * The panel's stylesheet.
 *
 * The shell loads this bundle as a module factory, so the only place a style
 * element may be created is inside that factory (a side effect at package
 * module scope would run before the factory is ever called). The once-per-page
 * mechanics live in `@cyrus/dsh-plugin-kit-client`; what stays here is the element id
 * this plugin owns and the CSS it carries.
 *
 * The CSS itself is compiled from `theme/app.css` by
 * `tooling/scripts/build-css.mjs`: Tailwind v4 without preflight, utilities
 * scoped to `.ci-panel`, and the component layer that carries the panel's own
 * rules.
 *
 * @module @cyrus/dsh-sessions-insight/client/styles
 */

import { injectStylesOnce } from "@cyrus/dsh-plugin-kit-client"
import { TAILWIND_CSS } from "./theme/generated.css.ts"

/** Id of the single style element this plugin owns. */
const STYLE_ID = "dsh-sessions-insight-styles"

/**
 * Create the style element once per page.
 * @returns nothing; a document without a head (tests, SSR) is left alone.
 */
export function injectStyles(): void {
  injectStylesOnce(STYLE_ID, TAILWIND_CSS)
}
