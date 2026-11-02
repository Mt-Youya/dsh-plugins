import type { SessionMetadataValue } from "../../protocol/management.ts"
import { isMetadataPatch } from "../../protocol/management.ts"
import { cleanTitle } from "../sources/source.ts"
import { ask, route } from "./route-utils.ts"
import type { RouteDeps } from "./routes.ts"
import type { RouteHandler } from "./server.ts"
import { guardRequest, isJsonContentType, readJsonBody, writeFail, writeOk } from "./server.ts"

export function handleSessionMetadata(deps: RouteDeps): RouteHandler {
  return route(async (req, res) => {
    if (!guardRequest(req, res, ["GET", "HEAD", "POST"])) return
    if (deps.metadata === undefined) {
      writeFail(res, "source-unavailable", "session-metadata-unavailable")
      return
    }
    if (req.method !== "POST") {
      writeOk(res, await deps.metadata.read())
      return
    }
    if (!isJsonContentType(req)) {
      writeFail(res, "bad-request", "content-type-json-required")
      return
    }
    const body = await readJsonBody(req)
    if (!isMetadataPatch(body)) {
      writeFail(res, "bad-request", "invalid-metadata-patch")
      return
    }
    const source = deps.sources.find((candidate) => candidate.id === body.source)
    if (source === undefined) {
      writeFail(res, "source-unavailable", "source-not-configured")
      return
    }
    const answer = await ask(source, () => source.detail(body.id))
    if (!answer.ok) {
      writeFail(res, "source-unavailable", answer.problem.detail ?? "adapter-error")
      return
    }
    if (!answer.value.ok) {
      writeFail(res, answer.value.error, answer.value.detail)
      return
    }
    const metadata = await deps.metadata.patch(body)
    const session = answer.value.session
    const displayTitle = metadata.title ?? cleanTitle(session.title, session.id)
    const value: SessionMetadataValue = { metadata }
    if (displayTitle !== undefined) value.displayTitle = displayTitle
    writeOk(res, value)
  })
}
