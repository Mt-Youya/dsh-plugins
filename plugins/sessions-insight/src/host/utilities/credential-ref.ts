/**
 * Which credential reference the balance check resolves.
 *
 * The Host `settings` service describes every profile entry's live config. The
 * DeepSeek official adapter (`llm-deepseek`, package
 * `@deepseek-ai/dsh-llm-deepseek-api-key`) exposes its API key reference as
 * `apiKeyEnv`, a `credential-ref` field whose default is `DEEPSEEK_API_KEY`.
 * A user who renames that reference on the Models page expects the balance panel
 * to follow, so the reference is read from there on every balance read instead
 * of being hard-coded.
 *
 * Only the DeepSeek official adapter is followed. Custom providers keep their
 * own credentials and must not redirect this plugin's lookup; any missing or
 * invalid settings data silently falls back to the default reference so the
 * balance route never fails because of this resolution.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/host/utilities/credential-ref
 */

import { isRecord } from "../../protocol/utilities.ts"

/** Reference used when the Host configures nothing, or configures it badly. */
export const DEFAULT_CREDENTIAL_REF = "DEEPSEEK_API_KEY"

/**
 * The one spelling rule for a configured credential reference: a non-blank
 * trimmed string wins, everything else falls back to the default.
 * @param value - whatever the Host config or a caller supplied.
 * @returns a non-empty credential reference.
 */
export function normalizeCredentialRef(value: unknown): string {
  const ref = typeof value === "string" ? value.trim() : ""
  return ref === "" ? DEFAULT_CREDENTIAL_REF : ref
}

/** Profile entry id of the DeepSeek official adapter (patch id `llm-deepseek`). */
export const DEEPSEEK_ADAPTER_ENTRY = "llm-deepseek"

/**
 * Structural face of the Host `settings` service, narrowed to the one method
 * this plugin calls. The real service also carries `revision` bookkeeping the
 * plugin has no use for.
 */
export interface SettingsFace {
  /** Synchronous description of every profile entry's live configuration. */
  describe(options?: unknown): unknown
}

/**
 * Resolve the DeepSeek credential reference for one balance read.
 *
 * Never cached across reads: `apiKeyEnv` can change while the panel is open.
 * @param settings - the Host settings service, when this fiber has one.
 * @returns a non-empty credential reference.
 */
export function credentialRefFrom(settings: SettingsFace | undefined): string {
  try {
    const entries = settings?.describe()
    if (!Array.isArray(entries)) return DEFAULT_CREDENTIAL_REF
    const entry = (entries as unknown[]).find((row) => isRecord(row) && row.ns === DEEPSEEK_ADAPTER_ENTRY)
    const value = isRecord(entry) ? entry.value : undefined
    return normalizeCredentialRef(isRecord(value) ? value.apiKeyEnv : undefined)
  } catch {
    return DEFAULT_CREDENTIAL_REF
  }
}
