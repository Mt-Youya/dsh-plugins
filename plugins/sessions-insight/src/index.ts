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
 * @module @cyrusdoyle/dsh-sessions-insight
 */

import type { IncomingMessage, ServerResponse } from "node:http"

import { readSettings, type SettingsConfig } from "./config.ts"
import { HandoffRunner } from "./host/handoff/handoff.ts"
import type { SessionCommandsFace } from "./host/handoff/handoff.ts"
import { clearListCache, preloadLists } from "./host/http/list-cache.ts"
import { createBalanceRateLimiter } from "./host/http/rate-limit.ts"
import { createRoutes, type RouteDeps } from "./host/http/routes.ts"
import type { WebRoute } from "./host/http/server.ts"
import { guardRequest, writeOk } from "./host/http/server.ts"
import { AiTitleGenerator, type AiTitleHost } from "./host/management/ai-title.ts"
import { SessionMetadataStore } from "./host/management/store.ts"
import { ClaudeSource } from "./host/sources/claude.ts"
import { CodexSource } from "./host/sources/codex.ts"
import { observeSession } from "./host/sources/dsh-events.ts"
import { DshSource } from "./host/sources/dsh.ts"
import { claudeRootFrom, codexRootFrom, dshRootFrom, hostSessionsRoot } from "./host/sources/paths.ts"
import type { SessionSource } from "./host/sources/source.ts"
import { BalanceReader, type UtilityServices } from "./host/utilities/balance.ts"
import { credentialRefFrom } from "./host/utilities/credential-ref.ts"
import { VersionChecker } from "./host/utilities/version.ts"
import { CONTEXT_SOURCES, HEALTH_PATH, type HealthOk } from "./protocol.ts"
import { SETTINGS_PATH } from "./protocol/settings.ts"
import { PLUGIN_VERSION } from "./version.ts"
export { BalanceReader } from "./host/utilities/balance.ts"
export { VersionChecker } from "./host/utilities/version.ts"
export { createUtilityRoutes } from "./host/http/utility-routes.ts"

export { Config, readSettings } from "./config.ts"
export type { SettingsConfig } from "./config.ts"

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
export { AiTitleGenerator } from "./host/management/ai-title.ts"
export { handleAiTitleSuggest } from "./host/http/ai-title-route.ts"
export { SessionMetadataStore, metadataPathFrom } from "./host/management/store.ts"
export type { MetadataStore } from "./host/management/store.ts"
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
export { Lru } from "@cyrusdoyle/dsh-plugin-kit-host"

/**
 * Version the health route reports; defined once in `src/version.ts` so the
 * route and its test cannot drift from `package.json`.
 */
export { PLUGIN_VERSION, PLUGIN_NAME } from "./version.ts"

/** Services this entry waits for before `apply` runs. */
export const inject = ["webServer", "sessionController", "workspaceController", "workspaceRegistry"] as const

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
  effect?: (setup: () => () => void, label?: string) => () => void
  /**
   * The Host's session controller, declared in `inject` so cordis resolves it
   * before `apply` runs. Handoff uses `sessionController.commands`; a property
   * read without the inject declaration throws ("cannot get property … without
   * inject").
   */
  sessionController?: unknown
  workspaceController?: {
    commands: { create(request: { path: string }): Promise<{ workspace: { workspaceId: string } }> }
  }
  workspaceRegistry?: { get(id: string): { attachSession(id: string): Promise<void> } | undefined }
  /** Cordis service lookup, kept as a fallback for a lazily-activated gateway. */
  get?: (name: string) => unknown
  /**
   * Cordis event subscription. `credentials/reference-updated` fires once per
   * committed credential write, with the changed reference as its payload; the
   * returned disposer removes the listener.
   */
  on?: (name: string, listener: (ref: string) => void) => unknown
  /** rc.5 Cordis child fiber: missing model services suspend only this capability. */
  inject?: (
    services: readonly string[],
    callback: (
      ctx: AiTitleHost &
        UtilityServices & {
          effect: (setup: () => () => void, label?: string) => unknown
        },
    ) => void,
  ) => unknown
}

/**
 * Answer the health route: the panel's liveness probe and version handshake.
 * @param req - the incoming request.
 * @param res - the response this handler owns.
 */
/** Read-only route; all mutations and persistence belong to Host configForms. */
export function createSettingsRoute(read: () => ReturnType<typeof readSettings>): WebRoute {
  return {
    kind: "exact",
    path: SETTINGS_PATH,
    handler: (req, res) => {
      if (!guardRequest(req, res, ["GET", "HEAD"])) return
      writeOk(res, read())
    },
  }
}

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
 * Drop the cached balance whenever the Host reports a credential reference
 * change. Writing an API key from the Models page fires this event; without
 * this listener the panel would keep serving the previous failure until the
 * TTL expired, even though the credential already changed.
 * @param ctx - Host context face carrying the event bus.
 * @param balance - reader whose cache follows credential writes.
 * @returns disposer removing the listener; a no-op on a Host without an event bus.
 */
