/**
 * Build for both halves of the plugin.
 *
 * `src/index.ts` is the Host entry: plain ESM, loaded by the Host loader in a
 * `node:vm` realm.
 *
 * `src/client/index.tsx` is the browser entry, and its *file format* is a
 * contract with the shell's module loader rather than a module system: the
 * served bundle must call `window.__ModuleLoader__.load({ id, factory })` with
 * the owning package's name as `id`, and the factory receives the `require` the shell
 * resolves (so `react` stays external and the shell's single copy is used).
 * The banner and footer build that wrapper around the CJS-shaped body.
 *
 * Internal workspace packages are inlined: the installed tarball has no
 * `node_modules` in which a workspace link could resolve, so aliases point the
 * bare specifiers at each package's `src` and `alwaysBundle` keeps rolldown
 * from externalising them.
 *
 * @see docs/adr/0002-asar-021-is-the-contract.md
 */

import { defineConfig } from "tsdown"
import { readFileSync } from "node:fs"

/**
 * The CJS body rolldown emits reads and writes `module.exports`/`exports` as
 * free variables, so the wrapper supplies both before the body and returns the
 * finished exports object after it.
 *
 * `id` must be the name of the package whose manifest owns the built file: the
 * shell keys the module graph by that package, and a bundle registering any
 * other id never arrives.
 * @param id - the owning package's name.
 * @returns the banner opening the registration call.
 */
function clientBanner(id: string): string {
  return `window.__ModuleLoader__.load({
	id: ${JSON.stringify(id)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
`
}

const CLIENT_FOOTER = `
		return module.exports;
	}
});
`

/** Where the plugin's sources and manifest live, and how its names resolve. */
export interface PluginBuildOptions {
  /** Directory holding `index.ts` and `client/index.tsx`, with a trailing slash. */
  srcDir: string
  /** Output directory, with a trailing slash. */
  outDir: string
  /** Absolute path of the manifest that owns `outDir`; its name and version are inlined. */
  manifestPath: string
  /** Workspace package name → absolute source entry. */
  alias: Record<string, string>
}

/**
 * Build the two plugin entries.
 * @param options - source, output and alias locations.
 * @returns one tsdown config per entry.
 */
export function createPluginConfig(options: PluginBuildOptions) {
  /**
   * The manifest is the only place the version is written: inlining it here
   * keeps the health route in step with whatever the release bumped, with no
   * second file to forget.
   */
  const manifest = JSON.parse(readFileSync(options.manifestPath, "utf8")) as { name: string; version: string }

  return defineConfig([
    {
      entry: [options.srcDir + "index.ts"],
      outDir: options.outDir,
      format: "esm",
      platform: "node",
      // The Host runs this entry on the Electron-bundled Node; keep the syntax
      // floor below it rather than assuming a Node version.
      target: "node20",
      sourcemap: true,
      dts: false,
      alias: options.alias,
      // Inline every workspace package: the installed tarball has no
      // node_modules in which a workspace link could resolve.
      deps: { alwaysBundle: Object.keys(options.alias) },
      // `main` and `exports["."]` name lib/index.js; an .mjs extension would
      // leave every manifest path dangling.
      outExtensions: () => ({ js: ".js" }),
      define: { __DSH_PLUGIN_VERSION__: JSON.stringify(manifest.version) },
    },
    {
      entry: { client: options.srcDir + "client/index.tsx" },
      outDir: options.outDir,
      format: "cjs",
      platform: "browser",
      sourcemap: true,
      dts: false,
      alias: options.alias,
      deps: {
        alwaysBundle: Object.keys(options.alias),
        // The shell owns these; bundling either copy would break hooks and context.
        neverBundle: [/^react(-dom)?(\/.*)?$/],
      },
      // The shell serves this file as text, not through Node's resolver: a .cjs
      // extension (what a CJS build implies inside a "type": "module" package)
      // would not match `exports["./client"]`.
      outExtensions: () => ({ js: ".js" }),
      banner: { js: clientBanner(manifest.name) },
      footer: { js: CLIENT_FOOTER },
    },
  ])
}
