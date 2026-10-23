import { isDeleteSessionValue } from "../../protocol.ts"
import type { RouteDeps } from "./routes.ts"
import { clearListCache } from "./list-cache.ts"
import { route } from "./route-utils.ts"
import type { RouteHandler } from "./server.ts"
import { guardRequest, isJsonContentType, readJsonBody, writeFail, writeOk } from "./server.ts"

export function handleDeleteSession(deps: RouteDeps): RouteHandler {
  return route(async (req, res) => {
    if (!guardRequest(req, res, ["POST"])) return
    // Desktop validates dsh-app's origin before stripping Origin and Sec-Fetch-Site in its proxy.
    if (!isJsonContentType(req)) {
      writeFail(res, "bad-request", "content-type-json-required")
      return
    }
    const body = await readJsonBody(req)
    if (!isDeleteSessionValue(body)) {
      writeFail(res, "bad-request", "invalid-session-reference")
      return
    }
    const source = deps.sources.find((candidate) => candidate.id === body.source)
    if (source?.remove === undefined) {
      writeFail(res, "source-unavailable", "session-deletion-unavailable")
      return
    }
    try {
      const answer = await source.remove(body.id)
      if (!answer.ok) {
        writeFail(res, answer.error, answer.detail)
        return
      }
      writeOk(res, body)
    } finally {
      // Partial filesystem failures must also drop old list answers.
      clearListCache(deps)
    }
  })
}
