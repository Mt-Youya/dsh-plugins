/**
 * Dev server for the local preview.
 *
 * Serves the browser half with HMR, and mounts the Host half's real routes in
 * the same process through `ssrLoadModule`, so the page reads the operator's
 * actual Claude/Codex/DSH sessions. Nothing here ships: `npx tsdown` at the
 * repository root still emits the plugin's `lib/index.js` and `lib/client.js`.
 *
 * The harness lives in `apps/` but the code it serves does not: workspace
 * aliases point the `@cyrusdoyle/dsh-*` specifiers at each package's `src`, and
 * `server.fs.allow` opens the whole repository to the dev server.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

import { viteAlias } from "../../tooling/aliases.ts"

/** This app's own directory: the served root. */
const PREVIEW_ROOT = fileURLToPath(new URL(".", import.meta.url))

/** Repository root; the dev server may read anything above the app. */
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url))

/** The Host entry, resolved against this file rather than the preview root. */
const manifest = JSON.parse(
  readFileSync(new URL("../../plugins/sessions-insight/package.json", import.meta.url), "utf8"),
) as { name: string; version: string }

const HOST_ENTRY = fileURLToPath(new URL("../../plugins/sessions-insight/src/index.ts", import.meta.url))

/** Mount the plugin's own routes on the dev server, under the same paths. */
function hostRoutes(): Plugin {
  return {
    name: "ci-host-routes",
    configureServer(server) {
      let utilityDeps: unknown
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ""
        if (!url.startsWith("/api/dsh-sessions-insight")) return next()
        void (async () => {
          try {
            const host = (await server.ssrLoadModule(HOST_ENTRY)) as {
              createRoutes: (
                deps: unknown,
              ) => { kind: string; path: string; handler: (req: unknown, res: unknown) => void }[]
              createSources: () => unknown
              SessionMetadataStore: new () => unknown
              handleHealth: (req: unknown, res: unknown) => void
              createSettingsRoute: (read: () => unknown) => { handler: (req: unknown, res: unknown) => void }
              readSettings: () => unknown
              PLUGIN_VERSION: string
              BalanceReader: new (deps: unknown) => unknown
              VersionChecker: new (version: string) => unknown
            }
            const pathname = new URL(url, "http://127.0.0.1").pathname
            if (pathname.endsWith("/settings")) {
              host.createSettingsRoute(host.readSettings).handler(req, res)
              return
            }
            if (pathname.endsWith("/health")) {
              host.handleHealth(req, res)
              return
            }
            utilityDeps ??= {
              // Never resolve the operator's environment key or account in preview.
              balance: new host.BalanceReader({
                credentialsSupported: true,
                credentials: () => undefined,
                account: () => undefined,
                version: host.PLUGIN_VERSION,
              }),
              versions: new host.VersionChecker(host.PLUGIN_VERSION),
              settings: host.readSettings,
            }
            const routes = host.createRoutes({
              utilities: utilityDeps,
              sources: host.createSources(),
              version: host.PLUGIN_VERSION,
              metadata: new host.SessionMetadataStore(),
            })
            const match = routes.find((route) =>
              route.kind === "exact" ? route.path === pathname : pathname.startsWith(route.path),
            )
            if (match === undefined) {
              res.statusCode = 404
              res.end("no route")
              return
            }
            match.handler(req, res)
          } catch {
            res.statusCode = 500
            res.end("preview-route-failed")
          }
        })()
      })
    },
  }
}

export default defineConfig({
  root: PREVIEW_ROOT,
  define: {
    __DSH_PLUGIN_VERSION__: JSON.stringify(manifest.version),
    __DSH_PLUGIN_NAME__: JSON.stringify(manifest.name),
  },
  plugins: [react(), hostRoutes()],
  resolve: { alias: viteAlias() },
  server: { fs: { allow: [REPO_ROOT] }, port: 5178 },
})
