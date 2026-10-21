/**
 * Build for both halves of this plugin.
 *
 * The configuration itself lives in `tooling/tsdown/plugin-config.ts` (it is the
 * same two-entry shape every plugin has); what belongs here is this package's
 * own locations and the workspace alias table the bundle inlines.
 *
 * @see tooling/tsdown/plugin-config.ts
 * @see docs/adr/0002-asar-021-is-the-contract.md
 */

import { fileURLToPath } from "node:url"
import { workspaceAlias } from "../../tooling/aliases.ts"
import { createPluginConfig } from "../../tooling/tsdown/plugin-config.ts"

/** Package directory, with the trailing slash the config expects. */
const root = fileURLToPath(new URL(".", import.meta.url))

export default createPluginConfig({
  srcDir: root + "src/",
  outDir: root + "lib/",
  manifestPath: root + "package.json",
  alias: workspaceAlias(),
})
