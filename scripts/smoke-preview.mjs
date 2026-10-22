/**
 * Preview smoke test (ticket 01).
 *
 * The panel is judged by what a browser computes, not by which classes exist:
 * it must mount, list rows, keep rows borderless, keep the user's own words at
 * reading size, and keep the source chip distinguishable from body text — in
 * both colour schemes. The page reports its own measurements under ?probe=1;
 * this script only starts the dev server, reads them, and decides.
 */
import { spawnSync } from "node:child_process"
import { CHROME, ORIGIN, ensureServer } from "./preview-server.mjs"

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
    { encoding: "utf8", timeout: 60_000 }
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

const stop = await ensureServer()
const failures = []
for (const theme of ["light", "dark"]) failures.push(...judge(theme, measure(theme)))
stop()

if (failures.length > 0) {
  console.error("preview smoke FAILED")
  for (const line of failures) console.error(" -", line)
  process.exit(1)
}
console.log("preview smoke ok: mounted, rows, borderless, input size, chip contrast (light + dark)")
