/**
 * The version the health route reports.
 *
 * The manifest is the single source of truth: `tsdown.config.ts` inlines
 * `package.json`'s version into this constant at build time, because a runtime
 * read would have to resolve a relative JSON path from inside the Host loader's
 * `node:vm` realm (M1's note). The fallback only appears in unbundled contexts
 * such as the test runner, never in a packed plugin.
 *
 * @module @cyrus/dsh-context-insight/version
 */

declare const __DSH_PLUGIN_VERSION__: string | undefined

/** Version the health route reports; inlined from `package.json` when bundled. */
export const PLUGIN_VERSION: string =
  typeof __DSH_PLUGIN_VERSION__ === "string" ? __DSH_PLUGIN_VERSION__ : "0.0.0-dev"
