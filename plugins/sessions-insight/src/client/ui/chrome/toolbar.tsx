/**
 * The panel's top bar: product mark, per-source availability, search and
 * refresh.
 *
 * Source pills carry the source's own glyph and count, and dim (with the reason
 * in their tooltip) when a corpus is unreadable — one failing source never
 * blanks the page, so the bar is where that failure stays visible.
 *
 * A readable pill is also the panel's source filter: clicking it narrows the
 * project tree to that source, clicking again removes it. The count always
 * stays the unfiltered corpus size, so the reader can see what is left out.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/client/toolbar
 */

import type { ReactElement } from "react"

import type { ContextSource, SourceStatus } from "../../../protocol.ts"
import { t } from "../../locale/index.ts"
import { BrandMark, Glyph, SOURCE_MARKS, SourceIcon } from "../shared/icons.tsx"
import { Kbd } from "../shared/primitives.tsx"

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
 * Per-source availability pills; a readable pill is also its source's filter.
 * @param props.sources - one entry per announced source.
 * @param props.activeSources - sources currently kept by the filter.
 * @param props.onToggleSource - flip one source in or out of the filter.
 * @returns the pill list.
 */
function SourceStrip({
  sources,
  activeSources,
  onToggleSource,
}: {
  sources: SourceStatus[]
  activeSources: readonly ContextSource[]
  onToggleSource: (source: ContextSource) => void
}): ReactElement {
  return (
    <ul className="m-0 hidden min-w-0 list-none items-center gap-1.5 p-0 @4xl:flex" aria-label={t("sources.title")}>
      {sources.map((entry) => {
        const mark = SOURCE_MARKS[entry.source]
        const active = activeSources.includes(entry.source)
        if (!entry.available)
          return (
            <li
              key={entry.source}
              className="inline-flex h-6 items-center gap-1.5 rounded-full border border-dashed border-line ps-1.5 pe-2 text-[11px] whitespace-nowrap opacity-60"
              title={`${mark.label.zh} · ${t("sources.unavailable")} · ${entry.errorDetail ?? reasonText(entry.reason) ?? ""}`}
            >
              <SourceIcon source={entry.source} size={12} />
              <span className="font-medium text-fg">{mark.label.zh}</span>
              <span className="text-fg-dim tabular-nums">{t("sources.unavailable")}</span>
            </li>
          )
        const action = active ? t("sources.filterActive") : t("sources.filterHint")
        return (
          <li key={entry.source}>
            <button
              type="button"
              className="ci-src-toggle"
              style={{ ["--ci-src-brand" as string]: mark.brand }}
              aria-pressed={active}
              aria-label={`${mark.label.zh} · ${action}`}
              title={`${mark.label.zh} · ${action} · ${entry.root ?? ""}`}
              onClick={() => onToggleSource(entry.source)}
            >
              <SourceIcon source={entry.source} size={12} />
              <span className="ci-src-toggle__label font-medium">{mark.label.zh}</span>
              <span className="text-fg-dim tabular-nums">{String(entry.sessions ?? "—")}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The bar.
 * @param props.sources - source statuses; empty while booting.
 * @param props.activeSources - sources currently kept by the filter.
 * @param props.onToggleSource - flip one source in or out of the filter.
 * @param props.busy - true while a read is in flight; spins the refresh glyph.
 * @param props.sidebarOpen - whether the project column is shown.
 * @param props.onToggleSidebar - show/hide the project column.
 * @param props.onSearch - open the search palette.
 * @param props.onRefresh - re-read everything.
 * @returns the header.
 */
export function Toolbar({
  sources,
  activeSources,
  onToggleSource,
  busy,
  sidebarOpen,
  onToggleSidebar,
  onSearch,
  onRefresh,
  onSettings,
}: {
  sources: SourceStatus[]
  activeSources: readonly ContextSource[]
  onToggleSource: (source: ContextSource) => void
  busy: boolean
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onSearch: () => void
  onRefresh: () => void
  onSettings?: () => void
}): ReactElement {
  return (
    <header className="flex h-12 min-w-0 shrink-0 items-center gap-3 border-b border-line-soft bg-bg px-3">
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
      <div className="flex min-w-0 items-center gap-2">
        <BrandMark size={24} />
        <h1 className="m-0 text-[13.5px] font-semibold whitespace-nowrap">{t("entry.label")}</h1>
      </div>
      <SourceStrip sources={sources} activeSources={activeSources} onToggleSource={onToggleSource} />
      <div className="ms-auto flex min-w-0 items-center gap-1.5">
        {onSettings === undefined ? null : (
          <button type="button" className="ci-btn active:bg-bg-3" onClick={onSettings} aria-label={t("settings.title")}>
            {t("settings.title")}
          </button>
        )}
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
