/**
 * Browser half of the context-insight plugin.
 *
 * Contributes one row into the sidebar shell's own global panel list and its
 * page into the layout's keyed `main` slot. The shell then owns the row box,
 * the label, the active highlight and the panel switch exactly as it does for
 * the shipped Plugins and Schedule pages.
 *
 * The two registrations and the locale binding are the kit's; what this module
 * owns is the panel's identity — its id, row order, glyph and page — and the
 * page-lifetime claim that keeps a duplicated injection from mounting twice.
 *
 * Failure policy: nothing here throws out of `apply`. The web shell fails the
 * whole boot when a plugin's apply throws, and an external plugin must not be
 * able to take the GUI down.
 *
 * @module @cyrus/dsh-context-insight/client
 */

import { registerLocale, registerPanel, type ClientContext } from "@cyrus/dsh-plugin-kit-client"
import type { ReactElement } from "react"
import { LOCALE_NS, en, setRuntimeTranslate, t, zh } from "./locale.ts"
import { ContextInsightPanel } from "./ui/panel.tsx"
import { injectStyles } from "./styles.ts"

export type { ClientContext, Dispose, LocaleFace, SlotsFace } from "@cyrus/dsh-plugin-kit-client"

/** Panel id shared by the sidebar row and the main-slot occupant. */
export const PANEL_ID = "context-insight"

/**
 * Row order among the shell's global panel rows: the shipped Plugins row is 0
 * and Schedule is 10, so this row renders after both.
 */
const PANEL_ORDER = 30

/** Services this entry waits for before `apply` runs. */
export const inject = ["slots", "locale"] as const

declare global {
  /** Apply guard shared by every module instance in one page lifetime. */
  // eslint-disable-next-line no-var
  var __dshContextInsightApplied: boolean | undefined
}

/**
 * Where the row glyph is resolved from: the shell asks for it at its own size
 * and active state, and this component draws only the glyph.
 * @param props - the shell's icon share: square edge and selection state.
 * @returns the decorative glyph.
 */
export function ContextInsightPanelIcon({ size }: { size: number; active: boolean }): ReactElement {
  return (
    <svg
      data-dsh-panel-entry={PANEL_ID}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="6.72" cy="6.72" r="3.92" strokeWidth={1.12} />
      <path d="M9.6 9.6 13.12 13.12" strokeWidth={1.28} />
      <path d="M5.12 4.48h3.2" strokeWidth={1.12} />
      <path d="M5.12 6.72h2.24" strokeWidth={1.12} />
      <path d="M5.12 8.96h1.28" strokeWidth={1.12} />
    </svg>
  )
}

/**
 * Mount the browser half.
 * @param ctx - client root context (services: slots, locale).
 */
export function apply(ctx: ClientContext): void {
  // A duplicated client injection (the module factory executed twice in one
  // page lifetime, e.g. a stale bundle mixed with a rebuilt one) would
  // otherwise mount a second sidebar row and a second panel page. First
  // application wins; later calls become no-ops.
  if (globalThis.__dshContextInsightApplied === true) return
  globalThis.__dshContextInsightApplied = true

  // Release the claim when this fiber unloads, so a hot-reloaded bundle can
  // claim again in the same page instead of being silently dropped.
  if (typeof ctx.effect === "function") {
    ctx.effect(
      () => () => {
        globalThis.__dshContextInsightApplied = undefined
      },
      "context-insight: apply claim"
    )
  }

  // Styles live in the factory body: the shell tags a factory's side effects as
  // its own, and nothing may touch the document before the factory runs.
  injectStyles()

  registerLocale(ctx, LOCALE_NS, { zh, en }, setRuntimeTranslate)

  try {
    registerPanel(ctx, {
      id: PANEL_ID,
      order: PANEL_ORDER,
      locale: LOCALE_NS,
      // A thunk, not a string: the shell re-resolves the label on every locale
      // change, so the row follows the Language setting without a reload.
      label: () => t("entry.label"),
      icon: ContextInsightPanelIcon,
      panel: ContextInsightPanel,
    })
  } catch (error) {
    // A shell that cannot serve the seats leaves the panel absent; boot stays
    // up, but the failure must stay visible in the console.
    console.warn("[context-insight] panel registration failed", error)
  }
}
