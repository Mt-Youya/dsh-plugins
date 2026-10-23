/**
 * Handoff: create a DSH session, deliver the brief, and *observe* what happened.
 *
 * The whole state machine exists because prompting a session only proves the
 * content was queued: the model turn starts afterwards, and a model-side failure
 * (a missing credential, for instance) never appears in the call's reply — it
 * lands in the new session's log (docs/adr/0007-accepted-is-not-success.md). So
 * this runner reports "delivered" after the queue call and only reports success
 * after it has read a `turn/end` whose reason is exactly `completed`.
 *
 * Two in-process faces are used:
 * - `sessionController.commands` creates the session and queues the prompt. This
 *   is the documented in-process entry (docs/HANDOFF.md): parameter names are
 *   **not** wire-mapped, so there is no `args.request` wrapper here.
 * - the session's own log file is read for observation. The gateway's `follow`
 *   stream is peer-scoped and refuses calls made outside a Remote invocation,
 *   while the log is exactly what the status machine needs.
 *
 * @module @cyrus/dsh-sessions-insight/host/handoff
 */

import { handoffProgress } from "./progress.ts"
import { stat } from "node:fs/promises"
import { isAbsolute } from "node:path"
import type { HandoffApplyValue, HandoffStatusValue } from "../../protocol.ts"
import { isSafeId } from "../../protocol.ts"
import type { ObservedEvent } from "../sources/dsh-events.ts"

/** Session creation/queueing, as the in-process controller exposes it. */
export interface SessionCommandsFace {
  /** `sessionController.commands.create`. */
  create(request: { workspaceId: string; sessionId?: string; agentPreset?: string }): Promise<unknown>
  /** `sessionController.commands.prompt(request, source)`. */
  prompt(
    request: {
      requestId: string
      sessionId: string
      mode: "queue"
      content: { type: "text"; text: string }[]
    },
    source: { kind: "user"; rpcId: string }
  ): Promise<unknown>
}

/** A refusal the routes turn into an envelope. */
export interface HandoffFailure {
  ok: false
  error: "bad-request" | "handoff-unavailable" | "not-found"
  detail: string
}

/** What `apply` accepted. */
export interface HandoffApplyInput {
  source: string
  id: string
  cwd: string
  brief: string
  sessionId?: string
}

/** Official workspace creation is idempotent by canonical directory path. */
export interface WorkspaceCommandsFace {
  create(request: { path: string }): Promise<{ workspace: { workspaceId: string } }>
  attach(workspaceId: string, sessionId: string): Promise<void>
}

/** Everything the runner needs from the Host. */
export interface HandoffDeps {
  workspaces?: WorkspaceCommandsFace
  /** In-process session commands; absent when the controller is not mounted. */
  commands?: SessionCommandsFace
  /** Reads the target session's events; absent means status cannot advance. */
  observe?: (sessionId: string) => Promise<ObservedEvent[] | undefined>
  /** Clock override for tests. */
  now?: () => number
}

/** Milliseconds a client should wait before polling again. */
export const HANDOFF_POLL_MS = 600

/** Characters of brief the runner accepts. */
export const HANDOFF_BRIEF_LIMIT = 8_000

/** How many delivered jobs the process remembers. */
const JOB_LIMIT = 64

/** Failure codes a log may carry, with what the reader should do about each. */
const FAILURE_HINTS: Record<string, string> = {
  MISSING_CREDENTIAL:
    "模型侧没有可用凭证（MISSING_CREDENTIAL）：会话已创建、简报已投递，但模型无法启动。到「设置 → 模型」为当前 provider 添加 API Key 后，在该会话里重发一次即可。",
  AUTH_FAILED: "模型侧鉴权失败（AUTH_FAILED）：检查 API Key 是否有效或是否过期。",
  PERMISSION_DENIED: "模型侧权限被拒（PERMISSION_DENIED）：检查该 provider 的访问权限。",
  RATE_LIMITED: "模型侧限流（RATE_LIMITED）：稍后在该会话重发，简报仍在会话历史里。",
  CONTEXT_OVERFLOW: "上下文超限（CONTEXT_OVERFLOW）：简报对目标模型过长，可缩短后重试。",
  TIMEOUT: "模型侧超时（TIMEOUT）：可稍后在该会话重试。",
}

