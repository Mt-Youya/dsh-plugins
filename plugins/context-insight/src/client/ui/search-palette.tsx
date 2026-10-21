/**
 * ⌘K search palette.
 *
 * Fast tier first: it greps metadata only and therefore always completes
 * (`remaining: 0`), which is what makes it usable while typing. Enter, when no
 * result is selected, escalates to the deep tier — a body scan inside the Host's
 * budget — and the footer then states exactly what was covered plus a control to
 * continue scanning from the cursor it returned. Presenting a partial scan as
 * complete would be the same lie as folding a residual into a category.
 *
 * Keyboard: ↑↓ move, Enter opens the selected hit (or escalates to deep when
 * nothing is selected), Esc closes. Results are grouped by source.
 *
 * @module @cyrus/dsh-context-insight/client/search-palette
 */

import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { ReactElement, ReactNode } from "react"
import type { ContextSource, SearchHit, SearchTier, SearchValue } from "../../protocol.ts"
import { CONTEXT_SOURCES } from "../../protocol.ts"
import type { Api, ApiFailure } from "../api.ts"
import { splitPath } from "../format.ts"
import { sessionLabel } from "../labels.ts"
import { t } from "../locale.ts"

/** Milliseconds between a keystroke and the first scan. */
export const SEARCH_DEBOUNCE_MS = 250

/** Hits requested per scan. */
const SEARCH_LIMIT = 30

/** Where a clicked result wants the panel to go. */
export interface SearchTarget {
  source: ContextSource
  sessionId: string
  workdir: string
  turnIndex: number
}

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; value: SearchValue; hits: SearchHit[] }
  | { kind: "failed"; failure: ApiFailure }

/**
 * Wrap occurrences of the query in a highlight element.
 * @param text - snippet text.
 * @param query - the raw query.
 * @returns nodes with the matches marked.
 */
