/**
 * Prove the packed halves still satisfy the shell's loading contract.
 *
 * The client bundle is not a module: it must call
 * `window.__ModuleLoader__.load({ id, factory })` and hand the shell a factory
 * whose `require` resolves React. Everything here runs against `lib/`, i.e. the
 * exact bytes that go into the tarball a user installs.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.argv[2] ?? "."
const client = readFileSync(join(root, "lib/client.js"), "utf8")
const host = readFileSync(join(root, "lib/index.js"), "utf8")
// The shell keys the client graph by the package that owns lib/, so the bundle
// must register under that package's name.
const packageName = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name
const failures = []

const id = client.match(/__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/)
if (id === null || id[1] !== packageName) failures.push("client bundle does not register the package id")
if (!client.includes("factory:")) failures.push("client bundle has no factory")
if (!client.includes("@scope (.ci-panel)")) failures.push("client bundle carries no scoped stylesheet")
if (/import\s+[^;]*from\s*["']react["']/.test(client)) failures.push("client bundle left a bare ESM react import")

for (const name of ["apply", "handleHealth", "createRoutes", "createSources"]) {
  if (!new RegExp("export\\s*\\{[^}]*\\b" + name + "\\b|export\\s+(function|const)\\s+" + name).test(host)) {
    failures.push(`host bundle does not export ${name}`)
  }
}

// Evaluate the client bundle the way the shell does: one global, one factory.
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
new Function("window", client.replace(/^/, "\n"))(sandbox.window)
if (registered === undefined) failures.push("client bundle did not call __ModuleLoader__.load")
else {
  const exports = registered.factory((name) => {
    if (name === "react")
      return {
        createElement: () => null,
        Fragment: Symbol("fragment"),
        useState: () => [undefined, () => {}],
        useEffect: () => {},
        useMemo: (fn) => fn(),
        useCallback: (fn) => fn,
        useRef: () => ({ current: null }),
      }
    // The shell resolves React from its own copy; the factory may also pull the
    // automatic JSX runtime, which the same copy provides.
    if (name === "react/jsx-runtime") {
      return { Fragment: Symbol("fragment"), jsx: () => null, jsxs: () => null, jsxDEV: () => null }
    }
    throw new Error("unexpected require: " + name)
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
console.log("bundle check ok: id, factory, scoped css, host exports, factory exports")
