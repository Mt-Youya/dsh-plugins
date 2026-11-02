import type { InsightKey } from "./insight-dictionaries.ts"
import { t } from "./locale.ts"

export { INSIGHT_EN, INSIGHT_ZH } from "./insight-dictionaries.ts"
export type { InsightKey } from "./insight-dictionaries.ts"

/** All insight text follows the plugin's registered locale. */
export function insightLabel(key: InsightKey, params?: Record<string, unknown>): string {
  return t(key, params)
}
