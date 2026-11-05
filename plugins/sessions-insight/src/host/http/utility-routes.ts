import type { IncomingMessage } from "node:http"

import type { Settings } from "../../protocol/settings.ts"
import { BALANCE_PATH, VERSION_PATH } from "../../protocol/utilities.ts"
import type { BalanceReadSource } from "../utilities/balance.ts"
import type { VersionChecker } from "../utilities/version.ts"
import { createBalanceRateLimiter, type RateLimiter } from "./rate-limit.ts"
import { route } from "./route-utils.ts"
import { guardRequest, type WebRoute, writeFail, writeJson, writeOk } from "./server.ts"

export interface UtilityRouteDeps {
  balance: BalanceReadSource
  versions: VersionChecker
  settings: () => Settings
  /**
   * Sliding-window limiter for calls that would really reach the provider or
   * the signed-in account. Tests inject one with a fixed clock; production gets
   * one per route table, so the window is process-local and resets on reload.
   */
  balanceLimiter?: RateLimiter
}

/**
 * Whether the request was made from this machine.
 *
 * The balance route returns financial data while the Host web server has no
 * site-wide authentication: bound to a non-loopback address, the same-origin
 * header gate above would let a remote client read it. Loopback is the
 * boundary; an IPv4-mapped IPv6 address counts as its IPv4 address.
 * @param req - the incoming request.
 * @returns true for 127.0.0.0/8, ::1 and ::ffff:127.* sources.
 */
function isLoopback(req: IncomingMessage): boolean {
  const address = req.socket?.remoteAddress?.toLowerCase()
  if (address === undefined) return false
  if (address === "::1") return true
  const ipv4 = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address
  return ipv4.startsWith("127.")
}

export function createUtilityRoutes(deps: UtilityRouteDeps): WebRoute[] {
  const limiter = deps.balanceLimiter ?? createBalanceRateLimiter()
  return [
    {
      kind: "exact",
      path: BALANCE_PATH,
      handler: route(async (req, res, url) => {
        // No HEAD: a probe must never reach the provider, so the method gate answers 405.
        if (!guardRequest(req, res, ["GET"])) return
        if (!isLoopback(req)) {
          writeFail(res, "forbidden", "non-loopback")
          return
        }
        const allowed = ["refresh", "locale", "timezoneOffsetSeconds"]
        const locale = url.searchParams.get("locale") ?? "en-US"
        const rawOffset = url.searchParams.get("timezoneOffsetSeconds") ?? "0"
        const timezoneOffsetSeconds = Number(rawOffset)
        if (
          [...url.searchParams.keys()].some((key) => !allowed.includes(key)) ||
          !/^[a-z]{2,3}(?:-[a-zA-Z]{2,8})?$/.test(locale) ||
          !/^-?\d+$/.test(rawOffset) ||
          !Number.isInteger(timezoneOffsetSeconds) ||
          Math.abs(timezoneOffsetSeconds) > 86400 ||
          (url.searchParams.has("refresh") && url.searchParams.get("refresh") !== "1")
        ) {
          writeFail(res, "bad-request", "invalid-utility-query")
          return
        }
        // The switch only short-circuits an already valid request, so a bad query
        // stays a 400 whether the route is enabled or not.
        if (!deps.settings().deepseekBalance) {
          writeOk(res, { status: "disabled", checkedAt: Date.now() })
          return
        }
        const refresh = url.searchParams.get("refresh") === "1"
        // Cache hits and in-flight reuse reach neither the provider nor the
        // account, so they never spend a slot. A full window answers 429 with
        // `rate-limited` so the caller can retry rather than hammer the provider;
        // the code is route-specific because the shared envelope vocabulary has
        // no generic throttling entry.
        if (!deps.balance.wouldReuse(refresh) && !limiter.take()) {
          writeJson(res, 429, { ok: false, error: "rate-limited", detail: "balance-refresh-limited" })
          return
        }
        writeOk(res, await deps.balance.read({ locale, timezoneOffsetSeconds }, refresh))
      }),
    },
    {
      kind: "exact",
      path: VERSION_PATH,
      handler: route(async (req, res, url) => {
        if (!guardRequest(req, res, ["GET", "HEAD"])) return
        if (
          [...url.searchParams.keys()].some((key) => !["refresh", "check"].includes(key)) ||
          [...url.searchParams.values()].some((value) => value !== "1")
        ) {
          writeFail(res, "bad-request", "invalid-utility-query")
          return
        }
        const manual = url.searchParams.get("check") === "1"
        // Validated before the switch, for the same 400 either way.
        if (!manual && !deps.settings().autoCheckVersion) {
          writeOk(res, { ...deps.versions.peek(), status: "disabled" as const })
          return
        }
        // HEAD is a passive probe, never a network check.
        writeOk(
          res,
          req.method === "HEAD"
            ? deps.versions.peek()
            : await deps.versions.check(manual || url.searchParams.get("refresh") === "1"),
        )
      }),
    },
  ]
}
