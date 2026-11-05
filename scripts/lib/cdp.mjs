/**
 * The slice of the DevTools protocol the preview scripts share.
 *
 * Chrome is driven over the protocol so a capture happens when the page says
 * it is ready, not after a guessed delay. `connect` is the transport, `until`
 * the polling convention, and `screenshot` the capture both callers need.
 */
import { sleep } from "./preview.mjs"

/**
 * A minimal DevTools-protocol client over Node's global WebSocket.
 *
 * `timeout` bounds each request in milliseconds; 0 waits forever. `onEvent`
 * receives protocol events, which is how the isolated check collects page
 * errors.
 */
export async function connect(url, { timeout = 0, onEvent } = {}) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", reject, { once: true })
  })
  let next = 0
  const pending = new Map()
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data))
    if (message.method !== undefined) onEvent?.(message)
    const waiter = pending.get(message.id)
    if (waiter === undefined) return
    pending.delete(message.id)
    clearTimeout(waiter.timer)
    if (message.error !== undefined) waiter.reject(new Error(message.error.message ?? JSON.stringify(message.error)))
    else waiter.resolve(message.result)
  })
  function send(method, params = {}) {
    next += 1
    const id = next
    const result = new Promise((resolve, reject) => {
      const timer =
        timeout > 0
          ? setTimeout(() => {
              pending.delete(id)
              reject(new Error(`DevTools timeout: ${method}`))
            }, timeout)
          : undefined
      pending.set(id, { resolve, reject, timer })
    })
    socket.send(JSON.stringify({ id, method, params }))
    return result
  }
  async function evaluate(expression) {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true, userGesture: true })
    if (response.exceptionDetails !== undefined) {
      throw new Error(`Runtime.evaluate threw: ${JSON.stringify(response.exceptionDetails)}`)
    }
    return response.result.value
  }
  return { send, evaluate, close: () => socket.close() }
}

/** Poll `read` until it is truthy: 80 attempts, 100ms apart. */
export async function until(read, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await read()) return
    await sleep(100)
  }
  throw new Error(`Timed out: ${label}`)
}

/** Capture the viewport as PNG bytes; extra params go to `Page.captureScreenshot`. */
export async function screenshot(cdp, params = {}) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", ...params })
  return Buffer.from(data, "base64")
}
