/**
 * The panel's top bar: product mark, per-source availability, search and
 * refresh.
 *
 * Source pills carry the source's own glyph and count, and dim (with the reason
 * in their tooltip) when a corpus is unreadable — one failing source never
 * blanks the page, so the bar is where that failure stays visible.
 *
 * @module @cyrus/dsh-sessions-insight/client/toolbar
 */

import type { ReactElement } from "react"
import type { SourceStatus } from "../../protocol.ts"
import { t } from "../locale.ts"
import { BrandMark, Glyph, SOURCE_MARKS, SourceIcon } from "./icons.tsx"
import { Kbd } from "./primitives.tsx"

/**
 * Human text for a source's unavailability reason.
 * @param reason - the Host's reason tag.
 * @returns the sentence, or the raw tag when it is unknown.
 */
export function reasonText(reason: string | undefined): string | undefined {
  if (reason === undefined) return undefined
  if (reason === "root-missing") return t("sources.reason.root-missing")
  if (reason === "root-unreadable") return t("sources.reason.root-unreadable")
  if (reason === "adapter-error") return t("sources.reason.adapter-error")
  return reason
}

/**
 * Per-source availability pills.
 * @param props.sources - one entry per announced source.
 * @returns the pill list.
 */
function SourceStrip({ sources }: { sources: SourceStatus[] }): ReactElement {
  return (
    <ul className="hidden @4xl:flex items-center gap-1.5 m-0 p-0 list-none min-w-0" aria-label={t("sources.title")}>
      {sources.map((entry) => {
        const mark = SOURCE_MARKS[entry.source]
        const tip = entry.available
          ? `${mark.label.zh} · ${t("sources.available")} · ${entry.root ?? ""}`
          : `${mark.label.zh} · ${t("sources.unavailable")} · ${entry.errorDetail ?? reasonText(entry.reason) ?? ""}`
        return (
          <li
            key={entry.source}
            className={
              entry.available
                ? "inline-flex items-center gap-1.5 h-6 rounded-full border border-line-soft bg-bg-1 ps-1.5 pe-2 text-[11px] whitespace-nowrap"
                : "inline-flex items-center gap-1.5 h-6 rounded-full border border-dashed border-line ps-1.5 pe-2 text-[11px] whitespace-nowrap opacity-60"
            }
            title={tip}
          >
            <SourceIcon source={entry.source} size={12} />
            <span className="font-medium text-fg">{mark.label.zh}</span>
            <span className="text-fg-dim tabular-nums">
              {entry.available ? String(entry.sessions ?? "—") : t("sources.unavailable")}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The bar.
 * @param props.sources - source statuses; empty while booting.
 * @param props.busy - true while a read is in flight; spins the refresh glyph.
 * @param props.sidebarOpen - whether the project column is shown.
 * @param props.onToggleSidebar - show/hide the project column.
 * @param props.onSearch - open the search palette.
 * @param props.onRefresh - re-read everything.
 * @returns the header.
 */
export function Toolbar({
  sources,
  busy,
  sidebarOpen,
  onToggleSidebar,
  onSearch,
  onRefresh,
}: {
  sources: SourceStatus[]
  busy: boolean
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onSearch: () => void
  onRefresh: () => void
}): ReactElement {
  return (
    <header className="flex items-center gap-3 h-12 shrink-0 px-3 border-b border-line-soft bg-bg min-w-0">
      <button
        type="button"
        className="ci-icon-btn"
        aria-pressed={sidebarOpen}
        aria-label={t("toolbar.sidebar")}
        title={t("toolbar.sidebar")}
        onClick={onToggleSidebar}
      >
        <Glyph name="sidebar" size={15} />
      </button>
      <div className="flex items-center gap-2 min-w-0">
        <BrandMark size={24} />
        <h1 className="m-0 text-[13.5px] font-semibold whitespace-nowrap">{t("entry.label")}</h1>
      </div>
      <SourceStrip sources={sources} />
      <div className="ms-auto flex items-center gap-1.5 min-w-0">
        <button type="button" className="ci-search w-[clamp(160px,28cqw,280px)]" onClick={onSearch}>
          <Glyph name="search" size={13} />
          <span className="flex-1 truncate">{t("search.trigger")}</span>
          <Kbd>⌘K</Kbd>
        </button>
        <button
          type="button"
          className="ci-icon-btn"
          onClick={onRefresh}
          aria-label={t("panel.refresh")}
          title={t("panel.refresh")}
        >
          <span className={busy ? "inline-grid motion-safe:animate-spin" : "inline-grid"}>
            <Glyph name="refresh" size={15} />
          </span>
        </button>
      </div>
    </header>
  )
}
