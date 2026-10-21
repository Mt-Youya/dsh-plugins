/**
 * Package name → source entry: the one place the workspace's module graph is
 * declared.
 *
 * Every tool that has to see the workspace as it is written — vitest, the
 * preview dev server, tsdown — resolves a package name through this table to
 * that package's `src/index.ts`, never to its built `lib/`. That is what lets
 * a plugin build inline the internal packages: no build order, no
 * `node_modules` resolution of a workspace link.
 *
 * `tsconfig.json` carries the same mapping as `paths`; TypeScript cannot import
 * this file, so the two are kept in step by hand.
 *
 * @module tooling/aliases
 */

import { fileURLToPath } from "node:url"

/** Repository root, resolved against this file rather than the caller's cwd. */
export const repoRoot: string = fileURLToPath(new URL("..", import.meta.url))

/** Package name → repo-relative path of its TypeScript entry. */
export const WORKSPACE_PACKAGES = {
  "@cyrus/dsh-plugin-kit": "packages/plugin-kit/src/index.ts",
  "@cyrus/dsh-session-contract": "packages/session-contract/src/index.ts",
  "@cyrus/dsh-session-readers": "packages/session-readers/src/index.ts",
  "@cyrus/dsh-plugin-kit-host": "packages/plugin-kit-host/src/index.ts",
  "@cyrus/dsh-plugin-kit-client": "packages/plugin-kit-client/src/index.ts",
} as const

/** Names of the workspace packages, in dependency order. */
export type WorkspacePackage = keyof typeof WORKSPACE_PACKAGES

/**
 * Absolute path of a package's source entry.
 * @param name - a workspace package name.
 * @returns the absolute `src/index.ts` path.
 */
export function packageEntry(name: WorkspacePackage): string {
  return repoRoot + WORKSPACE_PACKAGES[name]
}

/**
 * The table as tsdown and Vite both spell it.
 * @returns package name → absolute source entry.
 */
export function workspaceAlias(): Record<string, string> {
  const alias: Record<string, string> = {}
  for (const name of Object.keys(WORKSPACE_PACKAGES) as WorkspacePackage[]) alias[name] = packageEntry(name)
  return alias
}

/**
 * The table as Vite/Vitest `resolve.alias` entries.
 * @returns one `{ find, replacement }` per package.
 */
export function viteAlias(): { find: string; replacement: string }[] {
  return Object.entries(workspaceAlias()).map(([find, replacement]) => ({ find, replacement }))
}
