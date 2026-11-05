import type { IncomingMessage, ServerResponse } from "node:http"

import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createPreviewSettings } from "../../../apps/preview/settings.ts"
import { createApi } from "../src/client/api.ts"
import { en, zh } from "../src/client/locale/index.ts"
import { type ConfigForm, type ConfigFormSnapshot, SettingsStore } from "../src/client/state/settings.ts"
import { ContextInsightPanel } from "../src/client/ui/panel.tsx"
import { SessionPane } from "../src/client/ui/session/session-pane.tsx"
import { registerSettings, type SettingsClientContext } from "../src/client/ui/settings/registration.tsx"
import { SettingsPage } from "../src/client/ui/settings/settings.tsx"
import { Config, readSettings } from "../src/config.ts"
import { createSettingsRoute } from "../src/index.ts"
import type { SessionDetail } from "../src/protocol.ts"
import {
  enabledSessionTabs,
  isSettings,
  resolveSessionTab,
  type Settings,
  SETTINGS_DEFAULTS,
  SETTINGS_ENTRIES,
  SETTINGS_KEYS,
  SETTINGS_PACKAGES,
  SETTINGS_PATH,
  settingsFrom,
} from "../src/protocol/settings.ts"

function form(initial: ConfigFormSnapshot = { status: "ready", writable: true, value: SETTINGS_DEFAULTS }) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  const publish = (next: ConfigFormSnapshot): void => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  const controller: ConfigForm = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set: vi.fn(async (key, value) => {
      publish({ ...snapshot, value: { ...settingsFrom(snapshot.value), [key]: value } })
      return true
    }),
  }
  return { controller, publish, listeners }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("settings Config and protocol", () => {
  it("declares native boolean defaults and live fields, with matching plain defaults", () => {
    const schema = Config
    expect(Config.toJSON()).toHaveProperty("refs")
    expect(readSettings(Config({}))).toEqual(SETTINGS_DEFAULTS)
    expect(schema.type).toBe("object")
    expect(Object.keys(schema.dict!)).toEqual(SETTINGS_KEYS)
    for (const key of SETTINGS_KEYS) {
      expect(schema.dict![key]!.type).toBe("boolean")
      expect(schema.dict![key]!.meta).toMatchObject({ default: SETTINGS_DEFAULTS[key], volatile: true })
    }
    expect(isSettings(SETTINGS_DEFAULTS)).toBe(true)
    expect(isSettings({ ...SETTINGS_DEFAULTS, waterfall: "false" })).toBe(false)
    expect(isSettings(null)).toBe(false)
    expect(settingsFrom({ waterfall: false, skillsTab: "false", unrelated: "ignored" })).toEqual({
      ...SETTINGS_DEFAULTS,
      waterfall: false,
    })
  })
  it("ships both outbound utilities off by default", () => {
    expect(SETTINGS_DEFAULTS.deepseekBalance).toBe(false)
    expect(SETTINGS_DEFAULTS.autoCheckVersion).toBe(false)
    expect(readSettings(Config({}))).toMatchObject({ deepseekBalance: false, autoCheckVersion: false })
    for (const key of ["deepseekBalance", "autoCheckVersion"] as const)
      expect(Config.dict![key]!.meta).toMatchObject({ default: false })
  })
  it("reads current volatile references without retaining old values", () => {
    let value = true
    const config = { waterfall: { get: () => value } }
    expect(readSettings(config).waterfall).toBe(true)
    value = false
    expect(readSettings(config).waterfall).toBe(false)
    expect(readSettings()).toEqual(SETTINGS_DEFAULTS)
  })
  it("always retains turns and falls back when a selected tab is disabled", () => {
    const settings = { ...SETTINGS_DEFAULTS, sessionOverview: false, skillsTab: false }
    expect(enabledSessionTabs(settings)).toEqual(["turns"])
    expect(resolveSessionTab("overview", settings)).toBe("turns")
    expect(resolveSessionTab("skills", settings)).toBe("turns")
    expect(resolveSessionTab("unknown", SETTINGS_DEFAULTS)).toBe("turns")
    expect(resolveSessionTab("skills", SETTINGS_DEFAULTS)).toBe("skills")
  })
  it("keeps all locale keys including setting labels bilingual", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    for (const key of SETTINGS_KEYS) expect(en[`settings.${key}`]).toBeTruthy()
  })
})

