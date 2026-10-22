/**
 * Regenerate the README screenshots from the live preview.
 *
 * Each shot loads the preview with `?shot=<scene>` (see apps/preview/shot.ts),
 * waits until the page reports `shot:ready` in its title, then captures the
 * viewport as PNG into plugins/context-insight/docs/images/ and mirrors it to
 * docs/images/. Chrome is driven over the DevTools protocol so the capture
 * happens after the page says it is ready, not after a guessed delay.
 *
 * The pictures show whatever sessions are on this machine: titles, paths and
 * the user's own words. Look at them before committing.
 *
 * Usage: node scripts/screenshots.mjs [--theme dark|light]
 */
import { spawn } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { CHROME, ORIGIN, ensureServer, sleep } from "./preview-server.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const OUT = join(ROOT, "plugins/context-insight/docs/images")
const MIRROR = join(ROOT, "docs/images")
const WIDTH = 1440
const HEIGHT = 900
const DEBUG_PORT = Number(process.env.SHOT_DEBUG_PORT ?? 9333)
const theme = process.argv.includes("--theme") ? process.argv[process.argv.indexOf("--theme") + 1] : "dark"

/** File name → preview scene. The READMEs reference these names. */
const SHOTS = [
  ["01-merged-tree.png", "tree"],
  ["02-dsh-session.png", "session"],
  ["03-search-palette.png", "search"],
]

/** A minimal DevTools-protocol client over Node's global WebSocket. */
async function connect(url) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", reject, { once: true })
  })
  let next = 0
  const pending = new Map()
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data))
    const waiter = pending.get(message.id)
    if (waiter === undefined) return
    pending.delete(message.id)
    if (message.error !== undefined) waiter.reject(new Error(message.error.message))
    else waiter.resolve(message.result)
  })
  return {
    send(method, params = {}) {
      next += 1
      const id = next
      socket.send(JSON.stringify({ id, method, params }))
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
    },
    close: () => socket.close(),
  }
}

/** Start headless Chrome and return its first page target plus a stop function. */
async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), "ci-shots-"))
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${String(DEBUG_PORT)}`,
      `--user-data-dir=${profile}`,
      `--window-size=${String(WIDTH)},${String(HEIGHT)}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  )
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await sleep(200)
    try {
      const targets = await (await fetch(`http://127.0.0.1:${String(DEBUG_PORT)}/json/list`)).json()
      const page = targets.find((target) => target.type === "page")
      if (page !== undefined) {
        return {
          page,
          // Chrome keeps writing into its profile until it has exited, so the
          // directory is only removed after the exit event.
          stop: async () => {
            const exited = new Promise((resolve) => chrome.once("exit", resolve))
            chrome.kill()
            await exited
            rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
          },
        }
      }
    } catch {
      // not listening yet
    }
  }
  chrome.kill()
  throw new Error(`Chrome did not open its debugging port (CHROME_PATH=${CHROME})`)
}

/** Navigate to one scene, wait for the page to stage it, capture PNG bytes. */
async function capture(cdp, scene) {
  await cdp.send("Page.navigate", { url: `${ORIGIN}/?theme=${theme}&shot=${scene}` })
  const started = Date.now()
  for (;;) {
    await sleep(250)
    const { result } = await cdp.send("Runtime.evaluate", { expression: "document.title" })
    const title = String(result.value ?? "")
    if (title === "shot:ready") break
    if (title.startsWith("shot:failed:")) throw new Error(`${scene}: ${title.slice("shot:failed:".length)}`)
    if (Date.now() - started > 60_000) throw new Error(`${scene}: page never reported ready`)
  }
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
  return Buffer.from(data, "base64")
}

const stopServer = await ensureServer()
const { page, stop: stopChrome } = await launchChrome()
const cdp = await connect(page.webSocketDebuggerUrl)
try {
  await cdp.send("Page.enable")
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] })
  mkdirSync(OUT, { recursive: true })
  mkdirSync(MIRROR, { recursive: true })
  for (const [file, scene] of SHOTS) {
    const png = await capture(cdp, scene)
    writeFileSync(join(OUT, file), png)
    copyFileSync(join(OUT, file), join(MIRROR, file))
    console.log(`ok  ${file}  (${scene}, ${String(Math.round(png.length / 1024))} KB)`)
  }
} finally {
  cdp.close()
  await stopChrome()
  stopServer()
}
console.log(`wrote ${String(SHOTS.length)} screenshots to ${OUT} (mirrored to ${MIRROR})`)
