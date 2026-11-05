/** Plain wire settings: no Host schema or services may cross into the client. */
export const SETTINGS_PATH = "/api/dsh-sessions-insight/settings"
export const SETTINGS_URL = SETTINGS_PATH.slice(1)
export const SETTINGS_ENTRIES = ["cyrus-dsh-plugins", "sessions-insight"] as const
export const SETTINGS_PACKAGES = ["@cyrusdoyle/dsh-plugins", "@cyrusdoyle/dsh-sessions-insight"] as const

export const SETTINGS_DEFAULTS = Object.freeze({
  sessionOverview: true,
  skillsTab: true,
  waterfall: true,
  defaultToolsExpanded: false,
  // Both utilities leave the machine (balance: api.deepseek.com, version:
  // registry.npmjs.org) and the balance read needs a credential. A fresh
  // install sends nothing until the person opts in.
  deepseekBalance: false,
  autoCheckVersion: false,
})
export type SettingsKey = keyof typeof SETTINGS_DEFAULTS
export type Settings = { [K in SettingsKey]: boolean }
export const SETTINGS_KEYS = Object.keys(SETTINGS_DEFAULTS) as SettingsKey[]

export function isSettings(value: unknown): value is Settings {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    SETTINGS_KEYS.every((key) => typeof Reflect.get(value, key) === "boolean")
  )
}

/** Project only declared booleans; malformed or missing fields retain defaults. */
export function settingsFrom(value: unknown): Settings {
  const settings: Settings = { ...SETTINGS_DEFAULTS }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return settings
  for (const key of SETTINGS_KEYS) {
    const field = Reflect.get(value, key)
    if (typeof field === "boolean") settings[key] = field
  }
  return settings
}

export type SessionTab = "overview" | "turns" | "skills"
export function enabledSessionTabs(settings: Settings): SessionTab[] {
  return [
    ...(settings.sessionOverview ? ["overview" as const] : []),
    "turns",
    ...(settings.skillsTab ? ["skills" as const] : []),
  ]
}
export function resolveSessionTab(tab: string, settings: Settings): SessionTab {
  return enabledSessionTabs(settings).includes(tab as SessionTab) ? (tab as SessionTab) : "turns"
}