export function watchCredentialUpdates(
  ctx: Pick<HostContext, "on">,
  balance: Pick<BalanceReader, "invalidate">,
): () => void {
  const off = ctx.on?.("credentials/reference-updated", () => balance.invalidate())
  return typeof off === "function" ? (off as () => void) : (): void => {}
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
export function apply(ctx: HostContext, config: SettingsConfig = {}): () => void {
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
    ...(ctx.workspaceController === undefined || ctx.workspaceRegistry === undefined
      ? {}
      : {
          workspaces: {
            create: (request: { path: string }) => ctx.workspaceController!.commands.create(request),
            attach: async (workspaceId: string, sessionId: string) => {
              const workspace = ctx.workspaceRegistry!.get(workspaceId)
              if (workspace === undefined) throw new Error("workspace/not-found")
              await workspace.attachSession(sessionId)
            },
          },
        }),
  })
  let aiHost: AiTitleHost | undefined
  const aiTitles = new AiTitleGenerator(() => aiHost)
  ctx.inject?.(["llm", "agentDefaultModel"], (child) => {
    aiHost = { llm: child.llm, agentDefaultModel: child.agentDefaultModel }
    child.effect(
      () => () => {
        aiHost = undefined
        aiTitles.cancel()
      },
      "sessions-insight: AI title capability",
    )
  })
  let credentials: UtilityServices["credentials"]
  let account: UtilityServices["deepseekAccount"]
  let settings: UtilityServices["settings"]
  const balance = new BalanceReader({
    credentialsSupported: typeof ctx.inject === "function",
    // Re-resolved per read so a renamed `apiKeyEnv` takes effect immediately.
    credentialRef: () => credentialRefFrom(settings),
    credentials: () => credentials,
    account: () => account,
    version: PLUGIN_VERSION,
  })
  ctx.inject?.(["credentials"], (child) => {
    credentials = child.credentials
    balance.invalidate()
    child.effect(
      () => () => {
        credentials = undefined
        balance.invalidate()
      },
      "sessions-insight: credentials capability",
    )
  })
  ctx.inject?.(["deepseekAccount"], (child) => {
    account = child.deepseekAccount
    balance.invalidate()
    child.effect(
      () => () => {
        account = undefined
        balance.invalidate()
      },
      "sessions-insight: account capability",
    )
  })
  // The settings service is how the balance read follows the DeepSeek official
  // adapter's credential reference (`apiKeyEnv`) instead of a hard-coded one.
  // Missing service or entry stays a silent fallback inside `credentialRefFrom`.
  ctx.inject?.(["settings"], (child) => {
    settings = child.settings
    child.effect(
      () => () => {
        settings = undefined
      },
      "sessions-insight: settings capability",
    )
  })
  // The Host fires this after every committed credential write; the listener is
  // released by the same fiber-owned disposer as the routes below.
  const offCredentialUpdates = watchCredentialUpdates(ctx, balance)
  const utilities = {
    balance,
    versions: new VersionChecker(PLUGIN_VERSION),
    settings: () => readSettings(config),
    // One window per mounted plugin fiber: the limit is process-local and does
    // not survive a reload, which is deliberate (no user setting for it).
    balanceLimiter: createBalanceRateLimiter(),
  }
  const deps: RouteDeps & { aiTitles: AiTitleGenerator } = {
    sources,
    version: PLUGIN_VERSION,
    handoff,
    metadata: new SessionMetadataStore(),
    aiTitles,
    utilities,
  }
  const preload = { aborted: false }
  let timer: ReturnType<typeof setTimeout> | undefined
  const routes: WebRoute[] = [
    { kind: "exact", path: HEALTH_PATH, handler: handleHealth },
    createSettingsRoute(() => readSettings(config)),
    ...createRoutes(deps),
  ]
  const release = (disposers: readonly (() => void)[]): void => {
    if (timer !== undefined) globalThis.clearTimeout(timer)
    preload.aborted = true
    aiTitles.dispose()
    offCredentialUpdates()
    balance.invalidate()
    clearListCache(deps)
    for (const dispose of disposers) dispose()
    for (const source of sources) source.invalidate()
  }
  // All or nothing: cordis only collects the disposer `apply` returns, and the
  // web server's routes need explicit fiber ownership. A registration that throws
  // part-way would otherwise leave the earlier routes in the Host's table for
  // the life of the process, and every later start would collide on them.
  const disposers: (() => void)[] = []
  try {
    for (const route of routes) disposers.push(ctx.webServer.register(route))
  } catch (error) {
    release(disposers)
    throw error
  }
  // Yield registration/boot, then warm only the navigation metadata once.
  const warm = (): void => {
    void preloadLists(deps, preload).catch(() => undefined)
  }
  if (typeof globalThis.setTimeout === "function") timer = globalThis.setTimeout(warm, 0)
  else void Promise.resolve().then(warm)
  const dispose = () => release(disposers)
  return ctx.effect === undefined ? dispose : ctx.effect(() => dispose, "sessions-insight: host routes")
}
