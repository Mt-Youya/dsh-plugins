/**
 * The version the health route reports.
 *
 * The manifest is the single source of truth: `tsdown.config.ts` inlines
 * `package.json`'s version into this constant at build time, because a runtime
 * read would have to resolve a relative JSON path from inside the Host loader's
 * `node:vm` realm (M1's note). The fallback only appears in unbundled contexts
 * such as the test runner, never in a packed plugin.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/version
 */

import { isPluginName, type PluginName } from "./protocol/utilities.ts"

declare const __DSH_PLUGIN_VERSION__: string | undefined
declare const __DSH_PLUGIN_NAME__: string | undefined

/** Owning package identity; the unbundled fallback belongs to Sessions Insight. */
export const PLUGIN_NAME: PluginName =
  typeof __DSH_PLUGIN_NAME__ === "string" && isPluginName(__DSH_PLUGIN_NAME__)
    ? __DSH_PLUGIN_NAME__
    : "@cyrusdoyle/dsh-sessions-insight"

export const PLUGIN_VERSION: string = typeof __DSH_PLUGIN_VERSION__ === "string" ? __DSH_PLUGIN_VERSION__ : "0.0.0-dev"
