import { parseHandoffApply, parseHandoffPrepare, type BriefValue } from "../../protocol.ts"
import { canonicalDshId } from "../sources/dsh.ts"
import { extractBrief } from "../views/brief.ts"
import type { RouteDeps } from "./routes.ts"
import { ask, route } from "./route-utils.ts"
import type { RouteHandler } from "./server.ts"
import { guardRequest, isJsonContentType, readJsonBody, writeFail, writeOk } from "./server.ts"

/**
 * `POST /handoff/prepare`: extract the six-section brief from a session.
 * @param deps - route dependencies.
 * @returns the handler.
 */
export function handleHandoffPrepare(deps: RouteDeps): RouteHandler {
  return route(async (req, res) => {
    if (!guardRequest(req, res, ["POST"])) return
    if (!isJsonContentType(req)) {
      writeFail(res, "bad-request", "content-type-json-required")
      return
    }
    const body = await readJsonBody(req)
    const request = parseHandoffPrepare(body)
    if (request === undefined) {
      writeFail(res, "bad-request", "invalid-handoff-request")
      return
    }
    const reader = deps.sources.find((candidate) => candidate.id === request.source)
    if (reader === undefined) {
      writeFail(res, "source-unavailable", "source-not-configured")
      return
    }
    const answer = await ask(reader, () => reader.detail(request.id))
    if (!answer.ok) {
      writeFail(res, "source-unavailable", answer.problem.detail ?? "adapter-error")
      return
    }
    if (!answer.value.ok) {
      writeFail(res, answer.value.error, answer.value.detail)
      return
    }
    const session = answer.value.session
    if (session.workdir === "") {
      writeFail(res, "bad-request", "workdir-unknown:cwd-must-be-typed")
      return
    }
    const brief = extractBrief(session, request.locale)
    const value: BriefValue = {
      source: reader.id,
      sessionId: session.id,
      workdir: session.workdir,
      turns: session.turns.length,
      defaultCwd: session.workdir,
      brief: brief.text,
      chars: brief.chars,
      sections: brief.sections,
      fileCount: brief.files.length,
      decisionCount: brief.decisionCount,
      openCount: brief.openCount,
      commandCount: brief.commandCount,
    }
    if (session.title !== undefined) value.title = session.title
    writeOk(res, value)
  })
}

/**
 * `POST /handoff/apply`: create the DSH session and queue the brief.
 * @param deps - route dependencies.
 * @returns the handler.
 */
export function handleHandoffApply(deps: RouteDeps): RouteHandler {
  return route(async (req, res) => {
    if (!guardRequest(req, res, ["POST"])) return
    if (!isJsonContentType(req)) {
      writeFail(res, "bad-request", "content-type-json-required")
      return
    }
    const body = await readJsonBody(req)
    const request = parseHandoffApply(body)
    if (request === undefined) {
      writeFail(res, "bad-request", "invalid-handoff-apply")
      return
    }
    if (deps.handoff === undefined) {
      writeFail(res, "handoff-unavailable", "runner-missing")
      return
    }
    const answer = await deps.handoff.apply({
      source: request.source,
      id: request.id,
      cwd: request.cwd,
      brief: request.brief,
      ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }),
    })
    if (!answer.ok) {
      writeFail(res, answer.error, answer.detail)
      return
    }
    writeOk(res, answer.value)
  })
}

/**
 * `GET /handoff/status?sessionId=`: observe until a terminal `turn/end`.
 * @param deps - route dependencies.
 * @returns the handler.
 */
export function handleHandoffStatus(deps: RouteDeps): RouteHandler {
  return route(async (req, res, url) => {
    if (!guardRequest(req, res, ["GET", "HEAD"])) return
    const sessionId = url.searchParams.get("sessionId") ?? ""
    if (sessionId === "") {
      writeFail(res, "bad-request", "sessionId-required")
      return
    }
    if (deps.handoff === undefined) {
      writeFail(res, "handoff-unavailable", "runner-missing")
      return
    }
    const answer = await deps.handoff.status(sessionId)
    if (!answer.ok) {
      writeFail(res, answer.error, answer.detail)
      return
    }
    writeOk(res, answer.value)
  })
}

/** Resolve the authoritative session directory before registering its workspace membership. */
export function handleHandoffReveal(deps: RouteDeps): RouteHandler {
  return route(async (req, res) => {
    if (!guardRequest(req, res, ["POST"])) return
    if (!isJsonContentType(req)) {
      writeFail(res, "bad-request", "content-type-json-required")
      return
    }
    const request = parseHandoffPrepare(await readJsonBody(req))
    if (request === undefined || request.source !== "dsh") {
      writeFail(res, "bad-request", "invalid-handoff-reveal")
      return
    }
    const reader = deps.sources.find((source) => source.id === "dsh")
    if (reader === undefined || deps.handoff === undefined) {
      writeFail(res, "handoff-unavailable", "runner-or-source-missing")
      return
    }
    reader.invalidate()
    const answer = await ask(reader, () => reader.detail(canonicalDshId(request.id)))
    if (!answer.ok) {
      writeFail(res, "source-unavailable", answer.problem.detail ?? "adapter-error")
      return
    }
    if (!answer.value.ok) {
      writeFail(res, answer.value.error, answer.value.detail)
      return
    }
    const result = await deps.handoff.reveal(
      request.id.startsWith("session-") ? request.id : `session-${request.id}`,
      answer.value.session.workdir
    )
    if (!result.ok) {
      writeFail(res, result.error, result.detail)
      return
    }
    writeOk(res, result.value)
  })
}
