import type { ClientContext, Dispose } from "@cyrusdoyle/dsh-plugin-kit-client"
import type { ReactElement } from "react"

import { SETTINGS_ENTRIES, SETTINGS_PACKAGES } from "../../../protocol/settings.ts"
import { LOCALE_NS } from "../../locale/index.ts"
import type { ConfigForms, SettingsApi, SettingsStore } from "../../state/settings.ts"
import { SettingsBundleSection, type SettingsSections, SettingsSummary } from "./settings.tsx"

export interface SettingsClientContext extends ClientContext {
  get?: (name: string) => unknown
  inject?: (
    services: readonly string[],
    callback: (ctx: ClientContext & { configForms: ConfigForms }) => void,
  ) => unknown
}

/** The Host passes these props to every `plugins.bundle.config` entry. */
export interface SettingsSlotProps {
  /** `page` carries the save controls; `summary` is a one-line card extra. */
  view?: "page" | "summary"
  /** The owner's namespace-bound translate; this module keeps its own binding. */
  t?: (key: string, params?: Record<string, unknown>) => string
}

/**
 * Package keys differ from Host entry IDs; both details edit the active entry.
 *
 * Registration failures stay inside this module: a Host without `configForms`
 * or without the bundle slot leaves the panel and the page intact, and the
 * console keeps the only trace.
 * @param ctx - client context that can inject `configForms`.
 * @param store - the shared settings bridge.
 * @param sections - balance/version extensions.
 * @param api - optional Host read so a package detail can retry without the panel.
 */
export function registerSettings(
  ctx: SettingsClientContext,
  store: SettingsStore,
  sections?: SettingsSections,
  api?: SettingsApi,
): void {
  // The slot owner hands every entry its view: `page` renders the body only
  // (the Host draws title/icon/crumb), `summary` one line.
  const SettingsSlot = ({ view }: SettingsSlotProps): ReactElement =>
    view === "summary" ? <SettingsSummary /> : <SettingsBundleSection store={store} api={api} sections={sections} />

  try {
    ctx.inject?.(["configForms"], (child) => {
      try {
        const forms = child.configForms
        const setup = (): Dispose => {
          const attachments = SETTINGS_ENTRIES.map((entry) => forms.get(entry))
          let active: number | undefined
          let detach: Dispose | undefined
          const sync = (): void => {
            const next = attachments.findIndex((form) => form.getSnapshot().status === "ready")
            if (next === active) return
            detach?.()
            active = next
            detach = next < 0 ? undefined : store.attach(attachments[next]!)
          }
          const offs = attachments.map((form) => form.subscribe(sync))
          sync()
          const offSlots = forms.whileServed(SETTINGS_ENTRIES, () => {
            const slots = SETTINGS_PACKAGES.map((key) =>
              child.slots.inject("plugins.bundle.config", () =>
                child.slots.register({ name: "plugins.bundle.config", key, locale: LOCALE_NS }, SettingsSlot),
              ),
            )
            return () => {
              for (const off of slots) off()
            }
          })
          return () => {
            offSlots()
            for (const off of offs) off()
            detach?.()
          }
        }
        if (child.effect === undefined) setup()
        else child.effect(setup, "sessions-insight: configuration forms and package details")
      } catch (error) {
        console.warn("[sessions-insight] settings registration failed", error)
      }
    })
  } catch (error) {
    console.warn("[sessions-insight] settings registration failed", error)
  }
}
