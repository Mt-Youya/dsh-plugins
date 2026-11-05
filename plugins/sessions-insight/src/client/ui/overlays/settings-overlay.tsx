/**
 * The settings overlay rendered above the live panel.
 *
 * The session tree stays mounted underneath, so its scroll positions, selected
 * tab and open dialogs survive a settings visit. `inert` on that layer keeps
 * keyboard focus inside this region; Escape mirrors the back control.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/client/ui/settings-overlay
 */

import { useEffect, useRef } from "react"
import type { ReactElement } from "react"

import { t } from "../../locale/index.ts"
import type { SettingsApi, SettingsStore } from "../../state/settings.ts"
import { SettingsPage, type SettingsSections } from "../settings/settings.tsx"

/**
 * Render the settings region, or nothing while it is closed.
 * @param props - the shared settings bridge, optional Host read, extension
 * sections, whether the region is open, and the close action.
 * @returns the overlay region, focused when it opens.
 */
export function SettingsOverlay({
  open,
  store,
  api,
  sections,
  onClose,
}: {
  open: boolean
  store: SettingsStore
  api?: SettingsApi
  sections?: SettingsSections
  onClose: () => void
}): ReactElement | null {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])
  if (!open) return null
  return (
    <div
      ref={ref}
      className="absolute inset-0 z-60 overflow-y-auto outline-none"
      data-dsh-sessions-insight-layer="settings"
      tabIndex={-1}
      role="region"
      aria-label={t("settings.title")}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.preventDefault()
        onClose()
      }}
    >
      <SettingsPage store={store} api={api} sections={sections} onBack={onClose} />
    </div>
  )
}
