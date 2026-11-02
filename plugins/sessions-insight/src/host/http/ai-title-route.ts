import { transferableAbortController } from "node:util"

import { isAiTitleRequest } from "../../protocol/ai-title.ts"
import { AiTitleError, type AiTitleGenerator } from "../management/ai-title.ts"
import { ask, route } from "./route-utils.ts"
import type { RouteDeps } from "./routes.ts"
import type { RouteHandler } from "./server.ts"
import { guardRequest, isJsonContentType, readJsonBody, writeFail, writeOk } from "./server.ts"

/** The intersection stays compatible until the main agent adds RouteDeps.aiTitles. */
export function handleAiTitleSuggest(deps: RouteDeps & { aiTitles?: AiTitleGenerator }): RouteHandler {
  return route(async (req, res) => {
    if (!guardRequest(req, res, ["POST"])) return
    if (!isJsonContentType(req)) {
      writeFail(res, "bad-request", "content-type-json-required")
      return
    }
    const body = await readJsonBody(req)
    if (!isAiTitleRequest(body)) {
      writeFail(res, "bad-request", "invalid-ai-title-request")
      return
    }
    if (deps.aiTitles === undefined) {
      writeFail(res, "source-unavailable", "ai-naming-unavailable")
      return
    }
    const source = deps.sources.find((candidate) => candidate.id === body.source)
    if (source === undefined) {
      writeFail(res, "source-unavailable", "source-not-configured")
      return
    }
    const controller = transferableAbortController()
    const cancel = () => {
      if (!res.writableEnded) controller.abort()
    }
    res.once("close", cancel)
    try {
      const answer = await ask(source, () => source.detail(body.id))
      if (!answer.ok) {
        writeFail(res, "source-unavailable", "adapter-error")
        return
      }
      if (!answer.value.ok) {
        writeFail(res, answer.value.error, answer.value.detail)
        return
      }
      if (res.destroyed) return
      const value = await deps.aiTitles.suggest(body, answer.value.session, controller.signal)
      if (!res.destroyed) writeOk(res, value)
    } catch (error) {
      if (!res.destroyed)
        writeFail(res, "source-unavailable", error instanceof AiTitleError ? error.detail : "ai-naming-unavailable")
    } finally {
      res.removeListener("close", cancel)
    }
  })
}
