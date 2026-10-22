/**
 * Root build entry: the collection package's own `lib/`.
 *
 * The collection is what a profile installs, so the Host resolves its entry to
 * this package's manifest and keys the client module graph by
 * `@cyrus/dsh-plugins`. It therefore builds the plugin sources into its own
 * `lib/` under its own name rather than pointing `exports` into
 * `plugins/sessions-insight/lib`, whose client bundle registers as
 * `@cyrus/dsh-sessions-insight` and would never arrive under this package.
 *
 * @see tooling/tsdown/plugin-config.ts
 * @module tsdown.config
 */

import { fileURLToPath } from "node:url"
import { workspaceAlias } from "./tooling/aliases.ts"
import { createPluginConfig } from "./tooling/tsdown/plugin-config.ts"

/** Repository root, with the trailing slash the config expects. */
const root = fileURLToPath(new URL(".", import.meta.url))

export default createPluginConfig({
  srcDir: root + "plugins/sessions-insight/src/",
  outDir: root + "lib/",
  manifestPath: root + "package.json",
  alias: workspaceAlias(),
})
