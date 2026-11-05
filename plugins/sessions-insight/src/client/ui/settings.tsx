import type { ReactElement, ReactNode } from "react"
import { useId } from "react"

import type { SettingsKey } from "../../protocol/settings.ts"
import { t } from "../locale.ts"
import {
  type SettingsApi,
  type SettingsSnapshot,
  settingsState,
  type SettingsState,
  type SettingsStore,
  useSettings,
} from "../state/settings.ts"

/** Extension sections render inside the same scoped settings surface. */
export interface SettingsSections {
  balance?: ReactNode
  version?: ReactNode
}

const GROUPS: { title: "settings.modules" | "settings.utilities"; keys: SettingsKey[] }[] = [
  { title: "settings.modules", keys: ["sessionOverview", "skillsTab", "waterfall", "defaultToolsExpanded"] },
  { title: "settings.utilities", keys: ["deepseekBalance", "autoCheckVersion"] },
]

/**
 * The failure sentence for the unavailable state: either the read's Host
 * detail, the read-only notice, or the missing-form notice.
 * @param snapshot - the latest bridge snapshot.
 * @returns the visible message.
 */
function unavailableText(snapshot: SettingsSnapshot): string {
  if (snapshot.failure === "read") return t("settings.readFailed", { detail: snapshot.detail ?? "—" })
  if (snapshot.status === "ready") return t("settings.readonly")
  return t("settings.unavailable")
}

/** Retry control shared by the three failure states. */
function RetryButton({ store }: { store: SettingsStore }): ReactElement {
  return (
    <button type="button" className="ci-btn self-start" onClick={() => void store.retry()}>
      {t("settings.retry")}
    </button>
  )
}

/** The status row: the four states each get exactly one sentence or alert block. */
function SettingsStatus({
  store,
  snapshot,
  state,
}: {
  store: SettingsStore
  snapshot: SettingsSnapshot
  state: SettingsState
}): ReactElement {
  if (state === "loading") {
    return (
      <p role="status" className="m-0 text-xs text-fg-dim">
        {t("settings.loading")}
      </p>
    )
  }
  if (state === "unavailable") {
    return (
      <div role="alert" className="flex flex-col gap-2 rounded-xl border border-err/40 bg-err/5 p-4">
        <p className="m-0 text-sm text-err">{unavailableText(snapshot)}</p>
        <p className="m-0 text-xs text-fg-dim">{t("settings.requiresHost")}</p>
        <RetryButton store={store} />
      </div>
    )
  }
  if (state === "save-failed") {
    return (
      <div role="alert" className="flex flex-col gap-2 rounded-xl border border-warn/40 bg-warn/6 p-4">
        <p className="m-0 text-sm text-warn">{t("settings.saveFailed")}</p>
        <RetryButton store={store} />
      </div>
    )
  }
  return (
    <p role="status" className="m-0 text-xs text-fg-dim">
      {snapshot.pending ? t("settings.saving") : t("settings.saved")}
    </p>
  )
}

