/**
 * Root build entry.
 *
 * `npx tsdown` at the repository root builds the only publishable package; the
 * configuration lives with the plugin that owns it, so the same file serves
 * `pnpm --filter @cyrus/dsh-context-insight pack`.
 *
 * @module tsdown.config
 */

export { default } from "./plugins/context-insight/tsdown.config.ts"
