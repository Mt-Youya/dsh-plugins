import Schema from "@deepseek-ai/schemastery"

import { type Settings, SETTINGS_DEFAULTS, SETTINGS_KEYS } from "./protocol/settings.ts"

/** Native schemastery is required by settings' volatileForm / plainSchema. */
export const Config = Schema.object(
  Object.fromEntries(SETTINGS_KEYS.map((key) => [key, Schema.boolean().default(SETTINGS_DEFAULTS[key]).volatile()])),
)

export type SettingsConfig = Partial<{ [K in keyof Settings]: boolean | { get(): boolean } }>

/** Read live refs on each request, not just when the fiber mounts. */
export function readSettings(config: SettingsConfig = {}): Settings {
  const settings: Settings = { ...SETTINGS_DEFAULTS }
  for (const key of SETTINGS_KEYS) {
    const field = config[key]
    const value = typeof field === "object" && field !== null ? field.get() : field
    if (typeof value === "boolean") settings[key] = value
  }
  return settings
}
