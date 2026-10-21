/**
 * Build one internal workspace package as a library.
 *
 * Internal packages are published siblings, not private modules: a consumer of
 * `@cyrus/dsh-session-readers` installs `@cyrus/dsh-session-contract` alongside it, so the
 * `@cyrus/dsh-*` specifiers in the emitted files stay bare and resolvable rather than
 * being inlined per package. The plugin build is the opposite case and inlines
 * them (see `plugin-config.ts`).
 *
 * @module tooling/tsdown/lib-config
 */

import { defineConfig } from "tsdown"
import { workspaceAlias } from "../aliases.ts"

/** Where one package keeps its sources. */
export interface LibBuildOptions {
  /** Package directory, with a trailing slash. */
  root: string
  /** `node` for readers (they touch the filesystem), `neutral` for the rest. */
  platform?: "node" | "neutral"
}

/**
 * Build the package's `src/index.ts` into `lib/` as ESM plus declarations.
 * @param options - package root and runtime platform.
 * @returns the tsdown config for that package.
 */
export function createLibConfig(options: LibBuildOptions) {
  return defineConfig({
    entry: [options.root + "src/index.ts"],
    outDir: options.root + "lib",
    format: "esm",
    platform: options.platform ?? "neutral",
    target: "esnext",
    dts: true,
    sourcemap: true,
    outExtensions: () => ({ js: ".js" }),
    alias: workspaceAlias(),
    // Published siblings stay bare: a consumer installs them, so the emitted
    // files import the package names rather than carrying a copy.
    deps: { neverBundle: Object.keys(workspaceAlias()) },
  })
}
