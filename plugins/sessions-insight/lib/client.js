window.__ModuleLoader__.load({
	id: "@cyrusdoyle/dsh-sessions-insight",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let react = require("react");
react = __toESM(react, 1);
let react_jsx_runtime = require("react/jsx-runtime");
let react_dom = require("react-dom");
react_dom = __toESM(react_dom, 1);
//#region ../../packages/plugin-kit/src/envelope.ts
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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
	if (!isRecord$1(value)) return {
		ok: false,
		error: fallback,
		detail: "envelope-not-an-object"
	};
	if (value.ok === true) {
		if (guard(value.value)) return {
			ok: true,
			value: value.value
		};
		return {
			ok: false,
			error: fallback,
			detail: "payload-shape"
		};
	}
	if (value.ok === false) {
		const error = typeof value.error === "string" ? value.error : fallback;
		const code = codes.includes(error) ? error : fallback;
		const detail = typeof value.detail === "string" ? value.detail : void 0;
		return detail === void 0 ? {
			ok: false,
			error: code
		} : {
			ok: false,
			error: code,
			detail
		};
	}
	return {
		ok: false,
		error: fallback,
		detail: "envelope-without-ok"
	};
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
	return path.replace(/^\/+/, "");
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
	const method = request.method ?? "GET";
	let response;
	try {
		response = await fetch(request.url, {
			method,
			signal: request.signal ?? null,
			credentials: "same-origin",
			headers: method === "POST" ? {
				accept: "application/json",
				"content-type": "application/json"
			} : { accept: "application/json" },
			...request.body === void 0 ? {} : { body: JSON.stringify(request.body) }
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") return {
			ok: false,
			error: "aborted"
		};
		return {
			ok: false,
			error: "network"
		};
	}
	let payload;
	try {
		payload = await response.json();
	} catch {
		return {
			ok: false,
			error: "parse-failed",
			detail: "not-json",
			status: response.status
		};
	}
	const decoded = decodeEnvelope(payload, request.guard, request.codes, request.fallback ?? "parse-failed");
	if (decoded.ok) return {
		ok: true,
		value: decoded.value
	};
	return {
		ok: false,
		error: decoded.error,
		status: response.status,
		...decoded.detail === void 0 ? {} : { detail: decoded.detail }
	};
}
//#endregion
//#region ../../packages/plugin-kit-client/src/register.ts
/** Default seat names of the web shell's sidebar and layout entries. */
const DEFAULT_PANEL_SEATS = {
	list: "sidebar.panellist",
	main: "main"
};
/**
* Register the sidebar row and the main-slot page.
* @param ctx - client root context (service: slots).
* @param registration - panel id, order, label, icon and page.
* @returns disposer releasing both registrations.
*/
function registerPanel(ctx, registration) {
	const slots = ctx.slots;
	const seats = registration.seats ?? DEFAULT_PANEL_SEATS;
	const disposers = [];
	disposers.push(slots.inject(seats.list, () => slots.register({
		name: seats.list,
		id: registration.id,
		order: registration.order,
		locale: registration.locale,
		label: registration.label
	}, registration.icon)));
	disposers.push(slots.inject(seats.main, () => slots.register({
		name: seats.main,
		key: registration.id,
		locale: registration.locale
	}, registration.panel)));
	return () => {
		for (const dispose of disposers.splice(0)) dispose();
	};
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
		ctx.locale.register(namespace, dictionaries);
		bind(ctx.locale.bind(namespace));
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
	if (typeof document === "undefined") return;
	const existing = document.getElementById(id);
	if (existing !== null) {
		if (existing.textContent !== css) existing.textContent = css;
		return;
	}
	const style = document.createElement("style");
	style.id = id;
	style.textContent = css;
	document.head.append(style);
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
const API_ROOT = "/api/dsh-sessions-insight";
/** Liveness and version handshake (M1). */
const HEALTH_PATH = `${API_ROOT}/health`;
/** Per-source availability, root, session count, last scan. */
const SOURCES_PATH = `${API_ROOT}/sources`;
/** Workdir aggregation: the navigation axis. */
const WORKDIRS_PATH = `${API_ROOT}/workdirs`;
/** Light session list for one workdir: header + mtime only, no body parse. */
const SESSIONS_PATH = `${API_ROOT}/sessions`;
/** One session's IR, paged by turn. */
const SESSION_PATH = `${API_ROOT}/session`;
/** Full-text search across every readable source. */
const SEARCH_PATH = `${API_ROOT}/search`;
/** Build the handoff brief for one session (POST). */
const HANDOFF_PREPARE_PATH = `${API_ROOT}/handoff/prepare`;
/** Create a DSH session and deliver the brief (POST). */
const HANDOFF_APPLY_PATH = `${API_ROOT}/handoff/apply`;
/** Observe a delivered handoff (GET). */
const HANDOFF_STATUS_PATH = `${API_ROOT}/handoff/status`;
/** Per-session cost from the price table (GET). */
const COST_PATH = `${API_ROOT}/cost`;
browserUrl(HEALTH_PATH);
/** Sources, spelled for the browser. */
const SOURCES_URL = browserUrl(SOURCES_PATH);
/** Workdirs, spelled for the browser. */
const WORKDIRS_URL = browserUrl(WORKDIRS_PATH);
/** Sessions, spelled for the browser. */
const SESSIONS_URL = browserUrl(SESSIONS_PATH);
/** One session, spelled for the browser. */
const SESSION_URL = browserUrl(SESSION_PATH);
/** Search, spelled for the browser. */
const SEARCH_URL = browserUrl(SEARCH_PATH);
/** Handoff brief, spelled for the browser. */
const HANDOFF_PREPARE_URL = browserUrl(HANDOFF_PREPARE_PATH);
/** Handoff apply, spelled for the browser. */
const HANDOFF_APPLY_URL = browserUrl(HANDOFF_APPLY_PATH);
/** Handoff status, spelled for the browser. */
const HANDOFF_STATUS_URL = browserUrl(HANDOFF_STATUS_PATH);
/** Cost, spelled for the browser. */
const COST_URL = browserUrl(COST_PATH);
const SESSION_DELETE_URL = browserUrl(`${API_ROOT}/session/delete`);
const HANDOFF_REVEAL_URL = browserUrl(`${API_ROOT}/handoff/reveal`);
const SESSION_METADATA_URL = browserUrl(`${API_ROOT}/session/metadata`);
function hasShape$1(value, keys) {
	return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
}
function isText(value) {
	return typeof value === "string" && value.trim().length > 0 && value.length <= 80;
}
function isReference(value) {
	return isDeleteSessionValue(value);
}
function isSessionMetadata(value) {
	return hasShape$1(value, [
		"source",
		"id",
		"title",
		"group"
	]) && isReference(value) && (!("title" in value) || isText(value["title"])) && (!("group" in value) || isText(value["group"]));
}
function isMetadataValue(value) {
	if (!hasShape$1(value, ["entries"]) || !Array.isArray(value["entries"])) return false;
	const keys = /* @__PURE__ */ new Set();
	for (const entry of value["entries"]) {
		if (!isSessionMetadata(entry)) return false;
		const key = `${entry.source}:${entry.id}`;
		if (keys.has(key)) return false;
		keys.add(key);
	}
	return true;
}
function isSessionMetadataValue(value) {
	return hasShape$1(value, ["metadata", "displayTitle"]) && isSessionMetadata(value["metadata"]) && (!("displayTitle" in value) || typeof value["displayTitle"] === "string");
}
//#endregion
//#region ../../packages/session-contract/src/types.ts
/** Every announced source, in the order the panel renders them. */
const CONTEXT_SOURCES = [
	"claude",
	"dsh",
	"codex"
];
/** Every failure code, as one list the decoders can check membership against. */
const API_ERROR_CODES = [
	"bad-request",
	"method-not-allowed",
	"forbidden",
	"not-found",
	"read-limit",
	"parse-failed",
	"source-unavailable",
	"handoff-unavailable"
];
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
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}
function isStringArray(value) {
	return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
//#endregion
//#region ../../packages/session-contract/src/guards/attribution.ts
const PRECISIONS = /* @__PURE__ */ new Set(["exact", "estimate"]);
const BASES = /* @__PURE__ */ new Set([
	"usage",
	"harness-projection",
	"chars-per-token",
	"byte-length",
	"unattributed"
]);
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
	"thinking"
]);
/**
* Whether a wire value is a well-formed measure.
* @param value - any decoded JSON value.
* @returns true when tokens is finite and both tags are known. Negative tokens
*   are legal: a residual is `total − Σparts` and can run either way.
*/
function isMeasure(value) {
	if (!isRecord(value)) return false;
	const { tokens, precision, basis } = value;
	return typeof tokens === "number" && Number.isFinite(tokens) && PRECISIONS.has(precision) && BASES.has(basis);
}
/**
* Whether a wire value is a well-formed attribution.
* @param value - any decoded JSON value.
* @returns true for a total, at least zero parts, and optional residual/factor.
*/
function isAttribution(value) {
	if (!isRecord(value)) return false;
	if (!isMeasure(value.total)) return false;
	if (value.windowSize !== void 0 && (typeof value.windowSize !== "number" || !Number.isFinite(value.windowSize))) return false;
	const parts = value.parts;
	if (!Array.isArray(parts)) return false;
	for (const slice of parts) {
		if (!isRecord(slice)) return false;
		if (!PARTS.has(slice.part)) return false;
		if (!isMeasure(slice.measure)) return false;
	}
	if (value.residual !== void 0 && !isMeasure(value.residual)) return false;
	if (value.reconciled !== void 0) {
		if (!isRecord(value.reconciled)) return false;
		const factor = value.reconciled.factor;
		if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0) return false;
	}
	return true;
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
	if (!isRecord(value)) return false;
	if (!CONTEXT_SOURCES.includes(value.source)) return false;
	if (typeof value.sessionId !== "string") return false;
	const pricing = value.pricing;
	if (!isRecord(pricing) || typeof pricing.version !== "string" || typeof pricing.asOf !== "string") return false;
	const totals = value.totals;
	if (!isRecord(totals)) return false;
	if (totals.usd !== null && !isNumber(totals.usd)) return false;
	if (!isNumber(totals.pricedTurns) || !isNumber(totals.unpricedTurns)) return false;
	if (!Array.isArray(value.unpricedModels) || !isStringArray(value.unpricedModels)) return false;
	if (!Array.isArray(value.provisionalModels) || !isStringArray(value.provisionalModels)) return false;
	if (typeof value.provisional !== "boolean") return false;
	if (value.partial !== void 0 && typeof value.partial !== "boolean") return false;
	if (value.unlistedChannels !== void 0 && !isStringArray(value.unlistedChannels)) return false;
	if (!Array.isArray(value.turns)) return false;
	if (!value.turns.every((turn) => isRecord(turn) && isNumber(turn.index) && typeof turn.priced === "boolean" && (turn.usd === null || isNumber(turn.usd)))) return false;
	if (value.tableId !== void 0 && value.tableId !== null && typeof value.tableId !== "string") return false;
	if (value.tables === void 0) return true;
	if (!isRecord(value.tables)) return false;
	return Object.values(value.tables).every((table) => isRecord(table) && typeof table.id === "string" && isRecord(table.byCurrency) && typeof table.partial === "boolean" && Array.isArray(table.turns));
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
	if (value.length === 0 || value.length > 128) return false;
	if (!/^[A-Za-z0-9._-]+$/.test(value)) return false;
	return value !== "." && value !== "..";
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
	if (!isRecord(value) || !Array.isArray(value.sources)) return false;
	return value.sources.every((entry) => {
		if (!isRecord(entry)) return false;
		if (!CONTEXT_SOURCES.includes(entry.source)) return false;
		if (typeof entry.available !== "boolean") return false;
		if (entry.reason !== void 0 && typeof entry.reason !== "string") return false;
		if (entry.root !== void 0 && typeof entry.root !== "string") return false;
		return true;
	});
}
/**
* Whether a wire value names a known source.
* @param value - any decoded JSON value.
* @returns true when the value is a member of {@link CONTEXT_SOURCES}.
*/
function isContextSource(value) {
	return value === "claude" || value === "dsh" || value === "codex";
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
	if (!isRecord(value)) return false;
	if (!CONTEXT_SOURCES.includes(value.source)) return false;
	if (typeof value.sessionId !== "string" || typeof value.workdir !== "string") return false;
	if (typeof value.brief !== "string" || typeof value.defaultCwd !== "string") return false;
	if (!isNumber(value.chars) || !isNumber(value.turns)) return false;
	if (!Array.isArray(value.sections)) return false;
	return value.sections.every((section) => isRecord(section) && typeof section.title === "string" && isStringArray(section.lines) && typeof section.empty === "boolean");
}
/**
* Whether a wire value is a well-formed handoff apply answer.
* @param value - any decoded JSON value.
*/
function isHandoffApplyValue(value) {
	if (!isRecord(value)) return false;
	return typeof value.sessionId === "string" && value.state === "delivered" && isNumber(value.pollAfterMs);
}
/**
* Whether a wire value is a well-formed handoff status answer.
* @param value - any decoded JSON value.
*/
function isHandoffStatusValue(value) {
	if (!isRecord(value)) return false;
	if (typeof value.sessionId !== "string") return false;
	if (value.state !== "delivered" && value.state !== "running" && value.state !== "succeeded" && value.state !== "failed") return false;
	if (!isNumber(value.elapsedMs)) return false;
	if (value.progress !== void 0) {
		const progress = value.progress;
		if (!isRecord(progress) || !isNumber(progress.seq) || !isNumber(progress.updatedAt) || !isNumber(progress.toolsCompleted)) return false;
		if (progress.tool !== void 0 && typeof progress.tool !== "string") return false;
	}
	if (value.reason !== void 0 && typeof value.reason !== "string") return false;
	if (value.detail !== void 0 && typeof value.detail !== "string") return false;
	if (value.seq !== void 0 && !isNumber(value.seq)) return false;
	return true;
}
function isHandoffRevealValue(value) {
	return isRecord(value) && typeof value.sessionId === "string" && isSafeId(value.sessionId);
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
	if (!isRecord(value)) return false;
	if (!CONTEXT_SOURCES.includes(value.source)) return false;
	if (typeof value.sessionId !== "string" || typeof value.workdir !== "string") return false;
	if (!isNumber(value.turnIndex) || !isNumber(value.at)) return false;
	if (value.field !== "user" && value.field !== "assistant" && value.field !== "tool" && value.field !== "metadata") return false;
	if (value.tier !== "fast" && value.tier !== "deep") return false;
	if (typeof value.snippet !== "string") return false;
	if (value.title !== void 0 && typeof value.title !== "string") return false;
	if (value.firstInput !== void 0 && typeof value.firstInput !== "string") return false;
	return true;
}
/**
* Whether a wire value is a well-formed search answer.
* @param value - any decoded JSON value.
* @returns true when the counters and every hit pass their guards.
*/
function isSearchValue(value) {
	if (!isRecord(value)) return false;
	if (typeof value.query !== "string") return false;
	if (!isNumber(value.scanned) || !isNumber(value.remaining) || !isNumber(value.elapsedMs)) return false;
	if (typeof value.truncated !== "boolean") return false;
	if (!Array.isArray(value.hits) || !value.hits.every(isSearchHit)) return false;
	if (!Array.isArray(value.failures)) return false;
	return value.failures.every((entry) => isRecord(entry) && CONTEXT_SOURCES.includes(entry.source) && typeof entry.error === "string");
}
//#endregion
//#region ../../packages/session-contract/src/guards/turns.ts
function isUsage(value) {
	if (!isRecord(value)) return false;
	return isNumber(value.input) && isNumber(value.cacheRead) && isNumber(value.cacheWrite) && isNumber(value.output) && isNumber(value.totalContext);
}
function isCompaction(value) {
	if (!isRecord(value)) return false;
	return isNumber(value.at) && isMeasure(value.before) && isMeasure(value.after) && typeof value.replacedHistory === "boolean";
}
/**
* Whether a wire value is a well-formed turn.
* @param value - any decoded JSON value.
* @returns true when the fields the panel renders are all present and typed.
*/
function isTurn(value) {
	if (!isRecord(value)) return false;
	if (!isNumber(value.index) || !isNumber(value.startedAt)) return false;
	if (!isStringArray(value.userInput) || !isStringArray(value.assistantText)) return false;
	if (!isStringArray(value.subagents)) return false;
	if (!isAttribution(value.attribution)) return false;
	if (!Array.isArray(value.toolCalls) || !Array.isArray(value.compactions)) return false;
	if (!value.compactions.every(isCompaction)) return false;
	if (value.usage !== void 0 && !isUsage(value.usage)) return false;
	return true;
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
	if (!isRecord(value)) return false;
	if (!isNumber(value.turnCount) || !isNumber(value.offset) || !isNumber(value.limit)) return false;
	const meta = value.meta;
	if (!isRecord(meta) || typeof meta.cached !== "boolean" || !isNumber(meta.elapsedMs) || !isNumber(meta.bytes)) return false;
	const session = value.session;
	if (!isRecord(session)) return false;
	if (typeof session.id !== "string" || typeof session.workdir !== "string") return false;
	if (!CONTEXT_SOURCES.includes(session.source)) return false;
	if (!isNumber(session.createdAt) || !isNumber(session.updatedAt)) return false;
	if (!isStringArray(session.dataQuality)) return false;
	if (!Array.isArray(session.segments)) return false;
	if (!Array.isArray(session.turns) || !session.turns.every(isTurn)) return false;
	return true;
}
/**
* Whether a value is a well-formed workdirs answer.
* @param value - any decoded JSON value.
* @returns true when every row has a workdir, counts and source groups.
*/
function isWorkdirsValue(value) {
	if (!isRecord(value) || !isNumber(value.scannedAt)) return false;
	if (!Array.isArray(value.workdirs)) return false;
	return value.workdirs.every((row) => {
		if (!isRecord(row)) return false;
		if (typeof row.workdir !== "string" || !isNumber(row.sessions) || !isNumber(row.lastUpdatedAt)) return false;
		if (!Array.isArray(row.sources)) return false;
		return row.sources.every((group) => isRecord(group) && CONTEXT_SOURCES.includes(group.source) && isNumber(group.sessions) && isNumber(group.lastUpdatedAt));
	});
}
/**
* Whether a value is a well-formed sessions answer.
* @param value - any decoded JSON value.
* @returns true when every row carries its source badge facts.
*/
function isSessionsValue(value) {
	if (!isRecord(value) || typeof value.workdir !== "string") return false;
	if (!Array.isArray(value.sessions)) return false;
	return value.sessions.every((row) => {
		if (!isRecord(row)) return false;
		if (typeof row.id !== "string" || typeof row.workdir !== "string") return false;
		if (!CONTEXT_SOURCES.includes(row.source)) return false;
		if (!isNumber(row.updatedAt) || !isNumber(row.bytes)) return false;
		if (!isStringArray(row.dataQuality)) return false;
		if (row.title !== void 0 && typeof row.title !== "string") return false;
		return true;
	});
}
//#endregion
//#region ../../packages/session-contract/src/guards/deletion.ts
function isDeleteSessionValue(value) {
	return isRecord(value) && isContextSource(value["source"]) && typeof value["id"] === "string" && isSafeId(value["id"]);
}
function isInsightSessionDetail(value) {
	return isSessionDetail(value) && (!("insights" in value) || isSessionInsights(value.insights));
}
function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function number(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function count(value) {
	return number(value) && Number.isInteger(value);
}
function index$1(value) {
	return count(value) && value > 0;
}
function optionalTime(value) {
	return value === void 0 || number(value) && value > 0;
}
function optionalPath(value) {
	return value === void 0 || typeof value === "string" && value.length > 0;
}
function nullableNumber(value) {
	return value === null || number(value);
}
function isSkillEvidence(value) {
	return record(value) && index$1(value.turnIndex) && typeof value.toolCallId === "string" && value.toolCallId.length > 0 && (value.kind === "skill-tool" || value.kind === "skill-file" || (value.kind === "skill-reference" || value.kind === "skill-injection") && new RegExp(`^event:${value.kind}:${value.turnIndex}:[1-9][0-9]*$`).test(value.toolCallId) && typeof value.path === "string" && value.path.endsWith("/SKILL.md") && !/[\r\n\0]/.test(value.path) && (!/^[a-z][\w+.-]*:/i.test(value.path) || /^[A-Za-z]:\//.test(value.path)) && value.path.split("/").at(-2) === value.name) && typeof value.name === "string" && value.name.length > 0 && optionalPath(value.path) && optionalTime(value.time);
}
function isSkillInsight(value) {
	if (!record(value) || typeof value.id !== "string" || value.id.length === 0 || typeof value.name !== "string" || value.name.length === 0 || !optionalPath(value.path) || !index$1(value.count) || !index$1(value.lastTurnIndex) || !optionalTime(value.lastTime) || !Array.isArray(value.evidence) || !value.evidence.every(isSkillEvidence)) return false;
	const lastTurnIndex = value.evidence.reduce((last, item) => Math.max(last, item.turnIndex), 0);
	const lastTime = value.evidence.reduce((last, item) => item.time === void 0 ? last : Math.max(last ?? item.time, item.time), void 0);
	return value.id === (value.path === void 0 ? `name:${value.name}` : `path:${value.path}`) && value.count === value.evidence.length && value.evidence.every((item) => item.name === value.name && item.path === value.path) && value.lastTurnIndex === lastTurnIndex && value.lastTime === lastTime && new Set(value.evidence.map((item) => item.toolCallId)).size === value.count;
}
function isInsightUsage(value) {
	if (!record(value) || !count(value.coveredTurns) || !count(value.missingTurns)) return false;
	const buckets = [
		value.input,
		value.cacheRead,
		value.cacheWrite,
		value.output
	];
	return value.coveredTurns === 0 ? buckets.every((item) => item === null) : buckets.every(number);
}
function isInsightTiming(value) {
	if (!record(value)) return false;
	return nullableNumber(value.spanMs) && optionalTime(value.startedAt) && optionalTime(value.endedAt) && nullableNumber(value.completedTurnMs) && count(value.completedTurns) && count(value.missingTurnDurations) && nullableNumber(value.toolUnionMs) && count(value.timedToolCalls) && count(value.missingToolDurations) && (value.completedTurns === 0 ? value.completedTurnMs === null : number(value.completedTurnMs)) && (value.timedToolCalls === 0 ? value.toolUnionMs === null : number(value.toolUnionMs)) && (value.spanMs === null ? value.startedAt === void 0 && value.endedAt === void 0 : number(value.startedAt) && number(value.endedAt) && value.endedAt - value.startedAt === value.spanMs);
}
function isInsightMessage(value) {
	return record(value) && (value.role === "user" || value.role === "assistant") && typeof value.text === "string" && value.text.trim().length > 0 && (value.text.length <= 500 || value.text.length === 501 && value.text.endsWith("…")) && index$1(value.turnIndex) && optionalTime(value.time);
}
function isInsightAttribution(value) {
	return record(value) && index$1(value.turnIndex) && isAttribution(value.attribution) && value.attribution.total.tokens > 0;
}
function isInsightPeak(value) {
	return record(value) && index$1(value.turnIndex) && isMeasure(value.measure) && value.measure.tokens > 0;
}
function isSessionInsights(value) {
	if (!record(value) || !count(value.turnCount) || !count(value.toolCalls) || !count(value.compactions)) return false;
	if (value.currentAttribution !== null && !isInsightAttribution(value.currentAttribution)) return false;
	if (value.peak !== null && !isInsightPeak(value.peak)) return false;
	if (!isInsightUsage(value.usage) || !isInsightTiming(value.timing) || value.lastMessage !== null && !isInsightMessage(value.lastMessage) || !Array.isArray(value.skills) || !value.skills.every(isSkillInsight)) return false;
	const { turnCount, timing } = value;
	const inRange = (turnIndex) => turnIndex <= turnCount;
	const inSpan = (time) => time === void 0 || timing.spanMs !== null && time >= timing.startedAt && time <= timing.endedAt;
	const evidence = value.skills.flatMap((skill) => skill.evidence);
	return (value.currentAttribution === null ? value.peak === null : value.peak !== null && inRange(value.currentAttribution.turnIndex) && value.peak.turnIndex <= value.currentAttribution.turnIndex && value.peak.measure.tokens >= value.currentAttribution.attribution.total.tokens) && (value.peak === null || inRange(value.peak.turnIndex)) && (value.lastMessage === null || inRange(value.lastMessage.turnIndex) && inSpan(value.lastMessage.time)) && evidence.every((item) => inRange(item.turnIndex) && inSpan(item.time)) && new Set(evidence.map((item) => item.toolCallId)).size === evidence.length && evidence.filter((item) => item.kind === "skill-tool" || item.kind === "skill-file").length <= value.toolCalls && (value.timing.toolUnionMs === null || value.timing.spanMs !== null && value.timing.toolUnionMs <= value.timing.spanMs) && value.usage.coveredTurns + value.usage.missingTurns === value.turnCount && value.timing.completedTurns + value.timing.missingTurnDurations === value.turnCount && value.timing.timedToolCalls + value.timing.missingToolDurations === value.toolCalls && new Set(value.skills.map((skill) => skill.id)).size === value.skills.length;
}
const SESSION_AI_TITLE_URL = browserUrl(`${API_ROOT}/session/title/suggest`);
function hasShape(value, keys) {
	return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
}
function isAiTitleValue(value) {
	return hasShape(value, [
		"source",
		"id",
		"title",
		"provider",
		"model"
	]) && isDeleteSessionValue(value) && typeof value["title"] === "string" && value["title"].trim() === value["title"] && value["title"].length > 0 && value["title"].length <= 80 && !/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u.test(value["title"]) && typeof value["provider"] === "string" && value["provider"].trim().length > 0 && typeof value["model"] === "string" && value["model"].trim().length > 0;
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
	"insights.summary": "会话摘要",
	"insights.fallback": "宿主未返回 insights · 根据已加载的全部轮次生成概览",
	"insights.partial": "已加载 {loaded} / {total} 轮 · 全会话统计待宿主更新",
	"insights.loadedContext": "已加载上下文",
	"insights.loadedMessage": "已加载的最后一条消息",
	"insights.loadedNote": "以下归因、峰值与时长仅覆盖已加载轮次",
	"insights.loadedUsage": "已加载轮次累计用量",
	"insights.costUsage": "累计用量来自全会话费用报告；覆盖率仅指已加载轮次",
	"insights.peak": "上下文峰值",
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
	"insights.noSkills": "这份会话记录中未找到技能加载证据",
	"insights.noMatchingSkills": "没有匹配的技能，试试其他名称或路径",
	"insights.skillSummary": "{count} 个技能 · {uses} 次加载",
	"insights.partialSkills": "已检查 {loaded} / {total} 轮 · 加载更多以检查剩余技能",
	"insights.skillNote": "统计 Skill 调用、读取 SKILL.md、用户明确引用和技能加载记录；不是可用技能列表，也不推断技能已成功执行。",
	"insights.skill-reference": "用户引用 SKILL.md",
	"insights.skill-injection": "技能加载记录",
	"insights.skillCount": "{count} 次",
	"insights.skill-tool": "显式 Skill 调用",
	"insights.skill-file": "读取 SKILL.md",
	"insights.evidence": "具体证据"
};
const INSIGHT_EN = {
	"insights.tabs": "Session views",
	"insights.overview": "Overview",
	"insights.turns": "Turns",
	"insights.skills": "Skills",
	"insights.unrecorded": "Not recorded · unknown",
	"insights.summary": "Session summary",
	"insights.fallback": "Host did not return insights · overview derived from all loaded turns",
	"insights.partial": "Loaded {loaded} / {total} turns · full-session statistics await a Host update",
	"insights.loadedContext": "Loaded context",
	"insights.loadedMessage": "Latest loaded message",
	"insights.loadedNote": "Attribution, peak and timing below cover only loaded turns",
	"insights.loadedUsage": "Loaded-turn cumulative usage",
	"insights.costUsage": "Cumulative usage from the full-session cost report; coverage refers only to loaded turns",
	"insights.peak": "Peak context",
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
	"insights.durationNote": "Span includes gaps; summed turn durations may overlap. Parallel tool intervals are merged. Remaining time does not represent model thinking.",
	"insights.lastMessage": "Last message",
	"insights.user": "User",
	"insights.assistant": "Assistant",
	"insights.jump": "Go to turn {index}",
	"insights.searchSkills": "Search skill name or path",
	"insights.sortSkills": "Sort skills",
	"insights.byCount": "By count",
	"insights.byRecent": "By latest turn",
	"insights.noSkills": "No skill loading evidence found in this session record",
	"insights.noMatchingSkills": "No matching skills. Try another name or path.",
	"insights.skillSummary": "{count} skills · {uses} loads",
	"insights.partialSkills": "Checked {loaded} / {total} turns · load more to inspect remaining skills",
	"insights.skillNote": "Counts Skill calls, SKILL.md reads, explicit user references and skill loading records. This is not an available-skills list or proof of successful execution.",
	"insights.skill-reference": "User referenced SKILL.md",
	"insights.skill-injection": "Skill loading record",
	"insights.skillCount": "{count} calls",
	"insights.skill-tool": "Explicit Skill invocation",
	"insights.skill-file": "Read SKILL.md",
	"insights.evidence": "Evidence"
};
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
	"management.aiConfirm": "将为 {count} 条会话发送少量用户输入给当前默认模型以生成名称，会产生模型调用费用。是否继续？",
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
	"management.groupHint": "分组仅保存在插件元数据中，不会改变工作目录。"
};
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
	"management.aiConfirm": "Send a small amount of user input from {count} sessions to the current default model to suggest names? Model calls will incur charges.",
	"management.aiSkipped": "Skipped {count} already named sessions",
	"management.aiProgress": "AI suggestions: {done} / {total} processed",
	"management.aiStop": "Stop generation",
	"management.aiPending": "No suggestion yet; edit the name or retry to save this item.",
	"management.aiHint": "Suggestions are editable drafts only. Save submits generated or explicitly edited names only.",
	"management.aiUnavailable": "AI naming API is not connected yet",
	"management.move": "Move to group",
	"management.delete": "Delete",
	"management.deleteConfirm": "Delete {count} sessions? Original logs will be permanently deleted. This cannot be undone.",
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
	"management.groupHint": "Groups are plugin metadata only; working directories remain unchanged."
};
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
const LOCALE_NS = "sessions-insight";
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
	"cost.provisionalTip": "该模型的部分费率是推导值（cached 输入价由折扣规则推算、cacheWrite 按 1.25×input），不是官方单列价格；来源为 GPT-5.6 预览价汇总。",
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
	"error.network": "无法连接宿主路由"
};
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
	"tree.emptyAll": "No readable sessions in any source yet. Check the DSH / Claude / Codex directories, or press Refresh.",
	"tree.showAll": "Show all {count}",
	"sessions.untitled": "Untitled session",
	"sessions.actions": "Session actions",
	"sessions.delete": "Delete session",
	"sessions.deleteConfirm": "Delete “{title}”? This permanently deletes the session’s original logs and cannot be undone.",
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
	"handoff.cwdHint": "Must be explicit: omitting it makes DSH inherit its own launch directory and file the session under the wrong bucket.",
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
	"cost.provisionalTip": "Part of this model’s rates is derived (cached input from a discount rule, cacheWrite as 1.25× input), not an officially listed number; source is a GPT-5.6 preview price round-up.",
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
	"error.network": "Cannot reach the Host route"
};
/** Translate function bound to this namespace by the locale service. */
let runtimeTranslate;
/**
* Point {@link t} at the live locale service so every later read follows the
* active language. Called once from `apply`, before any label thunk can run.
* @param translate - namespace-bound translate from `ctx.locale.bind`.
*/
function setRuntimeTranslate(translate) {
	runtimeTranslate = translate;
}
/**
* Fill `{name}` placeholders.
* @param template - message text.
* @param params - values by placeholder name.
* @returns the filled text; an unknown placeholder is left visible on purpose.
*/
function fillParams(template, params) {
	if (params === void 0) return template;
	return template.replace(/\{(\w+)\}/g, (whole, name) => {
		const value = params[name];
		return value === void 0 ? whole : String(value);
	});
}
/**
* Translate one key of this namespace.
* @param key - a key of {@link zh}.
* @param params - interpolation values for the message.
* @returns the active-language text, or the English text when the locale
* service is absent, or the key itself when neither has it.
*/
function t(key, params) {
	const translated = runtimeTranslate?.(key, params);
	if (translated !== void 0 && translated !== "") return translated;
	return fillParams(en[key], params);
}
//#endregion
//#region src/client/state/list-cache.ts
/** Metadata only, shared by preload, panel and tree for one API origin. */
var ClientListCache = class {
	sources;
	workdirs;
	sessions = /* @__PURE__ */ new Map();
	#metadata = /* @__PURE__ */ new Map();
	projectSessions(value) {
		return {
			...value,
			sessions: value.sessions.map((row) => {
				const update = this.#metadata.get(`${row.source}:${row.id}`);
				if (update === void 0) return row;
				const next = { ...row };
				if (update.displayTitle === void 0) delete next.title;
				else next.title = update.displayTitle;
				return next;
			})
		};
	}
	#pending = /* @__PURE__ */ new Map();
	#listeners = /* @__PURE__ */ new Set();
	#deletion = 0;
	deletionVersion = () => this.#deletion;
	subscribe = (listener) => {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	};
	/** Keep visible rows, but prevent superseded requests from restoring them. */
	invalidateRequests(keys = this.#pending.keys()) {
		for (const key of keys) {
			const pending = this.#pending.get(key);
			this.#pending.delete(key);
			pending?.controller.abort();
		}
	}
	async read(key, load, save, signal) {
		if (signal?.aborted) return {
			ok: false,
			error: "aborted"
		};
		let pending = this.#pending.get(key);
		if (pending === void 0) {
			const controller = new AbortController();
			pending = {
				controller,
				promise: load(controller.signal).then((result) => {
					if (this.#pending.get(key) !== pending) return {
						ok: false,
						error: "aborted"
					};
					if (result.ok) save(result.value);
					return result;
				}).finally(() => {
					if (this.#pending.get(key) === pending) this.#pending.delete(key);
				}),
				readers: 0
			};
			this.#pending.set(key, pending);
		}
		const entry = pending;
		entry.readers += 1;
		return new Promise((resolve, reject) => {
			let finished = false;
			const finish = (result, error) => {
				if (finished) return;
				finished = true;
				signal?.removeEventListener("abort", abort);
				entry.readers -= 1;
				if (entry.readers === 0 && this.#pending.get(key) === entry) {
					this.#pending.delete(key);
					entry.controller.abort();
				}
				if (result !== void 0) resolve(result);
				else reject(error);
			};
			const abort = () => finish({
				ok: false,
				error: "aborted"
			});
			signal?.addEventListener("abort", abort, { once: true });
			entry.promise.then((result) => finish(result), (error) => finish(void 0, error));
			if (signal?.aborted) abort();
		});
	}
	rename(value) {
		const { source, id } = value.metadata;
		this.#metadata.set(`${source}:${id}`, value);
		for (const [workdir, list] of this.sessions) {
			if (!list.sessions.some((row) => row.source === source && row.id === id)) continue;
			this.invalidateRequests([`sessions:${workdir}`]);
			this.sessions.set(workdir, {
				...list,
				sessions: list.sessions.map((row) => {
					if (row.source !== source || row.id !== id) return row;
					const next = { ...row };
					if (value.displayTitle === void 0) delete next.title;
					else next.title = value.displayTitle;
					return next;
				})
			});
		}
		this.#deletion += 1;
		for (const listener of this.#listeners) listener();
	}
	remove(deleted) {
		this.invalidateRequests([
			"sources",
			"workdirs:false",
			"workdirs:true",
			`sessions:${deleted.workdir}`
		]);
		for (const [workdir, value] of this.sessions) this.sessions.set(workdir, {
			...value,
			sessions: value.sessions.filter((row) => row.source !== deleted.source || row.id !== deleted.id)
		});
		if (this.sources !== void 0) this.sources = { sources: this.sources.sources.map((row) => row.source === deleted.source && row.sessions !== void 0 ? {
			...row,
			sessions: Math.max(0, row.sessions - 1)
		} : row) };
		if (this.workdirs !== void 0) this.workdirs = {
			...this.workdirs,
			workdirs: this.workdirs.workdirs.map((row) => {
				if (row.workdir !== deleted.workdir) return row;
				const remaining = this.sessions.get(row.workdir)?.sessions;
				const sources = row.sources.map((group) => {
					if (group.source !== deleted.source) return group;
					const entries = remaining?.filter((session) => session.source === group.source);
					return {
						...group,
						sessions: Math.max(0, group.sessions - 1),
						lastUpdatedAt: entries === void 0 ? group.lastUpdatedAt : Math.max(0, ...entries.map((entry) => entry.updatedAt))
					};
				}).filter((group) => group.sessions > 0);
				return {
					...row,
					sessions: sources.reduce((sum, group) => sum + group.sessions, 0),
					lastUpdatedAt: Math.max(0, ...sources.map((group) => group.lastUpdatedAt)),
					sources
				};
			}).filter((row) => row.sessions > 0)
		};
		this.#deletion += 1;
		for (const listener of this.#listeners) listener();
	}
};
const CACHES = /* @__PURE__ */ new Map();
function clientListCache(base = "") {
	let cache = CACHES.get(base);
	if (cache === void 0) {
		cache = new ClientListCache();
		CACHES.set(base, cache);
	}
	return cache;
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
		signal
	});
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
		body
	});
}
/**
* Build the API surface.
* @param base - prefix prepended to every route ('' keeps it document-relative).
* @returns the four reads.
*/
function createApi(base = "") {
	const cache = clientListCache(base);
	return {
		deleteSession: (source, id) => post(base + SESSION_DELETE_URL, {
			source,
			id
		}, isDeleteSessionValue),
		metadata: (signal) => get(base + SESSION_METADATA_URL, isMetadataValue, signal),
		updateMetadata: (patch) => post(base + SESSION_METADATA_URL, patch, isSessionMetadataValue),
		suggestTitle: (source, id, signal) => post(base + SESSION_AI_TITLE_URL, {
			source,
			id
		}, isAiTitleValue, signal),
		sources: (signal) => cache.read("sources", (sharedSignal) => get(base + SOURCES_URL, isSourcesValue, sharedSignal), (value) => {
			cache.sources = value;
		}, signal),
		workdirs: (signal, refresh = false) => cache.read(`workdirs:${String(refresh)}`, (sharedSignal) => get(base + WORKDIRS_URL + (refresh ? "?refresh=1" : ""), isWorkdirsValue, sharedSignal), (value) => {
			cache.workdirs = value;
		}, signal),
		sessions: (workdir, signal) => cache.read(`sessions:${workdir}`, (sharedSignal) => get(`${base}${SESSIONS_URL}?workdir=${encodeURIComponent(workdir)}`, isSessionsValue, sharedSignal).then((result) => result.ok ? {
			ok: true,
			value: cache.projectSessions(result.value)
		} : result), (value) => {
			cache.sessions.set(workdir, value);
		}, signal),
		session: (id, offset, limit, source, signal) => get(`${base}${SESSION_URL}?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}&turnOffset=${String(offset)}&turnLimit=${String(limit)}`, isInsightSessionDetail, signal),
		search: (query, limit, tier, cursor, signal) => get(`${base}${SEARCH_URL}?q=${encodeURIComponent(query)}&limit=${String(limit)}&tier=${tier}&cursor=${String(cursor)}`, isSearchValue, signal),
		cost: (source, id, signal) => get(`${base}${COST_URL}?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`, isCostValue, signal),
		handoffPrepare: (source, id, signal) => post(base + HANDOFF_PREPARE_URL, {
			source,
			id,
			locale: t("handoff.language")
		}, isBriefValue, signal),
		handoffApply: (body, signal) => post(base + HANDOFF_APPLY_URL, body, isHandoffApplyValue, signal),
		handoffReveal: (sessionId) => post(base + HANDOFF_REVEAL_URL, {
			source: "dsh",
			id: sessionId
		}, isHandoffRevealValue),
		handoffStatus: (sessionId, signal) => get(`${base}${HANDOFF_STATUS_URL}?sessionId=${encodeURIComponent(sessionId)}`, isHandoffStatusValue, signal)
	};
}
/** Preload only navigation metadata; session bodies remain on demand. */
async function preloadSessionLists(api = createApi(), signal) {
	const [, workdirs] = await Promise.all([api.sources(signal), api.workdirs(signal)]);
	if (signal?.aborted || !workdirs.ok) return;
	const first = workdirs.value.workdirs[0];
	if (first !== void 0) await api.sessions(first.workdir, signal);
}
/**
* One line for a failed request: the classified error, then its detail.
* @param failure - the failed result.
* @returns printable text.
*/
function failureText(failure) {
	return failure.detail === void 0 ? failure.error : `${failure.error}: ${failure.detail}`;
}
//#endregion
//#region src/client/theme/generated.css.ts
const TAILWIND_CSS = "/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */\n@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))){*,:before,:after,::backdrop{--tw-rotate-x:initial;--tw-rotate-y:initial;--tw-rotate-z:initial;--tw-skew-x:initial;--tw-skew-y:initial;--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-tracking:initial;--tw-ordinal:initial;--tw-slashed-zero:initial;--tw-numeric-figure:initial;--tw-numeric-spacing:initial;--tw-numeric-fraction:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-outline-style:solid;--tw-blur:initial;--tw-brightness:initial;--tw-contrast:initial;--tw-grayscale:initial;--tw-hue-rotate:initial;--tw-invert:initial;--tw-opacity:initial;--tw-saturate:initial;--tw-sepia:initial;--tw-drop-shadow:initial;--tw-drop-shadow-color:initial;--tw-drop-shadow-alpha:100%;--tw-drop-shadow-size:initial;--tw-duration:initial;--tw-ease:initial;--tw-content:\"\"}}}@layer theme{.ci-panel{--font-mono:ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, monospace;--color-black:#000;--color-white:#fff;--spacing:.25rem;--container-md:28rem;--container-xl:36rem;--text-xs:.75rem;--text-xs--line-height:calc(1 / .75);--font-weight-normal:400;--font-weight-medium:500;--font-weight-semibold:600;--tracking-normal:0em;--leading-tight:1.25;--leading-snug:1.375;--leading-normal:1.5;--leading-relaxed:1.625;--radius-xs:.125rem;--radius-sm:.25rem;--radius-md:.375rem;--radius-lg:.5rem;--radius-xl:.75rem;--ease-out:cubic-bezier(.23, 1, .32, 1);--ease-in-out:cubic-bezier(.77, 0, .175, 1);--animate-spin:spin 1s linear infinite;--animate-pulse:pulse 2s cubic-bezier(.4, 0, .6, 1) infinite;--default-transition-duration:.15s;--default-transition-timing-function:cubic-bezier(.4, 0, .2, 1);--color-fg:var(--dsw-alias-label-primary,light-dark(oklch(22% 0 none),oklch(93% 0 none)));--color-fg-dim:var(--dsw-alias-label-secondary,light-dark(oklch(46% 0 none),oklch(68% 0 none)));--color-bg:var(--dsw-alias-bg-base,light-dark(oklch(100% 0 none),oklch(19% 0 none)));--color-bg-1:var(--dsw-alias-bg-layer-1,light-dark(oklch(97% 0 none),oklch(23% 0 none)));--color-bg-2:var(--dsw-alias-bg-layer-2,light-dark(oklch(94% 0 none),oklch(27% 0 none)));--color-bg-3:var(--dsw-alias-bg-layer-3,light-dark(oklch(91% 0 none),oklch(31% 0 none)));--color-fg-3:var(--dsw-alias-label-tertiary,light-dark(oklch(60% 0 none),oklch(56% 0 none)));--color-hover:var(--dsw-alias-interactive-bg-hover,light-dark(oklch(22% 0 none/.06),oklch(100% 0 none/.07)));--color-line:var(--dsw-alias-border-l2,light-dark(oklch(86% 0 none),oklch(34% 0 none)));--color-line-soft:var(--dsw-alias-border-l1,light-dark(oklch(91% 0 none),oklch(28% 0 none)));--color-accent:var(--dsw-alias-brand-primary,light-dark(oklch(52% .17 264),oklch(62% .15 264)));--color-ok:var(--dsw-alias-state-success-primary,light-dark(oklch(50% .14 152),oklch(72% .15 152)));--color-warn:var(--dsw-alias-state-warn-primary,light-dark(oklch(55% .12 82),oklch(78% .13 82)));--color-err:var(--dsw-alias-state-error-primary,light-dark(oklch(52% .18 22),oklch(68% .17 22)));--color-info:light-dark(oklch(55% .16 262),oklch(72% .15 264));--color-sidebar:var(--dsw-specific-sidebar-fill,var(--color-bg-1));--color-part-system-prompt:#6f86b8;--color-part-tool-definitions:#9a7fc4;--color-part-memory-instructions:#4f9e9a;--color-part-referenced-files:#6aa46f;--color-part-history:#b08a5a;--color-part-tool-results:#c47f7f;--color-part-images:#7f9aa8;--color-part-user-input:#8fa86a;--color-part-assistant-output:#a97fa8;--color-part-thinking:#7f7f8f}}@scope (.ci-panel) {\n@layer utilities{.\\@container{container-type:inline-size!important}.pointer-events-none{pointer-events:none!important}.collapse{visibility:collapse!important}.invisible{visibility:hidden!important}.visible{visibility:visible!important}.absolute{position:absolute!important}.fixed{position:fixed!important}.relative{position:relative!important}.sticky{position:sticky!important}.inset-0{inset:0!important}.inset-e-2{inset-inline-end:calc(var(--spacing) * 2)!important}.top-0{top:0!important}.isolate{isolation:isolate!important}.z-10{z-index:10!important}.z-50{z-index:50!important}.z-60{z-index:60!important}.col-start-1{grid-column-start:1!important}.row-start-1{grid-row-start:1!important}.container{width:100%!important}@media (min-width:40rem){.container{max-width:40rem!important}}@media (min-width:48rem){.container{max-width:48rem!important}}@media (min-width:64rem){.container{max-width:64rem!important}}@media (min-width:80rem){.container{max-width:80rem!important}}@media (min-width:96rem){.container{max-width:96rem!important}}.m-0{margin:0!important}.mx-1{margin-inline:var(--spacing)!important}.mx-1\\.5{margin-inline:calc(var(--spacing) * 1.5)!important}.mx-4{margin-inline:calc(var(--spacing) * 4)!important}.my-0{margin-block:0!important}.my-1{margin-block:var(--spacing)!important}.my-1\\.5{margin-block:calc(var(--spacing) * 1.5)!important}.my-2{margin-block:calc(var(--spacing) * 2)!important}.my-2\\.5{margin-block:calc(var(--spacing) * 2.5)!important}.my-px{margin-block:1px!important}.ms-1{margin-inline-start:var(--spacing)!important}.ms-2{margin-inline-start:calc(var(--spacing) * 2)!important}.ms-3{margin-inline-start:calc(var(--spacing) * 3)!important}.ms-3\\.25{margin-inline-start:calc(var(--spacing) * 3.25)!important}.ms-4{margin-inline-start:calc(var(--spacing) * 4)!important}.ms-5{margin-inline-start:calc(var(--spacing) * 5)!important}.ms-6{margin-inline-start:calc(var(--spacing) * 6)!important}.ms-auto{margin-inline-start:auto!important}.me-4{margin-inline-end:calc(var(--spacing) * 4)!important}.mbs-2{margin-block-start:calc(var(--spacing) * 2)!important}.mbs-3{margin-block-start:calc(var(--spacing) * 3)!important}.mt-0{margin-top:0!important}.mt-0\\.5{margin-top:calc(var(--spacing) * .5)!important}.mt-1{margin-top:var(--spacing)!important}.mt-1\\.5{margin-top:calc(var(--spacing) * 1.5)!important}.mt-2{margin-top:calc(var(--spacing) * 2)!important}.mt-2\\.5{margin-top:calc(var(--spacing) * 2.5)!important}.mt-3{margin-top:calc(var(--spacing) * 3)!important}.mt-auto{margin-top:auto!important}.mb-0{margin-bottom:0!important}.mb-1{margin-bottom:var(--spacing)!important}.mb-2{margin-bottom:calc(var(--spacing) * 2)!important}.mb-2\\.5{margin-bottom:calc(var(--spacing) * 2.5)!important}.box-border{box-sizing:border-box!important}.line-clamp-2{-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;display:-webkit-box!important;overflow:hidden!important}.block{display:block!important}.contents{display:contents!important}.flex{display:flex!important}.grid{display:grid!important}.hidden{display:none!important}.inline{display:inline!important}.inline-block{display:inline-block!important}.inline-flex{display:inline-flex!important}.inline-grid{display:inline-grid!important}.table{display:table!important}.size-1{width:var(--spacing)!important;height:var(--spacing)!important}.size-1\\.5{width:calc(var(--spacing) * 1.5)!important;height:calc(var(--spacing) * 1.5)!important}.size-4{width:calc(var(--spacing) * 4)!important;height:calc(var(--spacing) * 4)!important}.h-1{height:var(--spacing)!important}.h-1\\.5{height:calc(var(--spacing) * 1.5)!important}.h-2{height:calc(var(--spacing) * 2)!important}.h-2\\.5{height:calc(var(--spacing) * 2.5)!important}.h-3{height:calc(var(--spacing) * 3)!important}.h-3\\.5{height:calc(var(--spacing) * 3.5)!important}.h-4{height:calc(var(--spacing) * 4)!important}.h-4\\.5{height:calc(var(--spacing) * 4.5)!important}.h-5{height:calc(var(--spacing) * 5)!important}.h-6{height:calc(var(--spacing) * 6)!important}.h-7{height:calc(var(--spacing) * 7)!important}.h-8{height:calc(var(--spacing) * 8)!important}.h-9{height:calc(var(--spacing) * 9)!important}.h-10{height:calc(var(--spacing) * 10)!important}.h-12{height:calc(var(--spacing) * 12)!important}.h-14{height:calc(var(--spacing) * 14)!important}.h-20{height:calc(var(--spacing) * 20)!important}.h-24{height:calc(var(--spacing) * 24)!important}.h-28{height:calc(var(--spacing) * 28)!important}.h-32{height:calc(var(--spacing) * 32)!important}.h-36{height:calc(var(--spacing) * 36)!important}.h-40{height:calc(var(--spacing) * 40)!important}.h-44{height:calc(var(--spacing) * 44)!important}.h-\\[74px\\]{height:74px!important}.h-\\[min\\(300px\\,42dvh\\)\\]{height:min(300px,42dvh)!important}.h-full{height:100%!important}.h-px{height:1px!important}.max-h-\\(--available-height\\){max-height:var(--available-height)!important}.max-h-55{max-height:calc(var(--spacing) * 55)!important}.max-h-64{max-height:calc(var(--spacing) * 64)!important}.max-h-80{max-height:calc(var(--spacing) * 80)!important}.max-h-\\[42dvh\\]{max-height:42dvh!important}.max-h-\\[70vh\\]{max-height:70vh!important}.max-h-\\[90dvh\\]{max-height:90dvh!important}.max-h-full{max-height:100%!important}.min-h-0{min-height:0!important}.min-h-8{min-height:calc(var(--spacing) * 8)!important}.min-h-9{min-height:calc(var(--spacing) * 9)!important}.min-h-10{min-height:calc(var(--spacing) * 10)!important}.min-h-40{min-height:calc(var(--spacing) * 40)!important}.min-h-50{min-height:calc(var(--spacing) * 50)!important}.w-\\(--anchor-width\\){width:var(--anchor-width)!important}.w-1{width:var(--spacing)!important}.w-1\\/2{width:50%!important}.w-2{width:calc(var(--spacing) * 2)!important}.w-2\\.5{width:calc(var(--spacing) * 2.5)!important}.w-3{width:calc(var(--spacing) * 3)!important}.w-3\\.5{width:calc(var(--spacing) * 3.5)!important}.w-3\\/4{width:75%!important}.w-6{width:calc(var(--spacing) * 6)!important}.w-28{width:calc(var(--spacing) * 28)!important}.w-32{width:calc(var(--spacing) * 32)!important}.w-40{width:calc(var(--spacing) * 40)!important}.w-\\[46\\%\\]{width:46%!important}.w-\\[68\\%\\]{width:68%!important}.w-\\[86\\%\\]{width:86%!important}.w-\\[clamp\\(160px\\,28cqw\\,280px\\)\\]{width:clamp(160px,28cqw,280px)!important}.w-\\[min\\(720px\\,92vw\\)\\]{width:min(720px,92vw)!important}.w-\\[min\\(820px\\,94vw\\)\\]{width:min(820px,94vw)!important}.w-full{width:100%!important}.max-w-\\[16ch\\]{max-width:16ch!important}.max-w-\\[40\\%\\]{max-width:40%!important}.max-w-\\[42ch\\]{max-width:42ch!important}.max-w-\\[44ch\\]{max-width:44ch!important}.max-w-\\[60ch\\]{max-width:60ch!important}.max-w-full{max-width:100%!important}.max-w-md{max-width:var(--container-md)!important}.max-w-xl{max-width:var(--container-xl)!important}.min-w-0{min-width:0!important}.min-w-36{min-width:calc(var(--spacing) * 36)!important}.min-w-40{min-width:calc(var(--spacing) * 40)!important}.flex-1{flex:1!important}.flex-none{flex:none!important}.shrink{flex-shrink:1!important}.shrink-0{flex-shrink:0!important}.basis-64{flex-basis:calc(var(--spacing) * 64)!important}.transform{transform:var(--tw-rotate-x,) var(--tw-rotate-y,) var(--tw-rotate-z,) var(--tw-skew-x,) var(--tw-skew-y,)!important}.cursor-default{cursor:default!important}.cursor-pointer{cursor:pointer!important}.resize{resize:both!important}.resize-y{resize:vertical!important}.scrollbar-gutter-stable{scrollbar-gutter:stable!important}.list-none{list-style-type:none!important}.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))!important}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))!important}.grid-cols-\\[22px_minmax\\(0\\,1fr\\)_64px\\]{grid-template-columns:22px minmax(0,1fr) 64px!important}.grid-cols-\\[clamp\\(220px\\,30cqw\\,300px\\)_minmax\\(0\\,1fr\\)\\]{grid-template-columns:clamp(220px,30cqw,300px) minmax(0,1fr)!important}.grid-cols-\\[minmax\\(0\\,1fr\\)\\]{grid-template-columns:minmax(0,1fr)!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,10rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,16rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,19rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr))!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,22rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))!important}.grid-cols-\\[var\\(--ci-time-w\\)_36px_44px_minmax\\(0\\,1fr\\)\\]{grid-template-columns:var(--ci-time-w) 36px 44px minmax(0,1fr)!important}.grid-rows-\\[auto_minmax\\(0\\,1fr\\)\\]{grid-template-rows:auto minmax(0,1fr)!important}.grid-rows-\\[auto_minmax\\(0\\,1fr\\)_auto\\]{grid-template-rows:auto minmax(0,1fr) auto!important}.flex-col{flex-direction:column!important}.flex-wrap{flex-wrap:wrap!important}.place-items-center{place-items:center!important}.items-baseline{align-items:baseline!important}.items-center{align-items:center!important}.items-end{align-items:flex-end!important}.items-start{align-items:flex-start!important}.items-stretch{align-items:stretch!important}.justify-between{justify-content:space-between!important}.justify-center{justify-content:center!important}.justify-end{justify-content:flex-end!important}.justify-start{justify-content:flex-start!important}.gap-0{gap:0!important}.gap-0\\.5{gap:calc(var(--spacing) * .5)!important}.gap-1{gap:var(--spacing)!important}.gap-1\\.5{gap:calc(var(--spacing) * 1.5)!important}.gap-2{gap:calc(var(--spacing) * 2)!important}.gap-2\\.5{gap:calc(var(--spacing) * 2.5)!important}.gap-3{gap:calc(var(--spacing) * 3)!important}.gap-4{gap:calc(var(--spacing) * 4)!important}.gap-px{gap:1px!important}.gap-x-1{column-gap:var(--spacing)!important}.gap-x-1\\.5{column-gap:calc(var(--spacing) * 1.5)!important}.gap-x-2{column-gap:calc(var(--spacing) * 2)!important}.gap-x-2\\.5{column-gap:calc(var(--spacing) * 2.5)!important}.gap-x-5{column-gap:calc(var(--spacing) * 5)!important}.gap-x-6{column-gap:calc(var(--spacing) * 6)!important}.gap-y-0{row-gap:0!important}.gap-y-0\\.5{row-gap:calc(var(--spacing) * .5)!important}.gap-y-1{row-gap:var(--spacing)!important}.gap-y-1\\.5{row-gap:calc(var(--spacing) * 1.5)!important}.gap-y-2{row-gap:calc(var(--spacing) * 2)!important}.self-center{align-self:center!important}.self-start{align-self:flex-start!important}.truncate{text-overflow:ellipsis!important;white-space:nowrap!important;overflow:hidden!important}.overflow-clip{overflow:clip!important}.overflow-hidden{overflow:hidden!important}.overflow-visible{overflow:visible!important}.overflow-x-auto{overflow-x:auto!important}.overflow-x-clip{overflow-x:clip!important}.overflow-y-auto{overflow-y:auto!important}.overscroll-contain{overscroll-behavior:contain!important}.rounded{border-radius:.25rem!important}.rounded-\\[3px\\]{border-radius:3px!important}.rounded-\\[4px\\]{border-radius:4px!important}.rounded-\\[5px\\]{border-radius:5px!important}.rounded-\\[7px\\]{border-radius:7px!important}.rounded-\\[10px\\]{border-radius:10px!important}.rounded-full{border-radius:3.40282e38px!important}.rounded-lg{border-radius:var(--radius-lg)!important}.rounded-md{border-radius:var(--radius-md)!important}.rounded-sm{border-radius:var(--radius-sm)!important}.rounded-xl{border-radius:var(--radius-xl)!important}.rounded-xs{border-radius:var(--radius-xs)!important}.border{border-style:var(--tw-border-style)!important;border-width:1px!important}.border-0{border-style:var(--tw-border-style)!important;border-width:0!important}.border-\\[0\\.5px\\]{border-style:var(--tw-border-style)!important;border-width:.5px!important}.border-s{border-inline-start-style:var(--tw-border-style)!important;border-inline-start-width:1px!important}.border-s-2{border-inline-start-style:var(--tw-border-style)!important;border-inline-start-width:2px!important}.border-e{border-inline-end-style:var(--tw-border-style)!important;border-inline-end-width:1px!important}.border-bs{border-block-start-style:var(--tw-border-style)!important;border-block-start-width:1px!important}.border-t{border-top-style:var(--tw-border-style)!important;border-top-width:1px!important}.border-t-\\[0\\.5px\\]{border-top-style:var(--tw-border-style)!important;border-top-width:.5px!important}.border-b{border-bottom-style:var(--tw-border-style)!important;border-bottom-width:1px!important}.border-b-\\[0\\.5px\\]{border-bottom-style:var(--tw-border-style)!important;border-bottom-width:.5px!important}.border-dashed{--tw-border-style:dashed!important;border-style:dashed!important}.border-accent{border-color:var(--color-accent)!important}.border-current{border-color:currentColor!important}.border-err,.border-err\\/40{border-color:var(--color-err)!important}@supports (color:color-mix(in lab, red, red)){.border-err\\/40{border-color:color-mix(in oklab, var(--color-err) 40%, transparent)!important}}.border-line{border-color:var(--color-line)!important}.border-line-soft{border-color:var(--color-line-soft)!important}.border-warn,.border-warn\\/40{border-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.border-warn\\/40{border-color:color-mix(in oklab, var(--color-warn) 40%, transparent)!important}}.border-warn\\/50{border-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.border-warn\\/50{border-color:color-mix(in oklab, var(--color-warn) 50%, transparent)!important}}.border-warn\\/70{border-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.border-warn\\/70{border-color:color-mix(in oklab, var(--color-warn) 70%, transparent)!important}}.border-s-err{border-inline-start-color:var(--color-err)!important}.border-s-ok{border-inline-start-color:var(--color-ok)!important}.border-s-warn{border-inline-start-color:var(--color-warn)!important}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_16\\%\\,transparent\\)\\]{background-color:var(--color-accent)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_16\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-accent) 16%,transparent)!important}}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_35\\%\\,transparent\\)\\]{background-color:var(--color-accent)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_35\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-accent) 35%,transparent)!important}}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-err\\)_8\\%\\,transparent\\)\\]{background-color:var(--color-err)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-err\\)_8\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-err) 8%,transparent)!important}}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-ok\\)_8\\%\\,transparent\\)\\]{background-color:var(--color-ok)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-ok\\)_8\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-ok) 8%,transparent)!important}}.bg-\\[rgb\\(0_0_0\\/55\\%\\)\\]{background-color:#0000008c!important}.bg-accent,.bg-accent\\/14{background-color:var(--color-accent)!important}@supports (color:color-mix(in lab, red, red)){.bg-accent\\/14{background-color:color-mix(in oklab, var(--color-accent) 14%, transparent)!important}}.bg-bg{background-color:var(--color-bg)!important}.bg-bg-1{background-color:var(--color-bg-1)!important}.bg-bg-2{background-color:var(--color-bg-2)!important}.bg-bg-3{background-color:var(--color-bg-3)!important}.bg-err,.bg-err\\/5{background-color:var(--color-err)!important}@supports (color:color-mix(in lab, red, red)){.bg-err\\/5{background-color:color-mix(in oklab, var(--color-err) 5%, transparent)!important}}.bg-fg-dim{background-color:var(--color-fg-dim)!important}.bg-line-soft{background-color:var(--color-line-soft)!important}.bg-ok{background-color:var(--color-ok)!important}.bg-sidebar{background-color:var(--color-sidebar)!important}.bg-transparent{background-color:#0000!important}.bg-warn,.bg-warn\\/6{background-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.bg-warn\\/6{background-color:color-mix(in oklab, var(--color-warn) 6%, transparent)!important}}.bg-warn\\/8{background-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.bg-warn\\/8{background-color:color-mix(in oklab, var(--color-warn) 8%, transparent)!important}}.bg-\\[linear-gradient\\(90deg\\,var\\(--color-bg-1\\)\\,var\\(--color-bg-2\\)\\,var\\(--color-bg-1\\)\\)\\]{background-image:linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))!important}.bg-\\[repeating-linear-gradient\\(45deg\\,var\\(--color-fg-dim\\)_0_1px\\,transparent_1px_3px\\)\\]{background-image:repeating-linear-gradient(45deg,var(--color-fg-dim) 0 1px,transparent 1px 3px)!important}.bg-\\[repeating-linear-gradient\\(45deg\\,var\\(--color-fg-dim\\)_0_2px\\,transparent_2px_5px\\)\\]{background-image:repeating-linear-gradient(45deg,var(--color-fg-dim) 0 2px,transparent 2px 5px)!important}.bg-\\[length\\:200\\%_100\\%\\],.bg-size-\\[200\\%_100\\%\\]{background-size:200% 100%!important}.fill-accent{fill:var(--color-accent)!important}.fill-none{fill:none!important}.stroke-accent{stroke:var(--color-accent)!important}.stroke-fg-dim{stroke:var(--color-fg-dim)!important}.stroke-line-soft{stroke:var(--color-line-soft)!important}.stroke-warn{stroke:var(--color-warn)!important}.stroke-1{stroke-width:1px!important}.stroke-\\[1\\.6\\]{stroke-width:1.6px!important}.p-0{padding:0!important}.p-1{padding:var(--spacing)!important}.p-1\\.5{padding:calc(var(--spacing) * 1.5)!important}.p-2{padding:calc(var(--spacing) * 2)!important}.p-3{padding:calc(var(--spacing) * 3)!important}.p-3\\.5{padding:calc(var(--spacing) * 3.5)!important}.p-4{padding:calc(var(--spacing) * 4)!important}.p-5{padding:calc(var(--spacing) * 5)!important}.p-6{padding:calc(var(--spacing) * 6)!important}.px-1{padding-inline:var(--spacing)!important}.px-1\\.5{padding-inline:calc(var(--spacing) * 1.5)!important}.px-1\\.25{padding-inline:calc(var(--spacing) * 1.25)!important}.px-2{padding-inline:calc(var(--spacing) * 2)!important}.px-2\\.5{padding-inline:calc(var(--spacing) * 2.5)!important}.px-3{padding-inline:calc(var(--spacing) * 3)!important}.px-3\\.5{padding-inline:calc(var(--spacing) * 3.5)!important}.px-4{padding-inline:calc(var(--spacing) * 4)!important}.px-5{padding-inline:calc(var(--spacing) * 5)!important}.px-8{padding-inline:calc(var(--spacing) * 8)!important}.px-px{padding-inline:1px!important}.py-0{padding-block:0!important}.py-0\\.5{padding-block:calc(var(--spacing) * .5)!important}.py-1{padding-block:var(--spacing)!important}.py-1\\.5{padding-block:calc(var(--spacing) * 1.5)!important}.py-2{padding-block:calc(var(--spacing) * 2)!important}.py-2\\.5{padding-block:calc(var(--spacing) * 2.5)!important}.py-3{padding-block:calc(var(--spacing) * 3)!important}.py-4{padding-block:calc(var(--spacing) * 4)!important}.py-10{padding-block:calc(var(--spacing) * 10)!important}.py-px{padding-block:1px!important}.ps-0{padding-inline-start:0!important}.ps-1{padding-inline-start:var(--spacing)!important}.ps-1\\.5{padding-inline-start:calc(var(--spacing) * 1.5)!important}.ps-2{padding-inline-start:calc(var(--spacing) * 2)!important}.ps-2\\.5{padding-inline-start:calc(var(--spacing) * 2.5)!important}.ps-3{padding-inline-start:calc(var(--spacing) * 3)!important}.ps-4{padding-inline-start:calc(var(--spacing) * 4)!important}.ps-5{padding-inline-start:calc(var(--spacing) * 5)!important}.ps-8{padding-inline-start:calc(var(--spacing) * 8)!important}.ps-9{padding-inline-start:calc(var(--spacing) * 9)!important}.ps-9\\.25{padding-inline-start:calc(var(--spacing) * 9.25)!important}.pe-2{padding-inline-end:calc(var(--spacing) * 2)!important}.pe-8{padding-inline-end:calc(var(--spacing) * 8)!important}.pt-1{padding-top:var(--spacing)!important}.pt-1\\.5{padding-top:calc(var(--spacing) * 1.5)!important}.pt-2{padding-top:calc(var(--spacing) * 2)!important}.pt-3{padding-top:calc(var(--spacing) * 3)!important}.pt-4{padding-top:calc(var(--spacing) * 4)!important}.pt-\\[12vh\\]{padding-top:12vh!important}.pb-1{padding-bottom:var(--spacing)!important}.pb-1\\.5{padding-bottom:calc(var(--spacing) * 1.5)!important}.pb-2{padding-bottom:calc(var(--spacing) * 2)!important}.pb-2\\.5{padding-bottom:calc(var(--spacing) * 2.5)!important}.pb-3{padding-bottom:calc(var(--spacing) * 3)!important}.pb-4{padding-bottom:calc(var(--spacing) * 4)!important}.pb-6{padding-bottom:calc(var(--spacing) * 6)!important}.text-center{text-align:center!important}.text-end{text-align:end!important}.text-left{text-align:left!important}.text-right{text-align:right!important}.text-start{text-align:start!important}.font-\\[inherit\\]{font-family:inherit!important}.font-mono{font-family:var(--font-mono)!important}.text-xs{font-size:var(--text-xs)!important;line-height:var(--tw-leading,var(--text-xs--line-height))!important}.text-\\[9\\.5px\\]{font-size:9.5px!important}.text-\\[10\\.5px\\]{font-size:10.5px!important}.text-\\[10px\\]{font-size:10px!important}.text-\\[11\\.5px\\]{font-size:11.5px!important}.text-\\[11px\\]{font-size:11px!important}.text-\\[12\\.5px\\]{font-size:12.5px!important}.text-\\[12px\\]{font-size:12px!important}.text-\\[13\\.5px\\]{font-size:13.5px!important}.text-\\[13px\\]{font-size:13px!important}.text-\\[15px\\]{font-size:15px!important}.text-\\[16px\\]{font-size:16px!important}.text-\\[18px\\]{font-size:18px!important}.text-\\[20px\\]{font-size:20px!important}.text-\\[24px\\]{font-size:24px!important}.leading-4{--tw-leading:calc(var(--spacing) * 4)!important;line-height:calc(var(--spacing) * 4)!important}.leading-4\\.25{--tw-leading:calc(var(--spacing) * 4.25)!important;line-height:calc(var(--spacing) * 4.25)!important}.leading-\\[15px\\]{--tw-leading:15px!important;line-height:15px!important}.leading-none{--tw-leading:1!important;line-height:1!important}.leading-normal{--tw-leading:var(--leading-normal)!important;line-height:var(--leading-normal)!important}.leading-relaxed{--tw-leading:var(--leading-relaxed)!important;line-height:var(--leading-relaxed)!important}.leading-snug{--tw-leading:var(--leading-snug)!important;line-height:var(--leading-snug)!important}.leading-tight{--tw-leading:var(--leading-tight)!important;line-height:var(--leading-tight)!important}.font-medium{--tw-font-weight:var(--font-weight-medium)!important;font-weight:var(--font-weight-medium)!important}.font-normal{--tw-font-weight:var(--font-weight-normal)!important;font-weight:var(--font-weight-normal)!important}.font-semibold{--tw-font-weight:var(--font-weight-semibold)!important;font-weight:var(--font-weight-semibold)!important}.tracking-\\[-0\\.01em\\]{--tw-tracking:-.01em!important;letter-spacing:-.01em!important}.tracking-\\[0\\.02em\\]{--tw-tracking:.02em!important;letter-spacing:.02em!important}.tracking-\\[0\\.06em\\]{--tw-tracking:.06em!important;letter-spacing:.06em!important}.tracking-normal{--tw-tracking:var(--tracking-normal)!important;letter-spacing:var(--tracking-normal)!important}.break-words{overflow-wrap:break-word!important}.wrap-anywhere{overflow-wrap:anywhere!important}.break-all{word-break:break-all!important}.whitespace-nowrap{white-space:nowrap!important}.whitespace-pre-wrap{white-space:pre-wrap!important}.text-accent{color:var(--color-accent)!important}.text-err{color:var(--color-err)!important}.text-fg{color:var(--color-fg)!important}.text-fg-3{color:var(--color-fg-3)!important}.text-fg-dim{color:var(--color-fg-dim)!important}.text-inherit{color:inherit!important}.text-ok{color:var(--color-ok)!important}.text-warn{color:var(--color-warn)!important}.text-white{color:var(--color-white)!important}.normal-case{text-transform:none!important}.uppercase{text-transform:uppercase!important}.italic{font-style:italic!important}.ordinal{--tw-ordinal:ordinal!important;font-variant-numeric:var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)!important}.tabular-nums{--tw-numeric-spacing:tabular-nums!important;font-variant-numeric:var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)!important}.accent-accent{accent-color:var(--color-accent)!important}.opacity-50{opacity:.5!important}.opacity-60{opacity:.6!important}.opacity-70{opacity:.7!important}.opacity-75{opacity:.75!important}.opacity-80{opacity:.8!important}.opacity-100{opacity:1!important}.opacity-\\[0\\.14\\]{opacity:.14!important}.shadow-\\[0_18px_48px_rgb\\(0_0_0\\/50\\%\\)\\]{--tw-shadow:0 18px 48px var(--tw-shadow-color,#00000080)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.shadow-\\[inset_0_0_0_1px_var\\(--color-fg-dim\\)\\]{--tw-shadow:inset 0 0 0 1px var(--tw-shadow-color,var(--color-fg-dim))!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.shadow-lg{--tw-shadow:0 10px 15px -3px var(--tw-shadow-color,#0000001a), 0 4px 6px -4px var(--tw-shadow-color,#0000001a)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.shadow-sm{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a), 0 1px 2px -1px var(--tw-shadow-color,#0000001a)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.shadow-xl{--tw-shadow:0 20px 25px -5px var(--tw-shadow-color,#0000001a), 0 8px 10px -6px var(--tw-shadow-color,#0000001a)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.ring{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.outline{outline-style:var(--tw-outline-style)!important;outline-width:1px!important}.outline-offset-2{outline-offset:2px!important}.blur{--tw-blur:blur(8px)!important;filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)!important}.filter{filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)!important}.transition{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to,opacity,box-shadow,transform,translate,scale,rotate,filter,-webkit-backdrop-filter,backdrop-filter,display,content-visibility,overlay,pointer-events!important;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function))!important;transition-duration:var(--tw-duration,var(--default-transition-duration))!important}.transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to!important;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function))!important;transition-duration:var(--tw-duration,var(--default-transition-duration))!important}.duration-150{--tw-duration:.15s!important;transition-duration:.15s!important}.ease-in-out{--tw-ease:var(--ease-in-out)!important;transition-timing-function:var(--ease-in-out)!important}.ease-out{--tw-ease:var(--ease-out)!important;transition-timing-function:var(--ease-out)!important}.outline-none{--tw-outline-style:none!important;outline-style:none!important}.select-none{-webkit-user-select:none!important;user-select:none!important}.\\[stroke-dasharray\\:3_3\\]{stroke-dasharray:3 3!important}.\\[stroke-linejoin\\:round\\]{stroke-linejoin:round!important}.\\[vector-effect\\:non-scaling-stroke\\]{vector-effect:non-scaling-stroke!important}.placeholder\\:text-fg-3::placeholder{color:var(--color-fg-3)!important}.backdrop\\:bg-black\\/40::backdrop{background-color:#0006!important}@supports (color:color-mix(in lab, red, red)){.backdrop\\:bg-black\\/40::backdrop{background-color:color-mix(in oklab, var(--color-black) 40%, transparent)!important}}.after\\:w-max:after{content:var(--tw-content);width:max-content!important}.after\\:max-w-full:after{content:var(--tw-content);max-width:100%!important}.first\\:mt-0:first-child{margin-top:0!important}.first\\:rounded-s-sm:first-child{border-start-start-radius:var(--radius-sm)!important;border-end-start-radius:var(--radius-sm)!important}.first\\:border-t-0:first-child{border-top-style:var(--tw-border-style)!important;border-top-width:0!important}.last\\:rounded-e-sm:last-child{border-start-end-radius:var(--radius-sm)!important;border-end-end-radius:var(--radius-sm)!important}.focus-within\\:border-accent:focus-within{border-color:var(--color-accent)!important}@media (hover:hover){.hover\\:bg-bg-2:hover{background-color:var(--color-bg-2)!important}.hover\\:bg-hover:hover{background-color:var(--color-hover)!important}}.focus\\:bg-hover:focus{background-color:var(--color-hover)!important}.focus-visible\\:outline-2:focus-visible{outline-style:var(--tw-outline-style)!important;outline-width:2px!important}.focus-visible\\:outline-accent:focus-visible{outline-color:var(--color-accent)!important}.active\\:bg-bg-3:active{background-color:var(--color-bg-3)!important}.active\\:bg-hover:active{background-color:var(--color-hover)!important}@media (hover:hover){.enabled\\:hover\\:border-accent:enabled:hover{border-color:var(--color-accent)!important}.enabled\\:hover\\:brightness-110:enabled:hover{--tw-brightness:brightness(110%)!important;filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)!important}}.disabled\\:cursor-default:disabled{cursor:default!important}.disabled\\:cursor-not-allowed:disabled{cursor:not-allowed!important}.disabled\\:opacity-50:disabled{opacity:.5!important}.data-disabled\\:pointer-events-none[data-disabled]{pointer-events:none!important}.data-disabled\\:opacity-50[data-disabled]{opacity:.5!important}.data-highlighted\\:bg-bg-3[data-highlighted]{background-color:var(--color-bg-3)!important}.data-\\[active\\=true\\]\\:bg-bg-2[data-active=true]{background-color:var(--color-bg-2)!important}.data-\\[size\\=default\\]\\:h-9[data-size=default]{height:calc(var(--spacing) * 9)!important}.data-\\[size\\=sm\\]\\:h-8[data-size=sm]{height:calc(var(--spacing) * 8)!important}.data-\\[state\\=provisional\\]\\:border-dashed[data-state=provisional]{--tw-border-style:dashed!important;border-style:dashed!important}@media (prefers-reduced-motion:no-preference){.motion-safe\\:animate-\\[ci-skel_1\\.4s_var\\(--ease-in-out\\)_infinite\\]{animation:ci-skel 1.4s var(--ease-in-out) infinite!important}.motion-safe\\:animate-pulse{animation:var(--animate-pulse)!important}.motion-safe\\:animate-spin{animation:var(--animate-spin)!important}}@container (min-width:42rem){.\\@2xl\\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))!important}}@container (min-width:48rem){.\\@3xl\\:flex{display:flex!important}.\\@3xl\\:grid{display:grid!important}.\\@3xl\\:min-h-0{min-height:0!important}.\\@3xl\\:flex-1{flex:1!important}.\\@3xl\\:grid-cols-\\[minmax\\(300px\\,380px\\)_minmax\\(0\\,1fr\\)\\]{grid-template-columns:minmax(300px,380px) minmax(0,1fr)!important}.\\@3xl\\:overflow-hidden{overflow:hidden!important}.\\@3xl\\:overflow-y-auto{overflow-y:auto!important}.\\@3xl\\:overscroll-contain{overscroll-behavior:contain!important}.\\@3xl\\:border-e{border-inline-end-style:var(--tw-border-style)!important;border-inline-end-width:1px!important}.\\@3xl\\:border-t-0{border-top-style:var(--tw-border-style)!important;border-top-width:0!important}}@container (min-width:56rem){.\\@4xl\\:flex{display:flex!important}}.\\[\\&\\>span\\+span\\]\\:text-\\[11px\\]>span+span{font-size:11px!important}.\\[\\&\\>span\\+span\\]\\:font-normal>span+span{--tw-font-weight:var(--font-weight-normal)!important;font-weight:var(--font-weight-normal)!important}.\\[\\&\\>span\\+span\\]\\:text-fg-dim>span+span{color:var(--color-fg-dim)!important}}@layer components{.ci-src{border:1px solid light-dark(var(--ci-src-brand),var(--ci-src-brand));align-items:center;gap:.1875rem;padding-block:1px;padding-inline:.3125rem;display:inline-flex}@supports (color:color-mix(in lab, red, red)){.ci-src{border:1px solid light-dark(color-mix(in oklch, var(--ci-src-brand) 55%, oklch(40% 0 none)),color-mix(in oklch, var(--ci-src-brand) 45%, transparent))}}.ci-src{background:light-dark(var(--ci-src-brand),var(--ci-src-brand));border-radius:999px}@supports (color:color-mix(in lab, red, red)){.ci-src{background:light-dark(color-mix(in oklch, var(--ci-src-brand) 16%, oklch(100% 0 none)),color-mix(in oklch, var(--ci-src-brand) 14%, transparent))}}.ci-src{color:light-dark(var(--ci-src-brand),var(--ci-src-color,var(--color-fg)))}@supports (color:color-mix(in lab, red, red)){.ci-src{color:light-dark(color-mix(in oklch, var(--ci-src-brand) 55%, oklch(20% 0 none)),var(--ci-src-color,var(--color-fg)))}}.ci-src{font-variant-numeric:tabular-nums;white-space:nowrap;font-size:.625rem;line-height:1.4}.ci-src__word{color:light-dark(var(--ci-src-brand),var(--ci-src-color,var(--color-fg)))}@supports (color:color-mix(in lab, red, red)){.ci-src__word{color:light-dark(color-mix(in oklch, var(--ci-src-brand) 55%, oklch(20% 0 none)),var(--ci-src-color,var(--color-fg)))}}.ci-status{background:light-dark(currentColor,currentColor);border:1px solid;border-radius:999px;align-items:center;gap:.25rem;padding-block:1px;padding-inline:.375rem .3125rem;display:inline-flex}@supports (color:color-mix(in lab, red, red)){.ci-status{background:light-dark(color-mix(in oklch, currentColor 12%, oklch(100% 0 none)),color-mix(in oklch, currentColor 14%, transparent))}}.ci-status{font-variant-numeric:tabular-nums;font-size:.625rem;line-height:1.5}.ci-status:before{content:\"\";background:currentColor;border-radius:50%;block-size:6px;inline-size:6px}.ci-status--ok{color:var(--color-ok)}.ci-status--error{color:var(--color-err)}.ci-status--unknown{color:var(--color-warn)}.ci-status--running{color:var(--color-info)}.ci-status--running:before{animation:ci-breathe 1.6s var(--ease-in-out) infinite}@keyframes ci-breathe{0%,to{opacity:1;box-shadow:0 0 0 0 color-mix(in oklch, currentColor 55%, transparent)}50%{opacity:.55;box-shadow:0 0 0 4px color-mix(in oklch, currentColor 0%, transparent)}}@media (prefers-reduced-motion:reduce){.ci-status--running:before{animation:none}}.ci-ask{margin:0}.ci-ask__label{color:var(--color-fg-dim);margin-block-end:.375rem;font-size:11px;font-weight:500;display:block}.ci-ask__text{border:1px solid var(--color-accent);margin:0;padding-block:.625rem;padding-inline:.875rem}@supports (color:color-mix(in lab, red, red)){.ci-ask__text{border:1px solid color-mix(in oklch, var(--color-accent) 22%, transparent)}}.ci-ask__text{background:var(--color-accent);border-radius:10px}@supports (color:color-mix(in lab, red, red)){.ci-ask__text{background:color-mix(in oklch, var(--color-accent) 7%, var(--color-bg-1))}}.ci-ask__text{color:var(--color-fg);overscroll-behavior:contain;white-space:pre-wrap;overflow-wrap:break-word;max-block-size:7.5rem;font-size:13.5px;line-height:1.65;overflow-y:auto}.ci-pre{border:.5px solid var(--color-line-soft);background:var(--color-bg-2);font-family:var(--font-mono);white-space:pre-wrap;overflow-wrap:break-word;border-radius:5px;margin-block:2px 0;padding:6px 8px;font-size:11px;line-height:1.5;overflow-x:auto}[data-tip]{cursor:help}[data-tip]:hover:after,[data-tip]:focus-visible:after{content:attr(data-tip);z-index:20;border:.5px solid var(--color-line);background:var(--color-bg-2);max-width:340px;color:var(--color-fg);pointer-events:none;white-space:normal;border-radius:6px;padding:6px 8px;font-family:inherit;font-size:10.5px;font-style:normal;line-height:1.45;position:absolute;top:calc(100% + 6px);left:0;box-shadow:0 6px 18px #00000059}@keyframes ci-skel{0%{background-position:100% 0}to{background-position:-100% 0}}}.ci-btn,.ci-icon-btn,.ci-row,.ci-search{appearance:none;color:var(--color-fg);font:inherit;text-align:start;cursor:pointer;transition:background-color .14s var(--ease-out), border-color .14s var(--ease-out), color .14s var(--ease-out);background:0 0;border:1px solid #0000;margin:0}.ci-btn{border-color:var(--color-line);background:var(--color-bg-1);white-space:nowrap;border-radius:7px;align-items:center;gap:6px;block-size:28px;padding-inline:10px;font-size:12px;font-weight:500;display:inline-flex}.ci-btn:hover:not(:disabled){background:var(--color-bg-2)}.ci-btn--primary{background:var(--color-accent);color:#fff;border-color:#0000}.ci-btn--primary:hover:not(:disabled){background:var(--color-accent)}@supports (color:color-mix(in lab, red, red)){.ci-btn--primary:hover:not(:disabled){background:color-mix(in oklch, var(--color-accent) 86%, black)}}.ci-btn--quiet{color:var(--color-accent);background:0 0;border-color:#0000}.ci-btn--quiet:hover:not(:disabled){background:var(--color-accent)}@supports (color:color-mix(in lab, red, red)){.ci-btn--quiet:hover:not(:disabled){background:color-mix(in oklch, var(--color-accent) 10%, transparent)}}.ci-btn:disabled,.ci-icon-btn:disabled{opacity:.5;cursor:default}.ci-icon-btn{block-size:28px;inline-size:28px;color:var(--color-fg-dim);border-radius:7px;place-items:center;padding:0;display:inline-grid}.ci-icon-btn:hover:not(:disabled),.ci-icon-btn[aria-pressed=true]{background:var(--color-hover);color:var(--color-fg)}.ci-search{border-color:var(--color-line-soft);background:var(--color-bg-1);block-size:30px;color:var(--color-fg-3);border-radius:8px;align-items:center;gap:8px;padding-inline:10px 6px;font-size:12px;display:flex}.ci-search:hover{border-color:var(--color-line);color:var(--color-fg-dim)}.ci-row{border-radius:8px;inline-size:100%;min-inline-size:0;display:block}@media (hover:hover) and (pointer:fine){.ci-row:hover{background:var(--color-hover)}}.ci-row[data-selected=true]{background:var(--color-accent)}@supports (color:color-mix(in lab, red, red)){.ci-row[data-selected=true]{background:color-mix(in oklch, var(--color-accent) 14%, transparent)}}.ci-row:focus-visible,.ci-btn:focus-visible,.ci-icon-btn:focus-visible,.ci-search:focus-visible{outline:2px solid var(--color-accent);outline-offset:-2px}.ci-chevron{transition:transform .16s var(--ease-out)}[aria-expanded=true]>*>.ci-chevron,[aria-expanded=true]>.ci-chevron{transform:rotate(90deg)}.ci-fold>summary{cursor:pointer;list-style:none}.ci-fold>summary::-webkit-details-marker{display:none}.ci-fold[open]>summary .ci-chevron{transform:rotate(90deg)}.ci-dot{border:1.5px solid var(--color-bg);background:var(--color-accent);cursor:pointer;block-size:7px;inline-size:7px;transition:transform .14s var(--ease-out);border-radius:50%;margin:-3.5px 0 0 -3.5px;padding:0;position:absolute}.ci-dot:after{content:\"\";border-radius:50%;position:absolute;inset:-6px}.ci-dot:hover{transform:scale(1.5)}.ci-dot[data-selected=true]{block-size:11px;inline-size:11px;box-shadow:0 0 0 3px var(--color-accent);border-width:2px;margin:-5.5px 0 0 -5.5px}@supports (color:color-mix(in lab, red, red)){.ci-dot[data-selected=true]{box-shadow:0 0 0 3px color-mix(in oklch, var(--color-accent) 30%, transparent)}}.ci-scroll{scrollbar-width:thin;scrollbar-color:var(--color-line) transparent}@media (prefers-reduced-motion:reduce){.ci-btn,.ci-icon-btn,.ci-row,.ci-search,.ci-chevron{transition:none}}@layer base{*,:before,:after{box-sizing:border-box}:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--color-accent));outline-offset:1px;border-radius:6px}button,a,input,select,textarea{color:inherit;font:inherit;background:0 0;border:0}}:scope[data-dsh-sessions-insight-view] :is(h1,h2,h3,h4,h5,h6){font-family:revert;font-weight:revert;letter-spacing:revert;line-height:revert;margin:revert}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.5}}\n}@property --tw-rotate-x{syntax:\"*\";inherits:false}@property --tw-rotate-y{syntax:\"*\";inherits:false}@property --tw-rotate-z{syntax:\"*\";inherits:false}@property --tw-skew-x{syntax:\"*\";inherits:false}@property --tw-skew-y{syntax:\"*\";inherits:false}@property --tw-border-style{syntax:\"*\";inherits:false;initial-value:solid}@property --tw-leading{syntax:\"*\";inherits:false}@property --tw-font-weight{syntax:\"*\";inherits:false}@property --tw-tracking{syntax:\"*\";inherits:false}@property --tw-ordinal{syntax:\"*\";inherits:false}@property --tw-slashed-zero{syntax:\"*\";inherits:false}@property --tw-numeric-figure{syntax:\"*\";inherits:false}@property --tw-numeric-spacing{syntax:\"*\";inherits:false}@property --tw-numeric-fraction{syntax:\"*\";inherits:false}@property --tw-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-shadow-color{syntax:\"*\";inherits:false}@property --tw-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-inset-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-inset-shadow-color{syntax:\"*\";inherits:false}@property --tw-inset-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-ring-color{syntax:\"*\";inherits:false}@property --tw-ring-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-inset-ring-color{syntax:\"*\";inherits:false}@property --tw-inset-ring-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-ring-inset{syntax:\"*\";inherits:false}@property --tw-ring-offset-width{syntax:\"<length>\";inherits:false;initial-value:0}@property --tw-ring-offset-color{syntax:\"*\";inherits:false;initial-value:#fff}@property --tw-ring-offset-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-outline-style{syntax:\"*\";inherits:false;initial-value:solid}@property --tw-blur{syntax:\"*\";inherits:false}@property --tw-brightness{syntax:\"*\";inherits:false}@property --tw-contrast{syntax:\"*\";inherits:false}@property --tw-grayscale{syntax:\"*\";inherits:false}@property --tw-hue-rotate{syntax:\"*\";inherits:false}@property --tw-invert{syntax:\"*\";inherits:false}@property --tw-opacity{syntax:\"*\";inherits:false}@property --tw-saturate{syntax:\"*\";inherits:false}@property --tw-sepia{syntax:\"*\";inherits:false}@property --tw-drop-shadow{syntax:\"*\";inherits:false}@property --tw-drop-shadow-color{syntax:\"*\";inherits:false}@property --tw-drop-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-drop-shadow-size{syntax:\"*\";inherits:false}@property --tw-duration{syntax:\"*\";inherits:false}@property --tw-ease{syntax:\"*\";inherits:false}@property --tw-content{syntax:\"*\";inherits:false;initial-value:\"\"}";
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
const STYLE_ID = "dsh-sessions-insight-styles";
/**
* Create the style element once per page.
* @returns nothing; a document without a head (tests, SSR) is left alone.
*/
function injectStyles() {
	injectStylesOnce(STYLE_ID, TAILWIND_CSS);
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
const GROUPED = new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 });
/** The currency sign, kept out of the literals so no tooling mangles it. */
const DOLLAR = String.fromCharCode(36);
/**
* Group-separated integer, the form used wherever a token count is a claim.
* @param value - token count; may be negative (an over-counted defect).
*/
function formatTokens(value) {
	return GROUPED.format(Math.round(value));
}
/**
* Short form for a bar label: 980 / 4.2k / 423k / 1.1M.
* @param value - token count.
*/
function compactTokens(value) {
	const abs = Math.abs(value);
	const sign = value < 0 ? "-" : "";
	if (abs < 1e3) return sign + String(Math.round(abs));
	if (abs < 1e4) return `${sign + (abs / 1e3).toFixed(1)}k`;
	if (abs < 1e6) return `${sign + String(Math.round(abs / 1e3))}k`;
	return `${sign + (abs / 1e6).toFixed(1)}M`;
}
/**
* US-dollar amount, with enough decimals to keep a single turn readable.
* @param usd - amount in USD.
*/
function formatUsd(usd) {
	return DOLLAR + usd.toFixed(usd < .01 ? 4 : 3);
}
/**
* Money in its own currency, never converted.
* @param amount - amount in `currency`.
* @param currency - ISO code; unknown codes fall back to the code itself.
*/
function formatMoney(amount, currency) {
	const symbol = currency === "CNY" ? "¥" : currency === "USD" ? DOLLAR : "";
	const decimals = Math.abs(amount) >= 1 ? 2 : 4;
	return symbol + amount.toFixed(decimals);
}
/**
* Share of a whole, as a percentage string with one decimal.
* @param part - numerator.
* @param whole - denominator; a non-positive whole answers `—`.
*/
function formatShare(part, whole) {
	if (!Number.isFinite(whole) || whole <= 0) return "—";
	return `${(Math.round(part / whole * 1e3) / 10).toFixed(1)}%`;
}
/**
* Reconciliation factor, printed the way the ADR talks about it.
* @param factor - `reconciled.factor`.
*/
function formatFactor(factor) {
	return `×${(Math.round(factor * 1e3) / 1e3).toFixed(3)}`;
}
/**
* File size.
* @param bytes - byte count.
*/
function formatBytes(bytes) {
	if (bytes < 1024) return `${String(bytes)} B`;
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / 1048576).toFixed(1)} MB`;
}
const TIME = new Intl.DateTimeFormat(void 0, {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit"
});
/**
* Local wall-clock time of an epoch value.
* @param epoch - milliseconds since the Unix epoch.
*/
function formatTime(epoch) {
	if (!Number.isFinite(epoch) || epoch <= 0) return "—";
	return TIME.format(new Date(epoch));
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
	if (!Number.isFinite(epoch) || epoch <= 0) return "—";
	const date = new Date(epoch);
	const today = new Date(now);
	const pad = (value) => String(value).padStart(2, "0");
	const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	if (date.getFullYear() !== today.getFullYear()) return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	if (date.getMonth() === today.getMonth() && date.getDate() === today.getDate()) return clock;
	return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}`;
}
/**
* Duration between two epoch values, in the unit a reader scans fastest.
* @param from - start, epoch milliseconds.
* @param to - end, epoch milliseconds; omitted means "unknown".
*/
function formatDuration(from, to) {
	if (to === void 0 || !Number.isFinite(to) || to < from) return "—";
	const ms = to - from;
	if (ms < 1e3) return `${String(Math.round(ms))} ms`;
	if (ms < 6e4) return `${(ms / 1e3).toFixed(1)} s`;
	const minutes = Math.floor(ms / 6e4);
	return `${String(minutes)} min ${String(Math.round(ms % 6e4 / 1e3))} s`;
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
	if (path === "") return {
		parent: "",
		leaf: ""
	};
	const trimmed = path.replace(/[\\/]+$/, "");
	const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	if (index <= 0) return {
		parent: "",
		leaf: trimmed
	};
	return {
		parent: trimmed.slice(0, index + 1),
		leaf: trimmed.slice(index + 1)
	};
}
/**
* Last path segment.
* @param path - a filesystem path.
*/
function basename(path) {
	const trimmed = path.replace(/[\\/]+$/, "");
	const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	return index < 0 ? trimmed : trimmed.slice(index + 1);
}
/**
* Longest text a cell prints before the caller has to offer an expansion.
* @param text - candidate.
* @param limit - maximum characters.
*/
function clip(text, limit) {
	return text.length <= limit ? text : text.slice(0, limit);
}
/**
* Collapse the home directory to `~`, the way a terminal prints it.
* @param path - a filesystem path (POSIX or Windows).
* @returns the path with `/Users/<me>`, `/home/<me>` or `C:\Users\<me>` as `~`.
*/
function tildePath(path) {
	return path.replace(/^(\/Users\/[^/]+|\/home\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)(?=[\\/]|$)/, "~");
}
function sameSession(a, b) {
	return a?.source === b?.source && a?.id === b?.id;
}
function applySessionMetadata$1(session, value) {
	if (value === void 0 || !sameSession(session, value.metadata)) return session;
	const next = { ...session };
	if (value.displayTitle === void 0) delete next.title;
	else next.title = value.displayTitle;
	return next;
}
async function readTurnPrefix(api, ref, prefix, signal, current, publish, target) {
	while (current() && !signal.aborted && prefix.offset < prefix.total) {
		if (target !== void 0 && prefix.turns.some((turn) => turn.index === target)) break;
		const result = await api.session(ref.id, prefix.offset, target === void 0 ? 40 : 200, ref.source, signal);
		if (!current() || signal.aborted) return void 0;
		if (!result.ok) return result;
		const page = result.value.session.turns;
		if (page.length === 0) break;
		const turns = new Map(prefix.turns.map((turn) => [turn.index, turn]));
		for (const turn of page) if (!turns.has(turn.index)) turns.set(turn.index, turn);
		prefix = {
			turns: [...turns.values()].toSorted((a, b) => a.index - b.index),
			offset: prefix.offset + page.length,
			total: prefix.total
		};
		publish(prefix);
		if (target === void 0) break;
	}
}
function useSessionDetail(api, selected) {
	const [detail, setDetail] = (0, react.useState)({ kind: "idle" });
	const [cost, setCost] = (0, react.useState)(null);
	const [selectedTurn, setSelectedTurn] = (0, react.useState)(null);
	const [toolsExpanded, setToolsExpanded] = (0, react.useState)(false);
	const reading = (0, react.useRef)(null);
	const identity = (0, react.useRef)(selected);
	const metadata = (0, react.useRef)(/* @__PURE__ */ new Map());
	const jumpGeneration = (0, react.useRef)(0);
	const source = selected?.source;
	const id = selected?.id;
	(0, react.useLayoutEffect)(() => {
		identity.current = selected;
		if (!sameSession(reading.current?.ref ?? null, selected)) reading.current?.controller.abort();
	}, [selected]);
	const overlaySession = (0, react.useCallback)((session) => applySessionMetadata$1(session, metadata.current.get(`${session.source}:${session.id}`)), []);
	const overlay = (0, react.useCallback)((data) => {
		const session = overlaySession(data.session);
		return session === data.session ? data : {
			...data,
			session
		};
	}, [overlaySession]);
	(0, react.useEffect)(() => {
		setCost(null);
		setSelectedTurn(null);
		setToolsExpanded(false);
		if (source === void 0 || id === void 0) {
			reading.current = null;
			setDetail({ kind: "idle" });
			return;
		}
		const ref = {
			source,
			id
		};
		const controller = new AbortController();
		const active = {
			ref,
			controller,
			ready: false,
			prefix: {
				turns: [],
				offset: 0,
				total: 0
			}
		};
		reading.current = active;
		const current = () => reading.current === active && sameSession(identity.current, ref);
		setDetail({
			kind: "loading",
			ref
		});
		api.cost(source, id, controller.signal).then((result) => {
			if (!controller.signal.aborted && current()) setCost(result.ok ? result.value : null);
		});
		api.session(id, 0, 40, source, controller.signal).then((result) => {
			if (controller.signal.aborted || !current()) return;
			if (!result.ok) {
				setDetail({
					kind: "failed",
					ref,
					failure: result
				});
				return;
			}
			const turns = result.value.session.turns;
			active.ready = true;
			active.prefix = {
				turns,
				offset: turns.length,
				total: result.value.turnCount
			};
			setDetail({
				kind: "ready",
				ref,
				data: overlay(result.value),
				turns,
				loadingMore: false
			});
			setSelectedTurn(turns.find((turn) => turn.attribution.residual !== void 0)?.index ?? turns[0]?.index ?? null);
		});
		return () => controller.abort();
	}, [
		api,
		source,
		id,
		overlay
	]);
	const page = (0, react.useCallback)(async (target) => {
		const active = reading.current;
		if (active === null || !active.ready) return;
		const current = () => reading.current === active && !active.controller.signal.aborted && sameSession(identity.current, active.ref);
		if (!current()) return;
		while (active.paging !== void 0) {
			await active.paging;
			if (!current() || target === void 0) return;
		}
		if (target !== void 0 && active.prefix.turns.some((turn) => turn.index === target)) return;
		const update = (failure, loadingMore = false) => {
			if (!current()) return;
			setDetail((previous) => {
				if (!current() || previous.kind !== "ready" || !sameSession(previous.ref, active.ref)) return previous;
				const next = {
					...previous,
					data: overlay(previous.data),
					turns: active.prefix.turns,
					loadingMore
				};
				delete next.moreFailure;
				if (failure !== void 0) next.moreFailure = failure;
				return next;
			});
		};
		update(void 0, true);
		const request = readTurnPrefix(api, active.ref, active.prefix, active.controller.signal, current, (prefix) => {
			active.prefix = prefix;
			update(void 0, true);
		}, target).then((failure) => {
			update(failure);
		});
		active.paging = request;
		await request;
		if (active.paging === request) delete active.paging;
	}, [api, overlay]);
	return {
		detail,
		cost,
		selectedTurn,
		setSelectedTurn,
		toolsExpanded,
		setToolsExpanded,
		loadMore: (0, react.useCallback)(() => {
			page();
		}, [page]),
		jumpTurn: (0, react.useCallback)(async (index) => {
			const generation = ++jumpGeneration.current;
			const active = reading.current;
			await page(index);
			if (generation !== jumpGeneration.current || active === null || reading.current !== active || active.controller.signal.aborted || !sameSession(identity.current, active.ref)) return;
			if (active.prefix.turns.some((turn) => turn.index === index)) setSelectedTurn(index);
		}, [page]),
		onMetadataChanged: (0, react.useCallback)((value) => {
			const ref = value.metadata;
			metadata.current.set(`${ref.source}:${ref.id}`, value);
			setDetail((previous) => previous.kind !== "ready" || !sameSession(previous.ref, ref) ? previous : {
				...previous,
				data: overlay(previous.data)
			});
		}, [overlay]),
		overlaySession
	};
}
//#endregion
//#region src/client/ui/states.tsx
/** The shimmer shared by every skeleton block. */
const SHIMMER = "bg-[linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))] bg-[length:200%_100%] motion-safe:animate-[ci-skel_1.4s_var(--ease-in-out)_infinite]";
/**
* One skeleton block.
* @param props.className - size and shape utilities.
* @returns the block.
*/
function Skeleton({ className }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: `${SHIMMER} ${className}`,
		"aria-hidden": "true"
	});
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
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "m-0 px-1.5 pb-1 text-[11.5px] text-fg-dim",
			children: label
		}), [
			0,
			1,
			2
		].map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-1.5 py-1",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-[86%] rounded-lg" }), group === 0 ? [
				72,
				64,
				70,
				58
			].map((width) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "ms-5 h-8 rounded-lg" }, width)) : null]
		}, group))]
	});
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
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-3 border-b border-line-soft px-5 pt-4 pb-4",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "m-0 flex items-center gap-2 text-[11.5px] text-fg-dim",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "inline-block size-1.5 rounded-full bg-accent motion-safe:animate-pulse",
						"aria-hidden": "true"
					}), label]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-[46%] rounded-[5px]" }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-3.5 w-[68%] rounded-[4px]" }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-2 gap-2 @2xl:grid-cols-4",
					children: [
						0,
						1,
						2,
						3
					].map((tile) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-[74px] rounded-[10px]" }, tile))
				})
			]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "grid min-h-0 flex-1 grid-cols-1 @3xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2 border-line-soft p-3 @3xl:border-e",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-28 rounded-[10px]" }), [
					0,
					1,
					2,
					3,
					4,
					5
				].map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-14 rounded-lg" }, row))]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "hidden flex-col gap-3 p-4 @3xl:flex",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-32 rounded-[5px]" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-20 rounded-[10px]" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-44 rounded-[10px]" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-36 rounded-[10px]" })
				]
			})]
		})]
	});
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
		className: center ? "flex h-full min-h-40 flex-col items-center justify-center gap-1.5 p-6 text-center text-[12.5px] text-fg-dim" : "flex flex-col items-start gap-1.5 px-4 py-4 text-[12.5px] text-fg-dim",
		role: "status",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "m-0 font-medium text-fg",
			children: title
		}), hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "m-0 max-w-[44ch] text-[11.5px]",
			children: hint
		})]
	});
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
				children: title
			}),
			detail === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 text-[11.5px] text-fg-dim",
				children: detail
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "ci-btn",
				onClick: onRetry,
				children: t("panel.retry")
			})
		]
	});
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
		children
	});
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
const TERMINAL = /* @__PURE__ */ new Set(["succeeded", "failed"]);
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
	const base = "m-0 px-2.5 py-2 rounded-lg bg-bg-2 text-xs ";
	if (state === "succeeded") return `${base}text-ok`;
	if (state === "failed") return `${base}text-err`;
	return `${base}text-warn`;
}
function HandoffDialog({ api, source, id, onClose, onOpenSession }) {
	const [phase, setPhase] = (0, react.useState)({ kind: "preparing" });
	const [cwd, setCwd] = (0, react.useState)("");
	const [briefText, setBriefText] = (0, react.useState)("");
	const [progressError, setProgressError] = (0, react.useState)("");
	const [openError, setOpenError] = (0, react.useState)("");
	const alive = (0, react.useRef)(true);
	const pollTimer = (0, react.useRef)(void 0);
	(0, react.useEffect)(() => {
		alive.current = true;
		const controller = new AbortController();
		api.handoffPrepare(source, id, controller.signal).then((result) => {
			if (controller.signal.aborted) return;
			if (!result.ok) {
				setPhase({
					kind: "preview-failed",
					failure: result
				});
				return;
			}
			setPhase({
				kind: "ready",
				brief: result.value
			});
			setCwd(result.value.defaultCwd);
			setBriefText(result.value.brief);
		});
		return () => {
			alive.current = false;
			controller.abort();
			if (pollTimer.current !== void 0) window.clearTimeout(pollTimer.current);
		};
	}, [
		api,
		source,
		id
	]);
	function apply(brief) {
		setPhase({
			kind: "applying",
			brief
		});
		api.handoffApply({
			source,
			id,
			cwd,
			brief: briefText
		}).then((result) => {
			if (!alive.current) return;
			if (!result.ok) {
				setPhase({
					kind: "apply-failed",
					brief,
					failure: result
				});
				return;
			}
			const sessionId = result.value.sessionId;
			const afterMs = result.value.pollAfterMs;
			setPhase({
				kind: "applied",
				sessionId,
				status: {
					sessionId,
					state: "delivered",
					elapsedMs: 0
				}
			});
			function poll() {
				api.handoffStatus(sessionId).then((next) => {
					if (!alive.current) return;
					if (!next.ok) {
						setProgressError(next.detail ?? next.error);
						pollTimer.current = window.setTimeout(poll, afterMs);
						return;
					}
					setProgressError("");
					setPhase({
						kind: "applied",
						sessionId,
						status: next.value
					});
					if (!TERMINAL.has(next.value.state)) pollTimer.current = window.setTimeout(poll, afterMs);
				});
			}
			pollTimer.current = window.setTimeout(poll, afterMs);
		});
	}
	function stateLabel(status) {
		if (status.state === "delivered") return t("handoff.state.delivered");
		if (status.state === "running") return t("handoff.state.running");
		if (status.state === "succeeded") return t("handoff.state.succeeded");
		return t("handoff.state.failed");
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-60 flex items-center justify-center bg-[rgb(0_0_0/55%)] p-4",
		onMouseDown: (event) => event.target === event.currentTarget && onClose(),
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "grid max-h-[90dvh] w-[min(820px,94vw)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[10px] border-[0.5px] border-line bg-bg-1 shadow-[0_18px_48px_rgb(0_0_0/50%)]",
			role: "dialog",
			"aria-modal": "true",
			"aria-label": t("handoff.title"),
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: "flex items-center gap-3 border-b border-line-soft px-5 py-4",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 flex-col gap-1",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "text-[16px] font-semibold text-fg",
							children: t("handoff.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "text-[11px] text-fg-dim",
							children: [
								source,
								" · ",
								id.slice(0, 8)
							]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50",
						onClick: onClose,
						children: "Esc"
					})]
				}),
				phase.kind === "preparing" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex min-h-0 flex-col gap-3 overflow-y-auto p-5",
					role: "status",
					"aria-busy": "true",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: "m-0 flex items-center gap-2 text-[12px] text-fg-dim",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "size-1.5 rounded-full bg-accent motion-safe:animate-pulse",
								"aria-hidden": "true"
							}), t("handoff.preparing")]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-10 shrink-0 rounded-lg" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-3/4 shrink-0 rounded-sm" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-1/2 shrink-0 rounded-sm" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-[min(300px,42dvh)] shrink-0 rounded-lg" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "border-t border-line-soft pt-3",
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Skeleton, { className: "h-10 w-28 rounded-lg" })
						})
					]
				}) : null,
				phase.kind === "preview-failed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("session.error", { detail: phase.failure.detail ?? phase.failure.error }) }) : null,
				phase.kind === "ready" || phase.kind === "applying" || phase.kind === "apply-failed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex min-h-0 flex-col gap-3 overflow-y-auto p-5",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "flex flex-col gap-2 text-[12px] text-fg",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("handoff.cwd") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "w-full min-w-0 rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-[12px] text-fg",
								value: cwd,
								onChange: (event) => setCwd(event.target.value),
								spellCheck: false,
								"aria-describedby": "ci-handoff-cwd-hint"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 text-[11px] leading-relaxed text-fg-dim",
							id: "ci-handoff-cwd-hint",
							children: t("handoff.cwdHint")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-1.5",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim",
									children: t("handoff.files", { count: phase.brief.fileCount })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim",
									children: t("handoff.decisions", { count: phase.brief.decisionCount })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim",
									children: t("handoff.open", { count: phase.brief.openCount })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim",
									children: t("handoff.commands", { count: phase.brief.commandCount })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim",
									children: t("handoff.chars", { count: phase.brief.chars })
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "flex flex-col gap-2 text-[12px] text-fg",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("handoff.brief") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: "box-border max-h-[42dvh] min-h-40 w-full resize-y rounded-lg border border-line bg-bg p-3 font-mono text-[12px] leading-relaxed text-fg",
								value: briefText,
								onChange: (event) => setBriefText(event.target.value),
								spellCheck: false,
								rows: 14
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2 border-t border-line-soft pt-3",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "cursor-pointer rounded-lg border border-accent bg-accent px-4 py-2.5 font-[inherit] text-[12px] font-medium text-white enabled:hover:brightness-110 disabled:cursor-default disabled:opacity-50",
								onClick: () => apply(phase.brief),
								disabled: phase.kind === "applying" || cwd.trim() === "" || briefText.trim() === "",
								children: phase.kind === "applying" ? t("handoff.applying") : t("handoff.apply")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50",
								disabled: true,
								title: t("handoff.polishUnavailable"),
								children: t("handoff.polish")
							})]
						}),
						phase.kind === "apply-failed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("handoff.applyFailed", { detail: phase.failure.detail ?? phase.failure.error }) }) : null
					]
				}) : null,
				phase.kind === "applied" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex min-h-0 flex-col gap-3 overflow-y-auto p-5",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: stateClass(phase.status.state),
							"data-state": phase.status.state,
							children: [
								stateLabel(phase.status),
								" · ",
								phase.sessionId.slice(0, 12)
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 text-[12px] text-fg-dim",
							role: "status",
							children: t("handoff.progress", {
								seconds: Math.floor(phase.status.elapsedMs / 1e3),
								count: phase.status.progress?.toolsCompleted ?? 0
							})
						}),
						phase.status.state === "running" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 text-[12px] text-fg",
							children: phase.status.progress?.tool === "ask_user_question" ? t("handoff.waiting") : phase.status.progress?.tool ? t("handoff.tool", { tool: phase.status.progress.tool }) : t("handoff.thinking")
						}) : null,
						phase.status.progress === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 text-[11px] text-fg-dim",
							children: t("handoff.updated", { time: new Date(phase.status.progress.updatedAt).toLocaleTimeString(t("handoff.language") === "zh" ? "zh-CN" : "en-US") })
						}),
						progressError === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 text-[12px] text-warn",
							role: "alert",
							children: t("handoff.pollError", { detail: progressError })
						}),
						openError === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 text-[12px] text-err",
							role: "alert",
							children: t("handoff.openFailed", { detail: openError })
						}),
						phase.status.reason === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 font-mono text-[11px] text-err",
							children: t("handoff.reason", { reason: phase.status.reason })
						}),
						phase.status.detail === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "my-1.5 text-[10.5px] text-fg-dim",
							children: phase.status.detail
						}),
						phase.status.seq === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "my-1.5 text-[10.5px] text-fg-dim",
							children: t("handoff.evidence", { seq: phase.status.seq })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "cursor-pointer rounded-lg border border-accent bg-accent px-4 py-2.5 text-[12px] text-white disabled:opacity-50",
								disabled: onOpenSession === void 0,
								onClick: () => {
									setOpenError("");
									Promise.resolve().then(() => onOpenSession?.(phase.sessionId)).then(onClose).catch((error) => {
										if (alive.current) setOpenError(error instanceof Error ? error.message : String(error));
									});
								},
								children: t("handoff.openSession")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50",
								onClick: onClose,
								children: t("handoff.close")
							})]
						})
					]
				}) : null
			]
		})
	});
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
	const groups = cost.groups ?? [];
	function materialise() {
		return groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [cost.partial === true && groups.length === 1 ? t("cost.partialPrefix") : "", formatMoney(group.amount, group.currency)] }, group.tableId + group.currency));
	}
	const referenceEntries = Object.entries(cost.reference?.byCurrency ?? {});
	const reference = referenceEntries.length === 1 && referenceEntries[0] !== void 0 ? t("cost.reference", { amount: formatMoney(referenceEntries[0][1].amount, referenceEntries[0][0]) }) : void 0;
	const lines = [];
	const used = new Set(groups.map((group) => group.tableId));
	if (cost.reference !== void 0 && cost.reference !== null) used.add(cost.reference.tableId);
	for (const id of used) {
		const table = cost.tables?.[id];
		if (table === void 0) continue;
		lines.push(t("cost.tableLine", {
			id,
			source: table.pricing.source ?? "—",
			asOf: table.pricing.asOf
		}));
	}
	const channels = cost.unlistedChannels ?? [];
	if (channels.length > 0) lines.push(t("cost.unlistedTip", { channels: channels.join("、") }));
	lines.push(t("cost.noConvert"));
	const tip = lines.join(" · ");
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: plain ? "relative inline-flex items-baseline gap-1.5 whitespace-nowrap [&>span+span]:text-[11px] [&>span+span]:font-normal [&>span+span]:text-fg-dim" : "relative inline-flex items-center gap-1 rounded-sm border-[0.5px] border-line bg-transparent px-1.5 font-mono text-[10px] leading-4.25 whitespace-nowrap text-fg-dim data-[state=provisional]:border-dashed",
		"data-tip": tip,
		tabIndex: 0,
		"aria-label": tip === "" ? "cost" : tip,
		children: [
			groups.length === 0 ? "—" : materialise(),
			reference === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: reference }),
			cost.provisional === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "ms-1 inline-flex items-center gap-1 rounded-sm border-[0.5px] border-dashed border-line bg-bg-2 px-1.25 text-[9.5px] leading-4.25 tracking-[0.02em] whitespace-nowrap text-fg-dim normal-case",
				children: t("cost.provisional")
			}) : null
		]
	});
}
/** localStorage key for the expanded set. */
const TREE_STORAGE_KEY = "dsh-sessions-insight.tree";
/** Identity of one session row. */
function sessionKey(source, id) {
	return `${source}:${id}`;
}
/**
* Build project rows from the workdir answer, newest first.
* @param workdirs - the Host's workdir entries.
* @param split - path splitter (injected so the tests stay DOM-free).
*/
function buildProjects(workdirs, split) {
	return workdirs.map((entry) => {
		const parts = split(entry.workdir);
		return {
			workdir: entry.workdir,
			leaf: parts.leaf === "" ? entry.workdir : parts.leaf,
			parent: parts.parent,
			counts: entry.sources.map((group) => ({
				source: group.source,
				sessions: group.sessions
			})),
			lastUpdatedAt: entry.lastUpdatedAt
		};
	});
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
	const pageSize = input.pageSize ?? 20;
	const rows = [];
	for (const project of input.projects) {
		const expanded = input.expanded.has(project.workdir);
		rows.push({
			kind: "project",
			key: `p:${project.workdir}`,
			project,
			expanded
		});
		if (!expanded) continue;
		if (input.loading.has(project.workdir)) {
			rows.push({
				kind: "skeleton",
				key: `l:${project.workdir}`,
				workdir: project.workdir,
				rows: 4
			});
			continue;
		}
		const sessions = input.sessions.get(project.workdir);
		if (sessions === void 0) {
			rows.push({
				kind: "skeleton",
				key: `l:${project.workdir}`,
				workdir: project.workdir,
				rows: 4
			});
			continue;
		}
		const limit = input.limits.get(project.workdir) ?? pageSize;
		const shown = sessions.slice(0, limit);
		for (const session of shown) {
			const key = sessionKey(session.source, session.id);
			rows.push({
				kind: "session",
				key,
				workdir: project.workdir,
				session,
				selected: key === input.selected
			});
		}
		if (sessions.length > shown.length) rows.push({
			kind: "more",
			key: `m:${project.workdir}`,
			workdir: project.workdir,
			hidden: sessions.length - shown.length
		});
	}
	return rows;
}
/**
* Move the row cursor.
* @param rows - visible rows.
* @param from - current index (-1 when nothing is focused).
* @param key - the arrow/Home/End key.
* @returns the next index, clamped to the row list.
*/
function nextIndex(rows, from, key) {
	if (rows.length === 0) return -1;
	if (key === "Home") return 0;
	if (key === "End") return rows.length - 1;
	const delta = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
	if (delta === 0) return from;
	const start = from < 0 ? delta > 0 ? -1 : rows.length : from;
	return Math.min(rows.length - 1, Math.max(0, start + delta));
}
/**
* Read the persisted expanded set.
*
* Storage can be absent (SSR, private mode) or hold junk; both mean "no saved
* state", never a crash.
* @param storage - `localStorage`-like object, or undefined.
*/
function readExpanded(storage) {
	if (storage === void 0) return [];
	try {
		const raw = storage.getItem(TREE_STORAGE_KEY);
		if (raw === null) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((value) => typeof value === "string");
	} catch {
		return [];
	}
}
/**
* Persist the expanded set.
* @param storage - `localStorage`-like object, or undefined.
* @param workdirs - expanded workdirs.
*/
function writeExpanded(storage, workdirs) {
	if (storage === void 0) return;
	try {
		storage.setItem(TREE_STORAGE_KEY, JSON.stringify(workdirs));
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
	const needle = query.trim().toLowerCase();
	if (needle === "") return [...projects];
	return projects.filter((project) => project.workdir.toLowerCase().includes(needle));
}
//#endregion
//#region src/client/state/management.ts
/** Serial writes: successful rows are published immediately, failures do not stop the batch. */
async function runSessionBatch(sessions, write, onSuccess, signal) {
	const failures = [];
	for (const session of sessions) {
		if (signal?.aborted) break;
		try {
			const result = await write(session);
			if (result.ok) onSuccess(session, result.value);
			else failures.push({
				session,
				reason: failureText(result)
			});
		} catch (error) {
			failures.push({
				session,
				reason: error instanceof Error ? error.message : String(error)
			});
		}
	}
	return failures;
}
function applySessionMetadata(sessions, metadata, groupFilter) {
	return new Map([...sessions].map(([workdir, list]) => [workdir, list.flatMap((session) => {
		const value = metadata.get(sessionKey(session.source, session.id));
		const group = value?.metadata.group ?? "";
		if (groupFilter !== "" && (groupFilter === "ungrouped" ? group !== "" : group !== groupFilter.slice(6))) return [];
		const title = value?.displayTitle ?? value?.metadata.title ?? session.title;
		return [(value?.metadata.title?.trim().length ?? 0) > 0 ? {
			...session,
			title,
			named: true
		} : title === session.title ? session : {
			...session,
			title
		}];
	})]));
}
//#endregion
//#region src/client/state/selection.ts
function emptySelection() {
	return {
		keys: /* @__PURE__ */ new Set(),
		anchor: null
	};
}
/** Only painted session rows participate in Shift ranges and select-visible. */
function visibleSessions(rows) {
	return rows.flatMap((row) => row.kind === "session" ? [row.session] : []);
}
function toggleSelection(current, key, visible, shift = false) {
	const order = visible.map((session) => sessionKey(session.source, session.id));
	const end = order.indexOf(key);
	if (end < 0) return current;
	const start = current.anchor === null ? -1 : order.indexOf(current.anchor);
	const keys = new Set(current.keys);
	if (shift && start >= 0) {
		const range = order.slice(Math.min(start, end), Math.max(start, end) + 1);
		for (const item of range) if (current.keys.has(key)) keys.delete(item);
		else keys.add(item);
		return {
			keys,
			anchor: current.anchor
		};
	}
	if (keys.has(key)) keys.delete(key);
	else keys.add(key);
	return {
		keys,
		anchor: key
	};
}
/** Add an explicitly labelled scope; never infer hidden rows from visible ones. */
function selectSessions(current, sessions) {
	const keys = new Set(current.keys);
	for (const session of sessions) keys.add(sessionKey(session.source, session.id));
	return {
		keys,
		anchor: null
	};
}
function removeSelection(current, key) {
	const keys = new Set(current.keys);
	keys.delete(key);
	return {
		keys,
		anchor: current.anchor === key ? null : current.anchor
	};
}
function selectedSessions(selection, sessions) {
	const unique = /* @__PURE__ */ new Map();
	for (const list of sessions.values()) for (const session of list) {
		const key = sessionKey(session.source, session.id);
		if (selection.keys.has(key)) unique.set(key, session);
	}
	return [...unique.values()];
}
//#endregion
//#region src/client/state/use-session-management.ts
function useSessionManagement(api, onDeleted, onMetadataChanged) {
	const managementApi = api;
	const [editing, setEditing] = (0, react.useState)(false);
	const [selection, setSelection] = (0, react.useState)(emptySelection);
	const [metadata, setMetadata] = (0, react.useState)(/* @__PURE__ */ new Map());
	const [groupFilter, setGroupFilter] = (0, react.useState)("");
	const [dialog, setDialog] = (0, react.useState)(null);
	const [busy, setBusy] = (0, react.useState)(false);
	const [failures, setFailures] = (0, react.useState)([]);
	const [metadataError, setMetadataError] = (0, react.useState)("");
	const [metadataLoading, setMetadataLoading] = (0, react.useState)(false);
	const [drafts, setDrafts] = (0, react.useState)(/* @__PURE__ */ new Map());
	const [suggestions, setSuggestions] = (0, react.useState)(/* @__PURE__ */ new Map());
	const [aiErrors, setAiErrors] = (0, react.useState)(/* @__PURE__ */ new Map());
	const [generating, setGenerating] = (0, react.useState)(false);
	const [progress, setProgress] = (0, react.useState)({
		done: 0,
		total: 0
	});
	const loaded = (0, react.useRef)(false);
	const pending = (0, react.useRef)(null);
	const lock = (0, react.useRef)(false);
	const controller = (0, react.useRef)(new AbortController());
	const generation = (0, react.useRef)(null);
	const currentDialog = (0, react.useRef)(null);
	const serial = (0, react.useRef)(0);
	(0, react.useEffect)(() => {
		const lifetime = new AbortController();
		controller.current = lifetime;
		return () => {
			lifetime.abort();
			generation.current?.abort();
			currentDialog.current = null;
		};
	}, []);
	function stopGeneration() {
		generation.current?.abort();
		generation.current = null;
		setGenerating(false);
	}
	function closeDialog() {
		if (lock.current) return;
		stopGeneration();
		currentDialog.current = null;
		setDialog(null);
	}
	function clearSelection() {
		setSelection(emptySelection());
		setFailures([]);
	}
	function deleted(session) {
		if (!controller.current.signal.aborted) setSelection((current) => removeSelection(current, sessionKey(session.source, session.id)));
		onDeleted(session);
	}
	async function ensureMetadata() {
		if (controller.current.signal.aborted) return false;
		if (loaded.current) return true;
		if (pending.current !== null) return pending.current;
		if (managementApi.metadata === void 0) {
			setMetadataError(t("management.unavailable"));
			return false;
		}
		const signal = controller.current.signal;
		setMetadataLoading(true);
		setMetadataError("");
		pending.current = (async () => {
			try {
				const result = await managementApi.metadata(signal);
				if (signal.aborted) return false;
				if (!result.ok) {
					setMetadataError(failureText(result));
					return false;
				}
				setMetadata((current) => {
					const next = new Map(result.value.entries.map((entry) => [sessionKey(entry.source, entry.id), { metadata: entry }]));
					for (const [key, value] of current) next.set(key, value);
					return next;
				});
				loaded.current = true;
				return true;
			} catch (error) {
				if (!signal.aborted) setMetadataError(error instanceof Error ? error.message : String(error));
				return false;
			} finally {
				if (!signal.aborted) setMetadataLoading(false);
				pending.current = null;
			}
		})();
		return pending.current;
	}
	function toggleEditing() {
		if (lock.current) return;
		setEditing(!editing);
		clearSelection();
		if (!editing) ensureMetadata();
	}
	function newDialog(kind, sessions, ai = false, skipped = 0) {
		if (lock.current || controller.current.signal.aborted) return null;
		stopGeneration();
		const target = {
			serial: ++serial.current,
			kind,
			sessions: [...sessions],
			ai,
			skipped
		};
		currentDialog.current = target;
		setFailures([]);
		setDrafts(/* @__PURE__ */ new Map());
		setSuggestions(/* @__PURE__ */ new Map());
		setAiErrors(/* @__PURE__ */ new Map());
		setProgress({
			done: 0,
			total: 0
		});
		setDialog(target);
		ensureMetadata();
		return target;
	}
	async function openDialog(kind, sessions) {
		if (sessions.length > 0) newDialog(kind, sessions);
	}
	async function generateTitles(sessions, target = currentDialog.current) {
		if (target === null || currentDialog.current !== target || controller.current.signal.aborted || target.kind !== "rename" || lock.current || generation.current !== null || sessions.length === 0) return;
		if (!window.confirm(t("management.aiConfirm", { count: sessions.length }))) return;
		const request = new AbortController();
		generation.current = request;
		setGenerating(true);
		setProgress({
			done: 0,
			total: sessions.length
		});
		const valid = () => !request.signal.aborted && !controller.current.signal.aborted && currentDialog.current === target;
		try {
			for (const session of sessions) {
				if (!valid()) break;
				const key = sessionKey(session.source, session.id);
				setAiErrors((current) => {
					const next = new Map(current);
					next.delete(key);
					return next;
				});
				try {
					if (managementApi.suggestTitle === void 0) throw new Error(t("management.aiUnavailable"));
					const result = await managementApi.suggestTitle(session.source, session.id, request.signal);
					if (!valid()) break;
					if (!result.ok) throw new Error(failureText(result));
					setSuggestions((current) => new Map(current).set(key, result.value));
					setDrafts((current) => new Map(current).set(key, result.value.title));
				} catch (error) {
					if (!valid()) break;
					setAiErrors((current) => new Map(current).set(key, error instanceof Error ? error.message : String(error)));
				}
				if (valid()) setProgress((current) => ({
					...current,
					done: current.done + 1
				}));
			}
		} finally {
			if (generation.current === request) {
				generation.current = null;
				if (!controller.current.signal.aborted) setGenerating(false);
			}
		}
	}
	async function openAiDialog(sessions, skipNamed = true) {
		if (sessions.length === 0) return;
		const eligible = sessions.filter((session) => !skipNamed || session.named !== true);
		const target = newDialog("rename", eligible, true, sessions.length - eligible.length);
		if (target !== null) await generateTitles(eligible, target);
	}
	function editDraft(key, title) {
		setDrafts((current) => new Map(current).set(key, title));
	}
	async function deleteSessions(sessions) {
		if (lock.current || controller.current.signal.aborted || sessions.length === 0 || !window.confirm(t("management.deleteConfirm", { count: sessions.length }))) return;
		stopGeneration();
		const signal = controller.current.signal;
		lock.current = true;
		setBusy(true);
		setFailures([]);
		try {
			const failed = await runSessionBatch(sessions, (session) => api.deleteSession(session.source, session.id), deleted, signal);
			if (!signal.aborted) setFailures(failed);
		} finally {
			if (!signal.aborted) setBusy(false);
			lock.current = false;
		}
	}
	async function save(names, group) {
		const target = currentDialog.current;
		if (lock.current || generation.current !== null || target === null || managementApi.updateMetadata === void 0 || controller.current.signal.aborted) return;
		const sessions = target.kind === "rename" ? target.sessions.filter((session) => names.has(sessionKey(session.source, session.id))) : target.sessions;
		if (sessions.length === 0) return;
		const signal = controller.current.signal;
		lock.current = true;
		setBusy(true);
		setFailures([]);
		try {
			const failed = await runSessionBatch(sessions, (session) => managementApi.updateMetadata({
				source: session.source,
				id: session.id,
				...target.kind === "rename" ? { title: names.get(sessionKey(session.source, session.id)) } : { group }
			}), (session, value) => {
				if (!signal.aborted) setMetadata((current) => new Map(current).set(sessionKey(session.source, session.id), value));
				onMetadataChanged?.(value);
			}, signal);
			if (signal.aborted) return;
			setFailures(failed);
			const failedKeys = new Set(failed.map(({ session }) => sessionKey(session.source, session.id)));
			const remaining = target.sessions.filter((session) => !names.has(sessionKey(session.source, session.id)) && target.kind === "rename" || failedKeys.has(sessionKey(session.source, session.id)));
			const next = remaining.length === 0 ? null : {
				...target,
				sessions: remaining
			};
			currentDialog.current = next;
			setDialog(next);
		} finally {
			if (!signal.aborted) setBusy(false);
			lock.current = false;
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
		groups: [...new Set([...metadata.values()].flatMap((value) => value.metadata.group ? [value.metadata.group] : []))].sort(),
		groupFilter,
		setGroupFilter: (value) => {
			setGroupFilter(value);
			clearSelection();
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
		stopGeneration
	};
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
			en: "Claude"
		}
	},
	codex: {
		brand: "#10A37F",
		text: "color-mix(in srgb, #10A37F 62%, white)",
		label: {
			zh: "Codex",
			en: "Codex"
		}
	},
	dsh: {
		brand: "#4D6BFE",
		text: "color-mix(in srgb, #4D6BFE 62%, white)",
		label: {
			zh: "DSH",
			en: "DSH"
		}
	}
};
/**
* The glyph for one source: sun, hexagon, waveform.
* @param props.source - which corpus.
* @param props.size - pixel size.
* @param props.tone - 'brand' paints the brand colour, 'inherit' follows text.
* @returns an inline SVG.
*/
function SourceIcon({ source, size = 12, tone = "brand" }) {
	const mark = SOURCE_MARKS[source];
	const color = tone === "brand" ? mark.brand : "currentColor";
	if (source === "claude") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		"aria-hidden": "true",
		focusable: "false",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
			stroke: color,
			strokeWidth: "1.6",
			strokeLinecap: "round",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 2.2v11.6M2.2 8h11.6M3.9 3.9l8.2 8.2M12.1 3.9l-8.2 8.2" })
		})
	});
	if (source === "codex") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		"aria-hidden": "true",
		focusable: "false",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
			d: "M8 1.8l5.4 3.1v6.2L8 14.2 2.6 11.1V4.9z",
			fill: "none",
			stroke: color,
			strokeWidth: "1.5",
			strokeLinejoin: "round"
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
			d: "M5.4 6.2L8 8.6l2.6-2.4M8 8.6v3.2",
			fill: "none",
			stroke: color,
			strokeWidth: "1.2",
			strokeLinecap: "round"
		})]
	});
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
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2.4 8h1.6M6.2 5v6M8.8 3v10M11.4 5.6v4.8M14 7h-1.2" })
		})
	});
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
	close: "M4 4l8 8M12 4l-8 8"
};
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
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: GLYPHS[name] })
	});
}
/**
* The product mark: a magnifier over three context lines, on an accent tile.
* @param props.size - tile edge in pixels.
* @returns the mark.
*/
function BrandMark({ size = 24 }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		className: "inline-grid shrink-0 place-items-center rounded-[7px] bg-[color-mix(in_oklch,var(--color-accent)_16%,transparent)] text-accent",
		style: {
			inlineSize: size,
			blockSize: size
		},
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size * .62,
			height: size * .62,
			viewBox: "0 0 16 16",
			fill: "none",
			stroke: "currentColor",
			strokeLinecap: "round",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "6.7",
					cy: "6.7",
					r: "4.2",
					strokeWidth: "1.5"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M9.9 9.9 13.6 13.6",
					strokeWidth: "1.7"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M4.9 5.3h3.4M4.9 7.1h2.4M4.9 8.9h1.4",
					strokeWidth: "1.2"
				})
			]
		})
	});
}
//#endregion
//#region src/client/ui/session-management.tsx
function ManagementControls({ state, visible }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-1.5",
		children: [
			state.editing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-1",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ci-btn ci-btn--quiet active:bg-hover",
					disabled: state.busy,
					onClick: visible,
					children: t("management.selectVisible")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ci-btn ci-btn--quiet active:bg-hover",
					disabled: state.busy,
					onClick: state.clearSelection,
					children: t("management.clear")
				})]
			}) : null,
			state.editing || state.groupFilter !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
				"aria-label": t("management.groupFilter"),
				className: "min-w-0 rounded border border-line bg-bg px-2 py-1 text-[12px] text-fg focus-visible:outline-2 focus-visible:outline-accent",
				value: state.groupFilter,
				disabled: state.busy || state.metadataLoading,
				onChange: (event) => state.setGroupFilter(event.currentTarget.value),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: "",
						children: t("management.allGroups")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: "ungrouped",
						children: t("management.ungrouped")
					}),
					state.groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: `group:${group}`,
						children: group
					}, group))
				]
			}) : null,
			state.metadataLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				className: "m-0 text-[11px] text-fg-dim",
				children: t("management.loading")
			}) : null,
			state.metadataError !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "alert",
				className: "text-[11px] text-err",
				children: [state.metadataError, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ci-btn ci-btn--quiet active:bg-hover",
					onClick: () => void state.ensureMetadata(),
					children: t("management.retry")
				})]
			}) : null
		]
	});
}
function SessionManagement({ state, selected }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [state.editing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
		className: "flex shrink-0 flex-col gap-2 border-bs border-line bg-bg-1 p-3",
		"aria-label": t("sessions.actions"),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				role: "status",
				className: "text-[12px] tabular-nums",
				children: t("management.selected", { count: selected.length })
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-1",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ci-btn active:bg-hover",
						disabled: state.busy || selected.length === 0,
						onClick: () => void state.openDialog("rename", selected),
						children: t("management.rename")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ci-btn active:bg-hover",
						disabled: state.busy || state.generating || selected.length === 0,
						onClick: () => void state.openAiDialog(selected),
						children: t("management.aiRename")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ci-btn active:bg-hover",
						disabled: state.busy || selected.length === 0,
						onClick: () => void state.openDialog("group", selected),
						children: t("management.move")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ci-btn text-err active:bg-hover",
						disabled: state.busy || selected.length === 0,
						onClick: () => void state.deleteSessions(selected),
						children: t(state.busy ? "management.saving" : "management.delete")
					})
				]
			}),
			state.dialog === null && state.failures.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "max-bs-32 overflow-y-auto",
				role: "alert",
				children: [state.failures.map(({ session, reason }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "m-0 text-[11px] text-err",
					children: t("management.failure", {
						title: session.title,
						reason
					})
				}, sessionKey(session.source, session.id))), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ci-btn active:bg-hover",
					disabled: state.busy,
					onClick: () => void state.deleteSessions(state.failures.map((failure) => failure.session)),
					children: t("management.retry")
				})]
			}) : null
		]
	}) : null, state.dialog !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetadataDialog, { state }, state.dialog.serial) : null] });
}
function MetadataDialog({ state }) {
	const target = state.dialog;
	const ref = (0, react.useRef)(null);
	const titleId = (0, react.useId)();
	const groupsId = (0, react.useId)();
	const [restored, setRestored] = (0, react.useState)(/* @__PURE__ */ new Set());
	const [group, setGroup] = (0, react.useState)("");
	const [ungroup, setUngroup] = (0, react.useState)(false);
	(0, react.useEffect)(() => {
		const dialog = ref.current;
		dialog?.showModal();
		dialog?.querySelector("input:not(:disabled)")?.focus();
		return () => dialog?.close();
	}, []);
	if (target === null) return null;
	const renaming = target.kind === "rename";
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dialog", {
		ref,
		"aria-labelledby": titleId,
		className: "ci-panel max-bs-[80dvh] rounded-xl border border-line bg-bg-1 p-0 text-fg shadow-lg backdrop:bg-black/40",
		style: { inlineSize: "min(34rem, calc(100% - 2rem))" },
		onCancel: (event) => {
			event.preventDefault();
			state.closeDialog();
		},
		onClick: (event) => {
			if (event.target !== event.currentTarget) return;
			const bounds = event.currentTarget.getBoundingClientRect();
			if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) state.closeDialog();
		},
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
			className: "max-bs-[80dvh] flex flex-col",
			onSubmit: (event) => {
				event.preventDefault();
				const values = /* @__PURE__ */ new Map();
				for (const session of target.sessions) {
					const key = sessionKey(session.source, session.id);
					if (restored.has(key)) values.set(key, null);
					else if (state.drafts.has(key)) values.set(key, state.drafts.get(key)?.trim() ?? null);
					else if (!target.ai && !state.aiErrors.has(key) && !state.suggestions.has(key) && state.progress.total === 0) values.set(key, session.title);
				}
				state.save(values, ungroup ? null : group.trim());
			},
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", {
					id: titleId,
					className: "m-0 shrink-0 p-4 text-[15px] font-semibold",
					children: [
						t(renaming ? "management.rename" : "management.move"),
						" · ",
						target.sessions.length
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ci-scroll min-bs-0 flex-1 overflow-y-auto overscroll-contain px-4",
					children: [
						target.ai || state.progress.total > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1 text-[11px] text-fg-dim",
							role: "status",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "m-0",
									children: t("management.aiHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "m-0",
									children: t("management.aiSkipped", { count: target.skipped })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "m-0",
									children: t("management.aiProgress", state.progress)
								}),
								state.generating ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "ci-btn active:bg-hover",
									onClick: state.stopGeneration,
									children: t("management.aiStop")
								}) : null
							]
						}) : null,
						renaming ? target.sessions.map((session) => {
							const key = sessionKey(session.source, session.id);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "mbs-2 flex flex-col gap-1 text-[12px]",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "break-words",
										children: session.title
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "text-[10px] break-all text-fg-dim",
										children: [
											session.source,
											" · ",
											session.workdir,
											" · ",
											session.id
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										"aria-label": t("management.name", { title: session.title }),
										className: "min-w-0 rounded border border-line bg-bg px-2 py-1.5 text-fg focus-visible:outline-2 focus-visible:outline-accent",
										value: state.drafts.get(key) ?? session.title,
										maxLength: 80,
										disabled: state.busy || state.generating || restored.has(key),
										required: !restored.has(key),
										onChange: (event) => state.editDraft(key, event.currentTarget.value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "ci-btn active:bg-hover",
										disabled: state.busy || state.generating || restored.has(key),
										onClick: () => void state.generateTitles([session]),
										children: t(state.aiErrors.has(key) ? "management.retry" : "management.aiSuggest")
									}),
									state.suggestions.has(key) ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "text-[10px] text-fg-dim",
										title: `${state.suggestions.get(key).provider} · ${state.suggestions.get(key).model}`,
										children: [
											state.suggestions.get(key).provider,
											" · ",
											state.suggestions.get(key).model
										]
									}) : null,
									state.aiErrors.has(key) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										role: "alert",
										className: "text-[11px] text-err",
										children: state.aiErrors.get(key)
									}) : null,
									(target.ai || state.progress.total > 0) && !state.drafts.has(key) && !restored.has(key) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "text-[11px] text-fg-dim",
										children: t("management.aiPending")
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "flex items-center gap-1",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: restored.has(key),
											disabled: state.busy || state.generating,
											onChange: (event) => {
												const next = new Set(restored);
												if (event.currentTarget.checked) next.add(key);
												else next.delete(key);
												setRestored(next);
											}
										}), t("management.restore")]
									})
								]
							}, key);
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-2 text-[12px]",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "m-0 text-fg-dim",
									children: t("management.groupHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "flex flex-col gap-1",
									children: [t("management.group"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "rounded border border-line bg-bg px-2 py-1.5 text-fg focus-visible:outline-2 focus-visible:outline-accent",
										list: groupsId,
										maxLength: 80,
										value: group,
										disabled: state.busy || ungroup,
										required: !ungroup,
										onChange: (event) => setGroup(event.currentTarget.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
									id: groupsId,
									children: state.groups.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: name }, name))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "flex items-center gap-1",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: ungroup,
										disabled: state.busy,
										onChange: (event) => setUngroup(event.currentTarget.checked)
									}), t("management.ungroup")]
								}),
								target.sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: "m-0 break-words text-fg-dim",
									children: [
										session.title,
										" · ",
										session.workdir
									]
								}, sessionKey(session.source, session.id)))
							]
						}),
						state.failures.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "alert",
							className: "mbs-2 text-[11px] text-err",
							children: state.failures.map(({ session, reason }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("management.failure", {
								title: session.title,
								reason
							}) }, sessionKey(session.source, session.id)))
						}) : null
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 justify-end gap-2 p-4",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ci-btn active:bg-hover",
						disabled: state.busy,
						onClick: state.closeDialog,
						children: t("management.cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "submit",
						className: "ci-btn active:bg-hover",
						disabled: state.busy || state.generating || target.sessions.length === 0 || (target.ai || state.progress.total > 0) && !target.sessions.some((session) => restored.has(sessionKey(session.source, session.id)) || state.drafts.has(sessionKey(session.source, session.id))) || state.metadataLoading || state.metadataError !== "" || !renaming && !ungroup && group.trim() === "" || renaming && target.sessions.some((session) => {
							const key = sessionKey(session.source, session.id);
							return !restored.has(key) && (state.drafts.get(key) ?? session.title).trim() === "";
						}),
						children: t(state.busy ? "management.saving" : state.failures.length > 0 ? "management.retry" : "management.save")
					})]
				})
			]
		})
	});
}
//#endregion
//#region src/client/ui/session-row.tsx
/** A session row, hung under its project by a guide line. */
function SessionRow({ row, index, onOpen, onFocus, api, onDeleted, editing = false, checked = false, busy = false, onCheck, onRename, onAiRename, onMove }) {
	const trigger = (0, react.useRef)(null);
	const menu = (0, react.useRef)(null);
	const [menuOpen, setMenuOpen] = (0, react.useState)(false);
	const [deleting, setDeleting] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)("");
	(0, react.useEffect)(() => {
		if (!menuOpen) return;
		const popup = menu.current;
		if (popup === null) return;
		const doc = popup.ownerDocument;
		function dismiss(event) {
			if (!event.composedPath().includes(popup)) {
				popup?.hidePopover();
				setMenuOpen(false);
			}
		}
		function escape(event) {
			if (event.key === "Escape") closeMenu();
		}
		function hide() {
			popup?.hidePopover();
			setMenuOpen(false);
		}
		doc.addEventListener("pointerdown", dismiss, true);
		doc.addEventListener("keydown", escape, true);
		doc.addEventListener("scroll", hide, true);
		doc.defaultView?.addEventListener("blur", hide);
		return () => {
			doc.removeEventListener("pointerdown", dismiss, true);
			doc.removeEventListener("keydown", escape, true);
			doc.removeEventListener("scroll", hide, true);
			doc.defaultView?.removeEventListener("blur", hide);
		};
	}, [menuOpen]);
	function closeMenu() {
		menu.current?.hidePopover();
		setMenuOpen(false);
		trigger.current?.focus({ preventScroll: true });
	}
	function openMenu(x, y) {
		const popup = menu.current;
		if (popup === null || deleting) return;
		for (const other of popup.ownerDocument.querySelectorAll("[data-session-menu]:popover-open")) if (other !== popup) other.hidePopover();
		popup.showPopover();
		setMenuOpen(true);
		const bounds = popup.getBoundingClientRect();
		const view = popup.ownerDocument.defaultView;
		popup.style.insetInlineStart = `${Math.max(8, Math.min(x, (view?.innerWidth ?? bounds.right) - bounds.width - 8))}px`;
		popup.style.insetBlockStart = `${Math.max(8, Math.min(y, (view?.innerHeight ?? bounds.bottom) - bounds.height - 8))}px`;
		popup.querySelector("button")?.focus({ preventScroll: true });
	}
	async function remove() {
		closeMenu();
		if (deleting || !window.confirm(t("sessions.deleteConfirm", { title: row.session.title }))) return;
		setDeleting(true);
		setError("");
		const result = await api.deleteSession(row.session.source, row.session.id);
		setDeleting(false);
		if (result.ok) onDeleted(row.session);
		else setError(result.detail === "shared-session-logs" ? t("sessions.deleteShared") : t("sessions.deleteFailed", { detail: failureText(result) }));
	}
	const mark = SOURCE_MARKS[row.session.source];
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "ms-3.25 border-s border-line-soft ps-1.5",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1",
				children: [editing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					"aria-label": t("management.name", { title: row.session.title }),
					checked,
					disabled: busy || deleting,
					onChange: () => {},
					onClick: (event) => {
						event.stopPropagation();
						onCheck?.(event.shiftKey);
					},
					onKeyDown: (event) => {
						if (event.key === " ") event.stopPropagation();
					},
					className: "ms-1 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-accent"
				}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					ref: trigger,
					type: "button",
					"aria-haspopup": "menu",
					"aria-expanded": menuOpen,
					"aria-busy": deleting,
					disabled: deleting || busy,
					onContextMenu: (event) => {
						event.preventDefault();
						event.stopPropagation();
						openMenu(event.clientX, event.clientY);
					},
					onKeyDown: (event) => {
						if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
						event.preventDefault();
						event.stopPropagation();
						const bounds = event.currentTarget.getBoundingClientRect();
						openMenu(bounds.left, bounds.bottom);
					},
					className: "ci-row min-w-0 flex-1 px-2 py-1.5 active:bg-hover",
					"data-key": row.key,
					"data-selected": row.selected,
					"data-focus": index,
					"aria-current": row.selected,
					onClick: (event) => editing ? onCheck?.(event.shiftKey) : onOpen(),
					onFocus,
					title: row.session.title,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "flex min-w-0 items-center gap-1.5",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "inline-flex w-3.5 shrink-0 justify-center",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
								source: row.session.source,
								size: 12
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "min-w-0 flex-1 truncate text-[12.5px]",
							children: row.session.title
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 flex min-w-0 items-center gap-1.5 ps-5 text-[10.5px] text-fg-3 tabular-nums",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: { color: mark.text },
								className: "ci-src__word",
								children: mark.label.zh
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								children: "·"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatShortTime(row.session.updatedAt) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								children: "·"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatBytes(row.session.bytes) })
						]
					})]
				})]
			}),
			error === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "m-0 px-2 py-1 text-[11px] text-err",
				children: error
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
					event.stopPropagation();
					if (event.key === "Escape" || event.key === "Tab") {
						if (event.key === "Escape") event.preventDefault();
						closeMenu();
					} else if ([
						"ArrowDown",
						"ArrowUp",
						"Home",
						"End"
					].includes(event.key)) {
						event.preventDefault();
						const items = [...event.currentTarget.querySelectorAll("button")];
						const current = items.indexOf(event.currentTarget.ownerDocument.activeElement);
						items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
					}
				},
				children: [
					onRename ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "menuitem",
						className: "ci-btn ci-btn--quiet w-full justify-start active:bg-hover",
						onClick: () => {
							closeMenu();
							onRename();
						},
						children: t("management.rename")
					}) : null,
					onAiRename ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "menuitem",
						className: "ci-btn ci-btn--quiet w-full justify-start active:bg-hover",
						disabled: busy || deleting,
						onClick: () => {
							closeMenu();
							onAiRename();
						},
						children: t("management.aiRename")
					}) : null,
					onMove ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "menuitem",
						className: "ci-btn ci-btn--quiet w-full justify-start active:bg-hover",
						onClick: () => {
							closeMenu();
							onMove();
						},
						children: t("management.move")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						role: "menuitem",
						className: "flex w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 py-1.5 text-err hover:bg-hover focus:bg-hover",
						onClick: () => void remove(),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
							name: "trash",
							size: 14
						}), t("sessions.delete")]
					})
				]
			})
		]
	});
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
		return typeof window === "undefined" ? void 0 : window.localStorage;
	} catch {
		return;
	}
}
function treeSessions(sessions) {
	return sessions.map((summary) => ({
		...summary,
		title: summary.title ?? summary.firstInput ?? t("sessions.untitled"),
		named: (summary.title?.trim().length ?? 0) > 0
	}));
}
function cachedSessions() {
	return new Map([...clientListCache().sessions].map(([workdir, value]) => [workdir, treeSessions(value.sessions)]));
}
/** One source count: glyph plus number, tinted by the source's brand. */
function SourceCount({ source, count }) {
	const mark = SOURCE_MARKS[source];
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: "ci-src",
		style: {
			["--ci-src-color"]: mark.text,
			["--ci-src-brand"]: mark.brand
		},
		title: `${mark.label.zh} · ${t("sources.sessions", { count })}`,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
			source,
			size: 10
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: String(count) })]
	});
}
/** A project row. */
function ProjectRow({ row, index, onToggle, onFocus }) {
	const project = row.project;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
		type: "button",
		className: "ci-row px-2 py-1.5",
		"data-focus": index,
		"aria-expanded": row.expanded,
		onClick: onToggle,
		onFocus,
		title: project.workdir,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
			className: "flex min-w-0 items-center gap-1.5",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
					name: "chevron",
					size: 11,
					className: "ci-chevron shrink-0 text-fg-3"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
					name: "folder",
					size: 14,
					className: row.expanded ? "shrink-0 text-accent" : "shrink-0 text-fg-dim"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "min-w-0 flex-1 truncate text-[12.5px] font-semibold",
					children: project.leaf
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "shrink-0 text-[10.5px] text-fg-3 tabular-nums",
					children: formatShortTime(project.lastUpdatedAt)
				})
			]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
			className: "mt-1 flex min-w-0 items-center gap-1.5 ps-9.25",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "min-w-0 flex-1 truncate font-mono text-[10.5px] text-fg-3",
				children: project.parent === "" ? "" : tildePath(project.parent)
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "flex shrink-0 items-center gap-1",
				children: project.counts.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceCount, {
					source: group.source,
					count: group.sessions
				}, group.source))
			})]
		})]
	});
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
	const cache = clientListCache();
	const deletion = (0, react.useSyncExternalStore)(cache.subscribe, cache.deletionVersion, cache.deletionVersion);
	const allProjects = (0, react.useMemo)(() => buildProjects(workdirs, splitPath), [workdirs]);
	const [query, setQuery] = (0, react.useState)("");
	const projects = (0, react.useMemo)(() => filterProjects(allProjects, query), [allProjects, query]);
	const [expanded, setExpanded] = (0, react.useState)(() => {
		const saved = new Set(readExpanded(storageOf()));
		const first = selected?.workdir ?? workdirs[0]?.workdir;
		return saved.size > 0 || first === void 0 ? saved : /* @__PURE__ */ new Set([first]);
	});
	const [sessions, setSessions] = (0, react.useState)(cachedSessions);
	const management = useSessionManagement(api, (deleted) => {
		setSessions((current) => new Map([...current].map(([workdir, list]) => [workdir, list.filter((session) => sessionKey(session.source, session.id) !== sessionKey(deleted.source, deleted.id))])));
		onDeleted(deleted);
	}, onMetadataChanged);
	const displaySessions = applySessionMetadata(sessions, management.metadata, management.groupFilter);
	const chosen = selectedSessions(management.selection, applySessionMetadata(sessions, management.metadata, ""));
	const [loadingWorkdirs, setLoadingWorkdirs] = (0, react.useState)(() => /* @__PURE__ */ new Set());
	const [limits, setLimits] = (0, react.useState)(() => /* @__PURE__ */ new Map());
	const [focus, setFocus] = (0, react.useState)(-1);
	const navRef = (0, react.useRef)(null);
	const requested = (0, react.useRef)(/* @__PURE__ */ new Set());
	const generation = (0, react.useRef)(revision);
	const controller = (0, react.useRef)(new AbortController());
	const timers = (0, react.useRef)(/* @__PURE__ */ new Map());
	const visited = (0, react.useRef)(/* @__PURE__ */ new Set());
	const visible = (0, react.useRef)(expanded);
	visible.current = expanded;
	(0, react.useEffect)(() => setSessions(cachedSessions()), [deletion]);
	(0, react.useEffect)(() => {
		generation.current = revision;
		controller.current = new AbortController();
		requested.current.clear();
		visited.current.clear();
		setLoadingWorkdirs(/* @__PURE__ */ new Set());
		return () => {
			controller.current.abort();
			for (const timer of timers.current.values()) clearTimeout(timer);
			timers.current.clear();
		};
	}, [revision]);
	(0, react.useEffect)(() => {
		if (projects.length === 0) return;
		setExpanded((current) => {
			if (current.size > 0) return current;
			const target = selected?.workdir ?? projects[0]?.workdir;
			return target === void 0 ? current : /* @__PURE__ */ new Set([target]);
		});
	}, [projects, selected]);
	const load = (0, react.useCallback)(async (workdir) => {
		if (requested.current.has(workdir)) return;
		requested.current.add(workdir);
		clearTimeout(timers.current.get(workdir));
		timers.current.delete(workdir);
		const signal = controller.current.signal;
		if (!clientListCache().sessions.has(workdir)) setLoadingWorkdirs((current) => new Set(current).add(workdir));
		const result = await api.sessions(workdir, signal);
		if (signal.aborted || generation.current !== revision) return;
		requested.current.delete(workdir);
		setLoadingWorkdirs((current) => {
			const next = new Set(current);
			next.delete(workdir);
			return next;
		});
		if (!result.ok) {
			if (result.error === "aborted") return;
			setSessions((current) => current.has(workdir) ? current : new Map(current).set(workdir, []));
			return;
		}
		setSessions((current) => new Map(current).set(workdir, treeSessions(result.value.sessions)));
		if (result.value.refreshing) {
			const timer = setTimeout(() => {
				timers.current.delete(workdir);
				if (!signal.aborted && visible.current.has(workdir)) load(workdir);
			}, 500);
			timers.current.set(workdir, timer);
		}
	}, [api, revision]);
	(0, react.useEffect)(() => {
		const known = new Set(workdirs.map((row) => row.workdir));
		for (const workdir of visited.current) {
			if (expanded.has(workdir) && known.has(workdir)) continue;
			visited.current.delete(workdir);
			clearTimeout(timers.current.get(workdir));
			timers.current.delete(workdir);
		}
		for (const workdir of expanded) {
			if (!known.has(workdir) || visited.current.has(workdir)) continue;
			visited.current.add(workdir);
			load(workdir);
		}
	}, [
		expanded,
		load,
		workdirs
	]);
	const rows = flattenTree({
		projects,
		sessions: displaySessions,
		loading: loadingWorkdirs,
		expanded,
		selected: selected === null ? null : sessionKey(selected.source, selected.id),
		limits
	});
	function toggle(workdir) {
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(workdir)) next.delete(workdir);
			else next.add(workdir);
			writeExpanded(storageOf(), [...next]);
			return next;
		});
	}
	function openRow(row, shift = false) {
		if (row === void 0) return;
		if (row.kind === "project") {
			toggle(row.project.workdir);
			return;
		}
		if (row.kind === "more") {
			setLimits((current) => new Map(current).set(row.workdir, Number.MAX_SAFE_INTEGER));
			return;
		}
		if (row.kind === "session") {
			if (management.editing) {
				if (!management.busy) management.setSelection((current) => toggleSelection(current, row.key, visibleSessions(rows), shift));
				return;
			}
			onSelect({
				source: row.session.source,
				id: row.session.id,
				workdir: row.workdir
			});
		}
	}
	function onKeyDown(event) {
		const row = rows[focus];
		if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
			event.preventDefault();
			const next = nextIndex(rows, focus, event.key);
			setFocus(next);
			navRef.current?.querySelector(`[data-focus="${String(next)}"]`)?.focus();
			return;
		}
		if (event.key === "ArrowRight") {
			if (row?.kind === "project" && !row.expanded) {
				event.preventDefault();
				toggle(row.project.workdir);
			}
			return;
		}
		if (event.key === "ArrowLeft") {
			if (row?.kind === "project" && row.expanded) {
				event.preventDefault();
				toggle(row.project.workdir);
			} else if (row?.kind === "session" || row?.kind === "more" || row?.kind === "skeleton") {
				event.preventDefault();
				toggle(row.kind === "session" ? row.workdir : row.workdir);
			}
			return;
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			openRow(row, event.shiftKey);
		}
	}
	if (loading && allProjects.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("nav", {
		className: "ci-scroll h-full overflow-y-auto",
		"aria-label": t("workdirs.title"),
		"aria-busy": "true",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeSkeleton, { label: t("tree.loadingIndex") })
	});
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
								className: "rounded-full bg-bg-2 px-1.5 text-[10.5px] leading-4.25 font-medium text-fg-dim tabular-nums",
								children: query.trim() === "" ? allProjects.length : `${String(projects.length)} / ${String(allProjects.length)}`
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ci-btn ci-btn--quiet ms-auto active:bg-hover",
								disabled: management.busy,
								onClick: management.toggleEditing,
								children: t(management.editing ? "management.done" : "management.edit")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagementControls, {
						state: management,
						visible: () => management.setSelection((current) => selectSessions(current, visibleSessions(rows)))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "flex h-7 items-center gap-1.5 rounded-[7px] border border-line-soft bg-bg px-2 text-fg-3 focus-within:border-accent",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
							name: "search",
							size: 12
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-fg outline-none placeholder:text-fg-3",
							value: query,
							onChange: (event) => {
								setQuery(event.currentTarget.value);
								management.clearSelection();
							},
							onKeyDown: (event) => {
								if (event.key === "Escape") {
									setQuery("");
									management.clearSelection();
								}
							},
							placeholder: t("tree.filter"),
							"aria-label": t("tree.filter"),
							type: "search"
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ci-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3",
				ref: navRef,
				onKeyDown,
				role: "tree",
				children: [projects.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "m-0 px-2 py-3 text-[12px] leading-relaxed text-fg-dim",
					children: allProjects.length === 0 ? t("tree.emptyAll") : t("tree.noMatch", { query: query.trim() })
				}) : null, rows.map((row, index) => {
					if (row.kind === "project") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "mt-1 first:mt-0",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectRow, {
							row,
							index,
							onToggle: () => toggle(row.project.workdir),
							onFocus: () => setFocus(index)
						}), management.editing && displaySessions.has(row.project.workdir) && !loadingWorkdirs.has(row.project.workdir) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ci-btn ci-btn--quiet ms-3 active:bg-hover",
							disabled: management.busy,
							onClick: () => management.setSelection((current) => selectSessions(current, displaySessions.get(row.project.workdir) ?? [])),
							children: t("management.selectDirectory", { count: displaySessions.get(row.project.workdir)?.length ?? 0 })
						}) : null]
					}, row.key);
					if (row.kind === "skeleton") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ms-3.25 flex flex-col gap-1 border-s border-line-soft py-1 ps-2.5",
						children: Array.from({ length: row.rows }, (_, order) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "h-8 rounded-lg bg-[linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))] bg-size-[200%_100%] motion-safe:animate-[ci-skel_1.4s_var(--ease-in-out)_infinite]" }, row.key + String(order)))
					}, row.key);
					if (row.kind === "more") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ms-3.25 border-s border-line-soft py-0.5 ps-1.5",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ci-btn ci-btn--quiet h-7 w-full justify-start",
							"data-focus": index,
							onClick: () => openRow(row),
							onFocus: () => setFocus(index),
							children: t("tree.showAll", { count: row.hidden + 20 })
						})
					}, row.key);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
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
						onFocus: () => setFocus(index)
					}, row.key);
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionManagement, {
				state: management,
				selected: chosen
			})
		]
	});
}
/**
* Compose a session's label from its metadata.
* @param row - a list row, a search hit, or a session header.
* @returns the label lines.
*/
function sessionLabel(row) {
	const title = row.title?.trim();
	if (title !== void 0 && title !== "") return { title };
	const first = row.firstInput?.trim();
	if (first !== void 0 && first !== "") return {
		title: t("session.untitled"),
		detail: clip(first, 60)
	};
	return { title: t("session.untitled") };
}
/** Hits requested per scan. */
const SEARCH_LIMIT = 30;
/**
* Wrap occurrences of the query in a highlight element.
* @param text - snippet text.
* @param query - the raw query.
* @returns nodes with the matches marked.
*/
function highlight(text, query) {
	const needle = query.trim().toLowerCase();
	if (needle === "") return [text];
	const nodes = [];
	const lower = text.toLowerCase();
	let cursor = 0;
	let index = lower.indexOf(needle);
	while (index >= 0) {
		if (index > cursor) nodes.push(text.slice(cursor, index));
		nodes.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("mark", {
			className: "rounded-xs bg-[color-mix(in_oklch,var(--color-accent)_35%,transparent)] px-px text-fg",
			children: text.slice(index, index + needle.length)
		}, `m-${String(index)}`));
		cursor = index + needle.length;
		index = lower.indexOf(needle, cursor);
	}
	if (cursor < text.length) nodes.push(text.slice(cursor));
	return nodes;
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
	const label = sessionLabel(hit);
	const parts = splitPath(hit.workdir);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
		type: "button",
		className: "my-px flex w-full cursor-pointer flex-col gap-1 rounded-md border-0 px-2 py-2.5 text-left font-[inherit] text-inherit hover:bg-bg-2 data-[active=true]:bg-bg-2",
		"data-active": active,
		onClick: onOpen,
		onMouseEnter: onHover,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "flex w-full min-w-0 items-center gap-3",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
						source: hit.source,
						size: 12
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "min-w-0 flex-1 truncate text-[13px] font-medium text-fg",
						children: highlight(label.title, query)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "max-w-[40%] truncate text-[10px] text-fg-dim",
						title: hit.workdir,
						children: [parts.leaf === "" ? hit.workdir : parts.leaf, hit.turnIndex === 0 ? "" : ` · ${t("turns.selected", { index: hit.turnIndex })}`]
					})
				]
			}),
			label.detail === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "truncate text-[10.5px] text-fg-dim",
				children: label.detail
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "line-clamp-2 text-[11px] leading-normal text-fg-dim",
				children: highlight(hit.snippet, query)
			})
		]
	}) });
}
/**
* The palette.
* @param props.api - client API.
* @param props.onClose - close request (Esc, backdrop, after a jump).
* @param props.onOpenTurn - open one hit's turn.
* @returns the dialog.
*/
function SearchPalette({ api, onClose, onOpenTurn }) {
	const inputId = (0, react.useId)();
	const inputRef = (0, react.useRef)(null);
	const [query, setQuery] = (0, react.useState)("");
	const [tier, setTier] = (0, react.useState)("fast");
	const [cursor, setCursor] = (0, react.useState)(0);
	const [state, setState] = (0, react.useState)({ kind: "idle" });
	const [active, setActive] = (0, react.useState)(-1);
	const [continuing, setContinuing] = (0, react.useState)(false);
	(0, react.useEffect)(() => {
		inputRef.current?.focus();
	}, []);
	(0, react.useEffect)(() => {
		const trimmed = query.trim();
		if (trimmed === "") {
			setState({ kind: "idle" });
			return;
		}
		const controller = new AbortController();
		const continuingPage = tier === "deep" && cursor > 0;
		if (continuingPage) setContinuing(true);
		const timer = window.setTimeout(() => {
			if (!continuingPage) setState({ kind: "loading" });
			api.search(trimmed, SEARCH_LIMIT, tier, cursor, controller.signal).then((result) => {
				if (controller.signal.aborted) return;
				setContinuing(false);
				if (!result.ok) {
					setState({
						kind: "failed",
						failure: result
					});
					return;
				}
				setState((current) => {
					const previous = continuingPage && current.kind === "ready" ? current.hits : [];
					const seen = new Set(previous.map((hit) => `${hit.sessionId}:${String(hit.turnIndex)}`));
					const merged = [...previous, ...result.value.hits.filter((hit) => !seen.has(`${hit.sessionId}:${String(hit.turnIndex)}`))];
					return {
						kind: "ready",
						value: result.value,
						hits: merged
					};
				});
				if (!continuingPage) setActive(-1);
			});
		}, continuingPage ? 0 : 250);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [
		api,
		query,
		tier,
		cursor
	]);
	const hits = state.kind === "ready" ? state.hits : [];
	const grouped = (0, react.useMemo)(() => {
		const groups = /* @__PURE__ */ new Map();
		hits.forEach((hit, index) => {
			const list = groups.get(hit.source);
			if (list === void 0) groups.set(hit.source, [{
				hit,
				index
			}]);
			else list.push({
				hit,
				index
			});
		});
		return CONTEXT_SOURCES.filter((source) => groups.has(source)).map((source) => ({
			source,
			rows: groups.get(source) ?? []
		}));
	}, [hits]);
	function open(hit) {
		onOpenTurn({
			source: hit.source,
			sessionId: hit.sessionId,
			workdir: hit.workdir,
			turnIndex: hit.turnIndex
		});
	}
	function escalate() {
		setCursor(0);
		setTier("deep");
	}
	function onKeyDown(event) {
		if (event.key === "Escape") {
			event.preventDefault();
			onClose();
			return;
		}
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActive((current) => Math.min(hits.length - 1, current + 1));
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((current) => Math.max(-1, current - 1));
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const hit = active >= 0 ? hits[active] : void 0;
			if (hit !== void 0) open(hit);
			else if (tier === "fast") escalate();
			else if (state.kind === "ready" && state.value.truncated) setCursor(state.value.nextCursor ?? 0);
		}
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-60 flex items-start justify-center bg-[rgb(0_0_0/55%)] pt-[12vh]",
		onMouseDown: (event) => event.target === event.currentTarget && onClose(),
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "grid max-h-[70vh] w-[min(720px,92vw)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border-[0.5px] border-line bg-bg-1 shadow-[0_18px_48px_rgb(0_0_0/50%)]",
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
							children: t("search.title")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							id: inputId,
							ref: inputRef,
							className: "min-w-0 flex-1 rounded-md border-[0.5px] border-line bg-bg px-2 py-1.5 text-[13px] text-fg focus-visible:outline-2 focus-visible:outline-accent",
							type: "search",
							autoComplete: "off",
							spellCheck: false,
							placeholder: t("search.placeholder"),
							value: query,
							onChange: (event) => {
								setCursor(0);
								setTier("fast");
								setQuery(event.target.value);
							},
							"aria-describedby": `${inputId}-hint`
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "rounded-full border-[0.5px] border-line px-2 py-px text-[10px] whitespace-nowrap text-fg-dim",
							role: "status",
							children: tier === "deep" ? t("search.tier.deep") : t("search.tier.fast")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50",
							onClick: onClose,
							children: "Esc"
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "min-h-0 overflow-y-auto px-2 pt-1.5 pb-2.5",
					role: "listbox",
					"aria-label": t("search.title"),
					children: [
						state.kind === "idle" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "mx-1.5 my-2.5 text-[11px] text-fg-dim",
							id: `${inputId}-hint`,
							children: t("search.hint")
						}) : null,
						state.kind === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "mx-1.5 my-2.5 text-[11px] text-fg-dim",
							children: t("search.scanning")
						}) : null,
						state.kind === "failed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "mx-1.5 my-2.5 text-[11px] text-err",
							children: t("session.error", { detail: state.failure.detail ?? state.failure.error })
						}) : null,
						state.kind === "ready" && hits.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "mx-1.5 my-2.5 text-[11px] text-fg-dim",
							children: t("search.empty")
						}) : null,
						grouped.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "mt-2",
							"aria-label": group.source,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
								className: "m-0 mb-1 flex items-center gap-2 px-2 py-1 text-[11px] font-medium text-fg-dim",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
										source: group.source,
										size: 12
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: SOURCE_MARKS[group.source].label.zh }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "tabular-nums",
										children: group.rows.length
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "m-0 list-none p-0",
								children: group.rows.map(({ hit, index }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HitRow, {
									hit,
									query,
									active: index === active,
									onOpen: () => open(hit),
									onHover: () => setActive(index)
								}, `${hit.source}-${hit.sessionId}-${String(hit.turnIndex)}-${String(index)}`))
							})]
						}, group.source))
					]
				}),
				state.kind === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
					className: "flex items-center gap-3 border-t-[0.5px] border-line px-3 py-2 text-[10.5px] text-fg-dim",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: state.value.tier === "fast" ? t("search.fastMeta", { scanned: state.value.scanned }) : state.value.truncated ? t("search.truncated", { remaining: state.value.remaining }) : t("search.deepMeta", {
							scanned: state.value.scanned,
							remaining: state.value.remaining
						}) }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "my-1.5 text-[10.5px] text-fg-dim",
							children: t("search.meta", {
								scanned: state.value.scanned,
								elapsed: state.value.elapsedMs
							})
						}),
						state.value.tier === "fast" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "my-1.5 text-[10.5px] text-fg-dim",
							children: t("search.enterDeep")
						}) : null,
						state.value.tier === "deep" && state.value.truncated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "cursor-pointer rounded-md border-[0.5px] border-line bg-bg-2 px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50",
							disabled: continuing,
							onClick: () => setCursor(state.value.nextCursor ?? 0),
							children: continuing ? t("search.scanning") : t("search.continue", { count: state.value.remaining })
						}) : null,
						state.value.failures.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "ms-auto text-warn",
							children: t("search.failures", { count: state.value.failures.length })
						})
					]
				}) : null
			]
		})
	});
}
//#endregion
//#region src/shared/skill-evidence.ts
function text$1(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
/** POSIX/Windows identity normalization without Node APIs (also used by client fallback). */
function skillPath(value, workdir) {
	const raw = text$1(value)?.replaceAll("\\", "/");
	if (raw === void 0 || !raw.endsWith("/SKILL.md") || /[\n\r\0]/.test(raw) || /^[a-z][\w+.-]*:/i.test(raw) && !/^[A-Za-z]:\//.test(raw)) return void 0;
	const joined = raw.startsWith("/") || /^[A-Za-z]:\//.test(raw) || workdir === "" ? raw : `${workdir.replaceAll("\\", "/")}/${raw}`;
	const parts = [];
	for (const part of joined.split("/")) {
		if (part === "" || part === ".") continue;
		if (part === ".." && parts.length > 0 && parts.at(-1) !== "..") parts.pop();
		else if (part !== ".." || !joined.startsWith("/")) parts.push(part);
	}
	const name = parts.at(-2);
	if (name === void 0 || name === ".." || /^[A-Za-z]:$/.test(name)) return void 0;
	return {
		name,
		path: `${joined.startsWith("/") ? "/" : ""}${parts.join("/")}`
	};
}
function toolSkillEvidence(tool, turnIndex, workdir) {
	if (tool.id === "") return void 0;
	const input = tool.input !== null && typeof tool.input === "object" && !Array.isArray(tool.input) ? tool.input : void 0;
	const toolName = tool.name.split(/[.:/]/).at(-1)?.toLowerCase();
	const isSkill = toolName === "skill";
	if (!isSkill && ![
		"read",
		"read_file",
		"readfile"
	].includes(toolName ?? "")) return void 0;
	const location = skillPath(input?.file_path ?? input?.target_file ?? input?.path, workdir);
	const explicit = text$1(input?.skill) ?? text$1(input?.name) ?? (isSkill ? text$1(tool.input) : void 0);
	const name = location?.name ?? (isSkill && explicit !== void 0 && /^[\w@./:-]+$/.test(explicit) ? explicit : void 0);
	if (name === void 0 || !isSkill && location === void 0) return void 0;
	return {
		turnIndex,
		toolCallId: tool.id,
		kind: isSkill ? "skill-tool" : "skill-file",
		name,
		...location === void 0 ? {} : { path: location.path },
		...Number.isFinite(tool.startedAt) && tool.startedAt > 0 ? { time: tool.startedAt } : {}
	};
}
/** Available catalogs, instructions and code are not usage evidence. */
function userText(value) {
	if (/^\s*(?:# AGENTS\.md instructions|# Files (?:mentioned|pasted) by the user|The following is the Codex)/.test(value)) return "";
	return value.replace(/<(available_skills|available-skills|skills_instructions|agent_skills|INSTRUCTIONS|user_instructions|environment_context|recommended_plugins|instructions|rules)>[\s\S]*?<\/\1>/g, " ").replace(/```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~|`[^`\n]*`/g, " ");
}
/** Stable event nonce in the legacy toolCallId slot; never fabricated as a tool invocation. */
function turnSkillEvidence(turn, workdir) {
	const found = /* @__PURE__ */ new Map();
	const add = (path, kind) => {
		const location = skillPath(path, workdir);
		if (location === void 0) return;
		const key = location.path;
		if (found.has(key)) return;
		found.set(key, {
			...location,
			kind,
			turnIndex: turn.index,
			toolCallId: `event:${kind}:${turn.index}:${found.size + 1}`,
			...Number.isFinite(turn.startedAt) && turn.startedAt > 0 ? { time: turn.startedAt } : {}
		});
	};
	const metadata = turn.skillInjections;
	if (Array.isArray(metadata)) {
		for (const identity of metadata) if (identity !== null && typeof identity === "object" && text$1(identity.name) !== void 0) add(identity.path, "skill-injection");
	}
	for (const raw of turn.userInput) {
		const value = userText(raw);
		for (const block of value.matchAll(/<skill>\s*<name>([^<>\r\n]+)<\/name>\s*<path>([^<>\r\n]+)<\/path>[\s\S]*?<\/skill>/g)) if (text$1(block[1]) !== void 0) add(block[2], "skill-injection");
		const human = value.replace(/<skill>[\s\S]*?<\/skill>/g, " ");
		for (const citation of human.matchAll(/(?<!!)\[[^\]\n]+\]\(\s*(?:<([^<>\r\n]+)>|([^\r\n]*?\/SKILL\.md))\s*\)/g)) try {
			add(decodeURIComponent(citation[1] ?? citation[2]), "skill-reference");
		} catch {}
	}
	return [...found.values()];
}
/** Shared full/fallback projection. Tool outcomes are de-duplicated by invocation id. */
function skillsOfTurns(turns, workdir) {
	const skills = /* @__PURE__ */ new Map();
	const explicit = turns.flatMap((turn) => turnSkillEvidence(turn, workdir));
	const explicitKeys = new Set(explicit.map((item) => `${item.turnIndex}:${item.path}`));
	const represented = /* @__PURE__ */ new Set();
	const seenCalls = /* @__PURE__ */ new Set();
	const add = (evidence) => {
		const id = evidence.path === void 0 ? `name:${evidence.name}` : `path:${evidence.path}`;
		const key = `${evidence.turnIndex}:${evidence.path}`;
		if (explicitKeys.has(key) && represented.has(key)) return;
		represented.add(key);
		let skill = skills.get(id);
		if (skill === void 0) {
			skill = {
				id,
				name: evidence.name,
				...evidence.path === void 0 ? {} : { path: evidence.path },
				count: 0,
				lastTurnIndex: evidence.turnIndex,
				evidence: []
			};
			skills.set(id, skill);
		}
		skill.count++;
		skill.lastTurnIndex = Math.max(skill.lastTurnIndex, evidence.turnIndex);
		if (evidence.time !== void 0) skill.lastTime = Math.max(skill.lastTime ?? evidence.time, evidence.time);
		skill.evidence.push(evidence);
	};
	for (const turn of turns) for (const tool of turn.toolCalls) {
		if (tool.id === "" || seenCalls.has(tool.id)) continue;
		seenCalls.add(tool.id);
		const evidence = toolSkillEvidence(tool, turn.index, workdir);
		if (evidence !== void 0) add(evidence);
	}
	for (const evidence of explicit) add(evidence);
	return [...skills.values()].toSorted((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}
//#endregion
//#region src/client/insight-labels.ts
/** All insight text follows the plugin's registered locale. */
function insightLabel(key, params) {
	return t(key, params);
}
//#endregion
//#region src/shared/session-insights.ts
function timestamp(value) {
	return value !== void 0 && Number.isFinite(value) && value > 0;
}
function interval(start, end) {
	return timestamp(start) && timestamp(end) && end >= start ? [start, end] : void 0;
}
function unionMs(intervals) {
	if (intervals.length === 0) return null;
	intervals.sort((a, b) => a[0] - b[0]);
	let total = 0;
	let start = intervals[0][0];
	let end = intervals[0][1];
	for (const next of intervals.slice(1)) if (next[0] <= end) end = Math.max(end, next[1]);
	else {
		total += end - start;
		[start, end] = next;
	}
	return total + end - start;
}
function text(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
function lastText(chunks) {
	for (let i = chunks.length - 1; i >= 0; i--) {
		const value = text(chunks[i]);
		if (value !== void 0) return value;
	}
}
/** Pure projection of the existing full IR; does not read logs or paginate. */
function insightsOfSession(session) {
	const report = {
		turnCount: session.turns.length,
		toolCalls: 0,
		compactions: 0,
		currentAttribution: null,
		peak: null,
		usage: {
			input: null,
			cacheRead: null,
			cacheWrite: null,
			output: null,
			coveredTurns: 0,
			missingTurns: 0
		},
		lastMessage: null,
		timing: {
			spanMs: null,
			completedTurnMs: null,
			completedTurns: 0,
			missingTurnDurations: 0,
			toolUnionMs: null,
			timedToolCalls: 0,
			missingToolDurations: 0
		},
		skills: []
	};
	let first;
	let last;
	const observe = (at) => {
		if (!timestamp(at)) return;
		first = first === void 0 ? at : Math.min(first, at);
		last = last === void 0 ? at : Math.max(last, at);
	};
	const calls = /* @__PURE__ */ new Map();
	for (const turn of session.turns) {
		observe(turn.startedAt);
		observe(turn.endedAt);
		const duration = interval(turn.startedAt, turn.endedAt);
		if (duration === void 0) report.timing.missingTurnDurations++;
		else {
			report.timing.completedTurns++;
			report.timing.completedTurnMs = (report.timing.completedTurnMs ?? 0) + duration[1] - duration[0];
		}
		const attribution = turn.attribution;
		if (isAttribution(attribution) && attribution.total.tokens > 0) {
			if (report.currentAttribution === null || turn.index > report.currentAttribution.turnIndex) report.currentAttribution = {
				turnIndex: turn.index,
				attribution
			};
			if (report.peak === null || attribution.total.tokens > report.peak.measure.tokens) report.peak = {
				turnIndex: turn.index,
				measure: attribution.total
			};
		}
		report.compactions += turn.compactions.length;
		for (const point of turn.compactions) observe(point.at);
		const usage = turn.usage;
		if (usage === void 0 || ![
			usage.input,
			usage.cacheRead,
			usage.cacheWrite,
			usage.output
		].every((value) => Number.isFinite(value) && value >= 0)) report.usage.missingTurns++;
		else {
			report.usage.coveredTurns++;
			for (const key of [
				"input",
				"cacheRead",
				"cacheWrite",
				"output"
			]) report.usage[key] = (report.usage[key] ?? 0) + usage[key];
		}
		const assistant = lastText(turn.assistantText);
		const user = lastText(turn.userInput);
		if ((assistant !== void 0 || user !== void 0) && (report.lastMessage === null || turn.index >= report.lastMessage.turnIndex)) {
			const time = assistant === void 0 ? turn.startedAt : turn.endedAt;
			const message = assistant ?? user;
			report.lastMessage = {
				role: assistant === void 0 ? "user" : "assistant",
				text: message.length > 500 ? `${message.slice(0, 500)}…` : message,
				turnIndex: turn.index,
				...timestamp(time) ? { time } : {}
			};
		}
		turn.toolCalls.forEach((tool, ordinal) => {
			observe(tool.startedAt);
			observe(tool.endedAt);
			const key = tool.id === "" ? `anonymous:${turn.index}:${ordinal}` : `id:${tool.id}`;
			const prior = calls.get(key);
			if (prior === void 0) calls.set(key, {
				tool,
				turn
			});
			else if (interval(prior.tool.startedAt, prior.tool.endedAt) === void 0 && interval(tool.startedAt, tool.endedAt) !== void 0) calls.set(key, {
				tool: {
					...prior.tool,
					endedAt: tool.endedAt
				},
				turn: prior.turn
			});
		});
	}
	const intervals = [];
	report.toolCalls = calls.size;
	for (const { tool } of calls.values()) {
		const duration = interval(tool.startedAt, tool.endedAt);
		if (duration === void 0) report.timing.missingToolDurations++;
		else {
			intervals.push(duration);
			report.timing.timedToolCalls++;
		}
	}
	report.skills = skillsOfTurns(session.turns, session.workdir);
	report.timing.toolUnionMs = unionMs(intervals);
	if (first !== void 0 && last !== void 0) {
		report.timing.startedAt = first;
		report.timing.endedAt = last;
		report.timing.spanMs = last - first;
	}
	return report;
}
//#endregion
//#region src/client/state/session-insights.ts
const BUCKETS = [
	"input",
	"cacheRead",
	"cacheWrite",
	"output"
];
/** Adapt the shared calculator to loaded pages without claiming complete coverage. */
function sessionOverviewState({ insights, turns, turnCount, cost = null, workdir = "" }) {
	const base = {
		loadedTurns: turns.length,
		totalTurns: turnCount
	};
	if (insights !== void 0) return {
		...base,
		report: insights,
		source: "host",
		usageSource: "turns"
	};
	const report = insightsOfSession({
		id: "",
		source: "claude",
		workdir,
		createdAt: 0,
		updatedAt: 0,
		turns: [...turns].sort((a, b) => a.index - b.index),
		segments: [],
		dataQuality: []
	});
	const costUsage = cost !== null && cost.turns.length === turnCount && turnCount > 0 && BUCKETS.every((key) => Number.isFinite(cost.totals[key]) && cost.totals[key] >= 0);
	if (costUsage) for (const key of BUCKETS) report.usage[key] = cost.totals[key];
	return {
		...base,
		source: turns.length === turnCount ? "client-complete" : "client-partial",
		usageSource: costUsage ? "cost" : "turns",
		report
	};
}
//#endregion
//#region src/client/state/session-stats.ts
/**
* Summarise the loaded turns.
* @param turns - loaded page(s), in order.
* @returns the header numbers; zeros for an empty list.
*/
function sessionStats(turns) {
	let peak = 0;
	let peakTurn;
	let compactions = 0;
	let toolCalls = 0;
	let last;
	for (const turn of turns) {
		const total = turn.attribution.total.tokens;
		if (total > peak) {
			peak = total;
			peakTurn = turn.index;
		}
		if (total > 0) last = turn;
		compactions += turn.compactions.length;
		toolCalls += turn.toolCalls.length;
	}
	const current = last?.attribution.total.tokens ?? 0;
	const window = last?.attribution.windowSize;
	return {
		current,
		...window === void 0 ? {} : { window },
		...window === void 0 || window <= 0 ? {} : { windowShare: current / window },
		peak,
		...peakTurn === void 0 ? {} : { peakTurn },
		compactions,
		toolCalls
	};
}
//#endregion
//#region src/client/ui/primitives.tsx
const CHIP_BASE = "inline-flex items-center gap-1 rounded-[5px] px-1.5 h-4.5 text-[10.5px] leading-none whitespace-nowrap tabular-nums";
const CHIP_SKIN = {
	neutral: `${CHIP_BASE} border border-line text-fg-dim`,
	soft: `${CHIP_BASE} bg-bg-2 text-fg-dim`,
	warn: `${CHIP_BASE} border border-dashed border-warn/70 text-warn bg-warn/8`,
	accent: `${CHIP_BASE} bg-accent/14 text-accent`,
	mono: `${CHIP_BASE} border border-line text-fg-dim font-mono`
};
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
		children
	});
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
			count === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "rounded-full bg-bg-2 px-1.5 text-[10.5px] leading-4.25 font-medium text-fg-dim tabular-nums",
				children: count
			}),
			end === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "ms-auto flex items-center gap-2 font-normal",
				children: end
			})
		]
	});
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
		className: flush ? "min-w-0 rounded-[10px] border border-line-soft bg-bg-1" : "min-w-0 rounded-[10px] border border-line-soft bg-bg-1 p-3.5",
		"aria-label": label,
		children
	});
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
	const fill = meter === void 0 ? void 0 : Math.max(0, Math.min(1, meter));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-1 rounded-[10px] border border-line-soft bg-bg-1 px-3 py-2.5",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "truncate text-[11px] text-fg-dim",
				children: label
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: typeof value === "string" ? "truncate text-[18px] leading-tight font-semibold tracking-[-0.01em] text-fg tabular-nums" : "text-[18px] leading-tight font-semibold tracking-[-0.01em] text-fg tabular-nums",
				children: value
			}),
			fill === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "block h-1 w-full overflow-hidden rounded-full bg-bg-3",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: tone === "warn" ? "block h-full rounded-full bg-warn" : "block h-full rounded-full bg-accent",
					style: { inlineSize: `${(fill * 100).toFixed(1)}%` }
				})
			}),
			hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "truncate text-[10.5px] text-fg-3",
				children: hint
			})
		]
	});
}
/**
* Keyboard hint.
* @param props.children - key label.
* @returns the key cap.
*/
function Kbd({ children }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("kbd", {
		className: "inline-flex h-4.5 items-center rounded-[5px] border border-line bg-bg px-1.5 font-[inherit] text-[10.5px] text-fg-dim",
		children
	});
}
//#endregion
//#region src/client/ui/session-head.tsx
/** Window share above which the current-context gauge turns amber. */
const WINDOW_WARN = .8;
/**
* The head.
* @param props.data - the detail page.
* @param props.turns - turns loaded so far.
* @param props.cost - the priced session, when the Host returned one.
* @param props.onHandoff - open the handoff dialog.
* @returns the header.
*/
function SessionHead({ data, turns, cost, onHandoff, onOpenSession }) {
	const [openError, setOpenError] = (0, react.useState)("");
	const session = data.session;
	const label = sessionLabel({
		title: session.title,
		firstInput: session.firstInput
	});
	const mark = SOURCE_MARKS[session.source];
	const loadedAll = turns.length >= data.turnCount;
	const report = data.insights;
	const current = report?.currentAttribution?.attribution;
	const window = current?.windowSize;
	const stats = report === void 0 ? sessionStats(loadedAll ? turns : []) : {
		current: current?.total.tokens ?? 0,
		peak: report.peak?.measure.tokens ?? 0,
		peakTurn: report.peak?.turnIndex,
		window,
		windowShare: window === void 0 || window <= 0 || current === void 0 ? void 0 : current.total.tokens / window,
		compactions: report.compactions,
		toolCalls: report.toolCalls
	};
	const currentUnknown = report === void 0 ? !loadedAll || stats.current === 0 : report.currentAttribution === null;
	const peakUnknown = report === void 0 ? !loadedAll || stats.peak === 0 : report.peak === null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
		className: "flex min-w-0 flex-col gap-3 border-b border-line-soft px-5 pt-4 pb-4",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 items-start gap-3",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-1 flex-col gap-1",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: "m-0 truncate text-[16px] leading-snug font-semibold",
							title: session.id,
							children: label.title
						}),
						label.detail === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 truncate text-[12px] text-fg-dim",
							title: label.detail,
							children: label.detail
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: "m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-fg-dim",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "inline-flex items-center gap-1 font-medium",
									style: { color: mark.brand },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
										source: session.source,
										size: 12
									}), mark.label.zh]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "max-w-[42ch] truncate font-mono",
									title: session.workdir,
									children: session.workdir === "" ? t("workdirs.unknown") : tildePath(session.workdir)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									className: "text-fg-3",
									children: "·"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "tabular-nums",
									children: formatTime(session.updatedAt)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									className: "text-fg-3",
									children: "·"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "tabular-nums",
									children: formatBytes(data.meta.bytes)
								}),
								data.meta.residualTurns > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Chip, {
									tone: "warn",
									title: t("turns.unknownNote"),
									children: [
										t("turns.unknown"),
										" × ",
										data.meta.residualTurns
									]
								}) : null,
								data.meta.reconciledTurns > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Chip, {
									title: t("stats.reconciledTurns", { count: data.meta.reconciledTurns }),
									children: ["×", data.meta.reconciledTurns]
								}) : null
							]
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "ci-btn shrink-0",
					onClick: session.source !== "dsh" ? onHandoff : () => {
						setOpenError("");
						Promise.resolve().then(() => {
							if (onOpenSession === void 0) throw new Error("DSH navigation unavailable");
							return onOpenSession(session.id);
						}).catch((error) => setOpenError(error instanceof Error ? error.message : String(error)));
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
						name: "handoff",
						size: 13
					}), session.source === "dsh" ? t("handoff.openExisting") : t("handoff.button")]
				})]
			}),
			openError === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 text-[12px] text-err",
				role: "alert",
				children: t("handoff.openFailed", { detail: openError })
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2 @2xl:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
						label: t("stats.current"),
						value: currentUnknown ? insightLabel("insights.unrecorded") : compactTokens(stats.current),
						...stats.windowShare === void 0 ? {} : { meter: stats.windowShare },
						tone: (stats.windowShare ?? 0) >= WINDOW_WARN ? "warn" : "accent",
						hint: stats.window === void 0 ? t("stats.noWindow") : t("stats.windowShare", {
							share: formatShare(stats.current, stats.window),
							size: compactTokens(stats.window)
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
						label: t("stats.peak"),
						value: peakUnknown ? insightLabel("insights.unrecorded") : compactTokens(stats.peak),
						hint: stats.peakTurn === void 0 ? "—" : t("stats.peakAt", { index: stats.peakTurn })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
						label: t("stats.turns"),
						value: String(data.turnCount),
						hint: report !== void 0 || loadedAll ? t("stats.compactionsLine", {
							count: stats.compactions,
							tools: stats.toolCalls
						}) : t("stats.loaded", { count: turns.length })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
						label: t("stats.cost"),
						value: cost === null ? "—" : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CostBadge, {
							cost,
							plain: true
						}),
						hint: cost === null ? t("stats.costPending") : cost.totals.unpricedTurns > 0 ? t("cost.unpriced", { count: cost.totals.unpricedTurns }) : t("stats.costPriced")
					})
				]
			}),
			session.dataQuality.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: "ci-fold text-[11px] text-fg-dim",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
					className: "inline-flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
							name: "chevron",
							size: 11,
							className: "ci-chevron"
						}),
						t("session.quality"),
						" (",
						session.dataQuality.length,
						")"
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: "mt-1.5 mb-0 ps-4 font-mono text-[10.5px] break-all",
					children: session.dataQuality.map((token) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: token }) }, token))
				})]
			}) : null
		]
	});
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
	pixelsPerToken: 750
};
/**
* Human sentence for one basis, used as the tooltip body.
* @param basis - the measure's basis tag.
*/
function basisTip(basis) {
	switch (basis) {
		case "usage": return t("basis.tip.usage");
		case "chars-per-token": return t("basis.tip.chars-per-token", {
			text: CALIBRATION.text,
			cjk: CALIBRATION.cjk,
			schema: CALIBRATION.schema
		});
		case "harness-projection": return t("basis.tip.harness-projection", { px: CALIBRATION.pixelsPerToken });
		case "byte-length": return t("basis.tip.byte-length");
		case "unattributed": return t("basis.tip.unattributed");
	}
}
/** The tooltip body for one measure: precision word, basis, calipers, value. */
function measureTip(measure) {
	return `${measure.precision === "exact" ? t("precision.exact") : t("precision.estimate")} · ${t(`basis.${measure.basis}`)} — ${basisTip(measure.basis)} (${formatTokens(measure.tokens)} tokens)`;
}
/**
* Small badge carrying the precision word.
* @param props - the measure's precision.
* @returns the badge.
*/
function PrecisionBadge({ precision }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		className: precision === "exact" ? "px-1 rounded-[3px] font-[inherit] text-[9.5px] leading-[15px] tracking-[0.02em] border-[0.5px] border-current text-ok" : "px-1 rounded-[3px] font-[inherit] text-[9.5px] leading-[15px] tracking-[0.02em] border-[0.5px] border-current text-fg-dim",
		"data-precision": precision,
		children: precision === "exact" ? t("precision.exact") : t("precision.estimate")
	});
}
/**
* A token count that carries its own provenance.
* @param props.measure - the measure to print.
* @param props.share - optional pre-computed share text, e.g. `20.3%`.
* @param props.dense - drop the visible badge (the mark still separates them).
* @returns the value with its mark and tooltip.
*/
function MeasureValue({ measure, share, dense = false }) {
	const mark = measure.precision === "exact" ? "=" : "≈";
	const label = measureTip(measure);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: "relative inline-flex items-baseline gap-1 font-mono text-[11px] outline-offset-2",
		"data-precision": measure.precision,
		"data-tip": label,
		tabIndex: 0,
		"aria-label": label,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: measure.precision === "exact" ? "text-fg" : "text-fg-dim italic",
				children: formatTokens(measure.tokens)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "text-[10px] text-fg-dim",
				"aria-hidden": "true",
				children: mark
			}),
			dense ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PrecisionBadge, { precision: measure.precision }),
			share === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "text-[10px] text-fg-dim",
				children: share
			})
		]
	});
}
//#endregion
//#region src/client/state/bar-layout.ts
/**
* Turn an attribution into paintable slices.
* @param attribution - one turn's attribution.
* @returns the layout shared by the bar and the legend.
*/
function barLayout(attribution) {
	const total = attribution.total.tokens;
	const parts = attribution.parts.filter((slice) => slice.measure.tokens > 0);
	const sumParts = parts.reduce((sum, slice) => sum + slice.measure.tokens, 0);
	const residual = total - sumParts;
	const normalizedByParts = total <= 0;
	const overflowingParts = !normalizedByParts && sumParts > total;
	const denominator = normalizedByParts || overflowingParts ? Math.max(sumParts, 1) : total;
	const segments = parts.map((slice) => ({
		key: slice.part,
		kind: "part",
		part: slice.part,
		tokens: slice.measure.tokens,
		width: slice.measure.tokens / denominator * 100,
		share: formatShare(slice.measure.tokens, denominator)
	}));
	if (residual > 0) segments.push({
		key: "unknown",
		kind: "unknown",
		tokens: residual,
		width: residual / denominator * 100,
		share: formatShare(residual, denominator)
	});
	return {
		segments,
		denominator,
		residual,
		overCounted: residual < 0 && !normalizedByParts ? -residual : 0,
		normalizedByParts,
		overflowingParts
	};
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
	return `var(--color-part-${part})`;
}
/**
* The bar itself.
* @param props.attribution - one turn's attribution.
* @param props.label - accessible name, e.g. `第 5 轮上下文`.
* @param props.dense - the row-sized variant used inside the turn list.
* @returns the bar.
*/
function StackedBar({ attribution, label, dense = false }) {
	const layout = barLayout(attribution);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: `flex w-full bg-bg-3 ${dense ? "h-1.5 overflow-hidden rounded-full" : "relative h-3 rounded-sm"}`,
		role: dense ? "img" : "group",
		"aria-label": label,
		children: layout.segments.map((segment) => {
			const name = segment.part === void 0 ? t("turns.unknown") : t(`part.${segment.part}`);
			const measure = attribution.parts.find((slice) => slice.part === segment.part)?.measure ?? {
				tokens: segment.tokens,
				precision: "estimate",
				basis: "unattributed"
			};
			const tip = `${name} · ${segment.share} · ${measureTip(measure)}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: segment.kind === "unknown" ? "h-full flex-none bg-[repeating-linear-gradient(45deg,var(--color-fg-dim)_0_2px,transparent_2px_5px)] shadow-[inset_0_0_0_1px_var(--color-fg-dim)] after:w-max after:max-w-full first:rounded-s-sm last:rounded-e-sm" : "h-full flex-none after:w-max after:max-w-full first:rounded-s-sm last:rounded-e-sm",
				"data-part": segment.part ?? "unknown",
				style: segment.part === void 0 ? { width: `${segment.width.toFixed(3)}%` } : {
					width: `${segment.width.toFixed(3)}%`,
					background: partColor(segment.part)
				},
				title: dense ? tip : void 0,
				"data-tip": dense ? void 0 : tip,
				tabIndex: dense ? void 0 : 0,
				"aria-label": tip
			}, segment.key);
		})
	});
}
/**
* The bar's legend: every slice with its number, share and precision, plus the
* two honesty notices (unknown share, over-count, part-normalized bar).
* @param props.attribution - one turn's attribution.
* @returns the legend.
*/
function PartLegend({ attribution }) {
	const layout = barLayout(attribution);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
			className: "mt-3 mb-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0",
			children: [attribution.parts.filter((slice) => slice.measure.tokens !== 0).map((slice) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: "inline-flex items-center gap-1.5 text-[11px]",
				"data-part": slice.part,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "h-2.5 w-2.5 rounded-[3px]",
						style: { background: partColor(slice.part) },
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(`part.${slice.part}`) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, {
						measure: slice.measure,
						share: formatShare(slice.measure.tokens, layout.denominator),
						dense: true
					})
				]
			}, slice.part)), layout.residual > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: "inline-flex items-center gap-1.5 text-[11px]",
				"data-part": "unknown",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "h-2.5 w-2.5 rounded-[3px] bg-[repeating-linear-gradient(45deg,var(--color-fg-dim)_0_1px,transparent_1px_3px)]",
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("turns.unknown") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, {
						measure: {
							tokens: layout.residual,
							precision: "estimate",
							basis: "unattributed"
						},
						share: formatShare(layout.residual, layout.denominator),
						dense: true
					})
				]
			}) : null]
		}),
		layout.residual > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "mt-2 mb-0 text-[10.5px] text-fg-dim",
			role: "note",
			children: t("turns.unknownNote")
		}) : null,
		layout.overCounted > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "mt-2 mb-0 bg-bg-1 px-2 py-1 text-[10.5px] text-warn",
			role: "note",
			children: t("turns.overCounted", { tokens: formatTokens(layout.overCounted) })
		}) : null,
		layout.normalizedByParts ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "mt-2 mb-0 bg-bg-1 px-2 py-1 text-[10.5px] text-warn",
			role: "note",
			children: t("turns.normalizedByParts")
		}) : null,
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
			className: "mt-2.5 mb-0 text-[11px] text-fg-dim",
			children: [
				t("turns.total"),
				" ",
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "font-mono text-fg",
					children: compactTokens(attribution.total.tokens)
				}),
				attribution.windowSize === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [" · ", t("turns.window", { size: compactTokens(attribution.windowSize) })] }),
				attribution.reconciled === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [" · ", t("turns.notReconciled")] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [" · ", t("turns.reconciled", { factor: attribution.reconciled.factor.toFixed(3) })] })
			]
		})
	] });
}
//#endregion
//#region src/client/ui/session-overview.tsx
function Card({ title, children }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Card$1, {
		label: title,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-2.5",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
				className: "m-0 text-[12px] font-semibold",
				children: title
			}), children]
		})
	});
}
/** SVG charts use existing identity colors, and do not interpolate missing values. */
function Ring({ slices, center, name }) {
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	let offset = 0;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid w-full min-w-0 place-items-center",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			viewBox: "0 0 120 120",
			className: "col-start-1 row-start-1 h-32 w-32 max-w-full",
			role: "img",
			"aria-label": name,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "60",
				cy: "60",
				r: "48",
				fill: "none",
				stroke: "var(--color-bg-3)",
				strokeWidth: "9"
			}), total <= 0 ? null : slices.map((slice, index) => {
				const share = slice.value / total * 100;
				const start = offset;
				offset += share;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "60",
					cy: "60",
					r: "48",
					fill: "none",
					stroke: slice.color,
					strokeWidth: "9",
					pathLength: "100",
					strokeDasharray: `${share} ${100 - share}`,
					strokeDashoffset: -start,
					transform: "rotate(-90 60 60)"
				}, index);
			})]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "col-start-1 row-start-1 flex max-w-[16ch] flex-col items-center gap-1 text-center text-[12px]",
			children: center
		})]
	});
}
function Unknown() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		className: "text-[12px] text-fg-dim",
		children: insightLabel("insights.unrecorded")
	});
}
function SessionOverview({ insights: hostInsights, overview, onJumpTurn, onLoadMore, loadingMore = false, pagingFailure }) {
	const insights = hostInsights ?? overview?.report;
	const partial = hostInsights === void 0 && overview?.source === "client-partial";
	const currentTitle = insightLabel(partial ? "insights.loadedContext" : "insights.current");
	const usageTitle = insightLabel(partial && overview?.usageSource !== "cost" ? "insights.loadedUsage" : "insights.usage");
	if (insights === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "p-5",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {})
	});
	const current = insights.currentAttribution;
	const attribution = current?.attribution;
	const window = attribution?.windowSize;
	const share = attribution !== void 0 && window !== void 0 && window > 0 ? attribution.total.tokens / window : void 0;
	const usage = insights.usage;
	const buckets = [
		{
			key: "input",
			color: partColor("user-input")
		},
		{
			key: "cacheRead",
			color: partColor("history")
		},
		{
			key: "cacheWrite",
			color: partColor("memory-instructions")
		},
		{
			key: "output",
			color: partColor("assistant-output")
		}
	];
	const usageTotal = usage.coveredTurns === 0 && overview?.usageSource !== "cost" ? null : buckets.reduce((sum, bucket) => sum + (usage[bucket.key] ?? 0), 0);
	const timing = insights.timing;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-3 p-4",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card$1, {
				label: insightLabel("insights.summary"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: "m-0 text-[12px] font-semibold",
							children: insightLabel("insights.summary")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "text-[11px] text-fg-dim tabular-nums",
							children: [
								insightLabel("insights.turnCount"),
								" · ",
								overview?.totalTurns ?? insights.turnCount
							]
						})]
					}),
					hostInsights === void 0 && overview !== void 0 && overview.source !== "host" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "m-0 mbs-2 text-[11px] text-fg-dim",
						role: "status",
						children: partial ? insightLabel("insights.partial", {
							loaded: overview.loadedTurns,
							total: overview.totalTurns
						}) : insightLabel("insights.fallback")
					}) : null,
					partial ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "mbs-2 flex flex-wrap items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "text-[11px] text-fg-dim",
							children: insightLabel("insights.loadedNote")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ci-btn min-h-9 active:bg-bg-3",
							disabled: loadingMore || onLoadMore === void 0,
							onClick: onLoadMore,
							children: loadingMore ? t("session.loadingMore") : t("session.loadMore")
						})]
					}) : null,
					pagingFailure,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
						className: "m-0 mbs-3 flex flex-wrap gap-x-6 gap-y-2 text-[11px]",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
								className: "text-fg-dim",
								children: insightLabel("insights.toolCalls")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
								className: "m-0 font-semibold tabular-nums",
								children: insights.toolCalls
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
								className: "text-fg-dim",
								children: insightLabel("insights.compactions")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
								className: "m-0 font-semibold tabular-nums",
								children: insights.compactions
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
								className: "text-fg-dim",
								children: insightLabel("insights.span")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
								className: "m-0 font-semibold tabular-nums",
								children: timing.spanMs === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {}) : formatDuration(1, timing.spanMs + 1)
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
								className: "text-fg-dim",
								children: insightLabel("insights.peak")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
								className: "m-0 font-semibold tabular-nums",
								children: insights.peak === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, {
									measure: insights.peak.measure,
									dense: true
								})
							})] })
						]
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] items-start gap-3",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
					title: currentTitle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
							name: currentTitle,
							slices: share === void 0 ? [] : [{
								value: Math.min(share, 1),
								color: "var(--color-accent)"
							}, {
								value: Math.max(1 - share, 0),
								color: "var(--color-bg-3)"
							}],
							center: attribution === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
								className: "text-[24px] tabular-nums",
								children: compactTokens(attribution.total.tokens)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "text-fg-dim",
								children: "tokens"
							})] })
						}),
						attribution === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, { measure: attribution.total }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 text-[11px] text-fg-dim",
							children: share === void 0 ? insightLabel("insights.windowUnknown") : insightLabel("insights.window", { share: formatShare(attribution.total.tokens, window) })
						}),
						current === null || partial ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 text-[11px] text-fg-dim",
							children: insightLabel("insights.currentNote", { index: current.turnIndex })
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
					title: usageTitle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
							name: usageTitle,
							slices: usageTotal === null ? [] : buckets.map((bucket) => ({
								value: usage[bucket.key] ?? 0,
								color: bucket.color
							})),
							center: usageTotal === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
								className: "text-[24px] tabular-nums",
								children: compactTokens(usageTotal)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "text-fg-dim",
								children: "tokens"
							})] })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: "m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2 p-0",
							children: buckets.map((bucket) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: "flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "h-2 w-2 shrink-0 rounded-full",
										style: { background: bucket.color },
										"aria-hidden": "true"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: insightLabel(`insights.${bucket.key}`) }),
									usage[bucket.key] === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, {
										measure: {
											tokens: usage[bucket.key],
											precision: "exact",
											basis: "usage"
										},
										dense: true
									})
								]
							}, bucket.key))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 text-[11px] text-fg-dim",
							children: insightLabel(overview?.usageSource === "cost" && hostInsights === void 0 ? "insights.costUsage" : "insights.usageNote")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 text-[11px] text-fg-dim",
							children: insightLabel("insights.coverage", {
								covered: usage.coveredTurns,
								missing: usage.missingTurns
							})
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Card, {
				title: insightLabel("insights.composition"),
				children: attribution === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StackedBar, {
					attribution,
					label: insightLabel("insights.composition")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PartLegend, { attribution })] })
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card$1, {
				label: insightLabel("insights.completedDuration"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "m-0 text-[12px] font-semibold",
								children: insightLabel("insights.completedDuration")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "m-0 text-[16px] tabular-nums",
								children: timing.completedTurnMs === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {}) : formatDuration(1, timing.completedTurnMs + 1)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "m-0 text-[11px] text-fg-dim",
								children: insightLabel("insights.durationCoverage", {
									covered: timing.completedTurns,
									missing: timing.missingTurnDurations
								})
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "m-0 text-[12px] font-semibold",
								children: insightLabel("insights.toolDuration")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "m-0 text-[16px] tabular-nums",
								children: timing.toolUnionMs === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {}) : formatDuration(1, timing.toolUnionMs + 1)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "m-0 text-[11px] text-fg-dim",
								children: insightLabel("insights.durationCoverage", {
									covered: timing.timedToolCalls,
									missing: timing.missingToolDurations
								})
							})
						]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "m-0 mbs-2 text-[11px] text-fg-dim",
					children: insightLabel("insights.durationNote")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Card, {
				title: insightLabel(partial ? "insights.loadedMessage" : "insights.lastMessage"),
				children: insights.lastMessage === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2 text-[11px] text-fg-dim",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: insightLabel(`insights.${insights.lastMessage.role}`) }),
						insights.lastMessage.time === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Unknown, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", { children: formatTime(insights.lastMessage.time) }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ci-btn min-h-9 active:bg-bg-3",
							disabled: onJumpTurn === void 0,
							onClick: () => onJumpTurn?.(insights.lastMessage.turnIndex),
							children: insightLabel("insights.jump", { index: insights.lastMessage.turnIndex })
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "m-0 max-h-64 overflow-y-auto text-[12px] leading-relaxed wrap-anywhere whitespace-pre-wrap",
					children: insights.lastMessage.text
				})] })
			})
		]
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/visuallyHidden.mjs
const visuallyHiddenBase = {
	clipPath: "inset(50%)",
	overflow: "hidden",
	whiteSpace: "nowrap",
	border: 0,
	padding: 0,
	width: 1,
	height: 1,
	margin: -1
};
const visuallyHidden = {
	...visuallyHiddenBase,
	position: "fixed",
	margin: 0,
	top: 0,
	left: 0
};
const visuallyHiddenInput = {
	...visuallyHiddenBase,
	position: "absolute"
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useRefWithInit.mjs
const UNINITIALIZED = {};
/**
* A React.useRef() that is initialized with a function. Note that it accepts an optional
* initialization argument, so the initialization function doesn't need to be an inline closure.
*
* @usage
*   const ref = useRefWithInit(sortColumns, columns)
*/
function useRefWithInit(init, initArg) {
	const ref = react.useRef(UNINITIALIZED);
	if (ref.current === UNINITIALIZED) ref.current = init(initArg);
	return ref;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useMergedRefs.mjs
/**
* Merges refs into a single memoized callback ref or `null`.
* This makes sure multiple refs are updated together and have the same value.
*
* This function accepts up to four refs. If you need to merge more, or have an unspecified number of refs to merge,
* use `useMergedRefsN` instead.
*/
function useMergedRefs(a, b, c, d) {
	const forkRef = useRefWithInit(createForkRef).current;
	if (didChange(forkRef, a, b, c, d)) update(forkRef, [
		a,
		b,
		c,
		d
	]);
	return forkRef.callback;
}
/**
* Merges an array of refs into a single memoized callback ref or `null`.
*
* If you need to merge a fixed number (up to four) of refs, use `useMergedRefs` instead for better performance.
*/
function useMergedRefsN(refs) {
	const forkRef = useRefWithInit(createForkRef).current;
	if (didChangeN(forkRef, refs)) update(forkRef, refs);
	return forkRef.callback;
}
function createForkRef() {
	return {
		callback: null,
		cleanup: null,
		refs: []
	};
}
function didChange(forkRef, a, b, c, d) {
	return forkRef.refs[0] !== a || forkRef.refs[1] !== b || forkRef.refs[2] !== c || forkRef.refs[3] !== d;
}
function didChangeN(forkRef, newRefs) {
	return forkRef.refs.length !== newRefs.length || forkRef.refs.some((ref, index) => ref !== newRefs[index]);
}
function update(forkRef, refs) {
	forkRef.refs = refs;
	if (refs.every((ref) => ref == null)) {
		forkRef.callback = null;
		return;
	}
	forkRef.callback = (instance) => {
		if (forkRef.cleanup) {
			forkRef.cleanup();
			forkRef.cleanup = null;
		}
		if (instance != null) {
			const cleanupCallbacks = Array(refs.length).fill(null);
			for (let i = 0; i < refs.length; i += 1) {
				const ref = refs[i];
				if (ref == null) continue;
				switch (typeof ref) {
					case "function": {
						const refCleanup = ref(instance);
						if (typeof refCleanup === "function") cleanupCallbacks[i] = refCleanup;
						break;
					}
					case "object": ref.current = instance;
				}
			}
			forkRef.cleanup = () => {
				for (let i = 0; i < refs.length; i += 1) {
					const ref = refs[i];
					if (ref == null) continue;
					switch (typeof ref) {
						case "function": {
							const cleanupCallback = cleanupCallbacks[i];
							if (typeof cleanupCallback === "function") cleanupCallback();
							else ref(null);
							break;
						}
						case "object": ref.current = null;
					}
				}
			};
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useOnFirstRender.mjs
function useOnFirstRender(fn) {
	const ref = react.useRef(true);
	if (ref.current) {
		ref.current = false;
		fn();
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/usePreviousValue.mjs
/**
* Returns a previous value of its argument.
* @param value Current value.
* @returns Previous value, or null if there is no previous value.
*/
function usePreviousValue(value) {
	const [state, setState] = react.useState({
		current: value,
		previous: null
	});
	if (!Object.is(value, state.current)) setState({
		current: value,
		previous: state.current
	});
	return state.previous;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/isElementDisabled.mjs
function isElementDisabled(element) {
	return element == null || element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useControlled.mjs
function useControlled({ controlled, default: defaultProp, name, state = "value" }) {
	const { current: isControlled } = react.useRef(controlled !== void 0);
	const [valueState, setValue] = react.useState(() => defaultProp);
	return [isControlled && controlled !== void 0 ? controlled : valueState, react.useCallback((newValue) => {
		if (!isControlled) setValue(newValue);
	}, [])];
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useIsoLayoutEffect.mjs
const noop = () => {};
const useIsoLayoutEffect = typeof document !== "undefined" ? react.useLayoutEffect : noop;
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/safeReact.mjs
/**
* A clone of the React namespace for reading APIs that may be missing in older
* supported React versions. Bundlers can rewrite direct `React.someNewApi`
* reads into named imports, which breaks React 17. Reading from this cloned
* object keeps those lookups optional.
*
* @see https://github.com/mui/material-ui/issues/41190#issuecomment-2040873379
*/
const SafeReact = { ...react };
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useStableCallback.mjs
const useInsertionEffect = SafeReact.useInsertionEffect;
const useSafeInsertionEffect = useInsertionEffect && useInsertionEffect !== SafeReact.useLayoutEffect ? useInsertionEffect : (fn) => fn();
/**
* Stabilizes the function passed so it's always the same between renders.
*
* The function becomes non-reactive to any values it captures.
* It can safely be passed as a dependency of `React.useMemo` and `React.useEffect` without re-triggering them if its captured values change.
*
* The function must only be called inside effects and event handlers, never during render (which throws an error).
*
* This hook is a more permissive version of React 19.2's `React.useEffectEvent` in that it can be passed through contexts and called in event handler props, not just effects.
*/
function useStableCallback(callback) {
	const stable = useRefWithInit(createStableCallback).current;
	stable.next = callback;
	useSafeInsertionEffect(stable.effect);
	return stable.trampoline;
}
function createStableCallback() {
	const stable = {
		next: void 0,
		callback: assertNotCalled,
		trampoline: (...args) => stable.callback?.(...args),
		effect: () => {
			stable.callback = stable.next;
		}
	};
	return stable;
}
function assertNotCalled() {}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useValueAsRef.mjs
/**
* Untracks the provided value by turning it into a ref to remove its reactivity.
*
* Used to access the passed value inside `React.useEffect` without causing the effect to re-run when the value changes.
*/
function useValueAsRef(value) {
	const latest = useRefWithInit(createLatestRef, value).current;
	latest.next = value;
	useIsoLayoutEffect(latest.effect);
	return latest;
}
function createLatestRef(value) {
	const latest = {
		current: value,
		next: value,
		effect: () => {
			latest.current = latest.next;
		}
	};
	return latest;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/formatErrorMessage.mjs
/**
* Creates a formatErrorMessage function with a custom URL and prefix.
* @param baseUrl - The base URL for the error page (e.g., 'https://base-ui.com/production-error')
* @param prefix - The prefix for the error message (e.g., 'Base UI')
* @returns A function that formats error messages with the given URL and prefix
*/
function createFormatErrorMessage(baseUrl, prefix) {
	return function formatErrorMessage(code, ...args) {
		const url = new URL(baseUrl);
		url.searchParams.set("code", code.toString());
		args.forEach((arg) => url.searchParams.append("args[]", arg));
		return `${prefix} error #${code}; visit ${url} for the full message.`;
	};
}
/**
* WARNING: Don't import this directly. It's imported by the code generated by
* `@mui/internal-babel-plugin-minify-errors`. Make sure to always use string literals in `Error`
* constructors to ensure the plugin works as expected. Supported patterns include:
*   throw new Error('My message');
*   throw new Error(`My message: ${foo}`);
*   throw new Error(`My message: ${foo}` + 'another string');
*   ...
*/
const formatErrorMessage = createFormatErrorMessage("https://base-ui.com/production-error", "Base UI");
//#endregion
//#region ../../node_modules/.pnpm/use-sync-external-store@1.7.0_react@19.3.1/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.js
/**
* @license React
* use-sync-external-store-shim.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_use_sync_external_store_shim_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var React = require("react");
	function is(x, y) {
		return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
	}
	var objectIs = "function" === typeof Object.is ? Object.is : is;
	var useState = React.useState;
	var useEffect = React.useEffect;
	var useLayoutEffect = React.useLayoutEffect;
	var useDebugValue = React.useDebugValue;
	function useSyncExternalStore$2(subscribe, getSnapshot) {
		var value = getSnapshot(), _useState = useState({ inst: {
			value,
			getSnapshot
		} }), inst = _useState[0].inst, forceUpdate = _useState[1];
		useLayoutEffect(function() {
			inst.value = value;
			inst.getSnapshot = getSnapshot;
			checkIfSnapshotChanged(inst) && forceUpdate({ inst });
		}, [
			subscribe,
			value,
			getSnapshot
		]);
		useEffect(function() {
			checkIfSnapshotChanged(inst) && forceUpdate({ inst });
			return subscribe(function() {
				checkIfSnapshotChanged(inst) && forceUpdate({ inst });
			});
		}, [subscribe]);
		useDebugValue(value);
		return value;
	}
	function checkIfSnapshotChanged(inst) {
		var latestGetSnapshot = inst.getSnapshot;
		inst = inst.value;
		try {
			var nextValue = latestGetSnapshot();
			return !objectIs(inst, nextValue);
		} catch (error) {
			return !0;
		}
	}
	function useSyncExternalStore$1(subscribe, getSnapshot) {
		return getSnapshot();
	}
	var shim = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
	exports.useSyncExternalStore = void 0 !== React.useSyncExternalStore ? React.useSyncExternalStore : shim;
}));
//#endregion
//#region ../../node_modules/.pnpm/use-sync-external-store@1.7.0_react@19.3.1/node_modules/use-sync-external-store/shim/index.js
var require_shim = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_use_sync_external_store_shim_production();
}));
//#endregion
//#region ../../node_modules/.pnpm/use-sync-external-store@1.7.0_react@19.3.1/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js
/**
* @license React
* use-sync-external-store-shim/with-selector.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_with_selector_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var React = require("react");
	var shim = require_shim();
	function is(x, y) {
		return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
	}
	var objectIs = "function" === typeof Object.is ? Object.is : is;
	var useSyncExternalStore = shim.useSyncExternalStore;
	var useRef = React.useRef;
	var useEffect = React.useEffect;
	var useMemo = React.useMemo;
	var useDebugValue = React.useDebugValue;
	exports.useSyncExternalStoreWithSelector = function(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
		var instRef = useRef(null);
		if (null === instRef.current) {
			var inst = {
				hasValue: !1,
				value: null
			};
			instRef.current = inst;
		} else inst = instRef.current;
		instRef = useMemo(function() {
			function memoizedSelector(nextSnapshot) {
				if (!hasMemo) {
					hasMemo = !0;
					memoizedSnapshot = nextSnapshot;
					nextSnapshot = selector(nextSnapshot);
					if (void 0 !== isEqual && inst.hasValue) {
						var currentSelection = inst.value;
						if (isEqual(currentSelection, nextSnapshot)) return memoizedSelection = currentSelection;
					}
					return memoizedSelection = nextSnapshot;
				}
				currentSelection = memoizedSelection;
				if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
				var nextSelection = selector(nextSnapshot);
				if (void 0 !== isEqual && isEqual(currentSelection, nextSelection)) return memoizedSnapshot = nextSnapshot, currentSelection;
				memoizedSnapshot = nextSnapshot;
				return memoizedSelection = nextSelection;
			}
			var hasMemo = !1, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
			return [function() {
				return memoizedSelector(getSnapshot());
			}, null === maybeGetServerSnapshot ? void 0 : function() {
				return memoizedSelector(maybeGetServerSnapshot());
			}];
		}, [
			getSnapshot,
			getServerSnapshot,
			selector,
			isEqual
		]);
		var value = useSyncExternalStore(subscribe, instRef[0], instRef[1]);
		useEffect(function() {
			inst.hasValue = !0;
			inst.value = value;
		}, [value]);
		useDebugValue(value);
		return value;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/use-sync-external-store@1.7.0_react@19.3.1/node_modules/use-sync-external-store/shim/with-selector.js
var require_with_selector = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_with_selector_production();
}));
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/reactVersion.mjs
const majorVersion = parseInt(react.version, 10);
function isReactVersionAtLeast(reactVersionToCheck) {
	return majorVersion >= reactVersionToCheck;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/fastHooks.mjs
const hooks = [];
function register(hook) {
	hooks.push(hook);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/store/useStore.mjs
var import_shim = require_shim();
var import_with_selector = require_with_selector();
const useStoreImplementation = isReactVersionAtLeast(19) ? useStoreFast : useStoreLegacy;
function useStore(store, selector, a1, a2, a3) {
	return useStoreImplementation(store, selector, a1, a2, a3);
}
function useStoreR19(store, selector, a1, a2, a3) {
	const getSelection = react.useCallback(() => selector(store.getSnapshot(), a1, a2, a3), [
		store,
		selector,
		a1,
		a2,
		a3
	]);
	return (0, import_shim.useSyncExternalStore)(store.subscribe, getSelection, getSelection);
}
register({
	before(instance) {
		instance.syncIndex = 0;
		if (!instance.didInitialize) {
			instance.syncTick = 1;
			instance.syncHooks = [];
			instance.didChangeStore = true;
			instance.getSnapshot = () => {
				let didChange = false;
				for (let i = 0; i < instance.syncHooks.length; i += 1) {
					const hook = instance.syncHooks[i];
					const value = hook.selector(hook.store.state, hook.a1, hook.a2, hook.a3);
					if (!Object.is(hook.value, value)) {
						didChange = true;
						hook.value = value;
					}
				}
				if (didChange) instance.syncTick += 1;
				return instance.syncTick;
			};
		}
	},
	after(instance) {
		if (instance.syncHooks.length > 0) {
			if (instance.didChangeStore) {
				instance.didChangeStore = false;
				instance.subscribe = (onStoreChange) => {
					const stores = /* @__PURE__ */ new Set();
					for (const hook of instance.syncHooks) stores.add(hook.store);
					const unsubscribes = [];
					for (const store of stores) unsubscribes.push(store.subscribe(onStoreChange));
					return () => {
						for (const unsubscribe of unsubscribes) unsubscribe();
					};
				};
			}
			(0, import_shim.useSyncExternalStore)(instance.subscribe, instance.getSnapshot, instance.getSnapshot);
		}
	}
});
function useStoreFast(store, selector, a1, a2, a3) {
	return useStoreR19(store, selector, a1, a2, a3);
}
function useStoreLegacy(store, selector, a1, a2, a3) {
	return (0, import_with_selector.useSyncExternalStoreWithSelector)(store.subscribe, store.getSnapshot, store.getSnapshot, (state) => selector(state, a1, a2, a3));
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/store/Store.mjs
/**
* A data store implementation that allows subscribing to state changes and updating the state.
* It uses an observer pattern to notify subscribers when the state changes.
*/
var Store = class {
	/**
	* Creates a store with the given initial state, constructing the class it is called on.
	* Calling it on a generic base class (e.g. `ReactStore.create(...)`) constructs that
	* class but degrades the inferred instance type to `Store`; use `new` there instead.
	*/
	static create(state) {
		return new this(state);
	}
	/**
	* The current state of the store.
	* This property is updated immediately when the state changes as a result of calling {@link setState}, {@link update}, or {@link set}.
	* To subscribe to state changes, use the {@link useState} method. The value returned by {@link useState} is updated after the component renders (similarly to React's useState).
	* The values can be used directly (to avoid subscribing to the store) in effects or event handlers.
	*
	* Do not modify properties in state directly. Instead, use the provided methods to ensure proper state management and listener notification.
	*/
	constructor(state) {
		this.state = state;
		this.listeners = /* @__PURE__ */ new Set();
		this.updateTick = 0;
	}
	/**
	* Registers a listener that will be called whenever the store's state changes.
	*
	* @param fn The listener function to be called on state changes.
	* @returns A function to unsubscribe the listener.
	*/
	subscribe = (fn) => {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	};
	/**
	* Returns the current state of the store.
	*/
	getSnapshot = () => {
		return this.state;
	};
	/**
	* Updates the entire store's state and notifies all registered listeners.
	*
	* @param newState The new state to set for the store.
	*/
	setState(newState) {
		if (this.state === newState) return;
		this.state = newState;
		this.updateTick += 1;
		const currentTick = this.updateTick;
		for (const listener of this.listeners) {
			if (currentTick !== this.updateTick) return;
			listener(newState);
		}
	}
	/**
	* Merges the provided changes into the current state and notifies listeners if there are changes.
	* Each value must match its state key. Pass an exact known subset rather than a broad
	* `Partial<State>`, which may contain `undefined` for required state fields.
	*
	* @param changes An object containing the changes to apply to the current state.
	*/
	update(changes) {
		for (const key in changes) if (!Object.is(this.state[key], changes[key])) {
			this.setState({
				...this.state,
				...changes
			});
			return;
		}
	}
	/**
	* Sets a specific key in the store's state to a new value and notifies listeners if the value has changed.
	*
	* @param key The key in the store's state to update.
	* @param value The new value to set for the specified key.
	*/
	set(key, value) {
		if (!Object.is(this.state[key], value)) this.setState({
			...this.state,
			[key]: value
		});
	}
	/**
	* Gives the state a new reference and updates all registered listeners.
	*/
	notifyAll() {
		const newState = { ...this.state };
		this.setState(newState);
	}
	use(selector, a1, a2, a3) {
		return useStore(this, selector, a1, a2, a3);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/empty.mjs
function NOOP() {}
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/store/ReactStore.mjs
/**
* A Store that supports controlled state keys, non-reactive values and provides utility methods for React.
*/
var ReactStore = class extends Store {
	/**
	* Creates a new ReactStore instance.
	*
	* @param state Initial state of the store.
	* @param context Non-reactive context values.
	* @param selectors Optional selectors for use with `useState`.
	*/
	constructor(state, context = {}, selectors) {
		super(state);
		this.context = context;
		this.selectors = selectors;
	}
	/**
	* Non-reactive values such as refs, callbacks, etc.
	*/
	/**
	* Synchronizes a single external value into the store.
	*
	* Note that the while the value in `state` is updated immediately, the value returned
	* by `useState` is updated before the next render (similarly to React's `useState`).
	*/
	useSyncedValue(key, value) {
		react.useDebugValue(key);
		const store = this;
		useIsoLayoutEffect(() => {
			if (store.state[key] !== value) store.set(key, value);
		}, [
			store,
			key,
			value
		]);
	}
	/**
	* Synchronizes a single external value into the store and
	* cleans it up (sets to `undefined`) on unmount.
	*
	* Note that the while the value in `state` is updated immediately, the value returned
	* by `useState` is updated before the next render (similarly to React's `useState`).
	*/
	useSyncedValueWithCleanup(key, value) {
		const store = this;
		useIsoLayoutEffect(() => {
			if (store.state[key] !== value) store.set(key, value);
			return () => {
				store.set(key, void 0);
			};
		}, [
			store,
			key,
			value
		]);
	}
	/**
	* Synchronizes multiple external values into the store.
	* Each value must match its state key. Pass an exact known subset rather than a broad
	* `Partial<State>`, which may contain `undefined` for required state fields.
	*
	* Note that the while the values in `state` are updated immediately, the values returned
	* by `useState` are updated before the next render (similarly to React's `useState`).
	*
	* @param statePart An exact subset of state fields to synchronize. Unknown keys are not accepted.
	*/
	useSyncedValues(statePart) {
		const store = this;
		const dependencies = Object.values(statePart);
		useIsoLayoutEffect(() => {
			store.update(statePart);
		}, [store, ...dependencies]);
	}
	/**
	* Registers a controllable prop pair (`controlled`, `defaultValue`) for a specific key. If `controlled`
	* is non-undefined, the store's state at `key` is updated to match `controlled`.
	*/
	useControlledProp(key, controlled) {
		react.useDebugValue(key);
		const store = this;
		const isControlled = controlled !== void 0;
		useIsoLayoutEffect(() => {
			if (isControlled && !Object.is(store.state[key], controlled)) store.setState({
				...store.state,
				[key]: controlled
			});
		}, [
			store,
			key,
			controlled,
			isControlled
		]);
	}
	/** Gets the current value from the store using a selector with the provided key.
	*
	* @param key Key of the selector to use.
	*/
	select(key, a1, a2, a3) {
		const selector = this.selectors[key];
		return selector(this.state, a1, a2, a3);
	}
	/**
	* Returns a value from the store's state using a selector function.
	* Used to subscribe to specific parts of the state.
	* This methods causes a rerender whenever the selected state changes.
	*
	* @param key Key of the selector to use.
	*/
	useState(key, a1, a2, a3) {
		react.useDebugValue(key);
		return useStore(this, this.selectors[key], a1, a2, a3);
	}
	/**
	* Wraps a function with `useStableCallback` to ensure it has a stable reference
	* and assigns it to the context.
	*
	* @param key Key of the event callback. Must be a function in the context.
	* @param fn Function to assign.
	*/
	useContextCallback(key, fn) {
		react.useDebugValue(key);
		const stableFunction = useStableCallback(fn ?? NOOP);
		this.context[key] = stableFunction;
	}
	/**
	* Returns a stable setter function for a specific key in the store's state.
	* It's commonly used to pass as a ref callback to React elements.
	*
	* @param key Key of the state to set.
	*/
	useStateSetter(key) {
		const ref = react.useRef(void 0);
		if (ref.current === void 0) ref.current = (value) => {
			this.set(key, value);
		};
		return ref.current;
	}
	/**
	* Observes changes derived from the store's selectors and calls the listener when the selected value changes.
	*
	* @param key Key of the selector to observe.
	* @param listener Listener function called when the selector result changes.
	*/
	observe(selector, listener) {
		let selectFn;
		if (typeof selector === "function") selectFn = selector;
		else selectFn = this.selectors[selector];
		let prevValue = selectFn(this.state);
		listener(prevValue, prevValue, this);
		return this.subscribe((nextState) => {
			const nextValue = selectFn(nextState);
			if (!Object.is(prevValue, nextValue)) {
				const oldValue = prevValue;
				prevValue = nextValue;
				listener(nextValue, oldValue, this);
			}
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@floating-ui+utils@0.2.12/node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs
function hasWindow() {
	return typeof window !== "undefined";
}
function getNodeName(node) {
	if (isNode(node)) return (node.nodeName || "").toLowerCase();
	return "#document";
}
function getWindow(node) {
	var _node$ownerDocument;
	return (node == null || (_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
}
function getDocumentElement(node) {
	var _ref;
	return (_ref = (isNode(node) ? node.ownerDocument : node.document) || window.document) == null ? void 0 : _ref.documentElement;
}
function isNode(value) {
	if (!hasWindow()) return false;
	return value instanceof Node || value instanceof getWindow(value).Node;
}
function isElement(value) {
	if (!hasWindow()) return false;
	return value instanceof Element || value instanceof getWindow(value).Element;
}
function isHTMLElement(value) {
	if (!hasWindow()) return false;
	return value instanceof HTMLElement || value instanceof getWindow(value).HTMLElement;
}
function isShadowRoot(value) {
	if (!hasWindow() || typeof ShadowRoot === "undefined") return false;
	return value instanceof ShadowRoot || value instanceof getWindow(value).ShadowRoot;
}
function isOverflowElement(element) {
	const { overflow, overflowX, overflowY, display } = getComputedStyle$1(element);
	return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) && display !== "inline" && display !== "contents";
}
function isTableElement(element) {
	return /^(table|td|th)$/.test(getNodeName(element));
}
function isTopLayer(element) {
	try {
		if (element.matches(":popover-open")) return true;
	} catch (_e) {}
	try {
		return element.matches(":modal");
	} catch (_e) {
		return false;
	}
}
const willChangeRe = /transform|translate|scale|rotate|perspective|filter/;
const containRe = /paint|layout|strict|content/;
const isNotNone = (value) => !!value && value !== "none";
let isWebKitValue;
function isContainingBlock(elementOrCss) {
	const css = isElement(elementOrCss) ? getComputedStyle$1(elementOrCss) : elementOrCss;
	return isNotNone(css.transform) || isNotNone(css.translate) || isNotNone(css.scale) || isNotNone(css.rotate) || isNotNone(css.perspective) || !isWebKit() && (isNotNone(css.backdropFilter) || isNotNone(css.filter)) || willChangeRe.test(css.willChange || "") || containRe.test(css.contain || "");
}
function getContainingBlock(element) {
	let currentNode = getParentNode(element);
	while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
		if (isContainingBlock(currentNode)) return currentNode;
		else if (isTopLayer(currentNode)) return null;
		currentNode = getParentNode(currentNode);
	}
	return null;
}
function isWebKit() {
	if (isWebKitValue == null) isWebKitValue = typeof CSS !== "undefined" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none");
	return isWebKitValue;
}
function isLastTraversableNode(node) {
	return /^(html|body|#document)$/.test(getNodeName(node));
}
function getComputedStyle$1(element) {
	return getWindow(element).getComputedStyle(element);
}
function getNodeScroll(element) {
	if (isElement(element)) return {
		scrollLeft: element.scrollLeft,
		scrollTop: element.scrollTop
	};
	return {
		scrollLeft: element.scrollX,
		scrollTop: element.scrollY
	};
}
function getParentNode(node) {
	if (getNodeName(node) === "html") return node;
	const result = node.assignedSlot || node.parentNode || isShadowRoot(node) && node.host || getDocumentElement(node);
	return isShadowRoot(result) ? result.host : result;
}
function getNearestOverflowAncestor(node) {
	const parentNode = getParentNode(node);
	if (isLastTraversableNode(parentNode)) return (node.ownerDocument || node).body;
	if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) return parentNode;
	return getNearestOverflowAncestor(parentNode);
}
function getOverflowAncestors(node, list, traverseIframes) {
	var _node$ownerDocument2;
	if (list === void 0) list = [];
	if (traverseIframes === void 0) traverseIframes = true;
	const scrollableAncestor = getNearestOverflowAncestor(node);
	const isBody = scrollableAncestor === ((_node$ownerDocument2 = node.ownerDocument) == null ? void 0 : _node$ownerDocument2.body);
	const win = getWindow(scrollableAncestor);
	if (isBody) {
		const frameElement = getFrameElement(win);
		return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : [], frameElement && traverseIframes ? getOverflowAncestors(frameElement) : []);
	} else return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor, [], traverseIframes));
}
function getFrameElement(win) {
	return win.parent && Object.getPrototypeOf(win.parent) ? win.frameElement : null;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/mergeCleanups.mjs
/**
* Combines multiple cleanup functions into a single cleanup function.
*/
function mergeCleanups(...cleanups) {
	return () => {
		for (let i = 0; i < cleanups.length; i += 1) {
			const cleanup = cleanups[i];
			if (cleanup) cleanup();
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/owner.mjs
function ownerDocument(node) {
	return node?.ownerDocument || document;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/addEventListener.mjs
/**
* Adds an event listener and returns a cleanup function to remove it.
*/
function addEventListener(target, type, listener, options) {
	target.addEventListener(type, listener, options);
	return () => {
		target.removeEventListener(type, listener, options);
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useForcedRerendering.mjs
/**
* Returns a function that forces a rerender.
*/
function useForcedRerendering() {
	const [, setState] = react.useState({});
	return react.useCallback(() => {
		setState({});
	}, []);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useOnMount.mjs
/**
* A React.useEffect equivalent that runs once, when the component is mounted.
*/
function useOnMount(fn) {
	react.useEffect(fn, EMPTY_ARRAY);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useAnimationFrame.mjs
/** Unlike `setTimeout`, rAF doesn't guarantee a positive integer return value, so we can't have
* a monomorphic `uint` type with `0` meaning empty.
* See warning note at:
* https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame#return_value */
const EMPTY$1 = null;
globalThis.requestAnimationFrame;
var Scheduler = class {
	callbacks = [];
	callbacksCount = 0;
	nextId = 1;
	startId = 1;
	isScheduled = false;
	tick = (timestamp) => {
		this.isScheduled = false;
		const currentCallbacks = this.callbacks;
		const currentCallbacksCount = this.callbacksCount;
		this.callbacks = [];
		this.callbacksCount = 0;
		this.startId = this.nextId;
		if (currentCallbacksCount > 0) for (let i = 0; i < currentCallbacks.length; i += 1) currentCallbacks[i]?.(timestamp);
	};
	request(fn) {
		const id = this.nextId;
		this.nextId += 1;
		this.callbacks.push(fn);
		this.callbacksCount += 1;
		if (!this.isScheduled || false) {
			requestAnimationFrame(this.tick);
			this.isScheduled = true;
		}
		return id;
	}
	cancel(id) {
		const index = id - this.startId;
		if (index < 0 || index >= this.callbacks.length) return;
		if (this.callbacks[index] === null) return;
		this.callbacks[index] = null;
		this.callbacksCount -= 1;
	}
};
let scheduler = new Scheduler();
var AnimationFrame = class AnimationFrame {
	static create() {
		return new AnimationFrame();
	}
	static request(fn) {
		return scheduler.request(fn);
	}
	static cancel(id) {
		return scheduler.cancel(id);
	}
	currentId = EMPTY$1;
	/**
	* Executes `fn` after `delay`, clearing any previously scheduled call.
	*/
	request(fn) {
		this.cancel();
		this.currentId = scheduler.request(() => {
			this.currentId = EMPTY$1;
			fn();
		});
	}
	cancel = () => {
		if (this.currentId !== EMPTY$1) {
			scheduler.cancel(this.currentId);
			this.currentId = EMPTY$1;
		}
	};
	disposeEffect = () => {
		return this.cancel;
	};
};
/**
* A `requestAnimationFrame` with automatic cleanup and guard.
*/
function useAnimationFrame() {
	const timeout = useRefWithInit(AnimationFrame.create).current;
	useOnMount(timeout.disposeEffect);
	return timeout;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useTimeout.mjs
const EMPTY = 0;
var Timeout = class Timeout {
	static create() {
		return new Timeout();
	}
	currentId = EMPTY;
	/**
	* Executes `fn` after `delay`, clearing any previously scheduled call.
	*/
	start(delay, fn) {
		this.clear();
		this.currentId = setTimeout(() => {
			this.currentId = EMPTY;
			fn();
		}, delay);
	}
	isStarted() {
		return this.currentId !== EMPTY;
	}
	clear = () => {
		if (this.currentId !== EMPTY) {
			clearTimeout(this.currentId);
			this.currentId = EMPTY;
		}
	};
	disposeEffect = () => {
		return this.clear;
	};
};
/**
* A `setTimeout` with automatic cleanup and guard.
*/
function useTimeout() {
	const timeout = useRefWithInit(Timeout.create).current;
	useOnMount(timeout.disposeEffect);
	return timeout;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/platform/shared.mjs
/**
* Reads `navigator.userAgent` / `navigator.platform` (legacy but universally
* supported) into a normalized shape. In development, prefers the modern
* `navigator.userAgentData` API on Chromium to avoid DevTools warnings about
* the deprecated reads; that branch is dead-code-eliminated in production
* builds to keep the bundle small.
*
* Returns empty/zero values when `navigator` is undefined (SSR), so every
* derived flag safely evaluates to `false`.
*/
function readRawData() {
	if (typeof navigator === "undefined") return {
		userAgent: "",
		platform: "",
		maxTouchPoints: 0
	};
	return {
		userAgent: navigator.userAgent,
		platform: navigator.platform ?? "",
		maxTouchPoints: navigator.maxTouchPoints ?? 0
	};
}
const { userAgent, platform: platform$1, maxTouchPoints } = readRawData();
const lowerUserAgent = userAgent.toLowerCase();
const lowerPlatform = platform$1.toLowerCase();
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/platform/os.mjs
/** iPhone, iPad (including iPadOS 13+ reporting as macOS), iPod. */
const ios = /^i(os$|p)/.test(lowerPlatform) || lowerPlatform === "macintel" && maxTouchPoints > 1;
/** Android phones, tablets, and embedded Android browsers. */
const ANDROID_STRING = "android";
const android = lowerPlatform === ANDROID_STRING || lowerUserAgent.includes(ANDROID_STRING);
/** macOS desktop. Excludes iPadOS, which reports as `MacIntel`. */
const mac = !ios && lowerPlatform.startsWith("mac");
lowerPlatform.startsWith("win");
!android && /^(linux|chrome os)/.test(lowerPlatform);
/** Any Apple OS (`mac || ios`). */
const apple = mac || ios;
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/platform/engine.mjs
/** WebKit: Safari, all iOS browsers, GNOME Web. Excludes Blink. */
const webkit = typeof CSS !== "undefined" && !!CSS.supports?.("-webkit-backdrop-filter:none");
!webkit && lowerUserAgent.includes("firefox");
!webkit && lowerUserAgent.includes("chrom");
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/platform/screen-reader.mjs
/**
* The user *may* be using VoiceOver — actual activation is not detectable.
* True on any Apple platform (macOS, iOS, iPadOS).
*/
const voiceOver = apple;
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/platform/env.mjs
/** Running in jsdom or HappyDOM (used by unit tests). */
const jsdom = /jsdom|happydom/.test(lowerUserAgent);
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/utils/event.mjs
function stopEvent(event) {
	event.preventDefault();
	event.stopPropagation();
}
function isReactEvent(event) {
	return "nativeEvent" in event;
}
function isVirtualClick(event) {
	if (event.pointerType === "" && event.isTrusted) return true;
	if (android && event.pointerType) return event.type === "click" && event.buttons === 1;
	return event.detail === 0 && !event.pointerType;
}
function isVirtualPointerEvent(event) {
	if (jsdom) return false;
	return !android && event.width === 0 && event.height === 0 || event.type === "pointerdown" && event.width === 1 && event.height === 1 && event.pressure === 0 && event.detail === 0 && event.pointerType === "mouse" && (android || event.buttons === 0) || event.width < 1 && event.height < 1 && event.pressure === 0 && event.detail === 0 && event.pointerType === "touch";
}
function isMouseLikePointerType(pointerType, strict) {
	const values = ["mouse", "pen"];
	if (!strict) values.push("", void 0);
	return values.includes(pointerType);
}
function isClickLikeEvent(event) {
	const type = event.type;
	return type === "click" || type === "mousedown" || type === "keydown" || type === "keyup";
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/shadowDom.mjs
function activeElement(doc) {
	let element = doc.activeElement;
	while (element?.shadowRoot?.activeElement != null) element = element.shadowRoot.activeElement;
	return element;
}
function contains(parent, child) {
	if (!parent || !child) return false;
	const rootNode = child.getRootNode?.();
	if (parent.contains(child)) return true;
	if (rootNode && isShadowRoot(rootNode)) {
		let next = child;
		while (next) {
			if (parent === next) return true;
			next = next.parentNode || next.host;
		}
	}
	return false;
}
/**
* Finds the closest matching element in the composed tree, crossing slots and shadow roots.
* `:scope` is not supported.
*/
function closest(node, selector) {
	let current = node;
	while (current) {
		if (isElement(current) && current.matches(selector)) return current;
		current = current.assignedSlot ?? current.parentNode ?? (isShadowRoot(current) ? current.host : null);
	}
	return null;
}
function getTarget(event) {
	if ("composedPath" in event) return event.composedPath()[0] ?? event.target;
	return event.target;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/utils/constants.mjs
const FOCUSABLE_ATTRIBUTE = "data-base-ui-focusable";
const ARROW_LEFT$1 = "ArrowLeft";
const ARROW_RIGHT$1 = "ArrowRight";
const ARROW_UP$1 = "ArrowUp";
const ARROW_DOWN$1 = "ArrowDown";
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/TransitionStatusDataAttributes.mjs
/**
* Present when the component begins animating in.
*/
const startingStyle = "data-starting-style";
/**
* Present when the component is animating out.
*/
const endingStyle = "data-ending-style";
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/stateAttributesMapping.mjs
const STARTING_HOOK = { [startingStyle]: "" };
const ENDING_HOOK = { [endingStyle]: "" };
const transitionStatusMapping = { transitionStatus(value) {
	if (value === "starting") return STARTING_HOOK;
	if (value === "ending") return ENDING_HOOK;
	return null;
} };
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/CommonPopupDataAttributes.mjs
/**
* Present when the popup is open.
*/
const open = "data-open";
/**
* Present when the popup is closed.
*/
const closed = "data-closed";
/**
* Present when the anchor is hidden.
*/
const anchorHidden = "data-anchor-hidden";
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/CommonTriggerDataAttributes.mjs
/**
* Present when the popup is open.
*/
const popupOpen$1 = "data-popup-open";
/**
* Present when a pressable trigger is pressed.
*/
const pressed$1 = "data-pressed";
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/popupStateMapping.mjs
const TRIGGER_HOOK = { [popupOpen$1]: "" };
const PRESSABLE_TRIGGER_HOOK = {
	[popupOpen$1]: "",
	[pressed$1]: ""
};
const POPUP_OPEN_HOOK = { [open]: "" };
const POPUP_CLOSED_HOOK = { [closed]: "" };
const ANCHOR_HIDDEN_HOOK = { [anchorHidden]: "" };
const triggerOpenStateMapping = { open(value) {
	if (value) return TRIGGER_HOOK;
	return null;
} };
const pressableTriggerOpenStateMapping = { open(value) {
	if (value) return PRESSABLE_TRIGGER_HOOK;
	return null;
} };
const popupStateMapping = {
	open(value) {
		if (value) return POPUP_OPEN_HOOK;
		return POPUP_CLOSED_HOOK;
	},
	anchorHidden(value) {
		if (value) return ANCHOR_HIDDEN_HOOK;
		return null;
	}
};
({
	...popupStateMapping,
	...transitionStatusMapping
});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/utils/element.mjs
function isEventTargetWithin(event, node) {
	if (node == null) return false;
	if ("composedPath" in event) return event.composedPath().includes(node);
	const eventAgain = event;
	return eventAgain.target != null && node.contains(eventAgain.target);
}
function isRootElement(element) {
	return element.matches("html,body");
}
function isTypeableElement(element) {
	return isHTMLElement(element) && element.matches("input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])");
}
function isTypeableCombobox(element) {
	if (!element) return false;
	return element.getAttribute("role") === "combobox" && isTypeableElement(element);
}
function getFloatingFocusElement(floatingElement) {
	if (!floatingElement) return null;
	return floatingElement.hasAttribute("data-base-ui-focusable") ? floatingElement : floatingElement.querySelector(`[data-base-ui-focusable]`) || floatingElement;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/createBaseUIEventDetails.mjs
/**
* Maps a change `reason` string to the corresponding native event type.
*/
/**
* Details of custom change events emitted by Base UI components.
*/
/**
* Details of custom generic events emitted by Base UI components.
*/
/** Highlight navigation uses mouse events for hover and pointer events for leaving an item. */
/**
* Creates a Base UI event details object with the given reason and utilities
* for preventing Base UI's internal event handling.
*/
function createChangeEventDetails(reason, event, trigger, customProperties) {
	let canceled = false;
	let allowPropagation = false;
	const custom = customProperties ?? EMPTY_OBJECT;
	return {
		reason,
		event: event ?? new Event("base-ui"),
		cancel() {
			canceled = true;
		},
		allowPropagation() {
			allowPropagation = true;
		},
		get isCanceled() {
			return canceled;
		},
		get isPropagationAllowed() {
			return allowPropagation;
		},
		trigger,
		...custom
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/reason-parts.mjs
const none = "none";
const triggerPress = "trigger-press";
const outsidePress = "outside-press";
const itemPress = "item-press";
const focusOut = "focus-out";
const escapeKey = "escape-key";
const listNavigation = "list-navigation";
const cancelOpen = "cancel-open";
const imperativeAction = "imperative-action";
const windowResize = "window-resize";
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/FocusGuard.mjs
/**
* @internal
*/
const FocusGuard = /*#__PURE__*/ react.forwardRef(function FocusGuard(props, ref) {
	const [role, setRole] = react.useState();
	useIsoLayoutEffect(() => {
		if (voiceOver && webkit) setRole("button");
	}, []);
	const restProps = {
		tabIndex: 0,
		role
	};
	return /*#__PURE__*/ (0, react_jsx_runtime.jsx)("span", {
		...props,
		ref,
		style: visuallyHidden,
		"aria-hidden": role ? void 0 : true,
		...restProps,
		"data-base-ui-focus-guard": ""
	});
});
//#endregion
//#region ../../node_modules/.pnpm/@floating-ui+utils@0.2.12/node_modules/@floating-ui/utils/dist/floating-ui.utils.mjs
const min = Math.min;
const max = Math.max;
const round = Math.round;
const floor = Math.floor;
const createCoords = (v) => ({
	x: v,
	y: v
});
const oppositeSideMap = {
	left: "right",
	right: "left",
	bottom: "top",
	top: "bottom"
};
function clamp$1(start, value, end) {
	return max(start, min(value, end));
}
function evaluate(value, param) {
	return typeof value === "function" ? value(param) : value;
}
function getSide(placement) {
	return placement.split("-")[0];
}
function getAlignment(placement) {
	return placement.split("-")[1];
}
function getOppositeAxis(axis) {
	return axis === "x" ? "y" : "x";
}
function getAxisLength(axis) {
	return axis === "y" ? "height" : "width";
}
function getSideAxis(placement) {
	const firstChar = placement[0];
	return firstChar === "t" || firstChar === "b" ? "y" : "x";
}
function getAlignmentAxis(placement) {
	return getOppositeAxis(getSideAxis(placement));
}
function getAlignmentSides(placement, rects, rtl) {
	if (rtl === void 0) rtl = false;
	const alignment = getAlignment(placement);
	const alignmentAxis = getAlignmentAxis(placement);
	const length = getAxisLength(alignmentAxis);
	let mainAlignmentSide = alignmentAxis === "x" ? alignment === (rtl ? "end" : "start") ? "right" : "left" : alignment === "start" ? "bottom" : "top";
	if (rects.reference[length] > rects.floating[length]) mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
	return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
}
function getExpandedPlacements(placement) {
	const oppositePlacement = getOppositePlacement(placement);
	return [
		getOppositeAlignmentPlacement(placement),
		oppositePlacement,
		getOppositeAlignmentPlacement(oppositePlacement)
	];
}
function getOppositeAlignmentPlacement(placement) {
	return placement.includes("start") ? placement.replace("start", "end") : placement.replace("end", "start");
}
const lrPlacement = ["left", "right"];
const rlPlacement = ["right", "left"];
const tbPlacement = ["top", "bottom"];
const btPlacement = ["bottom", "top"];
function getSideList(side, isStart, rtl) {
	switch (side) {
		case "top":
		case "bottom":
			if (rtl) return isStart ? rlPlacement : lrPlacement;
			return isStart ? lrPlacement : rlPlacement;
		case "left":
		case "right": return isStart ? tbPlacement : btPlacement;
		default: return [];
	}
}
function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
	const alignment = getAlignment(placement);
	let list = getSideList(getSide(placement), direction === "start", rtl);
	if (alignment) {
		list = list.map((side) => side + "-" + alignment);
		if (flipAlignment) list = list.concat(list.map(getOppositeAlignmentPlacement));
	}
	return list;
}
function getOppositePlacement(placement) {
	const side = getSide(placement);
	return oppositeSideMap[side] + placement.slice(side.length);
}
function expandPaddingObject(padding) {
	var _padding$top, _padding$right, _padding$bottom, _padding$left;
	return {
		top: (_padding$top = padding.top) != null ? _padding$top : 0,
		right: (_padding$right = padding.right) != null ? _padding$right : 0,
		bottom: (_padding$bottom = padding.bottom) != null ? _padding$bottom : 0,
		left: (_padding$left = padding.left) != null ? _padding$left : 0
	};
}
function getPaddingObject(padding) {
	return typeof padding !== "number" ? expandPaddingObject(padding) : {
		top: padding,
		right: padding,
		bottom: padding,
		left: padding
	};
}
function rectToClientRect(rect) {
	const { x, y, width, height } = rect;
	return {
		width,
		height,
		top: y,
		left: x,
		right: x + width,
		bottom: y + height,
		x,
		y
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/utils/composite.mjs
function isIndexOutOfListBounds(list, index) {
	return index < 0 || index >= list.length;
}
function getMinListIndex(listRef, disabledIndices) {
	return findNonDisabledListIndex(listRef.current, { disabledIndices });
}
function getMaxListIndex(listRef, disabledIndices) {
	return findNonDisabledListIndex(listRef.current, {
		decrement: true,
		startingIndex: listRef.current.length,
		disabledIndices
	});
}
/**
* The index one arrow step moves the highlight to from `currentIndex`, or `-1` when the step
* leaves the list. `wrapped` reports a jump from one end of the list to the other.
*/
function getNextListIndex(list, currentIndex, options) {
	const { decrement, loopFocus, allowEscape, disabledIndices, minIndex, maxIndex } = options;
	const step = () => findNonDisabledListIndex(list, {
		startingIndex: currentIndex,
		decrement,
		disabledIndices
	});
	let index;
	let wrapped = false;
	if (!loopFocus) index = decrement ? Math.max(minIndex, step()) : Math.min(maxIndex, step());
	else if (decrement ? currentIndex <= minIndex : currentIndex >= maxIndex) {
		const outside = decrement ? -1 : list.length;
		if (allowEscape && currentIndex !== outside) index = -1;
		else {
			index = decrement ? maxIndex : minIndex;
			wrapped = true;
		}
	} else index = step();
	return {
		index: isIndexOutOfListBounds(list, index) ? -1 : index,
		wrapped
	};
}
function findNonDisabledListIndex(list, { startingIndex = -1, decrement = false, disabledIndices, amount = 1 } = {}) {
	let index = startingIndex;
	do
		index += decrement ? -amount : amount;
	while (index >= 0 && index <= list.length - 1 && isListIndexDisabled(list, index, disabledIndices));
	return index;
}
function isListIndexDisabled(list, index, disabledIndices) {
	if (typeof disabledIndices === "function" ? disabledIndices(index) : disabledIndices?.includes(index) ?? false) return true;
	const element = list[index];
	if (!element) return false;
	if (!isElementVisible(element)) return true;
	if (element.matches(":disabled")) return true;
	return !disabledIndices && (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true");
}
function isHiddenByStyles(styles) {
	return styles.visibility === "hidden" || styles.visibility === "collapse";
}
function isElementVisible(element, styles = element ? getComputedStyle$1(element) : null) {
	if (!element || !element.isConnected || !styles || isHiddenByStyles(styles)) return false;
	if (typeof element.checkVisibility === "function") return element.checkVisibility();
	return styles.display !== "none" && styles.display !== "contents";
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/utils/tabbable.mjs
const CANDIDATE_SELECTOR = "a[href],button,input,select,textarea,summary,details,iframe,object,embed,[tabindex],[contenteditable]:not([contenteditable=\"false\"]),audio[controls],video[controls]";
function getParentElement(element) {
	const assignedSlot = element.assignedSlot;
	if (assignedSlot) return assignedSlot;
	if (element.parentElement) return element.parentElement;
	const rootNode = element.getRootNode();
	return isShadowRoot(rootNode) ? rootNode.host : null;
}
function getDetailsSummary(details) {
	for (const child of Array.from(details.children)) if (getNodeName(child) === "summary") return child;
	return null;
}
function isWithinOpenDetailsSummary(element, details) {
	const summary = getDetailsSummary(details);
	return !!summary && (element === summary || contains(summary, element));
}
function isFocusableCandidate(element) {
	const nodeName = element ? getNodeName(element) : "";
	return element != null && element.matches(CANDIDATE_SELECTOR) && (nodeName !== "summary" || element.parentElement != null && getNodeName(element.parentElement) === "details" && getDetailsSummary(element.parentElement) === element) && (nodeName !== "details" || getDetailsSummary(element) == null) && (nodeName !== "input" || element.type !== "hidden");
}
function isFocusableElement(element) {
	if (!isFocusableCandidate(element) || !element.isConnected || element.matches(":disabled")) return false;
	for (let current = element; current; current = getParentElement(current)) {
		const isAncestor = current !== element;
		const isSlot = getNodeName(current) === "slot";
		if (current.hasAttribute("inert")) return false;
		if (isAncestor && getNodeName(current) === "details" && !current.open && !isWithinOpenDetailsSummary(element, current) || current.hasAttribute("hidden") || !isSlot && !isVisibleInTabbableTree(current, isAncestor)) return false;
	}
	return true;
}
function isVisibleInTabbableTree(element, isAncestor) {
	const styles = getComputedStyle$1(element);
	if (!isAncestor) return isElementVisible(element, styles);
	return styles.display !== "none";
}
function getTabIndex(element) {
	const tabIndex = element.tabIndex;
	if (tabIndex < 0) {
		const nodeName = getNodeName(element);
		if (nodeName === "details" || nodeName === "audio" || nodeName === "video" || isHTMLElement(element) && element.isContentEditable) return 0;
	}
	return tabIndex;
}
function getNamedRadioInput(element) {
	if (getNodeName(element) !== "input") return null;
	const input = element;
	return input.type === "radio" && input.name !== "" ? input : null;
}
function isTabbableRadio(element, candidates) {
	const input = getNamedRadioInput(element);
	if (!input) return true;
	const checkedRadio = candidates.find((candidate) => {
		const radio = getNamedRadioInput(candidate);
		return radio?.name === input.name && radio.form === input.form && radio.checked;
	});
	if (checkedRadio) return checkedRadio === input;
	return candidates.find((candidate) => {
		const radio = getNamedRadioInput(candidate);
		return radio?.name === input.name && radio.form === input.form;
	}) === input;
}
function getComposedChildren(container) {
	if (isHTMLElement(container) && getNodeName(container) === "slot") {
		const assignedElements = container.assignedElements({ flatten: true });
		if (assignedElements.length > 0) return assignedElements;
	}
	if (isHTMLElement(container) && container.shadowRoot) return Array.from(container.shadowRoot.children);
	return Array.from(container.children);
}
function appendCandidates(container, list) {
	getComposedChildren(container).forEach((child) => {
		if (isFocusableCandidate(child)) list.push(child);
		appendCandidates(child, list);
	});
}
function appendMatchingElements(container, selector, list) {
	getComposedChildren(container).forEach((child) => {
		if (isHTMLElement(child) && child.matches(selector)) list.push(child);
		appendMatchingElements(child, selector, list);
	});
}
function isTabbable(element) {
	return isFocusableElement(element) && getTabIndex(element) >= 0;
}
function focusable(container) {
	const candidates = [];
	appendCandidates(container, candidates);
	return candidates.filter(isFocusableElement);
}
function tabbable(container) {
	const candidates = focusable(container);
	return candidates.filter((element) => getTabIndex(element) >= 0 && isTabbableRadio(element, candidates));
}
function getTabbableIn(container, dir) {
	const list = tabbable(container);
	const len = list.length;
	if (len === 0) return;
	const active = activeElement(ownerDocument(container));
	const index = list.indexOf(active);
	return list[index === -1 ? dir === 1 ? 0 : len - 1 : index + dir];
}
function getNextTabbable(referenceElement) {
	return getTabbableIn(ownerDocument(referenceElement).body, 1) || referenceElement;
}
function getPreviousTabbable(referenceElement) {
	return getTabbableIn(ownerDocument(referenceElement).body, -1) || referenceElement;
}
function isOutsideEvent(event, container) {
	const containerElement = container || event.currentTarget;
	const relatedTarget = event.relatedTarget;
	return !relatedTarget || !contains(containerElement, relatedTarget);
}
function disableFocusInside(container) {
	tabbable(container).forEach((element) => {
		element.dataset.tabindex = element.getAttribute("tabindex") || "";
		element.setAttribute("tabindex", "-1");
	});
}
function enableFocusInside(container) {
	const elements = [];
	appendMatchingElements(container, "[data-tabindex]", elements);
	elements.forEach((element) => {
		const tabindex = element.dataset.tabindex;
		delete element.dataset.tabindex;
		if (tabindex) element.setAttribute("tabindex", tabindex);
		else element.removeAttribute("tabindex");
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/utils/nodes.mjs
function getNodeChildren(nodes, id, onlyOpenChildren = true) {
	return nodes.filter((node) => node.parentId === id).flatMap((child) => [...!onlyOpenChildren || child.context?.open ? [child] : [], ...getNodeChildren(nodes, child.id, onlyOpenChildren)]);
}
function getNodeAncestors(nodes, id) {
	let allAncestors = [];
	let currentParentId = nodes.find((node) => node.id === id)?.parentId;
	while (currentParentId) {
		const currentNode = nodes.find((node) => node.id === currentParentId);
		currentParentId = currentNode?.parentId;
		if (currentNode) allAncestors = allAncestors.concat(currentNode);
	}
	return allAncestors;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/utils/createAttribute.mjs
function createAttribute(name) {
	return `data-base-ui-${name}`;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/utils/enqueueFocus.mjs
let rafId = 0;
function enqueueFocus(el, options = {}) {
	const { preventScroll = false, sync = false, shouldFocus } = options;
	cancelAnimationFrame(rafId);
	function exec() {
		if (shouldFocus && !shouldFocus()) return;
		el?.focus({ preventScroll });
	}
	if (sync) {
		exec();
		return NOOP;
	}
	const currentRafId = requestAnimationFrame(exec);
	rafId = currentRafId;
	return () => {
		if (rafId === currentRafId) {
			cancelAnimationFrame(currentRafId);
			rafId = 0;
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/utils/markOthers.mjs
const markerName = "data-base-ui-inert";
let ariaHiddenCounterMap = /* @__PURE__ */ new WeakMap();
let uncontrolledElementsSet = /* @__PURE__ */ new WeakSet();
let markerCounterMap = /* @__PURE__ */ new WeakMap();
let lockCount = 0;
function unwrapHost(node) {
	if (!node) return null;
	return isShadowRoot(node) ? node.host : unwrapHost(node.parentNode);
}
const correctElements = (parent, targets) => targets.map((target) => {
	if (parent.contains(target)) return target;
	const correctedTarget = unwrapHost(target);
	if (parent.contains(correctedTarget)) return correctedTarget;
	return null;
}).filter((x) => x != null);
const buildKeepSet = (targets) => {
	const keep = /* @__PURE__ */ new Set();
	targets.forEach((target) => {
		let node = target;
		while (node && !keep.has(node)) {
			keep.add(node);
			node = node.parentNode;
		}
	});
	return keep;
};
const collectOutsideElements = (root, keepElements, stopElements) => {
	const outside = [];
	const walk = (parent) => {
		if (!parent || stopElements.has(parent)) return;
		Array.from(parent.children).forEach((node) => {
			if (getNodeName(node) === "script") return;
			if (keepElements.has(node)) walk(node);
			else outside.push(node);
		});
	};
	walk(root);
	return outside;
};
function applyAttributeToOthers(uncorrectedAvoidElements, body, ariaHidden, { mark = true }) {
	const avoidElements = correctElements(body, uncorrectedAvoidElements);
	const markerTargets = mark ? collectOutsideElements(body, buildKeepSet(avoidElements), new Set(avoidElements)) : [];
	const hiddenElements = [];
	const markedElements = [];
	if (ariaHidden) {
		const ariaLiveElements = correctElements(body, Array.from(body.querySelectorAll("[aria-live]")));
		const controlElements = avoidElements.concat(ariaLiveElements);
		collectOutsideElements(body, buildKeepSet(controlElements), new Set(controlElements)).forEach((node) => {
			const attr = node.getAttribute("aria-hidden");
			const alreadyHidden = attr !== null && attr !== "false";
			const counterValue = (ariaHiddenCounterMap.get(node) || 0) + 1;
			ariaHiddenCounterMap.set(node, counterValue);
			hiddenElements.push(node);
			if (counterValue === 1 && alreadyHidden) uncontrolledElementsSet.add(node);
			if (!alreadyHidden) node.setAttribute("aria-hidden", "true");
		});
	}
	if (mark) markerTargets.forEach((node) => {
		const markerValue = (markerCounterMap.get(node) || 0) + 1;
		markerCounterMap.set(node, markerValue);
		markedElements.push(node);
		if (markerValue === 1) node.setAttribute(markerName, "");
	});
	lockCount += 1;
	return () => {
		hiddenElements.forEach((element) => {
			const counterValue = (ariaHiddenCounterMap.get(element) || 0) - 1;
			ariaHiddenCounterMap.set(element, counterValue);
			if (!counterValue) {
				if (!uncontrolledElementsSet.has(element)) element.removeAttribute("aria-hidden");
				uncontrolledElementsSet.delete(element);
			}
		});
		if (mark) markedElements.forEach((element) => {
			const markerValue = (markerCounterMap.get(element) || 0) - 1;
			markerCounterMap.set(element, markerValue);
			if (!markerValue) element.removeAttribute(markerName);
		});
		lockCount -= 1;
		if (!lockCount) {
			ariaHiddenCounterMap = /* @__PURE__ */ new WeakMap();
			uncontrolledElementsSet = /* @__PURE__ */ new WeakSet();
			markerCounterMap = /* @__PURE__ */ new WeakMap();
		}
	};
}
function markOthers(avoidElements, options = {}) {
	const { ariaHidden = false, mark = true } = options;
	const body = ownerDocument(avoidElements[0]).body;
	return applyAttributeToOthers(avoidElements, body, ariaHidden, { mark });
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useId.mjs
let globalId = 0;
function useGlobalId(idOverride, prefix = "mui") {
	const defaultId = react.useRef(void 0);
	const forceRerender = useForcedRerendering();
	const id = idOverride ?? defaultId.current;
	react.useEffect(() => {
		if (defaultId.current == null) {
			globalId += 1;
			defaultId.current = `${prefix}-${globalId}`;
			if (idOverride == null) forceRerender();
		}
	}, [
		idOverride,
		prefix,
		forceRerender
	]);
	return id;
}
const maybeReactUseId = SafeReact.useId;
/**
*
* @example <div id={useId()} />
* @param {string | undefined} idOverride overrides the generated id when provided
* @param {string | undefined} prefix prefixes the generated id when provided
* @returns {string | undefined}
*/
function useId$2(idOverride, prefix) {
	if (maybeReactUseId !== void 0) {
		const reactId = maybeReactUseId();
		return idOverride ?? (prefix ? `${prefix}-${reactId}` : reactId);
	}
	return useGlobalId(idOverride, prefix);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/getReactElementRef.mjs
/**
* Extracts the `ref` from a React element, handling different React versions.
*/
function getReactElementRef(element) {
	if (!/*#__PURE__*/ react.isValidElement(element)) return null;
	const reactElement = element;
	const propsWithRef = reactElement.props;
	return (isReactVersionAtLeast(19) ? propsWithRef?.ref : reactElement.ref) ?? null;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/mergeObjects.mjs
function mergeObjects(a, b) {
	if (a && !b) return a;
	if (!a && b) return b;
	if (a || b) return {
		...a,
		...b
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/getStateAttributesProps.mjs
function getStateAttributesProps(state, customMapping) {
	const props = {};
	for (const key in state) {
		const value = state[key];
		if (customMapping?.hasOwnProperty(key)) {
			const customProps = customMapping[key](value);
			if (customProps != null) Object.assign(props, customProps);
			continue;
		}
		if (value === true) props[`data-${key.toLowerCase()}`] = "";
		else if (value) props[`data-${key.toLowerCase()}`] = value.toString();
	}
	return props;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/resolveClassName.mjs
/**
* If the provided className is a string, it will be returned as is.
* Otherwise, the function will call the className function with the state as the first argument.
*
* @param className
* @param state
*/
function resolveClassName(className, state) {
	return typeof className === "function" ? className(state) : className;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/resolveStyle.mjs
/**
* If the provided style is an object, it will be returned as is.
* Otherwise, the function will call the style function with the state as the first argument.
*
* @param style
* @param state
*/
function resolveStyle(style, state) {
	return typeof style === "function" ? style(state) : style;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/merge-props/mergeProps.mjs
const EMPTY_PROPS = {};
/**
* Merges multiple sets of React props. It follows the Object.assign pattern where the rightmost object's fields overwrite
* the conflicting ones from others. This doesn't apply to event handlers, `className` and `style` props.
*
* Event handlers are merged and called in right-to-left order (rightmost handler executes first, leftmost last).
* For React synthetic events, the rightmost handler can prevent prior (left-positioned) handlers from executing
* by calling `event.preventBaseUIHandler()`. For non-synthetic events (custom events with primitive/object values),
* all handlers always execute without prevention capability.
*
* The `className` prop is merged by concatenating classes in right-to-left order (rightmost class appears first in the string).
* The `style` prop is merged with rightmost styles overwriting the prior ones.
*
* Props can either be provided as objects or as functions that take the previous props as an argument.
* The function will receive the merged props up to that point (going from left to right):
* so in the case of `(obj1, obj2, fn, obj3)`, `fn` will receive the merged props of `obj1` and `obj2`.
* The function is responsible for chaining event handlers if needed (that is, we don't run the merge logic).
*
* Event handlers returned by the functions are not automatically prevented when `preventBaseUIHandler` is called.
* They must check `event.baseUIHandlerPrevented` themselves and bail out if it's true.
*
* @important **`ref` is not merged.**
* @param a Props object to merge.
* @param b Props object to merge. The function will overwrite conflicting props from `a`.
* @param c Props object to merge. The function will overwrite conflicting props from previous parameters.
* @param d Props object to merge. The function will overwrite conflicting props from previous parameters.
* @param e Props object to merge. The function will overwrite conflicting props from previous parameters.
* @returns The merged props.
* @public
*/
function mergeProps(a, b, c, d, e) {
	if (!c && !d && !e && !a) return createInitialMergedProps(b);
	let merged = createInitialMergedProps(a);
	if (b) merged = mergeInto(merged, b);
	if (c) merged = mergeInto(merged, c);
	if (d) merged = mergeInto(merged, d);
	if (e) merged = mergeInto(merged, e);
	return merged;
}
/**
* Merges an arbitrary number of React props using the same logic as {@link mergeProps}.
* This function accepts an array of props instead of individual arguments.
*
* This has slightly lower performance than {@link mergeProps} due to accepting an array
* instead of a fixed number of arguments. Prefer {@link mergeProps} when merging 5 or
* fewer prop sets for better performance.
*
* @param props Array of props to merge.
* @returns The merged props.
* @see mergeProps
* @public
*/
function mergePropsN(props) {
	if (props.length === 0) return EMPTY_PROPS;
	if (props.length === 1) return createInitialMergedProps(props[0]);
	let merged = createInitialMergedProps(props[0]);
	for (let i = 1; i < props.length; i += 1) merged = mergeInto(merged, props[i]);
	return merged;
}
function createInitialMergedProps(inputProps) {
	if (isPropsGetter(inputProps)) return { ...inputProps(EMPTY_PROPS) };
	return copyInitialProps(inputProps);
}
function mergeInto(merged, inputProps) {
	if (isPropsGetter(inputProps)) return inputProps(merged);
	return mutablyMergeInto(merged, inputProps);
}
function copyInitialProps(inputProps) {
	const copiedProps = { ...inputProps };
	for (const propName in copiedProps) {
		const propValue = copiedProps[propName];
		if (isEventHandler(propName, propValue)) copiedProps[propName] = wrapEventHandler(propValue);
	}
	return copiedProps;
}
/**
* Merges two sets of props. In case of conflicts, the external props take precedence.
*/
function mutablyMergeInto(mergedProps, externalProps) {
	if (!externalProps) return mergedProps;
	for (const propName in externalProps) {
		const externalPropValue = externalProps[propName];
		switch (propName) {
			case "style":
				mergedProps[propName] = mergeObjects(mergedProps.style, externalPropValue);
				break;
			case "className":
				mergedProps[propName] = mergeClassNames(mergedProps.className, externalPropValue);
				break;
			default: if (isEventHandler(propName, externalPropValue)) mergedProps[propName] = mergeEventHandlers(mergedProps[propName], externalPropValue);
			else mergedProps[propName] = externalPropValue;
		}
	}
	return mergedProps;
}
function isEventHandler(key, value) {
	const code0 = key.charCodeAt(0);
	const code1 = key.charCodeAt(1);
	const code2 = key.charCodeAt(2);
	return code0 === 111 && code1 === 110 && code2 >= 65 && code2 <= 90 && (typeof value === "function" || typeof value === "undefined");
}
function isPropsGetter(inputProps) {
	return typeof inputProps === "function";
}
function mergeEventHandlers(ourHandler, theirHandler) {
	if (!theirHandler) return ourHandler;
	if (!ourHandler) return wrapEventHandler(theirHandler);
	return (...args) => {
		const event = args[0];
		if (isSyntheticEvent(event)) {
			const baseUIEvent = event;
			makeEventPreventable(baseUIEvent);
			const result = theirHandler(...args);
			if (!baseUIEvent.baseUIHandlerPrevented) ourHandler?.(...args);
			return result;
		}
		const result = theirHandler(...args);
		ourHandler?.(...args);
		return result;
	};
}
function wrapEventHandler(handler) {
	if (!handler) return handler;
	return (...args) => {
		const event = args[0];
		if (isSyntheticEvent(event)) makeEventPreventable(event);
		return handler(...args);
	};
}
function makeEventPreventable(event) {
	event.preventBaseUIHandler = () => {
		event.baseUIHandlerPrevented = true;
	};
	return event;
}
function mergeClassNames(ourClassName, theirClassName) {
	if (theirClassName) {
		if (ourClassName) return theirClassName + " " + ourClassName;
		return theirClassName;
	}
	return ourClassName;
}
function isSyntheticEvent(event) {
	return event != null && typeof event === "object" && "nativeEvent" in event;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/useRenderElement.mjs
/**
* Renders a Base UI element.
*
* @param element The default HTML element to render. Can be overridden by the `render` prop.
* @param componentProps An object containing the `render` and `className` props to be used for element customization. Other props are ignored.
* @param params Additional parameters for rendering the element.
*/
function useRenderElement(element, componentProps, params = {}) {
	let renderProp = componentProps.render;
	if (params.enabled !== false) renderProp = unwrapLazyRenderProp(renderProp);
	const outProps = useRenderElementProps(componentProps, params, renderProp);
	if (params.enabled === false) return null;
	const state = params.state ?? EMPTY_OBJECT;
	return evaluateRenderProp(element, renderProp, outProps, state);
}
/**
* Computes render element final props.
*/
function useRenderElementProps(componentProps, params, renderProp) {
	const { className: classNameProp, style: styleProp } = componentProps;
	const { state = EMPTY_OBJECT, ref, props, stateAttributesMapping, enabled = true } = params;
	const className = enabled ? resolveClassName(classNameProp, state) : void 0;
	const style = enabled ? resolveStyle(styleProp, state) : void 0;
	const stateProps = enabled ? getStateAttributesProps(state, stateAttributesMapping) : EMPTY_OBJECT;
	const resolvedProps = enabled && props ? resolveRenderFunctionProps(props) : void 0;
	const outProps = enabled ? mergeObjects(stateProps, resolvedProps) ?? {} : EMPTY_OBJECT;
	if (typeof document !== "undefined") {
		if (!enabled) useMergedRefs(null, null);
		else if (Array.isArray(ref)) outProps.ref = useMergedRefsN([
			outProps.ref,
			getReactElementRef(renderProp),
			...ref
		]);
		else outProps.ref = useMergedRefs(outProps.ref, getReactElementRef(renderProp), ref);
	}
	if (!enabled) return EMPTY_OBJECT;
	if (className !== void 0) outProps.className = mergeClassNames(outProps.className, className);
	if (style !== void 0) outProps.style = mergeObjects(outProps.style, style);
	return outProps;
}
function resolveRenderFunctionProps(props) {
	if (Array.isArray(props)) return mergePropsN(props);
	return mergeProps(void 0, props);
}
const REACT_LAZY_TYPE = Symbol.for("react.lazy");
function unwrapLazyRenderProp(render) {
	if (render?.$$typeof !== REACT_LAZY_TYPE) return render;
	const unwrapped = react.Children.toArray(render)[0];
	return /*#__PURE__*/ react.isValidElement(unwrapped) ? unwrapped : render;
}
function evaluateRenderProp(element, render, props, state) {
	if (render) {
		if (typeof render === "function") return render(props, state);
		const mergedProps = mergeProps(props, render.props);
		mergedProps.ref = props.ref;
		return /*#__PURE__*/ react.cloneElement(render, mergedProps);
	}
	return renderTag(element, props);
}
function renderTag(Tag, props) {
	if (Tag === "button") return /*#__PURE__*/ (0, react.createElement)("button", {
		type: "button",
		...props,
		key: props.key
	});
	if (Tag === "img") return /*#__PURE__*/ (0, react.createElement)("img", {
		alt: "",
		...props,
		key: props.key
	});
	return /*#__PURE__*/ react.createElement(Tag, props);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/constants.mjs
const DISABLED_TRANSITIONS_STYLE = { style: { transition: "none" } };
/**
* Used for dropdowns that usually strictly prefer top/bottom placements and
* use `var(--available-height)` to limit their height.
*/
const DROPDOWN_COLLISION_AVOIDANCE = { fallbackAxisSide: "none" };
/**
* Special visually hidden styles for the aria-owns owner element to ensure owned element
* accessibility in iOS/Safari/VoiceControl.
* The owner element is an empty span, so most of the common visually hidden styles are not needed.
* @see https://github.com/floating-ui/floating-ui/issues/3403
*/
const ownerVisuallyHidden = {
	clipPath: "inset(50%)",
	position: "fixed",
	top: 0,
	left: 0
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/components/FloatingPortal.mjs
const PortalContext = /*#__PURE__*/ react.createContext(null);
const usePortalContext = () => react.useContext(PortalContext);
const attr = createAttribute("portal");
function useFloatingPortalNode(props = {}) {
	const { ref, container: containerProp, componentProps = EMPTY_OBJECT, elementProps } = props;
	const uniqueId = useId$2();
	const parentPortalNode = usePortalContext()?.portalNode;
	const [containerElement, setContainerElement] = react.useState(null);
	const [portalNode, setPortalNode] = react.useState(null);
	const setPortalNodeRef = useStableCallback((node) => {
		if (node !== null) setPortalNode(node);
	});
	const containerRef = react.useRef(null);
	useIsoLayoutEffect(() => {
		if (containerProp === null) {
			if (containerRef.current) {
				containerRef.current = null;
				setPortalNode(null);
				setContainerElement(null);
			}
			return;
		}
		const resolvedContainer = (containerProp && (isNode(containerProp) ? containerProp : containerProp.current)) ?? parentPortalNode ?? document.body;
		if (resolvedContainer == null) {
			if (containerRef.current) {
				containerRef.current = null;
				setPortalNode(null);
				setContainerElement(null);
			}
			return;
		}
		if (containerRef.current !== resolvedContainer) {
			containerRef.current = resolvedContainer;
			setPortalNode(null);
			setContainerElement(resolvedContainer);
		}
	}, [containerProp, parentPortalNode]);
	const portalElement = useRenderElement("div", componentProps, {
		ref: [ref, setPortalNodeRef],
		props: [{
			id: uniqueId,
			[attr]: ""
		}, elementProps]
	});
	const portalSubtree = containerElement && portalElement ? /*#__PURE__*/ react_dom.createPortal(portalElement, containerElement) : null;
	return {
		node: portalNode,
		nodeId: /*#__PURE__*/ react.isValidElement(portalElement) ? portalElement.props.id : void 0,
		subtree: portalSubtree
	};
}
/**
* Portals the floating element into a given container element — by default,
* outside of the app root and into the body.
* This is necessary to ensure the floating element can appear outside any
* potential parent containers that cause clipping (such as `overflow: hidden`),
* while retaining its location in the React tree.
* @see https://floating-ui.com/docs/FloatingPortal
* @internal
*/
const FloatingPortal = /*#__PURE__*/ react.forwardRef(function FloatingPortal(componentProps, forwardedRef) {
	const { render, className, style, children, container, portalOwnerRole, ...elementProps } = componentProps;
	const { node: portalNode, nodeId: portalNodeId, subtree: portalSubtree } = useFloatingPortalNode({
		container,
		ref: forwardedRef,
		componentProps,
		elementProps
	});
	const beforeOutsideRef = react.useRef(null);
	const afterOutsideRef = react.useRef(null);
	const beforeInsideRef = react.useRef(null);
	const afterInsideRef = react.useRef(null);
	const [focusManagerState, setFocusManagerState] = react.useState(null);
	const focusInsideDisabledRef = react.useRef(false);
	const modal = focusManagerState?.modal;
	const open = focusManagerState?.open;
	const shouldRenderGuards = !!focusManagerState && !focusManagerState.modal && focusManagerState.open && !!portalNode;
	react.useEffect(() => {
		if (!portalNode || modal) return;
		function onFocus(event) {
			if (portalNode && event.relatedTarget && isOutsideEvent(event)) {
				if (event.type === "focusin") {
					if (focusInsideDisabledRef.current) {
						enableFocusInside(portalNode);
						focusInsideDisabledRef.current = false;
					}
				} else {
					disableFocusInside(portalNode);
					focusInsideDisabledRef.current = true;
				}
			}
		}
		return mergeCleanups(addEventListener(portalNode, "focusin", onFocus, true), addEventListener(portalNode, "focusout", onFocus, true));
	}, [portalNode, modal]);
	useIsoLayoutEffect(() => {
		if (!portalNode || open !== true || !focusInsideDisabledRef.current) return;
		enableFocusInside(portalNode);
		focusInsideDisabledRef.current = false;
	}, [open, portalNode]);
	const portalContextValue = react.useMemo(() => ({
		beforeOutsideRef,
		afterOutsideRef,
		beforeInsideRef,
		afterInsideRef,
		portalNode,
		setFocusManagerState
	}), [portalNode]);
	return /*#__PURE__*/ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [portalSubtree, /*#__PURE__*/ (0, react_jsx_runtime.jsxs)(PortalContext.Provider, {
		value: portalContextValue,
		children: [
			shouldRenderGuards && portalNode && /*#__PURE__*/ (0, react_jsx_runtime.jsx)(FocusGuard, {
				"data-type": "outside",
				ref: beforeOutsideRef,
				onFocus: (event) => {
					if (isOutsideEvent(event, portalNode)) beforeInsideRef.current?.focus();
					else getPreviousTabbable(focusManagerState ? focusManagerState.domReference : null)?.focus();
				}
			}),
			shouldRenderGuards && portalNode && /*#__PURE__*/ (0, react_jsx_runtime.jsx)("span", {
				role: portalOwnerRole,
				"aria-owns": portalNodeId,
				style: ownerVisuallyHidden
			}),
			portalNode && /*#__PURE__*/ react_dom.createPortal(children, portalNode),
			shouldRenderGuards && portalNode && /*#__PURE__*/ (0, react_jsx_runtime.jsx)(FocusGuard, {
				"data-type": "outside",
				ref: afterOutsideRef,
				onFocus: (event) => {
					if (isOutsideEvent(event, portalNode)) afterInsideRef.current?.focus();
					else {
						getNextTabbable(focusManagerState ? focusManagerState.domReference : null)?.focus();
						if (focusManagerState?.closeOnFocusOut) focusManagerState?.onOpenChange(false, createChangeEventDetails("focus-out", event.nativeEvent));
					}
				}
			})
		]
	})] });
});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/utils/createEventEmitter.mjs
function createEventEmitter() {
	const map = /* @__PURE__ */ new Map();
	return {
		emit(event, data) {
			map.get(event)?.forEach((listener) => listener(data));
		},
		on(event, listener) {
			if (!map.has(event)) map.set(event, /* @__PURE__ */ new Set());
			map.get(event).add(listener);
		},
		off(event, listener) {
			map.get(event)?.delete(listener);
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/components/FloatingTree.mjs
const FloatingNodeContext = /*#__PURE__*/ react.createContext(null);
const FloatingTreeContext = /*#__PURE__*/ react.createContext(null);
const useFloatingParentNodeId = () => react.useContext(FloatingNodeContext)?.id || null;
/**
* Returns the nearest floating tree context, if available.
*/
const useFloatingTree = (externalTree) => {
	const contextTree = react.useContext(FloatingTreeContext);
	return externalTree ?? contextTree;
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/resolveRef.mjs
/**
* If the provided argument is a ref object, returns its `current` value.
* Otherwise, returns the argument itself.
*/
function resolveRef(maybeRef) {
	if (maybeRef == null) return maybeRef;
	return "current" in maybeRef ? maybeRef.current : maybeRef;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/components/FloatingFocusManager.mjs
function getEventType(event, lastInteractionType) {
	const win = getWindow(getTarget(event));
	if (event instanceof win.KeyboardEvent) return "keyboard";
	if (event instanceof win.FocusEvent) return lastInteractionType || "keyboard";
	if ("pointerType" in event) return event.pointerType || (isVirtualClick(event) ? "keyboard" : lastInteractionType || "mouse");
	if ("touches" in event) return "touch";
	if (event instanceof win.MouseEvent) return lastInteractionType || (event.detail === 0 ? "keyboard" : "mouse");
	return "";
}
const LIST_LIMIT = 20;
let previouslyFocusedElements = [];
function clearDisconnectedPreviouslyFocusedElements() {
	previouslyFocusedElements = previouslyFocusedElements.filter((entry) => {
		return entry.deref()?.isConnected;
	});
}
function addPreviouslyFocusedElement(element) {
	clearDisconnectedPreviouslyFocusedElements();
	if (element && getNodeName(element) !== "body") {
		previouslyFocusedElements.push(new WeakRef(element));
		if (previouslyFocusedElements.length > LIST_LIMIT) previouslyFocusedElements = previouslyFocusedElements.slice(-20);
	}
}
function getPreviouslyFocusedElement() {
	clearDisconnectedPreviouslyFocusedElements();
	return previouslyFocusedElements[previouslyFocusedElements.length - 1]?.deref();
}
function getFirstTabbableElement(container) {
	if (!container) return null;
	if (isTabbable(container)) return container;
	return tabbable(container)[0] || container;
}
function handleTabIndex(floatingFocusElement) {
	if (floatingFocusElement.hasAttribute("tabindex") && !floatingFocusElement.hasAttribute("data-tabindex")) return;
	if (!floatingFocusElement.getAttribute("role")?.includes("dialog")) return;
	const tabbableContent = focusable(floatingFocusElement).filter((element) => {
		const dataTabIndex = element.getAttribute("data-tabindex") || "";
		return isTabbable(element) || element.hasAttribute("data-tabindex") && !dataTabIndex.startsWith("-");
	});
	const tabIndex = floatingFocusElement.getAttribute("tabindex");
	if (tabbableContent.length === 0) {
		if (tabIndex !== "0") {
			floatingFocusElement.setAttribute("tabindex", "0");
			floatingFocusElement.setAttribute("data-tabindex", "0");
		}
	} else if (tabIndex !== "-1" || floatingFocusElement.hasAttribute("data-tabindex") && floatingFocusElement.getAttribute("data-tabindex") !== "-1") {
		floatingFocusElement.setAttribute("tabindex", "-1");
		floatingFocusElement.setAttribute("data-tabindex", "-1");
	}
}
/**
* Provides focus management for the floating element.
* @see https://floating-ui.com/docs/FloatingFocusManager
* @internal
*/
function FloatingFocusManager(props) {
	const { context: store, children, disabled = false, initialFocus = true, returnFocus = true, explicitReturnFocus, restoreFocus = false, modal = true, closeOnFocusOut = true, openInteractionType = "", nextFocusableElement, previousFocusableElement, beforeContentFocusGuardRef, externalTree, getInsideElements } = props;
	const open = store.useState("open");
	const domReference = store.useState("domReferenceElement");
	const floating = store.useState("floatingElement");
	const { events, dataRef } = store.context;
	const getNodeId = useStableCallback(() => dataRef.current.floatingContext?.nodeId);
	const ignoreInitialFocus = initialFocus === false;
	const isUntrappedTypeableCombobox = isTypeableCombobox(domReference) && ignoreInitialFocus;
	const initialFocusRef = useValueAsRef(initialFocus);
	const returnFocusRef = useValueAsRef(returnFocus);
	const explicitReturnFocusRef = useValueAsRef(explicitReturnFocus);
	const openInteractionTypeRef = useValueAsRef(openInteractionType);
	const openRef = useValueAsRef(open);
	const tree = useFloatingTree(externalTree);
	const portalContext = usePortalContext();
	const preventReturnFocusRef = react.useRef(false);
	const isPointerDownRef = react.useRef(false);
	const pointerDownOutsideRef = react.useRef(false);
	const lastFocusedTabbableRef = react.useRef(null);
	const closeTypeRef = react.useRef("");
	const lastInteractionTypeRef = react.useRef("");
	const beforeGuardRef = react.useRef(null);
	const afterGuardRef = react.useRef(null);
	const mergedBeforeGuardRef = useMergedRefs(beforeGuardRef, beforeContentFocusGuardRef, portalContext?.beforeInsideRef);
	const mergedAfterGuardRef = useMergedRefs(afterGuardRef, portalContext?.afterInsideRef);
	const blurTimeout = useTimeout();
	const pointerDownTimeout = useTimeout();
	const restoreFocusFrame = useAnimationFrame();
	const isInsidePortal = portalContext != null;
	const floatingFocusElement = getFloatingFocusElement(floating);
	const getTabbableContent = useStableCallback((container = floatingFocusElement) => {
		return container ? tabbable(container) : [];
	});
	const getResolvedInsideElements = useStableCallback(() => getInsideElements?.().filter((element) => element != null) ?? []);
	react.useEffect(() => {
		if (disabled || !modal) return;
		function onKeyDown(event) {
			if (event.key === "Tab") {
				if (contains(floatingFocusElement, activeElement(ownerDocument(floatingFocusElement))) && getTabbableContent().length === 0 && !isUntrappedTypeableCombobox) stopEvent(event);
			}
		}
		return addEventListener(ownerDocument(floatingFocusElement), "keydown", onKeyDown);
	}, [
		disabled,
		floatingFocusElement,
		modal,
		isUntrappedTypeableCombobox,
		getTabbableContent
	]);
	react.useEffect(() => {
		if (disabled || !open) return;
		const doc = ownerDocument(floatingFocusElement);
		function clearPointerDownOutside() {
			pointerDownOutsideRef.current = false;
		}
		function onPointerDown(event) {
			const target = getTarget(event);
			const insideElements = getResolvedInsideElements();
			const pointerTargetInside = contains(floating, target) || contains(domReference, target) || contains(portalContext?.portalNode, target) || insideElements.some((element) => element === target || contains(element, target));
			pointerDownOutsideRef.current = !pointerTargetInside;
			lastInteractionTypeRef.current = event.pointerType || "keyboard";
			if (closest(target, `[data-base-ui-click-trigger]`)) {
				isPointerDownRef.current = true;
				pointerDownTimeout.start(0, () => {
					isPointerDownRef.current = false;
				});
			}
		}
		function onKeyDown() {
			lastInteractionTypeRef.current = "keyboard";
		}
		return mergeCleanups(addEventListener(doc, "pointerdown", onPointerDown, true), addEventListener(doc, "pointerup", clearPointerDownOutside, true), addEventListener(doc, "pointercancel", clearPointerDownOutside, true), addEventListener(doc, "keydown", onKeyDown, true), clearPointerDownOutside);
	}, [
		disabled,
		floating,
		domReference,
		floatingFocusElement,
		open,
		portalContext,
		pointerDownTimeout,
		getResolvedInsideElements
	]);
	react.useEffect(() => {
		if (disabled || !closeOnFocusOut) return;
		const doc = ownerDocument(floatingFocusElement);
		function handlePointerDown() {
			isPointerDownRef.current = true;
			pointerDownTimeout.start(0, () => {
				isPointerDownRef.current = false;
			});
		}
		function handleFocusIn(event) {
			const target = getTarget(event);
			if (isTabbable(target)) lastFocusedTabbableRef.current = target;
		}
		function handleFocusOutside(event) {
			const relatedTarget = event.relatedTarget;
			const currentTarget = event.currentTarget;
			const target = getTarget(event);
			if (modal && relatedTarget == null && target != null && contains(floating, target)) addPreviouslyFocusedElement(target);
			queueMicrotask(() => {
				const nodeId = getNodeId();
				const triggers = store.context.triggerElements;
				const insideElements = getResolvedInsideElements();
				const isRelatedFocusGuard = relatedTarget?.hasAttribute(createAttribute("focus-guard")) && [
					beforeGuardRef.current,
					afterGuardRef.current,
					portalContext?.beforeInsideRef.current,
					portalContext?.afterInsideRef.current,
					portalContext?.beforeOutsideRef.current,
					portalContext?.afterOutsideRef.current,
					resolveRef(previousFocusableElement),
					resolveRef(nextFocusableElement)
				].includes(relatedTarget);
				const movedToUnrelatedNode = !(contains(domReference, relatedTarget) || contains(floating, relatedTarget) || contains(relatedTarget, floating) || contains(portalContext?.portalNode, relatedTarget) || insideElements.some((element) => element === relatedTarget || contains(element, relatedTarget)) || triggers.hasMatchingElement((trigger) => contains(trigger, relatedTarget)) || isRelatedFocusGuard || tree && (getNodeChildren(tree.nodesRef.current, nodeId).find((node) => contains(node.context?.elements.floating, relatedTarget) || contains(node.context?.elements.domReference, relatedTarget)) || getNodeAncestors(tree.nodesRef.current, nodeId).find((node) => [node.context?.elements.floating, getFloatingFocusElement(node.context?.elements.floating)].includes(relatedTarget) || node.context?.elements.domReference === relatedTarget)));
				if (currentTarget === domReference && floatingFocusElement) handleTabIndex(floatingFocusElement);
				if (restoreFocus && currentTarget !== domReference && !isElementVisible(target) && activeElement(doc) === doc.body) {
					if (isHTMLElement(floatingFocusElement)) {
						floatingFocusElement.focus();
						if (restoreFocus === "popup") {
							restoreFocusFrame.request(() => {
								floatingFocusElement.focus();
							});
							return;
						}
					}
					const tabbableContent = getTabbableContent();
					const prevTabbable = lastFocusedTabbableRef.current;
					const nodeToFocus = (prevTabbable && tabbableContent.includes(prevTabbable) ? prevTabbable : null) || tabbableContent[tabbableContent.length - 1] || floatingFocusElement;
					if (isHTMLElement(nodeToFocus)) nodeToFocus.focus();
				}
				if (dataRef.current.insideReactTree) {
					dataRef.current.insideReactTree = false;
					return;
				}
				if ((isUntrappedTypeableCombobox ? true : !modal) && relatedTarget && movedToUnrelatedNode && !isPointerDownRef.current && (isUntrappedTypeableCombobox || relatedTarget !== getPreviouslyFocusedElement())) {
					preventReturnFocusRef.current = true;
					store.setOpen(false, createChangeEventDetails(focusOut, event));
				}
			});
		}
		function markInsideReactTree() {
			if (pointerDownOutsideRef.current) return;
			dataRef.current.insideReactTree = true;
			blurTimeout.start(0, () => {
				dataRef.current.insideReactTree = false;
			});
		}
		const domReferenceElement = isHTMLElement(domReference) ? domReference : null;
		if (!floating && !domReferenceElement) return;
		return mergeCleanups(domReferenceElement && addEventListener(domReferenceElement, "focusout", handleFocusOutside), domReferenceElement && addEventListener(domReferenceElement, "pointerdown", handlePointerDown), floating && addEventListener(floating, "focusin", handleFocusIn), floating && addEventListener(floating, "focusout", handleFocusOutside), floating && portalContext && addEventListener(floating, "focusout", markInsideReactTree, true));
	}, [
		disabled,
		domReference,
		floating,
		floatingFocusElement,
		modal,
		tree,
		portalContext,
		store,
		closeOnFocusOut,
		restoreFocus,
		getTabbableContent,
		isUntrappedTypeableCombobox,
		getNodeId,
		dataRef,
		blurTimeout,
		pointerDownTimeout,
		restoreFocusFrame,
		nextFocusableElement,
		previousFocusableElement,
		getResolvedInsideElements
	]);
	react.useEffect(() => {
		if (disabled || !floating || !open) return;
		const portalNodes = Array.from(portalContext?.portalNode?.querySelectorAll(`[${createAttribute("portal")}]`) || []);
		const rootAncestorComboboxDomReference = (tree ? getNodeAncestors(tree.nodesRef.current, getNodeId()) : []).find((node) => isTypeableCombobox(node.context?.elements.domReference || null))?.context?.elements.domReference;
		const ariaHiddenCleanup = markOthers([
			...[
				floating,
				...portalNodes,
				beforeGuardRef.current,
				afterGuardRef.current,
				portalContext?.beforeOutsideRef.current,
				portalContext?.afterOutsideRef.current,
				...getResolvedInsideElements()
			],
			rootAncestorComboboxDomReference,
			resolveRef(previousFocusableElement),
			resolveRef(nextFocusableElement),
			isUntrappedTypeableCombobox ? domReference : null
		].filter((x) => x != null), {
			ariaHidden: modal || isUntrappedTypeableCombobox,
			mark: false
		});
		const markerCleanup = markOthers([floating, ...portalNodes].filter((x) => x != null));
		return () => {
			markerCleanup();
			ariaHiddenCleanup();
		};
	}, [
		open,
		disabled,
		domReference,
		floating,
		modal,
		portalContext,
		isUntrappedTypeableCombobox,
		tree,
		getNodeId,
		nextFocusableElement,
		previousFocusableElement,
		getResolvedInsideElements
	]);
	useIsoLayoutEffect(() => {
		if (!open || disabled || !isHTMLElement(floatingFocusElement)) return;
		closeTypeRef.current = "";
		lastInteractionTypeRef.current = "";
		const doc = ownerDocument(floatingFocusElement);
		const previouslyFocusedElement = activeElement(doc);
		queueMicrotask(() => {
			const initialFocusValueOrFn = initialFocusRef.current;
			const resolvedInitialFocus = typeof initialFocusValueOrFn === "function" ? initialFocusValueOrFn(openInteractionTypeRef.current || "") : initialFocusValueOrFn;
			if (resolvedInitialFocus === void 0 || resolvedInitialFocus === false) return;
			if (contains(floatingFocusElement, previouslyFocusedElement)) return;
			let focusableElements = null;
			const getDefaultFocusElement = () => {
				if (focusableElements == null) focusableElements = getTabbableContent(floatingFocusElement);
				return focusableElements[0] || floatingFocusElement;
			};
			let elToFocus;
			if (resolvedInitialFocus === true || resolvedInitialFocus === null) elToFocus = getDefaultFocusElement();
			else elToFocus = resolveRef(resolvedInitialFocus);
			elToFocus = elToFocus || getDefaultFocusElement();
			const hadFocusInside = contains(floatingFocusElement, activeElement(doc));
			const openEvent = dataRef.current.openEvent;
			const openedByVirtualPress = openEvent?.type === "mousedown" && isVirtualClick(openEvent);
			enqueueFocus(elToFocus, {
				sync: openedByVirtualPress,
				preventScroll: elToFocus === floatingFocusElement,
				shouldFocus() {
					if (!openRef.current) return false;
					if (hadFocusInside) return true;
					const currentActiveElement = activeElement(doc);
					return !(currentActiveElement !== elToFocus && contains(floatingFocusElement, currentActiveElement));
				}
			});
		});
	}, [
		disabled,
		open,
		floatingFocusElement,
		getTabbableContent,
		initialFocusRef,
		openInteractionTypeRef,
		openRef,
		dataRef
	]);
	const pendingReturnFocusRef = react.useRef(null);
	useIsoLayoutEffect(() => {
		if (disabled || !floatingFocusElement) {
			pendingReturnFocusRef.current = null;
			return;
		}
		if (pendingReturnFocusRef.current) {
			pendingReturnFocusRef.current.cancelled = true;
			pendingReturnFocusRef.current = null;
		}
		const doc = ownerDocument(floatingFocusElement);
		const elementFocusedBeforeOpen = activeElement(doc);
		const preferPreviousFocus = openInteractionTypeRef.current == null;
		addPreviouslyFocusedElement(elementFocusedBeforeOpen);
		function onOpenChangeLocal(details) {
			if (!details.open) closeTypeRef.current = getEventType(details.nativeEvent, lastInteractionTypeRef.current);
			if (details.reason === "focus-out" && details.triggerElement?.hasAttribute(createAttribute("focus-guard")) || details.reason === "trigger-hover" && details.nativeEvent.type === "mouseleave") preventReturnFocusRef.current = true;
			if (details.reason !== "outside-press") return;
			if (details.nested) preventReturnFocusRef.current = false;
			else if (isVirtualClick(details.nativeEvent) || isVirtualPointerEvent(details.nativeEvent)) preventReturnFocusRef.current = false;
			else {
				let isPreventScrollSupported = false;
				ownerDocument(floatingFocusElement).createElement("div").focus({ get preventScroll() {
					isPreventScrollSupported = true;
					return false;
				} });
				if (isPreventScrollSupported) preventReturnFocusRef.current = false;
				else preventReturnFocusRef.current = true;
			}
		}
		events.on("openchange", onOpenChangeLocal);
		function getReturnElement(closeType) {
			const returnFocusValueOrFn = returnFocusRef.current;
			let resolvedReturnFocusValue = typeof returnFocusValueOrFn === "function" ? returnFocusValueOrFn(closeType) : returnFocusValueOrFn;
			if (resolvedReturnFocusValue === void 0 || resolvedReturnFocusValue === false) return null;
			if (resolvedReturnFocusValue === null) resolvedReturnFocusValue = true;
			const referenceReturnElement = domReference?.isConnected ? domReference : null;
			const previousReturnElement = elementFocusedBeforeOpen?.isConnected && getNodeName(elementFocusedBeforeOpen) !== "body" ? elementFocusedBeforeOpen : null;
			let defaultReturnElement = preferPreviousFocus ? previousReturnElement || referenceReturnElement : referenceReturnElement || previousReturnElement;
			if (!defaultReturnElement) defaultReturnElement = getPreviouslyFocusedElement() || null;
			if (typeof resolvedReturnFocusValue === "boolean") return defaultReturnElement;
			return resolveRef(resolvedReturnFocusValue) || defaultReturnElement || null;
		}
		return () => {
			events.off("openchange", onOpenChangeLocal);
			const activeEl = activeElement(doc);
			const insideElements = getResolvedInsideElements();
			const isFocusInsideFloatingTree = contains(floating, activeEl) || insideElements.some((element) => element === activeEl || contains(element, activeEl)) || tree && getNodeChildren(tree.nodesRef.current, getNodeId(), false).some((node) => contains(node.context?.elements.floating, activeEl));
			const returnFocusValueOrFn = returnFocusRef.current;
			const closeType = closeTypeRef.current;
			const returnElement = getReturnElement(closeType);
			const job = { cancelled: false };
			pendingReturnFocusRef.current = job;
			queueMicrotask(() => {
				if (pendingReturnFocusRef.current === job) pendingReturnFocusRef.current = null;
				const tabbableReturnElement = getFirstTabbableElement(returnElement);
				const hasExplicitReturnFocus = explicitReturnFocusRef.current ?? typeof returnFocusValueOrFn !== "boolean";
				if (!job.cancelled && returnFocusValueOrFn && !preventReturnFocusRef.current && isHTMLElement(tabbableReturnElement) && (!hasExplicitReturnFocus && tabbableReturnElement !== activeEl && activeEl !== doc.body ? isFocusInsideFloatingTree : true)) {
					const focusOptions = { preventScroll: true };
					if (closeType === "keyboard") focusOptions.focusVisible = true;
					tabbableReturnElement.focus(focusOptions);
				}
				preventReturnFocusRef.current = false;
			});
		};
	}, [
		disabled,
		floating,
		floatingFocusElement,
		returnFocusRef,
		explicitReturnFocusRef,
		openInteractionTypeRef,
		events,
		tree,
		domReference,
		getNodeId,
		getResolvedInsideElements
	]);
	useIsoLayoutEffect(() => {
		if (!webkit || open || !floating) return;
		const activeEl = activeElement(ownerDocument(floating));
		if (!isHTMLElement(activeEl) || !isTypeableElement(activeEl)) return;
		if (contains(floating, activeEl)) activeEl.blur();
	}, [open, floating]);
	useIsoLayoutEffect(() => {
		if (disabled || !portalContext) return;
		portalContext.setFocusManagerState({
			modal,
			closeOnFocusOut,
			open,
			onOpenChange: store.setOpen,
			domReference
		});
		return () => {
			portalContext.setFocusManagerState(null);
		};
	}, [
		disabled,
		portalContext,
		modal,
		open,
		store,
		closeOnFocusOut,
		domReference
	]);
	useIsoLayoutEffect(() => {
		if (disabled || !floatingFocusElement) return;
		handleTabIndex(floatingFocusElement);
		return () => {
			queueMicrotask(clearDisconnectedPreviouslyFocusedElements);
		};
	}, [disabled, floatingFocusElement]);
	const shouldRenderGuards = !disabled && (modal ? !isUntrappedTypeableCombobox : true) && (isInsidePortal || modal);
	return /*#__PURE__*/ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [
		shouldRenderGuards && /*#__PURE__*/ (0, react_jsx_runtime.jsx)(FocusGuard, {
			"data-type": "inside",
			ref: mergedBeforeGuardRef,
			onFocus: (event) => {
				if (modal) {
					const els = getTabbableContent();
					enqueueFocus(els[els.length - 1]);
				} else if (portalContext?.portalNode) {
					preventReturnFocusRef.current = false;
					if (isOutsideEvent(event, portalContext.portalNode)) getNextTabbable(domReference)?.focus();
					else resolveRef(previousFocusableElement ?? portalContext.beforeOutsideRef)?.focus();
				}
			}
		}),
		children,
		shouldRenderGuards && /*#__PURE__*/ (0, react_jsx_runtime.jsx)(FocusGuard, {
			"data-type": "inside",
			ref: mergedAfterGuardRef,
			onFocus: (event) => {
				if (modal) enqueueFocus(getTabbableContent()[0]);
				else if (portalContext?.portalNode) {
					if (closeOnFocusOut) preventReturnFocusRef.current = true;
					if (isOutsideEvent(event, portalContext.portalNode)) getPreviousTabbable(domReference)?.focus();
					else resolveRef(nextFocusableElement ?? portalContext.afterOutsideRef)?.focus();
				}
			}
		})
	] });
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/hooks/useClick.mjs
/**
* Opens or closes the floating element when clicking the reference element.
* @see https://floating-ui.com/docs/useClick
*/
function useClick(store, props = {}) {
	const { enabled = true, event: eventOption = "click", toggle = true, ignoreMouse = false, stickIfOpen = true, touchOpenDelay = 0, reason = triggerPress } = props;
	const dataRef = store.context.dataRef;
	const pointerTypeRef = react.useRef(void 0);
	const frame = useAnimationFrame();
	const touchOpenTimeout = useTimeout();
	const reference = react.useMemo(() => {
		function setOpenWithTouchDelay(nextOpen, nativeEvent, target, pointerType) {
			const details = createChangeEventDetails(reason, nativeEvent, target);
			if (nextOpen && pointerType === "touch" && touchOpenDelay > 0) touchOpenTimeout.start(touchOpenDelay, () => {
				store.setOpen(true, details);
			});
			else store.setOpen(nextOpen, details);
		}
		function getNextOpen(open, currentTarget, isClickLikeOpenEvent) {
			const openEvent = dataRef.current.openEvent;
			const hasClickedOnInactiveTrigger = store.select("domReferenceElement") !== currentTarget;
			if (open && hasClickedOnInactiveTrigger) return true;
			if (!open) return true;
			if (!toggle) return true;
			if (openEvent && (typeof stickIfOpen === "function" ? stickIfOpen() : stickIfOpen)) return !isClickLikeOpenEvent(openEvent.type);
			return false;
		}
		return {
			onPointerDown(event) {
				pointerTypeRef.current = isMouseLikePointerType(event.pointerType, true) && isVirtualPointerEvent(event.nativeEvent) ? "virtual" : event.pointerType;
			},
			onMouseDown(event) {
				const pointerType = pointerTypeRef.current;
				const nativeEvent = event.nativeEvent;
				const open = store.select("open");
				if (event.button !== 0 || eventOption === "click" || isMouseLikePointerType(pointerType, true) && ignoreMouse) return;
				const nextOpen = getNextOpen(open, event.currentTarget, (openEventType) => openEventType === "click" || openEventType === "mousedown");
				const target = getTarget(nativeEvent);
				const isTypeable = isTypeableElement(target);
				if (isTypeable || pointerType === "virtual") {
					setOpenWithTouchDelay(nextOpen, nativeEvent, isTypeable ? target : event.currentTarget, pointerType);
					return;
				}
				const eventCurrentTarget = event.currentTarget;
				frame.request(() => {
					setOpenWithTouchDelay(nextOpen, nativeEvent, eventCurrentTarget, pointerType);
				});
			},
			onClick(event) {
				if (eventOption === "mousedown-only") return;
				const pointerType = pointerTypeRef.current;
				if (eventOption === "mousedown" && pointerType) {
					pointerTypeRef.current = void 0;
					return;
				}
				if (isMouseLikePointerType(pointerType, true) && ignoreMouse) return;
				setOpenWithTouchDelay(getNextOpen(store.select("open"), event.currentTarget, (openEventType) => openEventType === "click" || openEventType === "mousedown" || openEventType === "keydown" || openEventType === "keyup"), event.nativeEvent, event.currentTarget, pointerType);
			},
			onKeyDown() {
				pointerTypeRef.current = void 0;
			}
		};
	}, [
		dataRef,
		eventOption,
		ignoreMouse,
		reason,
		store,
		stickIfOpen,
		toggle,
		frame,
		touchOpenTimeout,
		touchOpenDelay
	]);
	return react.useMemo(() => enabled ? { reference } : EMPTY_OBJECT, [enabled, reference]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.mjs
function alwaysFalse() {
	return false;
}
function normalizeProp(normalizable) {
	return {
		escapeKey: typeof normalizable === "boolean" ? normalizable : normalizable?.escapeKey ?? false,
		outsidePress: typeof normalizable === "boolean" ? normalizable : normalizable?.outsidePress ?? true
	};
}
/**
* Closes the floating element when a dismissal is requested — by default, when
* the user presses the `escape` key or outside of the floating element.
* @see https://floating-ui.com/docs/useDismiss
*/
function useDismiss(store, props = {}) {
	const { enabled = true, escapeKey: escapeKey$1 = true, outsidePress: outsidePressProp = true, outsidePressEvent = "sloppy", referencePress = alwaysFalse, bubbles, externalTree } = props;
	const open = store.useState("open");
	const floatingElement = store.useState("floatingElement");
	const { dataRef, events } = store.context;
	const tree = useFloatingTree(externalTree);
	const outsidePressFn = useStableCallback(typeof outsidePressProp === "function" ? outsidePressProp : () => false);
	const outsidePress$1 = typeof outsidePressProp === "function" ? outsidePressFn : outsidePressProp;
	const outsidePressEnabled = outsidePress$1 !== false;
	const getOutsidePressEventProp = useStableCallback(() => outsidePressEvent);
	const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp(bubbles);
	const pressStartedInsideRef = react.useRef(false);
	const pressStartPreventedRef = react.useRef(false);
	const suppressNextOutsideClickRef = react.useRef(false);
	const sawPressWhileOpenRef = react.useRef(false);
	const isComposingRef = react.useRef(false);
	const currentPointerTypeRef = react.useRef("");
	const touchStateRef = react.useRef(null);
	const cancelDismissOnEndTimeout = useTimeout();
	const clearInsideReactTreeTimeout = useTimeout();
	const compositionTimeout = useTimeout();
	const clearInsideReactTree = useStableCallback(() => {
		clearInsideReactTreeTimeout.clear();
		dataRef.current.insideReactTree = false;
	});
	const hasBlockingChild = useStableCallback((bubbleKey) => {
		const nodeId = dataRef.current.floatingContext?.nodeId;
		return (tree ? getNodeChildren(tree.nodesRef.current, nodeId) : []).some((child) => child.context?.open && !child.context.dataRef.current[bubbleKey]);
	});
	const isEventWithinOwnElements = useStableCallback((event) => {
		return isEventTargetWithin(event, store.select("floatingElement")) || isEventTargetWithin(event, store.select("domReferenceElement"));
	});
	const closeOnReferencePress = useStableCallback((event) => {
		if (!referencePress()) return;
		store.setOpen(false, createChangeEventDetails(triggerPress, event.nativeEvent));
	});
	const closeOnEscapeKeyDown = useStableCallback((event) => {
		if (!open || !enabled || !escapeKey$1 || event.key !== "Escape") return;
		const native = isReactEvent(event) ? event.nativeEvent : event;
		if (isComposingRef.current || native.isComposing) return;
		if (!escapeKeyBubbles && hasBlockingChild("__escapeKeyBubbles")) return;
		const eventDetails = createChangeEventDetails(escapeKey, native);
		store.setOpen(false, eventDetails);
		if (!eventDetails.isCanceled) event.preventDefault();
		if (!escapeKeyBubbles && !eventDetails.isPropagationAllowed) event.stopPropagation();
	});
	const markInsideReactTree = useStableCallback(() => {
		dataRef.current.insideReactTree = true;
		clearInsideReactTreeTimeout.start(0, clearInsideReactTree);
	});
	const markPressStartedInsideReactTree = useStableCallback((event) => {
		if (!open || !enabled || event.button !== 0) return;
		const target = getTarget(event.nativeEvent);
		if (!contains(store.select("floatingElement"), target)) return;
		if (!pressStartedInsideRef.current) {
			pressStartedInsideRef.current = true;
			pressStartPreventedRef.current = false;
		}
	});
	const markInsidePressStartPrevented = useStableCallback((event) => {
		if (!open || !enabled) return;
		if (!(event.defaultPrevented || event.nativeEvent.defaultPrevented)) return;
		if (pressStartedInsideRef.current) pressStartPreventedRef.current = true;
	});
	react.useEffect(() => {
		function handleOpenChange(details) {
			if (!details.open) sawPressWhileOpenRef.current = false;
		}
		events.on("openchange", handleOpenChange);
		return () => {
			events.off("openchange", handleOpenChange);
		};
	}, [events]);
	react.useEffect(() => clearInsideReactTree, [clearInsideReactTree]);
	react.useEffect(() => {
		if (!open || !enabled) {
			if (!open) {
				sawPressWhileOpenRef.current = false;
				isComposingRef.current = false;
				currentPointerTypeRef.current = "";
				touchStateRef.current = null;
			}
			return clearInsideReactTree;
		}
		dataRef.current.__escapeKeyBubbles = escapeKeyBubbles;
		dataRef.current.__outsidePressBubbles = outsidePressBubbles;
		const preventedPressSuppressionTimeout = new Timeout();
		const doc = ownerDocument(floatingElement);
		function handleCompositionStart() {
			compositionTimeout.clear();
			isComposingRef.current = true;
		}
		function handleCompositionEnd() {
			isComposingRef.current = true;
			compositionTimeout.start(webkit ? 5 : 0, () => {
				isComposingRef.current = false;
			});
		}
		function suppressImmediateOutsideClickAfterPreventedStart() {
			suppressNextOutsideClickRef.current = true;
			preventedPressSuppressionTimeout.start(0, () => {
				suppressNextOutsideClickRef.current = false;
			});
		}
		function resetPressStartState() {
			pressStartedInsideRef.current = false;
			pressStartPreventedRef.current = false;
		}
		function getOutsidePressEvent() {
			const type = currentPointerTypeRef.current;
			const computedType = type === "pen" || !type ? "mouse" : type;
			const outsidePressEventValue = getOutsidePressEventProp();
			const resolved = typeof outsidePressEventValue === "function" ? outsidePressEventValue() : outsidePressEventValue;
			if (typeof resolved === "string") return resolved;
			return resolved[computedType];
		}
		function shouldIgnoreEvent(event) {
			const computedOutsidePressEvent = getOutsidePressEvent();
			return computedOutsidePressEvent === "intentional" && event.type !== "click" || computedOutsidePressEvent === "sloppy" && event.type === "click";
		}
		function isEventWithinFloatingTree(event) {
			const nodeId = dataRef.current.floatingContext?.nodeId;
			const targetIsInsideChildren = tree && getNodeChildren(tree.nodesRef.current, nodeId).some((node) => isEventTargetWithin(event, node.context?.elements.floating));
			return isEventWithinOwnElements(event) || targetIsInsideChildren;
		}
		function closeOnPressOutside(event) {
			if (shouldIgnoreEvent(event)) {
				if (event.type !== "click" && !isEventWithinOwnElements(event)) {
					preventedPressSuppressionTimeout.clear();
					suppressNextOutsideClickRef.current = false;
				}
				clearInsideReactTree();
				return;
			}
			if (dataRef.current.insideReactTree) {
				clearInsideReactTree();
				return;
			}
			const target = getTarget(event);
			const inertSelector = `[${createAttribute("inert")}]`;
			const targetRoot = isElement(target) ? target.getRootNode() : null;
			const markers = Array.from((isShadowRoot(targetRoot) ? targetRoot : ownerDocument(store.select("floatingElement"))).querySelectorAll(inertSelector));
			const triggers = store.context.triggerElements;
			if (target && (triggers.hasElement(target) || triggers.hasMatchingElement((trigger) => contains(trigger, target)))) return;
			let targetRootAncestor = isElement(target) ? target : null;
			while (targetRootAncestor && !isLastTraversableNode(targetRootAncestor)) {
				const nextParent = getParentNode(targetRootAncestor);
				if (isLastTraversableNode(nextParent) || !isElement(nextParent)) break;
				targetRootAncestor = nextParent;
			}
			if (markers.length && isElement(target) && !isRootElement(target) && !contains(target, store.select("floatingElement")) && markers.every((marker) => !contains(targetRootAncestor, marker))) return;
			if (isHTMLElement(target) && !("touches" in event)) {
				const lastTraversableNode = isLastTraversableNode(target);
				const style = getComputedStyle$1(target);
				const scrollRe = /auto|scroll/;
				const isScrollableX = lastTraversableNode || scrollRe.test(style.overflowX);
				const isScrollableY = lastTraversableNode || scrollRe.test(style.overflowY);
				const canScrollX = isScrollableX && target.clientWidth > 0 && target.scrollWidth > target.clientWidth;
				const canScrollY = isScrollableY && target.clientHeight > 0 && target.scrollHeight > target.clientHeight;
				const isRTL = style.direction === "rtl";
				const pressedVerticalScrollbar = canScrollY && (isRTL ? event.offsetX <= target.offsetWidth - target.clientWidth : event.offsetX > target.clientWidth);
				const pressedHorizontalScrollbar = canScrollX && event.offsetY > target.clientHeight;
				if (pressedVerticalScrollbar || pressedHorizontalScrollbar) return;
			}
			if (isEventWithinFloatingTree(event)) return;
			if (getOutsidePressEvent() === "intentional") {
				if (event.detail !== 0 && !isVirtualClick(event) && !sawPressWhileOpenRef.current) return;
				if (suppressNextOutsideClickRef.current) {
					preventedPressSuppressionTimeout.clear();
					suppressNextOutsideClickRef.current = false;
					return;
				}
			}
			if (typeof outsidePress$1 === "function" && !outsidePress$1(event)) return;
			if (hasBlockingChild("__outsidePressBubbles")) return;
			store.setOpen(false, createChangeEventDetails(outsidePress, event));
			clearInsideReactTree();
		}
		function handlePointerDown(event) {
			if (getOutsidePressEvent() !== "sloppy" || event.pointerType === "touch" || !store.select("open") || !enabled || isEventWithinOwnElements(event)) return;
			closeOnPressOutside(event);
		}
		function handleTouchStart(event) {
			if (getOutsidePressEvent() !== "sloppy" || !store.select("open") || !enabled || isEventWithinOwnElements(event)) return;
			const touch = event.touches[0];
			if (touch) {
				touchStateRef.current = {
					startTime: Date.now(),
					startX: touch.clientX,
					startY: touch.clientY,
					dismissOnTouchEnd: false,
					dismissOnMouseDown: true
				};
				cancelDismissOnEndTimeout.start(1e3, () => {
					if (touchStateRef.current) {
						touchStateRef.current.dismissOnTouchEnd = false;
						touchStateRef.current.dismissOnMouseDown = false;
					}
				});
			}
		}
		function addTargetEventListenerOnce(event, listener) {
			const target = getTarget(event);
			if (!target) return;
			const unsubscribe = addEventListener(target, event.type, () => {
				listener(event);
				unsubscribe();
			});
		}
		function handleTouchStartCapture(event) {
			currentPointerTypeRef.current = "touch";
			addTargetEventListenerOnce(event, handleTouchStart);
		}
		function closeOnPressOutsideCapture(event) {
			cancelDismissOnEndTimeout.clear();
			if (event.type === "pointerdown") {
				if (event.button === 0) sawPressWhileOpenRef.current = true;
				currentPointerTypeRef.current = event.pointerType;
			}
			if (event.type === "mousedown" && touchStateRef.current && !touchStateRef.current.dismissOnMouseDown) return;
			addTargetEventListenerOnce(event, (targetEvent) => {
				if (targetEvent.type === "pointerdown") handlePointerDown(targetEvent);
				else closeOnPressOutside(targetEvent);
			});
		}
		function handlePressEndCapture(event) {
			if (event.type === "pointercancel") sawPressWhileOpenRef.current = false;
			if (!pressStartedInsideRef.current) return;
			const pressStartedInsideDefaultPrevented = pressStartPreventedRef.current;
			resetPressStartState();
			if (getOutsidePressEvent() !== "intentional") return;
			if (event.type === "pointercancel") {
				if (pressStartedInsideDefaultPrevented) suppressImmediateOutsideClickAfterPreventedStart();
				return;
			}
			if (isEventWithinFloatingTree(event)) return;
			if (pressStartedInsideDefaultPrevented) {
				suppressImmediateOutsideClickAfterPreventedStart();
				return;
			}
			if (typeof outsidePress$1 === "function" && !outsidePress$1(event)) return;
			preventedPressSuppressionTimeout.clear();
			suppressNextOutsideClickRef.current = true;
			clearInsideReactTree();
		}
		function handleTouchMove(event) {
			if (getOutsidePressEvent() !== "sloppy" || !touchStateRef.current || isEventWithinOwnElements(event)) return;
			const touch = event.touches[0];
			if (!touch) return;
			const deltaX = Math.abs(touch.clientX - touchStateRef.current.startX);
			const deltaY = Math.abs(touch.clientY - touchStateRef.current.startY);
			const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
			if (distance > 5) touchStateRef.current.dismissOnTouchEnd = true;
			if (distance > 10) {
				closeOnPressOutside(event);
				cancelDismissOnEndTimeout.clear();
				touchStateRef.current = null;
			}
		}
		function handleTouchMoveCapture(event) {
			addTargetEventListenerOnce(event, handleTouchMove);
		}
		function handleTouchEnd(event) {
			if (getOutsidePressEvent() !== "sloppy" || !touchStateRef.current || isEventWithinOwnElements(event)) return;
			if (touchStateRef.current.dismissOnTouchEnd) closeOnPressOutside(event);
			cancelDismissOnEndTimeout.clear();
			touchStateRef.current = null;
		}
		function handleTouchEndCapture(event) {
			addTargetEventListenerOnce(event, handleTouchEnd);
		}
		const unsubscribe = mergeCleanups(escapeKey$1 && mergeCleanups(addEventListener(doc, "keydown", closeOnEscapeKeyDown), addEventListener(doc, "compositionstart", handleCompositionStart), addEventListener(doc, "compositionend", handleCompositionEnd)), outsidePressEnabled && mergeCleanups(addEventListener(doc, "click", closeOnPressOutsideCapture, true), addEventListener(doc, "pointerdown", closeOnPressOutsideCapture, true), addEventListener(doc, "pointerup", handlePressEndCapture, true), addEventListener(doc, "pointercancel", handlePressEndCapture, true), addEventListener(doc, "mousedown", closeOnPressOutsideCapture, true), addEventListener(doc, "mouseup", handlePressEndCapture, true), addEventListener(doc, "touchstart", handleTouchStartCapture, {
			capture: true,
			passive: true
		}), addEventListener(doc, "touchmove", handleTouchMoveCapture, {
			capture: true,
			passive: true
		}), addEventListener(doc, "touchend", handleTouchEndCapture, {
			capture: true,
			passive: true
		})));
		return () => {
			unsubscribe();
			preventedPressSuppressionTimeout.clear();
			resetPressStartState();
			suppressNextOutsideClickRef.current = false;
		};
	}, [
		dataRef,
		floatingElement,
		escapeKey$1,
		outsidePressEnabled,
		outsidePress$1,
		open,
		enabled,
		escapeKeyBubbles,
		outsidePressBubbles,
		closeOnEscapeKeyDown,
		clearInsideReactTree,
		getOutsidePressEventProp,
		hasBlockingChild,
		isEventWithinOwnElements,
		tree,
		store,
		cancelDismissOnEndTimeout,
		compositionTimeout
	]);
	const reference = react.useMemo(() => ({
		onKeyDown: closeOnEscapeKeyDown,
		onPointerDown: closeOnReferencePress,
		onClick: closeOnReferencePress
	}), [closeOnEscapeKeyDown, closeOnReferencePress]);
	const floating = react.useMemo(() => ({
		onKeyDown: closeOnEscapeKeyDown,
		onPointerDown: markInsidePressStartPrevented,
		onMouseDown: markInsidePressStartPrevented,
		onClickCapture: markInsideReactTree,
		onMouseDownCapture(event) {
			markInsideReactTree();
			markPressStartedInsideReactTree(event);
		},
		onPointerDownCapture(event) {
			markInsideReactTree();
			markPressStartedInsideReactTree(event);
		},
		onMouseUpCapture: markInsideReactTree,
		onTouchEndCapture: markInsideReactTree,
		onTouchMoveCapture: markInsideReactTree
	}), [
		closeOnEscapeKeyDown,
		markInsideReactTree,
		markPressStartedInsideReactTree,
		markInsidePressStartPrevented
	]);
	return react.useMemo(() => enabled ? {
		reference,
		floating,
		trigger: reference
	} : {}, [
		enabled,
		reference,
		floating
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/useTransitionStatus.mjs
/**
* Provides a status string for CSS animations.
* @param open - a boolean that determines if the element is open.
* @param enableIdleState - a boolean that enables the `'idle'` state between `'starting'` and `'ending'`
* @param deferEndingState - a boolean that delays the `'ending'` state by a frame
* @param animateInitialOpen - a boolean that makes an element which mounts already open still go
*   through `'starting'`. Off by default so content that was open on the first render (a
*   `defaultOpen` popup on page load, SSR'd markup) doesn't animate in.
*/
function useTransitionStatus(open, enableIdleState = false, deferEndingState = false, animateInitialOpen = false) {
	const [transitionStatus, setTransitionStatus] = react.useState(open && enableIdleState ? "idle" : void 0);
	const [mounted, setMounted] = react.useState(open && !animateInitialOpen);
	if (open && !mounted) {
		setMounted(true);
		setTransitionStatus("starting");
	}
	if (!open && mounted && transitionStatus !== "ending" && !deferEndingState) setTransitionStatus("ending");
	if (!open && !mounted && transitionStatus === "ending") setTransitionStatus(void 0);
	useIsoLayoutEffect(() => {
		if (!open && mounted && transitionStatus !== "ending" && deferEndingState) {
			const frame = AnimationFrame.request(() => {
				setTransitionStatus("ending");
			});
			return () => {
				AnimationFrame.cancel(frame);
			};
		}
	}, [
		open,
		mounted,
		transitionStatus,
		deferEndingState
	]);
	useIsoLayoutEffect(() => {
		if (!open || enableIdleState || transitionStatus === void 0) return;
		const frame = AnimationFrame.request(() => {
			setTransitionStatus(void 0);
		});
		return () => {
			AnimationFrame.cancel(frame);
		};
	}, [
		enableIdleState,
		open,
		transitionStatus
	]);
	useIsoLayoutEffect(() => {
		if (!open || !enableIdleState) return;
		if (open && mounted && transitionStatus !== "idle") setTransitionStatus("starting");
		const frame = AnimationFrame.request(() => {
			setTransitionStatus("idle");
		});
		return () => {
			AnimationFrame.cancel(frame);
		};
	}, [
		enableIdleState,
		open,
		mounted,
		transitionStatus
	]);
	return {
		mounted,
		setMounted,
		transitionStatus
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/getFiniteAnimations.mjs
/**
* Excludes infinite animations, whose finished promises never resolve while they run.
*/
function getFiniteAnimations(element, options) {
	return element.getAnimations(options).filter((animation) => {
		const timing = animation.effect?.getTiming();
		return timing?.duration !== Infinity && timing?.iterations !== Infinity;
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/useAnimationsFinished.mjs
let pendingCallbacks = null;
/**
* Runs the callback in a synchronous flush before the browser paints, so that the
* browser doesn't paint an intermediate frame: https://github.com/mui/base-ui/issues/979
* Callbacks that become ready within the same microtask checkpoint (e.g. multiple elements
* whose animations finish together) are batched into a single commit:
* https://github.com/mui/base-ui/issues/5481
*/
function flushBeforePaint(fn) {
	if (!pendingCallbacks) {
		const callbacks = [];
		pendingCallbacks = callbacks;
		queueMicrotask(() => {
			pendingCallbacks = null;
			react_dom.flushSync(() => {
				for (const callback of callbacks) callback();
			});
		});
	}
	pendingCallbacks.push(fn);
}
/**
* Executes a function once all animations have finished on the provided element.
* If an animation is canceled, waits for any replacement animations before executing.
* @param elementOrRef - The element to watch for animations.
* @param waitForStartingStyleRemoved - Whether to wait for [data-starting-style] to be removed before checking for animations.
* @param batch - Whether completions ready in the same microtask may be coalesced into a single
* commit. A batched callback runs before earlier callbacks' React updates have committed, so only
* opt in when the callback doesn't read state that another completion can change.
* @returns A function that takes a callback to execute once all animations have finished, and an optional AbortSignal to abort the callback
*/
function useAnimationsFinished(elementOrRef, waitForStartingStyleRemoved = false, batch = false) {
	const frame = useAnimationFrame();
	return useStableCallback((fnToExecute, signal = null) => {
		frame.cancel();
		const element = resolveRef(elementOrRef);
		if (element == null) return;
		const resolvedElement = element;
		const done = () => {
			if (!batch) {
				react_dom.flushSync(fnToExecute);
				return;
			}
			flushBeforePaint(() => {
				if (!signal?.aborted) fnToExecute();
			});
		};
		if (typeof resolvedElement.getAnimations !== "function" || globalThis.BASE_UI_ANIMATIONS_DISABLED) {
			fnToExecute();
			return;
		}
		function exec() {
			Promise.all(getFiniteAnimations(resolvedElement).map((animation) => animation.finished.then(NOOP))).then(() => {
				if (!signal?.aborted) done();
			}, () => {
				if (signal?.aborted) return;
				if (getFiniteAnimations(resolvedElement).some((animation) => animation.pending || animation.playState !== "finished")) {
					exec();
					return;
				}
				done();
			});
		}
		if (waitForStartingStyleRemoved) {
			const startingStyleAttribute = startingStyle;
			if (!resolvedElement.hasAttribute(startingStyleAttribute)) {
				frame.request(exec);
				return;
			}
			const attributeObserver = new MutationObserver(() => {
				if (!resolvedElement.hasAttribute(startingStyleAttribute)) {
					attributeObserver.disconnect();
					exec();
				}
			});
			attributeObserver.observe(resolvedElement, {
				attributes: true,
				attributeFilter: [startingStyleAttribute]
			});
			signal?.addEventListener("abort", () => attributeObserver.disconnect(), { once: true });
			return;
		}
		frame.request(exec);
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/useOpenChangeComplete.mjs
/**
* Calls the provided function when the CSS open/close animation or transition completes.
*/
function useOpenChangeComplete(parameters) {
	const { enabled = true, open, ref, batch = false, onComplete: onCompleteParam } = parameters;
	const onComplete = useStableCallback(onCompleteParam);
	const runOnceAnimationsFinish = useAnimationsFinished(ref, open, batch);
	react.useEffect(() => {
		if (!enabled) return;
		const abortController = new AbortController();
		runOnceAnimationsFinish(onComplete, abortController.signal);
		return () => {
			abortController.abort();
		};
	}, [
		enabled,
		open,
		onComplete,
		runOnceAnimationsFinish
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/useUnmountAfterClose.mjs
/**
* Keeps a popup mounted through its closing animation and unmounts it once the animation
* finishes, unless the close cycle opted out through `preventUnmountOnClose`.
* Store-agnostic: hosts sync `mounted` and `transitionStatus` wherever they need them.
*
* @returns `forceUnmount` unmounts the popup immediately. It is a no-op once the popup is already
*   unmounted, so calling it after the automatic unmount doesn't repeat the completion callback,
*   and a call while the popup is open only takes effect if a close commits in the same batch.
*/
function useUnmountAfterClose(parameters) {
	const { open, ref, preventUnmountOnClose, setPreventUnmountOnClose: setPreventUnmountOnCloseParam, onUnmount, animateInitialOpen } = parameters;
	const setPreventUnmountOnClose = useStableCallback(setPreventUnmountOnCloseParam);
	const { mounted, setMounted, transitionStatus } = useTransitionStatus(open, false, false, animateInitialOpen);
	const preventUnmountingOnClose = open ? false : preventUnmountOnClose;
	useIsoLayoutEffect(() => {
		if (open) setPreventUnmountOnClose(false);
	}, [open, setPreventUnmountOnClose]);
	const mountedRef = react.useRef(mounted);
	const pendingUnmountRef = react.useRef(false);
	const rerender = useForcedRerendering();
	const unmount = () => {
		mountedRef.current = false;
		setMounted(false);
		onUnmount();
	};
	useIsoLayoutEffect(() => {
		mountedRef.current = mounted;
		if (pendingUnmountRef.current) {
			pendingUnmountRef.current = false;
			if (!open && mounted) unmount();
		}
	});
	const forceUnmount = useStableCallback(() => {
		if (!mountedRef.current) return;
		if (open) {
			pendingUnmountRef.current = true;
			rerender();
			return;
		}
		unmount();
	});
	useOpenChangeComplete({
		enabled: mounted && !open && !preventUnmountingOnClose,
		open,
		ref,
		onComplete() {
			if (!open) forceUnmount();
		}
	});
	return {
		mounted,
		transitionStatus,
		preventUnmountingOnClose,
		forceUnmount
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/popups/popupStoreUtils.mjs
const FOCUSABLE_POPUP_PROPS = {
	tabIndex: -1,
	[FOCUSABLE_ATTRIBUTE]: ""
};
function attachPreventUnmountOnClose(eventDetails) {
	let preventUnmountOnClose = false;
	eventDetails.preventUnmountOnClose = () => {
		preventUnmountOnClose = true;
	};
	return () => preventUnmountOnClose;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/popups/popupTriggerMap.mjs
/**
* Data structure to keep track of popup trigger elements by their IDs.
*
* Element lookups iterate the id map rather than maintaining a parallel Set. Registration is O(1),
* while `hasElement` and `hasMatchingElement` are linear in the number of triggers.
*/
var PopupTriggerMap = class {
	idMap = /* @__PURE__ */ new Map();
	/**
	* Adds a trigger element with the given ID.
	*
	* Note: The provided element is assumed to not be registered under multiple IDs.
	*/
	add(id, element) {
		this.idMap.set(id, element);
	}
	/**
	* Removes the trigger element with the given ID.
	*/
	delete(id) {
		this.idMap.delete(id);
	}
	/**
	* Whether the given element is registered as a trigger.
	*/
	hasElement(element) {
		for (const registered of this.idMap.values()) if (registered === element) return true;
		return false;
	}
	/**
	* Whether there is a registered trigger element matching the given predicate.
	*/
	hasMatchingElement(predicate) {
		for (const element of this.idMap.values()) if (predicate(element)) return true;
		return false;
	}
	/**
	* Returns the trigger element associated with the given ID, or undefined if no such element exists.
	*/
	getById(id) {
		return this.idMap.get(id);
	}
	/**
	* Returns an iterable of all registered trigger entries, where each entry is a tuple of [id, element].
	*/
	entries() {
		return this.idMap.entries();
	}
	/**
	* Returns an iterable of all registered trigger elements.
	*/
	elements() {
		return this.idMap.values();
	}
	/**
	* Returns the number of registered trigger elements.
	*/
	get size() {
		return this.idMap.size;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/components/FloatingRootStore.mjs
const selectors$1 = {
	open: (state) => state.open,
	transitionStatus: (state) => state.transitionStatus,
	domReferenceElement: (state) => state.domReferenceElement,
	referenceElement: (state) => state.positionReference ?? state.referenceElement,
	floatingElement: (state) => state.floatingElement,
	floatingId: (state) => state.floatingId
};
var FloatingRootStore = class extends ReactStore {
	constructor(options) {
		const { syncOnly, nested, onOpenChange, triggerElements, ...initialState } = options;
		super({
			...initialState,
			positionReference: initialState.referenceElement,
			domReferenceElement: initialState.referenceElement
		}, {
			onOpenChange,
			dataRef: { current: {} },
			events: createEventEmitter(),
			nested,
			triggerElements
		}, selectors$1);
		this.syncOnly = syncOnly;
	}
	/**
	* Syncs the event used by hover logic to distinguish hover-open from click-like interaction.
	*/
	syncOpenEvent = (newOpen, event) => {
		if (!newOpen || !this.state.open || event != null && isClickLikeEvent(event)) this.context.dataRef.current.openEvent = newOpen ? event : void 0;
	};
	/**
	* Runs the root-owned side effects for an open state change.
	*/
	dispatchOpenChange = (newOpen, eventDetails) => {
		this.syncOpenEvent(newOpen, eventDetails.event);
		const details = {
			open: newOpen,
			reason: eventDetails.reason,
			nativeEvent: eventDetails.event,
			nested: this.context.nested,
			triggerElement: eventDetails.trigger
		};
		this.context.events.emit("openchange", details);
	};
	/**
	* Emits the `openchange` event through the internal event emitter and calls the `onOpenChange` handler with the provided arguments.
	*
	* @param newOpen The new open state.
	* @param eventDetails Details about the event that triggered the open state change.
	*/
	setOpen = (newOpen, eventDetails) => {
		if (this.syncOnly) {
			this.context.onOpenChange?.(newOpen, eventDetails);
			return;
		}
		this.dispatchOpenChange(newOpen, eventDetails);
		this.context.onOpenChange?.(newOpen, eventDetails);
	};
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/hooks/useFloatingRootContext.mjs
function useFloatingRootContext(options) {
	const { open = false, onOpenChange, elements = {} } = options;
	const floatingId = useId$2();
	const nested = useFloatingParentNodeId() != null;
	const store = useRefWithInit(() => new FloatingRootStore({
		open,
		transitionStatus: void 0,
		onOpenChange,
		referenceElement: elements.reference ?? null,
		floatingElement: elements.floating ?? null,
		triggerElements: new PopupTriggerMap(),
		floatingId,
		syncOnly: false,
		nested
	})).current;
	useIsoLayoutEffect(() => {
		const valuesToSync = {
			open,
			floatingId
		};
		if (elements.reference !== void 0) {
			valuesToSync.referenceElement = elements.reference;
			valuesToSync.domReferenceElement = isElement(elements.reference) ? elements.reference : null;
		}
		if (elements.floating !== void 0) valuesToSync.floatingElement = elements.floating;
		store.update(valuesToSync);
	}, [
		open,
		floatingId,
		elements.reference,
		elements.floating,
		store
	]);
	store.context.onOpenChange = onOpenChange;
	store.context.nested = nested;
	return store;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/hooks/useListNavigation.mjs
function isStationaryWebKitPointer(event) {
	return webkit && event.movementX === 0 && event.movementY === 0;
}
function doSwitch(orientation, vertical, horizontal) {
	switch (orientation) {
		case "vertical": return vertical;
		case "horizontal": return horizontal;
		default: return vertical || horizontal;
	}
}
function isMainOrientationKey(key, orientation) {
	return doSwitch(orientation, key === "ArrowUp" || key === "ArrowDown", key === "ArrowLeft" || key === "ArrowRight");
}
function isMainOrientationToEndKey(key, orientation, rtl) {
	return doSwitch(orientation, key === "ArrowDown", rtl ? key === "ArrowLeft" : key === "ArrowRight") || key === "Enter" || key === " " || key === "";
}
function isCrossOrientationOpenKey(key, orientation, rtl) {
	return doSwitch(orientation, rtl ? key === ARROW_LEFT$1 : key === ARROW_RIGHT$1, key === ARROW_DOWN$1);
}
function isCrossOrientationCloseKey(key, orientation, rtl, grid) {
	const vertical = rtl ? key === ARROW_RIGHT$1 : key === ARROW_LEFT$1;
	const horizontal = key === ARROW_UP$1;
	if (orientation === "both" || orientation === "horizontal" && grid) return key === "Escape";
	return doSwitch(orientation, vertical, horizontal);
}
/**
* Adds arrow key-based navigation of a list of items, either using real DOM
* focus or virtual focus.
* @see https://floating-ui.com/docs/useListNavigation
*/
function useListNavigation(store, props) {
	const { listRef, activeIndex, onNavigate: onNavigateProp = () => {}, enabled = true, selectedIndex = null, allowEscape = false, loopFocus = false, nested = false, rtl = false, virtual = false, focusItemOnOpen = "auto", focusItemOnHover = true, openOnArrowKeyDown = true, disabledIndices = void 0, orientation = "vertical", triggerOrientation = orientation, parentOrientation, id, resetOnPointerLeave = true, externalTree, nestedReturnFocusRef, grid: navigateGrid } = props;
	const isGrid = navigateGrid != null;
	const open = store.useState("open");
	const floatingElement = store.useState("floatingElement");
	const domReferenceElement = store.useState("domReferenceElement");
	const dataRef = store.context.dataRef;
	const floatingFocusElement = getFloatingFocusElement(floatingElement);
	const typeableComboboxReference = isTypeableCombobox(domReferenceElement);
	const floatingFocusElementRef = useValueAsRef(floatingFocusElement);
	const parentId = useFloatingParentNodeId();
	const tree = useFloatingTree(externalTree);
	const focusItemOnOpenRef = react.useRef(focusItemOnOpen);
	const indexRef = react.useRef(selectedIndex ?? -1);
	const keyRef = react.useRef(null);
	const isPointerModalityRef = react.useRef(true);
	const onNavigate = useStableCallback((event) => {
		onNavigateProp(indexRef.current === -1 ? null : indexRef.current, event);
	});
	const previousMountedRef = react.useRef(!!floatingElement);
	const previousOpenRef = react.useRef(open);
	const forceSyncFocusRef = react.useRef(false);
	const forceScrollIntoViewRef = react.useRef(false);
	const cancelQueuedFocusRef = react.useRef(null);
	const disabledIndicesRef = useValueAsRef(disabledIndices);
	const latestOpenRef = useValueAsRef(open);
	const selectedIndexRef = useValueAsRef(selectedIndex);
	const resetOnPointerLeaveRef = useValueAsRef(resetOnPointerLeave);
	const focusFrame = useAnimationFrame();
	const waitForListPopulatedFrame = useAnimationFrame();
	const focusItem = useStableCallback(() => {
		focusFrame.cancel();
		function runFocus(item) {
			if (!virtual) cancelQueuedFocusRef.current = enqueueFocus(item, {
				sync: forceSyncFocusRef.current,
				preventScroll: true
			});
		}
		const initialItem = listRef.current[indexRef.current];
		const forceScrollIntoView = forceScrollIntoViewRef.current;
		if (initialItem) runFocus(initialItem);
		(forceSyncFocusRef.current ? (callback) => callback() : (callback) => focusFrame.request(callback))(() => {
			const waitedItem = listRef.current[indexRef.current] || initialItem;
			if (!waitedItem) return;
			if (!initialItem) runFocus(waitedItem);
			if (item && (forceScrollIntoView || !isPointerModalityRef.current)) waitedItem.scrollIntoView?.({
				block: "nearest",
				inline: "nearest"
			});
		});
	});
	useIsoLayoutEffect(() => {
		dataRef.current.orientation = orientation;
	}, [dataRef, orientation]);
	useIsoLayoutEffect(() => {
		if (!open) keyRef.current = null;
		if (!open || focusItemOnOpen !== "auto") focusItemOnOpenRef.current = focusItemOnOpen;
	}, [open, focusItemOnOpen]);
	useIsoLayoutEffect(() => {
		if (!enabled) return;
		if (open && floatingElement) {
			indexRef.current = selectedIndex ?? -1;
			if (focusItemOnOpenRef.current && selectedIndex != null) {
				forceScrollIntoViewRef.current = true;
				onNavigate();
			}
		} else if (previousMountedRef.current) {
			indexRef.current = -1;
			onNavigate();
		}
	}, [
		enabled,
		open,
		floatingElement,
		selectedIndex,
		onNavigate
	]);
	useIsoLayoutEffect(() => {
		if (!enabled) return;
		if (!open) {
			forceSyncFocusRef.current = false;
			return;
		}
		if (!floatingElement) return;
		if (activeIndex == null) {
			forceSyncFocusRef.current = false;
			if (selectedIndexRef.current != null) return;
			if (previousMountedRef.current) {
				indexRef.current = -1;
				focusItem();
			}
			if ((!previousOpenRef.current || !previousMountedRef.current) && focusItemOnOpenRef.current && (keyRef.current != null || focusItemOnOpenRef.current === true && keyRef.current == null)) {
				let runs = 0;
				const waitForListPopulated = () => {
					if (listRef.current[0] == null) {
						if (runs < 2) (runs ? (callback) => waitForListPopulatedFrame.request(callback) : queueMicrotask)(waitForListPopulated);
						runs += 1;
					} else {
						indexRef.current = keyRef.current == null || isMainOrientationToEndKey(keyRef.current, triggerOrientation, rtl) || nested ? getMinListIndex(listRef) : getMaxListIndex(listRef);
						keyRef.current = null;
						onNavigate();
					}
				};
				waitForListPopulated();
			}
		} else if (!isIndexOutOfListBounds(listRef.current, activeIndex)) {
			indexRef.current = activeIndex;
			focusItem();
			forceScrollIntoViewRef.current = false;
		}
	}, [
		enabled,
		open,
		floatingElement,
		activeIndex,
		selectedIndexRef,
		nested,
		listRef,
		triggerOrientation,
		rtl,
		onNavigate,
		focusItem,
		waitForListPopulatedFrame
	]);
	useIsoLayoutEffect(() => {
		if (!enabled || floatingElement || !tree || virtual || !previousMountedRef.current) return;
		const nodes = tree.nodesRef.current;
		const parent = nodes.find((node) => node.id === parentId)?.context?.elements.floating;
		const activeEl = activeElement(ownerDocument(domReferenceElement ?? parent ?? null));
		const treeContainsActiveEl = nodes.some((node) => node.context && contains(node.context.elements.floating, activeEl));
		if (parent && !treeContainsActiveEl && isPointerModalityRef.current) parent.focus({ preventScroll: true });
	}, [
		enabled,
		floatingElement,
		domReferenceElement,
		tree,
		parentId,
		virtual
	]);
	useIsoLayoutEffect(() => {
		previousOpenRef.current = open;
		previousMountedRef.current = !!floatingElement;
	});
	const hasActiveIndex = activeIndex != null;
	const syncCurrentTarget = useStableCallback((event) => {
		if (!latestOpenRef.current) return;
		const index = listRef.current.indexOf(event.currentTarget);
		if (index !== -1 && (indexRef.current !== index || activeIndex !== index)) {
			indexRef.current = index;
			onNavigate(event);
		}
	});
	const getParentOrientation = useStableCallback(() => {
		return parentOrientation ?? tree?.nodesRef.current.find((node) => node.id === parentId)?.context?.dataRef?.current.orientation;
	});
	const getMinEnabledIndex = useStableCallback(() => {
		return getMinListIndex(listRef, disabledIndicesRef.current);
	});
	const commonOnKeyDown = useStableCallback((event) => {
		isPointerModalityRef.current = false;
		forceSyncFocusRef.current = true;
		if (event.which === 229) return;
		if (!latestOpenRef.current && event.currentTarget === floatingFocusElementRef.current) return;
		if (nested && isCrossOrientationCloseKey(event.key, orientation, rtl, isGrid)) {
			if (!isMainOrientationKey(event.key, getParentOrientation())) stopEvent(event);
			store.setOpen(false, createChangeEventDetails(listNavigation, event.nativeEvent));
			const returnElement = nestedReturnFocusRef?.current ?? domReferenceElement;
			if (isHTMLElement(returnElement)) returnElement.focus();
			return;
		}
		if (activeIndex != null && activeIndex !== indexRef.current && !isIndexOutOfListBounds(listRef.current, activeIndex)) indexRef.current = activeIndex;
		const currentIndex = indexRef.current;
		const minIndex = getMinListIndex(listRef, disabledIndices);
		const maxIndex = getMaxListIndex(listRef, disabledIndices);
		if (!typeableComboboxReference) {
			if (event.key === "Home") {
				stopEvent(event);
				indexRef.current = minIndex;
				onNavigate(event);
			}
			if (event.key === "End") {
				stopEvent(event);
				indexRef.current = maxIndex;
				onNavigate(event);
			}
		}
		if (navigateGrid != null) {
			const index = navigateGrid(event, indexRef.current, listRef, orientation, loopFocus, rtl, disabledIndices, minIndex, maxIndex);
			if (index != null && index !== indexRef.current) {
				indexRef.current = index;
				onNavigate(event);
			}
			if (orientation === "both") return;
		}
		if (isMainOrientationKey(event.key, orientation)) {
			stopEvent(event);
			const focusedElement = activeElement(event.currentTarget.ownerDocument);
			if (open && !virtual && contains(event.currentTarget, focusedElement) && !listRef.current.some((item) => item != null && contains(item, focusedElement))) {
				indexRef.current = isMainOrientationToEndKey(event.key, orientation, rtl) ? minIndex : maxIndex;
				onNavigate(event);
				if (activeIndex === indexRef.current) focusItem();
				return;
			}
			const { index, wrapped } = getNextListIndex(listRef.current, currentIndex, {
				decrement: !isMainOrientationToEndKey(event.key, orientation, rtl),
				loopFocus,
				allowEscape,
				disabledIndices,
				minIndex,
				maxIndex
			});
			if (wrapped) forceSyncFocusRef.current = false;
			indexRef.current = index;
			onNavigate(event);
		}
	});
	const item = react.useMemo(() => {
		return {
			onFocus(event) {
				forceSyncFocusRef.current = true;
				syncCurrentTarget(event);
			},
			onClick({ currentTarget }) {
				if (!virtual) currentTarget.focus({ preventScroll: true });
			},
			onMouseMove(event) {
				if (isStationaryWebKitPointer(event)) return;
				forceSyncFocusRef.current = true;
				forceScrollIntoViewRef.current = false;
				if (focusItemOnHover) syncCurrentTarget(event);
			},
			onPointerLeave(event) {
				if (!latestOpenRef.current || !isPointerModalityRef.current || event.pointerType === "touch") return;
				forceSyncFocusRef.current = true;
				const relatedTarget = event.relatedTarget;
				if (!focusItemOnHover || listRef.current.includes(relatedTarget)) return;
				if (!resetOnPointerLeaveRef.current) return;
				cancelQueuedFocusRef.current?.();
				cancelQueuedFocusRef.current = null;
				indexRef.current = -1;
				onNavigate(event);
				if (!virtual) {
					const floatingFocusEl = floatingFocusElementRef.current;
					const activeEl = activeElement(ownerDocument(floatingFocusEl));
					if (floatingFocusEl && contains(floatingFocusEl, activeEl)) floatingFocusEl.focus({ preventScroll: true });
				}
			}
		};
	}, [
		syncCurrentTarget,
		latestOpenRef,
		floatingFocusElementRef,
		focusItemOnHover,
		listRef,
		onNavigate,
		resetOnPointerLeaveRef,
		virtual
	]);
	const ariaActiveDescendantProp = react.useMemo(() => {
		return virtual && open && hasActiveIndex && { "aria-activedescendant": `${id}-${activeIndex}` };
	}, [
		virtual,
		open,
		hasActiveIndex,
		id,
		activeIndex
	]);
	const floating = react.useMemo(() => {
		return {
			...!typeableComboboxReference ? ariaActiveDescendantProp : {},
			onKeyDown(event) {
				if (event.key === "Tab" && event.shiftKey && open && !virtual) {
					const target = getTarget(event.nativeEvent);
					if (target && !contains(floatingFocusElementRef.current, target)) return;
					stopEvent(event);
					const details = createChangeEventDetails(focusOut, event.nativeEvent);
					store.setOpen(false, details);
					const returnElement = nestedReturnFocusRef?.current ?? domReferenceElement;
					if (!details.isCanceled && isHTMLElement(returnElement)) returnElement.focus();
					return;
				}
				commonOnKeyDown(event);
			},
			onPointerMove(event) {
				if (isStationaryWebKitPointer(event)) return;
				isPointerModalityRef.current = true;
			}
		};
	}, [
		ariaActiveDescendantProp,
		commonOnKeyDown,
		floatingFocusElementRef,
		typeableComboboxReference,
		store,
		open,
		virtual,
		domReferenceElement,
		nestedReturnFocusRef
	]);
	const trigger = react.useMemo(() => {
		function openOnNavigationKeyDown(event) {
			store.setOpen(true, createChangeEventDetails(listNavigation, event.nativeEvent, event.currentTarget));
		}
		function checkVirtualMouse(event) {
			if (focusItemOnOpen === "auto" && isVirtualClick(event.nativeEvent)) focusItemOnOpenRef.current = !virtual;
		}
		function checkVirtualPointer(event) {
			focusItemOnOpenRef.current = focusItemOnOpen;
			if (focusItemOnOpen === "auto" && isVirtualPointerEvent(event.nativeEvent)) focusItemOnOpenRef.current = true;
		}
		return {
			onKeyDown(event) {
				const currentOpen = store.select("open");
				isPointerModalityRef.current = false;
				const isArrowKey = event.key.startsWith("Arrow");
				const isParentCrossOpenKey = isCrossOrientationOpenKey(event.key, getParentOrientation(), rtl);
				const isMainKey = isMainOrientationKey(event.key, currentOpen ? orientation : triggerOrientation);
				const isNavigationKey = (nested ? isParentCrossOpenKey : isMainKey) || event.key === "Enter" || event.key.trim() === "";
				if (virtual && currentOpen && (!nested || isTypeableElement(event.currentTarget))) return commonOnKeyDown(event);
				if (!currentOpen && !openOnArrowKeyDown && isArrowKey) return;
				if (isNavigationKey) {
					const isParentMainKey = isMainOrientationKey(event.key, getParentOrientation());
					keyRef.current = nested && isParentMainKey ? null : event.key;
				}
				if (nested) {
					if (isParentCrossOpenKey) {
						stopEvent(event);
						if (currentOpen) {
							indexRef.current = getMinEnabledIndex();
							onNavigate(event);
							if (virtual) floatingFocusElementRef.current?.focus();
						} else openOnNavigationKeyDown(event);
					}
					return;
				}
				if (isMainKey) {
					if (selectedIndexRef.current != null) indexRef.current = selectedIndexRef.current;
					stopEvent(event);
					if (!currentOpen && openOnArrowKeyDown) openOnNavigationKeyDown(event);
					else commonOnKeyDown(event);
					if (currentOpen) onNavigate(event);
				}
			},
			onFocus(event) {
				if (event.target !== event.currentTarget) return;
				if (store.select("open") && !virtual) {
					indexRef.current = -1;
					onNavigate(event);
				}
			},
			onPointerDown: checkVirtualPointer,
			onPointerEnter: checkVirtualPointer,
			onMouseDown: checkVirtualMouse,
			onClick: checkVirtualMouse
		};
	}, [
		commonOnKeyDown,
		focusItemOnOpen,
		getMinEnabledIndex,
		nested,
		onNavigate,
		store,
		openOnArrowKeyDown,
		orientation,
		triggerOrientation,
		getParentOrientation,
		rtl,
		selectedIndexRef,
		virtual,
		floatingFocusElementRef
	]);
	const reference = react.useMemo(() => {
		return {
			...ariaActiveDescendantProp,
			...trigger
		};
	}, [ariaActiveDescendantProp, trigger]);
	return react.useMemo(() => enabled ? {
		reference,
		floating,
		item,
		trigger
	} : {}, [
		enabled,
		reference,
		floating,
		trigger,
		item
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/hooks/useTypeahead.mjs
/**
* Provides a matching callback that can be used to focus an item as the user
* types, often used in tandem with `useListNavigation()`.
* @see https://floating-ui.com/docs/useTypeahead
*/
function useTypeahead(store, props) {
	const { listRef, elementsRef, activeIndex, onMatch: onMatchProp, disabledIndices, onTyping: onTypingProp, enabled = true, resetMs = 750, selectedIndex = null } = props;
	const onTyping = useStableCallback(onTypingProp);
	const open = store.useState("open");
	const timeout = useTimeout();
	const stringRef = react.useRef("");
	const prevIndexRef = react.useRef(selectedIndex ?? activeIndex ?? -1);
	const matchIndexRef = react.useRef(null);
	const onKeyDown = useStableCallback((event) => {
		function getElement(index) {
			return elementsRef?.current[index];
		}
		function isItemAvailable(index) {
			const element = getElement(index);
			if (element && !isElementVisible(element) || element?.matches(":disabled")) return false;
			return disabledIndices == null || !isListIndexDisabled(EMPTY_ARRAY, index, disabledIndices);
		}
		function getMatchingIndex(list, string, startIndex = 0) {
			if (list.length === 0) return -1;
			const normalizedStartIndex = (startIndex % list.length + list.length) % list.length;
			const lowerString = string.toLowerCase();
			for (let offset = 0; offset < list.length; offset += 1) {
				const index = (normalizedStartIndex + offset) % list.length;
				if (!list[index]?.toLowerCase().startsWith(lowerString) || !isItemAvailable(index)) continue;
				return index;
			}
			return -1;
		}
		const listContent = listRef.current;
		if (stringRef.current.length > 0 && event.key === " ") {
			stopEvent(event);
			onTyping?.(true);
		}
		if (stringRef.current.length > 0 && stringRef.current[0] !== " ") {
			if (getMatchingIndex(listContent, stringRef.current) === -1 && event.key !== " ") onTyping?.(false);
		}
		if (listContent == null || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
		if (open && event.key !== " ") {
			stopEvent(event);
			onTyping?.(true);
		}
		const isNewSession = stringRef.current === "";
		if (isNewSession) prevIndexRef.current = selectedIndex ?? activeIndex ?? -1;
		if (listContent.every((text, index) => text && isItemAvailable(index) ? text[0]?.toLowerCase() !== text[1]?.toLowerCase() : true) && stringRef.current === event.key) {
			stringRef.current = "";
			prevIndexRef.current = matchIndexRef.current;
		}
		stringRef.current += event.key;
		timeout.start(resetMs, () => {
			stringRef.current = "";
			prevIndexRef.current = matchIndexRef.current;
			onTyping?.(false);
		});
		const startIndex = ((isNewSession ? selectedIndex ?? activeIndex ?? -1 : prevIndexRef.current) ?? 0) + 1;
		const index = getMatchingIndex(listContent, stringRef.current, startIndex);
		if (index !== -1) {
			onMatchProp?.(index, event);
			matchIndexRef.current = index;
		} else if (event.key !== " ") {
			stringRef.current = "";
			onTyping?.(false);
		}
	});
	const onBlur = useStableCallback((event) => {
		const next = event.relatedTarget;
		const currentDomReferenceElement = store.select("domReferenceElement");
		const currentFloatingElement = store.select("floatingElement");
		if (contains(currentDomReferenceElement, next) || contains(currentFloatingElement, next)) return;
		timeout.clear();
		stringRef.current = "";
		prevIndexRef.current = matchIndexRef.current;
		onTyping?.(false);
	});
	useIsoLayoutEffect(() => {
		if (!open && selectedIndex !== null) return;
		timeout.clear();
		matchIndexRef.current = null;
		if (stringRef.current !== "") {
			stringRef.current = "";
			onTyping?.(false);
		}
	}, [
		open,
		selectedIndex,
		timeout,
		onTyping
	]);
	const sharedProps = react.useMemo(() => ({
		onKeyDown,
		onBlur
	}), [onKeyDown, onBlur]);
	return react.useMemo(() => enabled ? {
		reference: sharedProps,
		floating: sharedProps
	} : {}, [enabled, sharedProps]);
}
//#endregion
//#region ../../node_modules/.pnpm/@floating-ui+core@1.8.0/node_modules/@floating-ui/core/dist/floating-ui.core.mjs
function computeCoordsFromPlacement(_ref, placement, rtl) {
	let { reference, floating } = _ref;
	const sideAxis = getSideAxis(placement);
	const alignmentAxis = getAlignmentAxis(placement);
	const alignLength = getAxisLength(alignmentAxis);
	const side = getSide(placement);
	const isVertical = sideAxis === "y";
	const commonX = reference.x + reference.width / 2 - floating.width / 2;
	const commonY = reference.y + reference.height / 2 - floating.height / 2;
	const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
	let coords;
	switch (side) {
		case "top":
			coords = {
				x: commonX,
				y: reference.y - floating.height
			};
			break;
		case "bottom":
			coords = {
				x: commonX,
				y: reference.y + reference.height
			};
			break;
		case "right":
			coords = {
				x: reference.x + reference.width,
				y: commonY
			};
			break;
		case "left":
			coords = {
				x: reference.x - floating.width,
				y: commonY
			};
			break;
		default: coords = {
			x: reference.x,
			y: reference.y
		};
	}
	const alignment = getAlignment(placement);
	if (alignment) coords[alignmentAxis] += commonAlign * (alignment === "end" ? 1 : -1) * (rtl && isVertical ? -1 : 1);
	return coords;
}
/**
* Resolves with an object of overflow side offsets that determine how much the
* element is overflowing a given clipping boundary on each side.
* - positive = overflowing the boundary by that number of pixels
* - negative = how many pixels left before it will overflow
* - 0 = lies flush with the boundary
* @see https://floating-ui.com/docs/detectOverflow
*/
async function detectOverflow(state, options) {
	var _await$platform$isEle;
	if (options === void 0) options = {};
	const { x, y, platform, rects, elements, strategy } = state;
	const { boundary = "clippingAncestors", rootBoundary = "viewport", elementContext = "floating", altBoundary = false, padding = 0 } = evaluate(options, state);
	const paddingObject = getPaddingObject(padding);
	const element = elements[altBoundary ? elementContext === "floating" ? "reference" : "floating" : elementContext];
	const clippingClientRect = rectToClientRect(await platform.getClippingRect({
		element: ((_await$platform$isEle = await (platform.isElement == null ? void 0 : platform.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || await (platform.getDocumentElement == null ? void 0 : platform.getDocumentElement(elements.floating)),
		boundary,
		rootBoundary,
		strategy
	}));
	const rect = elementContext === "floating" ? {
		x,
		y,
		width: rects.floating.width,
		height: rects.floating.height
	} : rects.reference;
	const offsetParent = await (platform.getOffsetParent == null ? void 0 : platform.getOffsetParent(elements.floating));
	const offsetScale = await (platform.isElement == null ? void 0 : platform.isElement(offsetParent)) && await (platform.getScale == null ? void 0 : platform.getScale(offsetParent)) || {
		x: 1,
		y: 1
	};
	const elementClientRect = rectToClientRect(platform.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform.convertOffsetParentRelativeRectToViewportRelativeRect({
		elements,
		rect,
		offsetParent,
		strategy
	}) : rect);
	return {
		top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
		bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
		left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
		right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
	};
}
const MAX_RESET_COUNT = 50;
/**
* Computes the `x` and `y` coordinates that will place the floating element
* next to a given reference element.
*
* This export does not have any `platform` interface logic. You will need to
* write one for the platform you are using Floating UI with.
*/
const computePosition$1 = async (reference, floating, config) => {
	const { placement = "bottom", strategy = "absolute", middleware = [], platform } = config;
	const platformWithDetectOverflow = platform.detectOverflow ? platform : {
		...platform,
		detectOverflow
	};
	const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(floating));
	let rects = await platform.getElementRects({
		reference,
		floating,
		strategy
	});
	let { x, y } = computeCoordsFromPlacement(rects, placement, rtl);
	let statefulPlacement = placement;
	let resetCount = 0;
	const middlewareData = {};
	for (let i = 0; i < middleware.length; i++) {
		const currentMiddleware = middleware[i];
		if (!currentMiddleware) continue;
		const { name, fn } = currentMiddleware;
		const { x: nextX, y: nextY, data, reset } = await fn({
			x,
			y,
			initialPlacement: placement,
			placement: statefulPlacement,
			strategy,
			middlewareData,
			rects,
			platform: platformWithDetectOverflow,
			elements: {
				reference,
				floating
			}
		});
		x = nextX != null ? nextX : x;
		y = nextY != null ? nextY : y;
		middlewareData[name] = {
			...middlewareData[name],
			...data
		};
		if (reset && resetCount < MAX_RESET_COUNT) {
			resetCount++;
			if (typeof reset === "object") {
				if (reset.placement) statefulPlacement = reset.placement;
				if (reset.rects) rects = reset.rects === true ? await platform.getElementRects({
					reference,
					floating,
					strategy
				}) : reset.rects;
				({x, y} = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
			}
			i = -1;
		}
	}
	return {
		x,
		y,
		placement: statefulPlacement,
		strategy,
		middlewareData
	};
};
/**
* Optimizes the visibility of the floating element by flipping the `placement`
* in order to keep it in view when the preferred placement(s) will overflow the
* clipping boundary. Alternative to `autoPlacement`.
* @see https://floating-ui.com/docs/flip
*/
const flip$1 = function(options) {
	if (options === void 0) options = {};
	return {
		name: "flip",
		options,
		async fn(state) {
			var _middlewareData$arrow, _middlewareData$flip;
			const { placement, middlewareData, rects, initialPlacement, platform, elements } = state;
			const { mainAxis: checkMainAxis = true, crossAxis: checkCrossAxis = true, fallbackPlacements: specifiedFallbackPlacements, fallbackStrategy = "bestFit", fallbackAxisSideDirection = "none", flipAlignment = true, ...detectOverflowOptions } = evaluate(options, state);
			if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) return {};
			const side = getSide(placement);
			const initialSideAxis = getSideAxis(initialPlacement);
			const isBasePlacement = getSide(initialPlacement) === initialPlacement;
			const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating));
			const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
			const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== "none";
			if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
			const placements = [initialPlacement, ...fallbackPlacements];
			const overflow = await platform.detectOverflow(state, detectOverflowOptions);
			const overflows = [];
			let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
			if (checkMainAxis) overflows.push(overflow[side]);
			if (checkCrossAxis) {
				const sides = getAlignmentSides(placement, rects, rtl);
				overflows.push(overflow[sides[0]], overflow[sides[1]]);
			}
			overflowsData = [...overflowsData, {
				placement,
				overflows
			}];
			if (!overflows.every((side) => side <= 0)) {
				var _middlewareData$flip2, _overflowsData$filter;
				const nextIndex = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
				const nextPlacement = placements[nextIndex];
				if (nextPlacement) {
					if (!(checkCrossAxis === "alignment" ? initialSideAxis !== getSideAxis(nextPlacement) : false) || overflowsData.every((d) => getSideAxis(d.placement) === initialSideAxis ? d.overflows[0] > 0 : true)) return {
						data: {
							index: nextIndex,
							overflows: overflowsData
						},
						reset: { placement: nextPlacement }
					};
				}
				let resetPlacement = (_overflowsData$filter = overflowsData.filter((d) => d.overflows[0] <= 0).sort((a, b) => a.overflows[1] - b.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;
				if (!resetPlacement) switch (fallbackStrategy) {
					case "bestFit": {
						var _overflowsData$filter2;
						const placement = (_overflowsData$filter2 = overflowsData.filter((d) => {
							if (hasFallbackAxisSideDirection) {
								const currentSideAxis = getSideAxis(d.placement);
								return currentSideAxis === initialSideAxis || currentSideAxis === "y";
							}
							return true;
						}).map((d) => [d.placement, d.overflows.filter((overflow) => overflow > 0).reduce((acc, overflow) => acc + overflow, 0)]).sort((a, b) => a[1] - b[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
						if (placement) resetPlacement = placement;
						break;
					}
					case "initialPlacement": resetPlacement = initialPlacement;
				}
				if (placement !== resetPlacement) return { reset: { placement: resetPlacement } };
			}
			return {};
		}
	};
};
const originSides = /*#__PURE__*/ new Set(["left", "top"]);
async function convertValueToCoords(state, options) {
	const { placement, platform, elements } = state;
	const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating));
	const side = getSide(placement);
	const alignment = getAlignment(placement);
	const isVertical = getSideAxis(placement) === "y";
	const mainAxisMulti = originSides.has(side) ? -1 : 1;
	const crossAxisMulti = rtl && isVertical ? -1 : 1;
	const rawValue = evaluate(options, state);
	let { mainAxis, crossAxis, alignmentAxis } = typeof rawValue === "number" ? {
		mainAxis: rawValue,
		crossAxis: 0,
		alignmentAxis: null
	} : {
		mainAxis: rawValue.mainAxis || 0,
		crossAxis: rawValue.crossAxis || 0,
		alignmentAxis: rawValue.alignmentAxis
	};
	if (alignment && typeof alignmentAxis === "number") crossAxis = alignment === "end" ? alignmentAxis * -1 : alignmentAxis;
	return isVertical ? {
		x: crossAxis * crossAxisMulti,
		y: mainAxis * mainAxisMulti
	} : {
		x: mainAxis * mainAxisMulti,
		y: crossAxis * crossAxisMulti
	};
}
/**
* Modifies the placement by translating the floating element along the
* specified axes.
* A number (shorthand for `mainAxis` or distance), or an axes configuration
* object may be passed.
* @see https://floating-ui.com/docs/offset
*/
const offset$1 = function(options) {
	if (options === void 0) options = 0;
	return {
		name: "offset",
		options,
		async fn(state) {
			var _middlewareData$offse, _middlewareData$arrow;
			const { x, y, placement, middlewareData } = state;
			const diffCoords = await convertValueToCoords(state, options);
			if (placement === ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse.placement) && (_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) return {};
			return {
				x: x + diffCoords.x,
				y: y + diffCoords.y,
				data: {
					...diffCoords,
					placement
				}
			};
		}
	};
};
/**
* Optimizes the visibility of the floating element by shifting it in order to
* keep it in view when it will overflow the clipping boundary.
* @see https://floating-ui.com/docs/shift
*/
const shift$1 = function(options) {
	if (options === void 0) options = {};
	return {
		name: "shift",
		options,
		async fn(state) {
			const { x, y, placement, platform } = state;
			const { mainAxis: checkMainAxis = true, crossAxis: checkCrossAxis = false, limiter = { fn: (_ref) => {
				let { x, y } = _ref;
				return {
					x,
					y
				};
			} }, ...detectOverflowOptions } = evaluate(options, state);
			const coords = {
				x,
				y
			};
			const overflow = await platform.detectOverflow(state, detectOverflowOptions);
			const crossAxis = getSideAxis(placement);
			const mainAxis = getOppositeAxis(crossAxis);
			let mainAxisCoord = coords[mainAxis];
			let crossAxisCoord = coords[crossAxis];
			const clampCoord = (axis, coord) => clamp$1(coord + overflow[axis === "y" ? "top" : "left"], coord, coord - overflow[axis === "y" ? "bottom" : "right"]);
			if (checkMainAxis) mainAxisCoord = clampCoord(mainAxis, mainAxisCoord);
			if (checkCrossAxis) crossAxisCoord = clampCoord(crossAxis, crossAxisCoord);
			const limitedCoords = limiter.fn({
				...state,
				[mainAxis]: mainAxisCoord,
				[crossAxis]: crossAxisCoord
			});
			return {
				...limitedCoords,
				data: {
					x: limitedCoords.x - x,
					y: limitedCoords.y - y,
					enabled: {
						[mainAxis]: checkMainAxis,
						[crossAxis]: checkCrossAxis
					}
				}
			};
		}
	};
};
/**
* Built-in `limiter` that will stop `shift()` at a certain point.
*/
const limitShift$1 = function(options) {
	if (options === void 0) options = {};
	return {
		options,
		fn(state) {
			var _rawOffset$mainAxis, _rawOffset$crossAxis;
			const { x, y, placement, rects, middlewareData } = state;
			const { offset = 0, mainAxis: checkMainAxis = true, crossAxis: checkCrossAxis = true } = evaluate(options, state);
			const coords = {
				x,
				y
			};
			const crossAxis = getSideAxis(placement);
			const mainAxis = getOppositeAxis(crossAxis);
			let mainAxisCoord = coords[mainAxis];
			let crossAxisCoord = coords[crossAxis];
			const rawOffset = evaluate(offset, state);
			const computedOffset = typeof rawOffset === "number" ? {
				mainAxis: rawOffset,
				crossAxis: 0
			} : {
				mainAxis: (_rawOffset$mainAxis = rawOffset.mainAxis) != null ? _rawOffset$mainAxis : 0,
				crossAxis: (_rawOffset$crossAxis = rawOffset.crossAxis) != null ? _rawOffset$crossAxis : 0
			};
			if (checkMainAxis) {
				const len = mainAxis === "y" ? "height" : "width";
				const limitMin = rects.reference[mainAxis] - rects.floating[len] + computedOffset.mainAxis;
				const limitMax = rects.reference[mainAxis] + rects.reference[len] - computedOffset.mainAxis;
				if (mainAxisCoord < limitMin) mainAxisCoord = limitMin;
				else if (mainAxisCoord > limitMax) mainAxisCoord = limitMax;
			}
			if (checkCrossAxis) {
				var _middlewareData$offse, _middlewareData$offse2;
				const len = mainAxis === "y" ? "width" : "height";
				const isOriginSide = originSides.has(getSide(placement));
				const limitMin = rects.reference[crossAxis] - rects.floating[len] + (isOriginSide ? ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse[crossAxis]) || 0 : 0) + (isOriginSide ? 0 : computedOffset.crossAxis);
				const limitMax = rects.reference[crossAxis] + rects.reference[len] + (isOriginSide ? 0 : ((_middlewareData$offse2 = middlewareData.offset) == null ? void 0 : _middlewareData$offse2[crossAxis]) || 0) - (isOriginSide ? computedOffset.crossAxis : 0);
				if (crossAxisCoord < limitMin) crossAxisCoord = limitMin;
				else if (crossAxisCoord > limitMax) crossAxisCoord = limitMax;
			}
			return {
				[mainAxis]: mainAxisCoord,
				[crossAxis]: crossAxisCoord
			};
		}
	};
};
/**
* Provides data that allows you to change the size of the floating element —
* for instance, prevent it from overflowing the clipping boundary or match the
* width of the reference element.
* @see https://floating-ui.com/docs/size
*/
const size$1 = function(options) {
	if (options === void 0) options = {};
	return {
		name: "size",
		options,
		async fn(state) {
			const { placement, rects, platform, elements } = state;
			const { apply = () => {}, ...detectOverflowOptions } = evaluate(options, state);
			const overflow = await platform.detectOverflow(state, detectOverflowOptions);
			const side = getSide(placement);
			const alignment = getAlignment(placement);
			const isYAxis = getSideAxis(placement) === "y";
			const { width, height } = rects.floating;
			let heightSide;
			let widthSide;
			if (side === "top" || side === "bottom") {
				heightSide = side;
				widthSide = alignment === (await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating)) ? "start" : "end") ? "left" : "right";
			} else {
				widthSide = side;
				heightSide = alignment === "end" ? "top" : "bottom";
			}
			const maximumClippingHeight = height - overflow.top - overflow.bottom;
			const maximumClippingWidth = width - overflow.left - overflow.right;
			const overflowAvailableHeight = min(height - overflow[heightSide], maximumClippingHeight);
			const overflowAvailableWidth = min(width - overflow[widthSide], maximumClippingWidth);
			const shiftData = state.middlewareData.shift;
			const noShift = !shiftData;
			let availableHeight = overflowAvailableHeight;
			let availableWidth = overflowAvailableWidth;
			if (shiftData != null && shiftData.enabled.x) availableWidth = maximumClippingWidth;
			if (shiftData != null && shiftData.enabled.y) availableHeight = maximumClippingHeight;
			if (noShift && !alignment) {
				if (isYAxis) availableWidth = width - 2 * max(overflow.left, overflow.right);
				else availableHeight = height - 2 * max(overflow.top, overflow.bottom);
			}
			await apply({
				...state,
				availableWidth,
				availableHeight
			});
			const nextDimensions = await platform.getDimensions(elements.floating);
			if (width !== nextDimensions.width || height !== nextDimensions.height) return { reset: { rects: true } };
			return {};
		}
	};
};
//#endregion
//#region ../../node_modules/.pnpm/@floating-ui+dom@1.8.0/node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs
function getCssDimensions(element) {
	const css = getComputedStyle$1(element);
	let width = parseFloat(css.width) || 0;
	let height = parseFloat(css.height) || 0;
	const hasOffset = isHTMLElement(element);
	const offsetWidth = hasOffset ? element.offsetWidth : width;
	const offsetHeight = hasOffset ? element.offsetHeight : height;
	const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;
	if (shouldFallback) {
		width = offsetWidth;
		height = offsetHeight;
	}
	return {
		width,
		height,
		$: shouldFallback
	};
}
function unwrapElement(element) {
	return !isElement(element) ? element.contextElement : element;
}
function getScale$1(element) {
	const domElement = unwrapElement(element);
	if (!isHTMLElement(domElement)) return createCoords(1);
	const rect = domElement.getBoundingClientRect();
	const { width, height, $ } = getCssDimensions(domElement);
	let x = ($ ? round(rect.width) : rect.width) / width;
	let y = ($ ? round(rect.height) : rect.height) / height;
	if (!x || !Number.isFinite(x)) x = 1;
	if (!y || !Number.isFinite(y)) y = 1;
	return {
		x,
		y
	};
}
const noOffsets = /*#__PURE__*/ createCoords(0);
function getVisualOffsets(element) {
	const win = getWindow(element);
	if (!isWebKit() || !win.visualViewport) return noOffsets;
	return {
		x: win.visualViewport.offsetLeft,
		y: win.visualViewport.offsetTop
	};
}
function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
	if (isFixed === void 0) isFixed = false;
	return !!floatingOffsetParent && isFixed && floatingOffsetParent === getWindow(element);
}
function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
	if (includeScale === void 0) includeScale = false;
	if (isFixedStrategy === void 0) isFixedStrategy = false;
	const clientRect = element.getBoundingClientRect();
	const domElement = unwrapElement(element);
	let scale = createCoords(1);
	if (includeScale) {
		if (offsetParent) {
			if (isElement(offsetParent)) scale = getScale$1(offsetParent);
		} else scale = getScale$1(element);
	}
	const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
	let x = (clientRect.left + visualOffsets.x) / scale.x;
	let y = (clientRect.top + visualOffsets.y) / scale.y;
	let width = clientRect.width / scale.x;
	let height = clientRect.height / scale.y;
	if (domElement && offsetParent) {
		const win = getWindow(domElement);
		const offsetWin = isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
		let currentWin = win;
		let currentIFrame = getFrameElement(currentWin);
		while (currentIFrame && offsetWin !== currentWin) {
			const iframeScale = getScale$1(currentIFrame);
			const iframeRect = currentIFrame.getBoundingClientRect();
			const css = getComputedStyle$1(currentIFrame);
			const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
			const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
			x *= iframeScale.x;
			y *= iframeScale.y;
			width *= iframeScale.x;
			height *= iframeScale.y;
			x += left;
			y += top;
			currentWin = getWindow(currentIFrame);
			currentIFrame = getFrameElement(currentWin);
		}
	}
	return rectToClientRect({
		width,
		height,
		x,
		y
	});
}
function getWindowScrollBarX(element, rect) {
	const leftScroll = getNodeScroll(element).scrollLeft;
	if (!rect) return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
	return rect.left + leftScroll;
}
function getHTMLOffset(documentElement, scroll) {
	const htmlRect = documentElement.getBoundingClientRect();
	return {
		x: htmlRect.left + scroll.scrollLeft - getWindowScrollBarX(documentElement, htmlRect),
		y: htmlRect.top + scroll.scrollTop
	};
}
function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
	let { elements, rect, offsetParent, strategy } = _ref;
	const isFixed = strategy === "fixed";
	const documentElement = getDocumentElement(offsetParent);
	const topLayer = elements ? isTopLayer(elements.floating) : false;
	if (offsetParent === documentElement || topLayer && isFixed) return rect;
	let scroll = {
		scrollLeft: 0,
		scrollTop: 0
	};
	let scale = createCoords(1);
	const offsets = createCoords(0);
	const isOffsetParentAnElement = isHTMLElement(offsetParent);
	if (isOffsetParentAnElement || !isFixed) {
		if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) scroll = getNodeScroll(offsetParent);
		if (isOffsetParentAnElement) {
			const offsetRect = getBoundingClientRect(offsetParent);
			scale = getScale$1(offsetParent);
			offsets.x = offsetRect.x + offsetParent.clientLeft;
			offsets.y = offsetRect.y + offsetParent.clientTop;
		}
	}
	const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
	return {
		width: rect.width * scale.x,
		height: rect.height * scale.y,
		x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
		y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
	};
}
function getClientRects(element) {
	return element.getClientRects ? Array.from(element.getClientRects()) : [];
}
function getDocumentRect(html) {
	const scroll = getNodeScroll(html);
	const body = html.ownerDocument.body;
	const width = max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
	const height = max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
	let x = -scroll.scrollLeft + getWindowScrollBarX(html);
	const y = -scroll.scrollTop;
	if (getComputedStyle$1(body).direction === "rtl") x += max(html.clientWidth, body.clientWidth) - width;
	return {
		width,
		height,
		x,
		y
	};
}
const SCROLLBAR_MAX = 25;
function getViewportRect(element, strategy, rootBoundary) {
	if (rootBoundary === void 0) rootBoundary = "viewport";
	const isLayoutViewport = rootBoundary === "layoutViewport";
	const win = getWindow(element);
	const html = getDocumentElement(element);
	const visualViewport = win.visualViewport;
	let width = html.clientWidth;
	let height = html.clientHeight;
	let x = 0;
	let y = 0;
	if (visualViewport) {
		const layoutRelativeClientCoords = !isWebKit() || strategy === "fixed";
		if (isLayoutViewport) {
			if (!layoutRelativeClientCoords) {
				x = -visualViewport.offsetLeft;
				y = -visualViewport.offsetTop;
			}
		} else {
			width = visualViewport.width;
			height = visualViewport.height;
			if (layoutRelativeClientCoords) {
				x = visualViewport.offsetLeft;
				y = visualViewport.offsetTop;
			}
		}
	}
	if (getWindowScrollBarX(html) <= 0) {
		const doc = html.ownerDocument;
		const body = doc.body;
		const bodyStyles = getComputedStyle(body);
		const bodyMarginInline = doc.compatMode === "CSS1Compat" ? parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight) || 0 : 0;
		const reservedWidth = Math.abs(html.clientWidth - body.clientWidth - bodyMarginInline);
		const gutter = getComputedStyle(html).scrollbarGutter === "stable both-edges" ? reservedWidth / 2 : reservedWidth;
		if (gutter <= SCROLLBAR_MAX) width -= gutter;
	}
	return {
		width,
		height,
		x,
		y
	};
}
function getInnerBoundingClientRect(element, strategy) {
	const clientRect = getBoundingClientRect(element, true, strategy === "fixed");
	const top = clientRect.top + element.clientTop;
	const left = clientRect.left + element.clientLeft;
	const scale = getScale$1(element);
	return {
		width: element.clientWidth * scale.x,
		height: element.clientHeight * scale.y,
		x: left * scale.x,
		y: top * scale.y
	};
}
function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
	let rect;
	if (clippingAncestor === "viewport" || clippingAncestor === "layoutViewport") rect = getViewportRect(element, strategy, clippingAncestor);
	else if (clippingAncestor === "document") rect = getDocumentRect(getDocumentElement(element));
	else if (isElement(clippingAncestor)) rect = getInnerBoundingClientRect(clippingAncestor, strategy);
	else {
		const visualOffsets = getVisualOffsets(element);
		rect = {
			x: clippingAncestor.x - visualOffsets.x,
			y: clippingAncestor.y - visualOffsets.y,
			width: clippingAncestor.width,
			height: clippingAncestor.height
		};
	}
	return rectToClientRect(rect);
}
function getClippingElementAncestors(element, cache) {
	const cachedResult = cache.get(element);
	if (cachedResult) return cachedResult;
	let result = getOverflowAncestors(element, [], false).filter((el) => isElement(el) && getNodeName(el) !== "body");
	let lastKeptComputedStyle = null;
	const elementIsFixed = getComputedStyle$1(element).position === "fixed";
	let currentNode = elementIsFixed ? getParentNode(element) : element;
	while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
		const computedStyle = getComputedStyle$1(currentNode);
		const currentNodeIsContaining = isContainingBlock(currentNode);
		const lastPosition = lastKeptComputedStyle ? lastKeptComputedStyle.position : elementIsFixed ? "fixed" : "";
		if (!currentNodeIsContaining && (lastPosition === "fixed" || lastPosition === "absolute" && computedStyle.position === "static")) result = result.filter((ancestor) => ancestor !== currentNode);
		else lastKeptComputedStyle = computedStyle;
		currentNode = getParentNode(currentNode);
	}
	cache.set(element, result);
	return result;
}
function getClippingRect(_ref) {
	let { element, boundary, rootBoundary, strategy } = _ref;
	const clippingAncestors = [...boundary === "clippingAncestors" ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary), rootBoundary];
	const firstRect = getClientRectFromClippingAncestor(element, clippingAncestors[0], strategy);
	let top = firstRect.top;
	let right = firstRect.right;
	let bottom = firstRect.bottom;
	let left = firstRect.left;
	for (let i = 1; i < clippingAncestors.length; i++) {
		const rect = getClientRectFromClippingAncestor(element, clippingAncestors[i], strategy);
		top = max(rect.top, top);
		right = min(rect.right, right);
		bottom = min(rect.bottom, bottom);
		left = max(rect.left, left);
	}
	return {
		width: right - left,
		height: bottom - top,
		x: left,
		y: top
	};
}
function getDimensions(element) {
	const { width, height } = getCssDimensions(element);
	return {
		width,
		height
	};
}
function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
	const isOffsetParentAnElement = isHTMLElement(offsetParent);
	const documentElement = getDocumentElement(offsetParent);
	const isFixed = strategy === "fixed";
	const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
	let scroll = {
		scrollLeft: 0,
		scrollTop: 0
	};
	const offsets = createCoords(0);
	if (isOffsetParentAnElement || !isFixed) {
		if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) scroll = getNodeScroll(offsetParent);
		if (isOffsetParentAnElement) {
			const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
			offsets.x = offsetRect.x + offsetParent.clientLeft;
			offsets.y = offsetRect.y + offsetParent.clientTop;
		}
	}
	if (!isOffsetParentAnElement && documentElement) offsets.x = getWindowScrollBarX(documentElement);
	const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
	return {
		x: rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x,
		y: rect.top + scroll.scrollTop - offsets.y - htmlOffset.y,
		width: rect.width,
		height: rect.height
	};
}
function isStaticPositioned(element) {
	return getComputedStyle$1(element).position === "static";
}
function getTrueOffsetParent(element, polyfill) {
	if (!isHTMLElement(element) || getComputedStyle$1(element).position === "fixed") return null;
	if (polyfill) return polyfill(element);
	let rawOffsetParent = element.offsetParent;
	if (getDocumentElement(element) === rawOffsetParent) rawOffsetParent = rawOffsetParent.ownerDocument.body;
	return rawOffsetParent;
}
function getOffsetParent(element, polyfill) {
	const win = getWindow(element);
	if (isTopLayer(element)) return win;
	if (!isHTMLElement(element)) {
		let svgOffsetParent = getParentNode(element);
		while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
			if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) return svgOffsetParent;
			svgOffsetParent = getParentNode(svgOffsetParent);
		}
		return win;
	}
	let offsetParent = getTrueOffsetParent(element, polyfill);
	while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) offsetParent = getTrueOffsetParent(offsetParent, polyfill);
	if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) return win;
	return offsetParent || getContainingBlock(element) || win;
}
const getElementRects = async function(data) {
	const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
	const getDimensionsFn = this.getDimensions;
	const floatingDimensions = await getDimensionsFn(data.floating);
	return {
		reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
		floating: {
			x: 0,
			y: 0,
			width: floatingDimensions.width,
			height: floatingDimensions.height
		}
	};
};
function isRTL(element) {
	return getComputedStyle$1(element).direction === "rtl";
}
const platform = {
	convertOffsetParentRelativeRectToViewportRelativeRect,
	getDocumentElement,
	getClippingRect,
	getOffsetParent,
	getElementRects,
	getClientRects,
	getDimensions,
	getScale: getScale$1,
	isElement,
	isRTL
};
function rectsAreEqual(a, b) {
	return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
function observeMove(element, onMove, ancestorResize) {
	let io = null;
	let timeoutId;
	const root = getDocumentElement(element);
	function cleanup() {
		var _io;
		clearTimeout(timeoutId);
		(_io = io) == null || _io.disconnect();
		io = null;
	}
	function refresh(skip, threshold) {
		if (skip === void 0) skip = false;
		if (threshold === void 0) threshold = 1;
		cleanup();
		const elementRectForRootMargin = element.getBoundingClientRect();
		const { left, top, width, height } = elementRectForRootMargin;
		if (!skip) onMove();
		if (!width || !height) return;
		const insetTop = floor(top);
		const insetRight = floor(root.clientWidth - (left + width));
		const insetBottom = floor(root.clientHeight - (top + height));
		const insetLeft = floor(left);
		const options = {
			rootMargin: -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px",
			threshold: max(0, min(1, threshold)) || 1
		};
		let isFirstUpdate = true;
		function handleObserve(entries) {
			const ratio = entries[0].intersectionRatio;
			if (!rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) return refresh();
			if (ratio !== threshold) {
				if (!isFirstUpdate) return refresh();
				if (!ratio) timeoutId = setTimeout(() => {
					refresh(false, 1e-7);
				}, 1e3);
				else refresh(false, ratio);
			}
			isFirstUpdate = false;
		}
		try {
			io = new IntersectionObserver(handleObserve, {
				...options,
				root: root.ownerDocument
			});
		} catch (_e) {
			io = new IntersectionObserver(handleObserve, options);
		}
		io.observe(element);
	}
	const win = getWindow(element);
	const handleResize = () => refresh(ancestorResize);
	win.addEventListener("resize", handleResize);
	refresh(true);
	return () => {
		win.removeEventListener("resize", handleResize);
		cleanup();
	};
}
/**
* Automatically updates the position of the floating element when necessary.
* Should only be called when the floating element is mounted on the DOM or
* visible on the screen.
* @returns cleanup function that should be invoked when the floating element is
* removed from the DOM or hidden from the screen.
* @see https://floating-ui.com/docs/autoUpdate
*/
function autoUpdate(reference, floating, update, options) {
	if (options === void 0) options = {};
	const { ancestorScroll = true, ancestorResize = true, elementResize = typeof ResizeObserver === "function", layoutShift = typeof IntersectionObserver === "function", animationFrame = false } = options;
	const referenceEl = unwrapElement(reference);
	const ancestors = ancestorScroll || ancestorResize ? [...referenceEl ? getOverflowAncestors(referenceEl) : [], ...floating ? getOverflowAncestors(floating) : []] : [];
	ancestors.forEach((ancestor) => {
		ancestorScroll && ancestor.addEventListener("scroll", update);
		ancestorResize && ancestor.addEventListener("resize", update);
	});
	const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update, ancestorResize) : null;
	let reobserveFrame = -1;
	let resizeObserver = null;
	if (elementResize) {
		resizeObserver = new ResizeObserver((_ref) => {
			let [firstEntry] = _ref;
			if (firstEntry && firstEntry.target === referenceEl && resizeObserver && floating) {
				resizeObserver.unobserve(floating);
				cancelAnimationFrame(reobserveFrame);
				reobserveFrame = requestAnimationFrame(() => {
					var _resizeObserver;
					(_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
				});
			}
			update();
		});
		if (referenceEl && !animationFrame) resizeObserver.observe(referenceEl);
		if (floating) resizeObserver.observe(floating);
	}
	let frameId;
	let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
	if (animationFrame) frameLoop();
	function frameLoop() {
		const nextRefRect = getBoundingClientRect(reference);
		if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) update();
		prevRefRect = nextRefRect;
		frameId = requestAnimationFrame(frameLoop);
	}
	update();
	return () => {
		var _resizeObserver2;
		ancestors.forEach((ancestor) => {
			ancestorScroll && ancestor.removeEventListener("scroll", update);
			ancestorResize && ancestor.removeEventListener("resize", update);
		});
		cleanupIo?.();
		(_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
		resizeObserver = null;
		if (animationFrame) cancelAnimationFrame(frameId);
	};
}
/**
* Modifies the placement by translating the floating element along the
* specified axes.
* A number (shorthand for `mainAxis` or distance), or an axes configuration
* object may be passed.
* @see https://floating-ui.com/docs/offset
*/
const offset$2 = offset$1;
/**
* Optimizes the visibility of the floating element by shifting it in order to
* keep it in view when it will overflow the clipping boundary.
* @see https://floating-ui.com/docs/shift
*/
const shift$2 = shift$1;
/**
* Optimizes the visibility of the floating element by flipping the `placement`
* in order to keep it in view when the preferred placement(s) will overflow the
* clipping boundary. Alternative to `autoPlacement`.
* @see https://floating-ui.com/docs/flip
*/
const flip$2 = flip$1;
/**
* Provides data that allows you to change the size of the floating element —
* for instance, prevent it from overflowing the clipping boundary or match the
* width of the reference element.
* @see https://floating-ui.com/docs/size
*/
const size$2 = size$1;
/**
* Built-in `limiter` that will stop `shift()` at a certain point.
*/
const limitShift$2 = limitShift$1;
/**
* Computes the `x` and `y` coordinates that will place the floating element
* next to a given reference element.
*/
const computePosition = (reference, floating, options) => {
	const cache = /* @__PURE__ */ new Map();
	const mergedOptions = options != null ? options : {};
	const platformWithCache = {
		...platform,
		...mergedOptions.platform,
		_c: cache
	};
	return computePosition$1(reference, floating, {
		...mergedOptions,
		platform: platformWithCache
	});
};
//#endregion
//#region ../../node_modules/.pnpm/@floating-ui+react-dom@2.1.9_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@floating-ui/react-dom/dist/floating-ui.react-dom.mjs
var index = typeof document !== "undefined" ? react.useLayoutEffect : function noop() {};
function deepEqual(a, b) {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a === "function" && a.toString() === b.toString()) return true;
	let length;
	let i;
	let keys;
	if (a && b && typeof a === "object") {
		if (Array.isArray(a)) {
			length = a.length;
			if (length !== b.length) return false;
			for (i = length; i-- !== 0;) if (!deepEqual(a[i], b[i])) return false;
			return true;
		}
		keys = Object.keys(a);
		length = keys.length;
		if (length !== Object.keys(b).length) return false;
		for (i = length; i-- !== 0;) if (!{}.hasOwnProperty.call(b, keys[i])) return false;
		for (i = length; i-- !== 0;) {
			const key = keys[i];
			if (key === "_owner" && a.$$typeof) continue;
			if (!deepEqual(a[key], b[key])) return false;
		}
		return true;
	}
	return a !== a && b !== b;
}
function getDPR(element) {
	if (typeof window === "undefined") return 1;
	return (element.ownerDocument.defaultView || window).devicePixelRatio || 1;
}
function roundByDPR(element, value) {
	const dpr = getDPR(element);
	return Math.round(value * dpr) / dpr;
}
function useLatestRef(value) {
	const ref = react.useRef(value);
	index(() => {
		ref.current = value;
	});
	return ref;
}
/**
* Provides data to position a floating element.
* @see https://floating-ui.com/docs/useFloating
*/
function useFloating(options) {
	if (options === void 0) options = {};
	const { placement = "bottom", strategy = "absolute", middleware = [], platform, elements: { reference: externalReference, floating: externalFloating } = {}, transform = true, whileElementsMounted, open } = options;
	const [data, setData] = react.useState({
		x: 0,
		y: 0,
		strategy,
		placement,
		middlewareData: {},
		isPositioned: false
	});
	const [latestMiddleware, setLatestMiddleware] = react.useState(middleware);
	if (!deepEqual(latestMiddleware, middleware)) setLatestMiddleware(middleware);
	const [_reference, _setReference] = react.useState(null);
	const [_floating, _setFloating] = react.useState(null);
	const setReference = react.useCallback((node) => {
		if (node !== referenceRef.current) {
			referenceRef.current = node;
			_setReference(node);
		}
	}, []);
	const setFloating = react.useCallback((node) => {
		if (node !== floatingRef.current) {
			floatingRef.current = node;
			_setFloating(node);
		}
	}, []);
	const referenceEl = externalReference || _reference;
	const floatingEl = externalFloating || _floating;
	const referenceRef = react.useRef(null);
	const floatingRef = react.useRef(null);
	const dataRef = react.useRef(data);
	const hasWhileElementsMounted = whileElementsMounted != null;
	const whileElementsMountedRef = useLatestRef(whileElementsMounted);
	const platformRef = useLatestRef(platform);
	const openRef = useLatestRef(open);
	const update = react.useCallback(() => {
		if (!referenceRef.current || !floatingRef.current) return;
		const config = {
			placement,
			strategy,
			middleware: latestMiddleware
		};
		if (platformRef.current) config.platform = platformRef.current;
		computePosition(referenceRef.current, floatingRef.current, config).then((data) => {
			const fullData = {
				...data,
				isPositioned: openRef.current !== false
			};
			if (isMountedRef.current && !deepEqual(dataRef.current, fullData)) {
				dataRef.current = fullData;
				react_dom.flushSync(() => {
					setData(fullData);
				});
			}
		});
	}, [
		latestMiddleware,
		placement,
		strategy,
		platformRef,
		openRef
	]);
	index(() => {
		if (open === false && dataRef.current.isPositioned) {
			dataRef.current.isPositioned = false;
			setData((data) => ({
				...data,
				isPositioned: false
			}));
		}
	}, [open]);
	const isMountedRef = react.useRef(false);
	index(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);
	index(() => {
		if (referenceEl) referenceRef.current = referenceEl;
		if (floatingEl) floatingRef.current = floatingEl;
		if (referenceEl && floatingEl) {
			if (whileElementsMountedRef.current) return whileElementsMountedRef.current(referenceEl, floatingEl, update);
			update();
		}
	}, [
		referenceEl,
		floatingEl,
		update,
		whileElementsMountedRef,
		hasWhileElementsMounted
	]);
	const refs = react.useMemo(() => ({
		reference: referenceRef,
		floating: floatingRef,
		setReference,
		setFloating
	}), [setReference, setFloating]);
	const elements = react.useMemo(() => ({
		reference: referenceEl,
		floating: floatingEl
	}), [referenceEl, floatingEl]);
	const floatingStyles = react.useMemo(() => {
		const initialStyles = {
			position: strategy,
			left: 0,
			top: 0
		};
		if (!elements.floating) return initialStyles;
		const x = roundByDPR(elements.floating, data.x);
		const y = roundByDPR(elements.floating, data.y);
		if (transform) return {
			...initialStyles,
			transform: "translate(" + x + "px, " + y + "px)",
			...getDPR(elements.floating) >= 1.5 && { willChange: "transform" }
		};
		return {
			position: strategy,
			left: x,
			top: y
		};
	}, [
		strategy,
		transform,
		elements.floating,
		data.x,
		data.y
	]);
	return react.useMemo(() => ({
		...data,
		update,
		refs,
		elements,
		floatingStyles
	}), [
		data,
		update,
		refs,
		elements,
		floatingStyles
	]);
}
/**
* Modifies the placement by translating the floating element along the
* specified axes.
* A number (shorthand for `mainAxis` or distance), or an axes configuration
* object may be passed.
* @see https://floating-ui.com/docs/offset
*/
const offset = (options, deps) => {
	const result = offset$2(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
/**
* Optimizes the visibility of the floating element by shifting it in order to
* keep it in view when it will overflow the clipping boundary.
* @see https://floating-ui.com/docs/shift
*/
const shift = (options, deps) => {
	const result = shift$2(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
/**
* Built-in `limiter` that will stop `shift()` at a certain point.
*/
const limitShift = (options, deps) => {
	return {
		fn: limitShift$2(options).fn,
		options: [options, deps]
	};
};
/**
* Optimizes the visibility of the floating element by flipping the `placement`
* in order to keep it in view when the preferred placement(s) will overflow the
* clipping boundary. Alternative to `autoPlacement`.
* @see https://floating-ui.com/docs/flip
*/
const flip = (options, deps) => {
	const result = flip$2(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
/**
* Provides data that allows you to change the size of the floating element —
* for instance, prevent it from overflowing the clipping boundary or match the
* width of the reference element.
* @see https://floating-ui.com/docs/size
*/
const size = (options, deps) => {
	const result = size$2(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/root/SelectRootContext.mjs
const SelectRootContext = /*#__PURE__*/ react.createContext(void 0);
const SelectFloatingContext = /*#__PURE__*/ react.createContext(void 0);
function useSelectRootContext() {
	const store = react.useContext(SelectRootContext);
	if (store === void 0) throw new Error(formatErrorMessage(60));
	return store;
}
function useSelectFloatingContext() {
	const context = react.useContext(SelectFloatingContext);
	if (context === void 0) throw new Error(formatErrorMessage(61));
	return context;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/field/control/FieldControlDataAttributes.mjs
/**
* Present when the field is in a valid state.
*/
const valid = "data-valid";
/**
* Present when the field is in an invalid state.
*/
const invalid = "data-invalid";
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/field-constants/constants.mjs
const DEFAULT_VALIDITY_STATE = {
	badInput: false,
	customError: false,
	patternMismatch: false,
	rangeOverflow: false,
	rangeUnderflow: false,
	stepMismatch: false,
	tooLong: false,
	tooShort: false,
	typeMismatch: false,
	valid: null,
	valueMissing: false
};
const DEFAULT_FIELD_ROOT_STATE = {
	disabled: false,
	valid: null,
	touched: false,
	dirty: false,
	filled: false,
	focused: false
};
const fieldValidityMapping = { valid(value) {
	if (value === null) return null;
	if (value) return { [valid]: "" };
	return { [invalid]: "" };
} };
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs
const DEFAULT_FIELD_ROOT_CONTEXT = {
	invalid: void 0,
	name: void 0,
	validityData: {
		state: DEFAULT_VALIDITY_STATE,
		errors: [],
		error: "",
		value: "",
		initialValue: null
	},
	setValidityData: NOOP,
	disabled: void 0,
	setTouched: NOOP,
	setDirty: NOOP,
	setFilled: NOOP,
	setFocused: NOOP,
	focusOwnerRef: { current: void 0 },
	validationMode: "onSubmit",
	shouldValidateOnChange: () => false,
	state: DEFAULT_FIELD_ROOT_STATE,
	registerFieldControl: NOOP,
	validation: {
		getValidationProps: (_disabled, props = EMPTY_OBJECT) => props,
		inputRef: { current: null },
		registeredInputs: /* @__PURE__ */ new Map(),
		registerInput: NOOP,
		getInputControl: () => null,
		commit: async () => {},
		change: NOOP
	}
};
const FieldRootContext = /*#__PURE__*/ react.createContext(DEFAULT_FIELD_ROOT_CONTEXT);
function useFieldRootContext(optional = true) {
	const context = react.useContext(FieldRootContext);
	if (context.setValidityData === NOOP && !optional) throw new Error(formatErrorMessage(28));
	return context;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/field-register-control/useRegisterFieldControl.mjs
function useRegisterFieldControl(controlRef, id, value, getFormValueOverride, enabled = true, name) {
	const { registerFieldControl } = useFieldRootContext();
	const sourceRef = useRefWithInit(() => Symbol());
	useIsoLayoutEffect(() => {
		const source = sourceRef.current;
		if (!enabled) {
			registerFieldControl(source, void 0);
			return;
		}
		registerFieldControl(source, {
			controlRef,
			getValue: getFormValueOverride,
			id,
			name,
			value
		});
	}, [
		controlRef,
		enabled,
		getFormValueOverride,
		id,
		name,
		registerFieldControl,
		sourceRef,
		value
	]);
	useIsoLayoutEffect(() => {
		const source = sourceRef.current;
		return () => {
			registerFieldControl(source, void 0);
		};
	}, [registerFieldControl, sourceRef]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/useBaseUiId.mjs
/**
* Wraps `useId` and prefixes generated `id`s with `base-ui-`
* @param {string | undefined} idOverride overrides the generated id when provided
* @returns {string | undefined}
*/
function useBaseUiId(idOverride) {
	return useId$2(idOverride, "base-ui");
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs
/**
* A context for providing [labelable elements](https://html.spec.whatwg.org/multipage/forms.html#category-label)\
* with an accessible name (label) and description.
*/
const LabelableContext = /*#__PURE__*/ react.createContext({
	controlId: void 0,
	registerControlId: NOOP,
	resetControlId: NOOP,
	labelId: void 0,
	setLabelId: NOOP,
	messageIds: [],
	setMessageIds: NOOP,
	getDescriptionProps: (externalProps) => externalProps
});
function useLabelableContext() {
	return react.useContext(LabelableContext);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/labelable-provider/useLabelableId.mjs
function useLabelableId(params = {}) {
	const { id, enabled = true } = params;
	const { controlId, registerControlId, resetControlId } = useLabelableContext();
	const defaultId = useBaseUiId();
	const controlSourceRef = useRefWithInit(() => Symbol());
	const hasRegisteredRef = react.useRef(false);
	const hadExplicitIdRef = react.useRef(false);
	const unregisterControlId = useStableCallback(() => {
		if (!hasRegisteredRef.current || registerControlId === NOOP) return;
		hasRegisteredRef.current = false;
		registerControlId(controlSourceRef.current, void 0);
	});
	useIsoLayoutEffect(() => {
		if (!enabled || registerControlId === NOOP) {
			unregisterControlId();
			return;
		}
		let nextId;
		if (id !== void 0) {
			hadExplicitIdRef.current = true;
			nextId = id;
		} else if (hadExplicitIdRef.current) nextId = defaultId;
		else {
			resetControlId();
			return;
		}
		if (nextId === void 0) {
			unregisterControlId();
			return;
		}
		hasRegisteredRef.current = true;
		registerControlId(controlSourceRef.current, nextId);
	}, [
		id,
		enabled,
		registerControlId,
		resetControlId,
		defaultId,
		controlSourceRef,
		unregisterControlId
	]);
	useIsoLayoutEffect(() => {
		return unregisterControlId;
	}, [unregisterControlId]);
	return (enabled ? controlId : void 0) ?? id ?? defaultId;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/areArraysEqual.mjs
/**
* Compares two arrays element-wise.
*
* The default comparison is `Object.is`, so `NaN` equals `NaN` and `0` does not equal `-0`.
*/
function areArraysEqual(array1, array2, itemComparer = Object.is) {
	const { length } = array1;
	if (length !== array2.length) return false;
	for (let i = 0; i < length; i += 1) if (!itemComparer(array1[i], array2[i])) return false;
	return true;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/itemEquality.mjs
const defaultItemEquality = (itemValue, selectedValue) => Object.is(itemValue, selectedValue);
function compareItemEquality(itemValue, selectedValue, comparer) {
	if (itemValue == null || selectedValue == null) return Object.is(itemValue, selectedValue);
	return comparer(itemValue, selectedValue);
}
function isSelectedValueDirty(currentValue, initialValue, comparer) {
	if (Array.isArray(currentValue) && Array.isArray(initialValue)) return !areArraysEqual(currentValue, initialValue, (itemValue, initialItemValue) => compareItemEquality(itemValue, initialItemValue, comparer));
	return currentValue !== initialValue;
}
function selectedValueIncludes(selectedValues, itemValue, comparer) {
	if (!selectedValues) return false;
	return selectedValues.some((selectedValue) => {
		if (selectedValue === void 0) return false;
		return compareItemEquality(itemValue, selectedValue, comparer);
	});
}
function findItemIndex(itemValues, selectedValue, comparer) {
	if (!itemValues) return -1;
	return itemValues.findIndex((itemValue) => {
		if (itemValue === void 0) return false;
		return compareItemEquality(itemValue, selectedValue, comparer);
	});
}
function createSelectionMatcher(selectedValues, comparer) {
	if (comparer !== defaultItemEquality) return (itemValue) => selectedValueIncludes(selectedValues, itemValue, comparer);
	const index = new Set(selectedValues);
	index.delete(void 0);
	return (itemValue) => index.has(itemValue) && (itemValue !== 0 || selectedValues.some((v) => Object.is(itemValue, v)));
}
function findSelectionIndex(itemValues, selectedValue, comparer, multiple) {
	const index = multiple && Array.isArray(selectedValue) ? itemValues.findIndex(createSelectionMatcher(selectedValue, comparer)) : findItemIndex(itemValues, selectedValue, comparer);
	return index === -1 ? null : index;
}
/** Resolves the first selected index as items register or change. */
function resolveSelectedIndex(index, itemValue, registry, selectedValues, comparer, currentIndex) {
	if (selectedValueIncludes(selectedValues, itemValue, comparer)) return currentIndex != null && index > currentIndex && selectedValueIncludes(selectedValues, registry[currentIndex], comparer) ? currentIndex : index;
	return index === currentIndex ? findSelectionIndex(registry, selectedValues, comparer, true) : currentIndex;
}
function removeItem(selectedValues, itemValue, comparer) {
	return selectedValues.filter((selectedValue) => !compareItemEquality(itemValue, selectedValue, comparer));
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/serializeValue.mjs
function serializeValue(value) {
	if (value == null) return "";
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/resolveValueLabel.mjs
function isGroup(item) {
	return typeof item === "object" && item != null && Array.isArray(item.items);
}
function isGroupedItems(items) {
	return isGroup(items?.[0]);
}
function flattenLeafItems(items) {
	return isGroupedItems(items) ? items.flatMap((group) => group.items) : items;
}
/**
* Checks if the items array contains an item with a null value that has a non-null label.
*/
function hasNullItemLabel(items) {
	if (!Array.isArray(items)) return items != null && "null" in items;
	const arrayItems = items;
	if (isGroupedItems(arrayItems)) {
		for (const group of arrayItems) for (const item of group.items) if (item && item.value == null && item.label != null) return true;
		return false;
	}
	for (const item of arrayItems) if (item && item.value == null && item.label != null) return true;
	return false;
}
function stringifyAsLabel(item, itemToStringLabel) {
	if (itemToStringLabel && item != null) return itemToStringLabel(item) ?? "";
	if (item && typeof item === "object") {
		if ("label" in item && item.label != null) return String(item.label);
		if ("value" in item) return String(item.value);
	}
	return serializeValue(item);
}
function stringifyAsValue(item, itemToStringValue) {
	if (itemToStringValue && item != null) return itemToStringValue(item) ?? "";
	if (item && typeof item === "object" && "value" in item && "label" in item) return serializeValue(item.value);
	return serializeValue(item);
}
function resolveSelectedLabel(value, items, itemToStringLabel) {
	function fallback() {
		return stringifyAsLabel(value, itemToStringLabel);
	}
	if (itemToStringLabel && value != null) return itemToStringLabel(value);
	if (value && typeof value === "object" && "label" in value && value.label != null) return value.label;
	if (items && !Array.isArray(items)) return (Object.hasOwn(items, value) ? items[value] : void 0) ?? fallback();
	if (Array.isArray(items)) {
		const flatItems = flattenLeafItems(items);
		if (value == null || typeof value !== "object") {
			const match = flatItems.find((item) => item.value === value);
			if (match && match.label != null) return match.label;
			return fallback();
		}
		if ("value" in value) {
			const match = flatItems.find((item) => item && item.value === value.value);
			if (match && match.label != null) return match.label;
		}
	}
	return fallback();
}
function resolveMultipleLabels(values, items, itemToStringLabel) {
	return values.reduce((acc, value, index) => {
		if (index > 0) acc.push(", ");
		acc.push(/*#__PURE__*/ (0, react_jsx_runtime.jsx)(react.Fragment, { children: resolveSelectedLabel(value, items, itemToStringLabel) }, index));
		return acc;
	}, []);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/store.mjs
/**
* Non-reactive values shared with the select parts. Nothing here is observable through
* `selectors`, so writing to a ref never notifies subscribers.
*/
const selectors = {
	id: (state) => state.id,
	labelId: (state) => state.labelId,
	modal: (state) => state.modal,
	multiple: (state) => state.multiple,
	disabled: (state) => state.disabled,
	readOnly: (state) => state.readOnly,
	required: (state) => state.required,
	highlightItemOnHover: (state) => state.highlightItemOnHover,
	items: (state) => state.items,
	itemToStringLabel: (state) => state.itemToStringLabel,
	isItemEqualToValue: (state) => state.isItemEqualToValue,
	value: (state) => state.value,
	hasSelectedValue: (state) => {
		const { value, multiple, itemToStringValue } = state;
		if (value == null) return false;
		if (multiple && Array.isArray(value)) return value.length > 0;
		return stringifyAsValue(value, itemToStringValue) !== "";
	},
	hasNullItemLabel: (state, enabled) => {
		return enabled ? hasNullItemLabel(state.items) : false;
	},
	open: (state) => state.open,
	mounted: (state) => state.mounted,
	forceMount: (state) => state.forceMount,
	transitionStatus: (state) => state.transitionStatus,
	openMethod: (state) => state.openMethod,
	activeIndex: (state) => state.activeIndex,
	selectedIndex: (state) => state.selectedIndex,
	isActive: (state, index) => state.activeIndex === index,
	isSelected: (state, itemValue) => {
		const comparer = state.isItemEqualToValue;
		const storeValue = state.value;
		if (state.multiple) return Array.isArray(storeValue) && storeValue.some((selectedItem) => compareItemEquality(itemValue, selectedItem, comparer));
		return compareItemEquality(itemValue, storeValue, comparer);
	},
	isSelectedByFocus: (state, index) => {
		return state.selectedIndex === index;
	},
	popupProps: (state) => state.popupProps,
	triggerProps: (state) => state.triggerProps,
	itemRoot: (state) => state.itemRoot,
	triggerElement: (state) => state.triggerElement,
	positionerElement: (state) => state.positionerElement,
	listElement: (state) => state.listElement,
	popupSide: (state) => state.popupSide,
	scrollUpArrowVisible: (state) => state.scrollUpArrowVisible,
	scrollDownArrowVisible: (state) => state.scrollDownArrowVisible,
	hasScrollArrows: (state) => state.hasScrollArrows
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/form-context/FormContext.mjs
const FormContext = /*#__PURE__*/ react.createContext({
	elementRef: { current: null },
	formRef: { current: { fields: /* @__PURE__ */ new Map() } },
	errors: {},
	clearErrors: NOOP,
	validationMode: "onSubmit",
	submitCountRef: { current: 0 }
});
function useFormContext() {
	return react.useContext(FormContext);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/useValueChanged.mjs
function useValueChanged(value, onChange) {
	const valueRef = react.useRef(value);
	const onChangeCallback = useStableCallback(onChange);
	useIsoLayoutEffect(() => {
		if (valueRef.current !== value) onChangeCallback(valueRef.current);
		valueRef.current = value;
	}, [value, onChangeCallback]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useEnhancedClickHandler.mjs
/**
* Provides a cross-browser way to determine the type of the pointer used to click.
* Safari and Firefox do not provide the PointerEvent to the click handler (they use MouseEvent) yet.
* Additionally, this implementation detects if the click was triggered by the keyboard.
*
* @param handler The function to be called when the button is clicked. The first parameter is the original event and the second parameter is the pointer type.
*/
function useEnhancedClickHandler(handler) {
	const lastClickInteractionTypeRef = react.useRef("");
	const handlePointerDown = react.useCallback((event) => {
		if (event.defaultPrevented) return;
		lastClickInteractionTypeRef.current = event.pointerType;
		handler(event, event.pointerType);
	}, [handler]);
	return {
		onClick: react.useCallback((event) => {
			if (event.detail === 0) {
				handler(event, "keyboard");
				return;
			}
			if ("pointerType" in event) handler(event, event.pointerType);
			else handler(event, lastClickInteractionTypeRef.current);
			lastClickInteractionTypeRef.current = "";
		}, [handler]),
		onPointerDown: handlePointerDown
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/useOpenInteractionType.mjs
function useOpenMethodTriggerProps(open, setOpenMethod) {
	const { onClick, onPointerDown } = useEnhancedClickHandler(useStableCallback((_, interactionType) => {
		if (!(typeof open === "function" ? open() : open)) setOpenMethod(interactionType || (ios ? "touch" : ""));
	}));
	return react.useMemo(() => ({
		onClick,
		onPointerDown
	}), [onClick, onPointerDown]);
}
/**
* Determines the interaction type (keyboard, mouse, touch, etc.) that opened the component.
*
* @param open The open state of the component.
*/
function useOpenInteractionType(open) {
	const [openMethod, setOpenMethod] = react.useState(null);
	const triggerProps = useOpenMethodTriggerProps(open, setOpenMethod);
	useValueChanged(open, (previousOpen) => {
		if (previousOpen && !open) setOpenMethod(null);
	});
	return react.useMemo(() => ({
		openMethod,
		triggerProps
	}), [openMethod, triggerProps]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/clamp.mjs
function clamp(val, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
	return Math.max(min, Math.min(val, max));
}
function getMaxScrollOffset(scrollSize, clientSize) {
	return Math.max(0, scrollSize - clientSize);
}
function normalizeScrollOffset(value, max) {
	if (max <= 0) return 0;
	const clamped = clamp(value, 0, max);
	const startDistance = clamped;
	const endDistance = max - clamped;
	const withinStartTolerance = startDistance <= 1;
	const withinEndTolerance = endDistance <= 1;
	if (withinStartTolerance && withinEndTolerance) return startDistance <= endDistance ? 0 : max;
	if (withinStartTolerance) return 0;
	if (withinEndTolerance) return max;
	return clamped;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/root/SelectRoot.mjs
/**
* Groups all parts of the select.
* Doesn't render its own HTML element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
function SelectRoot(props) {
	const { id, value: valueProp, defaultValue = null, onValueChange, open: openProp, defaultOpen = false, onOpenChange, name: nameProp, form, autoComplete, disabled: disabledProp = false, readOnly = false, required = false, modal = true, actionsRef, inputRef, onOpenChangeComplete, items, multiple = false, itemToStringLabel, itemToStringValue, isItemEqualToValue = defaultItemEquality, highlightItemOnHover = true, children } = props;
	const { clearErrors } = useFormContext();
	const { setDirty, setTouched, setFocused, validityData, setFilled, name: fieldName, disabled: fieldDisabled, validation, validationMode } = useFieldRootContext();
	const generatedId = useLabelableId({ id });
	const disabled = fieldDisabled || disabledProp;
	const name = fieldName ?? nameProp;
	const [value, setValueUnwrapped] = useControlled({
		controlled: valueProp,
		default: multiple ? defaultValue ?? EMPTY_ARRAY : defaultValue,
		name: "Select",
		state: "value"
	});
	const [open, setOpenUnwrapped] = useControlled({
		controlled: openProp,
		default: defaultOpen,
		name: "Select",
		state: "open"
	});
	const listRef = react.useRef([]);
	const labelsRef = react.useRef([]);
	const popupRef = react.useRef(null);
	const scrollHandlerRef = react.useRef(null);
	const scrollArrowsMountedCountRef = react.useRef(0);
	const valueRef = react.useRef(null);
	const valuesRef = react.useRef([]);
	const typingRef = react.useRef(false);
	const firstItemTextRef = react.useRef(null);
	const selectedItemTextRef = react.useRef(null);
	const selectionRef = react.useRef({
		allowSelectedMouseUp: false,
		allowUnselectedMouseUp: false,
		dragY: 0
	});
	const alignItemWithTriggerActiveRef = react.useRef(false);
	const initialValueRef = react.useRef(value);
	const { openMethod, triggerProps: interactionTypeProps } = useOpenInteractionType(open);
	const store = useRefWithInit(() => new ReactStore({
		id: generatedId,
		labelId: void 0,
		modal,
		multiple,
		disabled,
		readOnly,
		required,
		highlightItemOnHover,
		itemToStringLabel,
		itemToStringValue,
		isItemEqualToValue,
		value,
		open,
		mounted: open,
		transitionStatus: void 0,
		items,
		forceMount: false,
		openMethod: null,
		activeIndex: null,
		selectedIndex: null,
		popupProps: EMPTY_OBJECT,
		triggerProps: EMPTY_OBJECT,
		itemRoot: {
			props: EMPTY_OBJECT,
			multiple,
			disabled,
			readOnly,
			isItemEqualToValue
		},
		triggerElement: null,
		positionerElement: null,
		listElement: null,
		popupSide: null,
		scrollUpArrowVisible: false,
		scrollDownArrowVisible: false,
		hasScrollArrows: false
	}, {
		setValue: NOOP,
		setOpen: NOOP,
		handleScrollArrowVisibility: NOOP,
		onOpenChangeComplete: NOOP,
		listRef,
		popupRef,
		scrollHandlerRef,
		scrollArrowsMountedCountRef,
		valueRef,
		valuesRef,
		labelsRef,
		typingRef,
		selectionRef,
		firstItemTextRef,
		selectedItemTextRef,
		alignItemWithTriggerActiveRef,
		initialValueRef
	}, selectors)).current;
	const [preventUnmountOnClose, setPreventUnmountOnClose] = react.useState(false);
	const { mounted, transitionStatus, forceUnmount: handleUnmount } = useUnmountAfterClose({
		open,
		ref: popupRef,
		preventUnmountOnClose,
		setPreventUnmountOnClose,
		onUnmount() {
			store.update({
				activeIndex: null,
				openMethod: null,
				scrollUpArrowVisible: false,
				scrollDownArrowVisible: false
			});
			onOpenChangeComplete?.(false);
		}
	});
	const activeIndex = store.useState("activeIndex");
	const selectedIndex = store.useState("selectedIndex");
	const triggerElement = store.useState("triggerElement");
	const positionerElement = store.useState("positionerElement");
	const previousOpenMethod = usePreviousValue(openMethod);
	const renderedOpenMethod = openMethod ?? previousOpenMethod;
	const serializedValue = react.useMemo(() => {
		if (multiple) return "";
		return stringifyAsValue(value, itemToStringValue);
	}, [
		multiple,
		value,
		itemToStringValue
	]);
	const fieldStringValue = react.useMemo(() => {
		if (multiple && Array.isArray(value)) return value.map((currentValue) => stringifyAsValue(currentValue, itemToStringValue));
		return stringifyAsValue(value, itemToStringValue);
	}, [
		multiple,
		value,
		itemToStringValue
	]);
	useRegisterFieldControl(useValueAsRef(triggerElement), generatedId, value, useStableCallback(() => fieldStringValue), !disabled, nameProp);
	const hasSelectedValue = multiple ? Array.isArray(value) && value.length > 0 : value != null && serializedValue !== "";
	useIsoLayoutEffect(() => {
		setFilled(hasSelectedValue);
	}, [hasSelectedValue, setFilled]);
	useIsoLayoutEffect(function syncSelectedIndex() {
		const nextIndex = findSelectionIndex(valuesRef.current, value, isItemEqualToValue, multiple);
		if (nextIndex === null) selectedItemTextRef.current = null;
		if (open) return;
		store.set("selectedIndex", nextIndex);
	}, [
		multiple,
		open,
		value,
		isItemEqualToValue,
		store
	]);
	useValueChanged(value, () => {
		clearErrors(name);
		setDirty(isSelectedValueDirty(value, validityData.initialValue, isItemEqualToValue));
		validation.change(value);
	});
	const setOpen = useStableCallback((nextOpen, eventDetails) => {
		const openEventDetails = eventDetails;
		const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(openEventDetails);
		onOpenChange?.(nextOpen, openEventDetails);
		if (eventDetails.isCanceled) return;
		if (!nextOpen) setPreventUnmountOnClose(shouldPreventUnmountOnClose());
		setOpenUnwrapped(nextOpen);
		if (!nextOpen && (eventDetails.reason === "focus-out" || eventDetails.reason === "outside-press")) {
			setTouched(true);
			setFocused(false);
			if (validationMode === "onBlur") validation.commit(value);
		}
	});
	react.useImperativeHandle(actionsRef, () => ({
		unmount: handleUnmount,
		close: () => {
			if (store.state.open) setOpen(false, createChangeEventDetails(imperativeAction));
		}
	}), [
		handleUnmount,
		setOpen,
		store
	]);
	const setValue = useStableCallback((nextValue, eventDetails) => {
		onValueChange?.(nextValue, eventDetails);
		if (eventDetails.isCanceled) return;
		setValueUnwrapped(nextValue);
	});
	const handleScrollArrowVisibility = useStableCallback((scroller) => {
		const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
		const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
		const shouldShowUp = scrollTop > 0;
		const shouldShowDown = scrollTop < maxScrollTop;
		store.set("scrollUpArrowVisible", shouldShowUp);
		store.set("scrollDownArrowVisible", shouldShowDown);
	});
	const floatingContext = useFloatingRootContext({
		open,
		onOpenChange: setOpen,
		elements: {
			reference: triggerElement,
			floating: positionerElement
		}
	});
	const click = useClick(floatingContext, {
		enabled: !disabled,
		event: "mousedown"
	});
	const dismiss = useDismiss(floatingContext);
	const listNavigation = useListNavigation(floatingContext, {
		enabled: !disabled,
		listRef,
		activeIndex,
		selectedIndex,
		disabledIndices: EMPTY_ARRAY,
		onNavigate(nextActiveIndex) {
			if (nextActiveIndex === null && !open) return;
			store.set("activeIndex", nextActiveIndex);
		},
		focusItemOnHover: highlightItemOnHover
	});
	const typeahead = useTypeahead(floatingContext, {
		enabled: !disabled && (open || !readOnly && !multiple),
		listRef: labelsRef,
		activeIndex,
		selectedIndex,
		disabledIndices: (index) => isElementDisabled(listRef.current[index]),
		onMatch(index) {
			if (open) store.set("activeIndex", index);
			else setValue(valuesRef.current[index], createChangeEventDetails(none));
		},
		onTyping(typing) {
			typingRef.current = typing;
		}
	});
	const mergedTriggerProps = react.useMemo(() => mergeProps(typeahead.reference, listNavigation.reference, dismiss.reference, click.reference, interactionTypeProps), [
		click.reference,
		typeahead.reference,
		listNavigation.reference,
		dismiss.reference,
		interactionTypeProps
	]);
	const popupProps = react.useMemo(() => mergeProps(FOCUSABLE_POPUP_PROPS, typeahead.floating, listNavigation.floating, dismiss.floating), [
		typeahead.floating,
		listNavigation.floating,
		dismiss.floating
	]);
	const itemProps = listNavigation.item ?? EMPTY_OBJECT;
	const itemRoot = react.useMemo(() => ({
		props: itemProps,
		multiple,
		disabled,
		readOnly,
		isItemEqualToValue
	}), [
		itemProps,
		multiple,
		disabled,
		readOnly,
		isItemEqualToValue
	]);
	store.useContextCallback("setValue", setValue);
	store.useContextCallback("setOpen", setOpen);
	store.useContextCallback("handleScrollArrowVisibility", handleScrollArrowVisibility);
	store.useContextCallback("onOpenChangeComplete", onOpenChangeComplete);
	useOnFirstRender(() => {
		store.update({
			popupProps,
			triggerProps: mergedTriggerProps,
			itemRoot
		});
	});
	store.useSyncedValues({
		id: generatedId,
		modal,
		multiple,
		disabled,
		readOnly,
		required,
		highlightItemOnHover,
		value,
		open,
		mounted,
		transitionStatus,
		popupProps,
		triggerProps: mergedTriggerProps,
		itemRoot,
		items,
		itemToStringLabel,
		itemToStringValue,
		isItemEqualToValue,
		openMethod: renderedOpenMethod
	});
	const ref = useMergedRefs(inputRef, validation.inputRef);
	const hiddenInputName = multiple ? void 0 : name;
	const hiddenInputs = react.useMemo(() => {
		if (!multiple || !Array.isArray(value) || !name) return null;
		return value.map((v) => {
			const currentSerializedValue = stringifyAsValue(v, itemToStringValue);
			return /*#__PURE__*/ (0, react_jsx_runtime.jsx)("input", {
				type: "hidden",
				form,
				name,
				value: currentSerializedValue,
				disabled
			}, currentSerializedValue);
		});
	}, [
		multiple,
		value,
		form,
		name,
		itemToStringValue,
		disabled
	]);
	return /*#__PURE__*/ (0, react_jsx_runtime.jsxs)(SelectRootContext.Provider, {
		value: store,
		children: [
			/*#__PURE__*/ (0, react_jsx_runtime.jsx)(SelectFloatingContext.Provider, {
				value: floatingContext,
				children
			}),
			/*#__PURE__*/ (0, react_jsx_runtime.jsx)("input", {
				...validation.getValidationProps(disabled, {
					onFocus() {
						store.state.triggerElement?.focus({ focusVisible: true });
					},
					onChange(event) {
						if (event.nativeEvent.defaultPrevented || disabled || readOnly) return;
						const nextValue = event.currentTarget.value;
						const details = createChangeEventDetails(none, event.nativeEvent);
						function handleChange() {
							if (multiple) return;
							const nextValueLower = nextValue.toLowerCase();
							let matchingIndex = valuesRef.current.findIndex((candidate) => stringifyAsValue(candidate, itemToStringValue).toLowerCase() === nextValueLower || stringifyAsLabel(candidate, itemToStringLabel).toLowerCase() === nextValueLower);
							if (matchingIndex === -1) matchingIndex = valuesRef.current.findIndex((_, index) => {
								const renderedLabel = labelsRef.current[index];
								return renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower;
							});
							const matchingValue = valuesRef.current[matchingIndex];
							if (matchingValue != null) setValue(matchingValue, details);
						}
						store.set("forceMount", true);
						queueMicrotask(handleChange);
					}
				}),
				id: generatedId && hiddenInputName == null ? `${generatedId}-hidden-input` : void 0,
				form,
				name: hiddenInputName,
				autoComplete,
				value: serializedValue,
				disabled,
				required: required && !(multiple && hasSelectedValue),
				readOnly,
				ref,
				style: name ? visuallyHiddenInput : visuallyHidden,
				tabIndex: -1,
				"aria-hidden": true,
				suppressHydrationWarning: true
			}),
			hiddenInputs
		]
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/resolveAriaLabelledBy.mjs
function resolveAriaLabelledBy(fieldLabelId, localLabelId) {
	return fieldLabelId ?? localLabelId;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/field-root-context/useSetFieldFocused.mjs
/**
* Returns the field's `setFocused`, recording which control the focused state belongs to.
*
* Disabling or unmounting a focused control moves focus away without firing `blur`, so the focused
* state would otherwise stay latched. A field can have several focus targets, so a control only
* clears the shared state when focus last landed on itself. The stable callback doubles as that
* identity.
*/
function useSetFieldFocused(disabled, focusTargetRef, onFocusedChange) {
	const { setFocused, focusOwnerRef } = useFieldRootContext();
	const setFieldFocused = useStableCallback((focused) => {
		if (focused ? !disabled : focusOwnerRef.current === setFieldFocused) {
			focusOwnerRef.current = focused && setFieldFocused;
			onFocusedChange?.(focused);
			setFocused(focused);
		}
	});
	useIsoLayoutEffect(() => {
		const el = focusTargetRef.current;
		if ((el?.getRootNode())?.activeElement === el) setFieldFocused(true);
		return () => setFieldFocused(false);
	}, [
		disabled,
		focusTargetRef,
		setFieldFocused
	]);
	return setFieldFocused;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/getPseudoElementBounds.mjs
const BOUNDARY_OFFSET = 5;
/**
* Determines if a mouse event occurred within the bounds of an element
* (including its pseudo-elements), with a small tolerance for pointer drift.
*/
function isMouseWithinBounds(event, element) {
	const bounds = getPseudoElementBounds(element);
	return event.clientX >= bounds.left - BOUNDARY_OFFSET && event.clientX <= bounds.right + BOUNDARY_OFFSET && event.clientY >= bounds.top - BOUNDARY_OFFSET && event.clientY <= bounds.bottom + BOUNDARY_OFFSET;
}
function getPseudoElementBounds(element) {
	const elementRect = element.getBoundingClientRect();
	const win = getWindow(element);
	if (jsdom) return elementRect;
	const beforeStyles = win.getComputedStyle(element, "::before");
	const afterStyles = win.getComputedStyle(element, "::after");
	if (!(beforeStyles.content !== "none" || afterStyles.content !== "none")) return elementRect;
	const beforeWidth = parseFloat(beforeStyles.width) || 0;
	const beforeHeight = parseFloat(beforeStyles.height) || 0;
	const afterWidth = parseFloat(afterStyles.width) || 0;
	const afterHeight = parseFloat(afterStyles.height) || 0;
	const totalWidth = Math.max(elementRect.width, beforeWidth, afterWidth);
	const totalHeight = Math.max(elementRect.height, beforeHeight, afterHeight);
	const widthDiff = totalWidth - elementRect.width;
	const heightDiff = totalHeight - elementRect.height;
	return {
		left: elementRect.left - widthDiff / 2,
		right: elementRect.right + widthDiff / 2,
		top: elementRect.top - heightDiff / 2,
		bottom: elementRect.bottom + heightDiff / 2
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/composite/root/CompositeRootContext.mjs
const CompositeRootContext = /*#__PURE__*/ react.createContext(void 0);
function useCompositeRootContext(optional = false) {
	const context = react.useContext(CompositeRootContext);
	if (context === void 0 && !optional) throw new Error(formatErrorMessage(16));
	return context;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/useFocusableWhenDisabled.mjs
function useFocusableWhenDisabled(parameters) {
	const { focusableWhenDisabled, disabled, composite = false, tabIndex: tabIndexProp = 0, isNativeButton } = parameters;
	const isFocusableComposite = composite && focusableWhenDisabled !== false;
	const isNonFocusableComposite = composite && focusableWhenDisabled === false;
	return { props: react.useMemo(() => {
		const additionalProps = { onKeyDown(event) {
			if (disabled && focusableWhenDisabled && event.key !== "Tab") event.preventDefault();
		} };
		if (!composite) {
			additionalProps.tabIndex = tabIndexProp;
			if (!isNativeButton && disabled) additionalProps.tabIndex = focusableWhenDisabled ? tabIndexProp : -1;
		}
		if (isNativeButton && (focusableWhenDisabled || isFocusableComposite) || !isNativeButton && disabled) additionalProps["aria-disabled"] = disabled;
		if (isNativeButton && (!focusableWhenDisabled || isNonFocusableComposite)) additionalProps.disabled = disabled;
		return additionalProps;
	}, [
		composite,
		disabled,
		focusableWhenDisabled,
		isFocusableComposite,
		isNonFocusableComposite,
		isNativeButton,
		tabIndexProp
	]) };
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/dispatchClickWithModifiers.mjs
/**
* Dispatches a constructed click on the target so it carries the source event's
* modifier state, which `click()` always reports as unpressed. Like `click()`,
* the untrusted click still runs native activation behavior (form submission,
* link navigation).
* `detail` defaults to 0 and `pointerType` to `''` (the native convention for
* keyboard-generated clicks). When the click represents a mouse gesture, pass
* `detail: 1` and `pointerType: 'mouse'` so consumers don't classify it as a
* keyboard activation.
*/
function dispatchClickWithModifiers(target, sourceEvent, { detail = 0, pointerType = "" } = {}) {
	target.dispatchEvent(new (getWindow(target)).PointerEvent("click", {
		bubbles: true,
		cancelable: true,
		composed: true,
		detail,
		pointerType,
		shiftKey: sourceEvent.shiftKey,
		ctrlKey: sourceEvent.ctrlKey,
		altKey: sourceEvent.altKey,
		metaKey: sourceEvent.metaKey
	}));
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/use-button/useButton.mjs
function useButton(parameters = {}) {
	const { disabled = false, focusableWhenDisabled, tabIndex = 0, native: isNativeButton = true, composite: compositeProp } = parameters;
	const elementRef = react.useRef(null);
	const compositeRootContext = useCompositeRootContext(true);
	const isCompositeItem = compositeProp ?? compositeRootContext !== void 0;
	const { props: focusableWhenDisabledProps } = useFocusableWhenDisabled({
		focusableWhenDisabled,
		disabled,
		composite: isCompositeItem,
		tabIndex,
		isNativeButton
	});
	const updateDisabled = react.useCallback(() => {
		const element = elementRef.current;
		if (!isButtonElement(element)) return;
		if (isCompositeItem && disabled && focusableWhenDisabledProps.disabled === void 0 && element.disabled) element.disabled = false;
	}, [
		disabled,
		focusableWhenDisabledProps.disabled,
		isCompositeItem
	]);
	useIsoLayoutEffect(updateDisabled, [updateDisabled]);
	return {
		getButtonProps: react.useCallback((externalProps = {}) => {
			const { onClick: externalOnClick, onMouseDown: externalOnMouseDown, onKeyUp: externalOnKeyUp, onKeyDown: externalOnKeyDown, onPointerDown: externalOnPointerDown, ...otherExternalProps } = externalProps;
			return mergeProps({
				onClick(event) {
					if (disabled) {
						event.preventDefault();
						return;
					}
					externalOnClick?.(event);
				},
				onMouseDown(event) {
					if (!disabled) externalOnMouseDown?.(event);
				},
				onKeyDown(event) {
					if (disabled) return;
					makeEventPreventable(event);
					externalOnKeyDown?.(event);
					if (event.baseUIHandlerPrevented) return;
					const isCurrentTarget = event.target === event.currentTarget;
					const currentTarget = event.currentTarget;
					const isButton = isButtonElement(currentTarget);
					const isLink = !isNativeButton && isValidLinkElement(currentTarget);
					const shouldClick = isCurrentTarget && (isNativeButton ? isButton : !isLink);
					const isEnterKey = event.key === "Enter";
					const isSpaceKey = event.key === " ";
					const role = currentTarget.getAttribute("role");
					const isTextNavigationRole = role?.startsWith("menuitem") || role === "option" || role === "gridcell";
					if (isCurrentTarget && isCompositeItem && isSpaceKey) {
						if (event.defaultPrevented && isTextNavigationRole) return;
						event.preventDefault();
						if (!isNativeButton || isButton) {
							event.preventBaseUIHandler();
							dispatchClickWithModifiers(currentTarget, event);
						}
						return;
					}
					if (!shouldClick || isNativeButton || !isSpaceKey && !isEnterKey) {
						if (isCurrentTarget && isLink && isSpaceKey) event.preventDefault();
						return;
					}
					if (event.defaultPrevented) return;
					event.preventDefault();
					if (isEnterKey) {
						event.preventBaseUIHandler();
						dispatchClickWithModifiers(currentTarget, event);
					}
				},
				onKeyUp(event) {
					if (disabled) return;
					makeEventPreventable(event);
					externalOnKeyUp?.(event);
					if (event.target === event.currentTarget && isNativeButton && isCompositeItem && isButtonElement(event.currentTarget) && event.key === " ") {
						event.preventDefault();
						return;
					}
					if (event.baseUIHandlerPrevented) return;
					if (event.target === event.currentTarget && !isNativeButton && !isCompositeItem && !event.defaultPrevented && event.key === " ") {
						event.preventBaseUIHandler();
						dispatchClickWithModifiers(event.currentTarget, event);
					}
				},
				onPointerDown(event) {
					if (disabled) {
						event.preventDefault();
						return;
					}
					externalOnPointerDown?.(event);
				}
			}, isNativeButton ? { type: "button" } : { role: "button" }, focusableWhenDisabledProps, otherExternalProps);
		}, [
			disabled,
			focusableWhenDisabledProps,
			isCompositeItem,
			isNativeButton
		]),
		buttonRef: useStableCallback((element) => {
			elementRef.current = element;
			updateDisabled();
		})
	};
}
function isButtonElement(elem) {
	return isHTMLElement(elem) && elem.tagName === "BUTTON";
}
function isValidLinkElement(elem) {
	return isHTMLElement(elem) && elem.tagName === "A" && Boolean(elem.href);
}
/**
* Indicates which side the corresponding popup is positioned relative to its anchor.
* @type {'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start' | null}
*/
const popupSide = "data-popup-side";
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/trigger/SelectTrigger.mjs
const SELECTED_DELAY = 400;
const stateAttributesMapping$2 = {
	...pressableTriggerOpenStateMapping,
	...fieldValidityMapping,
	popupSide: (side) => side ? { [popupSide]: side } : null,
	value: () => null
};
/**
* A button that opens the select popup.
* Renders a `<button>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectTrigger$1 = /*#__PURE__*/ react.forwardRef(function SelectTrigger(componentProps, forwardedRef) {
	const { render, className, id: idProp, disabled: disabledProp = false, nativeButton = true, style, ...elementProps } = componentProps;
	const { setTouched, validationMode, validation, state: fieldState, disabled: fieldDisabled } = useFieldRootContext();
	const { labelId: fieldLabelId } = useLabelableContext();
	const store = useSelectRootContext();
	const readOnly = store.useState("readOnly");
	const required = store.useState("required");
	const selectDisabled = store.useState("disabled");
	const disabled = fieldDisabled || selectDisabled || disabledProp;
	const open = store.useState("open");
	const mounted = store.useState("mounted");
	const value = store.useState("value");
	const triggerProps = store.useState("triggerProps");
	const positionerElement = store.useState("positionerElement");
	const listElement = store.useState("listElement");
	const popupSideValue = store.useState("popupSide");
	const rootId = store.useState("id");
	const selectLabelId = store.useState("labelId");
	const hasSelectedValue = store.useState("hasSelectedValue");
	const popupSide = mounted && positionerElement ? popupSideValue : null;
	const id = idProp ?? rootId;
	const ariaLabelledBy = resolveAriaLabelledBy(fieldLabelId, selectLabelId);
	useLabelableId({ id: idProp });
	const positionerRef = useValueAsRef(positionerElement);
	const triggerRef = react.useRef(null);
	const setFocused = useSetFieldFocused(disabled, triggerRef);
	const { getButtonProps, buttonRef } = useButton({
		disabled,
		native: nativeButton
	});
	const setTriggerElement = store.useStateSetter("triggerElement");
	const timeoutFocus = useTimeout();
	const timeoutMouseDown = useTimeout();
	const selectedDelayTimeout = useTimeout();
	react.useEffect(() => {
		if (open) {
			selectedDelayTimeout.start(SELECTED_DELAY, () => {
				store.context.selectionRef.current.allowUnselectedMouseUp = true;
				store.context.selectionRef.current.allowSelectedMouseUp = true;
			});
			return () => {
				selectedDelayTimeout.clear();
			};
		}
		store.context.selectionRef.current = {
			allowSelectedMouseUp: false,
			allowUnselectedMouseUp: false,
			dragY: 0
		};
		timeoutMouseDown.clear();
	}, [
		open,
		store,
		timeoutMouseDown,
		selectedDelayTimeout
	]);
	const mergedProps = mergeProps(triggerProps, {
		id,
		role: "combobox",
		"aria-expanded": open,
		"aria-haspopup": "listbox",
		"aria-controls": open ? listElement?.id ?? getFloatingFocusElement(positionerElement)?.id : void 0,
		"aria-labelledby": ariaLabelledBy,
		"aria-readonly": readOnly || void 0,
		"aria-required": required || void 0,
		tabIndex: disabled ? -1 : 0,
		onFocus(event) {
			setFocused(true);
			if (open && store.context.alignItemWithTriggerActiveRef.current) store.context.setOpen(false, createChangeEventDetails(none, event.nativeEvent));
			timeoutFocus.start(0, () => {
				store.set("forceMount", true);
			});
		},
		onBlur(event) {
			if (contains(positionerElement, event.relatedTarget)) return;
			setTouched(true);
			setFocused(false);
			if (validationMode === "onBlur") validation.commit(value);
		},
		onMouseDown(event) {
			if (open) return;
			const doc = ownerDocument(event.currentTarget);
			function handleMouseUp(mouseEvent) {
				if (!triggerRef.current) return;
				const mouseUpTarget = mouseEvent.target;
				if (contains(triggerRef.current, mouseUpTarget) || contains(positionerRef.current, mouseUpTarget)) return;
				if (isMouseWithinBounds(mouseEvent, triggerRef.current)) return;
				store.context.setOpen(false, createChangeEventDetails(cancelOpen, mouseEvent));
			}
			timeoutMouseDown.start(0, () => {
				doc.addEventListener("mouseup", handleMouseUp, { once: true });
			});
		}
	}, elementProps, getButtonProps);
	const props = validation.getValidationProps(disabled, mergedProps);
	props.role = "combobox";
	const state = {
		...fieldState,
		open,
		disabled,
		value,
		readOnly,
		popupSide,
		placeholder: !hasSelectedValue
	};
	return useRenderElement("button", componentProps, {
		ref: [
			forwardedRef,
			triggerRef,
			buttonRef,
			setTriggerElement
		],
		state,
		stateAttributesMapping: stateAttributesMapping$2,
		props
	});
});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/value/SelectValue.mjs
const stateAttributesMapping$1 = { value: () => null };
/**
* A text label of the currently selected item.
* Renders a `<span>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectValue$1 = /*#__PURE__*/ react.forwardRef(function SelectValue(componentProps, forwardedRef) {
	const { className, render, children: childrenProp, placeholder, style, ...elementProps } = componentProps;
	const store = useSelectRootContext();
	const value = store.useState("value");
	const items = store.useState("items");
	const itemToStringLabel = store.useState("itemToStringLabel");
	const hasSelectedValue = store.useState("hasSelectedValue");
	const shouldCheckNullItemLabel = !hasSelectedValue && placeholder != null && childrenProp == null;
	const hasNullLabel = store.useState("hasNullItemLabel", shouldCheckNullItemLabel);
	const state = {
		value,
		placeholder: !hasSelectedValue
	};
	let children = null;
	if (typeof childrenProp === "function") children = childrenProp(value);
	else if (childrenProp != null) children = childrenProp;
	else if (shouldCheckNullItemLabel && !hasNullLabel) children = placeholder;
	else if (Array.isArray(value)) children = resolveMultipleLabels(value, items, itemToStringLabel);
	else children = resolveSelectedLabel(value, items, itemToStringLabel);
	return useRenderElement("span", componentProps, {
		state,
		ref: [forwardedRef, store.context.valueRef],
		props: [{ children }, elementProps],
		stateAttributesMapping: stateAttributesMapping$1
	});
});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/icon/SelectIcon.mjs
/**
* An icon that indicates that the trigger button opens a select popup.
* Renders a `<span>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectIcon = /*#__PURE__*/ react.forwardRef(function SelectIcon(componentProps, forwardedRef) {
	const { render, className, style, ...elementProps } = componentProps;
	return useRenderElement("span", componentProps, {
		state: { open: useSelectRootContext().useState("open") },
		ref: forwardedRef,
		props: [{
			"aria-hidden": true,
			children: "▼"
		}, elementProps],
		stateAttributesMapping: triggerOpenStateMapping
	});
});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/portal/SelectPortal.mjs
/**
* A portal element that moves the popup to a different part of the DOM.
* By default, the portal element is appended to `<body>`.
* Renders a `<div>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectPortal = /*#__PURE__*/ react.forwardRef(function SelectPortal(portalProps, forwardedRef) {
	const store = useSelectRootContext();
	const mounted = store.useState("mounted");
	const forceMount = store.useState("forceMount");
	if (!(mounted || forceMount)) return null;
	return /*#__PURE__*/ (0, react_jsx_runtime.jsx)(FloatingPortal, {
		ref: forwardedRef,
		...portalProps
	});
});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/inertValue.mjs
function inertValue(value) {
	if (isReactVersionAtLeast(19)) return value;
	return value ? "true" : void 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/composite/list/CompositeListContext.mjs
const CompositeListContext = /*#__PURE__*/ react.createContext({
	register: () => {},
	unregister: () => {},
	subscribeMapChange: () => () => {},
	nextIndexRef: { current: 0 }
});
function useCompositeListContext() {
	return react.useContext(CompositeListContext);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/composite/list/CompositeList.mjs
/**
* Provides context for a list of items in a composite component.
*/
function CompositeList(props) {
	const { children, elementsRef, labelsRef, onMapChange: onMapChangeProp } = props;
	const onMapChange = useStableCallback(onMapChangeProp);
	const [, setMapTick] = react.useState(0);
	const listeners = useRefWithInit(createListeners).current;
	const map = useRefWithInit(createMap).current;
	const nextIndexRef = react.useRef(0);
	const isDirtyRef = react.useRef(true);
	const itemsRef = react.useRef(null);
	const mutationObserverRef = react.useRef(null);
	const scheduleMapUpdate = useStableCallback(() => {
		if (isDirtyRef.current) return;
		isDirtyRef.current = true;
		setMapTick((tick) => tick + 1);
	});
	const register = useStableCallback((node, registration) => {
		map.set(node, registration);
		scheduleMapUpdate();
	});
	const unregister = useStableCallback((node) => {
		map.delete(node);
		scheduleMapUpdate();
	});
	const syncRefs = useStableCallback((items) => {
		const nextMap = /* @__PURE__ */ new Map();
		elementsRef.current.length = 0;
		if (labelsRef) labelsRef.current.length = 0;
		items.forEach((item) => {
			nextMap.set(item.element, {
				...item.registration.metadata ?? {},
				index: item.index
			});
			elementsRef.current[item.index] = item.element;
			if (labelsRef) labelsRef.current[item.index] = item.registration.label !== void 0 ? item.registration.label : item.registration.textRef?.current?.textContent ?? item.element.textContent;
		});
		nextIndexRef.current = elementsRef.current.length;
		return nextMap;
	});
	function observe(sortedNodes) {
		mutationObserverRef.current?.disconnect();
		mutationObserverRef.current = null;
		if (typeof MutationObserver !== "function" || sortedNodes.length < 2) return;
		const mutationObserver = new MutationObserver((entries) => {
			if (!hasMovedNode(entries)) return;
			let previousConnectedNode = null;
			for (const node of sortedNodes) {
				if (!node.isConnected) continue;
				if (previousConnectedNode && sortByDocumentPosition(previousConnectedNode, node) > 0) {
					mutationObserver.disconnect();
					scheduleMapUpdate();
					return;
				}
				previousConnectedNode = node;
			}
		});
		mutationObserverRef.current = mutationObserver;
		const roots = /* @__PURE__ */ new Set();
		for (let i = 1; i < sortedNodes.length; i += 1) {
			const root = getCommonAncestor(sortedNodes[i - 1], sortedNodes[i]);
			if (root) roots.add(root);
		}
		roots.forEach((root) => mutationObserver.observe(root, { childList: true }));
	}
	const flush = useStableCallback(() => {
		const [items, automaticNodes] = getCompositeListSnapshot(map);
		const nextMap = syncRefs(items);
		const previousItems = itemsRef.current;
		const changed = !previousItems || previousItems.length !== items.length || items.some((item, index) => {
			const previousItem = previousItems[index];
			return item.index !== previousItem.index || item.element !== previousItem.element || item.registration.index !== previousItem.registration.index || item.registration.metadata !== previousItem.registration.metadata;
		});
		observe(automaticNodes);
		itemsRef.current = items;
		isDirtyRef.current = false;
		if (!changed) return;
		listeners.forEach((listener) => listener(nextMap));
		onMapChange(nextMap);
	});
	useIsoLayoutEffect(() => {
		if (!isDirtyRef.current && itemsRef.current) syncRefs(itemsRef.current);
		return () => {
			elementsRef.current = [];
			if (labelsRef) labelsRef.current = [];
		};
	}, [
		elementsRef,
		labelsRef,
		syncRefs
	]);
	useIsoLayoutEffect(() => {
		if (isDirtyRef.current) flush();
	});
	useIsoLayoutEffect(() => {
		return () => {
			mutationObserverRef.current?.disconnect();
			isDirtyRef.current = true;
		};
	}, []);
	const subscribeMapChange = useStableCallback((fn) => {
		listeners.add(fn);
		return () => {
			listeners.delete(fn);
		};
	});
	const contextValue = react.useMemo(() => ({
		register,
		unregister,
		subscribeMapChange,
		nextIndexRef
	}), [
		register,
		unregister,
		subscribeMapChange,
		nextIndexRef
	]);
	return /*#__PURE__*/ (0, react_jsx_runtime.jsx)(CompositeListContext.Provider, {
		value: contextValue,
		children
	});
}
function createMap() {
	return /* @__PURE__ */ new Map();
}
function createListeners() {
	return /* @__PURE__ */ new Set();
}
function getCompositeListSnapshot(map) {
	const reservedIndices = /* @__PURE__ */ new Set();
	const items = [];
	const automaticItems = [];
	map.forEach((registration, node) => {
		if (!node.isConnected) return;
		const index = registration.index;
		const item = {
			index: index ?? -1,
			element: node,
			registration
		};
		if (index === null) automaticItems.push(item);
		else if (index >= 0) {
			reservedIndices.add(index);
			items.push(item);
		}
	});
	let nextAutomaticIndex = 0;
	automaticItems.sort((a, b) => sortByDocumentPosition(a.element, b.element));
	automaticItems.forEach((item) => {
		while (reservedIndices.has(nextAutomaticIndex)) nextAutomaticIndex += 1;
		item.index = nextAutomaticIndex;
		items.push(item);
		nextAutomaticIndex += 1;
	});
	if (reservedIndices.size > 0) items.sort((a, b) => a.index - b.index);
	return [items, automaticItems.map((item) => item.element)];
}
function getCommonAncestor(firstNode, lastNode) {
	let ancestor = firstNode.parentElement;
	while (ancestor && !ancestor.contains(lastNode)) ancestor = ancestor.parentElement;
	return ancestor;
}
function hasMovedNode(entries) {
	for (const entry of entries) for (let i = 0; i < entry.removedNodes.length; i += 1) if (entry.removedNodes[i].isConnected) return true;
	return false;
}
function sortByDocumentPosition(a, b) {
	if (a.nextElementSibling === b) return -1;
	if (b.nextElementSibling === a) return 1;
	return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/hooks/useFloating.mjs
/**
* Provides data to position a floating element and context to add interactions.
* The caller supplies the root store, which owns the reference and floating elements.
* @see https://floating-ui.com/docs/useFloating
*/
function useBaseUIFloating(options) {
	const { nodeId, externalTree, rootContext: store } = options;
	const referenceElement = store.useState("referenceElement");
	const floatingElement = store.useState("floatingElement");
	const domReferenceElement = store.useState("domReferenceElement");
	const open = store.useState("open");
	const floatingId = store.useState("floatingId");
	const [positionReference, setPositionReferenceRaw] = react.useState(null);
	const domReferenceRef = react.useRef(null);
	const tree = useFloatingTree(externalTree);
	const storeElements = react.useMemo(() => ({
		reference: referenceElement,
		floating: floatingElement,
		domReference: domReferenceElement
	}), [
		referenceElement,
		floatingElement,
		domReferenceElement
	]);
	const position = useFloating({
		...options,
		elements: {
			...storeElements,
			...positionReference && { reference: positionReference }
		}
	});
	const setPositionReference = react.useCallback((node) => {
		const computedPositionReference = isElement(node) ? {
			getBoundingClientRect: () => node.getBoundingClientRect(),
			getClientRects: () => node.getClientRects(),
			contextElement: node
		} : node;
		setPositionReferenceRaw(computedPositionReference);
		position.refs.setReference(computedPositionReference);
	}, [position.refs]);
	const refs = react.useMemo(() => ({
		...position.refs,
		setPositionReference,
		domReference: domReferenceRef
	}), [position.refs, setPositionReference]);
	const elements = react.useMemo(() => ({
		...position.elements,
		domReference: domReferenceElement
	}), [position.elements, domReferenceElement]);
	const context = react.useMemo(() => ({
		...position,
		dataRef: store.context.dataRef,
		open,
		onOpenChange: store.setOpen,
		events: store.context.events,
		floatingId,
		refs,
		elements,
		nodeId,
		rootStore: store
	}), [
		position,
		refs,
		elements,
		nodeId,
		store,
		open,
		floatingId
	]);
	useIsoLayoutEffect(() => {
		if (domReferenceElement) domReferenceRef.current = domReferenceElement;
	}, [domReferenceElement]);
	useIsoLayoutEffect(() => {
		store.context.dataRef.current.floatingContext = context;
		const node = tree?.nodesRef.current.find((n) => n.id === nodeId);
		if (node) node.context = context;
	});
	return react.useMemo(() => ({
		...position,
		context,
		refs,
		elements,
		rootStore: store
	}), [
		position,
		refs,
		elements,
		context,
		store
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/direction-context/DirectionContext.mjs
const DirectionContext = /*#__PURE__*/ react.createContext(void 0);
function useDirection() {
	return react.useContext(DirectionContext)?.direction ?? "ltr";
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/floating-ui-react/middleware/arrow.mjs
/**
* Fork of the original `arrow` middleware from Floating UI that always uses the floating element
* as the arrow's offset parent.
*/
const baseArrow = (options) => ({
	name: "arrow",
	options,
	async fn(state) {
		const { x, y, placement, rects, platform, elements, middlewareData } = state;
		const { element, padding = 0 } = evaluate(options, state) || {};
		if (element == null) return {};
		const paddingObject = getPaddingObject(padding);
		const coords = {
			x,
			y
		};
		const axis = getAlignmentAxis(placement);
		const length = getAxisLength(axis);
		const arrowDimensions = await platform.getDimensions(element);
		const isYAxis = axis === "y";
		const minProp = isYAxis ? "top" : "left";
		const maxProp = isYAxis ? "bottom" : "right";
		const clientProp = isYAxis ? "clientHeight" : "clientWidth";
		const endDiff = rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
		const startDiff = coords[axis] - rects.reference[axis];
		const clientSize = elements.floating[clientProp] || rects.floating[length];
		const centerToReference = endDiff / 2 - startDiff / 2;
		const largestPossiblePadding = clientSize / 2 - arrowDimensions[length] / 2 - 1;
		const minPadding = Math.min(paddingObject[minProp], largestPossiblePadding);
		const maxPadding = Math.min(paddingObject[maxProp], largestPossiblePadding);
		const min = minPadding;
		const max = clientSize - arrowDimensions[length] - maxPadding;
		const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
		const offset = clamp$1(min, center, max);
		const shouldAddOffset = !middlewareData.arrow && getAlignment(placement) != null && center !== offset && rects.reference[length] / 2 - (center < min ? minPadding : maxPadding) - arrowDimensions[length] / 2 < 0;
		const alignmentOffset = shouldAddOffset ? center < min ? center - min : center - max : 0;
		return {
			[axis]: coords[axis] + alignmentOffset,
			data: {
				[axis]: offset,
				centerOffset: center - offset - alignmentOffset,
				...shouldAddOffset && { alignmentOffset }
			},
			reset: shouldAddOffset
		};
	}
});
/**
* Provides data to position an inner element of the floating element so that it
* appears centered to the reference element.
* This wraps the core `arrow` middleware to allow React refs as the element.
* @see https://floating-ui.com/docs/arrow
*/
const arrow = (options, deps) => {
	const { name, fn } = baseArrow(options);
	return {
		name,
		fn,
		options: [options, deps]
	};
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/hideMiddleware.mjs
const hide = {
	name: "hide",
	async fn(state) {
		const { width, height, x, y } = state.rects.reference;
		const anchorHidden = width === 0 && height === 0 && x === 0 && y === 0;
		const overflow = await state.platform.detectOverflow(state, { elementContext: "reference" });
		return { data: { referenceHidden: overflow.top - height >= 0 || overflow.right - width >= 0 || overflow.bottom - height >= 0 || overflow.left - width >= 0 || anchorHidden } };
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/adaptiveOriginConstants.mjs
const DEFAULT_SIDES = {
	sideX: "left",
	sideY: "top"
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/CommonPositionerCssVars.mjs
/**
* The available width between the trigger and the edge of the viewport.
* @type {number}
*/
const availableWidth = "--available-width";
/**
* The available height between the trigger and the edge of the viewport.
* @type {number}
*/
const availableHeight = "--available-height";
/**
* The anchor's width.
* @type {number}
*/
const anchorWidth = "--anchor-width";
/**
* The anchor's height.
* @type {number}
*/
const anchorHeight = "--anchor-height";
/**
* The coordinates that this element is anchored to. Used for animations and transitions.
* @type {string}
*/
const transformOrigin$1 = "--transform-origin";
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/useAnchorPositioning.mjs
const AVAILABLE_WIDTH_VAR = availableWidth;
const AVAILABLE_HEIGHT_VAR = availableHeight;
function getLogicalSide(sideParam, renderedSide, isRtl) {
	const isLogicalSideParam = sideParam === "inline-start" || sideParam === "inline-end";
	return {
		top: "top",
		right: isLogicalSideParam ? isRtl ? "inline-start" : "inline-end" : "right",
		bottom: "bottom",
		left: isLogicalSideParam ? isRtl ? "inline-end" : "inline-start" : "left"
	}[renderedSide];
}
function getOffsetData(state, sideParam, isRtl) {
	const { rects, placement } = state;
	return {
		side: getLogicalSide(sideParam, getSide(placement), isRtl),
		align: getAlignment(placement) || "center",
		anchor: {
			width: rects.reference.width,
			height: rects.reference.height
		},
		positioner: {
			width: rects.floating.width,
			height: rects.floating.height
		}
	};
}
/**
* Provides standardized anchor positioning behavior for floating elements. Wraps Floating UI's
* `useFloating` hook.
*/
function useAnchorPositioning(params) {
	return useAnchorPositioningWithHook(params, useBaseUIFloating);
}
function useAnchorPositioningWithHook(params, useFloatingHook) {
	const { anchor, positionMethod = "absolute", side: sideParam = "bottom", sideOffset = 0, align = "center", alignOffset = 0, collisionBoundary, collisionPadding: collisionPaddingParam = 5, sticky = false, arrowPadding = 5, disableAnchorTracking = false, inline: inlineMiddleware, keepMounted = false, floatingRootContext, mounted, collisionAvoidance, shift: shift$3, nodeId, adaptiveOrigin, lazyFlip = false, externalTree } = params;
	const collisionAvoidanceSide = collisionAvoidance.side || "flip";
	const collisionAvoidanceAlign = collisionAvoidance.align || "flip";
	const collisionAvoidanceFallbackAxisSide = collisionAvoidance.fallbackAxisSide || "end";
	const shiftCrossAxis = shift$3?.crossAxis ?? false;
	const shiftRootBoundary = shift$3?.rootBoundary;
	const anchorFn = typeof anchor === "function" ? anchor : void 0;
	const anchorFnCallback = useStableCallback(anchorFn);
	const anchorDep = anchorFn ? anchorFnCallback : anchor;
	const anchorValueRef = useValueAsRef(anchor);
	const mountedRef = useValueAsRef(mounted);
	const isRtl = useDirection() === "rtl";
	const [mountPlacement, setMountPlacement] = react.useState(null);
	if (!mounted && mountPlacement !== null) setMountPlacement(null);
	const lockAlign = lazyFlip === "placement";
	const mountSide = mountPlacement ? getSide(mountPlacement) : null;
	const mountAlign = mountPlacement && lockAlign ? getAlignment(mountPlacement) || "center" : null;
	const side = mountSide || {
		top: "top",
		right: "right",
		bottom: "bottom",
		left: "left",
		"inline-end": isRtl ? "left" : "right",
		"inline-start": isRtl ? "right" : "left"
	}[sideParam];
	const placementAlign = mountAlign || align;
	const placement = placementAlign === "center" ? side : `${side}-${placementAlign}`;
	let collisionPadding = collisionPaddingParam;
	if (typeof collisionPadding === "number") collisionPadding = {
		top: collisionPadding,
		right: collisionPadding,
		bottom: collisionPadding,
		left: collisionPadding
	};
	else if (collisionPadding) collisionPadding = {
		top: collisionPadding.top || 0,
		right: collisionPadding.right || 0,
		bottom: collisionPadding.bottom || 0,
		left: collisionPadding.left || 0
	};
	const bias = 1;
	const biasTop = sideParam === "bottom" ? bias : 0;
	const biasBottom = sideParam === "top" ? bias : 0;
	const biasLeft = sideParam === "right" ? bias : 0;
	const biasRight = sideParam === "left" ? bias : 0;
	const commonCollisionProps = {
		boundary: collisionBoundary === "clipping-ancestors" ? "clippingAncestors" : collisionBoundary,
		padding: collisionPadding
	};
	const arrowRef = react.useRef(null);
	const sideOffsetRef = useValueAsRef(sideOffset);
	const alignOffsetRef = useValueAsRef(alignOffset);
	const sideOffsetDep = typeof sideOffset !== "function" ? sideOffset : 0;
	const alignOffsetDep = typeof alignOffset !== "function" ? alignOffset : 0;
	const middleware = [];
	if (inlineMiddleware) middleware.push(inlineMiddleware);
	middleware.push(offset((state) => {
		const data = getOffsetData(state, sideParam, isRtl);
		const sideAxis = typeof sideOffsetRef.current === "function" ? sideOffsetRef.current(data) : sideOffsetRef.current;
		const alignAxis = typeof alignOffsetRef.current === "function" ? alignOffsetRef.current(data) : alignOffsetRef.current;
		return {
			mainAxis: sideAxis,
			crossAxis: alignAxis,
			alignmentAxis: alignAxis
		};
	}, [
		sideOffsetDep,
		alignOffsetDep,
		isRtl,
		sideParam
	]));
	const shiftDisabled = collisionAvoidanceAlign === "none" && collisionAvoidanceSide !== "shift";
	const crossAxisShiftEnabled = !shiftDisabled && (sticky || shiftCrossAxis || collisionAvoidanceSide === "shift");
	const flipMiddleware = collisionAvoidanceSide === "none" ? null : flip({
		...commonCollisionProps,
		padding: {
			top: collisionPadding.top + bias + biasTop,
			right: collisionPadding.right + bias + biasRight,
			bottom: collisionPadding.bottom + bias + biasBottom,
			left: collisionPadding.left + bias + biasLeft
		},
		mainAxis: !shiftCrossAxis && collisionAvoidanceSide === "flip",
		crossAxis: collisionAvoidanceAlign === "flip" ? "alignment" : false,
		fallbackAxisSideDirection: collisionAvoidanceFallbackAxisSide
	});
	const shiftMiddleware = shiftDisabled ? null : shift({
		...commonCollisionProps,
		rootBoundary: shiftRootBoundary,
		mainAxis: collisionAvoidanceAlign !== "none",
		crossAxis: crossAxisShiftEnabled,
		limiter: sticky || shiftCrossAxis ? void 0 : limitShift((limitData) => {
			if (!arrowRef.current) return {};
			const { width, height } = arrowRef.current.getBoundingClientRect();
			const sideAxis = getSideAxis(getSide(limitData.placement));
			const arrowSize = sideAxis === "y" ? width : height;
			const offsetAmount = sideAxis === "y" ? collisionPadding.left + collisionPadding.right : collisionPadding.top + collisionPadding.bottom;
			return { offset: arrowSize / 2 + offsetAmount / 2 };
		})
	}, [
		commonCollisionProps,
		sticky,
		shiftCrossAxis,
		shiftRootBoundary,
		collisionPadding,
		collisionAvoidanceAlign
	]);
	if (collisionAvoidanceSide === "shift" || collisionAvoidanceAlign === "shift" || placementAlign === "center") middleware.push(shiftMiddleware, flipMiddleware);
	else middleware.push(flipMiddleware, shiftMiddleware);
	middleware.push(size({
		...commonCollisionProps,
		apply({ elements: { floating }, availableWidth, availableHeight, rects }) {
			if (!mountedRef.current) return;
			const floatingStyle = floating.style;
			floatingStyle.setProperty(AVAILABLE_WIDTH_VAR, `${availableWidth}px`);
			floatingStyle.setProperty(AVAILABLE_HEIGHT_VAR, `${availableHeight}px`);
			const dpr = getWindow(floating).devicePixelRatio || 1;
			const { x, y, width, height } = rects.reference;
			const anchorWidth$1 = (Math.round((x + width) * dpr) - Math.round(x * dpr)) / dpr;
			const anchorHeight$1 = (Math.round((y + height) * dpr) - Math.round(y * dpr)) / dpr;
			floatingStyle.setProperty(anchorWidth, `${anchorWidth$1}px`);
			floatingStyle.setProperty(anchorHeight, `${anchorHeight$1}px`);
		}
	}), arrow((state) => ({
		element: arrowRef.current || ownerDocument(state.elements.floating).createElement("div"),
		padding: arrowRef.current ? arrowPadding : 0
	}), [arrowPadding]), {
		name: "transformOrigin",
		fn(state) {
			const { elements: { floating }, middlewareData, placement: renderedPlacement, platform, rects, y } = state;
			const renderedSide = getSide(renderedPlacement);
			const renderedAlign = getAlignment(renderedPlacement);
			const isVertical = getSideAxis(renderedSide) === "y";
			const arrowEl = arrowRef.current;
			const sideOffsetValue = typeof sideOffset === "function" ? sideOffset(getOffsetData(state, sideParam, isRtl)) : sideOffset;
			let crossOrigin;
			if (!arrowEl && renderedAlign && Math.abs(isVertical ? middlewareData.shift?.x || 0 : middlewareData.shift?.y || 0) <= 1) crossOrigin = renderedAlign === "start" === (isVertical && platform.isRTL?.(floating) === true) ? "100%" : "0%";
			else crossOrigin = `${(isVertical ? middlewareData.arrow?.x || 0 : middlewareData.arrow?.y || 0) + (isVertical ? arrowEl?.clientWidth || 0 : arrowEl?.clientHeight || 0) / 2}px`;
			let sideOrigin = renderedSide === "top" || renderedSide === "left" ? `calc(100% + ${sideOffsetValue}px)` : `${-sideOffsetValue}px`;
			if (crossAxisShiftEnabled && isVertical && Math.abs(middlewareData.shift?.y || 0) > sideOffsetValue) sideOrigin = `${rects.reference.y + rects.reference.height / 2 - y}px`;
			floating.style.setProperty(transformOrigin$1, isVertical ? `${crossOrigin} ${sideOrigin}` : `${sideOrigin} ${crossOrigin}`);
			return {};
		}
	}, hide, adaptiveOrigin);
	useIsoLayoutEffect(() => {
		if (!mounted && floatingRootContext) floatingRootContext.update({
			referenceElement: null,
			floatingElement: null,
			domReferenceElement: null,
			positionReference: null
		});
	}, [mounted, floatingRootContext]);
	const autoUpdateOptions = react.useMemo(() => ({
		ancestorScroll: !disableAnchorTracking,
		elementResize: !disableAnchorTracking && typeof ResizeObserver !== "undefined",
		layoutShift: !disableAnchorTracking && typeof IntersectionObserver !== "undefined"
	}), [disableAnchorTracking]);
	const { refs, elements, x, y, middlewareData, update, placement: renderedPlacement, context, isPositioned, floatingStyles: originalFloatingStyles } = useFloatingHook({
		rootContext: floatingRootContext,
		open: keepMounted ? mounted : void 0,
		placement,
		middleware,
		strategy: positionMethod,
		whileElementsMounted: keepMounted ? void 0 : (...args) => autoUpdate(...args, autoUpdateOptions),
		nodeId,
		externalTree
	});
	const { sideX, sideY } = middlewareData.adaptiveOrigin || DEFAULT_SIDES;
	const resolvedPosition = isPositioned ? positionMethod : "fixed";
	const floatingStyles = react.useMemo(() => {
		let base;
		if (!isPositioned) base = {
			position: resolvedPosition,
			top: 0,
			left: 0
		};
		else if (adaptiveOrigin) base = {
			position: resolvedPosition,
			[sideX]: x,
			[sideY]: y
		};
		else base = {
			...originalFloatingStyles,
			position: resolvedPosition
		};
		base[AVAILABLE_WIDTH_VAR] = "100vw";
		base[AVAILABLE_HEIGHT_VAR] = "100vh";
		if (!isPositioned) base.opacity = 0;
		return base;
	}, [
		adaptiveOrigin,
		resolvedPosition,
		sideX,
		x,
		sideY,
		y,
		originalFloatingStyles,
		isPositioned
	]);
	const registeredPositionReferenceRef = react.useRef(null);
	useIsoLayoutEffect(() => {
		if (!mounted) return;
		const anchorValue = anchorValueRef.current;
		const resolvedAnchor = typeof anchorValue === "function" ? anchorValue() : anchorValue;
		const finalAnchor = (isRef(resolvedAnchor) ? resolvedAnchor.current : resolvedAnchor) || null;
		if (finalAnchor !== registeredPositionReferenceRef.current) {
			refs.setPositionReference(finalAnchor);
			registeredPositionReferenceRef.current = finalAnchor;
		}
	}, [
		mounted,
		refs,
		anchorDep,
		anchorValueRef
	]);
	react.useEffect(() => {
		if (!mounted) return;
		const anchorValue = anchorValueRef.current;
		if (typeof anchorValue === "function") return;
		if (isRef(anchorValue) && anchorValue.current !== registeredPositionReferenceRef.current) {
			refs.setPositionReference(anchorValue.current);
			registeredPositionReferenceRef.current = anchorValue.current;
		}
	}, [
		mounted,
		refs,
		anchorDep,
		anchorValueRef
	]);
	react.useEffect(() => {
		if (keepMounted && mounted && elements.reference && elements.floating) return autoUpdate(elements.reference, elements.floating, update, autoUpdateOptions);
	}, [
		keepMounted,
		mounted,
		elements,
		update,
		autoUpdateOptions
	]);
	const renderedSide = getSide(renderedPlacement);
	const logicalRenderedSide = getLogicalSide(sideParam, renderedSide, isRtl);
	const renderedAlign = getAlignment(renderedPlacement) || "center";
	const anchorHidden = Boolean(middlewareData.hide?.referenceHidden);
	useIsoLayoutEffect(() => {
		if (lazyFlip && mounted && isPositioned && (renderedSide !== side || lockAlign && renderedAlign !== placementAlign)) setMountPlacement(renderedPlacement);
	}, [
		lazyFlip,
		lockAlign,
		mounted,
		isPositioned,
		renderedPlacement,
		renderedSide,
		renderedAlign,
		side,
		placementAlign
	]);
	const arrowStyles = react.useMemo(() => ({
		position: "absolute",
		top: middlewareData.arrow?.y,
		left: middlewareData.arrow?.x
	}), [middlewareData.arrow]);
	const arrowUncentered = middlewareData.arrow?.centerOffset !== 0;
	return react.useMemo(() => ({
		positionerStyles: floatingStyles,
		arrowStyles,
		arrowRef,
		arrowUncentered,
		side: logicalRenderedSide,
		align: renderedAlign,
		physicalSide: renderedSide,
		anchorHidden,
		refs,
		context,
		isPositioned,
		update
	}), [
		floatingStyles,
		arrowStyles,
		arrowRef,
		arrowUncentered,
		logicalRenderedSide,
		renderedAlign,
		renderedSide,
		anchorHidden,
		refs,
		context,
		isPositioned,
		update
	]);
}
function isRef(param) {
	return param != null && "current" in param;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/positioner/SelectPositionerContext.mjs
const SelectPositionerContext = /*#__PURE__*/ react.createContext(void 0);
function useSelectPositionerContext() {
	const context = react.useContext(SelectPositionerContext);
	if (!context) throw new Error(formatErrorMessage(59));
	return context;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/InternalBackdrop.mjs
/**
* @internal
*/
const InternalBackdrop = /*#__PURE__*/ react.forwardRef(function InternalBackdrop(props, ref) {
	const { cutout, ...otherProps } = props;
	let clipPath;
	if (cutout) {
		const rect = cutout.getBoundingClientRect();
		clipPath = `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)`;
	}
	return /*#__PURE__*/ (0, react_jsx_runtime.jsx)("div", {
		ref,
		role: "presentation",
		"data-base-ui-inert": "",
		...otherProps,
		style: {
			position: "fixed",
			inset: 0,
			userSelect: "none",
			WebkitUserSelect: "none",
			clipPath
		}
	});
});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/popup/utils.mjs
function clearStyles(element, originalStyles) {
	if (element) Object.assign(element.style, originalStyles);
}
const LIST_FUNCTIONAL_STYLES = {
	position: "relative",
	maxHeight: "100%",
	overflowX: "hidden",
	overflowY: "auto"
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/getDisabledMountTransitionStyles.mjs
function getDisabledMountTransitionStyles(transitionStatus) {
	return transitionStatus === "starting" ? DISABLED_TRANSITIONS_STYLE : EMPTY_OBJECT;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/usePositioner.mjs
/**
* Renders the shared outer Positioner element used by popup components.
* Applies the common role, hidden state, transition styles, state attributes, and optional inert styling.
*/
function usePositioner(componentProps, state, { styles, transitionStatus, props, refs, hidden, inert = false }) {
	const style = { ...styles };
	if (inert) style.pointerEvents = "none";
	return useRenderElement("div", componentProps, {
		state,
		ref: refs,
		props: [
			{
				role: "presentation",
				hidden,
				style
			},
			getDisabledMountTransitionStyles(transitionStatus),
			props
		],
		stateAttributesMapping: popupStateMapping
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+utils@0.5.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/utils/useScrollLock.mjs
let originalHtmlStyles = {};
let originalBodyStyles = {};
let originalHtmlScrollBehavior = "";
function getViewportScroller(html, body) {
	return isOverflowElement(html) ? html : body;
}
function isPageScrollLocked(win, html, body) {
	return /hidden|clip/.test(win.getComputedStyle(getViewportScroller(html, body)).overflowY);
}
function hasInsetScrollbars(referenceElement) {
	if (typeof document === "undefined") return false;
	const doc = ownerDocument(referenceElement);
	return getWindow(doc).innerWidth - doc.documentElement.clientWidth > 0;
}
function supportsStableScrollbarGutter(referenceElement) {
	if (!(typeof CSS !== "undefined" && CSS.supports && CSS.supports("scrollbar-gutter", "stable")) || typeof document === "undefined") return false;
	const doc = ownerDocument(referenceElement);
	const html = doc.documentElement;
	const body = doc.body;
	const scrollContainer = getViewportScroller(html, body);
	const originalScrollContainerOverflowY = scrollContainer.style.overflowY;
	const originalHtmlStyleGutter = html.style.scrollbarGutter;
	html.style.scrollbarGutter = "stable";
	scrollContainer.style.overflowY = "scroll";
	const before = scrollContainer.offsetWidth;
	scrollContainer.style.overflowY = "hidden";
	const after = scrollContainer.offsetWidth;
	scrollContainer.style.overflowY = originalScrollContainerOverflowY;
	html.style.scrollbarGutter = originalHtmlStyleGutter;
	return before === after;
}
function preventScrollOverlayScrollbars(referenceElement) {
	const doc = ownerDocument(referenceElement);
	const html = doc.documentElement;
	const body = doc.body;
	const elementToLock = getViewportScroller(html, body);
	const originalElementToLockStyles = {
		overflowY: elementToLock.style.overflowY,
		overflowX: elementToLock.style.overflowX
	};
	Object.assign(elementToLock.style, {
		overflowY: "hidden",
		overflowX: "hidden"
	});
	return () => {
		Object.assign(elementToLock.style, originalElementToLockStyles);
	};
}
function preventScrollInsetScrollbars(referenceElement) {
	const doc = ownerDocument(referenceElement);
	const html = doc.documentElement;
	const body = doc.body;
	const win = getWindow(html);
	let scrollTop = 0;
	let scrollLeft = 0;
	let updateGutterOnly = false;
	const resizeFrame = AnimationFrame.create();
	if (webkit && (win.visualViewport?.scale ?? 1) !== 1) return () => {};
	function lockScroll() {
		const htmlStyles = win.getComputedStyle(html);
		const bodyStyles = win.getComputedStyle(body);
		const scrollbarGutterValue = (htmlStyles.scrollbarGutter || "").includes("both-edges") ? "stable both-edges" : "stable";
		scrollTop = html.scrollTop;
		scrollLeft = html.scrollLeft;
		originalHtmlStyles = {
			scrollbarGutter: html.style.scrollbarGutter,
			overflowY: html.style.overflowY,
			overflowX: html.style.overflowX
		};
		originalHtmlScrollBehavior = html.style.scrollBehavior;
		originalBodyStyles = {
			position: body.style.position,
			height: body.style.height,
			width: body.style.width,
			boxSizing: body.style.boxSizing,
			overflowY: body.style.overflowY,
			overflowX: body.style.overflowX,
			scrollBehavior: body.style.scrollBehavior
		};
		const isScrollableY = html.scrollHeight > html.clientHeight;
		const isScrollableX = html.scrollWidth > html.clientWidth;
		const hasConstantOverflowY = htmlStyles.overflowY === "scroll" || bodyStyles.overflowY === "scroll";
		const hasConstantOverflowX = htmlStyles.overflowX === "scroll" || bodyStyles.overflowX === "scroll";
		const scrollbarWidth = Math.max(0, win.innerWidth - body.clientWidth);
		const scrollbarHeight = Math.max(0, win.innerHeight - body.clientHeight);
		const marginY = parseFloat(bodyStyles.marginTop) + parseFloat(bodyStyles.marginBottom);
		const marginX = parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight);
		const elementToLock = getViewportScroller(html, body);
		updateGutterOnly = supportsStableScrollbarGutter(referenceElement);
		if (updateGutterOnly) {
			html.style.scrollbarGutter = scrollbarGutterValue;
			elementToLock.style.overflowY = "hidden";
			elementToLock.style.overflowX = "hidden";
			return;
		}
		Object.assign(html.style, {
			scrollbarGutter: scrollbarGutterValue,
			overflowY: "hidden",
			overflowX: "hidden"
		});
		if (isScrollableY || hasConstantOverflowY) html.style.overflowY = "scroll";
		if (isScrollableX || hasConstantOverflowX) html.style.overflowX = "scroll";
		Object.assign(body.style, {
			position: "relative",
			height: marginY || scrollbarHeight ? `calc(100dvh - ${marginY + scrollbarHeight}px)` : "100dvh",
			width: marginX || scrollbarWidth ? `calc(100vw - ${marginX + scrollbarWidth}px)` : "100vw",
			boxSizing: "border-box",
			overflowY: "hidden",
			overflowX: "hidden",
			scrollBehavior: "unset"
		});
		body.scrollTop = scrollTop;
		body.scrollLeft = scrollLeft;
		html.setAttribute("data-base-ui-scroll-locked", "");
		html.style.scrollBehavior = "unset";
	}
	function cleanup() {
		Object.assign(html.style, originalHtmlStyles);
		Object.assign(body.style, originalBodyStyles);
		if (!updateGutterOnly) {
			html.scrollTop = scrollTop;
			html.scrollLeft = scrollLeft;
			html.removeAttribute("data-base-ui-scroll-locked");
			html.style.scrollBehavior = originalHtmlScrollBehavior;
		}
	}
	function handleResize() {
		cleanup();
		resizeFrame.request(lockScroll);
	}
	lockScroll();
	const unsubscribeResize = addEventListener(win, "resize", handleResize);
	return () => {
		resizeFrame.cancel();
		cleanup();
		if (typeof win.removeEventListener === "function") unsubscribeResize();
	};
}
var ScrollLocker = class {
	lockCount = 0;
	restore = null;
	timeoutLock = Timeout.create();
	timeoutUnlock = Timeout.create();
	acquire(referenceElement) {
		this.lockCount += 1;
		if (this.lockCount === 1 && this.restore === null) this.timeoutLock.start(0, () => this.lock(referenceElement));
		return this.release;
	}
	release = () => {
		this.lockCount -= 1;
		if (this.lockCount === 0 && this.restore) this.timeoutUnlock.start(0, this.unlock);
	};
	unlock = () => {
		if (this.lockCount === 0 && this.restore) {
			this.restore?.();
			this.restore = null;
		}
	};
	lock(referenceElement) {
		if (this.lockCount === 0 || this.restore !== null) return;
		const doc = ownerDocument(referenceElement);
		const html = doc.documentElement;
		const body = doc.body;
		const win = getWindow(html);
		if (isPageScrollLocked(win, html, body)) {
			const observer = new win.MutationObserver(() => {
				if (isPageScrollLocked(win, html, body)) return;
				observer.disconnect();
				this.restore = null;
				this.lock(referenceElement);
			});
			const options = { attributes: true };
			observer.observe(html, options);
			observer.observe(body, options);
			this.restore = () => observer.disconnect();
			return;
		}
		const hasOverlayScrollbars = ios || !hasInsetScrollbars(referenceElement);
		this.restore = hasOverlayScrollbars ? preventScrollOverlayScrollbars(referenceElement) : preventScrollInsetScrollbars(referenceElement);
	}
};
const SCROLL_LOCKER = new ScrollLocker();
/**
* Locks the scroll of the document when enabled.
*
* @param enabled - Whether to enable the scroll lock.
* @param referenceElement - Element to use as a reference for lock calculations.
*/
function useScrollLock(enabled = true, referenceElement = null) {
	useIsoLayoutEffect(() => {
		if (!enabled) return;
		return SCROLL_LOCKER.acquire(referenceElement);
	}, [enabled, referenceElement]);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/useAnchoredPopupScrollLock.mjs
const VIEWPORT_WIDTH_TOLERANCE_PX = 20;
/**
* Manages scroll lock for anchored popups. For non-touch opens, scroll lock is applied when
* enabled. For touch opens, scroll lock is applied only when the positioner width is effectively
* viewport-sized.
*/
function useAnchoredPopupScrollLock(enabled, touchOpen, positionerElement, referenceElement) {
	const [touchOpenShouldLockScroll, setTouchOpenShouldLockScroll] = react.useState(false);
	useIsoLayoutEffect(() => {
		if (!enabled || !touchOpen || positionerElement == null) {
			setTouchOpenShouldLockScroll(false);
			return;
		}
		const viewportWidth = ownerDocument(positionerElement).documentElement.clientWidth;
		const popupWidth = positionerElement.offsetWidth;
		setTouchOpenShouldLockScroll(viewportWidth > 0 && popupWidth > 0 && popupWidth >= viewportWidth - VIEWPORT_WIDTH_TOLERANCE_PX);
	}, [
		enabled,
		touchOpen,
		positionerElement
	]);
	useScrollLock(enabled && (!touchOpen || touchOpenShouldLockScroll), referenceElement);
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/positioner/SelectPositioner.mjs
const FIXED = { position: "fixed" };
/**
* Positions the select popup.
* Renders a `<div>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectPositioner = /*#__PURE__*/ react.forwardRef(function SelectPositioner(componentProps, forwardedRef) {
	const { anchor, className, render, positionMethod, side, align, sideOffset, alignOffset, collisionBoundary = "clipping-ancestors", collisionPadding, arrowPadding, sticky, disableAnchorTracking, alignItemWithTrigger = true, collisionAvoidance = DROPDOWN_COLLISION_AVOIDANCE, style, ...elementProps } = componentProps;
	const store = useSelectRootContext();
	const floatingRootContext = useSelectFloatingContext();
	const open = store.useState("open");
	const mounted = store.useState("mounted");
	const modal = store.useState("modal");
	const value = store.useState("value");
	const openMethod = store.useState("openMethod");
	const positionerElement = store.useState("positionerElement");
	const triggerElement = store.useState("triggerElement");
	const isItemEqualToValue = store.useState("isItemEqualToValue");
	const transitionStatus = store.useState("transitionStatus");
	const scrollUpArrowRef = react.useRef(null);
	const scrollDownArrowRef = react.useRef(null);
	const [controlledAlignItemWithTrigger, setControlledAlignItemWithTrigger] = react.useState(alignItemWithTrigger);
	const alignItemWithTriggerActive = mounted && controlledAlignItemWithTrigger && openMethod !== "touch";
	if (!mounted && controlledAlignItemWithTrigger !== alignItemWithTrigger) setControlledAlignItemWithTrigger(alignItemWithTrigger);
	react.useImperativeHandle(store.context.alignItemWithTriggerActiveRef, () => alignItemWithTriggerActive);
	useAnchoredPopupScrollLock((alignItemWithTriggerActive || modal) && open, openMethod === "touch", positionerElement, triggerElement);
	const positioning = useAnchorPositioning({
		anchor,
		floatingRootContext,
		positionMethod,
		mounted,
		side,
		sideOffset,
		align,
		alignOffset,
		arrowPadding,
		collisionBoundary,
		collisionPadding,
		sticky,
		disableAnchorTracking: disableAnchorTracking ?? alignItemWithTriggerActive,
		collisionAvoidance,
		keepMounted: true
	});
	const renderedSide = alignItemWithTriggerActive ? "none" : positioning.side;
	const positionerStyles = alignItemWithTriggerActive ? FIXED : positioning.positionerStyles;
	const state = {
		open,
		side: renderedSide,
		align: positioning.align,
		anchorHidden: positioning.anchorHidden
	};
	useIsoLayoutEffect(() => {
		store.set("popupSide", positioning.side);
	}, [store, positioning.side]);
	const element = usePositioner(componentProps, state, {
		styles: positionerStyles,
		transitionStatus,
		props: elementProps,
		refs: [forwardedRef, store.useStateSetter("positionerElement")],
		hidden: !mounted,
		inert: !open
	});
	const prevMapSizeRef = react.useRef(0);
	const onMapChange = useStableCallback((map) => {
		if (store.context.valuesRef.current.length === 0) return;
		const prevSize = prevMapSizeRef.current;
		prevMapSizeRef.current = map.size;
		const eventDetails = createChangeEventDetails(none);
		if (prevSize !== 0 && !store.state.multiple && value !== null) {
			if (findItemIndex(store.context.valuesRef.current, value, isItemEqualToValue) === -1) {
				const initialSelectedValue = store.context.initialValueRef.current;
				const nextValue = initialSelectedValue != null && findItemIndex(store.context.valuesRef.current, initialSelectedValue, isItemEqualToValue) !== -1 ? initialSelectedValue : null;
				store.context.setValue(nextValue, eventDetails);
				if (nextValue === null) {
					store.set("selectedIndex", null);
					store.context.selectedItemTextRef.current = null;
				}
			}
		}
		if (prevSize !== 0 && store.state.multiple && Array.isArray(value)) {
			const nextValue = value.filter((selectedItemValue) => findItemIndex(store.context.valuesRef.current, selectedItemValue, isItemEqualToValue) !== -1);
			if (nextValue.length !== value.length) {
				store.context.setValue(nextValue, eventDetails);
				if (nextValue.length === 0) {
					store.set("selectedIndex", null);
					store.context.selectedItemTextRef.current = null;
				}
			}
		}
		if (open && alignItemWithTriggerActive) {
			store.update({
				scrollUpArrowVisible: false,
				scrollDownArrowVisible: false
			});
			const stylesToClear = { height: "" };
			clearStyles(positionerElement, stylesToClear);
			clearStyles(store.context.popupRef.current, stylesToClear);
		}
	});
	const contextValue = react.useMemo(() => ({
		...positioning,
		side: renderedSide,
		alignItemWithTriggerActive,
		setControlledAlignItemWithTrigger,
		scrollUpArrowRef,
		scrollDownArrowRef
	}), [
		positioning,
		renderedSide,
		alignItemWithTriggerActive,
		setControlledAlignItemWithTrigger
	]);
	return /*#__PURE__*/ (0, react_jsx_runtime.jsx)(CompositeList, {
		elementsRef: store.context.listRef,
		labelsRef: store.context.labelsRef,
		onMapChange,
		children: /*#__PURE__*/ (0, react_jsx_runtime.jsxs)(SelectPositionerContext.Provider, {
			value: contextValue,
			children: [mounted && modal && /*#__PURE__*/ (0, react_jsx_runtime.jsx)(InternalBackdrop, {
				inert: inertValue(!open),
				cutout: triggerElement
			}), element]
		})
	});
});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/styles.mjs
const DISABLE_SCROLLBAR_CLASS_NAME = "base-ui-disable-scrollbar";
const styleDisableScrollbar = {
	className: DISABLE_SCROLLBAR_CLASS_NAME,
	getElement(nonce) {
		return /*#__PURE__*/ (0, react_jsx_runtime.jsx)("style", {
			nonce,
			href: DISABLE_SCROLLBAR_CLASS_NAME,
			precedence: "base-ui:low",
			children: `.${DISABLE_SCROLLBAR_CLASS_NAME}{scrollbar-width:none}.${DISABLE_SCROLLBAR_CLASS_NAME}::-webkit-scrollbar{display:none}`
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/toolbar/root/ToolbarRootContext.mjs
const ToolbarRootContext = /*#__PURE__*/ react.createContext(void 0);
function useToolbarRootContext(optional) {
	const context = react.useContext(ToolbarRootContext);
	if (context === void 0 && !optional) throw new Error(formatErrorMessage(69));
	return context;
}
const COMPOSITE_KEYS = /* @__PURE__ */ new Set([
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Home",
	"End"
]);
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/csp-context/CSPContext.mjs
const CSPContext = /*#__PURE__*/ react.createContext(void 0);
const DEFAULT_CSP_CONTEXT_VALUE = { disableStyleElements: false };
function useCSPContext() {
	return react.useContext(CSPContext) ?? DEFAULT_CSP_CONTEXT_VALUE;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/positioner/SelectPositionerCssVars.mjs
/**
* The coordinates that this element is anchored to. Used for animations and transitions.
* @type {string}
*/
const transformOrigin = "--transform-origin";
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/popup/SelectPopup.mjs
const stateAttributesMapping = {
	...popupStateMapping,
	...transitionStatusMapping
};
/**
* A container for the select list.
* Renders a `<div>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectPopup = /*#__PURE__*/ react.forwardRef(function SelectPopup(componentProps, forwardedRef) {
	const { render, className, style, finalFocus, ...elementProps } = componentProps;
	const store = useSelectRootContext();
	const multiple = store.useState("multiple");
	const readOnly = store.useState("readOnly");
	const highlightItemOnHover = store.useState("highlightItemOnHover");
	const floatingRootContext = useSelectFloatingContext();
	const { side, align, alignItemWithTriggerActive, isPositioned, setControlledAlignItemWithTrigger } = useSelectPositionerContext();
	const insideToolbar = useToolbarRootContext(true) != null;
	const direction = useDirection();
	const { nonce, disableStyleElements } = useCSPContext();
	const id = store.useState("id");
	const open = store.useState("open");
	const openMethod = store.useState("openMethod");
	const mounted = store.useState("mounted");
	const popupProps = store.useState("popupProps");
	const transitionStatus = store.useState("transitionStatus");
	const triggerElement = store.useState("triggerElement");
	const positionerElement = store.useState("positionerElement");
	const listElement = store.useState("listElement");
	const reachedMaxHeightRef = react.useRef(false);
	const initialPlacedRef = react.useRef(false);
	const originalPositionerStylesRef = react.useRef({});
	const scrollArrowFrame = useAnimationFrame();
	const handleScroll = useStableCallback((scroller) => {
		if (!positionerElement || !store.context.popupRef.current || !initialPlacedRef.current) return;
		const isTopPositioned = positionerElement.style.top === "0px";
		const isBottomPositioned = positionerElement.style.bottom === "0px";
		if (reachedMaxHeightRef.current || !alignItemWithTriggerActive || !isTopPositioned && !isBottomPositioned) {
			store.context.handleScrollArrowVisibility(scroller);
			return;
		}
		const scale = getScale(positionerElement);
		const currentHeight = normalizeSize(positionerElement.getBoundingClientRect().height, "y", scale);
		const doc = ownerDocument(positionerElement);
		const win = getWindow(positionerElement);
		const positionerStyles = win.getComputedStyle(positionerElement);
		const marginTop = parseFloat(positionerStyles.marginTop);
		const marginBottom = parseFloat(positionerStyles.marginBottom);
		const maxPopupHeight = getMaxPopupHeight(win.getComputedStyle(store.context.popupRef.current));
		const maxAvailableHeight = Math.min(doc.documentElement.clientHeight - marginTop - marginBottom, maxPopupHeight);
		const scrollTop = scroller.scrollTop;
		const maxScrollTop = getMaxScrollTop(scroller);
		let nextScrollTop = null;
		const setHeight = (height) => {
			positionerElement.style.height = `${height}px`;
		};
		const diff = isTopPositioned ? maxScrollTop - scrollTop : scrollTop;
		const nextHeight = Math.min(currentHeight + diff, maxAvailableHeight);
		if (diff <= 1) {
			const heightDelta = clamp(diff, 0, maxAvailableHeight - currentHeight);
			if (heightDelta > 0) setHeight(currentHeight + heightDelta);
			scroller.scrollTop = isTopPositioned ? maxScrollTop : 0;
			if (maxAvailableHeight - (currentHeight + heightDelta) <= 1) reachedMaxHeightRef.current = true;
			store.context.handleScrollArrowVisibility(scroller);
			return;
		}
		if (maxAvailableHeight - nextHeight > 1) nextScrollTop = isTopPositioned ? Infinity : 0;
		else if (isBottomPositioned && scrollTop < maxScrollTop) nextScrollTop = scrollTop - (diff - (currentHeight + diff - maxAvailableHeight));
		const nextPositionerHeight = Math.ceil(nextHeight);
		if (nextPositionerHeight !== 0) setHeight(nextPositionerHeight);
		if (nextScrollTop != null) {
			const target = clamp(nextScrollTop, 0, getMaxScrollTop(scroller));
			if (Math.abs(scroller.scrollTop - target) > 1) scroller.scrollTop = target;
		}
		if (nextPositionerHeight >= maxAvailableHeight - 1) reachedMaxHeightRef.current = true;
		store.context.handleScrollArrowVisibility(scroller);
	});
	react.useImperativeHandle(store.context.scrollHandlerRef, () => handleScroll, [handleScroll]);
	useOpenChangeComplete({
		open,
		ref: store.context.popupRef,
		onComplete() {
			if (open) store.context.onOpenChangeComplete(true);
		}
	});
	const state = {
		open,
		transitionStatus,
		side,
		align
	};
	useIsoLayoutEffect(() => {
		if (!positionerElement || !store.context.popupRef.current || Object.keys(originalPositionerStylesRef.current).length) return;
		originalPositionerStylesRef.current = {
			top: positionerElement.style.top || "0",
			left: positionerElement.style.left || "0",
			right: positionerElement.style.right,
			height: positionerElement.style.height,
			bottom: positionerElement.style.bottom,
			minHeight: positionerElement.style.minHeight,
			maxHeight: positionerElement.style.maxHeight,
			marginTop: positionerElement.style.marginTop,
			marginBottom: positionerElement.style.marginBottom
		};
	}, [store, positionerElement]);
	useIsoLayoutEffect(() => {
		if (open || alignItemWithTriggerActive) return;
		initialPlacedRef.current = false;
		reachedMaxHeightRef.current = false;
		clearStyles(positionerElement, originalPositionerStylesRef.current);
	}, [
		open,
		alignItemWithTriggerActive,
		positionerElement
	]);
	useIsoLayoutEffect(() => {
		const popupElement = store.context.popupRef.current;
		if (!open || !triggerElement || !positionerElement || !popupElement || alignItemWithTriggerActive && !isPositioned || store.state.transitionStatus === "ending") return;
		initialPlacedRef.current = true;
		popupElement.style.removeProperty(transformOrigin);
		if (!alignItemWithTriggerActive) {
			scrollArrowFrame.request(() => store.context.handleScrollArrowVisibility(listElement || popupElement));
			return;
		}
		const restoreTransformStyles = unsetTransformStyles(popupElement);
		try {
			let textElement = store.context.selectedItemTextRef.current;
			if (!textElement?.isConnected) textElement = !store.select("hasSelectedValue") && store.context.firstItemTextRef.current?.isConnected ? store.context.firstItemTextRef.current : null;
			const valueElement = store.context.valueRef.current;
			const win = getWindow(positionerElement);
			const positionerStyles = win.getComputedStyle(positionerElement);
			const popupStyles = win.getComputedStyle(popupElement);
			const doc = ownerDocument(triggerElement);
			const scale = getScale(triggerElement);
			const triggerRect = normalizeRect(triggerElement.getBoundingClientRect(), scale);
			const positionerRect = normalizeRect(positionerElement.getBoundingClientRect(), scale);
			const triggerHeight = triggerRect.height;
			const scroller = listElement || popupElement;
			const scrollHeight = scroller.scrollHeight;
			const borderBottom = parseFloat(popupStyles.borderBottomWidth);
			const marginTop = parseFloat(positionerStyles.marginTop) || 10;
			const marginBottom = parseFloat(positionerStyles.marginBottom) || 10;
			const minHeight = parseFloat(positionerStyles.minHeight) || 100;
			const maxPopupHeight = getMaxPopupHeight(popupStyles);
			const paddingLeft = 5;
			const paddingRight = 5;
			const triggerCollisionThreshold = 20;
			const viewportHeight = doc.documentElement.clientHeight - marginTop - marginBottom;
			const viewportWidth = doc.documentElement.clientWidth;
			const availableSpaceBeneathTrigger = viewportHeight - triggerRect.bottom + triggerHeight;
			let textRect;
			let alignedLeft = direction === "rtl" ? triggerRect.right - positionerRect.width : triggerRect.left;
			let offsetY = 0;
			if (textElement && valueElement) {
				const valueRect = normalizeRect(valueElement.getBoundingClientRect(), scale);
				textRect = normalizeRect(textElement.getBoundingClientRect(), scale);
				alignedLeft = positionerRect.left + (direction === "rtl" ? valueRect.right - textRect.right : valueRect.left - textRect.left);
				const valueCenterFromTriggerTop = valueRect.top - triggerRect.top + valueRect.height / 2;
				offsetY = textRect.top - positionerRect.top + textRect.height / 2 - valueCenterFromTriggerTop;
			}
			const idealHeight = availableSpaceBeneathTrigger + offsetY + marginBottom + borderBottom;
			let height = Math.min(viewportHeight, idealHeight);
			const maxHeight = viewportHeight - marginTop - marginBottom;
			const scrollTop = idealHeight - height;
			const maxRight = viewportWidth - paddingRight;
			positionerElement.style.left = `${clamp(alignedLeft, paddingLeft, maxRight - positionerRect.width)}px`;
			positionerElement.style.height = `${height}px`;
			positionerElement.style.maxHeight = "none";
			positionerElement.style.marginTop = `${marginTop}px`;
			positionerElement.style.marginBottom = `${marginBottom}px`;
			popupElement.style.height = "100%";
			const maxScrollTop = getMaxScrollTop(scroller);
			const isTopPositioned = scrollTop >= maxScrollTop - 1;
			if (isTopPositioned) height = Math.min(viewportHeight, positionerRect.height) - (scrollTop - maxScrollTop);
			const fallbackToAlignPopupToTrigger = triggerRect.top < triggerCollisionThreshold || triggerRect.bottom > viewportHeight - triggerCollisionThreshold || Math.ceil(height) + 1 < Math.min(scrollHeight, minHeight);
			const isPinchZoomed = (win.visualViewport?.scale ?? 1) !== 1 && webkit;
			if (fallbackToAlignPopupToTrigger || isPinchZoomed) {
				clearStyles(positionerElement, originalPositionerStylesRef.current);
				setControlledAlignItemWithTrigger(false);
				return;
			}
			const initialHeight = Math.max(minHeight, height);
			if (isTopPositioned) {
				const topOffset = Math.max(0, viewportHeight - idealHeight);
				positionerElement.style.top = positionerRect.height >= maxHeight ? "0" : `${topOffset}px`;
				positionerElement.style.height = `${height}px`;
				scroller.scrollTop = getMaxScrollTop(scroller);
			} else {
				positionerElement.style.bottom = "0";
				scroller.scrollTop = scrollTop;
			}
			if (textRect) {
				const popupTop = positionerRect.top;
				const popupHeight = positionerRect.height;
				const textCenterY = textRect.top + textRect.height / 2;
				const clampedY = clamp(popupHeight > 0 ? (textCenterY - popupTop) / popupHeight * 100 : 50, 0, 100);
				popupElement.style.setProperty(transformOrigin, `50% ${clampedY}%`);
			}
			if (initialHeight === viewportHeight || height >= maxPopupHeight) reachedMaxHeightRef.current = true;
			store.context.handleScrollArrowVisibility(scroller);
			if (highlightItemOnHover && store.state.selectedIndex === null && store.state.activeIndex === null && store.context.listRef.current[0] != null) store.set("activeIndex", 0);
		} finally {
			restoreTransformStyles();
		}
	}, [
		store,
		open,
		positionerElement,
		triggerElement,
		alignItemWithTriggerActive,
		setControlledAlignItemWithTrigger,
		scrollArrowFrame,
		listElement,
		highlightItemOnHover,
		direction,
		isPositioned
	]);
	react.useEffect(() => {
		if (!alignItemWithTriggerActive || !positionerElement || !open) return;
		const win = getWindow(positionerElement);
		function handleResize(event) {
			store.context.setOpen(false, createChangeEventDetails(windowResize, event));
		}
		return addEventListener(win, "resize", handleResize);
	}, [
		store,
		alignItemWithTriggerActive,
		positionerElement,
		open
	]);
	const defaultProps = {
		...listElement ? { role: "presentation" } : {
			role: "listbox",
			"aria-multiselectable": multiple || void 0,
			"aria-readonly": readOnly || void 0,
			id: `${id}-list`
		},
		onKeyDown(event) {
			if (insideToolbar && COMPOSITE_KEYS.has(event.key)) event.stopPropagation();
		},
		onScroll(event) {
			if (listElement) return;
			handleScroll(event.currentTarget);
		},
		...alignItemWithTriggerActive && { style: listElement ? { height: "100%" } : LIST_FUNCTIONAL_STYLES },
		className: !listElement && alignItemWithTriggerActive ? styleDisableScrollbar.className : void 0
	};
	const element = useRenderElement("div", componentProps, {
		ref: [forwardedRef, store.context.popupRef],
		state,
		stateAttributesMapping,
		props: [
			popupProps,
			defaultProps,
			getDisabledMountTransitionStyles(transitionStatus),
			elementProps
		]
	});
	return /*#__PURE__*/ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [!disableStyleElements && styleDisableScrollbar.getElement(nonce), /*#__PURE__*/ (0, react_jsx_runtime.jsx)(FloatingFocusManager, {
		context: floatingRootContext,
		modal: false,
		disabled: !mounted,
		openInteractionType: openMethod,
		returnFocus: finalFocus,
		restoreFocus: true,
		children: element
	})] });
});
function getMaxPopupHeight(popupStyles) {
	const maxHeightStyle = popupStyles.maxHeight;
	return maxHeightStyle.endsWith("px") ? parseFloat(maxHeightStyle) || Infinity : Infinity;
}
function getMaxScrollTop(scroller) {
	return getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
}
function getScale(element) {
	return platform.getScale(element);
}
function normalizeSize(size, axis, scale) {
	return size / scale[axis];
}
function normalizeRect(rect, scale) {
	return rectToClientRect({
		x: normalizeSize(rect.x, "x", scale),
		y: normalizeSize(rect.y, "y", scale),
		width: normalizeSize(rect.width, "x", scale),
		height: normalizeSize(rect.height, "y", scale)
	});
}
const TRANSFORM_STYLE_RESETS = [
	["transform", "none"],
	["scale", "1"],
	["translate", "0 0"]
];
function unsetTransformStyles(popupElement) {
	const { style } = popupElement;
	const originalStyles = {};
	for (const [property, value] of TRANSFORM_STYLE_RESETS) {
		originalStyles[property] = style.getPropertyValue(property);
		style.setProperty(property, value, "important");
	}
	return () => {
		for (const [property] of TRANSFORM_STYLE_RESETS) {
			const originalValue = originalStyles[property];
			if (originalValue) style.setProperty(property, originalValue);
			else style.removeProperty(property);
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/list/SelectList.mjs
/**
* A container for the select items.
* Renders a `<div>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectList = /*#__PURE__*/ react.forwardRef(function SelectList(componentProps, forwardedRef) {
	const { render, className, style, ...elementProps } = componentProps;
	const store = useSelectRootContext();
	const multiple = store.useState("multiple");
	const readOnly = store.useState("readOnly");
	const { alignItemWithTriggerActive } = useSelectPositionerContext();
	const hasScrollArrows = store.useState("hasScrollArrows");
	const openMethod = store.useState("openMethod");
	const defaultProps = {
		id: `${store.useState("id")}-list`,
		role: "listbox",
		"aria-multiselectable": multiple || void 0,
		"aria-readonly": readOnly || void 0,
		onScroll(event) {
			store.context.scrollHandlerRef.current?.(event.currentTarget);
		},
		...alignItemWithTriggerActive && { style: LIST_FUNCTIONAL_STYLES },
		className: hasScrollArrows && openMethod !== "touch" ? styleDisableScrollbar.className : void 0
	};
	return useRenderElement("div", componentProps, {
		ref: [forwardedRef, store.useStateSetter("listElement")],
		props: [defaultProps, elementProps]
	});
});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/internals/composite/list/useCompositeListItem.mjs
/**
* Used to register a list item and its index (DOM position) in the `CompositeList`.
*/
function useCompositeListItem(params = {}) {
	const { guess, label, metadata, textRef, index: externalIndex } = params;
	const { register, unregister, subscribeMapChange, nextIndexRef } = useCompositeListContext();
	const indexRef = react.useRef(-1);
	const [internalIndex, setInternalIndex] = react.useState(externalIndex == null && guess ? () => {
		if (indexRef.current === -1) {
			const newIndex = nextIndexRef.current;
			nextIndexRef.current += 1;
			indexRef.current = newIndex;
		}
		return indexRef.current;
	} : -1);
	const index = externalIndex ?? internalIndex;
	const componentRef = react.useRef(null);
	const ref = react.useCallback((node) => {
		const previousNode = componentRef.current;
		if (previousNode) unregister(previousNode);
		componentRef.current = node;
		if (node) register(node, {
			metadata: metadata ?? null,
			index: externalIndex ?? null,
			label,
			textRef
		});
	}, [
		externalIndex,
		register,
		unregister,
		metadata,
		label,
		textRef
	]);
	useIsoLayoutEffect(() => {
		if (externalIndex != null) return;
		return subscribeMapChange((map) => {
			const i = componentRef.current ? map.get(componentRef.current)?.index : null;
			if (i != null) setInternalIndex(i);
		});
	}, [externalIndex, subscribeMapChange]);
	return {
		ref,
		index
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/item/SelectItemContext.mjs
const SelectItemContext = /*#__PURE__*/ react.createContext(void 0);
function useSelectItemContext() {
	const context = react.useContext(SelectItemContext);
	if (!context) throw new Error(formatErrorMessage(57));
	return context;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/item/SelectItem.mjs
/**
* An individual option in the select popup.
* Renders a `<div>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectItem$1 = /*#__PURE__*/ react.memo(/*#__PURE__*/ react.forwardRef(function SelectItem(componentProps, forwardedRef) {
	const { render, className, style, value: itemValue = null, label, disabled: disabledProp = false, nativeButton = false, ...elementProps } = componentProps;
	const textRef = react.useRef(null);
	const listItem = useCompositeListItem({
		guess: true,
		label,
		textRef
	});
	const store = useSelectRootContext();
	const { props: itemProps, multiple, disabled: selectDisabled, readOnly, isItemEqualToValue } = store.useState("itemRoot");
	const disabled = selectDisabled || disabledProp;
	const highlighted = store.useState("isActive", listItem.index);
	const open = store.useState("open");
	const selected = store.useState("isSelected", itemValue);
	const selectedByFocus = store.useState("isSelectedByFocus", listItem.index);
	const index = listItem.index;
	const itemRef = react.useRef(null);
	useIsoLayoutEffect(() => {
		const values = store.context.valuesRef.current;
		values[index] = itemValue;
		return () => {
			delete values[index];
		};
	}, [
		index,
		itemValue,
		store
	]);
	useIsoLayoutEffect(() => {
		const selectedValue = store.state.value;
		const currentIndex = store.state.selectedIndex;
		let nextIndex = currentIndex;
		let claims;
		if (multiple && Array.isArray(selectedValue)) {
			nextIndex = resolveSelectedIndex(index, itemValue, store.context.valuesRef.current, selectedValue, isItemEqualToValue, currentIndex);
			claims = nextIndex === index;
			if (index === currentIndex && !claims) store.context.selectedItemTextRef.current = null;
		} else {
			claims = selectedValue !== void 0 && compareItemEquality(itemValue, selectedValue, isItemEqualToValue);
			if (claims) nextIndex = index;
		}
		store.set("selectedIndex", nextIndex);
		if (claims && textRef.current) store.context.selectedItemTextRef.current = textRef.current;
	}, [
		index,
		multiple,
		isItemEqualToValue,
		store,
		itemValue
	]);
	const pointerTypeRef = react.useRef("mouse");
	const allowMouseSelectionRef = react.useRef(false);
	const { getButtonProps, buttonRef } = useButton({
		disabled,
		focusableWhenDisabled: true,
		native: nativeButton,
		composite: true
	});
	const state = {
		disabled,
		selected,
		highlighted
	};
	function commitSelection(event) {
		if (selectDisabled || readOnly) return;
		const selectedValue = store.state.value;
		if (multiple) {
			const currentValue = Array.isArray(selectedValue) ? selectedValue : [];
			const nextValue = selected ? removeItem(currentValue, itemValue, isItemEqualToValue) : [...currentValue, itemValue];
			store.context.setValue(nextValue, createChangeEventDetails(itemPress, event));
		} else {
			store.context.setValue(itemValue, createChangeEventDetails(itemPress, event));
			store.context.setOpen(false, createChangeEventDetails(itemPress, event));
		}
	}
	function resetDragMovement() {
		store.context.selectionRef.current.dragY = 0;
	}
	const defaultProps = {
		role: "option",
		"aria-selected": selected,
		tabIndex: open && highlighted ? 0 : -1,
		onKeyDown(event) {
			store.set("activeIndex", index);
			if (event.key === " " && store.context.typingRef.current) event.preventDefault();
		},
		onClick(event) {
			const isMouseClick = pointerTypeRef.current !== "touch";
			const clickPointerType = event.nativeEvent.pointerType;
			const isVirtualMouseClick = isMouseClick && isVirtualClick(event.nativeEvent) && (clickPointerType !== void 0 || highlighted);
			const isInvalidMouseClick = isMouseClick && !isVirtualMouseClick && !allowMouseSelectionRef.current;
			allowMouseSelectionRef.current = false;
			if (disabled || isInvalidMouseClick) return;
			commitSelection(event.nativeEvent);
		},
		onPointerEnter(event) {
			pointerTypeRef.current = event.pointerType;
		},
		onPointerMove(event) {
			if (event.pointerType === "mouse" && event.buttons === 1) {
				const selection = store.context.selectionRef.current;
				selection.dragY += event.movementY;
				if (selection.dragY ** 2 >= 64) selection.allowUnselectedMouseUp = true;
			}
		},
		onPointerDown(event) {
			pointerTypeRef.current = event.pointerType;
			allowMouseSelectionRef.current = true;
			resetDragMovement();
		},
		onMouseUp() {
			resetDragMovement();
			if (disabled || pointerTypeRef.current === "touch") return;
			if (allowMouseSelectionRef.current) return;
			const disallowSelectedMouseUp = !store.context.selectionRef.current.allowSelectedMouseUp && selected;
			const disallowUnselectedMouseUp = !store.context.selectionRef.current.allowUnselectedMouseUp && !selected;
			if (disallowSelectedMouseUp || disallowUnselectedMouseUp) return;
			allowMouseSelectionRef.current = true;
			itemRef.current?.click();
			allowMouseSelectionRef.current = false;
		}
	};
	const element = useRenderElement("div", componentProps, {
		ref: [
			buttonRef,
			forwardedRef,
			listItem.ref,
			itemRef
		],
		state,
		props: [
			itemProps,
			defaultProps,
			elementProps,
			getButtonProps
		]
	});
	const contextValue = react.useMemo(() => ({
		selected,
		index,
		textRef,
		selectedByFocus
	}), [
		selected,
		index,
		textRef,
		selectedByFocus
	]);
	return /*#__PURE__*/ (0, react_jsx_runtime.jsx)(SelectItemContext.Provider, {
		value: contextValue,
		children: element
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/utils/ItemIndicator.mjs
const ItemIndicator = /*#__PURE__*/ react.memo(/*#__PURE__*/ react.forwardRef(function ItemIndicator(componentProps, forwardedRef) {
	const { render, className, style, keepMounted, selected, ...elementProps } = componentProps;
	const indicatorRef = react.useRef(null);
	const { transitionStatus, setMounted } = useTransitionStatus(selected);
	const element = useRenderElement("span", componentProps, {
		ref: [forwardedRef, indicatorRef],
		state: {
			selected,
			transitionStatus
		},
		props: [{
			"aria-hidden": true,
			children: "✔️"
		}, elementProps],
		stateAttributesMapping: transitionStatusMapping
	});
	useOpenChangeComplete({
		batch: true,
		enabled: !selected,
		open: selected,
		ref: indicatorRef,
		onComplete() {
			if (!selected) setMounted(false);
		}
	});
	return element;
}));
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/item-indicator/SelectItemIndicator.mjs
/**
* Indicates whether the select item is selected.
* Renders a `<span>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectItemIndicator = /*#__PURE__*/ react.forwardRef(function SelectItemIndicator(componentProps, forwardedRef) {
	const { selected } = useSelectItemContext();
	if (!(componentProps.keepMounted || selected)) return null;
	return /*#__PURE__*/ (0, react_jsx_runtime.jsx)(ItemIndicator, {
		...componentProps,
		selected,
		ref: forwardedRef
	});
});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/item-text/SelectItemText.mjs
/**
* A text label of the select item.
* Renders a `<div>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectItemText = /*#__PURE__*/ react.memo(/*#__PURE__*/ react.forwardRef(function SelectItemText(componentProps, forwardedRef) {
	const { index, textRef, selectedByFocus } = useSelectItemContext();
	const store = useSelectRootContext();
	const { render, className, style, ...elementProps } = componentProps;
	return useRenderElement("div", componentProps, {
		ref: [
			react.useCallback((node) => {
				if (!node) return;
				if (index === 0) store.context.firstItemTextRef.current = node;
				if (selectedByFocus) store.context.selectedItemTextRef.current = node;
			}, [
				store,
				index,
				selectedByFocus
			]),
			forwardedRef,
			textRef
		],
		props: elementProps
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/scroll-arrow/SelectScrollArrow.mjs
/**
* @internal
*/
const SelectScrollArrow = /*#__PURE__*/ react.forwardRef(function SelectScrollArrow(componentProps, forwardedRef) {
	const { render, className, style, direction, keepMounted, ...elementProps } = componentProps;
	const isUp = direction === "up";
	const store = useSelectRootContext();
	const { side, scrollDownArrowRef, scrollUpArrowRef } = useSelectPositionerContext();
	const visibleSelector = isUp ? "scrollUpArrowVisible" : "scrollDownArrowVisible";
	const stateVisible = store.useState(visibleSelector);
	const openMethod = store.useState("openMethod");
	const visible = stateVisible && openMethod !== "touch";
	const timeout = useTimeout();
	const scrollArrowRef = isUp ? scrollUpArrowRef : scrollDownArrowRef;
	const { mounted, transitionStatus, setMounted } = useTransitionStatus(visible);
	useIsoLayoutEffect(() => {
		store.context.scrollArrowsMountedCountRef.current += 1;
		store.set("hasScrollArrows", true);
		return () => {
			store.context.scrollArrowsMountedCountRef.current = Math.max(0, store.context.scrollArrowsMountedCountRef.current - 1);
			if (store.context.scrollArrowsMountedCountRef.current === 0) store.set("hasScrollArrows", false);
		};
	}, [store]);
	useOpenChangeComplete({
		open: visible,
		ref: scrollArrowRef,
		onComplete() {
			if (!visible) setMounted(false);
		}
	});
	const element = useRenderElement("div", componentProps, {
		ref: [forwardedRef, scrollArrowRef],
		state: {
			direction,
			visible,
			side,
			transitionStatus
		},
		props: [{
			"aria-hidden": true,
			children: isUp ? "▲" : "▼",
			style: { position: "absolute" },
			onMouseMove(event) {
				if (event.movementX === 0 && event.movementY === 0 || timeout.isStarted()) return;
				store.set("activeIndex", null);
				function scrollNextItem() {
					const scroller = store.state.listElement ?? store.context.popupRef.current;
					if (!scroller) return;
					store.set("activeIndex", null);
					store.context.handleScrollArrowVisibility(scroller);
					const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
					const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
					const isScrolledToEdge = scrollTop === (isUp ? 0 : maxScrollTop);
					const items = store.context.listRef.current;
					if (scrollTop !== scroller.scrollTop) scroller.scrollTop = scrollTop;
					if (isScrolledToEdge) {
						timeout.clear();
						return;
					}
					if (items.length > 0) {
						const scrollArrowHeight = scrollArrowRef.current?.offsetHeight || 0;
						scroller.scrollTop = getTargetScrollTop(items, isUp, scrollTop, scroller.clientHeight, scrollArrowHeight, maxScrollTop);
					}
					timeout.start(40, scrollNextItem);
				}
				timeout.start(40, scrollNextItem);
			},
			onMouseLeave() {
				timeout.clear();
			}
		}, elementProps],
		stateAttributesMapping: transitionStatusMapping
	});
	if (!(mounted || keepMounted)) return null;
	return element;
});
function getTargetScrollTop(items, isUp, scrollTop, clientHeight, scrollArrowHeight, maxScrollTop) {
	if (isUp) {
		let firstVisibleIndex = 0;
		const visibleTop = scrollTop + scrollArrowHeight - 1;
		for (let i = 0; i < items.length; i += 1) {
			const item = items[i];
			if (item && item.offsetTop >= visibleTop) {
				firstVisibleIndex = i;
				break;
			}
		}
		const targetIndex = Math.max(0, firstVisibleIndex - 1);
		const targetItem = items[targetIndex];
		return targetIndex < firstVisibleIndex && targetItem ? normalizeScrollOffset(targetItem.offsetTop - scrollArrowHeight, maxScrollTop) : 0;
	}
	let lastVisibleIndex = items.length - 1;
	const visibleBottom = scrollTop + clientHeight - scrollArrowHeight + 1;
	for (let i = 0; i < items.length; i += 1) {
		const item = items[i];
		if (item && item.offsetTop + item.offsetHeight > visibleBottom) {
			lastVisibleIndex = Math.max(0, i - 1);
			break;
		}
	}
	const targetIndex = Math.min(items.length - 1, lastVisibleIndex + 1);
	const targetItem = items[targetIndex];
	return targetIndex > lastVisibleIndex && targetItem ? normalizeScrollOffset(targetItem.offsetTop + targetItem.offsetHeight - clientHeight + scrollArrowHeight, maxScrollTop) : maxScrollTop;
}
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/scroll-down-arrow/SelectScrollDownArrow.mjs
/**
* An element that scrolls the select popup down when hovered. Does not render when using touch input.
* Renders a `<div>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectScrollDownArrow = /*#__PURE__*/ react.forwardRef(function SelectScrollDownArrow(props, forwardedRef) {
	return /*#__PURE__*/ (0, react_jsx_runtime.jsx)(SelectScrollArrow, {
		...props,
		ref: forwardedRef,
		direction: "down"
	});
});
//#endregion
//#region ../../node_modules/.pnpm/@base-ui+react@1.9.0_@types+react@19.3.0_react-dom@19.3.1_react@19.3.1__react@19.3.1/node_modules/@base-ui/react/select/scroll-up-arrow/SelectScrollUpArrow.mjs
/**
* An element that scrolls the select popup up when hovered. Does not render when using touch input.
* Renders a `<div>` element.
*
* Documentation: [Base UI Select](https://base-ui.com/react/components/select)
*/
const SelectScrollUpArrow = /*#__PURE__*/ react.forwardRef(function SelectScrollUpArrow(props, forwardedRef) {
	return /*#__PURE__*/ (0, react_jsx_runtime.jsx)(SelectScrollArrow, {
		...props,
		ref: forwardedRef,
		direction: "up"
	});
});
//#endregion
//#region ../../node_modules/.pnpm/@hugeicons+core-free-icons@4.4.0/node_modules/@hugeicons/core-free-icons/dist/esm/CheckIcon.js
const CheckIcon = [["path", {
	d: "M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7",
	stroke: "currentColor",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	strokeWidth: "1.5",
	key: "0"
}]];
//#endregion
//#region ../../node_modules/.pnpm/@hugeicons+core-free-icons@4.4.0/node_modules/@hugeicons/core-free-icons/dist/esm/ChevronDownIcon.js
const ChevronDownIcon = [["path", {
	d: "M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9",
	stroke: "currentColor",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	strokeWidth: "1.5",
	key: "0"
}]];
//#endregion
//#region ../../node_modules/.pnpm/@hugeicons+core-free-icons@4.4.0/node_modules/@hugeicons/core-free-icons/dist/esm/ChevronUpIcon.js
const ChevronUpIcon = [["path", {
	d: "M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15",
	stroke: "currentColor",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	strokeWidth: "1.5",
	key: "0"
}]];
//#endregion
//#region ../../node_modules/.pnpm/@hugeicons+react@1.1.10_react@19.3.1/node_modules/@hugeicons/react/dist/esm/HugeiconsIcon.js
const defaultAttributes = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none"
};
const HugeiconsIcon = (0, react.forwardRef)(({ color = "currentColor", size = 24, strokeWidth, absoluteStrokeWidth = false, className = "", altIcon, showAlt = false, icon, primaryColor, secondaryColor, disableSecondaryOpacity = false, ...rest }, ref) => {
	const calculatedStrokeWidth = strokeWidth !== void 0 ? absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth : void 0;
	const strokeProps = calculatedStrokeWidth !== void 0 ? {
		strokeWidth: calculatedStrokeWidth,
		stroke: "currentColor"
	} : {};
	const elementProps = {
		ref,
		...defaultAttributes,
		width: size,
		height: size,
		color: primaryColor || color,
		className,
		...strokeProps,
		...rest
	};
	const svgChildren = [...showAlt && altIcon ? altIcon : icon].sort(([, a], [, b]) => {
		const hasOpacityA = a.opacity !== void 0;
		return b.opacity !== void 0 ? 1 : hasOpacityA ? -1 : 0;
	}).map(([tag, attrs]) => {
		const isSecondaryPath = attrs.opacity !== void 0;
		const pathOpacity = isSecondaryPath && !disableSecondaryOpacity ? attrs.opacity : void 0;
		const fillProps = secondaryColor ? { ...attrs.stroke !== void 0 ? { stroke: isSecondaryPath ? secondaryColor : primaryColor || color } : { fill: isSecondaryPath ? secondaryColor : primaryColor || color } } : {};
		return (0, react.createElement)(tag, {
			...attrs,
			...strokeProps,
			...fillProps,
			opacity: pathOpacity,
			key: attrs.key
		});
	});
	return (0, react.createElement)("svg", elementProps, svgChildren);
});
HugeiconsIcon.displayName = "HugeiconsIcon";
//#endregion
//#region ../../node_modules/.pnpm/cn@0.5.1/node_modules/cn/dist/tables.js
const P = 48;
const U = (s, o = 0) => {
	const out = new Int32Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) - P - o;
	return out;
};
const PS = (counts) => {
	const out = new Int32Array(counts.length + 1);
	for (let i = 0; i < counts.length; i++) out[i + 1] = out[i] + counts[i];
	return out;
};
const DZ = (s) => {
	const out = new Int32Array(s.length);
	let a = 0;
	for (let i = 0; i < s.length; i++) {
		const z = s.charCodeAt(i) - P;
		a += z >>> 1 ^ -(z & 1);
		out[i] = a;
	}
	return out;
};
const GROUP_COUNT = 384;
const customValidatorNames = [];
const edgeStart = PS(U("E0500002005282000000002000150000020021820000011200000003022202000300004200120000200420001200021200301200010400162000010000220021010:2192001200220012000220012000200200200400010200040000000000400200108200110100000022010313000162002000020020012020080213000228200000000082000000000120002000120020020040101020300130001001010"));
const labelStart = PS(U(":11111111211111119311546544411119731869:671397415686432441111111111161114151214313433415:78311132233313187211117221449443411141111151152226611131111112212518142224214215421421542142424242516171151615616347111111111197911327451111111111111111111113134714133513411111311111111111111111111112444411111342312715245411117:3"));
const labelText = "@containerabcdefghinlmoprstunderlineviawzccentlignnimatespectuto-colsrowsaglorightnessckdrop-sisbcontrastfiltergrayscalehue-rotateinvertopacityslurrightnessaturateepia-coniclinearpositionradialsizeockurrderttom-belrstxyespacing-xyaretoursorlnt-umnsendspantartainentrasteividerop-shadowurationcorationlay-xyasendillexontromlter-featuresstretchapr-xyayscaleidow-colsrowsue-rotatedentlinesetvert-beringsxyeshadoweiadingftnest-clamp-imageabein-lrstxyskx--b-coniclpositionrsizet-x-y-fromto-fromto-inearfromto-fromto-adialfromto-fromtofromtofromtofromtoblockhinlinew-screenesblockhinlinewbjectpacityrutlinederigin-offsetbelrstxyesrspective-originaceholderioghtng-offsettateundedw-xyz-belrstlreseslr-endspantartaturatecepiahizekewpace-taleroll-xyz-barmpbelrstxyesbelrstxyes-thumbrackadowrink-xyxyartrokeabextora-shadowpckingnsformitionlate-xyz-offsetill-changeoom";
const edgeTarget = (() => {
	const N = edgeStart.length - 1;
	const sizes = new Int32Array(N);
	for (let i = N - 1; i >= 0; i--) {
		let s = 1;
		let c = i + 1;
		for (let k = edgeStart[i]; k < edgeStart[i + 1]; k++) {
			s += sizes[c];
			c += sizes[c];
		}
		sizes[i] = s;
	}
	const out = new Int32Array(edgeStart[N]);
	let e = 0;
	for (let i = 0; i < N; i++) {
		let c = i + 1;
		for (let k = edgeStart[i]; k < edgeStart[i + 1]; k++) {
			out[e++] = c;
			c += sizes[c];
		}
	}
	return out;
})();
const nodeGroup = U("02000000000000900<=0?000B000F00F00ŏI0J0LNPRTVX0000]_a00000000000000000000000rst0000000zŏ00000000000ŏ0000000ŏ00000000000000000000000000000000000000000000000000000000000000Ë000000000000000000000Þ000000000000000000ð0000000ø0ùúûüýþÿĀāĂăĄąĆ000000000000000000000000000000000000000000ħ0ĨĪ00000000000000000000ļĽ00000Ŭ000000", 1);
const vlistPat = PS(U("123333359346463635126536711576"));
const vlistOps = U("93203242332583253248325D>E?F@03263243255B:032523853:0325B:8GA032542H<C=12727B:0328432553;D>E?3257D>032585:0325B:;0328B:032");
const vlistRef = U("012113445661666666789111:5;;;;;;;;444;;;:62999<1161=62>>?61:21@ABCD4446996:64E:::;:?::64:F114GHHIHHHHIHH1HH1HH1HHHHHH::EEJ4444::EE4444441691;644444114244444:;K6666555555555555555999666664444444444444444444444226?6:66644L9M?D:111::::6DE199");
const vlistGroup = DZ("020200202020020020020020020020200200200200200200200002020202001003040106000200200200200200200200200200200200200200200200200200200200200200200200200200200200020020020020020020002020200202002002002002002002002002002020002002020020200220200200200200200200200200200200020020020000200020002000200200200020020020002000200200200020020202002020202000200200020022000200200020020002002000200220002002000200W0Z00020020002002020002002000200g0j0002002000200200020020002002000200200020020002000200002000002002002002002000200020000200002002002002002002002020020020200200200200200200200200202020020020020020020020020002002002020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020002002002002002002000200200200200200200200200200020202020002000200020002002002002000020200200");
const nodeVlist = (() => {
	const out = (/* @__PURE__ */ new Int32Array(319)).fill(-1);
	const A = DZ("02422242:222222242224222242442222222422222244442242226224222426222422442462222422622222222626222462242622422622422424242422222222422222222242422222222222222222622442224222222222222224424442262222222222222222222226224222424242422224422422422222");
	const V = DZ("02222222222222222222202222222222222222222222221422222222222222222222222222222222222Y\\222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222221422222222222222222222222222222222222222Ŀł222222222222222222");
	for (let i = 0; i < A.length; i++) out[A[i]] = V[i];
	return out;
})();
const SETS = "container |break-after- all auto avoid avoid-page column left page right|break-before- all auto avoid avoid-page column left page right|break-inside-a uto void void-column void-page|box-decoration- clone slice|box- border content| contents flow-root hidden table table-caption table-cell table-column table-column-group table-footer-group table-header-group table-row table-row-group| not-sr-only sr-only|float- end left none right start|clear- both end left none right start|isolat e ion-auto|overflow- auto clip hidden scroll visible|overflow-x- auto clip hidden scroll visible|overflow-y- auto clip hidden scroll visible|overscroll- auto contain none|overscroll-x- auto contain none|overscroll-y- auto contain none| absolute fixed relative static sticky| collapse invisible visible|justify- around baseline between center center-safe end end-safe evenly normal start stretch|justify-items- center center-safe end end-safe normal start stretch|justify-self- auto center center-safe end end-safe start stretch|items- baseline baseline-last center center-safe end end-safe start stretch|self- auto baseline baseline-last center center-safe end end-safe start stretch|place-content- around baseline between center center-safe end end-safe evenly start stretch|place-items- baseline center center-safe end end-safe start stretch|place-self- auto center center-safe end end-safe start stretch| antialiased subpixel-antialiased| italic not-italic|normal-nums |ordinal |slashed-zero | lining-nums oldstyle-nums| proportional-nums tabular-nums| diagonal-fractions stacked-fractions| no-underline overline| capitalize lowercase normal-case uppercase|truncate |whitespace- break-spaces normal nowrap pre pre-line pre-wrap|break- all keep normal words|wrap- anywhere break-word normal|hyphens- auto manual none|mix-blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay plus-darker plus-lighter saturation screen soft-light|table- auto fixed|caption- bottom top|backface- hidden visible|appearance- auto none|scheme- dark light light-dark normal only-dark only-light|field-sizing- content fixed|pointer-events- auto none|resize  -none -x -y|snap- align-none center end start|snap- always normal|snap- both none x y|snap- mandatory proximity|touch- auto manipulation none|touch-pan- left right x|touch-pan- down up y|touch-pinch-zoom |select- all auto none text|forced-color-adjust- auto none| normal size| baseline bottom middle sub super text-bottom text-top top| bounce none ping pulse spin| auto square video| auto fr max min px|none | auto full px| fixed local scroll|clip- border content padding text|origin- border content padding| bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| no-repeat repeat repeat-round repeat-space repeat-x repeat-y| auto contain cover|blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay saturation screen soft-light|to- b bl br l r t tl tr| auto dvh fit full lh lvh max min px screen svh| dashed dotted double hidden none solid| collapse separate|px |auto |full | content none strict| inline-size size|layout |paint |style | around baseline between center center-safe end end-safe evenly normal start stretch| alias all-scroll auto cell col-resize context-menu copy crosshair default e-resize ew-resize grab grabbing help move n-resize ne-resize nesw-resize no-drop none not-allowed ns-resize nw-resize nwse-resize pointer progress row-resize s-resize se-resize sw-resize text vertical-text w-resize wait zoom-in zoom-out| dashed dotted double solid wavy| auto from-font|reverse |initial | in in-out initial linear out| col col-reverse row row-reverse| nowrap wrap wrap-reverse| auto initial none| black bold extrabold extralight light medium normal semibold thin| condensed expanded extra-condensed extra-expanded normal semi-condensed semi-expanded ultra-condensed ultra-expanded|flow- col col-dense dense row row-dense| none subgrid| auto dvh dvw fit full lh lvh lvw max min px screen svh svw| block flex grid table| auto dvw fit full lvw max min px screen svw| loose none normal px relaxed snug tight|through |item | inside outside| decimal disc none| auto px| clip-border clip-content clip-fill clip-padding clip-stroke clip-view no-clip| add exclude intersect subtract| alpha luminance match|origin- border content fill padding stroke view|type- alpha luminance| circle ellipse| closest-corner closest-side farthest-corner farthest-side|at- bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| dvh fit full lh lvh max min none px screen svh| auto dvh dvw fit full lh lvh lvw max min none px screen svh svw| dvw fit full lvw max min none px screen svw| auto dvh dvw fit full lvh lvw max min none prose px svh svw| auto dvh dvw fit full lvh lvw max min none px screen svh svw| contain cover fill none scale-down| first last none| distant dramatic midrange near none normal|inset | full none|3d | auto smooth|gutter- auto both stable| auto none thin| inner none| auto dvh dvw fit full lvh lvw max min px svh svw|base | center end justify left right start| clip ellipsis| balance nowrap pretty wrap| normal tight tighter wide wider widest| cpu gpu none| 3d flat| all colors none opacity shadow transform| discrete normal| full px| auto dvh dvw fit full lvh lvw max min px screen svh svw| auto contents scroll transform".split("|").map((s) => {
	const tails = s.split(" ");
	const prefix = tails.shift();
	for (let i = 0; i < tails.length; i++) tails[i] = prefix + tails[i];
	return tails;
});
const AA = DZ("0000000000000000000000000000000000000000000000000000000000000262242:6@200000006:240B428:4422400002046044222426220026642642462026224222824220022400000000\\00N222422242222222224062242222222422226264222422222222222222442804222422222222222222222222220<4<0204260002444020204224422");
const AG = DZ("ɠ222222222222222222222222222222222222222222222222222222222222˕4222226>6ʰ22ʷʺʷʺʷ42ʴ2ʓ22>621422ɶ222ɹɼɷɺɷɺ22ɱ42222ɨ2ɧ26622ɘɓ244ƸƵ222]d24242ǖǓƚÄȫ2263ȨȥȨ2222222ǣ222222222222222222ǂƽ2ƾƵ2222222422222ƜƑ22222222222222222222144Ŧţ22Ţş222222222222222222222ĸ2ı68ĦģĦɡŰ4Ġ«®ĝ822ĔđĔ2ē2222622");
const AS = DZ("02222222222222222222222222222222222222222222222222222222222222222202021422222222CF2200GJ021042222WZ222IL0ad2c10h2222U00X202[^2w0000120zy|}22:22z22222222222G000qOVI00000{2<40000@00000G¦§000ª00000000000000021K¬«00®000000000000000000000222HGH_1¸222½2¾2222ÇÊ000­°2±");
const litAnchor = /* @__PURE__ */ new Int32Array(987);
const litGroup = /* @__PURE__ */ new Int32Array(987);
const litPool = /* @__PURE__ */ new Int32Array(987);
let poolText = "";
const poolOffsets = /* @__PURE__ */ new Int32Array(1022);
{
	const tailRef = /* @__PURE__ */ new Map();
	let nextRef = 0;
	let e = 0;
	for (let i = 0; i < AA.length; i++) for (const tail of SETS[AS[i]]) {
		let r = tailRef.get(tail);
		if (r === void 0) {
			r = nextRef++;
			tailRef.set(tail, r);
			poolOffsets[r * 2] = poolText.length;
			poolOffsets[r * 2 + 1] = tail.length;
			poolText += tail;
		}
		litAnchor[e] = AA[i];
		litGroup[e] = AG[i];
		litPool[e] = r;
		e++;
	}
}
const adjGid = DZ("0b2N:222@R>F@286¦2@H2D266226FB22B2>BD\\6N22222Z222D222p");
const adjStart = PS(U("1::24444432:442:44:44>222222:44:4421322511111311111114"));
const adjTgt = DZ("24A;33N=C@H4A;33N=C@<27;83:;8393NQ:3NQʰ222ˉºŴŽ2R2=18cƴÅŇ=cĞÛC1ƈǝȈ:ħ25=11D3A@4=<1;1DEr25;11B3?<6;:371BCn9@7=<8192>2E121@9@EHE@9>2T25511<398454131<=V25511<398454131<=ƧNž2Đå242L222290000f22500ɛ000ǘ222");
const patGid = U("ĳ");
const patTgt = U("");
const postfixLookupGroups = U("1");
var tables_generated_default = {
	GROUP_COUNT,
	customValidatorNames,
	edgeStart,
	labelStart,
	labelText,
	edgeTarget,
	nodeGroup,
	nodeVlist,
	vlistPat,
	vlistOps,
	vlistRef,
	vlistGroup,
	litAnchor,
	litGroup,
	litPool,
	poolOffsets,
	poolText,
	adjGid,
	adjStart,
	adjTgt,
	patGid,
	patTgt,
	postfixLookupGroups,
	orderSensitiveModifiers: "* ** after backdrop before details-content file first-letter first-line marker placeholder selection"
};
//#endregion
//#region ../../node_modules/.pnpm/cn@0.5.1/node_modules/cn/dist/engine.js
const IS_JSC = "line" in /* @__PURE__ */ new Error();
const EXTERNAL = -1;
const DEAD = -1;
const fnv = (str, s, e) => {
	let h = 2166136261;
	for (let p = s; p < e; p++) h = Math.imul(h ^ str.charCodeAt(p), 16777619);
	return h;
};
const spanHash = (str, s, e) => {
	const len = e - s;
	let h = Math.imul(len, 2654435761) ^ str.charCodeAt(s);
	if (len > 3) {
		const q = len >> 2;
		const m = len >> 1;
		h = Math.imul(h ^ str.charCodeAt(s + 1) << 8 ^ str.charCodeAt(s + 2) << 16 ^ str.charCodeAt(s + q), 2246822507);
		h = Math.imul(h ^ str.charCodeAt(s + m) << 8 ^ str.charCodeAt(s + m + q) << 16 ^ str.charCodeAt(e - 3), 3266489909);
		h ^= str.charCodeAt(e - 2) << 8 ^ str.charCodeAt(e - 1) << 16;
		for (let p = s + 3, q = e - 4; p < s + 8 && p < q; p++, q--) h = Math.imul(h ^ str.charCodeAt(p) ^ str.charCodeAt(q) << 8, 16777619);
	}
	return h ^ h >>> 15 | 0;
};
const createEngine = (T, validatorImpls, options = {}) => {
	const { GROUP_COUNT, edgeStart, labelStart, labelText, edgeTarget, nodeGroup, nodeVlist, vlistPat, vlistOps, vlistRef, vlistGroup, litAnchor, litGroup, litPool, poolOffsets, poolText, adjGid, adjStart, adjTgt, patGid, patTgt, postfixLookupGroups, customValidatorNames, orderSensitiveModifiers } = T;
	const adjRow = new Int32Array(GROUP_COUNT).fill(-1);
	for (let i = 0; i < adjGid.length; i++) adjRow[adjGid[i]] = i;
	let maxAdj = 0;
	for (let r = 0; r + 1 < adjStart.length; r++) {
		const n = adjStart[r + 1] - adjStart[r];
		if (n > maxAdj) maxAdj = n;
	}
	let CLAIM_PER_TOKEN = 32;
	while (CLAIM_PER_TOKEN < 2 * (1 + maxAdj + patGid.length)) CLAIM_PER_TOKEN <<= 1;
	const vgStart = new Int32Array(vlistRef.length + 1);
	for (let l = 0; l < vlistRef.length; l++) vgStart[l + 1] = vgStart[l] + vlistPat[vlistRef[l] + 1] - vlistPat[vlistRef[l]];
	const postfixLookupSet = new Uint8Array(GROUP_COUNT);
	for (let i = 0; i < postfixLookupGroups.length; i++) postfixLookupSet[postfixLookupGroups[i]] = 1;
	const nodeCount = edgeStart.length - 1;
	const nodeHasLit = new Uint8Array(nodeCount);
	let litMaxLen = 0;
	let litNoArb = true;
	for (let i = 0; i < litAnchor.length; i++) {
		nodeHasLit[litAnchor[i]] = 1;
		const len = poolOffsets[litPool[i] * 2 + 1];
		if (len > litMaxLen) litMaxLen = len;
		const c0 = poolText.charCodeAt(poolOffsets[litPool[i] * 2]);
		if (c0 === 91 || c0 === 40) litNoArb = false;
	}
	let LIT_SIZE = 1;
	while (LIT_SIZE < litAnchor.length * 2) LIT_SIZE <<= 1;
	const litTable = new Int32Array(LIT_SIZE).fill(-1);
	for (let i = 0; i < litAnchor.length; i++) {
		const off = poolOffsets[litPool[i] * 2];
		let idx = (fnv(poolText, off, off + poolOffsets[litPool[i] * 2 + 1]) ^ Math.imul(litAnchor[i], 2654435761) | 0) & LIT_SIZE - 1;
		while (litTable[idx] !== -1) idx = idx + 1 & LIT_SIZE - 1;
		litTable[idx] = i;
	}
	const litProbe = (anchor, input, s, e) => {
		let idx = (fnv(input, s, e) ^ Math.imul(anchor, 2654435761) | 0) & LIT_SIZE - 1;
		const len = e - s;
		for (;;) {
			const entry = litTable[idx];
			if (entry === -1) return -1;
			if (litAnchor[entry] === anchor && poolOffsets[litPool[entry] * 2 + 1] === len) {
				const off = poolOffsets[litPool[entry] * 2];
				let ok = true;
				for (let k = 0; k < len; k++) if (poolText.charCodeAt(off + k) !== input.charCodeAt(s + k)) {
					ok = false;
					break;
				}
				if (ok) return litGroup[entry];
			}
			idx = idx + 1 & LIT_SIZE - 1;
		}
	};
	const cacheSize = options.cacheSize ?? 8192;
	const RAW_PREFIX = options.prefix ?? T.prefix ?? "";
	const FULL_PREFIX = RAW_PREFIX === "" ? "" : RAW_PREFIX + ":";
	const FPL = FULL_PREFIX.length;
	const vCustom = (customValidatorNames ?? []).map((name) => {
		const fn = validatorImpls && validatorImpls[name];
		if (!fn) throw new Error("cn: missing validator " + name);
		return fn;
	});
	const lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
	const colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/;
	const shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
	const imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
	let aKind = 0;
	let aLabelS = -1;
	let aLabelE = -1;
	let aValS = -1;
	let aValE = -1;
	const isWordCode = (c) => c >= 97 && c <= 122 || c >= 65 && c <= 90 || c >= 48 && c <= 57 || c === 95;
	const isUniWS = (c) => /\s/.test(String.fromCharCode(c));
	const analyzeArb = (input, s, e) => {
		aKind = 0;
		aLabelS = -1;
		if (e - s < 3) return;
		const c0 = input.charCodeAt(s);
		const cl = input.charCodeAt(e - 1);
		if (c0 === 91 && cl === 93) aKind = 1;
		else if (c0 === 40 && cl === 41) aKind = 2;
		else return;
		aValS = s + 1;
		aValE = e - 1;
		let p = s + 1;
		if (isWordCode(input.charCodeAt(p))) {
			p++;
			while (p < e - 1) {
				const c = input.charCodeAt(p);
				if (!isWordCode(c) && c !== 45) break;
				p++;
			}
			if (p < e - 2 && input.charCodeAt(p) === 58) {
				aLabelS = s + 1;
				aLabelE = p;
				aValS = p + 1;
			}
		}
	};
	const spanEq = (input, s, e, str) => {
		if (e - s !== str.length) return false;
		for (let i = 0; i < str.length; i++) if (input.charCodeAt(s + i) !== str.charCodeAt(i)) return false;
		return true;
	};
	const fractionRegex = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/;
	const tshirtRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
	const isNumStr = (v) => !!v && !Number.isNaN(Number(v));
	const spanIsNamedContainerQuery = (input, s, e) => {
		if (e - s < 11 || !spanEq(input, s, s + 10, "@container")) return false;
		if (input.charCodeAt(s + 10) === 47) return e - s >= 12;
		const c11 = input.charCodeAt(s + 11);
		return c11 === 115 && e - s >= 17 && spanEq(input, s + 10, s + 16, "-size/") || c11 === 110 && e - s >= 19 && spanEq(input, s + 10, s + 18, "-normal/");
	};
	const VKIND = [
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		2,
		2,
		2,
		2,
		2,
		2,
		2
	];
	const VLABELS = "length|number|number weight|family-name|position percentage|length size bg-size|image url|shadow|length|family-name|position percentage|length size bg-size|image url|shadow|number weight".split("|").map((s) => s.split(" "));
	const VFALL = [
		2,
		3,
		1,
		0,
		0,
		0,
		4,
		5,
		0,
		0,
		0,
		0,
		0,
		1,
		1
	];
	const runValidator = (op, input, s, e) => {
		if (op >= 10) {
			if (op >= 25) return vCustom[op - 25](input.slice(s, e));
			const i = op - 10;
			if (aKind !== VKIND[i]) return false;
			if (aLabelS >= 0) {
				for (const L of VLABELS[i]) if (spanEq(input, aLabelS, aLabelE, L)) return true;
				return false;
			}
			switch (VFALL[i]) {
				case 0: return false;
				case 1: return true;
				case 2: {
					const v = input.slice(aValS, aValE);
					return lengthUnitRegex.test(v) && !colorFunctionRegex.test(v);
				}
				case 3: return isNumStr(input.slice(aValS, aValE));
				case 4: return imageRegex.test(input.slice(aValS, aValE));
				default: return shadowRegex.test(input.slice(aValS, aValE));
			}
		}
		switch (op) {
			case 0: return true;
			case 1: return aKind === 0;
			case 2: return aKind === 1;
			case 3: return aKind === 2;
			case 4: return fractionRegex.test(input.slice(s, e));
			case 5: return isNumStr(input.slice(s, e));
			case 6: {
				const v = input.slice(s, e);
				return !!v && Number.isInteger(Number(v));
			}
			case 7: return e > s && input.charCodeAt(e - 1) === 37 && isNumStr(input.slice(s, e - 1));
			case 8: return tshirtRegex.test(input.slice(s, e));
			default: return spanIsNamedContainerQuery(input, s, e);
		}
	};
	const orderSensitive = new Set(typeof orderSensitiveModifiers === "string" ? orderSensitiveModifiers.split(" ") : orderSensitiveModifiers);
	const internSpan = (map, input, s, e, imp, make) => {
		const h = fnv(input, s, e) ^ (imp ? 2654435769 : 0) | 0;
		let bucket = map.get(h);
		if (bucket !== void 0) outer: for (let b = 0; b < bucket.length; b++) {
			const en = bucket[b];
			if (en.imp !== imp || en.k.length !== e - s) continue;
			for (let i = 0; i < en.k.length; i++) if (en.k.charCodeAt(i) !== input.charCodeAt(s + i)) continue outer;
			return en.id;
		}
		else map.set(h, bucket = []);
		const k = input.slice(s, e);
		const id = make(k);
		bucket.push({
			k,
			imp,
			id
		});
		return id;
	};
	let ctxByHash = /* @__PURE__ */ new Map();
	let ctxByCanon = /* @__PURE__ */ new Map();
	let nextCtxId = 2;
	const MAX_CTX = 4096;
	const canonicalizeContext = (raw, important) => {
		const mods = [];
		let dB = 0, dP = 0, start = 0;
		for (let i = 0; i < raw.length; i++) {
			const c = raw.charCodeAt(i);
			if (dB === 0 && dP === 0 && c === 58) {
				mods.push(raw.slice(start, i));
				start = i + 1;
			} else if (c === 91) dB++;
			else if (c === 93) dB--;
			else if (c === 40) dP++;
			else if (c === 41) dP--;
		}
		mods.push(raw.slice(start));
		let canonical = mods[0];
		if (mods.length > 1) {
			const result = [];
			let segment = [];
			for (const mod of mods) if (mod.charCodeAt(0) === 91 || orderSensitive.has(mod)) {
				if (segment.length) {
					result.push(...segment.sort());
					segment = [];
				}
				result.push(mod);
			} else segment.push(mod);
			if (segment.length) result.push(...segment.sort());
			canonical = result.join(":");
		}
		const key = important ? canonical + " !" : canonical;
		let id = ctxByCanon.get(key);
		if (id === void 0) ctxByCanon.set(key, id = nextCtxId++);
		return id;
	};
	let dynByHash = /* @__PURE__ */ new Map();
	let nextDynId = GROUP_COUNT;
	const MAX_DYN = GROUP_COUNT + 4096;
	const newDynId = () => nextDynId++;
	const ID_LIMIT = 2097152;
	const TOKEN_TABLE = 8192;
	const memoHash = new Int32Array(TOKEN_TABLE);
	const memoStr = new Array(TOKEN_TABLE).fill(null);
	const memoGid = new Int32Array(TOKEN_TABLE);
	const memoCtx = new Int32Array(TOKEN_TABLE);
	const memoFlags = new Uint8Array(TOKEN_TABLE);
	let memoTick = 0;
	const memoPut = (way0, input, ts, te, h, gid, ctxId, flags) => {
		let slot = way0;
		if (memoStr[way0] !== null) {
			if (memoStr[way0 | 1] === null) slot = way0 | 1;
			else if ((memoTick++ & 3) === 0) slot = way0 | memoTick >> 2 & 1;
			else return;
		}
		memoStr[slot] = input.slice(ts, te);
		memoHash[slot] = h;
		memoGid[slot] = gid;
		memoCtx[slot] = ctxId;
		memoFlags[slot] = flags;
	};
	const memoReset = () => memoStr.fill(null);
	let cap = 256;
	let tokI32 = [
		new Int32Array(cap),
		new Int32Array(cap),
		new Int32Array(cap),
		new Int32Array(cap)
	];
	let [tokStart, tokEnd, tokGid, tokCtx] = tokI32;
	let tokFlags = new Uint8Array(cap);
	let keep = new Uint8Array(cap);
	const growTokens = () => {
		cap *= 2;
		tokI32 = tokI32.map((a) => {
			const n = new Int32Array(cap);
			n.set(a);
			return n;
		});
		[tokStart, tokEnd, tokGid, tokCtx] = tokI32;
		const nf = new Uint8Array(cap);
		nf.set(tokFlags);
		tokFlags = nf;
		keep = new Uint8Array(cap);
	};
	let ckptCap = 64;
	let ckptNode = new Int32Array(ckptCap);
	let ckptTail = new Int32Array(ckptCap);
	const claim0 = new Int32Array(GROUP_COUNT);
	let CLAIM_TABLE = 2048;
	let claimShift = 21;
	let claimKeys = new Float64Array(CLAIM_TABLE);
	let claimEpochs = new Int32Array(CLAIM_TABLE);
	let epoch = 0;
	const claimTest = (ctx, gid) => {
		if (ctx === 0 && gid < GROUP_COUNT) {
			if (claim0[gid] === epoch) return 1;
			claim0[gid] = epoch;
			return 0;
		}
		const key = ctx * 2097152 + gid + 1;
		let idx = Math.imul(key, 2654435761) >>> claimShift;
		for (;;) {
			if (claimEpochs[idx] !== epoch) break;
			if (claimKeys[idx] === key) return 1;
			idx = idx + 1 & CLAIM_TABLE - 1;
		}
		claimKeys[idx] = key;
		claimEpochs[idx] = epoch;
		return 0;
	};
	const resolveAt = (input, bs, endPos, nodeAt, ckptAt) => {
		if (endPos - bs >= 2 && input.charCodeAt(bs) === 91 && input.charCodeAt(endPos - 1) === 93) {
			let colon = -1;
			for (let p = bs + 1; p < endPos - 1; p++) if (input.charCodeAt(p) === 58) {
				colon = p;
				break;
			}
			if (colon === -1 || colon === bs + 1) return EXTERNAL;
			return internSpan(dynByHash, input, bs + 1, colon, 0, newDynId);
		}
		if (nodeAt >= 0 && nodeGroup[nodeAt] >= 0) return nodeGroup[nodeAt];
		for (let k = ckptAt - 1; k >= 0; k--) {
			const tailStart = ckptTail[k];
			if (tailStart > endPos) continue;
			const nodeId = ckptNode[k];
			const tlen = endPos - tailStart;
			if (nodeHasLit[nodeId] === 1 && tlen > 0 && tlen <= litMaxLen) {
				const c0 = input.charCodeAt(tailStart);
				if (litNoArb === false || c0 !== 91 && c0 !== 40) {
					const g = litProbe(nodeId, input, tailStart, endPos);
					if (g >= 0) return g;
				}
			}
			const vl = nodeVlist[nodeId];
			if (vl < 0) continue;
			const pat = vlistRef[vl];
			const vs = vlistPat[pat];
			const ve = vlistPat[pat + 1];
			if (vs === ve) continue;
			analyzeArb(input, tailStart, endPos);
			const g0 = vgStart[vl] - vs;
			for (let v = vs; v < ve; v++) if (runValidator(vlistOps[v], input, tailStart, endPos)) return vlistGroup[g0 + v];
		}
		return EXTERNAL;
	};
	const mergeClassList = (input) => {
		const n = input.length;
		let tokenCount = 0;
		let totalTokenChars = 0;
		let sawNonSpaceWS = false;
		if (nextCtxId > MAX_CTX || ctxByHash.size > MAX_CTX) {
			ctxByHash = /* @__PURE__ */ new Map();
			ctxByCanon = /* @__PURE__ */ new Map();
			nextCtxId = 2;
			memoReset();
		}
		if (nextDynId > MAX_DYN) {
			dynByHash = /* @__PURE__ */ new Map();
			nextDynId = GROUP_COUNT;
			memoReset();
		}
		let i = 0;
		while (i < n) {
			let c = input.charCodeAt(i);
			if (c === 32 || c >= 9 && c <= 13 || c >= 160 && isUniWS(c)) {
				if (c !== 32) sawNonSpaceWS = true;
				i++;
				continue;
			}
			const ts = i;
			let th = 0;
			while (i < n) {
				c = input.charCodeAt(i);
				if (c <= 32) {
					if (c === 32) break;
					if (c >= 9 && c <= 13) {
						sawNonSpaceWS = true;
						break;
					}
				} else if (c >= 160 && isUniWS(c)) {
					sawNonSpaceWS = true;
					break;
				}
				th = Math.imul(th ^ c, 16777619);
				i++;
			}
			const te = i;
			const len = te - ts;
			if (tokenCount === cap) growTokens();
			const t = tokenCount++;
			tokStart[t] = ts;
			tokEnd[t] = te;
			totalTokenChars += len;
			th ^= Math.imul(len, 2654435761);
			const h = th ^ th >>> 15 | 0;
			const way0 = h & 8190;
			{
				let hitAt = -1;
				if (memoHash[way0] === h && memoStr[way0] !== null && memoStr[way0].length === len) hitAt = way0;
				else if (memoHash[way0 | 1] === h && memoStr[way0 | 1] !== null && memoStr[way0 | 1].length === len) hitAt = way0 | 1;
				if (hitAt >= 0) {
					const s = memoStr[hitAt];
					let ok = true;
					for (let k = 0; k < len; k++) if (s.charCodeAt(k) !== input.charCodeAt(ts + k)) {
						ok = false;
						break;
					}
					if (ok) {
						tokGid[t] = memoGid[hitAt];
						tokCtx[t] = memoCtx[hitAt];
						tokFlags[t] = memoFlags[hitAt];
						continue;
					}
				}
			}
			let pts = ts;
			if (FPL !== 0) {
				if (te - ts <= FPL || !input.startsWith(FULL_PREFIX, ts)) {
					tokGid[t] = EXTERNAL;
					memoPut(way0, input, ts, te, h, EXTERNAL, 0, 0);
					continue;
				}
				pts = ts + FPL;
			}
			let depthB = 0, depthP = 0;
			let lastColon = -1, lastSlash = -1;
			for (let p = pts; p < te; p++) {
				const pc = input.charCodeAt(p);
				if (depthB === 0 && depthP === 0) {
					if (pc === 58) {
						lastColon = p;
						continue;
					}
					if (pc === 47) {
						lastSlash = p;
						continue;
					}
				}
				if (pc === 91) depthB++;
				else if (pc === 93) depthB--;
				else if (pc === 40) depthP++;
				else if (pc === 41) depthP--;
			}
			const modStart = lastColon >= pts ? lastColon + 1 : pts;
			let bs = modStart;
			let be = te;
			let important = false;
			let prefixShift = 0;
			if (be > bs && input.charCodeAt(be - 1) === 33) {
				important = true;
				be--;
			} else if (be > bs && input.charCodeAt(bs) === 33) {
				important = true;
				bs++;
				prefixShift = 1;
			}
			let postfixEnd = -1;
			if (lastSlash > modStart) {
				postfixEnd = lastSlash + prefixShift;
				if (postfixEnd >= be) postfixEnd = -1;
			}
			let feedStart = bs;
			if (be - bs > 1 && input.charCodeAt(bs) === 45) feedStart = bs + 1;
			let node = 0;
			let lp = 0;
			let le = 0;
			let pending = -1;
			let ckptTop = 0;
			if (nodeVlist[0] >= 0 || nodeHasLit[0] === 1) {
				ckptNode[0] = 0;
				ckptTail[0] = feedStart;
				ckptTop = 1;
			}
			let slashNode = DEAD;
			let slashCkpt = 0;
			for (let p = feedStart; p < be; p++) {
				if (p === postfixEnd) {
					slashNode = lp < le ? DEAD : node;
					slashCkpt = ckptTop;
				}
				if (node !== DEAD) {
					const cc = input.charCodeAt(p);
					let arrived = -1;
					if (lp < le) {
						if (labelText.charCodeAt(lp) === cc) {
							lp++;
							if (lp === le) arrived = node = pending;
						} else node = DEAD;
					} else {
						const es = edgeStart[node];
						const ee = edgeStart[node + 1];
						let next = DEAD;
						for (let e = es; e < ee; e++) {
							const ls = labelStart[e];
							if (labelText.charCodeAt(ls) === cc) {
								if (labelStart[e + 1] - ls === 1) arrived = next = edgeTarget[e];
								else {
									lp = ls + 1;
									le = labelStart[e + 1];
									pending = edgeTarget[e];
									next = node;
								}
								break;
							}
						}
						node = next;
					}
					if (arrived >= 0 && (nodeVlist[arrived] >= 0 || nodeHasLit[arrived] === 1) && p + 1 < be && input.charCodeAt(p + 1) === 45) {
						if (ckptTop === ckptCap) {
							ckptCap *= 2;
							const nv = new Int32Array(ckptCap);
							nv.set(ckptNode);
							ckptNode = nv;
							const nt = new Int32Array(ckptCap);
							nt.set(ckptTail);
							ckptTail = nt;
						}
						ckptNode[ckptTop] = arrived;
						ckptTail[ckptTop] = p + 2;
						ckptTop++;
					}
				}
			}
			if (postfixEnd === be) {
				slashNode = lp < le ? DEAD : node;
				slashCkpt = ckptTop;
			}
			const endNode = lp < le ? DEAD : node;
			let gid;
			let hasPostfix = false;
			if (postfixEnd >= 0) {
				hasPostfix = true;
				gid = resolveAt(input, bs, postfixEnd, slashNode, slashCkpt);
				if (gid !== EXTERNAL && gid < GROUP_COUNT && postfixLookupSet[gid]) {
					const gidFull = resolveAt(input, bs, be, endNode, ckptTop);
					if (gidFull !== EXTERNAL && gidFull !== gid) {
						gid = gidFull;
						hasPostfix = false;
					}
				} else if (gid === EXTERNAL) {
					gid = resolveAt(input, bs, be, endNode, ckptTop);
					hasPostfix = false;
				}
			} else gid = resolveAt(input, bs, be, endNode, ckptTop);
			let ctxId = 0;
			let flags = 0;
			if (gid === EXTERNAL) tokGid[t] = EXTERNAL;
			else {
				flags = hasPostfix ? 1 : 0;
				ctxId = pts >= lastColon ? important ? 1 : 0 : internSpan(ctxByHash, input, pts, lastColon, important ? 1 : 0, (k) => canonicalizeContext(k, important));
				tokGid[t] = gid;
				tokFlags[t] = flags;
				tokCtx[t] = ctxId;
			}
			memoPut(way0, input, ts, te, h, gid, ctxId, flags);
		}
		if (tokenCount === 0) return "";
		if (tokenCount === 1) return tokStart[0] === 0 && tokEnd[0] === n ? input : input.slice(tokStart[0], tokEnd[0]);
		if (tokenCount * CLAIM_PER_TOKEN > CLAIM_TABLE) {
			while (tokenCount * CLAIM_PER_TOKEN > CLAIM_TABLE) {
				CLAIM_TABLE <<= 1;
				claimShift--;
			}
			claimKeys = new Float64Array(CLAIM_TABLE);
			claimEpochs = new Int32Array(CLAIM_TABLE);
		}
		if (nextCtxId >= ID_LIMIT || nextDynId >= ID_LIMIT) throw new Error("cn: too many distinct classes in one merge");
		epoch = epoch + 1 | 0;
		if (epoch === 0) {
			claim0.fill(0);
			claimEpochs.fill(0);
			epoch = 1;
		}
		let didDrop = false;
		for (let t = tokenCount - 1; t >= 0; t--) {
			const gid = tokGid[t];
			if (gid === EXTERNAL) {
				keep[t] = 1;
				continue;
			}
			const ctxId = tokCtx[t];
			if (claimTest(ctxId, gid) === 1) {
				keep[t] = 0;
				didDrop = true;
				continue;
			}
			keep[t] = 1;
			if (gid < GROUP_COUNT) {
				const r = adjRow[gid];
				if (r >= 0) for (let k = adjStart[r]; k < adjStart[r + 1]; k++) claimTest(ctxId, adjTgt[k]);
				if (tokFlags[t] & 1) {
					for (let k = 0; k < patGid.length; k++) if (patGid[k] === gid) claimTest(ctxId, patTgt[k]);
				}
			}
		}
		if (!didDrop && !sawNonSpaceWS && n === totalTokenChars + tokenCount - 1) return input;
		let out = "";
		let t = 0;
		while (t < tokenCount) {
			if (!keep[t]) {
				t++;
				continue;
			}
			const runStart = tokStart[t];
			let runEnd = tokEnd[t];
			let u = t + 1;
			while (u < tokenCount && keep[u] && tokStart[u] === runEnd + 1 && input.charCodeAt(runEnd) === 32) {
				runEnd = tokEnd[u];
				u++;
			}
			if (out.length > 0) out += " ";
			out += input.slice(runStart, runEnd);
			t = u;
		}
		return out;
	};
	const DOOR_SIZE = 16384;
	const door = new Int32Array(DOOR_SIZE * 2);
	let doorBase = 0;
	let doorEpoch = 1;
	let cache = Object.create(null);
	let prevCache = Object.create(null);
	let cacheMap = /* @__PURE__ */ new Map();
	let prevCacheMap = /* @__PURE__ */ new Map();
	let cacheCount = 0;
	let doorMarks = 0;
	const rotateDoor = () => {
		doorBase ^= DOOR_SIZE;
		doorEpoch = doorEpoch + 1 | 0;
		doorMarks = 0;
	};
	const mergeCached = (input) => {
		let merged = cache[input];
		if (merged !== void 0) return merged;
		const hash = spanHash(input, 0, input.length);
		const slot = (hash & 16383) + doorBase;
		const wasSeen = door[slot] === (hash ^ doorEpoch) || door[slot ^ DOOR_SIZE] === (hash ^ doorEpoch - 1);
		if (wasSeen) {
			merged = prevCache[input];
			if (merged !== void 0) {
				cache[input] = merged;
				return merged;
			}
		}
		merged = mergeClassList(input);
		if (wasSeen) {
			cache[input] = merged;
			if (++cacheCount > cacheSize) {
				cacheCount = 0;
				prevCache = cache;
				cache = Object.create(null);
				rotateDoor();
			}
		} else {
			door[slot] = hash ^ doorEpoch;
			if (++doorMarks > DOOR_SIZE) rotateDoor();
		}
		return merged;
	};
	const mergeCachedMap = (input) => {
		let merged = cacheMap.get(input);
		if (merged !== void 0) return merged;
		const hash = spanHash(input, 0, input.length);
		const slot = (hash & 16383) + doorBase;
		const wasSeen = door[slot] === (hash ^ doorEpoch) || door[slot ^ DOOR_SIZE] === (hash ^ doorEpoch - 1);
		if (wasSeen) {
			merged = prevCacheMap.get(input);
			if (merged !== void 0) {
				cacheMap.set(input, merged);
				return merged;
			}
		}
		merged = mergeClassList(input);
		if (wasSeen) {
			cacheMap.set(input, merged);
			if (++cacheCount > cacheSize) {
				cacheCount = 0;
				prevCacheMap = cacheMap;
				cacheMap = /* @__PURE__ */ new Map();
				rotateDoor();
			}
		} else {
			door[slot] = hash ^ doorEpoch;
			if (++doorMarks > DOOR_SIZE) rotateDoor();
		}
		return merged;
	};
	const seenBefore = (input) => {
		const hash = spanHash(input, 0, input.length);
		const slot = (hash & 16383) + doorBase;
		if (door[slot] === (hash ^ doorEpoch) || door[slot ^ DOOR_SIZE] === (hash ^ doorEpoch - 1)) return true;
		door[slot] = hash ^ doorEpoch;
		if (++doorMarks > DOOR_SIZE) rotateDoor();
		return false;
	};
	const mergeString = cacheSize === 0 ? mergeClassList : IS_JSC ? (input) => {
		const merged = cacheMap.get(input);
		return merged !== void 0 ? merged : mergeCachedMap(input);
	} : mergeCached;
	const merge = function() {
		return arguments.length === 1 && typeof arguments[0] === "string" ? mergeString(arguments[0]) : mergeString(twJoin.apply(null, arguments));
	};
	return {
		merge,
		mergeString,
		seenBefore: cacheSize === 0 ? () => false : seenBefore,
		mergeUncached: mergeClassList
	};
};
const resolveValue = (v, clsxMode) => {
	if (!v) return "";
	if (typeof v === "string") return v;
	let out = "";
	if (typeof v.length === "number" && (clsxMode ? Array.isArray(v) : true)) {
		const arr = v;
		for (let i = 0; i < arr.length; i++) {
			const item = arr[i];
			if (!item) continue;
			const r = typeof item === "string" ? item : resolveValue(item, clsxMode);
			if (r) {
				if (out) out += " ";
				out += r;
			}
		}
		return out;
	}
	if (clsxMode) {
		if (typeof v === "number") return "" + v;
		if (typeof v === "object") {
			for (const k in v) if (v[k]) {
				if (out) out += " ";
				out += k;
			}
		}
	}
	return out;
};
const joinArgs = (args, clsxMode) => {
	let s = "";
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (!a) continue;
		const r = typeof a === "string" ? a : resolveValue(a, clsxMode);
		if (r) {
			if (s) s += " ";
			s += r;
		}
	}
	return s;
};
/** join-only, `twJoin`-compatible (strings + nested arrays, falsy skipped) */
const twJoin = function() {
	return joinArgs(arguments, false);
};
const BUCKET_CAP = 256;
const BUCKET_MISS_CAP = 16;
const BUCKET_SKIP = 1024;
const CHURN_SIZE = 4096;
const wrapClsx = (mergeString, fresh) => {
	const seenBefore = fresh === void 0 ? () => true : fresh.seenBefore;
	const mergeUncached = fresh === void 0 ? mergeString : fresh.mergeUncached;
	let argCache = /* @__PURE__ */ new Map();
	let prevArgCache = /* @__PURE__ */ new Map();
	let argCount = 0;
	let lastHit = null;
	let churnKey = null;
	let churnOwn = [];
	let churnVal = [];
	let churnTick = 0;
	const churnLookup = (key, own, join) => {
		if (churnKey === null) {
			churnKey = new Array(CHURN_SIZE).fill("");
			churnOwn = new Array(CHURN_SIZE).fill("");
			churnVal = new Array(CHURN_SIZE).fill("");
		}
		const way0 = spanHash(key, 0, key.length) & 4094;
		if (churnKey[way0] === key && churnOwn[way0] === own) return churnVal[way0];
		if (churnKey[way0 | 1] === key && churnOwn[way0 | 1] === own) return churnVal[way0 | 1];
		const merged = mergeString(join ? own + " " + key : key);
		const slot = churnKey[way0] === "" ? way0 : way0 | (churnKey[way0 | 1] === "" ? 1 : churnTick++ & 1);
		churnKey[slot] = key;
		churnOwn[slot] = own;
		churnVal[slot] = merged;
		return merged;
	};
	const match3 = (e, v0, v1, v2) => {
		let k = 0;
		if (v0) {
			if (v0 !== e.a0) return false;
			k = 1;
		}
		if (v1) {
			if (v1 !== (k === 0 ? e.a0 : e.a1)) return false;
			k++;
		}
		if (v2) {
			if (v2 !== (k === 0 ? e.a0 : k === 1 ? e.a1 : e.a2)) return false;
			k++;
		}
		return k === e.t;
	};
	const matchN = (e, vals) => {
		const ea = e.a;
		let k = 0;
		for (let i = 0; i < vals.length; i++) {
			const v = vals[i];
			if (!v) continue;
			if (v !== ea[k]) return false;
			k++;
		}
		return k === e.t;
	};
	const resolveArgs = (vals, probed) => {
		const nArgs = vals.length;
		const pred = lastHit === null ? null : lastHit.n;
		if (!probed) {
			if (pred !== null && matchN(pred, vals)) {
				lastHit = pred;
				return pred.r;
			}
			if (lastHit !== null && lastHit !== pred && matchN(lastHit, vals)) return lastHit.r;
		}
		let first = "";
		let firstIdx = -1;
		let truthy = 0;
		let hasResolvedValue = false;
		for (let i = 0; i < nArgs; i++) {
			let v = vals[i];
			if (!v) continue;
			if (typeof v !== "string") {
				v = vals[i] = resolveValue(v, true);
				if (!v) continue;
				hasResolvedValue = true;
			}
			if (firstIdx < 0) {
				first = v;
				firstIdx = i;
			}
			truthy++;
		}
		if (truthy === 0) return "";
		if (truthy === 1) return mergeString(first);
		if (hasResolvedValue) {
			if (pred !== null && matchN(pred, vals)) {
				lastHit = pred;
				return pred.r;
			}
			if (lastHit !== null && lastHit !== pred && matchN(lastHit, vals)) return lastHit.r;
		}
		let bucket = argCache.get(first);
		if (bucket === void 0) {
			bucket = prevArgCache.get(first);
			if (bucket !== void 0) argCache.set(first, bucket);
		}
		let hit = null;
		if (bucket !== void 0) {
			if (bucket.skip > 0) {
				bucket.skip--;
				lastHit = null;
				let joined = first;
				for (let i = firstIdx + 1; i < nArgs; i++) {
					const v = vals[i];
					if (v) joined += " " + v;
				}
				return churnLookup(joined, "", false);
			}
			const entries = bucket.e;
			outer: for (let b = 0; b < entries.length; b++) {
				const e = entries[b];
				if (e.t !== truthy) continue;
				const ea = e.a;
				let k = 1;
				for (let i = firstIdx + 1; i < nArgs; i++) {
					const v = vals[i];
					if (v && v !== ea[k++]) continue outer;
				}
				hit = e;
				break;
			}
			if (hit !== null) bucket.miss = 0;
		}
		if (hit === null) {
			let joined = first;
			const a = [first];
			for (let i = firstIdx + 1; i < nArgs; i++) {
				const v = vals[i];
				if (!v) continue;
				joined += " " + v;
				a.push(v);
			}
			if (!seenBefore(joined)) return mergeUncached(joined);
			hit = {
				r: mergeString(joined),
				t: a.length,
				a0: a[0],
				a1: a[1],
				a2: a[2] ?? "",
				a,
				n: null
			};
			if (bucket === void 0) argCache.set(first, bucket = {
				e: [],
				miss: 0,
				skip: 0,
				at: 0
			});
			else if (++bucket.miss > BUCKET_MISS_CAP) {
				bucket.miss = BUCKET_MISS_CAP;
				bucket.skip = BUCKET_SKIP;
				bucket.e.length = 0;
				bucket.at = 0;
			}
			const entries = bucket.e;
			if (entries.length < BUCKET_CAP) entries.push(hit);
			else {
				entries[bucket.at] = hit;
				bucket.at = bucket.at + 1 & 255;
			}
			if (++argCount > 1e3) {
				argCount = 0;
				prevArgCache = argCache;
				argCache = /* @__PURE__ */ new Map();
			}
		}
		if (lastHit !== null && lastHit !== hit) lastHit.n = hit;
		lastHit = hit;
		return hit.r;
	};
	const mergeSingleValue = (value) => Array.isArray(value) ? resolveArgs(value.slice(), false) : mergeString(resolveValue(value, true));
	return function(v0, v1, v2) {
		const nArgs = arguments.length;
		if ((nArgs | 1) === 3) {
			const lh = lastHit;
			if (lh !== null) {
				const pred = lh.n;
				if (pred !== null && match3(pred, v0, v1, v2)) {
					lastHit = pred;
					return pred.r;
				}
				if (lh !== pred && match3(lh, v0, v1, v2)) return lh.r;
			}
			if (nArgs === 2 && typeof v1 === "string" && v1 !== "") {
				const bucket = argCache.get(v0);
				if (bucket !== void 0 && bucket.skip > 0) {
					bucket.skip--;
					lastHit = null;
					return churnLookup(v1, v0, true);
				}
			}
			return resolveArgs([
				v0,
				v1,
				v2
			], true);
		}
		if (nArgs === 1) return typeof v0 === "string" ? mergeString(v0) : mergeSingleValue(v0);
		const lh = lastHit;
		if (lh !== null) {
			const pred = lh.n;
			if (pred !== null) {
				const pa = pred.a;
				let k = 0;
				let ok = true;
				for (let i = 0; i < nArgs; i++) {
					const v = arguments[i];
					if (!v) continue;
					if (v !== pa[k]) {
						ok = false;
						break;
					}
					k++;
				}
				if (ok && k === pred.t) {
					lastHit = pred;
					return pred.r;
				}
			}
			if (lh !== pred) {
				const la = lh.a;
				let k = 0;
				let ok = true;
				for (let i = 0; i < nArgs; i++) {
					const v = arguments[i];
					if (!v) continue;
					if (v !== la[k]) {
						ok = false;
						break;
					}
					k++;
				}
				if (ok && k === lh.t) return lh.r;
			}
		}
		const vals = [];
		for (let i = 0; i < nArgs; i++) vals.push(arguments[i]);
		return resolveArgs(vals, true);
	};
};
//#endregion
//#region ../../node_modules/.pnpm/cn@0.5.1/node_modules/cn/dist/index.js
const instance = /* @__PURE__ */ createEngine(tables_generated_default);
/**
* Merge Tailwind CSS classes with clsx-style arguments (strings, arrays,
* objects, conditionals). Drop-in replacement for `twMerge(clsx(...))`.
*/
const cn = /* @__PURE__ */ wrapClsx(instance.mergeString, instance);
instance.merge;
//#endregion
//#region src/client/ui/select.tsx
const Select = SelectRoot;
function SelectValue({ className, ...props }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectValue$1, {
		"data-slot": "select-value",
		className: cn("flex flex-1 text-start", className),
		...props
	});
}
function SelectTrigger({ className, size = "default", children, ...props }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SelectTrigger$1, {
		"data-slot": "select-trigger",
		"data-size": size,
		className: cn("flex min-w-40 items-center justify-between gap-3 rounded-md border border-line bg-bg-1 py-2 ps-3 pe-2 text-[12px] whitespace-nowrap text-fg shadow-sm select-none hover:bg-hover active:bg-bg-3 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8", className),
		...props,
		children: [children, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectIcon, { render: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "flex shrink-0 text-fg-dim",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HugeiconsIcon, {
				icon: ChevronDownIcon,
				className: "size-4"
			})
		}) })]
	});
}
function SelectContent({ className, children, container, side = "bottom", sideOffset = 5, align = "start", alignOffset = 0, alignItemWithTrigger = false, ...props }) {
	const [portalContainer, setPortalContainer] = (0, react.useState)(null);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		ref: setPortalContainer,
		className: "contents",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectPortal, {
			container: container ?? portalContainer,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectPositioner, {
				side,
				sideOffset,
				align,
				alignOffset,
				alignItemWithTrigger,
				className: "isolate z-50",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SelectPopup, {
					"data-slot": "select-content",
					className: cn("relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-40 overflow-x-clip overflow-y-auto rounded-lg border border-line bg-bg-1 p-1 text-[12px] text-fg shadow-xl", className),
					...props,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectScrollUpButton, {}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectList, { children }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectScrollDownButton, {})
					]
				})
			})
		})
	});
}
function SelectItem({ className, children, ...props }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SelectItem$1, {
		"data-slot": "select-item",
		className: cn("relative flex min-h-8 w-full cursor-default items-center gap-1.5 rounded-md py-1.5 ps-2 pe-8 text-[12px] text-fg select-none active:bg-bg-3 data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-bg-3", className),
		...props,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectItemText, {
			className: "flex flex-1 shrink-0 gap-2 whitespace-nowrap",
			children
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectItemIndicator, { render: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "pointer-events-none absolute inset-e-2 flex size-4 items-center justify-center text-accent",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HugeiconsIcon, {
				icon: CheckIcon,
				className: "size-4"
			})
		}) })]
	});
}
function SelectScrollUpButton({ className, ...props }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectScrollUpArrow, {
		"data-slot": "select-scroll-up-button",
		className: cn("flex w-full items-center justify-center bg-bg-1 py-1 text-fg-dim", className),
		...props,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HugeiconsIcon, {
			icon: ChevronUpIcon,
			className: "size-4"
		})
	});
}
function SelectScrollDownButton({ className, ...props }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectScrollDownArrow, {
		"data-slot": "select-scroll-down-button",
		className: cn("flex w-full items-center justify-center bg-bg-1 py-1 text-fg-dim", className),
		...props,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HugeiconsIcon, {
			icon: ChevronDownIcon,
			className: "size-4"
		})
	});
}
//#endregion
//#region src/client/ui/skill-usage.tsx
function visibleSkills(skills, query, sort) {
	const needle = query.trim().toLowerCase();
	return skills.filter((skill) => `${skill.name}\n${skill.path ?? ""}`.toLowerCase().includes(needle)).toSorted((a, b) => (sort === "count" ? b.count - a.count : b.lastTurnIndex - a.lastTurnIndex) || b.lastTurnIndex - a.lastTurnIndex || a.id.localeCompare(b.id));
}
function SkillUsage({ skills, onJumpTurn, loadedTurns, totalTurns, onLoadMore, loadingMore = false }) {
	const id = (0, react.useId)();
	const [query, setQuery] = (0, react.useState)("");
	const [sort, setSort] = (0, react.useState)("count");
	const visible = visibleSkills(skills ?? [], query, sort);
	const maximum = Math.max(1, ...visible.map((skill) => skill.count));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-4 p-4",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					className: "m-0 text-[13px] font-semibold",
					children: insightLabel("insights.skills")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "text-[11px] text-fg-dim tabular-nums",
					children: insightLabel("insights.skillSummary", {
						count: skills?.length ?? 0,
						uses: (skills ?? []).reduce((sum, skill) => sum + skill.count, 0)
					})
				})]
			}),
			loadedTurns !== void 0 && totalTurns !== void 0 && loadedTurns < totalTurns ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Card$1, {
				label: insightLabel("insights.skills"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "m-0 text-[11px] text-fg-dim",
						children: insightLabel("insights.partialSkills", {
							loaded: loadedTurns,
							total: totalTurns
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ci-btn min-h-9",
						disabled: loadingMore || onLoadMore === void 0,
						onClick: onLoadMore,
						children: t(loadingMore ? "session.loadingMore" : "session.loadMore")
					})]
				})
			}) : null,
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end gap-3",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "flex min-w-0 basis-64 flex-col gap-1 text-[11px]",
					children: [insightLabel("insights.searchSkills"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "search",
						value: query,
						onChange: (event) => setQuery(event.target.value),
						className: "h-9 w-full rounded-md border border-line bg-bg-1 px-3 text-[12px] shadow-sm"
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-col gap-1 text-[11px]",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
						id: `${id}-sort`,
						children: insightLabel("insights.sortSkills")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Select, {
						value: sort,
						onValueChange: (value) => setSort(value === "recent" ? "recent" : "count"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectTrigger, {
							"aria-labelledby": `${id}-sort`,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectValue, { children: insightLabel(sort === "count" ? "insights.byCount" : "insights.byRecent") })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectItem, {
							value: "count",
							children: insightLabel("insights.byCount")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectItem, {
							value: "recent",
							children: insightLabel("insights.byRecent")
						})] })]
					})]
				})]
			}),
			skills === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 text-fg-dim",
				children: insightLabel("insights.unrecorded")
			}) : visible.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Card$1, {
				label: insightLabel("insights.skills"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "m-0 text-[12px] text-fg-dim",
					children: insightLabel(query.trim() === "" ? "insights.noSkills" : "insights.noMatchingSkills")
				})
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
				className: "m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-3 p-0",
				children: visible.map((skill, rank) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
					className: "flex min-w-0 flex-col gap-3 rounded-xl border border-line-soft bg-bg-1 p-4",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "flex min-w-0 items-baseline gap-2",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "font-mono text-[11px] text-fg-dim",
									children: rank + 1
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "m-0 min-w-0 flex-1 text-[13px] font-semibold wrap-anywhere",
									children: skill.name
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "shrink-0 text-[11px] tabular-nums",
									children: insightLabel("insights.skillCount", { count: skill.count })
								})
							]
						}),
						skill.path === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "m-0 font-mono text-[10px] wrap-anywhere text-fg-dim",
							children: skill.path
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "meter",
							"aria-valuemin": 0,
							"aria-valuemax": maximum,
							"aria-valuenow": skill.count,
							"aria-label": `${skill.name}: ${skill.count}`,
							className: "h-1.5 overflow-clip rounded-full bg-bg-3",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "h-full rounded-full bg-accent",
								style: { width: `${skill.count / maximum * 100}%` }
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ci-btn min-h-9 self-start active:bg-bg-3",
							disabled: onJumpTurn === void 0,
							onClick: () => onJumpTurn?.(skill.lastTurnIndex),
							children: insightLabel("insights.jump", { index: skill.lastTurnIndex })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
							className: "cursor-pointer rounded-md py-2 text-[11px] active:bg-bg-3",
							children: [
								insightLabel("insights.evidence"),
								" (",
								skill.evidence.length,
								")"
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: "m-0 flex list-none flex-col gap-2 p-0",
							children: skill.evidence.map((evidence) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: "min-w-0 rounded-md bg-bg-2 p-2 text-[11px]",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "ci-btn min-h-9 max-w-full active:bg-bg-3",
										disabled: onJumpTurn === void 0,
										onClick: () => onJumpTurn?.(evidence.turnIndex),
										children: insightLabel("insights.jump", { index: evidence.turnIndex })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "m-0 py-1",
										children: insightLabel(`insights.${evidence.kind}`)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "m-0 font-mono wrap-anywhere text-fg-dim",
										children: evidence.toolCallId
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "m-0 text-fg-dim",
										children: evidence.time === void 0 ? insightLabel("insights.unrecorded") : formatTime(evidence.time)
									})
								]
							}, evidence.toolCallId))
						})] })
					]
				}, skill.id))
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 text-[11px] leading-relaxed text-fg-dim",
				children: insightLabel("insights.skillNote")
			})
		]
	});
}
//#endregion
//#region src/client/ui/subagent-tree.tsx
/**
* @param props.segments - the session's physical files, main first.
* @param props.turnSubagents - subagent ids recorded on the open turn.
* @returns the section.
*/
function SubagentTree({ segments, turnSubagents }) {
	const attached = segments.slice(1);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card$1, {
		label: t("subagents.title"),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionTitle, {
				count: turnSubagents.length,
				children: t("subagents.title")
			}),
			segments.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 text-[11.5px] text-fg-dim",
				children: t("subagents.none")
			}) : null,
			segments.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: "ci-fold mt-1 mb-2",
				open: attached.length > 0 && attached.length <= 3,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
					className: "inline-flex items-center gap-1 text-[11.5px] text-fg-dim",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
						name: "chevron",
						size: 11,
						className: "ci-chevron"
					}), t("subagents.files", { count: attached.length })]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
					className: "mt-1.5 mb-0 list-none p-0 font-mono text-[11px]",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: "flex items-baseline gap-1.5 py-0.5 ps-0",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "text-fg-dim",
								"aria-hidden": "true",
								children: "▸"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "truncate",
								children: basename(segments[0]?.name ?? "")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-fg-dim",
								children: formatBytes(segments[0]?.bytes ?? 0)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chip, { children: t("subagents.main") })
						]
					}), attached.map((segment) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: "flex items-baseline gap-1.5 py-0.5 ps-3",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "text-fg-dim",
								"aria-hidden": "true",
								children: "└"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "truncate",
								children: segment.name
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-fg-dim",
								children: formatBytes(segment.bytes)
							})
						]
					}, segment.name))]
				})]
			}) : null,
			turnSubagents.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "m-0 text-[11.5px] text-fg-dim",
				children: t("turns.noSubagents")
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "mt-1.5 mb-2 flex list-none flex-wrap gap-1.5 p-0",
				children: turnSubagents.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Chip, {
					tone: "mono",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
						name: "branch",
						size: 11
					}), id]
				}) }, id))
			})
		]
	});
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
	running: "ci-status ci-status--running"
};
/** Calls rendered before the "show all" control appears. */
const VISIBLE_CALLS = 12;
/** Characters of a block printed before it folds. */
const PREVIEW_CHARS = 600;
function asRecord(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	return value;
}
function stringField(record, key) {
	const value = record?.[key];
	return typeof value === "string" ? value : void 0;
}
/**
* Flatten a tool result into text.
* @param value - a string, a content-block array, or any JSON value.
* @returns printable text (possibly empty).
*/
function outputText(value) {
	if (value === void 0) return "";
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map((entry) => {
		if (typeof entry === "string") return entry;
		const record = asRecord(entry);
		return stringField(record, "text") ?? (record === void 0 ? "" : JSON.stringify(record));
	}).filter((part) => part !== "").join("\n");
	const text = stringField(asRecord(value), "text");
	if (text !== void 0) return text;
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}
/**
* The one fact a call is about, chosen by tool name.
* @param call - the tool call.
* @returns label and body, or undefined when the call carries no named input.
*/
function primaryFact(call) {
	const input = asRecord(call.input);
	const command = stringField(input, "command");
	if (command !== void 0) return {
		label: t("tools.command"),
		body: command,
		mono: true
	};
	const path = stringField(input, "file_path") ?? stringField(input, "path") ?? stringField(input, "notebook_path");
	if (path !== void 0) return {
		label: t("tools.path"),
		body: path,
		mono: true
	};
	const url = stringField(input, "url");
	if (url !== void 0) return {
		label: "url",
		body: url,
		mono: true
	};
	const query = stringField(input, "query");
	if (query !== void 0) return {
		label: "query",
		body: query
	};
	if (call.input === void 0) return void 0;
	return {
		label: t("tools.input"),
		body: clip(outputText(call.input), PREVIEW_CHARS),
		mono: true
	};
}
/**
* A replaced/inserted pair, printed line by line.
* @param props.before - text the edit removed.
* @param props.after - text the edit inserted.
* @returns the diff block.
*/
function DiffBlock({ before, after }) {
	const removed = before === "" ? [] : before.split("\n");
	const added = after === "" ? [] : after.split("\n");
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		className: "mb-1 block text-[10.5px] text-fg-dim",
		children: t("tools.diff")
	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("pre", {
		className: "ci-pre max-h-55",
		children: [removed.map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
			className: "block bg-[color-mix(in_oklch,var(--color-err)_8%,transparent)] text-err",
			children: [line, "\n"]
		}, `d${String(index)}`)), added.map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
			className: "block bg-[color-mix(in_oklch,var(--color-ok)_8%,transparent)] text-ok",
			children: [line, "\n"]
		}, `a${String(index)}`))]
	})] });
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
	const fact = primaryFact(call);
	const input = asRecord(call.input);
	const before = stringField(input, "old_string");
	const after = stringField(input, "new_string");
	const output = outputText(call.output);
	const failed = call.status === "error";
	const status = call.endedAt === void 0 && call.status !== "error" ? "running" : call.status;
	const statusLabel = status === "running" ? t("tools.status.running") : status === "ok" ? t("tools.status.ok") : status === "error" ? t("tools.status.error") : t("tools.status.unknown");
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
		className: failed ? "rounded-lg border border-err/40 bg-err/5" : "rounded-lg border border-line-soft bg-bg",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
			className: "ci-fold",
			open: failed,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
				className: "flex min-w-0 items-center gap-2 px-2.5 py-2 text-[12px]",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
						name: "chevron",
						size: 11,
						className: "ci-chevron shrink-0 text-fg-3"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "shrink-0 font-mono font-semibold",
						children: call.name
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `${STATUS_SKIN[status]} shrink-0`,
						children: statusLabel
					}),
					fact === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "min-w-0 flex-1 truncate font-mono text-[11px] text-fg-dim",
						title: fact.body,
						children: fact.body.split("\n")[0]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "ms-auto shrink-0 text-[10.5px] text-fg-3 tabular-nums",
						children: formatDuration(call.startedAt, call.endedAt)
					})
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2 px-2.5 pb-2.5",
				children: [
					fact === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "mb-1 block text-[10.5px] text-fg-dim",
						children: fact.label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: "ci-pre",
						children: clip(fact.body, PREVIEW_CHARS)
					})] }),
					before === void 0 && after === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffBlock, {
						before: before ?? "",
						after: after ?? ""
					}),
					output === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: failed ? "mb-1 block text-[10.5px] text-err" : "mb-1 block text-[10.5px] text-fg-dim",
						children: failed ? `${t("tools.output")} · ${t("tools.status.error")}` : t("tools.output")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: "ci-pre max-h-80",
						children: clip(output, PREVIEW_CHARS * 4)
					})] })
				]
			})]
		})
	});
}
/**
* The whole tool section for one turn.
* @param props.calls - that turn's calls.
* @param props.expanded - whether the caller lifted the visible cap.
* @param props.onToggleExpanded - lift/lower the cap.
* @returns the section body.
*/
function ToolCalls({ calls, expanded, onToggleExpanded }) {
	if (calls.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "m-0 text-[11.5px] text-fg-dim",
		children: t("turns.noTools")
	});
	const visible = expanded ? calls : calls.slice(0, VISIBLE_CALLS);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
		className: "m-0 flex list-none flex-col gap-1.5 p-0",
		children: visible.map((call) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolEntry, { call }, call.id))
	}), calls.length > VISIBLE_CALLS ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
		type: "button",
		className: "ci-btn ci-btn--quiet mt-2",
		onClick: () => onToggleExpanded(!expanded),
		children: expanded ? t("tools.showLess") : t("tools.showAll", { count: calls.length })
	}) : null] });
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
	const attribution = turn.attribution;
	const total = attribution.total.tokens;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 flex-col",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "sticky top-0 z-10 flex flex-col gap-3 border-b border-line-soft bg-bg px-4 pt-4 pb-3",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 items-end gap-3",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-col",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: "m-0 text-[15px] font-semibold",
						children: t("turns.selected", { index: turn.index })
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "text-[11px] text-fg-dim tabular-nums",
						children: formatTime(turn.startedAt)
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ms-auto flex items-baseline gap-2",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "text-[20px] font-semibold tracking-[-0.01em] tabular-nums",
						children: compactTokens(total)
					}), attribution.windowSize === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chip, {
						tone: "soft",
						children: t("stats.windowShare", {
							share: formatShare(total, attribution.windowSize),
							size: compactTokens(attribution.windowSize)
						})
					})]
				})]
			}), turn.userInput.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ci-ask",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "ci-ask__label",
					children: t("detail.userInput")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "ci-ask__text",
					children: turn.userInput.join("\n")
				})]
			})]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-3 p-4",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card$1, {
					label: t("detail.composition"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionTitle, {
							end: attribution.reconciled === void 0 ? void 0 : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chip, {
								tone: "mono",
								title: t("turns.reconciled", { factor: attribution.reconciled.factor.toFixed(3) }),
								children: formatFactor(attribution.reconciled.factor)
							}),
							children: t("detail.composition")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StackedBar, {
							attribution,
							label: t("turns.selected", { index: turn.index })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PartLegend, { attribution })
					]
				}),
				turn.compactions.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card$1, {
					label: t("turns.compaction"),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionTitle, {
						count: turn.compactions.length,
						children: t("turns.compaction")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: "m-0 list-none p-0",
						children: turn.compactions.map((point, order) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: "flex flex-wrap items-baseline gap-2 border-t border-line-soft py-1.5 text-[11.5px] first:border-t-0",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "font-mono text-[10.5px] text-fg-dim",
									children: formatTime(point.at)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, {
									measure: point.before,
									dense: true
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									className: "text-warn",
									children: "→"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeasureValue, {
									measure: point.after,
									dense: true
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "text-fg-dim",
									children: point.replacedHistory ? t("turns.compactionReplaced") : t("turns.compactionContinued")
								}),
								point.trigger === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chip, {
									tone: "soft",
									children: point.trigger
								})
							]
						}, `${String(point.at)}-${String(order)}`))
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card$1, {
					label: t("turns.tools"),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionTitle, {
						count: turn.toolCalls.length,
						children: t("turns.tools")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolCalls, {
						calls: turn.toolCalls,
						expanded: expandedTools,
						onToggleExpanded: onToggleTools
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SubagentTree, {
					segments,
					turnSubagents: turn.subagents
				})
			]
		})]
	});
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
	const rows = [];
	for (const turn of turns) {
		if (turn.compactions.length > 0) rows.push({
			kind: "compactions",
			key: `c-${String(turn.index)}`,
			turn,
			points: turn.compactions
		});
		rows.push({
			kind: "turn",
			key: `t-${String(turn.index)}`,
			turn
		});
	}
	return rows;
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
	const first = points[0];
	const last = points[points.length - 1];
	const range = first === void 0 || last === void 0 ? "" : t("compactions.range", {
		before: compactTokens(first.before.tokens),
		after: compactTokens(last.after.tokens)
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
		className: "my-1 px-1 text-[11px] text-warn",
		"data-turn": turn.index,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
			className: "ci-fold rounded-lg border border-dashed border-warn/50 bg-warn/6",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
				className: "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 py-1.5",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
						name: "chevron",
						size: 10,
						className: "ci-chevron"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "font-semibold",
						children: t("compactions.count", { count: points.length })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "font-mono tabular-nums",
						children: range
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "text-fg-dim",
						children: first?.replacedHistory === true ? t("turns.compactionReplaced") : t("turns.compactionContinued")
					})
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "m-0 list-none px-2.5 pb-1.5 text-fg-dim",
				children: points.map((point, order) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap gap-2 py-0.5",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "font-mono",
							children: formatShortTime(point.at)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "font-mono tabular-nums",
							children: t("compactions.range", {
								before: compactTokens(point.before.tokens),
								after: compactTokens(point.after.tokens)
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [point.replacedHistory ? t("turns.compactionReplaced") : t("turns.compactionContinued"), point.trigger === void 0 ? "" : ` · ${point.trigger}`] })
					]
				}, `${String(point.at)}-${String(order)}`))
			})]
		})
	});
}
/**
* Tooltip for one turn's price: model, cache hit rate, and whether it is a
* preview price.
* @param index - the turn index.
* @param cost - that turn's priced line.
*/
function costTip(index, cost) {
	const rate = cost.cacheHitRate === null ? "—" : `${String(Math.round(cost.cacheHitRate * 100))}%`;
	const line = t("cost.turnTip", {
		index,
		model: cost.model ?? "—",
		rate
	});
	return cost.provisional === true ? `${line} · ${t("cost.provisional")}` : line;
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
	const layout = barLayout(turn.attribution);
	const unknown = layout.residual > 0 ? formatShare(layout.residual, layout.denominator) : void 0;
	const tools = turn.toolCalls.length;
	const summary = `${t("turns.selected", { index: turn.index })}: ${compactTokens(turn.attribution.total.tokens)}`;
	const ask = turn.userInput.join(" ").trim();
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
				if (event.key === "ArrowDown") onKeyNav(event, 1);
				else if (event.key === "ArrowUp") onKeyNav(event, -1);
				else if (event.key === "Home") onKeyNav(event, "first");
				else if (event.key === "End") onKeyNav(event, "last");
				else if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onSelect(turn.index);
				}
			},
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "grid grid-cols-[22px_minmax(0,1fr)_64px] items-center gap-x-2 gap-y-1.5",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] text-fg-3 tabular-nums",
						children: turn.index
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ask === "" ? "min-w-0 truncate text-[12.5px] text-fg-3" : "min-w-0 truncate text-[12.5px]",
						children: ask === "" ? t("turns.noInput") : ask
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "text-end text-[12.5px] font-semibold tabular-nums",
						children: compactTokens(turn.attribution.total.tokens)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { "aria-hidden": "true" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StackedBar, {
						attribution: turn.attribution,
						label: summary,
						dense: true
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { "aria-hidden": "true" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { "aria-hidden": "true" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "grid grid-cols-[var(--ci-time-w)_36px_44px_minmax(0,1fr)] items-center gap-x-1.5 text-[10.5px] text-fg-dim tabular-nums",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatShortTime(turn.startedAt) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "inline-flex items-center gap-0.5",
								title: t("turns.tools"),
								children: tools === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
									name: "tool",
									size: 11
								}), tools] })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "font-mono",
								title: turn.attribution.reconciled === void 0 ? void 0 : t("turns.reconciled", { factor: turn.attribution.reconciled.factor.toFixed(3) }),
								children: turn.attribution.reconciled === void 0 ? "" : `×${turn.attribution.reconciled.factor.toFixed(2)}`
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "flex min-w-0 items-center gap-1.5",
								children: [turn.subagents.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "inline-flex items-center gap-0.5",
									title: t("turns.subagents"),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
										name: "branch",
										size: 11
									}), turn.subagents.length]
								}), unknown === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Chip, {
									tone: "warn",
									title: t("turns.unknownNote"),
									children: [
										t("turns.unknown"),
										" ",
										unknown
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "relative text-end font-mono text-[10.5px] text-fg-dim tabular-nums",
						"data-tip": cost === void 0 || cost.usd === null ? void 0 : costTip(turn.index, cost),
						tabIndex: cost === void 0 || cost.usd === null ? void 0 : 0,
						children: cost === void 0 || cost.usd === null ? "" : (cost.provisional === true ? "~" : "") + formatUsd(cost.usd)
					})
				]
			})
		})
	});
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
	const rows = buildTurnRows(turns);
	const timeWidth = turns.some((turn) => formatShortTime(turn.startedAt).length > 5) ? "72px" : "34px";
	function move(event, delta) {
		event.preventDefault();
		const list = event.currentTarget.closest("ul");
		if (list === null) return;
		const rows = [...list.querySelectorAll("[data-turn-row]")];
		const current = rows.indexOf(event.currentTarget);
		if (current < 0) return;
		rows[delta === "first" ? 0 : delta === "last" ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, current + delta))]?.focus();
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
		className: "m-0 flex list-none flex-col gap-0.5 p-1.5",
		role: "list",
		"aria-label": t("turns.title"),
		style: { ["--ci-time-w"]: timeWidth },
		children: rows.map((row) => {
			if (row.kind === "compactions") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompactionsRow, {
				points: row.points,
				turn: row.turn
			}, row.key);
			const cost = costs?.get(row.turn.index);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TurnRow, {
				turn: row.turn,
				selected: selected === row.turn.index,
				onSelect,
				onKeyNav: move,
				...cost === void 0 ? {} : { cost }
			}, row.key);
		})
	});
}
//#endregion
//#region src/client/ui/waterfall.tsx
/** viewBox of the chart; CSS scales it to the box. */
const WIDTH = 1e3;
const HEIGHT = 100;
/**
* @param props.turns - the turns loaded so far, in order.
* @param props.selected - turn index to mark, if any.
* @param props.onSelect - open one turn.
* @returns the chart, or null when there is nothing to plot.
*/
function Waterfall({ turns, selected, onSelect }) {
	if (turns.length === 0) return null;
	const values = turns.map((turn) => Math.max(0, turn.attribution.total.tokens));
	const peak = Math.max(1, ...values);
	/** Horizontal position, 0..1. */
	const xOf = (index) => turns.length === 1 ? .5 : index / (turns.length - 1);
	/** Vertical position from the top, 0..1. */
	const yOf = (value) => 1 - value / peak * .88;
	const line = values.map((value, index) => `${index === 0 ? "M" : "L"}${(xOf(index) * WIDTH).toFixed(1)},${(yOf(value) * HEIGHT).toFixed(1)}`).join(" ");
	const area = `${line} L${(xOf(turns.length - 1) * WIDTH).toFixed(1)},${HEIGHT} L${(xOf(0) * WIDTH).toFixed(1)},${HEIGHT} Z`;
	const compactions = turns.flatMap((turn, index) => turn.compactions.map((point) => ({
		index,
		point
	})));
	const marked = selected === null ? -1 : turns.findIndex((turn) => turn.index === selected);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
		className: "m-0 px-3.5 pt-3 pb-3",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figcaption", {
			className: "flex items-baseline gap-2 text-[11px] text-fg-dim",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "text-[12px] font-semibold text-fg",
					children: t("waterfall.title")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "tabular-nums",
					children: t("waterfall.peak", { tokens: compactTokens(peak) })
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "ms-auto truncate text-fg-3",
					children: t("waterfall.hint")
				})
			]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "relative mt-2.5 h-24",
			role: "group",
			"aria-label": `${t("waterfall.title")} — ${t("waterfall.caption")}`,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "absolute inset-0 block h-full w-full overflow-visible",
				viewBox: `0 0 ${String(WIDTH)} ${String(HEIGHT)}`,
				preserveAspectRatio: "none",
				"aria-hidden": "true",
				children: [
					[
						.25,
						.5,
						.75
					].map((level) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						className: "stroke-line-soft [vector-effect:non-scaling-stroke]",
						x1: 0,
						x2: WIDTH,
						y1: level * HEIGHT,
						y2: level * HEIGHT
					}, level)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						className: "fill-accent opacity-[0.14]",
						d: area
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						className: "fill-none stroke-accent stroke-[1.6] [stroke-linejoin:round] [vector-effect:non-scaling-stroke]",
						d: line
					}),
					compactions.map(({ index, point }, order) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						className: "stroke-warn stroke-1 opacity-80 [stroke-dasharray:3_3] [vector-effect:non-scaling-stroke]",
						x1: xOf(index) * WIDTH,
						x2: xOf(index) * WIDTH,
						y1: 0,
						y2: HEIGHT,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: `${t("turns.compaction")}: ${compactTokens(point.before.tokens)} → ${compactTokens(point.after.tokens)}` })
					}, `${String(index)}-${String(order)}`)),
					marked < 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						className: "stroke-fg-dim stroke-1 opacity-50 [vector-effect:non-scaling-stroke]",
						x1: xOf(marked) * WIDTH,
						x2: xOf(marked) * WIDTH,
						y1: 0,
						y2: HEIGHT
					})
				]
			}), turns.map((turn, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "ci-dot",
				"data-selected": index === marked,
				style: {
					left: `${(xOf(index) * 100).toFixed(2)}%`,
					top: `${(yOf(values[index] ?? 0) * 100).toFixed(2)}%`
				},
				title: `${t("turns.selected", { index: turn.index })} · ${compactTokens(turn.attribution.total.tokens)}`,
				"aria-label": `${t("turns.selected", { index: turn.index })} · ${compactTokens(turn.attribution.total.tokens)}`,
				onClick: () => onSelect(turn.index)
			}, turn.index))]
		})]
	});
}
//#endregion
//#region src/client/ui/session-pane.tsx
/**
* The loaded session: header on top, the turn strip and the open turn below.
* @param props.session - the loaded page(s) of one session.
* @param props.title - accessible name for the article.
* @returns the pane body.
*/
function SessionPane({ session, title, cost, costs, selectedTurn, onSelectTurn, toolsExpanded, onToggleTools, onLoadMore, onHandoff, onOpenSession, onJumpTurn, revealTurns = false }) {
	const id = (0, react.useId)();
	const sessionKey = `${session.data.session.source}:${session.data.session.id}`;
	const [view, setView] = (0, react.useState)({
		sessionKey,
		selectedTurn,
		tab: revealTurns ? "turns" : "overview"
	});
	let tab = view.tab;
	if (view.sessionKey !== sessionKey) {
		tab = "overview";
		setView({
			sessionKey,
			selectedTurn,
			tab
		});
	} else if (view.selectedTurn !== selectedTurn) {
		if (view.selectedTurn !== null && selectedTurn !== null) tab = "turns";
		setView({
			sessionKey,
			selectedTurn,
			tab
		});
	}
	const jump = (index) => {
		setView({
			sessionKey,
			selectedTurn,
			tab: "turns"
		});
		if (onJumpTurn !== void 0) onJumpTurn(index);
		else onSelectTurn(index);
	};
	const currentTurn = session.turns.find((turn) => turn.index === selectedTurn);
	const tabs = [
		"overview",
		"turns",
		"skills"
	];
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
		className: "flex h-full min-h-0 flex-col overflow-y-auto @3xl:overflow-hidden",
		"aria-label": title,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionHead, {
				onOpenSession,
				data: session.data,
				turns: session.turns,
				cost,
				onHandoff
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				role: "tablist",
				"aria-label": insightLabel("insights.tabs"),
				className: "flex shrink-0 gap-2 overflow-x-auto border-b border-line-soft px-5 py-2",
				children: tabs.map((name, position) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					id: `${id}-${name}`,
					type: "button",
					role: "tab",
					"aria-selected": tab === name,
					"aria-controls": `${id}-content`,
					tabIndex: tab === name ? 0 : -1,
					className: tab === name ? "ci-btn min-h-10 bg-bg-2 text-accent active:bg-bg-3" : "ci-btn min-h-10 active:bg-bg-3",
					onClick: () => setView({
						sessionKey,
						selectedTurn,
						tab: name
					}),
					onKeyDown: (event) => {
						const next = event.key === "ArrowRight" ? (position + 1) % tabs.length : event.key === "ArrowLeft" ? (position + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : void 0;
						if (next === void 0) return;
						event.preventDefault();
						setView({
							sessionKey,
							selectedTurn,
							tab: tabs[next]
						});
						(event.currentTarget.parentElement?.querySelectorAll("[role=\"tab\"]")[next])?.focus();
					},
					children: insightLabel(`insights.${name}`)
				}, name))
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				id: `${id}-content`,
				role: "tabpanel",
				"aria-labelledby": `${id}-${tab}`,
				tabIndex: 0,
				className: "ci-scroll flex min-h-0 min-w-0 flex-1 flex-col @3xl:overflow-y-auto",
				children: tab === "overview" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionOverview, {
					insights: session.data.insights,
					overview: sessionOverviewState({
						insights: session.data.insights,
						turns: session.turns,
						turnCount: session.data.turnCount,
						cost
					}),
					onJumpTurn: jump,
					onLoadMore,
					loadingMore: session.loadingMore,
					pagingFailure: session.moreFailure === void 0 ? void 0 : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Notice, { children: failureText(session.moreFailure) })
				}) : tab === "skills" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillUsage, {
					skills: session.data.insights?.skills ?? skillsOfTurns(session.turns, session.data.session.workdir),
					onJumpTurn: jump,
					loadedTurns: session.data.insights === void 0 ? session.turns.length : void 0,
					totalTurns: session.data.turnCount,
					onLoadMore,
					loadingMore: session.loadingMore
				}, sessionKey) : session.turns.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyBlock, {
					title: t("session.noTurns"),
					hint: t("session.noTurnsHint"),
					center: true
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex flex-col @3xl:grid @3xl:min-h-0 @3xl:flex-1 @3xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 flex-col border-line-soft @3xl:min-h-0 @3xl:border-e",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "shrink-0 border-b border-line-soft",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Waterfall, {
									turns: session.turns,
									selected: selectedTurn,
									onSelect: onSelectTurn
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ci-scroll @3xl:min-h-0 @3xl:flex-1 @3xl:overflow-y-auto @3xl:overscroll-contain",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TurnList, {
									turns: session.turns,
									selected: selectedTurn,
									onSelect: onSelectTurn,
									costs
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
								className: "flex shrink-0 items-center justify-between gap-2 border-t border-line-soft px-3.5 py-2 text-[11px] text-fg-dim",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "tabular-nums",
									children: t("session.paging", {
										from: session.turns.length === 0 ? 0 : 1,
										to: session.turns.length,
										total: session.data.turnCount
									})
								}), session.turns.length < session.data.turnCount ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "ci-btn",
									onClick: onLoadMore,
									disabled: session.loadingMore,
									children: session.loadingMore ? t("session.loadingMore") : t("session.loadMore")
								}) : null]
							}),
							session.moreFailure === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "px-3 pb-3",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Notice, { children: failureText(session.moreFailure) })
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ci-scroll min-w-0 border-t border-line-soft @3xl:min-h-0 @3xl:overflow-y-auto @3xl:overscroll-contain @3xl:border-t-0",
						children: currentTurn === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyBlock, {
							title: t("turns.hint"),
							center: true
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TurnDetail, {
							turn: currentTurn,
							segments: session.data.session.segments,
							expandedTools: toolsExpanded,
							onToggleTools
						})
					})]
				})
			})
		]
	});
}
//#endregion
//#region src/client/ui/toolbar.tsx
/**
* Human text for a source's unavailability reason.
* @param reason - the Host's reason tag.
* @returns the sentence, or the raw tag when it is unknown.
*/
function reasonText(reason) {
	if (reason === void 0) return void 0;
	if (reason === "root-missing") return t("sources.reason.root-missing");
	if (reason === "root-unreadable") return t("sources.reason.root-unreadable");
	if (reason === "adapter-error") return t("sources.reason.adapter-error");
	return reason;
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
			const mark = SOURCE_MARKS[entry.source];
			const tip = entry.available ? `${mark.label.zh} · ${t("sources.available")} · ${entry.root ?? ""}` : `${mark.label.zh} · ${t("sources.unavailable")} · ${entry.errorDetail ?? reasonText(entry.reason) ?? ""}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: entry.available ? "inline-flex h-6 items-center gap-1.5 rounded-full border border-line-soft bg-bg-1 ps-1.5 pe-2 text-[11px] whitespace-nowrap" : "inline-flex h-6 items-center gap-1.5 rounded-full border border-dashed border-line ps-1.5 pe-2 text-[11px] whitespace-nowrap opacity-60",
				title: tip,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {
						source: entry.source,
						size: 12
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "font-medium text-fg",
						children: mark.label.zh
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "text-fg-dim tabular-nums",
						children: entry.available ? String(entry.sessions ?? "—") : t("sources.unavailable")
					})
				]
			}, entry.source);
		})
	});
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
					size: 15
				})
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 items-center gap-2",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, { size: 24 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
					className: "m-0 text-[13.5px] font-semibold whitespace-nowrap",
					children: t("entry.label")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceStrip, { sources }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ms-auto flex min-w-0 items-center gap-1.5",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "ci-search w-[clamp(160px,28cqw,280px)]",
					onClick: onSearch,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
							name: "search",
							size: 13
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "flex-1 truncate",
							children: t("search.trigger")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Kbd, { children: "⌘K" })
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ci-icon-btn",
					onClick: onRefresh,
					"aria-label": t("panel.refresh"),
					title: t("panel.refresh"),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: busy ? "inline-grid motion-safe:animate-spin" : "inline-grid",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, {
							name: "refresh",
							size: 15
						})
					})
				})]
			})
		]
	});
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
	lineHeight: 1.55
};
/**
* The panel. Fetches on mount, then follows the workdir → session → turn
* selection; ⌘K opens the search palette over it.
* @returns the panel page.
*/
function ContextInsightPanel({ onOpenSession } = {}) {
	const api = (0, react.useMemo)(() => createApi(), []);
	const cache = clientListCache();
	const [boot, setBoot] = (0, react.useState)(() => cache.sources === void 0 || cache.workdirs === void 0 ? { kind: "loading" } : {
		kind: "ready",
		sources: cache.sources.sources,
		workdirs: cache.workdirs.workdirs,
		failures: cache.workdirs.failures
	});
	const [workdir, setWorkdir] = (0, react.useState)(() => cache.workdirs?.workdirs[0]?.workdir ?? null);
	const [selected, setSelected] = (0, react.useState)(null);
	const [pendingJump, setPendingJump] = (0, react.useState)(null);
	const [sessionList, setSessionList] = (0, react.useState)({ kind: "idle" });
	const { detail, cost, selectedTurn, setSelectedTurn, toolsExpanded, setToolsExpanded, loadMore, jumpTurn, overlaySession, onMetadataChanged: updateDetailMetadata } = useSessionDetail(api, selected);
	const [reloadToken, setReloadToken] = (0, react.useState)(0);
	const [listRevision, setListRevision] = (0, react.useState)(0);
	const [searchOpen, setSearchOpen] = (0, react.useState)(false);
	const [refreshing, setRefreshing] = (0, react.useState)(false);
	const [handoffFor, setHandoffFor] = (0, react.useState)(null);
	const [sidebarOpen, setSidebarOpen] = (0, react.useState)(true);
	const [reading, setReading] = (0, react.useState)(true);
	(0, react.useEffect)(() => {
		function onKey(event) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setSearchOpen((open) => !open);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	(0, react.useEffect)(() => {
		const controller = new AbortController();
		setBoot((current) => current.kind === "ready" ? current : { kind: "loading" });
		setReading(true);
		const refresh = reloadToken > 0;
		let timer;
		const read = (forced) => {
			(forced ? api.workdirs(controller.signal, true).then(async (workdirs) => [await api.sources(controller.signal), workdirs]) : Promise.all([api.sources(controller.signal), api.workdirs(controller.signal)])).then(([sources, workdirs]) => {
				if (controller.signal.aborted) return;
				setReading(false);
				if (!sources.ok) {
					if (sources.error === "aborted" || cache.workdirs !== void 0 && cache.sources !== void 0) return;
					setBoot({
						kind: "failed",
						error: sources.error,
						...sources.detail === void 0 ? {} : { detail: sources.detail }
					});
					return;
				}
				if (!workdirs.ok) {
					if (workdirs.error === "aborted" || cache.workdirs !== void 0 && cache.sources !== void 0) return;
					setBoot({
						kind: "failed",
						error: workdirs.error,
						...workdirs.detail === void 0 ? {} : { detail: workdirs.detail }
					});
					return;
				}
				if (forced) setListRevision((current) => current + 1);
				setRefreshing(workdirs.value.refreshing === true);
				if (workdirs.value.refreshing) timer = setTimeout(() => read(false), 500);
				setBoot({
					kind: "ready",
					sources: sources.value.sources,
					workdirs: workdirs.value.workdirs,
					failures: workdirs.value.failures
				});
				setWorkdir((current) => {
					if (current !== null && workdirs.value.workdirs.some((row) => row.workdir === current)) return current;
					return workdirs.value.workdirs[0]?.workdir ?? null;
				});
			});
		};
		read(refresh);
		return () => {
			controller.abort();
			clearTimeout(timer);
			setRefreshing(false);
			setReading(false);
		};
	}, [
		api,
		reloadToken,
		cache
	]);
	(0, react.useEffect)(() => {
		if (workdir === null) {
			setSessionList({ kind: "idle" });
			return;
		}
		const controller = new AbortController();
		const cached = cache.sessions.get(workdir);
		setSessionList(cached === void 0 ? {
			kind: "loading",
			workdir
		} : {
			kind: "ready",
			workdir,
			sessions: cached.sessions,
			failures: cached.failures
		});
		let timer;
		const read = () => {
			api.sessions(workdir, controller.signal).then((result) => {
				if (controller.signal.aborted) return;
				if (!result.ok) {
					if (result.error === "aborted" || cached !== void 0) return;
					setSessionList({
						kind: "failed",
						workdir,
						failure: result
					});
					return;
				}
				setSessionList({
					kind: "ready",
					workdir,
					sessions: result.value.sessions.map(overlaySession),
					failures: result.value.failures
				});
				if (result.value.refreshing) timer = setTimeout(read, 500);
				setSelected((current) => {
					const rows = result.value.sessions;
					if (pendingJump !== null && rows.some((row) => row.id === pendingJump.ref.id && row.source === pendingJump.ref.source)) return pendingJump.ref;
					if (current !== null && rows.some((row) => row.id === current.id && row.source === current.source)) return current;
					const first = rows[0];
					return first === void 0 ? null : {
						source: first.source,
						id: first.id
					};
				});
			});
		};
		read();
		return () => {
			controller.abort();
			clearTimeout(timer);
		};
	}, [
		api,
		workdir,
		listRevision,
		pendingJump,
		cache,
		overlaySession
	]);
	const readyRef = detail.kind === "ready" ? detail.ref : null;
	(0, react.useEffect)(() => {
		if (pendingJump === null || readyRef === null || !sameSession(readyRef, pendingJump.ref)) return;
		let cancelled = false;
		jumpTurn(pendingJump.turn).then(() => {
			if (!cancelled) setPendingJump((current) => current === pendingJump ? null : current);
		});
		return () => {
			cancelled = true;
		};
	}, [
		pendingJump,
		readyRef,
		jumpTurn
	]);
	const onMetadataChanged = (0, react.useCallback)((value) => {
		updateDetailMetadata(value);
		setSessionList((current) => current.kind !== "ready" ? current : {
			...current,
			sessions: current.sessions.map((session) => applySessionMetadata$1(session, value))
		});
		cache.rename(value);
	}, [cache, updateDetailMetadata]);
	const jumpTo = (0, react.useCallback)((target) => {
		setSearchOpen(false);
		setWorkdir(target.workdir);
		setPendingJump({
			ref: {
				source: target.source,
				id: target.sessionId
			},
			turn: target.turnIndex
		});
		setSelected({
			source: target.source,
			id: target.sessionId
		});
	}, []);
	(0, react.useEffect)(() => {
		if (selectedTurn === null) return;
		document.querySelector(`.ci-panel [data-turn="${String(selectedTurn)}"] [data-turn-row]`)?.scrollIntoView({ block: "nearest" });
	}, [selectedTurn, detail.kind]);
	const retry = (0, react.useCallback)(() => {
		clientListCache().invalidateRequests();
		setReloadToken((token) => token + 1);
	}, []);
	const costs = (0, react.useMemo)(() => {
		if (cost === null) return void 0;
		const map = /* @__PURE__ */ new Map();
		for (const line of cost.turns) map.set(line.index, line);
		return map;
	}, [cost]);
	const sourceEntries = boot.kind === "ready" ? boot.sources : [];
	const anySource = sourceEntries.some((entry) => entry.available);
	const failures = [...boot.kind === "ready" ? boot.failures : [], ...sessionList.kind === "ready" ? sessionList.failures : []];
	const tree = boot.kind === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectTree, {
		onMetadataChanged,
		revision: listRevision,
		api,
		workdirs: boot.workdirs,
		selected,
		onSelect: (next) => {
			setSelected(next);
			setPendingJump(null);
			if (next.workdir !== void 0) setWorkdir(next.workdir);
		},
		onDeleted: (deleted) => {
			setSelected((current) => current?.source === deleted.source && current.id === deleted.id ? null : current);
			setPendingJump((current) => current?.ref.source === deleted.source && current.ref.id === deleted.id ? null : current);
			cache.remove(deleted);
			setBoot((current) => current.kind !== "ready" ? current : {
				...current,
				sources: cache.sources?.sources ?? current.sources,
				workdirs: cache.workdirs?.workdirs ?? current.workdirs
			});
			setSessionList((current) => current.kind !== "ready" ? current : {
				...current,
				sessions: current.sessions.filter((row) => row.source !== deleted.source || row.id !== deleted.id)
			});
		},
		loading: false
	}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeSkeleton, { label: t("tree.loadingIndex") });
	let pane = null;
	if (boot.kind === "loading") pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionSkeleton, { label: t("panel.loading") });
	else if (boot.kind === "failed") pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorBlock, {
		title: t("session.error", { detail: boot.detail ?? boot.error }),
		onRetry: retry
	});
	else if (boot.workdirs.length === 0) pane = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col items-center justify-center gap-3 p-6",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyBlock, {
			title: t("workdirs.empty"),
			hint: t("empty.noData"),
			center: true
		}), anySource ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Notice, { children: t("empty.noSources") })]
	});
	else if (detail.kind === "idle") pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyBlock, {
		title: t("sessions.pick"),
		hint: t("sessions.pickHint"),
		center: true
	});
	else if (detail.kind === "loading") pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionSkeleton, { label: t("session.loading") });
	else if (detail.kind === "failed") pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorBlock, {
		title: t("session.error", { detail: failureText(detail.failure) }),
		onRetry: () => {
			const ref = detail.ref;
			setSelected(null);
			window.setTimeout(() => setSelected(ref), 0);
		}
	});
	else pane = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionPane, {
		session: detail,
		revealTurns: pendingJump !== null,
		title: detail.data.session.title ?? detail.ref.id,
		cost,
		costs,
		selectedTurn,
		onSelectTurn: setSelectedTurn,
		onJumpTurn: (index) => {
			jumpTurn(index);
		},
		toolsExpanded,
		onToggleTools: setToolsExpanded,
		onLoadMore: loadMore,
		onOpenSession,
		onHandoff: () => setHandoffFor({
			source: detail.ref.source,
			id: detail.ref.id
		})
	}, `${detail.ref.source}:${detail.ref.id}`);
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
				onRefresh: retry
			}),
			failures.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "flex shrink-0 flex-col gap-1.5 border-b border-line-soft px-3 py-2",
				children: failures.map((problem) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Notice, { children: [
					problem.source,
					": ",
					problem.error
				] }, `${problem.source}-${problem.error}`))
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebarOpen ? "grid min-h-0 flex-1 grid-cols-[clamp(220px,30cqw,300px)_minmax(0,1fr)]" : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)]",
				children: [sidebarOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("aside", {
					className: "min-h-0 min-w-0 border-e border-line-soft bg-sidebar",
					children: tree
				}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
					className: "@container min-h-0 min-w-0",
					children: pane
				})]
			}),
			searchOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchPalette, {
				api,
				onClose: () => setSearchOpen(false),
				onOpenTurn: jumpTo
			}) : null,
			handoffFor === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HandoffDialog, {
				onOpenSession,
				api,
				source: handoffFor.source,
				id: handoffFor.id,
				onClose: () => setHandoffFor(null)
			})
		]
	});
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
const PANEL_ID = "sessions-insight";
/**
* Row order among the shell's global panel rows: the shipped Plugins row is 0
* and Schedule is 10, so this row renders after both.
*/
const PANEL_ORDER = 30;
/** Services this entry waits for before `apply` runs. */
const inject = [
	"slots",
	"locale",
	"uiWorkspace"
];
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
				strokeWidth: 1.12
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M9.6 9.6 13.12 13.12",
				strokeWidth: 1.28
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M5.12 4.48h3.2",
				strokeWidth: 1.12
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M5.12 6.72h2.24",
				strokeWidth: 1.12
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M5.12 8.96h1.28",
				strokeWidth: 1.12
			})
		]
	});
}
/**
* Mount the browser half.
* @param ctx - client root context (services: slots, locale).
*/
function apply(ctx) {
	if (globalThis.__dshContextInsightApplied === true) return;
	globalThis.__dshContextInsightApplied = true;
	if (typeof ctx.effect === "function") ctx.effect(() => () => {
		globalThis.__dshContextInsightApplied = void 0;
	}, "sessions-insight: apply claim");
	injectStyles();
	registerLocale(ctx, LOCALE_NS, {
		zh,
		en
	}, setRuntimeTranslate);
	const preload = new AbortController();
	const timer = setTimeout(() => {
		preloadSessionLists(createApi(), preload.signal).catch(() => void 0);
	}, 0);
	ctx.effect?.(() => () => {
		clearTimeout(timer);
		preload.abort();
	}, "sessions-insight: preload lists");
	try {
		registerPanel(ctx, {
			id: PANEL_ID,
			order: PANEL_ORDER,
			locale: LOCALE_NS,
			label: () => t("entry.label"),
			icon: ContextInsightPanelIcon,
			panel: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextInsightPanel, { onOpenSession: async (id) => {
				const workspace = ctx.get?.("uiWorkspace");
				if (typeof workspace?.openSession !== "function") throw new Error("uiWorkspace.openSession unavailable");
				const sessionId = id.startsWith("session-") ? id : `session-${id}`;
				const revealed = await createApi().handoffReveal(sessionId);
				if (!revealed.ok) throw new Error(revealed.detail ?? revealed.error);
				await workspace.openSession(sessionId);
			} })
		});
	} catch (error) {
		console.warn("[sessions-insight] panel registration failed", error);
	}
}
//#endregion
exports.ContextInsightPanelIcon = ContextInsightPanelIcon;
exports.PANEL_ID = PANEL_ID;
exports.apply = apply;
exports.inject = inject;


		return module.exports;
	}
});

//# sourceMappingURL=client.js.map