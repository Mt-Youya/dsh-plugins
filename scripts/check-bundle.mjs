/**
 * Prove the packed halves still satisfy the shell's loading contract.
 *
 * The client bundle is not a module: it must call
 * `window.__ModuleLoader__.load({ id, factory })` and hand the shell a factory
 * whose `require` resolves React. Everything here runs against `lib/`, i.e. the
 * exact bytes that go into the tarball a user installs.
 *
 * The host bundle is checked for two kinds of drift: the version inlined from
 * `package.json` must match the manifest that ships with it, and the export
 * table must still contain the entry points the shell and the plugin wire
 * together. Both failures say "stale lib/" on purpose: they normally mean the
 * artifacts were not rebuilt, not that the source lost an export.
 */
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { runInNewContext } from "node:vm"

const root = process.argv[2] ?? "."
const client = readFileSync(join(root, "lib/client.js"), "utf8")
const host = readFileSync(join(root, "lib/index.js"), "utf8")
// The shell keys the client graph by the package that owns lib/, so the bundle
// must register under that package's name; the version is inlined from the same
// manifest at build time.
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const packageName = manifest.name
const version = manifest.version
const failures = []

const id = client.match(/__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/)
if (id === null || id[1] !== packageName) failures.push("client bundle does not register the package id")
if (!client.includes("factory:")) failures.push("client bundle has no factory")
if (!client.includes("@scope (.ci-panel)")) failures.push("client bundle carries no scoped stylesheet")
if (/import\s+[^;]*from\s*["']react["']/.test(client)) failures.push("client bundle left a bare ESM react import")

// Host entry points this package is loaded for. The second group arrived with
// the settings page and the balance/version utilities: a bundle without them is
// an old artifact, not a source tree that lost the code.
const HOST_EXPORTS = {
  base: ["apply", "handleHealth", "createRoutes", "createSources"],
  utilities: [
    "Config",
    "readSettings",
    "BalanceReader",
    "VersionChecker",
    "createSettingsRoute",
    "createUtilityRoutes",
  ],
}
const exportsName = (name) =>
  new RegExp(`export\\s*\\{[^{}]*\\b${name}\\b|export\\s+(?:async\\s+)?(?:function|const|let|var|class)\\s+${name}\\b`)
for (const [group, names] of Object.entries(HOST_EXPORTS)) {
  const missing = names.filter((name) => !exportsName(name).test(host))
  if (missing.length === 0) continue
  failures.push(
    group === "utilities"
      ? `host bundle is stale: missing ${missing.join(", ")} (built before the settings/utility routes; rebuild lib/)`
      : `host bundle does not export ${missing.join(", ")}`,
  )
}

// `__DSH_PLUGIN_VERSION__` is inlined as a plain string literal: the bundle must
// carry the same version as the manifest it will be packed with.
const versionLiteral = /(["'`])(\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?)\1/g
const versionLiterals = (text) => [...text.matchAll(versionLiteral)].map((match) => match[2])
// In source, PLUGIN_NAME and PLUGIN_VERSION are adjacent constants; minification
// keeps the string literals and their order, so the version follows the name.
const nameLiteral = new RegExp(`["'\`]${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`, "g")
const nearName = [...host.matchAll(nameLiteral)].flatMap((match) =>
  versionLiterals(host.slice(match.index, match.index + 400)),
)
const allVersions = versionLiterals(host)
const inlinedVersion = nearName[0] ?? (allVersions.length === 1 ? allVersions[0] : undefined)
if (inlinedVersion === undefined) {
  failures.push(
    `host bundle carries no inlined version (found ${allVersions.join(", ") || "none"}); expected ${version} — rebuild lib/`,
  )
} else if (inlinedVersion !== version) {
  failures.push(
    `host bundle inlines version ${inlinedVersion} but package.json says ${version} — stale lib/, rebuild it`,
  )
}

// Evaluate in a browser-like realm with no implicit Node globals.
// new Function() in this Node process would incorrectly expose process/Buffer.
let registered
const sandbox = {
  window: {
    __ModuleLoader__: {
      load: (entry) => {
        registered = entry
      },
    },
  },
}
runInNewContext(client, sandbox, { filename: join(root, "lib/client.js"), timeout: 5000 })
if (registered === undefined) failures.push("client bundle did not call __ModuleLoader__.load")
else {
  const require = createRequire(import.meta.url)
  const exports = registered.factory((name) => {
    // Exercise the actual external APIs, including the UI library's forwardRef and portal.
    // Any unbundled third-party import still fails the deployment contract.
    if (/^react(-dom)?(\/.*)?$/.test(name)) return require(name)
    throw new Error(`unexpected require: ${name}`)
  })
  const values = Object.values(exports ?? {})
  if (values.length === 0) failures.push("factory returned no exports")
  else if (!values.some((value) => typeof value === "function")) failures.push("factory returned no callable export")
}

if (failures.length > 0) {
  console.error("bundle check FAILED")
  for (const line of failures) console.error(" -", line)
  process.exit(1)
}
console.log("bundle check ok: id, factory, scoped css, host exports, inlined version, factory exports")
