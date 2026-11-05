import { Buffer } from "node:buffer"
import { get } from "node:https"
import { setTimeout, clearTimeout } from "node:timers"

import { isPluginName, isUtilityFailureReason, type UtilityFailureReason } from "../../protocol/utilities.ts"

/** No caller-controlled URL, redirects, cookies, body or diagnostic text. */
export const UTILITY_ENDPOINTS = {
  balance: "https://api.deepseek.com/user/balance",
  "@cyrusdoyle/dsh-sessions-insight": "https://registry.npmjs.org/@cyrusdoyle%2Fdsh-sessions-insight/latest",
  "@cyrusdoyle/dsh-plugins": "https://registry.npmjs.org/@cyrusdoyle%2Fdsh-plugins/latest",
} as const
export const UTILITY_TIMEOUT_MS = 8_000
export const BALANCE_TIMEOUT_MS = 30_000
export const UTILITY_MAX_BYTES = 128 * 1024
export type UtilityRequest = (endpoint: keyof typeof UTILITY_ENDPOINTS, key?: string) => Promise<unknown>

/** Fixed message for existing consumers; only a safe code carries diagnostic information. */
export class UtilityRequestError extends Error {
  readonly reason: UtilityFailureReason
  constructor(reason: UtilityFailureReason) {
    super("utility-request-failed")
    this.reason = isUtilityFailureReason(reason) ? reason : "network"
  }
}

export const requestUtilityJson: UtilityRequest = (endpoint, key) =>
  new Promise((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (): void => {
      settled = true
      if (timer !== undefined) clearTimeout(timer)
    }
    const fail = (reason: UtilityFailureReason): void => {
      if (settled) return
      finish()
      reject(new UtilityRequestError(reason))
    }
    if (endpoint !== "balance" && !isPluginName(endpoint)) {
      fail("invalid-response")
      return
    }
    try {
      const request = get(
        UTILITY_ENDPOINTS[endpoint],
        {
          headers: {
            accept: "application/json",
            ...(endpoint === "balance" && key !== undefined ? { authorization: `Bearer ${key}` } : {}),
          },
        },
        (response) => {
          if (response.statusCode !== 200) {
            fail(
              response.statusCode === 401 || response.statusCode === 403
                ? "unauthorized"
                : response.statusCode === 429
                  ? "rate-limited"
                  : "http-error",
            )
            response.destroy()
            request.destroy()
            return
          }
          const chunks: Buffer[] = []
          let bytes = 0
          response.on("data", (chunk: Buffer) => {
            if (settled) return
            bytes += chunk.length
            if (bytes > UTILITY_MAX_BYTES) {
              fail("invalid-response")
              response.destroy()
              request.destroy()
            } else chunks.push(chunk)
          })
          response.on("error", () => fail("network"))
          response.on("aborted", () => fail("network"))
          response.on("close", () => fail("network"))
          response.on("end", () => {
            if (settled) return
            try {
              const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
              finish()
              resolve(value)
            } catch {
              fail("invalid-response")
            }
          })
        },
      )
      // Absolute deadline also bounds DNS/TLS and slow trickle responses.
      timer = setTimeout(
        () => {
          fail("timeout")
          request.destroy()
        },
        endpoint === "balance" ? BALANCE_TIMEOUT_MS : UTILITY_TIMEOUT_MS,
      )
      request.on("error", () => fail("network"))
      request.on("close", () => fail("network"))
    } catch {
      fail("network")
    }
  })

/** Bound Host services too; never relay a provider exception to the browser. */
export async function withUtilityTimeout<T>(
  operation: () => T | Promise<T>,
  timeoutMs = UTILITY_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new UtilityRequestError("timeout")), timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
