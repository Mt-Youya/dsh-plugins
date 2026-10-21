import { fileURLToPath } from "node:url"
import { createLibConfig } from "../../tooling/tsdown/lib-config.ts"

export default createLibConfig({ root: fileURLToPath(new URL(".", import.meta.url)) })
