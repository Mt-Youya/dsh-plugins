/**
 * Dev server for the local preview.
 *
 * Serves the browser half with HMR, and mounts the Host half's real routes in
 * the same process through `ssrLoadModule`, so the page reads the operator's
 * actual Claude/Codex/DSH sessions. Nothing here ships: `npx tsdown` at the
 * repository root still emits the plugin's `lib/index.js` and `lib/client.js`.
 *
 * The harness lives in `apps/` but the code it serves does not: workspace
 * aliases point the `@cyrus/dsh-*` specifiers at each package's `src`, and
 * `server.fs.allow` opens the whole repository to the dev server.
 */

import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vite"
import { viteAlias } from "../../tooling/aliases.ts"

/** This app's own directory: the served root. */
const PREVIEW_ROOT = fileURLToPath(new URL(".", import.meta.url))

/** Repository root; the dev server may read anything above the app. */
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url))

/** The Host entry, resolved against this file rather than the preview root. */
const HOST_ENTRY = fileURLToPath(new URL("../../plugins/sessions-insight/src/index.ts", import.meta.url))

/** Mount the plugin's own routes on the dev server, under the same paths. */
function hostRoutes(): Plugin {
  return {
    name: "ci-host-routes",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ""
        if (!url.startsWith("/api/dsh-sessions-insight")) return next()
        void (async () => {
          try {
            const host = (await server.ssrLoadModule(HOST_ENTRY)) as {
              createRoutes: (
                deps: unknown
              ) => { kind: string; path: string; handler: (req: unknown, res: unknown) => void }[]
              createSources: () => unknown
              handleHealth: (req: unknown, res: unknown) => void
            }
            const pathname = new URL(url, "http://127.0.0.1").pathname
            if (pathname.endsWith("/health")) {
              host.handleHealth(req, res)
              return
            }
            const routes = host.createRoutes({ sources: host.createSources(), version: "preview" })
            const match = routes.find((route) =>
              route.kind === "exact" ? route.path === pathname : pathname.startsWith(route.path)
            )
            if (match === undefined) {
              res.statusCode = 404
              res.end("no route")
              return
            }
            match.handler(req, res)
          } catch (error) {
            res.statusCode = 500
            res.end(String(error))
          }
        })()
      })
    },
  }
}

export default defineConfig({
  root: PREVIEW_ROOT,
  plugins: [react(), hostRoutes()],
  resolve: { alias: viteAlias() },
  server: { fs: { allow: [REPO_ROOT] }, port: 5178 },
})
