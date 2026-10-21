/**
 * The handful of building blocks every view shares: chips, section titles,
 * stat tiles, cards and the keyboard hint.
 *
 * Class strings are spelled out per variant (Tailwind only compiles literals it
 * can see), and control surfaces live in `theme/components.css` as `ci-btn` /
 * `ci-row`, so nothing here restates a button's background.
 *
 * @module @cyrus/dsh-context-insight/client/primitives
 */

import type { ReactElement, ReactNode } from "react"

/** Chip tones; `warn` is dashed because it marks a gap, not a fact. */
export type ChipTone = "neutral" | "soft" | "warn" | "accent" | "mono"

const CHIP_BASE =
  "inline-flex items-center gap-1 rounded-[5px] px-1.5 h-4.5 text-[10.5px] leading-none whitespace-nowrap tabular-nums"

const CHIP_SKIN: Record<ChipTone, string> = {
  neutral: CHIP_BASE + " border border-line text-fg-dim",
  soft: CHIP_BASE + " bg-bg-2 text-fg-dim",
  warn: CHIP_BASE + " border border-dashed border-warn/70 text-warn bg-warn/8",
  accent: CHIP_BASE + " bg-accent/14 text-accent",
  mono: CHIP_BASE + " border border-line text-fg-dim font-mono",
}

/**
 * A small label.
 * @param props.tone - skin.
 * @param props.title - native tooltip.
 * @param props.tip - styled tooltip (`data-tip`), focusable.
 * @param props.children - content.
 * @returns the chip.
 */
export function Chip({
  tone = "neutral",
  title,
  tip,
  children,
}: {
  tone?: ChipTone
  title?: string
  tip?: string
  children: ReactNode
}): ReactElement {
  return (
    <span
      className={tip === undefined ? CHIP_SKIN[tone] : CHIP_SKIN[tone] + " relative"}
      title={title}
      data-tip={tip}
      tabIndex={tip === undefined ? undefined : 0}
    >
      {children}
    </span>
  )
}

/**
 * Section heading with an optional count and a trailing slot.
 * @param props.children - heading text.
 * @param props.count - number shown beside it.
 * @param props.end - right-aligned content.
 * @returns the heading row.
 */
export function SectionTitle({
  children,
  count,
  end,
}: {
  children: ReactNode
  count?: number | string
  end?: ReactNode
}): ReactElement {
  return (
    <h3 className="flex items-center gap-2 m-0 mb-2.5 text-[12px] font-semibold text-fg">
      <span>{children}</span>
      {count === undefined ? null : (
        <span className="rounded-full bg-bg-2 px-1.5 text-[10.5px] font-medium leading-4.25 text-fg-dim tabular-nums">
          {count}
        </span>
      )}
      {end === undefined ? null : <span className="ms-auto flex items-center gap-2 font-normal">{end}</span>}
    </h3>
  )
}

/**
 * A bordered surface that groups one topic.
 * @param props.children - card body.
 * @param props.label - accessible name.
 * @param props.flush - drop the inner padding (for lists that pad their rows).
 * @returns the card.
 */
export function Card({
  children,
  label,
  flush = false,
}: {
  children: ReactNode
  label?: string
  flush?: boolean
}): ReactElement {
  return (
    <section
      className={
        flush
          ? "rounded-[10px] border border-line-soft bg-bg-1 min-w-0"
          : "rounded-[10px] border border-line-soft bg-bg-1 p-3.5 min-w-0"
      }
      aria-label={label}
    >
      {children}
    </section>
  )
}

/**
 * One headline number.
 * @param props.label - what it counts.
 * @param props.value - the number, already formatted.
 * @param props.hint - a second line (unit, share, provenance).
 * @param props.meter - 0..1 fill for a thin gauge under the value.
 * @param props.tone - `warn` paints the meter in the warning colour.
 * @returns the tile.
 */
export function Stat({
  label,
  value,
  hint,
  meter,
  tone = "accent",
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  meter?: number
  tone?: "accent" | "warn"
}): ReactElement {
  const fill = meter === undefined ? undefined : Math.max(0, Math.min(1, meter))
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[10px] border border-line-soft bg-bg-1 px-3 py-2.5">
      <span className="text-[11px] text-fg-dim truncate">{label}</span>
      {/* Only plain text truncates: an element value may carry a tooltip that an
          overflow clip would cut off. */}
      <span
        className={
          typeof value === "string"
            ? "text-[18px] font-semibold leading-tight tracking-[-0.01em] tabular-nums text-fg truncate"
            : "text-[18px] font-semibold leading-tight tracking-[-0.01em] tabular-nums text-fg"
        }
      >
        {value}
      </span>
      {fill === undefined ? null : (
        <span className="block h-1 w-full overflow-hidden rounded-full bg-bg-3" aria-hidden="true">
          <span
            className={tone === "warn" ? "block h-full rounded-full bg-warn" : "block h-full rounded-full bg-accent"}
            style={{ inlineSize: `${(fill * 100).toFixed(1)}%` }}
          />
        </span>
      )}
      {hint === undefined ? null : <span className="text-[10.5px] text-fg-3 truncate">{hint}</span>}
    </div>
  )
}

/**
 * Keyboard hint.
 * @param props.children - key label.
 * @returns the key cap.
 */
export function Kbd({ children }: { children: ReactNode }): ReactElement {
  return (
    <kbd className="inline-flex items-center rounded-[5px] border border-line bg-bg px-1.5 h-4.5 font-[inherit] text-[10.5px] text-fg-dim">
      {children}
    </kbd>
  )
}
