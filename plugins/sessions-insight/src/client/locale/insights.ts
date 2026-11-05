import type { InsightKey } from "./dictionaries/insights.ts"
import { t } from "./index.ts"

export { INSIGHT_EN, INSIGHT_ZH } from "./dictionaries/insights.ts"
export type { InsightKey } from "./dictionaries/insights.ts"

/** All insight text follows the plugin's registered locale. */
export function insightLabel(key: InsightKey, params?: Record<string, unknown>): string {
  return t(key, params)
}