describe("settings bridge", () => {
  it("subscribes to Host values, serializes UI writes and does not optimistically override a refused write", async () => {
    const { controller, publish, listeners } = form()
    const store = new SettingsStore()
    const off = store.attach(controller)
    expect(listeners.size).toBe(1)
    expect(await store.set("waterfall", false)).toBe(true)
    expect(controller.set).toHaveBeenCalledWith("waterfall", false)
    expect(store.getSnapshot().value.waterfall).toBe(false)
    controller.set = vi.fn(async () => false)
    expect(await store.set("waterfall", true)).toBe(false)
    expect(store.getSnapshot()).toMatchObject({ pending: false, failure: "save", value: { waterfall: false } })
    publish({ status: "ready", writable: false, value: SETTINGS_DEFAULTS })
    expect(await store.set("waterfall", false)).toBe(false)
    off()
    expect(listeners.size).toBe(0)
    expect(store.getSnapshot().writable).toBe(false)
  })
  it("does not let a late GET overwrite an attached form or an aborted read", async () => {
    const store = new SettingsStore()
    let resolve!: (value: { ok: true; value: typeof SETTINGS_DEFAULTS }) => void
    const api = {
      settings: () =>
        new Promise<{ ok: true; value: typeof SETTINGS_DEFAULTS }>((done) => {
          resolve = done
        }),
    }
    const pending = store.load(api, new AbortController().signal)
    store.attach(
      form({ status: "ready", writable: true, value: { ...SETTINGS_DEFAULTS, waterfall: false } }).controller,
    )
    resolve({ ok: true, value: SETTINGS_DEFAULTS })
    await pending
    expect(store.getSnapshot().value.waterfall).toBe(false)
    const detached = new SettingsStore()
    const controller = new AbortController()
    controller.abort()
    await detached.load({ settings: async () => ({ ok: true, value: SETTINGS_DEFAULTS }) }, controller.signal)
    expect(detached.getSnapshot().status).toBe("loading")
  })
  it("retries a failed read and a refused save", async () => {
    const api = {
      settings: vi
        .fn()
        .mockResolvedValueOnce({ ok: false as const, error: "invalid-response", detail: "bad-host" })
        .mockResolvedValueOnce({ ok: true as const, value: { ...SETTINGS_DEFAULTS, waterfall: false } }),
    }
    const store = new SettingsStore()
    await store.load(api, new AbortController().signal)
    expect(store.getSnapshot()).toMatchObject({
      status: "unavailable",
      failure: "read",
      detail: "bad-host",
      writable: false,
    })
    await store.retry()
    expect(store.getSnapshot()).toMatchObject({
      status: "ready",
      failure: null,
      detail: null,
      writable: false,
      value: { waterfall: false },
    })
    expect(api.settings).toHaveBeenCalledTimes(2)

    const { controller } = form()
    const saving = new SettingsStore()
    const off = saving.attach(controller)
    controller.set = vi.fn(async () => false)
    expect(await saving.set("waterfall", false)).toBe(false)
    expect(saving.getSnapshot()).toMatchObject({ failure: "save", pending: false, writable: true })
    const accepted = vi.fn(async () => true)
    controller.set = accepted
    await saving.retry()
    expect(saving.getSnapshot().failure).toBeNull()
    expect(accepted).toHaveBeenCalledWith("waterfall", false)
    off()
  })
  it("uses only in-memory preview forms", async () => {
    const first = createPreviewSettings()
    await first.store.set("deepseekBalance", true)
    expect(first.forms.get(SETTINGS_ENTRIES[0]).getSnapshot().value).toMatchObject({ deepseekBalance: true })
    expect(createPreviewSettings().store.getSnapshot().value.deepseekBalance).toBe(false)
  })
})

