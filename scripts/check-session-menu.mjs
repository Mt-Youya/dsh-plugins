/** Regression check: isolated fixtures, real pointer gestures, keyboard dismissal and computed row styles. */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { CHROME, ORIGIN } from "./preview-server.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const scratch = await mkdtemp(join(tmpdir(), "ci-menu-check-"))
const corpus = join(scratch, "claude", "-tmp-menu")
await mkdir(corpus, { recursive: true })
for (const id of ["s1", "s2"]) {
  const records = [
    {
      type: "user",
      uuid: "u1",
      sessionId: id,
      cwd: "/tmp/menu-check",
      message: { role: "user", content: `Menu ${id}` },
    },
    {
      type: "assistant",
      uuid: "a1",
      sessionId: id,
      cwd: "/tmp/menu-check",
      message: {
        id: "m1",
        role: "assistant",
        model: "claude-test",
        usage: { input_tokens: 100, output_tokens: 10 },
        content: [{ type: "text", text: "Fixture answer" }],
      },
    },
  ]
  await writeFile(join(corpus, `${id}.jsonl`), records.map((record) => JSON.stringify(record)).join("\n") + "\n")
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(read, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await read()) return
    await delay(100)
  }
  throw new Error(`Timed out: ${label}`)
}

let server, chrome, socket
const pending = new Map()
let nextId = 0
function send(method, params = {}) {
  const id = ++nextId
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`DevTools timeout: ${method}`)), 8000)
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      reject,
    })
  })
  socket.send(JSON.stringify({ id, method, params }))
  return result
}
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, userGesture: true })
  assert.equal(response.exceptionDetails, undefined, JSON.stringify(response.exceptionDetails))
  return response.result.value
}
async function press(key, code = key, modifiers = 0) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers })
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers })
}
async function click(selector, button = "left", modifiers = 0) {
  const point = await evaluate(`(() => {
    const box = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  })()`)
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type, ...point, button, modifiers, clickCount: 1 })
  }
}
const opened = () => evaluate('document.querySelectorAll("[data-session-menu]:popover-open").length')

try {
  let occupied = false
  try {
    await fetch(ORIGIN, { signal: AbortSignal.timeout(500) })
    occupied = true
  } catch {
    /* No server yet. */
  }
  assert.equal(occupied, false, `${ORIGIN} is occupied; stop its preview before running this isolated check`)
  server = spawn(join(root, "node_modules/.bin/vite"), ["--config", "apps/preview/vite.config.ts", "--strictPort"], {
    cwd: root,
    stdio: "ignore",
    env: {
      ...process.env,
      DSH_HOME: join(scratch, "dsh-home"),
      DSH_CONTEXT_INSIGHT_CLAUDE_ROOT: join(scratch, "claude"),
      DSH_CONTEXT_INSIGHT_CODEX_ROOT: join(scratch, "codex"),
      DSH_CONTEXT_INSIGHT_DSH_ROOT: join(scratch, "dsh"),
    },
  })
  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--remote-debugging-port=0",
      `--user-data-dir=${join(scratch, "chrome")}`,
      "--window-size=1100,800",
      "about:blank",
    ],
    { stdio: "ignore" }
  )
  await until(async () => {
    try {
      await access(join(scratch, "chrome", "DevToolsActivePort"))
      return true
    } catch {
      return false
    }
  }, "Chrome start")
  const { readFile } = await import("node:fs/promises")
  const port = (await readFile(join(scratch, "chrome", "DevToolsActivePort"), "utf8")).split("\n")[0]
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }))
  socket.addEventListener("message", ({ data }) => {
    const response = JSON.parse(String(data)),
      waiter = pending.get(response.id)
    if (waiter === undefined) return
    pending.delete(response.id)
    if (response.error) waiter.reject(new Error(JSON.stringify(response.error)))
    else waiter.resolve(response.result)
  })
  await send("Page.enable")
  await until(async () => {
    try {
      return (await fetch(`${ORIGIN}/api/dsh-sessions-insight/health`)).ok
    } catch {
      return false
    }
  }, "preview start")

  for (const theme of ["dark", "light"]) {
    await send("Page.navigate", { url: `${ORIGIN}/?theme=${theme}` })
    await until(
      () =>
        evaluate('document.querySelectorAll("[data-key]").length === 2 && !!document.querySelector(".ci-ask__text")'),
      `${theme} rows and detail`
    )
    const styles = await evaluate(`(() => {
      const rows = [...document.querySelectorAll('.ci-row[data-selected="true"]')].map((row) => {
        const style = getComputedStyle(row)
        return { shadow: style.boxShadow, background: style.backgroundColor }
      })
      const ask = getComputedStyle(document.querySelector('.ci-ask__text'))
      return { rows, askLeft: ask.borderLeftWidth, askRight: ask.borderRightWidth }
    })()`)
    assert.equal(styles.rows.length, 2)
    for (const row of styles.rows) {
      assert.equal(row.shadow, "none")
      assert.notEqual(row.background, "rgba(0, 0, 0, 0)")
    }
    assert.equal(styles.askLeft, styles.askRight)
    const first = '[data-key="claude:s1"]',
      second = '[data-key="claude:s2"]'
    await click(first, "right")
    await delay(500) // Assert persistence after the opening right-button release and queued browser events.
    assert.equal(await opened(), 1)
    await press("Escape")
    assert.equal(await opened(), 0)
    assert.equal(await evaluate(`document.activeElement.matches(${JSON.stringify(first)})`), true)
    await click(first, "left", 2) // macOS Control-click.
    await delay(100)
    assert.equal(await opened(), 1)
    await click(second, "right")
    assert.equal(await opened(), 1)
    await until(
      () => evaluate(`document.querySelector(${JSON.stringify(second)}).getAttribute("aria-expanded") === "true"`),
      "second row owns the open menu"
    )
    await click('input[type="search"]')
    assert.equal(await opened(), 0)
    await evaluate(`document.querySelector(${JSON.stringify(first)}).focus()`)
    await press("F10", "F10", 8)
    assert.equal(await opened(), 1)
    await press("Tab")
    assert.equal(await opened(), 0)
    console.log(
      `${theme}: rows have no accent edge; menu survives release, switches rows and dismisses with outside click/Escape/Tab`
    )
  }
} finally {
  socket?.close()
  const children = [chrome, server].filter(Boolean)
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve) => {
          if (child.exitCode !== null) {
            resolve()
            return
          }
          child.once("exit", resolve)
          child.kill()
        })
    )
  )
  await rm(scratch, { recursive: true, force: true, maxRetries: 3 })
}
