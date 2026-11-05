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
      timestamp: "2026-11-02T10:00:00.000Z",
      message: {
        role: "user",
        content: id === "s2" ? "[implement](/skills/implement/SKILL.md) Menu s2" : `Menu ${id}`,
      },
    },
    {
      type: "assistant",
      uuid: "a1",
      timestamp: "2026-11-02T10:00:01.000Z",
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
  await writeFile(join(corpus, `${id}.jsonl`), `${records.map((record) => JSON.stringify(record)).join("\n")}\n`)
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
const browserErrors = []
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
async function press(key, code = key, modifiers = 0, commands) {
  const windowsVirtualKeyCode = { Enter: 13, End: 35, ArrowDown: 40, Escape: 27, Tab: 9, F10: 121, Backspace: 8 }[key]
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers, windowsVirtualKeyCode, commands })
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode })
}
async function click(selector, button = "left", modifiers = 0) {
  const point = await evaluate(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)}), box = target.getBoundingClientRect()
    const y = box.y + box.height / 2
    const x = ${button === "right" || modifiers === 2 ? "[box.x + 8, box.right - 8].find((x) => target.contains(document.elementFromPoint(x, y)))" : "box.x + box.width / 2"}
    if (x === undefined) throw new Error('Click target is obscured: ' + ${JSON.stringify(selector)})
    return { x, y }
  })()`)
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type, ...point, button, modifiers, clickCount: 1 })
  }
}
const opened = () => evaluate('document.querySelectorAll("[data-session-menu]:popover-open").length')
const trigger = '[role="tabpanel"] [data-slot="select-trigger"]'
const dropdown = '[data-slot="select-content"]'
const skillSearch = '[role="tabpanel"] input[type="search"]'
async function checkDropdown(open, label) {
  await until(
    () =>
      evaluate(`(() => {
    const popup = document.querySelector(${JSON.stringify(dropdown)}), button = document.querySelector(${JSON.stringify(trigger)})
    const visible = !!popup?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && popup.getBoundingClientRect().width > 0 && popup.getBoundingClientRect().height > 0
    return button?.getAttribute('aria-expanded') === ${JSON.stringify(String(open))} && visible === ${open}
  })()`),
    label,
  )
}
async function screenshot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png" })
  const path = join("/tmp", `ci-${name}.png`)
  await writeFile(path, Buffer.from(data, "base64"))
  console.log(path)
}
async function checkOverview(label) {
  await until(() => evaluate(`!!document.querySelector('svg[aria-label="当前上下文"]')`), `${label} overview`)
  const report = await evaluate(`(() => {
    const panel = document.querySelector('[role="tabpanel"]')
    const values = ['当前上下文', '累计 token 用量'].map((name) => {
      const chart = panel.querySelector('svg[aria-label="' + name + '"]')
      return chart?.parentElement.querySelector('strong')?.textContent
    })
    const parts = [...panel.querySelectorAll('[role="group"][aria-label="当前上下文归因"] [data-part]')]
    return {
      defaultOverview: document.querySelector('[role="tablist"] button:first-child').getAttribute('aria-selected'),
      values, parts: parts.filter((part) => parseFloat(part.style.width) > 0).length,
      usageSlices: panel.querySelectorAll('svg[aria-label="累计 token 用量"] circle[pathLength]').length,
      text: panel.textContent
    }
  })()`)
  assert.equal(report.defaultOverview, "true", `${label}: overview is the default`)
  assert.deepEqual(report.values, ["100", "110"], `${label}: attribution and usage are nonempty`)
  assert.ok(report.parts > 0, `${label}: attribution has positive chart segments`)
  assert.ok(report.usageSlices > 0, `${label}: usage has chart slices`)
  return report.text
}
async function checkSkills(label) {
  await click('[role="tablist"] button:nth-child(3)')
  await until(
    () =>
      evaluate(
        '[...document.querySelectorAll("[role=tabpanel] h3")].some((heading) => heading.textContent === "implement")',
      ),
    `${label} implement heading`,
  ).catch(async (error) => {
    error.message += `: ${await evaluate('document.querySelector("[role=tabpanel]")?.textContent')} ${JSON.stringify(browserErrors)}`
    throw error
  })
  assert.equal(
    await evaluate('document.querySelector("[role=tabpanel]").textContent.includes("1 个技能 · 1 次加载")'),
    true,
  )
  assert.equal(
    await evaluate(`document.querySelector('[role=meter][aria-label="implement: 1"]').getAttribute('aria-valuenow')`),
    "1",
  )
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(trigger)}).tagName`), "BUTTON")
}
async function checkSkillDropdown(theme) {
  await screenshot(`${theme}-skills`)
  await click(trigger)
  await checkDropdown(true, `${theme} dropdown open`)
  const style = await evaluate(`(() => {
    const menu = document.querySelector(${JSON.stringify(dropdown)})
    const option = menu.querySelector('[role="option"]')
    const box = menu.getBoundingClientRect(), css = getComputedStyle(menu)
    return {
      scoped: !!menu.closest('.ci-panel'), fontSize: getComputedStyle(option).fontSize,
      background: css.backgroundColor, width: box.width, height: box.height,
      inViewport: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight
    }
  })()`)
  await screenshot(`${theme}-skill-dropdown`)
  assert.equal(style.scoped, true, `${theme}: select portal stays under ci-panel; ${JSON.stringify(style)}`)
  assert.equal(style.fontSize, "12px", `${theme}: dropdown option font size`)
  assert.notEqual(style.background, "rgba(0, 0, 0, 0)", `${theme}: dropdown background is opaque`)
  assert.notEqual(style.background, "transparent")
  assert.ok(style.width > 0 && style.height > 0 && style.inViewport, `${theme}: dropdown fits viewport`)
  await press("ArrowDown")
  await press("End")
  await until(() => evaluate('document.activeElement?.textContent === "按最近轮次"'), "latest option focused")
  await press("Enter")
  await checkDropdown(false, "selection closes dropdown")
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(trigger)}).textContent`), "按最近轮次")
  await click(trigger)
  await checkDropdown(true, "reopen dropdown")
  await click('[data-slot="select-content"] [role="option"]:last-child')
  await checkDropdown(false, "pointer selection closes dropdown")
  await click(trigger)
  await checkDropdown(true, "reopen before Escape")
  await press("Escape")
  await checkDropdown(false, "Escape closes dropdown")
  await until(
    () => evaluate(`document.activeElement === document.querySelector(${JSON.stringify(trigger)})`),
    "Escape restores trigger focus",
  )
  await click(trigger)
  await checkDropdown(true, "outside dismissal setup")
  await delay(100) // Allow the opening gesture and outside pointer listener to settle.
  await click('[role="tabpanel"] h3')
  await checkDropdown(false, "outside click closes dropdown")
  await click(skillSearch)
  await send("Input.insertText", { text: "no-such-skill" })
  await until(
    () => evaluate('document.querySelector("[role=tabpanel]").textContent.includes("没有匹配的技能")'),
    "no matching skills",
  )
  assert.equal(await evaluate('document.querySelectorAll("[role=tabpanel] [role=meter]").length'), 0)
  await press("a", "KeyA", 4, ["selectAll"])
  await press("Backspace", "Backspace", 0, ["deleteBackward"])
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(skillSearch)}).value`), "", "search is cleared")
  await until(
    () => evaluate(`!!document.querySelector('[role=meter][aria-label="implement: 1"]')`),
    "clear recovers implement",
  )
}
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
    { stdio: "ignore" },
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
    if (response.method === "Runtime.exceptionThrown") {
      const details = response.params.exceptionDetails
      browserErrors.push(details.exception?.description ?? details.text)
    }
    if (waiter === undefined) return
    pending.delete(response.id)
    if (response.error) waiter.reject(new Error(JSON.stringify(response.error)))
    else waiter.resolve(response.result)
  })
  await send("Page.enable")
  await send("Runtime.enable")
  await until(async () => {
    try {
      return (await fetch(`${ORIGIN}/api/dsh-sessions-insight/health`)).ok
    } catch {
      return false
    }
  }, "preview start")
  await send("Page.navigate", { url: `${ORIGIN}/?theme=light` })
  await until(() => evaluate('!!document.querySelector("[role=tablist]")'), "initial client before old Host reload")
  // Reload clears only client module caches; the same isolated Host and corpus stay alive.
  const { identifier } = await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const originalFetch = window.fetch
      window.oldHostResponses = 0
      window.fetch = async (...args) => {
        const response = await originalFetch(...args)
        const url = new URL(args[0] instanceof Request ? args[0].url : String(args[0]), location.href)
        const list = url.pathname === '/api/dsh-sessions-insight/sessions'
        if (!list && (url.pathname !== '/api/dsh-sessions-insight/session' || url.searchParams.get('id') !== 's2')) return response
        const body = await response.clone().json()
        if (list) {
          const row = body.value.sessions.find((row) => row.id === 's2')
          if (!row.title && !row.firstInput) throw new Error('Expected real named list fixture before stripping')
          delete row.title; delete row.firstInput
          body.value.sessions.sort((a, b) => Number(b.id === 's1') - Number(a.id === 's1'))
          window.untitledLists = (window.untitledLists ?? 0) + 1
        } else {
          if (!body.value.session.firstInput) throw new Error('Expected real first input in detail')
          body.value.session.title = 'Full log title'
          if (window.oldHostResponses === 0) {
            if (body.value?.insights === undefined) throw new Error('Expected real Host insights before stripping')
            delete body.value.insights; window.oldHostResponses += 1
          }
        }
        const headers = new Headers(response.headers)
        headers.delete('content-length')
        return new Response(JSON.stringify(body), { status: response.status, statusText: response.statusText, headers })
      }
    })()`,
  })
  await send("Page.reload", { ignoreCache: true })
  await until(
    () =>
      evaluate(
        `window.oldHostResponses !== undefined && !!document.querySelector('[data-key="claude:s2"]') && !!document.querySelector('[role=tablist]')`,
      ),
    "old Host reload",
  )
  assert.equal(
    await evaluate(`document.querySelector('[data-key="claude:s2"]').title`),
    "未命名会话",
    "s2 is untitled before click",
  )
  assert.equal(await evaluate("window.oldHostResponses"), 0, "s2 detail has not been opened automatically")
  await screenshot("light-untitled-before-detail")
  await click('[data-key="claude:s2"]')
  await until(() => evaluate("window.oldHostResponses === 1"), "one real session response stripped")
  await until(
    () =>
      evaluate(
        `document.querySelector('[data-key="claude:s2"]').title === 'Full log title' && document.querySelector('header h2')?.textContent === 'Full log title'`,
      ),
    "detail promotes visible row and header",
  )
  assert.equal(
    await evaluate(`document.querySelector('[data-key="claude:s2"] > span > span:last-child').textContent`),
    "Full log title",
    "actual row DOM label changes",
  )
  await screenshot("light-learned-title")
  const priorLists = await evaluate("window.untitledLists")
  await click("header button[aria-pressed]")
  await until(() => evaluate('!document.querySelector("aside")'), "title check sidebar unmounted")
  await click("header button[aria-pressed]")
  await until(
    () =>
      evaluate(
        `window.untitledLists > ${priorLists} && document.querySelector('[data-key="claude:s2"]')?.title === 'Full log title'`,
      ),
    "stale untitled list preserves learned row",
  )
  await delay(200)
  assert.deepEqual(
    await evaluate(
      `[document.querySelector('[data-key="claude:s2"] > span > span:last-child').textContent, document.querySelector('header h2').textContent]`,
    ),
    ["Full log title", "Full log title"],
    "stale list cannot overwrite learned DOM title",
  )
  await screenshot("light-learned-title-stale-list")
  const fallback = await checkOverview("old Host")
  assert.ok(fallback.includes("宿主未返回 insights"), "old Host renders client fallback notice")
  await screenshot("light-old-host-overview")
  await checkSkills("old Host")
  assert.equal(await evaluate("window.oldHostResponses"), 1, "fallback reuses the single stripped response")
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier })
  console.log(
    "old Host: untitled s2 learns Full log title and survives stale lists; one stripped response, overview charts and implement recovered",
  )
  const dropdownFailures = []
  for (const theme of ["dark", "light"]) {
    browserErrors.length = 0
    await send("Page.navigate", { url: `${ORIGIN}/?theme=${theme}` })
    await until(
      () =>
        evaluate('document.querySelectorAll("[data-key]").length === 2 && !!document.querySelector("[role=tablist]")'),
      `${theme} rows and detail`,
    )
    await click('[data-key="claude:s2"]')
    await checkOverview(theme)
    await screenshot(`${theme}-overview`)
    await checkSkills(theme)
    await checkSkillDropdown(theme).catch((error) => {
      dropdownFailures.push(error.message)
    })
  }
  assert.deepEqual(dropdownFailures, [], "both themes must pass skill dropdown regression")
  for (const theme of ["dark", "light"]) {
    await send("Page.navigate", { url: `${ORIGIN}/?theme=${theme}` })
    await until(
      () =>
        evaluate('document.querySelectorAll("[data-key]").length === 2 && !!document.querySelector("[role=tablist]")'),
      `${theme} menu rows and detail`,
    )
    await click('[role="tablist"] button:nth-child(2)')
    await until(() => evaluate('!!document.querySelector(".ci-ask__text")'), "turn detail tab")
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
    await evaluate(`(() => {
      const frame = document.createElement('iframe')
      document.body.append(frame)
      window.originalNode = window.Node
      window.Node = frame.contentWindow.Node
      frame.remove()
    })()`)
    await click('input[type="search"]')
    assert.equal(await opened(), 0, "outside dismissal must work across host realms")
    await evaluate("window.Node = window.originalNode; delete window.originalNode")
    await click(first, "right")
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
      "second row owns the open menu",
    )
    await click('input[type="search"]')
    assert.equal(await opened(), 0)
    await evaluate(`document.querySelector(${JSON.stringify(first)}).focus()`)
    await press("F10", "F10", 8)
    assert.equal(await opened(), 1)
    await press("Tab")
    assert.equal(await opened(), 0)
    if (theme === "light") {
      await evaluate(`document.querySelector('aside button').click()`)
      await click(first)
      await click(second)
      assert.equal(
        await evaluate('document.querySelectorAll("aside input[type=checkbox]:checked").length'),
        2,
        "edit mode selects without opening",
      )
      await evaluate(
        `([...document.querySelectorAll('aside footer button')].find((button) => button.textContent === '重命名')).click()`,
      )
      await until(() => evaluate('!!document.querySelector("dialog[open]")'), "rename dialog")
      await evaluate(`(() => {
        const input = document.querySelector('dialog input[aria-label="会话名称：Menu s1"]')
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Renamed fixture')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })()`)
      await click('dialog button[type="submit"]')
      await until(() => evaluate('!document.querySelector("dialog[open]")'), "rename saved")
      assert.equal(
        await evaluate(`document.querySelector(${JSON.stringify(first)}).textContent.includes('Renamed fixture')`),
        true,
        "renaming updates the row",
      )
      await evaluate(
        `([...document.querySelectorAll('aside footer button')].find((button) => button.textContent === '移至分组')).click()`,
      )
      await until(() => evaluate('!!document.querySelector("dialog[open]")'), "group dialog")
      await evaluate(`(() => {
        const input = document.querySelector('dialog input')
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Fixture group')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })()`)
      await click('dialog button[type="submit"]')
      await until(() => evaluate('!document.querySelector("dialog[open]")'), "group saved")
      await evaluate(`document.querySelector('aside button').click()`)
      await evaluate(`(() => {
        window.resumeLists = []
        window.originalFetch = window.fetch
        window.fetch = (...args) => /\\/(sources|workdirs|sessions)\\?/.test(String(args[0]) + '?')
          ? new Promise((resolve) => window.resumeLists.push(() => resolve(window.originalFetch(...args))))
          : window.originalFetch(...args)
      })()`)
      await click("header button[aria-pressed]")
      await until(() => evaluate('!document.querySelector("aside")'), "sidebar unmounted")
      await click("header button[aria-pressed]")
      await until(() => evaluate('!!document.querySelector("aside nav")'), "sidebar remounted")
      assert.equal(
        await evaluate('document.querySelectorAll("[data-key]").length'),
        2,
        "reopened tree paints cached rows before network returns",
      )
      await evaluate("window.fetch = window.originalFetch; window.resumeLists.forEach((resume) => resume())")
      await delay(200)
      await evaluate(`(() => {
        window.listRequests = []
        const originalFetch = window.fetch
        window.fetch = (...args) => {
          const url = String(args[0])
          if (/\\/(sources|workdirs|sessions)\\?/.test(url + '?')) window.listRequests.push(url)
          return originalFetch(...args)
        }
        window.confirm = () => true
        window.keepRow = document.querySelector(${JSON.stringify(second)})
      })()`)
      await click(first, "right")
      await click('[data-session-menu]:popover-open [role="menuitem"]:last-child')
      await until(() => evaluate(`!document.querySelector(${JSON.stringify(first)})`), "deleted row removed")
      assert.deepEqual(await evaluate("window.listRequests"), [], "deletion must not reload directory or session lists")
      assert.equal(await evaluate(`window.keepRow === document.querySelector(${JSON.stringify(second)})`), true)
    }
    console.log(
      `${theme}: rows have no accent edge; menu survives release, switches rows and dismisses with outside click/Escape/Tab`,
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
        }),
    ),
  )
  await rm(scratch, { recursive: true, force: true, maxRetries: 3 })
}