describe("settings details and rendering", () => {
  it("registers the same component for both package keys while watching entry IDs and disposes subscriptions", () => {
    const configs = [form(), form({ status: "unavailable", writable: false })]
    const registrations: { options: Record<string, unknown>; component: unknown }[] = []
    const cleanups: (() => void)[] = []
    const release = vi.fn()
    const get = vi.fn(
      (entry: string) => configs[SETTINGS_ENTRIES.indexOf(entry as (typeof SETTINGS_ENTRIES)[number])]!.controller,
    )
    const whileServed = vi.fn((_entries: readonly string[], register: (served: Set<string>) => () => void) =>
      register(new Set([SETTINGS_ENTRIES[0]])),
    )
    const child = {
      configForms: { get, whileServed },
      slots: {
        inject: (_name: string, setup: () => () => void) => setup(),
        register: (options: Record<string, unknown>, component: unknown) => {
          registrations.push({ options, component })
          return release
        },
      },
      locale: {} as SettingsClientContext["locale"],
      effect: (setup: () => () => void) => {
        const off = setup()
        cleanups.push(off)
        return off
      },
    }
    const ctx: SettingsClientContext = {
      ...child,
      inject: (_services, callback) => {
        callback(child)
      },
    }
    const store = new SettingsStore()
    registerSettings(ctx, store)
    expect(get.mock.calls.map(([entry]) => entry)).toEqual(SETTINGS_ENTRIES)
    expect(whileServed.mock.calls[0]![0]).toEqual(SETTINGS_ENTRIES)
    expect(registrations.map(({ options }) => options.key)).toEqual(SETTINGS_PACKAGES)
    expect(registrations.every(({ options }) => options.name === "plugins.bundle.config")).toBe(true)
    configs[0]!.publish({ status: "unavailable", writable: false })
    configs[1]!.publish({ status: "ready", writable: true, value: { ...SETTINGS_DEFAULTS, skillsTab: false } })
    expect(store.getSnapshot().value.skillsTab).toBe(false)
    for (const off of cleanups) off()
    expect(release).toHaveBeenCalledTimes(2)
    expect(configs.every((config) => config.listeners.size === 0)).toBe(true)
  })
  it("renders the bundle page as content only and the summary as one line", () => {
    const readyForm = form({ status: "ready", writable: true, value: { ...SETTINGS_DEFAULTS } }).controller
    const registrations: { options: Record<string, unknown>; component: unknown }[] = []
    const child = {
      configForms: {
        get: () => readyForm,
        whileServed: (_entries: readonly string[], register: (served: Set<string>) => () => void) =>
          register(new Set([SETTINGS_ENTRIES[0]])),
      },
      slots: {
        inject: (_name: string, setup: () => () => void) => setup(),
        register: (options: Record<string, unknown>, component: unknown) => {
          registrations.push({ options, component })
          return () => {}
        },
      },
      locale: {} as SettingsClientContext["locale"],
      effect: (setup: () => () => void) => setup(),
    }
    const ctx: SettingsClientContext = {
      ...child,
      inject: (_services, callback) => {
        callback(child)
      },
    }
    registerSettings(ctx, new SettingsStore())
    const Slot = registrations[0]!.component as (props: { view?: "page" | "summary" }) => ReactElement
    const page = renderToStaticMarkup(createElement(Slot, { view: "page" }))
    expect(page).not.toMatch(/<h1/)
    expect(page).not.toContain("block-size:100%")
    expect(page).not.toContain(en["settings.intro"])
    expect(page.match(/role="switch"/g)).toHaveLength(6)
    const summary = renderToStaticMarkup(createElement(Slot, { view: "summary" }))
    expect(summary).toContain(en["settings.summary"])
    expect(summary).not.toContain('role="switch"')
    expect(summary).not.toMatch(/<h1/)
  })
  it("keeps registration failures out of apply and leaves only a console warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const missing = {
      inject: () => {
        throw new Error("no configForms service")
      },
    } as unknown as SettingsClientContext
    expect(() => registerSettings(missing, new SettingsStore())).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)

    const child = {
      configForms: {
        get: () => form().controller,
        whileServed: (_entries: readonly string[], register: (served: Set<string>) => () => void) =>
          register(new Set()),
      },
      slots: {
        inject: () => {
          throw new Error("slot owner absent")
        },
        register: () => () => {},
      },
      locale: {} as SettingsClientContext["locale"],
      effect: (setup: () => () => void) => setup(),
    }
    const failing: SettingsClientContext = {
      ...child,
      inject: (_services, callback) => {
        callback(child)
      },
    }
    expect(() => registerSettings(failing, new SettingsStore())).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(2)
  })
  it("renders the settings overlay above a session panel that stays mounted", () => {
    const { store } = createPreviewSettings()
    const html = renderToStaticMarkup(
      createElement(ContextInsightPanel, { settingsStore: store, initialPage: "settings" }),
    )
    const sessions = html.match(/<div[^>]*data-dsh-sessions-insight-layer="sessions"[^>]*>/)?.[0]
    const overlay = html.match(/<div[^>]*data-dsh-sessions-insight-layer="settings"[^>]*>/)?.[0]
    expect(sessions).toBeDefined()
    expect(sessions).toContain('aria-hidden="true"')
    expect(sessions).toContain('inert=""')
    expect(overlay).toBeDefined()
    expect(overlay).toContain('tabindex="-1"')
    expect(overlay).toContain('role="region"')
    expect(html.match(/role="switch"/g)).toHaveLength(6)
    expect(html).toContain(en["settings.intro"])
    expect(html).toContain(en["settings.back"])
    // The session tree renders beneath the overlay, inside its own layer: the
    // overlay never replaces it, so closing the overlay cannot remount it.
    const underneath = html.slice(
      html.indexOf('data-dsh-sessions-insight-layer="sessions"'),
      html.indexOf('data-dsh-sessions-insight-layer="settings"'),
    )
    expect(underneath).toContain(en["toolbar.sidebar"])
    expect(underneath).toContain(en["search.trigger"])
    expect(underneath).toContain(en["tree.loadingIndex"])
    expect(underneath).toContain(en["panel.loading"])
  })
  it("renders only the session panel when the initial page is sessions", () => {
    const { store } = createPreviewSettings()
    const html = renderToStaticMarkup(createElement(ContextInsightPanel, { settingsStore: store }))
    const sessions = html.match(/<div[^>]*data-dsh-sessions-insight-layer="sessions"[^>]*>/)?.[0]
    expect(sessions).toBeDefined()
    expect(sessions).not.toContain("aria-hidden")
    expect(sessions).not.toContain("inert")
    expect(html).not.toContain('data-dsh-sessions-insight-layer="settings"')
    expect(html).not.toContain(en["settings.intro"])
    expect(html).not.toContain('role="switch"')
    expect(html).toContain(en["search.trigger"])
    expect(html).toContain(en["tree.loadingIndex"])
  })
  it("renders six labelled switches and extension sections in the scoped surface", () => {
    const { store } = createPreviewSettings()
    const html = renderToStaticMarkup(
      createElement(SettingsPage, {
        store,
        sections: {
          balance: createElement("section", null, "balance-extension"),
          version: createElement("section", null, "version-extension"),
        },
      }),
    )
    expect(html.match(/role="switch"/g)).toHaveLength(6)
    expect(html).toContain('class="ci-panel"')
    expect(html).toContain("balance-extension")
    expect(html).toContain("version-extension")
    expect(html).toContain("aria-describedby")
  })
  it("renders the loading, unavailable, save-failed and ready states with a retry control", async () => {
    let html = renderToStaticMarkup(createElement(SettingsPage, { store: new SettingsStore() }))
    expect(html).toContain(en["settings.loading"])
    expect(html).not.toContain('role="switch"')

    const unavailable = new SettingsStore()
    unavailable.attach(form({ status: "unavailable", writable: false }).controller)
    html = renderToStaticMarkup(createElement(SettingsPage, { store: unavailable }))
    expect(html).toContain(en["settings.unavailable"])
    expect(html).toContain("0.2.1-rc.5")
    expect(html).toContain(en["settings.retry"])
    expect(html).toMatch(/role="alert"/)

    const failedRead = new SettingsStore()
    await failedRead.load(
      { settings: async () => ({ ok: false, error: "network", detail: "host-down" }) },
      new AbortController().signal,
    )
    html = renderToStaticMarkup(createElement(SettingsPage, { store: failedRead }))
    expect(html).toContain(en["settings.readFailed"].replace("{detail}", "host-down"))
    expect(html).toContain(en["settings.retry"])

    const refused = form()
    const saveFailed = new SettingsStore()
    saveFailed.attach(refused.controller)
    refused.controller.set = vi.fn(async () => false)
    await saveFailed.set("waterfall", false)
    html = renderToStaticMarkup(createElement(SettingsPage, { store: saveFailed }))
    expect(html).toContain(en["settings.saveFailed"])
    expect(html).toContain(en["settings.retry"])
    expect(html.match(/role="switch"/g)).toHaveLength(6)

    html = renderToStaticMarkup(createElement(SettingsPage, { store: createPreviewSettings().store }))
    expect(html.match(/role="switch"/g)).toHaveLength(6)
    expect(html).toContain(en["settings.saved"])
  })
  it("renders turns with no optional tabs or waterfall when disabled", () => {
    const data: SessionDetail = {
      session: {
        source: "claude",
        id: "s",
        workdir: "/work",
        createdAt: 0,
        updatedAt: 0,
        turns: [],
        segments: [],
        dataQuality: [],
      },
      turnCount: 0,
      offset: 0,
      limit: 40,
      meta: { cached: false, elapsedMs: 0, bytes: 0, residualTurns: 0, reconciledTurns: 0 },
    }
    const turn = {
      index: 1,
      startedAt: 1000,
      endedAt: 2000,
      userInput: ["question"],
      assistantText: [],
      toolCalls: [],
      subagents: [],
      compactions: [],
      attribution: { total: { tokens: 100, precision: "exact" as const, basis: "usage" as const }, parts: [] },
    }
    data.session.turns = [turn]
    data.turnCount = 1
    const props = {
      session: { data, turns: [turn], loadingMore: false },
      title: "Session",
      cost: null,
      costs: undefined,
      selectedTurn: 1,
      onSelectTurn() {},
      toolsExpanded: false,
      onToggleTools() {},
      onLoadMore() {},
      onHandoff() {},
      settings: { ...SETTINGS_DEFAULTS, sessionOverview: false, skillsTab: false, waterfall: false },
    }
    const html = renderToStaticMarkup(createElement(SessionPane, props))
    const withWaterfall = renderToStaticMarkup(
      createElement(SessionPane, { ...props, settings: { ...props.settings, waterfall: true } }),
    )
    expect(withWaterfall).toContain("Cumulative level")
    expect(html.match(/role="tab"/g)).toHaveLength(1)
    expect(html).toContain("Turns")
    expect(html).not.toContain("Session overview")
    expect(html).not.toContain("Cumulative level")
  })
})

