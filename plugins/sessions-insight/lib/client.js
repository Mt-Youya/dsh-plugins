window.__ModuleLoader__.load({
  id: "@cyrusdoyle/dsh-sessions-insight",
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports

    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })
    const react = require("react")
    const react_jsx_runtime = require("react/jsx-runtime")
    //#region ../../packages/plugin-kit/src/envelope.ts
    function isRecord$1(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value)
    }
    /**
     * Read an envelope without trusting its payload type.
     * @param value - any decoded JSON value.
     * @param guard - payload guard, supplied by the caller that knows the payload.
     * @param codes - the failure codes this caller understands.
     * @param fallback - the code an unrecognised or malformed envelope degrades to.
     * @returns the payload when `ok` and the guard passed, otherwise a failure code.
     */
    function decodeEnvelope(value, guard, codes, fallback) {
      if (!isRecord$1(value))
        return {
          ok: false,
          error: fallback,
          detail: "envelope-not-an-object",
        }
      if (value.ok === true) {
        if (guard(value.value))
          return {
            ok: true,
            value: value.value,
          }
        return {
          ok: false,
          error: fallback,
          detail: "payload-shape",
        }
      }
      if (value.ok === false) {
        const error = typeof value.error === "string" ? value.error : fallback
        const code = codes.includes(error) ? error : fallback
        const detail = typeof value.detail === "string" ? value.detail : void 0
        return detail === void 0
          ? {
              ok: false,
              error: code,
            }
          : {
              ok: false,
              error: code,
              detail,
            }
      }
      return {
        ok: false,
        error: fallback,
        detail: "envelope-without-ok",
      }
    }
    //#endregion
    //#region ../../packages/plugin-kit/src/url.ts
    /**
     * How a plugin route is spelled on the wire.
     *
     * The page carries `<base href="./">` and routes are mounted at the site root,
     * so every request path exists in two spellings: the absolute one the Host
     * registers and the document-relative one the browser fetches. Keeping the
     * conversion here means a plugin defines its paths once and derives the other
     * spelling rather than hand-writing both.
     *
     * @module @cyrusdoyle/dsh-plugin-kit/url
     */
    /**
     * The document-relative spelling of a mount-absolute path.
     * @param path - an absolute route path.
     * @returns the same route without its leading slashes.
     */
    function browserUrl(path) {
      return path.replace(/^\/+/, "")
    }
    //#endregion
    //#region ../../packages/plugin-kit-client/src/fetch.ts
    /**
     * The browser half's only door to the Host.
     *
     * Every answer is decoded through a guard the caller supplies, so a drifted
     * Host produces a typed failure the panel can render instead of a crash deep in
     * a component. URLs are document-relative on purpose: the page carries
     * `<base href="./">` and the routes are mounted at the site root.
     *
     * The failure vocabulary stays the caller's: `codes` names what that plugin can
     * answer with, and anything else degrades to `fallback`.
     *
     * @module @cyrusdoyle/dsh-plugin-kit-client/fetch
     */
    /**
     * Perform one request and decode its envelope.
     * @param request - url, guard, vocabulary and optional body/cancellation.
     * @returns the decoded payload or a classified failure.
     */
    async function requestJson(request) {
      const method = request.method ?? "GET"
      let response
      try {
        response = await fetch(request.url, {
          method,
          signal: request.signal ?? null,
          credentials: "same-origin",
          headers:
            method === "POST"
              ? {
                  accept: "application/json",
                  "content-type": "application/json",
                }
              : { accept: "application/json" },
          ...(request.body === void 0 ? {} : { body: JSON.stringify(request.body) }),
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return {
            ok: false,
            error: "aborted",
          }
        return {
          ok: false,
          error: "network",
        }
      }
      let payload
      try {
        payload = await response.json()
      } catch {
        return {
          ok: false,
          error: "parse-failed",
          detail: "not-json",
          status: response.status,
        }
      }
      const decoded = decodeEnvelope(payload, request.guard, request.codes, request.fallback ?? "parse-failed")
      if (decoded.ok)
        return {
          ok: true,
          value: decoded.value,
        }
      return {
        ok: false,
        error: decoded.error,
        status: response.status,
        ...(decoded.detail === void 0 ? {} : { detail: decoded.detail }),
      }
    }
    //#endregion
    //#region ../../packages/plugin-kit-client/src/register.ts
    /** Default seat names of the web shell's sidebar and layout entries. */
    const DEFAULT_PANEL_SEATS = {
      list: "sidebar.panellist",
      main: "main",
    }
    /**
     * Register the sidebar row and the main-slot page.
     * @param ctx - client root context (service: slots).
     * @param registration - panel id, order, label, icon and page.
     * @returns disposer releasing both registrations.
     */
    function registerPanel(ctx, registration) {
      const slots = ctx.slots
      const seats = registration.seats ?? DEFAULT_PANEL_SEATS
      const disposers = []
      disposers.push(
        slots.inject(seats.list, () =>
          slots.register(
            {
              name: seats.list,
              id: registration.id,
              order: registration.order,
              locale: registration.locale,
              label: registration.label,
            },
            registration.icon,
          ),
        ),
      )
      disposers.push(
        slots.inject(seats.main, () =>
          slots.register(
            {
              name: seats.main,
              key: registration.id,
              locale: registration.locale,
            },
            registration.panel,
          ),
        ),
      )
      return () => {
        for (const dispose of disposers.splice(0)) dispose()
      }
    }
    /**
     * Register one locale namespace and bind it for the module's own translate.
     *
     * Locale is optional on the client root: a failed registration must leave the
     * panel readable rather than take the boot down.
     * @param ctx - client root context (service: locale).
     * @param namespace - namespace the dictionaries belong to.
     * @param dictionaries - locale → (key → text).
     * @param bind - receives the namespace-bound translate.
     */
    function registerLocale(ctx, namespace, dictionaries, bind) {
      try {
        ctx.locale.register(namespace, dictionaries)
        bind(ctx.locale.bind(namespace))
      } catch {}
    }
    //#endregion
    //#region ../../packages/plugin-kit-client/src/styles.ts
    /**
     * One stylesheet per plugin, injected once per page.
     *
     * The shell loads a plugin's browser half as a module factory, so the only
     * place a style element may be created is inside that factory (a side effect at
     * module scope would run before the factory is ever called). Injection is
     * idempotent by element id: a duplicated factory run must not stack copies.
     *
     * @module @cyrusdoyle/dsh-plugin-kit-client/styles
     */
    /**
     * Create one style element per page, refreshing its CSS after a plugin reload.
     * @param id - element id the plugin owns.
     * @param css - compiled stylesheet text.
     * @returns nothing; a document without a head (tests, SSR) is left alone.
     */
    function injectStylesOnce(id, css) {
      if (typeof document === "undefined") return
      const existing = document.getElementById(id)
      if (existing !== null) {
        if (existing.textContent !== css) existing.textContent = css
        return
      }
      const style = document.createElement("style")
      style.id = id
      style.textContent = css
      document.head.append(style)
    }
    //#endregion
    //#region src/protocol/paths.ts
    /**
     * Route paths this plugin owns.
     *
     * The Host owns every projection of the IR; the browser only decodes. Route
     * paths are the one part of the wire nobody else can name, so they stay here;
     * the IR, the payload types and their guards come from
     * `@cyrusdoyle/dsh-session-contract`, and the document-relative spelling comes from
     * `@cyrusdoyle/dsh-plugin-kit`.
     *
     * Rules that shaped this file (docs/API.md):
     * - every number travels as a `Measure`, never as a bare token count;
     * - errors are stable string codes, never exceptions;
     * - a source that cannot answer says `available:false` with a reason instead
     *   of failing the whole page.
     *
     * @module @cyrusdoyle/dsh-sessions-insight/protocol/paths
     */
    /** Root every route hangs off. The listener mounts it at the site root. */
    const API_ROOT = "/api/dsh-sessions-insight"
    /** Liveness and version handshake (M1). */
    const HEALTH_PATH = `${API_ROOT}/health`
    /** Per-source availability, root, session count, last scan. */
    const SOURCES_PATH = `${API_ROOT}/sources`
    /** Workdir aggregation: the navigation axis. */
    const WORKDIRS_PATH = `${API_ROOT}/workdirs`
    /** Light session list for one workdir: header + mtime only, no body parse. */
    const SESSIONS_PATH = `${API_ROOT}/sessions`
    /** One session's IR, paged by turn. */
    const SESSION_PATH = `${API_ROOT}/session`
    /** Full-text search across every readable source. */
    const SEARCH_PATH = `${API_ROOT}/search`
    /** Build the handoff brief for one session (POST). */
    const HANDOFF_PREPARE_PATH = `${API_ROOT}/handoff/prepare`
    /** Create a DSH session and deliver the brief (POST). */
    const HANDOFF_APPLY_PATH = `${API_ROOT}/handoff/apply`
    /** Observe a delivered handoff (GET). */
    const HANDOFF_STATUS_PATH = `${API_ROOT}/handoff/status`
    /** Per-session cost from the price table (GET). */
    const COST_PATH = `${API_ROOT}/cost`
    browserUrl(HEALTH_PATH)
    /** Sources, spelled for the browser. */
    const SOURCES_URL = browserUrl(SOURCES_PATH)
    /** Workdirs, spelled for the browser. */
    const WORKDIRS_URL = browserUrl(WORKDIRS_PATH)
    /** Sessions, spelled for the browser. */
    const SESSIONS_URL = browserUrl(SESSIONS_PATH)
    /** One session, spelled for the browser. */
    const SESSION_URL = browserUrl(SESSION_PATH)
    /** Search, spelled for the browser. */
    const SEARCH_URL = browserUrl(SEARCH_PATH)
    /** Handoff brief, spelled for the browser. */
    const HANDOFF_PREPARE_URL = browserUrl(HANDOFF_PREPARE_PATH)
    /** Handoff apply, spelled for the browser. */
    const HANDOFF_APPLY_URL = browserUrl(HANDOFF_APPLY_PATH)
    /** Handoff status, spelled for the browser. */
    const HANDOFF_STATUS_URL = browserUrl(HANDOFF_STATUS_PATH)
    /** Cost, spelled for the browser. */
    const COST_URL = browserUrl(COST_PATH)
    const SESSION_DELETE_URL = browserUrl(`${API_ROOT}/session/delete`)
    const HANDOFF_REVEAL_URL = browserUrl(`${API_ROOT}/handoff/reveal`)
    const SESSION_METADATA_URL = browserUrl(`${API_ROOT}/session/metadata`)
    function hasShape$1(value, keys) {
      return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).every((key) => keys.includes(key))
      )
    }
    function isText(value) {
      return typeof value === "string" && value.trim().length > 0 && value.length <= 80
    }
    function isReference(value) {
      return isDeleteSessionValue(value)
    }
    function isSessionMetadata(value) {
      return (
        hasShape$1(value, ["source", "id", "title", "group"]) &&
        isReference(value) &&
        (!("title" in value) || isText(value["title"])) &&
        (!("group" in value) || isText(value["group"]))
      )
    }
    function isMetadataValue(value) {
      if (!hasShape$1(value, ["entries"]) || !Array.isArray(value["entries"])) return false
      const keys = /* @__PURE__ */ new Set()
      for (const entry of value["entries"]) {
        if (!isSessionMetadata(entry)) return false
        const key = `${entry.source}:${entry.id}`
        if (keys.has(key)) return false
        keys.add(key)
      }
      return true
    }
    function isSessionMetadataValue(value) {
      return (
        hasShape$1(value, ["metadata", "displayTitle"]) &&
        isSessionMetadata(value["metadata"]) &&
        (!("displayTitle" in value) || typeof value["displayTitle"] === "string")
      )
    }
    //#endregion
    //#region ../../packages/session-contract/src/types.ts
    /** Every announced source, in the order the panel renders them. */
    const CONTEXT_SOURCES = ["claude", "dsh", "codex"]
    /** Every failure code, as one list the decoders can check membership against. */
    const API_ERROR_CODES = [
      "bad-request",
      "method-not-allowed",
      "forbidden",
      "not-found",
      "read-limit",
      "parse-failed",
      "source-unavailable",
      "handoff-unavailable",
    ]
    //#endregion
    //#region ../../packages/session-contract/src/guards/shared.ts
    /**
     * Primitives every decoder in this folder shares.
     *
     * Object shape, finite numbers and string arrays: the checks each view guard
     * would otherwise repeat.
     *
     * @module @cyrusdoyle/dsh-session-contract/guards/shared
     */
    function isRecord(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value)
    }
    function isNumber(value) {
      return typeof value === "number" && Number.isFinite(value)
    }
    function isStringArray(value) {
      return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    }
    //#endregion
    //#region ../../packages/session-contract/src/guards/attribution.ts
    const PRECISIONS = /* @__PURE__ */ new Set(["exact", "estimate"])
    const BASES = /* @__PURE__ */ new Set([
      "usage",
      "harness-projection",
      "chars-per-token",
      "byte-length",
      "unattributed",
    ])
    /** Context parts, duplicated from the IR as a closed set for the guard. */
    const PARTS = /* @__PURE__ */ new Set([
      "system-prompt",
      "tool-definitions",
      "memory-instructions",
      "referenced-files",
      "history",
      "tool-results",
      "images",
      "user-input",
      "assistant-output",
      "thinking",
    ])
    /**
     * Whether a wire value is a well-formed measure.
     * @param value - any decoded JSON value.
     * @returns true when tokens is finite and both tags are known. Negative tokens
     *   are legal: a residual is `total − Σparts` and can run either way.
     */
    function isMeasure(value) {
      if (!isRecord(value)) return false
      const { tokens, precision, basis } = value
      return typeof tokens === "number" && Number.isFinite(tokens) && PRECISIONS.has(precision) && BASES.has(basis)
    }
    /**
     * Whether a wire value is a well-formed attribution.
     * @param value - any decoded JSON value.
     * @returns true for a total, at least zero parts, and optional residual/factor.
     */
    function isAttribution(value) {
      if (!isRecord(value)) return false
      if (!isMeasure(value.total)) return false
      if (value.windowSize !== void 0 && (typeof value.windowSize !== "number" || !Number.isFinite(value.windowSize)))
        return false
      const parts = value.parts
      if (!Array.isArray(parts)) return false
      for (const slice of parts) {
        if (!isRecord(slice)) return false
        if (!PARTS.has(slice.part)) return false
        if (!isMeasure(slice.measure)) return false
      }
      if (value.residual !== void 0 && !isMeasure(value.residual)) return false
      if (value.reconciled !== void 0) {
        if (!isRecord(value.reconciled)) return false
        const factor = value.reconciled.factor
        if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0) return false
      }
      return true
    }
    //#endregion
    //#region ../../packages/session-contract/src/guards/cost.ts
    /**
     * The `/cost` contract: priced turns, price tables and the reference column.
     *
     * @module @cyrusdoyle/dsh-session-contract/guards/cost
     */
    /**
     * Whether a wire value is a well-formed cost answer.
     * @param value - any decoded JSON value.
     */
    function isCostValue(value) {
      if (!isRecord(value)) return false
      if (!CONTEXT_SOURCES.includes(value.source)) return false
      if (typeof value.sessionId !== "string") return false
      const pricing = value.pricing
      if (!isRecord(pricing) || typeof pricing.version !== "string" || typeof pricing.asOf !== "string") return false
      const totals = value.totals
      if (!isRecord(totals)) return false
      if (totals.usd !== null && !isNumber(totals.usd)) return false
      if (!isNumber(totals.pricedTurns) || !isNumber(totals.unpricedTurns)) return false
      if (!Array.isArray(value.unpricedModels) || !isStringArray(value.unpricedModels)) return false
      if (!Array.isArray(value.provisionalModels) || !isStringArray(value.provisionalModels)) return false
      if (typeof value.provisional !== "boolean") return false
      if (value.partial !== void 0 && typeof value.partial !== "boolean") return false
      if (value.unlistedChannels !== void 0 && !isStringArray(value.unlistedChannels)) return false
      if (!Array.isArray(value.turns)) return false
      if (
        !value.turns.every(
          (turn) =>
            isRecord(turn) &&
            isNumber(turn.index) &&
            typeof turn.priced === "boolean" &&
            (turn.usd === null || isNumber(turn.usd)),
        )
      )
        return false
      if (value.tableId !== void 0 && value.tableId !== null && typeof value.tableId !== "string") return false
      if (value.tables === void 0) return true
      if (!isRecord(value.tables)) return false
      return Object.values(value.tables).every(
        (table) =>
          isRecord(table) &&
          typeof table.id === "string" &&
          isRecord(table.byCurrency) &&
          typeof table.partial === "boolean" &&
          Array.isArray(table.turns),
      )
    }
    //#endregion
    //#region ../../packages/session-contract/src/guards/ids.ts
    /**
     * Guards for values that arrive as strings but have to be an identifier.
     *
     * @module @cyrusdoyle/dsh-session-contract/guards/ids
     */
    /**
     * Whether a value is an identifier this plugin hands to the filesystem.
     *
     * Deliberately a whitelist, not a "reject dots" check: a session id is a uuid,
     * and anything else (a path, an encoded separator, a dot segment) is refused
     * before it can reach `join`.
     * @param value - candidate id.
     * @returns true for `[A-Za-z0-9._-]` of length 1..128 that is not a dot segment.
     */
    function isSafeId(value) {
      if (value.length === 0 || value.length > 128) return false
      if (!/^[A-Za-z0-9._-]+$/.test(value)) return false
      return value !== "." && value !== ".."
    }
    //#endregion
    //#region ../../packages/session-contract/src/guards/sources.ts
    /**
     * The source vocabulary and the answers built on it: which sources exist, and
     * whether they are healthy.
     *
     * @module @cyrusdoyle/dsh-session-contract/guards/sources
     */
    /**
     * Whether a value is a well-formed sources answer.
     * @param value - any decoded JSON value.
     * @returns true when every entry names a source and its availability.
     */
    function isSourcesValue(value) {
      if (!isRecord(value) || !Array.isArray(value.sources)) return false
      return value.sources.every((entry) => {
        if (!isRecord(entry)) return false
        if (!CONTEXT_SOURCES.includes(entry.source)) return false
        if (typeof entry.available !== "boolean") return false
        if (entry.reason !== void 0 && typeof entry.reason !== "string") return false
        if (entry.root !== void 0 && typeof entry.root !== "string") return false
        return true
      })
    }
    /**
     * Whether a wire value names a known source.
     * @param value - any decoded JSON value.
     * @returns true when the value is a member of {@link CONTEXT_SOURCES}.
     */
    function isContextSource(value) {
      return value === "claude" || value === "dsh" || value === "codex"
    }
    //#endregion
    //#region ../../packages/session-contract/src/guards/handoff.ts
    /**
     * The handoff contract: the prepared brief, the apply/status answers and the
     * two request bodies the Host decodes.
     *
     * @module @cyrusdoyle/dsh-session-contract/guards/handoff
     */
    /**
     * Whether a wire value is a well-formed brief answer.
     * @param value - any decoded JSON value.
     */
    function isBriefValue(value) {
      if (!isRecord(value)) return false
      if (!CONTEXT_SOURCES.includes(value.source)) return false
      if (typeof value.sessionId !== "string" || typeof value.workdir !== "string") return false
      if (typeof value.brief !== "string" || typeof value.defaultCwd !== "string") return false
      if (!isNumber(value.chars) || !isNumber(value.turns)) return false
      if (!Array.isArray(value.sections)) return false
      return value.sections.every(
        (section) =>
          isRecord(section) &&
          typeof section.title === "string" &&
          isStringArray(section.lines) &&
          typeof section.empty === "boolean",
      )
    }
    /**
     * Whether a wire value is a well-formed handoff apply answer.
     * @param value - any decoded JSON value.
     */
    function isHandoffApplyValue(value) {
      if (!isRecord(value)) return false
      return typeof value.sessionId === "string" && value.state === "delivered" && isNumber(value.pollAfterMs)
    }
    /**
     * Whether a wire value is a well-formed handoff status answer.
     * @param value - any decoded JSON value.
     */
    function isHandoffStatusValue(value) {
      if (!isRecord(value)) return false
      if (typeof value.sessionId !== "string") return false
      if (
        value.state !== "delivered" &&
        value.state !== "running" &&
        value.state !== "succeeded" &&
        value.state !== "failed"
      )
        return false
      if (!isNumber(value.elapsedMs)) return false
      if (value.progress !== void 0) {
        const progress = value.progress
        if (
          !isRecord(progress) ||
          !isNumber(progress.seq) ||
          !isNumber(progress.updatedAt) ||
          !isNumber(progress.toolsCompleted)
        )
          return false
        if (progress.tool !== void 0 && typeof progress.tool !== "string") return false
      }
      if (value.reason !== void 0 && typeof value.reason !== "string") return false
      if (value.detail !== void 0 && typeof value.detail !== "string") return false
      if (value.seq !== void 0 && !isNumber(value.seq)) return false
      return true
    }
    function isHandoffRevealValue(value) {
      return isRecord(value) && typeof value.sessionId === "string" && isSafeId(value.sessionId)
    }
    //#endregion
    //#region ../../packages/session-contract/src/guards/search.ts
    /**
     * The `/search` contract: paging, both tiers, and the guards for a hit page.
     *
     * @module @cyrusdoyle/dsh-session-contract/guards/search
     */
    /**
     * Whether a wire value is a well-formed search hit.
     * @param value - any decoded JSON value.
     * @returns true when every field the panel renders is present and typed.
     */
    function isSearchHit(value) {
      if (!isRecord(value)) return false
      if (!CONTEXT_SOURCES.includes(value.source)) return false
      if (typeof value.sessionId !== "string" || typeof value.workdir !== "string") return false
      if (!isNumber(value.turnIndex) || !isNumber(value.at)) return false
      if (value.field !== "user" && value.field !== "assistant" && value.field !== "tool" && value.field !== "metadata")
        return false
      if (value.tier !== "fast" && value.tier !== "deep") return false
      if (typeof value.snippet !== "string") return false
      if (value.title !== void 0 && typeof value.title !== "string") return false
      if (value.firstInput !== void 0 && typeof value.firstInput !== "string") return false
      return true
    }
    /**
     * Whether a wire value is a well-formed search answer.
     * @param value - any decoded JSON value.
     * @returns true when the counters and every hit pass their guards.
     */
    function isSearchValue(value) {
      if (!isRecord(value)) return false
      if (typeof value.query !== "string") return false
      if (!isNumber(value.scanned) || !isNumber(value.remaining) || !isNumber(value.elapsedMs)) return false
      if (typeof value.truncated !== "boolean") return false
      if (!Array.isArray(value.hits) || !value.hits.every(isSearchHit)) return false
      if (!Array.isArray(value.failures)) return false
      return value.failures.every(
        (entry) => isRecord(entry) && CONTEXT_SOURCES.includes(entry.source) && typeof entry.error === "string",
      )
    }
    //#endregion
    //#region ../../packages/session-contract/src/guards/turns.ts
    function isUsage(value) {
      if (!isRecord(value)) return false
      return (
        isNumber(value.input) &&
        isNumber(value.cacheRead) &&
        isNumber(value.cacheWrite) &&
        isNumber(value.output) &&
        isNumber(value.totalContext)
      )
    }
    function isCompaction(value) {
      if (!isRecord(value)) return false
      return (
        isNumber(value.at) &&
        isMeasure(value.before) &&
        isMeasure(value.after) &&
        typeof value.replacedHistory === "boolean"
      )
    }
    /**
     * Whether a wire value is a well-formed turn.
     * @param value - any decoded JSON value.
     * @returns true when the fields the panel renders are all present and typed.
     */
    function isTurn(value) {
      if (!isRecord(value)) return false
      if (!isNumber(value.index) || !isNumber(value.startedAt)) return false
      if (!isStringArray(value.userInput) || !isStringArray(value.assistantText)) return false
      if (!isStringArray(value.subagents)) return false
      if (!isAttribution(value.attribution)) return false
      if (!Array.isArray(value.toolCalls) || !Array.isArray(value.compactions)) return false
      if (!value.compactions.every(isCompaction)) return false
      if (value.usage !== void 0 && !isUsage(value.usage)) return false
      return true
    }
    //#endregion
    //#region ../../packages/session-contract/src/guards/session.ts
    /**
     * Guards for the session inventory views: one session's detail page, the
     * workdir roll-up and the session list.
     *
     * @module @cyrusdoyle/dsh-session-contract/guards/session
     */
    /**
     * Whether a wire value is a well-formed session detail page.
     * @param value - any decoded JSON value.
     * @returns true when the pager fields and every turn pass their guards.
     */
    function isSessionDetail(value) {
      if (!isRecord(value)) return false
      if (!isNumber(value.turnCount) || !isNumber(value.offset) || !isNumber(value.limit)) return false
      const meta = value.meta
      if (!isRecord(meta) || typeof meta.cached !== "boolean" || !isNumber(meta.elapsedMs) || !isNumber(meta.bytes))
        return false
      const session = value.session
      if (!isRecord(session)) return false
      if (typeof session.id !== "string" || typeof session.workdir !== "string") return false
      if (!CONTEXT_SOURCES.includes(session.source)) return false
      if (!isNumber(session.createdAt) || !isNumber(session.updatedAt)) return false
      if (!isStringArray(session.dataQuality)) return false
      if (!Array.isArray(session.segments)) return false
      if (!Array.isArray(session.turns) || !session.turns.every(isTurn)) return false
      return true
    }
    /**
     * Whether a value is a well-formed workdirs answer.
     * @param value - any decoded JSON value.
     * @returns true when every row has a workdir, counts and source groups.
     */
    function isWorkdirsValue(value) {
      if (!isRecord(value) || !isNumber(value.scannedAt)) return false
      if (!Array.isArray(value.workdirs)) return false
      return value.workdirs.every((row) => {
        if (!isRecord(row)) return false
        if (typeof row.workdir !== "string" || !isNumber(row.sessions) || !isNumber(row.lastUpdatedAt)) return false
        if (!Array.isArray(row.sources)) return false
        return row.sources.every(
          (group) =>
            isRecord(group) &&
            CONTEXT_SOURCES.includes(group.source) &&
            isNumber(group.sessions) &&
            isNumber(group.lastUpdatedAt),
        )
      })
    }
    /**
     * Whether a value is a well-formed sessions answer.
     * @param value - any decoded JSON value.
     * @returns true when every row carries its source badge facts.
     */
    function isSessionsValue(value) {
      if (!isRecord(value) || typeof value.workdir !== "string") return false
      if (!Array.isArray(value.sessions)) return false
      return value.sessions.every((row) => {
        if (!isRecord(row)) return false
        if (typeof row.id !== "string" || typeof row.workdir !== "string") return false
        if (!CONTEXT_SOURCES.includes(row.source)) return false
        if (!isNumber(row.updatedAt) || !isNumber(row.bytes)) return false
        if (!isStringArray(row.dataQuality)) return false
        if (row.title !== void 0 && typeof row.title !== "string") return false
        return true
      })
    }
    //#endregion
    //#region ../../packages/session-contract/src/guards/deletion.ts
    function isDeleteSessionValue(value) {
      return (
        isRecord(value) && isContextSource(value["source"]) && typeof value["id"] === "string" && isSafeId(value["id"])
      )
    }
    function isInsightSessionDetail(value) {
      return isSessionDetail(value) && (!("insights" in value) || isSessionInsights(value.insights))
    }
    function record(value) {
      return value !== null && typeof value === "object" && !Array.isArray(value)
    }
    function number(value) {
      return typeof value === "number" && Number.isFinite(value) && value >= 0
    }
    function count(value) {
      return number(value) && Number.isInteger(value)
    }
    function index(value) {
      return count(value) && value > 0
    }
    function optionalTime(value) {
      return value === void 0 || (number(value) && value > 0)
    }
    function optionalPath(value) {
      return value === void 0 || (typeof value === "string" && value.length > 0)
    }
    function nullableNumber(value) {
      return value === null || number(value)
    }
    function isSkillEvidence(value) {
      return (
        record(value) &&
        index(value.turnIndex) &&
        typeof value.toolCallId === "string" &&
        value.toolCallId.length > 0 &&
        (value.kind === "skill-tool" || value.kind === "skill-file") &&
        typeof value.name === "string" &&
        value.name.length > 0 &&
        optionalPath(value.path) &&
        optionalTime(value.time)
      )
    }
    function isSkillInsight(value) {
      if (
        !record(value) ||
        typeof value.id !== "string" ||
        value.id.length === 0 ||
        typeof value.name !== "string" ||
        value.name.length === 0 ||
        !optionalPath(value.path) ||
        !index(value.count) ||
        !index(value.lastTurnIndex) ||
        !optionalTime(value.lastTime) ||
        !Array.isArray(value.evidence) ||
        !value.evidence.every(isSkillEvidence)
      )
        return false
      const lastTurnIndex = value.evidence.reduce((last, item) => Math.max(last, item.turnIndex), 0)
      const lastTime = value.evidence.reduce(
        (last, item) => (item.time === void 0 ? last : Math.max(last ?? item.time, item.time)),
        void 0,
      )
      return (
        value.id === (value.path === void 0 ? `name:${value.name}` : `path:${value.path}`) &&
        value.count === value.evidence.length &&
        value.evidence.every((item) => item.name === value.name && item.path === value.path) &&
        value.lastTurnIndex === lastTurnIndex &&
        value.lastTime === lastTime &&
        new Set(value.evidence.map((item) => item.toolCallId)).size === value.count
      )
    }
    function isInsightUsage(value) {
      if (!record(value) || !count(value.coveredTurns) || !count(value.missingTurns)) return false
      const buckets = [value.input, value.cacheRead, value.cacheWrite, value.output]
      return value.coveredTurns === 0 ? buckets.every((item) => item === null) : buckets.every(number)
    }
    function isInsightTiming(value) {
      if (!record(value)) return false
      return (
        nullableNumber(value.spanMs) &&
        optionalTime(value.startedAt) &&
        optionalTime(value.endedAt) &&
        nullableNumber(value.completedTurnMs) &&
        count(value.completedTurns) &&
        count(value.missingTurnDurations) &&
        nullableNumber(value.toolUnionMs) &&
        count(value.timedToolCalls) &&
        count(value.missingToolDurations) &&
        (value.completedTurns === 0 ? value.completedTurnMs === null : number(value.completedTurnMs)) &&
        (value.timedToolCalls === 0 ? value.toolUnionMs === null : number(value.toolUnionMs)) &&
        (value.spanMs === null
          ? value.startedAt === void 0 && value.endedAt === void 0
          : number(value.startedAt) && number(value.endedAt) && value.endedAt - value.startedAt === value.spanMs)
      )
    }
    function isInsightMessage(value) {
      return (
        record(value) &&
        (value.role === "user" || value.role === "assistant") &&
        typeof value.text === "string" &&
        value.text.trim().length > 0 &&
        (value.text.length <= 500 || (value.text.length === 501 && value.text.endsWith("…"))) &&
        index(value.turnIndex) &&
        optionalTime(value.time)
      )
    }
    function isInsightAttribution(value) {
      return (
        record(value) &&
        index(value.turnIndex) &&
        isAttribution(value.attribution) &&
        value.attribution.total.tokens > 0
      )
    }
    function isInsightPeak(value) {
      return record(value) && index(value.turnIndex) && isMeasure(value.measure) && value.measure.tokens > 0
    }
    function isSessionInsights(value) {
      if (!record(value) || !count(value.turnCount) || !count(value.toolCalls) || !count(value.compactions))
        return false
      if (value.currentAttribution !== null && !isInsightAttribution(value.currentAttribution)) return false
      if (value.peak !== null && !isInsightPeak(value.peak)) return false
      if (
        !isInsightUsage(value.usage) ||
        !isInsightTiming(value.timing) ||
        (value.lastMessage !== null && !isInsightMessage(value.lastMessage)) ||
        !Array.isArray(value.skills) ||
        !value.skills.every(isSkillInsight)
      )
        return false
      const { turnCount, timing } = value
      const inRange = (turnIndex) => turnIndex <= turnCount
      const inSpan = (time) =>
        time === void 0 || (timing.spanMs !== null && time >= timing.startedAt && time <= timing.endedAt)
      const evidence = value.skills.flatMap((skill) => skill.evidence)
      return (
        (value.currentAttribution === null
          ? value.peak === null
          : value.peak !== null &&
            inRange(value.currentAttribution.turnIndex) &&
            value.peak.turnIndex <= value.currentAttribution.turnIndex &&
            value.peak.measure.tokens >= value.currentAttribution.attribution.total.tokens) &&
        (value.peak === null || inRange(value.peak.turnIndex)) &&
        (value.lastMessage === null || (inRange(value.lastMessage.turnIndex) && inSpan(value.lastMessage.time))) &&
        evidence.every((item) => inRange(item.turnIndex) && inSpan(item.time)) &&
        new Set(evidence.map((item) => item.toolCallId)).size === evidence.length &&
        evidence.length <= value.toolCalls &&
        (value.timing.toolUnionMs === null ||
          (value.timing.spanMs !== null && value.timing.toolUnionMs <= value.timing.spanMs)) &&
        value.usage.coveredTurns + value.usage.missingTurns === value.turnCount &&
        value.timing.completedTurns + value.timing.missingTurnDurations === value.turnCount &&
        value.timing.timedToolCalls + value.timing.missingToolDurations === value.toolCalls &&
        new Set(value.skills.map((skill) => skill.id)).size === value.skills.length
      )
    }
    const SESSION_AI_TITLE_URL = browserUrl(`${API_ROOT}/session/title/suggest`)
    function hasShape(value, keys) {
      return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).every((key) => keys.includes(key))
      )
    }
    function isAiTitleValue(value) {
      return (
        hasShape(value, ["source", "id", "title", "provider", "model"]) &&
        isDeleteSessionValue(value) &&
        typeof value["title"] === "string" &&
        value["title"].trim() === value["title"] &&
        value["title"].length > 0 &&
        value["title"].length <= 80 &&
        !/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u.test(value["title"]) &&
        typeof value["provider"] === "string" &&
        value["provider"].trim().length > 0 &&
        typeof value["model"] === "string" &&
        value["model"].trim().length > 0
      )
    }
    //#endregion
    //#region src/client/insight-dictionaries.ts
    /** Merge these dictionaries into the plugin locale without changing shared IR. */
    const INSIGHT_ZH = {
      "insights.tabs": "会话视图",
      "insights.overview": "概览",
      "insights.turns": "轮次",
      "insights.skills": "技能",
      "insights.unrecorded": "未记录 · 未知",
      "insights.current": "当前上下文",
      "insights.currentNote": "最后有效归因：第 {index} 轮",
      "insights.windowUnknown": "窗口大小未记录 · 占比未知",
      "insights.window": "占窗口 {share}",
      "insights.usage": "累计 token 用量",
      "insights.usageNote": "累计计费用量，不是上下文构成之和",
      "insights.input": "输入（非缓存）",
      "insights.cacheRead": "缓存读取",
      "insights.cacheWrite": "缓存写入",
      "insights.output": "输出",
      "insights.coverage": "{covered} 轮有用量记录 · {missing} 轮未记录（未知）",
      "insights.composition": "当前上下文归因",
      "insights.turnCount": "全会话轮次",
      "insights.toolCalls": "工具调用",
      "insights.compactions": "压缩点",
      "insights.span": "会话记录跨度",
      "insights.completedDuration": "已完成轮次记录时长（累计）",
      "insights.toolDuration": "工具记录时长（区间并集）",
      "insights.durationCoverage": "{covered} 条有区间记录 · {missing} 条未记录（未知）",
      "insights.durationNote": "跨度包括间隔；轮次累计可重叠，工具时长已合并并行区间。剩余时间不代表模型思考。",
      "insights.lastMessage": "最后一条消息",
      "insights.user": "用户",
      "insights.assistant": "助手",
      "insights.jump": "定位第 {index} 轮",
      "insights.searchSkills": "搜索技能名称或路径",
      "insights.sortSkills": "技能排序",
      "insights.byCount": "按次数",
      "insights.byRecent": "按最近轮次",
      "insights.noSkills": "没有匹配的显式技能证据",
      "insights.skillNote": "仅统计 Skill 调用与读取 SKILL.md 的工具证据；不是可用技能列表，也不推断技能已成功执行。",
      "insights.skillCount": "{count} 次",
      "insights.skill-tool": "显式 Skill 调用",
      "insights.skill-file": "读取 SKILL.md",
      "insights.evidence": "具体证据",
    }
    const INSIGHT_EN = {
      "insights.tabs": "Session views",
      "insights.overview": "Overview",
      "insights.turns": "Turns",
      "insights.skills": "Skills",
      "insights.unrecorded": "Not recorded · unknown",
      "insights.current": "Current context",
      "insights.currentNote": "Last valid attribution: turn {index}",
      "insights.windowUnknown": "Window not recorded · share unknown",
      "insights.window": "{share} of window",
      "insights.usage": "Cumulative token usage",
      "insights.usageNote": "Cumulative billing usage, not the sum of context slices",
      "insights.input": "Input (uncached)",
      "insights.cacheRead": "Cache read",
      "insights.cacheWrite": "Cache write",
      "insights.output": "Output",
      "insights.coverage": "{covered} turns with usage · {missing} not recorded (unknown)",
      "insights.composition": "Current context attribution",
      "insights.turnCount": "Full-session turns",
      "insights.toolCalls": "Tool calls",
      "insights.compactions": "Compactions",
      "insights.span": "Recorded session span",
      "insights.completedDuration": "Recorded completed-turn duration (sum)",
      "insights.toolDuration": "Recorded tool duration (interval union)",
      "insights.durationCoverage": "{covered} recorded intervals · {missing} not recorded (unknown)",
      "insights.durationNote":
        "Span includes gaps; summed turn durations may overlap. Parallel tool intervals are merged. Remaining time does not represent model thinking.",
      "insights.lastMessage": "Last message",
      "insights.user": "User",
      "insights.assistant": "Assistant",
      "insights.jump": "Go to turn {index}",
      "insights.searchSkills": "Search skill name or path",
      "insights.sortSkills": "Sort skills",
      "insights.byCount": "By count",
      "insights.byRecent": "By latest turn",
      "insights.noSkills": "No matching explicit skill evidence",
      "insights.skillNote":
        "Only Skill invocations and tools reading SKILL.md count. This is not an available-skills list or proof of successful execution.",
      "insights.skillCount": "{count} calls",
      "insights.skill-tool": "Explicit Skill invocation",
      "insights.skill-file": "Read SKILL.md",
      "insights.evidence": "Evidence",
    }
    //#endregion
    //#region src/client/management-labels.ts
    const MANAGEMENT_ZH = {
      "management.edit": "编辑",
      "management.done": "完成",
      "management.selectVisible": "选择可见会话",
      "management.clear": "清空选择",
      "management.selectDirectory": "选择目录全部已加载 {count} 条",
      "management.selected": "已选择 {count} 条",
      "management.rename": "重命名",
      "management.aiRename": "AI 命名",
      "management.aiSuggest": "生成 AI 建议",
      "management.aiConfirm":
        "将为 {count} 条会话发送少量用户输入给当前默认模型以生成名称，会产生模型调用费用。是否继续？",
      "management.aiSkipped": "跳过 {count} 条已命名会话",
      "management.aiProgress": "AI 建议：已处理 {done} / {total} 条",
      "management.aiStop": "停止生成",
      "management.aiPending": "尚未生成建议；编辑名称或重试后可保存此项。",
      "management.aiHint": "建议仅填入草稿，可编辑；保存只提交已生成或明确编辑的名称。",
      "management.aiUnavailable": "AI 命名接口尚未连接",
      "management.move": "移至分组",
      "management.delete": "删除",
      "management.deleteConfirm": "确定删除 {count} 条会话？这会永久删除原始日志，无法撤销。",
      "management.cancel": "取消",
      "management.save": "保存",
      "management.saving": "处理中…",
      "management.restore": "恢复原名称",
      "management.name": "会话名称：{title}",
      "management.group": "分组（可输入新名称或选择已有分组）",
      "management.ungroup": "移出分组",
      "management.allGroups": "所有分组 / 工作目录",
      "management.ungrouped": "未分组",
      "management.groupFilter": "筛选分组",
      "management.failure": "{title}：{reason}",
      "management.retry": "重试失败项",
      "management.unavailable": "会话管理接口尚未连接",
      "management.loading": "正在读取会话管理信息…",
      "management.groupHint": "分组仅保存在插件元数据中，不会改变工作目录。",
    }
    const MANAGEMENT_EN = {
      "management.edit": "Edit",
      "management.done": "Done",
      "management.selectVisible": "Select visible sessions",
      "management.clear": "Clear selection",
      "management.selectDirectory": "Select all {count} loaded sessions in directory",
      "management.selected": "{count} selected",
      "management.rename": "Rename",
      "management.aiRename": "AI naming",
      "management.aiSuggest": "Generate AI suggestion",
      "management.aiConfirm":
        "Send a small amount of user input from {count} sessions to the current default model to suggest names? Model calls will incur charges.",
      "management.aiSkipped": "Skipped {count} already named sessions",
      "management.aiProgress": "AI suggestions: {done} / {total} processed",
      "management.aiStop": "Stop generation",
      "management.aiPending": "No suggestion yet; edit the name or retry to save this item.",
      "management.aiHint":
        "Suggestions are editable drafts only. Save submits generated or explicitly edited names only.",
      "management.aiUnavailable": "AI naming API is not connected yet",
      "management.move": "Move to group",
      "management.delete": "Delete",
      "management.deleteConfirm":
        "Delete {count} sessions? Original logs will be permanently deleted. This cannot be undone.",
      "management.cancel": "Cancel",
      "management.save": "Save",
      "management.saving": "Processing…",
      "management.restore": "Restore original name",
      "management.name": "Session name: {title}",
      "management.group": "Group (enter a new name or choose an existing group)",
      "management.ungroup": "Remove from group",
      "management.allGroups": "All groups / working directories",
      "management.ungrouped": "Ungrouped",
      "management.groupFilter": "Filter by group",
      "management.failure": "{title}: {reason}",
      "management.retry": "Retry failed items",
      "management.unavailable": "Session management API is not connected yet",
      "management.loading": "Loading session management metadata…",
      "management.groupHint": "Groups are plugin metadata only; working directories remain unchanged.",
    }
    //#endregion
    //#region src/client/locale.ts
    /**
     * Browser-half copy of the sessions-insight panel.
     *
     * The dictionaries are the source of truth for the namespace this plugin owns;
     * the sidebar label is a thunk over {@link t} so the shell re-resolves it on
     * every language change, and the module-level translate keeps plain callers
     * (outside React) following the same setting.
     *
     * Wording follows GLOSSARY.md: 轮次 / 压缩点 / 子代理会话 / 估算口径.
     *
     * @module @cyrusdoyle/dsh-sessions-insight/client/locale
     */
    /** Locale namespace this plugin owns. */
    const LOCALE_NS = "sessions-insight"
    /** Chinese dictionary; the default language. */
    const zh = {
      ...INSIGHT_ZH,
      ...MANAGEMENT_ZH,
      "entry.label": "会话洞察",
      "toolbar.sidebar": "显示/隐藏项目栏",
      "search.trigger": "搜索会话与轮次…",
      "tree.filter": "筛选项目",
      "tree.noMatch": "没有路径包含「{query}」的项目。",
      "sessions.pick": "从左侧选一个会话",
      "sessions.pickHint": "展开项目，点开任一会话，就能看到它每一轮实际喂给模型的上下文。",
      "stats.current": "当前上下文",
      "stats.noWindow": "日志未记录窗口大小",
      "stats.windowShare": "占窗口 {share} · {size}",
      "stats.peak": "峰值",
      "stats.peakAt": "出现在第 {index} 轮",
      "stats.turns": "轮次",
      "stats.compactionsLine": "{count} 个压缩点 · {tools} 次工具调用",
      "stats.loaded": "已加载 {count} 轮",
      "stats.cost": "花费",
      "stats.costPending": "价格计算中或未覆盖",
      "stats.costPriced": "按价格表逐轮计价",
      "stats.reconciledTurns": "{count} 轮按系数缩放过",
      "detail.composition": "上下文构成",
      "turns.noInput": "（本轮无用户输入）",
      "waterfall.hint": "点任一点跳到该轮",
      "list.refreshing": "刷新中…",
      "tree.title": "项目",
      "tree.loadingIndex": "正在读取三源会话索引…",
      "tree.emptyAll": "三个来源都还没有可读的会话。检查 DSH / Claude / Codex 目录是否存在，或点右上角「刷新」。",
      "tree.showAll": "显示全部 {count} 条",
      "sessions.untitled": "未命名会话",
      "sessions.actions": "会话操作",
      "sessions.delete": "删除会话",
      "sessions.deleteConfirm": "确定删除「{title}」？这会永久删除该会话的原始日志，无法撤销。",
      "sessions.deleteFailed": "删除失败：{detail}",
      "sessions.deleteShared": "此会话与其他 Codex 会话共用日志，无法安全删除。",
      "handoff.waiting": "正在等待你的回答，请打开 DSH 会话继续",
      "handoff.openExisting": "在 DSH 中打开",
      "handoff.language": "zh",
      "handoff.openSession": "打开 DSH 新会话",
      "handoff.openFailed": "无法打开会话：{detail}",
      "handoff.progress": "已运行 {seconds} 秒 · 已完成 {count} 次工具调用",
      "handoff.tool": "正在执行工具：{tool}",
      "handoff.thinking": "模型正在处理，等待下一条执行记录",
      "handoff.updated": "最近活动：{time}",
      "handoff.pollError": "进度读取失败，正在重试：{detail}",
      "handoff.button": "交接给 DSH",
      "handoff.title": "交接给 DSH",
      "handoff.preparing": "正在生成简报…",
      "handoff.cwd": "新会话的工作目录",
      "handoff.cwdHint": "必须显式指定：省略会让 DSH 继承自己的启动目录，把会话建到错误的桶里。",
      "handoff.brief": "简报（6 段，可在投递前编辑）",
      "handoff.files": "{count} 个文件",
      "handoff.decisions": "{count} 条决策",
      "handoff.open": "{count} 条未决",
      "handoff.commands": "{count} 条验证命令",
      "handoff.chars": "{count} 字",
      "handoff.apply": "投递到 DSH",
      "handoff.applying": "正在投递…",
      "handoff.polish": "用模型润色",
      "handoff.polishUnavailable": "本次交接使用规则抽取；模型润色尚未接通",
      "handoff.applyFailed": "投递失败：{detail}",
      "handoff.state.delivered": "已投递，等待模型响应",
      "handoff.state.running": "模型正在运行",
      "handoff.state.succeeded": "交接成功（已观察到 turn/end）",
      "handoff.state.failed": "交接失败",
      "handoff.polling": "每 600ms 轮询该会话日志，直到出现 turn/end 才判定结果",
      "handoff.reason": "失败原因：{reason}",
      "handoff.evidence": "证据：turn/end seq={seq}",
      "handoff.close": "关闭",
      "cost.total": "合计 {usd}",
      "cost.unpriced": "{count} 轮未覆盖价格",
      "cost.null": "—",
      "cost.tip": "价格表 {version} · 数据截至 {asOf} · {currency}；未覆盖模型显示 —",
      "cost.turnTip": "第 {index} 轮 · {model} · cache 命中 {rate}",
      "cost.provisional": "预览价",
      "cost.reference": "参考 {amount}",
      "cost.partialPrefix": "≥",
      "cost.noConvert": "两张表不做汇率换算，也不相加",
      "cost.tableLine": "{id}：{source} · 数据截至 {asOf}",
      "cost.unlistedTip": "未列价通道：{channels}",
      "cost.provisionalTip":
        "该模型的部分费率是推导值（cached 输入价由折扣规则推算、cacheWrite 按 1.25×input），不是官方单列价格；来源为 GPT-5.6 预览价汇总。",
      "search.tier.fast": "快搜（元数据）",
      "search.tier.deep": "深搜（正文）",
      "search.enterDeep": "Enter 深搜",
      "search.continue": "继续扫描剩余 {count} 个",
      "search.deepMeta": "深搜：扫过 {scanned} · 剩余 {remaining}",
      "search.fastMeta": "快搜：已扫全部 {scanned} 个会话",
      "session.untitled": "未命名会话",
      "session.firstInput": "首条输入",
      "sessions.headerHint": "列表仅读文件头，点开才解析",
      "compactions.count": "{count} 个压缩点",
      "compactions.range": "{before} → {after}",
      "compactions.list": "逐个展开前后对比",
      "search.title": "搜索会话",
      "search.placeholder": "搜索轮次正文…（Esc 关闭）",
      "search.empty": "没有命中。",
      "search.hint": "输入后即搜；↑↓ 选择，Enter 跳转到该轮",
      "search.scanning": "正在扫描…",
      "search.meta": "扫过 {scanned} 个会话，用时 {elapsed} ms",
      "search.truncated": "预算内未扫完，还剩 {remaining} 个会话",
      "search.complete": "已扫完 {scanned} 个会话",
      "search.open": "搜索（⌘K）",
      "search.failures": "{count} 个来源失败",
      "search.result": "{workdir} · 第 {turn} 轮",
      "search.jump": "跳转到该轮",
      "panel.refresh": "刷新",
      "panel.loading": "正在读取宿主数据…",
      "panel.retry": "重试",
      "panel.updated": "更新于 {time}",
      "sources.title": "来源",
      "sources.available": "可读",
      "sources.unavailable": "不可用",
      "sources.sessions": "{count} 个会话",
      "sources.reason.adapter-pending": "适配器尚未就绪",
      "sources.reason.root-missing": "根目录不存在",
      "sources.reason.root-unreadable": "根目录不可读",
      "sources.reason.adapter-error": "适配器异常",
      "workdirs.title": "工作目录",
      "workdirs.empty": "未发现任何 Claude 会话。",
      "workdirs.unknown": "（未知工作目录）",
      "workdirs.undecoded": "路径由目录名反解",
      "sessions.title": "会话",
      "sessions.empty": "该工作目录下没有会话。",
      "sessions.unparsed": "未解析",
      "sessions.turns": "{count} 轮",
      "session.loading": "正在解析会话…",
      "session.error": "读取失败：{detail}",
      "session.paging": "第 {from}–{to} 轮，共 {total} 轮",
      "session.loadMore": "加载更多轮次",
      "session.loadingMore": "正在加载…",
      "session.noTurns": "这个会话没有可解析的轮次。",
      "session.noTurnsHint": "文件存在但没有任何用户输入与 usage 记录，因此无法画出上下文构成。",
      "session.quality": "数据质量",
      "session.turnCount": "{count} 轮",
      "turns.title": "轮次上下文构成",
      "turns.hint": "每轮一行；点开可看分区数字与工具调用。",
      "turns.unknown": "未知",
      "turns.unknownNote": "无法归因的缺口，未摊入任何已知类别",
      "turns.overCounted": "估算合计超过精确总量 {tokens}",
      "turns.normalizedByParts": "该轮没有 usage：条形按分区估算归一",
      "turns.total": "总量",
      "turns.window": "窗口 {size}",
      "turns.reconciled": "已按系数 {factor} 缩放",
      "turns.notReconciled": "未缩放，缺口单列",
      "turns.compaction": "压缩点",
      "turns.compactionTransition": "{before} → {after}",
      "turns.compactionReplaced": "历史被替换",
      "turns.compactionContinued": "历史由摘要接续",
      "turns.tools": "工具调用",
      "turns.subagents": "子代理会话",
      "turns.noTools": "本轮没有工具调用。",
      "turns.noSubagents": "本轮没有记录到子代理会话。",
      "turns.selected": "第 {index} 轮",
      "waterfall.title": "累计水位",
      "waterfall.caption": "每轮的总上下文；竖虚线是压缩点",
      "waterfall.peak": "峰值 {tokens}",
      "precision.exact": "精确",
      "precision.estimate": "估算",
      "basis.usage": "日志 usage",
      "basis.chars-per-token": "字符折算",
      "basis.harness-projection": "宿投影",
      "basis.byte-length": "字节长度",
      "basis.unattributed": "不可归因缺口",
      "basis.tip.chars-per-token": "系数：文本 {text} 字/token，CJK {cjk}，schema {schema}",
      "basis.tip.usage": "直接读自日志的 usage，不是估算",
      "basis.tip.harness-projection": "图片按 {px} 像素/token 投影",
      "basis.tip.byte-length": "按字节长度折算",
      "basis.tip.unattributed": "总量减分区之和；不摊给任何类别",
      "part.system-prompt": "系统提示",
      "part.tool-definitions": "工具定义",
      "part.memory-instructions": "记忆与指令",
      "part.referenced-files": "引用文件",
      "part.history": "历史",
      "part.tool-results": "工具结果",
      "part.images": "图片",
      "part.user-input": "用户输入",
      "part.assistant-output": "助手输出",
      "part.thinking": "思考",
      "tools.status.ok": "成功",
      "tools.status.running": "进行中",
      "tools.status.error": "报错",
      "tools.status.unknown": "未回包",
      "detail.userInput": "用户输入",
      "tools.showAll": "显示全部 {count} 个",
      "tools.showLess": "收起",
      "tools.path": "路径",
      "tools.command": "命令",
      "tools.diff": "改动",
      "tools.output": "输出",
      "tools.input": "输入",
      "tools.truncated": "内容过长，已折叠",
      "subagents.title": "子代理会话",
      "subagents.files": "{count} 个附属文件",
      "subagents.none": "该会话没有记录到子代理文件。",
      "subagents.main": "主文件",
      "empty.noSources": "宿主没有可读的来源。",
      "empty.noData": "没有可解析的数据。",
      "error.network": "无法连接宿主路由",
    }
    /** English dictionary; same keys, so a missing translation is a type error. */
    const en = {
      ...INSIGHT_EN,
      ...MANAGEMENT_EN,
      "entry.label": "Sessions Insight",
      "toolbar.sidebar": "Show/hide projects",
      "search.trigger": "Search sessions and turns…",
      "tree.filter": "Filter projects",
      "tree.noMatch": "No project path contains “{query}”.",
      "sessions.pick": "Pick a session on the left",
      "sessions.pickHint": "Open a project and click any session to see what each turn actually fed the model.",
      "stats.current": "Current context",
      "stats.noWindow": "window size not logged",
      "stats.windowShare": "{share} of {size} window",
      "stats.peak": "Peak",
      "stats.peakAt": "at turn {index}",
      "stats.turns": "Turns",
      "stats.compactionsLine": "{count} compactions · {tools} tool calls",
      "stats.loaded": "{count} loaded",
      "stats.cost": "Cost",
      "stats.costPending": "pricing pending or uncovered",
      "stats.costPriced": "priced per turn from the table",
      "stats.reconciledTurns": "{count} turns were scaled",
      "detail.composition": "Context composition",
      "turns.noInput": "(no user input this turn)",
      "waterfall.hint": "click a point to open that turn",
      "list.refreshing": "refreshing…",
      "tree.title": "Projects",
      "tree.loadingIndex": "Reading the three session indexes…",
      "tree.emptyAll":
        "No readable sessions in any source yet. Check the DSH / Claude / Codex directories, or press Refresh.",
      "tree.showAll": "Show all {count}",
      "sessions.untitled": "Untitled session",
      "sessions.actions": "Session actions",
      "sessions.delete": "Delete session",
      "sessions.deleteConfirm":
        "Delete “{title}”? This permanently deletes the session’s original logs and cannot be undone.",
      "sessions.deleteFailed": "Delete failed: {detail}",
      "sessions.deleteShared": "This session shares logs with other Codex sessions and cannot be safely deleted.",
      "handoff.waiting": "Waiting for your answer. Open the DSH session to continue.",
      "handoff.openExisting": "Open in DSH",
      "handoff.language": "en",
      "handoff.openSession": "Open new DSH session",
      "handoff.openFailed": "Cannot open session: {detail}",
      "handoff.progress": "Elapsed {seconds}s · {count} tool calls completed",
      "handoff.tool": "Running tool: {tool}",
      "handoff.thinking": "The model is working; waiting for the next activity",
      "handoff.updated": "Last activity: {time}",
      "handoff.pollError": "Cannot read progress; retrying: {detail}",
      "handoff.button": "Hand off to DSH",
      "handoff.title": "Hand off to DSH",
      "handoff.preparing": "Building the brief…",
      "handoff.cwd": "Workdir of the new session",
      "handoff.cwdHint":
        "Must be explicit: omitting it makes DSH inherit its own launch directory and file the session under the wrong bucket.",
      "handoff.brief": "Brief (six sections; editable before delivery)",
      "handoff.files": "{count} files",
      "handoff.decisions": "{count} decisions",
      "handoff.open": "{count} open items",
      "handoff.commands": "{count} verification commands",
      "handoff.chars": "{count} chars",
      "handoff.apply": "Deliver to DSH",
      "handoff.applying": "Delivering…",
      "handoff.polish": "Polish with a model",
      "handoff.polishUnavailable": "This handoff is rule-extracted; model polishing is not wired yet",
      "handoff.applyFailed": "Delivery failed: {detail}",
      "handoff.state.delivered": "Delivered — waiting for the model",
      "handoff.state.running": "The model is running",
      "handoff.state.succeeded": "Handoff succeeded (turn/end observed)",
      "handoff.state.failed": "Handoff failed",
      "handoff.polling": "Polling the target log every 600 ms until a turn/end appears",
      "handoff.reason": "Reason: {reason}",
      "handoff.evidence": "Evidence: turn/end seq={seq}",
      "handoff.close": "Close",
      "cost.total": "Total {usd}",
      "cost.unpriced": "{count} unpriced turns",
      "cost.null": "—",
      "cost.tip": "Price table {version} · as of {asOf} · {currency}; uncovered models show —",
      "cost.turnTip": "Turn {index} · {model} · cache hit {rate}",
      "cost.provisional": "Preview price",
      "cost.reference": "ref {amount}",
      "cost.partialPrefix": "≥",
      "cost.noConvert": "The two tables are never converted or added together",
      "cost.tableLine": "{id}: {source} · as of {asOf}",
      "cost.unlistedTip": "Unlisted channels: {channels}",
      "cost.provisionalTip":
        "Part of this model’s rates is derived (cached input from a discount rule, cacheWrite as 1.25× input), not an officially listed number; source is a GPT-5.6 preview price round-up.",
      "search.tier.fast": "Fast (metadata)",
      "search.tier.deep": "Deep (bodies)",
      "search.enterDeep": "Enter = deep search",
      "search.continue": "Continue scanning {count} more",
      "search.deepMeta": "Deep: {scanned} scanned · {remaining} remaining",
      "search.fastMeta": "Fast: all {scanned} sessions scanned",
      "session.untitled": "Untitled session",
      "session.firstInput": "first input",
      "sessions.headerHint": "The list reads file headers only; open a row to parse it",
      "compactions.count": "{count} compactions",
      "compactions.range": "{before} → {after}",
      "compactions.list": "Expand every boundary",
      "search.title": "Search sessions",
      "search.placeholder": "Search turn text… (Esc to close)",
      "search.empty": "No matches.",
      "search.hint": "Type to search; ↑↓ to select, Enter to open the turn",
      "search.scanning": "Scanning…",
      "search.meta": "{scanned} sessions scanned in {elapsed} ms",
      "search.truncated": "Budget ran out; {remaining} sessions were not scanned",
      "search.complete": "All {scanned} sessions scanned",
      "search.open": "Search (⌘K)",
      "search.failures": "{count} sources failed",
      "search.result": "{workdir} · turn {turn}",
      "search.jump": "Open this turn",
      "panel.refresh": "Refresh",
      "panel.loading": "Reading Host data…",
      "panel.retry": "Retry",
      "panel.updated": "Updated {time}",
      "sources.title": "Sources",
      "sources.available": "readable",
      "sources.unavailable": "unavailable",
      "sources.sessions": "{count} sessions",
      "sources.reason.adapter-pending": "adapter not ready",
      "sources.reason.root-missing": "root missing",
      "sources.reason.root-unreadable": "root unreadable",
      "sources.reason.adapter-error": "adapter error",
      "workdirs.title": "Workdirs",
      "workdirs.empty": "No Claude sessions found.",
      "workdirs.unknown": "(unknown workdir)",
      "workdirs.undecoded": "path decoded from the directory name",
      "sessions.title": "Sessions",
      "sessions.empty": "No sessions in this workdir.",
      "sessions.unparsed": "not parsed",
      "sessions.turns": "{count} turns",
      "session.loading": "Parsing session…",
      "session.error": "Read failed: {detail}",
      "session.paging": "Turns {from}–{to} of {total}",
      "session.loadMore": "Load more turns",
      "session.loadingMore": "Loading…",
      "session.noTurns": "This session has no parseable turns.",
      "session.noTurnsHint": "The file exists but records no human input or usage, so no composition can be drawn.",
      "session.quality": "Data quality",
      "session.turnCount": "{count} turns",
      "turns.title": "Per-turn context",
      "turns.hint": "One row per turn; open one for part numbers and tool calls.",
      "turns.unknown": "Unknown",
      "turns.unknownNote": "The unattributed gap, never spread over the known parts",
      "turns.overCounted": "Estimates exceed the exact total by {tokens}",
      "turns.normalizedByParts": "No usage on this turn: the bar is normalized by parts",
      "turns.total": "Total",
      "turns.window": "window {size}",
      "turns.reconciled": "scaled by {factor}",
      "turns.notReconciled": "not scaled; the gap stands alone",
      "turns.compaction": "Compaction",
      "turns.compactionTransition": "{before} → {after}",
      "turns.compactionReplaced": "history replaced",
      "turns.compactionContinued": "history continues from a summary",
      "turns.tools": "Tool calls",
      "turns.subagents": "Subagent sessions",
      "turns.noTools": "No tool calls in this turn.",
      "turns.noSubagents": "No subagent sessions recorded for this turn.",
      "turns.selected": "Turn {index}",
      "waterfall.title": "Cumulative level",
      "waterfall.caption": "Total context per turn; dashed lines are compactions",
      "waterfall.peak": "peak {tokens}",
      "precision.exact": "exact",
      "precision.estimate": "estimate",
      "basis.usage": "logged usage",
      "basis.chars-per-token": "chars per token",
      "basis.harness-projection": "harness projection",
      "basis.byte-length": "byte length",
      "basis.unattributed": "unattributed gap",
      "basis.tip.chars-per-token": "calipers: text {text} chars/token, CJK {cjk}, schema {schema}",
      "basis.tip.usage": "read from the logged usage, not estimated",
      "basis.tip.harness-projection": "images projected at {px} pixels/token",
      "basis.tip.byte-length": "converted from byte length",
      "basis.tip.unattributed": "total minus the parts; never spread over a category",
      "part.system-prompt": "System prompt",
      "part.tool-definitions": "Tool definitions",
      "part.memory-instructions": "Memory & instructions",
      "part.referenced-files": "Referenced files",
      "part.history": "History",
      "part.tool-results": "Tool results",
      "part.images": "Images",
      "part.user-input": "User input",
      "part.assistant-output": "Assistant output",
      "part.thinking": "Thinking",
      "tools.status.ok": "ok",
      "tools.status.running": "running",
      "tools.status.error": "error",
      "tools.status.unknown": "no result",
      "detail.userInput": "User message",
      "tools.showAll": "Show all {count}",
      "tools.showLess": "Show less",
      "tools.path": "path",
      "tools.command": "command",
      "tools.diff": "diff",
      "tools.output": "output",
      "tools.input": "input",
      "tools.truncated": "long content folded",
      "subagents.title": "Subagent sessions",
      "subagents.files": "{count} attached files",
      "subagents.none": "No subagent files recorded for this session.",
      "subagents.main": "main file",
      "empty.noSources": "The Host serves no readable source.",
      "empty.noData": "No parseable data.",
      "error.network": "Cannot reach the Host route",
    }
    /** Translate function bound to this namespace by the locale service. */
    let runtimeTranslate
    /**
     * Point {@link t} at the live locale service so every later read follows the
     * active language. Called once from `apply`, before any label thunk can run.
     * @param translate - namespace-bound translate from `ctx.locale.bind`.
     */
    function setRuntimeTranslate(translate) {
      runtimeTranslate = translate
    }
    /**
     * Fill `{name}` placeholders.
     * @param template - message text.
     * @param params - values by placeholder name.
     * @returns the filled text; an unknown placeholder is left visible on purpose.
     */
    function fillParams(template, params) {
      if (params === void 0) return template
      return template.replace(/\{(\w+)\}/g, (whole, name) => {
        const value = params[name]
        return value === void 0 ? whole : String(value)
      })
    }
    /**
     * Translate one key of this namespace.
     * @param key - a key of {@link zh}.
     * @param params - interpolation values for the message.
     * @returns the active-language text, or the English text when the locale
     * service is absent, or the key itself when neither has it.
     */
    function t(key, params) {
      const translated = runtimeTranslate?.(key, params)
      if (translated !== void 0 && translated !== "") return translated
      return fillParams(en[key], params)
    }
    //#endregion
    //#region src/client/state/list-cache.ts
    /** Metadata only, shared by preload, panel and tree for one API origin. */
    const ClientListCache = class {
      sources
      workdirs
      sessions = /* @__PURE__ */ new Map()
      #metadata = /* @__PURE__ */ new Map()
      projectSessions(value) {
        return {
          ...value,
          sessions: value.sessions.map((row) => {
            const update = this.#metadata.get(`${row.source}:${row.id}`)
            if (update === void 0) return row
            const next = { ...row }
            if (update.displayTitle === void 0) delete next.title
            else next.title = update.displayTitle
            return next
          }),
        }
      }
      #pending = /* @__PURE__ */ new Map()
      #listeners = /* @__PURE__ */ new Set()
      #deletion = 0
      deletionVersion = () => this.#deletion
      subscribe = (listener) => {
        this.#listeners.add(listener)
        return () => {
          this.#listeners.delete(listener)
        }
      }
      /** Keep visible rows, but prevent superseded requests from restoring them. */
      invalidateRequests(keys = this.#pending.keys()) {
        for (const key of keys) {
          const pending = this.#pending.get(key)
          this.#pending.delete(key)
          pending?.controller.abort()
        }
      }
      async read(key, load, save, signal) {
        if (signal?.aborted)
          return {
            ok: false,
            error: "aborted",
          }
        let pending = this.#pending.get(key)
        if (pending === void 0) {
          const controller = new AbortController()
          pending = {
            controller,
            promise: load(controller.signal)
              .then((result) => {
                if (this.#pending.get(key) !== pending)
                  return {
                    ok: false,
                    error: "aborted",
                  }
                if (result.ok) save(result.value)
                return result
              })
              .finally(() => {
                if (this.#pending.get(key) === pending) this.#pending.delete(key)
              }),
            readers: 0,
          }
          this.#pending.set(key, pending)
        }
        const entry = pending
        entry.readers += 1
        return new Promise((resolve, reject) => {
          let finished = false
          const finish = (result, error) => {
            if (finished) return
            finished = true
            signal?.removeEventListener("abort", abort)
            entry.readers -= 1
            if (entry.readers === 0 && this.#pending.get(key) === entry) {
              this.#pending.delete(key)
              entry.controller.abort()
            }
            if (result !== void 0) resolve(result)
            else reject(error)
          }
          const abort = () =>
            finish({
              ok: false,
              error: "aborted",
            })
          signal?.addEventListener("abort", abort, { once: true })
          entry.promise.then(
            (result) => finish(result),
            (error) => finish(void 0, error),
          )
          if (signal?.aborted) abort()
        })
      }
      rename(value) {
        const { source, id } = value.metadata
        this.#metadata.set(`${source}:${id}`, value)
        for (const [workdir, list] of this.sessions) {
          if (!list.sessions.some((row) => row.source === source && row.id === id)) continue
          this.invalidateRequests([`sessions:${workdir}`])
          this.sessions.set(workdir, {
            ...list,
            sessions: list.sessions.map((row) => {
              if (row.source !== source || row.id !== id) return row
              const next = { ...row }
              if (value.displayTitle === void 0) delete next.title
              else next.title = value.displayTitle
              return next
            }),
          })
        }
        this.#deletion += 1
        for (const listener of this.#listeners) listener()
      }
      remove(deleted) {
        this.invalidateRequests(["sources", "workdirs:false", "workdirs:true", `sessions:${deleted.workdir}`])
        for (const [workdir, value] of this.sessions)
          this.sessions.set(workdir, {
            ...value,
            sessions: value.sessions.filter((row) => row.source !== deleted.source || row.id !== deleted.id),
          })
        if (this.sources !== void 0)
          this.sources = {
            sources: this.sources.sources.map((row) =>
              row.source === deleted.source && row.sessions !== void 0
                ? {
                    ...row,
                    sessions: Math.max(0, row.sessions - 1),
                  }
                : row,
            ),
          }
        if (this.workdirs !== void 0)
          this.workdirs = {
            ...this.workdirs,
            workdirs: this.workdirs.workdirs
              .map((row) => {
                if (row.workdir !== deleted.workdir) return row
                const remaining = this.sessions.get(row.workdir)?.sessions
                const sources = row.sources
                  .map((group) => {
                    if (group.source !== deleted.source) return group
                    const entries = remaining?.filter((session) => session.source === group.source)
                    return {
                      ...group,
                      sessions: Math.max(0, group.sessions - 1),
                      lastUpdatedAt:
                        entries === void 0
                          ? group.lastUpdatedAt
                          : Math.max(0, ...entries.map((entry) => entry.updatedAt)),
                    }
                  })
                  .filter((group) => group.sessions > 0)
                return {
                  ...row,
                  sessions: sources.reduce((sum, group) => sum + group.sessions, 0),
                  lastUpdatedAt: Math.max(0, ...sources.map((group) => group.lastUpdatedAt)),
                  sources,
                }
              })
              .filter((row) => row.sessions > 0),
          }
        this.#deletion += 1
        for (const listener of this.#listeners) listener()
      }
    }
    const CACHES = /* @__PURE__ */ new Map()
    function clientListCache(base = "") {
      let cache = CACHES.get(base)
      if (cache === void 0) {
        cache = new ClientListCache()
        CACHES.set(base, cache)
      }
      return cache
    }
    //#endregion
    //#region src/client/api.ts
    /**
     * The panel's only door to the Host.
     *
     * Every answer is decoded through a protocol guard, so a drifted Host produces
     * a typed failure the panel can render instead of a crash deep in a component.
     * The transport — fetch, JSON decoding, envelope decoding and failure
     * classification — is `@cyrusdoyle/dsh-plugin-kit-client`; what this module adds is the
     * endpoint list and the guards each endpoint's payload is checked against.
     *
     * URLs are document-relative on purpose: the page carries `<base href="./">`
     * and the routes are mounted at the site root.
     *
     * @module @cyrusdoyle/dsh-sessions-insight/client/api
     */
    /**
     * Perform one GET and decode its envelope.
     * @param url - document-relative route.
     * @param guard - payload guard.
     * @param signal - cancellation.
     * @returns the decoded payload or a classified failure.
     */
    function get(url, guard, signal) {
      return requestJson({
        url,
        guard,
        codes: API_ERROR_CODES,
        signal,
      })
    }
    /**
     * Perform one POST and decode its envelope.
     * @param url - document-relative route.
     * @param body - JSON body.
     * @param guard - payload guard.
     * @param signal - cancellation.
     * @returns the decoded payload or a classified failure.
     */
    function post(url, body, guard, signal) {
      return requestJson({
        url,
        guard,
        codes: API_ERROR_CODES,
        signal,
        method: "POST",
        body,
      })
    }
    /**
     * Build the API surface.
     * @param base - prefix prepended to every route ('' keeps it document-relative).
     * @returns the four reads.
     */
    function createApi(base = "") {
      const cache = clientListCache(base)
      return {
        deleteSession: (source, id) =>
          post(
            base + SESSION_DELETE_URL,
            {
              source,
              id,
            },
            isDeleteSessionValue,
          ),
        metadata: (signal) => get(base + SESSION_METADATA_URL, isMetadataValue, signal),
        updateMetadata: (patch) => post(base + SESSION_METADATA_URL, patch, isSessionMetadataValue),
        suggestTitle: (source, id, signal) =>
          post(
            base + SESSION_AI_TITLE_URL,
            {
              source,
              id,
            },
            isAiTitleValue,
            signal,
          ),
        sources: (signal) =>
          cache.read(
            "sources",
            (sharedSignal) => get(base + SOURCES_URL, isSourcesValue, sharedSignal),
            (value) => {
              cache.sources = value
            },
            signal,
          ),
        workdirs: (signal, refresh = false) =>
          cache.read(
            `workdirs:${String(refresh)}`,
            (sharedSignal) => get(base + WORKDIRS_URL + (refresh ? "?refresh=1" : ""), isWorkdirsValue, sharedSignal),
            (value) => {
              cache.workdirs = value
            },
            signal,
          ),
        sessions: (workdir, signal) =>
          cache.read(
            `sessions:${workdir}`,
            (sharedSignal) =>
              get(`${base}${SESSIONS_URL}?workdir=${encodeURIComponent(workdir)}`, isSessionsValue, sharedSignal).then(
                (result) =>
                  result.ok
                    ? {
                        ok: true,
                        value: cache.projectSessions(result.value),
                      }
                    : result,
              ),
            (value) => {
              cache.sessions.set(workdir, value)
            },
            signal,
          ),
        session: (id, offset, limit, source, signal) =>
          get(
            `${base}${SESSION_URL}?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}&turnOffset=${String(offset)}&turnLimit=${String(limit)}`,
            isInsightSessionDetail,
            signal,
          ),
        search: (query, limit, tier, cursor, signal) =>
          get(
            `${base}${SEARCH_URL}?q=${encodeURIComponent(query)}&limit=${String(limit)}&tier=${tier}&cursor=${String(cursor)}`,
            isSearchValue,
            signal,
          ),
        cost: (source, id, signal) =>
          get(
            `${base}${COST_URL}?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`,
            isCostValue,
            signal,
          ),
        handoffPrepare: (source, id, signal) =>
          post(
            base + HANDOFF_PREPARE_URL,
            {
              source,
              id,
              locale: t("handoff.language"),
            },
            isBriefValue,
            signal,
          ),
        handoffApply: (body, signal) => post(base + HANDOFF_APPLY_URL, body, isHandoffApplyValue, signal),
        handoffReveal: (sessionId) =>
          post(
            base + HANDOFF_REVEAL_URL,
            {
              source: "dsh",
              id: sessionId,
            },
            isHandoffRevealValue,
          ),
        handoffStatus: (sessionId, signal) =>
          get(`${base}${HANDOFF_STATUS_URL}?sessionId=${encodeURIComponent(sessionId)}`, isHandoffStatusValue, signal),
      }
    }
    /** Preload only navigation metadata; session bodies remain on demand. */
    async function preloadSessionLists(api = createApi(), signal) {
      const [, workdirs] = await Promise.all([api.sources(signal), api.workdirs(signal)])
      if (signal?.aborted || !workdirs.ok) return
      const first = workdirs.value.workdirs[0]
      if (first !== void 0) await api.sessions(first.workdir, signal)
    }
    /**
     * One line for a failed request: the classified error, then its detail.
     * @param failure - the failed result.
     * @returns printable text.
     */
    function failureText(failure) {
      return failure.detail === void 0 ? failure.error : `${failure.error}: ${failure.detail}`
    }
    //#endregion
    //#region src/client/theme/generated.css.ts
    const TAILWIND_CSS =
      '/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */\n@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))){*,:before,:after,::backdrop{--tw-rotate-x:initial;--tw-rotate-y:initial;--tw-rotate-z:initial;--tw-skew-x:initial;--tw-skew-y:initial;--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-tracking:initial;--tw-ordinal:initial;--tw-slashed-zero:initial;--tw-numeric-figure:initial;--tw-numeric-spacing:initial;--tw-numeric-fraction:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-outline-style:solid;--tw-blur:initial;--tw-brightness:initial;--tw-contrast:initial;--tw-grayscale:initial;--tw-hue-rotate:initial;--tw-invert:initial;--tw-opacity:initial;--tw-saturate:initial;--tw-sepia:initial;--tw-drop-shadow:initial;--tw-drop-shadow-color:initial;--tw-drop-shadow-alpha:100%;--tw-drop-shadow-size:initial;--tw-duration:initial;--tw-ease:initial;--tw-content:""}}}@layer theme{.ci-panel{--font-mono:ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;--color-black:#000;--color-white:#fff;--spacing:.25rem;--container-md:28rem;--container-xl:36rem;--text-xs:.75rem;--text-xs--line-height:calc(1 / .75);--font-weight-normal:400;--font-weight-medium:500;--font-weight-semibold:600;--tracking-normal:0em;--leading-tight:1.25;--leading-snug:1.375;--leading-normal:1.5;--leading-relaxed:1.625;--radius-xs:.125rem;--radius-sm:.25rem;--radius-md:.375rem;--radius-lg:.5rem;--radius-xl:.75rem;--ease-out:cubic-bezier(.23, 1, .32, 1);--ease-in-out:cubic-bezier(.77, 0, .175, 1);--animate-spin:spin 1s linear infinite;--animate-pulse:pulse 2s cubic-bezier(.4, 0, .6, 1) infinite;--default-transition-duration:.15s;--default-transition-timing-function:cubic-bezier(.4, 0, .2, 1);--color-fg:var(--dsw-alias-label-primary,light-dark(oklch(22% 0 none),oklch(93% 0 none)));--color-fg-dim:var(--dsw-alias-label-secondary,light-dark(oklch(46% 0 none),oklch(68% 0 none)));--color-bg:var(--dsw-alias-bg-base,light-dark(oklch(100% 0 none),oklch(19% 0 none)));--color-bg-1:var(--dsw-alias-bg-layer-1,light-dark(oklch(97% 0 none),oklch(23% 0 none)));--color-bg-2:var(--dsw-alias-bg-layer-2,light-dark(oklch(94% 0 none),oklch(27% 0 none)));--color-bg-3:var(--dsw-alias-bg-layer-3,light-dark(oklch(91% 0 none),oklch(31% 0 none)));--color-fg-3:var(--dsw-alias-label-tertiary,light-dark(oklch(60% 0 none),oklch(56% 0 none)));--color-hover:var(--dsw-alias-interactive-bg-hover,light-dark(oklch(22% 0 none/.06),oklch(100% 0 none/.07)));--color-line:var(--dsw-alias-border-l2,light-dark(oklch(86% 0 none),oklch(34% 0 none)));--color-line-soft:var(--dsw-alias-border-l1,light-dark(oklch(91% 0 none),oklch(28% 0 none)));--color-accent:var(--dsw-alias-brand-primary,light-dark(oklch(52% .17 264),oklch(62% .15 264)));--color-ok:var(--dsw-alias-state-success-primary,light-dark(oklch(50% .14 152),oklch(72% .15 152)));--color-warn:var(--dsw-alias-state-warn-primary,light-dark(oklch(55% .12 82),oklch(78% .13 82)));--color-err:var(--dsw-alias-state-error-primary,light-dark(oklch(52% .18 22),oklch(68% .17 22)));--color-info:light-dark(oklch(55% .16 262),oklch(72% .15 264));--color-sidebar:var(--dsw-specific-sidebar-fill,var(--color-bg-1));--color-part-system-prompt:#6f86b8;--color-part-tool-definitions:#9a7fc4;--color-part-memory-instructions:#4f9e9a;--color-part-referenced-files:#6aa46f;--color-part-history:#b08a5a;--color-part-tool-results:#c47f7f;--color-part-images:#7f9aa8;--color-part-user-input:#8fa86a;--color-part-assistant-output:#a97fa8;--color-part-thinking:#7f7f8f}}@scope (.ci-panel) {\n@layer utilities{.\\@container{container-type:inline-size!important}.collapse{visibility:collapse!important}.invisible{visibility:hidden!important}.visible{visibility:visible!important}.absolute{position:absolute!important}.fixed{position:fixed!important}.relative{position:relative!important}.sticky{position:sticky!important}.inset-0{inset:0!important}.top-0{top:0!important}.z-10{z-index:10!important}.z-60{z-index:60!important}.col-start-1{grid-column-start:1!important}.row-start-1{grid-row-start:1!important}.container{width:100%!important}@media (min-width:40rem){.container{max-width:40rem!important}}@media (min-width:48rem){.container{max-width:48rem!important}}@media (min-width:64rem){.container{max-width:64rem!important}}@media (min-width:80rem){.container{max-width:80rem!important}}@media (min-width:96rem){.container{max-width:96rem!important}}.m-0{margin:0!important}.mx-1{margin-inline:var(--spacing)!important}.mx-1\\.5{margin-inline:calc(var(--spacing) * 1.5)!important}.mx-4{margin-inline:calc(var(--spacing) * 4)!important}.my-0{margin-block:0!important}.my-1{margin-block:var(--spacing)!important}.my-1\\.5{margin-block:calc(var(--spacing) * 1.5)!important}.my-2{margin-block:calc(var(--spacing) * 2)!important}.my-2\\.5{margin-block:calc(var(--spacing) * 2.5)!important}.my-px{margin-block:1px!important}.ms-1{margin-inline-start:var(--spacing)!important}.ms-2{margin-inline-start:calc(var(--spacing) * 2)!important}.ms-3{margin-inline-start:calc(var(--spacing) * 3)!important}.ms-3\\.25{margin-inline-start:calc(var(--spacing) * 3.25)!important}.ms-4{margin-inline-start:calc(var(--spacing) * 4)!important}.ms-5{margin-inline-start:calc(var(--spacing) * 5)!important}.ms-6{margin-inline-start:calc(var(--spacing) * 6)!important}.ms-auto{margin-inline-start:auto!important}.me-4{margin-inline-end:calc(var(--spacing) * 4)!important}.mbs-2{margin-block-start:calc(var(--spacing) * 2)!important}.mt-0{margin-top:0!important}.mt-0\\.5{margin-top:calc(var(--spacing) * .5)!important}.mt-1{margin-top:var(--spacing)!important}.mt-1\\.5{margin-top:calc(var(--spacing) * 1.5)!important}.mt-2{margin-top:calc(var(--spacing) * 2)!important}.mt-2\\.5{margin-top:calc(var(--spacing) * 2.5)!important}.mt-3{margin-top:calc(var(--spacing) * 3)!important}.mt-auto{margin-top:auto!important}.mb-0{margin-bottom:0!important}.mb-1{margin-bottom:var(--spacing)!important}.mb-2{margin-bottom:calc(var(--spacing) * 2)!important}.mb-2\\.5{margin-bottom:calc(var(--spacing) * 2.5)!important}.box-border{box-sizing:border-box!important}.line-clamp-2{-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;display:-webkit-box!important;overflow:hidden!important}.block{display:block!important}.contents{display:contents!important}.flex{display:flex!important}.grid{display:grid!important}.hidden{display:none!important}.inline{display:inline!important}.inline-block{display:inline-block!important}.inline-flex{display:inline-flex!important}.inline-grid{display:inline-grid!important}.table{display:table!important}.size-1{width:var(--spacing)!important;height:var(--spacing)!important}.size-1\\.5{width:calc(var(--spacing) * 1.5)!important;height:calc(var(--spacing) * 1.5)!important}.h-1{height:var(--spacing)!important}.h-1\\.5{height:calc(var(--spacing) * 1.5)!important}.h-2{height:calc(var(--spacing) * 2)!important}.h-2\\.5{height:calc(var(--spacing) * 2.5)!important}.h-3{height:calc(var(--spacing) * 3)!important}.h-3\\.5{height:calc(var(--spacing) * 3.5)!important}.h-4{height:calc(var(--spacing) * 4)!important}.h-4\\.5{height:calc(var(--spacing) * 4.5)!important}.h-5{height:calc(var(--spacing) * 5)!important}.h-6{height:calc(var(--spacing) * 6)!important}.h-7{height:calc(var(--spacing) * 7)!important}.h-8{height:calc(var(--spacing) * 8)!important}.h-9{height:calc(var(--spacing) * 9)!important}.h-10{height:calc(var(--spacing) * 10)!important}.h-12{height:calc(var(--spacing) * 12)!important}.h-14{height:calc(var(--spacing) * 14)!important}.h-20{height:calc(var(--spacing) * 20)!important}.h-24{height:calc(var(--spacing) * 24)!important}.h-28{height:calc(var(--spacing) * 28)!important}.h-36{height:calc(var(--spacing) * 36)!important}.h-40{height:calc(var(--spacing) * 40)!important}.h-44{height:calc(var(--spacing) * 44)!important}.h-\\[74px\\]{height:74px!important}.h-\\[min\\(300px\\,42dvh\\)\\]{height:min(300px,42dvh)!important}.h-full{height:100%!important}.max-h-55{max-height:calc(var(--spacing) * 55)!important}.max-h-64{max-height:calc(var(--spacing) * 64)!important}.max-h-80{max-height:calc(var(--spacing) * 80)!important}.max-h-\\[42dvh\\]{max-height:42dvh!important}.max-h-\\[70vh\\]{max-height:70vh!important}.max-h-\\[90dvh\\]{max-height:90dvh!important}.max-h-full{max-height:100%!important}.min-h-0{min-height:0!important}.min-h-9{min-height:calc(var(--spacing) * 9)!important}.min-h-10{min-height:calc(var(--spacing) * 10)!important}.min-h-40{min-height:calc(var(--spacing) * 40)!important}.min-h-50{min-height:calc(var(--spacing) * 50)!important}.w-1{width:var(--spacing)!important}.w-1\\/2{width:50%!important}.w-2{width:calc(var(--spacing) * 2)!important}.w-2\\.5{width:calc(var(--spacing) * 2.5)!important}.w-3{width:calc(var(--spacing) * 3)!important}.w-3\\.5{width:calc(var(--spacing) * 3.5)!important}.w-3\\/4{width:75%!important}.w-6{width:calc(var(--spacing) * 6)!important}.w-28{width:calc(var(--spacing) * 28)!important}.w-32{width:calc(var(--spacing) * 32)!important}.w-40{width:calc(var(--spacing) * 40)!important}.w-\\[46\\%\\]{width:46%!important}.w-\\[68\\%\\]{width:68%!important}.w-\\[86\\%\\]{width:86%!important}.w-\\[clamp\\(160px\\,28cqw\\,280px\\)\\]{width:clamp(160px,28cqw,280px)!important}.w-\\[min\\(720px\\,92vw\\)\\]{width:min(720px,92vw)!important}.w-\\[min\\(820px\\,94vw\\)\\]{width:min(820px,94vw)!important}.w-full{width:100%!important}.max-w-\\[16ch\\]{max-width:16ch!important}.max-w-\\[40\\%\\]{max-width:40%!important}.max-w-\\[42ch\\]{max-width:42ch!important}.max-w-\\[44ch\\]{max-width:44ch!important}.max-w-\\[60ch\\]{max-width:60ch!important}.max-w-full{max-width:100%!important}.max-w-md{max-width:var(--container-md)!important}.max-w-xl{max-width:var(--container-xl)!important}.min-w-0{min-width:0!important}.min-w-36{min-width:calc(var(--spacing) * 36)!important}.flex-1{flex:1!important}.flex-none{flex:none!important}.shrink{flex-shrink:1!important}.shrink-0{flex-shrink:0!important}.basis-64{flex-basis:calc(var(--spacing) * 64)!important}.transform{transform:var(--tw-rotate-x,) var(--tw-rotate-y,) var(--tw-rotate-z,) var(--tw-skew-x,) var(--tw-skew-y,)!important}.cursor-pointer{cursor:pointer!important}.resize{resize:both!important}.resize-y{resize:vertical!important}.scrollbar-gutter-stable{scrollbar-gutter:stable!important}.list-none{list-style-type:none!important}.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))!important}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))!important}.grid-cols-\\[22px_minmax\\(0\\,1fr\\)_64px\\]{grid-template-columns:22px minmax(0,1fr) 64px!important}.grid-cols-\\[clamp\\(220px\\,30cqw\\,300px\\)_minmax\\(0\\,1fr\\)\\]{grid-template-columns:clamp(220px,30cqw,300px) minmax(0,1fr)!important}.grid-cols-\\[minmax\\(0\\,1fr\\)\\]{grid-template-columns:minmax(0,1fr)!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,10rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,12rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,19rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr))!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,22rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))!important}.grid-cols-\\[var\\(--ci-time-w\\)_36px_44px_minmax\\(0\\,1fr\\)\\]{grid-template-columns:var(--ci-time-w) 36px 44px minmax(0,1fr)!important}.grid-rows-\\[auto_minmax\\(0\\,1fr\\)\\]{grid-template-rows:auto minmax(0,1fr)!important}.grid-rows-\\[auto_minmax\\(0\\,1fr\\)_auto\\]{grid-template-rows:auto minmax(0,1fr) auto!important}.flex-col{flex-direction:column!important}.flex-wrap{flex-wrap:wrap!important}.place-items-center{place-items:center!important}.items-baseline{align-items:baseline!important}.items-center{align-items:center!important}.items-end{align-items:flex-end!important}.items-start{align-items:flex-start!important}.items-stretch{align-items:stretch!important}.justify-between{justify-content:space-between!important}.justify-center{justify-content:center!important}.justify-end{justify-content:flex-end!important}.justify-start{justify-content:flex-start!important}.gap-0{gap:0!important}.gap-0\\.5{gap:calc(var(--spacing) * .5)!important}.gap-1{gap:var(--spacing)!important}.gap-1\\.5{gap:calc(var(--spacing) * 1.5)!important}.gap-2{gap:calc(var(--spacing) * 2)!important}.gap-3{gap:calc(var(--spacing) * 3)!important}.gap-4{gap:calc(var(--spacing) * 4)!important}.gap-px{gap:1px!important}.gap-x-1{column-gap:var(--spacing)!important}.gap-x-1\\.5{column-gap:calc(var(--spacing) * 1.5)!important}.gap-x-2{column-gap:calc(var(--spacing) * 2)!important}.gap-x-2\\.5{column-gap:calc(var(--spacing) * 2.5)!important}.gap-x-5{column-gap:calc(var(--spacing) * 5)!important}.gap-y-0{row-gap:0!important}.gap-y-0\\.5{row-gap:calc(var(--spacing) * .5)!important}.gap-y-1{row-gap:var(--spacing)!important}.gap-y-1\\.5{row-gap:calc(var(--spacing) * 1.5)!important}.gap-y-2{row-gap:calc(var(--spacing) * 2)!important}.self-center{align-self:center!important}.self-start{align-self:flex-start!important}.truncate{text-overflow:ellipsis!important;white-space:nowrap!important;overflow:hidden!important}.overflow-hidden{overflow:hidden!important}.overflow-visible{overflow:visible!important}.overflow-x-auto{overflow-x:auto!important}.overflow-y-auto{overflow-y:auto!important}.overscroll-contain{overscroll-behavior:contain!important}.rounded{border-radius:.25rem!important}.rounded-\\[3px\\]{border-radius:3px!important}.rounded-\\[4px\\]{border-radius:4px!important}.rounded-\\[5px\\]{border-radius:5px!important}.rounded-\\[7px\\]{border-radius:7px!important}.rounded-\\[10px\\]{border-radius:10px!important}.rounded-full{border-radius:3.40282e38px!important}.rounded-lg{border-radius:var(--radius-lg)!important}.rounded-md{border-radius:var(--radius-md)!important}.rounded-sm{border-radius:var(--radius-sm)!important}.rounded-xl{border-radius:var(--radius-xl)!important}.rounded-xs{border-radius:var(--radius-xs)!important}.border{border-style:var(--tw-border-style)!important;border-width:1px!important}.border-0{border-style:var(--tw-border-style)!important;border-width:0!important}.border-\\[0\\.5px\\]{border-style:var(--tw-border-style)!important;border-width:.5px!important}.border-s{border-inline-start-style:var(--tw-border-style)!important;border-inline-start-width:1px!important}.border-s-2{border-inline-start-style:var(--tw-border-style)!important;border-inline-start-width:2px!important}.border-e{border-inline-end-style:var(--tw-border-style)!important;border-inline-end-width:1px!important}.border-bs{border-block-start-style:var(--tw-border-style)!important;border-block-start-width:1px!important}.border-t{border-top-style:var(--tw-border-style)!important;border-top-width:1px!important}.border-t-\\[0\\.5px\\]{border-top-style:var(--tw-border-style)!important;border-top-width:.5px!important}.border-b{border-bottom-style:var(--tw-border-style)!important;border-bottom-width:1px!important}.border-b-\\[0\\.5px\\]{border-bottom-style:var(--tw-border-style)!important;border-bottom-width:.5px!important}.border-dashed{--tw-border-style:dashed!important;border-style:dashed!important}.border-accent{border-color:var(--color-accent)!important}.border-current{border-color:currentColor!important}.border-err,.border-err\\/40{border-color:var(--color-err)!important}@supports (color:color-mix(in lab, red, red)){.border-err\\/40{border-color:color-mix(in oklab, var(--color-err) 40%, transparent)!important}}.border-line{border-color:var(--color-line)!important}.border-line-soft{border-color:var(--color-line-soft)!important}.border-warn,.border-warn\\/40{border-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.border-warn\\/40{border-color:color-mix(in oklab, var(--color-warn) 40%, transparent)!important}}.border-warn\\/50{border-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.border-warn\\/50{border-color:color-mix(in oklab, var(--color-warn) 50%, transparent)!important}}.border-warn\\/70{border-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.border-warn\\/70{border-color:color-mix(in oklab, var(--color-warn) 70%, transparent)!important}}.border-s-err{border-inline-start-color:var(--color-err)!important}.border-s-ok{border-inline-start-color:var(--color-ok)!important}.border-s-warn{border-inline-start-color:var(--color-warn)!important}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_16\\%\\,transparent\\)\\]{background-color:var(--color-accent)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_16\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-accent) 16%,transparent)!important}}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_35\\%\\,transparent\\)\\]{background-color:var(--color-accent)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_35\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-accent) 35%,transparent)!important}}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-err\\)_8\\%\\,transparent\\)\\]{background-color:var(--color-err)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-err\\)_8\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-err) 8%,transparent)!important}}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-ok\\)_8\\%\\,transparent\\)\\]{background-color:var(--color-ok)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-ok\\)_8\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-ok) 8%,transparent)!important}}.bg-\\[rgb\\(0_0_0\\/55\\%\\)\\]{background-color:#0000008c!important}.bg-accent,.bg-accent\\/14{background-color:var(--color-accent)!important}@supports (color:color-mix(in lab, red, red)){.bg-accent\\/14{background-color:color-mix(in oklab, var(--color-accent) 14%, transparent)!important}}.bg-bg{background-color:var(--color-bg)!important}.bg-bg-1{background-color:var(--color-bg-1)!important}.bg-bg-2{background-color:var(--color-bg-2)!important}.bg-bg-3{background-color:var(--color-bg-3)!important}.bg-err,.bg-err\\/5{background-color:var(--color-err)!important}@supports (color:color-mix(in lab, red, red)){.bg-err\\/5{background-color:color-mix(in oklab, var(--color-err) 5%, transparent)!important}}.bg-fg-dim{background-color:var(--color-fg-dim)!important}.bg-ok{background-color:var(--color-ok)!important}.bg-sidebar{background-color:var(--color-sidebar)!important}.bg-transparent{background-color:#0000!important}.bg-warn,.bg-warn\\/6{background-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.bg-warn\\/6{background-color:color-mix(in oklab, var(--color-warn) 6%, transparent)!important}}.bg-warn\\/8{background-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.bg-warn\\/8{background-color:color-mix(in oklab, var(--color-warn) 8%, transparent)!important}}.bg-\\[linear-gradient\\(90deg\\,var\\(--color-bg-1\\)\\,var\\(--color-bg-2\\)\\,var\\(--color-bg-1\\)\\)\\]{background-image:linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))!important}.bg-\\[repeating-linear-gradient\\(45deg\\,var\\(--color-fg-dim\\)_0_1px\\,transparent_1px_3px\\)\\]{background-image:repeating-linear-gradient(45deg,var(--color-fg-dim) 0 1px,transparent 1px 3px)!important}.bg-\\[repeating-linear-gradient\\(45deg\\,var\\(--color-fg-dim\\)_0_2px\\,transparent_2px_5px\\)\\]{background-image:repeating-linear-gradient(45deg,var(--color-fg-dim) 0 2px,transparent 2px 5px)!important}.bg-\\[length\\:200\\%_100\\%\\],.bg-size-\\[200\\%_100\\%\\]{background-size:200% 100%!important}.fill-accent{fill:var(--color-accent)!important}.fill-none{fill:none!important}.stroke-accent{stroke:var(--color-accent)!important}.stroke-fg-dim{stroke:var(--color-fg-dim)!important}.stroke-line-soft{stroke:var(--color-line-soft)!important}.stroke-warn{stroke:var(--color-warn)!important}.stroke-1{stroke-width:1px!important}.stroke-\\[1\\.6\\]{stroke-width:1.6px!important}.p-0{padding:0!important}.p-1{padding:var(--spacing)!important}.p-1\\.5{padding:calc(var(--spacing) * 1.5)!important}.p-2{padding:calc(var(--spacing) * 2)!important}.p-3{padding:calc(var(--spacing) * 3)!important}.p-3\\.5{padding:calc(var(--spacing) * 3.5)!important}.p-4{padding:calc(var(--spacing) * 4)!important}.p-5{padding:calc(var(--spacing) * 5)!important}.p-6{padding:calc(var(--spacing) * 6)!important}.px-1{padding-inline:var(--spacing)!important}.px-1\\.5{padding-inline:calc(var(--spacing) * 1.5)!important}.px-1\\.25{padding-inline:calc(var(--spacing) * 1.25)!important}.px-2{padding-inline:calc(var(--spacing) * 2)!important}.px-2\\.5{padding-inline:calc(var(--spacing) * 2.5)!important}.px-3{padding-inline:calc(var(--spacing) * 3)!important}.px-3\\.5{padding-inline:calc(var(--spacing) * 3.5)!important}.px-4{padding-inline:calc(var(--spacing) * 4)!important}.px-5{padding-inline:calc(var(--spacing) * 5)!important}.px-8{padding-inline:calc(var(--spacing) * 8)!important}.px-px{padding-inline:1px!important}.py-0{padding-block:0!important}.py-0\\.5{padding-block:calc(var(--spacing) * .5)!important}.py-1{padding-block:var(--spacing)!important}.py-1\\.5{padding-block:calc(var(--spacing) * 1.5)!important}.py-2{padding-block:calc(var(--spacing) * 2)!important}.py-2\\.5{padding-block:calc(var(--spacing) * 2.5)!important}.py-3{padding-block:calc(var(--spacing) * 3)!important}.py-4{padding-block:calc(var(--spacing) * 4)!important}.py-10{padding-block:calc(var(--spacing) * 10)!important}.py-px{padding-block:1px!important}.ps-0{padding-inline-start:0!important}.ps-1{padding-inline-start:var(--spacing)!important}.ps-1\\.5{padding-inline-start:calc(var(--spacing) * 1.5)!important}.ps-2{padding-inline-start:calc(var(--spacing) * 2)!important}.ps-2\\.5{padding-inline-start:calc(var(--spacing) * 2.5)!important}.ps-3{padding-inline-start:calc(var(--spacing) * 3)!important}.ps-4{padding-inline-start:calc(var(--spacing) * 4)!important}.ps-5{padding-inline-start:calc(var(--spacing) * 5)!important}.ps-8{padding-inline-start:calc(var(--spacing) * 8)!important}.ps-9{padding-inline-start:calc(var(--spacing) * 9)!important}.ps-9\\.25{padding-inline-start:calc(var(--spacing) * 9.25)!important}.pe-2{padding-inline-end:calc(var(--spacing) * 2)!important}.pt-1{padding-top:var(--spacing)!important}.pt-1\\.5{padding-top:calc(var(--spacing) * 1.5)!important}.pt-2{padding-top:calc(var(--spacing) * 2)!important}.pt-3{padding-top:calc(var(--spacing) * 3)!important}.pt-4{padding-top:calc(var(--spacing) * 4)!important}.pt-\\[12vh\\]{padding-top:12vh!important}.pb-1{padding-bottom:var(--spacing)!important}.pb-1\\.5{padding-bottom:calc(var(--spacing) * 1.5)!important}.pb-2{padding-bottom:calc(var(--spacing) * 2)!important}.pb-2\\.5{padding-bottom:calc(var(--spacing) * 2.5)!important}.pb-3{padding-bottom:calc(var(--spacing) * 3)!important}.pb-4{padding-bottom:calc(var(--spacing) * 4)!important}.pb-6{padding-bottom:calc(var(--spacing) * 6)!important}.text-center{text-align:center!important}.text-end{text-align:end!important}.text-left{text-align:left!important}.text-right{text-align:right!important}.text-start{text-align:start!important}.font-\\[inherit\\]{font-family:inherit!important}.font-mono{font-family:var(--font-mono)!important}.text-xs{font-size:var(--text-xs)!important;line-height:var(--tw-leading,var(--text-xs--line-height))!important}.text-\\[9\\.5px\\]{font-size:9.5px!important}.text-\\[10\\.5px\\]{font-size:10.5px!important}.text-\\[10px\\]{font-size:10px!important}.text-\\[11\\.5px\\]{font-size:11.5px!important}.text-\\[11px\\]{font-size:11px!important}.text-\\[12\\.5px\\]{font-size:12.5px!important}.text-\\[12px\\]{font-size:12px!important}.text-\\[13\\.5px\\]{font-size:13.5px!important}.text-\\[13px\\]{font-size:13px!important}.text-\\[15px\\]{font-size:15px!important}.text-\\[16px\\]{font-size:16px!important}.text-\\[18px\\]{font-size:18px!important}.text-\\[20px\\]{font-size:20px!important}.text-\\[22px\\]{font-size:22px!important}.text-\\[24px\\]{font-size:24px!important}.leading-4{--tw-leading:calc(var(--spacing) * 4)!important;line-height:calc(var(--spacing) * 4)!important}.leading-4\\.25{--tw-leading:calc(var(--spacing) * 4.25)!important;line-height:calc(var(--spacing) * 4.25)!important}.leading-\\[15px\\]{--tw-leading:15px!important;line-height:15px!important}.leading-none{--tw-leading:1!important;line-height:1!important}.leading-normal{--tw-leading:var(--leading-normal)!important;line-height:var(--leading-normal)!important}.leading-relaxed{--tw-leading:var(--leading-relaxed)!important;line-height:var(--leading-relaxed)!important}.leading-snug{--tw-leading:var(--leading-snug)!important;line-height:var(--leading-snug)!important}.leading-tight{--tw-leading:var(--leading-tight)!important;line-height:var(--leading-tight)!important}.font-medium{--tw-font-weight:var(--font-weight-medium)!important;font-weight:var(--font-weight-medium)!important}.font-normal{--tw-font-weight:var(--font-weight-normal)!important;font-weight:var(--font-weight-normal)!important}.font-semibold{--tw-font-weight:var(--font-weight-semibold)!important;font-weight:var(--font-weight-semibold)!important}.tracking-\\[-0\\.01em\\]{--tw-tracking:-.01em!important;letter-spacing:-.01em!important}.tracking-\\[0\\.02em\\]{--tw-tracking:.02em!important;letter-spacing:.02em!important}.tracking-\\[0\\.06em\\]{--tw-tracking:.06em!important;letter-spacing:.06em!important}.tracking-normal{--tw-tracking:var(--tracking-normal)!important;letter-spacing:var(--tracking-normal)!important}.break-words{overflow-wrap:break-word!important}.wrap-anywhere{overflow-wrap:anywhere!important}.break-all{word-break:break-all!important}.whitespace-nowrap{white-space:nowrap!important}.whitespace-pre-wrap{white-space:pre-wrap!important}.text-accent{color:var(--color-accent)!important}.text-err{color:var(--color-err)!important}.text-fg{color:var(--color-fg)!important}.text-fg-3{color:var(--color-fg-3)!important}.text-fg-dim{color:var(--color-fg-dim)!important}.text-inherit{color:inherit!important}.text-ok{color:var(--color-ok)!important}.text-warn{color:var(--color-warn)!important}.text-white{color:var(--color-white)!important}.normal-case{text-transform:none!important}.uppercase{text-transform:uppercase!important}.italic{font-style:italic!important}.ordinal{--tw-ordinal:ordinal!important;font-variant-numeric:var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)!important}.tabular-nums{--tw-numeric-spacing:tabular-nums!important;font-variant-numeric:var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)!important}.accent-accent{accent-color:var(--color-accent)!important}.opacity-50{opacity:.5!important}.opacity-60{opacity:.6!important}.opacity-70{opacity:.7!important}.opacity-75{opacity:.75!important}.opacity-80{opacity:.8!important}.opacity-100{opacity:1!important}.opacity-\\[0\\.14\\]{opacity:.14!important}.shadow-\\[0_18px_48px_rgb\\(0_0_0\\/50\\%\\)\\]{--tw-shadow:0 18px 48px var(--tw-shadow-color,#00000080)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.shadow-\\[inset_0_0_0_1px_var\\(--color-fg-dim\\)\\]{--tw-shadow:inset 0 0 0 1px var(--tw-shadow-color,var(--color-fg-dim))!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.shadow-lg{--tw-shadow:0 10px 15px -3px var(--tw-shadow-color,#0000001a), 0 4px 6px -4px var(--tw-shadow-color,#0000001a)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.ring{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.outline{outline-style:var(--tw-outline-style)!important;outline-width:1px!important}.outline-offset-2{outline-offset:2px!important}.blur{--tw-blur:blur(8px)!important;filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)!important}.filter{filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)!important}.transition{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to,opacity,box-shadow,transform,translate,scale,rotate,filter,-webkit-backdrop-filter,backdrop-filter,display,content-visibility,overlay,pointer-events!important;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function))!important;transition-duration:var(--tw-duration,var(--default-transition-duration))!important}.transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to!important;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function))!important;transition-duration:var(--tw-duration,var(--default-transition-duration))!important}.duration-150{--tw-duration:.15s!important;transition-duration:.15s!important}.ease-in-out{--tw-ease:var(--ease-in-out)!important;transition-timing-function:var(--ease-in-out)!important}.ease-out{--tw-ease:var(--ease-out)!important;transition-timing-function:var(--ease-out)!important}.outline-none{--tw-outline-style:none!important;outline-style:none!important}.\\[stroke-dasharray\\:3_3\\]{stroke-dasharray:3 3!important}.\\[stroke-linejoin\\:round\\]{stroke-linejoin:round!important}.\\[vector-effect\\:non-scaling-stroke\\]{vector-effect:non-scaling-stroke!important}.placeholder\\:text-fg-3::placeholder{color:var(--color-fg-3)!important}.backdrop\\:bg-black\\/40::backdrop{background-color:#0006!important}@supports (color:color-mix(in lab, red, red)){.backdrop\\:bg-black\\/40::backdrop{background-color:color-mix(in oklab, var(--color-black) 40%, transparent)!important}}.after\\:w-max:after{content:var(--tw-content);width:max-content!important}.after\\:max-w-full:after{content:var(--tw-content);max-width:100%!important}.first\\:mt-0:first-child{margin-top:0!important}.first\\:rounded-s-sm:first-child{border-start-start-radius:var(--radius-sm)!important;border-end-start-radius:var(--radius-sm)!important}.first\\:border-t-0:first-child{border-top-style:var(--tw-border-style)!important;border-top-width:0!important}.last\\:rounded-e-sm:last-child{border-start-end-radius:var(--radius-sm)!important;border-end-end-radius:var(--radius-sm)!important}.focus-within\\:border-accent:focus-within{border-color:var(--color-accent)!important}@media (hover:hover){.hover\\:bg-bg-2:hover{background-color:var(--color-bg-2)!important}.hover\\:bg-hover:hover{background-color:var(--color-hover)!important}}.focus\\:bg-hover:focus{background-color:var(--color-hover)!important}.focus-visible\\:outline-2:focus-visible{outline-style:var(--tw-outline-style)!important;outline-width:2px!important}.focus-visible\\:outline-accent:focus-visible{outline-color:var(--color-accent)!important}.active\\:bg-bg-3:active{background-color:var(--color-bg-3)!important}.active\\:bg-hover:active{background-color:var(--color-hover)!important}@media (hover:hover){.enabled\\:hover\\:border-accent:enabled:hover{border-color:var(--color-accent)!important}.enabled\\:hover\\:brightness-110:enabled:hover{--tw-brightness:brightness(110%)!important;filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)!important}}.disabled\\:cursor-default:disabled{cursor:default!important}.disabled\\:opacity-50:disabled{opacity:.5!important}.data-\\[active\\=true\\]\\:bg-bg-2[data-active=true]{background-color:var(--color-bg-2)!important}.data-\\[state\\=provisional\\]\\:border-dashed[data-state=provisional]{--tw-border-style:dashed!important;border-style:dashed!important}@media (prefers-reduced-motion:no-preference){.motion-safe\\:animate-\\[ci-skel_1\\.4s_var\\(--ease-in-out\\)_infinite\\]{animation:ci-skel 1.4s var(--ease-in-out) infinite!important}.motion-safe\\:animate-pulse{animation:var(--animate-pulse)!important}.motion-safe\\:animate-spin{animation:var(--animate-spin)!important}}@container (min-width:42rem){.\\@2xl\\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))!important}}@container (min-width:48rem){.\\@3xl\\:flex{display:flex!important}.\\@3xl\\:grid{display:grid!important}.\\@3xl\\:min-h-0{min-height:0!important}.\\@3xl\\:flex-1{flex:1!important}.\\@3xl\\:grid-cols-\\[minmax\\(300px\\,380px\\)_minmax\\(0\\,1fr\\)\\]{grid-template-columns:minmax(300px,380px) minmax(0,1fr)!important}.\\@3xl\\:overflow-hidden{overflow:hidden!important}.\\@3xl\\:overflow-y-auto{overflow-y:auto!important}.\\@3xl\\:overscroll-contain{overscroll-behavior:contain!important}.\\@3xl\\:border-e{border-inline-end-style:var(--tw-border-style)!important;border-inline-end-width:1px!important}.\\@3xl\\:border-t-0{border-top-style:var(--tw-border-style)!important;border-top-width:0!important}}@container (min-width:56rem){.\\@4xl\\:flex{display:flex!important}}.\\[\\&\\>span\\+span\\]\\:text-\\[11px\\]>span+span{font-size:11px!important}.\\[\\&\\>span\\+span\\]\\:font-normal>span+span{--tw-font-weight:var(--font-weight-normal)!important;font-weight:var(--font-weight-normal)!important}.\\[\\&\\>span\\+span\\]\\:text-fg-dim>span+span{color:var(--color-fg-dim)!important}}@layer components{.ci-src{border:1px solid light-dark(var(--ci-src-brand),var(--ci-src-brand));align-items:center;gap:.1875rem;padding-block:1px;padding-inline:.3125rem;display:inline-flex}@supports (color:color-mix(in lab, red, red)){.ci-src{border:1px solid light-dark(color-mix(in oklch, var(--ci-src-brand) 55%, oklch(40% 0 none)),color-mix(in oklch, var(--ci-src-brand) 45%, transparent))}}.ci-src{background:light-dark(var(--ci-src-brand),var(--ci-src-brand));border-radius:999px}@supports (color:color-mix(in lab, red, red)){.ci-src{background:light-dark(color-mix(in oklch, var(--ci-src-brand) 16%, oklch(100% 0 none)),color-mix(in oklch, var(--ci-src-brand) 14%, transparent))}}.ci-src{color:light-dark(var(--ci-src-brand),var(--ci-src-color,var(--color-fg)))}@supports (color:color-mix(in lab, red, red)){.ci-src{color:light-dark(color-mix(in oklch, var(--ci-src-brand) 55%, oklch(20% 0 none)),var(--ci-src-color,var(--color-fg)))}}.ci-src{font-variant-numeric:tabular-nums;white-space:nowrap;font-size:.625rem;line-height:1.4}.ci-src__word{color:light-dark(var(--ci-src-brand),var(--ci-src-color,var(--color-fg)))}@supports (color:color-mix(in lab, red, red)){.ci-src__word{color:light-dark(color-mix(in oklch, var(--ci-src-brand) 55%, oklch(20% 0 none)),var(--ci-src-color,var(--color-fg)))}}.ci-status{background:light-dark(currentColor,currentColor);border:1px solid;border-radius:999px;align-items:center;gap:.25rem;padding-block:1px;padding-inline:.375rem .3125rem;display:inline-flex}@supports (color:color-mix(in lab, red, red)){.ci-status{background:light-dark(color-mix(in oklch, currentColor 12%, oklch(100% 0 none)),color-mix(in oklch, currentColor 14%, transparent))}}.ci-status{font-variant-numeric:tabular-nums;font-size:.625rem;line-height:1.5}.ci-status:before{content:"";background:currentColor;border-radius:50%;block-size:6px;inline-size:6px}.ci-status--ok{color:var(--color-ok)}.ci-status--error{color:var(--color-err)}.ci-status--unknown{color:var(--color-warn)}.ci-status--running{color:var(--color-info)}.ci-status--running:before{animation:ci-breathe 1.6s var(--ease-in-out) infinite}@keyframes ci-breathe{0%,to{opacity:1;box-shadow:0 0 0 0 color-mix(in oklch, currentColor 55%, transparent)}50%{opacity:.55;box-shadow:0 0 0 4px color-mix(in oklch, currentColor 0%, transparent)}}@media (prefers-reduced-motion:reduce){.ci-status--running:before{animation:none}}.ci-ask{margin:0}.ci-ask__label{color:var(--color-fg-dim);margin-block-end:.375rem;font-size:11px;font-weight:500;display:block}.ci-ask__text{border:1px solid var(--color-accent);margin:0;padding-block:.625rem;padding-inline:.875rem}@supports (color:color-mix(in lab, red, red)){.ci-ask__text{border:1px solid color-mix(in oklch, var(--color-accent) 22%, transparent)}}.ci-ask__text{background:var(--color-accent);border-radius:10px}@supports (color:color-mix(in lab, red, red)){.ci-ask__text{background:color-mix(in oklch, var(--color-accent) 7%, var(--color-bg-1))}}.ci-ask__text{color:var(--color-fg);overscroll-behavior:contain;white-space:pre-wrap;overflow-wrap:break-word;max-block-size:7.5rem;font-size:13.5px;line-height:1.65;overflow-y:auto}.ci-pre{border:.5px solid var(--color-line-soft);background:var(--color-bg-2);font-family:var(--font-mono);white-space:pre-wrap;overflow-wrap:break-word;border-radius:5px;margin-block:2px 0;padding:6px 8px;font-size:11px;line-height:1.5;overflow-x:auto}[data-tip]{cursor:help}[data-tip]:hover:after,[data-tip]:focus-visible:after{content:attr(data-tip);z-index:20;border:.5px solid var(--color-line);background:var(--color-bg-2);max-width:340px;color:var(--color-fg);pointer-events:none;white-space:normal;border-radius:6px;padding:6px 8px;font-family:inherit;font-size:10.5px;font-style:normal;line-height:1.45;position:absolute;top:calc(100% + 6px);left:0;box-shadow:0 6px 18px #00000059}@keyframes ci-skel{0%{background-position:100% 0}to{background-position:-100% 0}}}.ci-btn,.ci-icon-btn,.ci-row,.ci-search{appearance:none;color:var(--color-fg);font:inherit;text-align:start;cursor:pointer;transition:background-color .14s var(--ease-out), border-color .14s var(--ease-out), color .14s var(--ease-out);background:0 0;border:1px solid #0000;margin:0}.ci-btn{border-color:var(--color-line);background:var(--color-bg-1);white-space:nowrap;border-radius:7px;align-items:center;gap:6px;block-size:28px;padding-inline:10px;font-size:12px;font-weight:500;display:inline-flex}.ci-btn:hover:not(:disabled){background:var(--color-bg-2)}.ci-btn--primary{background:var(--color-accent);color:#fff;border-color:#0000}.ci-btn--primary:hover:not(:disabled){background:var(--color-accent)}@supports (color:color-mix(in lab, red, red)){.ci-btn--primary:hover:not(:disabled){background:color-mix(in oklch, var(--color-accent) 86%, black)}}.ci-btn--quiet{color:var(--color-accent);background:0 0;border-color:#0000}.ci-btn--quiet:hover:not(:disabled){background:var(--color-accent)}@supports (color:color-mix(in lab, red, red)){.ci-btn--quiet:hover:not(:disabled){background:color-mix(in oklch, var(--color-accent) 10%, transparent)}}.ci-btn:disabled,.ci-icon-btn:disabled{opacity:.5;cursor:default}.ci-icon-btn{block-size:28px;inline-size:28px;color:var(--color-fg-dim);border-radius:7px;place-items:center;padding:0;display:inline-grid}.ci-icon-btn:hover:not(:disabled),.ci-icon-btn[aria-pressed=true]{background:var(--color-hover);color:var(--color-fg)}.ci-search{border-color:var(--color-line-soft);background:var(--color-bg-1);block-size:30px;color:var(--color-fg-3);border-radius:8px;align-items:center;gap:8px;padding-inline:10px 6px;font-size:12px;display:flex}.ci-search:hover{border-color:var(--color-line);color:var(--color-fg-dim)}.ci-row{border-radius:8px;inline-size:100%;min-inline-size:0;display:block}@media (hover:hover) and (pointer:fine){.ci-row:hover{background:var(--color-hover)}}.ci-row[data-selected=true]{background:var(--color-accent)}@supports (color:color-mix(in lab, red, red)){.ci-row[data-selected=true]{background:color-mix(in oklch, var(--color-accent) 14%, transparent)}}.ci-row:focus-visible,.ci-btn:focus-visible,.ci-icon-btn:focus-visible,.ci-search:focus-visible{outline:2px solid var(--color-accent);outline-offset:-2px}.ci-chevron{transition:transform .16s var(--ease-out)}[aria-expanded=true]>*>.ci-chevron,[aria-expanded=true]>.ci-chevron{transform:rotate(90deg)}.ci-fold>summary{cursor:pointer;list-style:none}.ci-fold>summary::-webkit-details-marker{display:none}.ci-fold[open]>summary .ci-chevron{transform:rotate(90deg)}.ci-dot{border:1.5px solid var(--color-bg);background:var(--color-accent);cursor:pointer;block-size:7px;inline-size:7px;transition:transform .14s var(--ease-out);border-radius:50%;margin:-3.5px 0 0 -3.5px;padding:0;position:absolute}.ci-dot:after{content:"";border-radius:50%;position:absolute;inset:-6px}.ci-dot:hover{transform:scale(1.5)}.ci-dot[data-selected=true]{block-size:11px;inline-size:11px;box-shadow:0 0 0 3px var(--color-accent);border-width:2px;margin:-5.5px 0 0 -5.5px}@supports (color:color-mix(in lab, red, red)){.ci-dot[data-selected=true]{box-shadow:0 0 0 3px color-mix(in oklch, var(--color-accent) 30%, transparent)}}.ci-scroll{scrollbar-width:thin;scrollbar-color:var(--color-line) transparent}@media (prefers-reduced-motion:reduce){.ci-btn,.ci-icon-btn,.ci-row,.ci-search,.ci-chevron{transition:none}}@layer base{*,:before,:after{box-sizing:border-box}:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--color-accent));outline-offset:1px;border-radius:6px}button,a,input,select,textarea{color:inherit;font:inherit;background:0 0;border:0}}:scope[data-dsh-sessions-insight-view] :is(h1,h2,h3,h4,h5,h6){font-family:revert;font-weight:revert;letter-spacing:revert;line-height:revert;margin:revert}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.5}}\n}@property --tw-rotate-x{syntax:"*";inherits:false}@property --tw-rotate-y{syntax:"*";inherits:false}@property --tw-rotate-z{syntax:"*";inherits:false}@property --tw-skew-x{syntax:"*";inherits:false}@property --tw-skew-y{syntax:"*";inherits:false}@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}@property --tw-leading{syntax:"*";inherits:false}@property --tw-font-weight{syntax:"*";inherits:false}@property --tw-tracking{syntax:"*";inherits:false}@property --tw-ordinal{syntax:"*";inherits:false}@property --tw-slashed-zero{syntax:"*";inherits:false}@property --tw-numeric-figure{syntax:"*";inherits:false}@property --tw-numeric-spacing{syntax:"*";inherits:false}@property --tw-numeric-fraction{syntax:"*";inherits:false}@property --tw-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-shadow-color{syntax:"*";inherits:false}@property --tw-shadow-alpha{syntax:"<percentage>";inherits:false;initial-value:100%}@property --tw-inset-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-inset-shadow-color{syntax:"*";inherits:false}@property --tw-inset-shadow-alpha{syntax:"<percentage>";inherits:false;initial-value:100%}@property --tw-ring-color{syntax:"*";inherits:false}@property --tw-ring-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-inset-ring-color{syntax:"*";inherits:false}@property --tw-inset-ring-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-ring-inset{syntax:"*";inherits:false}@property --tw-ring-offset-width{syntax:"<length>";inherits:false;initial-value:0}@property --tw-ring-offset-color{syntax:"*";inherits:false;initial-value:#fff}@property --tw-ring-offset-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-outline-style{syntax:"*";inherits:false;initial-value:solid}@property --tw-blur{syntax:"*";inherits:false}@property --tw-brightness{syntax:"*";inherits:false}@property --tw-contrast{syntax:"*";inherits:false}@property --tw-grayscale{syntax:"*";inherits:false}@property --tw-hue-rotate{syntax:"*";inherits:false}@property --tw-invert{syntax:"*";inherits:false}@property --tw-opacity{syntax:"*";inherits:false}@property --tw-saturate{syntax:"*";inherits:false}@property --tw-sepia{syntax:"*";inherits:false}@property --tw-drop-shadow{syntax:"*";inherits:false}@property --tw-drop-shadow-color{syntax:"*";inherits:false}@property --tw-drop-shadow-alpha{syntax:"<percentage>";inherits:false;initial-value:100%}@property --tw-drop-shadow-size{syntax:"*";inherits:false}@property --tw-duration{syntax:"*";inherits:false}@property --tw-ease{syntax:"*";inherits:false}@property --tw-content{syntax:"*";inherits:false;initial-value:""}'
    //#endregion
    //#region src/client/styles.ts
    /**
     * The panel's stylesheet.
     *
     * The shell loads this bundle as a module factory, so the only place a style
     * element may be created is inside that factory (a side effect at package
     * module scope would run before the factory is ever called). The once-per-page
     * mechanics live in `@cyrusdoyle/dsh-plugin-kit-client`; what stays here is the element id
     * this plugin owns and the CSS it carries.
     *
     * The CSS itself is compiled from `theme/app.css` by
     * `tooling/scripts/build-css.mjs`: Tailwind v4 without preflight, utilities
     * scoped to `.ci-panel`, and the component layer that carries the panel's own
     * rules.
     *
     * @module @cyrusdoyle/dsh-sessions-insight/client/styles
     */
    /** Id of the single style element this plugin owns. */
    const STYLE_ID = "dsh-sessions-insight-styles"
    /**
     * Create the style element once per page.
     * @returns nothing; a document without a head (tests, SSR) is left alone.
     */
    function injectStyles() {
      injectStylesOnce(STYLE_ID, TAILWIND_CSS)
    }
    //#endregion
    //#region src/client/format.ts
    /**
     * Presentation arithmetic. Nothing here decides meaning: it only turns the IR's
     * numbers into text the panel can print without losing precision, and keeps
     * every rounding rule in one place.
     *
     * @module @cyrusdoyle/dsh-sessions-insight/client/format
     */
    const GROUPED = new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 })
    /** The currency sign, kept out of the literals so no tooling mangles it. */
    const DOLLAR = String.fromCharCode(36)
    /**
     * Group-separated integer, the form used wherever a token count is a claim.
     * @param value - token count; may be negative (an over-counted defect).
     */
    function formatTokens(value) {
      return GROUPED.format(Math.round(value))
    }
    /**
     * Short form for a bar label: 980 / 4.2k / 423k / 1.1M.
     * @param value - token count.
     */
    function compactTokens(value) {
      const abs = Math.abs(value)
      const sign = value < 0 ? "-" : ""
      if (abs < 1e3) return sign + String(Math.round(abs))
      if (abs < 1e4) return `${sign + (abs / 1e3).toFixed(1)}k`
      if (abs < 1e6) return `${sign + String(Math.round(abs / 1e3))}k`
      return `${sign + (abs / 1e6).toFixed(1)}M`
    }
    /**
     * US-dollar amount, with enough decimals to keep a single turn readable.
     * @param usd - amount in USD.
     */
    function formatUsd(usd) {
      return DOLLAR + usd.toFixed(usd < 0.01 ? 4 : 3)
    }
    /**
     * Money in its own currency, never converted.
     * @param amount - amount in `currency`.
     * @param currency - ISO code; unknown codes fall back to the code itself.
     */
    function formatMoney(amount, currency) {
      const symbol = currency === "CNY" ? "¥" : currency === "USD" ? DOLLAR : ""
      const decimals = Math.abs(amount) >= 1 ? 2 : 4
      return symbol + amount.toFixed(decimals)
    }
    /**
     * Share of a whole, as a percentage string with one decimal.
     * @param part - numerator.
     * @param whole - denominator; a non-positive whole answers `—`.
     */
    function formatShare(part, whole) {
      if (!Number.isFinite(whole) || whole <= 0) return "—"
      return `${(Math.round((part / whole) * 1e3) / 10).toFixed(1)}%`
    }
    /**
     * Reconciliation factor, printed the way the ADR talks about it.
     * @param factor - `reconciled.factor`.
     */
    function formatFactor(factor) {
      return `×${(Math.round(factor * 1e3) / 1e3).toFixed(3)}`
    }
    /**
     * File size.
     * @param bytes - byte count.
     */
    function formatBytes(bytes) {
      if (bytes < 1024) return `${String(bytes)} B`
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
      return `${(bytes / 1048576).toFixed(1)} MB`
    }
    const TIME = new Intl.DateTimeFormat(void 0, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    /**
     * Local wall-clock time of an epoch value.
     * @param epoch - milliseconds since the Unix epoch.
     */
    function formatTime(epoch) {
      if (!Number.isFinite(epoch) || epoch <= 0) return "—"
      return TIME.format(new Date(epoch))
    }
    /**
     * A row has one narrow line to share with the title, so the timestamp keeps
     * only the parts that still tell two neighbours apart: `HH:mm` today, `MM-DD
     * HH:mm` this year, `YYYY-MM-DD` before that.
     * @param epoch - milliseconds since the Unix epoch.
     * @param now - reference time, injectable for tests.
     * @returns the shortest unambiguous local form, or `—` for an invalid epoch.
     */
    function formatShortTime(epoch, now = Date.now()) {
      if (!Number.isFinite(epoch) || epoch <= 0) return "—"
      const date = new Date(epoch)
      const today = new Date(now)
      const pad = (value) => String(value).padStart(2, "0")
      const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
      if (date.getFullYear() !== today.getFullYear())
        return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      if (date.getMonth() === today.getMonth() && date.getDate() === today.getDate()) return clock
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}`
    }
    /**
     * Duration between two epoch values, in the unit a reader scans fastest.
     * @param from - start, epoch milliseconds.
     * @param to - end, epoch milliseconds; omitted means "unknown".
     */
    function formatDuration(from, to) {
      if (to === void 0 || !Number.isFinite(to) || to < from) return "—"
      const ms = to - from
      if (ms < 1e3) return `${String(Math.round(ms))} ms`
      if (ms < 6e4) return `${(ms / 1e3).toFixed(1)} s`
      const minutes = Math.floor(ms / 6e4)
      return `${String(minutes)} min ${String(Math.round((ms % 6e4) / 1e3))} s`
    }
    /**
     * Split a workdir so the leaf survives truncation.
     *
     * A column 300px wide cannot show `/Users/me/codes/hubs/portfolio` whole, and
     * truncating its tail hides exactly the segment that identifies the project. The
     * panel therefore renders the parent dimmed on one line and the leaf on the
     * next, so the leaf is never the part that gets cut.
     * @param path - a filesystem path.
     */
    function splitPath(path) {
      if (path === "")
        return {
          parent: "",
          leaf: "",
        }
      const trimmed = path.replace(/[\\/]+$/, "")
      const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"))
      if (index <= 0)
        return {
          parent: "",
          leaf: trimmed,
        }
      return {
        parent: trimmed.slice(0, index + 1),
        leaf: trimmed.slice(index + 1),
      }
    }
    /**
     * Last path segment.
     * @param path - a filesystem path.
     */
    function basename(path) {
      const trimmed = path.replace(/[\\/]+$/, "")
      const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"))
      return index < 0 ? trimmed : trimmed.slice(index + 1)
    }
    /**
     * Longest text a cell prints before the caller has to offer an expansion.
     * @param text - candidate.
     * @param limit - maximum characters.
     */
    function clip(text, limit) {
      return text.length <= limit ? text : text.slice(0, limit)
    }
    /**
     * Collapse the home directory to `~`, the way a terminal prints it.
     * @param path - a filesystem path (POSIX or Windows).
     * @returns the path with `/Users/<me>`, `/home/<me>` or `C:\Users\<me>` as `~`.
     */
    function tildePath(path) {
      return path.replace(/^(\/Users\/[^/]+|\/home\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)(?=[\\/]|$)/, "~")
    }
    function sameSession(a, b) {
      return a?.source === b?.source && a?.id === b?.id
    }
    function applySessionMetadata$1(session, value) {
      if (value === void 0 || !sameSession(session, value.metadata)) return session
      const next = { ...session }
      if (value.displayTitle === void 0) delete next.title
      else next.title = value.displayTitle
      return next
    }
    async function readTurnPrefix(api, ref, prefix, signal, current, publish, target) {
      while (current() && !signal.aborted && prefix.offset < prefix.total) {
        if (target !== void 0 && prefix.turns.some((turn) => turn.index === target)) break
        const result = await api.session(ref.id, prefix.offset, target === void 0 ? 40 : 200, ref.source, signal)
        if (!current() || signal.aborted) return void 0
        if (!result.ok) return result
        const page = result.value.session.turns
        if (page.length === 0) break
        const turns = new Map(prefix.turns.map((turn) => [turn.index, turn]))
        for (const turn of page) if (!turns.has(turn.index)) turns.set(turn.index, turn)
        prefix = {
          turns: [...turns.values()].toSorted((a, b) => a.index - b.index),
          offset: prefix.offset + page.length,
          total: prefix.total,
        }
        publish(prefix)
        if (target === void 0) break
      }
    }
    function useSessionDetail(api, selected) {
      const [detail, setDetail] = (0, react.useState)({ kind: "idle" })
      const [cost, setCost] = (0, react.useState)(null)
      const [selectedTurn, setSelectedTurn] = (0, react.useState)(null)
      const [toolsExpanded, setToolsExpanded] = (0, react.useState)(false)
      const reading = (0, react.useRef)(null)
      const identity = (0, react.useRef)(selected)
      const metadata = (0, react.useRef)(/* @__PURE__ */ new Map())
      const jumpGeneration = (0, react.useRef)(0)
      const source = selected?.source
      const id = selected?.id
      ;(0, react.useLayoutEffect)(() => {
        identity.current = selected
        if (!sameSession(reading.current?.ref ?? null, selected)) reading.current?.controller.abort()
      }, [selected])
      const overlaySession = (0, react.useCallback)(
        (session) => applySessionMetadata$1(session, metadata.current.get(`${session.source}:${session.id}`)),
        [],
      )
      const overlay = (0, react.useCallback)(
        (data) => {
          const session = overlaySession(data.session)
          return session === data.session
            ? data
            : {
                ...data,
                session,
              }
        },
        [overlaySession],
      )
      ;(0, react.useEffect)(() => {
        setCost(null)
        setSelectedTurn(null)
        setToolsExpanded(false)
        if (source === void 0 || id === void 0) {
          reading.current = null
          setDetail({ kind: "idle" })
          return
        }
        const ref = {
          source,
          id,
        }
        const controller = new AbortController()
        const active = {
          ref,
          controller,
          ready: false,
          prefix: {
            turns: [],
            offset: 0,
            total: 0,
          },
        }
        reading.current = active
        const current = () => reading.current === active && sameSession(identity.current, ref)
        setDetail({
          kind: "loading",
          ref,
        })
        api.cost(source, id, controller.signal).then((result) => {
          if (!controller.signal.aborted && current()) setCost(result.ok ? result.value : null)
        })
        api.session(id, 0, 40, source, controller.signal).then((result) => {
          if (controller.signal.aborted || !current()) return
          if (!result.ok) {
            setDetail({
              kind: "failed",
              ref,
              failure: result,
            })
            return
          }
          const turns = result.value.session.turns
          active.ready = true
          active.prefix = {
            turns,
            offset: turns.length,
            total: result.value.turnCount,
          }
          setDetail({
            kind: "ready",
            ref,
            data: overlay(result.value),
            turns,
            loadingMore: false,
          })
          setSelectedTurn(turns.find((turn) => turn.attribution.residual !== void 0)?.index ?? turns[0]?.index ?? null)
        })
        return () => controller.abort()
      }, [api, source, id, overlay])
      const page = (0, react.useCallback)(
        async (target) => {
          const active = reading.current
          if (active === null || !active.ready) return
          const current = () =>
            reading.current === active && !active.controller.signal.aborted && sameSession(identity.current, active.ref)
          if (!current()) return
          while (active.paging !== void 0) {
            await active.paging
            if (!current() || target === void 0) return
          }
          if (target !== void 0 && active.prefix.turns.some((turn) => turn.index === target)) return
          const update = (failure, loadingMore = false) => {
            if (!current()) return
            setDetail((previous) => {
              if (!current() || previous.kind !== "ready" || !sameSession(previous.ref, active.ref)) return previous
              const next = {
                ...previous,
                data: overlay(previous.data),
                turns: active.prefix.turns,
                loadingMore,
              }
              delete next.moreFailure
              if (failure !== void 0) next.moreFailure = failure
              return next
            })
          }
          update(void 0, true)
          const request = readTurnPrefix(
            api,
            active.ref,
            active.prefix,
            active.controller.signal,
            current,
            (prefix) => {
              active.prefix = prefix
              update(void 0, true)
            },
            target,
          ).then((failure) => {
            update(failure)
          })
          active.paging = request
          await request
          if (active.paging === request) delete active.paging
        },
        [api, overlay],
      )
      return {
        detail,
        cost,
        selectedTurn,
        setSelectedTurn,
        toolsExpanded,
        setToolsExpanded,
        loadMore: (0, react.useCallback)(() => {
          page()
        }, [page]),
        jumpTurn: (0, react.useCallback)(
          async (index) => {
            const generation = ++jumpGeneration.current
            const active = reading.current
            await page(index)
            if (
              generation !== jumpGeneration.current ||
              active === null ||
              reading.current !== active ||
              active.controller.signal.aborted ||
              !sameSession(identity.current, active.ref)
            )
              return
            if (active.prefix.turns.some((turn) => turn.index === index)) setSelectedTurn(index)
          },
          [page],
        ),
        onMetadataChanged: (0, react.useCallback)(
          (value) => {
            const ref = value.metadata
            metadata.current.set(`${ref.source}:${ref.id}`, value)
            setDetail((previous) =>
              previous.kind !== "ready" || !sameSession(previous.ref, ref)
                ? previous
                : {
                    ...previous,
                    data: overlay(previous.data),
                  },
            )
          },
          [overlay],
        ),
        overlaySession,
      }
    }
    //#endregion
    //#region src/client/ui/states.tsx
    /** The shimmer shared by every skeleton block. */
    const SHIMMER =
      "bg-[linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))] bg-[length:200%_100%] motion-safe:animate-[ci-skel_1.4s_var(--ease-in-out)_infinite]"
    /**
     * One skeleton block.
     * @param props.className - size and shape utilities.
     * @returns the block.
     */
    function Skeleton({ className }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
        className: `${SHIMMER} ${className}`,
        "aria-hidden": "true",
      })
    }
    /**
     * Skeleton for the project tree.
     * @param props.label - what is being read, printed once.
     * @returns the rows.
     */
    function TreeSkeleton({ label }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: "flex flex-col gap-1 px-2 py-2",
        "aria-busy": "true",
        role: "status",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
            className: "m-0 px-1.5 pb-1 text-[11.5px] text-fg-dim",
            children: label,
          }),
          [0, 1, 2].map((group) =>
            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
              "div",
              {
                className: "flex flex-col gap-1.5 py-1",
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-[86%] rounded-lg" }),
                  group === 0
                    ? [72, 64, 70, 58].map((width) =>
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                          Skeleton,
                          { className: "ms-5 h-8 rounded-lg" },
                          width,
                        ),
                      )
                    : null,
                ],
              },
              group,
            ),
          ),
        ],
      })
    }
    /**
     * Skeleton for the session pane: header, tiles, chart, then rows beside a
     * detail column.
     * @param props.label - what is being read, printed once.
     * @returns the skeleton, filling the pane.
     */
    function SessionSkeleton({ label }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: "flex h-full min-h-0 flex-col",
        "aria-busy": "true",
        role: "status",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "flex flex-col gap-3 border-b border-line-soft px-5 pt-4 pb-4",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
                className: "m-0 flex items-center gap-2 text-[11.5px] text-fg-dim",
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                    className: "inline-block size-1.5 rounded-full bg-accent motion-safe:animate-pulse",
                    "aria-hidden": "true",
                  }),
                  label,
                ],
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-[46%] rounded-[5px]" }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-3.5 w-[68%] rounded-[4px]" }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
                className: "grid grid-cols-2 gap-2 @2xl:grid-cols-4",
                children: [0, 1, 2, 3].map((tile) =>
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-[74px] rounded-[10px]" }, tile),
                ),
              }),
            ],
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "grid min-h-0 flex-1 grid-cols-1 @3xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                className: "flex flex-col gap-2 border-line-soft p-3 @3xl:border-e",
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-28 rounded-[10px]" }),
                  [0, 1, 2, 3, 4, 5].map((row) =>
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-14 rounded-lg" }, row),
                  ),
                ],
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                className: "hidden flex-col gap-3 p-4 @3xl:flex",
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-32 rounded-[5px]" }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-20 rounded-[10px]" }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-44 rounded-[10px]" }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-36 rounded-[10px]" }),
                ],
              }),
            ],
          }),
        ],
      })
    }
    /**
     * Empty placeholder: a fact plus the next step, never a bare "no data".
     * @param props.title - what is missing.
     * @param props.hint - what the reader can do or expect.
     * @param props.center - centre it in the available space (pane-level states).
     * @returns the block.
     */
    function EmptyBlock({ title, hint, center = false }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: center
          ? "flex h-full min-h-40 flex-col items-center justify-center gap-1.5 p-6 text-center text-[12.5px] text-fg-dim"
          : "flex flex-col items-start gap-1.5 px-4 py-4 text-[12.5px] text-fg-dim",
        role: "status",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
            className: "m-0 font-medium text-fg",
            children: title,
          }),
          hint === void 0
            ? null
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "m-0 max-w-[44ch] text-[11.5px]",
                children: hint,
              }),
        ],
      })
    }
    /**
     * Failure placeholder with a retry.
     * @param props.title - what failed.
     * @param props.detail - the classified failure detail.
     * @param props.onRetry - retry callback.
     * @returns the block.
     */
    function ErrorBlock({ title, detail, onRetry }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: "flex h-full min-h-40 flex-col items-center justify-center gap-2 p-6 text-center",
        role: "alert",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
            className: "m-0 max-w-[60ch] text-[12.5px] text-err",
            children: title,
          }),
          detail === void 0
            ? null
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "m-0 text-[11.5px] text-fg-dim",
                children: detail,
              }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
            type: "button",
            className: "ci-btn",
            onClick: onRetry,
            children: t("panel.retry"),
          }),
        ],
      })
    }
    /**
     * Inline notice used for per-source failures, so one source never blanks the
     * others.
     * @param props.children - sentence.
     * @returns the notice.
     */
    function Notice({ children }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
        className: "m-0 rounded-lg border border-warn/40 bg-warn/8 px-3 py-2 text-[11.5px] text-warn",
        role: "note",
        children,
      })
    }
    //#endregion
    //#region src/client/ui/handoff.tsx
    /**
     * The handoff dialog: preview the brief, pick the cwd, deliver it, and watch.
     *
     * The status line is the point of this component. `session.prompt` answers with
     * `accepted` long before any model has run, so the dialog shows
     * 「已投递，等待模型响应」 until a `turn/end` is observed, and only then either
     * 成功 (with the event's seq) or 失败 with the model-side reason and the fix
     * (docs/adr/0007-accepted-is-not-success.md).
     *
     * @module @cyrusdoyle/dsh-sessions-insight/client/handoff
     */
    const TERMINAL = /* @__PURE__ */ new Set(["succeeded", "failed"])
    /**
     * One handoff, start to finish.
     * @param props.api - client API.
     * @param props.source - source of the session being handed off.
     * @param props.id - that session's id.
     * @param props.onClose - close request.
     * @returns the dialog.
     */
    /**
     * Colour the status line by state without a stylesheet.
     * @param state - delivered / running / succeeded / failed.
     */
    function stateClass(state) {
      const base = "m-0 px-2.5 py-2 rounded-lg bg-bg-2 text-xs "
      if (state === "succeeded") return `${base}text-ok`
      if (state === "failed") return `${base}text-err`
      return `${base}text-warn`
    }
    function HandoffDialog({ api, source, id, onClose, onOpenSession }) {
      const [phase, setPhase] = (0, react.useState)({ kind: "preparing" })
      const [cwd, setCwd] = (0, react.useState)("")
      const [briefText, setBriefText] = (0, react.useState)("")
      const [progressError, setProgressError] = (0, react.useState)("")
      const [openError, setOpenError] = (0, react.useState)("")
      const alive = (0, react.useRef)(true)
      const pollTimer = (0, react.useRef)(void 0)
      ;(0, react.useEffect)(() => {
        alive.current = true
        const controller = new AbortController()
        api.handoffPrepare(source, id, controller.signal).then((result) => {
          if (controller.signal.aborted) return
          if (!result.ok) {
            setPhase({
              kind: "preview-failed",
              failure: result,
            })
            return
          }
          setPhase({
            kind: "ready",
            brief: result.value,
          })
          setCwd(result.value.defaultCwd)
          setBriefText(result.value.brief)
        })
        return () => {
          alive.current = false
          controller.abort()
          if (pollTimer.current !== void 0) window.clearTimeout(pollTimer.current)
        }
      }, [api, source, id])
      function apply(brief) {
        setPhase({
          kind: "applying",
          brief,
        })
        api
          .handoffApply({
            source,
            id,
            cwd,
            brief: briefText,
          })
          .then((result) => {
            if (!alive.current) return
            if (!result.ok) {
              setPhase({
                kind: "apply-failed",
                brief,
                failure: result,
              })
              return
            }
            const sessionId = result.value.sessionId
            const afterMs = result.value.pollAfterMs
            setPhase({
              kind: "applied",
              sessionId,
              status: {
                sessionId,
                state: "delivered",
                elapsedMs: 0,
              },
            })
            function poll() {
              api.handoffStatus(sessionId).then((next) => {
                if (!alive.current) return
                if (!next.ok) {
                  setProgressError(next.detail ?? next.error)
                  pollTimer.current = window.setTimeout(poll, afterMs)
                  return
                }
                setProgressError("")
                setPhase({
                  kind: "applied",
                  sessionId,
                  status: next.value,
                })
                if (!TERMINAL.has(next.value.state)) pollTimer.current = window.setTimeout(poll, afterMs)
              })
            }
            pollTimer.current = window.setTimeout(poll, afterMs)
          })
      }
      function stateLabel(status) {
        if (status.state === "delivered") return t("handoff.state.delivered")
        if (status.state === "running") return t("handoff.state.running")
        if (status.state === "succeeded") return t("handoff.state.succeeded")
        return t("handoff.state.failed")
      }
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
        className: "fixed inset-0 z-60 flex items-center justify-center bg-[rgb(0_0_0/55%)] p-4",
        onMouseDown: (event) => event.target === event.currentTarget && onClose(),
        children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
          className:
            "grid max-h-[90dvh] w-[min(820px,94vw)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[10px] border-[0.5px] border-line bg-bg-1 shadow-[0_18px_48px_rgb(0_0_0/50%)]",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": t("handoff.title"),
          children: [
            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
              className: "flex items-center gap-3 border-b border-line-soft px-5 py-4",
              children: [
                /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                  className: "flex min-w-0 flex-col gap-1",
                  children: [
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                      className: "text-[16px] font-semibold text-fg",
                      children: t("handoff.title"),
                    }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                      className: "text-[11px] text-fg-dim",
                      children: [source, " · ", id.slice(0, 8)],
                    }),
                  ],
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                  type: "button",
                  className:
                    "ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50",
                  onClick: onClose,
                  children: "Esc",
                }),
              ],
            }),
            phase.kind === "preparing"
              ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                  className: "flex min-h-0 flex-col gap-3 overflow-y-auto p-5",
                  role: "status",
                  "aria-busy": "true",
                  children: [
                    /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
                      className: "m-0 flex items-center gap-2 text-[12px] text-fg-dim",
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                          className: "size-1.5 rounded-full bg-accent motion-safe:animate-pulse",
                          "aria-hidden": "true",
                        }),
                        t("handoff.preparing"),
                      ],
                    }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-10 shrink-0 rounded-lg" }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, {
                      className: "h-3 w-3/4 shrink-0 rounded-sm",
                    }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, {
                      className: "h-5 w-1/2 shrink-0 rounded-sm",
                    }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, {
                      className: "h-[min(300px,42dvh)] shrink-0 rounded-lg",
                    }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
                      className: "border-t border-line-soft pt-3",
                      "aria-hidden": "true",
                      children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, {
                        className: "h-10 w-28 rounded-lg",
                      }),
                    }),
                  ],
                })
              : null,
            phase.kind === "preview-failed"
              ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                  children: t("session.error", { detail: phase.failure.detail ?? phase.failure.error }),
                })
              : null,
            phase.kind === "ready" || phase.kind === "applying" || phase.kind === "apply-failed"
              ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                  className: "flex min-h-0 flex-col gap-3 overflow-y-auto p-5",
                  children: [
                    /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
                      className: "flex flex-col gap-2 text-[12px] text-fg",
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("handoff.cwd") }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
                          className:
                            "w-full min-w-0 rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-[12px] text-fg",
                          value: cwd,
                          onChange: (event) => setCwd(event.target.value),
                          spellCheck: false,
                          "aria-describedby": "ci-handoff-cwd-hint",
                        }),
                      ],
                    }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                      className: "m-0 text-[11px] leading-relaxed text-fg-dim",
                      id: "ci-handoff-cwd-hint",
                      children: t("handoff.cwdHint"),
                    }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                      className: "flex flex-wrap gap-1.5",
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                          className:
                            "inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim",
                          children: t("handoff.files", { count: phase.brief.fileCount }),
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                          className:
                            "inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim",
                          children: t("handoff.decisions", { count: phase.brief.decisionCount }),
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                          className:
                            "inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim",
                          children: t("handoff.open", { count: phase.brief.openCount }),
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                          className:
                            "inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim",
                          children: t("handoff.commands", { count: phase.brief.commandCount }),
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                          className:
                            "inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim",
                          children: t("handoff.chars", { count: phase.brief.chars }),
                        }),
                      ],
                    }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
                      className: "flex flex-col gap-2 text-[12px] text-fg",
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("handoff.brief") }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
                          className:
                            "box-border max-h-[42dvh] min-h-40 w-full resize-y rounded-lg border border-line bg-bg p-3 font-mono text-[12px] leading-relaxed text-fg",
                          value: briefText,
                          onChange: (event) => setBriefText(event.target.value),
                          spellCheck: false,
                          rows: 14,
                        }),
                      ],
                    }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                      className: "flex flex-wrap items-center gap-2 border-t border-line-soft pt-3",
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                          type: "button",
                          className:
                            "cursor-pointer rounded-lg border border-accent bg-accent px-4 py-2.5 font-[inherit] text-[12px] font-medium text-white enabled:hover:brightness-110 disabled:cursor-default disabled:opacity-50",
                          onClick: () => apply(phase.brief),
                          disabled: phase.kind === "applying" || cwd.trim() === "" || briefText.trim() === "",
                          children: phase.kind === "applying" ? t("handoff.applying") : t("handoff.apply"),
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                          type: "button",
                          className:
                            "ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50",
                          disabled: true,
                          title: t("handoff.polishUnavailable"),
                          children: t("handoff.polish"),
                        }),
                      ],
                    }),
                    phase.kind === "apply-failed"
                      ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          children: t("handoff.applyFailed", { detail: phase.failure.detail ?? phase.failure.error }),
                        })
                      : null,
                  ],
                })
              : null,
            phase.kind === "applied"
              ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                  className: "flex min-h-0 flex-col gap-3 overflow-y-auto p-5",
                  children: [
                    /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
                      className: stateClass(phase.status.state),
                      "data-state": phase.status.state,
                      children: [stateLabel(phase.status), " · ", phase.sessionId.slice(0, 12)],
                    }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                      className: "m-0 text-[12px] text-fg-dim",
                      role: "status",
                      children: t("handoff.progress", {
                        seconds: Math.floor(phase.status.elapsedMs / 1e3),
                        count: phase.status.progress?.toolsCompleted ?? 0,
                      }),
                    }),
                    phase.status.state === "running"
                      ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          className: "m-0 text-[12px] text-fg",
                          children:
                            phase.status.progress?.tool === "ask_user_question"
                              ? t("handoff.waiting")
                              : phase.status.progress?.tool
                                ? t("handoff.tool", { tool: phase.status.progress.tool })
                                : t("handoff.thinking"),
                        })
                      : null,
                    phase.status.progress === void 0
                      ? null
                      : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          className: "m-0 text-[11px] text-fg-dim",
                          children: t("handoff.updated", {
                            time: new Date(phase.status.progress.updatedAt).toLocaleTimeString(
                              t("handoff.language") === "zh" ? "zh-CN" : "en-US",
                            ),
                          }),
                        }),
                    progressError === ""
                      ? null
                      : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          className: "m-0 text-[12px] text-warn",
                          role: "alert",
                          children: t("handoff.pollError", { detail: progressError }),
                        }),
                    openError === ""
                      ? null
                      : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          className: "m-0 text-[12px] text-err",
                          role: "alert",
                          children: t("handoff.openFailed", { detail: openError }),
                        }),
                    phase.status.reason === void 0
                      ? null
                      : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          className: "m-0 font-mono text-[11px] text-err",
                          children: t("handoff.reason", { reason: phase.status.reason }),
                        }),
                    phase.status.detail === void 0
                      ? null
                      : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          className: "my-1.5 text-[10.5px] text-fg-dim",
                          children: phase.status.detail,
                        }),
                    phase.status.seq === void 0
                      ? null
                      : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          className: "my-1.5 text-[10.5px] text-fg-dim",
                          children: t("handoff.evidence", { seq: phase.status.seq }),
                        }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                      className: "flex flex-wrap items-center gap-2",
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                          type: "button",
                          className:
                            "cursor-pointer rounded-lg border border-accent bg-accent px-4 py-2.5 text-[12px] text-white disabled:opacity-50",
                          disabled: onOpenSession === void 0,
                          onClick: () => {
                            setOpenError("")
                            Promise.resolve()
                              .then(() => onOpenSession?.(phase.sessionId))
                              .then(onClose)
                              .catch((error) => {
                                if (alive.current) setOpenError(error instanceof Error ? error.message : String(error))
                              })
                          },
                          children: t("handoff.openSession"),
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                          type: "button",
                          className:
                            "ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50",
                          onClick: onClose,
                          children: t("handoff.close"),
                        }),
                      ],
                    }),
                  ],
                })
              : null,
          ],
        }),
      })
    }
    /**
     * Cost line for one session: one amount per `(table, currency)` group, plus the
     * OpenRouter reference amount.
     *
     * Amounts are never converted or added — a provider-billed USD turn and an
     * OpenRouter reference amount stay two numbers, each labelled by its symbol, with
     * every table's provenance and every unlisted channel in the tooltip. A `≥`
     * prefix marks a lower bound when the session's primary prices hit an unlisted
     * channel.
     * @param props.cost - the Host's cost answer.
     * @returns the chip row.
     */
    function CostBadge({ cost, plain = false }) {
      const groups = cost.groups ?? []
      function materialise() {
        return groups.map((group) =>
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
            "span",
            {
              children: [
                cost.partial === true && groups.length === 1 ? t("cost.partialPrefix") : "",
                formatMoney(group.amount, group.currency),
              ],
            },
            group.tableId + group.currency,
          ),
        )
      }
      const referenceEntries = Object.entries(cost.reference?.byCurrency ?? {})
      const reference =
        referenceEntries.length === 1 && referenceEntries[0] !== void 0
          ? t("cost.reference", { amount: formatMoney(referenceEntries[0][1].amount, referenceEntries[0][0]) })
          : void 0
      const lines = []
      const used = new Set(groups.map((group) => group.tableId))
      if (cost.reference !== void 0 && cost.reference !== null) used.add(cost.reference.tableId)
      for (const id of used) {
        const table = cost.tables?.[id]
        if (table === void 0) continue
        lines.push(
          t("cost.tableLine", {
            id,
            source: table.pricing.source ?? "—",
            asOf: table.pricing.asOf,
          }),
        )
      }
      const channels = cost.unlistedChannels ?? []
      if (channels.length > 0) lines.push(t("cost.unlistedTip", { channels: channels.join("、") }))
      lines.push(t("cost.noConvert"))
      const tip = lines.join(" · ")
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
        className: plain
          ? "relative inline-flex items-baseline gap-1.5 whitespace-nowrap [&>span+span]:text-[11px] [&>span+span]:font-normal [&>span+span]:text-fg-dim"
          : "relative inline-flex items-center gap-1 rounded-sm border-[0.5px] border-line bg-transparent px-1.5 font-mono text-[10px] leading-4.25 whitespace-nowrap text-fg-dim data-[state=provisional]:border-dashed",
        "data-tip": tip,
        tabIndex: 0,
        "aria-label": tip === "" ? "cost" : tip,
        children: [
          groups.length === 0 ? "—" : materialise(),
          reference === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: reference }),
          cost.provisional === true
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className:
                  "ms-1 inline-flex items-center gap-1 rounded-sm border-[0.5px] border-dashed border-line bg-bg-2 px-1.25 text-[9.5px] leading-4.25 tracking-[0.02em] whitespace-nowrap text-fg-dim normal-case",
                children: t("cost.provisional"),
              })
            : null,
        ],
      })
    }
    /** localStorage key for the expanded set. */
    const TREE_STORAGE_KEY = "dsh-sessions-insight.tree"
    /** Identity of one session row. */
    function sessionKey(source, id) {
      return `${source}:${id}`
    }
    /**
     * Build project rows from the workdir answer, newest first.
     * @param workdirs - the Host's workdir entries.
     * @param split - path splitter (injected so the tests stay DOM-free).
     */
    function buildProjects(workdirs, split) {
      return workdirs.map((entry) => {
        const parts = split(entry.workdir)
        return {
          workdir: entry.workdir,
          leaf: parts.leaf === "" ? entry.workdir : parts.leaf,
          parent: parts.parent,
          counts: entry.sources.map((group) => ({
            source: group.source,
            sessions: group.sessions,
          })),
          lastUpdatedAt: entry.lastUpdatedAt,
        }
      })
    }
    /**
     * Flatten projects and their sessions into the visible row list.
     *
     * A collapsed project contributes exactly one row, so keyboard movement and the
     * "20 rows then show all" truncation are decided here rather than in the view.
     * @param input - projects, sessions and view state.
     * @returns the rows in paint order.
     */
    function flattenTree(input) {
      const pageSize = input.pageSize ?? 20
      const rows = []
      for (const project of input.projects) {
        const expanded = input.expanded.has(project.workdir)
        rows.push({
          kind: "project",
          key: `p:${project.workdir}`,
          project,
          expanded,
        })
        if (!expanded) continue
        if (input.loading.has(project.workdir)) {
          rows.push({
            kind: "skeleton",
            key: `l:${project.workdir}`,
            workdir: project.workdir,
            rows: 4,
          })
          continue
        }
        const sessions = input.sessions.get(project.workdir)
        if (sessions === void 0) {
          rows.push({
            kind: "skeleton",
            key: `l:${project.workdir}`,
            workdir: project.workdir,
            rows: 4,
          })
          continue
        }
        const limit = input.limits.get(project.workdir) ?? pageSize
        const shown = sessions.slice(0, limit)
        for (const session of shown) {
          const key = sessionKey(session.source, session.id)
          rows.push({
            kind: "session",
            key,
            workdir: project.workdir,
            session,
            selected: key === input.selected,
          })
        }
        if (sessions.length > shown.length)
          rows.push({
            kind: "more",
            key: `m:${project.workdir}`,
            workdir: project.workdir,
            hidden: sessions.length - shown.length,
          })
      }
      return rows
    }
    /**
     * Move the row cursor.
     * @param rows - visible rows.
     * @param from - current index (-1 when nothing is focused).
     * @param key - the arrow/Home/End key.
     * @returns the next index, clamped to the row list.
     */
    function nextIndex(rows, from, key) {
      if (rows.length === 0) return -1
      if (key === "Home") return 0
      if (key === "End") return rows.length - 1
      const delta = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0
      if (delta === 0) return from
      const start = from < 0 ? (delta > 0 ? -1 : rows.length) : from
      return Math.min(rows.length - 1, Math.max(0, start + delta))
    }
    /**
     * Read the persisted expanded set.
     *
     * Storage can be absent (SSR, private mode) or hold junk; both mean "no saved
     * state", never a crash.
     * @param storage - `localStorage`-like object, or undefined.
     */
    function readExpanded(storage) {
      if (storage === void 0) return []
      try {
        const raw = storage.getItem(TREE_STORAGE_KEY)
        if (raw === null) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter((value) => typeof value === "string")
      } catch {
        return []
      }
    }
    /**
     * Persist the expanded set.
     * @param storage - `localStorage`-like object, or undefined.
     * @param workdirs - expanded workdirs.
     */
    function writeExpanded(storage, workdirs) {
      if (storage === void 0) return
      try {
        storage.setItem(TREE_STORAGE_KEY, JSON.stringify(workdirs))
      } catch {}
    }
    /**
     * Keep the projects whose name or path contains the query.
     *
     * Case-insensitive and whitespace-trimmed; an empty query keeps everything, so
     * clearing the field restores the full tree without a second code path.
     * @param projects - all projects, in display order.
     * @param query - what the reader typed.
     * @returns the matching projects, order preserved.
     */
    function filterProjects(projects, query) {
      const needle = query.trim().toLowerCase()
      if (needle === "") return [...projects]
      return projects.filter((project) => project.workdir.toLowerCase().includes(needle))
    }
    //#endregion
    //#region src/client/state/management.ts
    /** Serial writes: successful rows are published immediately, failures do not stop the batch. */
    async function runSessionBatch(sessions, write, onSuccess, signal) {
      const failures = []
      for (const session of sessions) {
        if (signal?.aborted) break
        try {
          const result = await write(session)
          if (result.ok) onSuccess(session, result.value)
          else
            failures.push({
              session,
              reason: failureText(result),
            })
        } catch (error) {
          failures.push({
            session,
            reason: error instanceof Error ? error.message : String(error),
          })
        }
      }
      return failures
    }
    function applySessionMetadata(sessions, metadata, groupFilter) {
      return new Map(
        [...sessions].map(([workdir, list]) => [
          workdir,
          list.flatMap((session) => {
            const value = metadata.get(sessionKey(session.source, session.id))
            const group = value?.metadata.group ?? ""
            if (groupFilter !== "" && (groupFilter === "ungrouped" ? group !== "" : group !== groupFilter.slice(6)))
              return []
            const title = value?.displayTitle ?? value?.metadata.title ?? session.title
            return [
              (value?.metadata.title?.trim().length ?? 0) > 0
                ? {
                    ...session,
                    title,
                    named: true,
                  }
                : title === session.title
                  ? session
                  : {
                      ...session,
                      title,
                    },
            ]
          }),
        ]),
      )
    }
    //#endregion
    //#region src/client/state/selection.ts
    function emptySelection() {
      return {
        keys: /* @__PURE__ */ new Set(),
        anchor: null,
      }
    }
    /** Only painted session rows participate in Shift ranges and select-visible. */
    function visibleSessions(rows) {
      return rows.flatMap((row) => (row.kind === "session" ? [row.session] : []))
    }
    function toggleSelection(current, key, visible, shift = false) {
      const order = visible.map((session) => sessionKey(session.source, session.id))
      const end = order.indexOf(key)
      if (end < 0) return current
      const start = current.anchor === null ? -1 : order.indexOf(current.anchor)
      const keys = new Set(current.keys)
      if (shift && start >= 0) {
        const range = order.slice(Math.min(start, end), Math.max(start, end) + 1)
        for (const item of range)
          if (current.keys.has(key)) keys.delete(item)
          else keys.add(item)
        return {
          keys,
          anchor: current.anchor,
        }
      }
      if (keys.has(key)) keys.delete(key)
      else keys.add(key)
      return {
        keys,
        anchor: key,
      }
    }
    /** Add an explicitly labelled scope; never infer hidden rows from visible ones. */
    function selectSessions(current, sessions) {
      const keys = new Set(current.keys)
      for (const session of sessions) keys.add(sessionKey(session.source, session.id))
      return {
        keys,
        anchor: null,
      }
    }
    function removeSelection(current, key) {
      const keys = new Set(current.keys)
      keys.delete(key)
      return {
        keys,
        anchor: current.anchor === key ? null : current.anchor,
      }
    }
    function selectedSessions(selection, sessions) {
      const unique = /* @__PURE__ */ new Map()
      for (const list of sessions.values())
        for (const session of list) {
          const key = sessionKey(session.source, session.id)
          if (selection.keys.has(key)) unique.set(key, session)
        }
      return [...unique.values()]
    }
    //#endregion
    //#region src/client/state/use-session-management.ts
    function useSessionManagement(api, onDeleted, onMetadataChanged) {
      const managementApi = api
      const [editing, setEditing] = (0, react.useState)(false)
      const [selection, setSelection] = (0, react.useState)(emptySelection)
      const [metadata, setMetadata] = (0, react.useState)(/* @__PURE__ */ new Map())
      const [groupFilter, setGroupFilter] = (0, react.useState)("")
      const [dialog, setDialog] = (0, react.useState)(null)
      const [busy, setBusy] = (0, react.useState)(false)
      const [failures, setFailures] = (0, react.useState)([])
      const [metadataError, setMetadataError] = (0, react.useState)("")
      const [metadataLoading, setMetadataLoading] = (0, react.useState)(false)
      const [drafts, setDrafts] = (0, react.useState)(/* @__PURE__ */ new Map())
      const [suggestions, setSuggestions] = (0, react.useState)(/* @__PURE__ */ new Map())
      const [aiErrors, setAiErrors] = (0, react.useState)(/* @__PURE__ */ new Map())
      const [generating, setGenerating] = (0, react.useState)(false)
      const [progress, setProgress] = (0, react.useState)({
        done: 0,
        total: 0,
      })
      const loaded = (0, react.useRef)(false)
      const pending = (0, react.useRef)(null)
      const lock = (0, react.useRef)(false)
      const controller = (0, react.useRef)(new AbortController())
      const generation = (0, react.useRef)(null)
      const currentDialog = (0, react.useRef)(null)
      const serial = (0, react.useRef)(0)
      ;(0, react.useEffect)(() => {
        const lifetime = new AbortController()
        controller.current = lifetime
        return () => {
          lifetime.abort()
          generation.current?.abort()
          currentDialog.current = null
        }
      }, [])
      function stopGeneration() {
        generation.current?.abort()
        generation.current = null
        setGenerating(false)
      }
      function closeDialog() {
        if (lock.current) return
        stopGeneration()
        currentDialog.current = null
        setDialog(null)
      }
      function clearSelection() {
        setSelection(emptySelection())
        setFailures([])
      }
      function deleted(session) {
        if (!controller.current.signal.aborted)
          setSelection((current) => removeSelection(current, sessionKey(session.source, session.id)))
        onDeleted(session)
      }
      async function ensureMetadata() {
        if (controller.current.signal.aborted) return false
        if (loaded.current) return true
        if (pending.current !== null) return pending.current
        if (managementApi.metadata === void 0) {
          setMetadataError(t("management.unavailable"))
          return false
        }
        const signal = controller.current.signal
        setMetadataLoading(true)
        setMetadataError("")
        pending.current = (async () => {
          try {
            const result = await managementApi.metadata(signal)
            if (signal.aborted) return false
            if (!result.ok) {
              setMetadataError(failureText(result))
              return false
            }
            setMetadata((current) => {
              const next = new Map(
                result.value.entries.map((entry) => [sessionKey(entry.source, entry.id), { metadata: entry }]),
              )
              for (const [key, value] of current) next.set(key, value)
              return next
            })
            loaded.current = true
            return true
          } catch (error) {
            if (!signal.aborted) setMetadataError(error instanceof Error ? error.message : String(error))
            return false
          } finally {
            if (!signal.aborted) setMetadataLoading(false)
            pending.current = null
          }
        })()
        return pending.current
      }
      function toggleEditing() {
        if (lock.current) return
        setEditing(!editing)
        clearSelection()
        if (!editing) ensureMetadata()
      }
      function newDialog(kind, sessions, ai = false, skipped = 0) {
        if (lock.current || controller.current.signal.aborted) return null
        stopGeneration()
        const target = {
          serial: ++serial.current,
          kind,
          sessions: [...sessions],
          ai,
          skipped,
        }
        currentDialog.current = target
        setFailures([])
        setDrafts(/* @__PURE__ */ new Map())
        setSuggestions(/* @__PURE__ */ new Map())
        setAiErrors(/* @__PURE__ */ new Map())
        setProgress({
          done: 0,
          total: 0,
        })
        setDialog(target)
        ensureMetadata()
        return target
      }
      async function openDialog(kind, sessions) {
        if (sessions.length > 0) newDialog(kind, sessions)
      }
      async function generateTitles(sessions, target = currentDialog.current) {
        if (
          target === null ||
          currentDialog.current !== target ||
          controller.current.signal.aborted ||
          target.kind !== "rename" ||
          lock.current ||
          generation.current !== null ||
          sessions.length === 0
        )
          return
        if (!window.confirm(t("management.aiConfirm", { count: sessions.length }))) return
        const request = new AbortController()
        generation.current = request
        setGenerating(true)
        setProgress({
          done: 0,
          total: sessions.length,
        })
        const valid = () =>
          !request.signal.aborted && !controller.current.signal.aborted && currentDialog.current === target
        try {
          for (const session of sessions) {
            if (!valid()) break
            const key = sessionKey(session.source, session.id)
            setAiErrors((current) => {
              const next = new Map(current)
              next.delete(key)
              return next
            })
            try {
              if (managementApi.suggestTitle === void 0) throw new Error(t("management.aiUnavailable"))
              const result = await managementApi.suggestTitle(session.source, session.id, request.signal)
              if (!valid()) break
              if (!result.ok) throw new Error(failureText(result))
              setSuggestions((current) => new Map(current).set(key, result.value))
              setDrafts((current) => new Map(current).set(key, result.value.title))
            } catch (error) {
              if (!valid()) break
              setAiErrors((current) =>
                new Map(current).set(key, error instanceof Error ? error.message : String(error)),
              )
            }
            if (valid())
              setProgress((current) => ({
                ...current,
                done: current.done + 1,
              }))
          }
        } finally {
          if (generation.current === request) {
            generation.current = null
            if (!controller.current.signal.aborted) setGenerating(false)
          }
        }
      }
      async function openAiDialog(sessions, skipNamed = true) {
        if (sessions.length === 0) return
        const eligible = sessions.filter((session) => !skipNamed || session.named !== true)
        const target = newDialog("rename", eligible, true, sessions.length - eligible.length)
        if (target !== null) await generateTitles(eligible, target)
      }
      function editDraft(key, title) {
        setDrafts((current) => new Map(current).set(key, title))
      }
      async function deleteSessions(sessions) {
        if (
          lock.current ||
          controller.current.signal.aborted ||
          sessions.length === 0 ||
          !window.confirm(t("management.deleteConfirm", { count: sessions.length }))
        )
          return
        stopGeneration()
        const signal = controller.current.signal
        lock.current = true
        setBusy(true)
        setFailures([])
        try {
          const failed = await runSessionBatch(
            sessions,
            (session) => api.deleteSession(session.source, session.id),
            deleted,
            signal,
          )
          if (!signal.aborted) setFailures(failed)
        } finally {
          if (!signal.aborted) setBusy(false)
          lock.current = false
        }
      }
      async function save(names, group) {
        const target = currentDialog.current
        if (
          lock.current ||
          generation.current !== null ||
          target === null ||
          managementApi.updateMetadata === void 0 ||
          controller.current.signal.aborted
        )
          return
        const sessions =
          target.kind === "rename"
            ? target.sessions.filter((session) => names.has(sessionKey(session.source, session.id)))
            : target.sessions
        if (sessions.length === 0) return
        const signal = controller.current.signal
        lock.current = true
        setBusy(true)
        setFailures([])
        try {
          const failed = await runSessionBatch(
            sessions,
            (session) =>
              managementApi.updateMetadata({
                source: session.source,
                id: session.id,
                ...(target.kind === "rename"
                  ? { title: names.get(sessionKey(session.source, session.id)) }
                  : { group }),
              }),
            (session, value) => {
              if (!signal.aborted)
                setMetadata((current) => new Map(current).set(sessionKey(session.source, session.id), value))
              onMetadataChanged?.(value)
            },
            signal,
          )
          if (signal.aborted) return
          setFailures(failed)
          const failedKeys = new Set(failed.map(({ session }) => sessionKey(session.source, session.id)))
          const remaining = target.sessions.filter(
            (session) =>
              (!names.has(sessionKey(session.source, session.id)) && target.kind === "rename") ||
              failedKeys.has(sessionKey(session.source, session.id)),
          )
          const next =
            remaining.length === 0
              ? null
              : {
                  ...target,
                  sessions: remaining,
                }
          currentDialog.current = next
          setDialog(next)
        } finally {
          if (!signal.aborted) setBusy(false)
          lock.current = false
        }
      }
      return {
        editing,
        selection,
        setSelection,
        clearSelection,
        toggleEditing,
        metadata,
        metadataError,
        metadataLoading,
        ensureMetadata,
        groups: [
          ...new Set([...metadata.values()].flatMap((value) => (value.metadata.group ? [value.metadata.group] : []))),
        ].sort(),
        groupFilter,
        setGroupFilter: (value) => {
          setGroupFilter(value)
          clearSelection()
        },
        dialog,
        openDialog,
        openAiDialog,
        closeDialog,
        busy,
        failures,
        deleteSessions,
        deleted,
        save,
        drafts,
        editDraft,
        suggestions,
        aiErrors,
        generating,
        progress,
        generateTitles,
        stopGeneration,
      }
    }
    //#endregion
    //#region src/client/ui/icons.tsx
    /** Mark metadata for every source. */
    const SOURCE_MARKS = {
      claude: {
        brand: "#D97757",
        text: "color-mix(in srgb, #D97757 62%, white)",
        label: {
          zh: "Claude",
          en: "Claude",
        },
      },
      codex: {
        brand: "#10A37F",
        text: "color-mix(in srgb, #10A37F 62%, white)",
        label: {
          zh: "Codex",
          en: "Codex",
        },
      },
      dsh: {
        brand: "#4D6BFE",
        text: "color-mix(in srgb, #4D6BFE 62%, white)",
        label: {
          zh: "DSH",
          en: "DSH",
        },
      },
    }
    /**
     * The glyph for one source: sun, hexagon, waveform.
     * @param props.source - which corpus.
     * @param props.size - pixel size.
     * @param props.tone - 'brand' paints the brand colour, 'inherit' follows text.
     * @returns an inline SVG.
     */
    function SourceIcon({ source, size = 12, tone = "brand" }) {
      const mark = SOURCE_MARKS[source]
      const color = tone === "brand" ? mark.brand : "currentColor"
      if (source === "claude")
        return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
          width: size,
          height: size,
          viewBox: "0 0 16 16",
          "aria-hidden": "true",
          focusable: "false",
          children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
            stroke: color,
            strokeWidth: "1.6",
            strokeLinecap: "round",
            children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
              d: "M8 2.2v11.6M2.2 8h11.6M3.9 3.9l8.2 8.2M12.1 3.9l-8.2 8.2",
            }),
          }),
        })
      if (source === "codex")
        return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
          width: size,
          height: size,
          viewBox: "0 0 16 16",
          "aria-hidden": "true",
          focusable: "false",
          children: [
            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
              d: "M8 1.8l5.4 3.1v6.2L8 14.2 2.6 11.1V4.9z",
              fill: "none",
              stroke: color,
              strokeWidth: "1.5",
              strokeLinejoin: "round",
            }),
            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
              d: "M5.4 6.2L8 8.6l2.6-2.4M8 8.6v3.2",
              fill: "none",
              stroke: color,
              strokeWidth: "1.2",
              strokeLinecap: "round",
            }),
          ],
        })
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
        width: size,
        height: size,
        viewBox: "0 0 16 16",
        "aria-hidden": "true",
        focusable: "false",
        children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
          stroke: color,
          strokeWidth: "1.6",
          strokeLinecap: "round",
          children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
            d: "M2.4 8h1.6M6.2 5v6M8.8 3v10M11.4 5.6v4.8M14 7h-1.2",
          }),
        }),
      })
    }
    /** The interface glyphs the panel draws; 16-unit grid, stroked in currentColor. */
    const GLYPHS = {
      search: "M7.2 12.4a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4ZM11 11l3.2 3.2",
      refresh: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.6 2.4v2.9h-2.9",
      chevron: "M6 3.8 10.2 8 6 12.2",
      sidebar: "M2.5 3.5h11v9h-11zM6.2 3.5v9",
      folder: "M2 4.5c0-.6.4-1 1-1h3.1l1.4 1.5H13c.6 0 1 .4 1 1v6c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z",
      tool: "M10.4 2.6a3 3 0 0 0-3.7 3.9L2.6 10.6a1.3 1.3 0 0 0 1.8 1.8l4.1-4.1a3 3 0 0 0 3.9-3.7l-1.8 1.8-1.6-.4-.4-1.6z",
      branch: "M4.5 2.5v11M4.5 9.5c0-2.5 7-1.5 7-5M11.5 2.5v2",
      handoff: "M3 8h9M9 4.5 12.5 8 9 11.5",
      trash: "M2 4h12M6 4V2h4v2M4 4l1 10h6l1-10M7 6v5M9 6v5",
      close: "M4 4l8 8M12 4l-8 8",
    }
    /**
     * One interface glyph.
     * @param props.name - which glyph.
     * @param props.size - pixel edge, default 14.
     * @param props.className - extra classes (e.g. `ci-chevron`).
     * @returns a decorative inline SVG.
     */
    function Glyph({ name, size = 14, className }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
        className,
        width: size,
        height: size,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.4",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        focusable: "false",
        children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: GLYPHS[name] }),
      })
    }
    /**
     * The product mark: a magnifier over three context lines, on an accent tile.
     * @param props.size - tile edge in pixels.
     * @returns the mark.
     */
    function BrandMark({ size = 24 }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
        className:
          "inline-grid shrink-0 place-items-center rounded-[7px] bg-[color-mix(in_oklch,var(--color-accent)_16%,transparent)] text-accent",
        style: {
          inlineSize: size,
          blockSize: size,
        },
        "aria-hidden": "true",
        children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
          width: size * 0.62,
          height: size * 0.62,
          viewBox: "0 0 16 16",
          fill: "none",
          stroke: "currentColor",
          strokeLinecap: "round",
          children: [
            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
              cx: "6.7",
              cy: "6.7",
              r: "4.2",
              strokeWidth: "1.5",
            }),
            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
              d: "M9.9 9.9 13.6 13.6",
              strokeWidth: "1.7",
            }),
            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
              d: "M4.9 5.3h3.4M4.9 7.1h2.4M4.9 8.9h1.4",
              strokeWidth: "1.2",
            }),
          ],
        }),
      })
    }
    //#endregion
    //#region src/client/ui/session-management.tsx
    function ManagementControls({ state, visible }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: "flex flex-col gap-1.5",
        children: [
          state.editing
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                className: "flex flex-wrap gap-1",
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                    type: "button",
                    className: "ci-btn ci-btn--quiet active:bg-hover",
                    disabled: state.busy,
                    onClick: visible,
                    children: t("management.selectVisible"),
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                    type: "button",
                    className: "ci-btn ci-btn--quiet active:bg-hover",
                    disabled: state.busy,
                    onClick: state.clearSelection,
                    children: t("management.clear"),
                  }),
                ],
              })
            : null,
          state.editing || state.groupFilter !== ""
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
                "aria-label": t("management.groupFilter"),
                className:
                  "min-w-0 rounded border border-line bg-bg px-2 py-1 text-[12px] text-fg focus-visible:outline-2 focus-visible:outline-accent",
                value: state.groupFilter,
                disabled: state.busy || state.metadataLoading,
                onChange: (event) => state.setGroupFilter(event.currentTarget.value),
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
                    value: "",
                    children: t("management.allGroups"),
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
                    value: "ungrouped",
                    children: t("management.ungrouped"),
                  }),
                  state.groups.map((group) =>
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                      "option",
                      {
                        value: `group:${group}`,
                        children: group,
                      },
                      group,
                    ),
                  ),
                ],
              })
            : null,
          state.metadataLoading
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                role: "status",
                className: "m-0 text-[11px] text-fg-dim",
                children: t("management.loading"),
              })
            : null,
          state.metadataError !== ""
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                role: "alert",
                className: "text-[11px] text-err",
                children: [
                  state.metadataError,
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                    type: "button",
                    className: "ci-btn ci-btn--quiet active:bg-hover",
                    onClick: () => void state.ensureMetadata(),
                    children: t("management.retry"),
                  }),
                ],
              })
            : null,
        ],
      })
    }
    function SessionManagement({ state, selected }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
        children: [
          state.editing
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
                className: "flex shrink-0 flex-col gap-2 border-bs border-line bg-bg-1 p-3",
                "aria-label": t("sessions.actions"),
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                    role: "status",
                    className: "text-[12px] tabular-nums",
                    children: t("management.selected", { count: selected.length }),
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                    className: "flex flex-wrap gap-1",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                        type: "button",
                        className: "ci-btn active:bg-hover",
                        disabled: state.busy || selected.length === 0,
                        onClick: () => void state.openDialog("rename", selected),
                        children: t("management.rename"),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                        type: "button",
                        className: "ci-btn active:bg-hover",
                        disabled: state.busy || state.generating || selected.length === 0,
                        onClick: () => void state.openAiDialog(selected),
                        children: t("management.aiRename"),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                        type: "button",
                        className: "ci-btn active:bg-hover",
                        disabled: state.busy || selected.length === 0,
                        onClick: () => void state.openDialog("group", selected),
                        children: t("management.move"),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                        type: "button",
                        className: "ci-btn text-err active:bg-hover",
                        disabled: state.busy || selected.length === 0,
                        onClick: () => void state.deleteSessions(selected),
                        children: t(state.busy ? "management.saving" : "management.delete"),
                      }),
                    ],
                  }),
                  state.dialog === null && state.failures.length > 0
                    ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                        className: "max-bs-32 overflow-y-auto",
                        role: "alert",
                        children: [
                          state.failures.map(({ session, reason }) =>
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                              "p",
                              {
                                className: "m-0 text-[11px] text-err",
                                children: t("management.failure", {
                                  title: session.title,
                                  reason,
                                }),
                              },
                              sessionKey(session.source, session.id),
                            ),
                          ),
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                            type: "button",
                            className: "ci-btn active:bg-hover",
                            disabled: state.busy,
                            onClick: () => void state.deleteSessions(state.failures.map((failure) => failure.session)),
                            children: t("management.retry"),
                          }),
                        ],
                      })
                    : null,
                ],
              })
            : null,
          state.dialog !== null
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetadataDialog, { state }, state.dialog.serial)
            : null,
        ],
      })
    }
    function MetadataDialog({ state }) {
      const target = state.dialog
      const ref = (0, react.useRef)(null)
      const titleId = (0, react.useId)()
      const groupsId = (0, react.useId)()
      const [restored, setRestored] = (0, react.useState)(/* @__PURE__ */ new Set())
      const [group, setGroup] = (0, react.useState)("")
      const [ungroup, setUngroup] = (0, react.useState)(false)
      ;(0, react.useEffect)(() => {
        const dialog = ref.current
        dialog?.showModal()
        dialog?.querySelector("input:not(:disabled)")?.focus()
        return () => dialog?.close()
      }, [])
      if (target === null) return null
      const renaming = target.kind === "rename"
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dialog", {
        ref,
        "aria-labelledby": titleId,
        className:
          "ci-panel max-bs-[80dvh] rounded-xl border border-line bg-bg-1 p-0 text-fg shadow-lg backdrop:bg-black/40",
        style: { inlineSize: "min(34rem, calc(100% - 2rem))" },
        onCancel: (event) => {
          event.preventDefault()
          state.closeDialog()
        },
        onClick: (event) => {
          if (event.target !== event.currentTarget) return
          const bounds = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            state.closeDialog()
        },
        children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
          className: "max-bs-[80dvh] flex flex-col",
          onSubmit: (event) => {
            event.preventDefault()
            const values = /* @__PURE__ */ new Map()
            for (const session of target.sessions) {
              const key = sessionKey(session.source, session.id)
              if (restored.has(key)) values.set(key, null)
              else if (state.drafts.has(key)) values.set(key, state.drafts.get(key)?.trim() ?? null)
              else if (
                !target.ai &&
                !state.aiErrors.has(key) &&
                !state.suggestions.has(key) &&
                state.progress.total === 0
              )
                values.set(key, session.title)
            }
            state.save(values, ungroup ? null : group.trim())
          },
          children: [
            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", {
              id: titleId,
              className: "m-0 shrink-0 p-4 text-[15px] font-semibold",
              children: [t(renaming ? "management.rename" : "management.move"), " · ", target.sessions.length],
            }),
            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
              className: "ci-scroll min-bs-0 flex-1 overflow-y-auto overscroll-contain px-4",
              children: [
                target.ai || state.progress.total > 0
                  ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                      className: "flex flex-col gap-1 text-[11px] text-fg-dim",
                      role: "status",
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          className: "m-0",
                          children: t("management.aiHint"),
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          className: "m-0",
                          children: t("management.aiSkipped", { count: target.skipped }),
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          className: "m-0",
                          children: t("management.aiProgress", state.progress),
                        }),
                        state.generating
                          ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                              type: "button",
                              className: "ci-btn active:bg-hover",
                              onClick: state.stopGeneration,
                              children: t("management.aiStop"),
                            })
                          : null,
                      ],
                    })
                  : null,
                renaming
                  ? target.sessions.map((session) => {
                      const key = sessionKey(session.source, session.id)
                      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                        "div",
                        {
                          className: "mbs-2 flex flex-col gap-1 text-[12px]",
                          children: [
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                              className: "break-words",
                              children: session.title,
                            }),
                            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                              className: "text-[10px] break-all text-fg-dim",
                              children: [session.source, " · ", session.workdir, " · ", session.id],
                            }),
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
                              "aria-label": t("management.name", { title: session.title }),
                              className:
                                "min-w-0 rounded border border-line bg-bg px-2 py-1.5 text-fg focus-visible:outline-2 focus-visible:outline-accent",
                              value: state.drafts.get(key) ?? session.title,
                              maxLength: 80,
                              disabled: state.busy || state.generating || restored.has(key),
                              required: !restored.has(key),
                              onChange: (event) => state.editDraft(key, event.currentTarget.value),
                            }),
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                              type: "button",
                              className: "ci-btn active:bg-hover",
                              disabled: state.busy || state.generating || restored.has(key),
                              onClick: () => void state.generateTitles([session]),
                              children: t(state.aiErrors.has(key) ? "management.retry" : "management.aiSuggest"),
                            }),
                            state.suggestions.has(key)
                              ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                                  className: "text-[10px] text-fg-dim",
                                  title: `${state.suggestions.get(key).provider} · ${state.suggestions.get(key).model}`,
                                  children: [
                                    state.suggestions.get(key).provider,
                                    " · ",
                                    state.suggestions.get(key).model,
                                  ],
                                })
                              : null,
                            state.aiErrors.has(key)
                              ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                  role: "alert",
                                  className: "text-[11px] text-err",
                                  children: state.aiErrors.get(key),
                                })
                              : null,
                            (target.ai || state.progress.total > 0) && !state.drafts.has(key) && !restored.has(key)
                              ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                  className: "text-[11px] text-fg-dim",
                                  children: t("management.aiPending"),
                                })
                              : null,
                            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
                              className: "flex items-center gap-1",
                              children: [
                                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
                                  type: "checkbox",
                                  checked: restored.has(key),
                                  disabled: state.busy || state.generating,
                                  onChange: (event) => {
                                    const next = new Set(restored)
                                    if (event.currentTarget.checked) next.add(key)
                                    else next.delete(key)
                                    setRestored(next)
                                  },
                                }),
                                t("management.restore"),
                              ],
                            }),
                          ],
                        },
                        key,
                      )
                    })
                  : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                      className: "flex flex-col gap-2 text-[12px]",
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                          className: "m-0 text-fg-dim",
                          children: t("management.groupHint"),
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
                          className: "flex flex-col gap-1",
                          children: [
                            t("management.group"),
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
                              className:
                                "rounded border border-line bg-bg px-2 py-1.5 text-fg focus-visible:outline-2 focus-visible:outline-accent",
                              list: groupsId,
                              maxLength: 80,
                              value: group,
                              disabled: state.busy || ungroup,
                              required: !ungroup,
                              onChange: (event) => setGroup(event.currentTarget.value),
                            }),
                          ],
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
                          id: groupsId,
                          children: state.groups.map((name) =>
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: name }, name),
                          ),
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
                          className: "flex items-center gap-1",
                          children: [
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
                              type: "checkbox",
                              checked: ungroup,
                              disabled: state.busy,
                              onChange: (event) => setUngroup(event.currentTarget.checked),
                            }),
                            t("management.ungroup"),
                          ],
                        }),
                        target.sessions.map((session) =>
                          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                            "p",
                            {
                              className: "m-0 break-words text-fg-dim",
                              children: [session.title, " · ", session.workdir],
                            },
                            sessionKey(session.source, session.id),
                          ),
                        ),
                      ],
                    }),
                state.failures.length > 0
                  ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
                      role: "alert",
                      className: "mbs-2 text-[11px] text-err",
                      children: state.failures.map(({ session, reason }) =>
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                          "p",
                          {
                            children: t("management.failure", {
                              title: session.title,
                              reason,
                            }),
                          },
                          sessionKey(session.source, session.id),
                        ),
                      ),
                    })
                  : null,
              ],
            }),
            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
              className: "flex shrink-0 justify-end gap-2 p-4",
              children: [
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                  type: "button",
                  className: "ci-btn active:bg-hover",
                  disabled: state.busy,
                  onClick: state.closeDialog,
                  children: t("management.cancel"),
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                  type: "submit",
                  className: "ci-btn active:bg-hover",
                  disabled:
                    state.busy ||
                    state.generating ||
                    target.sessions.length === 0 ||
                    ((target.ai || state.progress.total > 0) &&
                      !target.sessions.some(
                        (session) =>
                          restored.has(sessionKey(session.source, session.id)) ||
                          state.drafts.has(sessionKey(session.source, session.id)),
                      )) ||
                    state.metadataLoading ||
                    state.metadataError !== "" ||
                    (!renaming && !ungroup && group.trim() === "") ||
                    (renaming &&
                      target.sessions.some((session) => {
                        const key = sessionKey(session.source, session.id)
                        return !restored.has(key) && (state.drafts.get(key) ?? session.title).trim() === ""
                      })),
                  children: t(
                    state.busy
                      ? "management.saving"
                      : state.failures.length > 0
                        ? "management.retry"
                        : "management.save",
                  ),
                }),
              ],
            }),
          ],
        }),
      })
    }
    //#endregion
    //#region src/client/ui/session-row.tsx
    /** A session row, hung under its project by a guide line. */
    function SessionRow({
      row,
      index,
      onOpen,
      onFocus,
      api,
      onDeleted,
      editing = false,
      checked = false,
      busy = false,
      onCheck,
      onRename,
      onAiRename,
      onMove,
    }) {
      const trigger = (0, react.useRef)(null)
      const menu = (0, react.useRef)(null)
      const [menuOpen, setMenuOpen] = (0, react.useState)(false)
      const [deleting, setDeleting] = (0, react.useState)(false)
      const [error, setError] = (0, react.useState)("")
      ;(0, react.useEffect)(() => {
        if (!menuOpen) return
        const popup = menu.current
        if (popup === null) return
        const doc = popup.ownerDocument
        function dismiss(event) {
          if (!event.composedPath().includes(popup)) {
            popup?.hidePopover()
            setMenuOpen(false)
          }
        }
        function escape(event) {
          if (event.key === "Escape") closeMenu()
        }
        function hide() {
          popup?.hidePopover()
          setMenuOpen(false)
        }
        doc.addEventListener("pointerdown", dismiss, true)
        doc.addEventListener("keydown", escape, true)
        doc.addEventListener("scroll", hide, true)
        doc.defaultView?.addEventListener("blur", hide)
        return () => {
          doc.removeEventListener("pointerdown", dismiss, true)
          doc.removeEventListener("keydown", escape, true)
          doc.removeEventListener("scroll", hide, true)
          doc.defaultView?.removeEventListener("blur", hide)
        }
      }, [menuOpen])
      function closeMenu() {
        menu.current?.hidePopover()
        setMenuOpen(false)
        trigger.current?.focus({ preventScroll: true })
      }
      function openMenu(x, y) {
        const popup = menu.current
        if (popup === null || deleting) return
        for (const other of popup.ownerDocument.querySelectorAll("[data-session-menu]:popover-open"))
          if (other !== popup) other.hidePopover()
        popup.showPopover()
        setMenuOpen(true)
        const bounds = popup.getBoundingClientRect()
        const view = popup.ownerDocument.defaultView
        popup.style.insetInlineStart = `${Math.max(8, Math.min(x, (view?.innerWidth ?? bounds.right) - bounds.width - 8))}px`
        popup.style.insetBlockStart = `${Math.max(8, Math.min(y, (view?.innerHeight ?? bounds.bottom) - bounds.height - 8))}px`
        popup.querySelector("button")?.focus({ preventScroll: true })
      }
      async function remove() {
        closeMenu()
        if (deleting || !window.confirm(t("sessions.deleteConfirm", { title: row.session.title }))) return
        setDeleting(true)
        setError("")
        const result = await api.deleteSession(row.session.source, row.session.id)
        setDeleting(false)
        if (result.ok) onDeleted(row.session)
        else
          setError(
            result.detail === "shared-session-logs"
              ? t("sessions.deleteShared")
              : t("sessions.deleteFailed", { detail: failureText(result) }),
          )
      }
      const mark = SOURCE_MARKS[row.session.source]
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: "ms-3.25 border-s border-line-soft ps-1.5",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "flex items-center gap-1",
            children: [
              editing
                ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
                    type: "checkbox",
                    "aria-label": t("management.name", { title: row.session.title }),
                    checked,
                    disabled: busy || deleting,
                    onChange: () => {},
                    onClick: (event) => {
                      event.stopPropagation()
                      onCheck?.(event.shiftKey)
                    },
                    onKeyDown: (event) => {
                      if (event.key === " ") event.stopPropagation()
                    },
                    className: "ms-1 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-accent",
                  })
                : null,
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
                ref: trigger,
                type: "button",
                "aria-haspopup": "menu",
                "aria-expanded": menuOpen,
                "aria-busy": deleting,
                disabled: deleting || busy,
                onContextMenu: (event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  openMenu(event.clientX, event.clientY)
                },
                onKeyDown: (event) => {
                  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return
                  event.preventDefault()
                  event.stopPropagation()
                  const bounds = event.currentTarget.getBoundingClientRect()
                  openMenu(bounds.left, bounds.bottom)
                },
                className: "ci-row min-w-0 flex-1 px-2 py-1.5 active:bg-hover",
                "data-key": row.key,
                "data-selected": row.selected,
                "data-focus": index,
                "aria-current": row.selected,
                onClick: (event) => (editing ? onCheck?.(event.shiftKey) : onOpen()),
                onFocus,
                title: row.session.title,
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                    className: "flex min-w-0 items-center gap-1.5",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        className: "inline-flex w-3.5 shrink-0 justify-center",
                        children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
                          source: row.session.source,
                          size: 12,
                        }),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        className: "min-w-0 flex-1 truncate text-[12.5px]",
                        children: row.session.title,
                      }),
                    ],
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                    className: "mt-0.5 flex min-w-0 items-center gap-1.5 ps-5 text-[10.5px] text-fg-3 tabular-nums",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        style: { color: mark.text },
                        className: "ci-src__word",
                        children: mark.label.zh,
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        "aria-hidden": "true",
                        children: "·",
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        children: formatShortTime(row.session.updatedAt),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        "aria-hidden": "true",
                        children: "·",
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatBytes(row.session.bytes) }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          error === ""
            ? null
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                role: "alert",
                className: "m-0 px-2 py-1 text-[11px] text-err",
                children: error,
              }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            ref: menu,
            popover: "manual",
            "data-session-menu": "",
            onBeforeToggle: (event) => setMenuOpen(event.newState === "open"),
            role: "menu",
            "aria-label": t("sessions.actions"),
            className: "fixed m-0 min-w-36 rounded-lg border border-line bg-bg-1 p-1 text-[12.5px] text-fg shadow-lg",
            onContextMenu: (event) => event.preventDefault(),
            onKeyDown: (event) => {
              event.stopPropagation()
              if (event.key === "Escape" || event.key === "Tab") {
                if (event.key === "Escape") event.preventDefault()
                closeMenu()
              } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault()
                const items = [...event.currentTarget.querySelectorAll("button")]
                const current = items.indexOf(event.currentTarget.ownerDocument.activeElement)
                items[
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
                ]?.focus()
              }
            },
            children: [
              onRename
                ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                    type: "button",
                    role: "menuitem",
                    className: "ci-btn ci-btn--quiet w-full justify-start active:bg-hover",
                    onClick: () => {
                      closeMenu()
                      onRename()
                    },
                    children: t("management.rename"),
                  })
                : null,
              onAiRename
                ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                    type: "button",
                    role: "menuitem",
                    className: "ci-btn ci-btn--quiet w-full justify-start active:bg-hover",
                    disabled: busy || deleting,
                    onClick: () => {
                      closeMenu()
                      onAiRename()
                    },
                    children: t("management.aiRename"),
                  })
                : null,
              onMove
                ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                    type: "button",
                    role: "menuitem",
                    className: "ci-btn ci-btn--quiet w-full justify-start active:bg-hover",
                    onClick: () => {
                      closeMenu()
                      onMove()
                    },
                    children: t("management.move"),
                  })
                : null,
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
                type: "button",
                role: "menuitem",
                className:
                  "flex w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 py-1.5 text-err hover:bg-hover focus:bg-hover",
                onClick: () => void remove(),
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                    name: "trash",
                    size: 14,
                  }),
                  t("sessions.delete"),
                ],
              }),
            ],
          }),
        ],
      })
    }
    //#endregion
    //#region src/client/ui/project-tree.tsx
    /**
     * The left column: one project tree instead of two flat lists.
     *
     * Projects fold open in place, each session sits under the project it belongs to
     * with its source mark, and a big project shows one page plus a "show all" row.
     * Only the expanded projects are fetched, so opening the panel costs one list
     * request rather than one per workdir; the rows themselves are decided by the
     * pure functions in `tree.ts`.
     *
     * @module @cyrusdoyle/dsh-sessions-insight/client/project-tree
     */
    /** Local storage handle, absent outside a browser. */
    function storageOf() {
      try {
        return typeof window === "undefined" ? void 0 : window.localStorage
      } catch {
        return
      }
    }
    function treeSessions(sessions) {
      return sessions.map((summary) => ({
        ...summary,
        title: summary.title ?? summary.firstInput ?? t("sessions.untitled"),
        named: (summary.title?.trim().length ?? 0) > 0,
      }))
    }
    function cachedSessions() {
      return new Map([...clientListCache().sessions].map(([workdir, value]) => [workdir, treeSessions(value.sessions)]))
    }
    /** One source count: glyph plus number, tinted by the source's brand. */
    function SourceCount({ source, count }) {
      const mark = SOURCE_MARKS[source]
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
        className: "ci-src",
        style: {
          ["--ci-src-color"]: mark.text,
          ["--ci-src-brand"]: mark.brand,
        },
        title: `${mark.label.zh} · ${t("sources.sessions", { count })}`,
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
            source,
            size: 10,
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: String(count) }),
        ],
      })
    }
    /** A project row. */
    function ProjectRow({ row, index, onToggle, onFocus }) {
      const project = row.project
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
        type: "button",
        className: "ci-row px-2 py-1.5",
        "data-focus": index,
        "aria-expanded": row.expanded,
        onClick: onToggle,
        onFocus,
        title: project.workdir,
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
            className: "flex min-w-0 items-center gap-1.5",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                name: "chevron",
                size: 11,
                className: "ci-chevron shrink-0 text-fg-3",
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                name: "folder",
                size: 14,
                className: row.expanded ? "shrink-0 text-accent" : "shrink-0 text-fg-dim",
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "min-w-0 flex-1 truncate text-[12.5px] font-semibold",
                children: project.leaf,
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "shrink-0 text-[10.5px] text-fg-3 tabular-nums",
                children: formatShortTime(project.lastUpdatedAt),
              }),
            ],
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
            className: "mt-1 flex min-w-0 items-center gap-1.5 ps-9.25",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "min-w-0 flex-1 truncate font-mono text-[10.5px] text-fg-3",
                children: project.parent === "" ? "" : tildePath(project.parent),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "flex shrink-0 items-center gap-1",
                children: project.counts.map((group) =>
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                    SourceCount,
                    {
                      source: group.source,
                      count: group.sessions,
                    },
                    group.source,
                  ),
                ),
              }),
            ],
          }),
        ],
      })
    }
    /**
     * The tree column: a header with the project count and a filter, then the
     * scrolling rows.
     * @param props.api - client API.
     * @param props.workdirs - project rows from `/workdirs`.
     * @param props.selected - currently open session.
     * @param props.onSelect - open one session.
     * @param props.loading - true while the first `/workdirs` answer is pending.
     * @returns the tree column, filling its parent's height.
     */
    function ProjectTree({ api, workdirs, selected, onSelect, loading, onDeleted, revision, onMetadataChanged }) {
      const cache = clientListCache()
      const deletion = (0, react.useSyncExternalStore)(cache.subscribe, cache.deletionVersion, cache.deletionVersion)
      const allProjects = (0, react.useMemo)(() => buildProjects(workdirs, splitPath), [workdirs])
      const [query, setQuery] = (0, react.useState)("")
      const projects = (0, react.useMemo)(() => filterProjects(allProjects, query), [allProjects, query])
      const [expanded, setExpanded] = (0, react.useState)(() => {
        const saved = new Set(readExpanded(storageOf()))
        const first = selected?.workdir ?? workdirs[0]?.workdir
        return saved.size > 0 || first === void 0 ? saved : /* @__PURE__ */ new Set([first])
      })
      const [sessions, setSessions] = (0, react.useState)(cachedSessions)
      const management = useSessionManagement(
        api,
        (deleted) => {
          setSessions(
            (current) =>
              new Map(
                [...current].map(([workdir, list]) => [
                  workdir,
                  list.filter(
                    (session) => sessionKey(session.source, session.id) !== sessionKey(deleted.source, deleted.id),
                  ),
                ]),
              ),
          )
          onDeleted(deleted)
        },
        onMetadataChanged,
      )
      const displaySessions = applySessionMetadata(sessions, management.metadata, management.groupFilter)
      const chosen = selectedSessions(management.selection, applySessionMetadata(sessions, management.metadata, ""))
      const [loadingWorkdirs, setLoadingWorkdirs] = (0, react.useState)(() => /* @__PURE__ */ new Set())
      const [limits, setLimits] = (0, react.useState)(() => /* @__PURE__ */ new Map())
      const [focus, setFocus] = (0, react.useState)(-1)
      const navRef = (0, react.useRef)(null)
      const requested = (0, react.useRef)(/* @__PURE__ */ new Set())
      const generation = (0, react.useRef)(revision)
      const controller = (0, react.useRef)(new AbortController())
      const timers = (0, react.useRef)(/* @__PURE__ */ new Map())
      const visited = (0, react.useRef)(/* @__PURE__ */ new Set())
      const visible = (0, react.useRef)(expanded)
      visible.current = expanded
      ;(0, react.useEffect)(() => setSessions(cachedSessions()), [deletion])
      ;(0, react.useEffect)(() => {
        generation.current = revision
        controller.current = new AbortController()
        requested.current.clear()
        visited.current.clear()
        setLoadingWorkdirs(/* @__PURE__ */ new Set())
        return () => {
          controller.current.abort()
          for (const timer of timers.current.values()) clearTimeout(timer)
          timers.current.clear()
        }
      }, [revision])
      ;(0, react.useEffect)(() => {
        if (projects.length === 0) return
        setExpanded((current) => {
          if (current.size > 0) return current
          const target = selected?.workdir ?? projects[0]?.workdir
          return target === void 0 ? current : /* @__PURE__ */ new Set([target])
        })
      }, [projects, selected])
      const load = (0, react.useCallback)(
        async (workdir) => {
          if (requested.current.has(workdir)) return
          requested.current.add(workdir)
          clearTimeout(timers.current.get(workdir))
          timers.current.delete(workdir)
          const signal = controller.current.signal
          if (!clientListCache().sessions.has(workdir)) setLoadingWorkdirs((current) => new Set(current).add(workdir))
          const result = await api.sessions(workdir, signal)
          if (signal.aborted || generation.current !== revision) return
          requested.current.delete(workdir)
          setLoadingWorkdirs((current) => {
            const next = new Set(current)
            next.delete(workdir)
            return next
          })
          if (!result.ok) {
            if (result.error === "aborted") return
            setSessions((current) => (current.has(workdir) ? current : new Map(current).set(workdir, [])))
            return
          }
          setSessions((current) => new Map(current).set(workdir, treeSessions(result.value.sessions)))
          if (result.value.refreshing) {
            const timer = setTimeout(() => {
              timers.current.delete(workdir)
              if (!signal.aborted && visible.current.has(workdir)) load(workdir)
            }, 500)
            timers.current.set(workdir, timer)
          }
        },
        [api, revision],
      )
      ;(0, react.useEffect)(() => {
        const known = new Set(workdirs.map((row) => row.workdir))
        for (const workdir of visited.current) {
          if (expanded.has(workdir) && known.has(workdir)) continue
          visited.current.delete(workdir)
          clearTimeout(timers.current.get(workdir))
          timers.current.delete(workdir)
        }
        for (const workdir of expanded) {
          if (!known.has(workdir) || visited.current.has(workdir)) continue
          visited.current.add(workdir)
          load(workdir)
        }
      }, [expanded, load, workdirs])
      const rows = flattenTree({
        projects,
        sessions: displaySessions,
        loading: loadingWorkdirs,
        expanded,
        selected: selected === null ? null : sessionKey(selected.source, selected.id),
        limits,
      })
      function toggle(workdir) {
        setExpanded((current) => {
          const next = new Set(current)
          if (next.has(workdir)) next.delete(workdir)
          else next.add(workdir)
          writeExpanded(storageOf(), [...next])
          return next
        })
      }
      function openRow(row, shift = false) {
        if (row === void 0) return
        if (row.kind === "project") {
          toggle(row.project.workdir)
          return
        }
        if (row.kind === "more") {
          setLimits((current) => new Map(current).set(row.workdir, Number.MAX_SAFE_INTEGER))
          return
        }
        if (row.kind === "session") {
          if (management.editing) {
            if (!management.busy)
              management.setSelection((current) => toggleSelection(current, row.key, visibleSessions(rows), shift))
            return
          }
          onSelect({
            source: row.session.source,
            id: row.session.id,
            workdir: row.workdir,
          })
        }
      }
      function onKeyDown(event) {
        const row = rows[focus]
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
          event.preventDefault()
          const next = nextIndex(rows, focus, event.key)
          setFocus(next)
          navRef.current?.querySelector(`[data-focus="${String(next)}"]`)?.focus()
          return
        }
        if (event.key === "ArrowRight") {
          if (row?.kind === "project" && !row.expanded) {
            event.preventDefault()
            toggle(row.project.workdir)
          }
          return
        }
        if (event.key === "ArrowLeft") {
          if (row?.kind === "project" && row.expanded) {
            event.preventDefault()
            toggle(row.project.workdir)
          } else if (row?.kind === "session" || row?.kind === "more" || row?.kind === "skeleton") {
            event.preventDefault()
            toggle(row.kind === "session" ? row.workdir : row.workdir)
          }
          return
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          openRow(row, event.shiftKey)
        }
      }
      if (loading && allProjects.length === 0)
        return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("nav", {
          className: "ci-scroll h-full overflow-y-auto",
          "aria-label": t("workdirs.title"),
          "aria-busy": "true",
          children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeSkeleton, { label: t("tree.loadingIndex") }),
        })
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
        className: "flex h-full min-h-0 flex-col",
        "aria-label": t("workdirs.title"),
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                className: "flex items-center gap-2 text-[12px] font-semibold",
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("tree.title") }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                    className:
                      "rounded-full bg-bg-2 px-1.5 text-[10.5px] leading-4.25 font-medium text-fg-dim tabular-nums",
                    children:
                      query.trim() === ""
                        ? allProjects.length
                        : `${String(projects.length)} / ${String(allProjects.length)}`,
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                    type: "button",
                    className: "ci-btn ci-btn--quiet ms-auto active:bg-hover",
                    disabled: management.busy,
                    onClick: management.toggleEditing,
                    children: t(management.editing ? "management.done" : "management.edit"),
                  }),
                ],
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagementControls, {
                state: management,
                visible: () => management.setSelection((current) => selectSessions(current, visibleSessions(rows))),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
                className:
                  "flex h-7 items-center gap-1.5 rounded-[7px] border border-line-soft bg-bg px-2 text-fg-3 focus-within:border-accent",
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                    name: "search",
                    size: 12,
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
                    className:
                      "min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-fg outline-none placeholder:text-fg-3",
                    value: query,
                    onChange: (event) => {
                      setQuery(event.currentTarget.value)
                      management.clearSelection()
                    },
                    onKeyDown: (event) => {
                      if (event.key === "Escape") {
                        setQuery("")
                        management.clearSelection()
                      }
                    },
                    placeholder: t("tree.filter"),
                    "aria-label": t("tree.filter"),
                    type: "search",
                  }),
                ],
              }),
            ],
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "ci-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3",
            ref: navRef,
            onKeyDown,
            role: "tree",
            children: [
              projects.length === 0
                ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                    className: "m-0 px-2 py-3 text-[12px] leading-relaxed text-fg-dim",
                    children:
                      allProjects.length === 0 ? t("tree.emptyAll") : t("tree.noMatch", { query: query.trim() }),
                  })
                : null,
              rows.map((row, index) => {
                if (row.kind === "project")
                  return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                    "div",
                    {
                      className: "mt-1 first:mt-0",
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectRow, {
                          row,
                          index,
                          onToggle: () => toggle(row.project.workdir),
                          onFocus: () => setFocus(index),
                        }),
                        management.editing &&
                        displaySessions.has(row.project.workdir) &&
                        !loadingWorkdirs.has(row.project.workdir)
                          ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                              type: "button",
                              className: "ci-btn ci-btn--quiet ms-3 active:bg-hover",
                              disabled: management.busy,
                              onClick: () =>
                                management.setSelection((current) =>
                                  selectSessions(current, displaySessions.get(row.project.workdir) ?? []),
                                ),
                              children: t("management.selectDirectory", {
                                count: displaySessions.get(row.project.workdir)?.length ?? 0,
                              }),
                            })
                          : null,
                      ],
                    },
                    row.key,
                  )
                if (row.kind === "skeleton")
                  return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                    "div",
                    {
                      className: "ms-3.25 flex flex-col gap-1 border-s border-line-soft py-1 ps-2.5",
                      children: Array.from({ length: row.rows }, (_, order) =>
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                          "div",
                          {
                            className:
                              "h-8 rounded-lg bg-[linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))] bg-size-[200%_100%] motion-safe:animate-[ci-skel_1.4s_var(--ease-in-out)_infinite]",
                          },
                          row.key + String(order),
                        ),
                      ),
                    },
                    row.key,
                  )
                if (row.kind === "more")
                  return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                    "div",
                    {
                      className: "ms-3.25 border-s border-line-soft py-0.5 ps-1.5",
                      children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                        type: "button",
                        className: "ci-btn ci-btn--quiet h-7 w-full justify-start",
                        "data-focus": index,
                        onClick: () => openRow(row),
                        onFocus: () => setFocus(index),
                        children: t("tree.showAll", { count: row.hidden + 20 }),
                      }),
                    },
                    row.key,
                  )
                return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                  SessionRow,
                  {
                    api,
                    onDeleted: management.deleted,
                    editing: management.editing,
                    checked: management.selection.keys.has(row.key),
                    busy: management.busy,
                    onCheck: (shift) => openRow(row, shift),
                    onRename: () => void management.openDialog("rename", [row.session]),
                    onMove: () => void management.openDialog("group", [row.session]),
                    onAiRename: () => void management.openAiDialog([row.session], false),
                    row,
                    index,
                    onOpen: () => openRow(row),
                    onFocus: () => setFocus(index),
                  },
                  row.key,
                )
              }),
            ],
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionManagement, {
            state: management,
            selected: chosen,
          }),
        ],
      })
    }
    /**
     * Compose a session's label from its metadata.
     * @param row - a list row, a search hit, or a session header.
     * @returns the label lines.
     */
    function sessionLabel(row) {
      const title = row.title?.trim()
      if (title !== void 0 && title !== "") return { title }
      const first = row.firstInput?.trim()
      if (first !== void 0 && first !== "")
        return {
          title: t("session.untitled"),
          detail: clip(first, 60),
        }
      return { title: t("session.untitled") }
    }
    /** Hits requested per scan. */
    const SEARCH_LIMIT = 30
    /**
     * Wrap occurrences of the query in a highlight element.
     * @param text - snippet text.
     * @param query - the raw query.
     * @returns nodes with the matches marked.
     */
    function highlight(text, query) {
      const needle = query.trim().toLowerCase()
      if (needle === "") return [text]
      const nodes = []
      const lower = text.toLowerCase()
      let cursor = 0
      let index = lower.indexOf(needle)
      while (index >= 0) {
        if (index > cursor) nodes.push(text.slice(cursor, index))
        nodes.push(
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
            "mark",
            {
              className: "rounded-xs bg-[color-mix(in_oklch,var(--color-accent)_35%,transparent)] px-px text-fg",
              children: text.slice(index, index + needle.length),
            },
            `m-${String(index)}`,
          ),
        )
        cursor = index + needle.length
        index = lower.indexOf(needle, cursor)
      }
      if (cursor < text.length) nodes.push(text.slice(cursor))
      return nodes
    }
    /**
     * One result row.
     * @param props.hit - the hit.
     * @param props.query - the query, for the highlight.
     * @param props.active - whether this row is selected.
     * @param props.onOpen - open this hit.
     * @param props.onHover - select this hit without opening it.
     * @returns the row button.
     */
    function HitRow({ hit, query, active, onOpen, onHover }) {
      const label = sessionLabel(hit)
      const parts = splitPath(hit.workdir)
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
        children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
          type: "button",
          className:
            "my-px flex w-full cursor-pointer flex-col gap-1 rounded-md border-0 px-2 py-2.5 text-left font-[inherit] text-inherit hover:bg-bg-2 data-[active=true]:bg-bg-2",
          "data-active": active,
          onClick: onOpen,
          onMouseEnter: onHover,
          children: [
            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
              className: "flex w-full min-w-0 items-center gap-3",
              children: [
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
                  source: hit.source,
                  size: 12,
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className: "min-w-0 flex-1 truncate text-[13px] font-medium text-fg",
                  children: highlight(label.title, query),
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                  className: "max-w-[40%] truncate text-[10px] text-fg-dim",
                  title: hit.workdir,
                  children: [
                    parts.leaf === "" ? hit.workdir : parts.leaf,
                    hit.turnIndex === 0 ? "" : ` · ${t("turns.selected", { index: hit.turnIndex })}`,
                  ],
                }),
              ],
            }),
            label.detail === void 0
              ? null
              : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className: "truncate text-[10.5px] text-fg-dim",
                  children: label.detail,
                }),
            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
              className: "line-clamp-2 text-[11px] leading-normal text-fg-dim",
              children: highlight(hit.snippet, query),
            }),
          ],
        }),
      })
    }
    /**
     * The palette.
     * @param props.api - client API.
     * @param props.onClose - close request (Esc, backdrop, after a jump).
     * @param props.onOpenTurn - open one hit's turn.
     * @returns the dialog.
     */
    function SearchPalette({ api, onClose, onOpenTurn }) {
      const inputId = (0, react.useId)()
      const inputRef = (0, react.useRef)(null)
      const [query, setQuery] = (0, react.useState)("")
      const [tier, setTier] = (0, react.useState)("fast")
      const [cursor, setCursor] = (0, react.useState)(0)
      const [state, setState] = (0, react.useState)({ kind: "idle" })
      const [active, setActive] = (0, react.useState)(-1)
      const [continuing, setContinuing] = (0, react.useState)(false)
      ;(0, react.useEffect)(() => {
        inputRef.current?.focus()
      }, [])
      ;(0, react.useEffect)(() => {
        const trimmed = query.trim()
        if (trimmed === "") {
          setState({ kind: "idle" })
          return
        }
        const controller = new AbortController()
        const continuingPage = tier === "deep" && cursor > 0
        if (continuingPage) setContinuing(true)
        const timer = window.setTimeout(
          () => {
            if (!continuingPage) setState({ kind: "loading" })
            api.search(trimmed, SEARCH_LIMIT, tier, cursor, controller.signal).then((result) => {
              if (controller.signal.aborted) return
              setContinuing(false)
              if (!result.ok) {
                setState({
                  kind: "failed",
                  failure: result,
                })
                return
              }
              setState((current) => {
                const previous = continuingPage && current.kind === "ready" ? current.hits : []
                const seen = new Set(previous.map((hit) => `${hit.sessionId}:${String(hit.turnIndex)}`))
                const merged = [
                  ...previous,
                  ...result.value.hits.filter((hit) => !seen.has(`${hit.sessionId}:${String(hit.turnIndex)}`)),
                ]
                return {
                  kind: "ready",
                  value: result.value,
                  hits: merged,
                }
              })
              if (!continuingPage) setActive(-1)
            })
          },
          continuingPage ? 0 : 250,
        )
        return () => {
          window.clearTimeout(timer)
          controller.abort()
        }
      }, [api, query, tier, cursor])
      const hits = state.kind === "ready" ? state.hits : []
      const grouped = (0, react.useMemo)(() => {
        const groups = /* @__PURE__ */ new Map()
        hits.forEach((hit, index) => {
          const list = groups.get(hit.source)
          if (list === void 0)
            groups.set(hit.source, [
              {
                hit,
                index,
              },
            ])
          else
            list.push({
              hit,
              index,
            })
        })
        return CONTEXT_SOURCES.filter((source) => groups.has(source)).map((source) => ({
          source,
          rows: groups.get(source) ?? [],
        }))
      }, [hits])
      function open(hit) {
        onOpenTurn({
          source: hit.source,
          sessionId: hit.sessionId,
          workdir: hit.workdir,
          turnIndex: hit.turnIndex,
        })
      }
      function escalate() {
        setCursor(0)
        setTier("deep")
      }
      function onKeyDown(event) {
        if (event.key === "Escape") {
          event.preventDefault()
          onClose()
          return
        }
        if (event.key === "ArrowDown") {
          event.preventDefault()
          setActive((current) => Math.min(hits.length - 1, current + 1))
          return
        }
        if (event.key === "ArrowUp") {
          event.preventDefault()
          setActive((current) => Math.max(-1, current - 1))
          return
        }
        if (event.key === "Enter") {
          event.preventDefault()
          const hit = active >= 0 ? hits[active] : void 0
          if (hit !== void 0) open(hit)
          else if (tier === "fast") escalate()
          else if (state.kind === "ready" && state.value.truncated) setCursor(state.value.nextCursor ?? 0)
        }
      }
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
        className: "fixed inset-0 z-60 flex items-start justify-center bg-[rgb(0_0_0/55%)] pt-[12vh]",
        onMouseDown: (event) => event.target === event.currentTarget && onClose(),
        children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
          className:
            "grid max-h-[70vh] w-[min(720px,92vw)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border-[0.5px] border-line bg-bg-1 shadow-[0_18px_48px_rgb(0_0_0/50%)]",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": t("search.title"),
          onKeyDown,
          children: [
            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
              className: "flex items-center gap-2 border-b-[0.5px] border-line px-3 py-2.5",
              children: [
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
                  className: "text-[11px] tracking-[0.06em] whitespace-nowrap text-fg-dim uppercase",
                  htmlFor: inputId,
                  children: t("search.title"),
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
                  id: inputId,
                  ref: inputRef,
                  className:
                    "min-w-0 flex-1 rounded-md border-[0.5px] border-line bg-bg px-2 py-1.5 text-[13px] text-fg focus-visible:outline-2 focus-visible:outline-accent",
                  type: "search",
                  autoComplete: "off",
                  spellCheck: false,
                  placeholder: t("search.placeholder"),
                  value: query,
                  onChange: (event) => {
                    setCursor(0)
                    setTier("fast")
                    setQuery(event.target.value)
                  },
                  "aria-describedby": `${inputId}-hint`,
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className:
                    "rounded-full border-[0.5px] border-line px-2 py-px text-[10px] whitespace-nowrap text-fg-dim",
                  role: "status",
                  children: tier === "deep" ? t("search.tier.deep") : t("search.tier.fast"),
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                  type: "button",
                  className:
                    "ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50",
                  onClick: onClose,
                  children: "Esc",
                }),
              ],
            }),
            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
              className: "min-h-0 overflow-y-auto px-2 pt-1.5 pb-2.5",
              role: "listbox",
              "aria-label": t("search.title"),
              children: [
                state.kind === "idle"
                  ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                      className: "mx-1.5 my-2.5 text-[11px] text-fg-dim",
                      id: `${inputId}-hint`,
                      children: t("search.hint"),
                    })
                  : null,
                state.kind === "loading"
                  ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                      className: "mx-1.5 my-2.5 text-[11px] text-fg-dim",
                      children: t("search.scanning"),
                    })
                  : null,
                state.kind === "failed"
                  ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                      className: "mx-1.5 my-2.5 text-[11px] text-err",
                      children: t("session.error", { detail: state.failure.detail ?? state.failure.error }),
                    })
                  : null,
                state.kind === "ready" && hits.length === 0
                  ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                      className: "mx-1.5 my-2.5 text-[11px] text-fg-dim",
                      children: t("search.empty"),
                    })
                  : null,
                grouped.map((group) =>
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                    "section",
                    {
                      className: "mt-2",
                      "aria-label": group.source,
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
                          className: "m-0 mb-1 flex items-center gap-2 px-2 py-1 text-[11px] font-medium text-fg-dim",
                          children: [
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
                              source: group.source,
                              size: 12,
                            }),
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                              children: SOURCE_MARKS[group.source].label.zh,
                            }),
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                              className: "tabular-nums",
                              children: group.rows.length,
                            }),
                          ],
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
                          className: "m-0 list-none p-0",
                          children: group.rows.map(({ hit, index }) =>
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                              HitRow,
                              {
                                hit,
                                query,
                                active: index === active,
                                onOpen: () => open(hit),
                                onHover: () => setActive(index),
                              },
                              `${hit.source}-${hit.sessionId}-${String(hit.turnIndex)}-${String(index)}`,
                            ),
                          ),
                        }),
                      ],
                    },
                    group.source,
                  ),
                ),
              ],
            }),
            state.kind === "ready"
              ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
                  className: "flex items-center gap-3 border-t-[0.5px] border-line px-3 py-2 text-[10.5px] text-fg-dim",
                  children: [
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                      children:
                        state.value.tier === "fast"
                          ? t("search.fastMeta", { scanned: state.value.scanned })
                          : state.value.truncated
                            ? t("search.truncated", { remaining: state.value.remaining })
                            : t("search.deepMeta", {
                                scanned: state.value.scanned,
                                remaining: state.value.remaining,
                              }),
                    }),
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                      className: "my-1.5 text-[10.5px] text-fg-dim",
                      children: t("search.meta", {
                        scanned: state.value.scanned,
                        elapsed: state.value.elapsedMs,
                      }),
                    }),
                    state.value.tier === "fast"
                      ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                          className: "my-1.5 text-[10.5px] text-fg-dim",
                          children: t("search.enterDeep"),
                        })
                      : null,
                    state.value.tier === "deep" && state.value.truncated
                      ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                          type: "button",
                          className:
                            "cursor-pointer rounded-md border-[0.5px] border-line bg-bg-2 px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50",
                          disabled: continuing,
                          onClick: () => setCursor(state.value.nextCursor ?? 0),
                          children: continuing
                            ? t("search.scanning")
                            : t("search.continue", { count: state.value.remaining }),
                        })
                      : null,
                    state.value.failures.length === 0
                      ? null
                      : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                          className: "ms-auto text-warn",
                          children: t("search.failures", { count: state.value.failures.length }),
                        }),
                  ],
                })
              : null,
          ],
        }),
      })
    }
    //#endregion
    //#region src/client/insight-labels.ts
    /** All insight text follows the plugin's registered locale. */
    function insightLabel(key, params) {
      return t(key, params)
    }
    //#endregion
    //#region src/client/state/session-stats.ts
    /**
     * Summarise the loaded turns.
     * @param turns - loaded page(s), in order.
     * @returns the header numbers; zeros for an empty list.
     */
    function sessionStats(turns) {
      let peak = 0
      let peakTurn
      let compactions = 0
      let toolCalls = 0
      let last
      for (const turn of turns) {
        const total = turn.attribution.total.tokens
        if (total > peak) {
          peak = total
          peakTurn = turn.index
        }
        if (total > 0) last = turn
        compactions += turn.compactions.length
        toolCalls += turn.toolCalls.length
      }
      const current = last?.attribution.total.tokens ?? 0
      const window = last?.attribution.windowSize
      return {
        current,
        ...(window === void 0 ? {} : { window }),
        ...(window === void 0 || window <= 0 ? {} : { windowShare: current / window }),
        peak,
        ...(peakTurn === void 0 ? {} : { peakTurn }),
        compactions,
        toolCalls,
      }
    }
    //#endregion
    //#region src/client/ui/primitives.tsx
    const CHIP_BASE =
      "inline-flex items-center gap-1 rounded-[5px] px-1.5 h-4.5 text-[10.5px] leading-none whitespace-nowrap tabular-nums"
    const CHIP_SKIN = {
      neutral: `${CHIP_BASE} border border-line text-fg-dim`,
      soft: `${CHIP_BASE} bg-bg-2 text-fg-dim`,
      warn: `${CHIP_BASE} border border-dashed border-warn/70 text-warn bg-warn/8`,
      accent: `${CHIP_BASE} bg-accent/14 text-accent`,
      mono: `${CHIP_BASE} border border-line text-fg-dim font-mono`,
    }
    /**
     * A small label.
     * @param props.tone - skin.
     * @param props.title - native tooltip.
     * @param props.tip - styled tooltip (`data-tip`), focusable.
     * @param props.children - content.
     * @returns the chip.
     */
    function Chip({ tone = "neutral", title, tip, children }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
        className: tip === void 0 ? CHIP_SKIN[tone] : `${CHIP_SKIN[tone]} relative`,
        title,
        "data-tip": tip,
        tabIndex: tip === void 0 ? void 0 : 0,
        children,
      })
    }
    /**
     * Section heading with an optional count and a trailing slot.
     * @param props.children - heading text.
     * @param props.count - number shown beside it.
     * @param props.end - right-aligned content.
     * @returns the heading row.
     */
    function SectionTitle({ children, count, end }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
        className: "m-0 mb-2.5 flex items-center gap-2 text-[12px] font-semibold text-fg",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children }),
          count === void 0
            ? null
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className:
                  "rounded-full bg-bg-2 px-1.5 text-[10.5px] leading-4.25 font-medium text-fg-dim tabular-nums",
                children: count,
              }),
          end === void 0
            ? null
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "ms-auto flex items-center gap-2 font-normal",
                children: end,
              }),
        ],
      })
    }
    /**
     * A bordered surface that groups one topic.
     * @param props.children - card body.
     * @param props.label - accessible name.
     * @param props.flush - drop the inner padding (for lists that pad their rows).
     * @returns the card.
     */
    function Card$1({ children, label, flush = false }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
        className: flush
          ? "min-w-0 rounded-[10px] border border-line-soft bg-bg-1"
          : "min-w-0 rounded-[10px] border border-line-soft bg-bg-1 p-3.5",
        "aria-label": label,
        children,
      })
    }
    /**
     * One headline number.
     * @param props.label - what it counts.
     * @param props.value - the number, already formatted.
     * @param props.hint - a second line (unit, share, provenance).
     * @param props.meter - 0..1 fill for a thin gauge under the value.
     * @param props.tone - `warn` paints the meter in the warning colour.
     * @returns the tile.
     */
    function Stat({ label, value, hint, meter, tone = "accent" }) {
      const fill = meter === void 0 ? void 0 : Math.max(0, Math.min(1, meter))
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: "flex min-w-0 flex-col gap-1 rounded-[10px] border border-line-soft bg-bg-1 px-3 py-2.5",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
            className: "truncate text-[11px] text-fg-dim",
            children: label,
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
            className:
              typeof value === "string"
                ? "truncate text-[18px] leading-tight font-semibold tracking-[-0.01em] text-fg tabular-nums"
                : "text-[18px] leading-tight font-semibold tracking-[-0.01em] text-fg tabular-nums",
            children: value,
          }),
          fill === void 0
            ? null
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "block h-1 w-full overflow-hidden rounded-full bg-bg-3",
                "aria-hidden": "true",
                children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className:
                    tone === "warn" ? "block h-full rounded-full bg-warn" : "block h-full rounded-full bg-accent",
                  style: { inlineSize: `${(fill * 100).toFixed(1)}%` },
                }),
              }),
          hint === void 0
            ? null
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "truncate text-[10.5px] text-fg-3",
                children: hint,
              }),
        ],
      })
    }
    /**
     * Keyboard hint.
     * @param props.children - key label.
     * @returns the key cap.
     */
    function Kbd({ children }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("kbd", {
        className:
          "inline-flex h-4.5 items-center rounded-[5px] border border-line bg-bg px-1.5 font-[inherit] text-[10.5px] text-fg-dim",
        children,
      })
    }
    //#endregion
    //#region src/client/ui/session-head.tsx
    /** Window share above which the current-context gauge turns amber. */
    const WINDOW_WARN = 0.8
    /**
     * The head.
     * @param props.data - the detail page.
     * @param props.turns - turns loaded so far.
     * @param props.cost - the priced session, when the Host returned one.
     * @param props.onHandoff - open the handoff dialog.
     * @returns the header.
     */
    function SessionHead({ data, turns, cost, onHandoff, onOpenSession }) {
      const [openError, setOpenError] = (0, react.useState)("")
      const session = data.session
      const label = sessionLabel({
        title: session.title,
        firstInput: session.firstInput,
      })
      const mark = SOURCE_MARKS[session.source]
      const loadedAll = turns.length >= data.turnCount
      const report = data.insights
      const current = report?.currentAttribution?.attribution
      const window = current?.windowSize
      const stats =
        report === void 0
          ? sessionStats(loadedAll ? turns : [])
          : {
              current: current?.total.tokens ?? 0,
              peak: report.peak?.measure.tokens ?? 0,
              peakTurn: report.peak?.turnIndex,
              window,
              windowShare:
                window === void 0 || window <= 0 || current === void 0 ? void 0 : current.total.tokens / window,
              compactions: report.compactions,
              toolCalls: report.toolCalls,
            }
      const currentUnknown = report === void 0 ? !loadedAll || stats.current === 0 : report.currentAttribution === null
      const peakUnknown = report === void 0 ? !loadedAll || stats.peak === 0 : report.peak === null
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
        className: "flex min-w-0 flex-col gap-3 border-b border-line-soft px-5 pt-4 pb-4",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "flex min-w-0 items-start gap-3",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                className: "flex min-w-0 flex-1 flex-col gap-1",
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
                    className: "m-0 truncate text-[16px] leading-snug font-semibold",
                    title: session.id,
                    children: label.title,
                  }),
                  label.detail === void 0
                    ? null
                    : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                        className: "m-0 truncate text-[12px] text-fg-dim",
                        title: label.detail,
                        children: label.detail,
                      }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
                    className: "m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-fg-dim",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                        className: "inline-flex items-center gap-1 font-medium",
                        style: { color: mark.brand },
                        children: [
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
                            source: session.source,
                            size: 12,
                          }),
                          mark.label.zh,
                        ],
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        className: "max-w-[42ch] truncate font-mono",
                        title: session.workdir,
                        children: session.workdir === "" ? t("workdirs.unknown") : tildePath(session.workdir),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        "aria-hidden": "true",
                        className: "text-fg-3",
                        children: "·",
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        className: "tabular-nums",
                        children: formatTime(session.updatedAt),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        "aria-hidden": "true",
                        className: "text-fg-3",
                        children: "·",
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        className: "tabular-nums",
                        children: formatBytes(data.meta.bytes),
                      }),
                      data.meta.residualTurns > 0
                        ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Chip, {
                            tone: "warn",
                            title: t("turns.unknownNote"),
                            children: [t("turns.unknown"), " × ", data.meta.residualTurns],
                          })
                        : null,
                      data.meta.reconciledTurns > 0
                        ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Chip, {
                            title: t("stats.reconciledTurns", { count: data.meta.reconciledTurns }),
                            children: ["×", data.meta.reconciledTurns],
                          })
                        : null,
                    ],
                  }),
                ],
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
                type: "button",
                className: "ci-btn shrink-0",
                onClick:
                  session.source !== "dsh"
                    ? onHandoff
                    : () => {
                        setOpenError("")
                        Promise.resolve()
                          .then(() => {
                            if (onOpenSession === void 0) throw new Error("DSH navigation unavailable")
                            return onOpenSession(session.id)
                          })
                          .catch((error) => setOpenError(error instanceof Error ? error.message : String(error)))
                      },
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                    name: "handoff",
                    size: 13,
                  }),
                  session.source === "dsh" ? t("handoff.openExisting") : t("handoff.button"),
                ],
              }),
            ],
          }),
          openError === ""
            ? null
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "m-0 text-[12px] text-err",
                role: "alert",
                children: t("handoff.openFailed", { detail: openError }),
              }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "grid grid-cols-2 gap-2 @2xl:grid-cols-4",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
                label: t("stats.current"),
                value: currentUnknown ? insightLabel("insights.unrecorded") : compactTokens(stats.current),
                ...(stats.windowShare === void 0 ? {} : { meter: stats.windowShare }),
                tone: (stats.windowShare ?? 0) >= WINDOW_WARN ? "warn" : "accent",
                hint:
                  stats.window === void 0
                    ? t("stats.noWindow")
                    : t("stats.windowShare", {
                        share: formatShare(stats.current, stats.window),
                        size: compactTokens(stats.window),
                      }),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
                label: t("stats.peak"),
                value: peakUnknown ? insightLabel("insights.unrecorded") : compactTokens(stats.peak),
                hint: stats.peakTurn === void 0 ? "—" : t("stats.peakAt", { index: stats.peakTurn }),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
                label: t("stats.turns"),
                value: String(data.turnCount),
                hint:
                  report !== void 0 || loadedAll
                    ? t("stats.compactionsLine", {
                        count: stats.compactions,
                        tools: stats.toolCalls,
                      })
                    : t("stats.loaded", { count: turns.length }),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
                label: t("stats.cost"),
                value:
                  cost === null
                    ? "—"
                    : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CostBadge, {
                        cost,
                        plain: true,
                      }),
                hint:
                  cost === null
                    ? t("stats.costPending")
                    : cost.totals.unpricedTurns > 0
                      ? t("cost.unpriced", { count: cost.totals.unpricedTurns })
                      : t("stats.costPriced"),
              }),
            ],
          }),
          session.dataQuality.length > 0
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
                className: "ci-fold text-[11px] text-fg-dim",
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
                    className: "inline-flex items-center gap-1",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                        name: "chevron",
                        size: 11,
                        className: "ci-chevron",
                      }),
                      t("session.quality"),
                      " (",
                      session.dataQuality.length,
                      ")",
                    ],
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
                    className: "mt-1.5 mb-0 ps-4 font-mono text-[10.5px] break-all",
                    children: session.dataQuality.map((token) =>
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                        "li",
                        { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: token }) },
                        token,
                      ),
                    ),
                  }),
                ],
              })
            : null,
        ],
      })
    }
    //#endregion
    //#region src/client/ui/precision.tsx
    /** Calipers of the current adapters; see `src/core/attribution.ts`. */
    const CALIBRATION = {
      /** Characters per token for Latin-script text. */
      text: 2.6,
      /** Characters per token for CJK text. */
      cjk: 1.24,
      /** Characters per token for serialized tool schemas. */
      schema: 2.26,
      /** Pixels per token for an image. */
      pixelsPerToken: 750,
    }
    /**
     * Human sentence for one basis, used as the tooltip body.
     * @param basis - the measure's basis tag.
     */
    function basisTip(basis) {
      switch (basis) {
        case "usage":
          return t("basis.tip.usage")
        case "chars-per-token":
          return t("basis.tip.chars-per-token", {
            text: CALIBRATION.text,
            cjk: CALIBRATION.cjk,
            schema: CALIBRATION.schema,
          })
        case "harness-projection":
          return t("basis.tip.harness-projection", { px: CALIBRATION.pixelsPerToken })
        case "byte-length":
          return t("basis.tip.byte-length")
        case "unattributed":
          return t("basis.tip.unattributed")
      }
    }
    /** The tooltip body for one measure: precision word, basis, calipers, value. */
    function measureTip(measure) {
      return `${measure.precision === "exact" ? t("precision.exact") : t("precision.estimate")} · ${t(`basis.${measure.basis}`)} — ${basisTip(measure.basis)} (${formatTokens(measure.tokens)} tokens)`
    }
    /**
     * Small badge carrying the precision word.
     * @param props - the measure's precision.
     * @returns the badge.
     */
    function PrecisionBadge({ precision }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
        className:
          precision === "exact"
            ? "px-1 rounded-[3px] font-[inherit] text-[9.5px] leading-[15px] tracking-[0.02em] border-[0.5px] border-current text-ok"
            : "px-1 rounded-[3px] font-[inherit] text-[9.5px] leading-[15px] tracking-[0.02em] border-[0.5px] border-current text-fg-dim",
        "data-precision": precision,
        children: precision === "exact" ? t("precision.exact") : t("precision.estimate"),
      })
    }
    /**
     * A token count that carries its own provenance.
     * @param props.measure - the measure to print.
     * @param props.share - optional pre-computed share text, e.g. `20.3%`.
     * @param props.dense - drop the visible badge (the mark still separates them).
     * @returns the value with its mark and tooltip.
     */
    function MeasureValue({ measure, share, dense = false }) {
      const mark = measure.precision === "exact" ? "=" : "≈"
      const label = measureTip(measure)
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
        className: "relative inline-flex items-baseline gap-1 font-mono text-[11px] outline-offset-2",
        "data-precision": measure.precision,
        "data-tip": label,
        tabIndex: 0,
        "aria-label": label,
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
            className: measure.precision === "exact" ? "text-fg" : "text-fg-dim italic",
            children: formatTokens(measure.tokens),
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
            className: "text-[10px] text-fg-dim",
            "aria-hidden": "true",
            children: mark,
          }),
          dense ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PrecisionBadge, { precision: measure.precision }),
          share === void 0
            ? null
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "text-[10px] text-fg-dim",
                children: share,
              }),
        ],
      })
    }
    //#endregion
    //#region src/client/state/bar-layout.ts
    /**
     * Turn an attribution into paintable slices.
     * @param attribution - one turn's attribution.
     * @returns the layout shared by the bar and the legend.
     */
    function barLayout(attribution) {
      const total = attribution.total.tokens
      const parts = attribution.parts.filter((slice) => slice.measure.tokens > 0)
      const sumParts = parts.reduce((sum, slice) => sum + slice.measure.tokens, 0)
      const residual = total - sumParts
      const normalizedByParts = total <= 0
      const overflowingParts = !normalizedByParts && sumParts > total
      const denominator = normalizedByParts || overflowingParts ? Math.max(sumParts, 1) : total
      const segments = parts.map((slice) => ({
        key: slice.part,
        kind: "part",
        part: slice.part,
        tokens: slice.measure.tokens,
        width: (slice.measure.tokens / denominator) * 100,
        share: formatShare(slice.measure.tokens, denominator),
      }))
      if (residual > 0)
        segments.push({
          key: "unknown",
          kind: "unknown",
          tokens: residual,
          width: (residual / denominator) * 100,
          share: formatShare(residual, denominator),
        })
      return {
        segments,
        denominator,
        residual,
        overCounted: residual < 0 && !normalizedByParts ? -residual : 0,
        normalizedByParts,
        overflowingParts,
      }
    }
    //#endregion
    //#region src/client/ui/stacked-bar.tsx
    /**
     * A part's identity colour, as the theme declares it (`--color-part-*`).
     *
     * Painted inline rather than through a class: a colour utility on the same
     * element would out-rank a component rule, and every part must keep its own
     * colour in the bar and in the legend alike.
     * @param part - the context part.
     * @returns a CSS colour reference.
     */
    function partColor(part) {
      return `var(--color-part-${part})`
    }
    /**
     * The bar itself.
     * @param props.attribution - one turn's attribution.
     * @param props.label - accessible name, e.g. `第 5 轮上下文`.
     * @param props.dense - the row-sized variant used inside the turn list.
     * @returns the bar.
     */
    function StackedBar({ attribution, label, dense = false }) {
      const layout = barLayout(attribution)
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
        className: `flex w-full bg-bg-3 ${dense ? "h-1.5 overflow-hidden rounded-full" : "relative h-3 rounded-sm"}`,
        role: dense ? "img" : "group",
        "aria-label": label,
        children: layout.segments.map((segment) => {
          const name = segment.part === void 0 ? t("turns.unknown") : t(`part.${segment.part}`)
          const measure = attribution.parts.find((slice) => slice.part === segment.part)?.measure ?? {
            tokens: segment.tokens,
            precision: "estimate",
            basis: "unattributed",
          }
          const tip = `${name} · ${segment.share} · ${measureTip(measure)}`
          return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
            "span",
            {
              className:
                segment.kind === "unknown"
                  ? "h-full flex-none bg-[repeating-linear-gradient(45deg,var(--color-fg-dim)_0_2px,transparent_2px_5px)] shadow-[inset_0_0_0_1px_var(--color-fg-dim)] after:w-max after:max-w-full first:rounded-s-sm last:rounded-e-sm"
                  : "h-full flex-none after:w-max after:max-w-full first:rounded-s-sm last:rounded-e-sm",
              "data-part": segment.part ?? "unknown",
              style:
                segment.part === void 0
                  ? { width: `${segment.width.toFixed(3)}%` }
                  : {
                      width: `${segment.width.toFixed(3)}%`,
                      background: partColor(segment.part),
                    },
              title: dense ? tip : void 0,
              "data-tip": dense ? void 0 : tip,
              tabIndex: dense ? void 0 : 0,
              "aria-label": tip,
            },
            segment.key,
          )
        }),
      })
    }
    /**
     * The bar's legend: every slice with its number, share and precision, plus the
     * two honesty notices (unknown share, over-count, part-normalized bar).
     * @param props.attribution - one turn's attribution.
     * @returns the legend.
     */
    function PartLegend({ attribution }) {
      const layout = barLayout(attribution)
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
            className: "mt-3 mb-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0",
            children: [
              attribution.parts
                .filter((slice) => slice.measure.tokens !== 0)
                .map((slice) =>
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                    "li",
                    {
                      className: "inline-flex items-center gap-1.5 text-[11px]",
                      "data-part": slice.part,
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                          className: "h-2.5 w-2.5 rounded-[3px]",
                          style: { background: partColor(slice.part) },
                          "aria-hidden": "true",
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(`part.${slice.part}`) }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, {
                          measure: slice.measure,
                          share: formatShare(slice.measure.tokens, layout.denominator),
                          dense: true,
                        }),
                      ],
                    },
                    slice.part,
                  ),
                ),
              layout.residual > 0
                ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
                    className: "inline-flex items-center gap-1.5 text-[11px]",
                    "data-part": "unknown",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        className:
                          "h-2.5 w-2.5 rounded-[3px] bg-[repeating-linear-gradient(45deg,var(--color-fg-dim)_0_1px,transparent_1px_3px)]",
                        "aria-hidden": "true",
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("turns.unknown") }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, {
                        measure: {
                          tokens: layout.residual,
                          precision: "estimate",
                          basis: "unattributed",
                        },
                        share: formatShare(layout.residual, layout.denominator),
                        dense: true,
                      }),
                    ],
                  })
                : null,
            ],
          }),
          layout.residual > 0
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "mt-2 mb-0 text-[10.5px] text-fg-dim",
                role: "note",
                children: t("turns.unknownNote"),
              })
            : null,
          layout.overCounted > 0
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "mt-2 mb-0 bg-bg-1 px-2 py-1 text-[10.5px] text-warn",
                role: "note",
                children: t("turns.overCounted", { tokens: formatTokens(layout.overCounted) }),
              })
            : null,
          layout.normalizedByParts
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "mt-2 mb-0 bg-bg-1 px-2 py-1 text-[10.5px] text-warn",
                role: "note",
                children: t("turns.normalizedByParts"),
              })
            : null,
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
            className: "mt-2.5 mb-0 text-[11px] text-fg-dim",
            children: [
              t("turns.total"),
              " ",
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "font-mono text-fg",
                children: compactTokens(attribution.total.tokens),
              }),
              attribution.windowSize === void 0
                ? null
                : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
                    children: [" · ", t("turns.window", { size: compactTokens(attribution.windowSize) })],
                  }),
              attribution.reconciled === void 0
                ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
                    children: [" · ", t("turns.notReconciled")],
                  })
                : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
                    children: [" · ", t("turns.reconciled", { factor: attribution.reconciled.factor.toFixed(3) })],
                  }),
            ],
          }),
        ],
      })
    }
    //#endregion
    //#region src/client/ui/session-overview.tsx
    function Card({ title, children }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
        className: "flex min-w-0 flex-col gap-3 rounded-xl border border-line-soft bg-bg-1 p-4",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
            className: "m-0 text-[13px] font-semibold",
            children: title,
          }),
          children,
        ],
      })
    }
    /** SVG charts use existing identity colors, and do not interpolate missing values. */
    function Ring({ slices, center, name }) {
      const total = slices.reduce((sum, slice) => sum + slice.value, 0)
      let offset = 0
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: "grid w-full min-w-0 place-items-center",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
            viewBox: "0 0 120 120",
            className: "col-start-1 row-start-1 h-40 w-40 max-w-full",
            role: "img",
            "aria-label": name,
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
                cx: "60",
                cy: "60",
                r: "48",
                fill: "none",
                stroke: "var(--color-bg-3)",
                strokeWidth: "9",
              }),
              total <= 0
                ? null
                : slices.map((slice, index) => {
                    const share = (slice.value / total) * 100
                    const start = offset
                    offset += share
                    return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                      "circle",
                      {
                        cx: "60",
                        cy: "60",
                        r: "48",
                        fill: "none",
                        stroke: slice.color,
                        strokeWidth: "9",
                        pathLength: "100",
                        strokeDasharray: `${share} ${100 - share}`,
                        strokeDashoffset: -start,
                        transform: "rotate(-90 60 60)",
                      },
                      index,
                    )
                  }),
            ],
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
            className: "col-start-1 row-start-1 flex max-w-[16ch] flex-col items-center gap-1 text-center text-[12px]",
            children: center,
          }),
        ],
      })
    }
    function Unknown() {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
        className: "text-[12px] text-fg-dim",
        children: insightLabel("insights.unrecorded"),
      })
    }
    function SessionOverview({ insights, onJumpTurn }) {
      if (insights === void 0)
        return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
          className: "p-5",
          children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {}),
        })
      const current = insights.currentAttribution
      const attribution = current?.attribution
      const window = attribution?.windowSize
      const share =
        attribution !== void 0 && window !== void 0 && window > 0 ? attribution.total.tokens / window : void 0
      const usage = insights.usage
      const buckets = [
        {
          key: "input",
          color: partColor("user-input"),
        },
        {
          key: "cacheRead",
          color: partColor("history"),
        },
        {
          key: "cacheWrite",
          color: partColor("memory-instructions"),
        },
        {
          key: "output",
          color: partColor("assistant-output"),
        },
      ]
      const usageTotal =
        usage.coveredTurns === 0 ? null : buckets.reduce((sum, bucket) => sum + (usage[bucket.key] ?? 0), 0)
      const timing = insights.timing
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: "flex min-w-0 flex-col gap-4 p-5",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "grid grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] gap-4",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
                title: insightLabel("insights.current"),
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
                    name: insightLabel("insights.current"),
                    slices:
                      share === void 0
                        ? []
                        : [
                            {
                              value: Math.min(share, 1),
                              color: "var(--color-accent)",
                            },
                            {
                              value: Math.max(1 - share, 0),
                              color: "var(--color-bg-3)",
                            },
                          ],
                    center:
                      attribution === void 0
                        ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {})
                        : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
                            children: [
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
                                className: "text-[24px] tabular-nums",
                                children: compactTokens(attribution.total.tokens),
                              }),
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                className: "text-fg-dim",
                                children: "tokens",
                              }),
                            ],
                          }),
                  }),
                  attribution === void 0
                    ? null
                    : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, { measure: attribution.total }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                    className: "m-0 text-[11px] text-fg-dim",
                    children:
                      share === void 0
                        ? insightLabel("insights.windowUnknown")
                        : insightLabel("insights.window", { share: formatShare(attribution.total.tokens, window) }),
                  }),
                  current === null
                    ? null
                    : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                        className: "m-0 text-[11px] text-fg-dim",
                        children: insightLabel("insights.currentNote", { index: current.turnIndex }),
                      }),
                ],
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
                title: insightLabel("insights.usage"),
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
                    name: insightLabel("insights.usage"),
                    slices:
                      usageTotal === null
                        ? []
                        : buckets.map((bucket) => ({
                            value: usage[bucket.key] ?? 0,
                            color: bucket.color,
                          })),
                    center:
                      usageTotal === null
                        ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {})
                        : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
                            children: [
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
                                className: "text-[24px] tabular-nums",
                                children: compactTokens(usageTotal),
                              }),
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                className: "text-fg-dim",
                                children: "tokens",
                              }),
                            ],
                          }),
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
                    className: "m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2 p-0",
                    children: buckets.map((bucket) =>
                      /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                        "li",
                        {
                          className: "flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]",
                          children: [
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                              className: "h-2 w-2 shrink-0 rounded-full",
                              style: { background: bucket.color },
                              "aria-hidden": "true",
                            }),
                            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                              children: insightLabel(`insights.${bucket.key}`),
                            }),
                            usage[bucket.key] === null
                              ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {})
                              : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, {
                                  measure: {
                                    tokens: usage[bucket.key],
                                    precision: "exact",
                                    basis: "usage",
                                  },
                                  dense: true,
                                }),
                          ],
                        },
                        bucket.key,
                      ),
                    ),
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                    className: "m-0 text-[11px] text-fg-dim",
                    children: insightLabel("insights.usageNote"),
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                    className: "m-0 text-[11px] text-fg-dim",
                    children: insightLabel("insights.coverage", {
                      covered: usage.coveredTurns,
                      missing: usage.missingTurns,
                    }),
                  }),
                ],
              }),
            ],
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Card, {
            title: insightLabel("insights.composition"),
            children:
              attribution === void 0
                ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {})
                : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StackedBar, {
                        attribution,
                        label: insightLabel("insights.composition"),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PartLegend, { attribution }),
                    ],
                  }),
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3",
            children: [
              [
                ["insights.turnCount", insights.turnCount],
                ["insights.toolCalls", insights.toolCalls],
                ["insights.compactions", insights.compactions],
              ].map(([key, value]) =>
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                  Card,
                  {
                    title: insightLabel(key),
                    children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
                      className: "text-[22px] tabular-nums",
                      children: value,
                    }),
                  },
                  key,
                ),
              ),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Card, {
                title: insightLabel("insights.span"),
                children:
                  timing.spanMs === null
                    ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {})
                    : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
                        className: "text-[22px] tabular-nums",
                        children: formatDuration(1, timing.spanMs + 1),
                      }),
              }),
            ],
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
            title: insightLabel("insights.completedDuration"),
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "m-0 text-[16px] tabular-nums",
                children:
                  timing.completedTurnMs === null
                    ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {})
                    : formatDuration(1, timing.completedTurnMs + 1),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "m-0 text-[11px] text-fg-dim",
                children: insightLabel("insights.durationCoverage", {
                  covered: timing.completedTurns,
                  missing: timing.missingTurnDurations,
                }),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
                className: "m-0 text-[13px] font-semibold",
                children: insightLabel("insights.toolDuration"),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "m-0 text-[16px] tabular-nums",
                children:
                  timing.toolUnionMs === null
                    ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {})
                    : formatDuration(1, timing.toolUnionMs + 1),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "m-0 text-[11px] text-fg-dim",
                children: insightLabel("insights.durationCoverage", {
                  covered: timing.timedToolCalls,
                  missing: timing.missingToolDurations,
                }),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "m-0 text-[11px] text-fg-dim",
                children: insightLabel("insights.durationNote"),
              }),
            ],
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Card, {
            title: insightLabel("insights.lastMessage"),
            children:
              insights.lastMessage === null
                ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {})
                : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                        className: "flex flex-wrap items-center gap-2 text-[11px] text-fg-dim",
                        children: [
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                            children: insightLabel(`insights.${insights.lastMessage.role}`),
                          }),
                          insights.lastMessage.time === void 0
                            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {})
                            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", {
                                children: formatTime(insights.lastMessage.time),
                              }),
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                            type: "button",
                            className: "ci-btn min-h-9 active:bg-bg-3",
                            disabled: onJumpTurn === void 0,
                            onClick: () => onJumpTurn?.(insights.lastMessage.turnIndex),
                            children: insightLabel("insights.jump", { index: insights.lastMessage.turnIndex }),
                          }),
                        ],
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                        className:
                          "m-0 max-h-64 overflow-y-auto text-[12px] leading-relaxed wrap-anywhere whitespace-pre-wrap",
                        children: insights.lastMessage.text,
                      }),
                    ],
                  }),
          }),
        ],
      })
    }
    //#endregion
    //#region src/client/ui/skill-usage.tsx
    function visibleSkills(skills, query, sort) {
      const needle = query.trim().toLowerCase()
      return skills
        .filter((skill) => `${skill.name}\n${skill.path ?? ""}`.toLowerCase().includes(needle))
        .sort(
          (a, b) =>
            (sort === "count" ? b.count - a.count : b.lastTurnIndex - a.lastTurnIndex) ||
            b.lastTurnIndex - a.lastTurnIndex ||
            a.id.localeCompare(b.id),
        )
    }
    function SkillUsage({ skills, onJumpTurn }) {
      const [query, setQuery] = (0, react.useState)("")
      const [sort, setSort] = (0, react.useState)("count")
      const visible = visibleSkills(skills ?? [], query, sort)
      const maximum = Math.max(1, ...visible.map((skill) => skill.count))
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: "flex min-w-0 flex-col gap-4 p-5",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
            className: "m-0 text-[12px] leading-relaxed text-fg-dim",
            children: insightLabel("insights.skillNote"),
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "flex flex-wrap items-center gap-3",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
                className: "flex min-w-0 basis-64 flex-col gap-1 text-[11px]",
                children: [
                  insightLabel("insights.searchSkills"),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
                    type: "search",
                    value: query,
                    onChange: (event) => setQuery(event.target.value),
                    className: "min-h-10 w-full rounded-md border border-line bg-bg-1 px-3 text-[12px]",
                  }),
                ],
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
                className: "flex min-w-0 flex-col gap-1 text-[11px]",
                children: [
                  insightLabel("insights.sortSkills"),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
                    value: sort,
                    onChange: (event) => setSort(event.target.value === "recent" ? "recent" : "count"),
                    className: "min-h-10 rounded-md border border-line bg-bg-1 px-3 text-[12px] active:bg-bg-3",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
                        value: "count",
                        children: insightLabel("insights.byCount"),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
                        value: "recent",
                        children: insightLabel("insights.byRecent"),
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          skills === void 0
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "m-0 text-fg-dim",
                children: insightLabel("insights.unrecorded"),
              })
            : visible.length === 0
              ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                  className: "m-0 text-fg-dim",
                  children: insightLabel("insights.noSkills"),
                })
              : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
                  className: "m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-3 p-0",
                  children: visible.map((skill, rank) =>
                    /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                      "li",
                      {
                        className: "flex min-w-0 flex-col gap-3 rounded-xl border border-line-soft bg-bg-1 p-4",
                        children: [
                          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                            className: "flex min-w-0 items-baseline gap-2",
                            children: [
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                className: "font-mono text-[11px] text-fg-dim",
                                children: rank + 1,
                              }),
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
                                className: "m-0 min-w-0 flex-1 text-[13px] font-semibold wrap-anywhere",
                                children: skill.name,
                              }),
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                className: "shrink-0 text-[11px] tabular-nums",
                                children: insightLabel("insights.skillCount", { count: skill.count }),
                              }),
                            ],
                          }),
                          skill.path === void 0
                            ? null
                            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                                className: "m-0 font-mono text-[10px] wrap-anywhere text-fg-dim",
                                children: skill.path,
                              }),
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("meter", {
                            min: "0",
                            max: maximum,
                            value: skill.count,
                            className: "h-2 w-full",
                            "aria-label": `${skill.name}: ${skill.count}`,
                          }),
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                            type: "button",
                            className: "ci-btn min-h-9 self-start active:bg-bg-3",
                            disabled: onJumpTurn === void 0,
                            onClick: () => onJumpTurn?.(skill.lastTurnIndex),
                            children: insightLabel("insights.jump", { index: skill.lastTurnIndex }),
                          }),
                          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
                            children: [
                              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
                                className: "cursor-pointer rounded-md py-2 text-[11px] active:bg-bg-3",
                                children: [insightLabel("insights.evidence"), " (", skill.evidence.length, ")"],
                              }),
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
                                className: "m-0 flex list-none flex-col gap-2 p-0",
                                children: skill.evidence.map((evidence) =>
                                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                                    "li",
                                    {
                                      className: "min-w-0 rounded-md bg-bg-2 p-2 text-[11px]",
                                      children: [
                                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                                          type: "button",
                                          className: "ci-btn min-h-9 max-w-full active:bg-bg-3",
                                          disabled: onJumpTurn === void 0,
                                          onClick: () => onJumpTurn?.(evidence.turnIndex),
                                          children: insightLabel("insights.jump", { index: evidence.turnIndex }),
                                        }),
                                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                                          className: "m-0 py-1",
                                          children: insightLabel(`insights.${evidence.kind}`),
                                        }),
                                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                                          className: "m-0 font-mono wrap-anywhere text-fg-dim",
                                          children: evidence.toolCallId,
                                        }),
                                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                                          className: "m-0 text-fg-dim",
                                          children:
                                            evidence.time === void 0
                                              ? insightLabel("insights.unrecorded")
                                              : formatTime(evidence.time),
                                        }),
                                      ],
                                    },
                                    evidence.toolCallId,
                                  ),
                                ),
                              }),
                            ],
                          }),
                        ],
                      },
                      skill.id,
                    ),
                  ),
                }),
        ],
      })
    }
    //#endregion
    //#region src/client/ui/subagent-tree.tsx
    /**
     * @param props.segments - the session's physical files, main first.
     * @param props.turnSubagents - subagent ids recorded on the open turn.
     * @returns the section.
     */
    function SubagentTree({ segments, turnSubagents }) {
      const attached = segments.slice(1)
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card$1, {
        label: t("subagents.title"),
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionTitle, {
            count: turnSubagents.length,
            children: t("subagents.title"),
          }),
          segments.length === 0
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "m-0 text-[11.5px] text-fg-dim",
                children: t("subagents.none"),
              })
            : null,
          segments.length > 0
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
                className: "ci-fold mt-1 mb-2",
                open: attached.length > 0 && attached.length <= 3,
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
                    className: "inline-flex items-center gap-1 text-[11.5px] text-fg-dim",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                        name: "chevron",
                        size: 11,
                        className: "ci-chevron",
                      }),
                      t("subagents.files", { count: attached.length }),
                    ],
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
                    className: "mt-1.5 mb-0 list-none p-0 font-mono text-[11px]",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
                        className: "flex items-baseline gap-1.5 py-0.5 ps-0",
                        children: [
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                            className: "text-fg-dim",
                            "aria-hidden": "true",
                            children: "▸",
                          }),
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                            className: "truncate",
                            children: basename(segments[0]?.name ?? ""),
                          }),
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                            className: "text-[10px] text-fg-dim",
                            children: formatBytes(segments[0]?.bytes ?? 0),
                          }),
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chip, { children: t("subagents.main") }),
                        ],
                      }),
                      attached.map((segment) =>
                        /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                          "li",
                          {
                            className: "flex items-baseline gap-1.5 py-0.5 ps-3",
                            children: [
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                className: "text-fg-dim",
                                "aria-hidden": "true",
                                children: "└",
                              }),
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                className: "truncate",
                                children: segment.name,
                              }),
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                className: "text-[10px] text-fg-dim",
                                children: formatBytes(segment.bytes),
                              }),
                            ],
                          },
                          segment.name,
                        ),
                      ),
                    ],
                  }),
                ],
              })
            : null,
          turnSubagents.length === 0
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                className: "m-0 text-[11.5px] text-fg-dim",
                children: t("turns.noSubagents"),
              })
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
                className: "mt-1.5 mb-2 flex list-none flex-wrap gap-1.5 p-0",
                children: turnSubagents.map((id) =>
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                    "li",
                    {
                      children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Chip, {
                        tone: "mono",
                        children: [
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                            name: "branch",
                            size: 11,
                          }),
                          id,
                        ],
                      }),
                    },
                    id,
                  ),
                ),
              }),
        ],
      })
    }
    //#endregion
    //#region src/client/ui/tool-detail.tsx
    /**
     * Chip skin per status. Spelled out rather than interpolated, so no class name is
     * ever built at runtime.
     */
    const STATUS_SKIN = {
      ok: "ci-status ci-status--ok",
      error: "ci-status ci-status--error",
      unknown: "ci-status ci-status--unknown",
      running: "ci-status ci-status--running",
    }
    /** Calls rendered before the "show all" control appears. */
    const VISIBLE_CALLS = 12
    /** Characters of a block printed before it folds. */
    const PREVIEW_CHARS = 600
    function asRecord(value) {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0
      return value
    }
    function stringField(record, key) {
      const value = record?.[key]
      return typeof value === "string" ? value : void 0
    }
    /**
     * Flatten a tool result into text.
     * @param value - a string, a content-block array, or any JSON value.
     * @returns printable text (possibly empty).
     */
    function outputText(value) {
      if (value === void 0) return ""
      if (typeof value === "string") return value
      if (Array.isArray(value))
        return value
          .map((entry) => {
            if (typeof entry === "string") return entry
            const record = asRecord(entry)
            return stringField(record, "text") ?? (record === void 0 ? "" : JSON.stringify(record))
          })
          .filter((part) => part !== "")
          .join("\n")
      const text = stringField(asRecord(value), "text")
      if (text !== void 0) return text
      try {
        return JSON.stringify(value, null, 2)
      } catch {
        return String(value)
      }
    }
    /**
     * The one fact a call is about, chosen by tool name.
     * @param call - the tool call.
     * @returns label and body, or undefined when the call carries no named input.
     */
    function primaryFact(call) {
      const input = asRecord(call.input)
      const command = stringField(input, "command")
      if (command !== void 0)
        return {
          label: t("tools.command"),
          body: command,
          mono: true,
        }
      const path = stringField(input, "file_path") ?? stringField(input, "path") ?? stringField(input, "notebook_path")
      if (path !== void 0)
        return {
          label: t("tools.path"),
          body: path,
          mono: true,
        }
      const url = stringField(input, "url")
      if (url !== void 0)
        return {
          label: "url",
          body: url,
          mono: true,
        }
      const query = stringField(input, "query")
      if (query !== void 0)
        return {
          label: "query",
          body: query,
        }
      if (call.input === void 0) return void 0
      return {
        label: t("tools.input"),
        body: clip(outputText(call.input), PREVIEW_CHARS),
        mono: true,
      }
    }
    /**
     * A replaced/inserted pair, printed line by line.
     * @param props.before - text the edit removed.
     * @param props.after - text the edit inserted.
     * @returns the diff block.
     */
    function DiffBlock({ before, after }) {
      const removed = before === "" ? [] : before.split("\n")
      const added = after === "" ? [] : after.split("\n")
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
            className: "mb-1 block text-[10.5px] text-fg-dim",
            children: t("tools.diff"),
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("pre", {
            className: "ci-pre max-h-55",
            children: [
              removed.map((line, index) =>
                /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                  "span",
                  {
                    className: "block bg-[color-mix(in_oklch,var(--color-err)_8%,transparent)] text-err",
                    children: [line, "\n"],
                  },
                  `d${String(index)}`,
                ),
              ),
              added.map((line, index) =>
                /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                  "span",
                  {
                    className: "block bg-[color-mix(in_oklch,var(--color-ok)_8%,transparent)] text-ok",
                    children: [line, "\n"],
                  },
                  `a${String(index)}`,
                ),
              ),
            ],
          }),
        ],
      })
    }
    /**
     * One call: a one-line summary that folds open into the facts.
     *
     * The summary carries what a reader scans for — tool, status, the command or
     * path, duration — and a failed call opens itself, because its error text is
     * the reason to look.
     * @param props.call - the call.
     * @returns the entry.
     */
    function ToolEntry({ call }) {
      const fact = primaryFact(call)
      const input = asRecord(call.input)
      const before = stringField(input, "old_string")
      const after = stringField(input, "new_string")
      const output = outputText(call.output)
      const failed = call.status === "error"
      const status = call.endedAt === void 0 && call.status !== "error" ? "running" : call.status
      const statusLabel =
        status === "running"
          ? t("tools.status.running")
          : status === "ok"
            ? t("tools.status.ok")
            : status === "error"
              ? t("tools.status.error")
              : t("tools.status.unknown")
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
        className: failed ? "rounded-lg border border-err/40 bg-err/5" : "rounded-lg border border-line-soft bg-bg",
        children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
          className: "ci-fold",
          open: failed,
          children: [
            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
              className: "flex min-w-0 items-center gap-2 px-2.5 py-2 text-[12px]",
              children: [
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                  name: "chevron",
                  size: 11,
                  className: "ci-chevron shrink-0 text-fg-3",
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className: "shrink-0 font-mono font-semibold",
                  children: call.name,
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className: `${STATUS_SKIN[status]} shrink-0`,
                  children: statusLabel,
                }),
                fact === void 0
                  ? null
                  : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                      className: "min-w-0 flex-1 truncate font-mono text-[11px] text-fg-dim",
                      title: fact.body,
                      children: fact.body.split("\n")[0],
                    }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className: "ms-auto shrink-0 text-[10.5px] text-fg-3 tabular-nums",
                  children: formatDuration(call.startedAt, call.endedAt),
                }),
              ],
            }),
            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
              className: "flex flex-col gap-2 px-2.5 pb-2.5",
              children: [
                fact === void 0
                  ? null
                  : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                          className: "mb-1 block text-[10.5px] text-fg-dim",
                          children: fact.label,
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
                          className: "ci-pre",
                          children: clip(fact.body, PREVIEW_CHARS),
                        }),
                      ],
                    }),
                before === void 0 && after === void 0
                  ? null
                  : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffBlock, {
                      before: before ?? "",
                      after: after ?? "",
                    }),
                output === ""
                  ? null
                  : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                      children: [
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                          className: failed
                            ? "mb-1 block text-[10.5px] text-err"
                            : "mb-1 block text-[10.5px] text-fg-dim",
                          children: failed ? `${t("tools.output")} · ${t("tools.status.error")}` : t("tools.output"),
                        }),
                        /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
                          className: "ci-pre max-h-80",
                          children: clip(output, PREVIEW_CHARS * 4),
                        }),
                      ],
                    }),
              ],
            }),
          ],
        }),
      })
    }
    /**
     * The whole tool section for one turn.
     * @param props.calls - that turn's calls.
     * @param props.expanded - whether the caller lifted the visible cap.
     * @param props.onToggleExpanded - lift/lower the cap.
     * @returns the section body.
     */
    function ToolCalls({ calls, expanded, onToggleExpanded }) {
      if (calls.length === 0)
        return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
          className: "m-0 text-[11.5px] text-fg-dim",
          children: t("turns.noTools"),
        })
      const visible = expanded ? calls : calls.slice(0, VISIBLE_CALLS)
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
            className: "m-0 flex list-none flex-col gap-1.5 p-0",
            children: visible.map((call) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolEntry, { call }, call.id)),
          }),
          calls.length > VISIBLE_CALLS
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                type: "button",
                className: "ci-btn ci-btn--quiet mt-2",
                onClick: () => onToggleExpanded(!expanded),
                children: expanded ? t("tools.showLess") : t("tools.showAll", { count: calls.length }),
              })
            : null,
        ],
      })
    }
    //#endregion
    //#region src/client/ui/turn-detail.tsx
    /**
     * @param props.turn - the open turn.
     * @param props.segments - session files, for the subagent tree.
     * @param props.expandedTools - whether the tool cap is lifted.
     * @param props.onToggleTools - lift/lower the tool cap.
     * @returns the column body.
     */
    function TurnDetail({ turn, segments, expandedTools, onToggleTools }) {
      const attribution = turn.attribution
      const total = attribution.total.tokens
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: "flex min-w-0 flex-col",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "sticky top-0 z-10 flex flex-col gap-3 border-b border-line-soft bg-bg px-4 pt-4 pb-3",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                className: "flex min-w-0 items-end gap-3",
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                    className: "flex min-w-0 flex-col",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
                        className: "m-0 text-[15px] font-semibold",
                        children: t("turns.selected", { index: turn.index }),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        className: "text-[11px] text-fg-dim tabular-nums",
                        children: formatTime(turn.startedAt),
                      }),
                    ],
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                    className: "ms-auto flex items-baseline gap-2",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        className: "text-[20px] font-semibold tracking-[-0.01em] tabular-nums",
                        children: compactTokens(total),
                      }),
                      attribution.windowSize === void 0
                        ? null
                        : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chip, {
                            tone: "soft",
                            children: t("stats.windowShare", {
                              share: formatShare(total, attribution.windowSize),
                              size: compactTokens(attribution.windowSize),
                            }),
                          }),
                    ],
                  }),
                ],
              }),
              turn.userInput.length === 0
                ? null
                : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                    className: "ci-ask",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        className: "ci-ask__label",
                        children: t("detail.userInput"),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
                        className: "ci-ask__text",
                        children: turn.userInput.join("\n"),
                      }),
                    ],
                  }),
            ],
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "flex min-w-0 flex-col gap-3 p-4",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card$1, {
                label: t("detail.composition"),
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionTitle, {
                    end:
                      attribution.reconciled === void 0
                        ? void 0
                        : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chip, {
                            tone: "mono",
                            title: t("turns.reconciled", { factor: attribution.reconciled.factor.toFixed(3) }),
                            children: formatFactor(attribution.reconciled.factor),
                          }),
                    children: t("detail.composition"),
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StackedBar, {
                    attribution,
                    label: t("turns.selected", { index: turn.index }),
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PartLegend, { attribution }),
                ],
              }),
              turn.compactions.length === 0
                ? null
                : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card$1, {
                    label: t("turns.compaction"),
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionTitle, {
                        count: turn.compactions.length,
                        children: t("turns.compaction"),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
                        className: "m-0 list-none p-0",
                        children: turn.compactions.map((point, order) =>
                          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                            "li",
                            {
                              className:
                                "flex flex-wrap items-baseline gap-2 border-t border-line-soft py-1.5 text-[11.5px] first:border-t-0",
                              children: [
                                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                  className: "font-mono text-[10.5px] text-fg-dim",
                                  children: formatTime(point.at),
                                }),
                                /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, {
                                  measure: point.before,
                                  dense: true,
                                }),
                                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                  "aria-hidden": "true",
                                  className: "text-warn",
                                  children: "→",
                                }),
                                /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, {
                                  measure: point.after,
                                  dense: true,
                                }),
                                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                  className: "text-fg-dim",
                                  children: point.replacedHistory
                                    ? t("turns.compactionReplaced")
                                    : t("turns.compactionContinued"),
                                }),
                                point.trigger === void 0
                                  ? null
                                  : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chip, {
                                      tone: "soft",
                                      children: point.trigger,
                                    }),
                              ],
                            },
                            `${String(point.at)}-${String(order)}`,
                          ),
                        ),
                      }),
                    ],
                  }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card$1, {
                label: t("turns.tools"),
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionTitle, {
                    count: turn.toolCalls.length,
                    children: t("turns.tools"),
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolCalls, {
                    calls: turn.toolCalls,
                    expanded: expandedTools,
                    onToggleExpanded: onToggleTools,
                  }),
                ],
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SubagentTree, {
                segments,
                turnSubagents: turn.subagents,
              }),
            ],
          }),
        ],
      })
    }
    //#endregion
    //#region src/client/state/turn-rows.ts
    /**
     * Build the strip's rows: one compaction row per turn that has any, then the
     * turn itself.
     * @param turns - the loaded page(s) of turns, in order.
     * @returns the rows.
     */
    function buildTurnRows(turns) {
      const rows = []
      for (const turn of turns) {
        if (turn.compactions.length > 0)
          rows.push({
            kind: "compactions",
            key: `c-${String(turn.index)}`,
            turn,
            points: turn.compactions,
          })
        rows.push({
          kind: "turn",
          key: `t-${String(turn.index)}`,
          turn,
        })
      }
      return rows
    }
    //#endregion
    //#region src/client/ui/turn-list.tsx
    /**
     * One turn's compaction boundaries, collapsed.
     * @param props.points - every boundary recorded in this turn.
     * @param props.turn - the turn that carries them.
     * @returns the divider row.
     */
    function CompactionsRow({ points, turn }) {
      const first = points[0]
      const last = points[points.length - 1]
      const range =
        first === void 0 || last === void 0
          ? ""
          : t("compactions.range", {
              before: compactTokens(first.before.tokens),
              after: compactTokens(last.after.tokens),
            })
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
        className: "my-1 px-1 text-[11px] text-warn",
        "data-turn": turn.index,
        children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
          className: "ci-fold rounded-lg border border-dashed border-warn/50 bg-warn/6",
          children: [
            /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
              className: "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 py-1.5",
              children: [
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                  name: "chevron",
                  size: 10,
                  className: "ci-chevron",
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className: "font-semibold",
                  children: t("compactions.count", { count: points.length }),
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className: "font-mono tabular-nums",
                  children: range,
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className: "text-fg-dim",
                  children:
                    first?.replacedHistory === true ? t("turns.compactionReplaced") : t("turns.compactionContinued"),
                }),
              ],
            }),
            /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
              className: "m-0 list-none px-2.5 pb-1.5 text-fg-dim",
              children: points.map((point, order) =>
                /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                  "li",
                  {
                    className: "flex flex-wrap gap-2 py-0.5",
                    children: [
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        className: "font-mono",
                        children: formatShortTime(point.at),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                        className: "font-mono tabular-nums",
                        children: t("compactions.range", {
                          before: compactTokens(point.before.tokens),
                          after: compactTokens(point.after.tokens),
                        }),
                      }),
                      /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                        children: [
                          point.replacedHistory ? t("turns.compactionReplaced") : t("turns.compactionContinued"),
                          point.trigger === void 0 ? "" : ` · ${point.trigger}`,
                        ],
                      }),
                    ],
                  },
                  `${String(point.at)}-${String(order)}`,
                ),
              ),
            }),
          ],
        }),
      })
    }
    /**
     * Tooltip for one turn's price: model, cache hit rate, and whether it is a
     * preview price.
     * @param index - the turn index.
     * @param cost - that turn's priced line.
     */
    function costTip(index, cost) {
      const rate = cost.cacheHitRate === null ? "—" : `${String(Math.round(cost.cacheHitRate * 100))}%`
      const line = t("cost.turnTip", {
        index,
        model: cost.model ?? "—",
        rate,
      })
      return cost.provisional === true ? `${line} · ${t("cost.provisional")}` : line
    }
    /**
     * One turn row: what was asked, how big the context was, what it held.
     * @param props.turn - the turn.
     * @param props.selected - whether this row is the open one.
     * @param props.onSelect - selection callback.
     * @param props.onKeyNav - arrow-key handler, shared by every row.
     * @param props.cost - this turn's priced line, when the Host returned one.
     * @returns the row.
     */
    function TurnRow({ turn, selected, onSelect, onKeyNav, cost }) {
      const layout = barLayout(turn.attribution)
      const unknown = layout.residual > 0 ? formatShare(layout.residual, layout.denominator) : void 0
      const tools = turn.toolCalls.length
      const summary = `${t("turns.selected", { index: turn.index })}: ${compactTokens(turn.attribution.total.tokens)}`
      const ask = turn.userInput.join(" ").trim()
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
        "data-turn": turn.index,
        children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
          role: "button",
          tabIndex: 0,
          "data-turn-row": "",
          className: "ci-row px-2.5 py-2",
          "data-selected": selected,
          "aria-pressed": selected,
          onClick: () => onSelect(turn.index),
          onKeyDown: (event) => {
            if (event.key === "ArrowDown") onKeyNav(event, 1)
            else if (event.key === "ArrowUp") onKeyNav(event, -1)
            else if (event.key === "Home") onKeyNav(event, "first")
            else if (event.key === "End") onKeyNav(event, "last")
            else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onSelect(turn.index)
            }
          },
          children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
            className: "grid grid-cols-[22px_minmax(0,1fr)_64px] items-center gap-x-2 gap-y-1.5",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "font-mono text-[11px] text-fg-3 tabular-nums",
                children: turn.index,
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: ask === "" ? "min-w-0 truncate text-[12.5px] text-fg-3" : "min-w-0 truncate text-[12.5px]",
                children: ask === "" ? t("turns.noInput") : ask,
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "text-end text-[12.5px] font-semibold tabular-nums",
                children: compactTokens(turn.attribution.total.tokens),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { "aria-hidden": "true" }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StackedBar, {
                attribution: turn.attribution,
                label: summary,
                dense: true,
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { "aria-hidden": "true" }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { "aria-hidden": "true" }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                className:
                  "grid grid-cols-[var(--ci-time-w)_36px_44px_minmax(0,1fr)] items-center gap-x-1.5 text-[10.5px] text-fg-dim tabular-nums",
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatShortTime(turn.startedAt) }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                    className: "inline-flex items-center gap-0.5",
                    title: t("turns.tools"),
                    children:
                      tools === 0
                        ? null
                        : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
                            children: [
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                                name: "tool",
                                size: 11,
                              }),
                              tools,
                            ],
                          }),
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                    className: "font-mono",
                    title:
                      turn.attribution.reconciled === void 0
                        ? void 0
                        : t("turns.reconciled", { factor: turn.attribution.reconciled.factor.toFixed(3) }),
                    children:
                      turn.attribution.reconciled === void 0 ? "" : `×${turn.attribution.reconciled.factor.toFixed(2)}`,
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                    className: "flex min-w-0 items-center gap-1.5",
                    children: [
                      turn.subagents.length === 0
                        ? null
                        : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
                            className: "inline-flex items-center gap-0.5",
                            title: t("turns.subagents"),
                            children: [
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                                name: "branch",
                                size: 11,
                              }),
                              turn.subagents.length,
                            ],
                          }),
                      unknown === void 0
                        ? null
                        : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Chip, {
                            tone: "warn",
                            title: t("turns.unknownNote"),
                            children: [t("turns.unknown"), " ", unknown],
                          }),
                    ],
                  }),
                ],
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "relative text-end font-mono text-[10.5px] text-fg-dim tabular-nums",
                "data-tip": cost === void 0 || cost.usd === null ? void 0 : costTip(turn.index, cost),
                tabIndex: cost === void 0 || cost.usd === null ? void 0 : 0,
                children:
                  cost === void 0 || cost.usd === null
                    ? ""
                    : (cost.provisional === true ? "~" : "") + formatUsd(cost.usd),
              }),
            ],
          }),
        }),
      })
    }
    /**
     * The strip.
     * @param props.turns - the loaded page(s) of turns.
     * @param props.selected - open turn index.
     * @param props.onSelect - selection callback.
     * @param props.costs - per-turn priced lines, when available.
     * @returns the list.
     */
    function TurnList({ turns, selected, onSelect, costs }) {
      const rows = buildTurnRows(turns)
      const timeWidth = turns.some((turn) => formatShortTime(turn.startedAt).length > 5) ? "72px" : "34px"
      function move(event, delta) {
        event.preventDefault()
        const list = event.currentTarget.closest("ul")
        if (list === null) return
        const rows = [...list.querySelectorAll("[data-turn-row]")]
        const current = rows.indexOf(event.currentTarget)
        if (current < 0) return
        rows[
          delta === "first"
            ? 0
            : delta === "last"
              ? rows.length - 1
              : Math.min(rows.length - 1, Math.max(0, current + delta))
        ]?.focus()
      }
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
        className: "m-0 flex list-none flex-col gap-0.5 p-1.5",
        role: "list",
        "aria-label": t("turns.title"),
        style: { ["--ci-time-w"]: timeWidth },
        children: rows.map((row) => {
          if (row.kind === "compactions")
            return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
              CompactionsRow,
              {
                points: row.points,
                turn: row.turn,
              },
              row.key,
            )
          const cost = costs?.get(row.turn.index)
          return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
            TurnRow,
            {
              turn: row.turn,
              selected: selected === row.turn.index,
              onSelect,
              onKeyNav: move,
              ...(cost === void 0 ? {} : { cost }),
            },
            row.key,
          )
        }),
      })
    }
    //#endregion
    //#region src/client/ui/waterfall.tsx
    /** viewBox of the chart; CSS scales it to the box. */
    const WIDTH = 1e3
    const HEIGHT = 100
    /**
     * @param props.turns - the turns loaded so far, in order.
     * @param props.selected - turn index to mark, if any.
     * @param props.onSelect - open one turn.
     * @returns the chart, or null when there is nothing to plot.
     */
    function Waterfall({ turns, selected, onSelect }) {
      if (turns.length === 0) return null
      const values = turns.map((turn) => Math.max(0, turn.attribution.total.tokens))
      const peak = Math.max(1, ...values)
      /** Horizontal position, 0..1. */
      const xOf = (index) => (turns.length === 1 ? 0.5 : index / (turns.length - 1))
      /** Vertical position from the top, 0..1. */
      const yOf = (value) => 1 - (value / peak) * 0.88
      const line = values
        .map(
          (value, index) =>
            `${index === 0 ? "M" : "L"}${(xOf(index) * WIDTH).toFixed(1)},${(yOf(value) * HEIGHT).toFixed(1)}`,
        )
        .join(" ")
      const area = `${line} L${(xOf(turns.length - 1) * WIDTH).toFixed(1)},${HEIGHT} L${(xOf(0) * WIDTH).toFixed(1)},${HEIGHT} Z`
      const compactions = turns.flatMap((turn, index) =>
        turn.compactions.map((point) => ({
          index,
          point,
        })),
      )
      const marked = selected === null ? -1 : turns.findIndex((turn) => turn.index === selected)
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
        className: "m-0 px-3.5 pt-3 pb-3",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figcaption", {
            className: "flex items-baseline gap-2 text-[11px] text-fg-dim",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "text-[12px] font-semibold text-fg",
                children: t("waterfall.title"),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "tabular-nums",
                children: t("waterfall.peak", { tokens: compactTokens(peak) }),
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                className: "ms-auto truncate text-fg-3",
                children: t("waterfall.hint"),
              }),
            ],
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "relative mt-2.5 h-24",
            role: "group",
            "aria-label": `${t("waterfall.title")} — ${t("waterfall.caption")}`,
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
                className: "absolute inset-0 block h-full w-full overflow-visible",
                viewBox: `0 0 ${String(WIDTH)} ${String(HEIGHT)}`,
                preserveAspectRatio: "none",
                "aria-hidden": "true",
                children: [
                  [0.25, 0.5, 0.75].map((level) =>
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                      "line",
                      {
                        className: "stroke-line-soft [vector-effect:non-scaling-stroke]",
                        x1: 0,
                        x2: WIDTH,
                        y1: level * HEIGHT,
                        y2: level * HEIGHT,
                      },
                      level,
                    ),
                  ),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
                    className: "fill-accent opacity-[0.14]",
                    d: area,
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
                    className:
                      "fill-none stroke-accent stroke-[1.6] [stroke-linejoin:round] [vector-effect:non-scaling-stroke]",
                    d: line,
                  }),
                  compactions.map(({ index, point }, order) =>
                    /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                      "line",
                      {
                        className:
                          "stroke-warn stroke-1 opacity-80 [stroke-dasharray:3_3] [vector-effect:non-scaling-stroke]",
                        x1: xOf(index) * WIDTH,
                        x2: xOf(index) * WIDTH,
                        y1: 0,
                        y2: HEIGHT,
                        children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", {
                          children: `${t("turns.compaction")}: ${compactTokens(point.before.tokens)} → ${compactTokens(point.after.tokens)}`,
                        }),
                      },
                      `${String(index)}-${String(order)}`,
                    ),
                  ),
                  marked < 0
                    ? null
                    : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
                        className: "stroke-fg-dim stroke-1 opacity-50 [vector-effect:non-scaling-stroke]",
                        x1: xOf(marked) * WIDTH,
                        x2: xOf(marked) * WIDTH,
                        y1: 0,
                        y2: HEIGHT,
                      }),
                ],
              }),
              turns.map((turn, index) =>
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "ci-dot",
                    "data-selected": index === marked,
                    style: {
                      left: `${(xOf(index) * 100).toFixed(2)}%`,
                      top: `${(yOf(values[index] ?? 0) * 100).toFixed(2)}%`,
                    },
                    title: `${t("turns.selected", { index: turn.index })} · ${compactTokens(turn.attribution.total.tokens)}`,
                    "aria-label": `${t("turns.selected", { index: turn.index })} · ${compactTokens(turn.attribution.total.tokens)}`,
                    onClick: () => onSelect(turn.index),
                  },
                  turn.index,
                ),
              ),
            ],
          }),
        ],
      })
    }
    //#endregion
    //#region src/client/ui/session-pane.tsx
    /**
     * The loaded session: header on top, the turn strip and the open turn below.
     * @param props.session - the loaded page(s) of one session.
     * @param props.title - accessible name for the article.
     * @returns the pane body.
     */
    function SessionPane({
      session,
      title,
      cost,
      costs,
      selectedTurn,
      onSelectTurn,
      toolsExpanded,
      onToggleTools,
      onLoadMore,
      onHandoff,
      onOpenSession,
      onJumpTurn,
      revealTurns = false,
    }) {
      const id = (0, react.useId)()
      const sessionKey = `${session.data.session.source}:${session.data.session.id}`
      const [view, setView] = (0, react.useState)({
        sessionKey,
        selectedTurn,
        tab: revealTurns ? "turns" : "overview",
      })
      let tab = view.tab
      if (view.sessionKey !== sessionKey) {
        tab = "overview"
        setView({
          sessionKey,
          selectedTurn,
          tab,
        })
      } else if (view.selectedTurn !== selectedTurn) {
        if (view.selectedTurn !== null && selectedTurn !== null) tab = "turns"
        setView({
          sessionKey,
          selectedTurn,
          tab,
        })
      }
      const jump = (index) => {
        setView({
          sessionKey,
          selectedTurn,
          tab: "turns",
        })
        if (onJumpTurn !== void 0) onJumpTurn(index)
        else onSelectTurn(index)
      }
      const currentTurn = session.turns.find((turn) => turn.index === selectedTurn)
      const tabs = ["overview", "turns", "skills"]
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
        className: "flex h-full min-h-0 flex-col overflow-y-auto @3xl:overflow-hidden",
        "aria-label": title,
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionHead, {
            onOpenSession,
            data: session.data,
            turns: session.turns,
            cost,
            onHandoff,
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
            role: "tablist",
            "aria-label": insightLabel("insights.tabs"),
            className: "flex shrink-0 gap-2 overflow-x-auto border-b border-line-soft px-5 py-2",
            children: tabs.map((name, position) =>
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
                "button",
                {
                  id: `${id}-${name}`,
                  type: "button",
                  role: "tab",
                  "aria-selected": tab === name,
                  "aria-controls": `${id}-content`,
                  tabIndex: tab === name ? 0 : -1,
                  className:
                    tab === name
                      ? "ci-btn min-h-10 bg-bg-2 text-accent active:bg-bg-3"
                      : "ci-btn min-h-10 active:bg-bg-3",
                  onClick: () =>
                    setView({
                      sessionKey,
                      selectedTurn,
                      tab: name,
                    }),
                  onKeyDown: (event) => {
                    const next =
                      event.key === "ArrowRight"
                        ? (position + 1) % tabs.length
                        : event.key === "ArrowLeft"
                          ? (position + tabs.length - 1) % tabs.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? tabs.length - 1
                              : void 0
                    if (next === void 0) return
                    event.preventDefault()
                    setView({
                      sessionKey,
                      selectedTurn,
                      tab: tabs[next],
                    })
                    event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next]?.focus()
                  },
                  children: insightLabel(`insights.${name}`),
                },
                name,
              ),
            ),
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
            id: `${id}-content`,
            role: "tabpanel",
            "aria-labelledby": `${id}-${tab}`,
            tabIndex: 0,
            className: "ci-scroll flex min-h-0 min-w-0 flex-1 flex-col @3xl:overflow-y-auto",
            children:
              tab === "overview"
                ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionOverview, {
                    insights: session.data.insights,
                    onJumpTurn: jump,
                  })
                : tab === "skills"
                  ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillUsage, {
                      skills: session.data.insights?.skills,
                      onJumpTurn: jump,
                    })
                  : session.turns.length === 0
                    ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyBlock, {
                        title: t("session.noTurns"),
                        hint: t("session.noTurnsHint"),
                        center: true,
                      })
                    : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                        className:
                          "flex flex-col @3xl:grid @3xl:min-h-0 @3xl:flex-1 @3xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]",
                        children: [
                          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
                            className: "flex min-w-0 flex-col border-line-soft @3xl:min-h-0 @3xl:border-e",
                            children: [
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
                                className: "shrink-0 border-b border-line-soft",
                                children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Waterfall, {
                                  turns: session.turns,
                                  selected: selectedTurn,
                                  onSelect: onSelectTurn,
                                }),
                              }),
                              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
                                className:
                                  "ci-scroll @3xl:min-h-0 @3xl:flex-1 @3xl:overflow-y-auto @3xl:overscroll-contain",
                                children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TurnList, {
                                  turns: session.turns,
                                  selected: selectedTurn,
                                  onSelect: onSelectTurn,
                                  costs,
                                }),
                              }),
                              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
                                className:
                                  "flex shrink-0 items-center justify-between gap-2 border-t border-line-soft px-3.5 py-2 text-[11px] text-fg-dim",
                                children: [
                                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                                    className: "tabular-nums",
                                    children: t("session.paging", {
                                      from: session.turns.length === 0 ? 0 : 1,
                                      to: session.turns.length,
                                      total: session.data.turnCount,
                                    }),
                                  }),
                                  session.turns.length < session.data.turnCount
                                    ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                                        type: "button",
                                        className: "ci-btn",
                                        onClick: onLoadMore,
                                        disabled: session.loadingMore,
                                        children: session.loadingMore
                                          ? t("session.loadingMore")
                                          : t("session.loadMore"),
                                      })
                                    : null,
                                ],
                              }),
                              session.moreFailure === void 0
                                ? null
                                : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
                                    className: "px-3 pb-3",
                                    children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Notice, {
                                      children: failureText(session.moreFailure),
                                    }),
                                  }),
                            ],
                          }),
                          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
                            className:
                              "ci-scroll min-w-0 border-t border-line-soft @3xl:min-h-0 @3xl:overflow-y-auto @3xl:overscroll-contain @3xl:border-t-0",
                            children:
                              currentTurn === void 0
                                ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyBlock, {
                                    title: t("turns.hint"),
                                    center: true,
                                  })
                                : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TurnDetail, {
                                    turn: currentTurn,
                                    segments: session.data.session.segments,
                                    expandedTools: toolsExpanded,
                                    onToggleTools,
                                  }),
                          }),
                        ],
                      }),
          }),
        ],
      })
    }
    //#endregion
    //#region src/client/ui/toolbar.tsx
    /**
     * Human text for a source's unavailability reason.
     * @param reason - the Host's reason tag.
     * @returns the sentence, or the raw tag when it is unknown.
     */
    function reasonText(reason) {
      if (reason === void 0) return void 0
      if (reason === "root-missing") return t("sources.reason.root-missing")
      if (reason === "root-unreadable") return t("sources.reason.root-unreadable")
      if (reason === "adapter-error") return t("sources.reason.adapter-error")
      return reason
    }
    /**
     * Per-source availability pills.
     * @param props.sources - one entry per announced source.
     * @returns the pill list.
     */
    function SourceStrip({ sources }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
        className: "m-0 hidden min-w-0 list-none items-center gap-1.5 p-0 @4xl:flex",
        "aria-label": t("sources.title"),
        children: sources.map((entry) => {
          const mark = SOURCE_MARKS[entry.source]
          const tip = entry.available
            ? `${mark.label.zh} · ${t("sources.available")} · ${entry.root ?? ""}`
            : `${mark.label.zh} · ${t("sources.unavailable")} · ${entry.errorDetail ?? reasonText(entry.reason) ?? ""}`
          return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
            "li",
            {
              className: entry.available
                ? "inline-flex h-6 items-center gap-1.5 rounded-full border border-line-soft bg-bg-1 ps-1.5 pe-2 text-[11px] whitespace-nowrap"
                : "inline-flex h-6 items-center gap-1.5 rounded-full border border-dashed border-line ps-1.5 pe-2 text-[11px] whitespace-nowrap opacity-60",
              title: tip,
              children: [
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
                  source: entry.source,
                  size: 12,
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className: "font-medium text-fg",
                  children: mark.label.zh,
                }),
                /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className: "text-fg-dim tabular-nums",
                  children: entry.available ? String(entry.sessions ?? "—") : t("sources.unavailable"),
                }),
              ],
            },
            entry.source,
          )
        }),
      })
    }
    /**
     * The bar.
     * @param props.sources - source statuses; empty while booting.
     * @param props.busy - true while a read is in flight; spins the refresh glyph.
     * @param props.sidebarOpen - whether the project column is shown.
     * @param props.onToggleSidebar - show/hide the project column.
     * @param props.onSearch - open the search palette.
     * @param props.onRefresh - re-read everything.
     * @returns the header.
     */
    function Toolbar({ sources, busy, sidebarOpen, onToggleSidebar, onSearch, onRefresh }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
        className: "flex h-12 min-w-0 shrink-0 items-center gap-3 border-b border-line-soft bg-bg px-3",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
            type: "button",
            className: "ci-icon-btn",
            "aria-pressed": sidebarOpen,
            "aria-label": t("toolbar.sidebar"),
            title: t("toolbar.sidebar"),
            onClick: onToggleSidebar,
            children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
              name: "sidebar",
              size: 15,
            }),
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "flex min-w-0 items-center gap-2",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, { size: 24 }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
                className: "m-0 text-[13.5px] font-semibold whitespace-nowrap",
                children: t("entry.label"),
              }),
            ],
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceStrip, { sources }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: "ms-auto flex min-w-0 items-center gap-1.5",
            children: [
              /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
                type: "button",
                className: "ci-search w-[clamp(160px,28cqw,280px)]",
                onClick: onSearch,
                children: [
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                    name: "search",
                    size: 13,
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                    className: "flex-1 truncate",
                    children: t("search.trigger"),
                  }),
                  /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Kbd, { children: "⌘K" }),
                ],
              }),
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
                type: "button",
                className: "ci-icon-btn",
                onClick: onRefresh,
                "aria-label": t("panel.refresh"),
                title: t("panel.refresh"),
                children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
                  className: busy ? "inline-grid motion-safe:animate-spin" : "inline-grid",
                  children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
                    name: "refresh",
                    size: 15,
                  }),
                }),
              }),
            ],
          }),
        ],
      })
    }
    //#endregion
    //#region src/client/ui/panel.tsx
    /**
     * The panel: workdir → session → turn, with the five views the milestone asks
     * for (composition, cumulative level, tool detail, compaction boundaries,
     * subagent tree) plus ⌘K search.
     *
     * Rules that shape this component:
     * - one source failing never blanks the page: its pill says why, its rows are
     *   missing from the merged tree, and a `failures` notice names it;
     * - a session is identified by `source + id`, because three corpora hand out
     *   uuids and they are not interchangeable;
     * - the page is loaded a window of turns at a time and appended, so a session
     *   with hundreds of turns never renders in one go;
     * - every number printed comes from a `Measure`, through `MeasureValue`.
     *
     * Layout: the panel fills the Host's main slot and never sets a pixel height of
     * its own. The tree and the two session columns each scroll on their own; below
     * the container breakpoint the session pane collapses to one scrolling column.
     * This module only orchestrates — every view lives in its own file.
     *
     * @module @cyrusdoyle/dsh-sessions-insight/client/panel
     */
    /**
     * The root's own box, as an inline style.
     *
     * The stylesheet is compiled inside `@scope (.ci-panel)`, and a scoped selector
     * only matches the root's descendants — so no class on the root element itself
     * ever applies (which is why an earlier `h-full` there seemed to do nothing).
     * The root fills the Host's main slot, a flex column with a definite height, the
     * same contract the task board and dsh-context panels rely on; it never sets a
     * pixel height of its own, and the inner columns scroll instead of the page.
     */
    const ROOT_STYLE = {
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      flex: "1 1 auto",
      inlineSize: "100%",
      blockSize: "100%",
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: "hidden",
      containerType: "inline-size",
      background: "var(--color-bg)",
      color: "var(--color-fg)",
      fontSize: "12.5px",
      lineHeight: 1.55,
    }
    /**
     * The panel. Fetches on mount, then follows the workdir → session → turn
     * selection; ⌘K opens the search palette over it.
     * @returns the panel page.
     */
    function ContextInsightPanel({ onOpenSession } = {}) {
      const api = (0, react.useMemo)(() => createApi(), [])
      const cache = clientListCache()
      const [boot, setBoot] = (0, react.useState)(() =>
        cache.sources === void 0 || cache.workdirs === void 0
          ? { kind: "loading" }
          : {
              kind: "ready",
              sources: cache.sources.sources,
              workdirs: cache.workdirs.workdirs,
              failures: cache.workdirs.failures,
            },
      )
      const [workdir, setWorkdir] = (0, react.useState)(() => cache.workdirs?.workdirs[0]?.workdir ?? null)
      const [selected, setSelected] = (0, react.useState)(null)
      const [pendingJump, setPendingJump] = (0, react.useState)(null)
      const [sessionList, setSessionList] = (0, react.useState)({ kind: "idle" })
      const {
        detail,
        cost,
        selectedTurn,
        setSelectedTurn,
        toolsExpanded,
        setToolsExpanded,
        loadMore,
        jumpTurn,
        overlaySession,
        onMetadataChanged: updateDetailMetadata,
      } = useSessionDetail(api, selected)
      const [reloadToken, setReloadToken] = (0, react.useState)(0)
      const [listRevision, setListRevision] = (0, react.useState)(0)
      const [searchOpen, setSearchOpen] = (0, react.useState)(false)
      const [refreshing, setRefreshing] = (0, react.useState)(false)
      const [handoffFor, setHandoffFor] = (0, react.useState)(null)
      const [sidebarOpen, setSidebarOpen] = (0, react.useState)(true)
      const [reading, setReading] = (0, react.useState)(true)
      ;(0, react.useEffect)(() => {
        function onKey(event) {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
            event.preventDefault()
            setSearchOpen((open) => !open)
          }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
      }, [])
      ;(0, react.useEffect)(() => {
        const controller = new AbortController()
        setBoot((current) => (current.kind === "ready" ? current : { kind: "loading" }))
        setReading(true)
        const refresh = reloadToken > 0
        let timer
        const read = (forced) => {
          ;(forced
            ? api
                .workdirs(controller.signal, true)
                .then(async (workdirs) => [await api.sources(controller.signal), workdirs])
            : Promise.all([api.sources(controller.signal), api.workdirs(controller.signal)])
          ).then(([sources, workdirs]) => {
            if (controller.signal.aborted) return
            setReading(false)
            if (!sources.ok) {
              if (sources.error === "aborted" || (cache.workdirs !== void 0 && cache.sources !== void 0)) return
              setBoot({
                kind: "failed",
                error: sources.error,
                ...(sources.detail === void 0 ? {} : { detail: sources.detail }),
              })
              return
            }
            if (!workdirs.ok) {
              if (workdirs.error === "aborted" || (cache.workdirs !== void 0 && cache.sources !== void 0)) return
              setBoot({
                kind: "failed",
                error: workdirs.error,
                ...(workdirs.detail === void 0 ? {} : { detail: workdirs.detail }),
              })
              return
            }
            if (forced) setListRevision((current) => current + 1)
            setRefreshing(workdirs.value.refreshing === true)
            if (workdirs.value.refreshing) timer = setTimeout(() => read(false), 500)
            setBoot({
              kind: "ready",
              sources: sources.value.sources,
              workdirs: workdirs.value.workdirs,
              failures: workdirs.value.failures,
            })
            setWorkdir((current) => {
              if (current !== null && workdirs.value.workdirs.some((row) => row.workdir === current)) return current
              return workdirs.value.workdirs[0]?.workdir ?? null
            })
          })
        }
        read(refresh)
        return () => {
          controller.abort()
          clearTimeout(timer)
          setRefreshing(false)
          setReading(false)
        }
      }, [api, reloadToken, cache])
      ;(0, react.useEffect)(() => {
        if (workdir === null) {
          setSessionList({ kind: "idle" })
          return
        }
        const controller = new AbortController()
        const cached = cache.sessions.get(workdir)
        setSessionList(
          cached === void 0
            ? {
                kind: "loading",
                workdir,
              }
            : {
                kind: "ready",
                workdir,
                sessions: cached.sessions,
                failures: cached.failures,
              },
        )
        let timer
        const read = () => {
          api.sessions(workdir, controller.signal).then((result) => {
            if (controller.signal.aborted) return
            if (!result.ok) {
              if (result.error === "aborted" || cached !== void 0) return
              setSessionList({
                kind: "failed",
                workdir,
                failure: result,
              })
              return
            }
            setSessionList({
              kind: "ready",
              workdir,
              sessions: result.value.sessions.map(overlaySession),
              failures: result.value.failures,
            })
            if (result.value.refreshing) timer = setTimeout(read, 500)
            setSelected((current) => {
              const rows = result.value.sessions
              if (
                pendingJump !== null &&
                rows.some((row) => row.id === pendingJump.ref.id && row.source === pendingJump.ref.source)
              )
                return pendingJump.ref
              if (current !== null && rows.some((row) => row.id === current.id && row.source === current.source))
                return current
              const first = rows[0]
              return first === void 0
                ? null
                : {
                    source: first.source,
                    id: first.id,
                  }
            })
          })
        }
        read()
        return () => {
          controller.abort()
          clearTimeout(timer)
        }
      }, [api, workdir, listRevision, pendingJump, cache, overlaySession])
      const readyRef = detail.kind === "ready" ? detail.ref : null
      ;(0, react.useEffect)(() => {
        if (pendingJump === null || readyRef === null || !sameSession(readyRef, pendingJump.ref)) return
        let cancelled = false
        jumpTurn(pendingJump.turn).then(() => {
          if (!cancelled) setPendingJump((current) => (current === pendingJump ? null : current))
        })
        return () => {
          cancelled = true
        }
      }, [pendingJump, readyRef, jumpTurn])
      const onMetadataChanged = (0, react.useCallback)(
        (value) => {
          updateDetailMetadata(value)
          setSessionList((current) =>
            current.kind !== "ready"
              ? current
              : {
                  ...current,
                  sessions: current.sessions.map((session) => applySessionMetadata$1(session, value)),
                },
          )
          cache.rename(value)
        },
        [cache, updateDetailMetadata],
      )
      const jumpTo = (0, react.useCallback)((target) => {
        setSearchOpen(false)
        setWorkdir(target.workdir)
        setPendingJump({
          ref: {
            source: target.source,
            id: target.sessionId,
          },
          turn: target.turnIndex,
        })
        setSelected({
          source: target.source,
          id: target.sessionId,
        })
      }, [])
      ;(0, react.useEffect)(() => {
        if (selectedTurn === null) return
        document
          .querySelector(`.ci-panel [data-turn="${String(selectedTurn)}"] [data-turn-row]`)
          ?.scrollIntoView({ block: "nearest" })
      }, [selectedTurn, detail.kind])
      const retry = (0, react.useCallback)(() => {
        clientListCache().invalidateRequests()
        setReloadToken((token) => token + 1)
      }, [])
      const costs = (0, react.useMemo)(() => {
        if (cost === null) return void 0
        const map = /* @__PURE__ */ new Map()
        for (const line of cost.turns) map.set(line.index, line)
        return map
      }, [cost])
      const sourceEntries = boot.kind === "ready" ? boot.sources : []
      const anySource = sourceEntries.some((entry) => entry.available)
      const failures = [
        ...(boot.kind === "ready" ? boot.failures : []),
        ...(sessionList.kind === "ready" ? sessionList.failures : []),
      ]
      const tree =
        boot.kind === "ready"
          ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectTree, {
              onMetadataChanged,
              revision: listRevision,
              api,
              workdirs: boot.workdirs,
              selected,
              onSelect: (next) => {
                setSelected(next)
                setPendingJump(null)
                if (next.workdir !== void 0) setWorkdir(next.workdir)
              },
              onDeleted: (deleted) => {
                setSelected((current) =>
                  current?.source === deleted.source && current.id === deleted.id ? null : current,
                )
                setPendingJump((current) =>
                  current?.ref.source === deleted.source && current.ref.id === deleted.id ? null : current,
                )
                cache.remove(deleted)
                setBoot((current) =>
                  current.kind !== "ready"
                    ? current
                    : {
                        ...current,
                        sources: cache.sources?.sources ?? current.sources,
                        workdirs: cache.workdirs?.workdirs ?? current.workdirs,
                      },
                )
                setSessionList((current) =>
                  current.kind !== "ready"
                    ? current
                    : {
                        ...current,
                        sessions: current.sessions.filter(
                          (row) => row.source !== deleted.source || row.id !== deleted.id,
                        ),
                      },
                )
              },
              loading: false,
            })
          : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeSkeleton, { label: t("tree.loadingIndex") })
      let pane = null
      if (boot.kind === "loading")
        pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionSkeleton, { label: t("panel.loading") })
      else if (boot.kind === "failed")
        pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorBlock, {
          title: t("session.error", { detail: boot.detail ?? boot.error }),
          onRetry: retry,
        })
      else if (boot.workdirs.length === 0)
        pane = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
          className: "flex h-full flex-col items-center justify-center gap-3 p-6",
          children: [
            /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyBlock, {
              title: t("workdirs.empty"),
              hint: t("empty.noData"),
              center: true,
            }),
            anySource ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Notice, { children: t("empty.noSources") }),
          ],
        })
      else if (detail.kind === "idle")
        pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyBlock, {
          title: t("sessions.pick"),
          hint: t("sessions.pickHint"),
          center: true,
        })
      else if (detail.kind === "loading")
        pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionSkeleton, { label: t("session.loading") })
      else if (detail.kind === "failed")
        pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorBlock, {
          title: t("session.error", { detail: failureText(detail.failure) }),
          onRetry: () => {
            const ref = detail.ref
            setSelected(null)
            window.setTimeout(() => setSelected(ref), 0)
          },
        })
      else
        pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(
          SessionPane,
          {
            session: detail,
            revealTurns: pendingJump !== null,
            title: detail.data.session.title ?? detail.ref.id,
            cost,
            costs,
            selectedTurn,
            onSelectTurn: setSelectedTurn,
            onJumpTurn: (index) => {
              jumpTurn(index)
            },
            toolsExpanded,
            onToggleTools: setToolsExpanded,
            onLoadMore: loadMore,
            onOpenSession,
            onHandoff: () =>
              setHandoffFor({
                source: detail.ref.source,
                id: detail.ref.id,
              }),
          },
          `${detail.ref.source}:${detail.ref.id}`,
        )
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
        className: "ci-panel",
        style: ROOT_STYLE,
        "data-dsh-sessions-insight-view": "",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toolbar, {
            sources: sourceEntries,
            busy: reading || refreshing,
            sidebarOpen,
            onToggleSidebar: () => setSidebarOpen((open) => !open),
            onSearch: () => setSearchOpen(true),
            onRefresh: retry,
          }),
          failures.length === 0
            ? null
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
                className: "flex shrink-0 flex-col gap-1.5 border-b border-line-soft px-3 py-2",
                children: failures.map((problem) =>
                  /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(
                    Notice,
                    { children: [problem.source, ": ", problem.error] },
                    `${problem.source}-${problem.error}`,
                  ),
                ),
              }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
            className: sidebarOpen
              ? "grid min-h-0 flex-1 grid-cols-[clamp(220px,30cqw,300px)_minmax(0,1fr)]"
              : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)]",
            children: [
              sidebarOpen
                ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("aside", {
                    className: "min-h-0 min-w-0 border-e border-line-soft bg-sidebar",
                    children: tree,
                  })
                : null,
              /* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
                className: "@container min-h-0 min-w-0",
                children: pane,
              }),
            ],
          }),
          searchOpen
            ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchPalette, {
                api,
                onClose: () => setSearchOpen(false),
                onOpenTurn: jumpTo,
              })
            : null,
          handoffFor === null
            ? null
            : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HandoffDialog, {
                onOpenSession,
                api,
                source: handoffFor.source,
                id: handoffFor.id,
                onClose: () => setHandoffFor(null),
              }),
        ],
      })
    }
    //#endregion
    //#region src/client/index.tsx
    /**
     * Browser half of the sessions-insight plugin.
     *
     * Contributes one row into the sidebar shell's own global panel list and its
     * page into the layout's keyed `main` slot. The shell then owns the row box,
     * the label, the active highlight and the panel switch exactly as it does for
     * the shipped Plugins and Schedule pages.
     *
     * The two registrations and the locale binding are the kit's; what this module
     * owns is the panel's identity — its id, row order, glyph and page — and the
     * page-lifetime claim that keeps a duplicated injection from mounting twice.
     *
     * Failure policy: nothing here throws out of `apply`. The web shell fails the
     * whole boot when a plugin's apply throws, and an external plugin must not be
     * able to take the GUI down.
     *
     * @module @cyrusdoyle/dsh-sessions-insight/client
     */
    /** Panel id shared by the sidebar row and the main-slot occupant. */
    const PANEL_ID = "sessions-insight"
    /**
     * Row order among the shell's global panel rows: the shipped Plugins row is 0
     * and Schedule is 10, so this row renders after both.
     */
    const PANEL_ORDER = 30
    /** Services this entry waits for before `apply` runs. */
    const inject = ["slots", "locale", "uiWorkspace"]
    /**
     * Where the row glyph is resolved from: the shell asks for it at its own size
     * and active state, and this component draws only the glyph.
     * @param props - the shell's icon share: square edge and selection state.
     * @returns the decorative glyph.
     */
    function ContextInsightPanelIcon({ size }) {
      return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
        "data-dsh-panel-entry": PANEL_ID,
        viewBox: "0 0 16 16",
        width: size,
        height: size,
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        children: [
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
            cx: "6.72",
            cy: "6.72",
            r: "3.92",
            strokeWidth: 1.12,
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
            d: "M9.6 9.6 13.12 13.12",
            strokeWidth: 1.28,
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
            d: "M5.12 4.48h3.2",
            strokeWidth: 1.12,
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
            d: "M5.12 6.72h2.24",
            strokeWidth: 1.12,
          }),
          /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
            d: "M5.12 8.96h1.28",
            strokeWidth: 1.12,
          }),
        ],
      })
    }
    /**
     * Mount the browser half.
     * @param ctx - client root context (services: slots, locale).
     */
    function apply(ctx) {
      if (globalThis.__dshContextInsightApplied === true) return
      globalThis.__dshContextInsightApplied = true
      if (typeof ctx.effect === "function")
        ctx.effect(
          () => () => {
            globalThis.__dshContextInsightApplied = void 0
          },
          "sessions-insight: apply claim",
        )
      injectStyles()
      registerLocale(
        ctx,
        LOCALE_NS,
        {
          zh,
          en,
        },
        setRuntimeTranslate,
      )
      const preload = new AbortController()
      const timer = setTimeout(() => {
        preloadSessionLists(createApi(), preload.signal).catch(() => void 0)
      }, 0)
      ctx.effect?.(
        () => () => {
          clearTimeout(timer)
          preload.abort()
        },
        "sessions-insight: preload lists",
      )
      try {
        registerPanel(ctx, {
          id: PANEL_ID,
          order: PANEL_ORDER,
          locale: LOCALE_NS,
          label: () => t("entry.label"),
          icon: ContextInsightPanelIcon,
          panel: () =>
            /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextInsightPanel, {
              onOpenSession: async (id) => {
                const workspace = ctx.get?.("uiWorkspace")
                if (typeof workspace?.openSession !== "function") throw new Error("uiWorkspace.openSession unavailable")
                const sessionId = id.startsWith("session-") ? id : `session-${id}`
                const revealed = await createApi().handoffReveal(sessionId)
                if (!revealed.ok) throw new Error(revealed.detail ?? revealed.error)
                await workspace.openSession(sessionId)
              },
            }),
        })
      } catch (error) {
        console.warn("[sessions-insight] panel registration failed", error)
      }
    }
    //#endregion
    exports.ContextInsightPanelIcon = ContextInsightPanelIcon
    exports.PANEL_ID = PANEL_ID
    exports.apply = apply
    exports.inject = inject

    return module.exports
  },
})

//# sourceMappingURL=client.js.map
