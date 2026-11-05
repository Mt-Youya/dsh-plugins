window.__ModuleLoader__.load({
  id: "@cyrusdoyle/dsh-sessions-insight",
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports

    Object.defineProperty(exports, Symbol.toStringTag, { value: `Module` })
    const e = Object.create,
      t = Object.defineProperty,
      n = Object.getOwnPropertyDescriptor,
      r = Object.getOwnPropertyNames,
      i = Object.getPrototypeOf,
      a = Object.prototype.hasOwnProperty,
      o = (e, t) => () => (t || (e((t = { exports: {} }).exports, t, t.exports), (e = null)), t.exports),
      s = (e, i, o, s) => {
        if ((i && typeof i == `object`) || typeof i == `function`)
          for (var c = r(i), l = 0, u = c.length, d; l < u; l++)
            ((d = c[l]),
              !a.call(e, d) &&
                d !== o &&
                t(e, d, { get: ((e) => i[e]).bind(null, d), enumerable: !(s = n(i, d)) || s.enumerable }))
        return e
      },
      c = (n, r, o) => (
        (o = n == null ? {} : e(i(n))),
        s(r || !n || !n.__esModule || !a.call(n, `default`) ? t(o, `default`, { value: n, enumerable: !0 }) : o, n)
      )
    let l = require("react")
    l = c(l, 1)
    let u = require("react/jsx-runtime"),
      d = require("react-dom")
    d = c(d, 1)
    function f(e) {
      return typeof e == `object` && !!e && !Array.isArray(e)
    }
    function p(e, t, n, r) {
      if (!f(e)) return { ok: !1, error: r, detail: `envelope-not-an-object` }
      if (e.ok === !0) return t(e.value) ? { ok: !0, value: e.value } : { ok: !1, error: r, detail: `payload-shape` }
      if (e.ok === !1) {
        const t = typeof e.error == `string` ? e.error : r,
          i = n.includes(t) ? t : r,
          a = typeof e.detail == `string` ? e.detail : void 0
        return a === void 0 ? { ok: !1, error: i } : { ok: !1, error: i, detail: a }
      }
      return { ok: !1, error: r, detail: `envelope-without-ok` }
    }
    function m(e) {
      return e.replace(/^\/+/, ``)
    }
    async function h(e) {
      let t = e.method ?? `GET`,
        n
      try {
        n = await fetch(e.url, {
          method: t,
          signal: e.signal ?? null,
          credentials: `same-origin`,
          headers:
            t === `POST`
              ? { accept: `application/json`, "content-type": `application/json` }
              : { accept: `application/json` },
          ...(e.body === void 0 ? {} : { body: JSON.stringify(e.body) }),
        })
      } catch (e) {
        return e instanceof DOMException && e.name === `AbortError`
          ? { ok: !1, error: `aborted` }
          : { ok: !1, error: `network` }
      }
      let r
      try {
        r = await n.json()
      } catch {
        return { ok: !1, error: `parse-failed`, detail: `not-json`, status: n.status }
      }
      const i = p(r, e.guard, e.codes, e.fallback ?? `parse-failed`)
      return i.ok
        ? { ok: !0, value: i.value }
        : { ok: !1, error: i.error, status: n.status, ...(i.detail === void 0 ? {} : { detail: i.detail }) }
    }
    const g = { list: `sidebar.panellist`, main: `main` }
    function _(e, t) {
      const n = e.slots,
        r = t.seats ?? g,
        i = []
      return (
        i.push(
          n.inject(r.list, () =>
            n.register({ name: r.list, id: t.id, order: t.order, locale: t.locale, label: t.label }, t.icon),
          ),
        ),
        i.push(n.inject(r.main, () => n.register({ name: r.main, key: t.id, locale: t.locale }, t.panel))),
        () => {
          for (const e of i.splice(0)) e()
        }
      )
    }
    function v(e, t, n, r) {
      try {
        ;(e.locale.register(t, n), r(e.locale.bind(t)))
      } catch {}
    }
    function y(e, t) {
      if (typeof document > `u`) return
      const n = document.getElementById(e)
      if (n !== null) {
        n.textContent !== t && (n.textContent = t)
        return
      }
      const r = document.createElement(`style`)
      ;((r.id = e), (r.textContent = t), document.head.append(r))
    }
    const b = `/api/dsh-sessions-insight`,
      x = `${b}/health`,
      S = `${b}/sources`,
      C = `${b}/workdirs`,
      w = `${b}/sessions`,
      T = `${b}/session`,
      E = `${b}/search`,
      D = `${b}/handoff/prepare`,
      O = `${b}/handoff/apply`,
      k = `${b}/handoff/status`,
      A = `${b}/cost`
    m(x)
    const j = m(S),
      M = m(C),
      N = m(w),
      P = m(T),
      F = m(E),
      I = m(D),
      L = m(O),
      R = m(k),
      z = m(A),
      B = m(`${b}/session/delete`),
      ee = m(`${b}/handoff/reveal`),
      V = m(`${b}/session/metadata`)
    function H(e, t) {
      return typeof e == `object` && !!e && !Array.isArray(e) && Object.keys(e).every((e) => t.includes(e))
    }
    function U(e) {
      return typeof e == `string` && e.trim().length > 0 && e.length <= 80
    }
    function te(e) {
      return Ee(e)
    }
    function ne(e) {
      return (
        H(e, [`source`, `id`, `title`, `group`]) &&
        te(e) &&
        (!(`title` in e) || U(e.title)) &&
        (!(`group` in e) || U(e.group))
      )
    }
    function W(e) {
      if (!H(e, [`entries`]) || !Array.isArray(e.entries)) return !1
      const t = /* @__PURE__ */ new Set()
      for (const n of e.entries) {
        if (!ne(n)) return !1
        const e = `${n.source}:${n.id}`
        if (t.has(e)) return !1
        t.add(e)
      }
      return !0
    }
    function re(e) {
      return (
        H(e, [`metadata`, `displayTitle`]) &&
        ne(e.metadata) &&
        (!(`displayTitle` in e) || typeof e.displayTitle == `string`)
      )
    }
    const G = [`claude`, `dsh`, `codex`],
      ie = [
        `bad-request`,
        `method-not-allowed`,
        `forbidden`,
        `not-found`,
        `read-limit`,
        `parse-failed`,
        `source-unavailable`,
        `handoff-unavailable`,
      ]
    function K(e) {
      return typeof e == `object` && !!e && !Array.isArray(e)
    }
    function q(e) {
      return typeof e == `number` && Number.isFinite(e)
    }
    function ae(e) {
      return Array.isArray(e) && e.every((e) => typeof e == `string`)
    }
    const oe = /* @__PURE__ */ new Set([`exact`, `estimate`]),
      se = /* @__PURE__ */ new Set([`usage`, `harness-projection`, `chars-per-token`, `byte-length`, `unattributed`]),
      ce = /* @__PURE__ */ new Set([
        `system-prompt`,
        `tool-definitions`,
        `memory-instructions`,
        `referenced-files`,
        `history`,
        `tool-results`,
        `images`,
        `user-input`,
        `assistant-output`,
        `thinking`,
      ])
    function le(e) {
      if (!K(e)) return !1
      const { tokens: t, precision: n, basis: r } = e
      return typeof t == `number` && Number.isFinite(t) && oe.has(n) && se.has(r)
    }
    function ue(e) {
      if (
        !K(e) ||
        !le(e.total) ||
        (e.windowSize !== void 0 && (typeof e.windowSize != `number` || !Number.isFinite(e.windowSize)))
      )
        return !1
      const t = e.parts
      if (!Array.isArray(t)) return !1
      for (const e of t) if (!K(e) || !ce.has(e.part) || !le(e.measure)) return !1
      if (e.residual !== void 0 && !le(e.residual)) return !1
      if (e.reconciled !== void 0) {
        if (!K(e.reconciled)) return !1
        const t = e.reconciled.factor
        if (typeof t != `number` || !Number.isFinite(t) || t <= 0) return !1
      }
      return !0
    }
    function J(e) {
      if (!K(e) || !G.includes(e.source) || typeof e.sessionId != `string`) return !1
      const t = e.pricing
      if (!K(t) || typeof t.version != `string` || typeof t.asOf != `string`) return !1
      const n = e.totals
      return !K(n) ||
        (n.usd !== null && !q(n.usd)) ||
        !q(n.pricedTurns) ||
        !q(n.unpricedTurns) ||
        !Array.isArray(e.unpricedModels) ||
        !ae(e.unpricedModels) ||
        !Array.isArray(e.provisionalModels) ||
        !ae(e.provisionalModels) ||
        typeof e.provisional != `boolean` ||
        (e.partial !== void 0 && typeof e.partial != `boolean`) ||
        (e.unlistedChannels !== void 0 && !ae(e.unlistedChannels)) ||
        !Array.isArray(e.turns) ||
        !e.turns.every((e) => K(e) && q(e.index) && typeof e.priced == `boolean` && (e.usd === null || q(e.usd))) ||
        (e.tableId !== void 0 && e.tableId !== null && typeof e.tableId != `string`)
        ? !1
        : e.tables === void 0
          ? !0
          : K(e.tables)
            ? Object.values(e.tables).every(
                (e) =>
                  K(e) &&
                  typeof e.id == `string` &&
                  K(e.byCurrency) &&
                  typeof e.partial == `boolean` &&
                  Array.isArray(e.turns),
              )
            : !1
    }
    function de(e) {
      return e.length === 0 || e.length > 128 || !/^[A-Za-z0-9._-]+$/.test(e) ? !1 : e !== `.` && e !== `..`
    }
    function fe(e) {
      return !K(e) || !Array.isArray(e.sources)
        ? !1
        : e.sources.every(
            (e) =>
              !(
                !K(e) ||
                !G.includes(e.source) ||
                typeof e.available != `boolean` ||
                (e.reason !== void 0 && typeof e.reason != `string`) ||
                (e.root !== void 0 && typeof e.root != `string`)
              ),
          )
    }
    function pe(e) {
      return e === `claude` || e === `dsh` || e === `codex`
    }
    function me(e) {
      return !K(e) ||
        !G.includes(e.source) ||
        typeof e.sessionId != `string` ||
        typeof e.workdir != `string` ||
        typeof e.brief != `string` ||
        typeof e.defaultCwd != `string` ||
        !q(e.chars) ||
        !q(e.turns) ||
        !Array.isArray(e.sections)
        ? !1
        : e.sections.every((e) => K(e) && typeof e.title == `string` && ae(e.lines) && typeof e.empty == `boolean`)
    }
    function he(e) {
      return K(e) ? typeof e.sessionId == `string` && e.state === `delivered` && q(e.pollAfterMs) : !1
    }
    function ge(e) {
      if (
        !K(e) ||
        typeof e.sessionId != `string` ||
        (e.state !== `delivered` && e.state !== `running` && e.state !== `succeeded` && e.state !== `failed`) ||
        !q(e.elapsedMs)
      )
        return !1
      if (e.progress !== void 0) {
        const t = e.progress
        if (
          !K(t) ||
          !q(t.seq) ||
          !q(t.updatedAt) ||
          !q(t.toolsCompleted) ||
          (t.tool !== void 0 && typeof t.tool != `string`)
        )
          return !1
      }
      return !(
        (e.reason !== void 0 && typeof e.reason != `string`) ||
        (e.detail !== void 0 && typeof e.detail != `string`) ||
        (e.seq !== void 0 && !q(e.seq))
      )
    }
    function _e(e) {
      return K(e) && typeof e.sessionId == `string` && de(e.sessionId)
    }
    function ve(e) {
      return !(
        !K(e) ||
        !G.includes(e.source) ||
        typeof e.sessionId != `string` ||
        typeof e.workdir != `string` ||
        !q(e.turnIndex) ||
        !q(e.at) ||
        (e.field !== `user` && e.field !== `assistant` && e.field !== `tool` && e.field !== `metadata`) ||
        (e.tier !== `fast` && e.tier !== `deep`) ||
        typeof e.snippet != `string` ||
        (e.title !== void 0 && typeof e.title != `string`) ||
        (e.firstInput !== void 0 && typeof e.firstInput != `string`)
      )
    }
    function ye(e) {
      return !K(e) ||
        typeof e.query != `string` ||
        !q(e.scanned) ||
        !q(e.remaining) ||
        !q(e.elapsedMs) ||
        typeof e.truncated != `boolean` ||
        !Array.isArray(e.hits) ||
        !e.hits.every(ve) ||
        !Array.isArray(e.failures)
        ? !1
        : e.failures.every((e) => K(e) && G.includes(e.source) && typeof e.error == `string`)
    }
    function be(e) {
      return K(e) ? q(e.input) && q(e.cacheRead) && q(e.cacheWrite) && q(e.output) && q(e.totalContext) : !1
    }
    function xe(e) {
      return K(e) ? q(e.at) && le(e.before) && le(e.after) && typeof e.replacedHistory == `boolean` : !1
    }
    function Se(e) {
      return !(
        !K(e) ||
        !q(e.index) ||
        !q(e.startedAt) ||
        !ae(e.userInput) ||
        !ae(e.assistantText) ||
        !ae(e.subagents) ||
        !ue(e.attribution) ||
        !Array.isArray(e.toolCalls) ||
        !Array.isArray(e.compactions) ||
        !e.compactions.every(xe) ||
        (e.usage !== void 0 && !be(e.usage))
      )
    }
    function Ce(e) {
      if (!K(e) || !q(e.turnCount) || !q(e.offset) || !q(e.limit)) return !1
      const t = e.meta
      if (!K(t) || typeof t.cached != `boolean` || !q(t.elapsedMs) || !q(t.bytes)) return !1
      const n = e.session
      return !(
        !K(n) ||
        typeof n.id != `string` ||
        typeof n.workdir != `string` ||
        !G.includes(n.source) ||
        !q(n.createdAt) ||
        !q(n.updatedAt) ||
        !ae(n.dataQuality) ||
        !Array.isArray(n.segments) ||
        !Array.isArray(n.turns) ||
        !n.turns.every(Se)
      )
    }
    function we(e) {
      return !K(e) || !q(e.scannedAt) || !Array.isArray(e.workdirs)
        ? !1
        : e.workdirs.every((e) =>
            !K(e) || typeof e.workdir != `string` || !q(e.sessions) || !q(e.lastUpdatedAt) || !Array.isArray(e.sources)
              ? !1
              : e.sources.every((e) => K(e) && G.includes(e.source) && q(e.sessions) && q(e.lastUpdatedAt)),
          )
    }
    function Te(e) {
      return !K(e) || typeof e.workdir != `string` || !Array.isArray(e.sessions)
        ? !1
        : e.sessions.every(
            (e) =>
              !(
                !K(e) ||
                typeof e.id != `string` ||
                typeof e.workdir != `string` ||
                !G.includes(e.source) ||
                !q(e.updatedAt) ||
                !q(e.bytes) ||
                !ae(e.dataQuality) ||
                (e.title !== void 0 && typeof e.title != `string`)
              ),
          )
    }
    function Ee(e) {
      return K(e) && pe(e.source) && typeof e.id == `string` && de(e.id)
    }
    function De(e) {
      return Ce(e) && (!(`insights` in e) || He(e.insights))
    }
    function Oe(e) {
      return typeof e == `object` && !!e && !Array.isArray(e)
    }
    function ke(e) {
      return typeof e == `number` && Number.isFinite(e) && e >= 0
    }
    function Ae(e) {
      return ke(e) && Number.isInteger(e)
    }
    function je(e) {
      return Ae(e) && e > 0
    }
    function Me(e) {
      return e === void 0 || (ke(e) && e > 0)
    }
    function Ne(e) {
      return e === void 0 || (typeof e == `string` && e.length > 0)
    }
    function Pe(e) {
      return e === null || ke(e)
    }
    function Fe(e) {
      return (
        Oe(e) &&
        je(e.turnIndex) &&
        typeof e.toolCallId == `string` &&
        e.toolCallId.length > 0 &&
        (e.kind === `skill-tool` ||
          e.kind === `skill-file` ||
          ((e.kind === `skill-reference` || e.kind === `skill-injection`) &&
            RegExp(`^event:${e.kind}:${e.turnIndex}:[1-9][0-9]*$`).test(e.toolCallId) &&
            typeof e.path == `string` &&
            e.path.endsWith(`/SKILL.md`) &&
            !/[\r\n\0]/.test(e.path) &&
            (!/^[a-z][\w+.-]*:/i.test(e.path) || /^[A-Za-z]:\//.test(e.path)) &&
            e.path.split(`/`).at(-2) === e.name)) &&
        typeof e.name == `string` &&
        e.name.length > 0 &&
        Ne(e.path) &&
        Me(e.time)
      )
    }
    function Ie(e) {
      if (
        !Oe(e) ||
        typeof e.id != `string` ||
        e.id.length === 0 ||
        typeof e.name != `string` ||
        e.name.length === 0 ||
        !Ne(e.path) ||
        !je(e.count) ||
        !je(e.lastTurnIndex) ||
        !Me(e.lastTime) ||
        !Array.isArray(e.evidence) ||
        !e.evidence.every(Fe)
      )
        return !1
      const t = e.evidence.reduce((e, t) => Math.max(e, t.turnIndex), 0),
        n = e.evidence.reduce((e, t) => (t.time === void 0 ? e : Math.max(e ?? t.time, t.time)), void 0)
      return (
        e.id === (e.path === void 0 ? `name:${e.name}` : `path:${e.path}`) &&
        e.count === e.evidence.length &&
        e.evidence.every((t) => t.name === e.name && t.path === e.path) &&
        e.lastTurnIndex === t &&
        e.lastTime === n &&
        new Set(e.evidence.map((e) => e.toolCallId)).size === e.count
      )
    }
    function Le(e) {
      if (!Oe(e) || !Ae(e.coveredTurns) || !Ae(e.missingTurns)) return !1
      const t = [e.input, e.cacheRead, e.cacheWrite, e.output]
      return e.coveredTurns === 0 ? t.every((e) => e === null) : t.every(ke)
    }
    function Re(e) {
      return Oe(e)
        ? Pe(e.spanMs) &&
            Me(e.startedAt) &&
            Me(e.endedAt) &&
            Pe(e.completedTurnMs) &&
            Ae(e.completedTurns) &&
            Ae(e.missingTurnDurations) &&
            Pe(e.toolUnionMs) &&
            Ae(e.timedToolCalls) &&
            Ae(e.missingToolDurations) &&
            (e.completedTurns === 0 ? e.completedTurnMs === null : ke(e.completedTurnMs)) &&
            (e.timedToolCalls === 0 ? e.toolUnionMs === null : ke(e.toolUnionMs)) &&
            (e.spanMs === null
              ? e.startedAt === void 0 && e.endedAt === void 0
              : ke(e.startedAt) && ke(e.endedAt) && e.endedAt - e.startedAt === e.spanMs)
        : !1
    }
    function ze(e) {
      return (
        Oe(e) &&
        (e.role === `user` || e.role === `assistant`) &&
        typeof e.text == `string` &&
        e.text.trim().length > 0 &&
        (e.text.length <= 500 || (e.text.length === 501 && e.text.endsWith(`…`))) &&
        je(e.turnIndex) &&
        Me(e.time)
      )
    }
    function Be(e) {
      return Oe(e) && je(e.turnIndex) && ue(e.attribution) && e.attribution.total.tokens > 0
    }
    function Ve(e) {
      return Oe(e) && je(e.turnIndex) && le(e.measure) && e.measure.tokens > 0
    }
    function He(e) {
      if (
        !Oe(e) ||
        !Ae(e.turnCount) ||
        !Ae(e.toolCalls) ||
        !Ae(e.compactions) ||
        (e.currentAttribution !== null && !Be(e.currentAttribution)) ||
        (e.peak !== null && !Ve(e.peak)) ||
        !Le(e.usage) ||
        !Re(e.timing) ||
        (e.lastMessage !== null && !ze(e.lastMessage)) ||
        !Array.isArray(e.skills) ||
        !e.skills.every(Ie)
      )
        return !1
      const { turnCount: t, timing: n } = e,
        r = (e) => e <= t,
        i = (e) => e === void 0 || (n.spanMs !== null && e >= n.startedAt && e <= n.endedAt),
        a = e.skills.flatMap((e) => e.evidence)
      return (
        (e.currentAttribution === null
          ? e.peak === null
          : e.peak !== null &&
            r(e.currentAttribution.turnIndex) &&
            e.peak.turnIndex <= e.currentAttribution.turnIndex &&
            e.peak.measure.tokens >= e.currentAttribution.attribution.total.tokens) &&
        (e.peak === null || r(e.peak.turnIndex)) &&
        (e.lastMessage === null || (r(e.lastMessage.turnIndex) && i(e.lastMessage.time))) &&
        a.every((e) => r(e.turnIndex) && i(e.time)) &&
        new Set(a.map((e) => e.toolCallId)).size === a.length &&
        a.filter((e) => e.kind === `skill-tool` || e.kind === `skill-file`).length <= e.toolCalls &&
        (e.timing.toolUnionMs === null || (e.timing.spanMs !== null && e.timing.toolUnionMs <= e.timing.spanMs)) &&
        e.usage.coveredTurns + e.usage.missingTurns === e.turnCount &&
        e.timing.completedTurns + e.timing.missingTurnDurations === e.turnCount &&
        e.timing.timedToolCalls + e.timing.missingToolDurations === e.toolCalls &&
        new Set(e.skills.map((e) => e.id)).size === e.skills.length
      )
    }
    const Ue = m(`${b}/session/title/suggest`)
    function We(e, t) {
      return typeof e == `object` && !!e && !Array.isArray(e) && Object.keys(e).every((e) => t.includes(e))
    }
    function Ge(e) {
      return (
        We(e, [`source`, `id`, `title`, `provider`, `model`]) &&
        Ee(e) &&
        typeof e.title == `string` &&
        e.title.trim() === e.title &&
        e.title.length > 0 &&
        e.title.length <= 80 &&
        !/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u.test(e.title) &&
        typeof e.provider == `string` &&
        e.provider.trim().length > 0 &&
        typeof e.model == `string` &&
        e.model.trim().length > 0
      )
    }
    const Ke = [`cyrus-dsh-plugins`, `sessions-insight`],
      qe = [`@cyrusdoyle/dsh-plugins`, `@cyrusdoyle/dsh-sessions-insight`],
      Je = Object.freeze({
        sessionOverview: !0,
        skillsTab: !0,
        waterfall: !0,
        defaultToolsExpanded: !1,
        deepseekBalance: !1,
        autoCheckVersion: !1,
      }),
      Ye = Object.keys(Je)
    function Xe(e) {
      return typeof e == `object` && !!e && !Array.isArray(e) && Ye.every((t) => typeof Reflect.get(e, t) == `boolean`)
    }
    function Ze(e) {
      const t = { ...Je }
      if (typeof e != `object` || !e || Array.isArray(e)) return t
      for (const n of Ye) {
        const r = Reflect.get(e, n)
        typeof r == `boolean` && (t[n] = r)
      }
      return t
    }
    function Qe(e) {
      return [...(e.sessionOverview ? [`overview`] : []), `turns`, ...(e.skillsTab ? [`skills`] : [])]
    }
    function $e(e, t) {
      return Qe(t).includes(e) ? e : `turns`
    }
    const et = {
      "@cyrusdoyle/dsh-plugins": `https://www.npmjs.com/package/@cyrusdoyle/dsh-plugins`,
      "@cyrusdoyle/dsh-sessions-insight": `https://www.npmjs.com/package/@cyrusdoyle/dsh-sessions-insight`,
    }
    function tt(e) {
      return e === `@cyrusdoyle/dsh-plugins` || e === `@cyrusdoyle/dsh-sessions-insight`
    }
    const nt = `https://platform.deepseek.com/top_up`,
      rt = [
        `credential-error`,
        `unauthorized`,
        `rate-limited`,
        `timeout`,
        `network`,
        `http-error`,
        `invalid-response`,
        `account-error`,
      ]
    function it(e) {
      return rt.some((t) => e === t)
    }
    function at(e) {
      return e === `api-key` || e === `account`
    }
    function ot(e) {
      return typeof e == `object` && !!e && !Array.isArray(e)
    }
    function st(e) {
      return typeof e == `string` && e.length <= 80 && /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.exec(e)?.[0] === e
    }
    function ct(e) {
      return (
        ot(e) &&
        (e.currency === `CNY` || e.currency === `USD`) &&
        st(e.balance) &&
        (e.grantedBalance === void 0 || st(e.grantedBalance)) &&
        (e.toppedUpBalance === void 0 || st(e.toppedUpBalance))
      )
    }
    function lt(e) {
      return Array.isArray(e) && e.length <= 32 && e.every(ct)
    }
    function ut(e) {
      return typeof e == `number` && Number.isFinite(e) && e >= 0
    }
    function dt(e) {
      return !ot(e) || !ut(e.checkedAt)
        ? !1
        : e.status === `disabled` || e.status === `missing-credentials`
          ? !0
          : e.status === `failed`
            ? (e.reason === void 0 || e.reason === `host-unavailable` || it(e.reason)) &&
              (e.source === void 0 || at(e.source))
            : e.status === `ready` &&
              (e.source === `api-key` || e.source === `account`) &&
              (e.available === null || typeof e.available == `boolean`) &&
              lt(e.value) &&
              lt(e.bonusWallets)
    }
    function ft(e) {
      return !ot(e) || !tt(e.packageName) || typeof e.currentVersion != `string` || e.currentVersion.length > 128
        ? !1
        : e.status === `unchecked` || e.status === `disabled` || e.status === `failed`
          ? e.checkedAt === null || ut(e.checkedAt)
          : (e.status === `current` || e.status === `update`) &&
            ut(e.checkedAt) &&
            typeof e.latestVersion == `string` &&
            e.latestVersion.length <= 128
    }
    const pt = {
        "insights.tabs": `会话视图`,
        "insights.overview": `概览`,
        "insights.turns": `轮次`,
        "insights.skills": `技能`,
        "insights.unrecorded": `未记录 · 未知`,
        "insights.summary": `会话摘要`,
        "insights.fallback": `宿主未返回 insights · 根据已加载的全部轮次生成概览`,
        "insights.partial": `已加载 {loaded} / {total} 轮 · 全会话统计待宿主更新`,
        "insights.loadedContext": `已加载上下文`,
        "insights.loadedMessage": `已加载的最后一条消息`,
        "insights.loadedNote": `以下归因、峰值与时长仅覆盖已加载轮次`,
        "insights.loadedUsage": `已加载轮次累计用量`,
        "insights.costUsage": `累计用量来自全会话费用报告；覆盖率仅指已加载轮次`,
        "insights.peak": `上下文峰值`,
        "insights.current": `当前上下文`,
        "insights.currentNote": `最后有效归因：第 {index} 轮`,
        "insights.windowUnknown": `窗口大小未记录 · 占比未知`,
        "insights.window": `占窗口 {share}`,
        "insights.usage": `累计 token 用量`,
        "insights.usageNote": `累计计费用量，不是上下文构成之和`,
        "insights.input": `输入（非缓存）`,
        "insights.cacheRead": `缓存读取`,
        "insights.cacheWrite": `缓存写入`,
        "insights.output": `输出`,
        "insights.coverage": `{covered} 轮有用量记录 · {missing} 轮未记录（未知）`,
        "insights.composition": `当前上下文归因`,
        "insights.turnCount": `全会话轮次`,
        "insights.toolCalls": `工具调用`,
        "insights.compactions": `压缩点`,
        "insights.span": `会话记录跨度`,
        "insights.completedDuration": `已完成轮次记录时长（累计）`,
        "insights.toolDuration": `工具记录时长（区间并集）`,
        "insights.durationCoverage": `{covered} 条有区间记录 · {missing} 条未记录（未知）`,
        "insights.durationNote": `跨度包括间隔；轮次累计可重叠，工具时长已合并并行区间。剩余时间不代表模型思考。`,
        "insights.lastMessage": `最后一条消息`,
        "insights.user": `用户`,
        "insights.assistant": `助手`,
        "insights.jump": `定位第 {index} 轮`,
        "insights.searchSkills": `搜索技能名称或路径`,
        "insights.sortSkills": `技能排序`,
        "insights.byCount": `按次数`,
        "insights.byRecent": `按最近轮次`,
        "insights.noSkills": `这份会话记录中未找到技能加载证据`,
        "insights.noMatchingSkills": `没有匹配的技能，试试其他名称或路径`,
        "insights.skillSummary": `{count} 个技能 · {uses} 次加载`,
        "insights.partialSkills": `已检查 {loaded} / {total} 轮 · 加载更多以检查剩余技能`,
        "insights.skillNote": `统计 Skill 调用、读取 SKILL.md、用户明确引用和技能加载记录；不是可用技能列表，也不推断技能已成功执行。`,
        "insights.skill-reference": `用户引用 SKILL.md`,
        "insights.skill-injection": `技能加载记录`,
        "insights.skillCount": `{count} 次`,
        "insights.skill-tool": `显式 Skill 调用`,
        "insights.skill-file": `读取 SKILL.md`,
        "insights.evidence": `具体证据`,
      },
      mt = {
        "insights.tabs": `Session views`,
        "insights.overview": `Overview`,
        "insights.turns": `Turns`,
        "insights.skills": `Skills`,
        "insights.unrecorded": `Not recorded · unknown`,
        "insights.summary": `Session summary`,
        "insights.fallback": `Host did not return insights · overview derived from all loaded turns`,
        "insights.partial": `Loaded {loaded} / {total} turns · full-session statistics await a Host update`,
        "insights.loadedContext": `Loaded context`,
        "insights.loadedMessage": `Latest loaded message`,
        "insights.loadedNote": `Attribution, peak and timing below cover only loaded turns`,
        "insights.loadedUsage": `Loaded-turn cumulative usage`,
        "insights.costUsage": `Cumulative usage from the full-session cost report; coverage refers only to loaded turns`,
        "insights.peak": `Peak context`,
        "insights.current": `Current context`,
        "insights.currentNote": `Last valid attribution: turn {index}`,
        "insights.windowUnknown": `Window not recorded · share unknown`,
        "insights.window": `{share} of window`,
        "insights.usage": `Cumulative token usage`,
        "insights.usageNote": `Cumulative billing usage, not the sum of context slices`,
        "insights.input": `Input (uncached)`,
        "insights.cacheRead": `Cache read`,
        "insights.cacheWrite": `Cache write`,
        "insights.output": `Output`,
        "insights.coverage": `{covered} turns with usage · {missing} not recorded (unknown)`,
        "insights.composition": `Current context attribution`,
        "insights.turnCount": `Full-session turns`,
        "insights.toolCalls": `Tool calls`,
        "insights.compactions": `Compactions`,
        "insights.span": `Recorded session span`,
        "insights.completedDuration": `Recorded completed-turn duration (sum)`,
        "insights.toolDuration": `Recorded tool duration (interval union)`,
        "insights.durationCoverage": `{covered} recorded intervals · {missing} not recorded (unknown)`,
        "insights.durationNote": `Span includes gaps; summed turn durations may overlap. Parallel tool intervals are merged. Remaining time does not represent model thinking.`,
        "insights.lastMessage": `Last message`,
        "insights.user": `User`,
        "insights.assistant": `Assistant`,
        "insights.jump": `Go to turn {index}`,
        "insights.searchSkills": `Search skill name or path`,
        "insights.sortSkills": `Sort skills`,
        "insights.byCount": `By count`,
        "insights.byRecent": `By latest turn`,
        "insights.noSkills": `No skill loading evidence found in this session record`,
        "insights.noMatchingSkills": `No matching skills. Try another name or path.`,
        "insights.skillSummary": `{count} skills · {uses} loads`,
        "insights.partialSkills": `Checked {loaded} / {total} turns · load more to inspect remaining skills`,
        "insights.skillNote": `Counts Skill calls, SKILL.md reads, explicit user references and skill loading records. This is not an available-skills list or proof of successful execution.`,
        "insights.skill-reference": `User referenced SKILL.md`,
        "insights.skill-injection": `Skill loading record`,
        "insights.skillCount": `{count} calls`,
        "insights.skill-tool": `Explicit Skill invocation`,
        "insights.skill-file": `Read SKILL.md`,
        "insights.evidence": `Evidence`,
      },
      ht = {
        "management.edit": `编辑`,
        "management.done": `完成`,
        "management.selectVisible": `选择可见会话`,
        "management.clear": `清空选择`,
        "management.selectDirectory": `选择目录全部已加载 {count} 条`,
        "management.selected": `已选择 {count} 条`,
        "management.rename": `重命名`,
        "management.aiRename": `AI 命名`,
        "management.aiSuggest": `生成 AI 建议`,
        "management.aiConfirm": `将为 {count} 条会话发送少量用户输入给当前默认模型以生成名称，会产生模型调用费用。是否继续？`,
        "management.aiSkipped": `跳过 {count} 条已命名会话`,
        "management.aiProgress": `AI 建议：已处理 {done} / {total} 条`,
        "management.aiStop": `停止生成`,
        "management.aiPending": `尚未生成建议；编辑名称或重试后可保存此项。`,
        "management.aiHint": `建议仅填入草稿，可编辑；保存只提交已生成或明确编辑的名称。`,
        "management.aiUnavailable": `AI 命名接口尚未连接`,
        "management.move": `移至分组`,
        "management.delete": `删除`,
        "management.deleteConfirm": `确定删除 {count} 条会话？这会永久删除原始日志，无法撤销。`,
        "management.cancel": `取消`,
        "management.save": `保存`,
        "management.saving": `处理中…`,
        "management.restore": `恢复原名称`,
        "management.name": `会话名称：{title}`,
        "management.group": `分组（可输入新名称或选择已有分组）`,
        "management.ungroup": `移出分组`,
        "management.allGroups": `所有分组 / 工作目录`,
        "management.ungrouped": `未分组`,
        "management.groupFilter": `筛选分组`,
        "management.failure": `{title}：{reason}`,
        "management.retry": `重试失败项`,
        "management.unavailable": `会话管理接口尚未连接`,
        "management.loading": `正在读取会话管理信息…`,
        "management.groupHint": `分组仅保存在插件元数据中，不会改变工作目录。`,
      },
      gt = {
        "management.edit": `Edit`,
        "management.done": `Done`,
        "management.selectVisible": `Select visible sessions`,
        "management.clear": `Clear selection`,
        "management.selectDirectory": `Select all {count} loaded sessions in directory`,
        "management.selected": `{count} selected`,
        "management.rename": `Rename`,
        "management.aiRename": `AI naming`,
        "management.aiSuggest": `Generate AI suggestion`,
        "management.aiConfirm": `Send a small amount of user input from {count} sessions to the current default model to suggest names? Model calls will incur charges.`,
        "management.aiSkipped": `Skipped {count} already named sessions`,
        "management.aiProgress": `AI suggestions: {done} / {total} processed`,
        "management.aiStop": `Stop generation`,
        "management.aiPending": `No suggestion yet; edit the name or retry to save this item.`,
        "management.aiHint": `Suggestions are editable drafts only. Save submits generated or explicitly edited names only.`,
        "management.aiUnavailable": `AI naming API is not connected yet`,
        "management.move": `Move to group`,
        "management.delete": `Delete`,
        "management.deleteConfirm": `Delete {count} sessions? Original logs will be permanently deleted. This cannot be undone.`,
        "management.cancel": `Cancel`,
        "management.save": `Save`,
        "management.saving": `Processing…`,
        "management.restore": `Restore original name`,
        "management.name": `Session name: {title}`,
        "management.group": `Group (enter a new name or choose an existing group)`,
        "management.ungroup": `Remove from group`,
        "management.allGroups": `All groups / working directories`,
        "management.ungrouped": `Ungrouped`,
        "management.groupFilter": `Filter by group`,
        "management.failure": `{title}: {reason}`,
        "management.retry": `Retry failed items`,
        "management.unavailable": `Session management API is not connected yet`,
        "management.loading": `Loading session management metadata…`,
        "management.groupHint": `Groups are plugin metadata only; working directories remain unchanged.`,
      },
      _t = {
        "settings.title": `设置`,
        "settings.back": `返回会话`,
        "settings.intro": `选择需要显示的模块。轮次始终保留，关闭当前标签后会返回轮次。`,
        "settings.modules": `会话模块`,
        "settings.utilities": `辅助功能`,
        "settings.sessionOverview": `会话概览`,
        "settings.sessionOverview.hint": `显示上下文、花费与会话统计概览。`,
        "settings.skillsTab": `Skills 标签`,
        "settings.skillsTab.hint": `显示技能使用记录及对应轮次。`,
        "settings.waterfall": `累计水位图`,
        "settings.waterfall.hint": `在轮次页显示上下文水位变化。`,
        "settings.defaultToolsExpanded": `默认展开工具列表`,
        "settings.defaultToolsExpanded.hint": `打开会话时显示全部工具调用，仍可手动收起。`,
        "settings.deepseekBalance": `DeepSeek 余额显示`,
        "settings.deepseekBalance.hint": `在主面板显示 DeepSeek 余额；开启后会访问 api.deepseek.com，并使用 DeepSeek 官方适配器配置的凭据引用（默认 DEEPSEEK_API_KEY）读取，未配置时使用已登录账号。`,
        "settings.autoCheckVersion": `自动检查版本`,
        "settings.autoCheckVersion.hint": `自动访问 registry.npmjs.org 检查当前安装包的新版本；关闭后仍可在下方手动检查。`,
        "settings.summary": `会话洞察：会话模块与辅助功能的开关，均由宿主保存。`,
        "settings.readonly": `当前设置只读；宿主配置表单就绪且允许写入后才能修改。`,
        "settings.loading": `正在读取设置…`,
        "settings.unavailable": `宿主暂时没有提供可编辑的设置表单。`,
        "settings.requiresHost": `设置表单需要 DSH 0.2.1-rc.5 或更新版本；升级并重启宿主后重试。`,
        "settings.readFailed": `读取设置失败：{detail}`,
        "settings.retry": `重试`,
        "settings.saveFailed": `设置未保存，请重试。显示值以宿主配置为准。`,
        "settings.saving": `正在保存…`,
        "settings.saved": `设置由宿主保存，即时生效。`,
      },
      vt = {
        "settings.title": `Settings`,
        "settings.back": `Back to sessions`,
        "settings.intro": `Choose the modules to display. Turns always remain available; disabling the active tab returns to Turns.`,
        "settings.modules": `Session modules`,
        "settings.utilities": `Utilities`,
        "settings.sessionOverview": `Session overview`,
        "settings.sessionOverview.hint": `Show context, cost and session statistics.`,
        "settings.skillsTab": `Skills tab`,
        "settings.skillsTab.hint": `Show skill usage and the corresponding turns.`,
        "settings.waterfall": `Cumulative level chart`,
        "settings.waterfall.hint": `Show context levels on the Turns page.`,
        "settings.defaultToolsExpanded": `Expand tool list by default`,
        "settings.defaultToolsExpanded.hint": `Show all tool calls when opening a session; they can still be collapsed manually.`,
        "settings.deepseekBalance": `DeepSeek balance display`,
        "settings.deepseekBalance.hint": `Show DeepSeek balance in the main panel; enabling it calls api.deepseek.com and reads the credential reference configured for the DeepSeek official adapter (default DEEPSEEK_API_KEY), falling back to the signed-in account.`,
        "settings.autoCheckVersion": `Automatically check versions`,
        "settings.autoCheckVersion.hint": `Automatically check registry.npmjs.org for a newer installed package; you can still check manually below when this is off.`,
        "settings.summary": `Sessions Insight: switches for session modules and utilities, saved by the Host.`,
        "settings.readonly": `Settings are read-only until the Host configuration form is ready and writable.`,
        "settings.loading": `Loading settings…`,
        "settings.unavailable": `The Host does not expose an editable settings form yet.`,
        "settings.requiresHost": `The settings form requires DSH 0.2.1-rc.5 or newer; upgrade and restart the Host, then retry.`,
        "settings.readFailed": `Reading settings failed: {detail}`,
        "settings.retry": `Retry`,
        "settings.saveFailed": `Settings were not saved. Retry; the displayed values follow the Host.`,
        "settings.saving": `Saving…`,
        "settings.saved": `Saved by the Host and applied immediately.`,
      },
      yt = {
        ...mt,
        ...gt,
        ...vt,
        "entry.label": `Sessions Insight`,
        "toolbar.sidebar": `Show/hide projects`,
        "search.trigger": `Search sessions and turns…`,
        "tree.filter": `Filter projects`,
        "tree.noMatch": `No project path contains “{query}”.`,
        "sessions.pick": `Pick a session on the left`,
        "sessions.pickHint": `Open a project and click any session to see what each turn actually fed the model.`,
        "stats.current": `Current context`,
        "stats.noWindow": `window size not logged`,
        "stats.windowShare": `{share} of {size} window`,
        "stats.peak": `Peak`,
        "stats.peakAt": `at turn {index}`,
        "stats.turns": `Turns`,
        "stats.compactionsLine": `{count} compactions · {tools} tool calls`,
        "stats.loaded": `{count} loaded`,
        "stats.cost": `Cost`,
        "stats.costPending": `pricing pending or uncovered`,
        "stats.costPriced": `priced per turn from the table`,
        "stats.reconciledTurns": `{count} turns were scaled`,
        "detail.composition": `Context composition`,
        "turns.noInput": `(no user input this turn)`,
        "waterfall.hint": `click a point to open that turn`,
        "list.refreshing": `refreshing…`,
        "tree.title": `Projects`,
        "tree.loadingIndex": `Reading the three session indexes…`,
        "tree.emptyAll": `No readable sessions in any source yet. Check the DSH / Claude / Codex directories, or press Refresh.`,
        "tree.showAll": `Show all {count}`,
        "sessions.untitled": `Untitled session`,
        "sessions.actions": `Session actions`,
        "sessions.delete": `Delete session`,
        "sessions.deleteConfirm": `Delete “{title}”? This permanently deletes the session’s original logs and cannot be undone.`,
        "sessions.deleteFailed": `Delete failed: {detail}`,
        "sessions.deleteShared": `This session shares logs with other Codex sessions and cannot be safely deleted.`,
        "handoff.waiting": `Waiting for your answer. Open the DSH session to continue.`,
        "handoff.openExisting": `Open in DSH`,
        "handoff.language": `en`,
        "handoff.openSession": `Open new DSH session`,
        "handoff.openFailed": `Cannot open session: {detail}`,
        "handoff.progress": `Elapsed {seconds}s · {count} tool calls completed`,
        "handoff.tool": `Running tool: {tool}`,
        "handoff.thinking": `The model is working; waiting for the next activity`,
        "handoff.updated": `Last activity: {time}`,
        "handoff.pollError": `Cannot read progress; retrying: {detail}`,
        "handoff.button": `Hand off to DSH`,
        "handoff.title": `Hand off to DSH`,
        "handoff.preparing": `Building the brief…`,
        "handoff.cwd": `Workdir of the new session`,
        "handoff.cwdHint": `Must be explicit: omitting it makes DSH inherit its own launch directory and file the session under the wrong bucket.`,
        "handoff.brief": `Brief (six sections; editable before delivery)`,
        "handoff.files": `{count} files`,
        "handoff.decisions": `{count} decisions`,
        "handoff.open": `{count} open items`,
        "handoff.commands": `{count} verification commands`,
        "handoff.chars": `{count} chars`,
        "handoff.apply": `Deliver to DSH`,
        "handoff.applying": `Delivering…`,
        "handoff.polish": `Polish with a model`,
        "handoff.polishUnavailable": `This handoff is rule-extracted; model polishing is not wired yet`,
        "handoff.applyFailed": `Delivery failed: {detail}`,
        "handoff.state.delivered": `Delivered — waiting for the model`,
        "handoff.state.running": `The model is running`,
        "handoff.state.succeeded": `Handoff succeeded (turn/end observed)`,
        "handoff.state.failed": `Handoff failed`,
        "handoff.polling": `Polling the target log every 600 ms until a turn/end appears`,
        "handoff.reason": `Reason: {reason}`,
        "handoff.evidence": `Evidence: turn/end seq={seq}`,
        "handoff.close": `Close`,
        "cost.total": `Total {usd}`,
        "cost.unpriced": `{count} unpriced turns`,
        "cost.null": `—`,
        "cost.tip": `Price table {version} · as of {asOf} · {currency}; uncovered models show —`,
        "cost.turnTip": `Turn {index} · {model} · cache hit {rate}`,
        "cost.provisional": `Preview price`,
        "cost.reference": `ref {amount}`,
        "cost.partialPrefix": `≥`,
        "cost.noConvert": `The two tables are never converted or added together`,
        "cost.tableLine": `{id}: {source} · as of {asOf}`,
        "cost.unlistedTip": `Unlisted channels: {channels}`,
        "cost.provisionalTip": `Part of this model’s rates is derived (cached input from a discount rule, cacheWrite as 1.25× input), not an officially listed number; source is a GPT-5.6 preview price round-up.`,
        "search.tier.fast": `Fast (metadata)`,
        "search.tier.deep": `Deep (bodies)`,
        "search.enterDeep": `Enter = deep search`,
        "search.continue": `Continue scanning {count} more`,
        "search.deepMeta": `Deep: {scanned} scanned · {remaining} remaining`,
        "search.fastMeta": `Fast: all {scanned} sessions scanned`,
        "session.untitled": `Untitled session`,
        "session.firstInput": `first input`,
        "sessions.headerHint": `The list reads file headers only; open a row to parse it`,
        "compactions.count": `{count} compactions`,
        "compactions.range": `{before} → {after}`,
        "compactions.list": `Expand every boundary`,
        "search.title": `Search sessions`,
        "search.placeholder": `Search turn text… (Esc to close)`,
        "search.empty": `No matches.`,
        "search.hint": `Type to search; ↑↓ to select, Enter to open the turn`,
        "search.scanning": `Scanning…`,
        "search.meta": `{scanned} sessions scanned in {elapsed} ms`,
        "search.truncated": `Budget ran out; {remaining} sessions were not scanned`,
        "search.complete": `All {scanned} sessions scanned`,
        "search.open": `Search (⌘K)`,
        "search.failures": `{count} sources failed`,
        "search.result": `{workdir} · turn {turn}`,
        "search.jump": `Open this turn`,
        "panel.refresh": `Refresh`,
        "panel.loading": `Reading Host data…`,
        "panel.retry": `Retry`,
        "panel.updated": `Updated {time}`,
        "sources.title": `Sources`,
        "sources.available": `readable`,
        "sources.unavailable": `unavailable`,
        "sources.sessions": `{count} sessions`,
        "sources.reason.adapter-pending": `adapter not ready`,
        "sources.reason.root-missing": `root missing`,
        "sources.reason.root-unreadable": `root unreadable`,
        "sources.reason.adapter-error": `adapter error`,
        "workdirs.title": `Workdirs`,
        "workdirs.empty": `No Claude sessions found.`,
        "workdirs.unknown": `(unknown workdir)`,
        "workdirs.undecoded": `path decoded from the directory name`,
        "sessions.title": `Sessions`,
        "sessions.empty": `No sessions in this workdir.`,
        "sessions.unparsed": `not parsed`,
        "sessions.turns": `{count} turns`,
        "session.loading": `Parsing session…`,
        "session.error": `Read failed: {detail}`,
        "session.paging": `Turns {from}–{to} of {total}`,
        "session.loadMore": `Load more turns`,
        "session.loadingMore": `Loading…`,
        "session.noTurns": `This session has no parseable turns.`,
        "session.noTurnsHint": `The file exists but records no human input or usage, so no composition can be drawn.`,
        "session.quality": `Data quality`,
        "session.turnCount": `{count} turns`,
        "turns.title": `Per-turn context`,
        "turns.hint": `One row per turn; open one for part numbers and tool calls.`,
        "turns.unknown": `Unknown`,
        "turns.unknownNote": `The unattributed gap, never spread over the known parts`,
        "turns.overCounted": `Estimates exceed the exact total by {tokens}`,
        "turns.normalizedByParts": `No usage on this turn: the bar is normalized by parts`,
        "turns.total": `Total`,
        "turns.window": `window {size}`,
        "turns.reconciled": `scaled by {factor}`,
        "turns.notReconciled": `not scaled; the gap stands alone`,
        "turns.compaction": `Compaction`,
        "turns.compactionTransition": `{before} → {after}`,
        "turns.compactionReplaced": `history replaced`,
        "turns.compactionContinued": `history continues from a summary`,
        "turns.tools": `Tool calls`,
        "turns.subagents": `Subagent sessions`,
        "turns.noTools": `No tool calls in this turn.`,
        "turns.noSubagents": `No subagent sessions recorded for this turn.`,
        "turns.selected": `Turn {index}`,
        "waterfall.title": `Cumulative level`,
        "waterfall.caption": `Total context per turn; dashed lines are compactions`,
        "waterfall.peak": `peak {tokens}`,
        "precision.exact": `exact`,
        "precision.estimate": `estimate`,
        "basis.usage": `logged usage`,
        "basis.chars-per-token": `chars per token`,
        "basis.harness-projection": `harness projection`,
        "basis.byte-length": `byte length`,
        "basis.unattributed": `unattributed gap`,
        "basis.tip.chars-per-token": `calipers: text {text} chars/token, CJK {cjk}, schema {schema}`,
        "basis.tip.usage": `read from the logged usage, not estimated`,
        "basis.tip.harness-projection": `images projected at {px} pixels/token`,
        "basis.tip.byte-length": `converted from byte length`,
        "basis.tip.unattributed": `total minus the parts; never spread over a category`,
        "part.system-prompt": `System prompt`,
        "part.tool-definitions": `Tool definitions`,
        "part.memory-instructions": `Memory & instructions`,
        "part.referenced-files": `Referenced files`,
        "part.history": `History`,
        "part.tool-results": `Tool results`,
        "part.images": `Images`,
        "part.user-input": `User input`,
        "part.assistant-output": `Assistant output`,
        "part.thinking": `Thinking`,
        "tools.status.ok": `ok`,
        "tools.status.running": `running`,
        "tools.status.error": `error`,
        "tools.status.unknown": `no result`,
        "detail.userInput": `User message`,
        "tools.showAll": `Show all {count}`,
        "tools.showLess": `Show less`,
        "tools.path": `path`,
        "tools.command": `command`,
        "tools.diff": `diff`,
        "tools.output": `output`,
        "tools.input": `input`,
        "tools.truncated": `long content folded`,
        "subagents.title": `Subagent sessions`,
        "subagents.files": `{count} attached files`,
        "subagents.none": `No subagent files recorded for this session.`,
        "subagents.main": `main file`,
        "empty.noSources": `The Host serves no readable source.`,
        "empty.noData": `No parseable data.`,
        "error.network": `Cannot reach the Host route`,
        "utility.loading": `Checking…`,
        "utility.balance.title": `DeepSeek balance`,
        "utility.balance.unchecked": `Not refreshed yet`,
        "utility.balance.empty": `No balance available`,
        "utility.balance.disabled": `Balance display is disabled`,
        "utility.balance.missing-credentials": `No API key or signed-in account available`,
        "utility.balance.failed": `Balance query failed without a reason from the Host. Refresh; if it persists, check Host/plugin versions.`,
        "utility.balance.source.api-key": `Source: API key`,
        "utility.balance.source.account": `Source: signed-in account`,
        "utility.balance.failure.credential-error": `Credential lookup failed. Check Host credential settings and refresh.`,
        "utility.balance.failure.unauthorized": `API authentication failed (401/403). Check the API key validity and permissions, then refresh; another account will not be used automatically.`,
        "utility.balance.failure.account-unauthorized": `Account authentication failed. Sign in to the DeepSeek account again and refresh.`,
        "utility.balance.failure.rate-limited": `Rate limited (429); wait before refreshing and avoid repeated queries.`,
        "utility.balance.failure.timeout": `Balance query timed out. Check the network and retry.`,
        "utility.balance.failure.network": `Cannot reach the balance service. Check network or proxy settings and refresh.`,
        "utility.balance.failure.http-error": `The balance service returned an HTTP error; retry later.`,
        "utility.balance.failure.invalid-response": `Incompatible balance response. Check Host/plugin compatibility and refresh.`,
        "utility.balance.failure.account-error": `Host account balance service failed. Sign in to the DeepSeek account again and refresh.`,
        "utility.balance.failure.host-unavailable": `Cannot access the Host balance route. Check that the plugin is loaded, the Host version supports balances, and the Host is signed in and reachable.`,
        "utility.balance.unavailable": `API balance is not available for use`,
        "utility.balance.bonus": `Bonus wallet`,
        "utility.balance.refresh": `Refresh balance`,
        "utility.balance.recharge": `Top up on DeepSeek`,
        "utility.balance.hint": `When enabled, queries api.deepseek.com for the balance, using the credential reference configured for the DeepSeek official adapter (default DEEPSEEK_API_KEY) and falling back to the signed-in account. The plugin stores no key; currencies are shown separately.`,
        "utility.version.title": `Plugin version`,
        "utility.version.unchecked": `Not checked yet`,
        "utility.version.disabled": `Automatic checks are off; you can still check manually`,
        "utility.version.failed": `Version check failed; please retry`,
        "utility.version.current": `Up to date · {version}`,
        "utility.version.update": `New version available · {version}`,
        "utility.version.check": `Check for updates`,
        "utility.version.open": `View update on npm`,
        "utility.version.hint": `When enabled, checks registry.npmjs.org for a newer version of the installed package; manual checks still work when it is off.`,
      },
      bt = {
        ...pt,
        ...ht,
        ..._t,
        "entry.label": `会话洞察`,
        "toolbar.sidebar": `显示/隐藏项目栏`,
        "search.trigger": `搜索会话与轮次…`,
        "tree.filter": `筛选项目`,
        "tree.noMatch": `没有路径包含「{query}」的项目。`,
        "sessions.pick": `从左侧选一个会话`,
        "sessions.pickHint": `展开项目，点开任一会话，就能看到它每一轮实际喂给模型的上下文。`,
        "stats.current": `当前上下文`,
        "stats.noWindow": `日志未记录窗口大小`,
        "stats.windowShare": `占窗口 {share} · {size}`,
        "stats.peak": `峰值`,
        "stats.peakAt": `出现在第 {index} 轮`,
        "stats.turns": `轮次`,
        "stats.compactionsLine": `{count} 个压缩点 · {tools} 次工具调用`,
        "stats.loaded": `已加载 {count} 轮`,
        "stats.cost": `花费`,
        "stats.costPending": `价格计算中或未覆盖`,
        "stats.costPriced": `按价格表逐轮计价`,
        "stats.reconciledTurns": `{count} 轮按系数缩放过`,
        "detail.composition": `上下文构成`,
        "turns.noInput": `（本轮无用户输入）`,
        "waterfall.hint": `点任一点跳到该轮`,
        "list.refreshing": `刷新中…`,
        "tree.title": `项目`,
        "tree.loadingIndex": `正在读取三源会话索引…`,
        "tree.emptyAll": `三个来源都还没有可读的会话。检查 DSH / Claude / Codex 目录是否存在，或点右上角「刷新」。`,
        "tree.showAll": `显示全部 {count} 条`,
        "sessions.untitled": `未命名会话`,
        "sessions.actions": `会话操作`,
        "sessions.delete": `删除会话`,
        "sessions.deleteConfirm": `确定删除「{title}」？这会永久删除该会话的原始日志，无法撤销。`,
        "sessions.deleteFailed": `删除失败：{detail}`,
        "sessions.deleteShared": `此会话与其他 Codex 会话共用日志，无法安全删除。`,
        "handoff.waiting": `正在等待你的回答，请打开 DSH 会话继续`,
        "handoff.openExisting": `在 DSH 中打开`,
        "handoff.language": `zh`,
        "handoff.openSession": `打开 DSH 新会话`,
        "handoff.openFailed": `无法打开会话：{detail}`,
        "handoff.progress": `已运行 {seconds} 秒 · 已完成 {count} 次工具调用`,
        "handoff.tool": `正在执行工具：{tool}`,
        "handoff.thinking": `模型正在处理，等待下一条执行记录`,
        "handoff.updated": `最近活动：{time}`,
        "handoff.pollError": `进度读取失败，正在重试：{detail}`,
        "handoff.button": `交接给 DSH`,
        "handoff.title": `交接给 DSH`,
        "handoff.preparing": `正在生成简报…`,
        "handoff.cwd": `新会话的工作目录`,
        "handoff.cwdHint": `必须显式指定：省略会让 DSH 继承自己的启动目录，把会话建到错误的桶里。`,
        "handoff.brief": `简报（6 段，可在投递前编辑）`,
        "handoff.files": `{count} 个文件`,
        "handoff.decisions": `{count} 条决策`,
        "handoff.open": `{count} 条未决`,
        "handoff.commands": `{count} 条验证命令`,
        "handoff.chars": `{count} 字`,
        "handoff.apply": `投递到 DSH`,
        "handoff.applying": `正在投递…`,
        "handoff.polish": `用模型润色`,
        "handoff.polishUnavailable": `本次交接使用规则抽取；模型润色尚未接通`,
        "handoff.applyFailed": `投递失败：{detail}`,
        "handoff.state.delivered": `已投递，等待模型响应`,
        "handoff.state.running": `模型正在运行`,
        "handoff.state.succeeded": `交接成功（已观察到 turn/end）`,
        "handoff.state.failed": `交接失败`,
        "handoff.polling": `每 600ms 轮询该会话日志，直到出现 turn/end 才判定结果`,
        "handoff.reason": `失败原因：{reason}`,
        "handoff.evidence": `证据：turn/end seq={seq}`,
        "handoff.close": `关闭`,
        "cost.total": `合计 {usd}`,
        "cost.unpriced": `{count} 轮未覆盖价格`,
        "cost.null": `—`,
        "cost.tip": `价格表 {version} · 数据截至 {asOf} · {currency}；未覆盖模型显示 —`,
        "cost.turnTip": `第 {index} 轮 · {model} · cache 命中 {rate}`,
        "cost.provisional": `预览价`,
        "cost.reference": `参考 {amount}`,
        "cost.partialPrefix": `≥`,
        "cost.noConvert": `两张表不做汇率换算，也不相加`,
        "cost.tableLine": `{id}：{source} · 数据截至 {asOf}`,
        "cost.unlistedTip": `未列价通道：{channels}`,
        "cost.provisionalTip": `该模型的部分费率是推导值（cached 输入价由折扣规则推算、cacheWrite 按 1.25×input），不是官方单列价格；来源为 GPT-5.6 预览价汇总。`,
        "search.tier.fast": `快搜（元数据）`,
        "search.tier.deep": `深搜（正文）`,
        "search.enterDeep": `Enter 深搜`,
        "search.continue": `继续扫描剩余 {count} 个`,
        "search.deepMeta": `深搜：扫过 {scanned} · 剩余 {remaining}`,
        "search.fastMeta": `快搜：已扫全部 {scanned} 个会话`,
        "session.untitled": `未命名会话`,
        "session.firstInput": `首条输入`,
        "sessions.headerHint": `列表仅读文件头，点开才解析`,
        "compactions.count": `{count} 个压缩点`,
        "compactions.range": `{before} → {after}`,
        "compactions.list": `逐个展开前后对比`,
        "search.title": `搜索会话`,
        "search.placeholder": `搜索轮次正文…（Esc 关闭）`,
        "search.empty": `没有命中。`,
        "search.hint": `输入后即搜；↑↓ 选择，Enter 跳转到该轮`,
        "search.scanning": `正在扫描…`,
        "search.meta": `扫过 {scanned} 个会话，用时 {elapsed} ms`,
        "search.truncated": `预算内未扫完，还剩 {remaining} 个会话`,
        "search.complete": `已扫完 {scanned} 个会话`,
        "search.open": `搜索（⌘K）`,
        "search.failures": `{count} 个来源失败`,
        "search.result": `{workdir} · 第 {turn} 轮`,
        "search.jump": `跳转到该轮`,
        "panel.refresh": `刷新`,
        "panel.loading": `正在读取宿主数据…`,
        "panel.retry": `重试`,
        "panel.updated": `更新于 {time}`,
        "sources.title": `来源`,
        "sources.available": `可读`,
        "sources.unavailable": `不可用`,
        "sources.sessions": `{count} 个会话`,
        "sources.reason.adapter-pending": `适配器尚未就绪`,
        "sources.reason.root-missing": `根目录不存在`,
        "sources.reason.root-unreadable": `根目录不可读`,
        "sources.reason.adapter-error": `适配器异常`,
        "workdirs.title": `工作目录`,
        "workdirs.empty": `未发现任何 Claude 会话。`,
        "workdirs.unknown": `（未知工作目录）`,
        "workdirs.undecoded": `路径由目录名反解`,
        "sessions.title": `会话`,
        "sessions.empty": `该工作目录下没有会话。`,
        "sessions.unparsed": `未解析`,
        "sessions.turns": `{count} 轮`,
        "session.loading": `正在解析会话…`,
        "session.error": `读取失败：{detail}`,
        "session.paging": `第 {from}–{to} 轮，共 {total} 轮`,
        "session.loadMore": `加载更多轮次`,
        "session.loadingMore": `正在加载…`,
        "session.noTurns": `这个会话没有可解析的轮次。`,
        "session.noTurnsHint": `文件存在但没有任何用户输入与 usage 记录，因此无法画出上下文构成。`,
        "session.quality": `数据质量`,
        "session.turnCount": `{count} 轮`,
        "turns.title": `轮次上下文构成`,
        "turns.hint": `每轮一行；点开可看分区数字与工具调用。`,
        "turns.unknown": `未知`,
        "turns.unknownNote": `无法归因的缺口，未摊入任何已知类别`,
        "turns.overCounted": `估算合计超过精确总量 {tokens}`,
        "turns.normalizedByParts": `该轮没有 usage：条形按分区估算归一`,
        "turns.total": `总量`,
        "turns.window": `窗口 {size}`,
        "turns.reconciled": `已按系数 {factor} 缩放`,
        "turns.notReconciled": `未缩放，缺口单列`,
        "turns.compaction": `压缩点`,
        "turns.compactionTransition": `{before} → {after}`,
        "turns.compactionReplaced": `历史被替换`,
        "turns.compactionContinued": `历史由摘要接续`,
        "turns.tools": `工具调用`,
        "turns.subagents": `子代理会话`,
        "turns.noTools": `本轮没有工具调用。`,
        "turns.noSubagents": `本轮没有记录到子代理会话。`,
        "turns.selected": `第 {index} 轮`,
        "waterfall.title": `累计水位`,
        "waterfall.caption": `每轮的总上下文；竖虚线是压缩点`,
        "waterfall.peak": `峰值 {tokens}`,
        "precision.exact": `精确`,
        "precision.estimate": `估算`,
        "basis.usage": `日志 usage`,
        "basis.chars-per-token": `字符折算`,
        "basis.harness-projection": `宿投影`,
        "basis.byte-length": `字节长度`,
        "basis.unattributed": `不可归因缺口`,
        "basis.tip.chars-per-token": `系数：文本 {text} 字/token，CJK {cjk}，schema {schema}`,
        "basis.tip.usage": `直接读自日志的 usage，不是估算`,
        "basis.tip.harness-projection": `图片按 {px} 像素/token 投影`,
        "basis.tip.byte-length": `按字节长度折算`,
        "basis.tip.unattributed": `总量减分区之和；不摊给任何类别`,
        "part.system-prompt": `系统提示`,
        "part.tool-definitions": `工具定义`,
        "part.memory-instructions": `记忆与指令`,
        "part.referenced-files": `引用文件`,
        "part.history": `历史`,
        "part.tool-results": `工具结果`,
        "part.images": `图片`,
        "part.user-input": `用户输入`,
        "part.assistant-output": `助手输出`,
        "part.thinking": `思考`,
        "tools.status.ok": `成功`,
        "tools.status.running": `进行中`,
        "tools.status.error": `报错`,
        "tools.status.unknown": `未回包`,
        "detail.userInput": `用户输入`,
        "tools.showAll": `显示全部 {count} 个`,
        "tools.showLess": `收起`,
        "tools.path": `路径`,
        "tools.command": `命令`,
        "tools.diff": `改动`,
        "tools.output": `输出`,
        "tools.input": `输入`,
        "tools.truncated": `内容过长，已折叠`,
        "subagents.title": `子代理会话`,
        "subagents.files": `{count} 个附属文件`,
        "subagents.none": `该会话没有记录到子代理文件。`,
        "subagents.main": `主文件`,
        "empty.noSources": `宿主没有可读的来源。`,
        "empty.noData": `没有可解析的数据。`,
        "error.network": `无法连接宿主路由`,
        "utility.loading": `正在查询…`,
        "utility.balance.title": `DeepSeek 余额`,
        "utility.balance.unchecked": `尚未刷新`,
        "utility.balance.empty": `余额暂无`,
        "utility.balance.disabled": `余额显示已关闭`,
        "utility.balance.missing-credentials": `没有可用的 API Key 或已登录账号`,
        "utility.balance.failed": `余额查询失败，宿主未提供原因；请刷新，持续失败时检查宿主与插件版本。`,
        "utility.balance.source.api-key": `来源：API Key`,
        "utility.balance.source.account": `来源：已登录账号`,
        "utility.balance.failure.credential-error": `凭据读取失败；检查宿主的凭据设置后刷新。`,
        "utility.balance.failure.unauthorized": `API 认证失败（401/403）；检查 API Key 是否有效及权限后刷新，不会自动改查其他账号。`,
        "utility.balance.failure.account-unauthorized": `账号认证失败；重新登录 DeepSeek 账号后刷新。`,
        "utility.balance.failure.rate-limited": `请求被限流（429）；稍后再刷新，避免连续查询。`,
        "utility.balance.failure.timeout": `查询超时；检查网络后重试。`,
        "utility.balance.failure.network": `无法连接余额服务；检查网络或代理设置后刷新。`,
        "utility.balance.failure.http-error": `余额服务返回 HTTP 错误；稍后重试。`,
        "utility.balance.failure.invalid-response": `余额响应格式不兼容；检查宿主与插件版本是否匹配后刷新。`,
        "utility.balance.failure.account-error": `宿主账号服务查询失败；重新登录 DeepSeek 账号后刷新。`,
        "utility.balance.failure.host-unavailable": `无法访问宿主余额接口；检查插件是否已加载、当前宿主版本是否支持余额功能以及宿主登录与连接状态。`,
        "utility.balance.unavailable": `API 余额当前不可用于调用`,
        "utility.balance.bonus": `奖励钱包`,
        "utility.balance.refresh": `刷新余额`,
        "utility.balance.recharge": `前往 DeepSeek 充值`,
        "utility.balance.hint": `开启后会访问 api.deepseek.com 查询余额：使用 DeepSeek 官方适配器配置的凭据引用（默认 DEEPSEEK_API_KEY），未配置时使用已登录账号。插件不保存密钥；各币种独立展示，不折算合计。`,
        "utility.version.title": `插件版本`,
        "utility.version.unchecked": `尚未检查`,
        "utility.version.disabled": `自动检查已关闭，仍可手动检查`,
        "utility.version.failed": `版本检查失败，请重试`,
        "utility.version.current": `已是最新版本 · {version}`,
        "utility.version.update": `发现新版本 · {version}`,
        "utility.version.check": `检查新版本`,
        "utility.version.open": `前往 npm 查看更新`,
        "utility.version.hint": `开启后会访问 registry.npmjs.org 检查已安装包的新版本；关闭后仍可手动检查。`,
      },
      xt = `sessions-insight`
    let St
    function Ct(e) {
      St = e
    }
    function wt(e, t) {
      return t === void 0
        ? e
        : e.replace(/\{(\w+)\}/g, (e, n) => {
            const r = t[n]
            return r === void 0 ? e : String(r)
          })
    }
    function Y(e, t) {
      const n = St?.(e, t)
      return n !== void 0 && n !== `` ? n : wt(yt[e], t)
    }
    const Tt = class {
      sources
      workdirs
      sessions = /* @__PURE__ */ new Map()
      #e = /* @__PURE__ */ new Map()
      #t = /* @__PURE__ */ new Map()
      projectSessions(e) {
        return {
          ...e,
          sessions: e.sessions.map((e) => {
            let t = `${e.source}:${e.id}`,
              n = this.#t.get(t),
              r =
                n !== void 0 && n.bytes === e.bytes && n.updatedAt === e.updatedAt
                  ? {
                      ...e,
                      ...(n.title === void 0 ? {} : { title: n.title }),
                      ...(n.firstInput === void 0 ? {} : { firstInput: n.firstInput }),
                    }
                  : e,
              i = this.#e.get(t)
            if (i === void 0) return r
            let a = { ...r }
            return (i.displayTitle === void 0 ? delete a.title : (a.title = i.displayTitle), a)
          }),
        }
      }
      #n = /* @__PURE__ */ new Map()
      #r = /* @__PURE__ */ new Set()
      #i = 0
      deletionVersion = () => this.#i
      subscribe = (e) => (
        this.#r.add(e),
        () => {
          this.#r.delete(e)
        }
      )
      invalidateRequests(e = this.#n.keys()) {
        for (let t of e) {
          let e = this.#n.get(t)
          ;(this.#n.delete(t), e?.controller.abort())
        }
      }
      async read(e, t, n, r) {
        if (r?.aborted) return { ok: !1, error: `aborted` }
        let i = this.#n.get(e)
        if (i === void 0) {
          let r = new AbortController()
          ;((i = {
            controller: r,
            promise: t(r.signal)
              .then((t) => (this.#n.get(e) === i ? (t.ok && n(t.value), t) : { ok: !1, error: `aborted` }))
              .finally(() => {
                this.#n.get(e) === i && this.#n.delete(e)
              }),
            readers: 0,
          }),
            this.#n.set(e, i))
        }
        let a = i
        return (
          (a.readers += 1),
          new Promise((t, n) => {
            let i = !1,
              o = (o, c) => {
                i ||
                  ((i = !0),
                  r?.removeEventListener(`abort`, s),
                  --a.readers,
                  a.readers === 0 && this.#n.get(e) === a && (this.#n.delete(e), a.controller.abort()),
                  o === void 0 ? n(c) : t(o))
              },
              s = () => o({ ok: !1, error: `aborted` })
            ;(r?.addEventListener(`abort`, s, { once: !0 }),
              a.promise.then(
                (e) => o(e),
                (e) => o(void 0, e),
              ),
              r?.aborted && s())
          })
        )
      }
      learnSessionLabel(e) {
        let t = `${e.source}:${e.id}`,
          n = this.sessions.get(e.workdir),
          r = n?.sessions.find((t) => t.source === e.source && t.id === e.id),
          i = this.#t.get(t),
          a = r?.updatedAt ?? e.updatedAt,
          o = i?.bytes === e.bytes && i.updatedAt === a,
          s = e.title?.trim() || (o ? i.title : void 0),
          c = e.firstInput?.trim() || (o ? i.firstInput : void 0)
        if (
          !(o && i.title === s && i.firstInput === c) &&
          (s !== void 0 || c !== void 0) &&
          (this.#t.set(t, {
            bytes: e.bytes,
            updatedAt: a,
            ...(s === void 0 ? {} : { title: s }),
            ...(c === void 0 ? {} : { firstInput: c }),
          }),
          n !== void 0)
        ) {
          ;(this.sessions.set(e.workdir, this.projectSessions(n)), (this.#i += 1))
          for (let e of this.#r) e()
        }
      }
      rename(e) {
        let { source: t, id: n } = e.metadata
        this.#e.set(`${t}:${n}`, e)
        for (let [r, i] of this.sessions)
          i.sessions.some((e) => e.source === t && e.id === n) &&
            (this.invalidateRequests([`sessions:${r}`]),
            this.sessions.set(r, {
              ...i,
              sessions: i.sessions.map((r) => {
                if (r.source !== t || r.id !== n) return r
                let i = { ...r }
                return (e.displayTitle === void 0 ? delete i.title : (i.title = e.displayTitle), i)
              }),
            }))
        this.#i += 1
        for (let e of this.#r) e()
      }
      remove(e) {
        ;(this.#t.delete(`${e.source}:${e.id}`),
          this.invalidateRequests([`sources`, `workdirs:false`, `workdirs:true`, `sessions:${e.workdir}`]))
        for (let [t, n] of this.sessions)
          this.sessions.set(t, { ...n, sessions: n.sessions.filter((t) => t.source !== e.source || t.id !== e.id) })
        ;(this.sources !== void 0 &&
          (this.sources = {
            sources: this.sources.sources.map((t) =>
              t.source === e.source && t.sessions !== void 0 ? { ...t, sessions: Math.max(0, t.sessions - 1) } : t,
            ),
          }),
          this.workdirs !== void 0 &&
            (this.workdirs = {
              ...this.workdirs,
              workdirs: this.workdirs.workdirs
                .map((t) => {
                  if (t.workdir !== e.workdir) return t
                  let n = this.sessions.get(t.workdir)?.sessions,
                    r = t.sources
                      .map((t) => {
                        if (t.source !== e.source) return t
                        let r = n?.filter((e) => e.source === t.source)
                        return {
                          ...t,
                          sessions: Math.max(0, t.sessions - 1),
                          lastUpdatedAt: r === void 0 ? t.lastUpdatedAt : Math.max(0, ...r.map((e) => e.updatedAt)),
                        }
                      })
                      .filter((e) => e.sessions > 0)
                  return {
                    ...t,
                    sessions: r.reduce((e, t) => e + t.sessions, 0),
                    lastUpdatedAt: Math.max(0, ...r.map((e) => e.lastUpdatedAt)),
                    sources: r,
                  }
                })
                .filter((e) => e.sessions > 0),
            }),
          (this.#i += 1))
        for (let e of this.#r) e()
      }
    }
    const Et = /* @__PURE__ */ new Map()
    function Dt(e = ``) {
      let t = Et.get(e)
      return (t === void 0 && ((t = new Tt()), Et.set(e, t)), t)
    }
    function Ot(e, t, n) {
      return h({ url: e, guard: t, codes: ie, signal: n })
    }
    function kt(e, t, n, r) {
      return h({ url: e, guard: n, codes: ie, signal: r, method: `POST`, body: t })
    }
    function At(e = ``) {
      const t = Dt(e)
      return {
        balance: (t = !1, n) => {
          const r = new URLSearchParams({
            locale: Y(`handoff.language`) === `zh` ? `zh-CN` : `en-US`,
            timezoneOffsetSeconds: String(-/* @__PURE__ */ new Date().getTimezoneOffset() * 60),
          })
          return (t && r.set(`refresh`, `1`), Ot(`${e}api/dsh-sessions-insight/balance?${r}`, dt, n))
        },
        version: (t = !1, n) => Ot(`${e  }api/dsh-sessions-insight/version${  t ? `?check=1` : ``}`, ft, n),
        settings: (t) => Ot(`${e  }api/dsh-sessions-insight/settings`, Xe, t),
        deleteSession: (t, n) => kt(e + B, { source: t, id: n }, Ee),
        metadata: (t) => Ot(e + V, W, t),
        updateMetadata: (t) => kt(e + V, t, re),
        suggestTitle: (t, n, r) => kt(e + Ue, { source: t, id: n }, Ge, r),
        sources: (n) =>
          t.read(
            `sources`,
            (t) => Ot(e + j, fe, t),
            (e) => {
              t.sources = e
            },
            n,
          ),
        workdirs: (n, r = !1) =>
          t.read(
            `workdirs:${String(r)}`,
            (t) => Ot(e + M + (r ? `?refresh=1` : ``), we, t),
            (e) => {
              t.workdirs = e
            },
            n,
          ),
        sessions: (n, r) =>
          t.read(
            `sessions:${n}`,
            (r) =>
              Ot(`${e}${N}?workdir=${encodeURIComponent(n)}`, Te, r).then((e) =>
                e.ok ? { ok: !0, value: t.projectSessions(e.value) } : e,
              ),
            (e) => {
              t.sessions.set(n, e)
            },
            r,
          ),
        session: (n, r, i, a, o) =>
          Ot(
            `${e}${P}?source=${encodeURIComponent(a)}&id=${encodeURIComponent(n)}&turnOffset=${String(r)}&turnLimit=${String(i)}`,
            De,
            o,
          ).then(
            (e) => (
              e.ok && !o?.aborted && t.learnSessionLabel({ ...e.value.session, id: n, bytes: e.value.meta.bytes }),
              e
            ),
          ),
        search: (t, n, r, i, a) =>
          Ot(`${e}${F}?q=${encodeURIComponent(t)}&limit=${String(n)}&tier=${r}&cursor=${String(i)}`, ye, a),
        cost: (t, n, r) => Ot(`${e}${z}?source=${encodeURIComponent(t)}&id=${encodeURIComponent(n)}`, J, r),
        handoffPrepare: (t, n, r) => kt(e + I, { source: t, id: n, locale: Y(`handoff.language`) }, me, r),
        handoffApply: (t, n) => kt(e + L, t, he, n),
        handoffReveal: (t) => kt(e + ee, { source: `dsh`, id: t }, _e),
        handoffStatus: (t, n) => Ot(`${e}${R}?sessionId=${encodeURIComponent(t)}`, ge, n),
      }
    }
    async function jt(e = At(), t) {
      const [, n] = await Promise.all([e.sources(t), e.workdirs(t)])
      if (t?.aborted || !n.ok) return
      const r = n.value.workdirs[0]
      r !== void 0 && (await e.sessions(r.workdir, t))
    }
    function Mt(e) {
      return e.detail === void 0 ? e.error : `${e.error}: ${e.detail}`
    }
    function Nt(e) {
      return e.failure === `save` && e.status === `ready` && e.writable
        ? `save-failed`
        : e.status === `loading`
          ? `loading`
          : e.status === `ready` && e.writable
            ? `ready`
            : `unavailable`
    }
    const Pt = class {
      snapshot = { value: { ...Je }, status: `loading`, writable: !1, pending: !1, failure: null, detail: null }
      listeners = /* @__PURE__ */ new Set()
      form
      api
      lastWrite
      getSnapshot = () => this.snapshot
      subscribe = (e) => (
        this.listeners.add(e),
        () => {
          this.listeners.delete(e)
        }
      )
      publish(e) {
        this.snapshot = e
        for (let e of this.listeners) e()
      }
      attach(e) {
        this.form = e
        let t = () => {
            if (this.form !== e) return
            let t = e.getSnapshot(),
              n = t.status === `ready`
            this.publish({
              ...this.snapshot,
              status: t.status,
              writable: n && t.writable,
              value: n ? Ze(t.value) : this.snapshot.value,
              failure: n ? null : this.snapshot.failure,
              detail: n ? null : this.snapshot.detail,
            })
          },
          n = e.subscribe(t)
        return (
          t(),
          () => {
            ;(n(),
              this.form === e &&
                ((this.form = void 0),
                this.publish({ ...this.snapshot, status: `unavailable`, writable: !1, pending: !1 })))
          }
        )
      }
      async load(e, t) {
        this.api = e
        let n = this.form
        ;(n !== void 0 && n.getSnapshot().status === `ready` && n.getSnapshot().writable) || (await this.read(e, t))
      }
      async read(e, t) {
        let n
        try {
          n = await e.settings(t)
        } catch {
          n = { ok: !1, error: `network` }
        }
        t.aborted ||
          ((this.form === void 0 || this.form.getSnapshot().status !== `ready`) &&
            this.publish(
              n.ok
                ? { ...this.snapshot, status: `ready`, writable: !1, value: n.value, failure: null, detail: null }
                : {
                    ...this.snapshot,
                    status: `unavailable`,
                    writable: !1,
                    failure: `read`,
                    detail: n.detail ?? n.error,
                  },
            ))
      }
      async set(e, t) {
        let n = this.form
        if (n === void 0 || !this.snapshot.writable || this.snapshot.pending) return !1
        ;((this.lastWrite = { key: e, value: t }),
          this.publish({ ...this.snapshot, pending: !0, failure: null, detail: null }))
        let r = !1
        try {
          r = await n.set(e, t)
        } catch {
          r = !1
        }
        return (this.form === n && this.publish({ ...this.snapshot, pending: !1, failure: r ? null : `save` }), r)
      }
      async retry() {
        if (Nt(this.snapshot) === `save-failed`) {
          let e = this.lastWrite
          e !== void 0 && (await this.set(e.key, e.value))
          return
        }
        let e = this.api
        e !== void 0 &&
          (this.publish({ ...this.snapshot, status: `loading`, failure: null, detail: null }),
          await this.load(e, new AbortController().signal))
      }
    }
    function Ft(e, t) {
      const n = (0, l.useSyncExternalStore)(e.subscribe, e.getSnapshot, e.getSnapshot)
      return (
        (0, l.useEffect)(() => {
          if (t === void 0) return
          const n = new AbortController()
          return (e.load(t, n.signal), () => n.abort())
        }, [e, t]),
        n
      )
    }
    const It = [
      { title: `settings.modules`, keys: [`sessionOverview`, `skillsTab`, `waterfall`, `defaultToolsExpanded`] },
      { title: `settings.utilities`, keys: [`deepseekBalance`, `autoCheckVersion`] },
    ]
    function Lt(e) {
      return e.failure === `read`
        ? Y(`settings.readFailed`, { detail: e.detail ?? `—` })
        : e.status === `ready`
          ? Y(`settings.readonly`)
          : Y(`settings.unavailable`)
    }
    function Rt({ store: e }) {
      return /* @__PURE__ */ (0, u.jsx)(`button`, {
        type: `button`,
        className: `ci-btn self-start`,
        onClick: () => void e.retry(),
        children: Y(`settings.retry`),
      })
    }
    function zt({ store: e, snapshot: t, state: n }) {
      return n === `loading`
        ? /* @__PURE__ */ (0, u.jsx)(`p`, {
            role: `status`,
            className: `m-0 text-xs text-fg-dim`,
            children: Y(`settings.loading`),
          })
        : n === `unavailable`
          ? /* @__PURE__ */ (0, u.jsxs)(`div`, {
              role: `alert`,
              className: `flex flex-col gap-2 rounded-xl border border-err/40 bg-err/5 p-4`,
              children: [
                /* @__PURE__ */ (0, u.jsx)(`p`, { className: `m-0 text-sm text-err`, children: Lt(t) }),
                /* @__PURE__ */ (0, u.jsx)(`p`, {
                  className: `m-0 text-xs text-fg-dim`,
                  children: Y(`settings.requiresHost`),
                }),
                /* @__PURE__ */ (0, u.jsx)(Rt, { store: e }),
              ],
            })
          : n === `save-failed`
            ? /* @__PURE__ */ (0, u.jsxs)(`div`, {
                role: `alert`,
                className: `flex flex-col gap-2 rounded-xl border border-warn/40 bg-warn/6 p-4`,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(`p`, {
                    className: `m-0 text-sm text-warn`,
                    children: Y(`settings.saveFailed`),
                  }),
                  /* @__PURE__ */ (0, u.jsx)(Rt, { store: e }),
                ],
              })
            : /* @__PURE__ */ (0, u.jsx)(`p`, {
                role: `status`,
                className: `m-0 text-xs text-fg-dim`,
                children: t.pending ? Y(`settings.saving`) : Y(`settings.saved`),
              })
    }
    function Bt({ id: e, name: t, store: n, snapshot: r }) {
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `flex items-center justify-between gap-4 border-b border-line-soft p-4 last:border-b-0`,
        children: [
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `flex min-w-0 flex-col gap-1`,
            children: [
              /* @__PURE__ */ (0, u.jsx)(`label`, {
                id: `${e}-${t}`,
                htmlFor: `${e}-${t}-switch`,
                className: `text-sm font-medium`,
                children: Y(`settings.${t}`),
              }),
              /* @__PURE__ */ (0, u.jsx)(`p`, {
                id: `${e}-${t}-hint`,
                className: `m-0 text-xs text-fg-dim`,
                children: Y(`settings.${t}.hint`),
              }),
            ],
          }),
          /* @__PURE__ */ (0, u.jsx)(`button`, {
            id: `${e}-${t}-switch`,
            type: `button`,
            role: `switch`,
            "aria-checked": r.value[t],
            "aria-labelledby": `${e}-${t}`,
            "aria-describedby": `${e}-${t}-hint`,
            disabled: !r.writable || r.pending,
            className: `relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50 ${r.value[t] ? `bg-accent` : `bg-bg-3`}`,
            onClick: () => {
              n.set(t, !r.value[t])
            },
            children: /* @__PURE__ */ (0, u.jsx)(`span`, {
              "aria-hidden": `true`,
              className: `h-5 w-5 rounded-full bg-bg ${r.value[t] ? `ms-auto` : `me-auto`}`,
            }),
          }),
        ],
      })
    }
    function Vt({ store: e, api: t, sections: n }) {
      const r = Ft(e, t),
        i = Nt(r),
        a = (0, l.useId)(),
        o = r.status === `ready`
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `flex min-w-0 flex-col gap-6`,
        children: [
          i === `unavailable` || i === `loading`
            ? /* @__PURE__ */ (0, u.jsx)(zt, { store: e, snapshot: r, state: i })
            : null,
          o
            ? /* @__PURE__ */ (0, u.jsxs)(u.Fragment, {
                children: [
                  It.map((t) =>
                    /* @__PURE__ */ (0, u.jsxs)(
                      `section`,
                      {
                        "aria-labelledby": `${a}-${t.title}`,
                        className: `flex flex-col gap-2`,
                        children: [
                          /* @__PURE__ */ (0, u.jsx)(`h2`, {
                            id: `${a}-${t.title}`,
                            className: `m-0 text-sm font-semibold`,
                            children: Y(t.title),
                          }),
                          /* @__PURE__ */ (0, u.jsx)(`div`, {
                            className: `overflow-clip rounded-xl border border-line-soft bg-bg-1`,
                            children: t.keys.map((t) =>
                              /* @__PURE__ */ (0, u.jsx)(Bt, { id: a, name: t, store: e, snapshot: r }, t),
                            ),
                          }),
                        ],
                      },
                      t.title,
                    ),
                  ),
                  n?.balance,
                  n?.version,
                ],
              })
            : null,
          i === `ready` || i === `save-failed`
            ? /* @__PURE__ */ (0, u.jsx)(zt, { store: e, snapshot: r, state: i })
            : null,
        ],
      })
    }
    function Ht({ store: e, api: t, sections: n }) {
      return /* @__PURE__ */ (0, u.jsx)(`div`, {
        className: `ci-panel`,
        "data-dsh-sessions-insight-view": ``,
        style: { color: `var(--color-fg)`, minInlineSize: 0 },
        children: /* @__PURE__ */ (0, u.jsx)(`div`, {
          className: `mx-auto flex w-full max-w-3xl flex-col`,
          children: /* @__PURE__ */ (0, u.jsx)(Vt, { store: e, api: t, sections: n }),
        }),
      })
    }
    function Ut() {
      return /* @__PURE__ */ (0, u.jsx)(`span`, { children: Y(`settings.summary`) })
    }
    function Wt({ store: e, api: t, onBack: n, sections: r }) {
      return /* @__PURE__ */ (0, u.jsx)(`div`, {
        className: `ci-panel`,
        "data-dsh-sessions-insight-view": ``,
        style: {
          color: `var(--color-fg)`,
          background: `var(--color-bg)`,
          minInlineSize: 0,
          blockSize: `100%`,
          overflow: `auto`,
        },
        children: /* @__PURE__ */ (0, u.jsxs)(`div`, {
          className: `mx-auto flex w-full max-w-3xl flex-col gap-6 p-5`,
          children: [
            /* @__PURE__ */ (0, u.jsxs)(`header`, {
              className: `flex flex-col gap-2`,
              children: [
                n === void 0
                  ? null
                  : /* @__PURE__ */ (0, u.jsx)(`button`, {
                      type: `button`,
                      className: `ci-btn self-start active:bg-bg-3`,
                      onClick: n,
                      children: Y(`settings.back`),
                    }),
                /* @__PURE__ */ (0, u.jsx)(`h1`, {
                  className: `m-0 text-lg font-semibold`,
                  children: Y(`settings.title`),
                }),
                /* @__PURE__ */ (0, u.jsx)(`p`, {
                  className: `m-0 text-sm text-fg-dim`,
                  children: Y(`settings.intro`),
                }),
              ],
            }),
            /* @__PURE__ */ (0, u.jsx)(Vt, { store: e, api: t, sections: r }),
          ],
        }),
      })
    }
    function Gt(e, t, n, r) {
      const i = ({ view: e }) =>
        e === `summary`
          ? /* @__PURE__ */ (0, u.jsx)(Ut, {})
          : /* @__PURE__ */ (0, u.jsx)(Ht, { store: t, api: r, sections: n })
      try {
        e.inject?.([`configForms`], (e) => {
          try {
            const n = e.configForms,
              r = () => {
                let r = Ke.map((e) => n.get(e)),
                  a,
                  o,
                  s = () => {
                    let e = r.findIndex((e) => e.getSnapshot().status === `ready`)
                    e !== a && (o?.(), (a = e), (o = e < 0 ? void 0 : t.attach(r[e])))
                  },
                  c = r.map((e) => e.subscribe(s))
                s()
                let l = n.whileServed(Ke, () => {
                  let t = qe.map((t) =>
                    e.slots.inject(`plugins.bundle.config`, () =>
                      e.slots.register({ name: `plugins.bundle.config`, key: t, locale: xt }, i),
                    ),
                  )
                  return () => {
                    for (let e of t) e()
                  }
                })
                return () => {
                  l()
                  for (let e of c) e()
                  o?.()
                }
              }
            e.effect === void 0 ? r() : e.effect(r, `sessions-insight: configuration forms and package details`)
          } catch (e) {
            console.warn(`[sessions-insight] settings registration failed`, e)
          }
        })
      } catch (e) {
        console.warn(`[sessions-insight] settings registration failed`, e)
      }
    }
    const Kt = `@cyrusdoyle/dsh-sessions-insight`
    const qt = class {
      read
      apply
      pending
      disposed
      flight
      queued
      controller
      generation = 0
      constructor(e, t, n, r) {
        ;((this.read = e), (this.apply = t), (this.pending = n), (this.disposed = r))
      }
      request(e, t) {
        return this.disposed()
          ? Promise.resolve()
          : this.flight === void 0
            ? !e && t()
              ? Promise.resolve()
              : this.launch(e)
            : e
              ? this.enqueue()
              : this.flight
      }
      enqueue() {
        if (this.queued !== void 0) return this.queued
        let e = (this.flight ?? Promise.resolve()).then(() => ((this.queued = void 0), this.request(!0, () => !1)))
        return ((this.queued = e), e)
      }
      launch(e) {
        let t = ++this.generation,
          n = new AbortController()
        ;((this.controller = n), this.pending(!0))
        let r = this.read(e, n.signal)
          .then((e) => {
            this.current(t) && e !== void 0 && this.apply(e)
          })
          .catch(() => {})
          .finally(() => {
            ;(this.controller === n && (this.controller = void 0),
              this.flight === r && (this.flight = void 0),
              this.current(t) && this.pending(!1))
          })
        return ((this.flight = r), r)
      }
      current(e) {
        return !this.disposed() && e === this.generation
      }
      dispose() {
        this.controller?.abort()
      }
    }
    function Jt(e, t) {
      return t === 404 || t === 401 || t === 403 || e === `network`
        ? `host-unavailable`
        : t === 429
          ? `rate-limited`
          : t !== void 0 && t >= 400
            ? `http-error`
            : `invalid-response`
    }
    const Yt = class {
      api
      snapshot = { balance: null, version: null, balancePending: !1, versionPending: !1 }
      listeners = /* @__PURE__ */ new Set()
      balanceAt = 0
      versionAt = 0
      disposed = !1
      balance
      version
      constructor(e) {
        ;((this.api = e),
          (this.balance = new qt(
            this.readBalance,
            (e) => {
              ;(e.answered && (this.balanceAt = Date.now()), this.publish({ balance: e.value }))
            },
            (e) => this.publish({ balancePending: e }),
            () => this.disposed,
          )),
          (this.version = new qt(
            this.readVersion,
            (e) => {
              ;(e.answered && (this.versionAt = Date.now()), this.publish({ version: e.value }))
            },
            (e) => this.publish({ versionPending: e }),
            () => this.disposed,
          )))
      }
      getSnapshot = () => this.snapshot
      subscribe = (e) => (
        this.listeners.add(e),
        () => {
          this.listeners.delete(e)
        }
      )
      publish(e) {
        if (!this.disposed) {
          this.snapshot = { ...this.snapshot, ...e }
          for (let e of this.listeners) e()
        }
      }
      readBalance = async (e, t) =>
        await this.read(this.api.balance(e, t), (e) => {
          if (!e.ok)
            return { value: { status: `failed`, checkedAt: Date.now(), reason: Jt(e.error, e.status) }, answered: !0 }
          if (!dt(e.value))
            return { value: { status: `failed`, checkedAt: Date.now(), reason: `invalid-response` }, answered: !0 }
          if (e.value.status === `failed`) {
            let { checkedAt: t, reason: n, source: r } = e.value
            return { value: { status: `failed`, checkedAt: t, reason: n, source: r }, answered: !0 }
          }
          return { value: e.value, answered: !0 }
        })
      readVersion = async (e, t) =>
        await this.read(this.api.version(e, t), (e) =>
          e.ok
            ? { value: e.value, answered: !0 }
            : {
                value: {
                  status: `failed`,
                  packageName: this.snapshot.version?.packageName ?? Kt,
                  currentVersion: this.snapshot.version?.currentVersion ?? ``,
                  checkedAt: Date.now(),
                },
                answered: !0,
              },
        )
      async read(e, t) {
        let n = !0,
          r = await e.catch(() => ((n = !1), { ok: !1, error: `network` }))
        if (!r.ok && r.error === `aborted`) return
        let i = t(r)
        return { ...i, answered: n && i.answered }
      }
      refreshBalance = (e = !0) =>
        this.balance.request(e, () => this.balanceAt > 0 && Date.now() - this.balanceAt < 3e4)
      checkVersion = (e = !0) => this.version.request(e, () => this.versionAt > 0 && Date.now() - this.versionAt < 36e5)
      dispose() {
        ;((this.disposed = !0), this.balance.dispose(), this.version.dispose(), this.listeners.clear())
      }
    }
    function Xt(e, t) {
      const n = Ft(t),
        r = (0, l.useSyncExternalStore)(e.subscribe, e.getSnapshot, e.getSnapshot)
      return (
        (0, l.useEffect)(() => {
          n.status === `ready` &&
            (n.value.deepseekBalance && e.refreshBalance(!1), n.value.autoCheckVersion && e.checkVersion(!1))
        }, [e, n.status, n.value.deepseekBalance, n.value.autoCheckVersion]),
        r
      )
    }
    function Zt() {
      y(
        `dsh-sessions-insight-styles`,
        `/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */
@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))){*,:before,:after,::backdrop{--tw-rotate-x:initial;--tw-rotate-y:initial;--tw-rotate-z:initial;--tw-skew-x:initial;--tw-skew-y:initial;--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-tracking:initial;--tw-ordinal:initial;--tw-slashed-zero:initial;--tw-numeric-figure:initial;--tw-numeric-spacing:initial;--tw-numeric-fraction:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-outline-style:solid;--tw-blur:initial;--tw-brightness:initial;--tw-contrast:initial;--tw-grayscale:initial;--tw-hue-rotate:initial;--tw-invert:initial;--tw-opacity:initial;--tw-saturate:initial;--tw-sepia:initial;--tw-drop-shadow:initial;--tw-drop-shadow-color:initial;--tw-drop-shadow-alpha:100%;--tw-drop-shadow-size:initial;--tw-duration:initial;--tw-ease:initial;--tw-content:""}}}@layer theme{.ci-panel{--font-mono:ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;--color-black:#000;--color-white:#fff;--spacing:.25rem;--container-md:28rem;--container-xl:36rem;--container-3xl:48rem;--text-xs:.75rem;--text-xs--line-height:calc(1 / .75);--text-sm:.875rem;--text-sm--line-height:calc(1.25 / .875);--text-lg:1.125rem;--text-lg--line-height:calc(1.75 / 1.125);--font-weight-normal:400;--font-weight-medium:500;--font-weight-semibold:600;--tracking-normal:0em;--leading-tight:1.25;--leading-snug:1.375;--leading-normal:1.5;--leading-relaxed:1.625;--radius-xs:.125rem;--radius-sm:.25rem;--radius-md:.375rem;--radius-lg:.5rem;--radius-xl:.75rem;--ease-out:cubic-bezier(.23, 1, .32, 1);--ease-in-out:cubic-bezier(.77, 0, .175, 1);--animate-spin:spin 1s linear infinite;--animate-pulse:pulse 2s cubic-bezier(.4, 0, .6, 1) infinite;--default-transition-duration:.15s;--default-transition-timing-function:cubic-bezier(.4, 0, .2, 1);--color-fg:var(--dsw-alias-label-primary,light-dark(oklch(22% 0 none),oklch(93% 0 none)));--color-fg-dim:var(--dsw-alias-label-secondary,light-dark(oklch(46% 0 none),oklch(68% 0 none)));--color-bg:var(--dsw-alias-bg-base,light-dark(oklch(100% 0 none),oklch(19% 0 none)));--color-bg-1:var(--dsw-alias-bg-layer-1,light-dark(oklch(97% 0 none),oklch(23% 0 none)));--color-bg-2:var(--dsw-alias-bg-layer-2,light-dark(oklch(94% 0 none),oklch(27% 0 none)));--color-bg-3:var(--dsw-alias-bg-layer-3,light-dark(oklch(91% 0 none),oklch(31% 0 none)));--color-fg-3:var(--dsw-alias-label-tertiary,light-dark(oklch(60% 0 none),oklch(56% 0 none)));--color-hover:var(--dsw-alias-interactive-bg-hover,light-dark(oklch(22% 0 none/.06),oklch(100% 0 none/.07)));--color-line:var(--dsw-alias-border-l2,light-dark(oklch(86% 0 none),oklch(34% 0 none)));--color-line-soft:var(--dsw-alias-border-l1,light-dark(oklch(91% 0 none),oklch(28% 0 none)));--color-accent:var(--dsw-alias-brand-primary,light-dark(oklch(52% .17 264),oklch(62% .15 264)));--color-ok:var(--dsw-alias-state-success-primary,light-dark(oklch(50% .14 152),oklch(72% .15 152)));--color-warn:var(--dsw-alias-state-warn-primary,light-dark(oklch(55% .12 82),oklch(78% .13 82)));--color-err:var(--dsw-alias-state-error-primary,light-dark(oklch(52% .18 22),oklch(68% .17 22)));--color-info:light-dark(oklch(55% .16 262),oklch(72% .15 264));--color-sidebar:var(--dsw-specific-sidebar-fill,var(--color-bg-1));--color-part-system-prompt:#6f86b8;--color-part-tool-definitions:#9a7fc4;--color-part-memory-instructions:#4f9e9a;--color-part-referenced-files:#6aa46f;--color-part-history:#b08a5a;--color-part-tool-results:#c47f7f;--color-part-images:#7f9aa8;--color-part-user-input:#8fa86a;--color-part-assistant-output:#a97fa8;--color-part-thinking:#7f7f8f}}@scope (.ci-panel) {
@layer utilities{.\\@container{container-type:inline-size!important}.pointer-events-none{pointer-events:none!important}.collapse{visibility:collapse!important}.invisible{visibility:hidden!important}.visible{visibility:visible!important}.absolute{position:absolute!important}.fixed{position:fixed!important}.relative{position:relative!important}.sticky{position:sticky!important}.inset-0{inset:0!important}.inset-e-2{inset-inline-end:calc(var(--spacing) * 2)!important}.top-0{top:0!important}.isolate{isolation:isolate!important}.z-10{z-index:10!important}.z-50{z-index:50!important}.z-60{z-index:60!important}.col-start-1{grid-column-start:1!important}.row-start-1{grid-row-start:1!important}.container{width:100%!important}@media (min-width:40rem){.container{max-width:40rem!important}}@media (min-width:48rem){.container{max-width:48rem!important}}@media (min-width:64rem){.container{max-width:64rem!important}}@media (min-width:80rem){.container{max-width:80rem!important}}@media (min-width:96rem){.container{max-width:96rem!important}}.m-0{margin:0!important}.mx-1{margin-inline:var(--spacing)!important}.mx-1\\.5{margin-inline:calc(var(--spacing) * 1.5)!important}.mx-4{margin-inline:calc(var(--spacing) * 4)!important}.mx-auto{margin-inline:auto!important}.my-0{margin-block:0!important}.my-1{margin-block:var(--spacing)!important}.my-1\\.5{margin-block:calc(var(--spacing) * 1.5)!important}.my-2{margin-block:calc(var(--spacing) * 2)!important}.my-2\\.5{margin-block:calc(var(--spacing) * 2.5)!important}.my-px{margin-block:1px!important}.ms-1{margin-inline-start:var(--spacing)!important}.ms-2{margin-inline-start:calc(var(--spacing) * 2)!important}.ms-3{margin-inline-start:calc(var(--spacing) * 3)!important}.ms-3\\.25{margin-inline-start:calc(var(--spacing) * 3.25)!important}.ms-4{margin-inline-start:calc(var(--spacing) * 4)!important}.ms-5{margin-inline-start:calc(var(--spacing) * 5)!important}.ms-6{margin-inline-start:calc(var(--spacing) * 6)!important}.ms-auto{margin-inline-start:auto!important}.me-4{margin-inline-end:calc(var(--spacing) * 4)!important}.me-auto{margin-inline-end:auto!important}.mbs-2{margin-block-start:calc(var(--spacing) * 2)!important}.mbs-3{margin-block-start:calc(var(--spacing) * 3)!important}.mt-0{margin-top:0!important}.mt-0\\.5{margin-top:calc(var(--spacing) * .5)!important}.mt-1{margin-top:var(--spacing)!important}.mt-1\\.5{margin-top:calc(var(--spacing) * 1.5)!important}.mt-2{margin-top:calc(var(--spacing) * 2)!important}.mt-2\\.5{margin-top:calc(var(--spacing) * 2.5)!important}.mt-3{margin-top:calc(var(--spacing) * 3)!important}.mt-auto{margin-top:auto!important}.mb-0{margin-bottom:0!important}.mb-1{margin-bottom:var(--spacing)!important}.mb-2{margin-bottom:calc(var(--spacing) * 2)!important}.mb-2\\.5{margin-bottom:calc(var(--spacing) * 2.5)!important}.box-border{box-sizing:border-box!important}.line-clamp-2{-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;display:-webkit-box!important;overflow:hidden!important}.block{display:block!important}.contents{display:contents!important}.flex{display:flex!important}.grid{display:grid!important}.hidden{display:none!important}.inline{display:inline!important}.inline-block{display:inline-block!important}.inline-flex{display:inline-flex!important}.inline-grid{display:inline-grid!important}.table{display:table!important}.size-1{width:var(--spacing)!important;height:var(--spacing)!important}.size-1\\.5{width:calc(var(--spacing) * 1.5)!important;height:calc(var(--spacing) * 1.5)!important}.size-4{width:calc(var(--spacing) * 4)!important;height:calc(var(--spacing) * 4)!important}.h-1{height:var(--spacing)!important}.h-1\\.5{height:calc(var(--spacing) * 1.5)!important}.h-2{height:calc(var(--spacing) * 2)!important}.h-2\\.5{height:calc(var(--spacing) * 2.5)!important}.h-3{height:calc(var(--spacing) * 3)!important}.h-3\\.5{height:calc(var(--spacing) * 3.5)!important}.h-4{height:calc(var(--spacing) * 4)!important}.h-4\\.5{height:calc(var(--spacing) * 4.5)!important}.h-5{height:calc(var(--spacing) * 5)!important}.h-6{height:calc(var(--spacing) * 6)!important}.h-7{height:calc(var(--spacing) * 7)!important}.h-8{height:calc(var(--spacing) * 8)!important}.h-9{height:calc(var(--spacing) * 9)!important}.h-10{height:calc(var(--spacing) * 10)!important}.h-12{height:calc(var(--spacing) * 12)!important}.h-14{height:calc(var(--spacing) * 14)!important}.h-20{height:calc(var(--spacing) * 20)!important}.h-24{height:calc(var(--spacing) * 24)!important}.h-28{height:calc(var(--spacing) * 28)!important}.h-32{height:calc(var(--spacing) * 32)!important}.h-36{height:calc(var(--spacing) * 36)!important}.h-40{height:calc(var(--spacing) * 40)!important}.h-44{height:calc(var(--spacing) * 44)!important}.h-\\[74px\\]{height:74px!important}.h-\\[min\\(300px\\,42dvh\\)\\]{height:min(300px,42dvh)!important}.h-full{height:100%!important}.h-px{height:1px!important}.max-h-\\(--available-height\\){max-height:var(--available-height)!important}.max-h-55{max-height:calc(var(--spacing) * 55)!important}.max-h-64{max-height:calc(var(--spacing) * 64)!important}.max-h-80{max-height:calc(var(--spacing) * 80)!important}.max-h-\\[42dvh\\]{max-height:42dvh!important}.max-h-\\[70vh\\]{max-height:70vh!important}.max-h-\\[90dvh\\]{max-height:90dvh!important}.max-h-full{max-height:100%!important}.min-h-0{min-height:0!important}.min-h-8{min-height:calc(var(--spacing) * 8)!important}.min-h-9{min-height:calc(var(--spacing) * 9)!important}.min-h-10{min-height:calc(var(--spacing) * 10)!important}.min-h-40{min-height:calc(var(--spacing) * 40)!important}.min-h-50{min-height:calc(var(--spacing) * 50)!important}.w-\\(--anchor-width\\){width:var(--anchor-width)!important}.w-1{width:var(--spacing)!important}.w-1\\/2{width:50%!important}.w-2{width:calc(var(--spacing) * 2)!important}.w-2\\.5{width:calc(var(--spacing) * 2.5)!important}.w-3{width:calc(var(--spacing) * 3)!important}.w-3\\.5{width:calc(var(--spacing) * 3.5)!important}.w-3\\/4{width:75%!important}.w-5{width:calc(var(--spacing) * 5)!important}.w-6{width:calc(var(--spacing) * 6)!important}.w-12{width:calc(var(--spacing) * 12)!important}.w-28{width:calc(var(--spacing) * 28)!important}.w-32{width:calc(var(--spacing) * 32)!important}.w-40{width:calc(var(--spacing) * 40)!important}.w-\\[46\\%\\]{width:46%!important}.w-\\[68\\%\\]{width:68%!important}.w-\\[86\\%\\]{width:86%!important}.w-\\[clamp\\(160px\\,28cqw\\,280px\\)\\]{width:clamp(160px,28cqw,280px)!important}.w-\\[min\\(720px\\,92vw\\)\\]{width:min(720px,92vw)!important}.w-\\[min\\(820px\\,94vw\\)\\]{width:min(820px,94vw)!important}.w-full{width:100%!important}.max-w-3xl{max-width:var(--container-3xl)!important}.max-w-\\[16ch\\]{max-width:16ch!important}.max-w-\\[40\\%\\]{max-width:40%!important}.max-w-\\[42ch\\]{max-width:42ch!important}.max-w-\\[44ch\\]{max-width:44ch!important}.max-w-\\[60ch\\]{max-width:60ch!important}.max-w-full{max-width:100%!important}.max-w-md{max-width:var(--container-md)!important}.max-w-xl{max-width:var(--container-xl)!important}.min-w-0{min-width:0!important}.min-w-36{min-width:calc(var(--spacing) * 36)!important}.min-w-40{min-width:calc(var(--spacing) * 40)!important}.flex-1{flex:1!important}.flex-none{flex:none!important}.shrink{flex-shrink:1!important}.shrink-0{flex-shrink:0!important}.basis-64{flex-basis:calc(var(--spacing) * 64)!important}.transform{transform:var(--tw-rotate-x,) var(--tw-rotate-y,) var(--tw-rotate-z,) var(--tw-skew-x,) var(--tw-skew-y,)!important}.cursor-default{cursor:default!important}.cursor-pointer{cursor:pointer!important}.resize{resize:both!important}.resize-y{resize:vertical!important}.scrollbar-gutter-stable{scrollbar-gutter:stable!important}.list-none{list-style-type:none!important}.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))!important}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))!important}.grid-cols-\\[22px_minmax\\(0\\,1fr\\)_64px\\]{grid-template-columns:22px minmax(0,1fr) 64px!important}.grid-cols-\\[clamp\\(220px\\,30cqw\\,300px\\)_minmax\\(0\\,1fr\\)\\]{grid-template-columns:clamp(220px,30cqw,300px) minmax(0,1fr)!important}.grid-cols-\\[minmax\\(0\\,1fr\\)\\]{grid-template-columns:minmax(0,1fr)!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,10rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,16rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,19rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr))!important}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,22rem\\)\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))!important}.grid-cols-\\[var\\(--ci-time-w\\)_36px_44px_minmax\\(0\\,1fr\\)\\]{grid-template-columns:var(--ci-time-w) 36px 44px minmax(0,1fr)!important}.grid-rows-\\[auto_minmax\\(0\\,1fr\\)\\]{grid-template-rows:auto minmax(0,1fr)!important}.grid-rows-\\[auto_minmax\\(0\\,1fr\\)_auto\\]{grid-template-rows:auto minmax(0,1fr) auto!important}.flex-col{flex-direction:column!important}.flex-wrap{flex-wrap:wrap!important}.place-items-center{place-items:center!important}.items-baseline{align-items:baseline!important}.items-center{align-items:center!important}.items-end{align-items:flex-end!important}.items-start{align-items:flex-start!important}.items-stretch{align-items:stretch!important}.justify-between{justify-content:space-between!important}.justify-center{justify-content:center!important}.justify-end{justify-content:flex-end!important}.justify-start{justify-content:flex-start!important}.gap-0{gap:0!important}.gap-0\\.5{gap:calc(var(--spacing) * .5)!important}.gap-1{gap:var(--spacing)!important}.gap-1\\.5{gap:calc(var(--spacing) * 1.5)!important}.gap-2{gap:calc(var(--spacing) * 2)!important}.gap-2\\.5{gap:calc(var(--spacing) * 2.5)!important}.gap-3{gap:calc(var(--spacing) * 3)!important}.gap-4{gap:calc(var(--spacing) * 4)!important}.gap-6{gap:calc(var(--spacing) * 6)!important}.gap-px{gap:1px!important}.gap-x-1{column-gap:var(--spacing)!important}.gap-x-1\\.5{column-gap:calc(var(--spacing) * 1.5)!important}.gap-x-2{column-gap:calc(var(--spacing) * 2)!important}.gap-x-2\\.5{column-gap:calc(var(--spacing) * 2.5)!important}.gap-x-5{column-gap:calc(var(--spacing) * 5)!important}.gap-x-6{column-gap:calc(var(--spacing) * 6)!important}.gap-y-0{row-gap:0!important}.gap-y-0\\.5{row-gap:calc(var(--spacing) * .5)!important}.gap-y-1{row-gap:var(--spacing)!important}.gap-y-1\\.5{row-gap:calc(var(--spacing) * 1.5)!important}.gap-y-2{row-gap:calc(var(--spacing) * 2)!important}.self-center{align-self:center!important}.self-start{align-self:flex-start!important}.truncate{text-overflow:ellipsis!important;white-space:nowrap!important;overflow:hidden!important}.overflow-clip{overflow:clip!important}.overflow-hidden{overflow:hidden!important}.overflow-visible{overflow:visible!important}.overflow-x-auto{overflow-x:auto!important}.overflow-x-clip{overflow-x:clip!important}.overflow-y-auto{overflow-y:auto!important}.overscroll-contain{overscroll-behavior:contain!important}.rounded{border-radius:.25rem!important}.rounded-\\[3px\\]{border-radius:3px!important}.rounded-\\[4px\\]{border-radius:4px!important}.rounded-\\[5px\\]{border-radius:5px!important}.rounded-\\[7px\\]{border-radius:7px!important}.rounded-\\[10px\\]{border-radius:10px!important}.rounded-full{border-radius:3.40282e38px!important}.rounded-lg{border-radius:var(--radius-lg)!important}.rounded-md{border-radius:var(--radius-md)!important}.rounded-sm{border-radius:var(--radius-sm)!important}.rounded-xl{border-radius:var(--radius-xl)!important}.rounded-xs{border-radius:var(--radius-xs)!important}.border{border-style:var(--tw-border-style)!important;border-width:1px!important}.border-0{border-style:var(--tw-border-style)!important;border-width:0!important}.border-\\[0\\.5px\\]{border-style:var(--tw-border-style)!important;border-width:.5px!important}.border-s{border-inline-start-style:var(--tw-border-style)!important;border-inline-start-width:1px!important}.border-s-2{border-inline-start-style:var(--tw-border-style)!important;border-inline-start-width:2px!important}.border-e{border-inline-end-style:var(--tw-border-style)!important;border-inline-end-width:1px!important}.border-bs{border-block-start-style:var(--tw-border-style)!important;border-block-start-width:1px!important}.border-t{border-top-style:var(--tw-border-style)!important;border-top-width:1px!important}.border-t-\\[0\\.5px\\]{border-top-style:var(--tw-border-style)!important;border-top-width:.5px!important}.border-b{border-bottom-style:var(--tw-border-style)!important;border-bottom-width:1px!important}.border-b-\\[0\\.5px\\]{border-bottom-style:var(--tw-border-style)!important;border-bottom-width:.5px!important}.border-dashed{--tw-border-style:dashed!important;border-style:dashed!important}.border-accent{border-color:var(--color-accent)!important}.border-current{border-color:currentColor!important}.border-err,.border-err\\/40{border-color:var(--color-err)!important}@supports (color:color-mix(in lab, red, red)){.border-err\\/40{border-color:color-mix(in oklab, var(--color-err) 40%, transparent)!important}}.border-line{border-color:var(--color-line)!important}.border-line-soft{border-color:var(--color-line-soft)!important}.border-warn,.border-warn\\/40{border-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.border-warn\\/40{border-color:color-mix(in oklab, var(--color-warn) 40%, transparent)!important}}.border-warn\\/50{border-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.border-warn\\/50{border-color:color-mix(in oklab, var(--color-warn) 50%, transparent)!important}}.border-warn\\/70{border-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.border-warn\\/70{border-color:color-mix(in oklab, var(--color-warn) 70%, transparent)!important}}.border-s-err{border-inline-start-color:var(--color-err)!important}.border-s-ok{border-inline-start-color:var(--color-ok)!important}.border-s-warn{border-inline-start-color:var(--color-warn)!important}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_16\\%\\,transparent\\)\\]{background-color:var(--color-accent)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_16\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-accent) 16%,transparent)!important}}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_35\\%\\,transparent\\)\\]{background-color:var(--color-accent)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-accent\\)_35\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-accent) 35%,transparent)!important}}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-err\\)_8\\%\\,transparent\\)\\]{background-color:var(--color-err)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-err\\)_8\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-err) 8%,transparent)!important}}.bg-\\[color-mix\\(in_oklch\\,var\\(--color-ok\\)_8\\%\\,transparent\\)\\]{background-color:var(--color-ok)!important}@supports (color:color-mix(in lab, red, red)){.bg-\\[color-mix\\(in_oklch\\,var\\(--color-ok\\)_8\\%\\,transparent\\)\\]{background-color:color-mix(in oklch,var(--color-ok) 8%,transparent)!important}}.bg-\\[rgb\\(0_0_0\\/55\\%\\)\\]{background-color:#0000008c!important}.bg-accent,.bg-accent\\/14{background-color:var(--color-accent)!important}@supports (color:color-mix(in lab, red, red)){.bg-accent\\/14{background-color:color-mix(in oklab, var(--color-accent) 14%, transparent)!important}}.bg-bg{background-color:var(--color-bg)!important}.bg-bg-1{background-color:var(--color-bg-1)!important}.bg-bg-2{background-color:var(--color-bg-2)!important}.bg-bg-3{background-color:var(--color-bg-3)!important}.bg-err,.bg-err\\/5{background-color:var(--color-err)!important}@supports (color:color-mix(in lab, red, red)){.bg-err\\/5{background-color:color-mix(in oklab, var(--color-err) 5%, transparent)!important}}.bg-fg-dim{background-color:var(--color-fg-dim)!important}.bg-line-soft{background-color:var(--color-line-soft)!important}.bg-ok{background-color:var(--color-ok)!important}.bg-sidebar{background-color:var(--color-sidebar)!important}.bg-transparent{background-color:#0000!important}.bg-warn,.bg-warn\\/6{background-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.bg-warn\\/6{background-color:color-mix(in oklab, var(--color-warn) 6%, transparent)!important}}.bg-warn\\/8{background-color:var(--color-warn)!important}@supports (color:color-mix(in lab, red, red)){.bg-warn\\/8{background-color:color-mix(in oklab, var(--color-warn) 8%, transparent)!important}}.bg-\\[linear-gradient\\(90deg\\,var\\(--color-bg-1\\)\\,var\\(--color-bg-2\\)\\,var\\(--color-bg-1\\)\\)\\]{background-image:linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))!important}.bg-\\[repeating-linear-gradient\\(45deg\\,var\\(--color-fg-dim\\)_0_1px\\,transparent_1px_3px\\)\\]{background-image:repeating-linear-gradient(45deg,var(--color-fg-dim) 0 1px,transparent 1px 3px)!important}.bg-\\[repeating-linear-gradient\\(45deg\\,var\\(--color-fg-dim\\)_0_2px\\,transparent_2px_5px\\)\\]{background-image:repeating-linear-gradient(45deg,var(--color-fg-dim) 0 2px,transparent 2px 5px)!important}.bg-\\[length\\:200\\%_100\\%\\],.bg-size-\\[200\\%_100\\%\\]{background-size:200% 100%!important}.fill-accent{fill:var(--color-accent)!important}.fill-none{fill:none!important}.stroke-accent{stroke:var(--color-accent)!important}.stroke-fg-dim{stroke:var(--color-fg-dim)!important}.stroke-line-soft{stroke:var(--color-line-soft)!important}.stroke-warn{stroke:var(--color-warn)!important}.stroke-1{stroke-width:1px!important}.stroke-\\[1\\.6\\]{stroke-width:1.6px!important}.p-0{padding:0!important}.p-1{padding:var(--spacing)!important}.p-1\\.5{padding:calc(var(--spacing) * 1.5)!important}.p-2{padding:calc(var(--spacing) * 2)!important}.p-3{padding:calc(var(--spacing) * 3)!important}.p-3\\.5{padding:calc(var(--spacing) * 3.5)!important}.p-4{padding:calc(var(--spacing) * 4)!important}.p-5{padding:calc(var(--spacing) * 5)!important}.p-6{padding:calc(var(--spacing) * 6)!important}.px-1{padding-inline:var(--spacing)!important}.px-1\\.5{padding-inline:calc(var(--spacing) * 1.5)!important}.px-1\\.25{padding-inline:calc(var(--spacing) * 1.25)!important}.px-2{padding-inline:calc(var(--spacing) * 2)!important}.px-2\\.5{padding-inline:calc(var(--spacing) * 2.5)!important}.px-3{padding-inline:calc(var(--spacing) * 3)!important}.px-3\\.5{padding-inline:calc(var(--spacing) * 3.5)!important}.px-4{padding-inline:calc(var(--spacing) * 4)!important}.px-5{padding-inline:calc(var(--spacing) * 5)!important}.px-8{padding-inline:calc(var(--spacing) * 8)!important}.px-px{padding-inline:1px!important}.py-0{padding-block:0!important}.py-0\\.5{padding-block:calc(var(--spacing) * .5)!important}.py-1{padding-block:var(--spacing)!important}.py-1\\.5{padding-block:calc(var(--spacing) * 1.5)!important}.py-2{padding-block:calc(var(--spacing) * 2)!important}.py-2\\.5{padding-block:calc(var(--spacing) * 2.5)!important}.py-3{padding-block:calc(var(--spacing) * 3)!important}.py-4{padding-block:calc(var(--spacing) * 4)!important}.py-10{padding-block:calc(var(--spacing) * 10)!important}.py-px{padding-block:1px!important}.ps-0{padding-inline-start:0!important}.ps-1{padding-inline-start:var(--spacing)!important}.ps-1\\.5{padding-inline-start:calc(var(--spacing) * 1.5)!important}.ps-2{padding-inline-start:calc(var(--spacing) * 2)!important}.ps-2\\.5{padding-inline-start:calc(var(--spacing) * 2.5)!important}.ps-3{padding-inline-start:calc(var(--spacing) * 3)!important}.ps-4{padding-inline-start:calc(var(--spacing) * 4)!important}.ps-5{padding-inline-start:calc(var(--spacing) * 5)!important}.ps-8{padding-inline-start:calc(var(--spacing) * 8)!important}.ps-9{padding-inline-start:calc(var(--spacing) * 9)!important}.ps-9\\.25{padding-inline-start:calc(var(--spacing) * 9.25)!important}.pe-2{padding-inline-end:calc(var(--spacing) * 2)!important}.pe-8{padding-inline-end:calc(var(--spacing) * 8)!important}.pt-1{padding-top:var(--spacing)!important}.pt-1\\.5{padding-top:calc(var(--spacing) * 1.5)!important}.pt-2{padding-top:calc(var(--spacing) * 2)!important}.pt-3{padding-top:calc(var(--spacing) * 3)!important}.pt-4{padding-top:calc(var(--spacing) * 4)!important}.pt-\\[12vh\\]{padding-top:12vh!important}.pb-1{padding-bottom:var(--spacing)!important}.pb-1\\.5{padding-bottom:calc(var(--spacing) * 1.5)!important}.pb-2{padding-bottom:calc(var(--spacing) * 2)!important}.pb-2\\.5{padding-bottom:calc(var(--spacing) * 2.5)!important}.pb-3{padding-bottom:calc(var(--spacing) * 3)!important}.pb-4{padding-bottom:calc(var(--spacing) * 4)!important}.pb-6{padding-bottom:calc(var(--spacing) * 6)!important}.text-center{text-align:center!important}.text-end{text-align:end!important}.text-left{text-align:left!important}.text-right{text-align:right!important}.text-start{text-align:start!important}.font-\\[inherit\\]{font-family:inherit!important}.font-mono{font-family:var(--font-mono)!important}.text-lg{font-size:var(--text-lg)!important;line-height:var(--tw-leading,var(--text-lg--line-height))!important}.text-sm{font-size:var(--text-sm)!important;line-height:var(--tw-leading,var(--text-sm--line-height))!important}.text-xs{font-size:var(--text-xs)!important;line-height:var(--tw-leading,var(--text-xs--line-height))!important}.text-\\[9\\.5px\\]{font-size:9.5px!important}.text-\\[10\\.5px\\]{font-size:10.5px!important}.text-\\[10px\\]{font-size:10px!important}.text-\\[11\\.5px\\]{font-size:11.5px!important}.text-\\[11px\\]{font-size:11px!important}.text-\\[12\\.5px\\]{font-size:12.5px!important}.text-\\[12px\\]{font-size:12px!important}.text-\\[13\\.5px\\]{font-size:13.5px!important}.text-\\[13px\\]{font-size:13px!important}.text-\\[15px\\]{font-size:15px!important}.text-\\[16px\\]{font-size:16px!important}.text-\\[18px\\]{font-size:18px!important}.text-\\[20px\\]{font-size:20px!important}.text-\\[24px\\]{font-size:24px!important}.leading-4{--tw-leading:calc(var(--spacing) * 4)!important;line-height:calc(var(--spacing) * 4)!important}.leading-4\\.25{--tw-leading:calc(var(--spacing) * 4.25)!important;line-height:calc(var(--spacing) * 4.25)!important}.leading-\\[15px\\]{--tw-leading:15px!important;line-height:15px!important}.leading-none{--tw-leading:1!important;line-height:1!important}.leading-normal{--tw-leading:var(--leading-normal)!important;line-height:var(--leading-normal)!important}.leading-relaxed{--tw-leading:var(--leading-relaxed)!important;line-height:var(--leading-relaxed)!important}.leading-snug{--tw-leading:var(--leading-snug)!important;line-height:var(--leading-snug)!important}.leading-tight{--tw-leading:var(--leading-tight)!important;line-height:var(--leading-tight)!important}.font-medium{--tw-font-weight:var(--font-weight-medium)!important;font-weight:var(--font-weight-medium)!important}.font-normal{--tw-font-weight:var(--font-weight-normal)!important;font-weight:var(--font-weight-normal)!important}.font-semibold{--tw-font-weight:var(--font-weight-semibold)!important;font-weight:var(--font-weight-semibold)!important}.tracking-\\[-0\\.01em\\]{--tw-tracking:-.01em!important;letter-spacing:-.01em!important}.tracking-\\[0\\.02em\\]{--tw-tracking:.02em!important;letter-spacing:.02em!important}.tracking-\\[0\\.06em\\]{--tw-tracking:.06em!important;letter-spacing:.06em!important}.tracking-normal{--tw-tracking:var(--tracking-normal)!important;letter-spacing:var(--tracking-normal)!important}.break-words{overflow-wrap:break-word!important}.wrap-anywhere{overflow-wrap:anywhere!important}.wrap-break-word{overflow-wrap:break-word!important}.break-all{word-break:break-all!important}.whitespace-nowrap{white-space:nowrap!important}.whitespace-pre-wrap{white-space:pre-wrap!important}.text-accent{color:var(--color-accent)!important}.text-err{color:var(--color-err)!important}.text-fg{color:var(--color-fg)!important}.text-fg-3{color:var(--color-fg-3)!important}.text-fg-dim{color:var(--color-fg-dim)!important}.text-inherit{color:inherit!important}.text-ok{color:var(--color-ok)!important}.text-warn{color:var(--color-warn)!important}.text-white{color:var(--color-white)!important}.normal-case{text-transform:none!important}.uppercase{text-transform:uppercase!important}.italic{font-style:italic!important}.ordinal{--tw-ordinal:ordinal!important;font-variant-numeric:var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)!important}.tabular-nums{--tw-numeric-spacing:tabular-nums!important;font-variant-numeric:var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)!important}.accent-accent{accent-color:var(--color-accent)!important}.opacity-50{opacity:.5!important}.opacity-60{opacity:.6!important}.opacity-70{opacity:.7!important}.opacity-75{opacity:.75!important}.opacity-80{opacity:.8!important}.opacity-100{opacity:1!important}.opacity-\\[0\\.14\\]{opacity:.14!important}.shadow-\\[0_18px_48px_rgb\\(0_0_0\\/50\\%\\)\\]{--tw-shadow:0 18px 48px var(--tw-shadow-color,#00000080)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.shadow-\\[inset_0_0_0_1px_var\\(--color-fg-dim\\)\\]{--tw-shadow:inset 0 0 0 1px var(--tw-shadow-color,var(--color-fg-dim))!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.shadow-lg{--tw-shadow:0 10px 15px -3px var(--tw-shadow-color,#0000001a), 0 4px 6px -4px var(--tw-shadow-color,#0000001a)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.shadow-sm{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a), 0 1px 2px -1px var(--tw-shadow-color,#0000001a)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.shadow-xl{--tw-shadow:0 20px 25px -5px var(--tw-shadow-color,#0000001a), 0 8px 10px -6px var(--tw-shadow-color,#0000001a)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.ring{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor)!important;box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)!important}.outline{outline-style:var(--tw-outline-style)!important;outline-width:1px!important}.outline-offset-2{outline-offset:2px!important}.blur{--tw-blur:blur(8px)!important;filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)!important}.filter{filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)!important}.transition{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to,opacity,box-shadow,transform,translate,scale,rotate,filter,-webkit-backdrop-filter,backdrop-filter,display,content-visibility,overlay,pointer-events!important;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function))!important;transition-duration:var(--tw-duration,var(--default-transition-duration))!important}.transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to!important;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function))!important;transition-duration:var(--tw-duration,var(--default-transition-duration))!important}.duration-150{--tw-duration:.15s!important;transition-duration:.15s!important}.ease-in-out{--tw-ease:var(--ease-in-out)!important;transition-timing-function:var(--ease-in-out)!important}.ease-out{--tw-ease:var(--ease-out)!important;transition-timing-function:var(--ease-out)!important}.outline-none{--tw-outline-style:none!important;outline-style:none!important}.select-none{-webkit-user-select:none!important;user-select:none!important}.\\[stroke-dasharray\\:3_3\\]{stroke-dasharray:3 3!important}.\\[stroke-linejoin\\:round\\]{stroke-linejoin:round!important}.\\[vector-effect\\:non-scaling-stroke\\]{vector-effect:non-scaling-stroke!important}.placeholder\\:text-fg-3::placeholder{color:var(--color-fg-3)!important}.backdrop\\:bg-black\\/40::backdrop{background-color:#0006!important}@supports (color:color-mix(in lab, red, red)){.backdrop\\:bg-black\\/40::backdrop{background-color:color-mix(in oklab, var(--color-black) 40%, transparent)!important}}.after\\:w-max:after{content:var(--tw-content);width:max-content!important}.after\\:max-w-full:after{content:var(--tw-content);max-width:100%!important}.first\\:mt-0:first-child{margin-top:0!important}.first\\:rounded-s-sm:first-child{border-start-start-radius:var(--radius-sm)!important;border-end-start-radius:var(--radius-sm)!important}.first\\:border-t-0:first-child{border-top-style:var(--tw-border-style)!important;border-top-width:0!important}.last\\:rounded-e-sm:last-child{border-start-end-radius:var(--radius-sm)!important;border-end-end-radius:var(--radius-sm)!important}.last\\:border-b-0:last-child{border-bottom-style:var(--tw-border-style)!important;border-bottom-width:0!important}.focus-within\\:border-accent:focus-within{border-color:var(--color-accent)!important}@media (hover:hover){.hover\\:bg-bg-2:hover{background-color:var(--color-bg-2)!important}.hover\\:bg-hover:hover{background-color:var(--color-hover)!important}}.focus\\:bg-hover:focus{background-color:var(--color-hover)!important}.focus-visible\\:outline-2:focus-visible{outline-style:var(--tw-outline-style)!important;outline-width:2px!important}.focus-visible\\:outline-offset-2:focus-visible{outline-offset:2px!important}.focus-visible\\:outline-accent:focus-visible{outline-color:var(--color-accent)!important}.active\\:bg-bg-3:active{background-color:var(--color-bg-3)!important}.active\\:bg-hover:active{background-color:var(--color-hover)!important}.active\\:brightness-90:active{--tw-brightness:brightness(90%)!important;filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)!important}@media (hover:hover){.enabled\\:hover\\:border-accent:enabled:hover{border-color:var(--color-accent)!important}.enabled\\:hover\\:brightness-110:enabled:hover{--tw-brightness:brightness(110%)!important;filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)!important}}.disabled\\:cursor-default:disabled{cursor:default!important}.disabled\\:cursor-not-allowed:disabled{cursor:not-allowed!important}.disabled\\:opacity-50:disabled{opacity:.5!important}.data-disabled\\:pointer-events-none[data-disabled]{pointer-events:none!important}.data-disabled\\:opacity-50[data-disabled]{opacity:.5!important}.data-highlighted\\:bg-bg-3[data-highlighted]{background-color:var(--color-bg-3)!important}.data-\\[active\\=true\\]\\:bg-bg-2[data-active=true]{background-color:var(--color-bg-2)!important}.data-\\[size\\=default\\]\\:h-9[data-size=default]{height:calc(var(--spacing) * 9)!important}.data-\\[size\\=sm\\]\\:h-8[data-size=sm]{height:calc(var(--spacing) * 8)!important}.data-\\[state\\=provisional\\]\\:border-dashed[data-state=provisional]{--tw-border-style:dashed!important;border-style:dashed!important}@media (prefers-reduced-motion:no-preference){.motion-safe\\:animate-\\[ci-skel_1\\.4s_var\\(--ease-in-out\\)_infinite\\]{animation:ci-skel 1.4s var(--ease-in-out) infinite!important}.motion-safe\\:animate-pulse{animation:var(--animate-pulse)!important}.motion-safe\\:animate-spin{animation:var(--animate-spin)!important}}@container (min-width:42rem){.\\@2xl\\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))!important}}@container (min-width:48rem){.\\@3xl\\:flex{display:flex!important}.\\@3xl\\:grid{display:grid!important}.\\@3xl\\:min-h-0{min-height:0!important}.\\@3xl\\:flex-1{flex:1!important}.\\@3xl\\:grid-cols-\\[minmax\\(300px\\,380px\\)_minmax\\(0\\,1fr\\)\\]{grid-template-columns:minmax(300px,380px) minmax(0,1fr)!important}.\\@3xl\\:overflow-hidden{overflow:hidden!important}.\\@3xl\\:overflow-y-auto{overflow-y:auto!important}.\\@3xl\\:overscroll-contain{overscroll-behavior:contain!important}.\\@3xl\\:border-e{border-inline-end-style:var(--tw-border-style)!important;border-inline-end-width:1px!important}.\\@3xl\\:border-t-0{border-top-style:var(--tw-border-style)!important;border-top-width:0!important}}@container (min-width:56rem){.\\@4xl\\:flex{display:flex!important}}.\\[\\&\\>span\\+span\\]\\:text-\\[11px\\]>span+span{font-size:11px!important}.\\[\\&\\>span\\+span\\]\\:font-normal>span+span{--tw-font-weight:var(--font-weight-normal)!important;font-weight:var(--font-weight-normal)!important}.\\[\\&\\>span\\+span\\]\\:text-fg-dim>span+span{color:var(--color-fg-dim)!important}}@layer components{.ci-src{border:1px solid light-dark(var(--ci-src-brand),var(--ci-src-brand));align-items:center;gap:.1875rem;padding-block:1px;padding-inline:.3125rem;display:inline-flex}@supports (color:color-mix(in lab, red, red)){.ci-src{border:1px solid light-dark(color-mix(in oklch, var(--ci-src-brand) 55%, oklch(40% 0 none)),color-mix(in oklch, var(--ci-src-brand) 45%, transparent))}}.ci-src{background:light-dark(var(--ci-src-brand),var(--ci-src-brand));border-radius:999px}@supports (color:color-mix(in lab, red, red)){.ci-src{background:light-dark(color-mix(in oklch, var(--ci-src-brand) 16%, oklch(100% 0 none)),color-mix(in oklch, var(--ci-src-brand) 14%, transparent))}}.ci-src{color:light-dark(var(--ci-src-brand),var(--ci-src-color,var(--color-fg)))}@supports (color:color-mix(in lab, red, red)){.ci-src{color:light-dark(color-mix(in oklch, var(--ci-src-brand) 55%, oklch(20% 0 none)),var(--ci-src-color,var(--color-fg)))}}.ci-src{font-variant-numeric:tabular-nums;white-space:nowrap;font-size:.625rem;line-height:1.4}.ci-src__word{color:light-dark(var(--ci-src-brand),var(--ci-src-color,var(--color-fg)))}@supports (color:color-mix(in lab, red, red)){.ci-src__word{color:light-dark(color-mix(in oklch, var(--ci-src-brand) 55%, oklch(20% 0 none)),var(--ci-src-color,var(--color-fg)))}}.ci-status{background:light-dark(currentColor,currentColor);border:1px solid;border-radius:999px;align-items:center;gap:.25rem;padding-block:1px;padding-inline:.375rem .3125rem;display:inline-flex}@supports (color:color-mix(in lab, red, red)){.ci-status{background:light-dark(color-mix(in oklch, currentColor 12%, oklch(100% 0 none)),color-mix(in oklch, currentColor 14%, transparent))}}.ci-status{font-variant-numeric:tabular-nums;font-size:.625rem;line-height:1.5}.ci-status:before{content:"";background:currentColor;border-radius:50%;block-size:6px;inline-size:6px}.ci-status--ok{color:var(--color-ok)}.ci-status--error{color:var(--color-err)}.ci-status--unknown{color:var(--color-warn)}.ci-status--running{color:var(--color-info)}.ci-status--running:before{animation:ci-breathe 1.6s var(--ease-in-out) infinite}@keyframes ci-breathe{0%,to{opacity:1;box-shadow:0 0 0 0 color-mix(in oklch, currentColor 55%, transparent)}50%{opacity:.55;box-shadow:0 0 0 4px color-mix(in oklch, currentColor 0%, transparent)}}@media (prefers-reduced-motion:reduce){.ci-status--running:before{animation:none}}.ci-ask{margin:0}.ci-ask__label{color:var(--color-fg-dim);margin-block-end:.375rem;font-size:11px;font-weight:500;display:block}.ci-ask__text{border:1px solid var(--color-accent);margin:0;padding-block:.625rem;padding-inline:.875rem}@supports (color:color-mix(in lab, red, red)){.ci-ask__text{border:1px solid color-mix(in oklch, var(--color-accent) 22%, transparent)}}.ci-ask__text{background:var(--color-accent);border-radius:10px}@supports (color:color-mix(in lab, red, red)){.ci-ask__text{background:color-mix(in oklch, var(--color-accent) 7%, var(--color-bg-1))}}.ci-ask__text{color:var(--color-fg);overscroll-behavior:contain;white-space:pre-wrap;overflow-wrap:break-word;max-block-size:7.5rem;font-size:13.5px;line-height:1.65;overflow-y:auto}.ci-pre{border:.5px solid var(--color-line-soft);background:var(--color-bg-2);font-family:var(--font-mono);white-space:pre-wrap;overflow-wrap:break-word;border-radius:5px;margin-block:2px 0;padding:6px 8px;font-size:11px;line-height:1.5;overflow-x:auto}[data-tip]{cursor:help}[data-tip]:hover:after,[data-tip]:focus-visible:after{content:attr(data-tip);z-index:20;border:.5px solid var(--color-line);background:var(--color-bg-2);max-width:340px;color:var(--color-fg);pointer-events:none;white-space:normal;border-radius:6px;padding:6px 8px;font-family:inherit;font-size:10.5px;font-style:normal;line-height:1.45;position:absolute;top:calc(100% + 6px);left:0;box-shadow:0 6px 18px #00000059}@keyframes ci-skel{0%{background-position:100% 0}to{background-position:-100% 0}}}.ci-btn,.ci-icon-btn,.ci-row,.ci-search{appearance:none;color:var(--color-fg);font:inherit;text-align:start;cursor:pointer;transition:background-color .14s var(--ease-out), border-color .14s var(--ease-out), color .14s var(--ease-out);background:0 0;border:1px solid #0000;margin:0}.ci-btn{border-color:var(--color-line);background:var(--color-bg-1);white-space:nowrap;border-radius:7px;align-items:center;gap:6px;block-size:28px;padding-inline:10px;font-size:12px;font-weight:500;display:inline-flex}.ci-btn:hover:not(:disabled){background:var(--color-bg-2)}.ci-btn--primary{background:var(--color-accent);color:#fff;border-color:#0000}.ci-btn--primary:hover:not(:disabled){background:var(--color-accent)}@supports (color:color-mix(in lab, red, red)){.ci-btn--primary:hover:not(:disabled){background:color-mix(in oklch, var(--color-accent) 86%, black)}}.ci-btn--quiet{color:var(--color-accent);background:0 0;border-color:#0000}.ci-btn--quiet:hover:not(:disabled){background:var(--color-accent)}@supports (color:color-mix(in lab, red, red)){.ci-btn--quiet:hover:not(:disabled){background:color-mix(in oklch, var(--color-accent) 10%, transparent)}}.ci-btn:disabled,.ci-icon-btn:disabled{opacity:.5;cursor:default}.ci-icon-btn{block-size:28px;inline-size:28px;color:var(--color-fg-dim);border-radius:7px;place-items:center;padding:0;display:inline-grid}.ci-icon-btn:hover:not(:disabled),.ci-icon-btn[aria-pressed=true]{background:var(--color-hover);color:var(--color-fg)}.ci-search{border-color:var(--color-line-soft);background:var(--color-bg-1);block-size:30px;color:var(--color-fg-3);border-radius:8px;align-items:center;gap:8px;padding-inline:10px 6px;font-size:12px;display:flex}.ci-search:hover{border-color:var(--color-line);color:var(--color-fg-dim)}.ci-row{border-radius:8px;inline-size:100%;min-inline-size:0;display:block}@media (hover:hover) and (pointer:fine){.ci-row:hover{background:var(--color-hover)}}.ci-row[data-selected=true]{background:var(--color-accent)}@supports (color:color-mix(in lab, red, red)){.ci-row[data-selected=true]{background:color-mix(in oklch, var(--color-accent) 14%, transparent)}}.ci-row:focus-visible,.ci-btn:focus-visible,.ci-icon-btn:focus-visible,.ci-search:focus-visible{outline:2px solid var(--color-accent);outline-offset:-2px}.ci-chevron{transition:transform .16s var(--ease-out)}[aria-expanded=true]>*>.ci-chevron,[aria-expanded=true]>.ci-chevron{transform:rotate(90deg)}.ci-fold>summary{cursor:pointer;list-style:none}.ci-fold>summary::-webkit-details-marker{display:none}.ci-fold[open]>summary .ci-chevron{transform:rotate(90deg)}.ci-dot{border:1.5px solid var(--color-bg);background:var(--color-accent);cursor:pointer;block-size:7px;inline-size:7px;transition:transform .14s var(--ease-out);border-radius:50%;margin:-3.5px 0 0 -3.5px;padding:0;position:absolute}.ci-dot:after{content:"";border-radius:50%;position:absolute;inset:-6px}.ci-dot:hover{transform:scale(1.5)}.ci-dot[data-selected=true]{block-size:11px;inline-size:11px;box-shadow:0 0 0 3px var(--color-accent);border-width:2px;margin:-5.5px 0 0 -5.5px}@supports (color:color-mix(in lab, red, red)){.ci-dot[data-selected=true]{box-shadow:0 0 0 3px color-mix(in oklch, var(--color-accent) 30%, transparent)}}.ci-scroll{scrollbar-width:thin;scrollbar-color:var(--color-line) transparent}@media (prefers-reduced-motion:reduce){.ci-btn,.ci-icon-btn,.ci-row,.ci-search,.ci-chevron{transition:none}}@layer base{*,:before,:after{box-sizing:border-box}:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--color-accent));outline-offset:1px;border-radius:6px}button,a,input,select,textarea{color:inherit;font:inherit;background:0 0;border:0}}:scope[data-dsh-sessions-insight-view] :is(h1,h2,h3,h4,h5,h6){font-family:revert;font-weight:revert;letter-spacing:revert;line-height:revert;margin:revert}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.5}}
}@property --tw-rotate-x{syntax:"*";inherits:false}@property --tw-rotate-y{syntax:"*";inherits:false}@property --tw-rotate-z{syntax:"*";inherits:false}@property --tw-skew-x{syntax:"*";inherits:false}@property --tw-skew-y{syntax:"*";inherits:false}@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}@property --tw-leading{syntax:"*";inherits:false}@property --tw-font-weight{syntax:"*";inherits:false}@property --tw-tracking{syntax:"*";inherits:false}@property --tw-ordinal{syntax:"*";inherits:false}@property --tw-slashed-zero{syntax:"*";inherits:false}@property --tw-numeric-figure{syntax:"*";inherits:false}@property --tw-numeric-spacing{syntax:"*";inherits:false}@property --tw-numeric-fraction{syntax:"*";inherits:false}@property --tw-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-shadow-color{syntax:"*";inherits:false}@property --tw-shadow-alpha{syntax:"<percentage>";inherits:false;initial-value:100%}@property --tw-inset-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-inset-shadow-color{syntax:"*";inherits:false}@property --tw-inset-shadow-alpha{syntax:"<percentage>";inherits:false;initial-value:100%}@property --tw-ring-color{syntax:"*";inherits:false}@property --tw-ring-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-inset-ring-color{syntax:"*";inherits:false}@property --tw-inset-ring-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-ring-inset{syntax:"*";inherits:false}@property --tw-ring-offset-width{syntax:"<length>";inherits:false;initial-value:0}@property --tw-ring-offset-color{syntax:"*";inherits:false;initial-value:#fff}@property --tw-ring-offset-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-outline-style{syntax:"*";inherits:false;initial-value:solid}@property --tw-blur{syntax:"*";inherits:false}@property --tw-brightness{syntax:"*";inherits:false}@property --tw-contrast{syntax:"*";inherits:false}@property --tw-grayscale{syntax:"*";inherits:false}@property --tw-hue-rotate{syntax:"*";inherits:false}@property --tw-invert{syntax:"*";inherits:false}@property --tw-opacity{syntax:"*";inherits:false}@property --tw-saturate{syntax:"*";inherits:false}@property --tw-sepia{syntax:"*";inherits:false}@property --tw-drop-shadow{syntax:"*";inherits:false}@property --tw-drop-shadow-color{syntax:"*";inherits:false}@property --tw-drop-shadow-alpha{syntax:"<percentage>";inherits:false;initial-value:100%}@property --tw-drop-shadow-size{syntax:"*";inherits:false}@property --tw-duration{syntax:"*";inherits:false}@property --tw-ease{syntax:"*";inherits:false}@property --tw-content{syntax:"*";inherits:false;initial-value:""}`,
      )
    }
    const Qt = new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 })
    function $t(e) {
      return Qt.format(Math.round(e))
    }
    function en(e) {
      const t = Math.abs(e),
        n = e < 0 ? `-` : ``
      return t < 1e3
        ? n + String(Math.round(t))
        : t < 1e4
          ? `${n + (t / 1e3).toFixed(1)}k`
          : t < 1e6
            ? `${n + String(Math.round(t / 1e3))}k`
            : `${n + (t / 1e6).toFixed(1)}M`
    }
    function tn(e) {
      return `$${  e.toFixed(e < 0.01 ? 4 : 3)}`
    }
    function nn(e, t) {
      const n = t === `CNY` ? `¥` : t === `USD` ? `$` : ``,
        r = Math.abs(e) >= 1 ? 2 : 4
      return n + e.toFixed(r)
    }
    function rn(e, t) {
      return !Number.isFinite(t) || t <= 0 ? `—` : `${(Math.round((e / t) * 1e3) / 10).toFixed(1)}%`
    }
    function an(e) {
      return `×${(Math.round(e * 1e3) / 1e3).toFixed(3)}`
    }
    function on(e) {
      return e < 1024
        ? `${String(e)} B`
        : e < 1048576
          ? `${(e / 1024).toFixed(0)} KB`
          : `${(e / 1048576).toFixed(1)} MB`
    }
    const sn = new Intl.DateTimeFormat(void 0, {
      year: `numeric`,
      month: `2-digit`,
      day: `2-digit`,
      hour: `2-digit`,
      minute: `2-digit`,
    })
    function cn(e) {
      return !Number.isFinite(e) || e <= 0 ? `—` : sn.format(new Date(e))
    }
    function ln(e, t = Date.now()) {
      if (!Number.isFinite(e) || e <= 0) return `—`
      const n = new Date(e),
        r = new Date(t),
        i = (e) => String(e).padStart(2, `0`),
        a = `${i(n.getHours())}:${i(n.getMinutes())}`
      return n.getFullYear() === r.getFullYear()
        ? n.getMonth() === r.getMonth() && n.getDate() === r.getDate()
          ? a
          : `${i(n.getMonth() + 1)}-${i(n.getDate())} ${a}`
        : `${String(n.getFullYear())}-${i(n.getMonth() + 1)}-${i(n.getDate())}`
    }
    function un(e, t) {
      if (t === void 0 || !Number.isFinite(t) || t < e) return `—`
      const n = t - e
      if (n < 1e3) return `${String(Math.round(n))} ms`
      if (n < 6e4) return `${(n / 1e3).toFixed(1)} s`
      const r = Math.floor(n / 6e4)
      return `${String(r)} min ${String(Math.round((n % 6e4) / 1e3))} s`
    }
    function dn(e) {
      if (e === ``) return { parent: ``, leaf: `` }
      const t = e.replace(/[\\/]+$/, ``),
        n = Math.max(t.lastIndexOf(`/`), t.lastIndexOf(`\\`))
      return n <= 0 ? { parent: ``, leaf: t } : { parent: t.slice(0, n + 1), leaf: t.slice(n + 1) }
    }
    function fn(e) {
      const t = e.replace(/[\\/]+$/, ``),
        n = Math.max(t.lastIndexOf(`/`), t.lastIndexOf(`\\`))
      return n < 0 ? t : t.slice(n + 1)
    }
    function pn(e, t) {
      return e.length <= t ? e : e.slice(0, t)
    }
    function mn(e) {
      return e.replace(/^(\/Users\/[^/]+|\/home\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)(?=[\\/]|$)/, `~`)
    }
    function hn(e, t) {
      return e?.source === t?.source && e?.id === t?.id
    }
    function gn(e, t) {
      if (t === void 0 || !hn(e, t.metadata)) return e
      const n = { ...e }
      return (t.displayTitle === void 0 ? delete n.title : (n.title = t.displayTitle), n)
    }
    async function _n(e, t, n, r, i, a, o) {
      for (; i() && !r.aborted && n.offset < n.total && !(o !== void 0 && n.turns.some((e) => e.index === o));) {
        const s = await e.session(t.id, n.offset, o === void 0 ? 40 : 200, t.source, r)
        if (!i() || r.aborted) return
        if (!s.ok) return s
        const c = s.value.session.turns
        if (c.length === 0) break
        const l = new Map(n.turns.map((e) => [e.index, e]))
        for (const e of c) l.has(e.index) || l.set(e.index, e)
        if (
          ((n = {
            turns: [...l.values()].toSorted((e, t) => e.index - t.index),
            offset: n.offset + c.length,
            total: n.total,
          }),
          a(n),
          o === void 0)
        )
          break
      }
    }
    function vn(e, t, n = !1) {
      const [r, i] = (0, l.useState)({ kind: `idle` }),
        [a, o] = (0, l.useState)(null),
        [s, c] = (0, l.useState)(null),
        [u, d] = (0, l.useState)(n),
        f = (0, l.useRef)(n)
      ;((f.current = n),
        (0, l.useEffect)(() => {
          d(n)
        }, [n]))
      const p = (0, l.useRef)(null),
        m = (0, l.useRef)(t),
        h = (0, l.useRef)(/* @__PURE__ */ new Map()),
        g = (0, l.useRef)(0),
        _ = t?.source,
        v = t?.id
      ;(0, l.useLayoutEffect)(() => {
        ;((m.current = t), hn(p.current?.ref ?? null, t) || p.current?.controller.abort())
      }, [t])
      const y = (0, l.useCallback)((e) => gn(e, h.current.get(`${e.source}:${e.id}`)), []),
        b = (0, l.useCallback)(
          (e) => {
            let t = y(e.session)
            return t === e.session ? e : { ...e, session: t }
          },
          [y],
        )
      ;(0, l.useEffect)(() => {
        if ((o(null), c(null), d(f.current), _ === void 0 || v === void 0)) {
          ;((p.current = null), i({ kind: `idle` }))
          return
        }
        const t = { source: _, id: v },
          n = new AbortController(),
          r = { ref: t, controller: n, ready: !1, prefix: { turns: [], offset: 0, total: 0 } }
        p.current = r
        const a = () => p.current === r && hn(m.current, t)
        return (
          i({ kind: `loading`, ref: t }),
          e.cost(_, v, n.signal).then((e) => {
            !n.signal.aborted && a() && o(e.ok ? e.value : null)
          }),
          e.session(v, 0, 40, _, n.signal).then((e) => {
            if (n.signal.aborted || !a()) return
            if (!e.ok) {
              i({ kind: `failed`, ref: t, failure: e })
              return
            }
            const o = e.value.session.turns
            ;((r.ready = !0),
              (r.prefix = { turns: o, offset: o.length, total: e.value.turnCount }),
              i({ kind: `ready`, ref: t, data: b(e.value), turns: o, loadingMore: !1 }),
              c(o.find((e) => e.attribution.residual !== void 0)?.index ?? o[0]?.index ?? null))
          }),
          () => n.abort()
        )
      }, [e, _, v, b])
      const x = (0, l.useCallback)(
        async (t) => {
          let n = p.current
          if (n === null || !n.ready) return
          let r = () => p.current === n && !n.controller.signal.aborted && hn(m.current, n.ref)
          if (!r()) return
          for (; n.paging !== void 0;) if ((await n.paging, !r() || t === void 0)) return
          if (t !== void 0 && n.prefix.turns.some((e) => e.index === t)) return
          let a = (e, t = !1) => {
            r() &&
              i((i) => {
                if (!r() || i.kind !== `ready` || !hn(i.ref, n.ref)) return i
                let a = { ...i, data: b(i.data), turns: n.prefix.turns, loadingMore: t }
                return (delete a.moreFailure, e !== void 0 && (a.moreFailure = e), a)
              })
          }
          a(void 0, !0)
          let o = _n(
            e,
            n.ref,
            n.prefix,
            n.controller.signal,
            r,
            (e) => {
              ;((n.prefix = e), a(void 0, !0))
            },
            t,
          ).then((e) => {
            a(e)
          })
          ;((n.paging = o), await o, n.paging === o && delete n.paging)
        },
        [e, b],
      )
      return {
        detail: r,
        cost: a,
        selectedTurn: s,
        setSelectedTurn: c,
        toolsExpanded: u,
        setToolsExpanded: d,
        loadMore: (0, l.useCallback)(() => {
          x()
        }, [x]),
        jumpTurn: (0, l.useCallback)(
          async (e) => {
            const t = ++g.current,
              n = p.current
            ;(await x(e),
              t === g.current &&
                n !== null &&
                p.current === n &&
                !n.controller.signal.aborted &&
                hn(m.current, n.ref) &&
                n.prefix.turns.some((t) => t.index === e) &&
                c(e))
          },
          [x],
        ),
        onMetadataChanged: (0, l.useCallback)(
          (e) => {
            const t = e.metadata
            ;(h.current.set(`${t.source}:${t.id}`, e),
              i((e) => (e.kind !== `ready` || !hn(e.ref, t) ? e : { ...e, data: b(e.data) })))
          },
          [b],
        ),
        overlaySession: y,
      }
    }
    function yn({ className: e }) {
      return /* @__PURE__ */ (0, u.jsx)(`div`, {
        className: `bg-[linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))] bg-[length:200%_100%] motion-safe:animate-[ci-skel_1.4s_var(--ease-in-out)_infinite] ${e}`,
        "aria-hidden": `true`,
      })
    }
    function bn({ label: e }) {
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `flex flex-col gap-1 px-2 py-2`,
        "aria-busy": `true`,
        role: `status`,
        children: [
          /* @__PURE__ */ (0, u.jsx)(`p`, { className: `m-0 px-1.5 pb-1 text-[11.5px] text-fg-dim`, children: e }),
          [0, 1, 2].map((e) =>
            /* @__PURE__ */ (0, u.jsxs)(
              `div`,
              {
                className: `flex flex-col gap-1.5 py-1`,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-9 w-[86%] rounded-lg` }),
                  e === 0
                    ? [72, 64, 70, 58].map((e) =>
                        /* @__PURE__ */ (0, u.jsx)(yn, { className: `ms-5 h-8 rounded-lg` }, e),
                      )
                    : null,
                ],
              },
              e,
            ),
          ),
        ],
      })
    }
    function xn({ label: e }) {
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `flex h-full min-h-0 flex-col`,
        "aria-busy": `true`,
        role: `status`,
        children: [
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `flex flex-col gap-3 border-b border-line-soft px-5 pt-4 pb-4`,
            children: [
              /* @__PURE__ */ (0, u.jsxs)(`p`, {
                className: `m-0 flex items-center gap-2 text-[11.5px] text-fg-dim`,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(`span`, {
                    className: `inline-block size-1.5 rounded-full bg-accent motion-safe:animate-pulse`,
                    "aria-hidden": `true`,
                  }),
                  e,
                ],
              }),
              /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-5 w-[46%] rounded-[5px]` }),
              /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-3.5 w-[68%] rounded-[4px]` }),
              /* @__PURE__ */ (0, u.jsx)(`div`, {
                className: `grid grid-cols-2 gap-2 @2xl:grid-cols-4`,
                children: [0, 1, 2, 3].map((e) =>
                  /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-[74px] rounded-[10px]` }, e),
                ),
              }),
            ],
          }),
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `grid min-h-0 flex-1 grid-cols-1 @3xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]`,
            children: [
              /* @__PURE__ */ (0, u.jsxs)(`div`, {
                className: `flex flex-col gap-2 border-line-soft p-3 @3xl:border-e`,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-28 rounded-[10px]` }),
                  [0, 1, 2, 3, 4, 5].map((e) => /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-14 rounded-lg` }, e)),
                ],
              }),
              /* @__PURE__ */ (0, u.jsxs)(`div`, {
                className: `hidden flex-col gap-3 p-4 @3xl:flex`,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-5 w-32 rounded-[5px]` }),
                  /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-20 rounded-[10px]` }),
                  /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-44 rounded-[10px]` }),
                  /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-36 rounded-[10px]` }),
                ],
              }),
            ],
          }),
        ],
      })
    }
    function Sn({ title: e, hint: t, center: n = !1 }) {
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: n
          ? `flex h-full min-h-40 flex-col items-center justify-center gap-1.5 p-6 text-center text-[12.5px] text-fg-dim`
          : `flex flex-col items-start gap-1.5 px-4 py-4 text-[12.5px] text-fg-dim`,
        role: `status`,
        children: [
          /* @__PURE__ */ (0, u.jsx)(`p`, { className: `m-0 font-medium text-fg`, children: e }),
          t === void 0
            ? null
            : /* @__PURE__ */ (0, u.jsx)(`p`, { className: `m-0 max-w-[44ch] text-[11.5px]`, children: t }),
        ],
      })
    }
    function Cn({ title: e, detail: t, onRetry: n }) {
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `flex h-full min-h-40 flex-col items-center justify-center gap-2 p-6 text-center`,
        role: `alert`,
        children: [
          /* @__PURE__ */ (0, u.jsx)(`p`, { className: `m-0 max-w-[60ch] text-[12.5px] text-err`, children: e }),
          t === void 0
            ? null
            : /* @__PURE__ */ (0, u.jsx)(`p`, { className: `m-0 text-[11.5px] text-fg-dim`, children: t }),
          /* @__PURE__ */ (0, u.jsx)(`button`, {
            type: `button`,
            className: `ci-btn`,
            onClick: n,
            children: Y(`panel.retry`),
          }),
        ],
      })
    }
    function wn({ children: e }) {
      return /* @__PURE__ */ (0, u.jsx)(`p`, {
        className: `m-0 rounded-lg border border-warn/40 bg-warn/8 px-3 py-2 text-[11.5px] text-warn`,
        role: `note`,
        children: e,
      })
    }
    const Tn = /* @__PURE__ */ new Set([`succeeded`, `failed`])
    function En(e) {
      const t = `m-0 px-2.5 py-2 rounded-lg bg-bg-2 text-xs `
      return e === `succeeded` ? `${t}text-ok` : e === `failed` ? `${t}text-err` : `${t}text-warn`
    }
    function Dn({ api: e, source: t, id: n, onClose: r, onOpenSession: i }) {
      const [a, o] = (0, l.useState)({ kind: `preparing` }),
        [s, c] = (0, l.useState)(``),
        [d, f] = (0, l.useState)(``),
        [p, m] = (0, l.useState)(``),
        [h, g] = (0, l.useState)(``),
        _ = (0, l.useRef)(!0),
        v = (0, l.useRef)(void 0)
      ;(0, l.useEffect)(() => {
        _.current = !0
        const r = new AbortController()
        return (
          e.handoffPrepare(t, n, r.signal).then((e) => {
            r.signal.aborted ||
              (e.ok
                ? (o({ kind: `ready`, brief: e.value }), c(e.value.defaultCwd), f(e.value.brief))
                : o({ kind: `preview-failed`, failure: e }))
          }),
          () => {
            ;((_.current = !1), r.abort(), v.current !== void 0 && window.clearTimeout(v.current))
          }
        )
      }, [e, t, n])
      function y(r) {
        ;(o({ kind: `applying`, brief: r }),
          e.handoffApply({ source: t, id: n, cwd: s, brief: d }).then((t) => {
            if (!_.current) return
            if (!t.ok) {
              o({ kind: `apply-failed`, brief: r, failure: t })
              return
            }
            const n = t.value.sessionId,
              i = t.value.pollAfterMs
            o({ kind: `applied`, sessionId: n, status: { sessionId: n, state: `delivered`, elapsedMs: 0 } })
            function a() {
              e.handoffStatus(n).then((e) => {
                _.current &&
                  (e.ok
                    ? (m(``),
                      o({ kind: `applied`, sessionId: n, status: e.value }),
                      Tn.has(e.value.state) || (v.current = window.setTimeout(a, i)))
                    : (m(e.detail ?? e.error), (v.current = window.setTimeout(a, i))))
              })
            }
            v.current = window.setTimeout(a, i)
          }))
      }
      function b(e) {
        return e.state === `delivered`
          ? Y(`handoff.state.delivered`)
          : e.state === `running`
            ? Y(`handoff.state.running`)
            : e.state === `succeeded`
              ? Y(`handoff.state.succeeded`)
              : Y(`handoff.state.failed`)
      }
      return /* @__PURE__ */ (0, u.jsx)(`div`, {
        className: `fixed inset-0 z-60 flex items-center justify-center bg-[rgb(0_0_0/55%)] p-4`,
        onMouseDown: (e) => e.target === e.currentTarget && r(),
        children: /* @__PURE__ */ (0, u.jsxs)(`div`, {
          className: `grid max-h-[90dvh] w-[min(820px,94vw)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[10px] border-[0.5px] border-line bg-bg-1 shadow-[0_18px_48px_rgb(0_0_0/50%)]`,
          role: `dialog`,
          "aria-modal": `true`,
          "aria-label": Y(`handoff.title`),
          children: [
            /* @__PURE__ */ (0, u.jsxs)(`header`, {
              className: `flex items-center gap-3 border-b border-line-soft px-5 py-4`,
              children: [
                /* @__PURE__ */ (0, u.jsxs)(`div`, {
                  className: `flex min-w-0 flex-col gap-1`,
                  children: [
                    /* @__PURE__ */ (0, u.jsx)(`span`, {
                      className: `text-[16px] font-semibold text-fg`,
                      children: Y(`handoff.title`),
                    }),
                    /* @__PURE__ */ (0, u.jsxs)(`span`, {
                      className: `text-[11px] text-fg-dim`,
                      children: [t, ` · `, n.slice(0, 8)],
                    }),
                  ],
                }),
                /* @__PURE__ */ (0, u.jsx)(`button`, {
                  type: `button`,
                  className: `ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50`,
                  onClick: r,
                  children: `Esc`,
                }),
              ],
            }),
            a.kind === `preparing`
              ? /* @__PURE__ */ (0, u.jsxs)(`div`, {
                  className: `flex min-h-0 flex-col gap-3 overflow-y-auto p-5`,
                  role: `status`,
                  "aria-busy": `true`,
                  children: [
                    /* @__PURE__ */ (0, u.jsxs)(`p`, {
                      className: `m-0 flex items-center gap-2 text-[12px] text-fg-dim`,
                      children: [
                        /* @__PURE__ */ (0, u.jsx)(`span`, {
                          className: `size-1.5 rounded-full bg-accent motion-safe:animate-pulse`,
                          "aria-hidden": `true`,
                        }),
                        Y(`handoff.preparing`),
                      ],
                    }),
                    /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-10 shrink-0 rounded-lg` }),
                    /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-3 w-3/4 shrink-0 rounded-sm` }),
                    /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-5 w-1/2 shrink-0 rounded-sm` }),
                    /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-[min(300px,42dvh)] shrink-0 rounded-lg` }),
                    /* @__PURE__ */ (0, u.jsx)(`div`, {
                      className: `border-t border-line-soft pt-3`,
                      "aria-hidden": `true`,
                      children: /* @__PURE__ */ (0, u.jsx)(yn, { className: `h-10 w-28 rounded-lg` }),
                    }),
                  ],
                })
              : null,
            a.kind === `preview-failed`
              ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                  children: Y(`session.error`, { detail: a.failure.detail ?? a.failure.error }),
                })
              : null,
            a.kind === `ready` || a.kind === `applying` || a.kind === `apply-failed`
              ? /* @__PURE__ */ (0, u.jsxs)(`div`, {
                  className: `flex min-h-0 flex-col gap-3 overflow-y-auto p-5`,
                  children: [
                    /* @__PURE__ */ (0, u.jsxs)(`label`, {
                      className: `flex flex-col gap-2 text-[12px] text-fg`,
                      children: [
                        /* @__PURE__ */ (0, u.jsx)(`span`, { children: Y(`handoff.cwd`) }),
                        /* @__PURE__ */ (0, u.jsx)(`input`, {
                          className: `w-full min-w-0 rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-[12px] text-fg`,
                          value: s,
                          onChange: (e) => c(e.target.value),
                          spellCheck: !1,
                          "aria-describedby": `ci-handoff-cwd-hint`,
                        }),
                      ],
                    }),
                    /* @__PURE__ */ (0, u.jsx)(`p`, {
                      className: `m-0 text-[11px] leading-relaxed text-fg-dim`,
                      id: `ci-handoff-cwd-hint`,
                      children: Y(`handoff.cwdHint`),
                    }),
                    /* @__PURE__ */ (0, u.jsxs)(`div`, {
                      className: `flex flex-wrap gap-1.5`,
                      children: [
                        /* @__PURE__ */ (0, u.jsx)(`span`, {
                          className: `inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim`,
                          children: Y(`handoff.files`, { count: a.brief.fileCount }),
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`span`, {
                          className: `inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim`,
                          children: Y(`handoff.decisions`, { count: a.brief.decisionCount }),
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`span`, {
                          className: `inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim`,
                          children: Y(`handoff.open`, { count: a.brief.openCount }),
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`span`, {
                          className: `inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim`,
                          children: Y(`handoff.commands`, { count: a.brief.commandCount }),
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`span`, {
                          className: `inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 text-[10px] leading-4.25 whitespace-nowrap text-fg-dim`,
                          children: Y(`handoff.chars`, { count: a.brief.chars }),
                        }),
                      ],
                    }),
                    /* @__PURE__ */ (0, u.jsxs)(`label`, {
                      className: `flex flex-col gap-2 text-[12px] text-fg`,
                      children: [
                        /* @__PURE__ */ (0, u.jsx)(`span`, { children: Y(`handoff.brief`) }),
                        /* @__PURE__ */ (0, u.jsx)(`textarea`, {
                          className: `box-border max-h-[42dvh] min-h-40 w-full resize-y rounded-lg border border-line bg-bg p-3 font-mono text-[12px] leading-relaxed text-fg`,
                          value: d,
                          onChange: (e) => f(e.target.value),
                          spellCheck: !1,
                          rows: 14,
                        }),
                      ],
                    }),
                    /* @__PURE__ */ (0, u.jsxs)(`div`, {
                      className: `flex flex-wrap items-center gap-2 border-t border-line-soft pt-3`,
                      children: [
                        /* @__PURE__ */ (0, u.jsx)(`button`, {
                          type: `button`,
                          className: `cursor-pointer rounded-lg border border-accent bg-accent px-4 py-2.5 font-[inherit] text-[12px] font-medium text-white enabled:hover:brightness-110 disabled:cursor-default disabled:opacity-50`,
                          onClick: () => y(a.brief),
                          disabled: a.kind === `applying` || s.trim() === `` || d.trim() === ``,
                          children: a.kind === `applying` ? Y(`handoff.applying`) : Y(`handoff.apply`),
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`button`, {
                          type: `button`,
                          className: `ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50`,
                          disabled: !0,
                          title: Y(`handoff.polishUnavailable`),
                          children: Y(`handoff.polish`),
                        }),
                      ],
                    }),
                    a.kind === `apply-failed`
                      ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                          children: Y(`handoff.applyFailed`, { detail: a.failure.detail ?? a.failure.error }),
                        })
                      : null,
                  ],
                })
              : null,
            a.kind === `applied`
              ? /* @__PURE__ */ (0, u.jsxs)(`div`, {
                  className: `flex min-h-0 flex-col gap-3 overflow-y-auto p-5`,
                  children: [
                    /* @__PURE__ */ (0, u.jsxs)(`p`, {
                      className: En(a.status.state),
                      "data-state": a.status.state,
                      children: [b(a.status), ` · `, a.sessionId.slice(0, 12)],
                    }),
                    /* @__PURE__ */ (0, u.jsx)(`p`, {
                      className: `m-0 text-[12px] text-fg-dim`,
                      role: `status`,
                      children: Y(`handoff.progress`, {
                        seconds: Math.floor(a.status.elapsedMs / 1e3),
                        count: a.status.progress?.toolsCompleted ?? 0,
                      }),
                    }),
                    a.status.state === `running`
                      ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                          className: `m-0 text-[12px] text-fg`,
                          children:
                            a.status.progress?.tool === `ask_user_question`
                              ? Y(`handoff.waiting`)
                              : a.status.progress?.tool
                                ? Y(`handoff.tool`, { tool: a.status.progress.tool })
                                : Y(`handoff.thinking`),
                        })
                      : null,
                    a.status.progress === void 0
                      ? null
                      : /* @__PURE__ */ (0, u.jsx)(`p`, {
                          className: `m-0 text-[11px] text-fg-dim`,
                          children: Y(`handoff.updated`, {
                            time: new Date(a.status.progress.updatedAt).toLocaleTimeString(
                              Y(`handoff.language`) === `zh` ? `zh-CN` : `en-US`,
                            ),
                          }),
                        }),
                    p === ``
                      ? null
                      : /* @__PURE__ */ (0, u.jsx)(`p`, {
                          className: `m-0 text-[12px] text-warn`,
                          role: `alert`,
                          children: Y(`handoff.pollError`, { detail: p }),
                        }),
                    h === ``
                      ? null
                      : /* @__PURE__ */ (0, u.jsx)(`p`, {
                          className: `m-0 text-[12px] text-err`,
                          role: `alert`,
                          children: Y(`handoff.openFailed`, { detail: h }),
                        }),
                    a.status.reason === void 0
                      ? null
                      : /* @__PURE__ */ (0, u.jsx)(`p`, {
                          className: `m-0 font-mono text-[11px] text-err`,
                          children: Y(`handoff.reason`, { reason: a.status.reason }),
                        }),
                    a.status.detail === void 0
                      ? null
                      : /* @__PURE__ */ (0, u.jsx)(`p`, {
                          className: `my-1.5 text-[10.5px] text-fg-dim`,
                          children: a.status.detail,
                        }),
                    a.status.seq === void 0
                      ? null
                      : /* @__PURE__ */ (0, u.jsx)(`p`, {
                          className: `my-1.5 text-[10.5px] text-fg-dim`,
                          children: Y(`handoff.evidence`, { seq: a.status.seq }),
                        }),
                    /* @__PURE__ */ (0, u.jsxs)(`div`, {
                      className: `flex flex-wrap items-center gap-2`,
                      children: [
                        /* @__PURE__ */ (0, u.jsx)(`button`, {
                          type: `button`,
                          className: `cursor-pointer rounded-lg border border-accent bg-accent px-4 py-2.5 text-[12px] text-white disabled:opacity-50`,
                          disabled: i === void 0,
                          onClick: () => {
                            ;(g(``),
                              Promise.resolve()
                                .then(() => i?.(a.sessionId))
                                .then(r)
                                .catch((e) => {
                                  _.current && g(e instanceof Error ? e.message : String(e))
                                }))
                          },
                          children: Y(`handoff.openSession`),
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`button`, {
                          type: `button`,
                          className: `ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50`,
                          onClick: r,
                          children: Y(`handoff.close`),
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
    function On({ cost: e, plain: t = !1 }) {
      const n = e.groups ?? []
      function r() {
        return n.map((t) =>
          /* @__PURE__ */ (0, u.jsxs)(
            `span`,
            { children: [e.partial === !0 && n.length === 1 ? Y(`cost.partialPrefix`) : ``, nn(t.amount, t.currency)] },
            t.tableId + t.currency,
          ),
        )
      }
      const i = Object.entries(e.reference?.byCurrency ?? {}),
        a = i.length === 1 && i[0] !== void 0 ? Y(`cost.reference`, { amount: nn(i[0][1].amount, i[0][0]) }) : void 0,
        o = [],
        s = new Set(n.map((e) => e.tableId))
      e.reference !== void 0 && e.reference !== null && s.add(e.reference.tableId)
      for (const t of s) {
        const n = e.tables?.[t]
        n !== void 0 && o.push(Y(`cost.tableLine`, { id: t, source: n.pricing.source ?? `—`, asOf: n.pricing.asOf }))
      }
      const c = e.unlistedChannels ?? []
      ;(c.length > 0 && o.push(Y(`cost.unlistedTip`, { channels: c.join(`、`) })), o.push(Y(`cost.noConvert`)))
      const l = o.join(` · `)
      return /* @__PURE__ */ (0, u.jsxs)(`span`, {
        className: t
          ? `relative inline-flex items-baseline gap-1.5 whitespace-nowrap [&>span+span]:text-[11px] [&>span+span]:font-normal [&>span+span]:text-fg-dim`
          : `relative inline-flex items-center gap-1 rounded-sm border-[0.5px] border-line bg-transparent px-1.5 font-mono text-[10px] leading-4.25 whitespace-nowrap text-fg-dim data-[state=provisional]:border-dashed`,
        "data-tip": l,
        tabIndex: 0,
        "aria-label": l === `` ? `cost` : l,
        children: [
          n.length === 0 ? `—` : r(),
          a === void 0 ? null : /* @__PURE__ */ (0, u.jsx)(`span`, { children: a }),
          e.provisional === !0
            ? /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `ms-1 inline-flex items-center gap-1 rounded-sm border-[0.5px] border-dashed border-line bg-bg-2 px-1.25 text-[9.5px] leading-4.25 tracking-[0.02em] whitespace-nowrap text-fg-dim normal-case`,
                children: Y(`cost.provisional`),
              })
            : null,
        ],
      })
    }
    const kn = {
        boxSizing: `border-box`,
        display: `flex`,
        flexDirection: `column`,
        flex: `1 1 auto`,
        inlineSize: `100%`,
        blockSize: `100%`,
        minBlockSize: 0,
        minInlineSize: 0,
        overflow: `hidden`,
        position: `relative`,
        containerType: `inline-size`,
        background: `var(--color-bg)`,
        color: `var(--color-fg)`,
        fontSize: `12.5px`,
        lineHeight: 1.55,
      },
      An = `dsh-sessions-insight.tree`
    function jn(e, t) {
      return `${e}:${t}`
    }
    function Mn(e, t) {
      return e.map((e) => {
        const n = t(e.workdir)
        return {
          workdir: e.workdir,
          leaf: n.leaf === `` ? e.workdir : n.leaf,
          parent: n.parent,
          counts: e.sources.map((e) => ({ source: e.source, sessions: e.sessions })),
          lastUpdatedAt: e.lastUpdatedAt,
        }
      })
    }
    function Nn(e) {
      const t = e.pageSize ?? 20,
        n = []
      for (const r of e.projects) {
        const i = e.expanded.has(r.workdir)
        if ((n.push({ kind: `project`, key: `p:${r.workdir}`, project: r, expanded: i }), !i)) continue
        if (e.loading.has(r.workdir)) {
          n.push({ kind: `skeleton`, key: `l:${r.workdir}`, workdir: r.workdir, rows: 4 })
          continue
        }
        const a = e.sessions.get(r.workdir)
        if (a === void 0) {
          n.push({ kind: `skeleton`, key: `l:${r.workdir}`, workdir: r.workdir, rows: 4 })
          continue
        }
        const o = e.limits.get(r.workdir) ?? t,
          s = a.slice(0, o)
        for (const t of s) {
          const i = jn(t.source, t.id)
          n.push({ kind: `session`, key: i, workdir: r.workdir, session: t, selected: i === e.selected })
        }
        a.length > s.length &&
          n.push({ kind: `more`, key: `m:${r.workdir}`, workdir: r.workdir, hidden: a.length - s.length })
      }
      return n
    }
    function Pn(e, t, n) {
      if (e.length === 0) return -1
      if (n === `Home`) return 0
      if (n === `End`) return e.length - 1
      const r = n === `ArrowDown` ? 1 : n === `ArrowUp` ? -1 : 0
      if (r === 0) return t
      const i = t < 0 ? (r > 0 ? -1 : e.length) : t
      return Math.min(e.length - 1, Math.max(0, i + r))
    }
    function Fn(e) {
      if (e === void 0) return []
      try {
        const t = e.getItem(An)
        if (t === null) return []
        const n = JSON.parse(t)
        return Array.isArray(n) ? n.filter((e) => typeof e == `string`) : []
      } catch {
        return []
      }
    }
    function In(e, t) {
      if (e !== void 0)
        try {
          e.setItem(An, JSON.stringify(t))
        } catch {}
    }
    function Ln(e, t) {
      const n = t.trim().toLowerCase()
      return n === `` ? [...e] : e.filter((e) => e.workdir.toLowerCase().includes(n))
    }
    async function Rn(e, t, n, r) {
      const i = []
      for (const a of e) {
        if (r?.aborted) break
        try {
          const e = await t(a)
          e.ok ? n(a, e.value) : i.push({ session: a, reason: Mt(e) })
        } catch (e) {
          i.push({ session: a, reason: e instanceof Error ? e.message : String(e) })
        }
      }
      return i
    }
    function zn(e, t, n) {
      return new Map(
        [...e].map(([e, r]) => [
          e,
          r.flatMap((e) => {
            const r = t.get(jn(e.source, e.id)),
              i = r?.metadata.group ?? ``
            if (n !== `` && (n === `ungrouped` ? i !== `` : i !== n.slice(6))) return []
            const a = r?.displayTitle ?? r?.metadata.title ?? e.title
            return [
              (r?.metadata.title?.trim().length ?? 0) > 0
                ? { ...e, title: a, named: !0 }
                : a === e.title
                  ? e
                  : { ...e, title: a },
            ]
          }),
        ]),
      )
    }
    function Bn() {
      return { keys: /* @__PURE__ */ new Set(), anchor: null }
    }
    function Vn(e) {
      return e.flatMap((e) => (e.kind === `session` ? [e.session] : []))
    }
    function Hn(e, t, n, r = !1) {
      const i = n.map((e) => jn(e.source, e.id)),
        a = i.indexOf(t)
      if (a < 0) return e
      const o = e.anchor === null ? -1 : i.indexOf(e.anchor),
        s = new Set(e.keys)
      if (r && o >= 0) {
        const n = i.slice(Math.min(o, a), Math.max(o, a) + 1)
        for (const r of n) e.keys.has(t) ? s.delete(r) : s.add(r)
        return { keys: s, anchor: e.anchor }
      }
      return (s.has(t) ? s.delete(t) : s.add(t), { keys: s, anchor: t })
    }
    function Un(e, t) {
      const n = new Set(e.keys)
      for (const e of t) n.add(jn(e.source, e.id))
      return { keys: n, anchor: null }
    }
    function Wn(e, t) {
      const n = new Set(e.keys)
      return (n.delete(t), { keys: n, anchor: e.anchor === t ? null : e.anchor })
    }
    function Gn(e, t) {
      const n = /* @__PURE__ */ new Map()
      for (const r of t.values())
        for (const t of r) {
          const r = jn(t.source, t.id)
          e.keys.has(r) && n.set(r, t)
        }
      return [...n.values()]
    }
    function Kn(e, t, n) {
      const r = e,
        [i, a] = (0, l.useState)(!1),
        [o, s] = (0, l.useState)(Bn),
        [c, u] = (0, l.useState)(/* @__PURE__ */ new Map()),
        [d, f] = (0, l.useState)(``),
        [p, m] = (0, l.useState)(null),
        [h, g] = (0, l.useState)(!1),
        [_, v] = (0, l.useState)([]),
        [y, b] = (0, l.useState)(``),
        [x, S] = (0, l.useState)(!1),
        [C, w] = (0, l.useState)(/* @__PURE__ */ new Map()),
        [T, E] = (0, l.useState)(/* @__PURE__ */ new Map()),
        [D, O] = (0, l.useState)(/* @__PURE__ */ new Map()),
        [k, A] = (0, l.useState)(!1),
        [j, M] = (0, l.useState)({ done: 0, total: 0 }),
        N = (0, l.useRef)(!1),
        P = (0, l.useRef)(null),
        F = (0, l.useRef)(!1),
        I = (0, l.useRef)(new AbortController()),
        L = (0, l.useRef)(null),
        R = (0, l.useRef)(null),
        z = (0, l.useRef)(0)
      ;(0, l.useEffect)(() => {
        const e = new AbortController()
        return (
          (I.current = e),
          () => {
            ;(e.abort(), L.current?.abort(), (R.current = null))
          }
        )
      }, [])
      function B() {
        ;(L.current?.abort(), (L.current = null), A(!1))
      }
      function ee() {
        F.current || (B(), (R.current = null), m(null))
      }
      function V() {
        ;(s(Bn()), v([]))
      }
      function H(e) {
        ;(I.current.signal.aborted || s((t) => Wn(t, jn(e.source, e.id))), t(e))
      }
      async function U() {
        if (I.current.signal.aborted) return !1
        if (N.current) return !0
        if (P.current !== null) return P.current
        if (r.metadata === void 0) return (b(Y(`management.unavailable`)), !1)
        const e = I.current.signal
        return (
          S(!0),
          b(``),
          (P.current = (async () => {
            try {
              const t = await r.metadata(e)
              return e.aborted
                ? !1
                : t.ok
                  ? (u((e) => {
                      const n = new Map(t.value.entries.map((e) => [jn(e.source, e.id), { metadata: e }]))
                      for (const [t, r] of e) n.set(t, r)
                      return n
                    }),
                    (N.current = !0),
                    !0)
                  : (b(Mt(t)), !1)
            } catch (t) {
              return (e.aborted || b(t instanceof Error ? t.message : String(t)), !1)
            } finally {
              ;(e.aborted || S(!1), (P.current = null))
            }
          })()),
          P.current
        )
      }
      function te() {
        F.current || (a(!i), V(), i || U())
      }
      function ne(e, t, n = !1, r = 0) {
        if (F.current || I.current.signal.aborted) return null
        B()
        const i = { serial: ++z.current, kind: e, sessions: [...t], ai: n, skipped: r }
        return (
          (R.current = i),
          v([]),
          w(/* @__PURE__ */ new Map()),
          E(/* @__PURE__ */ new Map()),
          O(/* @__PURE__ */ new Map()),
          M({ done: 0, total: 0 }),
          m(i),
          U(),
          i
        )
      }
      async function W(e, t) {
        t.length > 0 && ne(e, t)
      }
      async function re(e, t = R.current) {
        if (
          t === null ||
          R.current !== t ||
          I.current.signal.aborted ||
          t.kind !== `rename` ||
          F.current ||
          L.current !== null ||
          e.length === 0 ||
          !window.confirm(Y(`management.aiConfirm`, { count: e.length }))
        )
          return
        const n = new AbortController()
        ;((L.current = n), A(!0), M({ done: 0, total: e.length }))
        const i = () => !n.signal.aborted && !I.current.signal.aborted && R.current === t
        try {
          for (const t of e) {
            if (!i()) break
            const e = jn(t.source, t.id)
            O((t) => {
              const n = new Map(t)
              return (n.delete(e), n)
            })
            try {
              if (r.suggestTitle === void 0) throw Error(Y(`management.aiUnavailable`))
              const a = await r.suggestTitle(t.source, t.id, n.signal)
              if (!i()) break
              if (!a.ok) throw Error(Mt(a))
              ;(E((t) => new Map(t).set(e, a.value)), w((t) => new Map(t).set(e, a.value.title)))
            } catch (t) {
              if (!i()) break
              O((n) => new Map(n).set(e, t instanceof Error ? t.message : String(t)))
            }
            i() && M((e) => ({ ...e, done: e.done + 1 }))
          }
        } finally {
          L.current === n && ((L.current = null), I.current.signal.aborted || A(!1))
        }
      }
      async function G(e, t = !0) {
        if (e.length === 0) return
        const n = e.filter((e) => !t || e.named !== !0),
          r = ne(`rename`, n, !0, e.length - n.length)
        r !== null && (await re(n, r))
      }
      function ie(e, t) {
        w((n) => new Map(n).set(e, t))
      }
      async function K(t) {
        if (
          F.current ||
          I.current.signal.aborted ||
          t.length === 0 ||
          !window.confirm(Y(`management.deleteConfirm`, { count: t.length }))
        )
          return
        B()
        const n = I.current.signal
        ;((F.current = !0), g(!0), v([]))
        try {
          const r = await Rn(t, (t) => e.deleteSession(t.source, t.id), H, n)
          n.aborted || v(r)
        } finally {
          ;(n.aborted || g(!1), (F.current = !1))
        }
      }
      async function q(e, t) {
        const i = R.current
        if (F.current || L.current !== null || i === null || r.updateMetadata === void 0 || I.current.signal.aborted)
          return
        const a = i.kind === `rename` ? i.sessions.filter((t) => e.has(jn(t.source, t.id))) : i.sessions
        if (a.length === 0) return
        const o = I.current.signal
        ;((F.current = !0), g(!0), v([]))
        try {
          const s = await Rn(
            a,
            (n) =>
              r.updateMetadata({
                source: n.source,
                id: n.id,
                ...(i.kind === `rename` ? { title: e.get(jn(n.source, n.id)) } : { group: t }),
              }),
            (e, t) => {
              ;(o.aborted || u((n) => new Map(n).set(jn(e.source, e.id), t)), n?.(t))
            },
            o,
          )
          if (o.aborted) return
          v(s)
          const c = new Set(s.map(({ session: e }) => jn(e.source, e.id))),
            l = i.sessions.filter(
              (t) => (!e.has(jn(t.source, t.id)) && i.kind === `rename`) || c.has(jn(t.source, t.id)),
            ),
            d = l.length === 0 ? null : { ...i, sessions: l }
          ;((R.current = d), m(d))
        } finally {
          ;(o.aborted || g(!1), (F.current = !1))
        }
      }
      return {
        editing: i,
        selection: o,
        setSelection: s,
        clearSelection: V,
        toggleEditing: te,
        metadata: c,
        metadataError: y,
        metadataLoading: x,
        ensureMetadata: U,
        groups: [...new Set([...c.values()].flatMap((e) => (e.metadata.group ? [e.metadata.group] : [])))].sort(),
        groupFilter: d,
        setGroupFilter: (e) => {
          ;(f(e), V())
        },
        dialog: p,
        openDialog: W,
        openAiDialog: G,
        closeDialog: ee,
        busy: h,
        failures: _,
        deleteSessions: K,
        deleted: H,
        save: q,
        drafts: C,
        editDraft: ie,
        suggestions: T,
        aiErrors: D,
        generating: k,
        progress: j,
        generateTitles: re,
        stopGeneration: B,
      }
    }
    const qn = {
      claude: {
        brand: `#D97757`,
        text: `color-mix(in srgb, #D97757 62%, white)`,
        label: { zh: `Claude`, en: `Claude` },
      },
      codex: { brand: `#10A37F`, text: `color-mix(in srgb, #10A37F 62%, white)`, label: { zh: `Codex`, en: `Codex` } },
      dsh: { brand: `#4D6BFE`, text: `color-mix(in srgb, #4D6BFE 62%, white)`, label: { zh: `DSH`, en: `DSH` } },
    }
    function Jn({ source: e, size: t = 12, tone: n = `brand` }) {
      const r = qn[e],
        i = n === `brand` ? r.brand : `currentColor`
      return e === `claude`
        ? /* @__PURE__ */ (0, u.jsx)(`svg`, {
            width: t,
            height: t,
            viewBox: `0 0 16 16`,
            "aria-hidden": `true`,
            focusable: `false`,
            children: /* @__PURE__ */ (0, u.jsx)(`g`, {
              stroke: i,
              strokeWidth: `1.6`,
              strokeLinecap: `round`,
              children: /* @__PURE__ */ (0, u.jsx)(`path`, {
                d: `M8 2.2v11.6M2.2 8h11.6M3.9 3.9l8.2 8.2M12.1 3.9l-8.2 8.2`,
              }),
            }),
          })
        : e === `codex`
          ? /* @__PURE__ */ (0, u.jsxs)(`svg`, {
              width: t,
              height: t,
              viewBox: `0 0 16 16`,
              "aria-hidden": `true`,
              focusable: `false`,
              children: [
                /* @__PURE__ */ (0, u.jsx)(`path`, {
                  d: `M8 1.8l5.4 3.1v6.2L8 14.2 2.6 11.1V4.9z`,
                  fill: `none`,
                  stroke: i,
                  strokeWidth: `1.5`,
                  strokeLinejoin: `round`,
                }),
                /* @__PURE__ */ (0, u.jsx)(`path`, {
                  d: `M5.4 6.2L8 8.6l2.6-2.4M8 8.6v3.2`,
                  fill: `none`,
                  stroke: i,
                  strokeWidth: `1.2`,
                  strokeLinecap: `round`,
                }),
              ],
            })
          : /* @__PURE__ */ (0, u.jsx)(`svg`, {
              width: t,
              height: t,
              viewBox: `0 0 16 16`,
              "aria-hidden": `true`,
              focusable: `false`,
              children: /* @__PURE__ */ (0, u.jsx)(`g`, {
                stroke: i,
                strokeWidth: `1.6`,
                strokeLinecap: `round`,
                children: /* @__PURE__ */ (0, u.jsx)(`path`, {
                  d: `M2.4 8h1.6M6.2 5v6M8.8 3v10M11.4 5.6v4.8M14 7h-1.2`,
                }),
              }),
            })
    }
    const Yn = {
      search: `M7.2 12.4a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4ZM11 11l3.2 3.2`,
      refresh: `M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.6 2.4v2.9h-2.9`,
      chevron: `M6 3.8 10.2 8 6 12.2`,
      sidebar: `M2.5 3.5h11v9h-11zM6.2 3.5v9`,
      folder: `M2 4.5c0-.6.4-1 1-1h3.1l1.4 1.5H13c.6 0 1 .4 1 1v6c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z`,
      tool: `M10.4 2.6a3 3 0 0 0-3.7 3.9L2.6 10.6a1.3 1.3 0 0 0 1.8 1.8l4.1-4.1a3 3 0 0 0 3.9-3.7l-1.8 1.8-1.6-.4-.4-1.6z`,
      branch: `M4.5 2.5v11M4.5 9.5c0-2.5 7-1.5 7-5M11.5 2.5v2`,
      handoff: `M3 8h9M9 4.5 12.5 8 9 11.5`,
      trash: `M2 4h12M6 4V2h4v2M4 4l1 10h6l1-10M7 6v5M9 6v5`,
      close: `M4 4l8 8M12 4l-8 8`,
    }
    function Xn({ name: e, size: t = 14, className: n }) {
      return /* @__PURE__ */ (0, u.jsx)(`svg`, {
        className: n,
        width: t,
        height: t,
        viewBox: `0 0 16 16`,
        fill: `none`,
        stroke: `currentColor`,
        strokeWidth: `1.4`,
        strokeLinecap: `round`,
        strokeLinejoin: `round`,
        "aria-hidden": `true`,
        focusable: `false`,
        children: /* @__PURE__ */ (0, u.jsx)(`path`, { d: Yn[e] }),
      })
    }
    function Zn({ size: e = 24 }) {
      return /* @__PURE__ */ (0, u.jsx)(`span`, {
        className: `inline-grid shrink-0 place-items-center rounded-[7px] bg-[color-mix(in_oklch,var(--color-accent)_16%,transparent)] text-accent`,
        style: { inlineSize: e, blockSize: e },
        "aria-hidden": `true`,
        children: /* @__PURE__ */ (0, u.jsxs)(`svg`, {
          width: e * 0.62,
          height: e * 0.62,
          viewBox: `0 0 16 16`,
          fill: `none`,
          stroke: `currentColor`,
          strokeLinecap: `round`,
          children: [
            /* @__PURE__ */ (0, u.jsx)(`circle`, { cx: `6.7`, cy: `6.7`, r: `4.2`, strokeWidth: `1.5` }),
            /* @__PURE__ */ (0, u.jsx)(`path`, { d: `M9.9 9.9 13.6 13.6`, strokeWidth: `1.7` }),
            /* @__PURE__ */ (0, u.jsx)(`path`, { d: `M4.9 5.3h3.4M4.9 7.1h2.4M4.9 8.9h1.4`, strokeWidth: `1.2` }),
          ],
        }),
      })
    }
    function Qn({ state: e, visible: t }) {
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `flex flex-col gap-1.5`,
        children: [
          e.editing
            ? /* @__PURE__ */ (0, u.jsxs)(`div`, {
                className: `flex flex-wrap gap-1`,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(`button`, {
                    type: `button`,
                    className: `ci-btn ci-btn--quiet active:bg-hover`,
                    disabled: e.busy,
                    onClick: t,
                    children: Y(`management.selectVisible`),
                  }),
                  /* @__PURE__ */ (0, u.jsx)(`button`, {
                    type: `button`,
                    className: `ci-btn ci-btn--quiet active:bg-hover`,
                    disabled: e.busy,
                    onClick: e.clearSelection,
                    children: Y(`management.clear`),
                  }),
                ],
              })
            : null,
          e.editing || e.groupFilter !== ``
            ? /* @__PURE__ */ (0, u.jsxs)(`select`, {
                "aria-label": Y(`management.groupFilter`),
                className: `min-w-0 rounded border border-line bg-bg px-2 py-1 text-[12px] text-fg focus-visible:outline-2 focus-visible:outline-accent`,
                value: e.groupFilter,
                disabled: e.busy || e.metadataLoading,
                onChange: (t) => e.setGroupFilter(t.currentTarget.value),
                children: [
                  /* @__PURE__ */ (0, u.jsx)(`option`, { value: ``, children: Y(`management.allGroups`) }),
                  /* @__PURE__ */ (0, u.jsx)(`option`, { value: `ungrouped`, children: Y(`management.ungrouped`) }),
                  e.groups.map((e) => /* @__PURE__ */ (0, u.jsx)(`option`, { value: `group:${e}`, children: e }, e)),
                ],
              })
            : null,
          e.metadataLoading
            ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                role: `status`,
                className: `m-0 text-[11px] text-fg-dim`,
                children: Y(`management.loading`),
              })
            : null,
          e.metadataError === ``
            ? null
            : /* @__PURE__ */ (0, u.jsxs)(`div`, {
                role: `alert`,
                className: `text-[11px] text-err`,
                children: [
                  e.metadataError,
                  /* @__PURE__ */ (0, u.jsx)(`button`, {
                    type: `button`,
                    className: `ci-btn ci-btn--quiet active:bg-hover`,
                    onClick: () => void e.ensureMetadata(),
                    children: Y(`management.retry`),
                  }),
                ],
              }),
        ],
      })
    }
    function $n({ state: e, selected: t }) {
      return /* @__PURE__ */ (0, u.jsxs)(u.Fragment, {
        children: [
          e.editing
            ? /* @__PURE__ */ (0, u.jsxs)(`footer`, {
                className: `flex shrink-0 flex-col gap-2 border-bs border-line bg-bg-1 p-3`,
                "aria-label": Y(`sessions.actions`),
                children: [
                  /* @__PURE__ */ (0, u.jsx)(`span`, {
                    role: `status`,
                    className: `text-[12px] tabular-nums`,
                    children: Y(`management.selected`, { count: t.length }),
                  }),
                  /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    className: `flex flex-wrap gap-1`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`button`, {
                        type: `button`,
                        className: `ci-btn active:bg-hover`,
                        disabled: e.busy || t.length === 0,
                        onClick: () => void e.openDialog(`rename`, t),
                        children: Y(`management.rename`),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`button`, {
                        type: `button`,
                        className: `ci-btn active:bg-hover`,
                        disabled: e.busy || e.generating || t.length === 0,
                        onClick: () => void e.openAiDialog(t),
                        children: Y(`management.aiRename`),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`button`, {
                        type: `button`,
                        className: `ci-btn active:bg-hover`,
                        disabled: e.busy || t.length === 0,
                        onClick: () => void e.openDialog(`group`, t),
                        children: Y(`management.move`),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`button`, {
                        type: `button`,
                        className: `ci-btn text-err active:bg-hover`,
                        disabled: e.busy || t.length === 0,
                        onClick: () => void e.deleteSessions(t),
                        children: Y(e.busy ? `management.saving` : `management.delete`),
                      }),
                    ],
                  }),
                  e.dialog === null && e.failures.length > 0
                    ? /* @__PURE__ */ (0, u.jsxs)(`div`, {
                        className: `max-bs-32 overflow-y-auto`,
                        role: `alert`,
                        children: [
                          e.failures.map(({ session: e, reason: t }) =>
                            /* @__PURE__ */ (0, u.jsx)(
                              `p`,
                              {
                                className: `m-0 text-[11px] text-err`,
                                children: Y(`management.failure`, { title: e.title, reason: t }),
                              },
                              jn(e.source, e.id),
                            ),
                          ),
                          /* @__PURE__ */ (0, u.jsx)(`button`, {
                            type: `button`,
                            className: `ci-btn active:bg-hover`,
                            disabled: e.busy,
                            onClick: () => void e.deleteSessions(e.failures.map((e) => e.session)),
                            children: Y(`management.retry`),
                          }),
                        ],
                      })
                    : null,
                ],
              })
            : null,
          e.dialog === null ? null : /* @__PURE__ */ (0, u.jsx)(er, { state: e }, e.dialog.serial),
        ],
      })
    }
    function er({ state: e }) {
      const t = e.dialog,
        n = (0, l.useRef)(null),
        r = (0, l.useId)(),
        i = (0, l.useId)(),
        [a, o] = (0, l.useState)(/* @__PURE__ */ new Set()),
        [s, c] = (0, l.useState)(``),
        [d, f] = (0, l.useState)(!1)
      if (
        ((0, l.useEffect)(() => {
          const e = n.current
          return (e?.showModal(), e?.querySelector(`input:not(:disabled)`)?.focus(), () => e?.close())
        }, []),
        t === null)
      )
        return null
      const p = t.kind === `rename`
      return /* @__PURE__ */ (0, u.jsx)(`dialog`, {
        ref: n,
        "aria-labelledby": r,
        className: `ci-panel max-bs-[80dvh] rounded-xl border border-line bg-bg-1 p-0 text-fg shadow-lg backdrop:bg-black/40`,
        style: { inlineSize: `min(34rem, calc(100% - 2rem))` },
        onCancel: (t) => {
          ;(t.preventDefault(), e.closeDialog())
        },
        onClick: (t) => {
          if (t.target !== t.currentTarget) return
          const n = t.currentTarget.getBoundingClientRect()
          ;(t.clientX < n.left || t.clientX > n.right || t.clientY < n.top || t.clientY > n.bottom) && e.closeDialog()
        },
        children: /* @__PURE__ */ (0, u.jsxs)(`form`, {
          className: `max-bs-[80dvh] flex flex-col`,
          onSubmit: (n) => {
            n.preventDefault()
            const r = /* @__PURE__ */ new Map()
            for (const n of t.sessions) {
              const i = jn(n.source, n.id)
              a.has(i)
                ? r.set(i, null)
                : e.drafts.has(i)
                  ? r.set(i, e.drafts.get(i)?.trim() ?? null)
                  : !t.ai && !e.aiErrors.has(i) && !e.suggestions.has(i) && e.progress.total === 0 && r.set(i, n.title)
            }
            e.save(r, d ? null : s.trim())
          },
          children: [
            /* @__PURE__ */ (0, u.jsxs)(`h2`, {
              id: r,
              className: `m-0 shrink-0 p-4 text-[15px] font-semibold`,
              children: [Y(p ? `management.rename` : `management.move`), ` · `, t.sessions.length],
            }),
            /* @__PURE__ */ (0, u.jsxs)(`div`, {
              className: `ci-scroll min-bs-0 flex-1 overflow-y-auto overscroll-contain px-4`,
              children: [
                t.ai || e.progress.total > 0
                  ? /* @__PURE__ */ (0, u.jsxs)(`div`, {
                      className: `flex flex-col gap-1 text-[11px] text-fg-dim`,
                      role: `status`,
                      children: [
                        /* @__PURE__ */ (0, u.jsx)(`p`, { className: `m-0`, children: Y(`management.aiHint`) }),
                        /* @__PURE__ */ (0, u.jsx)(`p`, {
                          className: `m-0`,
                          children: Y(`management.aiSkipped`, { count: t.skipped }),
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`p`, {
                          className: `m-0`,
                          children: Y(`management.aiProgress`, e.progress),
                        }),
                        e.generating
                          ? /* @__PURE__ */ (0, u.jsx)(`button`, {
                              type: `button`,
                              className: `ci-btn active:bg-hover`,
                              onClick: e.stopGeneration,
                              children: Y(`management.aiStop`),
                            })
                          : null,
                      ],
                    })
                  : null,
                p
                  ? t.sessions.map((n) => {
                      const r = jn(n.source, n.id)
                      return /* @__PURE__ */ (0, u.jsxs)(
                        `div`,
                        {
                          className: `mbs-2 flex flex-col gap-1 text-[12px]`,
                          children: [
                            /* @__PURE__ */ (0, u.jsx)(`span`, { className: `wrap-break-word`, children: n.title }),
                            /* @__PURE__ */ (0, u.jsxs)(`span`, {
                              className: `text-[10px] break-all text-fg-dim`,
                              children: [n.source, ` · `, n.workdir, ` · `, n.id],
                            }),
                            /* @__PURE__ */ (0, u.jsx)(`input`, {
                              "aria-label": Y(`management.name`, { title: n.title }),
                              className: `min-w-0 rounded border border-line bg-bg px-2 py-1.5 text-fg focus-visible:outline-2 focus-visible:outline-accent`,
                              value: e.drafts.get(r) ?? n.title,
                              maxLength: 80,
                              disabled: e.busy || e.generating || a.has(r),
                              required: !a.has(r),
                              onChange: (t) => e.editDraft(r, t.currentTarget.value),
                            }),
                            /* @__PURE__ */ (0, u.jsx)(`button`, {
                              type: `button`,
                              className: `ci-btn active:bg-hover`,
                              disabled: e.busy || e.generating || a.has(r),
                              onClick: () => void e.generateTitles([n]),
                              children: Y(e.aiErrors.has(r) ? `management.retry` : `management.aiSuggest`),
                            }),
                            e.suggestions.has(r)
                              ? /* @__PURE__ */ (0, u.jsxs)(`span`, {
                                  className: `text-[10px] text-fg-dim`,
                                  title: `${e.suggestions.get(r).provider} · ${e.suggestions.get(r).model}`,
                                  children: [e.suggestions.get(r).provider, ` · `, e.suggestions.get(r).model],
                                })
                              : null,
                            e.aiErrors.has(r)
                              ? /* @__PURE__ */ (0, u.jsx)(`span`, {
                                  role: `alert`,
                                  className: `text-[11px] text-err`,
                                  children: e.aiErrors.get(r),
                                })
                              : null,
                            (t.ai || e.progress.total > 0) && !e.drafts.has(r) && !a.has(r)
                              ? /* @__PURE__ */ (0, u.jsx)(`span`, {
                                  className: `text-[11px] text-fg-dim`,
                                  children: Y(`management.aiPending`),
                                })
                              : null,
                            /* @__PURE__ */ (0, u.jsxs)(`label`, {
                              className: `flex items-center gap-1`,
                              children: [
                                /* @__PURE__ */ (0, u.jsx)(`input`, {
                                  type: `checkbox`,
                                  checked: a.has(r),
                                  disabled: e.busy || e.generating,
                                  onChange: (e) => {
                                    const t = new Set(a)
                                    ;(e.currentTarget.checked ? t.add(r) : t.delete(r), o(t))
                                  },
                                }),
                                Y(`management.restore`),
                              ],
                            }),
                          ],
                        },
                        r,
                      )
                    })
                  : /* @__PURE__ */ (0, u.jsxs)(`div`, {
                      className: `flex flex-col gap-2 text-[12px]`,
                      children: [
                        /* @__PURE__ */ (0, u.jsx)(`p`, {
                          className: `m-0 text-fg-dim`,
                          children: Y(`management.groupHint`),
                        }),
                        /* @__PURE__ */ (0, u.jsxs)(`label`, {
                          className: `flex flex-col gap-1`,
                          children: [
                            Y(`management.group`),
                            /* @__PURE__ */ (0, u.jsx)(`input`, {
                              className: `rounded border border-line bg-bg px-2 py-1.5 text-fg focus-visible:outline-2 focus-visible:outline-accent`,
                              list: i,
                              maxLength: 80,
                              value: s,
                              disabled: e.busy || d,
                              required: !d,
                              onChange: (e) => c(e.currentTarget.value),
                            }),
                          ],
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`datalist`, {
                          id: i,
                          children: e.groups.map((e) => /* @__PURE__ */ (0, u.jsx)(`option`, { value: e }, e)),
                        }),
                        /* @__PURE__ */ (0, u.jsxs)(`label`, {
                          className: `flex items-center gap-1`,
                          children: [
                            /* @__PURE__ */ (0, u.jsx)(`input`, {
                              type: `checkbox`,
                              checked: d,
                              disabled: e.busy,
                              onChange: (e) => f(e.currentTarget.checked),
                            }),
                            Y(`management.ungroup`),
                          ],
                        }),
                        t.sessions.map((e) =>
                          /* @__PURE__ */ (0, u.jsxs)(
                            `p`,
                            { className: `m-0 wrap-break-word text-fg-dim`, children: [e.title, ` · `, e.workdir] },
                            jn(e.source, e.id),
                          ),
                        ),
                      ],
                    }),
                e.failures.length > 0
                  ? /* @__PURE__ */ (0, u.jsx)(`div`, {
                      role: `alert`,
                      className: `mbs-2 text-[11px] text-err`,
                      children: e.failures.map(({ session: e, reason: t }) =>
                        /* @__PURE__ */ (0, u.jsx)(
                          `p`,
                          { children: Y(`management.failure`, { title: e.title, reason: t }) },
                          jn(e.source, e.id),
                        ),
                      ),
                    })
                  : null,
              ],
            }),
            /* @__PURE__ */ (0, u.jsxs)(`div`, {
              className: `flex shrink-0 justify-end gap-2 p-4`,
              children: [
                /* @__PURE__ */ (0, u.jsx)(`button`, {
                  type: `button`,
                  className: `ci-btn active:bg-hover`,
                  disabled: e.busy,
                  onClick: e.closeDialog,
                  children: Y(`management.cancel`),
                }),
                /* @__PURE__ */ (0, u.jsx)(`button`, {
                  type: `submit`,
                  className: `ci-btn active:bg-hover`,
                  disabled:
                    e.busy ||
                    e.generating ||
                    t.sessions.length === 0 ||
                    ((t.ai || e.progress.total > 0) &&
                      !t.sessions.some((t) => a.has(jn(t.source, t.id)) || e.drafts.has(jn(t.source, t.id)))) ||
                    e.metadataLoading ||
                    e.metadataError !== `` ||
                    (!p && !d && s.trim() === ``) ||
                    (p &&
                      t.sessions.some((t) => {
                        const n = jn(t.source, t.id)
                        return !a.has(n) && (e.drafts.get(n) ?? t.title).trim() === ``
                      })),
                  children: Y(
                    e.busy ? `management.saving` : e.failures.length > 0 ? `management.retry` : `management.save`,
                  ),
                }),
              ],
            }),
          ],
        }),
      })
    }
    function tr({
      row: e,
      index: t,
      onOpen: n,
      onFocus: r,
      api: i,
      onDeleted: a,
      editing: o = !1,
      checked: s = !1,
      busy: c = !1,
      onCheck: d,
      onRename: f,
      onAiRename: p,
      onMove: m,
    }) {
      const h = (0, l.useRef)(null),
        g = (0, l.useRef)(null),
        [_, v] = (0, l.useState)(!1),
        [y, b] = (0, l.useState)(!1),
        [x, S] = (0, l.useState)(``)
      ;(0, l.useEffect)(() => {
        if (!_) return
        const e = g.current
        if (e === null) return
        const t = e.ownerDocument
        function n(t) {
          t.composedPath().includes(e) || (e?.hidePopover(), v(!1))
        }
        function r(e) {
          e.key === `Escape` && C()
        }
        function i() {
          ;(e?.hidePopover(), v(!1))
        }
        return (
          t.addEventListener(`pointerdown`, n, !0),
          t.addEventListener(`keydown`, r, !0),
          t.addEventListener(`scroll`, i, !0),
          t.defaultView?.addEventListener(`blur`, i),
          () => {
            ;(t.removeEventListener(`pointerdown`, n, !0),
              t.removeEventListener(`keydown`, r, !0),
              t.removeEventListener(`scroll`, i, !0),
              t.defaultView?.removeEventListener(`blur`, i))
          }
        )
      }, [_])
      function C() {
        ;(g.current?.hidePopover(), v(!1), h.current?.focus({ preventScroll: !0 }))
      }
      function w(e, t) {
        const n = g.current
        if (n === null || y) return
        for (const e of n.ownerDocument.querySelectorAll(`[data-session-menu]:popover-open`)) e !== n && e.hidePopover()
        ;(n.showPopover(), v(!0))
        const r = n.getBoundingClientRect(),
          i = n.ownerDocument.defaultView
        ;((n.style.insetInlineStart = `${Math.max(8, Math.min(e, (i?.innerWidth ?? r.right) - r.width - 8))}px`),
          (n.style.insetBlockStart = `${Math.max(8, Math.min(t, (i?.innerHeight ?? r.bottom) - r.height - 8))}px`),
          n.querySelector(`button`)?.focus({ preventScroll: !0 }))
      }
      async function T() {
        if ((C(), y || !window.confirm(Y(`sessions.deleteConfirm`, { title: e.session.title })))) return
        ;(b(!0), S(``))
        const t = await i.deleteSession(e.session.source, e.session.id)
        ;(b(!1),
          t.ok
            ? a(e.session)
            : S(
                t.detail === `shared-session-logs`
                  ? Y(`sessions.deleteShared`)
                  : Y(`sessions.deleteFailed`, { detail: Mt(t) }),
              ))
      }
      const E = qn[e.session.source]
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `ms-3.25 border-s border-line-soft ps-1.5`,
        children: [
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `flex items-center gap-1`,
            children: [
              o
                ? /* @__PURE__ */ (0, u.jsx)(`input`, {
                    type: `checkbox`,
                    "aria-label": Y(`management.name`, { title: e.session.title }),
                    checked: s,
                    disabled: c || y,
                    onChange: () => {},
                    onClick: (e) => {
                      ;(e.stopPropagation(), d?.(e.shiftKey))
                    },
                    onKeyDown: (e) => {
                      e.key === ` ` && e.stopPropagation()
                    },
                    className: `ms-1 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-accent`,
                  })
                : null,
              /* @__PURE__ */ (0, u.jsxs)(`button`, {
                ref: h,
                type: `button`,
                "aria-haspopup": `menu`,
                "aria-expanded": _,
                "aria-busy": y,
                disabled: y || c,
                onContextMenu: (e) => {
                  ;(e.preventDefault(), e.stopPropagation(), w(e.clientX, e.clientY))
                },
                onKeyDown: (e) => {
                  if (e.key !== `ContextMenu` && !(e.shiftKey && e.key === `F10`)) return
                  ;(e.preventDefault(), e.stopPropagation())
                  const t = e.currentTarget.getBoundingClientRect()
                  w(t.left, t.bottom)
                },
                className: `ci-row min-w-0 flex-1 px-2 py-1.5 active:bg-hover`,
                "data-key": e.key,
                "data-selected": e.selected,
                "data-focus": t,
                "aria-current": e.selected,
                onClick: (e) => (o ? d?.(e.shiftKey) : n()),
                onFocus: r,
                title: e.session.title,
                children: [
                  /* @__PURE__ */ (0, u.jsxs)(`span`, {
                    className: `flex min-w-0 items-center gap-1.5`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        className: `inline-flex w-3.5 shrink-0 justify-center`,
                        children: /* @__PURE__ */ (0, u.jsx)(Jn, { source: e.session.source, size: 12 }),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        className: `min-w-0 flex-1 truncate text-[12.5px]`,
                        children: e.session.title,
                      }),
                    ],
                  }),
                  /* @__PURE__ */ (0, u.jsxs)(`span`, {
                    className: `mt-0.5 flex min-w-0 items-center gap-1.5 ps-5 text-[10.5px] text-fg-3 tabular-nums`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        style: { color: E.text },
                        className: `ci-src__word`,
                        children: E.label.zh,
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, { "aria-hidden": `true`, children: `·` }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, { children: ln(e.session.updatedAt) }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, { "aria-hidden": `true`, children: `·` }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, { children: on(e.session.bytes) }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          x === ``
            ? null
            : /* @__PURE__ */ (0, u.jsx)(`p`, {
                role: `alert`,
                className: `m-0 px-2 py-1 text-[11px] text-err`,
                children: x,
              }),
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            ref: g,
            popover: `manual`,
            "data-session-menu": ``,
            onBeforeToggle: (e) => v(e.newState === `open`),
            role: `menu`,
            "aria-label": Y(`sessions.actions`),
            className: `fixed m-0 min-w-36 rounded-lg border border-line bg-bg-1 p-1 text-[12.5px] text-fg shadow-lg`,
            onContextMenu: (e) => e.preventDefault(),
            onKeyDown: (e) => {
              if ((e.stopPropagation(), e.key === `Escape` || e.key === `Tab`))
                (e.key === `Escape` && e.preventDefault(), C())
              else if ([`ArrowDown`, `ArrowUp`, `Home`, `End`].includes(e.key)) {
                e.preventDefault()
                const t = [...e.currentTarget.querySelectorAll(`button`)],
                  n = t.indexOf(e.currentTarget.ownerDocument.activeElement)
                t[
                  e.key === `Home`
                    ? 0
                    : e.key === `End`
                      ? t.length - 1
                      : (n + (e.key === `ArrowDown` ? 1 : -1) + t.length) % t.length
                ]?.focus()
              }
            },
            children: [
              f
                ? /* @__PURE__ */ (0, u.jsx)(`button`, {
                    type: `button`,
                    role: `menuitem`,
                    className: `ci-btn ci-btn--quiet w-full justify-start active:bg-hover`,
                    onClick: () => {
                      ;(C(), f())
                    },
                    children: Y(`management.rename`),
                  })
                : null,
              p
                ? /* @__PURE__ */ (0, u.jsx)(`button`, {
                    type: `button`,
                    role: `menuitem`,
                    className: `ci-btn ci-btn--quiet w-full justify-start active:bg-hover`,
                    disabled: c || y,
                    onClick: () => {
                      ;(C(), p())
                    },
                    children: Y(`management.aiRename`),
                  })
                : null,
              m
                ? /* @__PURE__ */ (0, u.jsx)(`button`, {
                    type: `button`,
                    role: `menuitem`,
                    className: `ci-btn ci-btn--quiet w-full justify-start active:bg-hover`,
                    onClick: () => {
                      ;(C(), m())
                    },
                    children: Y(`management.move`),
                  })
                : null,
              /* @__PURE__ */ (0, u.jsxs)(`button`, {
                type: `button`,
                role: `menuitem`,
                className: `flex w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 py-1.5 text-err hover:bg-hover focus:bg-hover`,
                onClick: () => void T(),
                children: [/* @__PURE__ */ (0, u.jsx)(Xn, { name: `trash`, size: 14 }), Y(`sessions.delete`)],
              }),
            ],
          }),
        ],
      })
    }
    function nr() {
      try {
        return typeof window > `u` ? void 0 : window.localStorage
      } catch {
        return
      }
    }
    function rr(e) {
      return e.map((e) => ({
        ...e,
        title: e.title ?? e.firstInput ?? Y(`sessions.untitled`),
        named: (e.title?.trim().length ?? 0) > 0,
      }))
    }
    function ir() {
      return new Map([...Dt().sessions].map(([e, t]) => [e, rr(t.sessions)]))
    }
    function ar({ source: e, count: t }) {
      const n = qn[e]
      return /* @__PURE__ */ (0, u.jsxs)(`span`, {
        className: `ci-src`,
        style: { "--ci-src-color": n.text, "--ci-src-brand": n.brand },
        title: `${n.label.zh} · ${Y(`sources.sessions`, { count: t })}`,
        children: [
          /* @__PURE__ */ (0, u.jsx)(Jn, { source: e, size: 10 }),
          /* @__PURE__ */ (0, u.jsx)(`span`, { children: String(t) }),
        ],
      })
    }
    function or({ row: e, index: t, onToggle: n, onFocus: r }) {
      const i = e.project
      return /* @__PURE__ */ (0, u.jsxs)(`button`, {
        type: `button`,
        className: `ci-row px-2 py-1.5`,
        "data-focus": t,
        "aria-expanded": e.expanded,
        onClick: n,
        onFocus: r,
        title: i.workdir,
        children: [
          /* @__PURE__ */ (0, u.jsxs)(`span`, {
            className: `flex min-w-0 items-center gap-1.5`,
            children: [
              /* @__PURE__ */ (0, u.jsx)(Xn, { name: `chevron`, size: 11, className: `ci-chevron shrink-0 text-fg-3` }),
              /* @__PURE__ */ (0, u.jsx)(Xn, {
                name: `folder`,
                size: 14,
                className: e.expanded ? `shrink-0 text-accent` : `shrink-0 text-fg-dim`,
              }),
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `min-w-0 flex-1 truncate text-[12.5px] font-semibold`,
                children: i.leaf,
              }),
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `shrink-0 text-[10.5px] text-fg-3 tabular-nums`,
                children: ln(i.lastUpdatedAt),
              }),
            ],
          }),
          /* @__PURE__ */ (0, u.jsxs)(`span`, {
            className: `mt-1 flex min-w-0 items-center gap-1.5 ps-9.25`,
            children: [
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `min-w-0 flex-1 truncate font-mono text-[10.5px] text-fg-3`,
                children: i.parent === `` ? `` : mn(i.parent),
              }),
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `flex shrink-0 items-center gap-1`,
                children: i.counts.map((e) =>
                  /* @__PURE__ */ (0, u.jsx)(ar, { source: e.source, count: e.sessions }, e.source),
                ),
              }),
            ],
          }),
        ],
      })
    }
    function sr({
      api: e,
      workdirs: t,
      selected: n,
      onSelect: r,
      loading: i,
      onDeleted: a,
      revision: o,
      onMetadataChanged: s,
    }) {
      const c = Dt(),
        d = (0, l.useSyncExternalStore)(c.subscribe, c.deletionVersion, c.deletionVersion),
        f = (0, l.useMemo)(() => Mn(t, dn), [t]),
        [p, m] = (0, l.useState)(``),
        h = (0, l.useMemo)(() => Ln(f, p), [f, p]),
        [g, _] = (0, l.useState)(() => {
          let e = new Set(Fn(nr())),
            r = n?.workdir ?? t[0]?.workdir
          return e.size > 0 || r === void 0 ? e : /* @__PURE__ */ new Set([r])
        }),
        [v, y] = (0, l.useState)(ir),
        b = Kn(
          e,
          (e) => {
            ;(y(
              (t) => new Map([...t].map(([t, n]) => [t, n.filter((t) => jn(t.source, t.id) !== jn(e.source, e.id))])),
            ),
              a(e))
          },
          s,
        ),
        x = zn(v, b.metadata, b.groupFilter),
        S = Gn(b.selection, zn(v, b.metadata, ``)),
        [C, w] = (0, l.useState)(() => /* @__PURE__ */ new Set()),
        [T, E] = (0, l.useState)(() => /* @__PURE__ */ new Map()),
        [D, O] = (0, l.useState)(-1),
        k = (0, l.useRef)(null),
        A = (0, l.useRef)(/* @__PURE__ */ new Set()),
        j = (0, l.useRef)(o),
        M = (0, l.useRef)(new AbortController()),
        N = (0, l.useRef)(/* @__PURE__ */ new Map()),
        P = (0, l.useRef)(/* @__PURE__ */ new Set()),
        F = (0, l.useRef)(g)
      ;((F.current = g),
        (0, l.useEffect)(() => y(ir()), [d]),
        (0, l.useEffect)(
          () => (
            (j.current = o),
            (M.current = new AbortController()),
            A.current.clear(),
            P.current.clear(),
            w(/* @__PURE__ */ new Set()),
            () => {
              M.current.abort()
              for (const e of N.current.values()) clearTimeout(e)
              N.current.clear()
            }
          ),
          [o],
        ),
        (0, l.useEffect)(() => {
          h.length !== 0 &&
            _((e) => {
              if (e.size > 0) return e
              const t = n?.workdir ?? h[0]?.workdir
              return t === void 0 ? e : /* @__PURE__ */ new Set([t])
            })
        }, [h, n]))
      const I = (0, l.useCallback)(
        async (t) => {
          if (A.current.has(t)) return
          ;(A.current.add(t), clearTimeout(N.current.get(t)), N.current.delete(t))
          let n = M.current.signal
          Dt().sessions.has(t) || w((e) => new Set(e).add(t))
          let r = await e.sessions(t, n)
          if (!(n.aborted || j.current !== o)) {
            if (
              (A.current.delete(t),
              w((e) => {
                let n = new Set(e)
                return (n.delete(t), n)
              }),
              !r.ok)
            ) {
              if (r.error === `aborted`) return
              y((e) => (e.has(t) ? e : new Map(e).set(t, [])))
            } else if ((y((e) => new Map(e).set(t, rr(r.value.sessions))), r.value.refreshing)) {
              let e = setTimeout(() => {
                ;(N.current.delete(t), !n.aborted && F.current.has(t) && I(t))
              }, 500)
              N.current.set(t, e)
            }
          }
        },
        [e, o],
      )
      ;(0, l.useEffect)(() => {
        const e = new Set(t.map((e) => e.workdir))
        for (const t of P.current)
          (g.has(t) && e.has(t)) || (P.current.delete(t), clearTimeout(N.current.get(t)), N.current.delete(t))
        for (const t of g) e.has(t) && !P.current.has(t) && (P.current.add(t), I(t))
      }, [g, I, t])
      const L = Nn({
        projects: h,
        sessions: x,
        loading: C,
        expanded: g,
        selected: n === null ? null : jn(n.source, n.id),
        limits: T,
      })
      function R(e) {
        _((t) => {
          const n = new Set(t)
          return (n.has(e) ? n.delete(e) : n.add(e), In(nr(), [...n]), n)
        })
      }
      function z(e, t = !1) {
        if (e !== void 0) {
          if (e.kind === `project`) R(e.project.workdir)
          else if (e.kind === `more`) E((t) => new Map(t).set(e.workdir, 2 ** 53 - 1))
          else if (e.kind === `session`) {
            if (b.editing) {
              b.busy || b.setSelection((n) => Hn(n, e.key, Vn(L), t))
              return
            }
            r({ source: e.session.source, id: e.session.id, workdir: e.workdir })
          }
        }
      }
      function B(e) {
        const t = L[D]
        if (e.key === `ArrowDown` || e.key === `ArrowUp` || e.key === `Home` || e.key === `End`) {
          e.preventDefault()
          const t = Pn(L, D, e.key)
          ;(O(t), k.current?.querySelector(`[data-focus="${String(t)}"]`)?.focus())
        } else
          e.key === `ArrowRight`
            ? t?.kind === `project` && !t.expanded && (e.preventDefault(), R(t.project.workdir))
            : e.key === `ArrowLeft`
              ? t?.kind === `project` && t.expanded
                ? (e.preventDefault(), R(t.project.workdir))
                : (t?.kind === `session` || t?.kind === `more` || t?.kind === `skeleton`) &&
                  (e.preventDefault(), R((t.kind, t.workdir)))
              : (e.key === `Enter` || e.key === ` `) && (e.preventDefault(), z(t, e.shiftKey))
      }
      return i && f.length === 0
        ? /* @__PURE__ */ (0, u.jsx)(`nav`, {
            className: `ci-scroll h-full overflow-y-auto`,
            "aria-label": Y(`workdirs.title`),
            "aria-busy": `true`,
            children: /* @__PURE__ */ (0, u.jsx)(bn, { label: Y(`tree.loadingIndex`) }),
          })
        : /* @__PURE__ */ (0, u.jsxs)(`nav`, {
            className: `flex h-full min-h-0 flex-col`,
            "aria-label": Y(`workdirs.title`),
            children: [
              /* @__PURE__ */ (0, u.jsxs)(`div`, {
                className: `flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2`,
                children: [
                  /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    className: `flex items-center gap-2 text-[12px] font-semibold`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`span`, { children: Y(`tree.title`) }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        className: `rounded-full bg-bg-2 px-1.5 text-[10.5px] leading-4.25 font-medium text-fg-dim tabular-nums`,
                        children: p.trim() === `` ? f.length : `${String(h.length)} / ${String(f.length)}`,
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`button`, {
                        type: `button`,
                        className: `ci-btn ci-btn--quiet ms-auto active:bg-hover`,
                        disabled: b.busy,
                        onClick: b.toggleEditing,
                        children: Y(b.editing ? `management.done` : `management.edit`),
                      }),
                    ],
                  }),
                  /* @__PURE__ */ (0, u.jsx)(Qn, { state: b, visible: () => b.setSelection((e) => Un(e, Vn(L))) }),
                  /* @__PURE__ */ (0, u.jsxs)(`label`, {
                    className: `flex h-7 items-center gap-1.5 rounded-[7px] border border-line-soft bg-bg px-2 text-fg-3 focus-within:border-accent`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(Xn, { name: `search`, size: 12 }),
                      /* @__PURE__ */ (0, u.jsx)(`input`, {
                        className: `min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-fg outline-none placeholder:text-fg-3`,
                        value: p,
                        onChange: (e) => {
                          ;(m(e.currentTarget.value), b.clearSelection())
                        },
                        onKeyDown: (e) => {
                          e.key === `Escape` && (m(``), b.clearSelection())
                        },
                        placeholder: Y(`tree.filter`),
                        "aria-label": Y(`tree.filter`),
                        type: `search`,
                      }),
                    ],
                  }),
                ],
              }),
              /* @__PURE__ */ (0, u.jsxs)(`div`, {
                className: `ci-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3`,
                ref: k,
                onKeyDown: B,
                role: `tree`,
                children: [
                  h.length === 0
                    ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                        className: `m-0 px-2 py-3 text-[12px] leading-relaxed text-fg-dim`,
                        children: f.length === 0 ? Y(`tree.emptyAll`) : Y(`tree.noMatch`, { query: p.trim() }),
                      })
                    : null,
                  L.map((t, n) =>
                    t.kind === `project`
                      ? /* @__PURE__ */ (0, u.jsxs)(
                          `div`,
                          {
                            className: `mt-1 first:mt-0`,
                            children: [
                              /* @__PURE__ */ (0, u.jsx)(or, {
                                row: t,
                                index: n,
                                onToggle: () => R(t.project.workdir),
                                onFocus: () => O(n),
                              }),
                              b.editing && x.has(t.project.workdir) && !C.has(t.project.workdir)
                                ? /* @__PURE__ */ (0, u.jsx)(`button`, {
                                    type: `button`,
                                    className: `ci-btn ci-btn--quiet ms-3 active:bg-hover`,
                                    disabled: b.busy,
                                    onClick: () => b.setSelection((e) => Un(e, x.get(t.project.workdir) ?? [])),
                                    children: Y(`management.selectDirectory`, {
                                      count: x.get(t.project.workdir)?.length ?? 0,
                                    }),
                                  })
                                : null,
                            ],
                          },
                          t.key,
                        )
                      : t.kind === `skeleton`
                        ? /* @__PURE__ */ (0, u.jsx)(
                            `div`,
                            {
                              className: `ms-3.25 flex flex-col gap-1 border-s border-line-soft py-1 ps-2.5`,
                              children: Array.from({ length: t.rows }, (e, n) =>
                                /* @__PURE__ */ (0, u.jsx)(
                                  `div`,
                                  {
                                    className: `h-8 rounded-lg bg-[linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))] bg-size-[200%_100%] motion-safe:animate-[ci-skel_1.4s_var(--ease-in-out)_infinite]`,
                                  },
                                  t.key + String(n),
                                ),
                              ),
                            },
                            t.key,
                          )
                        : t.kind === `more`
                          ? /* @__PURE__ */ (0, u.jsx)(
                              `div`,
                              {
                                className: `ms-3.25 border-s border-line-soft py-0.5 ps-1.5`,
                                children: /* @__PURE__ */ (0, u.jsx)(`button`, {
                                  type: `button`,
                                  className: `ci-btn ci-btn--quiet h-7 w-full justify-start`,
                                  "data-focus": n,
                                  onClick: () => z(t),
                                  onFocus: () => O(n),
                                  children: Y(`tree.showAll`, { count: t.hidden + 20 }),
                                }),
                              },
                              t.key,
                            )
                          : /* @__PURE__ */ (0, u.jsx)(
                              tr,
                              {
                                api: e,
                                onDeleted: b.deleted,
                                editing: b.editing,
                                checked: b.selection.keys.has(t.key),
                                busy: b.busy,
                                onCheck: (e) => z(t, e),
                                onRename: () => void b.openDialog(`rename`, [t.session]),
                                onMove: () => void b.openDialog(`group`, [t.session]),
                                onAiRename: () => void b.openAiDialog([t.session], !1),
                                row: t,
                                index: n,
                                onOpen: () => z(t),
                                onFocus: () => O(n),
                              },
                              t.key,
                            ),
                  ),
                ],
              }),
              /* @__PURE__ */ (0, u.jsx)($n, { state: b, selected: S }),
            ],
          })
    }
    function cr(e) {
      const t = e.title?.trim()
      if (t !== void 0 && t !== ``) return { title: t }
      const n = e.firstInput?.trim()
      return n !== void 0 && n !== ``
        ? { title: Y(`session.untitled`), detail: pn(n, 60) }
        : { title: Y(`session.untitled`) }
    }
    function lr(e, t) {
      const n = t.trim().toLowerCase()
      if (n === ``) return [e]
      let r = [],
        i = e.toLowerCase(),
        a = 0,
        o = i.indexOf(n)
      for (; o >= 0;)
        (o > a && r.push(e.slice(a, o)),
          r.push(
            /* @__PURE__ */ (0, u.jsx)(
              `mark`,
              {
                className: `rounded-xs bg-[color-mix(in_oklch,var(--color-accent)_35%,transparent)] px-px text-fg`,
                children: e.slice(o, o + n.length),
              },
              `m-${String(o)}`,
            ),
          ),
          (a = o + n.length),
          (o = i.indexOf(n, a)))
      return (a < e.length && r.push(e.slice(a)), r)
    }
    function ur({ hit: e, query: t, active: n, onOpen: r, onHover: i }) {
      const a = cr(e),
        o = dn(e.workdir)
      return /* @__PURE__ */ (0, u.jsx)(`li`, {
        children: /* @__PURE__ */ (0, u.jsxs)(`button`, {
          type: `button`,
          className: `my-px flex w-full cursor-pointer flex-col gap-1 rounded-md border-0 px-2 py-2.5 text-left font-[inherit] text-inherit hover:bg-bg-2 data-[active=true]:bg-bg-2`,
          "data-active": n,
          onClick: r,
          onMouseEnter: i,
          children: [
            /* @__PURE__ */ (0, u.jsxs)(`span`, {
              className: `flex w-full min-w-0 items-center gap-3`,
              children: [
                /* @__PURE__ */ (0, u.jsx)(Jn, { source: e.source, size: 12 }),
                /* @__PURE__ */ (0, u.jsx)(`span`, {
                  className: `min-w-0 flex-1 truncate text-[13px] font-medium text-fg`,
                  children: lr(a.title, t),
                }),
                /* @__PURE__ */ (0, u.jsxs)(`span`, {
                  className: `max-w-[40%] truncate text-[10px] text-fg-dim`,
                  title: e.workdir,
                  children: [
                    o.leaf === `` ? e.workdir : o.leaf,
                    e.turnIndex === 0 ? `` : ` · ${Y(`turns.selected`, { index: e.turnIndex })}`,
                  ],
                }),
              ],
            }),
            a.detail === void 0
              ? null
              : /* @__PURE__ */ (0, u.jsx)(`span`, {
                  className: `truncate text-[10.5px] text-fg-dim`,
                  children: a.detail,
                }),
            /* @__PURE__ */ (0, u.jsx)(`span`, {
              className: `line-clamp-2 text-[11px] leading-normal text-fg-dim`,
              children: lr(e.snippet, t),
            }),
          ],
        }),
      })
    }
    function dr({ api: e, onClose: t, onOpenTurn: n }) {
      const r = (0, l.useId)(),
        i = (0, l.useRef)(null),
        [a, o] = (0, l.useState)(``),
        [s, c] = (0, l.useState)(`fast`),
        [d, f] = (0, l.useState)(0),
        [p, m] = (0, l.useState)({ kind: `idle` }),
        [h, g] = (0, l.useState)(-1),
        [_, v] = (0, l.useState)(!1)
      ;((0, l.useEffect)(() => {
        i.current?.focus()
      }, []),
        (0, l.useEffect)(() => {
          const t = a.trim()
          if (t === ``) {
            m({ kind: `idle` })
            return
          }
          const n = new AbortController(),
            r = s === `deep` && d > 0
          r && v(!0)
          const i = window.setTimeout(
            () => {
              ;(r || m({ kind: `loading` }),
                e.search(t, 30, s, d, n.signal).then((e) => {
                  n.signal.aborted ||
                    (v(!1),
                    e.ok
                      ? (m((t) => {
                          let n = r && t.kind === `ready` ? t.hits : [],
                            i = new Set(n.map((e) => `${e.sessionId}:${String(e.turnIndex)}`)),
                            a = [...n, ...e.value.hits.filter((e) => !i.has(`${e.sessionId}:${String(e.turnIndex)}`))]
                          return { kind: `ready`, value: e.value, hits: a }
                        }),
                        r || g(-1))
                      : m({ kind: `failed`, failure: e }))
                }))
            },
            r ? 0 : 250,
          )
          return () => {
            ;(window.clearTimeout(i), n.abort())
          }
        }, [e, a, s, d]))
      const y = p.kind === `ready` ? p.hits : [],
        b = (0, l.useMemo)(() => {
          let e = /* @__PURE__ */ new Map()
          return (
            y.forEach((t, n) => {
              let r = e.get(t.source)
              r === void 0 ? e.set(t.source, [{ hit: t, index: n }]) : r.push({ hit: t, index: n })
            }),
            G.filter((t) => e.has(t)).map((t) => ({ source: t, rows: e.get(t) ?? [] }))
          )
        }, [y])
      function x(e) {
        n({ source: e.source, sessionId: e.sessionId, workdir: e.workdir, turnIndex: e.turnIndex })
      }
      function S() {
        ;(f(0), c(`deep`))
      }
      function C(e) {
        if (e.key === `Escape`) (e.preventDefault(), t())
        else if (e.key === `ArrowDown`) (e.preventDefault(), g((e) => Math.min(y.length - 1, e + 1)))
        else if (e.key === `ArrowUp`) (e.preventDefault(), g((e) => Math.max(-1, e - 1)))
        else if (e.key === `Enter`) {
          e.preventDefault()
          const t = h >= 0 ? y[h] : void 0
          t === void 0
            ? s === `fast`
              ? S()
              : p.kind === `ready` && p.value.truncated && f(p.value.nextCursor ?? 0)
            : x(t)
        }
      }
      return /* @__PURE__ */ (0, u.jsx)(`div`, {
        className: `fixed inset-0 z-60 flex items-start justify-center bg-[rgb(0_0_0/55%)] pt-[12vh]`,
        onMouseDown: (e) => e.target === e.currentTarget && t(),
        children: /* @__PURE__ */ (0, u.jsxs)(`div`, {
          className: `grid max-h-[70vh] w-[min(720px,92vw)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border-[0.5px] border-line bg-bg-1 shadow-[0_18px_48px_rgb(0_0_0/50%)]`,
          role: `dialog`,
          "aria-modal": `true`,
          "aria-label": Y(`search.title`),
          onKeyDown: C,
          children: [
            /* @__PURE__ */ (0, u.jsxs)(`div`, {
              className: `flex items-center gap-2 border-b-[0.5px] border-line px-3 py-2.5`,
              children: [
                /* @__PURE__ */ (0, u.jsx)(`label`, {
                  className: `text-[11px] tracking-[0.06em] whitespace-nowrap text-fg-dim uppercase`,
                  htmlFor: r,
                  children: Y(`search.title`),
                }),
                /* @__PURE__ */ (0, u.jsx)(`input`, {
                  id: r,
                  ref: i,
                  className: `min-w-0 flex-1 rounded-md border-[0.5px] border-line bg-bg px-2 py-1.5 text-[13px] text-fg focus-visible:outline-2 focus-visible:outline-accent`,
                  type: `search`,
                  autoComplete: `off`,
                  spellCheck: !1,
                  placeholder: Y(`search.placeholder`),
                  value: a,
                  onChange: (e) => {
                    ;(f(0), c(`fast`), o(e.target.value))
                  },
                  "aria-describedby": `${r}-hint`,
                }),
                /* @__PURE__ */ (0, u.jsx)(`span`, {
                  className: `rounded-full border-[0.5px] border-line px-2 py-px text-[10px] whitespace-nowrap text-fg-dim`,
                  role: `status`,
                  children: Y(s === `deep` ? `search.tier.deep` : `search.tier.fast`),
                }),
                /* @__PURE__ */ (0, u.jsx)(`button`, {
                  type: `button`,
                  className: `ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50`,
                  onClick: t,
                  children: `Esc`,
                }),
              ],
            }),
            /* @__PURE__ */ (0, u.jsxs)(`div`, {
              className: `min-h-0 overflow-y-auto px-2 pt-1.5 pb-2.5`,
              role: `listbox`,
              "aria-label": Y(`search.title`),
              children: [
                p.kind === `idle`
                  ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                      className: `mx-1.5 my-2.5 text-[11px] text-fg-dim`,
                      id: `${r}-hint`,
                      children: Y(`search.hint`),
                    })
                  : null,
                p.kind === `loading`
                  ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                      className: `mx-1.5 my-2.5 text-[11px] text-fg-dim`,
                      children: Y(`search.scanning`),
                    })
                  : null,
                p.kind === `failed`
                  ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                      className: `mx-1.5 my-2.5 text-[11px] text-err`,
                      children: Y(`session.error`, { detail: p.failure.detail ?? p.failure.error }),
                    })
                  : null,
                p.kind === `ready` && y.length === 0
                  ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                      className: `mx-1.5 my-2.5 text-[11px] text-fg-dim`,
                      children: Y(`search.empty`),
                    })
                  : null,
                b.map((e) =>
                  /* @__PURE__ */ (0, u.jsxs)(
                    `section`,
                    {
                      className: `mt-2`,
                      "aria-label": e.source,
                      children: [
                        /* @__PURE__ */ (0, u.jsxs)(`h3`, {
                          className: `m-0 mb-1 flex items-center gap-2 px-2 py-1 text-[11px] font-medium text-fg-dim`,
                          children: [
                            /* @__PURE__ */ (0, u.jsx)(Jn, { source: e.source, size: 12 }),
                            /* @__PURE__ */ (0, u.jsx)(`span`, { children: qn[e.source].label.zh }),
                            /* @__PURE__ */ (0, u.jsx)(`span`, { className: `tabular-nums`, children: e.rows.length }),
                          ],
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`ul`, {
                          className: `m-0 list-none p-0`,
                          children: e.rows.map(({ hit: e, index: t }) =>
                            /* @__PURE__ */ (0, u.jsx)(
                              ur,
                              { hit: e, query: a, active: t === h, onOpen: () => x(e), onHover: () => g(t) },
                              `${e.source}-${e.sessionId}-${String(e.turnIndex)}-${String(t)}`,
                            ),
                          ),
                        }),
                      ],
                    },
                    e.source,
                  ),
                ),
              ],
            }),
            p.kind === `ready`
              ? /* @__PURE__ */ (0, u.jsxs)(`footer`, {
                  className: `flex items-center gap-3 border-t-[0.5px] border-line px-3 py-2 text-[10.5px] text-fg-dim`,
                  children: [
                    /* @__PURE__ */ (0, u.jsx)(`span`, {
                      children:
                        p.value.tier === `fast`
                          ? Y(`search.fastMeta`, { scanned: p.value.scanned })
                          : p.value.truncated
                            ? Y(`search.truncated`, { remaining: p.value.remaining })
                            : Y(`search.deepMeta`, { scanned: p.value.scanned, remaining: p.value.remaining }),
                    }),
                    /* @__PURE__ */ (0, u.jsx)(`span`, {
                      className: `my-1.5 text-[10.5px] text-fg-dim`,
                      children: Y(`search.meta`, { scanned: p.value.scanned, elapsed: p.value.elapsedMs }),
                    }),
                    p.value.tier === `fast`
                      ? /* @__PURE__ */ (0, u.jsx)(`span`, {
                          className: `my-1.5 text-[10.5px] text-fg-dim`,
                          children: Y(`search.enterDeep`),
                        })
                      : null,
                    p.value.tier === `deep` && p.value.truncated
                      ? /* @__PURE__ */ (0, u.jsx)(`button`, {
                          type: `button`,
                          className: `cursor-pointer rounded-md border-[0.5px] border-line bg-bg-2 px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50`,
                          disabled: _,
                          onClick: () => f(p.value.nextCursor ?? 0),
                          children: _ ? Y(`search.scanning`) : Y(`search.continue`, { count: p.value.remaining }),
                        })
                      : null,
                    p.value.failures.length === 0
                      ? null
                      : /* @__PURE__ */ (0, u.jsx)(`span`, {
                          className: `ms-auto text-warn`,
                          children: Y(`search.failures`, { count: p.value.failures.length }),
                        }),
                  ],
                })
              : null,
          ],
        }),
      })
    }
    function fr(e) {
      return typeof e == `string` && e.trim() !== `` ? e.trim() : void 0
    }
    function pr(e, t) {
      const n = fr(e)?.replaceAll(`\\`, `/`)
      if (
        n === void 0 ||
        !n.endsWith(`/SKILL.md`) ||
        /[\n\r\0]/.test(n) ||
        (/^[a-z][\w+.-]*:/i.test(n) && !/^[A-Za-z]:\//.test(n))
      )
        return
      const r = n.startsWith(`/`) || /^[A-Za-z]:\//.test(n) || t === `` ? n : `${t.replaceAll(`\\`, `/`)}/${n}`,
        i = []
      for (const e of r.split(`/`))
        e !== `` &&
          e !== `.` &&
          (e === `..` && i.length > 0 && i.at(-1) !== `..` ? i.pop() : (e !== `..` || !r.startsWith(`/`)) && i.push(e))
      const a = i.at(-2)
      if (!(a === void 0 || a === `..` || /^[A-Za-z]:$/.test(a)))
        return { name: a, path: `${r.startsWith(`/`) ? `/` : ``}${i.join(`/`)}` }
    }
    function mr(e, t, n) {
      if (e.id === ``) return
      const r = e.input !== null && typeof e.input == `object` && !Array.isArray(e.input) ? e.input : void 0,
        i = e.name.split(/[.:/]/).at(-1)?.toLowerCase(),
        a = i === `skill`
      if (!a && ![`read`, `read_file`, `readfile`].includes(i ?? ``)) return
      const o = pr(r?.file_path ?? r?.target_file ?? r?.path, n),
        s = fr(r?.skill) ?? fr(r?.name) ?? (a ? fr(e.input) : void 0),
        c = o?.name ?? (a && s !== void 0 && /^[\w@./:-]+$/.test(s) ? s : void 0)
      if (!(c === void 0 || (!a && o === void 0)))
        return {
          turnIndex: t,
          toolCallId: e.id,
          kind: a ? `skill-tool` : `skill-file`,
          name: c,
          ...(o === void 0 ? {} : { path: o.path }),
          ...(Number.isFinite(e.startedAt) && e.startedAt > 0 ? { time: e.startedAt } : {}),
        }
    }
    function hr(e) {
      return /^\s*(?:# AGENTS\.md instructions|# Files (?:mentioned|pasted) by the user|The following is the Codex)/.test(
        e,
      )
        ? ``
        : e
            .replace(
              /<(available_skills|available-skills|skills_instructions|agent_skills|INSTRUCTIONS|user_instructions|environment_context|recommended_plugins|instructions|rules)>[\s\S]*?<\/\1>/g,
              ` `,
            )
            .replace(/```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~|`[^`\n]*`/g, ` `)
    }
    function gr(e, t) {
      const n = /* @__PURE__ */ new Map(),
        r = (r, i) => {
          let a = pr(r, t)
          if (a === void 0) return
          let o = a.path
          n.has(o) ||
            n.set(o, {
              ...a,
              kind: i,
              turnIndex: e.index,
              toolCallId: `event:${i}:${e.index}:${n.size + 1}`,
              ...(Number.isFinite(e.startedAt) && e.startedAt > 0 ? { time: e.startedAt } : {}),
            })
        },
        i = e.skillInjections
      if (Array.isArray(i))
        for (const e of i) typeof e == `object` && e && fr(e.name) !== void 0 && r(e.path, `skill-injection`)
      for (const t of e.userInput) {
        const e = hr(t)
        for (const t of e.matchAll(/<skill>\s*<name>([^<>\r\n]+)<\/name>\s*<path>([^<>\r\n]+)<\/path>[\s\S]*?<\/skill>/g))
          fr(t[1]) !== void 0 && r(t[2], `skill-injection`)
        const n = e.replace(/<skill>[\s\S]*?<\/skill>/g, ` `)
        for (const e of n.matchAll(/(?<!!)\[[^\]\n]+\]\(\s*(?:<([^<>\r\n]+)>|([^\r\n]*?\/SKILL\.md))\s*\)/g))
          try {
            r(decodeURIComponent(e[1] ?? e[2]), `skill-reference`)
          } catch {}
      }
      return [...n.values()]
    }
    function _r(e, t) {
      const n = /* @__PURE__ */ new Map(),
        r = e.flatMap((e) => gr(e, t)),
        i = new Set(r.map((e) => `${e.turnIndex}:${e.path}`)),
        a = /* @__PURE__ */ new Set(),
        o = /* @__PURE__ */ new Set(),
        s = (e) => {
          let t = e.path === void 0 ? `name:${e.name}` : `path:${e.path}`,
            r = `${e.turnIndex}:${e.path}`
          if (i.has(r) && a.has(r)) return
          a.add(r)
          let o = n.get(t)
          ;(o === void 0 &&
            ((o = {
              id: t,
              name: e.name,
              ...(e.path === void 0 ? {} : { path: e.path }),
              count: 0,
              lastTurnIndex: e.turnIndex,
              evidence: [],
            }),
            n.set(t, o)),
            o.count++,
            (o.lastTurnIndex = Math.max(o.lastTurnIndex, e.turnIndex)),
            e.time !== void 0 && (o.lastTime = Math.max(o.lastTime ?? e.time, e.time)),
            o.evidence.push(e))
        }
      for (const n of e)
        for (const e of n.toolCalls) {
          if (e.id === `` || o.has(e.id)) continue
          o.add(e.id)
          const r = mr(e, n.index, t)
          r !== void 0 && s(r)
        }
      for (const e of r) s(e)
      return [...n.values()].toSorted((e, t) => t.count - e.count || e.id.localeCompare(t.id))
    }
    function X(e, t) {
      return Y(e, t)
    }
    function vr(e) {
      return e !== void 0 && Number.isFinite(e) && e > 0
    }
    function yr(e, t) {
      return vr(e) && vr(t) && t >= e ? [e, t] : void 0
    }
    function br(e) {
      if (e.length === 0) return null
      e.sort((e, t) => e[0] - t[0])
      let t = 0,
        n = e[0][0],
        r = e[0][1]
      for (const i of e.slice(1)) i[0] <= r ? (r = Math.max(r, i[1])) : ((t += r - n), ([n, r] = i))
      return t + r - n
    }
    function xr(e) {
      return typeof e == `string` && e.trim() !== `` ? e.trim() : void 0
    }
    function Sr(e) {
      for (let t = e.length - 1; t >= 0; t--) {
        const n = xr(e[t])
        if (n !== void 0) return n
      }
    }
    function Cr(e) {
      let t = {
          turnCount: e.turns.length,
          toolCalls: 0,
          compactions: 0,
          currentAttribution: null,
          peak: null,
          usage: { input: null, cacheRead: null, cacheWrite: null, output: null, coveredTurns: 0, missingTurns: 0 },
          lastMessage: null,
          timing: {
            spanMs: null,
            completedTurnMs: null,
            completedTurns: 0,
            missingTurnDurations: 0,
            toolUnionMs: null,
            timedToolCalls: 0,
            missingToolDurations: 0,
          },
          skills: [],
        },
        n,
        r,
        i = (e) => {
          vr(e) && ((n = n === void 0 ? e : Math.min(n, e)), (r = r === void 0 ? e : Math.max(r, e)))
        },
        a = /* @__PURE__ */ new Map()
      for (const n of e.turns) {
        ;(i(n.startedAt), i(n.endedAt))
        const e = yr(n.startedAt, n.endedAt)
        e === void 0
          ? t.timing.missingTurnDurations++
          : (t.timing.completedTurns++, (t.timing.completedTurnMs = (t.timing.completedTurnMs ?? 0) + e[1] - e[0]))
        const r = n.attribution
        ;(ue(r) &&
          r.total.tokens > 0 &&
          ((t.currentAttribution === null || n.index > t.currentAttribution.turnIndex) &&
            (t.currentAttribution = { turnIndex: n.index, attribution: r }),
          (t.peak === null || r.total.tokens > t.peak.measure.tokens) &&
            (t.peak = { turnIndex: n.index, measure: r.total })),
          (t.compactions += n.compactions.length))
        for (const e of n.compactions) i(e.at)
        const o = n.usage
        if (o === void 0 || ![o.input, o.cacheRead, o.cacheWrite, o.output].every((e) => Number.isFinite(e) && e >= 0))
          t.usage.missingTurns++
        else {
          t.usage.coveredTurns++
          for (const e of [`input`, `cacheRead`, `cacheWrite`, `output`]) t.usage[e] = (t.usage[e] ?? 0) + o[e]
        }
        const s = Sr(n.assistantText),
          c = Sr(n.userInput)
        if ((s !== void 0 || c !== void 0) && (t.lastMessage === null || n.index >= t.lastMessage.turnIndex)) {
          const e = s === void 0 ? n.startedAt : n.endedAt,
            r = s ?? c
          t.lastMessage = {
            role: s === void 0 ? `user` : `assistant`,
            text: r.length > 500 ? `${r.slice(0, 500)}…` : r,
            turnIndex: n.index,
            ...(vr(e) ? { time: e } : {}),
          }
        }
        n.toolCalls.forEach((e, t) => {
          ;(i(e.startedAt), i(e.endedAt))
          const r = e.id === `` ? `anonymous:${n.index}:${t}` : `id:${e.id}`,
            o = a.get(r)
          o === void 0
            ? a.set(r, { tool: e, turn: n })
            : yr(o.tool.startedAt, o.tool.endedAt) === void 0 &&
              yr(e.startedAt, e.endedAt) !== void 0 &&
              a.set(r, { tool: { ...o.tool, endedAt: e.endedAt }, turn: o.turn })
        })
      }
      const o = []
      t.toolCalls = a.size
      for (const { tool: e } of a.values()) {
        const n = yr(e.startedAt, e.endedAt)
        n === void 0 ? t.timing.missingToolDurations++ : (o.push(n), t.timing.timedToolCalls++)
      }
      return (
        (t.skills = _r(e.turns, e.workdir)),
        (t.timing.toolUnionMs = br(o)),
        n !== void 0 && r !== void 0 && ((t.timing.startedAt = n), (t.timing.endedAt = r), (t.timing.spanMs = r - n)),
        t
      )
    }
    const wr = [`input`, `cacheRead`, `cacheWrite`, `output`]
    function Tr({ insights: e, turns: t, turnCount: n, cost: r = null, workdir: i = `` }) {
      const a = { loadedTurns: t.length, totalTurns: n }
      if (e !== void 0) return { ...a, report: e, source: `host`, usageSource: `turns` }
      const o = Cr({
          id: ``,
          source: `claude`,
          workdir: i,
          createdAt: 0,
          updatedAt: 0,
          turns: [...t].sort((e, t) => e.index - t.index),
          segments: [],
          dataQuality: [],
        }),
        s =
          r !== null &&
          r.turns.length === n &&
          n > 0 &&
          wr.every((e) => Number.isFinite(r.totals[e]) && r.totals[e] >= 0)
      if (s) for (const e of wr) o.usage[e] = r.totals[e]
      return {
        ...a,
        source: t.length === n ? `client-complete` : `client-partial`,
        usageSource: s ? `cost` : `turns`,
        report: o,
      }
    }
    function Er(e) {
      let t = 0,
        n,
        r = 0,
        i = 0,
        a
      for (const o of e) {
        const e = o.attribution.total.tokens
        ;(e > t && ((t = e), (n = o.index)), e > 0 && (a = o), (r += o.compactions.length), (i += o.toolCalls.length))
      }
      const o = a?.attribution.total.tokens ?? 0,
        s = a?.attribution.windowSize
      return {
        current: o,
        ...(s === void 0 ? {} : { window: s }),
        ...(s === void 0 || s <= 0 ? {} : { windowShare: o / s }),
        peak: t,
        ...(n === void 0 ? {} : { peakTurn: n }),
        compactions: r,
        toolCalls: i,
      }
    }
    const Dr = `inline-flex items-center gap-1 rounded-[5px] px-1.5 h-4.5 text-[10.5px] leading-none whitespace-nowrap tabular-nums`,
      Or = {
        neutral: `${Dr} border border-line text-fg-dim`,
        soft: `${Dr} bg-bg-2 text-fg-dim`,
        warn: `${Dr} border border-dashed border-warn/70 text-warn bg-warn/8`,
        accent: `${Dr} bg-accent/14 text-accent`,
        mono: `${Dr} border border-line text-fg-dim font-mono`,
      }
    function kr({ tone: e = `neutral`, title: t, tip: n, children: r }) {
      return /* @__PURE__ */ (0, u.jsx)(`span`, {
        className: n === void 0 ? Or[e] : `${Or[e]} relative`,
        title: t,
        "data-tip": n,
        tabIndex: n === void 0 ? void 0 : 0,
        children: r,
      })
    }
    function Ar({ children: e, count: t, end: n }) {
      return /* @__PURE__ */ (0, u.jsxs)(`h3`, {
        className: `m-0 mb-2.5 flex items-center gap-2 text-[12px] font-semibold text-fg`,
        children: [
          /* @__PURE__ */ (0, u.jsx)(`span`, { children: e }),
          t === void 0
            ? null
            : /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `rounded-full bg-bg-2 px-1.5 text-[10.5px] leading-4.25 font-medium text-fg-dim tabular-nums`,
                children: t,
              }),
          n === void 0
            ? null
            : /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `ms-auto flex items-center gap-2 font-normal`,
                children: n,
              }),
        ],
      })
    }
    function jr({ children: e, label: t, flush: n = !1 }) {
      return /* @__PURE__ */ (0, u.jsx)(`section`, {
        className: n
          ? `min-w-0 rounded-[10px] border border-line-soft bg-bg-1`
          : `min-w-0 rounded-[10px] border border-line-soft bg-bg-1 p-3.5`,
        "aria-label": t,
        children: e,
      })
    }
    function Mr({ label: e, value: t, hint: n, meter: r, tone: i = `accent` }) {
      const a = r === void 0 ? void 0 : Math.max(0, Math.min(1, r))
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `flex min-w-0 flex-col gap-1 rounded-[10px] border border-line-soft bg-bg-1 px-3 py-2.5`,
        children: [
          /* @__PURE__ */ (0, u.jsx)(`span`, { className: `truncate text-[11px] text-fg-dim`, children: e }),
          /* @__PURE__ */ (0, u.jsx)(`span`, {
            className:
              typeof t == `string`
                ? `truncate text-[18px] leading-tight font-semibold tracking-[-0.01em] text-fg tabular-nums`
                : `text-[18px] leading-tight font-semibold tracking-[-0.01em] text-fg tabular-nums`,
            children: t,
          }),
          a === void 0
            ? null
            : /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `block h-1 w-full overflow-hidden rounded-full bg-bg-3`,
                "aria-hidden": `true`,
                children: /* @__PURE__ */ (0, u.jsx)(`span`, {
                  className: i === `warn` ? `block h-full rounded-full bg-warn` : `block h-full rounded-full bg-accent`,
                  style: { inlineSize: `${(a * 100).toFixed(1)}%` },
                }),
              }),
          n === void 0
            ? null
            : /* @__PURE__ */ (0, u.jsx)(`span`, { className: `truncate text-[10.5px] text-fg-3`, children: n }),
        ],
      })
    }
    function Nr({ children: e }) {
      return /* @__PURE__ */ (0, u.jsx)(`kbd`, {
        className: `inline-flex h-4.5 items-center rounded-[5px] border border-line bg-bg px-1.5 font-[inherit] text-[10.5px] text-fg-dim`,
        children: e,
      })
    }
    function Pr({ data: e, turns: t, cost: n, onHandoff: r, onOpenSession: i }) {
      const [a, o] = (0, l.useState)(``),
        s = e.session,
        c = cr({ title: s.title, firstInput: s.firstInput }),
        d = qn[s.source],
        f = t.length >= e.turnCount,
        p = e.insights,
        m = p?.currentAttribution?.attribution,
        h = m?.windowSize,
        g =
          p === void 0
            ? Er(f ? t : [])
            : {
                current: m?.total.tokens ?? 0,
                peak: p.peak?.measure.tokens ?? 0,
                peakTurn: p.peak?.turnIndex,
                window: h,
                windowShare: h === void 0 || h <= 0 || m === void 0 ? void 0 : m.total.tokens / h,
                compactions: p.compactions,
                toolCalls: p.toolCalls,
              },
        _ = p === void 0 ? !f || g.current === 0 : p.currentAttribution === null,
        v = p === void 0 ? !f || g.peak === 0 : p.peak === null
      return /* @__PURE__ */ (0, u.jsxs)(`header`, {
        className: `flex min-w-0 flex-col gap-3 border-b border-line-soft px-5 pt-4 pb-4`,
        children: [
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `flex min-w-0 items-start gap-3`,
            children: [
              /* @__PURE__ */ (0, u.jsxs)(`div`, {
                className: `flex min-w-0 flex-1 flex-col gap-1`,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(`h2`, {
                    className: `m-0 truncate text-[16px] leading-snug font-semibold`,
                    title: s.id,
                    children: c.title,
                  }),
                  c.detail === void 0
                    ? null
                    : /* @__PURE__ */ (0, u.jsx)(`p`, {
                        className: `m-0 truncate text-[12px] text-fg-dim`,
                        title: c.detail,
                        children: c.detail,
                      }),
                  /* @__PURE__ */ (0, u.jsxs)(`p`, {
                    className: `m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-fg-dim`,
                    children: [
                      /* @__PURE__ */ (0, u.jsxs)(`span`, {
                        className: `inline-flex items-center gap-1 font-medium`,
                        style: { color: d.brand },
                        children: [/* @__PURE__ */ (0, u.jsx)(Jn, { source: s.source, size: 12 }), d.label.zh],
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        className: `max-w-[42ch] truncate font-mono`,
                        title: s.workdir,
                        children: s.workdir === `` ? Y(`workdirs.unknown`) : mn(s.workdir),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        "aria-hidden": `true`,
                        className: `text-fg-3`,
                        children: `·`,
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, { className: `tabular-nums`, children: cn(s.updatedAt) }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        "aria-hidden": `true`,
                        className: `text-fg-3`,
                        children: `·`,
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, { className: `tabular-nums`, children: on(e.meta.bytes) }),
                      e.meta.residualTurns > 0
                        ? /* @__PURE__ */ (0, u.jsxs)(kr, {
                            tone: `warn`,
                            title: Y(`turns.unknownNote`),
                            children: [Y(`turns.unknown`), ` × `, e.meta.residualTurns],
                          })
                        : null,
                      e.meta.reconciledTurns > 0
                        ? /* @__PURE__ */ (0, u.jsxs)(kr, {
                            title: Y(`stats.reconciledTurns`, { count: e.meta.reconciledTurns }),
                            children: [`×`, e.meta.reconciledTurns],
                          })
                        : null,
                    ],
                  }),
                ],
              }),
              /* @__PURE__ */ (0, u.jsxs)(`button`, {
                type: `button`,
                className: `ci-btn shrink-0`,
                onClick:
                  s.source === `dsh`
                    ? () => {
                        ;(o(``),
                          Promise.resolve()
                            .then(() => {
                              if (i === void 0) throw Error(`DSH navigation unavailable`)
                              return i(s.id)
                            })
                            .catch((e) => o(e instanceof Error ? e.message : String(e))))
                      }
                    : r,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(Xn, { name: `handoff`, size: 13 }),
                  s.source === `dsh` ? Y(`handoff.openExisting`) : Y(`handoff.button`),
                ],
              }),
            ],
          }),
          a === ``
            ? null
            : /* @__PURE__ */ (0, u.jsx)(`p`, {
                className: `m-0 text-[12px] text-err`,
                role: `alert`,
                children: Y(`handoff.openFailed`, { detail: a }),
              }),
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `grid grid-cols-2 gap-2 @2xl:grid-cols-4`,
            children: [
              /* @__PURE__ */ (0, u.jsx)(Mr, {
                label: Y(`stats.current`),
                value: _ ? X(`insights.unrecorded`) : en(g.current),
                ...(g.windowShare === void 0 ? {} : { meter: g.windowShare }),
                tone: (g.windowShare ?? 0) >= 0.8 ? `warn` : `accent`,
                hint:
                  g.window === void 0
                    ? Y(`stats.noWindow`)
                    : Y(`stats.windowShare`, { share: rn(g.current, g.window), size: en(g.window) }),
              }),
              /* @__PURE__ */ (0, u.jsx)(Mr, {
                label: Y(`stats.peak`),
                value: v ? X(`insights.unrecorded`) : en(g.peak),
                hint: g.peakTurn === void 0 ? `—` : Y(`stats.peakAt`, { index: g.peakTurn }),
              }),
              /* @__PURE__ */ (0, u.jsx)(Mr, {
                label: Y(`stats.turns`),
                value: String(e.turnCount),
                hint:
                  p !== void 0 || f
                    ? Y(`stats.compactionsLine`, { count: g.compactions, tools: g.toolCalls })
                    : Y(`stats.loaded`, { count: t.length }),
              }),
              /* @__PURE__ */ (0, u.jsx)(Mr, {
                label: Y(`stats.cost`),
                value: n === null ? `—` : /* @__PURE__ */ (0, u.jsx)(On, { cost: n, plain: !0 }),
                hint:
                  n === null
                    ? Y(`stats.costPending`)
                    : n.totals.unpricedTurns > 0
                      ? Y(`cost.unpriced`, { count: n.totals.unpricedTurns })
                      : Y(`stats.costPriced`),
              }),
            ],
          }),
          s.dataQuality.length > 0
            ? /* @__PURE__ */ (0, u.jsxs)(`details`, {
                className: `ci-fold text-[11px] text-fg-dim`,
                children: [
                  /* @__PURE__ */ (0, u.jsxs)(`summary`, {
                    className: `inline-flex items-center gap-1`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(Xn, { name: `chevron`, size: 11, className: `ci-chevron` }),
                      Y(`session.quality`),
                      ` (`,
                      s.dataQuality.length,
                      `)`,
                    ],
                  }),
                  /* @__PURE__ */ (0, u.jsx)(`ul`, {
                    className: `mt-1.5 mb-0 ps-4 font-mono text-[10.5px] break-all`,
                    children: s.dataQuality.map((e) =>
                      /* @__PURE__ */ (0, u.jsx)(
                        `li`,
                        { children: /* @__PURE__ */ (0, u.jsx)(`code`, { children: e }) },
                        e,
                      ),
                    ),
                  }),
                ],
              })
            : null,
        ],
      })
    }
    const Fr = { text: 2.6, cjk: 1.24, schema: 2.26, pixelsPerToken: 750 }
    function Ir(e) {
      switch (e) {
        case `usage`:
          return Y(`basis.tip.usage`)
        case `chars-per-token`:
          return Y(`basis.tip.chars-per-token`, { text: Fr.text, cjk: Fr.cjk, schema: Fr.schema })
        case `harness-projection`:
          return Y(`basis.tip.harness-projection`, { px: Fr.pixelsPerToken })
        case `byte-length`:
          return Y(`basis.tip.byte-length`)
        case `unattributed`:
          return Y(`basis.tip.unattributed`)
      }
    }
    function Lr(e) {
      return `${e.precision === `exact` ? Y(`precision.exact`) : Y(`precision.estimate`)} · ${Y(`basis.${e.basis}`)} — ${Ir(e.basis)} (${$t(e.tokens)} tokens)`
    }
    function Rr({ precision: e }) {
      return /* @__PURE__ */ (0, u.jsx)(`span`, {
        className:
          e === `exact`
            ? `px-1 rounded-[3px] font-[inherit] text-[9.5px] leading-[15px] tracking-[0.02em] border-[0.5px] border-current text-ok`
            : `px-1 rounded-[3px] font-[inherit] text-[9.5px] leading-[15px] tracking-[0.02em] border-[0.5px] border-current text-fg-dim`,
        "data-precision": e,
        children: Y(e === `exact` ? `precision.exact` : `precision.estimate`),
      })
    }
    function zr({ measure: e, share: t, dense: n = !1 }) {
      const r = e.precision === `exact` ? `=` : `≈`,
        i = Lr(e)
      return /* @__PURE__ */ (0, u.jsxs)(`span`, {
        className: `relative inline-flex items-baseline gap-1 font-mono text-[11px] outline-offset-2`,
        "data-precision": e.precision,
        "data-tip": i,
        tabIndex: 0,
        "aria-label": i,
        children: [
          /* @__PURE__ */ (0, u.jsx)(`span`, {
            className: e.precision === `exact` ? `text-fg` : `text-fg-dim italic`,
            children: $t(e.tokens),
          }),
          /* @__PURE__ */ (0, u.jsx)(`span`, {
            className: `text-[10px] text-fg-dim`,
            "aria-hidden": `true`,
            children: r,
          }),
          n ? null : /* @__PURE__ */ (0, u.jsx)(Rr, { precision: e.precision }),
          t === void 0
            ? null
            : /* @__PURE__ */ (0, u.jsx)(`span`, { className: `text-[10px] text-fg-dim`, children: t }),
        ],
      })
    }
    function Br(e) {
      const t = e.total.tokens,
        n = e.parts.filter((e) => e.measure.tokens > 0),
        r = n.reduce((e, t) => e + t.measure.tokens, 0),
        i = t - r,
        a = t <= 0,
        o = !a && r > t,
        s = a || o ? Math.max(r, 1) : t,
        c = n.map((e) => ({
          key: e.part,
          kind: `part`,
          part: e.part,
          tokens: e.measure.tokens,
          width: (e.measure.tokens / s) * 100,
          share: rn(e.measure.tokens, s),
        }))
      return (
        i > 0 && c.push({ key: `unknown`, kind: `unknown`, tokens: i, width: (i / s) * 100, share: rn(i, s) }),
        {
          segments: c,
          denominator: s,
          residual: i,
          overCounted: i < 0 && !a ? -i : 0,
          normalizedByParts: a,
          overflowingParts: o,
        }
      )
    }
    function Vr(e) {
      return `var(--color-part-${e})`
    }
    function Hr({ attribution: e, label: t, dense: n = !1 }) {
      const r = Br(e)
      return /* @__PURE__ */ (0, u.jsx)(`div`, {
        className: `flex w-full bg-bg-3 ${n ? `h-1.5 overflow-hidden rounded-full` : `relative h-3 rounded-sm`}`,
        role: n ? `img` : `group`,
        "aria-label": t,
        children: r.segments.map((t) => {
          const r = t.part === void 0 ? Y(`turns.unknown`) : Y(`part.${t.part}`),
            i = e.parts.find((e) => e.part === t.part)?.measure ?? {
              tokens: t.tokens,
              precision: `estimate`,
              basis: `unattributed`,
            },
            a = `${r} · ${t.share} · ${Lr(i)}`
          return /* @__PURE__ */ (0, u.jsx)(
            `span`,
            {
              className:
                t.kind === `unknown`
                  ? `h-full flex-none bg-[repeating-linear-gradient(45deg,var(--color-fg-dim)_0_2px,transparent_2px_5px)] shadow-[inset_0_0_0_1px_var(--color-fg-dim)] after:w-max after:max-w-full first:rounded-s-sm last:rounded-e-sm`
                  : `h-full flex-none after:w-max after:max-w-full first:rounded-s-sm last:rounded-e-sm`,
              "data-part": t.part ?? `unknown`,
              style:
                t.part === void 0
                  ? { width: `${t.width.toFixed(3)}%` }
                  : { width: `${t.width.toFixed(3)}%`, background: Vr(t.part) },
              title: n ? a : void 0,
              "data-tip": n ? void 0 : a,
              tabIndex: n ? void 0 : 0,
              "aria-label": a,
            },
            t.key,
          )
        }),
      })
    }
    function Ur({ attribution: e }) {
      const t = Br(e)
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        children: [
          /* @__PURE__ */ (0, u.jsxs)(`ul`, {
            className: `mt-3 mb-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0`,
            children: [
              e.parts
                .filter((e) => e.measure.tokens !== 0)
                .map((e) =>
                  /* @__PURE__ */ (0, u.jsxs)(
                    `li`,
                    {
                      className: `inline-flex items-center gap-1.5 text-[11px]`,
                      "data-part": e.part,
                      children: [
                        /* @__PURE__ */ (0, u.jsx)(`span`, {
                          className: `h-2.5 w-2.5 rounded-[3px]`,
                          style: { background: Vr(e.part) },
                          "aria-hidden": `true`,
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`span`, { children: Y(`part.${e.part}`) }),
                        /* @__PURE__ */ (0, u.jsx)(zr, {
                          measure: e.measure,
                          share: rn(e.measure.tokens, t.denominator),
                          dense: !0,
                        }),
                      ],
                    },
                    e.part,
                  ),
                ),
              t.residual > 0
                ? /* @__PURE__ */ (0, u.jsxs)(`li`, {
                    className: `inline-flex items-center gap-1.5 text-[11px]`,
                    "data-part": `unknown`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        className: `h-2.5 w-2.5 rounded-[3px] bg-[repeating-linear-gradient(45deg,var(--color-fg-dim)_0_1px,transparent_1px_3px)]`,
                        "aria-hidden": `true`,
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, { children: Y(`turns.unknown`) }),
                      /* @__PURE__ */ (0, u.jsx)(zr, {
                        measure: { tokens: t.residual, precision: `estimate`, basis: `unattributed` },
                        share: rn(t.residual, t.denominator),
                        dense: !0,
                      }),
                    ],
                  })
                : null,
            ],
          }),
          t.residual > 0
            ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                className: `mt-2 mb-0 text-[10.5px] text-fg-dim`,
                role: `note`,
                children: Y(`turns.unknownNote`),
              })
            : null,
          t.overCounted > 0
            ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                className: `mt-2 mb-0 bg-bg-1 px-2 py-1 text-[10.5px] text-warn`,
                role: `note`,
                children: Y(`turns.overCounted`, { tokens: $t(t.overCounted) }),
              })
            : null,
          t.normalizedByParts
            ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                className: `mt-2 mb-0 bg-bg-1 px-2 py-1 text-[10.5px] text-warn`,
                role: `note`,
                children: Y(`turns.normalizedByParts`),
              })
            : null,
          /* @__PURE__ */ (0, u.jsxs)(`p`, {
            className: `mt-2.5 mb-0 text-[11px] text-fg-dim`,
            children: [
              Y(`turns.total`),
              ` `,
              /* @__PURE__ */ (0, u.jsx)(`span`, { className: `font-mono text-fg`, children: en(e.total.tokens) }),
              e.windowSize === void 0
                ? null
                : /* @__PURE__ */ (0, u.jsxs)(u.Fragment, {
                    children: [` · `, Y(`turns.window`, { size: en(e.windowSize) })],
                  }),
              e.reconciled === void 0
                ? /* @__PURE__ */ (0, u.jsxs)(u.Fragment, { children: [` · `, Y(`turns.notReconciled`)] })
                : /* @__PURE__ */ (0, u.jsxs)(u.Fragment, {
                    children: [` · `, Y(`turns.reconciled`, { factor: e.reconciled.factor.toFixed(3) })],
                  }),
            ],
          }),
        ],
      })
    }
    function Wr({ title: e, children: t }) {
      return /* @__PURE__ */ (0, u.jsx)(jr, {
        label: e,
        children: /* @__PURE__ */ (0, u.jsxs)(`div`, {
          className: `flex min-w-0 flex-col gap-2.5`,
          children: [/* @__PURE__ */ (0, u.jsx)(`h3`, { className: `m-0 text-[12px] font-semibold`, children: e }), t],
        }),
      })
    }
    function Gr({ slices: e, center: t, name: n }) {
      let r = e.reduce((e, t) => e + t.value, 0),
        i = 0
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `grid w-full min-w-0 place-items-center`,
        children: [
          /* @__PURE__ */ (0, u.jsxs)(`svg`, {
            viewBox: `0 0 120 120`,
            className: `col-start-1 row-start-1 h-32 w-32 max-w-full`,
            role: `img`,
            "aria-label": n,
            children: [
              /* @__PURE__ */ (0, u.jsx)(`circle`, {
                cx: `60`,
                cy: `60`,
                r: `48`,
                fill: `none`,
                stroke: `var(--color-bg-3)`,
                strokeWidth: `9`,
              }),
              r <= 0
                ? null
                : e.map((e, t) => {
                    const n = (e.value / r) * 100,
                      a = i
                    return (
                      (i += n),
                      /* @__PURE__ */ (0, u.jsx)(
                        `circle`,
                        {
                          cx: `60`,
                          cy: `60`,
                          r: `48`,
                          fill: `none`,
                          stroke: e.color,
                          strokeWidth: `9`,
                          pathLength: `100`,
                          strokeDasharray: `${n} ${100 - n}`,
                          strokeDashoffset: -a,
                          transform: `rotate(-90 60 60)`,
                        },
                        t,
                      )
                    )
                  }),
            ],
          }),
          /* @__PURE__ */ (0, u.jsx)(`div`, {
            className: `col-start-1 row-start-1 flex max-w-[16ch] flex-col items-center gap-1 text-center text-[12px]`,
            children: t,
          }),
        ],
      })
    }
    function Kr() {
      return /* @__PURE__ */ (0, u.jsx)(`span`, {
        className: `text-[12px] text-fg-dim`,
        children: X(`insights.unrecorded`),
      })
    }
    function qr({ insights: e, overview: t, onJumpTurn: n, onLoadMore: r, loadingMore: i = !1, pagingFailure: a }) {
      const o = e ?? t?.report,
        s = e === void 0 && t?.source === `client-partial`,
        c = X(s ? `insights.loadedContext` : `insights.current`),
        l = X(s && t?.usageSource !== `cost` ? `insights.loadedUsage` : `insights.usage`)
      if (o === void 0)
        return /* @__PURE__ */ (0, u.jsx)(`div`, { className: `p-5`, children: /* @__PURE__ */ (0, u.jsx)(Kr, {}) })
      const d = o.currentAttribution,
        f = d?.attribution,
        p = f?.windowSize,
        m = f !== void 0 && p !== void 0 && p > 0 ? f.total.tokens / p : void 0,
        h = o.usage,
        g = [
          { key: `input`, color: Vr(`user-input`) },
          { key: `cacheRead`, color: Vr(`history`) },
          { key: `cacheWrite`, color: Vr(`memory-instructions`) },
          { key: `output`, color: Vr(`assistant-output`) },
        ],
        _ = h.coveredTurns === 0 && t?.usageSource !== `cost` ? null : g.reduce((e, t) => e + (h[t.key] ?? 0), 0),
        v = o.timing
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `flex min-w-0 flex-col gap-3 p-4`,
        children: [
          /* @__PURE__ */ (0, u.jsxs)(jr, {
            label: X(`insights.summary`),
            children: [
              /* @__PURE__ */ (0, u.jsxs)(`div`, {
                className: `flex flex-wrap items-center justify-between gap-2`,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(`h3`, {
                    className: `m-0 text-[12px] font-semibold`,
                    children: X(`insights.summary`),
                  }),
                  /* @__PURE__ */ (0, u.jsxs)(`span`, {
                    className: `text-[11px] text-fg-dim tabular-nums`,
                    children: [X(`insights.turnCount`), ` · `, t?.totalTurns ?? o.turnCount],
                  }),
                ],
              }),
              e === void 0 && t !== void 0 && t.source !== `host`
                ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                    className: `m-0 mbs-2 text-[11px] text-fg-dim`,
                    role: `status`,
                    children: s
                      ? X(`insights.partial`, { loaded: t.loadedTurns, total: t.totalTurns })
                      : X(`insights.fallback`),
                  })
                : null,
              s
                ? /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    className: `mbs-2 flex flex-wrap items-center justify-between gap-2`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        className: `text-[11px] text-fg-dim`,
                        children: X(`insights.loadedNote`),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`button`, {
                        type: `button`,
                        className: `ci-btn min-h-9 active:bg-bg-3`,
                        disabled: i || r === void 0,
                        onClick: r,
                        children: Y(i ? `session.loadingMore` : `session.loadMore`),
                      }),
                    ],
                  })
                : null,
              a,
              /* @__PURE__ */ (0, u.jsxs)(`dl`, {
                className: `m-0 mbs-3 flex flex-wrap gap-x-6 gap-y-2 text-[11px]`,
                children: [
                  /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`dt`, { className: `text-fg-dim`, children: X(`insights.toolCalls`) }),
                      /* @__PURE__ */ (0, u.jsx)(`dd`, {
                        className: `m-0 font-semibold tabular-nums`,
                        children: o.toolCalls,
                      }),
                    ],
                  }),
                  /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`dt`, {
                        className: `text-fg-dim`,
                        children: X(`insights.compactions`),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`dd`, {
                        className: `m-0 font-semibold tabular-nums`,
                        children: o.compactions,
                      }),
                    ],
                  }),
                  /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`dt`, { className: `text-fg-dim`, children: X(`insights.span`) }),
                      /* @__PURE__ */ (0, u.jsx)(`dd`, {
                        className: `m-0 font-semibold tabular-nums`,
                        children: v.spanMs === null ? /* @__PURE__ */ (0, u.jsx)(Kr, {}) : un(1, v.spanMs + 1),
                      }),
                    ],
                  }),
                  /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`dt`, { className: `text-fg-dim`, children: X(`insights.peak`) }),
                      /* @__PURE__ */ (0, u.jsx)(`dd`, {
                        className: `m-0 font-semibold tabular-nums`,
                        children:
                          o.peak === null
                            ? /* @__PURE__ */ (0, u.jsx)(Kr, {})
                            : /* @__PURE__ */ (0, u.jsx)(zr, { measure: o.peak.measure, dense: !0 }),
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `grid grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] items-start gap-3`,
            children: [
              /* @__PURE__ */ (0, u.jsxs)(Wr, {
                title: c,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(Gr, {
                    name: c,
                    slices:
                      m === void 0
                        ? []
                        : [
                            { value: Math.min(m, 1), color: `var(--color-accent)` },
                            { value: Math.max(1 - m, 0), color: `var(--color-bg-3)` },
                          ],
                    center:
                      f === void 0
                        ? /* @__PURE__ */ (0, u.jsx)(Kr, {})
                        : /* @__PURE__ */ (0, u.jsxs)(u.Fragment, {
                            children: [
                              /* @__PURE__ */ (0, u.jsx)(`strong`, {
                                className: `text-[24px] tabular-nums`,
                                children: en(f.total.tokens),
                              }),
                              /* @__PURE__ */ (0, u.jsx)(`span`, { className: `text-fg-dim`, children: `tokens` }),
                            ],
                          }),
                  }),
                  f === void 0 ? null : /* @__PURE__ */ (0, u.jsx)(zr, { measure: f.total }),
                  /* @__PURE__ */ (0, u.jsx)(`p`, {
                    className: `m-0 text-[11px] text-fg-dim`,
                    children:
                      m === void 0
                        ? X(`insights.windowUnknown`)
                        : X(`insights.window`, { share: rn(f.total.tokens, p) }),
                  }),
                  d === null || s
                    ? null
                    : /* @__PURE__ */ (0, u.jsx)(`p`, {
                        className: `m-0 text-[11px] text-fg-dim`,
                        children: X(`insights.currentNote`, { index: d.turnIndex }),
                      }),
                ],
              }),
              /* @__PURE__ */ (0, u.jsxs)(Wr, {
                title: l,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(Gr, {
                    name: l,
                    slices: _ === null ? [] : g.map((e) => ({ value: h[e.key] ?? 0, color: e.color })),
                    center:
                      _ === null
                        ? /* @__PURE__ */ (0, u.jsx)(Kr, {})
                        : /* @__PURE__ */ (0, u.jsxs)(u.Fragment, {
                            children: [
                              /* @__PURE__ */ (0, u.jsx)(`strong`, {
                                className: `text-[24px] tabular-nums`,
                                children: en(_),
                              }),
                              /* @__PURE__ */ (0, u.jsx)(`span`, { className: `text-fg-dim`, children: `tokens` }),
                            ],
                          }),
                  }),
                  /* @__PURE__ */ (0, u.jsx)(`ul`, {
                    className: `m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2 p-0`,
                    children: g.map((e) =>
                      /* @__PURE__ */ (0, u.jsxs)(
                        `li`,
                        {
                          className: `flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]`,
                          children: [
                            /* @__PURE__ */ (0, u.jsx)(`span`, {
                              className: `h-2 w-2 shrink-0 rounded-full`,
                              style: { background: e.color },
                              "aria-hidden": `true`,
                            }),
                            /* @__PURE__ */ (0, u.jsx)(`span`, { children: X(`insights.${e.key}`) }),
                            h[e.key] === null
                              ? /* @__PURE__ */ (0, u.jsx)(Kr, {})
                              : /* @__PURE__ */ (0, u.jsx)(zr, {
                                  measure: { tokens: h[e.key], precision: `exact`, basis: `usage` },
                                  dense: !0,
                                }),
                          ],
                        },
                        e.key,
                      ),
                    ),
                  }),
                  /* @__PURE__ */ (0, u.jsx)(`p`, {
                    className: `m-0 text-[11px] text-fg-dim`,
                    children: X(
                      t?.usageSource === `cost` && e === void 0 ? `insights.costUsage` : `insights.usageNote`,
                    ),
                  }),
                  /* @__PURE__ */ (0, u.jsx)(`p`, {
                    className: `m-0 text-[11px] text-fg-dim`,
                    children: X(`insights.coverage`, { covered: h.coveredTurns, missing: h.missingTurns }),
                  }),
                ],
              }),
            ],
          }),
          /* @__PURE__ */ (0, u.jsx)(Wr, {
            title: X(`insights.composition`),
            children:
              f === void 0
                ? /* @__PURE__ */ (0, u.jsx)(Kr, {})
                : /* @__PURE__ */ (0, u.jsxs)(u.Fragment, {
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(Hr, { attribution: f, label: X(`insights.composition`) }),
                      /* @__PURE__ */ (0, u.jsx)(Ur, { attribution: f }),
                    ],
                  }),
          }),
          /* @__PURE__ */ (0, u.jsxs)(jr, {
            label: X(`insights.completedDuration`),
            children: [
              /* @__PURE__ */ (0, u.jsxs)(`div`, {
                className: `grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3`,
                children: [
                  /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    className: `flex flex-col gap-1`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`h3`, {
                        className: `m-0 text-[12px] font-semibold`,
                        children: X(`insights.completedDuration`),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`p`, {
                        className: `m-0 text-[16px] tabular-nums`,
                        children:
                          v.completedTurnMs === null
                            ? /* @__PURE__ */ (0, u.jsx)(Kr, {})
                            : un(1, v.completedTurnMs + 1),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`p`, {
                        className: `m-0 text-[11px] text-fg-dim`,
                        children: X(`insights.durationCoverage`, {
                          covered: v.completedTurns,
                          missing: v.missingTurnDurations,
                        }),
                      }),
                    ],
                  }),
                  /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    className: `flex flex-col gap-1`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`h3`, {
                        className: `m-0 text-[12px] font-semibold`,
                        children: X(`insights.toolDuration`),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`p`, {
                        className: `m-0 text-[16px] tabular-nums`,
                        children:
                          v.toolUnionMs === null ? /* @__PURE__ */ (0, u.jsx)(Kr, {}) : un(1, v.toolUnionMs + 1),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`p`, {
                        className: `m-0 text-[11px] text-fg-dim`,
                        children: X(`insights.durationCoverage`, {
                          covered: v.timedToolCalls,
                          missing: v.missingToolDurations,
                        }),
                      }),
                    ],
                  }),
                ],
              }),
              /* @__PURE__ */ (0, u.jsx)(`p`, {
                className: `m-0 mbs-2 text-[11px] text-fg-dim`,
                children: X(`insights.durationNote`),
              }),
            ],
          }),
          /* @__PURE__ */ (0, u.jsx)(Wr, {
            title: X(s ? `insights.loadedMessage` : `insights.lastMessage`),
            children:
              o.lastMessage === null
                ? /* @__PURE__ */ (0, u.jsx)(Kr, {})
                : /* @__PURE__ */ (0, u.jsxs)(u.Fragment, {
                    children: [
                      /* @__PURE__ */ (0, u.jsxs)(`div`, {
                        className: `flex flex-wrap items-center gap-2 text-[11px] text-fg-dim`,
                        children: [
                          /* @__PURE__ */ (0, u.jsx)(`span`, { children: X(`insights.${o.lastMessage.role}`) }),
                          o.lastMessage.time === void 0
                            ? /* @__PURE__ */ (0, u.jsx)(Kr, {})
                            : /* @__PURE__ */ (0, u.jsx)(`time`, { children: cn(o.lastMessage.time) }),
                          /* @__PURE__ */ (0, u.jsx)(`button`, {
                            type: `button`,
                            className: `ci-btn min-h-9 active:bg-bg-3`,
                            disabled: n === void 0,
                            onClick: () => n?.(o.lastMessage.turnIndex),
                            children: X(`insights.jump`, { index: o.lastMessage.turnIndex }),
                          }),
                        ],
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`p`, {
                        className: `m-0 max-h-64 overflow-y-auto text-[12px] leading-relaxed wrap-anywhere whitespace-pre-wrap`,
                        children: o.lastMessage.text,
                      }),
                    ],
                  }),
          }),
        ],
      })
    }
    const Jr = {
        clipPath: `inset(50%)`,
        overflow: `hidden`,
        whiteSpace: `nowrap`,
        border: 0,
        padding: 0,
        width: 1,
        height: 1,
        margin: -1,
      },
      Yr = { ...Jr, position: `fixed`, margin: 0, top: 0, left: 0 },
      Xr = { ...Jr, position: `absolute` },
      Zr = {}
    function Qr(e, t) {
      const n = l.useRef(Zr)
      return (n.current === Zr && (n.current = e(t)), n)
    }
    function $r(e, t, n, r) {
      const i = Qr(ti).current
      return (ni(i, e, t, n, r) && ii(i, [e, t, n, r]), i.callback)
    }
    function ei(e) {
      const t = Qr(ti).current
      return (ri(t, e) && ii(t, e), t.callback)
    }
    function ti() {
      return { callback: null, cleanup: null, refs: [] }
    }
    function ni(e, t, n, r, i) {
      return e.refs[0] !== t || e.refs[1] !== n || e.refs[2] !== r || e.refs[3] !== i
    }
    function ri(e, t) {
      return e.refs.length !== t.length || e.refs.some((e, n) => e !== t[n])
    }
    function ii(e, t) {
      ;((e.refs = t),
        (e.callback = t.every((e) => e == null)
          ? null
          : (n) => {
              if (((e.cleanup &&= (e.cleanup(), null)), n != null)) {
                const r = Array(t.length).fill(null)
                for (let e = 0; e < t.length; e += 1) {
                  const i = t[e]
                  if (i != null)
                    switch (typeof i) {
                      case `function`: {
                        const t = i(n)
                        typeof t == `function` && (r[e] = t)
                        break
                      }
                      case `object`:
                        i.current = n
                    }
                }
                e.cleanup = () => {
                  for (let e = 0; e < t.length; e += 1) {
                    const n = t[e]
                    if (n != null)
                      switch (typeof n) {
                        case `function`: {
                          const t = r[e]
                          typeof t == `function` ? t() : n(null)
                          break
                        }
                        case `object`:
                          n.current = null
                      }
                  }
                }
              }
            }))
    }
    function ai(e) {
      const t = l.useRef(!0)
      t.current && ((t.current = !1), e())
    }
    function oi(e) {
      const [t, n] = l.useState({ current: e, previous: null })
      return (Object.is(e, t.current) || n({ current: e, previous: t.current }), t.previous)
    }
    function si(e) {
      return e == null || e.hasAttribute(`disabled`) || e.getAttribute(`aria-disabled`) === `true`
    }
    function ci({ controlled: e, default: t, name: n, state: r = `value` }) {
      const { current: i } = l.useRef(e !== void 0),
        [a, o] = l.useState(() => t)
      return [
        i && e !== void 0 ? e : a,
        l.useCallback((e) => {
          i || o(e)
        }, []),
      ]
    }
    const Z = typeof document < `u` ? l.useLayoutEffect : () => {},
      li = { ...l },
      ui = li.useInsertionEffect,
      di = ui && ui !== li.useLayoutEffect ? ui : (e) => e()
    function Q(e) {
      const t = Qr(fi).current
      return ((t.next = e), di(t.effect), t.trampoline)
    }
    function fi() {
      const e = {
        next: void 0,
        callback: pi,
        trampoline: (...t) => e.callback?.(...t),
        effect: () => {
          e.callback = e.next
        },
      }
      return e
    }
    function pi() {}
    function mi(e) {
      const t = Qr(hi, e).current
      return ((t.next = e), Z(t.effect), t)
    }
    function hi(e) {
      const t = {
        current: e,
        next: e,
        effect: () => {
          t.current = t.next
        },
      }
      return t
    }
    function gi(e, t) {
      return function (n, ...r) {
        const i = new URL(e)
        return (
          i.searchParams.set(`code`, n.toString()),
          r.forEach((e) => i.searchParams.append(`args[]`, e)),
          `${t} error #${n}; visit ${i} for the full message.`
        )
      }
    }
    const _i = gi(`https://base-ui.com/production-error`, `Base UI`)
    /**
     * @license React
     * use-sync-external-store-shim.production.js
     *
     * Copyright (c) Meta Platforms, Inc. and affiliates.
     *
     * This source code is licensed under the MIT license found in the
     * LICENSE file in the root directory of this source tree.
     */
    const vi = /* @__PURE__ */ o((e) => {
        var t = require("react")
        function n(e, t) {
          return (e === t && (e !== 0 || 1 / e == 1 / t)) || (e !== e && t !== t)
        }
        var r = typeof Object.is == `function` ? Object.is : n,
          i = t.useState,
          a = t.useEffect,
          o = t.useLayoutEffect,
          s = t.useDebugValue
        function c(e, t) {
          var n = t(),
            r = i({ inst: { value: n, getSnapshot: t } }),
            c = r[0].inst,
            u = r[1]
          return (
            o(
              function () {
                ;((c.value = n), (c.getSnapshot = t), l(c) && u({ inst: c }))
              },
              [e, n, t],
            ),
            a(
              function () {
                return (
                  l(c) && u({ inst: c }),
                  e(function () {
                    l(c) && u({ inst: c })
                  })
                )
              },
              [e],
            ),
            s(n),
            n
          )
        }
        function l(e) {
          var t = e.getSnapshot
          e = e.value
          try {
            var n = t()
            return !r(e, n)
          } catch {
            return !0
          }
        }
        function u(e, t) {
          return t()
        }
        var d = typeof window > `u` || window.document === void 0 || window.document.createElement === void 0 ? u : c
        e.useSyncExternalStore = t.useSyncExternalStore === void 0 ? d : t.useSyncExternalStore
      }),
      yi = /* @__PURE__ */ o((e, t) => {
        t.exports = vi()
      }),
      bi = /* @__PURE__ */ o((e) => {
        /**
         * @license React
         * use-sync-external-store-shim/with-selector.production.js
         *
         * Copyright (c) Meta Platforms, Inc. and affiliates.
         *
         * This source code is licensed under the MIT license found in the
         * LICENSE file in the root directory of this source tree.
         */
        var t = require("react"),
          n = yi()
        function r(e, t) {
          return (e === t && (e !== 0 || 1 / e == 1 / t)) || (e !== e && t !== t)
        }
        var i = typeof Object.is == `function` ? Object.is : r,
          a = n.useSyncExternalStore,
          o = t.useRef,
          s = t.useEffect,
          c = t.useMemo,
          l = t.useDebugValue
        e.useSyncExternalStoreWithSelector = function (e, t, n, r, u) {
          var d = o(null)
          if (d.current === null) {
            var f = { hasValue: !1, value: null }
            d.current = f
          } else f = d.current
          d = c(
            function () {
              function e(e) {
                if (!a) {
                  if (((a = !0), (o = e), (e = r(e)), u !== void 0 && f.hasValue)) {
                    var t = f.value
                    if (u(t, e)) return (s = t)
                  }
                  return (s = e)
                }
                if (((t = s), i(o, e))) return t
                var n = r(e)
                return u !== void 0 && u(t, n) ? ((o = e), t) : ((o = e), (s = n))
              }
              var a = !1,
                o,
                s,
                c = n === void 0 ? null : n
              return [
                function () {
                  return e(t())
                },
                c === null
                  ? void 0
                  : function () {
                      return e(c())
                    },
              ]
            },
            [t, n, r, u],
          )
          var p = a(e, d[0], d[1])
          return (
            s(
              function () {
                ;((f.hasValue = !0), (f.value = p))
              },
              [p],
            ),
            l(p),
            p
          )
        }
      }),
      xi = /* @__PURE__ */ o((e, t) => {
        t.exports = bi()
      })
    const Si = parseInt(l.version, 10)
    function Ci(e) {
      return Si >= e
    }
    const wi = []
    function Ti(e) {
      wi.push(e)
    }
    const Ei = yi(),
      Di = xi()
    const Oi = Ci(19) ? ji : Mi
    function ki(e, t, n, r, i) {
      return Oi(e, t, n, r, i)
    }
    function Ai(e, t, n, r, i) {
      const a = l.useCallback(() => t(e.getSnapshot(), n, r, i), [e, t, n, r, i])
      return (0, Ei.useSyncExternalStore)(e.subscribe, a, a)
    }
    Ti({
      before(e) {
        ;((e.syncIndex = 0),
          e.didInitialize ||
            ((e.syncTick = 1),
            (e.syncHooks = []),
            (e.didChangeStore = !0),
            (e.getSnapshot = () => {
              let t = !1
              for (let n = 0; n < e.syncHooks.length; n += 1) {
                const r = e.syncHooks[n],
                  i = r.selector(r.store.state, r.a1, r.a2, r.a3)
                Object.is(r.value, i) || ((t = !0), (r.value = i))
              }
              return (t && (e.syncTick += 1), e.syncTick)
            })))
      },
      after(e) {
        e.syncHooks.length > 0 &&
          (e.didChangeStore &&
            ((e.didChangeStore = !1),
            (e.subscribe = (t) => {
              const n = /* @__PURE__ */ new Set()
              for (const t of e.syncHooks) n.add(t.store)
              const r = []
              for (const e of n) r.push(e.subscribe(t))
              return () => {
                for (const e of r) e()
              }
            })),
          (0, Ei.useSyncExternalStore)(e.subscribe, e.getSnapshot, e.getSnapshot))
      },
    })
    function ji(e, t, n, r, i) {
      return Ai(e, t, n, r, i)
    }
    function Mi(e, t, n, r, i) {
      return (0, Di.useSyncExternalStoreWithSelector)(e.subscribe, e.getSnapshot, e.getSnapshot, (e) => t(e, n, r, i))
    }
    const Ni = class {
      static create(e) {
        return new this(e)
      }
      constructor(e) {
        ;((this.state = e), (this.listeners = /* @__PURE__ */ new Set()), (this.updateTick = 0))
      }
      subscribe = (e) => (
        this.listeners.add(e),
        () => {
          this.listeners.delete(e)
        }
      )
      getSnapshot = () => this.state
      setState(e) {
        if (this.state === e) return
        ;((this.state = e), (this.updateTick += 1))
        let t = this.updateTick
        for (let n of this.listeners) {
          if (t !== this.updateTick) return
          n(e)
        }
      }
      update(e) {
        for (let t in e)
          if (!Object.is(this.state[t], e[t])) {
            this.setState({ ...this.state, ...e })
            return
          }
      }
      set(e, t) {
        Object.is(this.state[e], t) || this.setState({ ...this.state, [e]: t })
      }
      notifyAll() {
        let e = { ...this.state }
        this.setState(e)
      }
      use(e, t, n, r) {
        return ki(this, e, t, n, r)
      }
    }
    function Pi() {}
    const Fi = Object.freeze([]),
      Ii = Object.freeze({})
    const Li = class extends Ni {
      constructor(e, t = {}, n) {
        ;(super(e), (this.context = t), (this.selectors = n))
      }
      useSyncedValue(e, t) {
        l.useDebugValue(e)
        let n = this
        Z(() => {
          n.state[e] !== t && n.set(e, t)
        }, [n, e, t])
      }
      useSyncedValueWithCleanup(e, t) {
        let n = this
        Z(
          () => (
            n.state[e] !== t && n.set(e, t),
            () => {
              n.set(e, void 0)
            }
          ),
          [n, e, t],
        )
      }
      useSyncedValues(e) {
        let t = this,
          n = Object.values(e)
        Z(() => {
          t.update(e)
        }, [t, ...n])
      }
      useControlledProp(e, t) {
        l.useDebugValue(e)
        let n = this,
          r = t !== void 0
        Z(() => {
          r && !Object.is(n.state[e], t) && n.setState({ ...n.state, [e]: t })
        }, [n, e, t, r])
      }
      select(e, t, n, r) {
        let i = this.selectors[e]
        return i(this.state, t, n, r)
      }
      useState(e, t, n, r) {
        return (l.useDebugValue(e), ki(this, this.selectors[e], t, n, r))
      }
      useContextCallback(e, t) {
        l.useDebugValue(e)
        let n = Q(t ?? Pi)
        this.context[e] = n
      }
      useStateSetter(e) {
        let t = l.useRef(void 0)
        return (
          t.current === void 0 &&
            (t.current = (t) => {
              this.set(e, t)
            }),
          t.current
        )
      }
      observe(e, t) {
        let n
        n = typeof e == `function` ? e : this.selectors[e]
        let r = n(this.state)
        return (
          t(r, r, this),
          this.subscribe((e) => {
            let i = n(e)
            if (!Object.is(r, i)) {
              let e = r
              ;((r = i), t(i, e, this))
            }
          })
        )
      }
    }
    function Ri() {
      return typeof window < `u`
    }
    function zi(e) {
      return Hi(e) ? (e.nodeName || ``).toLowerCase() : `#document`
    }
    function Bi(e) {
      let t
      return (e == null || (t = e.ownerDocument) == null ? void 0 : t.defaultView) || window
    }
    function Vi(e) {
      return ((Hi(e) ? e.ownerDocument : e.document) || window.document)?.documentElement
    }
    function Hi(e) {
      return Ri() ? e instanceof Node || e instanceof Bi(e).Node : !1
    }
    function Ui(e) {
      return Ri() ? e instanceof Element || e instanceof Bi(e).Element : !1
    }
    function Wi(e) {
      return Ri() ? e instanceof HTMLElement || e instanceof Bi(e).HTMLElement : !1
    }
    function Gi(e) {
      return !Ri() || typeof ShadowRoot > `u` ? !1 : e instanceof ShadowRoot || e instanceof Bi(e).ShadowRoot
    }
    function Ki(e) {
      const { overflow: t, overflowX: n, overflowY: r, display: i } = ra(e)
      return /auto|scroll|overlay|hidden|clip/.test(t + r + n) && i !== `inline` && i !== `contents`
    }
    function qi(e) {
      return /^(table|td|th)$/.test(zi(e))
    }
    function Ji(e) {
      try {
        if (e.matches(`:popover-open`)) return !0
      } catch {}
      try {
        return e.matches(`:modal`)
      } catch {
        return !1
      }
    }
    const Yi = /transform|translate|scale|rotate|perspective|filter/,
      Xi = /paint|layout|strict|content/,
      Zi = (e) => !!e && e !== `none`
    let Qi
    function $i(e) {
      const t = Ui(e) ? ra(e) : e
      return (
        Zi(t.transform) ||
        Zi(t.translate) ||
        Zi(t.scale) ||
        Zi(t.rotate) ||
        Zi(t.perspective) ||
        (!ta() && (Zi(t.backdropFilter) || Zi(t.filter))) ||
        Yi.test(t.willChange || ``) ||
        Xi.test(t.contain || ``)
      )
    }
    function ea(e) {
      let t = aa(e)
      for (; Wi(t) && !na(t);) {
        if ($i(t)) return t
        if (Ji(t)) return null
        t = aa(t)
      }
      return null
    }
    function ta() {
      return ((Qi ??= typeof CSS < `u` && CSS.supports && CSS.supports(`-webkit-backdrop-filter`, `none`)), Qi)
    }
    function na(e) {
      return /^(html|body|#document)$/.test(zi(e))
    }
    function ra(e) {
      return Bi(e).getComputedStyle(e)
    }
    function ia(e) {
      return Ui(e)
        ? { scrollLeft: e.scrollLeft, scrollTop: e.scrollTop }
        : { scrollLeft: e.scrollX, scrollTop: e.scrollY }
    }
    function aa(e) {
      if (zi(e) === `html`) return e
      const t = e.assignedSlot || e.parentNode || (Gi(e) && e.host) || Vi(e)
      return Gi(t) ? t.host : t
    }
    function oa(e) {
      const t = aa(e)
      return na(t) ? (e.ownerDocument || e).body : Wi(t) && Ki(t) ? t : oa(t)
    }
    function sa(e, t, n) {
      ;(t === void 0 && (t = []), n === void 0 && (n = !0))
      const r = oa(e),
        i = r === e.ownerDocument?.body,
        a = Bi(r)
      if (i) {
        const e = ca(a)
        return t.concat(a, a.visualViewport || [], Ki(r) ? r : [], e && n ? sa(e) : [])
      }
      return t.concat(r, sa(r, [], n))
    }
    function ca(e) {
      return e.parent && Object.getPrototypeOf(e.parent) ? e.frameElement : null
    }
    function la(...e) {
      return () => {
        for (let t = 0; t < e.length; t += 1) {
          const n = e[t]
          n && n()
        }
      }
    }
    function ua(e) {
      return e?.ownerDocument || document
    }
    function da(e, t, n, r) {
      return (
        e.addEventListener(t, n, r),
        () => {
          e.removeEventListener(t, n, r)
        }
      )
    }
    function fa() {
      const [, e] = l.useState({})
      return l.useCallback(() => {
        e({})
      }, [])
    }
    function pa(e) {
      l.useEffect(e, Fi)
    }
    globalThis.requestAnimationFrame
    const ma = new (class {
      callbacks = []
      callbacksCount = 0
      nextId = 1
      startId = 1
      isScheduled = !1
      tick = (e) => {
        this.isScheduled = !1
        let t = this.callbacks,
          n = this.callbacksCount
        if (((this.callbacks = []), (this.callbacksCount = 0), (this.startId = this.nextId), n > 0))
          for (let n = 0; n < t.length; n += 1) t[n]?.(e)
      }
      request(e) {
        let t = this.nextId
        return (
          (this.nextId += 1),
          this.callbacks.push(e),
          (this.callbacksCount += 1),
          (this.isScheduled ||= (requestAnimationFrame(this.tick), !0)),
          t
        )
      }
      cancel(e) {
        let t = e - this.startId
        t < 0 ||
          t >= this.callbacks.length ||
          (this.callbacks[t] !== null && ((this.callbacks[t] = null), --this.callbacksCount))
      }
    })()
    const ha = class e {
      static create() {
        return new e()
      }
      static request(e) {
        return ma.request(e)
      }
      static cancel(e) {
        return ma.cancel(e)
      }
      currentId = null
      request(e) {
        ;(this.cancel(),
          (this.currentId = ma.request(() => {
            ;((this.currentId = null), e())
          })))
      }
      cancel = () => {
        this.currentId !== null && (ma.cancel(this.currentId), (this.currentId = null))
      }
      disposeEffect = () => this.cancel
    }
    function ga() {
      const e = Qr(ha.create).current
      return (pa(e.disposeEffect), e)
    }
    const _a = class e {
      static create() {
        return new e()
      }
      currentId = 0
      start(e, t) {
        ;(this.clear(),
          (this.currentId = setTimeout(() => {
            ;((this.currentId = 0), t())
          }, e)))
      }
      isStarted() {
        return this.currentId !== 0
      }
      clear = () => {
        this.currentId !== 0 && (clearTimeout(this.currentId), (this.currentId = 0))
      }
      disposeEffect = () => this.clear
    }
    function va() {
      const e = Qr(_a.create).current
      return (pa(e.disposeEffect), e)
    }
    function ya() {
      return typeof navigator > `u`
        ? { userAgent: ``, platform: ``, maxTouchPoints: 0 }
        : {
            userAgent: navigator.userAgent,
            platform: navigator.platform ?? ``,
            maxTouchPoints: navigator.maxTouchPoints ?? 0,
          }
    }
    const { userAgent: ba, platform: xa, maxTouchPoints: Sa } = ya(),
      Ca = ba.toLowerCase(),
      wa = xa.toLowerCase(),
      Ta = /^i(os$|p)/.test(wa) || (wa === `macintel` && Sa > 1),
      Ea = `android`,
      Da = wa === Ea || Ca.includes(Ea),
      Oa = !Ta && wa.startsWith(`mac`)
    ;(wa.startsWith(`win`), !Da && /^(linux|chrome os)/.test(wa))
    const ka = Oa || Ta,
      Aa = typeof CSS < `u` && !!CSS.supports?.(`-webkit-backdrop-filter:none`)
    ;(!Aa && Ca.includes(`firefox`), !Aa && Ca.includes(`chrom`))
    const ja = ka,
      Ma = /jsdom|happydom/.test(Ca)
    function Na(e) {
      ;(e.preventDefault(), e.stopPropagation())
    }
    function Pa(e) {
      return `nativeEvent` in e
    }
    function Fa(e) {
      return e.pointerType === `` && e.isTrusted
        ? !0
        : Da && e.pointerType
          ? e.type === `click` && e.buttons === 1
          : e.detail === 0 && !e.pointerType
    }
    function Ia(e) {
      return Ma
        ? !1
        : (!Da && e.width === 0 && e.height === 0) ||
            (e.type === `pointerdown` &&
              e.width === 1 &&
              e.height === 1 &&
              e.pressure === 0 &&
              e.detail === 0 &&
              e.pointerType === `mouse` &&
              (Da || e.buttons === 0)) ||
            (e.width < 1 && e.height < 1 && e.pressure === 0 && e.detail === 0 && e.pointerType === `touch`)
    }
    function La(e, t) {
      const n = [`mouse`, `pen`]
      return (t || n.push(``, void 0), n.includes(e))
    }
    function Ra(e) {
      const t = e.type
      return t === `click` || t === `mousedown` || t === `keydown` || t === `keyup`
    }
    function za(e) {
      let t = e.activeElement
      for (; t?.shadowRoot?.activeElement != null;) t = t.shadowRoot.activeElement
      return t
    }
    function $(e, t) {
      if (!e || !t) return !1
      const n = t.getRootNode?.()
      if (e.contains(t)) return !0
      if (n && Gi(n)) {
        let n = t
        for (; n;) {
          if (e === n) return !0
          n = n.parentNode || n.host
        }
      }
      return !1
    }
    function Ba(e, t) {
      let n = e
      for (; n;) {
        if (Ui(n) && n.matches(t)) return n
        n = n.assignedSlot ?? n.parentNode ?? (Gi(n) ? n.host : null)
      }
      return null
    }
    function Va(e) {
      return `composedPath` in e ? (e.composedPath()[0] ?? e.target) : e.target
    }
    const Ha = `ArrowLeft`,
      Ua = `ArrowRight`,
      Wa = `data-starting-style`,
      Ga = { [Wa]: `` },
      Ka = { "data-ending-style": `` },
      qa = {
        transitionStatus(e) {
          return e === `starting` ? Ga : e === `ending` ? Ka : null
        },
      },
      Ja = `data-popup-open`,
      Ya = { [Ja]: `` },
      Xa = { [Ja]: ``, "data-pressed": `` },
      Za = { "data-open": `` },
      Qa = { "data-closed": `` },
      $a = { "data-anchor-hidden": `` },
      eo = {
        open(e) {
          return e ? Ya : null
        },
      },
      to = {
        open(e) {
          return e ? Xa : null
        },
      },
      no = {
        open(e) {
          return e ? Za : Qa
        },
        anchorHidden(e) {
          return e ? $a : null
        },
      }
    ;({ ...no, ...qa })
    function ro(e, t) {
      if (t == null) return !1
      if (`composedPath` in e) return e.composedPath().includes(t)
      const n = e
      return n.target != null && t.contains(n.target)
    }
    function io(e) {
      return e.matches(`html,body`)
    }
    function ao(e) {
      return (
        Wi(e) &&
        e.matches(
          `input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])`,
        )
      )
    }
    function oo(e) {
      return e ? e.getAttribute(`role`) === `combobox` && ao(e) : !1
    }
    function so(e) {
      return e
        ? e.hasAttribute(`data-base-ui-focusable`)
          ? e
          : e.querySelector(`[data-base-ui-focusable]`) || e
        : null
    }
    function co(e, t, n, r) {
      const i = !1,
        a = !1,
        o = r ?? Ii
      return {
        reason: e,
        event: t ?? new Event(`base-ui`),
        cancel() {
          i = !0
        },
        allowPropagation() {
          a = !0
        },
        get isCanceled() {
          return i
        },
        get isPropagationAllowed() {
          return a
        },
        trigger: n,
        ...o,
      }
    }
    const lo = `none`,
      uo = `trigger-press`,
      fo = `item-press`,
      po = `focus-out`,
      mo = `list-navigation`,
      ho = /*#__PURE__*/ l.forwardRef(function (e, t) {
        const [n, r] = l.useState()
        Z(() => {
          ja && Aa && r(`button`)
        }, [])
        const i = { tabIndex: 0, role: n }
        return /*#__PURE__*/ (0, u.jsx)(`span`, {
          ...e,
          ref: t,
          style: Yr,
          "aria-hidden": !n || void 0,
          ...i,
          "data-base-ui-focus-guard": ``,
        })
      }),
      go = Math.min,
      _o = Math.max,
      vo = Math.round,
      yo = Math.floor,
      bo = (e) => ({ x: e, y: e }),
      xo = { left: `right`, right: `left`, bottom: `top`, top: `bottom` }
    function So(e, t, n) {
      return _o(e, go(t, n))
    }
    function Co(e, t) {
      return typeof e == `function` ? e(t) : e
    }
    function wo(e) {
      return e.split(`-`)[0]
    }
    function To(e) {
      return e.split(`-`)[1]
    }
    function Eo(e) {
      return e === `x` ? `y` : `x`
    }
    function Do(e) {
      return e === `y` ? `height` : `width`
    }
    function Oo(e) {
      const t = e[0]
      return t === `t` || t === `b` ? `y` : `x`
    }
    function ko(e) {
      return Eo(Oo(e))
    }
    function Ao(e, t, n) {
      n === void 0 && (n = !1)
      let r = To(e),
        i = ko(e),
        a = Do(i),
        o = i === `x` ? (r === (n ? `end` : `start`) ? `right` : `left`) : r === `start` ? `bottom` : `top`
      return (t.reference[a] > t.floating[a] && (o = zo(o)), [o, zo(o)])
    }
    function jo(e) {
      const t = zo(e)
      return [Mo(e), t, Mo(t)]
    }
    function Mo(e) {
      return e.includes(`start`) ? e.replace(`start`, `end`) : e.replace(`end`, `start`)
    }
    const No = [`left`, `right`],
      Po = [`right`, `left`],
      Fo = [`top`, `bottom`],
      Io = [`bottom`, `top`]
    function Lo(e, t, n) {
      switch (e) {
        case `top`:
        case `bottom`:
          return n ? (t ? Po : No) : t ? No : Po
        case `left`:
        case `right`:
          return t ? Fo : Io
        default:
          return []
      }
    }
    function Ro(e, t, n, r) {
      let i = To(e),
        a = Lo(wo(e), n === `start`, r)
      return (i && ((a = a.map((e) => `${e  }-${  i}`)), t && (a = a.concat(a.map(Mo)))), a)
    }
    function zo(e) {
      const t = wo(e)
      return xo[t] + e.slice(t.length)
    }
    function Bo(e) {
      return { top: e.top ?? 0, right: e.right ?? 0, bottom: e.bottom ?? 0, left: e.left ?? 0 }
    }
    function Vo(e) {
      return typeof e == `number` ? { top: e, right: e, bottom: e, left: e } : Bo(e)
    }
    function Ho(e) {
      const { x: t, y: n, width: r, height: i } = e
      return { width: r, height: i, top: n, left: t, right: t + r, bottom: n + i, x: t, y: n }
    }
    function Uo(e, t) {
      return t < 0 || t >= e.length
    }
    function Wo(e, t) {
      return qo(e.current, { disabledIndices: t })
    }
    function Go(e, t) {
      return qo(e.current, { decrement: !0, startingIndex: e.current.length, disabledIndices: t })
    }
    function Ko(e, t, n) {
      let { decrement: r, loopFocus: i, allowEscape: a, disabledIndices: o, minIndex: s, maxIndex: c } = n,
        l = () => qo(e, { startingIndex: t, decrement: r, disabledIndices: o }),
        u,
        d = !1
      if (!i) u = r ? Math.max(s, l()) : Math.min(c, l())
      else if (r ? t <= s : t >= c) {
        const n = r ? -1 : e.length
        a && t !== n ? (u = -1) : ((u = r ? c : s), (d = !0))
      } else u = l()
      return { index: Uo(e, u) ? -1 : u, wrapped: d }
    }
    function qo(e, { startingIndex: t = -1, decrement: n = !1, disabledIndices: r, amount: i = 1 } = {}) {
      let a = t
      do a += n ? -i : i
      while (a >= 0 && a <= e.length - 1 && Jo(e, a, r))
      return a
    }
    function Jo(e, t, n) {
      if (typeof n == `function` ? n(t) : (n?.includes(t) ?? !1)) return !0
      const r = e[t]
      return r
        ? !Xo(r) || r.matches(`:disabled`)
          ? !0
          : !n && (r.hasAttribute(`disabled`) || r.getAttribute(`aria-disabled`) === `true`)
        : !1
    }
    function Yo(e) {
      return e.visibility === `hidden` || e.visibility === `collapse`
    }
    function Xo(e, t = e ? ra(e) : null) {
      return !e || !e.isConnected || !t || Yo(t)
        ? !1
        : typeof e.checkVisibility == `function`
          ? e.checkVisibility()
          : t.display !== `none` && t.display !== `contents`
    }
    function Zo(e) {
      const t = e.assignedSlot
      if (t) return t
      if (e.parentElement) return e.parentElement
      const n = e.getRootNode()
      return Gi(n) ? n.host : null
    }
    function Qo(e) {
      for (const t of Array.from(e.children)) if (zi(t) === `summary`) return t
      return null
    }
    function $o(e, t) {
      const n = Qo(t)
      return !!n && (e === n || $(n, e))
    }
    function es(e) {
      const t = e ? zi(e) : ``
      return (
        e != null &&
        e.matches(
          `a[href],button,input,select,textarea,summary,details,iframe,object,embed,[tabindex],[contenteditable]:not([contenteditable="false"]),audio[controls],video[controls]`,
        ) &&
        (t !== `summary` ||
          (e.parentElement != null && zi(e.parentElement) === `details` && Qo(e.parentElement) === e)) &&
        (t !== `details` || Qo(e) == null) &&
        (t !== `input` || e.type !== `hidden`)
      )
    }
    function ts(e) {
      if (!es(e) || !e.isConnected || e.matches(`:disabled`)) return !1
      for (let t = e; t; t = Zo(t)) {
        const n = t !== e,
          r = zi(t) === `slot`
        if (
          t.hasAttribute(`inert`) ||
          (n && zi(t) === `details` && !t.open && !$o(e, t)) ||
          t.hasAttribute(`hidden`) ||
          (!r && !ns(t, n))
        )
          return !1
      }
      return !0
    }
    function ns(e, t) {
      const n = ra(e)
      return t ? n.display !== `none` : Xo(e, n)
    }
    function rs(e) {
      const t = e.tabIndex
      if (t < 0) {
        const t = zi(e)
        if (t === `details` || t === `audio` || t === `video` || (Wi(e) && e.isContentEditable)) return 0
      }
      return t
    }
    function is(e) {
      if (zi(e) !== `input`) return null
      const t = e
      return t.type === `radio` && t.name !== `` ? t : null
    }
    function as(e, t) {
      const n = is(e)
      if (!n) return !0
      const r = t.find((e) => {
        let t = is(e)
        return t?.name === n.name && t.form === n.form && t.checked
      })
      return r
        ? r === n
        : t.find((e) => {
            const t = is(e)
            return t?.name === n.name && t.form === n.form
          }) === n
    }
    function os(e) {
      if (Wi(e) && zi(e) === `slot`) {
        const t = e.assignedElements({ flatten: !0 })
        if (t.length > 0) return t
      }
      return Wi(e) && e.shadowRoot ? Array.from(e.shadowRoot.children) : Array.from(e.children)
    }
    function ss(e, t) {
      os(e).forEach((e) => {
        ;(es(e) && t.push(e), ss(e, t))
      })
    }
    function cs(e, t, n) {
      os(e).forEach((e) => {
        ;(Wi(e) && e.matches(t) && n.push(e), cs(e, t, n))
      })
    }
    function ls(e) {
      return ts(e) && rs(e) >= 0
    }
    function us(e) {
      const t = []
      return (ss(e, t), t.filter(ts))
    }
    function ds(e) {
      const t = us(e)
      return t.filter((e) => rs(e) >= 0 && as(e, t))
    }
    function fs(e, t) {
      const n = ds(e),
        r = n.length
      if (r === 0) return
      const i = za(ua(e)),
        a = n.indexOf(i)
      return n[a === -1 ? (t === 1 ? 0 : r - 1) : a + t]
    }
    function ps(e) {
      return fs(ua(e).body, 1) || e
    }
    function ms(e) {
      return fs(ua(e).body, -1) || e
    }
    function hs(e, t) {
      const n = t || e.currentTarget,
        r = e.relatedTarget
      return !r || !$(n, r)
    }
    function gs(e) {
      ds(e).forEach((e) => {
        ;((e.dataset.tabindex = e.getAttribute(`tabindex`) || ``), e.setAttribute(`tabindex`, `-1`))
      })
    }
    function _s(e) {
      const t = []
      ;(cs(e, `[data-tabindex]`, t),
        t.forEach((e) => {
          const t = e.dataset.tabindex
          ;(delete e.dataset.tabindex, t ? e.setAttribute(`tabindex`, t) : e.removeAttribute(`tabindex`))
        }))
    }
    function vs(e, t, n = !0) {
      return e
        .filter((e) => e.parentId === t)
        .flatMap((t) => [...(!n || t.context?.open ? [t] : []), ...vs(e, t.id, n)])
    }
    function ys(e, t) {
      let n = [],
        r = e.find((e) => e.id === t)?.parentId
      for (; r;) {
        const t = e.find((e) => e.id === r)
        ;((r = t?.parentId), t && (n = n.concat(t)))
      }
      return n
    }
    function bs(e) {
      return `data-base-ui-${e}`
    }
    let xs = 0
    function Ss(e, t = {}) {
      const { preventScroll: n = !1, sync: r = !1, shouldFocus: i } = t
      cancelAnimationFrame(xs)
      function a() {
        ;(!i || i()) && e?.focus({ preventScroll: n })
      }
      if (r) return (a(), Pi)
      const o = requestAnimationFrame(a)
      return (
        (xs = o),
        () => {
          xs === o && (cancelAnimationFrame(o), (xs = 0))
        }
      )
    }
    const Cs = `data-base-ui-inert`
    let ws = /* @__PURE__ */ new WeakMap(),
      Ts = /* @__PURE__ */ new WeakSet(),
      Es = /* @__PURE__ */ new WeakMap(),
      Ds = 0
    function Os(e) {
      return e ? (Gi(e) ? e.host : Os(e.parentNode)) : null
    }
    const ks = (e, t) =>
        t
          .map((t) => {
            if (e.contains(t)) return t
            const n = Os(t)
            return e.contains(n) ? n : null
          })
          .filter((e) => e != null),
      As = (e) => {
        const t = /* @__PURE__ */ new Set()
        return (
          e.forEach((e) => {
            let n = e
            for (; n && !t.has(n);) (t.add(n), (n = n.parentNode))
          }),
          t
        )
      },
      js = (e, t, n) => {
        const r = [],
          i = (e) => {
            e &&
              !n.has(e) &&
              Array.from(e.children).forEach((e) => {
                zi(e) !== `script` && (t.has(e) ? i(e) : r.push(e))
              })
          }
        return (i(e), r)
      }
    function Ms(e, t, n, { mark: r = !0 }) {
      const i = ks(t, e),
        a = r ? js(t, As(i), new Set(i)) : [],
        o = [],
        s = []
      if (n) {
        const e = ks(t, Array.from(t.querySelectorAll(`[aria-live]`))),
          n = i.concat(e)
        js(t, As(n), new Set(n)).forEach((e) => {
          const t = e.getAttribute(`aria-hidden`),
            n = t !== null && t !== `false`,
            r = (ws.get(e) || 0) + 1
          ;(ws.set(e, r), o.push(e), r === 1 && n && Ts.add(e), n || e.setAttribute(`aria-hidden`, `true`))
        })
      }
      return (
        r &&
          a.forEach((e) => {
            const t = (Es.get(e) || 0) + 1
            ;(Es.set(e, t), s.push(e), t === 1 && e.setAttribute(Cs, ``))
          }),
        (Ds += 1),
        () => {
          ;(o.forEach((e) => {
            const t = (ws.get(e) || 0) - 1
            ;(ws.set(e, t), t || (Ts.has(e) || e.removeAttribute(`aria-hidden`), Ts.delete(e)))
          }),
            r &&
              s.forEach((e) => {
                const t = (Es.get(e) || 0) - 1
                ;(Es.set(e, t), t || e.removeAttribute(Cs))
              }),
            --Ds,
            Ds ||
              ((ws = /* @__PURE__ */ new WeakMap()),
              (Ts = /* @__PURE__ */ new WeakSet()),
              (Es = /* @__PURE__ */ new WeakMap())))
        }
      )
    }
    function Ns(e, t = {}) {
      const { ariaHidden: n = !1, mark: r = !0 } = t,
        i = ua(e[0]).body
      return Ms(e, i, n, { mark: r })
    }
    let Ps = 0
    function Fs(e, t = `mui`) {
      const n = l.useRef(void 0),
        r = fa(),
        i = e ?? n.current
      return (
        l.useEffect(() => {
          n.current ?? ((Ps += 1), (n.current = `${t}-${Ps}`), e ?? r())
        }, [e, t, r]),
        i
      )
    }
    const Is = li.useId
    function Ls(e, t) {
      if (Is !== void 0) {
        const n = Is()
        return e ?? (t ? `${t}-${n}` : n)
      }
      return Fs(e, t)
    }
    function Rs(e) {
      if (!(/*#__PURE__*/ l.isValidElement(e))) return null
      const t = e,
        n = t.props
      return (Ci(19) ? n?.ref : t.ref) ?? null
    }
    function zs(e, t) {
      if (e && !t) return e
      if (!e && t) return t
      if (e || t) return { ...e, ...t }
    }
    function Bs(e, t) {
      const n = {}
      for (const r in e) {
        const i = e[r]
        if (t?.hasOwnProperty(r)) {
          const e = t[r](i)
          e != null && Object.assign(n, e)
        } else i === !0 ? (n[`data-${r.toLowerCase()}`] = ``) : i && (n[`data-${r.toLowerCase()}`] = i.toString())
      }
      return n
    }
    function Vs(e, t) {
      return typeof e == `function` ? e(t) : e
    }
    function Hs(e, t) {
      return typeof e == `function` ? e(t) : e
    }
    const Us = {}
    function Ws(e, t, n, r, i) {
      if (!n && !r && !i && !e) return Ks(t)
      let a = Ks(e)
      return (t && (a = qs(a, t)), n && (a = qs(a, n)), r && (a = qs(a, r)), i && (a = qs(a, i)), a)
    }
    function Gs(e) {
      if (e.length === 0) return Us
      if (e.length === 1) return Ks(e[0])
      let t = Ks(e[0])
      for (let n = 1; n < e.length; n += 1) t = qs(t, e[n])
      return t
    }
    function Ks(e) {
      return Zs(e) ? { ...e(Us) } : Js(e)
    }
    function qs(e, t) {
      return Zs(t) ? t(e) : Ys(e, t)
    }
    function Js(e) {
      const t = { ...e }
      for (const e in t) {
        const n = t[e]
        Xs(e, n) && (t[e] = $s(n))
      }
      return t
    }
    function Ys(e, t) {
      if (!t) return e
      for (const n in t) {
        const r = t[n]
        switch (n) {
          case `style`:
            e[n] = zs(e.style, r)
            break
          case `className`:
            e[n] = tc(e.className, r)
            break
          default:
            e[n] = Xs(n, r) ? Qs(e[n], r) : r
        }
      }
      return e
    }
    function Xs(e, t) {
      const n = e.charCodeAt(0),
        r = e.charCodeAt(1),
        i = e.charCodeAt(2)
      return n === 111 && r === 110 && i >= 65 && i <= 90 && (typeof t == `function` || t === void 0)
    }
    function Zs(e) {
      return typeof e == `function`
    }
    function Qs(e, t) {
      return t
        ? e
          ? (...n) => {
              const r = n[0]
              if (nc(r)) {
                const i = r
                ec(i)
                const a = t(...n)
                return (i.baseUIHandlerPrevented || e?.(...n), a)
              }
              const i = t(...n)
              return (e?.(...n), i)
            }
          : $s(t)
        : e
    }
    function $s(e) {
      return (
        e &&
        ((...t) => {
          const n = t[0]
          return (nc(n) && ec(n), e(...t))
        })
      )
    }
    function ec(e) {
      return (
        (e.preventBaseUIHandler = () => {
          e.baseUIHandlerPrevented = !0
        }),
        e
      )
    }
    function tc(e, t) {
      return t ? (e ? `${t  } ${  e}` : t) : e
    }
    function nc(e) {
      return typeof e == `object` && !!e && `nativeEvent` in e
    }
    function rc(e, t, n = {}) {
      let r = t.render
      n.enabled !== !1 && (r = sc(r))
      const i = ic(t, n, r)
      if (n.enabled === !1) return null
      const a = n.state ?? Ii
      return cc(e, r, i, a)
    }
    function ic(e, t, n) {
      const { className: r, style: i } = e,
        { state: a = Ii, ref: o, props: s, stateAttributesMapping: c, enabled: l = !0 } = t,
        u = l ? Vs(r, a) : void 0,
        d = l ? Hs(i, a) : void 0,
        f = l ? Bs(a, c) : Ii,
        p = l && s ? ac(s) : void 0,
        m = l ? (zs(f, p) ?? {}) : Ii
      return (
        typeof document < `u` &&
          (l ? (m.ref = Array.isArray(o) ? ei([m.ref, Rs(n), ...o]) : $r(m.ref, Rs(n), o)) : $r(null, null)),
        l ? (u !== void 0 && (m.className = tc(m.className, u)), d !== void 0 && (m.style = zs(m.style, d)), m) : Ii
      )
    }
    function ac(e) {
      return Array.isArray(e) ? Gs(e) : Ws(void 0, e)
    }
    const oc = Symbol.for(`react.lazy`)
    function sc(e) {
      if (e?.$$typeof !== oc) return e
      const t = l.Children.toArray(e)[0]
      return /*#__PURE__*/ l.isValidElement(t) ? t : e
    }
    function cc(e, t, n, r) {
      if (t) {
        if (typeof t == `function`) return t(n, r)
        const e = Ws(n, t.props)
        return ((e.ref = n.ref), /*#__PURE__*/ l.cloneElement(t, e))
      }
      return lc(e, n)
    }
    function lc(e, t) {
      return e === `button`
        ? /*#__PURE__*/ (0, l.createElement)(`button`, { type: `button`, ...t, key: t.key })
        : e === `img`
          ? /*#__PURE__*/ (0, l.createElement)(`img`, { alt: ``, ...t, key: t.key })
          : /*#__PURE__*/ l.createElement(e, t)
    }
    const uc = { style: { transition: `none` } },
      dc = { fallbackAxisSide: `none` },
      fc = { clipPath: `inset(50%)`, position: `fixed`, top: 0, left: 0 },
      pc = /*#__PURE__*/ l.createContext(null),
      mc = () => l.useContext(pc),
      hc = bs(`portal`)
    function gc(e = {}) {
      const { ref: t, container: n, componentProps: r = Ii, elementProps: i } = e,
        a = Ls(),
        o = mc()?.portalNode,
        [s, c] = l.useState(null),
        [u, f] = l.useState(null),
        p = Q((e) => {
          e !== null && f(e)
        }),
        m = l.useRef(null)
      Z(() => {
        if (n === null) {
          m.current && ((m.current = null), f(null), c(null))
          return
        }
        const e = (n && (Hi(n) ? n : n.current)) ?? o ?? document.body
        e == null
          ? m.current && ((m.current = null), f(null), c(null))
          : m.current !== e && ((m.current = e), f(null), c(e))
      }, [n, o])
      const h = rc(`div`, r, { ref: [t, p], props: [{ id: a, [hc]: `` }, i] }),
        g = s && h ? /*#__PURE__*/ d.createPortal(h, s) : null
      return { node: u, nodeId: /*#__PURE__*/ l.isValidElement(h) ? h.props.id : void 0, subtree: g }
    }
    const _c = /*#__PURE__*/ l.forwardRef(function (e, t) {
      const { render: n, className: r, style: i, children: a, container: o, portalOwnerRole: s, ...c } = e,
        { node: f, nodeId: p, subtree: m } = gc({ container: o, ref: t, componentProps: e, elementProps: c }),
        h = l.useRef(null),
        g = l.useRef(null),
        _ = l.useRef(null),
        v = l.useRef(null),
        [y, b] = l.useState(null),
        x = l.useRef(!1),
        S = y?.modal,
        C = y?.open,
        w = !!y && !y.modal && y.open && !!f
      ;(l.useEffect(() => {
        if (!f || S) return
        function e(e) {
          f &&
            e.relatedTarget &&
            hs(e) &&
            (e.type === `focusin` ? (x.current &&= (_s(f), !1)) : (gs(f), (x.current = !0)))
        }
        return la(da(f, `focusin`, e, !0), da(f, `focusout`, e, !0))
      }, [f, S]),
        Z(() => {
          f && C === !0 && x.current && (_s(f), (x.current = !1))
        }, [C, f]))
      const T = l.useMemo(
        () => ({
          beforeOutsideRef: h,
          afterOutsideRef: g,
          beforeInsideRef: _,
          afterInsideRef: v,
          portalNode: f,
          setFocusManagerState: b,
        }),
        [f],
      )
      return /*#__PURE__*/ (0, u.jsxs)(l.Fragment, {
        children: [
          m,
          /*#__PURE__*/ (0, u.jsxs)(pc.Provider, {
            value: T,
            children: [
              w &&
                f &&
                /*#__PURE__*/ (0, u.jsx)(ho, {
                  "data-type": `outside`,
                  ref: h,
                  onFocus: (e) => {
                    hs(e, f) ? _.current?.focus() : ms(y ? y.domReference : null)?.focus()
                  },
                }),
              w && f && /*#__PURE__*/ (0, u.jsx)(`span`, { role: s, "aria-owns": p, style: fc }),
              f && /*#__PURE__*/ d.createPortal(a, f),
              w &&
                f &&
                /*#__PURE__*/ (0, u.jsx)(ho, {
                  "data-type": `outside`,
                  ref: g,
                  onFocus: (e) => {
                    hs(e, f)
                      ? v.current?.focus()
                      : (ps(y ? y.domReference : null)?.focus(),
                        y?.closeOnFocusOut && y?.onOpenChange(!1, co(`focus-out`, e.nativeEvent)))
                  },
                }),
            ],
          }),
        ],
      })
    })
    function vc() {
      const e = /* @__PURE__ */ new Map()
      return {
        emit(t, n) {
          e.get(t)?.forEach((e) => e(n))
        },
        on(t, n) {
          ;(e.has(t) || e.set(t, /* @__PURE__ */ new Set()), e.get(t).add(n))
        },
        off(t, n) {
          e.get(t)?.delete(n)
        },
      }
    }
    const yc = /*#__PURE__*/ l.createContext(null),
      bc = /*#__PURE__*/ l.createContext(null),
      xc = () => l.useContext(yc)?.id || null,
      Sc = (e) => {
        const t = l.useContext(bc)
        return e ?? t
      }
    function Cc(e) {
      return e == null ? e : `current` in e ? e.current : e
    }
    function wc(e, t) {
      const n = Bi(Va(e))
      return e instanceof n.KeyboardEvent
        ? `keyboard`
        : e instanceof n.FocusEvent
          ? t || `keyboard`
          : `pointerType` in e
            ? e.pointerType || (Fa(e) ? `keyboard` : t || `mouse`)
            : `touches` in e
              ? `touch`
              : e instanceof n.MouseEvent
                ? t || (e.detail === 0 ? `keyboard` : `mouse`)
                : ``
    }
    let Tc = []
    function Ec() {
      Tc = Tc.filter((e) => e.deref()?.isConnected)
    }
    function Dc(e) {
      ;(Ec(), e && zi(e) !== `body` && (Tc.push(new WeakRef(e)), Tc.length > 20 && (Tc = Tc.slice(-20))))
    }
    function Oc() {
      return (Ec(), Tc[Tc.length - 1]?.deref())
    }
    function kc(e) {
      return e ? (ls(e) ? e : ds(e)[0] || e) : null
    }
    function Ac(e) {
      if (
        (e.hasAttribute(`tabindex`) && !e.hasAttribute(`data-tabindex`)) ||
        !e.getAttribute(`role`)?.includes(`dialog`)
      )
        return
      const t = us(e).filter((e) => {
          let t = e.getAttribute(`data-tabindex`) || ``
          return ls(e) || (e.hasAttribute(`data-tabindex`) && !t.startsWith(`-`))
        }),
        n = e.getAttribute(`tabindex`)
      t.length === 0
        ? n !== `0` && (e.setAttribute(`tabindex`, `0`), e.setAttribute(`data-tabindex`, `0`))
        : (n !== `-1` || (e.hasAttribute(`data-tabindex`) && e.getAttribute(`data-tabindex`) !== `-1`)) &&
          (e.setAttribute(`tabindex`, `-1`), e.setAttribute(`data-tabindex`, `-1`))
    }
    function jc(e) {
      const {
          context: t,
          children: n,
          disabled: r = !1,
          initialFocus: i = !0,
          returnFocus: a = !0,
          explicitReturnFocus: o,
          restoreFocus: s = !1,
          modal: c = !0,
          closeOnFocusOut: d = !0,
          openInteractionType: f = ``,
          nextFocusableElement: p,
          previousFocusableElement: m,
          beforeContentFocusGuardRef: h,
          externalTree: g,
          getInsideElements: _,
        } = e,
        v = t.useState(`open`),
        y = t.useState(`domReferenceElement`),
        b = t.useState(`floatingElement`),
        { events: x, dataRef: S } = t.context,
        C = Q(() => S.current.floatingContext?.nodeId),
        w = i === !1,
        T = oo(y) && w,
        E = mi(i),
        D = mi(a),
        O = mi(o),
        k = mi(f),
        A = mi(v),
        j = Sc(g),
        M = mc(),
        N = l.useRef(!1),
        P = l.useRef(!1),
        F = l.useRef(!1),
        I = l.useRef(null),
        L = l.useRef(``),
        R = l.useRef(``),
        z = l.useRef(null),
        B = l.useRef(null),
        ee = $r(z, h, M?.beforeInsideRef),
        V = $r(B, M?.afterInsideRef),
        H = va(),
        U = va(),
        te = ga(),
        ne = M != null,
        W = so(b),
        re = Q((e = W) => (e ? ds(e) : [])),
        G = Q(() => _?.().filter((e) => e != null) ?? [])
      ;(l.useEffect(() => {
        if (r || !c) return
        function e(e) {
          e.key === `Tab` && $(W, za(ua(W))) && re().length === 0 && !T && Na(e)
        }
        return da(ua(W), `keydown`, e)
      }, [r, W, c, T, re]),
        l.useEffect(() => {
          if (r || !v) return
          const e = ua(W)
          function t() {
            F.current = !1
          }
          function n(e) {
            const t = Va(e),
              n = G(),
              r = $(b, t) || $(y, t) || $(M?.portalNode, t) || n.some((e) => e === t || $(e, t))
            ;((F.current = !r),
              (R.current = e.pointerType || `keyboard`),
              Ba(t, `[data-base-ui-click-trigger]`) &&
                ((P.current = !0),
                U.start(0, () => {
                  P.current = !1
                })))
          }
          function i() {
            R.current = `keyboard`
          }
          return la(
            da(e, `pointerdown`, n, !0),
            da(e, `pointerup`, t, !0),
            da(e, `pointercancel`, t, !0),
            da(e, `keydown`, i, !0),
            t,
          )
        }, [r, b, y, W, v, M, U, G]),
        l.useEffect(() => {
          if (r || !d) return
          const e = ua(W)
          function n() {
            ;((P.current = !0),
              U.start(0, () => {
                P.current = !1
              }))
          }
          function i(e) {
            const t = Va(e)
            ls(t) && (I.current = t)
          }
          function a(n) {
            const r = n.relatedTarget,
              i = n.currentTarget,
              a = Va(n)
            ;(c && r == null && a != null && $(b, a) && Dc(a),
              queueMicrotask(() => {
                const o = C(),
                  l = t.context.triggerElements,
                  u = G(),
                  d =
                    r?.hasAttribute(bs(`focus-guard`)) &&
                    [
                      z.current,
                      B.current,
                      M?.beforeInsideRef.current,
                      M?.afterInsideRef.current,
                      M?.beforeOutsideRef.current,
                      M?.afterOutsideRef.current,
                      Cc(m),
                      Cc(p),
                    ].includes(r),
                  f = !(
                    $(y, r) ||
                    $(b, r) ||
                    $(r, b) ||
                    $(M?.portalNode, r) ||
                    u.some((e) => e === r || $(e, r)) ||
                    l.hasMatchingElement((e) => $(e, r)) ||
                    d ||
                    (j &&
                      (vs(j.nodesRef.current, o).find(
                        (e) => $(e.context?.elements.floating, r) || $(e.context?.elements.domReference, r),
                      ) ||
                        ys(j.nodesRef.current, o).find(
                          (e) =>
                            [e.context?.elements.floating, so(e.context?.elements.floating)].includes(r) ||
                            e.context?.elements.domReference === r,
                        )))
                  )
                if ((i === y && W && Ac(W), s && i !== y && !Xo(a) && za(e) === e.body)) {
                  if (Wi(W) && (W.focus(), s === `popup`)) {
                    te.request(() => {
                      W.focus()
                    })
                    return
                  }
                  const e = re(),
                    t = I.current,
                    n = (t && e.includes(t) ? t : null) || e[e.length - 1] || W
                  Wi(n) && n.focus()
                }
                S.current.insideReactTree
                  ? (S.current.insideReactTree = !1)
                  : (T || !c) &&
                    r &&
                    f &&
                    !P.current &&
                    (T || r !== Oc()) &&
                    ((N.current = !0), t.setOpen(!1, co(po, n)))
              }))
          }
          function o() {
            F.current ||
              ((S.current.insideReactTree = !0),
              H.start(0, () => {
                S.current.insideReactTree = !1
              }))
          }
          const l = Wi(y) ? y : null
          if (b || l)
            return la(
              l && da(l, `focusout`, a),
              l && da(l, `pointerdown`, n),
              b && da(b, `focusin`, i),
              b && da(b, `focusout`, a),
              b && M && da(b, `focusout`, o, !0),
            )
        }, [r, y, b, W, c, j, M, t, d, s, re, T, C, S, H, U, te, p, m, G]),
        l.useEffect(() => {
          if (r || !b || !v) return
          const e = Array.from(M?.portalNode?.querySelectorAll(`[${bs(`portal`)}]`) || []),
            t = (j ? ys(j.nodesRef.current, C()) : []).find((e) => oo(e.context?.elements.domReference || null))
              ?.context?.elements.domReference,
            n = Ns(
              [
                b,
                ...e,
                z.current,
                B.current,
                M?.beforeOutsideRef.current,
                M?.afterOutsideRef.current,
                ...G(),
                t,
                Cc(m),
                Cc(p),
                T ? y : null,
              ].filter((e) => e != null),
              { ariaHidden: c || T, mark: !1 },
            ),
            i = Ns([b, ...e].filter((e) => e != null))
          return () => {
            ;(i(), n())
          }
        }, [v, r, y, b, c, M, T, j, C, p, m, G]),
        Z(() => {
          if (!v || r || !Wi(W)) return
          ;((L.current = ``), (R.current = ``))
          const e = ua(W),
            t = za(e)
          queueMicrotask(() => {
            const n = E.current,
              r = typeof n == `function` ? n(k.current || ``) : n
            if (r === void 0 || r === !1 || $(W, t)) return
            let i = null,
              a = () => ((i ??= re(W)), i[0] || W),
              o
            ;((o = r === !0 || r === null ? a() : Cc(r)), (o ||= a()))
            const s = $(W, za(e)),
              c = S.current.openEvent,
              l = c?.type === `mousedown` && Fa(c)
            Ss(o, {
              sync: l,
              preventScroll: o === W,
              shouldFocus() {
                if (!A.current) return !1
                if (s) return !0
                const t = za(e)
                return !(t !== o && $(W, t))
              },
            })
          })
        }, [r, v, W, re, E, k, A, S]))
      const ie = l.useRef(null)
      ;(Z(() => {
        if (r || !W) {
          ie.current = null
          return
        }
        ie.current &&= ((ie.current.cancelled = !0), null)
        const e = ua(W),
          t = za(e),
          n = k.current == null
        Dc(t)
        function i(e) {
          if (
            (e.open || (L.current = wc(e.nativeEvent, R.current)),
            ((e.reason === `focus-out` && e.triggerElement?.hasAttribute(bs(`focus-guard`))) ||
              (e.reason === `trigger-hover` && e.nativeEvent.type === `mouseleave`)) &&
              (N.current = !0),
            e.reason === `outside-press`)
          ) {
            if (e.nested) N.current = !1
            else if (Fa(e.nativeEvent) || Ia(e.nativeEvent)) N.current = !1
            else {
              let e = !1
              ;(ua(W)
                .createElement(`div`)
                .focus({
                  get preventScroll() {
                    return ((e = !0), !1)
                  },
                }),
                e ? (N.current = !1) : (N.current = !0))
            }
          }
        }
        x.on(`openchange`, i)
        function a(e) {
          let r = D.current,
            i = typeof r == `function` ? r(e) : r
          if (i === void 0 || i === !1) return null
          i === null && (i = !0)
          let a = y?.isConnected ? y : null,
            o = t?.isConnected && zi(t) !== `body` ? t : null,
            s = n ? o || a : a || o
          return ((s ||= Oc() || null), typeof i == `boolean` ? s : Cc(i) || s || null)
        }
        return () => {
          x.off(`openchange`, i)
          const t = za(e),
            n = G(),
            r =
              $(b, t) ||
              n.some((e) => e === t || $(e, t)) ||
              (j && vs(j.nodesRef.current, C(), !1).some((e) => $(e.context?.elements.floating, t))),
            o = D.current,
            s = L.current,
            c = a(s),
            l = { cancelled: !1 }
          ;((ie.current = l),
            queueMicrotask(() => {
              ie.current === l && (ie.current = null)
              const n = kc(c),
                i = O.current ?? typeof o != `boolean`
              if (!l.cancelled && o && !N.current && Wi(n) && (i || n === t || t === e.body || r)) {
                const e = { preventScroll: !0 }
                ;(s === `keyboard` && (e.focusVisible = !0), n.focus(e))
              }
              N.current = !1
            }))
        }
      }, [r, b, W, D, O, k, x, j, y, C, G]),
        Z(() => {
          if (!Aa || v || !b) return
          const e = za(ua(b))
          Wi(e) && ao(e) && $(b, e) && e.blur()
        }, [v, b]),
        Z(() => {
          if (!r && M)
            return (
              M.setFocusManagerState({
                modal: c,
                closeOnFocusOut: d,
                open: v,
                onOpenChange: t.setOpen,
                domReference: y,
              }),
              () => {
                M.setFocusManagerState(null)
              }
            )
        }, [r, M, c, v, t, d, y]),
        Z(() => {
          if (!r && W)
            return (
              Ac(W),
              () => {
                queueMicrotask(Ec)
              }
            )
        }, [r, W]))
      const K = !r && (!c || !T) && (ne || c)
      return /*#__PURE__*/ (0, u.jsxs)(l.Fragment, {
        children: [
          K &&
            /*#__PURE__*/ (0, u.jsx)(ho, {
              "data-type": `inside`,
              ref: ee,
              onFocus: (e) => {
                if (c) {
                  const e = re()
                  Ss(e[e.length - 1])
                } else
                  M?.portalNode &&
                    ((N.current = !1), hs(e, M.portalNode) ? ps(y)?.focus() : Cc(m ?? M.beforeOutsideRef)?.focus())
              },
            }),
          n,
          K &&
            /*#__PURE__*/ (0, u.jsx)(ho, {
              "data-type": `inside`,
              ref: V,
              onFocus: (e) => {
                c
                  ? Ss(re()[0])
                  : M?.portalNode &&
                    (d && (N.current = !0), hs(e, M.portalNode) ? ms(y)?.focus() : Cc(p ?? M.afterOutsideRef)?.focus())
              },
            }),
        ],
      })
    }
    function Mc(e, t = {}) {
      const {
          enabled: n = !0,
          event: r = `click`,
          toggle: i = !0,
          ignoreMouse: a = !1,
          stickIfOpen: o = !0,
          touchOpenDelay: s = 0,
          reason: c = uo,
        } = t,
        u = e.context.dataRef,
        d = l.useRef(void 0),
        f = ga(),
        p = va(),
        m = l.useMemo(() => {
          function t(t, n, r, i) {
            let a = co(c, n, r)
            t && i === `touch` && s > 0
              ? p.start(s, () => {
                  e.setOpen(!0, a)
                })
              : e.setOpen(t, a)
          }
          function n(t, n, r) {
            let a = u.current.openEvent,
              s = e.select(`domReferenceElement`) !== n
            return (t && s) || !t || !i ? !0 : a && (typeof o == `function` ? o() : o) ? !r(a.type) : !1
          }
          return {
            onPointerDown(e) {
              d.current = La(e.pointerType, !0) && Ia(e.nativeEvent) ? `virtual` : e.pointerType
            },
            onMouseDown(i) {
              let o = d.current,
                s = i.nativeEvent,
                c = e.select(`open`)
              if (i.button !== 0 || r === `click` || (La(o, !0) && a)) return
              let l = n(c, i.currentTarget, (e) => e === `click` || e === `mousedown`),
                u = Va(s),
                p = ao(u)
              if (p || o === `virtual`) {
                t(l, s, p ? u : i.currentTarget, o)
                return
              }
              let m = i.currentTarget
              f.request(() => {
                t(l, s, m, o)
              })
            },
            onClick(i) {
              if (r === `mousedown-only`) return
              let o = d.current
              r === `mousedown` && o
                ? (d.current = void 0)
                : (La(o, !0) && a) ||
                  t(
                    n(
                      e.select(`open`),
                      i.currentTarget,
                      (e) => e === `click` || e === `mousedown` || e === `keydown` || e === `keyup`,
                    ),
                    i.nativeEvent,
                    i.currentTarget,
                    o,
                  )
            },
            onKeyDown() {
              d.current = void 0
            },
          }
        }, [u, r, a, c, e, o, i, f, p, s])
      return l.useMemo(() => (n ? { reference: m } : Ii), [n, m])
    }
    function Nc() {
      return !1
    }
    function Pc(e) {
      return {
        escapeKey: typeof e == `boolean` ? e : (e?.escapeKey ?? !1),
        outsidePress: typeof e == `boolean` ? e : (e?.outsidePress ?? !0),
      }
    }
    function Fc(e, t = {}) {
      const {
          enabled: n = !0,
          escapeKey: r = !0,
          outsidePress: i = !0,
          outsidePressEvent: a = `sloppy`,
          referencePress: o = Nc,
          bubbles: s,
          externalTree: c,
        } = t,
        u = e.useState(`open`),
        d = e.useState(`floatingElement`),
        { dataRef: f, events: p } = e.context,
        m = Sc(c),
        h = Q(typeof i == `function` ? i : () => !1),
        g = typeof i == `function` ? h : i,
        _ = g !== !1,
        v = Q(() => a),
        { escapeKey: y, outsidePress: b } = Pc(s),
        x = l.useRef(!1),
        S = l.useRef(!1),
        C = l.useRef(!1),
        w = l.useRef(!1),
        T = l.useRef(!1),
        E = l.useRef(``),
        D = l.useRef(null),
        O = va(),
        k = va(),
        A = va(),
        j = Q(() => {
          ;(k.clear(), (f.current.insideReactTree = !1))
        }),
        M = Q((e) => {
          let t = f.current.floatingContext?.nodeId
          return (m ? vs(m.nodesRef.current, t) : []).some((t) => t.context?.open && !t.context.dataRef.current[e])
        }),
        N = Q((t) => ro(t, e.select(`floatingElement`)) || ro(t, e.select(`domReferenceElement`))),
        P = Q((t) => {
          o() && e.setOpen(!1, co(uo, t.nativeEvent))
        }),
        F = Q((t) => {
          if (!u || !n || !r || t.key !== `Escape`) return
          let i = Pa(t) ? t.nativeEvent : t
          if (T.current || i.isComposing || (!y && M(`__escapeKeyBubbles`))) return
          let a = co(`escape-key`, i)
          ;(e.setOpen(!1, a), a.isCanceled || t.preventDefault(), !y && !a.isPropagationAllowed && t.stopPropagation())
        }),
        I = Q(() => {
          ;((f.current.insideReactTree = !0), k.start(0, j))
        }),
        L = Q((t) => {
          if (!u || !n || t.button !== 0) return
          let r = Va(t.nativeEvent)
          $(e.select(`floatingElement`), r) && (x.current || ((x.current = !0), (S.current = !1)))
        }),
        R = Q((e) => {
          u && n && (e.defaultPrevented || e.nativeEvent.defaultPrevented) && x.current && (S.current = !0)
        })
      ;(l.useEffect(() => {
        function e(e) {
          e.open || (w.current = !1)
        }
        return (
          p.on(`openchange`, e),
          () => {
            p.off(`openchange`, e)
          }
        )
      }, [p]),
        l.useEffect(() => j, [j]),
        l.useEffect(() => {
          if (!u || !n) return (u || ((w.current = !1), (T.current = !1), (E.current = ``), (D.current = null)), j)
          ;((f.current.__escapeKeyBubbles = y), (f.current.__outsidePressBubbles = b))
          const t = new _a(),
            i = ua(d)
          function a() {
            ;(A.clear(), (T.current = !0))
          }
          function o() {
            ;((T.current = !0),
              A.start(Aa ? 5 : 0, () => {
                T.current = !1
              }))
          }
          function s() {
            ;((C.current = !0),
              t.start(0, () => {
                C.current = !1
              }))
          }
          function c() {
            ;((x.current = !1), (S.current = !1))
          }
          function l() {
            const e = E.current,
              t = e === `pen` || !e ? `mouse` : e,
              n = v(),
              r = typeof n == `function` ? n() : n
            return typeof r == `string` ? r : r[t]
          }
          function p(e) {
            const t = l()
            return (t === `intentional` && e.type !== `click`) || (t === `sloppy` && e.type === `click`)
          }
          function h(e) {
            const t = f.current.floatingContext?.nodeId,
              n = m && vs(m.nodesRef.current, t).some((t) => ro(e, t.context?.elements.floating))
            return N(e) || n
          }
          function k(n) {
            if (p(n)) {
              ;(n.type !== `click` && !N(n) && (t.clear(), (C.current = !1)), j())
              return
            }
            if (f.current.insideReactTree) {
              j()
              return
            }
            const r = Va(n),
              i = `[${bs(`inert`)}]`,
              a = Ui(r) ? r.getRootNode() : null,
              o = Array.from((Gi(a) ? a : ua(e.select(`floatingElement`))).querySelectorAll(i)),
              s = e.context.triggerElements
            if (r && (s.hasElement(r) || s.hasMatchingElement((e) => $(e, r)))) return
            let c = Ui(r) ? r : null
            for (; c && !na(c);) {
              const e = aa(c)
              if (na(e) || !Ui(e)) break
              c = e
            }
            if (!(o.length && Ui(r) && !io(r) && !$(r, e.select(`floatingElement`)) && o.every((e) => !$(c, e)))) {
              if (Wi(r) && !(`touches` in n)) {
                const e = na(r),
                  t = ra(r),
                  i = /auto|scroll/,
                  a = e || i.test(t.overflowX),
                  o = e || i.test(t.overflowY),
                  s = a && r.clientWidth > 0 && r.scrollWidth > r.clientWidth,
                  c = o && r.clientHeight > 0 && r.scrollHeight > r.clientHeight,
                  l = t.direction === `rtl`,
                  u = c && (l ? n.offsetX <= r.offsetWidth - r.clientWidth : n.offsetX > r.clientWidth),
                  d = s && n.offsetY > r.clientHeight
                if (u || d) return
              }
              if (!h(n)) {
                if (l() === `intentional`) {
                  if (n.detail !== 0 && !Fa(n) && !w.current) return
                  if (C.current) {
                    ;(t.clear(), (C.current = !1))
                    return
                  }
                }
                ;(typeof g != `function` || g(n)) &&
                  (M(`__outsidePressBubbles`) || (e.setOpen(!1, co(`outside-press`, n)), j()))
              }
            }
          }
          function P(t) {
            l() === `sloppy` && t.pointerType !== `touch` && e.select(`open`) && n && !N(t) && k(t)
          }
          function I(t) {
            if (l() !== `sloppy` || !e.select(`open`) || !n || N(t)) return
            const r = t.touches[0]
            r &&
              ((D.current = {
                startTime: Date.now(),
                startX: r.clientX,
                startY: r.clientY,
                dismissOnTouchEnd: !1,
                dismissOnMouseDown: !0,
              }),
              O.start(1e3, () => {
                D.current && ((D.current.dismissOnTouchEnd = !1), (D.current.dismissOnMouseDown = !1))
              }))
          }
          function L(e, t) {
            const n = Va(e)
            if (!n) return
            const r = da(n, e.type, () => {
              ;(t(e), r())
            })
          }
          function R(e) {
            ;((E.current = `touch`), L(e, I))
          }
          function z(e) {
            ;(O.clear(),
              e.type === `pointerdown` && (e.button === 0 && (w.current = !0), (E.current = e.pointerType)),
              (e.type !== `mousedown` || !D.current || D.current.dismissOnMouseDown) &&
                L(e, (e) => {
                  e.type === `pointerdown` ? P(e) : k(e)
                }))
          }
          function B(e) {
            if ((e.type === `pointercancel` && (w.current = !1), !x.current)) return
            const n = S.current
            ;(c(),
              l() === `intentional` &&
                (e.type === `pointercancel`
                  ? n && s()
                  : h(e) || (n ? s() : (typeof g != `function` || g(e)) && (t.clear(), (C.current = !0), j()))))
          }
          function ee(e) {
            if (l() !== `sloppy` || !D.current || N(e)) return
            const t = e.touches[0]
            if (!t) return
            const n = Math.abs(t.clientX - D.current.startX),
              r = Math.abs(t.clientY - D.current.startY),
              i = Math.sqrt(n * n + r * r)
            ;(i > 5 && (D.current.dismissOnTouchEnd = !0), i > 10 && (k(e), O.clear(), (D.current = null)))
          }
          function V(e) {
            L(e, ee)
          }
          function H(e) {
            l() === `sloppy` &&
              D.current &&
              !N(e) &&
              (D.current.dismissOnTouchEnd && k(e), O.clear(), (D.current = null))
          }
          function U(e) {
            L(e, H)
          }
          const te = la(
            r && la(da(i, `keydown`, F), da(i, `compositionstart`, a), da(i, `compositionend`, o)),
            _ &&
              la(
                da(i, `click`, z, !0),
                da(i, `pointerdown`, z, !0),
                da(i, `pointerup`, B, !0),
                da(i, `pointercancel`, B, !0),
                da(i, `mousedown`, z, !0),
                da(i, `mouseup`, B, !0),
                da(i, `touchstart`, R, { capture: !0, passive: !0 }),
                da(i, `touchmove`, V, { capture: !0, passive: !0 }),
                da(i, `touchend`, U, { capture: !0, passive: !0 }),
              ),
          )
          return () => {
            ;(te(), t.clear(), c(), (C.current = !1))
          }
        }, [f, d, r, _, g, u, n, y, b, F, j, v, M, N, m, e, O, A]))
      const z = l.useMemo(() => ({ onKeyDown: F, onPointerDown: P, onClick: P }), [F, P]),
        B = l.useMemo(
          () => ({
            onKeyDown: F,
            onPointerDown: R,
            onMouseDown: R,
            onClickCapture: I,
            onMouseDownCapture(e) {
              ;(I(), L(e))
            },
            onPointerDownCapture(e) {
              ;(I(), L(e))
            },
            onMouseUpCapture: I,
            onTouchEndCapture: I,
            onTouchMoveCapture: I,
          }),
          [F, I, L, R],
        )
      return l.useMemo(() => (n ? { reference: z, floating: B, trigger: z } : {}), [n, z, B])
    }
    function Ic(e, t = !1, n = !1, r = !1) {
      const [i, a] = l.useState(e && t ? `idle` : void 0),
        [o, s] = l.useState(e && !r)
      return (
        e && !o && (s(!0), a(`starting`)),
        !e && o && i !== `ending` && !n && a(`ending`),
        !e && !o && i === `ending` && a(void 0),
        Z(() => {
          if (!e && o && i !== `ending` && n) {
            const e = ha.request(() => {
              a(`ending`)
            })
            return () => {
              ha.cancel(e)
            }
          }
        }, [e, o, i, n]),
        Z(() => {
          if (!e || t || i === void 0) return
          const n = ha.request(() => {
            a(void 0)
          })
          return () => {
            ha.cancel(n)
          }
        }, [t, e, i]),
        Z(() => {
          if (!e || !t) return
          e && o && i !== `idle` && a(`starting`)
          const n = ha.request(() => {
            a(`idle`)
          })
          return () => {
            ha.cancel(n)
          }
        }, [t, e, o, i]),
        { mounted: o, setMounted: s, transitionStatus: i }
      )
    }
    function Lc(e, t) {
      return e.getAnimations(t).filter((e) => {
        const t = e.effect?.getTiming()
        return t?.duration !== 1 / 0 && t?.iterations !== 1 / 0
      })
    }
    let Rc = null
    function zc(e) {
      if (!Rc) {
        const e = []
        ;((Rc = e),
          queueMicrotask(() => {
            ;((Rc = null),
              d.flushSync(() => {
                for (const t of e) t()
              }))
          }))
      }
      Rc.push(e)
    }
    function Bc(e, t = !1, n = !1) {
      const r = ga()
      return Q((i, a = null) => {
        r.cancel()
        const o = Cc(e)
        if (o == null) return
        const s = o,
          c = () => {
            n
              ? zc(() => {
                  a?.aborted || i()
                })
              : d.flushSync(i)
          }
        if (typeof s.getAnimations != `function` || globalThis.BASE_UI_ANIMATIONS_DISABLED) {
          i()
          return
        }
        function l() {
          Promise.all(Lc(s).map((e) => e.finished.then(Pi))).then(
            () => {
              a?.aborted || c()
            },
            () => {
              a?.aborted || (Lc(s).some((e) => e.pending || e.playState !== `finished`) ? l() : c())
            },
          )
        }
        if (t) {
          const e = Wa
          if (!s.hasAttribute(e)) {
            r.request(l)
            return
          }
          const t = new MutationObserver(() => {
            s.hasAttribute(e) || (t.disconnect(), l())
          })
          ;(t.observe(s, { attributes: !0, attributeFilter: [e] }),
            a?.addEventListener(`abort`, () => t.disconnect(), { once: !0 }))
        } else r.request(l)
      })
    }
    function Vc(e) {
      const { enabled: t = !0, open: n, ref: r, batch: i = !1, onComplete: a } = e,
        o = Q(a),
        s = Bc(r, n, i)
      l.useEffect(() => {
        if (!t) return
        const e = new AbortController()
        return (
          s(o, e.signal),
          () => {
            e.abort()
          }
        )
      }, [t, n, o, s])
    }
    function Hc(e) {
      const {
          open: t,
          ref: n,
          preventUnmountOnClose: r,
          setPreventUnmountOnClose: i,
          onUnmount: a,
          animateInitialOpen: o,
        } = e,
        s = Q(i),
        { mounted: c, setMounted: u, transitionStatus: d } = Ic(t, !1, !1, o),
        f = !t && r
      Z(() => {
        t && s(!1)
      }, [t, s])
      const p = l.useRef(c),
        m = l.useRef(!1),
        h = fa(),
        g = () => {
          ;((p.current = !1), u(!1), a())
        }
      Z(() => {
        ;((p.current = c), m.current && ((m.current = !1), !t && c && g()))
      })
      const _ = Q(() => {
        p.current && (t ? ((m.current = !0), h()) : g())
      })
      return (
        Vc({
          enabled: c && !t && !f,
          open: t,
          ref: n,
          onComplete() {
            t || _()
          },
        }),
        { mounted: c, transitionStatus: d, preventUnmountingOnClose: f, forceUnmount: _ }
      )
    }
    const Uc = { tabIndex: -1, "data-base-ui-focusable": `` }
    function Wc(e) {
      let t = !1
      return (
        (e.preventUnmountOnClose = () => {
          t = !0
        }),
        () => t
      )
    }
    const Gc = class {
      idMap = /* @__PURE__ */ new Map()
      add(e, t) {
        this.idMap.set(e, t)
      }
      delete(e) {
        this.idMap.delete(e)
      }
      hasElement(e) {
        for (let t of this.idMap.values()) if (t === e) return !0
        return !1
      }
      hasMatchingElement(e) {
        for (let t of this.idMap.values()) if (e(t)) return !0
        return !1
      }
      getById(e) {
        return this.idMap.get(e)
      }
      entries() {
        return this.idMap.entries()
      }
      elements() {
        return this.idMap.values()
      }
      get size() {
        return this.idMap.size
      }
    }
    const Kc = {
      open: (e) => e.open,
      transitionStatus: (e) => e.transitionStatus,
      domReferenceElement: (e) => e.domReferenceElement,
      referenceElement: (e) => e.positionReference ?? e.referenceElement,
      floatingElement: (e) => e.floatingElement,
      floatingId: (e) => e.floatingId,
    }
    const qc = class extends Li {
      constructor(e) {
        let { syncOnly: t, nested: n, onOpenChange: r, triggerElements: i, ...a } = e
        ;(super(
          { ...a, positionReference: a.referenceElement, domReferenceElement: a.referenceElement },
          { onOpenChange: r, dataRef: { current: {} }, events: vc(), nested: n, triggerElements: i },
          Kc,
        ),
          (this.syncOnly = t))
      }
      syncOpenEvent = (e, t) => {
        ;(!e || !this.state.open || (t != null && Ra(t))) && (this.context.dataRef.current.openEvent = e ? t : void 0)
      }
      dispatchOpenChange = (e, t) => {
        this.syncOpenEvent(e, t.event)
        let n = {
          open: e,
          reason: t.reason,
          nativeEvent: t.event,
          nested: this.context.nested,
          triggerElement: t.trigger,
        }
        this.context.events.emit(`openchange`, n)
      }
      setOpen = (e, t) => {
        ;(this.syncOnly || this.dispatchOpenChange(e, t), this.context.onOpenChange?.(e, t))
      }
    }
    function Jc(e) {
      const { open: t = !1, onOpenChange: n, elements: r = {} } = e,
        i = Ls(),
        a = xc() != null,
        o = Qr(
          () =>
            new qc({
              open: t,
              transitionStatus: void 0,
              onOpenChange: n,
              referenceElement: r.reference ?? null,
              floatingElement: r.floating ?? null,
              triggerElements: new Gc(),
              floatingId: i,
              syncOnly: !1,
              nested: a,
            }),
        ).current
      return (
        Z(() => {
          const e = { open: t, floatingId: i }
          ;(r.reference !== void 0 &&
            ((e.referenceElement = r.reference), (e.domReferenceElement = Ui(r.reference) ? r.reference : null)),
            r.floating !== void 0 && (e.floatingElement = r.floating),
            o.update(e))
        }, [t, i, r.reference, r.floating, o]),
        (o.context.onOpenChange = n),
        (o.context.nested = a),
        o
      )
    }
    function Yc(e) {
      return Aa && e.movementX === 0 && e.movementY === 0
    }
    function Xc(e, t, n) {
      switch (e) {
        case `vertical`:
          return t
        case `horizontal`:
          return n
        default:
          return t || n
      }
    }
    function Zc(e, t) {
      return Xc(t, e === `ArrowUp` || e === `ArrowDown`, e === `ArrowLeft` || e === `ArrowRight`)
    }
    function Qc(e, t, n) {
      return (
        Xc(t, e === `ArrowDown`, n ? e === `ArrowLeft` : e === `ArrowRight`) || e === `Enter` || e === ` ` || e === ``
      )
    }
    function $c(e, t, n) {
      return Xc(t, n ? e === Ha : e === Ua, e === `ArrowDown`)
    }
    function el(e, t, n, r) {
      return t === `both` || (t === `horizontal` && r)
        ? e === `Escape`
        : Xc(t, n ? e === Ua : e === Ha, e === `ArrowUp`)
    }
    function tl(e, t) {
      const {
          listRef: n,
          activeIndex: r,
          onNavigate: i = () => {},
          enabled: a = !0,
          selectedIndex: o = null,
          allowEscape: s = !1,
          loopFocus: c = !1,
          nested: u = !1,
          rtl: d = !1,
          virtual: f = !1,
          focusItemOnOpen: p = `auto`,
          focusItemOnHover: m = !0,
          openOnArrowKeyDown: h = !0,
          disabledIndices: g = void 0,
          orientation: _ = `vertical`,
          triggerOrientation: v = _,
          parentOrientation: y,
          id: b,
          resetOnPointerLeave: x = !0,
          externalTree: S,
          nestedReturnFocusRef: C,
          grid: w,
        } = t,
        T = w != null,
        E = e.useState(`open`),
        D = e.useState(`floatingElement`),
        O = e.useState(`domReferenceElement`),
        k = e.context.dataRef,
        A = so(D),
        j = oo(O),
        M = mi(A),
        N = xc(),
        P = Sc(S),
        F = l.useRef(p),
        I = l.useRef(o ?? -1),
        L = l.useRef(null),
        R = l.useRef(!0),
        z = Q((e) => {
          i(I.current === -1 ? null : I.current, e)
        }),
        B = l.useRef(!!D),
        ee = l.useRef(E),
        V = l.useRef(!1),
        H = l.useRef(!1),
        U = l.useRef(null),
        te = mi(g),
        ne = mi(E),
        W = mi(o),
        re = mi(x),
        G = ga(),
        ie = ga(),
        K = Q(() => {
          G.cancel()
          function e(e) {
            f || (U.current = Ss(e, { sync: V.current, preventScroll: !0 }))
          }
          let t = n.current[I.current],
            r = H.current
          ;(t && e(t),
            (V.current ? (e) => e() : (e) => G.request(e))(() => {
              let i = n.current[I.current] || t
              i && (t || e(i), le && (r || !R.current) && i.scrollIntoView?.({ block: `nearest`, inline: `nearest` }))
            }))
        })
      ;(Z(() => {
        k.current.orientation = _
      }, [k, _]),
        Z(() => {
          ;(E || (L.current = null), (!E || p !== `auto`) && (F.current = p))
        }, [E, p]),
        Z(() => {
          a &&
            (E && D
              ? ((I.current = o ?? -1), F.current && o != null && ((H.current = !0), z()))
              : B.current && ((I.current = -1), z()))
        }, [a, E, D, o, z]),
        Z(() => {
          if (a) {
            if (!E) V.current = !1
            else if (D) {
              if (r == null) {
                if (((V.current = !1), W.current != null)) return
                if (
                  (B.current && ((I.current = -1), K()),
                  (!ee.current || !B.current) &&
                    F.current &&
                    (L.current != null || (F.current === !0 && L.current == null)))
                ) {
                  const e = 0,
                    t = () => {
                      n.current[0] == null
                        ? (e < 2 && (e ? (e) => ie.request(e) : queueMicrotask)(t), (e += 1))
                        : ((I.current = L.current == null || Qc(L.current, v, d) || u ? Wo(n) : Go(n)),
                          (L.current = null),
                          z())
                    }
                  t()
                }
              } else Uo(n.current, r) || ((I.current = r), K(), (H.current = !1))
            }
          }
        }, [a, E, D, r, W, u, n, v, d, z, K, ie]),
        Z(() => {
          if (!a || D || !P || f || !B.current) return
          const e = P.nodesRef.current,
            t = e.find((e) => e.id === N)?.context?.elements.floating,
            n = za(ua(O ?? t ?? null)),
            r = e.some((e) => e.context && $(e.context.elements.floating, n))
          t && !r && R.current && t.focus({ preventScroll: !0 })
        }, [a, D, O, P, N, f]),
        Z(() => {
          ;((ee.current = E), (B.current = !!D))
        }))
      const q = r != null,
        ae = Q((e) => {
          if (!ne.current) return
          let t = n.current.indexOf(e.currentTarget)
          t !== -1 && (I.current !== t || r !== t) && ((I.current = t), z(e))
        }),
        oe = Q(() => y ?? P?.nodesRef.current.find((e) => e.id === N)?.context?.dataRef?.current.orientation),
        se = Q(() => Wo(n, te.current)),
        ce = Q((t) => {
          if (((R.current = !1), (V.current = !0), t.which === 229 || (!ne.current && t.currentTarget === M.current)))
            return
          if (u && el(t.key, _, d, T)) {
            ;(Zc(t.key, oe()) || Na(t), e.setOpen(!1, co(mo, t.nativeEvent)))
            let n = C?.current ?? O
            Wi(n) && n.focus()
            return
          }
          r != null && r !== I.current && !Uo(n.current, r) && (I.current = r)
          let i = I.current,
            a = Wo(n, g),
            o = Go(n, g)
          if (
            (j ||
              (t.key === `Home` && (Na(t), (I.current = a), z(t)), t.key === `End` && (Na(t), (I.current = o), z(t))),
            w != null)
          ) {
            let e = w(t, I.current, n, _, c, d, g, a, o)
            if ((e != null && e !== I.current && ((I.current = e), z(t)), _ === `both`)) return
          }
          if (Zc(t.key, _)) {
            Na(t)
            let e = za(t.currentTarget.ownerDocument)
            if (E && !f && $(t.currentTarget, e) && !n.current.some((t) => t != null && $(t, e))) {
              ;((I.current = Qc(t.key, _, d) ? a : o), z(t), r === I.current && K())
              return
            }
            let { index: l, wrapped: u } = Ko(n.current, i, {
              decrement: !Qc(t.key, _, d),
              loopFocus: c,
              allowEscape: s,
              disabledIndices: g,
              minIndex: a,
              maxIndex: o,
            })
            ;(u && (V.current = !1), (I.current = l), z(t))
          }
        }),
        le = l.useMemo(
          () => ({
            onFocus(e) {
              ;((V.current = !0), ae(e))
            },
            onClick({ currentTarget: e }) {
              f || e.focus({ preventScroll: !0 })
            },
            onMouseMove(e) {
              Yc(e) || ((V.current = !0), (H.current = !1), m && ae(e))
            },
            onPointerLeave(e) {
              if (!ne.current || !R.current || e.pointerType === `touch`) return
              V.current = !0
              let t = e.relatedTarget
              if (
                m &&
                !n.current.includes(t) &&
                re.current &&
                (U.current?.(), (U.current = null), (I.current = -1), z(e), !f)
              ) {
                let e = M.current,
                  t = za(ua(e))
                e && $(e, t) && e.focus({ preventScroll: !0 })
              }
            },
          }),
          [ae, ne, M, m, n, z, re, f],
        ),
        ue = l.useMemo(() => f && E && q && { "aria-activedescendant": `${b}-${r}` }, [f, E, q, b, r]),
        J = l.useMemo(
          () => ({
            ...(j ? {} : ue),
            onKeyDown(t) {
              if (t.key === `Tab` && t.shiftKey && E && !f) {
                let n = Va(t.nativeEvent)
                if (n && !$(M.current, n)) return
                Na(t)
                let r = co(po, t.nativeEvent)
                e.setOpen(!1, r)
                let i = C?.current ?? O
                !r.isCanceled && Wi(i) && i.focus()
              } else ce(t)
            },
            onPointerMove(e) {
              Yc(e) || (R.current = !0)
            },
          }),
          [ue, ce, M, j, e, E, f, O, C],
        ),
        de = l.useMemo(() => {
          function t(t) {
            e.setOpen(!0, co(mo, t.nativeEvent, t.currentTarget))
          }
          function n(e) {
            p === `auto` && Fa(e.nativeEvent) && (F.current = !f)
          }
          function r(e) {
            ;((F.current = p), p === `auto` && Ia(e.nativeEvent) && (F.current = !0))
          }
          return {
            onKeyDown(n) {
              let r = e.select(`open`)
              R.current = !1
              let i = n.key.startsWith(`Arrow`),
                a = $c(n.key, oe(), d),
                o = Zc(n.key, r ? _ : v),
                s = (u ? a : o) || n.key === `Enter` || n.key.trim() === ``
              if (f && r && (!u || ao(n.currentTarget))) return ce(n)
              if (r || h || !i) {
                if (s) {
                  let e = Zc(n.key, oe())
                  L.current = u && e ? null : n.key
                }
                u
                  ? a && (Na(n), r ? ((I.current = se()), z(n), f && M.current?.focus()) : t(n))
                  : o && (W.current != null && (I.current = W.current), Na(n), !r && h ? t(n) : ce(n), r && z(n))
              }
            },
            onFocus(t) {
              t.target === t.currentTarget && e.select(`open`) && !f && ((I.current = -1), z(t))
            },
            onPointerDown: r,
            onPointerEnter: r,
            onMouseDown: n,
            onClick: n,
          }
        }, [ce, p, se, u, z, e, h, _, v, oe, d, W, f, M]),
        fe = l.useMemo(() => ({ ...ue, ...de }), [ue, de])
      return l.useMemo(() => (a ? { reference: fe, floating: J, item: le, trigger: de } : {}), [a, fe, J, de, le])
    }
    function nl(e, t) {
      const {
          listRef: n,
          elementsRef: r,
          activeIndex: i,
          onMatch: a,
          disabledIndices: o,
          onTyping: s,
          enabled: c = !0,
          resetMs: u = 750,
          selectedIndex: d = null,
        } = t,
        f = Q(s),
        p = e.useState(`open`),
        m = va(),
        h = l.useRef(``),
        g = l.useRef(d ?? i ?? -1),
        _ = l.useRef(null),
        v = Q((e) => {
          function t(e) {
            return r?.current[e]
          }
          function s(e) {
            let n = t(e)
            return (n && !Xo(n)) || n?.matches(`:disabled`) ? !1 : o == null || !Jo(Fi, e, o)
          }
          function c(e, t, n = 0) {
            if (e.length === 0) return -1
            let r = ((n % e.length) + e.length) % e.length,
              i = t.toLowerCase()
            for (let t = 0; t < e.length; t += 1) {
              let n = (r + t) % e.length
              if (e[n]?.toLowerCase().startsWith(i) && s(n)) return n
            }
            return -1
          }
          let l = n.current
          if (
            (h.current.length > 0 && e.key === ` ` && (Na(e), f?.(!0)),
            h.current.length > 0 && h.current[0] !== ` ` && c(l, h.current) === -1 && e.key !== ` ` && f?.(!1),
            l == null || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey)
          )
            return
          p && e.key !== ` ` && (Na(e), f?.(!0))
          let v = h.current === ``
          ;(v && (g.current = d ?? i ?? -1),
            l.every((e, t) => (e && s(t) ? e[0]?.toLowerCase() !== e[1]?.toLowerCase() : !0)) &&
              h.current === e.key &&
              ((h.current = ``), (g.current = _.current)),
            (h.current += e.key),
            m.start(u, () => {
              ;((h.current = ``), (g.current = _.current), f?.(!1))
            }))
          let y = ((v ? (d ?? i ?? -1) : g.current) ?? 0) + 1,
            b = c(l, h.current, y)
          b === -1 ? e.key !== ` ` && ((h.current = ``), f?.(!1)) : (a?.(b, e), (_.current = b))
        }),
        y = Q((t) => {
          let n = t.relatedTarget,
            r = e.select(`domReferenceElement`),
            i = e.select(`floatingElement`)
          $(r, n) || $(i, n) || (m.clear(), (h.current = ``), (g.current = _.current), f?.(!1))
        })
      Z(() => {
        ;(p || d === null) && (m.clear(), (_.current = null), h.current !== `` && ((h.current = ``), f?.(!1)))
      }, [p, d, m, f])
      const b = l.useMemo(() => ({ onKeyDown: v, onBlur: y }), [v, y])
      return l.useMemo(() => (c ? { reference: b, floating: b } : {}), [c, b])
    }
    function rl(e, t, n) {
      let { reference: r, floating: i } = e,
        a = Oo(t),
        o = ko(t),
        s = Do(o),
        c = wo(t),
        l = a === `y`,
        u = r.x + r.width / 2 - i.width / 2,
        d = r.y + r.height / 2 - i.height / 2,
        f = r[s] / 2 - i[s] / 2,
        p
      switch (c) {
        case `top`:
          p = { x: u, y: r.y - i.height }
          break
        case `bottom`:
          p = { x: u, y: r.y + r.height }
          break
        case `right`:
          p = { x: r.x + r.width, y: d }
          break
        case `left`:
          p = { x: r.x - i.width, y: d }
          break
        default:
          p = { x: r.x, y: r.y }
      }
      const m = To(t)
      return (m && (p[o] += f * (m === `end` ? 1 : -1) * (n && l ? -1 : 1)), p)
    }
    async function il(e, t) {
      t === void 0 && (t = {})
      const { x: n, y: r, platform: i, rects: a, elements: o, strategy: s } = e,
        {
          boundary: c = `clippingAncestors`,
          rootBoundary: l = `viewport`,
          elementContext: u = `floating`,
          altBoundary: d = !1,
          padding: f = 0,
        } = Co(t, e),
        p = Vo(f),
        m = o[d ? (u === `floating` ? `reference` : `floating`) : u],
        h = Ho(
          await i.getClippingRect({
            element:
              ((await (i.isElement == null ? void 0 : i.isElement(m))) ?? !0)
                ? m
                : m.contextElement ||
                  (await (i.getDocumentElement == null ? void 0 : i.getDocumentElement(o.floating))),
            boundary: c,
            rootBoundary: l,
            strategy: s,
          }),
        ),
        g = u === `floating` ? { x: n, y: r, width: a.floating.width, height: a.floating.height } : a.reference,
        _ = await (i.getOffsetParent == null ? void 0 : i.getOffsetParent(o.floating)),
        v = ((await (i.isElement == null ? void 0 : i.isElement(_))) &&
          (await (i.getScale == null ? void 0 : i.getScale(_)))) || { x: 1, y: 1 },
        y = Ho(
          i.convertOffsetParentRelativeRectToViewportRelativeRect
            ? await i.convertOffsetParentRelativeRectToViewportRelativeRect({
                elements: o,
                rect: g,
                offsetParent: _,
                strategy: s,
              })
            : g,
        )
      return {
        top: (h.top - y.top + p.top) / v.y,
        bottom: (y.bottom - h.bottom + p.bottom) / v.y,
        left: (h.left - y.left + p.left) / v.x,
        right: (y.right - h.right + p.right) / v.x,
      }
    }
    const al = async (e, t, n) => {
        const { placement: r = `bottom`, strategy: i = `absolute`, middleware: a = [], platform: o } = n,
          s = o.detectOverflow ? o : { ...o, detectOverflow: il },
          c = await (o.isRTL == null ? void 0 : o.isRTL(t)),
          l = await o.getElementRects({ reference: e, floating: t, strategy: i }),
          { x: u, y: d } = rl(l, r, c),
          f = r,
          p = 0,
          m = {}
        for (let n = 0; n < a.length; n++) {
          const h = a[n]
          if (!h) continue
          const { name: g, fn: _ } = h,
            {
              x: v,
              y,
              data: b,
              reset: x,
            } = await _({
              x: u,
              y: d,
              initialPlacement: r,
              placement: f,
              strategy: i,
              middlewareData: m,
              rects: l,
              platform: s,
              elements: { reference: e, floating: t },
            })
          ;((u = v ?? u),
            (d = y ?? d),
            (m[g] = { ...m[g], ...b }),
            x &&
              p < 50 &&
              (p++,
              typeof x == `object` &&
                (x.placement && (f = x.placement),
                x.rects &&
                  (l = x.rects === !0 ? await o.getElementRects({ reference: e, floating: t, strategy: i }) : x.rects),
                ({ x: u, y: d } = rl(l, f, c))),
              (n = -1)))
        }
        return { x: u, y: d, placement: f, strategy: i, middlewareData: m }
      },
      ol = function (e) {
        return (
          e === void 0 && (e = {}),
          {
            name: `flip`,
            options: e,
            async fn(t) {
              let n
              const { placement: r, middlewareData: i, rects: a, initialPlacement: o, platform: s, elements: c } = t,
                {
                  mainAxis: l = !0,
                  crossAxis: u = !0,
                  fallbackPlacements: d,
                  fallbackStrategy: f = `bestFit`,
                  fallbackAxisSideDirection: p = `none`,
                  flipAlignment: m = !0,
                  ...h
                } = Co(e, t)
              if ((n = i.arrow) != null && n.alignmentOffset) return {}
              const g = wo(r),
                _ = Oo(o),
                v = wo(o) === o,
                y = await (s.isRTL == null ? void 0 : s.isRTL(c.floating)),
                b = d || (v || !m ? [zo(o)] : jo(o)),
                x = p !== `none`
              !d && x && b.push(...Ro(o, m, p, y))
              let S = [o, ...b],
                C = await s.detectOverflow(t, h),
                w = [],
                T = i.flip?.overflows || []
              if ((l && w.push(C[g]), u)) {
                const e = Ao(r, a, y)
                w.push(C[e[0]], C[e[1]])
              }
              if (((T = [...T, { placement: r, overflows: w }]), !w.every((e) => e <= 0))) {
                const e = (i.flip?.index || 0) + 1,
                  t = S[e]
                if (
                  t &&
                  (u !== `alignment` || _ === Oo(t) || T.every((e) => Oo(e.placement) !== _ || e.overflows[0] > 0))
                )
                  return { data: { index: e, overflows: T }, reset: { placement: t } }
                let n = T.filter((e) => e.overflows[0] <= 0).sort((e, t) => e.overflows[1] - t.overflows[1])[0]
                  ?.placement
                if (!n)
                  switch (f) {
                    case `bestFit`: {
                      const e = T.filter((e) => {
                        if (x) {
                          let t = Oo(e.placement)
                          return t === _ || t === `y`
                        }
                        return !0
                      })
                        .map((e) => [e.placement, e.overflows.filter((e) => e > 0).reduce((e, t) => e + t, 0)])
                        .sort((e, t) => e[1] - t[1])[0]?.[0]
                      e && (n = e)
                      break
                    }
                    case `initialPlacement`:
                      n = o
                  }
                if (r !== n) return { reset: { placement: n } }
              }
              return {}
            },
          }
        )
      },
      sl = /*#__PURE__*/ new Set([`left`, `top`])
    async function cl(e, t) {
      let { placement: n, platform: r, elements: i } = e,
        a = await (r.isRTL == null ? void 0 : r.isRTL(i.floating)),
        o = wo(n),
        s = To(n),
        c = Oo(n) === `y`,
        l = sl.has(o) ? -1 : 1,
        u = a && c ? -1 : 1,
        d = Co(t, e),
        {
          mainAxis: f,
          crossAxis: p,
          alignmentAxis: m,
        } = typeof d == `number`
          ? { mainAxis: d, crossAxis: 0, alignmentAxis: null }
          : { mainAxis: d.mainAxis || 0, crossAxis: d.crossAxis || 0, alignmentAxis: d.alignmentAxis }
      return (
        s && typeof m == `number` && (p = s === `end` ? m * -1 : m), c ? { x: p * u, y: f * l } : { x: f * l, y: p * u }
      )
    }
    const ll = function (e) {
        return (
          e === void 0 && (e = 0),
          {
            name: `offset`,
            options: e,
            async fn(t) {
              let n
              const { x: r, y: i, placement: a, middlewareData: o } = t,
                s = await cl(t, e)
              return a === o.offset?.placement && (n = o.arrow) != null && n.alignmentOffset
                ? {}
                : { x: r + s.x, y: i + s.y, data: { ...s, placement: a } }
            },
          }
        )
      },
      ul = function (e) {
        return (
          e === void 0 && (e = {}),
          {
            name: `shift`,
            options: e,
            async fn(t) {
              const { x: n, y: r, placement: i, platform: a } = t,
                {
                  mainAxis: o = !0,
                  crossAxis: s = !1,
                  limiter: c = {
                    fn: (e) => {
                      let { x: t, y: n } = e
                      return { x: t, y: n }
                    },
                  },
                  ...l
                } = Co(e, t),
                u = { x: n, y: r },
                d = await a.detectOverflow(t, l),
                f = Oo(i),
                p = Eo(f),
                m = u[p],
                h = u[f],
                g = (e, t) => So(t + d[e === `y` ? `top` : `left`], t, t - d[e === `y` ? `bottom` : `right`])
              ;(o && (m = g(p, m)), s && (h = g(f, h)))
              const _ = c.fn({ ...t, [p]: m, [f]: h })
              return { ..._, data: { x: _.x - n, y: _.y - r, enabled: { [p]: o, [f]: s } } }
            },
          }
        )
      },
      dl = function (e) {
        return (
          e === void 0 && (e = {}),
          {
            options: e,
            fn(t) {
              const { x: n, y: r, placement: i, rects: a, middlewareData: o } = t,
                { offset: s = 0, mainAxis: c = !0, crossAxis: l = !0 } = Co(e, t),
                u = { x: n, y: r },
                d = Oo(i),
                f = Eo(d),
                p = u[f],
                m = u[d],
                h = Co(s, t),
                g =
                  typeof h == `number`
                    ? { mainAxis: h, crossAxis: 0 }
                    : { mainAxis: h.mainAxis ?? 0, crossAxis: h.crossAxis ?? 0 }
              if (c) {
                const e = f === `y` ? `height` : `width`,
                  t = a.reference[f] - a.floating[e] + g.mainAxis,
                  n = a.reference[f] + a.reference[e] - g.mainAxis
                p < t ? (p = t) : p > n && (p = n)
              }
              if (l) {
                const e = f === `y` ? `width` : `height`,
                  t = sl.has(wo(i)),
                  n = a.reference[d] - a.floating[e] + ((t && o.offset?.[d]) || 0) + (t ? 0 : g.crossAxis),
                  r = a.reference[d] + a.reference[e] + (t ? 0 : o.offset?.[d] || 0) - (t ? g.crossAxis : 0)
                m < n ? (m = n) : m > r && (m = r)
              }
              return { [f]: p, [d]: m }
            },
          }
        )
      },
      fl = function (e) {
        return (
          e === void 0 && (e = {}),
          {
            name: `size`,
            options: e,
            async fn(t) {
              let { placement: n, rects: r, platform: i, elements: a } = t,
                { apply: o = () => {}, ...s } = Co(e, t),
                c = await i.detectOverflow(t, s),
                l = wo(n),
                u = To(n),
                d = Oo(n) === `y`,
                { width: f, height: p } = r.floating,
                m,
                h
              l === `top` || l === `bottom`
                ? ((m = l),
                  (h =
                    u === ((await (i.isRTL == null ? void 0 : i.isRTL(a.floating))) ? `start` : `end`)
                      ? `left`
                      : `right`))
                : ((h = l), (m = u === `end` ? `top` : `bottom`))
              let g = p - c.top - c.bottom,
                _ = f - c.left - c.right,
                v = go(p - c[m], g),
                y = go(f - c[h], _),
                b = t.middlewareData.shift,
                x = !b,
                S = v,
                C = y
              ;(b != null && b.enabled.x && (C = _),
                b != null && b.enabled.y && (S = g),
                x && !u && (d ? (C = f - 2 * _o(c.left, c.right)) : (S = p - 2 * _o(c.top, c.bottom))),
                await o({ ...t, availableWidth: C, availableHeight: S }))
              const w = await i.getDimensions(a.floating)
              return f !== w.width || p !== w.height ? { reset: { rects: !0 } } : {}
            },
          }
        )
      }
    function pl(e) {
      const t = ra(e),
        n = parseFloat(t.width) || 0,
        r = parseFloat(t.height) || 0,
        i = Wi(e),
        a = i ? e.offsetWidth : n,
        o = i ? e.offsetHeight : r,
        s = vo(n) !== a || vo(r) !== o
      return (s && ((n = a), (r = o)), { width: n, height: r, $: s })
    }
    function ml(e) {
      return Ui(e) ? e : e.contextElement
    }
    function hl(e) {
      const t = ml(e)
      if (!Wi(t)) return bo(1)
      let n = t.getBoundingClientRect(),
        { width: r, height: i, $: a } = pl(t),
        o = (a ? vo(n.width) : n.width) / r,
        s = (a ? vo(n.height) : n.height) / i
      return ((!o || !Number.isFinite(o)) && (o = 1), (!s || !Number.isFinite(s)) && (s = 1), { x: o, y: s })
    }
    const gl = /*#__PURE__*/ bo(0)
    function _l(e) {
      const t = Bi(e)
      return !ta() || !t.visualViewport ? gl : { x: t.visualViewport.offsetLeft, y: t.visualViewport.offsetTop }
    }
    function vl(e, t, n) {
      return (t === void 0 && (t = !1), !!n && t && n === Bi(e))
    }
    function yl(e, t, n, r) {
      ;(t === void 0 && (t = !1), n === void 0 && (n = !1))
      let i = e.getBoundingClientRect(),
        a = ml(e),
        o = bo(1)
      t && (r ? Ui(r) && (o = hl(r)) : (o = hl(e)))
      let s = vl(a, n, r) ? _l(a) : bo(0),
        c = (i.left + s.x) / o.x,
        l = (i.top + s.y) / o.y,
        u = i.width / o.x,
        d = i.height / o.y
      if (a && r) {
        let e = Bi(a),
          t = Ui(r) ? Bi(r) : r,
          n = e,
          i = ca(n)
        for (; i && t !== n;) {
          const e = hl(i),
            t = i.getBoundingClientRect(),
            r = ra(i),
            a = t.left + (i.clientLeft + parseFloat(r.paddingLeft)) * e.x,
            o = t.top + (i.clientTop + parseFloat(r.paddingTop)) * e.y
          ;((c *= e.x), (l *= e.y), (u *= e.x), (d *= e.y), (c += a), (l += o), (n = Bi(i)), (i = ca(n)))
        }
      }
      return Ho({ width: u, height: d, x: c, y: l })
    }
    function bl(e, t) {
      const n = ia(e).scrollLeft
      return t ? t.left + n : yl(Vi(e)).left + n
    }
    function xl(e, t) {
      const n = e.getBoundingClientRect()
      return { x: n.left + t.scrollLeft - bl(e, n), y: n.top + t.scrollTop }
    }
    function Sl(e) {
      const { elements: t, rect: n, offsetParent: r, strategy: i } = e,
        a = i === `fixed`,
        o = Vi(r),
        s = t ? Ji(t.floating) : !1
      if (r === o || (s && a)) return n
      const c = { scrollLeft: 0, scrollTop: 0 },
        l = bo(1),
        u = bo(0),
        d = Wi(r)
      if ((d || !a) && ((zi(r) !== `body` || Ki(o)) && (c = ia(r)), d)) {
        const e = yl(r)
        ;((l = hl(r)), (u.x = e.x + r.clientLeft), (u.y = e.y + r.clientTop))
      }
      const f = o && !d && !a ? xl(o, c) : bo(0)
      return {
        width: n.width * l.x,
        height: n.height * l.y,
        x: n.x * l.x - c.scrollLeft * l.x + u.x + f.x,
        y: n.y * l.y - c.scrollTop * l.y + u.y + f.y,
      }
    }
    function Cl(e) {
      return e.getClientRects ? Array.from(e.getClientRects()) : []
    }
    function wl(e) {
      const t = ia(e),
        n = e.ownerDocument.body,
        r = _o(e.scrollWidth, e.clientWidth, n.scrollWidth, n.clientWidth),
        i = _o(e.scrollHeight, e.clientHeight, n.scrollHeight, n.clientHeight),
        a = -t.scrollLeft + bl(e),
        o = -t.scrollTop
      return (
        ra(n).direction === `rtl` && (a += _o(e.clientWidth, n.clientWidth) - r), { width: r, height: i, x: a, y: o }
      )
    }
    function Tl(e, t, n) {
      n === void 0 && (n = `viewport`)
      let r = n === `layoutViewport`,
        i = Bi(e),
        a = Vi(e),
        o = i.visualViewport,
        s = a.clientWidth,
        c = a.clientHeight,
        l = 0,
        u = 0
      if (o) {
        const e = !ta() || t === `fixed`
        r
          ? e || ((l = -o.offsetLeft), (u = -o.offsetTop))
          : ((s = o.width), (c = o.height), e && ((l = o.offsetLeft), (u = o.offsetTop)))
      }
      if (bl(a) <= 0) {
        const e = a.ownerDocument,
          t = e.body,
          n = getComputedStyle(t),
          r = (e.compatMode === `CSS1Compat` && parseFloat(n.marginLeft) + parseFloat(n.marginRight)) || 0,
          i = Math.abs(a.clientWidth - t.clientWidth - r),
          o = getComputedStyle(a).scrollbarGutter === `stable both-edges` ? i / 2 : i
        o <= 25 && (s -= o)
      }
      return { width: s, height: c, x: l, y: u }
    }
    function El(e, t) {
      const n = yl(e, !0, t === `fixed`),
        r = n.top + e.clientTop,
        i = n.left + e.clientLeft,
        a = hl(e)
      return { width: e.clientWidth * a.x, height: e.clientHeight * a.y, x: i * a.x, y: r * a.y }
    }
    function Dl(e, t, n) {
      let r
      if (t === `viewport` || t === `layoutViewport`) r = Tl(e, n, t)
      else if (t === `document`) r = wl(Vi(e))
      else if (Ui(t)) r = El(t, n)
      else {
        const n = _l(e)
        r = { x: t.x - n.x, y: t.y - n.y, width: t.width, height: t.height }
      }
      return Ho(r)
    }
    function Ol(e, t) {
      const n = t.get(e)
      if (n) return n
      let r = sa(e, [], !1).filter((e) => Ui(e) && zi(e) !== `body`),
        i = null,
        a = ra(e).position === `fixed`,
        o = a ? aa(e) : e
      for (; Ui(o) && !na(o);) {
        const e = ra(o),
          t = $i(o),
          n = i ? i.position : a ? `fixed` : ``
        ;(!t && (n === `fixed` || (n === `absolute` && e.position === `static`))
          ? (r = r.filter((e) => e !== o))
          : (i = e),
          (o = aa(o)))
      }
      return (t.set(e, r), r)
    }
    function kl(e) {
      let { element: t, boundary: n, rootBoundary: r, strategy: i } = e,
        a = [...(n === `clippingAncestors` ? (Ji(t) ? [] : Ol(t, this._c)) : [].concat(n)), r],
        o = Dl(t, a[0], i),
        s = o.top,
        c = o.right,
        l = o.bottom,
        u = o.left
      for (let e = 1; e < a.length; e++) {
        const n = Dl(t, a[e], i)
        ;((s = _o(n.top, s)), (c = go(n.right, c)), (l = go(n.bottom, l)), (u = _o(n.left, u)))
      }
      return { width: c - u, height: l - s, x: u, y: s }
    }
    function Al(e) {
      const { width: t, height: n } = pl(e)
      return { width: t, height: n }
    }
    function jl(e, t, n) {
      const r = Wi(t),
        i = Vi(t),
        a = n === `fixed`,
        o = yl(e, !0, a, t),
        s = { scrollLeft: 0, scrollTop: 0 },
        c = bo(0)
      if ((r || !a) && ((zi(t) !== `body` || Ki(i)) && (s = ia(t)), r)) {
        const e = yl(t, !0, a, t)
        ;((c.x = e.x + t.clientLeft), (c.y = e.y + t.clientTop))
      }
      !r && i && (c.x = bl(i))
      const l = i && !r && !a ? xl(i, s) : bo(0)
      return {
        x: o.left + s.scrollLeft - c.x - l.x,
        y: o.top + s.scrollTop - c.y - l.y,
        width: o.width,
        height: o.height,
      }
    }
    function Ml(e) {
      return ra(e).position === `static`
    }
    function Nl(e, t) {
      if (!Wi(e) || ra(e).position === `fixed`) return null
      if (t) return t(e)
      let n = e.offsetParent
      return (Vi(e) === n && (n = n.ownerDocument.body), n)
    }
    function Pl(e, t) {
      const n = Bi(e)
      if (Ji(e)) return n
      if (!Wi(e)) {
        let t = aa(e)
        for (; t && !na(t);) {
          if (Ui(t) && !Ml(t)) return t
          t = aa(t)
        }
        return n
      }
      let r = Nl(e, t)
      for (; r && qi(r) && Ml(r);) r = Nl(r, t)
      return r && na(r) && Ml(r) && !$i(r) ? n : r || ea(e) || n
    }
    const Fl = async function (e) {
      const t = this.getOffsetParent || Pl,
        n = this.getDimensions,
        r = await n(e.floating)
      return {
        reference: jl(e.reference, await t(e.floating), e.strategy),
        floating: { x: 0, y: 0, width: r.width, height: r.height },
      }
    }
    function Il(e) {
      return ra(e).direction === `rtl`
    }
    const Ll = {
      convertOffsetParentRelativeRectToViewportRelativeRect: Sl,
      getDocumentElement: Vi,
      getClippingRect: kl,
      getOffsetParent: Pl,
      getElementRects: Fl,
      getClientRects: Cl,
      getDimensions: Al,
      getScale: hl,
      isElement: Ui,
      isRTL: Il,
    }
    function Rl(e, t) {
      return e.x === t.x && e.y === t.y && e.width === t.width && e.height === t.height
    }
    function zl(e, t, n) {
      let r = null,
        i,
        a = Vi(e)
      function o() {
        let e
        ;(clearTimeout(i), (e = r) == null || e.disconnect(), (r = null))
      }
      function s(n, c) {
        ;(n === void 0 && (n = !1), c === void 0 && (c = 1), o())
        const l = e.getBoundingClientRect(),
          { left: u, top: d, width: f, height: p } = l
        if ((n || t(), !f || !p)) return
        let m = yo(d),
          h = yo(a.clientWidth - (u + f)),
          g = yo(a.clientHeight - (d + p)),
          _ = yo(u),
          v = { rootMargin: `${-m  }px ${  -h  }px ${  -g  }px ${  -_  }px`, threshold: _o(0, go(1, c)) || 1 },
          y = !0
        function b(t) {
          const n = t[0].intersectionRatio
          if (!Rl(l, e.getBoundingClientRect())) return s()
          if (n !== c) {
            if (!y) return s()
            n
              ? s(!1, n)
              : (i = setTimeout(() => {
                  s(!1, 1e-7)
                }, 1e3))
          }
          y = !1
        }
        try {
          r = new IntersectionObserver(b, { ...v, root: a.ownerDocument })
        } catch {
          r = new IntersectionObserver(b, v)
        }
        r.observe(e)
      }
      const c = Bi(e),
        l = () => s(n)
      return (
        c.addEventListener(`resize`, l),
        s(!0),
        () => {
          ;(c.removeEventListener(`resize`, l), o())
        }
      )
    }
    function Bl(e, t, n, r) {
      r === void 0 && (r = {})
      const {
          ancestorScroll: i = !0,
          ancestorResize: a = !0,
          elementResize: o = typeof ResizeObserver == `function`,
          layoutShift: s = typeof IntersectionObserver == `function`,
          animationFrame: c = !1,
        } = r,
        l = ml(e),
        u = i || a ? [...(l ? sa(l) : []), ...(t ? sa(t) : [])] : []
      u.forEach((e) => {
        ;(i && e.addEventListener(`scroll`, n), a && e.addEventListener(`resize`, n))
      })
      let d = l && s ? zl(l, n, a) : null,
        f = -1,
        p = null
      o &&
        ((p = new ResizeObserver((e) => {
          const [r] = e
          ;(r &&
            r.target === l &&
            p &&
            t &&
            (p.unobserve(t),
            cancelAnimationFrame(f),
            (f = requestAnimationFrame(() => {
              let e
              ;(e = p) == null || e.observe(t)
            }))),
            n())
        })),
        l && !c && p.observe(l),
        t && p.observe(t))
      let m,
        h = c ? yl(e) : null
      c && g()
      function g() {
        const t = yl(e)
        ;(h && !Rl(h, t) && n(), (h = t), (m = requestAnimationFrame(g)))
      }
      return (
        n(),
        () => {
          let e
          ;(u.forEach((e) => {
            ;(i && e.removeEventListener(`scroll`, n), a && e.removeEventListener(`resize`, n))
          }),
            d?.(),
            (e = p) == null || e.disconnect(),
            (p = null),
            c && cancelAnimationFrame(m))
        }
      )
    }
    const Vl = ll,
      Hl = ul,
      Ul = ol,
      Wl = fl,
      Gl = dl,
      Kl = (e, t, n) => {
        const r = /* @__PURE__ */ new Map(),
          i = n ?? {},
          a = { ...Ll, ...i.platform, _c: r }
        return al(e, t, { ...i, platform: a })
      }
    const ql = typeof document < `u` ? l.useLayoutEffect : function () {}
    function Jl(e, t) {
      if (e === t) return !0
      if (typeof e != typeof t) return !1
      if (typeof e == `function` && e.toString() === t.toString()) return !0
      let n, r, i
      if (e && t && typeof e == `object`) {
        if (Array.isArray(e)) {
          if (((n = e.length), n !== t.length)) return !1
          for (r = n; r-- !== 0;) if (!Jl(e[r], t[r])) return !1
          return !0
        }
        if (((i = Object.keys(e)), (n = i.length), n !== Object.keys(t).length)) return !1
        for (r = n; r-- !== 0;) if (!{}.hasOwnProperty.call(t, i[r])) return !1
        for (r = n; r-- !== 0;) {
          const n = i[r]
          if (!(n === `_owner` && e.$$typeof) && !Jl(e[n], t[n])) return !1
        }
        return !0
      }
      return e !== e && t !== t
    }
    function Yl(e) {
      return typeof window > `u` ? 1 : (e.ownerDocument.defaultView || window).devicePixelRatio || 1
    }
    function Xl(e, t) {
      const n = Yl(e)
      return Math.round(t * n) / n
    }
    function Zl(e) {
      const t = l.useRef(e)
      return (
        ql(() => {
          t.current = e
        }),
        t
      )
    }
    function Ql(e) {
      e === void 0 && (e = {})
      const {
          placement: t = `bottom`,
          strategy: n = `absolute`,
          middleware: r = [],
          platform: i,
          elements: { reference: a, floating: o } = {},
          transform: s = !0,
          whileElementsMounted: c,
          open: u,
        } = e,
        [f, p] = l.useState({ x: 0, y: 0, strategy: n, placement: t, middlewareData: {}, isPositioned: !1 }),
        [m, h] = l.useState(r)
      Jl(m, r) || h(r)
      const [g, _] = l.useState(null),
        [v, y] = l.useState(null),
        b = l.useCallback((e) => {
          e !== w.current && ((w.current = e), _(e))
        }, []),
        x = l.useCallback((e) => {
          e !== T.current && ((T.current = e), y(e))
        }, []),
        S = a || g,
        C = o || v,
        w = l.useRef(null),
        T = l.useRef(null),
        E = l.useRef(f),
        D = c != null,
        O = Zl(c),
        k = Zl(i),
        A = Zl(u),
        j = l.useCallback(() => {
          if (!w.current || !T.current) return
          let e = { placement: t, strategy: n, middleware: m }
          ;(k.current && (e.platform = k.current),
            Kl(w.current, T.current, e).then((e) => {
              let t = { ...e, isPositioned: A.current !== !1 }
              M.current &&
                !Jl(E.current, t) &&
                ((E.current = t),
                d.flushSync(() => {
                  p(t)
                }))
            }))
        }, [m, t, n, k, A])
      ql(() => {
        u === !1 && E.current.isPositioned && ((E.current.isPositioned = !1), p((e) => ({ ...e, isPositioned: !1 })))
      }, [u])
      const M = l.useRef(!1)
      ;(ql(
        () => (
          (M.current = !0),
          () => {
            M.current = !1
          }
        ),
        [],
      ),
        ql(() => {
          if ((S && (w.current = S), C && (T.current = C), S && C)) {
            if (O.current) return O.current(S, C, j)
            j()
          }
        }, [S, C, j, O, D]))
      const N = l.useMemo(() => ({ reference: w, floating: T, setReference: b, setFloating: x }), [b, x]),
        P = l.useMemo(() => ({ reference: S, floating: C }), [S, C]),
        F = l.useMemo(() => {
          let e = { position: n, left: 0, top: 0 }
          if (!P.floating) return e
          let t = Xl(P.floating, f.x),
            r = Xl(P.floating, f.y)
          return s
            ? {
                ...e,
                transform: `translate(` + t + `px, ` + r + `px)`,
                ...(Yl(P.floating) >= 1.5 && { willChange: `transform` }),
              }
            : { position: n, left: t, top: r }
        }, [n, s, P.floating, f.x, f.y])
      return l.useMemo(() => ({ ...f, update: j, refs: N, elements: P, floatingStyles: F }), [f, j, N, P, F])
    }
    const $l = (e, t) => {
        const n = Vl(e)
        return { name: n.name, fn: n.fn, options: [e, t] }
      },
      eu = (e, t) => {
        const n = Hl(e)
        return { name: n.name, fn: n.fn, options: [e, t] }
      },
      tu = (e, t) => ({ fn: Gl(e).fn, options: [e, t] }),
      nu = (e, t) => {
        const n = Ul(e)
        return { name: n.name, fn: n.fn, options: [e, t] }
      },
      ru = (e, t) => {
        const n = Wl(e)
        return { name: n.name, fn: n.fn, options: [e, t] }
      },
      iu = /*#__PURE__*/ l.createContext(void 0),
      au = /*#__PURE__*/ l.createContext(void 0)
    function ou() {
      const e = l.useContext(iu)
      if (e === void 0) throw Error(_i(60))
      return e
    }
    function su() {
      const e = l.useContext(au)
      if (e === void 0) throw Error(_i(61))
      return e
    }
    const cu = {
        badInput: !1,
        customError: !1,
        patternMismatch: !1,
        rangeOverflow: !1,
        rangeUnderflow: !1,
        stepMismatch: !1,
        tooLong: !1,
        tooShort: !1,
        typeMismatch: !1,
        valid: null,
        valueMissing: !1,
      },
      lu = { disabled: !1, valid: null, touched: !1, dirty: !1, filled: !1, focused: !1 },
      uu = {
        valid(e) {
          return e === null ? null : e ? { "data-valid": `` } : { "data-invalid": `` }
        },
      },
      du = {
        invalid: void 0,
        name: void 0,
        validityData: { state: cu, errors: [], error: ``, value: ``, initialValue: null },
        setValidityData: Pi,
        disabled: void 0,
        setTouched: Pi,
        setDirty: Pi,
        setFilled: Pi,
        setFocused: Pi,
        focusOwnerRef: { current: void 0 },
        validationMode: `onSubmit`,
        shouldValidateOnChange: () => !1,
        state: lu,
        registerFieldControl: Pi,
        validation: {
          getValidationProps: (e, t = Ii) => t,
          inputRef: { current: null },
          registeredInputs: /* @__PURE__ */ new Map(),
          registerInput: Pi,
          getInputControl: () => null,
          commit: async () => {},
          change: Pi,
        },
      },
      fu = /*#__PURE__*/ l.createContext(du)
    function pu(e = !0) {
      const t = l.useContext(fu)
      if (t.setValidityData === Pi && !e) throw Error(_i(28))
      return t
    }
    function mu(e, t, n, r, i = !0, a) {
      const { registerFieldControl: o } = pu(),
        s = Qr(() => Symbol())
      ;(Z(() => {
        const c = s.current
        i ? o(c, { controlRef: e, getValue: r, id: t, name: a, value: n }) : o(c, void 0)
      }, [e, i, r, t, a, o, s, n]),
        Z(() => {
          const e = s.current
          return () => {
            o(e, void 0)
          }
        }, [o, s]))
    }
    function hu(e) {
      return Ls(e, `base-ui`)
    }
    const gu = /*#__PURE__*/ l.createContext({
      controlId: void 0,
      registerControlId: Pi,
      resetControlId: Pi,
      labelId: void 0,
      setLabelId: Pi,
      messageIds: [],
      setMessageIds: Pi,
      getDescriptionProps: (e) => e,
    })
    function _u() {
      return l.useContext(gu)
    }
    function vu(e = {}) {
      const { id: t, enabled: n = !0 } = e,
        { controlId: r, registerControlId: i, resetControlId: a } = _u(),
        o = hu(),
        s = Qr(() => Symbol()),
        c = l.useRef(!1),
        u = l.useRef(!1),
        d = Q(() => {
          c.current && i !== Pi && ((c.current = !1), i(s.current, void 0))
        })
      return (
        Z(() => {
          if (!n || i === Pi) {
            d()
            return
          }
          let e
          if (t !== void 0) ((u.current = !0), (e = t))
          else if (u.current) e = o
          else {
            a()
            return
          }
          e === void 0 ? d() : ((c.current = !0), i(s.current, e))
        }, [t, n, i, a, o, s, d]),
        Z(() => d, [d]),
        (n ? r : void 0) ?? t ?? o
      )
    }
    function yu(e, t, n = Object.is) {
      const { length: r } = e
      if (r !== t.length) return !1
      for (let i = 0; i < r; i += 1) if (!n(e[i], t[i])) return !1
      return !0
    }
    const bu = (e, t) => Object.is(e, t)
    function xu(e, t, n) {
      return e == null || t == null ? Object.is(e, t) : n(e, t)
    }
    function Su(e, t, n) {
      return Array.isArray(e) && Array.isArray(t) ? !yu(e, t, (e, t) => xu(e, t, n)) : e !== t
    }
    function Cu(e, t, n) {
      return e ? e.some((e) => e !== void 0 && xu(t, e, n)) : !1
    }
    function wu(e, t, n) {
      return e ? e.findIndex((e) => e !== void 0 && xu(e, t, n)) : -1
    }
    function Tu(e, t) {
      if (t !== bu) return (n) => Cu(e, n, t)
      const n = new Set(e)
      return (n.delete(void 0), (t) => n.has(t) && (t !== 0 || e.some((e) => Object.is(t, e))))
    }
    function Eu(e, t, n, r) {
      const i = r && Array.isArray(t) ? e.findIndex(Tu(t, n)) : wu(e, t, n)
      return i === -1 ? null : i
    }
    function Du(e, t, n, r, i, a) {
      return Cu(r, t, i) ? (a != null && e > a && Cu(r, n[a], i) ? a : e) : e === a ? Eu(n, r, i, !0) : a
    }
    function Ou(e, t, n) {
      return e.filter((e) => !xu(t, e, n))
    }
    function ku(e) {
      if (e == null) return ``
      if (typeof e == `string`) return e
      try {
        return JSON.stringify(e)
      } catch {
        return String(e)
      }
    }
    function Au(e) {
      return typeof e == `object` && !!e && Array.isArray(e.items)
    }
    function ju(e) {
      return Au(e?.[0])
    }
    function Mu(e) {
      return ju(e) ? e.flatMap((e) => e.items) : e
    }
    function Nu(e) {
      if (!Array.isArray(e)) return e != null && `null` in e
      const t = e
      if (ju(t)) {
        for (const e of t) for (const t of e.items) if (t && t.value == null && t.label != null) return !0
        return !1
      }
      for (const e of t) if (e && e.value == null && e.label != null) return !0
      return !1
    }
    function Pu(e, t) {
      if (t && e != null) return t(e) ?? ``
      if (e && typeof e == `object`) {
        if (`label` in e && e.label != null) return String(e.label)
        if (`value` in e) return String(e.value)
      }
      return ku(e)
    }
    function Fu(e, t) {
      return t && e != null
        ? (t(e) ?? ``)
        : e && typeof e == `object` && `value` in e && `label` in e
          ? ku(e.value)
          : ku(e)
    }
    function Iu(e, t, n) {
      function r() {
        return Pu(e, n)
      }
      if (n && e != null) return n(e)
      if (e && typeof e == `object` && `label` in e && e.label != null) return e.label
      if (t && !Array.isArray(t)) return (Object.hasOwn(t, e) ? t[e] : void 0) ?? r()
      if (Array.isArray(t)) {
        const n = Mu(t)
        if (typeof e != `object` || !e) {
          const t = n.find((t) => t.value === e)
          return t && t.label != null ? t.label : r()
        }
        if (`value` in e) {
          const t = n.find((t) => t && t.value === e.value)
          if (t && t.label != null) return t.label
        }
      }
      return r()
    }
    function Lu(e, t, n) {
      return e.reduce(
        (e, r, i) => (
          i > 0 && e.push(`, `),
          e.push(/*#__PURE__*/ (0, u.jsx)(l.Fragment, { children: Iu(r, t, n) }, i)),
          e
        ),
        [],
      )
    }
    const Ru = {
        id: (e) => e.id,
        labelId: (e) => e.labelId,
        modal: (e) => e.modal,
        multiple: (e) => e.multiple,
        disabled: (e) => e.disabled,
        readOnly: (e) => e.readOnly,
        required: (e) => e.required,
        highlightItemOnHover: (e) => e.highlightItemOnHover,
        items: (e) => e.items,
        itemToStringLabel: (e) => e.itemToStringLabel,
        isItemEqualToValue: (e) => e.isItemEqualToValue,
        value: (e) => e.value,
        hasSelectedValue: (e) => {
          const { value: t, multiple: n, itemToStringValue: r } = e
          return t == null ? !1 : n && Array.isArray(t) ? t.length > 0 : Fu(t, r) !== ``
        },
        hasNullItemLabel: (e, t) => (t ? Nu(e.items) : !1),
        open: (e) => e.open,
        mounted: (e) => e.mounted,
        forceMount: (e) => e.forceMount,
        transitionStatus: (e) => e.transitionStatus,
        openMethod: (e) => e.openMethod,
        activeIndex: (e) => e.activeIndex,
        selectedIndex: (e) => e.selectedIndex,
        isActive: (e, t) => e.activeIndex === t,
        isSelected: (e, t) => {
          const n = e.isItemEqualToValue,
            r = e.value
          return e.multiple ? Array.isArray(r) && r.some((e) => xu(t, e, n)) : xu(t, r, n)
        },
        isSelectedByFocus: (e, t) => e.selectedIndex === t,
        popupProps: (e) => e.popupProps,
        triggerProps: (e) => e.triggerProps,
        itemRoot: (e) => e.itemRoot,
        triggerElement: (e) => e.triggerElement,
        positionerElement: (e) => e.positionerElement,
        listElement: (e) => e.listElement,
        popupSide: (e) => e.popupSide,
        scrollUpArrowVisible: (e) => e.scrollUpArrowVisible,
        scrollDownArrowVisible: (e) => e.scrollDownArrowVisible,
        hasScrollArrows: (e) => e.hasScrollArrows,
      },
      zu = /*#__PURE__*/ l.createContext({
        elementRef: { current: null },
        formRef: { current: { fields: /* @__PURE__ */ new Map() } },
        errors: {},
        clearErrors: Pi,
        validationMode: `onSubmit`,
        submitCountRef: { current: 0 },
      })
    function Bu() {
      return l.useContext(zu)
    }
    function Vu(e, t) {
      const n = l.useRef(e),
        r = Q(t)
      Z(() => {
        ;(n.current !== e && r(n.current), (n.current = e))
      }, [e, r])
    }
    function Hu(e) {
      const t = l.useRef(``),
        n = l.useCallback(
          (n) => {
            n.defaultPrevented || ((t.current = n.pointerType), e(n, n.pointerType))
          },
          [e],
        )
      return {
        onClick: l.useCallback(
          (n) => {
            n.detail === 0
              ? e(n, `keyboard`)
              : (`pointerType` in n ? e(n, n.pointerType) : e(n, t.current), (t.current = ``))
          },
          [e],
        ),
        onPointerDown: n,
      }
    }
    function Uu(e, t) {
      const { onClick: n, onPointerDown: r } = Hu(
        Q((n, r) => {
          ;(typeof e == `function` ? e() : e) || t(r || (Ta ? `touch` : ``))
        }),
      )
      return l.useMemo(() => ({ onClick: n, onPointerDown: r }), [n, r])
    }
    function Wu(e) {
      const [t, n] = l.useState(null),
        r = Uu(e, n)
      return (
        Vu(e, (t) => {
          t && !e && n(null)
        }),
        l.useMemo(() => ({ openMethod: t, triggerProps: r }), [t, r])
      )
    }
    function Gu(e, t = -(2 ** 53 - 1), n = 2 ** 53 - 1) {
      return Math.max(t, Math.min(e, n))
    }
    function Ku(e, t) {
      return Math.max(0, e - t)
    }
    function qu(e, t) {
      if (t <= 0) return 0
      const n = Gu(e, 0, t),
        r = n,
        i = t - n,
        a = r <= 1,
        o = i <= 1
      return a && o ? (r <= i ? 0 : t) : a ? 0 : o ? t : n
    }
    function Ju(e) {
      const {
          id: t,
          value: n,
          defaultValue: r = null,
          onValueChange: i,
          open: a,
          defaultOpen: o = !1,
          onOpenChange: s,
          name: c,
          form: d,
          autoComplete: f,
          disabled: p = !1,
          readOnly: m = !1,
          required: h = !1,
          modal: g = !0,
          actionsRef: _,
          inputRef: v,
          onOpenChangeComplete: y,
          items: b,
          multiple: x = !1,
          itemToStringLabel: S,
          itemToStringValue: C,
          isItemEqualToValue: w = bu,
          highlightItemOnHover: T = !0,
          children: E,
        } = e,
        { clearErrors: D } = Bu(),
        {
          setDirty: O,
          setTouched: k,
          setFocused: A,
          validityData: j,
          setFilled: M,
          name: N,
          disabled: P,
          validation: F,
          validationMode: I,
        } = pu(),
        L = vu({ id: t }),
        R = P || p,
        z = N ?? c,
        [B, ee] = ci({ controlled: n, default: x ? (r ?? Fi) : r, name: `Select`, state: `value` }),
        [V, H] = ci({ controlled: a, default: o, name: `Select`, state: `open` }),
        U = l.useRef([]),
        te = l.useRef([]),
        ne = l.useRef(null),
        W = l.useRef(null),
        re = l.useRef(0),
        G = l.useRef(null),
        ie = l.useRef([]),
        K = l.useRef(!1),
        q = l.useRef(null),
        ae = l.useRef(null),
        oe = l.useRef({ allowSelectedMouseUp: !1, allowUnselectedMouseUp: !1, dragY: 0 }),
        se = l.useRef(!1),
        ce = l.useRef(B),
        { openMethod: le, triggerProps: ue } = Wu(V),
        J = Qr(
          () =>
            new Li(
              {
                id: L,
                labelId: void 0,
                modal: g,
                multiple: x,
                disabled: R,
                readOnly: m,
                required: h,
                highlightItemOnHover: T,
                itemToStringLabel: S,
                itemToStringValue: C,
                isItemEqualToValue: w,
                value: B,
                open: V,
                mounted: V,
                transitionStatus: void 0,
                items: b,
                forceMount: !1,
                openMethod: null,
                activeIndex: null,
                selectedIndex: null,
                popupProps: Ii,
                triggerProps: Ii,
                itemRoot: { props: Ii, multiple: x, disabled: R, readOnly: m, isItemEqualToValue: w },
                triggerElement: null,
                positionerElement: null,
                listElement: null,
                popupSide: null,
                scrollUpArrowVisible: !1,
                scrollDownArrowVisible: !1,
                hasScrollArrows: !1,
              },
              {
                setValue: Pi,
                setOpen: Pi,
                handleScrollArrowVisibility: Pi,
                onOpenChangeComplete: Pi,
                listRef: U,
                popupRef: ne,
                scrollHandlerRef: W,
                scrollArrowsMountedCountRef: re,
                valueRef: G,
                valuesRef: ie,
                labelsRef: te,
                typingRef: K,
                selectionRef: oe,
                firstItemTextRef: q,
                selectedItemTextRef: ae,
                alignItemWithTriggerActiveRef: se,
                initialValueRef: ce,
              },
              Ru,
            ),
        ).current,
        [de, fe] = l.useState(!1),
        {
          mounted: pe,
          transitionStatus: me,
          forceUnmount: he,
        } = Hc({
          open: V,
          ref: ne,
          preventUnmountOnClose: de,
          setPreventUnmountOnClose: fe,
          onUnmount() {
            ;(J.update({ activeIndex: null, openMethod: null, scrollUpArrowVisible: !1, scrollDownArrowVisible: !1 }),
              y?.(!1))
          },
        }),
        ge = J.useState(`activeIndex`),
        _e = J.useState(`selectedIndex`),
        ve = J.useState(`triggerElement`),
        ye = J.useState(`positionerElement`),
        be = oi(le),
        xe = le ?? be,
        Se = l.useMemo(() => (x ? `` : Fu(B, C)), [x, B, C]),
        Ce = l.useMemo(() => (x && Array.isArray(B) ? B.map((e) => Fu(e, C)) : Fu(B, C)), [x, B, C])
      mu(
        mi(ve),
        L,
        B,
        Q(() => Ce),
        !R,
        c,
      )
      const we = x ? Array.isArray(B) && B.length > 0 : B != null && Se !== ``
      ;(Z(() => {
        M(we)
      }, [we, M]),
        Z(
          function () {
            const e = Eu(ie.current, B, w, x)
            ;(e === null && (ae.current = null), !V && J.set(`selectedIndex`, e))
          },
          [x, V, B, w, J],
        ),
        Vu(B, () => {
          ;(D(z), O(Su(B, j.initialValue, w)), F.change(B))
        }))
      const Te = Q((e, t) => {
        let n = t,
          r = Wc(n)
        ;(s?.(e, n),
          !t.isCanceled &&
            (e || fe(r()),
            H(e),
            !e &&
              (t.reason === `focus-out` || t.reason === `outside-press`) &&
              (k(!0), A(!1), I === `onBlur` && F.commit(B))))
      })
      l.useImperativeHandle(
        _,
        () => ({
          unmount: he,
          close: () => {
            J.state.open && Te(!1, co(`imperative-action`))
          },
        }),
        [he, Te, J],
      )
      const Ee = Q((e, t) => {
          ;(i?.(e, t), !t.isCanceled && ee(e))
        }),
        De = Q((e) => {
          let t = Ku(e.scrollHeight, e.clientHeight),
            n = qu(e.scrollTop, t),
            r = n > 0,
            i = n < t
          ;(J.set(`scrollUpArrowVisible`, r), J.set(`scrollDownArrowVisible`, i))
        }),
        Oe = Jc({ open: V, onOpenChange: Te, elements: { reference: ve, floating: ye } }),
        ke = Mc(Oe, { enabled: !R, event: `mousedown` }),
        Ae = Fc(Oe),
        je = tl(Oe, {
          enabled: !R,
          listRef: U,
          activeIndex: ge,
          selectedIndex: _e,
          disabledIndices: Fi,
          onNavigate(e) {
            ;(e !== null || V) && J.set(`activeIndex`, e)
          },
          focusItemOnHover: T,
        }),
        Me = nl(Oe, {
          enabled: !R && (V || (!m && !x)),
          listRef: te,
          activeIndex: ge,
          selectedIndex: _e,
          disabledIndices: (e) => si(U.current[e]),
          onMatch(e) {
            V ? J.set(`activeIndex`, e) : Ee(ie.current[e], co(lo))
          },
          onTyping(e) {
            K.current = e
          },
        }),
        Ne = l.useMemo(
          () => Ws(Me.reference, je.reference, Ae.reference, ke.reference, ue),
          [ke.reference, Me.reference, je.reference, Ae.reference, ue],
        ),
        Pe = l.useMemo(() => Ws(Uc, Me.floating, je.floating, Ae.floating), [Me.floating, je.floating, Ae.floating]),
        Fe = je.item ?? Ii,
        Ie = l.useMemo(
          () => ({ props: Fe, multiple: x, disabled: R, readOnly: m, isItemEqualToValue: w }),
          [Fe, x, R, m, w],
        )
      ;(J.useContextCallback(`setValue`, Ee),
        J.useContextCallback(`setOpen`, Te),
        J.useContextCallback(`handleScrollArrowVisibility`, De),
        J.useContextCallback(`onOpenChangeComplete`, y),
        ai(() => {
          J.update({ popupProps: Pe, triggerProps: Ne, itemRoot: Ie })
        }),
        J.useSyncedValues({
          id: L,
          modal: g,
          multiple: x,
          disabled: R,
          readOnly: m,
          required: h,
          highlightItemOnHover: T,
          value: B,
          open: V,
          mounted: pe,
          transitionStatus: me,
          popupProps: Pe,
          triggerProps: Ne,
          itemRoot: Ie,
          items: b,
          itemToStringLabel: S,
          itemToStringValue: C,
          isItemEqualToValue: w,
          openMethod: xe,
        }))
      const Le = $r(v, F.inputRef),
        Re = x ? void 0 : z,
        ze = l.useMemo(
          () =>
            !x || !Array.isArray(B) || !z
              ? null
              : B.map((e) => {
                  let t = Fu(e, C)
                  return /*#__PURE__*/ (0, u.jsx)(
                    `input`,
                    { type: `hidden`, form: d, name: z, value: t, disabled: R },
                    t,
                  )
                }),
          [x, B, d, z, C, R],
        )
      return /*#__PURE__*/ (0, u.jsxs)(iu.Provider, {
        value: J,
        children: [
          /*#__PURE__*/ (0, u.jsx)(au.Provider, { value: Oe, children: E }),
          /*#__PURE__*/ (0, u.jsx)(`input`, {
            ...F.getValidationProps(R, {
              onFocus() {
                J.state.triggerElement?.focus({ focusVisible: !0 })
              },
              onChange(e) {
                if (e.nativeEvent.defaultPrevented || R || m) return
                const t = e.currentTarget.value,
                  n = co(lo, e.nativeEvent)
                function r() {
                  if (x) return
                  let e = t.toLowerCase(),
                    r = ie.current.findIndex((t) => Fu(t, C).toLowerCase() === e || Pu(t, S).toLowerCase() === e)
                  r === -1 &&
                    (r = ie.current.findIndex((t, n) => {
                      const r = te.current[n]
                      return r != null && r.toLowerCase() === e
                    }))
                  const i = ie.current[r]
                  i != null && Ee(i, n)
                }
                ;(J.set(`forceMount`, !0), queueMicrotask(r))
              },
            }),
            id: L && Re == null ? `${L}-hidden-input` : void 0,
            form: d,
            name: Re,
            autoComplete: f,
            value: Se,
            disabled: R,
            required: h && !(x && we),
            readOnly: m,
            ref: Le,
            style: z ? Xr : Yr,
            tabIndex: -1,
            "aria-hidden": !0,
            suppressHydrationWarning: !0,
          }),
          ze,
        ],
      })
    }
    function Yu(e, t) {
      return e ?? t
    }
    function Xu(e, t, n) {
      const { setFocused: r, focusOwnerRef: i } = pu(),
        a = Q((t) => {
          ;(t ? !e : i.current === a) && ((i.current = t && a), n?.(t), r(t))
        })
      return (
        Z(() => {
          const e = t.current
          return (e?.getRootNode()?.activeElement === e && a(!0), () => a(!1))
        }, [e, t, a]),
        a
      )
    }
    function Zu(e, t) {
      const n = Qu(t)
      return e.clientX >= n.left - 5 && e.clientX <= n.right + 5 && e.clientY >= n.top - 5 && e.clientY <= n.bottom + 5
    }
    function Qu(e) {
      const t = e.getBoundingClientRect(),
        n = Bi(e)
      if (Ma) return t
      const r = n.getComputedStyle(e, `::before`),
        i = n.getComputedStyle(e, `::after`)
      if (r.content === `none` && i.content === `none`) return t
      const a = parseFloat(r.width) || 0,
        o = parseFloat(r.height) || 0,
        s = parseFloat(i.width) || 0,
        c = parseFloat(i.height) || 0,
        l = Math.max(t.width, a, s),
        u = Math.max(t.height, o, c),
        d = l - t.width,
        f = u - t.height
      return { left: t.left - d / 2, right: t.right + d / 2, top: t.top - f / 2, bottom: t.bottom + f / 2 }
    }
    const $u = /*#__PURE__*/ l.createContext(void 0)
    function ed(e = !1) {
      const t = l.useContext($u)
      if (t === void 0 && !e) throw Error(_i(16))
      return t
    }
    function td(e) {
      const { focusableWhenDisabled: t, disabled: n, composite: r = !1, tabIndex: i = 0, isNativeButton: a } = e,
        o = r && t !== !1,
        s = r && t === !1
      return {
        props: l.useMemo(() => {
          const e = {
            onKeyDown(e) {
              n && t && e.key !== `Tab` && e.preventDefault()
            },
          }
          return (
            r || ((e.tabIndex = i), !a && n && (e.tabIndex = t ? i : -1)),
            ((a && (t || o)) || (!a && n)) && (e[`aria-disabled`] = n),
            a && (!t || s) && (e.disabled = n),
            e
          )
        }, [r, n, t, o, s, a, i]),
      }
    }
    function nd(e, t, { detail: n = 0, pointerType: r = `` } = {}) {
      e.dispatchEvent(
        new (Bi(e).PointerEvent)(`click`, {
          bubbles: !0,
          cancelable: !0,
          composed: !0,
          detail: n,
          pointerType: r,
          shiftKey: t.shiftKey,
          ctrlKey: t.ctrlKey,
          altKey: t.altKey,
          metaKey: t.metaKey,
        }),
      )
    }
    function rd(e = {}) {
      const { disabled: t = !1, focusableWhenDisabled: n, tabIndex: r = 0, native: i = !0, composite: a } = e,
        o = l.useRef(null),
        s = ed(!0),
        c = a ?? s !== void 0,
        { props: u } = td({ focusableWhenDisabled: n, disabled: t, composite: c, tabIndex: r, isNativeButton: i }),
        d = l.useCallback(() => {
          let e = o.current
          id(e) && c && t && u.disabled === void 0 && e.disabled && (e.disabled = !1)
        }, [t, u.disabled, c])
      return (
        Z(d, [d]),
        {
          getButtonProps: l.useCallback(
            (e = {}) => {
              const { onClick: n, onMouseDown: r, onKeyUp: a, onKeyDown: o, onPointerDown: s, ...l } = e
              return Ws(
                {
                  onClick(e) {
                    t ? e.preventDefault() : n?.(e)
                  },
                  onMouseDown(e) {
                    t || r?.(e)
                  },
                  onKeyDown(e) {
                    if (t || (ec(e), o?.(e), e.baseUIHandlerPrevented)) return
                    const n = e.target === e.currentTarget,
                      r = e.currentTarget,
                      a = id(r),
                      s = !i && ad(r),
                      l = n && (i ? a : !s),
                      u = e.key === `Enter`,
                      d = e.key === ` `,
                      f = r.getAttribute(`role`),
                      p = f?.startsWith(`menuitem`) || f === `option` || f === `gridcell`
                    if (n && c && d) {
                      if (e.defaultPrevented && p) return
                      ;(e.preventDefault(), (!i || a) && (e.preventBaseUIHandler(), nd(r, e)))
                    } else
                      !l || i || (!d && !u)
                        ? n && s && d && e.preventDefault()
                        : e.defaultPrevented || (e.preventDefault(), u && (e.preventBaseUIHandler(), nd(r, e)))
                  },
                  onKeyUp(e) {
                    t ||
                      (ec(e),
                      a?.(e),
                      e.target === e.currentTarget && i && c && id(e.currentTarget) && e.key === ` `
                        ? e.preventDefault()
                        : e.baseUIHandlerPrevented ||
                          (e.target === e.currentTarget &&
                            !i &&
                            !c &&
                            !e.defaultPrevented &&
                            e.key === ` ` &&
                            (e.preventBaseUIHandler(), nd(e.currentTarget, e))))
                  },
                  onPointerDown(e) {
                    t ? e.preventDefault() : s?.(e)
                  },
                },
                i ? { type: `button` } : { role: `button` },
                u,
                l,
              )
            },
            [t, u, c, i],
          ),
          buttonRef: Q((e) => {
            ;((o.current = e), d())
          }),
        }
      )
    }
    function id(e) {
      return Wi(e) && e.tagName === `BUTTON`
    }
    function ad(e) {
      return Wi(e) && e.tagName === `A` && !!e.href
    }
    const od = { ...to, ...uu, popupSide: (e) => (e ? { "data-popup-side": e } : null), value: () => null },
      sd = /*#__PURE__*/ l.forwardRef(function (e, t) {
        const { render: n, className: r, id: i, disabled: a = !1, nativeButton: o = !0, style: s, ...c } = e,
          { setTouched: u, validationMode: d, validation: f, state: p, disabled: m } = pu(),
          { labelId: h } = _u(),
          g = ou(),
          _ = g.useState(`readOnly`),
          v = g.useState(`required`),
          y = g.useState(`disabled`),
          b = m || y || a,
          x = g.useState(`open`),
          S = g.useState(`mounted`),
          C = g.useState(`value`),
          w = g.useState(`triggerProps`),
          T = g.useState(`positionerElement`),
          E = g.useState(`listElement`),
          D = g.useState(`popupSide`),
          O = g.useState(`id`),
          k = g.useState(`labelId`),
          A = g.useState(`hasSelectedValue`),
          j = S && T ? D : null,
          M = i ?? O,
          N = Yu(h, k)
        vu({ id: i })
        const P = mi(T),
          F = l.useRef(null),
          I = Xu(b, F),
          { getButtonProps: L, buttonRef: R } = rd({ disabled: b, native: o }),
          z = g.useStateSetter(`triggerElement`),
          B = va(),
          ee = va(),
          V = va()
        l.useEffect(() => {
          if (x)
            return (
              V.start(400, () => {
                ;((g.context.selectionRef.current.allowUnselectedMouseUp = !0),
                  (g.context.selectionRef.current.allowSelectedMouseUp = !0))
              }),
              () => {
                V.clear()
              }
            )
          ;((g.context.selectionRef.current = { allowSelectedMouseUp: !1, allowUnselectedMouseUp: !1, dragY: 0 }),
            ee.clear())
        }, [x, g, ee, V])
        const H = Ws(
            w,
            {
              id: M,
              role: `combobox`,
              "aria-expanded": x,
              "aria-haspopup": `listbox`,
              "aria-controls": x ? (E?.id ?? so(T)?.id) : void 0,
              "aria-labelledby": N,
              "aria-readonly": _ || void 0,
              "aria-required": v || void 0,
              tabIndex: b ? -1 : 0,
              onFocus(e) {
                ;(I(!0),
                  x && g.context.alignItemWithTriggerActiveRef.current && g.context.setOpen(!1, co(lo, e.nativeEvent)),
                  B.start(0, () => {
                    g.set(`forceMount`, !0)
                  }))
              },
              onBlur(e) {
                $(T, e.relatedTarget) || (u(!0), I(!1), d === `onBlur` && f.commit(C))
              },
              onMouseDown(e) {
                if (x) return
                let t = ua(e.currentTarget)
                function n(e) {
                  if (!F.current) return
                  let t = e.target
                  $(F.current, t) || $(P.current, t) || Zu(e, F.current) || g.context.setOpen(!1, co(`cancel-open`, e))
                }
                ee.start(0, () => {
                  t.addEventListener(`mouseup`, n, { once: !0 })
                })
              },
            },
            c,
            L,
          ),
          U = f.getValidationProps(b, H)
        U.role = `combobox`
        const te = { ...p, open: x, disabled: b, value: C, readOnly: _, popupSide: j, placeholder: !A }
        return rc(`button`, e, { ref: [t, F, R, z], state: te, stateAttributesMapping: od, props: U })
      }),
      cd = { value: () => null },
      ld = /*#__PURE__*/ l.forwardRef(function (e, t) {
        let { className: n, render: r, children: i, placeholder: a, style: o, ...s } = e,
          c = ou(),
          l = c.useState(`value`),
          u = c.useState(`items`),
          d = c.useState(`itemToStringLabel`),
          f = c.useState(`hasSelectedValue`),
          p = !f && a != null && i == null,
          m = c.useState(`hasNullItemLabel`, p),
          h = { value: l, placeholder: !f },
          g = null
        return (
          (g = typeof i == `function` ? i(l) : (i ?? (p && !m ? a : Array.isArray(l) ? Lu(l, u, d) : Iu(l, u, d)))),
          rc(`span`, e, {
            state: h,
            ref: [t, c.context.valueRef],
            props: [{ children: g }, s],
            stateAttributesMapping: cd,
          })
        )
      }),
      ud = /*#__PURE__*/ l.forwardRef(function (e, t) {
        const { render: n, className: r, style: i, ...a } = e
        return rc(`span`, e, {
          state: { open: ou().useState(`open`) },
          ref: t,
          props: [{ "aria-hidden": !0, children: `▼` }, a],
          stateAttributesMapping: eo,
        })
      }),
      dd = /*#__PURE__*/ l.forwardRef(function (e, t) {
        const n = ou(),
          r = n.useState(`mounted`),
          i = n.useState(`forceMount`)
        return r || i ? /*#__PURE__*/ (0, u.jsx)(_c, { ref: t, ...e }) : null
      })
    function fd(e) {
      return Ci(19) ? e : e ? `true` : void 0
    }
    const pd = /*#__PURE__*/ l.createContext({
      register: () => {},
      unregister: () => {},
      subscribeMapChange: () => () => {},
      nextIndexRef: { current: 0 },
    })
    function md() {
      return l.useContext(pd)
    }
    function hd(e) {
      const { children: t, elementsRef: n, labelsRef: r, onMapChange: i } = e,
        a = Q(i),
        [, o] = l.useState(0),
        s = Qr(_d).current,
        c = Qr(gd).current,
        d = l.useRef(0),
        f = l.useRef(!0),
        p = l.useRef(null),
        m = l.useRef(null),
        h = Q(() => {
          f.current || ((f.current = !0), o((e) => e + 1))
        }),
        g = Q((e, t) => {
          ;(c.set(e, t), h())
        }),
        _ = Q((e) => {
          ;(c.delete(e), h())
        }),
        v = Q((e) => {
          let t = /* @__PURE__ */ new Map()
          return (
            (n.current.length = 0),
            r && (r.current.length = 0),
            e.forEach((e) => {
              ;(t.set(e.element, { ...(e.registration.metadata ?? {}), index: e.index }),
                (n.current[e.index] = e.element),
                r &&
                  (r.current[e.index] =
                    e.registration.label === void 0
                      ? (e.registration.textRef?.current?.textContent ?? e.element.textContent)
                      : e.registration.label))
            }),
            (d.current = n.current.length),
            t
          )
        })
      function y(e) {
        if ((m.current?.disconnect(), (m.current = null), typeof MutationObserver != `function` || e.length < 2)) return
        const t = new MutationObserver((n) => {
          if (!bd(n)) return
          let r = null
          for (let n of e)
            if (n.isConnected) {
              if (r && xd(r, n) > 0) {
                ;(t.disconnect(), h())
                return
              }
              r = n
            }
        })
        m.current = t
        const n = /* @__PURE__ */ new Set()
        for (let t = 1; t < e.length; t += 1) {
          const r = yd(e[t - 1], e[t])
          r && n.add(r)
        }
        n.forEach((e) => t.observe(e, { childList: !0 }))
      }
      const b = Q(() => {
        let [e, t] = vd(c),
          n = v(e),
          r = p.current,
          i =
            !r ||
            r.length !== e.length ||
            e.some((e, t) => {
              let n = r[t]
              return (
                e.index !== n.index ||
                e.element !== n.element ||
                e.registration.index !== n.registration.index ||
                e.registration.metadata !== n.registration.metadata
              )
            })
        ;(y(t), (p.current = e), (f.current = !1), i && (s.forEach((e) => e(n)), a(n)))
      })
      ;(Z(
        () => (
          !f.current && p.current && v(p.current),
          () => {
            ;((n.current = []), r && (r.current = []))
          }
        ),
        [n, r, v],
      ),
        Z(() => {
          f.current && b()
        }),
        Z(
          () => () => {
            ;(m.current?.disconnect(), (f.current = !0))
          },
          [],
        ))
      const x = Q(
          (e) => (
            s.add(e),
            () => {
              s.delete(e)
            }
          ),
        ),
        S = l.useMemo(() => ({ register: g, unregister: _, subscribeMapChange: x, nextIndexRef: d }), [g, _, x, d])
      return /*#__PURE__*/ (0, u.jsx)(pd.Provider, { value: S, children: t })
    }
    function gd() {
      return /* @__PURE__ */ new Map()
    }
    function _d() {
      return /* @__PURE__ */ new Set()
    }
    function vd(e) {
      const t = /* @__PURE__ */ new Set(),
        n = [],
        r = []
      e.forEach((e, i) => {
        if (!i.isConnected) return
        const a = e.index,
          o = { index: a ?? -1, element: i, registration: e }
        a === null ? r.push(o) : a >= 0 && (t.add(a), n.push(o))
      })
      let i = 0
      return (
        r.sort((e, t) => xd(e.element, t.element)),
        r.forEach((e) => {
          for (; t.has(i);) i += 1
          ;((e.index = i), n.push(e), (i += 1))
        }),
        t.size > 0 && n.sort((e, t) => e.index - t.index),
        [n, r.map((e) => e.element)]
      )
    }
    function yd(e, t) {
      let n = e.parentElement
      for (; n && !n.contains(t);) n = n.parentElement
      return n
    }
    function bd(e) {
      for (const t of e) for (let e = 0; e < t.removedNodes.length; e += 1) if (t.removedNodes[e].isConnected) return !0
      return !1
    }
    function xd(e, t) {
      return e.nextElementSibling === t
        ? -1
        : t.nextElementSibling === e
          ? 1
          : e.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING
            ? -1
            : 1
    }
    function Sd(e) {
      const { nodeId: t, externalTree: n, rootContext: r } = e,
        i = r.useState(`referenceElement`),
        a = r.useState(`floatingElement`),
        o = r.useState(`domReferenceElement`),
        s = r.useState(`open`),
        c = r.useState(`floatingId`),
        [u, d] = l.useState(null),
        f = l.useRef(null),
        p = Sc(n),
        m = l.useMemo(() => ({ reference: i, floating: a, domReference: o }), [i, a, o]),
        h = Ql({ ...e, elements: { ...m, ...(u && { reference: u }) } }),
        g = l.useCallback(
          (e) => {
            let t = Ui(e)
              ? {
                  getBoundingClientRect: () => e.getBoundingClientRect(),
                  getClientRects: () => e.getClientRects(),
                  contextElement: e,
                }
              : e
            ;(d(t), h.refs.setReference(t))
          },
          [h.refs],
        ),
        _ = l.useMemo(() => ({ ...h.refs, setPositionReference: g, domReference: f }), [h.refs, g]),
        v = l.useMemo(() => ({ ...h.elements, domReference: o }), [h.elements, o]),
        y = l.useMemo(
          () => ({
            ...h,
            dataRef: r.context.dataRef,
            open: s,
            onOpenChange: r.setOpen,
            events: r.context.events,
            floatingId: c,
            refs: _,
            elements: v,
            nodeId: t,
            rootStore: r,
          }),
          [h, _, v, t, r, s, c],
        )
      return (
        Z(() => {
          o && (f.current = o)
        }, [o]),
        Z(() => {
          r.context.dataRef.current.floatingContext = y
          const e = p?.nodesRef.current.find((e) => e.id === t)
          e && (e.context = y)
        }),
        l.useMemo(() => ({ ...h, context: y, refs: _, elements: v, rootStore: r }), [h, _, v, y, r])
      )
    }
    const Cd = /*#__PURE__*/ l.createContext(void 0)
    function wd() {
      return l.useContext(Cd)?.direction ?? `ltr`
    }
    const Td = (e) => ({
        name: `arrow`,
        options: e,
        async fn(t) {
          const { x: n, y: r, placement: i, rects: a, platform: o, elements: s, middlewareData: c } = t,
            { element: l, padding: u = 0 } = Co(e, t) || {}
          if (l == null) return {}
          const d = Vo(u),
            f = { x: n, y: r },
            p = ko(i),
            m = Do(p),
            h = await o.getDimensions(l),
            g = p === `y`,
            _ = g ? `top` : `left`,
            v = g ? `bottom` : `right`,
            y = g ? `clientHeight` : `clientWidth`,
            b = a.reference[m] + a.reference[p] - f[p] - a.floating[m],
            x = f[p] - a.reference[p],
            S = s.floating[y] || a.floating[m],
            C = b / 2 - x / 2,
            w = S / 2 - h[m] / 2 - 1,
            T = Math.min(d[_], w),
            E = Math.min(d[v], w),
            D = T,
            O = S - h[m] - E,
            k = S / 2 - h[m] / 2 + C,
            A = So(D, k, O),
            j = !c.arrow && To(i) != null && k !== A && a.reference[m] / 2 - (k < D ? T : E) - h[m] / 2 < 0,
            M = j ? (k < D ? k - D : k - O) : 0
          return {
            [p]: f[p] + M,
            data: { [p]: A, centerOffset: k - A - M, ...(j && { alignmentOffset: M }) },
            reset: j,
          }
        },
      }),
      Ed = (e, t) => {
        const { name: n, fn: r } = Td(e)
        return { name: n, fn: r, options: [e, t] }
      },
      Dd = {
        name: `hide`,
        async fn(e) {
          const { width: t, height: n, x: r, y: i } = e.rects.reference,
            a = t === 0 && n === 0 && r === 0 && i === 0,
            o = await e.platform.detectOverflow(e, { elementContext: `reference` })
          return {
            data: { referenceHidden: o.top - n >= 0 || o.right - t >= 0 || o.bottom - n >= 0 || o.left - t >= 0 || a },
          }
        },
      },
      Od = { sideX: `left`, sideY: `top` },
      kd = `--available-width`,
      Ad = `--available-height`
    function jd(e, t, n) {
      const r = e === `inline-start` || e === `inline-end`
      return {
        top: `top`,
        right: r ? (n ? `inline-start` : `inline-end`) : `right`,
        bottom: `bottom`,
        left: r ? (n ? `inline-end` : `inline-start`) : `left`,
      }[t]
    }
    function Md(e, t, n) {
      const { rects: r, placement: i } = e
      return {
        side: jd(t, wo(i), n),
        align: To(i) || `center`,
        anchor: { width: r.reference.width, height: r.reference.height },
        positioner: { width: r.floating.width, height: r.floating.height },
      }
    }
    function Nd(e) {
      return Pd(e, Sd)
    }
    function Pd(e, t) {
      const {
          anchor: n,
          positionMethod: r = `absolute`,
          side: i = `bottom`,
          sideOffset: a = 0,
          align: o = `center`,
          alignOffset: s = 0,
          collisionBoundary: c,
          collisionPadding: u = 5,
          sticky: d = !1,
          arrowPadding: f = 5,
          disableAnchorTracking: p = !1,
          inline: m,
          keepMounted: h = !1,
          floatingRootContext: g,
          mounted: _,
          collisionAvoidance: v,
          shift: y,
          nodeId: b,
          adaptiveOrigin: x,
          lazyFlip: S = !1,
          externalTree: C,
        } = e,
        w = v.side || `flip`,
        T = v.align || `flip`,
        E = v.fallbackAxisSide || `end`,
        D = y?.crossAxis ?? !1,
        O = y?.rootBoundary,
        k = typeof n == `function` ? n : void 0,
        A = Q(k),
        j = k ? A : n,
        M = mi(n),
        N = mi(_),
        P = wd() === `rtl`,
        [F, I] = l.useState(null)
      !_ && F !== null && I(null)
      let L = S === `placement`,
        R = F ? wo(F) : null,
        z = F && L ? To(F) || `center` : null,
        B =
          R ||
          {
            top: `top`,
            right: `right`,
            bottom: `bottom`,
            left: `left`,
            "inline-end": P ? `left` : `right`,
            "inline-start": P ? `right` : `left`,
          }[i],
        ee = z || o,
        V = ee === `center` ? B : `${B}-${ee}`,
        H = u
      typeof H == `number`
        ? (H = { top: H, right: H, bottom: H, left: H })
        : (H &&= { top: H.top || 0, right: H.right || 0, bottom: H.bottom || 0, left: H.left || 0 })
      const U = +(i === `bottom`),
        te = +(i === `top`),
        ne = +(i === `right`),
        W = +(i === `left`),
        re = { boundary: c === `clipping-ancestors` ? `clippingAncestors` : c, padding: H },
        G = l.useRef(null),
        ie = mi(a),
        K = mi(s),
        q = typeof a == `function` ? 0 : a,
        ae = typeof s == `function` ? 0 : s,
        oe = []
      ;(m && oe.push(m),
        oe.push(
          $l(
            (e) => {
              const t = Md(e, i, P),
                n = typeof ie.current == `function` ? ie.current(t) : ie.current,
                r = typeof K.current == `function` ? K.current(t) : K.current
              return { mainAxis: n, crossAxis: r, alignmentAxis: r }
            },
            [q, ae, P, i],
          ),
        ))
      const se = T === `none` && w !== `shift`,
        ce = !se && (d || D || w === `shift`),
        le =
          w === `none`
            ? null
            : nu({
                ...re,
                padding: {
                  top: H.top + 1 + U,
                  right: H.right + 1 + W,
                  bottom: H.bottom + 1 + te,
                  left: H.left + 1 + ne,
                },
                mainAxis: !D && w === `flip`,
                crossAxis: T === `flip` && `alignment`,
                fallbackAxisSideDirection: E,
              }),
        ue = se
          ? null
          : eu(
              {
                ...re,
                rootBoundary: O,
                mainAxis: T !== `none`,
                crossAxis: ce,
                limiter:
                  d || D
                    ? void 0
                    : tu((e) => {
                        if (!G.current) return {}
                        let { width: t, height: n } = G.current.getBoundingClientRect(),
                          r = Oo(wo(e.placement)),
                          i = r === `y` ? t : n,
                          a = r === `y` ? H.left + H.right : H.top + H.bottom
                        return { offset: i / 2 + a / 2 }
                      }),
              },
              [re, d, D, O, H, T],
            )
      ;(w === `shift` || T === `shift` || ee === `center` ? oe.push(ue, le) : oe.push(le, ue),
        oe.push(
          ru({
            ...re,
            apply({ elements: { floating: e }, availableWidth: t, availableHeight: n, rects: r }) {
              if (!N.current) return
              const i = e.style
              ;(i.setProperty(kd, `${t}px`), i.setProperty(Ad, `${n}px`))
              const a = Bi(e).devicePixelRatio || 1,
                { x: o, y: s, width: c, height: l } = r.reference,
                u = (Math.round((o + c) * a) - Math.round(o * a)) / a,
                d = (Math.round((s + l) * a) - Math.round(s * a)) / a
              ;(i.setProperty(`--anchor-width`, `${u}px`), i.setProperty(`--anchor-height`, `${d}px`))
            },
          }),
          Ed(
            (e) => ({ element: G.current || ua(e.elements.floating).createElement(`div`), padding: G.current ? f : 0 }),
            [f],
          ),
          {
            name: `transformOrigin`,
            fn(e) {
              let {
                  elements: { floating: t },
                  middlewareData: n,
                  placement: r,
                  platform: o,
                  rects: s,
                  y: c,
                } = e,
                l = wo(r),
                u = To(r),
                d = Oo(l) === `y`,
                f = G.current,
                p = typeof a == `function` ? a(Md(e, i, P)) : a,
                m
              m =
                !f && u && Math.abs(d ? n.shift?.x || 0 : n.shift?.y || 0) <= 1
                  ? (u === `start`) === (d && o.isRTL?.(t) === !0)
                    ? `100%`
                    : `0%`
                  : `${(d ? n.arrow?.x || 0 : n.arrow?.y || 0) + (d ? f?.clientWidth || 0 : f?.clientHeight || 0) / 2}px`
              let h = l === `top` || l === `left` ? `calc(100% + ${p}px)` : `${-p}px`
              return (
                ce && d && Math.abs(n.shift?.y || 0) > p && (h = `${s.reference.y + s.reference.height / 2 - c}px`),
                t.style.setProperty(`--transform-origin`, d ? `${m} ${h}` : `${h} ${m}`),
                {}
              )
            },
          },
          Dd,
          x,
        ),
        Z(() => {
          !_ &&
            g &&
            g.update({
              referenceElement: null,
              floatingElement: null,
              domReferenceElement: null,
              positionReference: null,
            })
        }, [_, g]))
      const J = l.useMemo(
          () => ({
            ancestorScroll: !p,
            elementResize: !p && typeof ResizeObserver < `u`,
            layoutShift: !p && typeof IntersectionObserver < `u`,
          }),
          [p],
        ),
        {
          refs: de,
          elements: fe,
          x: pe,
          y: me,
          middlewareData: he,
          update: ge,
          placement: _e,
          context: ve,
          isPositioned: ye,
          floatingStyles: be,
        } = t({
          rootContext: g,
          open: h ? _ : void 0,
          placement: V,
          middleware: oe,
          strategy: r,
          whileElementsMounted: h ? void 0 : (...e) => Bl(...e, J),
          nodeId: b,
          externalTree: C,
        }),
        { sideX: xe, sideY: Se } = he.adaptiveOrigin || Od,
        Ce = ye ? r : `fixed`,
        we = l.useMemo(() => {
          let e
          return (
            (e = ye
              ? x
                ? { position: Ce, [xe]: pe, [Se]: me }
                : { ...be, position: Ce }
              : { position: Ce, top: 0, left: 0 }),
            (e[kd] = `100vw`),
            (e[Ad] = `100vh`),
            ye || (e.opacity = 0),
            e
          )
        }, [x, Ce, xe, pe, Se, me, be, ye]),
        Te = l.useRef(null)
      ;(Z(() => {
        if (!_) return
        const e = M.current,
          t = typeof e == `function` ? e() : e,
          n = (Fd(t) ? t.current : t) || null
        n !== Te.current && (de.setPositionReference(n), (Te.current = n))
      }, [_, de, j, M]),
        l.useEffect(() => {
          if (!_) return
          const e = M.current
          typeof e != `function` &&
            Fd(e) &&
            e.current !== Te.current &&
            (de.setPositionReference(e.current), (Te.current = e.current))
        }, [_, de, j, M]),
        l.useEffect(() => {
          if (h && _ && fe.reference && fe.floating) return Bl(fe.reference, fe.floating, ge, J)
        }, [h, _, fe, ge, J]))
      const Ee = wo(_e),
        De = jd(i, Ee, P),
        Oe = To(_e) || `center`,
        ke = !!he.hide?.referenceHidden
      Z(() => {
        S && _ && ye && (Ee !== B || (L && Oe !== ee)) && I(_e)
      }, [S, L, _, ye, _e, Ee, Oe, B, ee])
      const Ae = l.useMemo(() => ({ position: `absolute`, top: he.arrow?.y, left: he.arrow?.x }), [he.arrow]),
        je = he.arrow?.centerOffset !== 0
      return l.useMemo(
        () => ({
          positionerStyles: we,
          arrowStyles: Ae,
          arrowRef: G,
          arrowUncentered: je,
          side: De,
          align: Oe,
          physicalSide: Ee,
          anchorHidden: ke,
          refs: de,
          context: ve,
          isPositioned: ye,
          update: ge,
        }),
        [we, Ae, G, je, De, Oe, Ee, ke, de, ve, ye, ge],
      )
    }
    function Fd(e) {
      return e != null && `current` in e
    }
    const Id = /*#__PURE__*/ l.createContext(void 0)
    function Ld() {
      const e = l.useContext(Id)
      if (!e) throw Error(_i(59))
      return e
    }
    const Rd = /*#__PURE__*/ l.forwardRef(function (e, t) {
      let { cutout: n, ...r } = e,
        i
      if (n) {
        const e = n.getBoundingClientRect()
        i = `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${e.left}px ${e.top}px,${e.left}px ${e.bottom}px,${e.right}px ${e.bottom}px,${e.right}px ${e.top}px,${e.left}px ${e.top}px)`
      }
      return /*#__PURE__*/ (0, u.jsx)(`div`, {
        ref: t,
        role: `presentation`,
        "data-base-ui-inert": ``,
        ...r,
        style: { position: `fixed`, inset: 0, userSelect: `none`, WebkitUserSelect: `none`, clipPath: i },
      })
    })
    function zd(e, t) {
      e && Object.assign(e.style, t)
    }
    const Bd = { position: `relative`, maxHeight: `100%`, overflowX: `hidden`, overflowY: `auto` }
    function Vd(e) {
      return e === `starting` ? uc : Ii
    }
    function Hd(e, t, { styles: n, transitionStatus: r, props: i, refs: a, hidden: o, inert: s = !1 }) {
      const c = { ...n }
      return (
        s && (c.pointerEvents = `none`),
        rc(`div`, e, {
          state: t,
          ref: a,
          props: [{ role: `presentation`, hidden: o, style: c }, Vd(r), i],
          stateAttributesMapping: no,
        })
      )
    }
    let Ud = {},
      Wd = {},
      Gd = ``
    function Kd(e, t) {
      return Ki(e) ? e : t
    }
    function qd(e, t, n) {
      return /hidden|clip/.test(e.getComputedStyle(Kd(t, n)).overflowY)
    }
    function Jd(e) {
      if (typeof document > `u`) return !1
      const t = ua(e)
      return Bi(t).innerWidth - t.documentElement.clientWidth > 0
    }
    function Yd(e) {
      if (!(typeof CSS < `u` && CSS.supports && CSS.supports(`scrollbar-gutter`, `stable`)) || typeof document > `u`)
        return !1
      const t = ua(e),
        n = t.documentElement,
        r = t.body,
        i = Kd(n, r),
        a = i.style.overflowY,
        o = n.style.scrollbarGutter
      ;((n.style.scrollbarGutter = `stable`), (i.style.overflowY = `scroll`))
      const s = i.offsetWidth
      i.style.overflowY = `hidden`
      const c = i.offsetWidth
      return ((i.style.overflowY = a), (n.style.scrollbarGutter = o), s === c)
    }
    function Xd(e) {
      const t = ua(e),
        n = t.documentElement,
        r = t.body,
        i = Kd(n, r),
        a = { overflowY: i.style.overflowY, overflowX: i.style.overflowX }
      return (
        Object.assign(i.style, { overflowY: `hidden`, overflowX: `hidden` }),
        () => {
          Object.assign(i.style, a)
        }
      )
    }
    function Zd(e) {
      const t = ua(e),
        n = t.documentElement,
        r = t.body,
        i = Bi(n),
        a = 0,
        o = 0,
        s = !1,
        c = ha.create()
      if (Aa && (i.visualViewport?.scale ?? 1) !== 1) return () => {}
      function l() {
        const t = i.getComputedStyle(n),
          c = i.getComputedStyle(r),
          l = (t.scrollbarGutter || ``).includes(`both-edges`) ? `stable both-edges` : `stable`
        ;((a = n.scrollTop),
          (o = n.scrollLeft),
          (Ud = {
            scrollbarGutter: n.style.scrollbarGutter,
            overflowY: n.style.overflowY,
            overflowX: n.style.overflowX,
          }),
          (Gd = n.style.scrollBehavior),
          (Wd = {
            position: r.style.position,
            height: r.style.height,
            width: r.style.width,
            boxSizing: r.style.boxSizing,
            overflowY: r.style.overflowY,
            overflowX: r.style.overflowX,
            scrollBehavior: r.style.scrollBehavior,
          }))
        const u = n.scrollHeight > n.clientHeight,
          d = n.scrollWidth > n.clientWidth,
          f = t.overflowY === `scroll` || c.overflowY === `scroll`,
          p = t.overflowX === `scroll` || c.overflowX === `scroll`,
          m = Math.max(0, i.innerWidth - r.clientWidth),
          h = Math.max(0, i.innerHeight - r.clientHeight),
          g = parseFloat(c.marginTop) + parseFloat(c.marginBottom),
          _ = parseFloat(c.marginLeft) + parseFloat(c.marginRight),
          v = Kd(n, r)
        ;((s = Yd(e)),
          s
            ? ((n.style.scrollbarGutter = l), (v.style.overflowY = `hidden`), (v.style.overflowX = `hidden`))
            : (Object.assign(n.style, { scrollbarGutter: l, overflowY: `hidden`, overflowX: `hidden` }),
              (u || f) && (n.style.overflowY = `scroll`),
              (d || p) && (n.style.overflowX = `scroll`),
              Object.assign(r.style, {
                position: `relative`,
                height: g || h ? `calc(100dvh - ${g + h}px)` : `100dvh`,
                width: _ || m ? `calc(100vw - ${_ + m}px)` : `100vw`,
                boxSizing: `border-box`,
                overflowY: `hidden`,
                overflowX: `hidden`,
                scrollBehavior: `unset`,
              }),
              (r.scrollTop = a),
              (r.scrollLeft = o),
              n.setAttribute(`data-base-ui-scroll-locked`, ``),
              (n.style.scrollBehavior = `unset`)))
      }
      function u() {
        ;(Object.assign(n.style, Ud),
          Object.assign(r.style, Wd),
          s ||
            ((n.scrollTop = a),
            (n.scrollLeft = o),
            n.removeAttribute(`data-base-ui-scroll-locked`),
            (n.style.scrollBehavior = Gd)))
      }
      function d() {
        ;(u(), c.request(l))
      }
      l()
      const f = da(i, `resize`, d)
      return () => {
        ;(c.cancel(), u(), typeof i.removeEventListener == `function` && f())
      }
    }
    const Qd = new (class {
      lockCount = 0
      restore = null
      timeoutLock = _a.create()
      timeoutUnlock = _a.create()
      acquire(e) {
        return (
          (this.lockCount += 1),
          this.lockCount === 1 && this.restore === null && this.timeoutLock.start(0, () => this.lock(e)),
          this.release
        )
      }
      release = () => {
        ;(--this.lockCount, this.lockCount === 0 && this.restore && this.timeoutUnlock.start(0, this.unlock))
      }
      unlock = () => {
        this.lockCount === 0 && this.restore && (this.restore?.(), (this.restore = null))
      }
      lock(e) {
        if (this.lockCount === 0 || this.restore !== null) return
        const t = ua(e),
          n = t.documentElement,
          r = t.body,
          i = Bi(n)
        if (qd(i, n, r)) {
          const t = new i.MutationObserver(() => {
              qd(i, n, r) || (t.disconnect(), (this.restore = null), this.lock(e))
            }),
            a = { attributes: !0 }
          ;(t.observe(n, a), t.observe(r, a), (this.restore = () => t.disconnect()))
          return
        }
        const a = Ta || !Jd(e)
        this.restore = a ? Xd(e) : Zd(e)
      }
    })()
    function $d(e = !0, t = null) {
      Z(() => {
        if (e) return Qd.acquire(t)
      }, [e, t])
    }
    function ef(e, t, n, r) {
      const [i, a] = l.useState(!1)
      ;(Z(() => {
        if (!e || !t || n == null) {
          a(!1)
          return
        }
        const r = ua(n).documentElement.clientWidth,
          i = n.offsetWidth
        a(r > 0 && i > 0 && i >= r - 20)
      }, [e, t, n]),
        $d(e && (!t || i), r))
    }
    const tf = { position: `fixed` },
      nf = /*#__PURE__*/ l.forwardRef(function (e, t) {
        const {
            anchor: n,
            className: r,
            render: i,
            positionMethod: a,
            side: o,
            align: s,
            sideOffset: c,
            alignOffset: d,
            collisionBoundary: f = `clipping-ancestors`,
            collisionPadding: p,
            arrowPadding: m,
            sticky: h,
            disableAnchorTracking: g,
            alignItemWithTrigger: _ = !0,
            collisionAvoidance: v = dc,
            style: y,
            ...b
          } = e,
          x = ou(),
          S = su(),
          C = x.useState(`open`),
          w = x.useState(`mounted`),
          T = x.useState(`modal`),
          E = x.useState(`value`),
          D = x.useState(`openMethod`),
          O = x.useState(`positionerElement`),
          k = x.useState(`triggerElement`),
          A = x.useState(`isItemEqualToValue`),
          j = x.useState(`transitionStatus`),
          M = l.useRef(null),
          N = l.useRef(null),
          [P, F] = l.useState(_),
          I = w && P && D !== `touch`
        ;(!w && P !== _ && F(_),
          l.useImperativeHandle(x.context.alignItemWithTriggerActiveRef, () => I),
          ef((I || T) && C, D === `touch`, O, k))
        const L = Nd({
            anchor: n,
            floatingRootContext: S,
            positionMethod: a,
            mounted: w,
            side: o,
            sideOffset: c,
            align: s,
            alignOffset: d,
            arrowPadding: m,
            collisionBoundary: f,
            collisionPadding: p,
            sticky: h,
            disableAnchorTracking: g ?? I,
            collisionAvoidance: v,
            keepMounted: !0,
          }),
          R = I ? `none` : L.side,
          z = I ? tf : L.positionerStyles,
          B = { open: C, side: R, align: L.align, anchorHidden: L.anchorHidden }
        Z(() => {
          x.set(`popupSide`, L.side)
        }, [x, L.side])
        const ee = Hd(e, B, {
            styles: z,
            transitionStatus: j,
            props: b,
            refs: [t, x.useStateSetter(`positionerElement`)],
            hidden: !w,
            inert: !C,
          }),
          V = l.useRef(0),
          H = Q((e) => {
            if (x.context.valuesRef.current.length === 0) return
            let t = V.current
            V.current = e.size
            let n = co(lo)
            if (t !== 0 && !x.state.multiple && E !== null && wu(x.context.valuesRef.current, E, A) === -1) {
              let e = x.context.initialValueRef.current,
                t = e != null && wu(x.context.valuesRef.current, e, A) !== -1 ? e : null
              ;(x.context.setValue(t, n),
                t === null && (x.set(`selectedIndex`, null), (x.context.selectedItemTextRef.current = null)))
            }
            if (t !== 0 && x.state.multiple && Array.isArray(E)) {
              let e = E.filter((e) => wu(x.context.valuesRef.current, e, A) !== -1)
              e.length !== E.length &&
                (x.context.setValue(e, n),
                e.length === 0 && (x.set(`selectedIndex`, null), (x.context.selectedItemTextRef.current = null)))
            }
            if (C && I) {
              x.update({ scrollUpArrowVisible: !1, scrollDownArrowVisible: !1 })
              let e = { height: `` }
              ;(zd(O, e), zd(x.context.popupRef.current, e))
            }
          }),
          U = l.useMemo(
            () => ({
              ...L,
              side: R,
              alignItemWithTriggerActive: I,
              setControlledAlignItemWithTrigger: F,
              scrollUpArrowRef: M,
              scrollDownArrowRef: N,
            }),
            [L, R, I, F],
          )
        return /*#__PURE__*/ (0, u.jsx)(hd, {
          elementsRef: x.context.listRef,
          labelsRef: x.context.labelsRef,
          onMapChange: H,
          children: /*#__PURE__*/ (0, u.jsxs)(Id.Provider, {
            value: U,
            children: [w && T && /*#__PURE__*/ (0, u.jsx)(Rd, { inert: fd(!C), cutout: k }), ee],
          }),
        })
      }),
      rf = `base-ui-disable-scrollbar`,
      af = {
        className: rf,
        getElement(e) {
          return /*#__PURE__*/ (0, u.jsx)(`style`, {
            nonce: e,
            href: rf,
            precedence: `base-ui:low`,
            children: `.${rf}{scrollbar-width:none}.${rf}::-webkit-scrollbar{display:none}`,
          })
        },
      },
      of = /*#__PURE__*/ l.createContext(void 0)
    function sf(e) {
      const t = l.useContext(of)
      if (t === void 0 && !e) throw Error(_i(69))
      return t
    }
    const cf = /* @__PURE__ */ new Set([`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`]),
      lf = /*#__PURE__*/ l.createContext(void 0),
      uf = { disableStyleElements: !1 }
    function df() {
      return l.useContext(lf) ?? uf
    }
    const ff = `--transform-origin`,
      pf = { ...no, ...qa },
      mf = /*#__PURE__*/ l.forwardRef(function (e, t) {
        const { render: n, className: r, style: i, finalFocus: a, ...o } = e,
          s = ou(),
          c = s.useState(`multiple`),
          d = s.useState(`readOnly`),
          f = s.useState(`highlightItemOnHover`),
          p = su(),
          {
            side: m,
            align: h,
            alignItemWithTriggerActive: g,
            isPositioned: _,
            setControlledAlignItemWithTrigger: v,
          } = Ld(),
          y = sf(!0) != null,
          b = wd(),
          { nonce: x, disableStyleElements: S } = df(),
          C = s.useState(`id`),
          w = s.useState(`open`),
          T = s.useState(`openMethod`),
          E = s.useState(`mounted`),
          D = s.useState(`popupProps`),
          O = s.useState(`transitionStatus`),
          k = s.useState(`triggerElement`),
          A = s.useState(`positionerElement`),
          j = s.useState(`listElement`),
          M = l.useRef(!1),
          N = l.useRef(!1),
          P = l.useRef({}),
          F = ga(),
          I = Q((e) => {
            if (!A || !s.context.popupRef.current || !N.current) return
            let t = A.style.top === `0px`,
              n = A.style.bottom === `0px`
            if (M.current || !g || (!t && !n)) {
              s.context.handleScrollArrowVisibility(e)
              return
            }
            let r = _f(A),
              i = vf(A.getBoundingClientRect().height, `y`, r),
              a = ua(A),
              o = Bi(A),
              c = o.getComputedStyle(A),
              l = parseFloat(c.marginTop),
              u = parseFloat(c.marginBottom),
              d = hf(o.getComputedStyle(s.context.popupRef.current)),
              f = Math.min(a.documentElement.clientHeight - l - u, d),
              p = e.scrollTop,
              m = gf(e),
              h = null,
              _ = (e) => {
                A.style.height = `${e}px`
              },
              v = t ? m - p : p,
              y = Math.min(i + v, f)
            if (v <= 1) {
              let n = Gu(v, 0, f - i)
              ;(n > 0 && _(i + n),
                (e.scrollTop = t ? m : 0),
                f - (i + n) <= 1 && (M.current = !0),
                s.context.handleScrollArrowVisibility(e))
              return
            }
            f - y > 1 ? (h = t ? 1 / 0 : 0) : n && p < m && (h = p - (v - (i + v - f)))
            let b = Math.ceil(y)
            if ((b !== 0 && _(b), h != null)) {
              let t = Gu(h, 0, gf(e))
              Math.abs(e.scrollTop - t) > 1 && (e.scrollTop = t)
            }
            ;(b >= f - 1 && (M.current = !0), s.context.handleScrollArrowVisibility(e))
          })
        ;(l.useImperativeHandle(s.context.scrollHandlerRef, () => I, [I]),
          Vc({
            open: w,
            ref: s.context.popupRef,
            onComplete() {
              w && s.context.onOpenChangeComplete(!0)
            },
          }))
        const L = { open: w, transitionStatus: O, side: m, align: h }
        ;(Z(() => {
          A &&
            s.context.popupRef.current &&
            !Object.keys(P.current).length &&
            (P.current = {
              top: A.style.top || `0`,
              left: A.style.left || `0`,
              right: A.style.right,
              height: A.style.height,
              bottom: A.style.bottom,
              minHeight: A.style.minHeight,
              maxHeight: A.style.maxHeight,
              marginTop: A.style.marginTop,
              marginBottom: A.style.marginBottom,
            })
        }, [s, A]),
          Z(() => {
            w || g || ((N.current = !1), (M.current = !1), zd(A, P.current))
          }, [w, g, A]),
          Z(() => {
            const e = s.context.popupRef.current
            if (!w || !k || !A || !e || (g && !_) || s.state.transitionStatus === `ending`) return
            if (((N.current = !0), e.style.removeProperty(ff), !g)) {
              F.request(() => s.context.handleScrollArrowVisibility(j || e))
              return
            }
            const t = xf(e)
            try {
              let t = s.context.selectedItemTextRef.current
              t?.isConnected ||
                (t =
                  !s.select(`hasSelectedValue`) && s.context.firstItemTextRef.current?.isConnected
                    ? s.context.firstItemTextRef.current
                    : null)
              let n = s.context.valueRef.current,
                r = Bi(A),
                i = r.getComputedStyle(A),
                a = r.getComputedStyle(e),
                o = ua(k),
                c = _f(k),
                l = yf(k.getBoundingClientRect(), c),
                u = yf(A.getBoundingClientRect(), c),
                d = l.height,
                p = j || e,
                m = p.scrollHeight,
                h = parseFloat(a.borderBottomWidth),
                g = parseFloat(i.marginTop) || 10,
                _ = parseFloat(i.marginBottom) || 10,
                y = parseFloat(i.minHeight) || 100,
                x = hf(a),
                S = o.documentElement.clientHeight - g - _,
                C = o.documentElement.clientWidth,
                w = S - l.bottom + d,
                T,
                E = b === `rtl` ? l.right - u.width : l.left,
                D = 0
              if (t && n) {
                const e = yf(n.getBoundingClientRect(), c)
                ;((T = yf(t.getBoundingClientRect(), c)),
                  (E = u.left + (b === `rtl` ? e.right - T.right : e.left - T.left)))
                const r = e.top - l.top + e.height / 2
                D = T.top - u.top + T.height / 2 - r
              }
              const O = w + D + _ + h,
                N = Math.min(S, O),
                F = S - g - _,
                I = O - N,
                L = C - 5
              ;((A.style.left = `${Gu(E, 5, L - u.width)}px`),
                (A.style.height = `${N}px`),
                (A.style.maxHeight = `none`),
                (A.style.marginTop = `${g}px`),
                (A.style.marginBottom = `${_}px`),
                (e.style.height = `100%`))
              const R = gf(p),
                z = I >= R - 1
              z && (N = Math.min(S, u.height) - (I - R))
              const B = l.top < 20 || l.bottom > S - 20 || Math.ceil(N) + 1 < Math.min(m, y),
                ee = (r.visualViewport?.scale ?? 1) !== 1 && Aa
              if (B || ee) {
                ;(zd(A, P.current), v(!1))
                return
              }
              const V = Math.max(y, N)
              if (z) {
                const e = Math.max(0, S - O)
                ;((A.style.top = u.height >= F ? `0` : `${e}px`), (A.style.height = `${N}px`), (p.scrollTop = gf(p)))
              } else ((A.style.bottom = `0`), (p.scrollTop = I))
              if (T) {
                const t = u.top,
                  n = u.height,
                  r = T.top + T.height / 2,
                  i = Gu(n > 0 ? ((r - t) / n) * 100 : 50, 0, 100)
                e.style.setProperty(ff, `50% ${i}%`)
              }
              ;((V === S || N >= x) && (M.current = !0),
                s.context.handleScrollArrowVisibility(p),
                f &&
                  s.state.selectedIndex === null &&
                  s.state.activeIndex === null &&
                  s.context.listRef.current[0] != null &&
                  s.set(`activeIndex`, 0))
            } finally {
              t()
            }
          }, [s, w, A, k, g, v, F, j, f, b, _]),
          l.useEffect(() => {
            if (!g || !A || !w) return
            const e = Bi(A)
            function t(e) {
              s.context.setOpen(!1, co(`window-resize`, e))
            }
            return da(e, `resize`, t)
          }, [s, g, A, w]))
        const R = {
            ...(j
              ? { role: `presentation` }
              : {
                  role: `listbox`,
                  "aria-multiselectable": c || void 0,
                  "aria-readonly": d || void 0,
                  id: `${C}-list`,
                }),
            onKeyDown(e) {
              y && cf.has(e.key) && e.stopPropagation()
            },
            onScroll(e) {
              j || I(e.currentTarget)
            },
            ...(g && { style: j ? { height: `100%` } : Bd }),
            className: !j && g ? af.className : void 0,
          },
          z = rc(`div`, e, {
            ref: [t, s.context.popupRef],
            state: L,
            stateAttributesMapping: pf,
            props: [D, R, Vd(O), o],
          })
        return /*#__PURE__*/ (0, u.jsxs)(l.Fragment, {
          children: [
            !S && af.getElement(x),
            /*#__PURE__*/ (0, u.jsx)(jc, {
              context: p,
              modal: !1,
              disabled: !E,
              openInteractionType: T,
              returnFocus: a,
              restoreFocus: !0,
              children: z,
            }),
          ],
        })
      })
    function hf(e) {
      const t = e.maxHeight
      return (t.endsWith(`px`) && parseFloat(t)) || 1 / 0
    }
    function gf(e) {
      return Ku(e.scrollHeight, e.clientHeight)
    }
    function _f(e) {
      return Ll.getScale(e)
    }
    function vf(e, t, n) {
      return e / n[t]
    }
    function yf(e, t) {
      return Ho({ x: vf(e.x, `x`, t), y: vf(e.y, `y`, t), width: vf(e.width, `x`, t), height: vf(e.height, `y`, t) })
    }
    const bf = [
      [`transform`, `none`],
      [`scale`, `1`],
      [`translate`, `0 0`],
    ]
    function xf(e) {
      const { style: t } = e,
        n = {}
      for (const [e, r] of bf) ((n[e] = t.getPropertyValue(e)), t.setProperty(e, r, `important`))
      return () => {
        for (const [e] of bf) {
          const r = n[e]
          r ? t.setProperty(e, r) : t.removeProperty(e)
        }
      }
    }
    const Sf = /*#__PURE__*/ l.forwardRef(function (e, t) {
      const { render: n, className: r, style: i, ...a } = e,
        o = ou(),
        s = o.useState(`multiple`),
        c = o.useState(`readOnly`),
        { alignItemWithTriggerActive: l } = Ld(),
        u = o.useState(`hasScrollArrows`),
        d = o.useState(`openMethod`),
        f = {
          id: `${o.useState(`id`)}-list`,
          role: `listbox`,
          "aria-multiselectable": s || void 0,
          "aria-readonly": c || void 0,
          onScroll(e) {
            o.context.scrollHandlerRef.current?.(e.currentTarget)
          },
          ...(l && { style: Bd }),
          className: u && d !== `touch` ? af.className : void 0,
        }
      return rc(`div`, e, { ref: [t, o.useStateSetter(`listElement`)], props: [f, a] })
    })
    function Cf(e = {}) {
      const { guess: t, label: n, metadata: r, textRef: i, index: a } = e,
        { register: o, unregister: s, subscribeMapChange: c, nextIndexRef: u } = md(),
        d = l.useRef(-1),
        [f, p] = l.useState(
          a == null && t
            ? () => {
                if (d.current === -1) {
                  let e = u.current
                  ;((u.current += 1), (d.current = e))
                }
                return d.current
              }
            : -1,
        ),
        m = a ?? f,
        h = l.useRef(null),
        g = l.useCallback(
          (e) => {
            let t = h.current
            ;(t && s(t), (h.current = e), e && o(e, { metadata: r ?? null, index: a ?? null, label: n, textRef: i }))
          },
          [a, o, s, r, n, i],
        )
      return (
        Z(() => {
          if (a == null)
            return c((e) => {
              const t = h.current ? e.get(h.current)?.index : null
              t != null && p(t)
            })
        }, [a, c]),
        { ref: g, index: m }
      )
    }
    const wf = /*#__PURE__*/ l.createContext(void 0)
    function Tf() {
      const e = l.useContext(wf)
      if (!e) throw Error(_i(57))
      return e
    }
    const Ef = /*#__PURE__*/ l.memo(
        /*#__PURE__*/ l.forwardRef(function (e, t) {
          const {
              render: n,
              className: r,
              style: i,
              value: a = null,
              label: o,
              disabled: s = !1,
              nativeButton: c = !1,
              ...d
            } = e,
            f = l.useRef(null),
            p = Cf({ guess: !0, label: o, textRef: f }),
            m = ou(),
            { props: h, multiple: g, disabled: _, readOnly: v, isItemEqualToValue: y } = m.useState(`itemRoot`),
            b = _ || s,
            x = m.useState(`isActive`, p.index),
            S = m.useState(`open`),
            C = m.useState(`isSelected`, a),
            w = m.useState(`isSelectedByFocus`, p.index),
            T = p.index,
            E = l.useRef(null)
          ;(Z(() => {
            const e = m.context.valuesRef.current
            return (
              (e[T] = a),
              () => {
                delete e[T]
              }
            )
          }, [T, a, m]),
            Z(() => {
              let e = m.state.value,
                t = m.state.selectedIndex,
                n = t,
                r
              ;(g && Array.isArray(e)
                ? ((n = Du(T, a, m.context.valuesRef.current, e, y, t)),
                  (r = n === T),
                  T === t && !r && (m.context.selectedItemTextRef.current = null))
                : ((r = e !== void 0 && xu(a, e, y)), r && (n = T)),
                m.set(`selectedIndex`, n),
                r && f.current && (m.context.selectedItemTextRef.current = f.current))
            }, [T, g, y, m, a]))
          const D = l.useRef(`mouse`),
            O = l.useRef(!1),
            { getButtonProps: k, buttonRef: A } = rd({
              disabled: b,
              focusableWhenDisabled: !0,
              native: c,
              composite: !0,
            }),
            j = { disabled: b, selected: C, highlighted: x }
          function M(e) {
            if (_ || v) return
            const t = m.state.value
            if (g) {
              const n = Array.isArray(t) ? t : [],
                r = C ? Ou(n, a, y) : [...n, a]
              m.context.setValue(r, co(fo, e))
            } else (m.context.setValue(a, co(fo, e)), m.context.setOpen(!1, co(fo, e)))
          }
          function N() {
            m.context.selectionRef.current.dragY = 0
          }
          const P = {
              role: `option`,
              "aria-selected": C,
              tabIndex: S && x ? 0 : -1,
              onKeyDown(e) {
                ;(m.set(`activeIndex`, T), e.key === ` ` && m.context.typingRef.current && e.preventDefault())
              },
              onClick(e) {
                let t = D.current !== `touch`,
                  n = e.nativeEvent.pointerType,
                  r = t && Fa(e.nativeEvent) && (n !== void 0 || x),
                  i = t && !r && !O.current
                ;((O.current = !1), !(b || i) && M(e.nativeEvent))
              },
              onPointerEnter(e) {
                D.current = e.pointerType
              },
              onPointerMove(e) {
                if (e.pointerType === `mouse` && e.buttons === 1) {
                  let t = m.context.selectionRef.current
                  ;((t.dragY += e.movementY), t.dragY ** 2 >= 64 && (t.allowUnselectedMouseUp = !0))
                }
              },
              onPointerDown(e) {
                ;((D.current = e.pointerType), (O.current = !0), N())
              },
              onMouseUp() {
                if ((N(), b || D.current === `touch` || O.current)) return
                let e = !m.context.selectionRef.current.allowSelectedMouseUp && C,
                  t = !m.context.selectionRef.current.allowUnselectedMouseUp && !C
                e || t || ((O.current = !0), E.current?.click(), (O.current = !1))
              },
            },
            F = rc(`div`, e, { ref: [A, t, p.ref, E], state: j, props: [h, P, d, k] }),
            I = l.useMemo(() => ({ selected: C, index: T, textRef: f, selectedByFocus: w }), [C, T, f, w])
          return /*#__PURE__*/ (0, u.jsx)(wf.Provider, { value: I, children: F })
        }),
      ),
      Df = /*#__PURE__*/ l.memo(
        /*#__PURE__*/ l.forwardRef(function (e, t) {
          const { render: n, className: r, style: i, keepMounted: a, selected: o, ...s } = e,
            c = l.useRef(null),
            { transitionStatus: u, setMounted: d } = Ic(o),
            f = rc(`span`, e, {
              ref: [t, c],
              state: { selected: o, transitionStatus: u },
              props: [{ "aria-hidden": !0, children: `✔️` }, s],
              stateAttributesMapping: qa,
            })
          return (
            Vc({
              batch: !0,
              enabled: !o,
              open: o,
              ref: c,
              onComplete() {
                o || d(!1)
              },
            }),
            f
          )
        }),
      ),
      Of = /*#__PURE__*/ l.forwardRef(function (e, t) {
        const { selected: n } = Tf()
        return e.keepMounted || n ? /*#__PURE__*/ (0, u.jsx)(Df, { ...e, selected: n, ref: t }) : null
      }),
      kf = /*#__PURE__*/ l.memo(
        /*#__PURE__*/ l.forwardRef(function (e, t) {
          const { index: n, textRef: r, selectedByFocus: i } = Tf(),
            a = ou(),
            { render: o, className: s, style: c, ...u } = e
          return rc(`div`, e, {
            ref: [
              l.useCallback(
                (e) => {
                  e &&
                    (n === 0 && (a.context.firstItemTextRef.current = e),
                    i && (a.context.selectedItemTextRef.current = e))
                },
                [a, n, i],
              ),
              t,
              r,
            ],
            props: u,
          })
        }),
      ),
      Af = /*#__PURE__*/ l.forwardRef(function (e, t) {
        const { render: n, className: r, style: i, direction: a, keepMounted: o, ...s } = e,
          c = a === `up`,
          l = ou(),
          { side: u, scrollDownArrowRef: d, scrollUpArrowRef: f } = Ld(),
          p = c ? `scrollUpArrowVisible` : `scrollDownArrowVisible`,
          m = l.useState(p),
          h = l.useState(`openMethod`),
          g = m && h !== `touch`,
          _ = va(),
          v = c ? f : d,
          { mounted: y, transitionStatus: b, setMounted: x } = Ic(g)
        ;(Z(
          () => (
            (l.context.scrollArrowsMountedCountRef.current += 1),
            l.set(`hasScrollArrows`, !0),
            () => {
              ;((l.context.scrollArrowsMountedCountRef.current = Math.max(
                0,
                l.context.scrollArrowsMountedCountRef.current - 1,
              )),
                l.context.scrollArrowsMountedCountRef.current === 0 && l.set(`hasScrollArrows`, !1))
            }
          ),
          [l],
        ),
          Vc({
            open: g,
            ref: v,
            onComplete() {
              g || x(!1)
            },
          }))
        const S = rc(`div`, e, {
          ref: [t, v],
          state: { direction: a, visible: g, side: u, transitionStatus: b },
          props: [
            {
              "aria-hidden": !0,
              children: c ? `▲` : `▼`,
              style: { position: `absolute` },
              onMouseMove(e) {
                if ((e.movementX === 0 && e.movementY === 0) || _.isStarted()) return
                l.set(`activeIndex`, null)
                function t() {
                  let e = l.state.listElement ?? l.context.popupRef.current
                  if (!e) return
                  ;(l.set(`activeIndex`, null), l.context.handleScrollArrowVisibility(e))
                  let n = Ku(e.scrollHeight, e.clientHeight),
                    r = qu(e.scrollTop, n),
                    i = r === (c ? 0 : n),
                    a = l.context.listRef.current
                  if ((r !== e.scrollTop && (e.scrollTop = r), i)) _.clear()
                  else {
                    if (a.length > 0) {
                      let t = v.current?.offsetHeight || 0
                      e.scrollTop = jf(a, c, r, e.clientHeight, t, n)
                    }
                    _.start(40, t)
                  }
                }
                _.start(40, t)
              },
              onMouseLeave() {
                _.clear()
              },
            },
            s,
          ],
          stateAttributesMapping: qa,
        })
        return y || o ? S : null
      })
    function jf(e, t, n, r, i, a) {
      if (t) {
        const t = 0,
          r = n + i - 1
        for (let n = 0; n < e.length; n += 1) {
          const i = e[n]
          if (i && i.offsetTop >= r) {
            t = n
            break
          }
        }
        const o = Math.max(0, t - 1),
          s = e[o]
        return o < t && s ? qu(s.offsetTop - i, a) : 0
      }
      const o = e.length - 1,
        s = n + r - i + 1
      for (let t = 0; t < e.length; t += 1) {
        const n = e[t]
        if (n && n.offsetTop + n.offsetHeight > s) {
          o = Math.max(0, t - 1)
          break
        }
      }
      const c = Math.min(e.length - 1, o + 1),
        l = e[c]
      return c > o && l ? qu(l.offsetTop + l.offsetHeight - r + i, a) : a
    }
    const Mf = /*#__PURE__*/ l.forwardRef(function (e, t) {
        return /*#__PURE__*/ (0, u.jsx)(Af, { ...e, ref: t, direction: `down` })
      }),
      Nf = /*#__PURE__*/ l.forwardRef(function (e, t) {
        return /*#__PURE__*/ (0, u.jsx)(Af, { ...e, ref: t, direction: `up` })
      }),
      Pf = [
        [
          `path`,
          {
            d: `M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7`,
            stroke: `currentColor`,
            strokeLinecap: `round`,
            strokeLinejoin: `round`,
            strokeWidth: `1.5`,
            key: `0`,
          },
        ],
      ],
      Ff = [
        [
          `path`,
          {
            d: `M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9`,
            stroke: `currentColor`,
            strokeLinecap: `round`,
            strokeLinejoin: `round`,
            strokeWidth: `1.5`,
            key: `0`,
          },
        ],
      ],
      If = [
        [
          `path`,
          {
            d: `M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15`,
            stroke: `currentColor`,
            strokeLinecap: `round`,
            strokeLinejoin: `round`,
            strokeWidth: `1.5`,
            key: `0`,
          },
        ],
      ],
      Lf = { xmlns: `http://www.w3.org/2000/svg`, width: 24, height: 24, viewBox: `0 0 24 24`, fill: `none` },
      Rf = (0, l.forwardRef)(
        (
          {
            color: e = `currentColor`,
            size: t = 24,
            strokeWidth: n,
            absoluteStrokeWidth: r = !1,
            className: i = ``,
            altIcon: a,
            showAlt: o = !1,
            icon: s,
            primaryColor: c,
            secondaryColor: u,
            disableSecondaryOpacity: d = !1,
            ...f
          },
          p,
        ) => {
          const m = n === void 0 ? void 0 : r ? (Number(n) * 24) / Number(t) : n,
            h = m === void 0 ? {} : { strokeWidth: m, stroke: `currentColor` },
            g = { ref: p, ...Lf, width: t, height: t, color: c || e, className: i, ...h, ...f },
            _ = [...(o && a ? a : s)]
              .sort(([, e], [, t]) => {
                let n = e.opacity !== void 0
                return t.opacity === void 0 ? (n ? -1 : 0) : 1
              })
              .map(([t, n]) => {
                let r = n.opacity !== void 0,
                  i = r && !d ? n.opacity : void 0,
                  a = u ? { ...(n.stroke === void 0 ? { fill: r ? u : c || e } : { stroke: r ? u : c || e }) } : {}
                return (0, l.createElement)(t, { ...n, ...h, ...a, opacity: i, key: n.key })
              })
          return (0, l.createElement)(`svg`, g, _)
        },
      )
    Rf.displayName = `HugeiconsIcon`
    const zf = (e, t = 0) => {
        const n = new Int32Array(e.length)
        for (let r = 0; r < e.length; r++) n[r] = e.charCodeAt(r) - 48 - t
        return n
      },
      Bf = (e) => {
        const t = new Int32Array(e.length + 1)
        for (let n = 0; n < e.length; n++) t[n + 1] = t[n] + e[n]
        return t
      },
      Vf = (e) => {
        let t = new Int32Array(e.length),
          n = 0
        for (let r = 0; r < e.length; r++) {
          const i = e.charCodeAt(r) - 48
          ;((n += (i >>> 1) ^ -(i & 1)), (t[r] = n))
        }
        return t
      },
      Hf = [],
      Uf = Bf(
        zf(
          `E0500002005282000000002000150000020021820000011200000003022202000300004200120000200420001200021200301200010400162000010000220021010:2192001200220012000220012000200200200400010200040000000000400200108200110100000022010313000162002000020020012020080213000228200000000082000000000120002000120020020040101020300130001001010`,
        ),
      ),
      Wf = Bf(
        zf(
          `:11111111211111119311546544411119731869:671397415686432441111111111161114151214313433415:78311132233313187211117221449443411141111151152226611131111112212518142224214215421421542142424242516171151615616347111111111197911327451111111111111111111113134714133513411111311111111111111111111112444411111342312715245411117:3`,
        ),
      ),
      Gf = (() => {
        const e = Uf.length - 1,
          t = new Int32Array(e)
        for (let n = e - 1; n >= 0; n--) {
          let e = 1,
            r = n + 1
          for (let i = Uf[n]; i < Uf[n + 1]; i++) ((e += t[r]), (r += t[r]))
          t[n] = e
        }
        let n = new Int32Array(Uf[e]),
          r = 0
        for (let i = 0; i < e; i++) {
          let e = i + 1
          for (let a = Uf[i]; a < Uf[i + 1]; a++) ((n[r++] = e), (e += t[e]))
        }
        return n
      })(),
      Kf = zf(
        `02000000000000900<=0?000B000F00F00ŏI0J0LNPRTVX0000]_a00000000000000000000000rst0000000zŏ00000000000ŏ0000000ŏ00000000000000000000000000000000000000000000000000000000000000Ë000000000000000000000Þ000000000000000000ð0000000ø0ùúûüýþÿĀāĂăĄąĆ000000000000000000000000000000000000000000ħ0ĨĪ00000000000000000000ļĽ00000Ŭ000000`,
        1,
      ),
      qf = Bf(zf(`123333359346463635126536711576`)),
      Jf = zf(
        `93203242332583253248325D>E?F@03263243255B:032523853:0325B:8GA032542H<C=12727B:0328432553;D>E?3257D>032585:0325B:;0328B:032`,
      ),
      Yf = zf(
        `012113445661666666789111:5;;;;;;;;444;;;:62999<1161=62>>?61:21@ABCD4446996:64E:::;:?::64:F114GHHIHHHHIHH1HH1HH1HHHHHH::EEJ4444::EE4444441691;644444114244444:;K6666555555555555555999666664444444444444444444444226?6:66644L9M?D:111::::6DE199`,
      ),
      Xf = Vf(
        `020200202020020020020020020020200200200200200200200002020202001003040106000200200200200200200200200200200200200200200200200200200200200200200200200200200200020020020020020020002020200202002002002002002002002002002020002002020020200220200200200200200200200200200200020020020000200020002000200200200020020020002000200200200020020202002020202000200200020022000200200020020002002000200220002002000200W0Z00020020002002020002002000200g0j0002002000200200020020002002000200200020020002000200002000002002002002002000200020000200002002002002002002002020020020200200200200200200200200202020020020020020020020020002002002020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020002002002002002002000200200200200200200200200200020202020002000200020002002002002000020200200`,
      ),
      Zf = (() => {
        const e = /* @__PURE__ */ new Int32Array(319).fill(-1),
          t = Vf(
            `02422242:222222242224222242442222222422222244442242226224222426222422442462222422622222222626222462242622422622422424242422222222422222222242422222222222222222622442224222222222222224424442262222222222222222222226224222424242422224422422422222`,
          ),
          n = Vf(
            `02222222222222222222202222222222222222222222221422222222222222222222222222222222222Y\\222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222221422222222222222222222222222222222222222Ŀł222222222222222222`,
          )
        for (let r = 0; r < t.length; r++) e[t[r]] = n[r]
        return e
      })(),
      Qf =
        `container |break-after- all auto avoid avoid-page column left page right|break-before- all auto avoid avoid-page column left page right|break-inside-a uto void void-column void-page|box-decoration- clone slice|box- border content| contents flow-root hidden table table-caption table-cell table-column table-column-group table-footer-group table-header-group table-row table-row-group| not-sr-only sr-only|float- end left none right start|clear- both end left none right start|isolat e ion-auto|overflow- auto clip hidden scroll visible|overflow-x- auto clip hidden scroll visible|overflow-y- auto clip hidden scroll visible|overscroll- auto contain none|overscroll-x- auto contain none|overscroll-y- auto contain none| absolute fixed relative static sticky| collapse invisible visible|justify- around baseline between center center-safe end end-safe evenly normal start stretch|justify-items- center center-safe end end-safe normal start stretch|justify-self- auto center center-safe end end-safe start stretch|items- baseline baseline-last center center-safe end end-safe start stretch|self- auto baseline baseline-last center center-safe end end-safe start stretch|place-content- around baseline between center center-safe end end-safe evenly start stretch|place-items- baseline center center-safe end end-safe start stretch|place-self- auto center center-safe end end-safe start stretch| antialiased subpixel-antialiased| italic not-italic|normal-nums |ordinal |slashed-zero | lining-nums oldstyle-nums| proportional-nums tabular-nums| diagonal-fractions stacked-fractions| no-underline overline| capitalize lowercase normal-case uppercase|truncate |whitespace- break-spaces normal nowrap pre pre-line pre-wrap|break- all keep normal words|wrap- anywhere break-word normal|hyphens- auto manual none|mix-blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay plus-darker plus-lighter saturation screen soft-light|table- auto fixed|caption- bottom top|backface- hidden visible|appearance- auto none|scheme- dark light light-dark normal only-dark only-light|field-sizing- content fixed|pointer-events- auto none|resize  -none -x -y|snap- align-none center end start|snap- always normal|snap- both none x y|snap- mandatory proximity|touch- auto manipulation none|touch-pan- left right x|touch-pan- down up y|touch-pinch-zoom |select- all auto none text|forced-color-adjust- auto none| normal size| baseline bottom middle sub super text-bottom text-top top| bounce none ping pulse spin| auto square video| auto fr max min px|none | auto full px| fixed local scroll|clip- border content padding text|origin- border content padding| bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| no-repeat repeat repeat-round repeat-space repeat-x repeat-y| auto contain cover|blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay saturation screen soft-light|to- b bl br l r t tl tr| auto dvh fit full lh lvh max min px screen svh| dashed dotted double hidden none solid| collapse separate|px |auto |full | content none strict| inline-size size|layout |paint |style | around baseline between center center-safe end end-safe evenly normal start stretch| alias all-scroll auto cell col-resize context-menu copy crosshair default e-resize ew-resize grab grabbing help move n-resize ne-resize nesw-resize no-drop none not-allowed ns-resize nw-resize nwse-resize pointer progress row-resize s-resize se-resize sw-resize text vertical-text w-resize wait zoom-in zoom-out| dashed dotted double solid wavy| auto from-font|reverse |initial | in in-out initial linear out| col col-reverse row row-reverse| nowrap wrap wrap-reverse| auto initial none| black bold extrabold extralight light medium normal semibold thin| condensed expanded extra-condensed extra-expanded normal semi-condensed semi-expanded ultra-condensed ultra-expanded|flow- col col-dense dense row row-dense| none subgrid| auto dvh dvw fit full lh lvh lvw max min px screen svh svw| block flex grid table| auto dvw fit full lvw max min px screen svw| loose none normal px relaxed snug tight|through |item | inside outside| decimal disc none| auto px| clip-border clip-content clip-fill clip-padding clip-stroke clip-view no-clip| add exclude intersect subtract| alpha luminance match|origin- border content fill padding stroke view|type- alpha luminance| circle ellipse| closest-corner closest-side farthest-corner farthest-side|at- bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| dvh fit full lh lvh max min none px screen svh| auto dvh dvw fit full lh lvh lvw max min none px screen svh svw| dvw fit full lvw max min none px screen svw| auto dvh dvw fit full lvh lvw max min none prose px svh svw| auto dvh dvw fit full lvh lvw max min none px screen svh svw| contain cover fill none scale-down| first last none| distant dramatic midrange near none normal|inset | full none|3d | auto smooth|gutter- auto both stable| auto none thin| inner none| auto dvh dvw fit full lvh lvw max min px svh svw|base | center end justify left right start| clip ellipsis| balance nowrap pretty wrap| normal tight tighter wide wider widest| cpu gpu none| 3d flat| all colors none opacity shadow transform| discrete normal| full px| auto dvh dvw fit full lvh lvw max min px screen svh svw| auto contents scroll transform`
          .split(`|`)
          .map((e) => {
            const t = e.split(` `),
              n = t.shift()
            for (let e = 0; e < t.length; e++) t[e] = n + t[e]
            return t
          }),
      $f = Vf(
        `0000000000000000000000000000000000000000000000000000000000000262242:6@200000006:240B428:4422400002046044222426220026642642462026224222824220022400000000\\00N222422242222222224062242222222422226264222422222222222222442804222422222222222222222222220<4<0204260002444020204224422`,
      ),
      ep = Vf(
        `ɠ222222222222222222222222222222222222222222222222222222222222˕4222226>6ʰ22ʷʺʷʺʷ42ʴ2ʓ22>621422ɶ222ɹɼɷɺɷɺ22ɱ42222ɨ2ɧ26622ɘɓ244ƸƵ222]d24242ǖǓƚÄȫ2263ȨȥȨ2222222ǣ222222222222222222ǂƽ2ƾƵ2222222422222ƜƑ22222222222222222222144Ŧţ22Ţş222222222222222222222ĸ2ı68ĦģĦɡŰ4Ġ«®ĝ822ĔđĔ2ē2222622`,
      ),
      tp = Vf(
        `02222222222222222222222222222222222222222222222222222222222222222202021422222222CF2200GJ021042222WZ222IL0ad2c10h2222U00X202[^2w0000120zy|}22:22z22222222222G000qOVI00000{2<40000@00000G¦§000ª00000000000000021K¬«00®000000000000000000000222HGH_1¸222½2¾2222ÇÊ000­°2±`,
      ),
      np = /* @__PURE__ */ new Int32Array(987),
      rp = /* @__PURE__ */ new Int32Array(987),
      ip = /* @__PURE__ */ new Int32Array(987)
    let ap = ``
    const op = /* @__PURE__ */ new Int32Array(1022)
    {
      let e = /* @__PURE__ */ new Map(),
        t = 0,
        n = 0
      for (let r = 0; r < $f.length; r++)
        for (const i of Qf[tp[r]]) {
          let a = e.get(i)
          ;(a === void 0 && ((a = t++), e.set(i, a), (op[a * 2] = ap.length), (op[a * 2 + 1] = i.length), (ap += i)),
            (np[n] = $f[r]),
            (rp[n] = ep[r]),
            (ip[n] = a),
            n++)
        }
    }
    const sp = Vf(`0b2N:222@R>F@286¦2@H2D266226FB22B2>BD\\6N22222Z222D222p`),
      cp = Bf(zf(`1::24444432:442:44:44>222222:44:4421322511111311111114`)),
      lp = Vf(
        `24A;33N=C@H4A;33N=C@<27;83:;8393NQ:3NQʰ222ˉºŴŽ2R2=18cƴÅŇ=cĞÛC1ƈǝȈ:ħ25=11D3A@4=<1;1DEr25;11B3?<6;:371BCn9@7=<8192>2E121@9@EHE@9>2T25511<398454131<=V25511<398454131<=ƧNž2Đå242L222290000f22500ɛ000ǘ222`,
      ),
      up = zf(`ĳ`),
      dp = zf(``),
      fp = zf(`1`)
    const pp = {
      GROUP_COUNT: 384,
      customValidatorNames: Hf,
      edgeStart: Uf,
      labelStart: Wf,
      labelText: `@containerabcdefghinlmoprstunderlineviawzccentlignnimatespectuto-colsrowsaglorightnessckdrop-sisbcontrastfiltergrayscalehue-rotateinvertopacityslurrightnessaturateepia-coniclinearpositionradialsizeockurrderttom-belrstxyespacing-xyaretoursorlnt-umnsendspantartainentrasteividerop-shadowurationcorationlay-xyasendillexontromlter-featuresstretchapr-xyayscaleidow-colsrowsue-rotatedentlinesetvert-beringsxyeshadoweiadingftnest-clamp-imageabein-lrstxyskx--b-coniclpositionrsizet-x-y-fromto-fromto-inearfromto-fromto-adialfromto-fromtofromtofromtofromtoblockhinlinew-screenesblockhinlinewbjectpacityrutlinederigin-offsetbelrstxyesrspective-originaceholderioghtng-offsettateundedw-xyz-belrstlreseslr-endspantartaturatecepiahizekewpace-taleroll-xyz-barmpbelrstxyesbelrstxyes-thumbrackadowrink-xyxyartrokeabextora-shadowpckingnsformitionlate-xyz-offsetill-changeoom`,
      edgeTarget: Gf,
      nodeGroup: Kf,
      nodeVlist: Zf,
      vlistPat: qf,
      vlistOps: Jf,
      vlistRef: Yf,
      vlistGroup: Xf,
      litAnchor: np,
      litGroup: rp,
      litPool: ip,
      poolOffsets: op,
      poolText: ap,
      adjGid: sp,
      adjStart: cp,
      adjTgt: lp,
      patGid: up,
      patTgt: dp,
      postfixLookupGroups: fp,
      orderSensitiveModifiers: `* ** after backdrop before details-content file first-letter first-line marker placeholder selection`,
    }
    const mp = `line` in /* @__PURE__ */ Error(),
      hp = (e, t, n) => {
        let r = 2166136261
        for (let i = t; i < n; i++) r = Math.imul(r ^ e.charCodeAt(i), 16777619)
        return r
      },
      gp = (e, t, n) => {
        let r = n - t,
          i = Math.imul(r, 2654435761) ^ e.charCodeAt(t)
        if (r > 3) {
          const a = r >> 2,
            o = r >> 1
          ;((i = Math.imul(
            i ^ (e.charCodeAt(t + 1) << 8) ^ (e.charCodeAt(t + 2) << 16) ^ e.charCodeAt(t + a),
            2246822507,
          )),
            (i = Math.imul(
              i ^ (e.charCodeAt(t + o) << 8) ^ (e.charCodeAt(t + o + a) << 16) ^ e.charCodeAt(n - 3),
              3266489909,
            )),
            (i ^= (e.charCodeAt(n - 2) << 8) ^ (e.charCodeAt(n - 1) << 16)))
          for (let r = t + 3, a = n - 4; r < t + 8 && r < a; r++, a--)
            i = Math.imul(i ^ e.charCodeAt(r) ^ (e.charCodeAt(a) << 8), 16777619)
        }
        return i ^ (i >>> 15)
      },
      _p = (e, t, n = {}) => {
        const {
            GROUP_COUNT: r,
            edgeStart: i,
            labelStart: a,
            labelText: o,
            edgeTarget: s,
            nodeGroup: c,
            nodeVlist: l,
            vlistPat: u,
            vlistOps: d,
            vlistRef: f,
            vlistGroup: p,
            litAnchor: m,
            litGroup: h,
            litPool: g,
            poolOffsets: _,
            poolText: v,
            adjGid: y,
            adjStart: b,
            adjTgt: x,
            patGid: S,
            patTgt: C,
            postfixLookupGroups: w,
            customValidatorNames: T,
            orderSensitiveModifiers: E,
          } = e,
          D = new Int32Array(r).fill(-1)
        for (let e = 0; e < y.length; e++) D[y[e]] = e
        let O = 0
        for (let e = 0; e + 1 < b.length; e++) {
          const t = b[e + 1] - b[e]
          t > O && (O = t)
        }
        let k = 32
        for (; k < 2 * (1 + O + S.length);) k <<= 1
        const A = new Int32Array(f.length + 1)
        for (let e = 0; e < f.length; e++) A[e + 1] = A[e] + u[f[e] + 1] - u[f[e]]
        const j = new Uint8Array(r)
        for (let e = 0; e < w.length; e++) j[w[e]] = 1
        let M = i.length - 1,
          N = new Uint8Array(M),
          P = 0,
          F = !0
        for (let e = 0; e < m.length; e++) {
          N[m[e]] = 1
          const t = _[g[e] * 2 + 1]
          t > P && (P = t)
          const n = v.charCodeAt(_[g[e] * 2])
          ;(n === 91 || n === 40) && (F = !1)
        }
        let I = 1
        for (; I < m.length * 2;) I <<= 1
        const L = new Int32Array(I).fill(-1)
        for (let e = 0; e < m.length; e++) {
          let t = _[g[e] * 2],
            n = ((hp(v, t, t + _[g[e] * 2 + 1]) ^ Math.imul(m[e], 2654435761)) | 0) & (I - 1)
          for (; L[n] !== -1;) n = (n + 1) & (I - 1)
          L[n] = e
        }
        const R = (e, t, n, r) => {
            let i = ((hp(t, n, r) ^ Math.imul(e, 2654435761)) | 0) & (I - 1),
              a = r - n
            for (;;) {
              let r = L[i]
              if (r === -1) return -1
              if (m[r] === e && _[g[r] * 2 + 1] === a) {
                let e = _[g[r] * 2],
                  i = !0
                for (let r = 0; r < a; r++)
                  if (v.charCodeAt(e + r) !== t.charCodeAt(n + r)) {
                    i = !1
                    break
                  }
                if (i) return h[r]
              }
              i = (i + 1) & (I - 1)
            }
          },
          z = n.cacheSize ?? 8192,
          B = n.prefix ?? e.prefix ?? ``,
          ee = B === `` ? `` : B + `:`,
          V = ee.length,
          H = (T ?? []).map((e) => {
            let n = t && t[e]
            if (!n) throw Error(`cn: missing validator ` + e)
            return n
          }),
          U =
            /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,
          te = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/,
          ne = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,
          W = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,
          re = 0,
          G = -1,
          ie = -1,
          K = -1,
          q = -1,
          ae = (e) => (e >= 97 && e <= 122) || (e >= 65 && e <= 90) || (e >= 48 && e <= 57) || e === 95,
          oe = (e) => /\s/.test(String.fromCharCode(e)),
          se = (e, t, n) => {
            if (((re = 0), (G = -1), n - t < 3)) return
            let r = e.charCodeAt(t),
              i = e.charCodeAt(n - 1)
            if (r === 91 && i === 93) re = 1
            else if (r === 40 && i === 41) re = 2
            else return
            ;((K = t + 1), (q = n - 1))
            let a = t + 1
            if (ae(e.charCodeAt(a))) {
              for (a++; a < n - 1;) {
                let t = e.charCodeAt(a)
                if (!ae(t) && t !== 45) break
                a++
              }
              a < n - 2 && e.charCodeAt(a) === 58 && ((G = t + 1), (ie = a), (K = a + 1))
            }
          },
          ce = (e, t, n, r) => {
            if (n - t !== r.length) return !1
            for (let n = 0; n < r.length; n++) if (e.charCodeAt(t + n) !== r.charCodeAt(n)) return !1
            return !0
          },
          le = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/,
          ue = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,
          J = (e) => !!e && !Number.isNaN(Number(e)),
          de = (e, t, n) => {
            if (n - t < 11 || !ce(e, t, t + 10, `@container`)) return !1
            if (e.charCodeAt(t + 10) === 47) return n - t >= 12
            let r = e.charCodeAt(t + 11)
            return (
              (r === 115 && n - t >= 17 && ce(e, t + 10, t + 16, `-size/`)) ||
              (r === 110 && n - t >= 19 && ce(e, t + 10, t + 18, `-normal/`))
            )
          },
          fe = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2],
          pe =
            `length|number|number weight|family-name|position percentage|length size bg-size|image url|shadow|length|family-name|position percentage|length size bg-size|image url|shadow|number weight`
              .split(`|`)
              .map((e) => e.split(` `)),
          me = [2, 3, 1, 0, 0, 0, 4, 5, 0, 0, 0, 0, 0, 1, 1],
          he = (e, t, n, r) => {
            if (e >= 10) {
              if (e >= 25) return H[e - 25](t.slice(n, r))
              let i = e - 10
              if (re !== fe[i]) return !1
              if (G >= 0) {
                for (let e of pe[i]) if (ce(t, G, ie, e)) return !0
                return !1
              }
              switch (me[i]) {
                case 0:
                  return !1
                case 1:
                  return !0
                case 2: {
                  let e = t.slice(K, q)
                  return U.test(e) && !te.test(e)
                }
                case 3:
                  return J(t.slice(K, q))
                case 4:
                  return W.test(t.slice(K, q))
                default:
                  return ne.test(t.slice(K, q))
              }
            }
            switch (e) {
              case 0:
                return !0
              case 1:
                return re === 0
              case 2:
                return re === 1
              case 3:
                return re === 2
              case 4:
                return le.test(t.slice(n, r))
              case 5:
                return J(t.slice(n, r))
              case 6: {
                let e = t.slice(n, r)
                return !!e && Number.isInteger(Number(e))
              }
              case 7:
                return r > n && t.charCodeAt(r - 1) === 37 && J(t.slice(n, r - 1))
              case 8:
                return ue.test(t.slice(n, r))
              default:
                return de(t, n, r)
            }
          },
          ge = new Set(typeof E == `string` ? E.split(` `) : E),
          _e = (e, t, n, r, i, a) => {
            let o = hp(t, n, r) ^ (i ? 2654435769 : 0),
              s = e.get(o)
            if (s !== void 0)
              outer: for (let e = 0; e < s.length; e++) {
                let a = s[e]
                if (a.imp === i && a.k.length === r - n) {
                  for (let e = 0; e < a.k.length; e++) if (a.k.charCodeAt(e) !== t.charCodeAt(n + e)) continue outer
                  return a.id
                }
              }
            else e.set(o, (s = []))
            let c = t.slice(n, r),
              l = a(c)
            return (s.push({ k: c, imp: i, id: l }), l)
          },
          ve = /* @__PURE__ */ new Map(),
          ye = /* @__PURE__ */ new Map(),
          be = 2,
          xe = 4096,
          Se = (e, t) => {
            let n = [],
              r = 0,
              i = 0,
              a = 0
            for (let t = 0; t < e.length; t++) {
              let o = e.charCodeAt(t)
              r === 0 && i === 0 && o === 58
                ? (n.push(e.slice(a, t)), (a = t + 1))
                : o === 91
                  ? r++
                  : o === 93
                    ? r--
                    : o === 40
                      ? i++
                      : o === 41 && i--
            }
            n.push(e.slice(a))
            let o = n[0]
            if (n.length > 1) {
              let e = [],
                t = []
              for (let r of n)
                r.charCodeAt(0) === 91 || ge.has(r)
                  ? (t.length && (e.push(...t.sort()), (t = [])), e.push(r))
                  : t.push(r)
              ;(t.length && e.push(...t.sort()), (o = e.join(`:`)))
            }
            let s = t ? o + ` !` : o,
              c = ye.get(s)
            return (c === void 0 && ye.set(s, (c = be++)), c)
          },
          Ce = /* @__PURE__ */ new Map(),
          we = r,
          Te = r + 4096,
          Ee = () => we++,
          De = 2097152,
          Oe = 8192,
          ke = new Int32Array(Oe),
          Ae = Array(Oe).fill(null),
          je = new Int32Array(Oe),
          Me = new Int32Array(Oe),
          Ne = new Uint8Array(Oe),
          Pe = 0,
          Fe = (e, t, n, r, i, a, o, s) => {
            let c = e
            if (Ae[e] !== null) {
              if (Ae[e | 1] === null) c = e | 1
              else if (!(Pe++ & 3)) c = e | ((Pe >> 2) & 1)
              else return
            }
            ;((Ae[c] = t.slice(n, r)), (ke[c] = i), (je[c] = a), (Me[c] = o), (Ne[c] = s))
          },
          Ie = () => Ae.fill(null),
          Le = 256,
          Re = [new Int32Array(Le), new Int32Array(Le), new Int32Array(Le), new Int32Array(Le)],
          [ze, Be, Ve, He] = Re,
          Ue = new Uint8Array(Le),
          We = new Uint8Array(Le),
          Ge = () => {
            ;((Le *= 2),
              (Re = Re.map((e) => {
                let t = new Int32Array(Le)
                return (t.set(e), t)
              })),
              ([ze, Be, Ve, He] = Re))
            let e = new Uint8Array(Le)
            ;(e.set(Ue), (Ue = e), (We = new Uint8Array(Le)))
          },
          Ke = 64,
          qe = new Int32Array(Ke),
          Je = new Int32Array(Ke),
          Ye = new Int32Array(r),
          Xe = 2048,
          Ze = 21,
          Qe = new Float64Array(Xe),
          $e = new Int32Array(Xe),
          et = 0,
          tt = (e, t) => {
            if (e === 0 && t < r) return Ye[t] === et ? 1 : ((Ye[t] = et), 0)
            let n = e * 2097152 + t + 1,
              i = Math.imul(n, 2654435761) >>> Ze
            for (; $e[i] === et;) {
              if (Qe[i] === n) return 1
              i = (i + 1) & (Xe - 1)
            }
            return ((Qe[i] = n), ($e[i] = et), 0)
          },
          nt = (e, t, n, r, i) => {
            if (n - t >= 2 && e.charCodeAt(t) === 91 && e.charCodeAt(n - 1) === 93) {
              let r = -1
              for (let i = t + 1; i < n - 1; i++)
                if (e.charCodeAt(i) === 58) {
                  r = i
                  break
                }
              return r === -1 || r === t + 1 ? -1 : _e(Ce, e, t + 1, r, 0, Ee)
            }
            if (r >= 0 && c[r] >= 0) return c[r]
            for (let t = i - 1; t >= 0; t--) {
              let r = Je[t]
              if (r > n) continue
              let i = qe[t],
                a = n - r
              if (N[i] === 1 && a > 0 && a <= P) {
                let t = e.charCodeAt(r)
                if (F === !1 || (t !== 91 && t !== 40)) {
                  let t = R(i, e, r, n)
                  if (t >= 0) return t
                }
              }
              let o = l[i]
              if (o < 0) continue
              let s = f[o],
                c = u[s],
                m = u[s + 1]
              if (c === m) continue
              se(e, r, n)
              let h = A[o] - c
              for (let t = c; t < m; t++) if (he(d[t], e, r, n)) return p[h + t]
            }
            return -1
          },
          rt = (e) => {
            let t = e.length,
              n = 0,
              c = 0,
              u = !1
            ;((be > xe || ve.size > xe) &&
              ((ve = /* @__PURE__ */ new Map()), (ye = /* @__PURE__ */ new Map()), (be = 2), Ie()),
              we > Te && ((Ce = /* @__PURE__ */ new Map()), (we = r), Ie()))
            let d = 0
            for (; d < t;) {
              let f = e.charCodeAt(d)
              if (f === 32 || (f >= 9 && f <= 13) || (f >= 160 && oe(f))) {
                ;(f !== 32 && (u = !0), d++)
                continue
              }
              let p = d,
                m = 0
              for (; d < t;) {
                if (((f = e.charCodeAt(d)), f <= 32)) {
                  if (f === 32) break
                  if (f >= 9 && f <= 13) {
                    u = !0
                    break
                  }
                } else if (f >= 160 && oe(f)) {
                  u = !0
                  break
                }
                ;((m = Math.imul(m ^ f, 16777619)), d++)
              }
              let h = d,
                g = h - p
              n === Le && Ge()
              let _ = n++
              ;((ze[_] = p), (Be[_] = h), (c += g), (m ^= Math.imul(g, 2654435761)))
              let v = m ^ (m >>> 15),
                y = v & 8190
              {
                let t = -1
                if (
                  (ke[y] === v && Ae[y] !== null && Ae[y].length === g
                    ? (t = y)
                    : ke[y | 1] === v && Ae[y | 1] !== null && Ae[y | 1].length === g && (t = y | 1),
                  t >= 0)
                ) {
                  let n = Ae[t],
                    r = !0
                  for (let t = 0; t < g; t++)
                    if (n.charCodeAt(t) !== e.charCodeAt(p + t)) {
                      r = !1
                      break
                    }
                  if (r) {
                    ;((Ve[_] = je[t]), (He[_] = Me[t]), (Ue[_] = Ne[t]))
                    continue
                  }
                }
              }
              let b = p
              if (V !== 0) {
                if (h - p <= V || !e.startsWith(ee, p)) {
                  ;((Ve[_] = -1), Fe(y, e, p, h, v, -1, 0, 0))
                  continue
                }
                b = p + V
              }
              let x = 0,
                S = 0,
                C = -1,
                w = -1
              for (let t = b; t < h; t++) {
                let n = e.charCodeAt(t)
                if (x === 0 && S === 0) {
                  if (n === 58) {
                    C = t
                    continue
                  }
                  if (n === 47) {
                    w = t
                    continue
                  }
                }
                n === 91 ? x++ : n === 93 ? x-- : n === 40 ? S++ : n === 41 && S--
              }
              let T = C >= b ? C + 1 : b,
                E = T,
                D = h,
                O = !1,
                k = 0
              D > E && e.charCodeAt(D - 1) === 33
                ? ((O = !0), D--)
                : D > E && e.charCodeAt(E) === 33 && ((O = !0), E++, (k = 1))
              let A = -1
              w > T && ((A = w + k), A >= D && (A = -1))
              let M = E
              D - E > 1 && e.charCodeAt(E) === 45 && (M = E + 1)
              let P = 0,
                F = 0,
                I = 0,
                L = -1,
                R = 0
              ;(l[0] >= 0 || N[0] === 1) && ((qe[0] = 0), (Je[0] = M), (R = 1))
              let z = -1,
                B = 0
              for (let t = M; t < D; t++)
                if ((t === A && ((z = F < I ? -1 : P), (B = R)), P !== -1)) {
                  let n = e.charCodeAt(t),
                    r = -1
                  if (F < I) o.charCodeAt(F) === n ? (F++, F === I && (r = P = L)) : (P = -1)
                  else {
                    let e = i[P],
                      t = i[P + 1],
                      c = -1
                    for (let i = e; i < t; i++) {
                      let e = a[i]
                      if (o.charCodeAt(e) === n) {
                        a[i + 1] - e === 1 ? (r = c = s[i]) : ((F = e + 1), (I = a[i + 1]), (L = s[i]), (c = P))
                        break
                      }
                    }
                    P = c
                  }
                  if (r >= 0 && (l[r] >= 0 || N[r] === 1) && t + 1 < D && e.charCodeAt(t + 1) === 45) {
                    if (R === Ke) {
                      Ke *= 2
                      let e = new Int32Array(Ke)
                      ;(e.set(qe), (qe = e))
                      let t = new Int32Array(Ke)
                      ;(t.set(Je), (Je = t))
                    }
                    ;((qe[R] = r), (Je[R] = t + 2), R++)
                  }
                }
              A === D && ((z = F < I ? -1 : P), (B = R))
              let H = F < I ? -1 : P,
                U,
                te = !1
              if (A >= 0) {
                if (((te = !0), (U = nt(e, E, A, z, B)), U !== -1 && U < r && j[U])) {
                  let t = nt(e, E, D, H, R)
                  t !== -1 && t !== U && ((U = t), (te = !1))
                } else U === -1 && ((U = nt(e, E, D, H, R)), (te = !1))
              } else U = nt(e, E, D, H, R)
              let ne = 0,
                W = 0
              ;(U === -1
                ? (Ve[_] = -1)
                : ((W = +!!te),
                  (ne = b >= C ? +!!O : _e(ve, e, b, C, +!!O, (e) => Se(e, O))),
                  (Ve[_] = U),
                  (Ue[_] = W),
                  (He[_] = ne)),
                Fe(y, e, p, h, v, U, ne, W))
            }
            if (n === 0) return ``
            if (n === 1) return ze[0] === 0 && Be[0] === t ? e : e.slice(ze[0], Be[0])
            if (n * k > Xe) {
              for (; n * k > Xe;) ((Xe <<= 1), Ze--)
              ;((Qe = new Float64Array(Xe)), ($e = new Int32Array(Xe)))
            }
            if (be >= De || we >= De) throw Error(`cn: too many distinct classes in one merge`)
            ;((et = (et + 1) | 0), et === 0 && (Ye.fill(0), $e.fill(0), (et = 1)))
            let f = !1
            for (let e = n - 1; e >= 0; e--) {
              let t = Ve[e]
              if (t === -1) {
                We[e] = 1
                continue
              }
              let n = He[e]
              if (tt(n, t) === 1) ((We[e] = 0), (f = !0))
              else if (((We[e] = 1), t < r)) {
                let r = D[t]
                if (r >= 0) for (let e = b[r]; e < b[r + 1]; e++) tt(n, x[e])
                if (Ue[e] & 1) for (let e = 0; e < S.length; e++) S[e] === t && tt(n, C[e])
              }
            }
            if (!f && !u && t === c + n - 1) return e
            let p = ``,
              m = 0
            for (; m < n;) {
              if (!We[m]) {
                m++
                continue
              }
              let t = ze[m],
                r = Be[m],
                i = m + 1
              for (; i < n && We[i] && ze[i] === r + 1 && e.charCodeAt(r) === 32;) ((r = Be[i]), i++)
              ;(p.length > 0 && (p += ` `), (p += e.slice(t, r)), (m = i))
            }
            return p
          },
          it = 16384,
          at = new Int32Array(it * 2),
          ot = 0,
          st = 1,
          ct = Object.create(null),
          lt = Object.create(null),
          ut = /* @__PURE__ */ new Map(),
          dt = /* @__PURE__ */ new Map(),
          ft = 0,
          pt = 0,
          mt = () => {
            ;((ot ^= it), (st = (st + 1) | 0), (pt = 0))
          },
          ht = (e) => {
            let t = ct[e]
            if (t !== void 0) return t
            let n = gp(e, 0, e.length),
              r = (n & 16383) + ot,
              i = at[r] === (n ^ st) || at[r ^ it] === (n ^ (st - 1))
            return i && ((t = lt[e]), t !== void 0)
              ? ((ct[e] = t), t)
              : ((t = rt(e)),
                i
                  ? ((ct[e] = t), ++ft > z && ((ft = 0), (lt = ct), (ct = Object.create(null)), mt()))
                  : ((at[r] = n ^ st), ++pt > it && mt()),
                t)
          },
          gt = (e) => {
            let t = ut.get(e)
            if (t !== void 0) return t
            let n = gp(e, 0, e.length),
              r = (n & 16383) + ot,
              i = at[r] === (n ^ st) || at[r ^ it] === (n ^ (st - 1))
            return i && ((t = dt.get(e)), t !== void 0)
              ? (ut.set(e, t), t)
              : ((t = rt(e)),
                i
                  ? (ut.set(e, t), ++ft > z && ((ft = 0), (dt = ut), (ut = /* @__PURE__ */ new Map()), mt()))
                  : ((at[r] = n ^ st), ++pt > it && mt()),
                t)
          },
          _t = (e) => {
            let t = gp(e, 0, e.length),
              n = (t & 16383) + ot
            return at[n] === (t ^ st) || at[n ^ it] === (t ^ (st - 1)) || ((at[n] = t ^ st), ++pt > it && mt(), !1)
          },
          vt =
            z === 0
              ? rt
              : mp
                ? (e) => {
                    let t = ut.get(e)
                    return t === void 0 ? gt(e) : t
                  }
                : ht
        return {
          merge () {
            return arguments.length === 1 && typeof arguments[0] == `string`
              ? vt(arguments[0])
              : vt(bp.apply(null, arguments))
          },
          mergeString: vt,
          seenBefore: z === 0 ? () => !1 : _t,
          mergeUncached: rt,
        }
      },
      vp = (e, t) => {
        if (!e) return ``
        if (typeof e == `string`) return e
        let n = ``
        if (typeof e.length == `number` && (!t || Array.isArray(e))) {
          const r = e
          for (let e = 0; e < r.length; e++) {
            const i = r[e]
            if (!i) continue
            const a = typeof i == `string` ? i : vp(i, t)
            a && (n && (n += ` `), (n += a))
          }
          return n
        }
        if (t) {
          if (typeof e == `number`) return `${  e}`
          if (typeof e == `object`) for (const t in e) e[t] && (n && (n += ` `), (n += t))
        }
        return n
      },
      yp = (e, t) => {
        let n = ``
        for (let r = 0; r < e.length; r++) {
          const i = e[r]
          if (!i) continue
          const a = typeof i == `string` ? i : vp(i, t)
          a && (n && (n += ` `), (n += a))
        }
        return n
      },
      bp = function () {
        return yp(arguments, !1)
      },
      xp = 4096,
      Sp = (e, t) => {
        const n = t === void 0 ? () => !0 : t.seenBefore,
          r = t === void 0 ? e : t.mergeUncached,
          i = /* @__PURE__ */ new Map(),
          a = /* @__PURE__ */ new Map(),
          o = 0,
          s = null,
          c = null,
          l = [],
          u = [],
          d = 0,
          f = (t, n, r) => {
            c === null && ((c = Array(xp).fill(``)), (l = Array(xp).fill(``)), (u = Array(xp).fill(``)))
            let i = gp(t, 0, t.length) & 4094
            if (c[i] === t && l[i] === n) return u[i]
            if (c[i | 1] === t && l[i | 1] === n) return u[i | 1]
            let a = e(r ? n + ` ` + t : t),
              o = c[i] === `` ? i : i | (c[i | 1] === `` ? 1 : d++ & 1)
            return ((c[o] = t), (l[o] = n), (u[o] = a), a)
          },
          p = (e, t, n, r) => {
            let i = 0
            if (t) {
              if (t !== e.a0) return !1
              i = 1
            }
            if (n) {
              if (n !== (i === 0 ? e.a0 : e.a1)) return !1
              i++
            }
            if (r) {
              if (r !== (i === 0 ? e.a0 : i === 1 ? e.a1 : e.a2)) return !1
              i++
            }
            return i === e.t
          },
          m = (e, t) => {
            let n = e.a,
              r = 0
            for (let e = 0; e < t.length; e++) {
              let i = t[e]
              if (i) {
                if (i !== n[r]) return !1
                r++
              }
            }
            return r === e.t
          },
          h = (t, c) => {
            let l = t.length,
              u = s === null ? null : s.n
            if (!c) {
              if (u !== null && m(u, t)) return ((s = u), u.r)
              if (s !== null && s !== u && m(s, t)) return s.r
            }
            let d = ``,
              p = -1,
              h = 0,
              g = !1
            for (let e = 0; e < l; e++) {
              let n = t[e]
              if (n) {
                if (typeof n != `string`) {
                  if (((n = t[e] = vp(n, !0)), !n)) continue
                  g = !0
                }
                ;(p < 0 && ((d = n), (p = e)), h++)
              }
            }
            if (h === 0) return ``
            if (h === 1) return e(d)
            if (g) {
              if (u !== null && m(u, t)) return ((s = u), u.r)
              if (s !== null && s !== u && m(s, t)) return s.r
            }
            let _ = i.get(d)
            _ === void 0 && ((_ = a.get(d)), _ !== void 0 && i.set(d, _))
            let v = null
            if (_ !== void 0) {
              if (_.skip > 0) {
                ;(_.skip--, (s = null))
                let e = d
                for (let n = p + 1; n < l; n++) {
                  let r = t[n]
                  r && (e += ` ` + r)
                }
                return f(e, ``, !1)
              }
              let e = _.e
              outer: for (let n = 0; n < e.length; n++) {
                let r = e[n]
                if (r.t !== h) continue
                let i = r.a,
                  a = 1
                for (let e = p + 1; e < l; e++) {
                  let n = t[e]
                  if (n && n !== i[a++]) continue outer
                }
                v = r
                break
              }
              v !== null && (_.miss = 0)
            }
            if (v === null) {
              let s = d,
                c = [d]
              for (let e = p + 1; e < l; e++) {
                let n = t[e]
                n && ((s += ` ` + n), c.push(n))
              }
              if (!n(s)) return r(s)
              ;((v = { r: e(s), t: c.length, a0: c[0], a1: c[1], a2: c[2] ?? ``, a: c, n: null }),
                _ === void 0
                  ? i.set(d, (_ = { e: [], miss: 0, skip: 0, at: 0 }))
                  : ++_.miss > 16 && ((_.miss = 16), (_.skip = 1024), (_.e.length = 0), (_.at = 0)))
              let u = _.e
              ;(u.length < 256 ? u.push(v) : ((u[_.at] = v), (_.at = (_.at + 1) & 255)),
                ++o > 1e3 && ((o = 0), (a = i), (i = /* @__PURE__ */ new Map())))
            }
            return (s !== null && s !== v && (s.n = v), (s = v), v.r)
          },
          g = (t) => (Array.isArray(t) ? h(t.slice(), !1) : e(vp(t, !0)))
        return function (t, n, r) {
          const a = arguments.length
          if ((a | 1) == 3) {
            const e = s
            if (e !== null) {
              const i = e.n
              if (i !== null && p(i, t, n, r)) return ((s = i), i.r)
              if (e !== i && p(e, t, n, r)) return e.r
            }
            if (a === 2 && typeof n == `string` && n !== ``) {
              const e = i.get(t)
              if (e !== void 0 && e.skip > 0) return (e.skip--, (s = null), f(n, t, !0))
            }
            return h([t, n, r], !0)
          }
          if (a === 1) return typeof t == `string` ? e(t) : g(t)
          const o = s
          if (o !== null) {
            const e = o.n
            if (e !== null) {
              let t = e.a,
                n = 0,
                r = !0
              for (let e = 0; e < a; e++) {
                const i = arguments[e]
                if (i) {
                  if (i !== t[n]) {
                    r = !1
                    break
                  }
                  n++
                }
              }
              if (r && n === e.t) return ((s = e), e.r)
            }
            if (o !== e) {
              let e = o.a,
                t = 0,
                n = !0
              for (let r = 0; r < a; r++) {
                const i = arguments[r]
                if (i) {
                  if (i !== e[t]) {
                    n = !1
                    break
                  }
                  t++
                }
              }
              if (n && t === o.t) return o.r
            }
          }
          const c = []
          for (let e = 0; e < a; e++) c.push(arguments[e])
          return h(c, !0)
        }
      },
      Cp = /* @__PURE__ */ _p(pp),
      wp = /* @__PURE__ */ Sp(Cp.mergeString, Cp)
    Cp.merge
    const Tp = Ju
    function Ep({ className: e, ...t }) {
      return /* @__PURE__ */ (0, u.jsx)(ld, {
        "data-slot": `select-value`,
        className: wp(`flex flex-1 text-start`, e),
        ...t,
      })
    }
    function Dp({ className: e, size: t = `default`, children: n, ...r }) {
      return /* @__PURE__ */ (0, u.jsxs)(sd, {
        "data-slot": `select-trigger`,
        "data-size": t,
        className: wp(
          `flex min-w-40 items-center justify-between gap-3 rounded-md border border-line bg-bg-1 py-2 ps-3 pe-2 text-[12px] whitespace-nowrap text-fg shadow-sm select-none hover:bg-hover active:bg-bg-3 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8`,
          e,
        ),
        ...r,
        children: [
          n,
          /* @__PURE__ */ (0, u.jsx)(ud, {
            render: /* @__PURE__ */ (0, u.jsx)(`span`, {
              className: `flex shrink-0 text-fg-dim`,
              children: /* @__PURE__ */ (0, u.jsx)(Rf, { icon: Ff, className: `size-4` }),
            }),
          }),
        ],
      })
    }
    function Op({
      className: e,
      children: t,
      container: n,
      side: r = `bottom`,
      sideOffset: i = 5,
      align: a = `start`,
      alignOffset: o = 0,
      alignItemWithTrigger: s = !1,
      ...c
    }) {
      const [d, f] = (0, l.useState)(null)
      return /* @__PURE__ */ (0, u.jsx)(`div`, {
        ref: f,
        className: `contents`,
        children: /* @__PURE__ */ (0, u.jsx)(dd, {
          container: n ?? d,
          children: /* @__PURE__ */ (0, u.jsx)(nf, {
            side: r,
            sideOffset: i,
            align: a,
            alignOffset: o,
            alignItemWithTrigger: s,
            className: `isolate z-50`,
            children: /* @__PURE__ */ (0, u.jsxs)(mf, {
              "data-slot": `select-content`,
              className: wp(
                `relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-40 overflow-x-clip overflow-y-auto rounded-lg border border-line bg-bg-1 p-1 text-[12px] text-fg shadow-xl`,
                e,
              ),
              ...c,
              children: [
                /* @__PURE__ */ (0, u.jsx)(Ap, {}),
                /* @__PURE__ */ (0, u.jsx)(Sf, { children: t }),
                /* @__PURE__ */ (0, u.jsx)(jp, {}),
              ],
            }),
          }),
        }),
      })
    }
    function kp({ className: e, children: t, ...n }) {
      return /* @__PURE__ */ (0, u.jsxs)(Ef, {
        "data-slot": `select-item`,
        className: wp(
          `relative flex min-h-8 w-full cursor-default items-center gap-1.5 rounded-md py-1.5 ps-2 pe-8 text-[12px] text-fg select-none active:bg-bg-3 data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-bg-3`,
          e,
        ),
        ...n,
        children: [
          /* @__PURE__ */ (0, u.jsx)(kf, { className: `flex flex-1 shrink-0 gap-2 whitespace-nowrap`, children: t }),
          /* @__PURE__ */ (0, u.jsx)(Of, {
            render: /* @__PURE__ */ (0, u.jsx)(`span`, {
              className: `pointer-events-none absolute inset-e-2 flex size-4 items-center justify-center text-accent`,
              children: /* @__PURE__ */ (0, u.jsx)(Rf, { icon: Pf, className: `size-4` }),
            }),
          }),
        ],
      })
    }
    function Ap({ className: e, ...t }) {
      return /* @__PURE__ */ (0, u.jsx)(Nf, {
        "data-slot": `select-scroll-up-button`,
        className: wp(`flex w-full items-center justify-center bg-bg-1 py-1 text-fg-dim`, e),
        ...t,
        children: /* @__PURE__ */ (0, u.jsx)(Rf, { icon: If, className: `size-4` }),
      })
    }
    function jp({ className: e, ...t }) {
      return /* @__PURE__ */ (0, u.jsx)(Mf, {
        "data-slot": `select-scroll-down-button`,
        className: wp(`flex w-full items-center justify-center bg-bg-1 py-1 text-fg-dim`, e),
        ...t,
        children: /* @__PURE__ */ (0, u.jsx)(Rf, { icon: Ff, className: `size-4` }),
      })
    }
    function Mp(e, t, n) {
      const r = t.trim().toLowerCase()
      return e
        .filter((e) => `${e.name}\n${e.path ?? ``}`.toLowerCase().includes(r))
        .toSorted(
          (e, t) =>
            (n === `count` ? t.count - e.count : t.lastTurnIndex - e.lastTurnIndex) ||
            t.lastTurnIndex - e.lastTurnIndex ||
            e.id.localeCompare(t.id),
        )
    }
    function Np({ skills: e, onJumpTurn: t, loadedTurns: n, totalTurns: r, onLoadMore: i, loadingMore: a = !1 }) {
      const o = (0, l.useId)(),
        [s, c] = (0, l.useState)(``),
        [d, f] = (0, l.useState)(`count`),
        p = Mp(e ?? [], s, d),
        m = Math.max(1, ...p.map((e) => e.count))
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `flex min-w-0 flex-col gap-4 p-4`,
        children: [
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `flex flex-wrap items-baseline justify-between gap-2`,
            children: [
              /* @__PURE__ */ (0, u.jsx)(`h3`, {
                className: `m-0 text-[13px] font-semibold`,
                children: X(`insights.skills`),
              }),
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `text-[11px] text-fg-dim tabular-nums`,
                children: X(`insights.skillSummary`, {
                  count: e?.length ?? 0,
                  uses: (e ?? []).reduce((e, t) => e + t.count, 0),
                }),
              }),
            ],
          }),
          n !== void 0 && r !== void 0 && n < r
            ? /* @__PURE__ */ (0, u.jsx)(jr, {
                label: X(`insights.skills`),
                children: /* @__PURE__ */ (0, u.jsxs)(`div`, {
                  className: `flex flex-wrap items-center justify-between gap-2`,
                  children: [
                    /* @__PURE__ */ (0, u.jsx)(`p`, {
                      className: `m-0 text-[11px] text-fg-dim`,
                      children: X(`insights.partialSkills`, { loaded: n, total: r }),
                    }),
                    /* @__PURE__ */ (0, u.jsx)(`button`, {
                      type: `button`,
                      className: `ci-btn min-h-9`,
                      disabled: a || i === void 0,
                      onClick: i,
                      children: Y(a ? `session.loadingMore` : `session.loadMore`),
                    }),
                  ],
                }),
              })
            : null,
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `flex flex-wrap items-end gap-3`,
            children: [
              /* @__PURE__ */ (0, u.jsxs)(`label`, {
                className: `flex min-w-0 basis-64 flex-col gap-1 text-[11px]`,
                children: [
                  X(`insights.searchSkills`),
                  /* @__PURE__ */ (0, u.jsx)(`input`, {
                    type: `search`,
                    value: s,
                    onChange: (e) => c(e.target.value),
                    className: `h-9 w-full rounded-md border border-line bg-bg-1 px-3 text-[12px] shadow-sm`,
                  }),
                ],
              }),
              /* @__PURE__ */ (0, u.jsxs)(`div`, {
                className: `flex min-w-0 flex-col gap-1 text-[11px]`,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(`label`, { id: `${o}-sort`, children: X(`insights.sortSkills`) }),
                  /* @__PURE__ */ (0, u.jsxs)(Tp, {
                    value: d,
                    onValueChange: (e) => f(e === `recent` ? `recent` : `count`),
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(Dp, {
                        "aria-labelledby": `${o}-sort`,
                        children: /* @__PURE__ */ (0, u.jsx)(Ep, {
                          children: X(d === `count` ? `insights.byCount` : `insights.byRecent`),
                        }),
                      }),
                      /* @__PURE__ */ (0, u.jsxs)(Op, {
                        children: [
                          /* @__PURE__ */ (0, u.jsx)(kp, { value: `count`, children: X(`insights.byCount`) }),
                          /* @__PURE__ */ (0, u.jsx)(kp, { value: `recent`, children: X(`insights.byRecent`) }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          e === void 0
            ? /* @__PURE__ */ (0, u.jsx)(`p`, { className: `m-0 text-fg-dim`, children: X(`insights.unrecorded`) })
            : p.length === 0
              ? /* @__PURE__ */ (0, u.jsx)(jr, {
                  label: X(`insights.skills`),
                  children: /* @__PURE__ */ (0, u.jsx)(`p`, {
                    className: `m-0 text-[12px] text-fg-dim`,
                    children: X(s.trim() === `` ? `insights.noSkills` : `insights.noMatchingSkills`),
                  }),
                })
              : /* @__PURE__ */ (0, u.jsx)(`ol`, {
                  className: `m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-3 p-0`,
                  children: p.map((e, n) =>
                    /* @__PURE__ */ (0, u.jsxs)(
                      `li`,
                      {
                        className: `flex min-w-0 flex-col gap-3 rounded-xl border border-line-soft bg-bg-1 p-4`,
                        children: [
                          /* @__PURE__ */ (0, u.jsxs)(`div`, {
                            className: `flex min-w-0 items-baseline gap-2`,
                            children: [
                              /* @__PURE__ */ (0, u.jsx)(`span`, {
                                className: `font-mono text-[11px] text-fg-dim`,
                                children: n + 1,
                              }),
                              /* @__PURE__ */ (0, u.jsx)(`h3`, {
                                className: `m-0 min-w-0 flex-1 text-[13px] font-semibold wrap-anywhere`,
                                children: e.name,
                              }),
                              /* @__PURE__ */ (0, u.jsx)(`span`, {
                                className: `shrink-0 text-[11px] tabular-nums`,
                                children: X(`insights.skillCount`, { count: e.count }),
                              }),
                            ],
                          }),
                          e.path === void 0
                            ? null
                            : /* @__PURE__ */ (0, u.jsx)(`p`, {
                                className: `m-0 font-mono text-[10px] wrap-anywhere text-fg-dim`,
                                children: e.path,
                              }),
                          /* @__PURE__ */ (0, u.jsx)(`div`, {
                            role: `meter`,
                            "aria-valuemin": 0,
                            "aria-valuemax": m,
                            "aria-valuenow": e.count,
                            "aria-label": `${e.name}: ${e.count}`,
                            className: `h-1.5 overflow-clip rounded-full bg-bg-3`,
                            children: /* @__PURE__ */ (0, u.jsx)(`div`, {
                              className: `h-full rounded-full bg-accent`,
                              style: { width: `${(e.count / m) * 100}%` },
                            }),
                          }),
                          /* @__PURE__ */ (0, u.jsx)(`button`, {
                            type: `button`,
                            className: `ci-btn min-h-9 self-start active:bg-bg-3`,
                            disabled: t === void 0,
                            onClick: () => t?.(e.lastTurnIndex),
                            children: X(`insights.jump`, { index: e.lastTurnIndex }),
                          }),
                          /* @__PURE__ */ (0, u.jsxs)(`details`, {
                            children: [
                              /* @__PURE__ */ (0, u.jsxs)(`summary`, {
                                className: `cursor-pointer rounded-md py-2 text-[11px] active:bg-bg-3`,
                                children: [X(`insights.evidence`), ` (`, e.evidence.length, `)`],
                              }),
                              /* @__PURE__ */ (0, u.jsx)(`ul`, {
                                className: `m-0 flex list-none flex-col gap-2 p-0`,
                                children: e.evidence.map((e) =>
                                  /* @__PURE__ */ (0, u.jsxs)(
                                    `li`,
                                    {
                                      className: `min-w-0 rounded-md bg-bg-2 p-2 text-[11px]`,
                                      children: [
                                        /* @__PURE__ */ (0, u.jsx)(`button`, {
                                          type: `button`,
                                          className: `ci-btn min-h-9 max-w-full active:bg-bg-3`,
                                          disabled: t === void 0,
                                          onClick: () => t?.(e.turnIndex),
                                          children: X(`insights.jump`, { index: e.turnIndex }),
                                        }),
                                        /* @__PURE__ */ (0, u.jsx)(`p`, {
                                          className: `m-0 py-1`,
                                          children: X(`insights.${e.kind}`),
                                        }),
                                        /* @__PURE__ */ (0, u.jsx)(`p`, {
                                          className: `m-0 font-mono wrap-anywhere text-fg-dim`,
                                          children: e.toolCallId,
                                        }),
                                        /* @__PURE__ */ (0, u.jsx)(`p`, {
                                          className: `m-0 text-fg-dim`,
                                          children: e.time === void 0 ? X(`insights.unrecorded`) : cn(e.time),
                                        }),
                                      ],
                                    },
                                    e.toolCallId,
                                  ),
                                ),
                              }),
                            ],
                          }),
                        ],
                      },
                      e.id,
                    ),
                  ),
                }),
          /* @__PURE__ */ (0, u.jsx)(`p`, {
            className: `m-0 text-[11px] leading-relaxed text-fg-dim`,
            children: X(`insights.skillNote`),
          }),
        ],
      })
    }
    function Pp({ segments: e, turnSubagents: t }) {
      const n = e.slice(1)
      return /* @__PURE__ */ (0, u.jsxs)(jr, {
        label: Y(`subagents.title`),
        children: [
          /* @__PURE__ */ (0, u.jsx)(Ar, { count: t.length, children: Y(`subagents.title`) }),
          e.length === 0
            ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                className: `m-0 text-[11.5px] text-fg-dim`,
                children: Y(`subagents.none`),
              })
            : null,
          e.length > 0
            ? /* @__PURE__ */ (0, u.jsxs)(`details`, {
                className: `ci-fold mt-1 mb-2`,
                open: n.length > 0 && n.length <= 3,
                children: [
                  /* @__PURE__ */ (0, u.jsxs)(`summary`, {
                    className: `inline-flex items-center gap-1 text-[11.5px] text-fg-dim`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(Xn, { name: `chevron`, size: 11, className: `ci-chevron` }),
                      Y(`subagents.files`, { count: n.length }),
                    ],
                  }),
                  /* @__PURE__ */ (0, u.jsxs)(`ul`, {
                    className: `mt-1.5 mb-0 list-none p-0 font-mono text-[11px]`,
                    children: [
                      /* @__PURE__ */ (0, u.jsxs)(`li`, {
                        className: `flex items-baseline gap-1.5 py-0.5 ps-0`,
                        children: [
                          /* @__PURE__ */ (0, u.jsx)(`span`, {
                            className: `text-fg-dim`,
                            "aria-hidden": `true`,
                            children: `▸`,
                          }),
                          /* @__PURE__ */ (0, u.jsx)(`span`, { className: `truncate`, children: fn(e[0]?.name ?? ``) }),
                          /* @__PURE__ */ (0, u.jsx)(`span`, {
                            className: `text-[10px] text-fg-dim`,
                            children: on(e[0]?.bytes ?? 0),
                          }),
                          /* @__PURE__ */ (0, u.jsx)(kr, { children: Y(`subagents.main`) }),
                        ],
                      }),
                      n.map((e) =>
                        /* @__PURE__ */ (0, u.jsxs)(
                          `li`,
                          {
                            className: `flex items-baseline gap-1.5 py-0.5 ps-3`,
                            children: [
                              /* @__PURE__ */ (0, u.jsx)(`span`, {
                                className: `text-fg-dim`,
                                "aria-hidden": `true`,
                                children: `└`,
                              }),
                              /* @__PURE__ */ (0, u.jsx)(`span`, { className: `truncate`, children: e.name }),
                              /* @__PURE__ */ (0, u.jsx)(`span`, {
                                className: `text-[10px] text-fg-dim`,
                                children: on(e.bytes),
                              }),
                            ],
                          },
                          e.name,
                        ),
                      ),
                    ],
                  }),
                ],
              })
            : null,
          t.length === 0
            ? /* @__PURE__ */ (0, u.jsx)(`p`, {
                className: `m-0 text-[11.5px] text-fg-dim`,
                children: Y(`turns.noSubagents`),
              })
            : /* @__PURE__ */ (0, u.jsx)(`ul`, {
                className: `mt-1.5 mb-2 flex list-none flex-wrap gap-1.5 p-0`,
                children: t.map((e) =>
                  /* @__PURE__ */ (0, u.jsx)(
                    `li`,
                    {
                      children: /* @__PURE__ */ (0, u.jsxs)(kr, {
                        tone: `mono`,
                        children: [/* @__PURE__ */ (0, u.jsx)(Xn, { name: `branch`, size: 11 }), e],
                      }),
                    },
                    e,
                  ),
                ),
              }),
        ],
      })
    }
    const Fp = {
      ok: `ci-status ci-status--ok`,
      error: `ci-status ci-status--error`,
      unknown: `ci-status ci-status--unknown`,
      running: `ci-status ci-status--running`,
    }
    function Ip(e) {
      if (typeof e == `object` && e && !Array.isArray(e)) return e
    }
    function Lp(e, t) {
      const n = e?.[t]
      return typeof n == `string` ? n : void 0
    }
    function Rp(e) {
      if (e === void 0) return ``
      if (typeof e == `string`) return e
      if (Array.isArray(e))
        return e
          .map((e) => {
            if (typeof e == `string`) return e
            const t = Ip(e)
            return Lp(t, `text`) ?? (t === void 0 ? `` : JSON.stringify(t))
          })
          .filter((e) => e !== ``).join(`
`)
      const t = Lp(Ip(e), `text`)
      if (t !== void 0) return t
      try {
        return JSON.stringify(e, null, 2)
      } catch {
        return String(e)
      }
    }
    function zp(e) {
      const t = Ip(e.input),
        n = Lp(t, `command`)
      if (n !== void 0) return { label: Y(`tools.command`), body: n, mono: !0 }
      const r = Lp(t, `file_path`) ?? Lp(t, `path`) ?? Lp(t, `notebook_path`)
      if (r !== void 0) return { label: Y(`tools.path`), body: r, mono: !0 }
      const i = Lp(t, `url`)
      if (i !== void 0) return { label: `url`, body: i, mono: !0 }
      const a = Lp(t, `query`)
      if (a !== void 0) return { label: `query`, body: a }
      if (e.input !== void 0) return { label: Y(`tools.input`), body: pn(Rp(e.input), 600), mono: !0 }
    }
    function Bp({ before: e, after: t }) {
      const n =
          e === ``
            ? []
            : e.split(`
`),
        r =
          t === ``
            ? []
            : t.split(`
`)
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        children: [
          /* @__PURE__ */ (0, u.jsx)(`span`, {
            className: `mb-1 block text-[10.5px] text-fg-dim`,
            children: Y(`tools.diff`),
          }),
          /* @__PURE__ */ (0, u.jsxs)(`pre`, {
            className: `ci-pre max-h-55`,
            children: [
              n.map((e, t) =>
                /* @__PURE__ */ (0, u.jsxs)(
                  `span`,
                  {
                    className: `block bg-[color-mix(in_oklch,var(--color-err)_8%,transparent)] text-err`,
                    children: [
                      e,
                      `
`,
                    ],
                  },
                  `d${String(t)}`,
                ),
              ),
              r.map((e, t) =>
                /* @__PURE__ */ (0, u.jsxs)(
                  `span`,
                  {
                    className: `block bg-[color-mix(in_oklch,var(--color-ok)_8%,transparent)] text-ok`,
                    children: [
                      e,
                      `
`,
                    ],
                  },
                  `a${String(t)}`,
                ),
              ),
            ],
          }),
        ],
      })
    }
    function Vp({ call: e }) {
      const t = zp(e),
        n = Ip(e.input),
        r = Lp(n, `old_string`),
        i = Lp(n, `new_string`),
        a = Rp(e.output),
        o = e.status === `error`,
        s = e.endedAt === void 0 && e.status !== `error` ? `running` : e.status,
        c = Y(
          s === `running`
            ? `tools.status.running`
            : s === `ok`
              ? `tools.status.ok`
              : s === `error`
                ? `tools.status.error`
                : `tools.status.unknown`,
        )
      return /* @__PURE__ */ (0, u.jsx)(`li`, {
        className: o ? `rounded-lg border border-err/40 bg-err/5` : `rounded-lg border border-line-soft bg-bg`,
        children: /* @__PURE__ */ (0, u.jsxs)(`details`, {
          className: `ci-fold`,
          open: o,
          children: [
            /* @__PURE__ */ (0, u.jsxs)(`summary`, {
              className: `flex min-w-0 items-center gap-2 px-2.5 py-2 text-[12px]`,
              children: [
                /* @__PURE__ */ (0, u.jsx)(Xn, {
                  name: `chevron`,
                  size: 11,
                  className: `ci-chevron shrink-0 text-fg-3`,
                }),
                /* @__PURE__ */ (0, u.jsx)(`span`, { className: `shrink-0 font-mono font-semibold`, children: e.name }),
                /* @__PURE__ */ (0, u.jsx)(`span`, { className: `${Fp[s]} shrink-0`, children: c }),
                t === void 0
                  ? null
                  : /* @__PURE__ */ (0, u.jsx)(`span`, {
                      className: `min-w-0 flex-1 truncate font-mono text-[11px] text-fg-dim`,
                      title: t.body,
                      children: t.body.split(`
`)[0],
                    }),
                /* @__PURE__ */ (0, u.jsx)(`span`, {
                  className: `ms-auto shrink-0 text-[10.5px] text-fg-3 tabular-nums`,
                  children: un(e.startedAt, e.endedAt),
                }),
              ],
            }),
            /* @__PURE__ */ (0, u.jsxs)(`div`, {
              className: `flex flex-col gap-2 px-2.5 pb-2.5`,
              children: [
                t === void 0
                  ? null
                  : /* @__PURE__ */ (0, u.jsxs)(`div`, {
                      children: [
                        /* @__PURE__ */ (0, u.jsx)(`span`, {
                          className: `mb-1 block text-[10.5px] text-fg-dim`,
                          children: t.label,
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`pre`, { className: `ci-pre`, children: pn(t.body, 600) }),
                      ],
                    }),
                r === void 0 && i === void 0
                  ? null
                  : /* @__PURE__ */ (0, u.jsx)(Bp, { before: r ?? ``, after: i ?? `` }),
                a === ``
                  ? null
                  : /* @__PURE__ */ (0, u.jsxs)(`div`, {
                      children: [
                        /* @__PURE__ */ (0, u.jsx)(`span`, {
                          className: o ? `mb-1 block text-[10.5px] text-err` : `mb-1 block text-[10.5px] text-fg-dim`,
                          children: o ? `${Y(`tools.output`)} · ${Y(`tools.status.error`)}` : Y(`tools.output`),
                        }),
                        /* @__PURE__ */ (0, u.jsx)(`pre`, { className: `ci-pre max-h-80`, children: pn(a, 2400) }),
                      ],
                    }),
              ],
            }),
          ],
        }),
      })
    }
    function Hp({ calls: e, expanded: t, onToggleExpanded: n }) {
      if (e.length === 0)
        return /* @__PURE__ */ (0, u.jsx)(`p`, {
          className: `m-0 text-[11.5px] text-fg-dim`,
          children: Y(`turns.noTools`),
        })
      const r = t ? e : e.slice(0, 12)
      return /* @__PURE__ */ (0, u.jsxs)(u.Fragment, {
        children: [
          /* @__PURE__ */ (0, u.jsx)(`ul`, {
            className: `m-0 flex list-none flex-col gap-1.5 p-0`,
            children: r.map((e) => /* @__PURE__ */ (0, u.jsx)(Vp, { call: e }, e.id)),
          }),
          e.length > 12
            ? /* @__PURE__ */ (0, u.jsx)(`button`, {
                type: `button`,
                className: `ci-btn ci-btn--quiet mt-2`,
                onClick: () => n(!t),
                children: t ? Y(`tools.showLess`) : Y(`tools.showAll`, { count: e.length }),
              })
            : null,
        ],
      })
    }
    function Up({ turn: e, segments: t, expandedTools: n, onToggleTools: r }) {
      const i = e.attribution,
        a = i.total.tokens
      return /* @__PURE__ */ (0, u.jsxs)(`div`, {
        className: `flex min-w-0 flex-col`,
        children: [
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `sticky top-0 z-10 flex flex-col gap-3 border-b border-line-soft bg-bg px-4 pt-4 pb-3`,
            children: [
              /* @__PURE__ */ (0, u.jsxs)(`div`, {
                className: `flex min-w-0 items-end gap-3`,
                children: [
                  /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    className: `flex min-w-0 flex-col`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`h3`, {
                        className: `m-0 text-[15px] font-semibold`,
                        children: Y(`turns.selected`, { index: e.index }),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        className: `text-[11px] text-fg-dim tabular-nums`,
                        children: cn(e.startedAt),
                      }),
                    ],
                  }),
                  /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    className: `ms-auto flex items-baseline gap-2`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        className: `text-[20px] font-semibold tracking-[-0.01em] tabular-nums`,
                        children: en(a),
                      }),
                      i.windowSize === void 0
                        ? null
                        : /* @__PURE__ */ (0, u.jsx)(kr, {
                            tone: `soft`,
                            children: Y(`stats.windowShare`, { share: rn(a, i.windowSize), size: en(i.windowSize) }),
                          }),
                    ],
                  }),
                ],
              }),
              e.userInput.length === 0
                ? null
                : /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    className: `ci-ask`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        className: `ci-ask__label`,
                        children: Y(`detail.userInput`),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`p`, {
                        className: `ci-ask__text`,
                        children: e.userInput.join(`
`),
                      }),
                    ],
                  }),
            ],
          }),
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `flex min-w-0 flex-col gap-3 p-4`,
            children: [
              /* @__PURE__ */ (0, u.jsxs)(jr, {
                label: Y(`detail.composition`),
                children: [
                  /* @__PURE__ */ (0, u.jsx)(Ar, {
                    end:
                      i.reconciled === void 0
                        ? void 0
                        : /* @__PURE__ */ (0, u.jsx)(kr, {
                            tone: `mono`,
                            title: Y(`turns.reconciled`, { factor: i.reconciled.factor.toFixed(3) }),
                            children: an(i.reconciled.factor),
                          }),
                    children: Y(`detail.composition`),
                  }),
                  /* @__PURE__ */ (0, u.jsx)(Hr, { attribution: i, label: Y(`turns.selected`, { index: e.index }) }),
                  /* @__PURE__ */ (0, u.jsx)(Ur, { attribution: i }),
                ],
              }),
              e.compactions.length === 0
                ? null
                : /* @__PURE__ */ (0, u.jsxs)(jr, {
                    label: Y(`turns.compaction`),
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(Ar, { count: e.compactions.length, children: Y(`turns.compaction`) }),
                      /* @__PURE__ */ (0, u.jsx)(`ul`, {
                        className: `m-0 list-none p-0`,
                        children: e.compactions.map((e, t) =>
                          /* @__PURE__ */ (0, u.jsxs)(
                            `li`,
                            {
                              className: `flex flex-wrap items-baseline gap-2 border-t border-line-soft py-1.5 text-[11.5px] first:border-t-0`,
                              children: [
                                /* @__PURE__ */ (0, u.jsx)(`span`, {
                                  className: `font-mono text-[10.5px] text-fg-dim`,
                                  children: cn(e.at),
                                }),
                                /* @__PURE__ */ (0, u.jsx)(zr, { measure: e.before, dense: !0 }),
                                /* @__PURE__ */ (0, u.jsx)(`span`, {
                                  "aria-hidden": `true`,
                                  className: `text-warn`,
                                  children: `→`,
                                }),
                                /* @__PURE__ */ (0, u.jsx)(zr, { measure: e.after, dense: !0 }),
                                /* @__PURE__ */ (0, u.jsx)(`span`, {
                                  className: `text-fg-dim`,
                                  children: e.replacedHistory
                                    ? Y(`turns.compactionReplaced`)
                                    : Y(`turns.compactionContinued`),
                                }),
                                e.trigger === void 0
                                  ? null
                                  : /* @__PURE__ */ (0, u.jsx)(kr, { tone: `soft`, children: e.trigger }),
                              ],
                            },
                            `${String(e.at)}-${String(t)}`,
                          ),
                        ),
                      }),
                    ],
                  }),
              /* @__PURE__ */ (0, u.jsxs)(jr, {
                label: Y(`turns.tools`),
                children: [
                  /* @__PURE__ */ (0, u.jsx)(Ar, { count: e.toolCalls.length, children: Y(`turns.tools`) }),
                  /* @__PURE__ */ (0, u.jsx)(Hp, { calls: e.toolCalls, expanded: n, onToggleExpanded: r }),
                ],
              }),
              /* @__PURE__ */ (0, u.jsx)(Pp, { segments: t, turnSubagents: e.subagents }),
            ],
          }),
        ],
      })
    }
    function Wp(e) {
      const t = []
      for (const n of e)
        (n.compactions.length > 0 &&
          t.push({ kind: `compactions`, key: `c-${String(n.index)}`, turn: n, points: n.compactions }),
          t.push({ kind: `turn`, key: `t-${String(n.index)}`, turn: n }))
      return t
    }
    function Gp({ points: e, turn: t }) {
      const n = e[0],
        r = e[e.length - 1],
        i =
          n === void 0 || r === void 0
            ? ``
            : Y(`compactions.range`, { before: en(n.before.tokens), after: en(r.after.tokens) })
      return /* @__PURE__ */ (0, u.jsx)(`li`, {
        className: `my-1 px-1 text-[11px] text-warn`,
        "data-turn": t.index,
        children: /* @__PURE__ */ (0, u.jsxs)(`details`, {
          className: `ci-fold rounded-lg border border-dashed border-warn/50 bg-warn/6`,
          children: [
            /* @__PURE__ */ (0, u.jsxs)(`summary`, {
              className: `flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 py-1.5`,
              children: [
                /* @__PURE__ */ (0, u.jsx)(Xn, { name: `chevron`, size: 10, className: `ci-chevron` }),
                /* @__PURE__ */ (0, u.jsx)(`span`, {
                  className: `font-semibold`,
                  children: Y(`compactions.count`, { count: e.length }),
                }),
                /* @__PURE__ */ (0, u.jsx)(`span`, { className: `font-mono tabular-nums`, children: i }),
                /* @__PURE__ */ (0, u.jsx)(`span`, {
                  className: `text-fg-dim`,
                  children: n?.replacedHistory === !0 ? Y(`turns.compactionReplaced`) : Y(`turns.compactionContinued`),
                }),
              ],
            }),
            /* @__PURE__ */ (0, u.jsx)(`ul`, {
              className: `m-0 list-none px-2.5 pb-1.5 text-fg-dim`,
              children: e.map((e, t) =>
                /* @__PURE__ */ (0, u.jsxs)(
                  `li`,
                  {
                    className: `flex flex-wrap gap-2 py-0.5`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`span`, { className: `font-mono`, children: ln(e.at) }),
                      /* @__PURE__ */ (0, u.jsx)(`span`, {
                        className: `font-mono tabular-nums`,
                        children: Y(`compactions.range`, { before: en(e.before.tokens), after: en(e.after.tokens) }),
                      }),
                      /* @__PURE__ */ (0, u.jsxs)(`span`, {
                        children: [
                          e.replacedHistory ? Y(`turns.compactionReplaced`) : Y(`turns.compactionContinued`),
                          e.trigger === void 0 ? `` : ` · ${e.trigger}`,
                        ],
                      }),
                    ],
                  },
                  `${String(e.at)}-${String(t)}`,
                ),
              ),
            }),
          ],
        }),
      })
    }
    function Kp(e, t) {
      const n = t.cacheHitRate === null ? `—` : `${String(Math.round(t.cacheHitRate * 100))}%`,
        r = Y(`cost.turnTip`, { index: e, model: t.model ?? `—`, rate: n })
      return t.provisional === !0 ? `${r} · ${Y(`cost.provisional`)}` : r
    }
    function qp({ turn: e, selected: t, onSelect: n, onKeyNav: r, cost: i }) {
      const a = Br(e.attribution),
        o = a.residual > 0 ? rn(a.residual, a.denominator) : void 0,
        s = e.toolCalls.length,
        c = `${Y(`turns.selected`, { index: e.index })}: ${en(e.attribution.total.tokens)}`,
        l = e.userInput.join(` `).trim()
      return /* @__PURE__ */ (0, u.jsx)(`li`, {
        "data-turn": e.index,
        children: /* @__PURE__ */ (0, u.jsx)(`div`, {
          role: `button`,
          tabIndex: 0,
          "data-turn-row": ``,
          className: `ci-row px-2.5 py-2`,
          "data-selected": t,
          "aria-pressed": t,
          onClick: () => n(e.index),
          onKeyDown: (t) => {
            t.key === `ArrowDown`
              ? r(t, 1)
              : t.key === `ArrowUp`
                ? r(t, -1)
                : t.key === `Home`
                  ? r(t, `first`)
                  : t.key === `End`
                    ? r(t, `last`)
                    : (t.key === `Enter` || t.key === ` `) && (t.preventDefault(), n(e.index))
          },
          children: /* @__PURE__ */ (0, u.jsxs)(`span`, {
            className: `grid grid-cols-[22px_minmax(0,1fr)_64px] items-center gap-x-2 gap-y-1.5`,
            children: [
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `font-mono text-[11px] text-fg-3 tabular-nums`,
                children: e.index,
              }),
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: l === `` ? `min-w-0 truncate text-[12.5px] text-fg-3` : `min-w-0 truncate text-[12.5px]`,
                children: l === `` ? Y(`turns.noInput`) : l,
              }),
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `text-end text-[12.5px] font-semibold tabular-nums`,
                children: en(e.attribution.total.tokens),
              }),
              /* @__PURE__ */ (0, u.jsx)(`span`, { "aria-hidden": `true` }),
              /* @__PURE__ */ (0, u.jsx)(Hr, { attribution: e.attribution, label: c, dense: !0 }),
              /* @__PURE__ */ (0, u.jsx)(`span`, { "aria-hidden": `true` }),
              /* @__PURE__ */ (0, u.jsx)(`span`, { "aria-hidden": `true` }),
              /* @__PURE__ */ (0, u.jsxs)(`span`, {
                className: `grid grid-cols-[var(--ci-time-w)_36px_44px_minmax(0,1fr)] items-center gap-x-1.5 text-[10.5px] text-fg-dim tabular-nums`,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(`span`, { children: ln(e.startedAt) }),
                  /* @__PURE__ */ (0, u.jsx)(`span`, {
                    className: `inline-flex items-center gap-0.5`,
                    title: Y(`turns.tools`),
                    children:
                      s === 0
                        ? null
                        : /* @__PURE__ */ (0, u.jsxs)(u.Fragment, {
                            children: [/* @__PURE__ */ (0, u.jsx)(Xn, { name: `tool`, size: 11 }), s],
                          }),
                  }),
                  /* @__PURE__ */ (0, u.jsx)(`span`, {
                    className: `font-mono`,
                    title:
                      e.attribution.reconciled === void 0
                        ? void 0
                        : Y(`turns.reconciled`, { factor: e.attribution.reconciled.factor.toFixed(3) }),
                    children:
                      e.attribution.reconciled === void 0 ? `` : `×${e.attribution.reconciled.factor.toFixed(2)}`,
                  }),
                  /* @__PURE__ */ (0, u.jsxs)(`span`, {
                    className: `flex min-w-0 items-center gap-1.5`,
                    children: [
                      e.subagents.length === 0
                        ? null
                        : /* @__PURE__ */ (0, u.jsxs)(`span`, {
                            className: `inline-flex items-center gap-0.5`,
                            title: Y(`turns.subagents`),
                            children: [
                              /* @__PURE__ */ (0, u.jsx)(Xn, { name: `branch`, size: 11 }),
                              e.subagents.length,
                            ],
                          }),
                      o === void 0
                        ? null
                        : /* @__PURE__ */ (0, u.jsxs)(kr, {
                            tone: `warn`,
                            title: Y(`turns.unknownNote`),
                            children: [Y(`turns.unknown`), ` `, o],
                          }),
                    ],
                  }),
                ],
              }),
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `relative text-end font-mono text-[10.5px] text-fg-dim tabular-nums`,
                "data-tip": i === void 0 || i.usd === null ? void 0 : Kp(e.index, i),
                tabIndex: i === void 0 || i.usd === null ? void 0 : 0,
                children: i === void 0 || i.usd === null ? `` : (i.provisional === !0 ? `~` : ``) + tn(i.usd),
              }),
            ],
          }),
        }),
      })
    }
    function Jp({ turns: e, selected: t, onSelect: n, costs: r }) {
      const i = Wp(e),
        a = e.some((e) => ln(e.startedAt).length > 5) ? `72px` : `34px`
      function o(e, t) {
        e.preventDefault()
        const n = e.currentTarget.closest(`ul`)
        if (n === null) return
        const r = [...n.querySelectorAll(`[data-turn-row]`)],
          i = r.indexOf(e.currentTarget)
        i < 0 ||
          r[t === `first` ? 0 : t === `last` ? r.length - 1 : Math.min(r.length - 1, Math.max(0, i + t))]?.focus()
      }
      return /* @__PURE__ */ (0, u.jsx)(`ul`, {
        className: `m-0 flex list-none flex-col gap-0.5 p-1.5`,
        role: `list`,
        "aria-label": Y(`turns.title`),
        style: { "--ci-time-w": a },
        children: i.map((e) => {
          if (e.kind === `compactions`) return /* @__PURE__ */ (0, u.jsx)(Gp, { points: e.points, turn: e.turn }, e.key)
          const i = r?.get(e.turn.index)
          return /* @__PURE__ */ (0, u.jsx)(
            qp,
            {
              turn: e.turn,
              selected: t === e.turn.index,
              onSelect: n,
              onKeyNav: o,
              ...(i === void 0 ? {} : { cost: i }),
            },
            e.key,
          )
        }),
      })
    }
    const Yp = 1e3
    function Xp({ turns: e, selected: t, onSelect: n }) {
      if (e.length === 0) return null
      const r = e.map((e) => Math.max(0, e.attribution.total.tokens)),
        i = Math.max(1, ...r),
        a = (t) => (e.length === 1 ? 0.5 : t / (e.length - 1)),
        o = (e) => 1 - (e / i) * 0.88,
        s = r.map((e, t) => `${t === 0 ? `M` : `L`}${(a(t) * Yp).toFixed(1)},${(o(e) * 100).toFixed(1)}`).join(` `),
        c = `${s} L${(a(e.length - 1) * Yp).toFixed(1)},100 L${(a(0) * Yp).toFixed(1)},100 Z`,
        l = e.flatMap((e, t) => e.compactions.map((e) => ({ index: t, point: e }))),
        d = t === null ? -1 : e.findIndex((e) => e.index === t)
      return /* @__PURE__ */ (0, u.jsxs)(`figure`, {
        className: `m-0 px-3.5 pt-3 pb-3`,
        children: [
          /* @__PURE__ */ (0, u.jsxs)(`figcaption`, {
            className: `flex items-baseline gap-2 text-[11px] text-fg-dim`,
            children: [
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `text-[12px] font-semibold text-fg`,
                children: Y(`waterfall.title`),
              }),
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `tabular-nums`,
                children: Y(`waterfall.peak`, { tokens: en(i) }),
              }),
              /* @__PURE__ */ (0, u.jsx)(`span`, {
                className: `ms-auto truncate text-fg-3`,
                children: Y(`waterfall.hint`),
              }),
            ],
          }),
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `relative mt-2.5 h-24`,
            role: `group`,
            "aria-label": `${Y(`waterfall.title`)} — ${Y(`waterfall.caption`)}`,
            children: [
              /* @__PURE__ */ (0, u.jsxs)(`svg`, {
                className: `absolute inset-0 block h-full w-full overflow-visible`,
                viewBox: `0 0 1000 100`,
                preserveAspectRatio: `none`,
                "aria-hidden": `true`,
                children: [
                  [0.25, 0.5, 0.75].map((e) =>
                    /* @__PURE__ */ (0, u.jsx)(
                      `line`,
                      {
                        className: `stroke-line-soft [vector-effect:non-scaling-stroke]`,
                        x1: 0,
                        x2: Yp,
                        y1: e * 100,
                        y2: e * 100,
                      },
                      e,
                    ),
                  ),
                  /* @__PURE__ */ (0, u.jsx)(`path`, { className: `fill-accent opacity-[0.14]`, d: c }),
                  /* @__PURE__ */ (0, u.jsx)(`path`, {
                    className: `fill-none stroke-accent stroke-[1.6] [stroke-linejoin:round] [vector-effect:non-scaling-stroke]`,
                    d: s,
                  }),
                  l.map(({ index: e, point: t }, n) =>
                    /* @__PURE__ */ (0, u.jsx)(
                      `line`,
                      {
                        className: `stroke-warn stroke-1 opacity-80 [stroke-dasharray:3_3] [vector-effect:non-scaling-stroke]`,
                        x1: a(e) * Yp,
                        x2: a(e) * Yp,
                        y1: 0,
                        y2: 100,
                        children: /* @__PURE__ */ (0, u.jsx)(`title`, {
                          children: `${Y(`turns.compaction`)}: ${en(t.before.tokens)} → ${en(t.after.tokens)}`,
                        }),
                      },
                      `${String(e)}-${String(n)}`,
                    ),
                  ),
                  d < 0
                    ? null
                    : /* @__PURE__ */ (0, u.jsx)(`line`, {
                        className: `stroke-fg-dim stroke-1 opacity-50 [vector-effect:non-scaling-stroke]`,
                        x1: a(d) * Yp,
                        x2: a(d) * Yp,
                        y1: 0,
                        y2: 100,
                      }),
                ],
              }),
              e.map((e, t) =>
                /* @__PURE__ */ (0, u.jsx)(
                  `button`,
                  {
                    type: `button`,
                    className: `ci-dot`,
                    "data-selected": t === d,
                    style: { left: `${(a(t) * 100).toFixed(2)}%`, top: `${(o(r[t] ?? 0) * 100).toFixed(2)}%` },
                    title: `${Y(`turns.selected`, { index: e.index })} · ${en(e.attribution.total.tokens)}`,
                    "aria-label": `${Y(`turns.selected`, { index: e.index })} · ${en(e.attribution.total.tokens)}`,
                    onClick: () => n(e.index),
                  },
                  e.index,
                ),
              ),
            ],
          }),
        ],
      })
    }
    function Zp({
      session: e,
      title: t,
      cost: n,
      costs: r,
      selectedTurn: i,
      onSelectTurn: a,
      toolsExpanded: o,
      onToggleTools: s,
      onLoadMore: c,
      onHandoff: d,
      onOpenSession: f,
      onJumpTurn: p,
      revealTurns: m = !1,
      settings: h = Je,
    }) {
      let g = (0, l.useId)(),
        _ = `${e.data.session.source}:${e.data.session.id}`,
        [v, y] = (0, l.useState)({ sessionKey: _, selectedTurn: i, tab: m ? `turns` : `overview` }),
        b = v.tab
      v.sessionKey === _
        ? v.selectedTurn !== i &&
          (v.selectedTurn !== null && i !== null && (b = `turns`), y({ sessionKey: _, selectedTurn: i, tab: b }))
        : ((b = `overview`), y({ sessionKey: _, selectedTurn: i, tab: b }))
      const x = (e) => {
          ;(y({ sessionKey: _, selectedTurn: i, tab: `turns` }), p === void 0 ? a(e) : p(e))
        },
        S = e.turns.find((e) => e.index === i),
        C = Qe(h),
        w = $e(b, h)
      return (
        w !== b && ((b = w), y({ sessionKey: _, selectedTurn: i, tab: b })),
        /* @__PURE__ */ (0, u.jsxs)(`article`, {
          className: `flex h-full min-h-0 flex-col overflow-y-auto @3xl:overflow-hidden`,
          "aria-label": t,
          children: [
            /* @__PURE__ */ (0, u.jsx)(Pr, { onOpenSession: f, data: e.data, turns: e.turns, cost: n, onHandoff: d }),
            /* @__PURE__ */ (0, u.jsx)(`div`, {
              role: `tablist`,
              "aria-label": X(`insights.tabs`),
              className: `flex shrink-0 gap-2 overflow-x-auto border-b border-line-soft px-5 py-2`,
              children: C.map((e, t) =>
                /* @__PURE__ */ (0, u.jsx)(
                  `button`,
                  {
                    id: `${g}-${e}`,
                    type: `button`,
                    role: `tab`,
                    "aria-selected": b === e,
                    "aria-controls": `${g}-content`,
                    tabIndex: b === e ? 0 : -1,
                    className:
                      b === e ? `ci-btn min-h-10 bg-bg-2 text-accent active:bg-bg-3` : `ci-btn min-h-10 active:bg-bg-3`,
                    onClick: () => y({ sessionKey: _, selectedTurn: i, tab: e }),
                    onKeyDown: (e) => {
                      const n =
                        e.key === `ArrowRight`
                          ? (t + 1) % C.length
                          : e.key === `ArrowLeft`
                            ? (t + C.length - 1) % C.length
                            : e.key === `Home`
                              ? 0
                              : e.key === `End`
                                ? C.length - 1
                                : void 0
                      n !== void 0 &&
                        (e.preventDefault(),
                        y({ sessionKey: _, selectedTurn: i, tab: C[n] }),
                        e.currentTarget.parentElement?.querySelectorAll(`[role="tab"]`)[n]?.focus())
                    },
                    children: X(`insights.${e}`),
                  },
                  e,
                ),
              ),
            }),
            /* @__PURE__ */ (0, u.jsx)(`div`, {
              id: `${g}-content`,
              role: `tabpanel`,
              "aria-labelledby": `${g}-${b}`,
              tabIndex: 0,
              className: `ci-scroll flex min-h-0 min-w-0 flex-1 flex-col @3xl:overflow-y-auto`,
              children:
                b === `overview`
                  ? /* @__PURE__ */ (0, u.jsx)(qr, {
                      insights: e.data.insights,
                      overview: Tr({ insights: e.data.insights, turns: e.turns, turnCount: e.data.turnCount, cost: n }),
                      onJumpTurn: x,
                      onLoadMore: c,
                      loadingMore: e.loadingMore,
                      pagingFailure:
                        e.moreFailure === void 0
                          ? void 0
                          : /* @__PURE__ */ (0, u.jsx)(wn, { children: Mt(e.moreFailure) }),
                    })
                  : b === `skills`
                    ? /* @__PURE__ */ (0, u.jsx)(
                        Np,
                        {
                          skills: e.data.insights?.skills ?? _r(e.turns, e.data.session.workdir),
                          onJumpTurn: x,
                          loadedTurns: e.data.insights === void 0 ? e.turns.length : void 0,
                          totalTurns: e.data.turnCount,
                          onLoadMore: c,
                          loadingMore: e.loadingMore,
                        },
                        _,
                      )
                    : e.turns.length === 0
                      ? /* @__PURE__ */ (0, u.jsx)(Sn, {
                          title: Y(`session.noTurns`),
                          hint: Y(`session.noTurnsHint`),
                          center: !0,
                        })
                      : /* @__PURE__ */ (0, u.jsxs)(`div`, {
                          className: `flex flex-col @3xl:grid @3xl:min-h-0 @3xl:flex-1 @3xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]`,
                          children: [
                            /* @__PURE__ */ (0, u.jsxs)(`div`, {
                              className: `flex min-w-0 flex-col border-line-soft @3xl:min-h-0 @3xl:border-e`,
                              children: [
                                h.waterfall
                                  ? /* @__PURE__ */ (0, u.jsx)(`div`, {
                                      className: `shrink-0 border-b border-line-soft`,
                                      children: /* @__PURE__ */ (0, u.jsx)(Xp, {
                                        turns: e.turns,
                                        selected: i,
                                        onSelect: a,
                                      }),
                                    })
                                  : null,
                                /* @__PURE__ */ (0, u.jsx)(`div`, {
                                  className: `ci-scroll @3xl:min-h-0 @3xl:flex-1 @3xl:overflow-y-auto @3xl:overscroll-contain`,
                                  children: /* @__PURE__ */ (0, u.jsx)(Jp, {
                                    turns: e.turns,
                                    selected: i,
                                    onSelect: a,
                                    costs: r,
                                  }),
                                }),
                                /* @__PURE__ */ (0, u.jsxs)(`footer`, {
                                  className: `flex shrink-0 items-center justify-between gap-2 border-t border-line-soft px-3.5 py-2 text-[11px] text-fg-dim`,
                                  children: [
                                    /* @__PURE__ */ (0, u.jsx)(`span`, {
                                      className: `tabular-nums`,
                                      children: Y(`session.paging`, {
                                        from: e.turns.length === 0 ? 0 : 1,
                                        to: e.turns.length,
                                        total: e.data.turnCount,
                                      }),
                                    }),
                                    e.turns.length < e.data.turnCount
                                      ? /* @__PURE__ */ (0, u.jsx)(`button`, {
                                          type: `button`,
                                          className: `ci-btn`,
                                          onClick: c,
                                          disabled: e.loadingMore,
                                          children: e.loadingMore ? Y(`session.loadingMore`) : Y(`session.loadMore`),
                                        })
                                      : null,
                                  ],
                                }),
                                e.moreFailure === void 0
                                  ? null
                                  : /* @__PURE__ */ (0, u.jsx)(`div`, {
                                      className: `px-3 pb-3`,
                                      children: /* @__PURE__ */ (0, u.jsx)(wn, { children: Mt(e.moreFailure) }),
                                    }),
                              ],
                            }),
                            /* @__PURE__ */ (0, u.jsx)(`div`, {
                              className: `ci-scroll min-w-0 border-t border-line-soft @3xl:min-h-0 @3xl:overflow-y-auto @3xl:overscroll-contain @3xl:border-t-0`,
                              children:
                                S === void 0
                                  ? /* @__PURE__ */ (0, u.jsx)(Sn, { title: Y(`turns.hint`), center: !0 })
                                  : /* @__PURE__ */ (0, u.jsx)(Up, {
                                      turn: S,
                                      segments: e.data.session.segments,
                                      expandedTools: o,
                                      onToggleTools: s,
                                    }),
                            }),
                          ],
                        }),
            }),
          ],
        })
      )
    }
    function Qp({ open: e, store: t, api: n, sections: r, onClose: i }) {
      const a = (0, l.useRef)(null)
      return (
        (0, l.useEffect)(() => {
          e && a.current?.focus()
        }, [e]),
        e
          ? /* @__PURE__ */ (0, u.jsx)(`div`, {
              ref: a,
              className: `absolute inset-0 z-60 overflow-y-auto outline-none`,
              "data-dsh-sessions-insight-layer": `settings`,
              tabIndex: -1,
              role: `region`,
              "aria-label": Y(`settings.title`),
              onKeyDown: (e) => {
                e.key === `Escape` && (e.preventDefault(), i())
              },
              children: /* @__PURE__ */ (0, u.jsx)(Wt, { store: t, api: n, sections: r, onBack: i }),
            })
          : null
      )
    }
    function $p(e) {
      if (e !== void 0)
        return e === `root-missing`
          ? Y(`sources.reason.root-missing`)
          : e === `root-unreadable`
            ? Y(`sources.reason.root-unreadable`)
            : e === `adapter-error`
              ? Y(`sources.reason.adapter-error`)
              : e
    }
    function em({ sources: e }) {
      return /* @__PURE__ */ (0, u.jsx)(`ul`, {
        className: `m-0 hidden min-w-0 list-none items-center gap-1.5 p-0 @4xl:flex`,
        "aria-label": Y(`sources.title`),
        children: e.map((e) => {
          const t = qn[e.source],
            n = e.available
              ? `${t.label.zh} · ${Y(`sources.available`)} · ${e.root ?? ``}`
              : `${t.label.zh} · ${Y(`sources.unavailable`)} · ${e.errorDetail ?? $p(e.reason) ?? ``}`
          return /* @__PURE__ */ (0, u.jsxs)(
            `li`,
            {
              className: e.available
                ? `inline-flex h-6 items-center gap-1.5 rounded-full border border-line-soft bg-bg-1 ps-1.5 pe-2 text-[11px] whitespace-nowrap`
                : `inline-flex h-6 items-center gap-1.5 rounded-full border border-dashed border-line ps-1.5 pe-2 text-[11px] whitespace-nowrap opacity-60`,
              title: n,
              children: [
                /* @__PURE__ */ (0, u.jsx)(Jn, { source: e.source, size: 12 }),
                /* @__PURE__ */ (0, u.jsx)(`span`, { className: `font-medium text-fg`, children: t.label.zh }),
                /* @__PURE__ */ (0, u.jsx)(`span`, {
                  className: `text-fg-dim tabular-nums`,
                  children: e.available ? String(e.sessions ?? `—`) : Y(`sources.unavailable`),
                }),
              ],
            },
            e.source,
          )
        }),
      })
    }
    function tm({ sources: e, busy: t, sidebarOpen: n, onToggleSidebar: r, onSearch: i, onRefresh: a, onSettings: o }) {
      return /* @__PURE__ */ (0, u.jsxs)(`header`, {
        className: `flex h-12 min-w-0 shrink-0 items-center gap-3 border-b border-line-soft bg-bg px-3`,
        children: [
          /* @__PURE__ */ (0, u.jsx)(`button`, {
            type: `button`,
            className: `ci-icon-btn`,
            "aria-pressed": n,
            "aria-label": Y(`toolbar.sidebar`),
            title: Y(`toolbar.sidebar`),
            onClick: r,
            children: /* @__PURE__ */ (0, u.jsx)(Xn, { name: `sidebar`, size: 15 }),
          }),
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `flex min-w-0 items-center gap-2`,
            children: [
              /* @__PURE__ */ (0, u.jsx)(Zn, { size: 24 }),
              /* @__PURE__ */ (0, u.jsx)(`h1`, {
                className: `m-0 text-[13.5px] font-semibold whitespace-nowrap`,
                children: Y(`entry.label`),
              }),
            ],
          }),
          /* @__PURE__ */ (0, u.jsx)(em, { sources: e }),
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `ms-auto flex min-w-0 items-center gap-1.5`,
            children: [
              o === void 0
                ? null
                : /* @__PURE__ */ (0, u.jsx)(`button`, {
                    type: `button`,
                    className: `ci-btn active:bg-bg-3`,
                    onClick: o,
                    "aria-label": Y(`settings.title`),
                    children: Y(`settings.title`),
                  }),
              /* @__PURE__ */ (0, u.jsxs)(`button`, {
                type: `button`,
                className: `ci-search w-[clamp(160px,28cqw,280px)]`,
                onClick: i,
                children: [
                  /* @__PURE__ */ (0, u.jsx)(Xn, { name: `search`, size: 13 }),
                  /* @__PURE__ */ (0, u.jsx)(`span`, { className: `flex-1 truncate`, children: Y(`search.trigger`) }),
                  /* @__PURE__ */ (0, u.jsx)(Nr, { children: `⌘K` }),
                ],
              }),
              /* @__PURE__ */ (0, u.jsx)(`button`, {
                type: `button`,
                className: `ci-icon-btn`,
                onClick: a,
                "aria-label": Y(`panel.refresh`),
                title: Y(`panel.refresh`),
                children: /* @__PURE__ */ (0, u.jsx)(`span`, {
                  className: t ? `inline-grid motion-safe:animate-spin` : `inline-grid`,
                  children: /* @__PURE__ */ (0, u.jsx)(Xn, { name: `refresh`, size: 15 }),
                }),
              }),
            ],
          }),
        ],
      })
    }
    const nm = `rounded-md border border-line-soft bg-bg-1 px-3 py-1.5 text-xs active:bg-bg-3 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50`
    function rm({ value: e }) {
      if (e === null) return /* @__PURE__ */ (0, u.jsx)(`span`, { children: Y(`utility.balance.unchecked`) })
      if (e.status === `failed`) {
        const t = e.reason === `unauthorized` && e.source === `account` ? `account-unauthorized` : e.reason
        return /* @__PURE__ */ (0, u.jsxs)(`span`, {
          className: `inline-flex flex-wrap items-center gap-3`,
          children: [
            e.source === void 0
              ? null
              : /* @__PURE__ */ (0, u.jsx)(`span`, { children: Y(`utility.balance.source.${e.source}`) }),
            /* @__PURE__ */ (0, u.jsx)(`span`, {
              children: Y(t === void 0 ? `utility.balance.failed` : `utility.balance.failure.${t}`),
            }),
          ],
        })
      }
      return e.status === `ready`
        ? e.value.length === 0 && e.bonusWallets.length === 0
          ? /* @__PURE__ */ (0, u.jsx)(`span`, { children: Y(`utility.balance.empty`) })
          : /* @__PURE__ */ (0, u.jsxs)(`span`, {
              className: `inline-flex flex-wrap items-center gap-3 tabular-nums`,
              children: [
                e.value.map((e, t) =>
                  /* @__PURE__ */ (0, u.jsxs)(`span`, { children: [e.currency, ` `, e.balance] }, `${e.currency}-${t}`),
                ),
                e.bonusWallets.map((e, t) =>
                  /* @__PURE__ */ (0, u.jsxs)(
                    `span`,
                    { children: [Y(`utility.balance.bonus`), ` `, e.currency, ` `, e.balance] },
                    `bonus-${t}`,
                  ),
                ),
                e.available === !1
                  ? /* @__PURE__ */ (0, u.jsx)(`span`, { children: Y(`utility.balance.unavailable`) })
                  : null,
              ],
            })
        : /* @__PURE__ */ (0, u.jsx)(`span`, { children: Y(`utility.balance.${e.status}`) })
    }
    function im({ value: e }) {
      return /* @__PURE__ */ (0, u.jsx)(`span`, {
        children:
          e === null
            ? Y(`utility.version.unchecked`)
            : e.status === `update`
              ? Y(`utility.version.update`, { version: e.latestVersion })
              : e.status === `current`
                ? Y(`utility.version.current`, { version: e.currentVersion })
                : Y(`utility.version.${e.status}`),
      })
    }
    function am({ store: e, settingsStore: t }) {
      const n = Xt(e, t),
        r = Ft(t).value.deepseekBalance
      return /* @__PURE__ */ (0, u.jsxs)(`section`, {
        className: `flex flex-col gap-3 rounded-xl border border-line-soft bg-bg-1 p-4`,
        "aria-label": Y(`utility.balance.title`),
        children: [
          /* @__PURE__ */ (0, u.jsx)(`h2`, {
            className: `m-0 text-sm font-semibold`,
            children: Y(`utility.balance.title`),
          }),
          /* @__PURE__ */ (0, u.jsx)(`div`, {
            role: `status`,
            "aria-live": `polite`,
            children: /* @__PURE__ */ (0, u.jsx)(rm, { value: r ? n.balance : { status: `disabled`, checkedAt: 0 } }),
          }),
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `flex flex-wrap items-center gap-3`,
            children: [
              /* @__PURE__ */ (0, u.jsx)(`button`, {
                className: nm,
                type: `button`,
                disabled: !r || n.balancePending,
                onClick: () => {
                  e.refreshBalance()
                },
                children: n.balancePending ? Y(`utility.loading`) : Y(`utility.balance.refresh`),
              }),
              /* @__PURE__ */ (0, u.jsx)(`a`, {
                className: nm,
                href: nt,
                target: `_blank`,
                rel: `noopener noreferrer`,
                children: Y(`utility.balance.recharge`),
              }),
            ],
          }),
          /* @__PURE__ */ (0, u.jsx)(`p`, {
            className: `m-0 text-xs text-fg-dim`,
            children: Y(`utility.balance.hint`),
          }),
        ],
      })
    }
    function om({ store: e, settingsStore: t }) {
      const n = Xt(e, t),
        r = Ft(t).value.autoCheckVersion
      return /* @__PURE__ */ (0, u.jsxs)(`section`, {
        className: `flex flex-col gap-3 rounded-xl border border-line-soft bg-bg-1 p-4`,
        "aria-label": Y(`utility.version.title`),
        children: [
          /* @__PURE__ */ (0, u.jsx)(`h2`, {
            className: `m-0 text-sm font-semibold`,
            children: Y(`utility.version.title`),
          }),
          /* @__PURE__ */ (0, u.jsx)(`div`, {
            role: `status`,
            "aria-live": `polite`,
            children: /* @__PURE__ */ (0, u.jsx)(im, { value: n.version }),
          }),
          r
            ? null
            : /* @__PURE__ */ (0, u.jsx)(`p`, {
                className: `m-0 text-xs text-fg-dim`,
                children: Y(`utility.version.disabled`),
              }),
          /* @__PURE__ */ (0, u.jsx)(`p`, {
            className: `m-0 text-xs text-fg-dim`,
            children: Y(`utility.version.hint`),
          }),
          /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `flex flex-wrap items-center gap-3`,
            children: [
              /* @__PURE__ */ (0, u.jsx)(`button`, {
                className: nm,
                type: `button`,
                disabled: n.versionPending,
                onClick: () => {
                  e.checkVersion()
                },
                children: n.versionPending ? Y(`utility.loading`) : Y(`utility.version.check`),
              }),
              /* @__PURE__ */ (0, u.jsx)(`a`, {
                className: nm,
                href: et[n.version?.packageName ?? Kt],
                target: `_blank`,
                rel: `noopener noreferrer`,
                children: Y(`utility.version.open`),
              }),
            ],
          }),
        ],
      })
    }
    function sm(e, t) {
      return {
        balance: /* @__PURE__ */ (0, u.jsx)(am, { store: e, settingsStore: t }),
        version: /* @__PURE__ */ (0, u.jsx)(om, { store: e, settingsStore: t }),
      }
    }
    function cm({ store: e, settingsStore: t }) {
      const n = Xt(e, t),
        r = Ft(t).value.deepseekBalance,
        i = n.version?.status === `update`
      return !r && !i
        ? null
        : /* @__PURE__ */ (0, u.jsxs)(`div`, {
            className: `flex shrink-0 flex-wrap items-center gap-3 border-b border-line-soft px-3 py-2 text-xs`,
            "aria-live": `polite`,
            children: [
              r
                ? /* @__PURE__ */ (0, u.jsxs)(`span`, {
                    className: `inline-flex flex-wrap items-center gap-3`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(`strong`, { children: Y(`utility.balance.title`) }),
                      /* @__PURE__ */ (0, u.jsx)(rm, { value: n.balance }),
                      /* @__PURE__ */ (0, u.jsx)(`button`, {
                        className: nm,
                        type: `button`,
                        disabled: n.balancePending,
                        onClick: () => {
                          e.refreshBalance()
                        },
                        children: n.balancePending ? Y(`utility.loading`) : Y(`utility.balance.refresh`),
                      }),
                      /* @__PURE__ */ (0, u.jsx)(`a`, {
                        className: nm,
                        href: nt,
                        target: `_blank`,
                        rel: `noopener noreferrer`,
                        children: Y(`utility.balance.recharge`),
                      }),
                    ],
                  })
                : null,
              i
                ? /* @__PURE__ */ (0, u.jsxs)(`span`, {
                    role: `status`,
                    className: `inline-flex flex-wrap items-center gap-3 text-accent`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(im, { value: n.version }),
                      /* @__PURE__ */ (0, u.jsx)(`a`, {
                        className: nm,
                        href: et[n.version?.packageName ?? Kt],
                        target: `_blank`,
                        rel: `noopener noreferrer`,
                        children: Y(`utility.version.open`),
                      }),
                    ],
                  })
                : null,
            ],
          })
    }
    function lm({
      onOpenSession: e,
      settingsStore: t,
      settingsSections: n,
      utilityStore: r,
      initialPage: i = `sessions`,
    }) {
      const a = (0, l.useMemo)(() => At(), []),
        o = (0, l.useMemo)(() => t ?? new Pt(), [t]),
        s = (0, l.useMemo)(() => r ?? new Yt(a), [r, a]),
        c = (0, l.useMemo)(() => n ?? sm(s, o), [n, s, o]),
        d = Ft(o, a).value,
        [f, p] = (0, l.useState)(i),
        m = (0, l.useCallback)(() => p(`sessions`), []),
        h = Dt(),
        [g, _] = (0, l.useState)(() =>
          h.sources === void 0 || h.workdirs === void 0
            ? { kind: `loading` }
            : {
                kind: `ready`,
                sources: h.sources.sources,
                workdirs: h.workdirs.workdirs,
                failures: h.workdirs.failures,
              },
        ),
        [v, y] = (0, l.useState)(() => h.workdirs?.workdirs[0]?.workdir ?? null),
        [b, x] = (0, l.useState)(null),
        [S, C] = (0, l.useState)(null),
        [w, T] = (0, l.useState)({ kind: `idle` }),
        {
          detail: E,
          cost: D,
          selectedTurn: O,
          setSelectedTurn: k,
          toolsExpanded: A,
          setToolsExpanded: j,
          loadMore: M,
          jumpTurn: N,
          overlaySession: P,
          onMetadataChanged: F,
        } = vn(a, b, d.defaultToolsExpanded),
        [I, L] = (0, l.useState)(0),
        [R, z] = (0, l.useState)(0),
        [B, ee] = (0, l.useState)(!1),
        [V, H] = (0, l.useState)(!1),
        [U, te] = (0, l.useState)(null),
        [ne, W] = (0, l.useState)(!0),
        [re, G] = (0, l.useState)(!0)
      ;((0, l.useEffect)(() => {
        function e(e) {
          ;(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === `k` && (e.preventDefault(), ee((e) => !e))
        }
        return (window.addEventListener(`keydown`, e), () => window.removeEventListener(`keydown`, e))
      }, []),
        (0, l.useEffect)(() => {
          const e = new AbortController()
          ;(_((e) => (e.kind === `ready` ? e : { kind: `loading` })), G(!0))
          let t = I > 0,
            n,
            r = (t) => {
              ;(t
                ? a.workdirs(e.signal, !0).then(async (t) => [await a.sources(e.signal), t])
                : Promise.all([a.sources(e.signal), a.workdirs(e.signal)])
              ).then(([i, a]) => {
                if (!e.signal.aborted) {
                  if ((G(!1), !i.ok)) {
                    if (i.error === `aborted` || (h.workdirs !== void 0 && h.sources !== void 0)) return
                    _({ kind: `failed`, error: i.error, ...(i.detail === void 0 ? {} : { detail: i.detail }) })
                  } else if (a.ok)
                    (t && z((e) => e + 1),
                      H(a.value.refreshing === !0),
                      a.value.refreshing && (n = setTimeout(() => r(!1), 500)),
                      _({
                        kind: `ready`,
                        sources: i.value.sources,
                        workdirs: a.value.workdirs,
                        failures: a.value.failures,
                      }),
                      y((e) =>
                        e !== null && a.value.workdirs.some((t) => t.workdir === e)
                          ? e
                          : (a.value.workdirs[0]?.workdir ?? null),
                      ))
                  else {
                    if (a.error === `aborted` || (h.workdirs !== void 0 && h.sources !== void 0)) return
                    _({ kind: `failed`, error: a.error, ...(a.detail === void 0 ? {} : { detail: a.detail }) })
                  }
                }
              })
            }
          return (
            r(t),
            () => {
              ;(e.abort(), clearTimeout(n), H(!1), G(!1))
            }
          )
        }, [a, I, h]),
        (0, l.useEffect)(() => {
          if (v === null) {
            T({ kind: `idle` })
            return
          }
          const e = new AbortController(),
            t = h.sessions.get(v)
          T(
            t === void 0
              ? { kind: `loading`, workdir: v }
              : { kind: `ready`, workdir: v, sessions: t.sessions, failures: t.failures },
          )
          let n,
            r = () => {
              a.sessions(v, e.signal).then((i) => {
                if (!e.signal.aborted) {
                  if (i.ok)
                    (T({ kind: `ready`, workdir: v, sessions: i.value.sessions.map(P), failures: i.value.failures }),
                      i.value.refreshing && (n = setTimeout(r, 500)),
                      x((e) => {
                        const t = i.value.sessions
                        if (S !== null && t.some((e) => e.id === S.ref.id && e.source === S.ref.source)) return S.ref
                        if (e !== null && t.some((t) => t.id === e.id && t.source === e.source)) return e
                        const n = t[0]
                        return n === void 0 ? null : { source: n.source, id: n.id }
                      }))
                  else {
                    if (i.error === `aborted` || t !== void 0) return
                    T({ kind: `failed`, workdir: v, failure: i })
                  }
                }
              })
            }
          return (
            r(),
            () => {
              ;(e.abort(), clearTimeout(n))
            }
          )
        }, [a, v, R, S, h, P]))
      const ie = E.kind === `ready` ? E.ref : null
      ;(0, l.useEffect)(() => {
        if (S === null || ie === null || !hn(ie, S.ref)) return
        let e = !1
        return (
          N(S.turn).then(() => {
            e || C((e) => (e === S ? null : e))
          }),
          () => {
            e = !0
          }
        )
      }, [S, ie, N])
      const K = (0, l.useCallback)(
          (e) => {
            ;(F(e),
              T((t) => (t.kind === `ready` ? { ...t, sessions: t.sessions.map((t) => gn(t, e)) } : t)),
              h.rename(e))
          },
          [h, F],
        ),
        q = (0, l.useCallback)((e) => {
          ;(ee(!1),
            y(e.workdir),
            C({ ref: { source: e.source, id: e.sessionId }, turn: e.turnIndex }),
            x({ source: e.source, id: e.sessionId }))
        }, [])
      ;(0, l.useEffect)(() => {
        O !== null &&
          document
            .querySelector(`.ci-panel [data-turn="${String(O)}"] [data-turn-row]`)
            ?.scrollIntoView({ block: `nearest` })
      }, [O, E.kind])
      let ae = (0, l.useCallback)(() => {
          ;(Dt().invalidateRequests(), L((e) => e + 1))
        }, []),
        oe = (0, l.useMemo)(() => {
          if (D === null) return
          const e = /* @__PURE__ */ new Map()
          for (const t of D.turns) e.set(t.index, t)
          return e
        }, [D]),
        se = g.kind === `ready` ? g.sources : [],
        ce = se.some((e) => e.available),
        le = [...(g.kind === `ready` ? g.failures : []), ...(w.kind === `ready` ? w.failures : [])],
        ue =
          g.kind === `ready`
            ? /* @__PURE__ */ (0, u.jsx)(sr, {
                onMetadataChanged: K,
                revision: R,
                api: a,
                workdirs: g.workdirs,
                selected: b,
                onSelect: (e) => {
                  ;(x(e), C(null), e.workdir !== void 0 && y(e.workdir))
                },
                onDeleted: (e) => {
                  ;(x((t) => (t?.source === e.source && t.id === e.id ? null : t)),
                    C((t) => (t?.ref.source === e.source && t.ref.id === e.id ? null : t)),
                    h.remove(e),
                    _((e) =>
                      e.kind === `ready`
                        ? {
                            ...e,
                            sources: h.sources?.sources ?? e.sources,
                            workdirs: h.workdirs?.workdirs ?? e.workdirs,
                          }
                        : e,
                    ),
                    T((t) =>
                      t.kind === `ready`
                        ? { ...t, sessions: t.sessions.filter((t) => t.source !== e.source || t.id !== e.id) }
                        : t,
                    ))
                },
                loading: !1,
              })
            : /* @__PURE__ */ (0, u.jsx)(bn, { label: Y(`tree.loadingIndex`) }),
        J = null
      return (
        (J =
          g.kind === `loading`
            ? /* @__PURE__ */ (0, u.jsx)(xn, { label: Y(`panel.loading`) })
            : g.kind === `failed`
              ? /* @__PURE__ */ (0, u.jsx)(Cn, {
                  title: Y(`session.error`, { detail: g.detail ?? g.error }),
                  onRetry: ae,
                })
              : g.workdirs.length === 0
                ? /* @__PURE__ */ (0, u.jsxs)(`div`, {
                    className: `flex h-full flex-col items-center justify-center gap-3 p-6`,
                    children: [
                      /* @__PURE__ */ (0, u.jsx)(Sn, {
                        title: Y(`workdirs.empty`),
                        hint: Y(`empty.noData`),
                        center: !0,
                      }),
                      ce ? null : /* @__PURE__ */ (0, u.jsx)(wn, { children: Y(`empty.noSources`) }),
                    ],
                  })
                : E.kind === `idle`
                  ? /* @__PURE__ */ (0, u.jsx)(Sn, {
                      title: Y(`sessions.pick`),
                      hint: Y(`sessions.pickHint`),
                      center: !0,
                    })
                  : E.kind === `loading`
                    ? /* @__PURE__ */ (0, u.jsx)(xn, { label: Y(`session.loading`) })
                    : E.kind === `failed`
                      ? /* @__PURE__ */ (0, u.jsx)(Cn, {
                          title: Y(`session.error`, { detail: Mt(E.failure) }),
                          onRetry: () => {
                            const e = E.ref
                            ;(x(null), window.setTimeout(() => x(e), 0))
                          },
                        })
                      : /* @__PURE__ */ (0, u.jsx)(
                          Zp,
                          {
                            session: E,
                            settings: d,
                            revealTurns: S !== null,
                            title: E.data.session.title ?? E.ref.id,
                            cost: D,
                            costs: oe,
                            selectedTurn: O,
                            onSelectTurn: k,
                            onJumpTurn: (e) => {
                              N(e)
                            },
                            toolsExpanded: A,
                            onToggleTools: j,
                            onLoadMore: M,
                            onOpenSession: e,
                            onHandoff: () => te({ source: E.ref.source, id: E.ref.id }),
                          },
                          `${E.ref.source}:${E.ref.id}`,
                        )),
        /* @__PURE__ */ (0, u.jsxs)(`div`, {
          className: `ci-panel`,
          style: kn,
          "data-dsh-sessions-insight-view": ``,
          children: [
            /* @__PURE__ */ (0, u.jsxs)(`div`, {
              className: `flex min-h-0 min-w-0 flex-1 flex-col`,
              "data-dsh-sessions-insight-layer": `sessions`,
              "aria-hidden": f === `settings` || void 0,
              inert: f === `settings` || void 0,
              children: [
                /* @__PURE__ */ (0, u.jsx)(tm, {
                  sources: se,
                  busy: re || V,
                  sidebarOpen: ne,
                  onToggleSidebar: () => W((e) => !e),
                  onSearch: () => ee(!0),
                  onRefresh: ae,
                  onSettings: () => p(`settings`),
                }),
                /* @__PURE__ */ (0, u.jsx)(cm, { store: s, settingsStore: o }),
                le.length === 0
                  ? null
                  : /* @__PURE__ */ (0, u.jsx)(`div`, {
                      className: `flex shrink-0 flex-col gap-1.5 border-b border-line-soft px-3 py-2`,
                      children: le.map((e) =>
                        /* @__PURE__ */ (0, u.jsxs)(
                          wn,
                          { children: [e.source, `: `, e.error] },
                          `${e.source}-${e.error}`,
                        ),
                      ),
                    }),
                /* @__PURE__ */ (0, u.jsxs)(`div`, {
                  className: ne
                    ? `grid min-h-0 flex-1 grid-cols-[clamp(220px,30cqw,300px)_minmax(0,1fr)]`
                    : `grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)]`,
                  children: [
                    ne
                      ? /* @__PURE__ */ (0, u.jsx)(`aside`, {
                          className: `min-h-0 min-w-0 border-e border-line-soft bg-sidebar`,
                          children: ue,
                        })
                      : null,
                    /* @__PURE__ */ (0, u.jsx)(`main`, { className: `@container min-h-0 min-w-0`, children: J }),
                  ],
                }),
              ],
            }),
            /* @__PURE__ */ (0, u.jsx)(Qp, { open: f === `settings`, store: o, api: a, sections: c, onClose: m }),
            B ? /* @__PURE__ */ (0, u.jsx)(dr, { api: a, onClose: () => ee(!1), onOpenTurn: q }) : null,
            U === null
              ? null
              : /* @__PURE__ */ (0, u.jsx)(Dn, {
                  onOpenSession: e,
                  api: a,
                  source: U.source,
                  id: U.id,
                  onClose: () => te(null),
                }),
          ],
        })
      )
    }
    const um = `sessions-insight`,
      dm = [`slots`, `locale`, `uiWorkspace`]
    function fm({ size: e }) {
      return /* @__PURE__ */ (0, u.jsxs)(`svg`, {
        "data-dsh-panel-entry": um,
        viewBox: `0 0 16 16`,
        width: e,
        height: e,
        fill: `none`,
        stroke: `currentColor`,
        strokeLinecap: `round`,
        strokeLinejoin: `round`,
        "aria-hidden": `true`,
        children: [
          /* @__PURE__ */ (0, u.jsx)(`circle`, { cx: `6.72`, cy: `6.72`, r: `3.92`, strokeWidth: 1.12 }),
          /* @__PURE__ */ (0, u.jsx)(`path`, { d: `M9.6 9.6 13.12 13.12`, strokeWidth: 1.28 }),
          /* @__PURE__ */ (0, u.jsx)(`path`, { d: `M5.12 4.48h3.2`, strokeWidth: 1.12 }),
          /* @__PURE__ */ (0, u.jsx)(`path`, { d: `M5.12 6.72h2.24`, strokeWidth: 1.12 }),
          /* @__PURE__ */ (0, u.jsx)(`path`, { d: `M5.12 8.96h1.28`, strokeWidth: 1.12 }),
        ],
      })
    }
    function pm(e) {
      if (globalThis.__dshContextInsightApplied === !0) return
      ;((globalThis.__dshContextInsightApplied = !0),
        typeof e.effect == `function` &&
          e.effect(
            () => () => {
              globalThis.__dshContextInsightApplied = void 0
            },
            `sessions-insight: apply claim`,
          ),
        Zt(),
        v(e, xt, { zh: bt, en: yt }, Ct))
      const t = new Pt(),
        n = new Yt(At()),
        r = sm(n, t)
      try {
        Gt(e, t, r, At())
      } catch (e) {
        console.warn(`[sessions-insight] settings registration failed`, e)
      }
      e.effect?.(() => () => n.dispose(), `sessions-insight: utilities`)
      const i = new AbortController(),
        a = setTimeout(() => {
          jt(At(), i.signal).catch(() => void 0)
        }, 0)
      e.effect?.(
        () => () => {
          ;(clearTimeout(a), i.abort())
        },
        `sessions-insight: preload lists`,
      )
      try {
        _(e, {
          id: um,
          order: 30,
          locale: xt,
          label: () => Y(`entry.label`),
          icon: fm,
          panel: () =>
            /* @__PURE__ */ (0, u.jsx)(lm, {
              settingsStore: t,
              utilityStore: n,
              settingsSections: r,
              onOpenSession: async (t) => {
                const n = e.get?.(`uiWorkspace`)
                if (typeof n?.openSession != `function`) throw Error(`uiWorkspace.openSession unavailable`)
                const r = t.startsWith(`session-`) ? t : `session-${t}`,
                  i = await At().handoffReveal(r)
                if (!i.ok) throw Error(i.detail ?? i.error)
                await n.openSession(r)
              },
            }),
        })
      } catch (e) {
        console.warn(`[sessions-insight] panel registration failed`, e)
      }
    }
    ;((exports.ContextInsightPanelIcon = fm), (exports.PANEL_ID = um), (exports.apply = pm), (exports.inject = dm))

    return module.exports
  },
})

//# sourceMappingURL=client.js.map
