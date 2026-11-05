import type { ReactElement } from "react"

import { RECHARGE_LINK, UPDATE_LINKS } from "../../../protocol/utilities.ts"
import type { BalanceValue, VersionValue } from "../../../protocol/utilities.ts"
import { PLUGIN_NAME } from "../../../version.ts"
import { t } from "../../locale/index.ts"
import type { SettingsStore } from "../../state/settings.ts"
import { useSettings } from "../../state/settings.ts"
import type { UtilityStore } from "../../state/utilities.ts"
import { useUtilities } from "../../state/utilities.ts"
import type { SettingsSections } from "./settings.tsx"

const ACTION =
  "rounded-md border border-line-soft bg-bg-1 px-3 py-1.5 text-xs active:bg-bg-3 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
export function BalanceDisplay({ value }: { value: BalanceValue | null }): ReactElement {
  if (value === null) return <span>{t("utility.balance.unchecked")}</span>
  if (value.status === "failed") {
    const reason = value.reason === "unauthorized" && value.source === "account" ? "account-unauthorized" : value.reason
    return (
      <span className="inline-flex flex-wrap items-center gap-3">
        {value.source === undefined ? null : <span>{t(`utility.balance.source.${value.source}`)}</span>}
        <span>{reason === undefined ? t("utility.balance.failed") : t(`utility.balance.failure.${reason}`)}</span>
      </span>
    )
  }
  if (value.status !== "ready") return <span>{t(`utility.balance.${value.status}`)}</span>
  if (value.value.length === 0 && value.bonusWallets.length === 0) return <span>{t("utility.balance.empty")}</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-3 tabular-nums">
      {value.value.map((wallet, index) => (
        <span key={`${wallet.currency}-${index}`}>
          {wallet.currency} {wallet.balance}
        </span>
      ))}
      {value.bonusWallets.map((wallet, index) => (
        <span key={`bonus-${index}`}>
          {t("utility.balance.bonus")} {wallet.currency} {wallet.balance}
        </span>
      ))}
      {value.available === false ? <span>{t("utility.balance.unavailable")}</span> : null}
    </span>
  )
}
export function VersionDisplay({ value }: { value: VersionValue | null }): ReactElement {
  return (
    <span>
      {value === null
        ? t("utility.version.unchecked")
        : value.status === "update"
          ? t("utility.version.update", { version: value.latestVersion })
          : value.status === "current"
            ? t("utility.version.current", { version: value.currentVersion })
            : t(`utility.version.${value.status}`)}
    </span>
  )
}
function BalanceSection({ store, settingsStore }: { store: UtilityStore; settingsStore: SettingsStore }): ReactElement {
  const snapshot = useUtilities(store, settingsStore)
  const enabled = useSettings(settingsStore).value.deepseekBalance
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-line-soft bg-bg-1 p-4"
      aria-label={t("utility.balance.title")}
    >
      <h2 className="m-0 text-sm font-semibold">{t("utility.balance.title")}</h2>
      <div role="status" aria-live="polite">
        <BalanceDisplay value={enabled ? snapshot.balance : { status: "disabled", checkedAt: 0 }} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={ACTION}
          type="button"
          disabled={!enabled || snapshot.balancePending}
          onClick={() => {
            void store.refreshBalance()
          }}
        >
          {snapshot.balancePending ? t("utility.loading") : t("utility.balance.refresh")}
        </button>
        <a className={ACTION} href={RECHARGE_LINK} target="_blank" rel="noopener noreferrer">
          {t("utility.balance.recharge")}
        </a>
      </div>
      <p className="m-0 text-xs text-fg-dim">{t("utility.balance.hint")}</p>
    </section>
  )
}
function VersionSection({ store, settingsStore }: { store: UtilityStore; settingsStore: SettingsStore }): ReactElement {
  const snapshot = useUtilities(store, settingsStore)
  const automatic = useSettings(settingsStore).value.autoCheckVersion
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-line-soft bg-bg-1 p-4"
      aria-label={t("utility.version.title")}
    >
      <h2 className="m-0 text-sm font-semibold">{t("utility.version.title")}</h2>
      <div role="status" aria-live="polite">
        <VersionDisplay value={snapshot.version} />
      </div>
      {!automatic ? <p className="m-0 text-xs text-fg-dim">{t("utility.version.disabled")}</p> : null}
      <p className="m-0 text-xs text-fg-dim">{t("utility.version.hint")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={ACTION}
          type="button"
          disabled={snapshot.versionPending}
          onClick={() => {
            void store.checkVersion()
          }}
        >
          {snapshot.versionPending ? t("utility.loading") : t("utility.version.check")}
        </button>
        <a
          className={ACTION}
          href={UPDATE_LINKS[snapshot.version?.packageName ?? PLUGIN_NAME]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("utility.version.open")}
        </a>
      </div>
    </section>
  )
}
export function makeUtilitySections(store: UtilityStore, settingsStore: SettingsStore): SettingsSections {
  return {
    balance: <BalanceSection store={store} settingsStore={settingsStore} />,
    version: <VersionSection store={store} settingsStore={settingsStore} />,
  }
}
export function UtilityStrip({
  store,
  settingsStore,
}: {
  store: UtilityStore
  settingsStore: SettingsStore
}): ReactElement | null {
  const snapshot = useUtilities(store, settingsStore)
  const enabled = useSettings(settingsStore).value.deepseekBalance
  const update = snapshot.version?.status === "update"
  if (!enabled && !update) return null
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-soft px-3 py-2 text-xs"
      aria-live="polite"
    >
      {enabled ? (
        <span className="inline-flex flex-wrap items-center gap-3">
          <strong>{t("utility.balance.title")}</strong>
          <BalanceDisplay value={snapshot.balance} />
          <button
            className={ACTION}
            type="button"
            disabled={snapshot.balancePending}
            onClick={() => {
              void store.refreshBalance()
            }}
          >
            {snapshot.balancePending ? t("utility.loading") : t("utility.balance.refresh")}
          </button>
          <a className={ACTION} href={RECHARGE_LINK} target="_blank" rel="noopener noreferrer">
            {t("utility.balance.recharge")}
          </a>
        </span>
      ) : null}
      {update ? (
        <span role="status" className="inline-flex flex-wrap items-center gap-3 text-accent">
          <VersionDisplay value={snapshot.version} />
          <a
            className={ACTION}
            href={UPDATE_LINKS[snapshot.version?.packageName ?? PLUGIN_NAME]}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("utility.version.open")}
          </a>
        </span>
      ) : null}
    </div>
  )
}
