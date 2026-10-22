/**
 * Host half of the sessions-insight plugin.
 *
 * Runs inside the Host's `node:vm` realm: it registers exact routes on the
 * Host's own web server and owns their response lifecycles. The browser half is
 * a separate entry (`./client`) that reaches these routes over same-origin
 * fetches, so nothing here may assume shared memory with the page.
 *
 * The services this entry touches are typed structurally instead of importing
 * the official client packages: 0.2.1 ships no `.d.ts` for them, and a plugin
 * must not fail to boot against a newer Host because a private type moved (see
 * docs/adr/0002-asar-021-is-the-contract.md).
 *
 * @module @cyrus/dsh-sessions-insight
 */

import type { IncomingMessage, ServerResponse } from "node:http"
import { ClaudeSource } from "./host/sources/claude.ts"
import { CodexSource } from "./host/sources/codex.ts"
import { DshSource } from "./host/sources/dsh.ts"
import type { WebRoute } from "./host/http/server.ts"
import { guardRequest, writeOk } from "./host/http/server.ts"
import { claudeRootFrom, codexRootFrom, dshRootFrom, hostSessionsRoot } from "./host/sources/paths.ts"
import { HandoffRunner } from "./host/handoff/handoff.ts"
import type { SessionCommandsFace } from "./host/handoff/handoff.ts"
import { observeSession } from "./host/sources/dsh-events.ts"
import { createRoutes, type RouteDeps } from "./host/http/routes.ts"
import type { SessionSource } from "./host/sources/source.ts"
import { CONTEXT_SOURCES, HEALTH_PATH, type HealthOk } from "./protocol.ts"
import { PLUGIN_VERSION } from "./version.ts"

export type { RouteHandler, WebRoute } from "./host/http/server.ts"
export { isSameOrigin, statusOf } from "./host/http/server.ts"
export type { RouteDeps } from "./host/http/routes.ts"
export { createRoutes, mergeWorkdirs } from "./host/http/routes.ts"
export { HandoffRunner } from "./host/handoff/handoff.ts"
export type { HandoffDeps, SessionCommandsFace } from "./host/handoff/handoff.ts"
export { observeSession, readSessionEvents } from "./host/sources/dsh-events.ts"
export { extractBrief, NO_RECORD, BRIEF_LIMIT } from "./host/views/brief.ts"
export { PRICING, lookupPrice } from "./host/views/pricing.ts"
export { costOfSession } from "./host/views/cost.ts"
export { searchSessions } from "./host/views/search.ts"
export type { ParsedSession, SearchCandidate, SessionSource, SourceFailure } from "./host/sources/source.ts"
export { cleanTitle, firstInputOf, snippetAround } from "./host/sources/source.ts"
export { ClaudeSource } from "./host/sources/claude.ts"
export { CodexSource } from "./host/sources/codex.ts"
export { DshSource, canonicalDshId, decodeBucketName, readDshHeaderFacts } from "./host/sources/dsh.ts"
export {
  claudeRootFrom,
  codexRootFrom,
  decodeProjectDirName,
  dshRootFrom,
  hostSessionsRoot,
  isWithin,
  resolveInside,
} from "./host/sources/paths.ts"
export { Lru } from "@cyrus/dsh-plugin-kit-host"

/**
 * Version the health route reports; defined once in `src/version.ts` so the
 * route and its test cannot drift from `package.json`.
 */
export { PLUGIN_VERSION } from "./version.ts"

/** Services this entry waits for before `apply` runs. */
export const inject = ["webServer", "sessionController"] as const

/** Structural face of the Host web-server service. */
export interface WebServerFace {
  /**
   * Register a named route.
   * @param route - kind, path, and handler.
   * @returns disposer removing the route.
   */
  register(route: WebRoute): () => void
}

