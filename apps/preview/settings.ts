import {
  type ConfigForm,
  type ConfigForms,
  type ConfigFormSnapshot,
  SettingsStore,
} from "../../plugins/sessions-insight/src/client/state/settings.ts"
import {
  SETTINGS_DEFAULTS,
  SETTINGS_ENTRIES,
  settingsFrom,
} from "../../plugins/sessions-insight/src/protocol/settings.ts"

/** In-memory configForms simulation. No Host writes, disk storage or credentials. */
export function createPreviewSettings(): { store: SettingsStore; forms: ConfigForms } {
  let snapshot: ConfigFormSnapshot = { status: "ready", writable: true, value: { ...SETTINGS_DEFAULTS } }
  const listeners = new Set<() => void>()
  const form: ConfigForm = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set: async (key, value) => {
      if (!(key in SETTINGS_DEFAULTS)) return false
      snapshot = { ...snapshot, value: { ...settingsFrom(snapshot.value), [key]: value } }
      for (const listener of listeners) listener()
      return true
    },
  }
  const forms: ConfigForms = {
    get: () => form,
    whileServed: (entries, register) => register(new Set(entries)),
  }
  const store = new SettingsStore()
  store.attach(forms.get(SETTINGS_ENTRIES[0]))
  return { store, forms }
}