const FAILURE_CODES = Object.keys(FAILURE_HINTS)

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Map one command rejection onto our own codes.
 * @param error - whatever the controller threw.
 * @param phase - which call failed, for the detail.
 */
function mapCallError(error: unknown, phase: "create" | "prompt"): HandoffFailure {
  const message = messageOf(error)
  if (message.includes("session/not-found")) return { ok: false, error: "not-found", detail: "session-not-found" }
  if (message.includes("agent-preset/not-found"))
    return { ok: false, error: "bad-request", detail: "agent-preset-not-found" }
  if (message.includes("bad-request")) return { ok: false, error: "bad-request", detail: `rpc-${phase}-bad-request` }
  return { ok: false, error: "handoff-unavailable", detail: `${phase}: ${message.slice(0, 200)}` }
}

function reasonKind(data: unknown): string | undefined {
  if (!isObject(data)) return undefined
  const reason = data["reason"]
  if (typeof reason === "string") return reason
  if (isObject(reason) && typeof reason["kind"] === "string") return reason["kind"]
  return undefined
}

/** Message patterns that identify a known failure class, checked in order. */
const FAILURE_PATTERNS: { code: string; pattern: RegExp }[] = [
  { code: "MISSING_CREDENTIAL", pattern: /MISSING_CREDENTIAL|no API key|API key for provider|API_KEY (is )?not set/i },
  { code: "AUTH_FAILED", pattern: /AUTH_FAILED|unauthorized|invalid api key|authentication failed|\b401\b/i },
  { code: "PERMISSION_DENIED", pattern: /PERMISSION_DENIED|forbidden|\b403\b/i },
  { code: "RATE_LIMITED", pattern: /RATE_LIMITED|rate limit|too many requests|\b429\b/i },
  { code: "CONTEXT_OVERFLOW", pattern: /CONTEXT_OVERFLOW|context (length|window)|too many tokens/i },
  { code: "TIMEOUT", pattern: /TIMEOUT|timed out|ETIMEDOUT/i },
]

/** First known failure class mentioned in the attempt records of the window. */
function failureCodeOf(events: readonly ObservedEvent[]): string | undefined {
  for (const event of events) {
    if (!event.type.startsWith("assistant/")) continue
    let serialized: string
    try {
      serialized = JSON.stringify(event.data)
    } catch {
      continue
    }
    for (const code of FAILURE_CODES) {
      if (serialized.includes(code)) return code
    }
    for (const { code, pattern } of FAILURE_PATTERNS) {
      if (pattern.test(serialized)) return code
    }
  }
  return undefined
}

/** The Host's own failure sentence, for the detail line. */
function failureMessageOf(events: readonly ObservedEvent[]): string | undefined {
  for (const event of events) {
    if (!event.type.startsWith("assistant/")) continue
    let serialized: string
    try {
      serialized = JSON.stringify(event.data)
    } catch {
      continue
    }
    const match = /"message":\s*"((?:[^"\\]|\\.){0,300})"/.exec(serialized)
    if (match !== null && match[1] !== undefined) return match[1].replace(/\\"/g, '"')
  }
  return undefined
}

/** Handoff runner. One instance per Host fiber. */
export class HandoffRunner {
  readonly #deps: HandoffDeps
  /**
   * Per-session delivery bookkeeping.
   *
   * `baselineSeq` is the log's highest `seq` **before** the prompt was sent, so
   * the observation window is defined by log order rather than by wall clock:
   * the Host emits `turn/start` as soon as it accepts the prompt, which can be
   * the same millisecond we record `deliveredAt` — and a short turn wins that
   * race while a long one loses it and used to stay `delivered` forever.
   */
  readonly #jobs = new Map<string, { baselineSeq: number; deliveredAt: number }>()

  /**
   * @param deps - session commands, log observer and clock.
   */
  constructor(deps: HandoffDeps) {
    this.#deps = deps
  }

  /** Whether every dependency the runner needs is mounted. */
  available(): boolean {
    return this.#deps.commands !== undefined
  }

