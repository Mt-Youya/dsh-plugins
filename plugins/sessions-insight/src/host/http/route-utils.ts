import type { IncomingMessage, ServerResponse } from "node:http"
import type { SourceProblem } from "../../protocol.ts"
import type { SessionSource } from "../sources/source.ts"
import type { RouteHandler } from "./server.ts"
import { requestUrl, writeFail } from "./server.ts"

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function problemOf(source: SessionSource, error: unknown): SourceProblem {
  return { source: source.id, error: "adapter-error", detail: messageOf(error).slice(0, 200) }
}

/** One source's answer, or the failure that replaced it. */
type Sourced<T> = { ok: true; value: T } | { ok: false; problem: SourceProblem }

/**
 * Run one source call, converting a thrown adapter into a problem.
 * @param source - the reader being asked.
 * @param run - the call.
 * @returns the value, or the failure to report.
 */
export async function ask<T>(source: SessionSource, run: () => Promise<T>): Promise<Sourced<T>> {
  try {
    return { ok: true, value: await run() }
  } catch (error) {
    return { ok: false, problem: problemOf(source, error) }
  }
}

/**
 * Wrap an async handler so no branch can escape as a naked exception.
 * @param handler - async handler receiving the parsed URL.
 * @returns the synchronous handler the web server calls.
 */
export function route(handler: (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>): RouteHandler {
  return (req, res) => {
    const url = requestUrl(req)
    void handler(req, res, url).catch((error: unknown) => {
      if (res.headersSent) {
        res.end()
        return
      }
      writeFail(res, "parse-failed", messageOf(error).slice(0, 200))
    })
  }
}