/** One labelled switch row; disabled whenever the Host form is not writable. */
function SettingsSwitch({
  id,
  name,
  store,
  snapshot,
}: {
  id: string
  name: SettingsKey
  store: SettingsStore
  snapshot: SettingsSnapshot
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-soft p-4 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-1">
        <label id={`${id}-${name}`} htmlFor={`${id}-${name}-switch`} className="text-sm font-medium">
          {t(`settings.${name}`)}
        </label>
        <p id={`${id}-${name}-hint`} className="m-0 text-xs text-fg-dim">
          {t(`settings.${name}.hint`)}
        </p>
      </div>
      <button
        id={`${id}-${name}-switch`}
        type="button"
        role="switch"
        aria-checked={snapshot.value[name]}
        aria-labelledby={`${id}-${name}`}
        aria-describedby={`${id}-${name}-hint`}
        disabled={!snapshot.writable || snapshot.pending}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50 ${snapshot.value[name] ? "bg-accent" : "bg-bg-3"}`}
        onClick={() => {
          void store.set(name, !snapshot.value[name])
        }}
      >
        <span
          aria-hidden="true"
          className={`h-5 w-5 rounded-full bg-bg ${snapshot.value[name] ? "ms-auto" : "me-auto"}`}
        />
      </button>
    </div>
  )
}

/**
 * The content area only: no page title, back control or full-height box, so
 * the embedded page and the Host's bundle detail page share one body.
 * @param store - the settings bridge.
 * @param api - optional Host read, used by the retry row when the form is absent.
 * @param sections - balance/version extensions rendered below the switches.
 * @returns the settings body.
 */
export function SettingsContent({
  store,
  api,
  sections,
}: {
  store: SettingsStore
  api?: SettingsApi
  sections?: SettingsSections
}): ReactElement {
  const snapshot = useSettings(store, api)
  const state = settingsState(snapshot)
  const id = useId()
  const loaded = snapshot.status === "ready"
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {state === "unavailable" || state === "loading" ? (
        <SettingsStatus store={store} snapshot={snapshot} state={state} />
      ) : null}
      {loaded ? (
        <>
          {GROUPS.map((group) => (
            <section key={group.title} aria-labelledby={`${id}-${group.title}`} className="flex flex-col gap-2">
              <h2 id={`${id}-${group.title}`} className="m-0 text-sm font-semibold">
                {t(group.title)}
              </h2>
              <div className="overflow-clip rounded-xl border border-line-soft bg-bg-1">
                {group.keys.map((key) => (
                  <SettingsSwitch key={key} id={id} name={key} store={store} snapshot={snapshot} />
                ))}
              </div>
            </section>
          ))}
          {sections?.balance}
          {sections?.version}
        </>
      ) : null}
      {state === "ready" || state === "save-failed" ? (
        <SettingsStatus store={store} snapshot={snapshot} state={state} />
      ) : null}
    </div>
  )
}

/**
 * Content-only surface for the Host's bundle detail page: the Host draws the
 * page title, icon and crumb, and the slot owner passes `view: "page"`.
 * @param store - the settings bridge.
 * @param api - optional Host read for the retry row.
 * @param sections - balance/version extensions.
 * @returns the body inside its own style scope, without page chrome.
 */
export function SettingsBundleSection({
  store,
  api,
  sections,
}: {
  store: SettingsStore
  api?: SettingsApi
  sections?: SettingsSections
}): ReactElement {
  return (
    <div className="ci-panel" data-dsh-sessions-insight-view="" style={{ color: "var(--color-fg)", minInlineSize: 0 }}>
      <div className="mx-auto flex w-full max-w-3xl flex-col">
        <SettingsContent store={store} api={api} sections={sections} />
      </div>
    </div>
  )
}

/** One-line bundle summary, for the slot's `summary` view. */
export function SettingsSummary(): ReactElement {
  return <span>{t("settings.summary")}</span>
}

/** The panel's embedded settings page: page chrome plus the shared content. */
export function SettingsPage({
  store,
  api,
  onBack,
  sections,
}: {
  store: SettingsStore
  api?: SettingsApi
  onBack?: () => void
  sections?: SettingsSections
}): ReactElement {
  return (
    <div
      className="ci-panel"
      data-dsh-sessions-insight-view=""
      style={{
        color: "var(--color-fg)",
        background: "var(--color-bg)",
        minInlineSize: 0,
        blockSize: "100%",
        overflow: "auto",
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-5">
        <header className="flex flex-col gap-2">
          {onBack === undefined ? null : (
            <button type="button" className="ci-btn self-start active:bg-bg-3" onClick={onBack}>
              {t("settings.back")}
            </button>
          )}
          <h1 className="m-0 text-lg font-semibold">{t("settings.title")}</h1>
          <p className="m-0 text-sm text-fg-dim">{t("settings.intro")}</p>
        </header>
        <SettingsContent store={store} api={api} sections={sections} />
      </div>
    </div>
  )
}