  #now(): number {
    return this.#deps.now === undefined ? Date.now() : this.#deps.now()
  }

  /**
   * Create the target session and deliver the brief.
   *
   * `cwd` is mandatory: omitting it makes the Host inherit its own launch
   * directory, which silently creates the session under the wrong bucket.
   * @param input - validated request.
   * @returns the new session id and the delivered state, or a refusal.
   */
  async apply(input: HandoffApplyInput): Promise<{ ok: true; value: HandoffApplyValue } | HandoffFailure> {
    const commands = this.#deps.commands
    if (commands === undefined) return { ok: false, error: "handoff-unavailable", detail: "session-controller-missing" }
    const cwd = input.cwd.trim()
    if (cwd === "") return { ok: false, error: "bad-request", detail: "cwd-required" }
    if (!isAbsolute(cwd)) return { ok: false, error: "bad-request", detail: "cwd-not-absolute" }
    try {
      const info = await stat(cwd)
      if (!info.isDirectory()) return { ok: false, error: "bad-request", detail: "cwd-not-a-directory" }
    } catch {
      return { ok: false, error: "bad-request", detail: "cwd-missing" }
    }
    const brief = input.brief.trim()
    if (brief === "") return { ok: false, error: "bad-request", detail: "brief-required" }
    if (brief.length > HANDOFF_BRIEF_LIMIT) return { ok: false, error: "bad-request", detail: "brief-too-long" }
    if (input.sessionId !== undefined && !isSafeId(input.sessionId)) {
      return { ok: false, error: "bad-request", detail: "invalid-session-id" }
    }

    const workspaces = this.#deps.workspaces
    if (workspaces === undefined)
      return { ok: false, error: "handoff-unavailable", detail: "workspace-controller-missing" }
    let workspaceId: string
    try {
      workspaceId = (await workspaces.create({ path: cwd })).workspace.workspaceId
    } catch (error) {
      return { ok: false, error: "handoff-unavailable", detail: `workspace: ${messageOf(error).slice(0, 200)}` }
    }
    let created: unknown
    try {
      const request: { workspaceId: string; sessionId?: string; agentPreset?: string } = { workspaceId }
      if (input.sessionId !== undefined) request.sessionId = input.sessionId
      created = await commands.create(request)
    } catch (error) {
      return mapCallError(error, "create")
    }
    const sessionId = isObject(created) && typeof created["sessionId"] === "string" ? created["sessionId"] : undefined
    if (sessionId === undefined)
      return { ok: false, error: "handoff-unavailable", detail: "create-returned-no-session-id" }

    // Log order, not wall clock, bounds the observation window (see #jobs).
    const baselineSeq = await this.#baselineOf(sessionId)
    const requestId = `handoff-${sessionId}-${String(this.#now())}`
    try {
      await commands.prompt(
        { requestId, sessionId, mode: "queue", content: [{ type: "text", text: brief }] },
        { kind: "user", rpcId: requestId }
      )
    } catch (error) {
      return mapCallError(error, "prompt")
    }

    this.#remember(sessionId, baselineSeq)
    return { ok: true, value: { sessionId, state: "delivered", pollAfterMs: HANDOFF_POLL_MS } }
  }

  /** Make an existing handoff visible without starting or interrupting a turn. */
  async reveal(sessionId: string, cwd: string): Promise<{ ok: true; value: { sessionId: string } } | HandoffFailure> {
    if (!isSafeId(sessionId) || !isAbsolute(cwd))
      return { ok: false, error: "bad-request", detail: "invalid-session-location" }
    const workspaces = this.#deps.workspaces
    if (workspaces === undefined)
      return { ok: false, error: "handoff-unavailable", detail: "workspace-controller-missing" }
    try {
      const { workspace } = await workspaces.create({ path: cwd })
      await workspaces.attach(workspace.workspaceId, sessionId)
      return { ok: true, value: { sessionId } }
    } catch (error) {
      return { ok: false, error: "handoff-unavailable", detail: `workspace: ${messageOf(error).slice(0, 200)}` }
    }
  }

  /**
   * Observe the target session and classify it.
   * @param sessionId - the session the handoff created.
   * @returns delivered / running / succeeded / failed with the evidence.
   */
  async status(sessionId: string): Promise<{ ok: true; value: HandoffStatusValue } | HandoffFailure> {
    if (!isSafeId(sessionId)) return { ok: false, error: "bad-request", detail: "invalid-session-id" }
    const observe = this.#deps.observe
    if (observe === undefined) return { ok: false, error: "handoff-unavailable", detail: "observer-missing" }

    const started = this.#now()
    let events: ObservedEvent[] | undefined
    try {
      events = await observe(sessionId)
    } catch (error) {
      return { ok: false, error: "handoff-unavailable", detail: `observe: ${messageOf(error).slice(0, 200)}` }
    }
    if (events === undefined) {
      // The log is not on disk yet (or already gone): the handoff is still only
      // "delivered" from the caller's point of view.
      return { ok: true, value: { sessionId, state: "delivered", elapsedMs: this.#now() - started } }
    }

    const job = this.#jobs.get(sessionId)
    const baseline = job?.baselineSeq ?? -1
    const elapsedMs = Math.max(
      0,
      this.#now() - (job?.deliveredAt ?? events.find((event) => event.type === "turn/start")?.time ?? started)
    )
    // Log order first. The time fallback only applies when the whole log sits at
    // or below the baseline, i.e. when seq cannot separate old from new.
    const bySeq = events.filter((event) => event.seq > baseline)
    const inWindow = bySeq.length > 0 ? bySeq : events.filter((event) => event.time >= (job?.deliveredAt ?? 0))
    const progress = handoffProgress(inWindow)
    const sawTurnStart = inWindow.some((event) => event.type === "turn/start")
    let turnEnd = inWindow.find((event) => event.type === "turn/end")
    if (turnEnd === undefined) {
      // The Host may fold the boundary onto another record; fall back to the
      // first turn/end that follows the prompt's own user/message.
      const from = events.reduce(
        (last, event, index) => (event.type === "user/message" && event.seq > baseline ? index : last),
        -1
      )
      if (from >= 0) turnEnd = events.slice(from + 1).find((event) => event.type === "turn/end")
    }
    if (turnEnd === undefined) {
      if (!sawTurnStart) {
        return { ok: true, value: { sessionId, state: "delivered", elapsedMs, progress } }
      }
      // A turn has started, so delivery is over: never report "delivered" here.
      // (Previous builds could, when turn/start predated the wall-clock window.)
      return { ok: true, value: { sessionId, state: "running", elapsedMs, progress } }
    }
    const kind = reasonKind(turnEnd.data)
    if (kind === "completed") {
      return { ok: true, value: { sessionId, state: "succeeded", seq: turnEnd.seq, elapsedMs, progress } }
    }
    const code = failureCodeOf(inWindow)
    const reason = code ?? kind ?? "unknown"
    const hint = FAILURE_HINTS[reason] ?? `turn/end reason=${reason}，会话日志里没有已知失败码`
    const raw = failureMessageOf(inWindow)
    const detail = raw === undefined ? hint : `${hint} 原始失败：${raw}`
    return { ok: true, value: { sessionId, state: "failed", reason, seq: turnEnd.seq, detail, elapsedMs, progress } }
  }

  /**
   * Highest `seq` the session already has, -1 when it has none.
   * @param sessionId - the session just created.
   */
  async #baselineOf(sessionId: string): Promise<number> {
    const observe = this.#deps.observe
    if (observe === undefined) return -1
    try {
      const events = await observe(sessionId)
      if (events === undefined || events.length === 0) return -1
      return events.reduce((highest, event) => (event.seq > highest ? event.seq : highest), -1)
    } catch {
      // Observation is best-effort: without it the window starts at the first event.
      return -1
    }
  }

  #remember(sessionId: string, baselineSeq: number): void {
    this.#jobs.set(sessionId, { baselineSeq, deliveredAt: this.#now() })
    while (this.#jobs.size > JOB_LIMIT) {
      const oldest = this.#jobs.keys().next()
      if (oldest.done === true) break
      this.#jobs.delete(oldest.value)
    }
  }
}
