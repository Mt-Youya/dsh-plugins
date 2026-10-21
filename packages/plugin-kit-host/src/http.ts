/**
 * HTTP plumbing shared by every route: the same-origin gate, a bounded JSON
 * envelope writer, and query decoding.
 *
 * A route handler owns its response lifecycle — the Host web server does not
 * touch the response after the call — so every branch here writes exactly one
 * and returns.
 *
 * The failure vocabulary is the plugin's, not this module's: a status table is
 * passed in, so `writeFail` maps whatever codes the caller defines without this
 * module importing them.
 *
 * @module @cyrus/dsh-plugin-kit-host/http
 */

import type { IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "node:http"
import type { Envelope } from "@cyrus/dsh-plugin-kit"

/** Route handler shape, as the Host web server calls it. */
export type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void

/**
 * One named route, as `webServer.register` accepts it.
 *
 * A plugin normally registers `exact` paths only: every route is a fixed
 * endpoint, so a prefix mount would hand the same handler arbitrary sub-paths.
 */
export interface WebRoute {
  /** `exact` matches one pathname; `prefix` owns a subtree. */
  kind: "exact" | "prefix"
  /** Pathname, absolute on the site root. */
  path: string
  /** Response owner; the server does not touch the response after the call. */
  handler: RouteHandler
}

/** HTTP status for each failure code the caller defines. */
export type StatusTable<Code extends string> = Readonly<Record<Code, number>>

/**
 * Status one failure code answers with.
 * @param table - the caller's code → status mapping.
 * @param code - a stable failure code.
 * @returns the HTTP status.
 */
export function statusOf<Code extends string>(table: StatusTable<Code>, code: Code): number {
  return table[code]
}

function headerValue(headers: IncomingHttpHeaders, name: keyof IncomingHttpHeaders): string | undefined {
  const raw = headers[name]
  return typeof raw === "string" ? raw : undefined
}

/**
 * Same-origin gate for a plugin's routes.
 *
 * The check is deliberately conservative and header-only: it refuses a
 * `Sec-Fetch-Site: cross-site` request, and refuses an `Origin` that does not
 * match the `Host` the request was addressed to. A same-origin GET carries no
 * `Origin` at all, so an absent header passes — the gate assumes read-only
 * routes on a listener bound to a concrete loopback address.
 *
 * This is a tripwire, not an authority boundary: a non-browser client can forge
 * both headers. Routes that read user data need a credential check on top.
 * @param req - the incoming request.
 * @returns true when the request may proceed.
 */
export function isSameOrigin(req: IncomingMessage): boolean {
  if (headerValue(req.headers, "sec-fetch-site") === "cross-site") return false
  const origin = headerValue(req.headers, "origin")
  if (origin === undefined) return true
  const host = headerValue(req.headers, "host")
  if (host === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * Write one JSON response.
 * @param res - the response this handler owns.
 * @param status - HTTP status.
 * @param body - value to serialize.
 * @param headers - extra headers, applied after the defaults.
 */
export function writeJson(res: ServerResponse, status: number, body: unknown, headers: OutgoingHttpHeaders = {}): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.byteLength(payload)),
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    ...headers,
  })
  res.end(payload)
}

/**
 * Write a success envelope.
 * @param res - the response this handler owns.
 * @param value - payload.
 */
export function writeOk<T>(res: ServerResponse, value: T): void {
  const envelope: Envelope<T> = { ok: true, value }
  writeJson(res, 200, envelope)
}

/**
 * Write a failure envelope at the status its code implies.
 * @param res - the response this handler owns.
 * @param table - the caller's code → status mapping.
 * @param code - stable failure code.
 * @param detail - optional specific; never replaces the code.
 * @param headers - extra headers, e.g. `allow`.
 */
export function writeFail<Code extends string>(
  res: ServerResponse,
  table: StatusTable<Code>,
  code: Code,
  detail?: string,
  headers: OutgoingHttpHeaders = {}
): void {
  const envelope = detail === undefined ? { ok: false, error: code } : { ok: false, error: code, detail }
  writeJson(res, statusOf(table, code), envelope, headers)
}

/** Largest JSON body any POST route accepts. */
export const MAX_BODY_BYTES = 64 * 1024

/**
 * Read a bounded JSON body.
 * @param req - the incoming request.
 * @param maxBytes - cap; a larger body is dropped rather than buffered.
 * @returns the parsed value, or undefined when the body is empty, too large or malformed.
 */
export async function readJsonBody(req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<unknown | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > maxBytes) {
      req.destroy()
      return undefined
    }
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString("utf8")
  if (text.trim() === "") return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/**
 * Whether the request declares a JSON body.
 * @param req - the incoming request.
 */
export function isJsonContentType(req: IncomingMessage): boolean {
  const value = headerValue(req.headers, "content-type")
  return value !== undefined && value.toLowerCase().startsWith("application/json")
}

/**
 * Decode the request URL against a synthetic origin.
 * @param req - the incoming request.
 * @returns the parsed URL; a malformed target degrades to a bare path.
 */
export function requestUrl(req: IncomingMessage): URL {
  try {
    return new URL(req.url ?? "/", "http://127.0.0.1")
  } catch {
    return new URL("http://127.0.0.1/")
  }
}

/** The two refusal codes a method/origin gate answers with. */
export interface RefusalCodes<Code extends string> {
  /** Code for a request that failed the same-origin gate. */
  forbidden: Code
  /** Code for a method the route does not serve. */
  methodNotAllowed: Code
}

/**
 * Gate every route on origin, then on method.
 * @param req - the incoming request.
 * @param res - the response this handler owns.
 * @param allowed - methods the route serves.
 * @param table - the caller's code → status mapping.
 * @param codes - the caller's refusal codes.
 * @returns true when the caller may continue; a refusal has been written.
 */
export function guardRequest<Code extends string>(
  req: IncomingMessage,
  res: ServerResponse,
  allowed: readonly string[],
  table: StatusTable<Code>,
  codes: RefusalCodes<Code>
): boolean {
  if (!isSameOrigin(req)) {
    writeFail(res, table, codes.forbidden, "origin-mismatch")
    return false
  }
  const method = req.method ?? "GET"
  if (!allowed.includes(method)) {
    writeFail(res, table, codes.methodNotAllowed, method, { allow: allowed.join(", ") })
    return false
  }
  return true
}
