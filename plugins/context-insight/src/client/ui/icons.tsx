/**
 * Source marks: one shape per corpus, plus its brand colour.
 *
 * Shape carries the meaning and colour only reinforces it — a reader who cannot
 * separate orange from green still sees a sun, a hexagon and a waveform. Labels
 * use a lightened brand tone so they clear 4.5:1 on the dark panel background;
 * the raw brand colour is only used for the glyph itself.
 *
 * @module @cyrus/dsh-context-insight/client/icons
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
