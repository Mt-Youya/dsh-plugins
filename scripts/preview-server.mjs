/**
 * The preview dev server, as the browser-driving scripts need it.
 *
 * `smoke-preview.mjs` and `screenshots.mjs` both point headless Chrome at the
 * preview app. They reuse a server that is already running (the one `pnpm dev`
 * started), and otherwise start `pnpm dev` themselves and stop it afterwards.
 */
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

/** Port the preview listens on; `apps/preview/vite.config.ts` pins 5178. */
export const PORT = Number(process.env.PREVIEW_PORT ?? 5178)

/** Origin the scripts navigate to. */
export const ORIGIN = `http://localhost:${String(PORT)}`

/** Chrome binary; override with CHROME_PATH. */
export const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

/** Workspace root: `pnpm dev` is declared there. */
const ROOT = fileURLToPath(new URL("..", import.meta.url))

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function reachable() {
  try {
    const response = await fetch(`${ORIGIN}/api/dsh-context-insight/health`, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Make sure the preview answers.
 * @returns a stop function: a no-op for a server someone else started.
 */
export async function ensureServer() {
  if (await reachable()) return () => {}
  const child = spawn("pnpm", ["dev"], { cwd: ROOT, stdio: "ignore", detached: true })
  child.unref()
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(500)
    if (await reachable()) {
      return () => {
        try {
          process.kill(-child.pid)
        } catch {
          // already gone
        }
      }
    }
  }
  throw new Error("preview dev server did not become reachable")
}
