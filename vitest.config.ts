import { defineConfig } from "vitest/config"
import { viteAlias } from "./tooling/aliases.ts"

/**
 * Kept apart from the preview server config on purpose: that one is the dev
 * server, and a bare `vitest run` that picked it up would look for tests under
 * the preview app and find none.
 *
 * Tests live next to the package they cover, so a package can be read (and
 * eventually moved) without a root-level test directory that knows about every
 * one of them. Workspace package names resolve to their `src` entry, which is
 * what lets a test run against the code as written rather than a stale build.
 */
export default defineConfig({
  resolve: { alias: viteAlias() },
  test: {
    root: ".",
    include: ["packages/*/test/**/*.test.ts", "plugins/*/test/**/*.test.ts"],
  },
})
