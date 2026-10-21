/**
 * The two registrations every DSH panel makes, without the shell's seat names
 * hard-coded in a plugin.
 *
 * Both go through `ctx.slots.inject`: the callback runs only once the owning
 * shell entry has declared the seat, so load order between a plugin and
 * `ui-layout` / `ui-sidebar` does not matter, and a shell that cannot serve the
 * seats leaves the panel absent instead of failing boot.
 *
 * @module @cyrus/dsh-plugin-kit-client/register
 */

/** A registration disposer, as the slots service returns it. */
export type Dispose = () => void

/** Structural face of the slots service (`ctx.slots`). */
export interface SlotsFace {
  /** Run `callback` once `key` is declared; returns the cancellable subscription. */
  inject(key: string, callback: () => Dispose): Dispose
  /** Contribute one entry to a declared slot. */
  register(options: Record<string, unknown>, component: unknown): Dispose
}

/** Structural face of the locale service (`ctx.locale`). */
export interface LocaleFace {
  /** Register one namespace's dictionaries; throws when a locale already exists. */
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): Dispose
  /** Bind a namespace and return its translate. */
  bind(namespace: string): (key: string, params?: Record<string, unknown>) => string
}

/** Structural face of the client root context these registrations need. */
export interface ClientContext {
  /** Declarative slot registry; provided by the renderer. */
  slots: SlotsFace
  /** Dictionaries and the namespace-bound translate. */
  locale: LocaleFace
  /** Fiber-scoped cleanup registration (absent on capture-only test contexts). */
  effect?: (callback: () => Dispose, label?: string) => Dispose
}

/** Where the shell keeps the panel's row and its page. */
export interface PanelSeats {
  /** Slot key of the shell's global panel list. */
  list: string
  /** Slot key of the shell's keyed main slot. */
  main: string
}

/** Default seat names of the web shell's sidebar and layout entries. */
export const DEFAULT_PANEL_SEATS: PanelSeats = { list: "sidebar.panellist", main: "main" }

/** Everything one panel contributes to the shell. */
export interface PanelRegistration {
  /** Panel id shared by the row and the main-slot occupant. */
  id: string
  /** Row order among the shell's global panel rows. */
  order: number
  /** Locale namespace the row's label resolves against. */
  locale: string
  /** Label thunk, so the row follows a locale change without a reload. */
  label: () => string
  /** Glyph the shell draws for the row. */
  icon: unknown
  /** Component the main slot renders. */
  panel: unknown
  /** Override the shell's seat names; defaults to the web shell's. */
  seats?: PanelSeats
}

/**
 * Register the sidebar row and the main-slot page.
 * @param ctx - client root context (service: slots).
 * @param registration - panel id, order, label, icon and page.
 * @returns disposer releasing both registrations.
 */
export function registerPanel(ctx: ClientContext, registration: PanelRegistration): Dispose {
  const slots = ctx.slots
  const seats = registration.seats ?? DEFAULT_PANEL_SEATS
  const disposers: Dispose[] = []

  disposers.push(
    slots.inject(seats.list, () =>
      slots.register(
        {
          name: seats.list,
          id: registration.id,
          order: registration.order,
          locale: registration.locale,
          label: registration.label,
        },
        registration.icon
      )
    )
  )

  disposers.push(
    slots.inject(seats.main, () =>
      slots.register(
        {
          name: seats.main,
          key: registration.id,
          locale: registration.locale,
        },
        registration.panel
      )
    )
  )

  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}

/**
 * Register one locale namespace and bind it for the module's own translate.
 *
 * Locale is optional on the client root: a failed registration must leave the
 * panel readable rather than take the boot down.
 * @param ctx - client root context (service: locale).
 * @param namespace - namespace the dictionaries belong to.
 * @param dictionaries - locale → (key → text).
 * @param bind - receives the namespace-bound translate.
 */
export function registerLocale(
  ctx: ClientContext,
  namespace: string,
  dictionaries: Record<string, Record<string, string>>,
  bind: (translate: (key: string, params?: Record<string, unknown>) => string) => void
): void {
  try {
    ctx.locale.register(namespace, dictionaries)
    bind(ctx.locale.bind(namespace))
  } catch {
    // Locale is optional: the English dictionary keeps the panel readable.
  }
}
