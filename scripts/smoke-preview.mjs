/**
 * Preview smoke test (ticket 01).
 *
 * The panel is judged by what a browser computes, not by which classes exist:
 * it must mount, list rows, keep rows borderless, keep the user's own words at
 * reading size, and keep the source chip distinguishable from body text — in
 * both colour schemes. The page reports its own measurements under ?probe=1;
 * this script only starts the dev server, reads them, and decides.
 */
import { spawn, spawnSync } from "node:child_process"
import { join } from "node:path"

const ROOT = process.argv[2] ?? "."
const PORT = Number(process.env.PREVIEW_PORT ?? 5178)
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const ORIGIN = `http://localhost:${PORT}`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function reachable() {
  try {
    const response = await fetch(`${ORIGIN}/api/dsh-context-insight/health`, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await reachable()) return undefined
  const child = spawn("npx", ["vite", "--config", "vite.config.ts"], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  })
  child.unref()
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(500)
    if (await reachable()) return child
  }
  throw new Error("preview dev server did not become reachable")
}

function measure(theme) {
  const url = `${ORIGIN}/?theme=${theme}&probe=1`
  const run = spawnSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--virtual-time-budget=8000",
      "--window-size=1280,860",
      "--dump-dom",
      url,
    ],
    { encoding: "utf8", timeout: 60_000 },
  )
  if (run.status !== 0) throw new Error(`chrome exited ${run.status} for ${theme}`)
  const title = run.stdout.match(/<title>([^<]*)<\/title>/)?.[1] ?? ""
  try {
    return JSON.parse(title)
  } catch {
    throw new Error(`preview did not report measurements for ${theme} (title: ${title.slice(0, 80)})`)
  }
}

function judge(theme, probe) {
  const failures = []
  if (probe.mounted !== true) failures.push("panel did not mount")
  if (!(probe.rows >= 3)) failures.push(`expected at least 3 tree rows, saw ${probe.rows}`)
  if (probe.rowBorder !== "0px") failures.push(`tree row kept a border (${probe.rowBorder})`)
  if (probe.askFontSize !== null && probe.askFontSize !== "14.5px") {
    failures.push(`user input is ${probe.askFontSize}, expected 14.5px`)
  }
  if (probe.chipDistinct === false) failures.push("source chip is the same colour as body text")
  return failures.map((line) => `${theme}: ${line}`)
}

const started = await ensureServer()
const failures = []
for (const theme of ["light", "dark"]) failures.push(...judge(theme, measure(theme)))

if (started !== undefined) {
  try {
    process.kill(-started.pid)
  } catch {
    // the dev server was already running under another owner
  }
}

if (failures.length > 0) {
  console.error("preview smoke FAILED")
  for (const line of failures) console.error(" -", line)
  process.exit(1)
}
console.log("preview smoke ok: mounted, rows, borderless, input size, chip contrast (light + dark)")