/** Structural face of the Host context this entry needs. */
export interface HostContext {
  /** Browser HTTP carrier; registered routes are reachable at the site root. */
  webServer: WebServerFace
  /**
   * The Host's session controller, declared in `inject` so cordis resolves it
   * before `apply` runs. Handoff uses `sessionController.commands`; a property
   * read without the inject declaration throws ("cannot get property … without
   * inject").
   */
  sessionController?: unknown
  /** Cordis service lookup, kept as a fallback for a lazily-activated gateway. */
  get?: (name: string) => unknown
}

/**
 * Answer the health route: the panel's liveness probe and version handshake.
 * @param req - the incoming request.
 * @param res - the response this handler owns.
 */
export function handleHealth(req: IncomingMessage, res: ServerResponse): void {
  if (!guardRequest(req, res, ["GET", "HEAD"])) return
  const answer: HealthOk = {
    ok: true,
    value: { version: PLUGIN_VERSION, sources: CONTEXT_SOURCES },
  }
  writeOk(res, answer.value)
}

/**
 * Build the three readers for one Host environment.
 * @param env - process environment, so tests and alt installs relocate roots.
 * @returns one reader per source, in CONTEXT_SOURCES order.
 */
export function createSources(env: NodeJS.ProcessEnv = process.env): SessionSource[] {
  return [
    new ClaudeSource({ root: claudeRootFrom(env) }),
    new CodexSource({ root: codexRootFrom(env) }),
    new DshSource({ root: dshRootFrom(env) }),
  ]
}

/**
 * Mount the Host half.
 *
 * The readers are created per fiber, so two Host instances (or a reloaded
 * fiber) never share an LRU, and disposing the routes drops them with the
 * fiber.
 * @param ctx - Host context (service: webServer).
 * @returns disposer releasing every registered route.
 */
export function apply(ctx: HostContext): () => void {
  const sources = createSources()
  const commands = (): SessionCommandsFace | undefined => {
    let controller: unknown
    try {
      controller = ctx.sessionController ?? ctx.get?.("sessionController")
    } catch {
      controller = undefined
    }
    if (controller === undefined) return undefined
    const inner = (controller as { commands?: Partial<SessionCommandsFace> }).commands
    if (inner === undefined) return undefined
    const create = inner.create
    const prompt = inner.prompt
    if (typeof create !== "function" || typeof prompt !== "function") return undefined
    return {
      create: (request) => create.call(inner, request),
      prompt: (request, source) => prompt.call(inner, request, source),
    }
  }
  const observedRoot = hostSessionsRoot()
  const handoff = new HandoffRunner({
    ...(commands() === undefined ? {} : { commands: commands() }),
    observe: (sessionId) => observeSession(observedRoot, sessionId),
  })
  // Warm every reader's directory scan in the background. The first ⌘K, /sources
  // or /workdirs then answers from cache; without this the cold index build
  // (Codex decompresses one frame per rollout) shows up inside the user's first
  // keystroke.
  // Delayed warm-up: the first scan must not run during boot, or a cold start
  // can never be measured (and the panel's first paint waits for three scans).
  // One idle callback later the readers warm themselves for later requests.
  const warm = (): void => {
    void Promise.allSettled(sources.map((source) => source.status()))
  }
  const timer = typeof globalThis.setTimeout === "function" ? globalThis.setTimeout(warm, 5_000) : undefined
  const deps: RouteDeps = { sources, version: PLUGIN_VERSION, handoff }
  const routes: WebRoute[] = [{ kind: "exact", path: HEALTH_PATH, handler: handleHealth }, ...createRoutes(deps)]
  const release = (disposers: readonly (() => void)[]): void => {
    if (timer !== undefined) globalThis.clearTimeout(timer)
    for (const dispose of disposers) dispose()
    for (const source of sources) source.invalidate()
  }
  // All or nothing: cordis only collects the disposer `apply` returns, and the
  // web server's routes are not owned by this fiber. A registration that throws
  // part-way would otherwise leave the earlier routes in the Host's table for
  // the life of the process, and every later start would collide on them.
  const disposers: (() => void)[] = []
  try {
    for (const route of routes) disposers.push(ctx.webServer.register(route))
  } catch (error) {
    release(disposers)
    throw error
  }
  return () => release(disposers)
}