function highlight(text: string, query: string): ReactNode[] {
  const needle = query.trim().toLowerCase()
  if (needle === "") return [text]
  const nodes: ReactNode[] = []
  const lower = text.toLowerCase()
  let cursor = 0
  let index = lower.indexOf(needle)
  while (index >= 0) {
    if (index > cursor) nodes.push(text.slice(cursor, index))
    nodes.push(
      <mark
        className="bg-[color-mix(in_oklch,var(--color-accent)_35%,transparent)] text-fg rounded-[2px] px-px"
        key={`m-${String(index)}`}
      >
        {text.slice(index, index + needle.length)}
      </mark>
    )
    cursor = index + needle.length
    index = lower.indexOf(needle, cursor)
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

/**
 * One result row.
 * @param props.hit - the hit.
 * @param props.query - the query, for the highlight.
 * @param props.active - whether this row is selected.
 * @param props.onOpen - open this hit.
 * @param props.onHover - select this hit without opening it.
 * @returns the row button.
 */
function HitRow({
  hit,
  query,
  active,
  onOpen,
  onHover,
}: {
  hit: SearchHit
  query: string
  active: boolean
  onOpen: () => void
  onHover: () => void
}): ReactElement {
  const label = sessionLabel(hit)
  const parts = splitPath(hit.workdir)
  return (
    <li>
      <button
        type="button"
        className="flex w-full cursor-pointer flex-col gap-[3px] rounded-[6px] border-0 my-px px-2 py-[7px] text-inherit font-[inherit] text-left hover:bg-bg-2 data-[active=true]:bg-bg-2"
        data-active={active}
        onClick={onOpen}
        onMouseEnter={onHover}
      >
        <span className="flex items-baseline gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-fg border-[0.5px] border-line">{hit.source}</span>
          <span className="truncate text-[12px]">{label.title}</span>
          <span className="ms-auto text-[10px] text-fg-dim whitespace-nowrap">
            {parts.leaf === "" ? hit.workdir : parts.leaf}
            {hit.turnIndex === 0 ? "" : " · " + t("turns.selected", { index: hit.turnIndex })}
          </span>
        </span>
        {label.detail === undefined ? null : <span className="truncate text-[10.5px] text-fg-dim">{label.detail}</span>}
        <span className="line-clamp-2 text-[11px] text-fg-dim leading-normal">{highlight(hit.snippet, query)}</span>
      </button>
    </li>
  )
}

/**
 * The palette.
 * @param props.api - client API.
 * @param props.onClose - close request (Esc, backdrop, after a jump).
 * @param props.onOpenTurn - open one hit's turn.
 * @returns the dialog.
 */
export function SearchPalette({
  api,
  onClose,
  onOpenTurn,
}: {
  api: Api
  onClose: () => void
  onOpenTurn: (target: SearchTarget) => void
}): ReactElement {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [tier, setTier] = useState<SearchTier>("fast")
  const [cursor, setCursor] = useState(0)
  const [state, setState] = useState<SearchState>({ kind: "idle" })
  // -1 means "nothing selected yet": Enter then escalates to the deep tier
  // instead of opening the first hit, which is what the footer promises.
  const [active, setActive] = useState(-1)
  const [continuing, setContinuing] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === "") {
      setState({ kind: "idle" })
      return
    }
    const controller = new AbortController()
    const continuingPage = tier === "deep" && cursor > 0
    if (continuingPage) setContinuing(true)
    const timer = window.setTimeout(
      () => {
        if (!continuingPage) setState({ kind: "loading" })
        void api.search(trimmed, SEARCH_LIMIT, tier, cursor, controller.signal).then((result) => {
          if (controller.signal.aborted) return
          setContinuing(false)
          if (!result.ok) {
            setState({ kind: "failed", failure: result })
            return
          }
          setState((current) => {
            const previous = continuingPage && current.kind === "ready" ? current.hits : []
            const seen = new Set(previous.map((hit) => hit.sessionId + ":" + String(hit.turnIndex)))
            const merged = [
              ...previous,
              ...result.value.hits.filter((hit) => !seen.has(hit.sessionId + ":" + String(hit.turnIndex))),
            ]
            return { kind: "ready", value: result.value, hits: merged }
          })
          if (!continuingPage) setActive(-1)
        })
      },
      continuingPage ? 0 : SEARCH_DEBOUNCE_MS
    )
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [api, query, tier, cursor])

  const hits = state.kind === "ready" ? state.hits : []
  const grouped = useMemo(() => {
    const groups = new Map<ContextSource, { hit: SearchHit; index: number }[]>()
    hits.forEach((hit, index) => {
      const list = groups.get(hit.source)
      if (list === undefined) groups.set(hit.source, [{ hit, index }])
      else list.push({ hit, index })
    })
    return CONTEXT_SOURCES.filter((source) => groups.has(source)).map((source) => ({
      source,
      rows: groups.get(source) ?? [],
    }))
  }, [hits])

  function open(hit: SearchHit): void {
    onOpenTurn({ source: hit.source, sessionId: hit.sessionId, workdir: hit.workdir, turnIndex: hit.turnIndex })
  }

  function escalate(): void {
    setCursor(0)
    setTier("deep")
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((current) => Math.min(hits.length - 1, current + 1))
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((current) => Math.max(-1, current - 1))
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      const hit = active >= 0 ? hits[active] : undefined
      if (hit !== undefined) open(hit)
      else if (tier === "fast") escalate()
      else if (state.kind === "ready" && state.value.truncated) setCursor(state.value.nextCursor ?? 0)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[rgb(0_0_0/55%)] flex items-start justify-center pt-[12vh]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-[min(720px,92vw)] max-h-[70vh] grid grid-rows-[auto_minmax(0,1fr)_auto] rounded-[10px] border-[0.5px] border-line bg-bg-1 shadow-[0_18px_48px_rgb(0_0_0/50%)] overflow-hidden" role="dialog" aria-modal="true" aria-label={t("search.title")} onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 px-3 py-2.5 border-b-[0.5px] border-line">
          <label className="text-[11px] tracking-[0.06em] uppercase text-fg-dim whitespace-nowrap" htmlFor={inputId}>
            {t("search.title")}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            className="flex-1 min-w-0 px-2 py-1.5 rounded-md border-[0.5px] border-line bg-bg text-fg text-[13px] focus-visible:outline-2 focus-visible:outline-accent"
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("search.placeholder")}
            value={query}
            onChange={(event) => {
              setCursor(0)
              setTier("fast")
              setQuery(event.target.value)
            }}
            aria-describedby={`${inputId}-hint`}
          />
          <span className="px-2 py-px rounded-full border-[0.5px] border-line text-[10px] text-fg-dim whitespace-nowrap" role="status">
            {tier === "deep" ? t("search.tier.deep") : t("search.tier.fast")}
          </span>
          <button type="button" className="px-2.5 py-1 rounded-[6px] border-[0.5px] border-line bg-transparent text-fg font-[inherit] text-[11px] cursor-pointer enabled:hover:border-accent disabled:opacity-50 disabled:cursor-default ms-auto" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="overflow-y-auto px-2 pt-1.5 pb-2.5 min-h-0" role="listbox" aria-label={t("search.title")}>
          {state.kind === "idle" ? (
            <p className="mx-1.5 my-2.5 text-[11px] text-fg-dim" id={`${inputId}-hint`}>
              {t("search.hint")}
            </p>
          ) : null}
          {state.kind === "loading" ? <p className="mx-1.5 my-2.5 text-[11px] text-fg-dim">{t("search.scanning")}</p> : null}
          {state.kind === "failed" ? (
            <p className="mx-1.5 my-2.5 text-[11px] text-err">
              {t("session.error", { detail: state.failure.detail ?? state.failure.error })}
            </p>
          ) : null}
          {state.kind === "ready" && hits.length === 0 ? <p className="mx-1.5 my-2.5 text-[11px] text-fg-dim">{t("search.empty")}</p> : null}
          {grouped.map((group) => (
            <section className="mt-2" key={group.source} aria-label={group.source}>
              <h3 className="flex items-center gap-2 mb-1 px-1.5 text-[10px] font-semibold tracking-[0.06em] uppercase text-fg-dim">
                <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-fg border-[0.5px] border-line">{group.source}</span>
                <span className="text-fg-dim text-[10.5px] my-1.5">{group.rows.length}</span>
              </h3>
              <ul className="m-0 p-0 list-none">
                {group.rows.map(({ hit, index }) => (
                  <HitRow
                    key={`${hit.source}-${hit.sessionId}-${String(hit.turnIndex)}-${String(index)}`}
                    hit={hit}
                    query={query}
                    active={index === active}
                    onOpen={() => open(hit)}
                    onHover={() => setActive(index)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        {state.kind === "ready" ? (
          <footer className="flex items-center gap-3 px-3 py-2 border-t-[0.5px] border-line text-[10.5px] text-fg-dim">
            <span>
              {state.value.tier === "fast"
                ? t("search.fastMeta", { scanned: state.value.scanned })
                : state.value.truncated
                  ? t("search.truncated", { remaining: state.value.remaining })
                  : t("search.deepMeta", { scanned: state.value.scanned, remaining: state.value.remaining })}
            </span>
            <span className="text-fg-dim text-[10.5px] my-1.5">
              {t("search.meta", { scanned: state.value.scanned, elapsed: state.value.elapsedMs })}
            </span>
            {state.value.tier === "fast" ? <span className="text-fg-dim text-[10.5px] my-1.5">{t("search.enterDeep")}</span> : null}
            {state.value.tier === "deep" && state.value.truncated ? (
              <button
                type="button"
                className="px-2.5 py-1 rounded-[6px] border-[0.5px] border-line bg-bg-2 text-fg font-[inherit] text-[11px] cursor-pointer enabled:hover:border-accent disabled:opacity-50 disabled:cursor-default"
                disabled={continuing}
                onClick={() => setCursor(state.value.nextCursor ?? 0)}
              >
                {continuing ? t("search.scanning") : t("search.continue", { count: state.value.remaining })}
              </button>
            ) : null}
            {state.value.failures.length === 0 ? null : (
              <span className="ms-auto text-warn">{t("search.failures", { count: state.value.failures.length })}</span>
            )}
          </footer>
        ) : null}
      </div>
    </div>
  )
}