describe("settings GET", () => {
  it("returns live settings through the existing envelope and rejects writes", () => {
    let settings: Settings = { ...SETTINGS_DEFAULTS }
    const route = createSettingsRoute(() => settings)
    expect(route.path).toBe(SETTINGS_PATH)
    const headers: Record<string, string> = {}
    let body = ""
    const res = {
      writeHead: (status: number, values: Record<string, string>) => {
        res.statusCode = status
        Object.assign(headers, values)
      },
      end: (value: string) => {
        body = value
      },
      statusCode: 0,
    } as unknown as ServerResponse
    const req = { method: "GET", headers: { host: "localhost" } } as IncomingMessage
    route.handler(req, res)
    expect(JSON.parse(body)).toEqual({ ok: true, value: SETTINGS_DEFAULTS })
    settings = { ...settings, waterfall: false }
    route.handler(req, res)
    expect(JSON.parse(body).value.waterfall).toBe(false)
    route.handler({ ...req, method: "POST" } as IncomingMessage, res)
    expect(res.statusCode).toBe(405)
  })
  it("adds the guarded settings method without changing the existing transport", async () => {
    const fetch = vi.fn(
      async (_url: string, _options?: RequestInit) =>
        new Response(JSON.stringify({ ok: true, value: SETTINGS_DEFAULTS }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetch)
    expect(await createApi().settings()).toEqual({ ok: true, value: SETTINGS_DEFAULTS })
    expect(fetch.mock.calls[0]![0]).toBe("api/dsh-sessions-insight/settings")
  })
})
