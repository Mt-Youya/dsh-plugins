/** Runtime locale binding; dictionaries are split by language. */
import { en } from "./locale-en.ts"
import type { ContextInsightKey } from "./locale-zh.ts"

export { en } from "./locale-en.ts"
export { zh, type ContextInsightKey } from "./locale-zh.ts"

export const LOCALE_NS = "sessions-insight"

let runtimeTranslate: ((key: string, params?: Record<string, unknown>) => string) | undefined

/** Bind the Host's live locale before rendering labels. */
export function setRuntimeTranslate(translate: (key: string, params?: Record<string, unknown>) => string): void {
  runtimeTranslate = translate
}

/** Fill placeholders, leaving unknown values visible. */
export function fillParams(template: string, params?: Record<string, unknown>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (whole: string, name: string) => {
    const value = params[name]
    return value === undefined ? whole : String(value)
  })
}

export function t(key: ContextInsightKey, params?: Record<string, unknown>): string {
  const translated = runtimeTranslate?.(key, params)
  if (translated !== undefined && translated !== "") return translated
  return fillParams(en[key], params)
}
