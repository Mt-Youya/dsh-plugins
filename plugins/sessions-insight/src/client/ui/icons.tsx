/**
 * Source marks: one shape per corpus, plus its brand colour.
 *
 * Shape carries the meaning and colour only reinforces it — a reader who cannot
 * separate orange from green still sees a sun, a hexagon and a waveform. Labels
 * use a lightened brand tone so they clear 4.5:1 on the dark panel background;
 * the raw brand colour is only used for the glyph itself.
 *
 * @module @cyrus/dsh-sessions-insight/client/icons
 */

import type { ReactElement } from "react"
import type { ContextSource } from "../../protocol.ts"

/** One source's mark and colours. */
export interface SourceMark {
  /** Brand colour, used for the glyph and the chip border. */
  brand: string
  /** Lightened tone for text (≥ 4.5:1 on the panel background). */
  text: string
  /** Localised label. */
  label: { zh: string; en: string }
}

/** Mark metadata for every source. */
export const SOURCE_MARKS: Record<ContextSource, SourceMark> = {
  claude: { brand: "#D97757", text: "color-mix(in srgb, #D97757 62%, white)", label: { zh: "Claude", en: "Claude" } },
  codex: { brand: "#10A37F", text: "color-mix(in srgb, #10A37F 62%, white)", label: { zh: "Codex", en: "Codex" } },
  dsh: { brand: "#4D6BFE", text: "color-mix(in srgb, #4D6BFE 62%, white)", label: { zh: "DSH", en: "DSH" } },
}

/**
 * The glyph for one source: sun, hexagon, waveform.
 * @param props.source - which corpus.
 * @param props.size - pixel size.
 * @param props.tone - 'brand' paints the brand colour, 'inherit' follows text.
 * @returns an inline SVG.
 */
export function SourceIcon({
  source,
  size = 12,
  tone = "brand",
}: {
  source: ContextSource
  size?: number
  tone?: "brand" | "inherit"
}): ReactElement {
  const mark = SOURCE_MARKS[source]
  const color = tone === "brand" ? mark.brand : "currentColor"
  if (source === "claude") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <g stroke={color} strokeWidth="1.6" strokeLinecap="round">
          <path d="M8 2.2v11.6M2.2 8h11.6M3.9 3.9l8.2 8.2M12.1 3.9l-8.2 8.2" />
        </g>
      </svg>
    )
  }
  if (source === "codex") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path
          d="M8 1.8l5.4 3.1v6.2L8 14.2 2.6 11.1V4.9z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M5.4 6.2L8 8.6l2.6-2.4M8 8.6v3.2" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <g stroke={color} strokeWidth="1.6" strokeLinecap="round">
        <path d="M2.4 8h1.6M6.2 5v6M8.8 3v10M11.4 5.6v4.8M14 7h-1.2" />
      </g>
    </svg>
  )
}

/** The interface glyphs the panel draws; 16-unit grid, stroked in currentColor. */
const GLYPHS = {
  search: "M7.2 12.4a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4ZM11 11l3.2 3.2",
  refresh: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.6 2.4v2.9h-2.9",
  chevron: "M6 3.8 10.2 8 6 12.2",
  sidebar: "M2.5 3.5h11v9h-11zM6.2 3.5v9",
  folder: "M2 4.5c0-.6.4-1 1-1h3.1l1.4 1.5H13c.6 0 1 .4 1 1v6c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z",
  tool: "M10.4 2.6a3 3 0 0 0-3.7 3.9L2.6 10.6a1.3 1.3 0 0 0 1.8 1.8l4.1-4.1a3 3 0 0 0 3.9-3.7l-1.8 1.8-1.6-.4-.4-1.6z",
  branch: "M4.5 2.5v11M4.5 9.5c0-2.5 7-1.5 7-5M11.5 2.5v2",
  handoff: "M3 8h9M9 4.5 12.5 8 9 11.5",
  trash: "M2 4h12M6 4V2h4v2M4 4l1 10h6l1-10M7 6v5M9 6v5",
  close: "M4 4l8 8M12 4l-8 8",
} as const

/** Names of {@link GLYPHS}. */
export type GlyphName = keyof typeof GLYPHS

/**
 * One interface glyph.
 * @param props.name - which glyph.
 * @param props.size - pixel edge, default 14.
 * @param props.className - extra classes (e.g. `ci-chevron`).
 * @returns a decorative inline SVG.
 */
export function Glyph({
  name,
  size = 14,
  className,
}: {
  name: GlyphName
  size?: number
  className?: string
}): ReactElement {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={GLYPHS[name]} />
    </svg>
  )
}

/**
 * The product mark: a magnifier over three context lines, on an accent tile.
 * @param props.size - tile edge in pixels.
 * @returns the mark.
 */
export function BrandMark({ size = 24 }: { size?: number }): ReactElement {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-[7px] bg-[color-mix(in_oklch,var(--color-accent)_16%,transparent)] text-accent"
      style={{ inlineSize: size, blockSize: size }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      >
        <circle cx="6.7" cy="6.7" r="4.2" strokeWidth="1.5" />
        <path d="M9.9 9.9 13.6 13.6" strokeWidth="1.7" />
        <path d="M4.9 5.3h3.4M4.9 7.1h2.4M4.9 8.9h1.4" strokeWidth="1.2" />
      </svg>
    </span>
  )
}
