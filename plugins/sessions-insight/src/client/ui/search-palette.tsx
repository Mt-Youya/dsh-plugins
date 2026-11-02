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
 * @module @cyrusdoyle/dsh-sessions-insight/client/search-palette
 */

import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { ReactElement, ReactNode } from "react"

import type { ContextSource, SearchHit, SearchTier, SearchValue } from "../../protocol.ts"
import { CONTEXT_SOURCES } from "../../protocol.ts"
import type { Api, ApiFailure } from "../api.ts"
import { splitPath } from "../format.ts"
import { sessionLabel } from "../labels.ts"
import { t } from "../locale.ts"
import { SOURCE_MARKS, SourceIcon } from "./icons.tsx"

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
        className="rounded-xs bg-[color-mix(in_oklch,var(--color-accent)_35%,transparent)] px-px text-fg"
        key={`m-${String(index)}`}
      >
        {text.slice(index, index + needle.length)}
      </mark>,
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
        className="my-px flex w-full cursor-pointer flex-col gap-1 rounded-md border-0 px-2 py-2.5 text-left font-[inherit] text-inherit hover:bg-bg-2 data-[active=true]:bg-bg-2"
        data-active={active}
        onClick={onOpen}
        onMouseEnter={onHover}
      >
        <span className="flex w-full min-w-0 items-center gap-3">
          <SourceIcon source={hit.source} size={12} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
            {highlight(label.title, query)}
          </span>
          <span className="max-w-[40%] truncate text-[10px] text-fg-dim" title={hit.workdir}>
            {parts.leaf === "" ? hit.workdir : parts.leaf}
            {hit.turnIndex === 0 ? "" : ` · ${t("turns.selected", { index: hit.turnIndex })}`}
          </span>
        </span>
        {label.detail === undefined ? null : <span className="truncate text-[10.5px] text-fg-dim">{label.detail}</span>}
        <span className="line-clamp-2 text-[11px] leading-normal text-fg-dim">{highlight(hit.snippet, query)}</span>
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
            const seen = new Set(previous.map((hit) => `${hit.sessionId}:${String(hit.turnIndex)}`))
            const merged = [
              ...previous,
              ...result.value.hits.filter((hit) => !seen.has(`${hit.sessionId}:${String(hit.turnIndex)}`)),
            ]
            return { kind: "ready", value: result.value, hits: merged }
          })
          if (!continuingPage) setActive(-1)
        })
      },
      continuingPage ? 0 : SEARCH_DEBOUNCE_MS,
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
    <div
      className="fixed inset-0 z-60 flex items-start justify-center bg-[rgb(0_0_0/55%)] pt-[12vh]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="grid max-h-[70vh] w-[min(720px,92vw)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border-[0.5px] border-line bg-bg-1 shadow-[0_18px_48px_rgb(0_0_0/50%)]"
        role="dialog"
        aria-modal="true"
        aria-label={t("search.title")}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b-[0.5px] border-line px-3 py-2.5">
          <label className="text-[11px] tracking-[0.06em] whitespace-nowrap text-fg-dim uppercase" htmlFor={inputId}>
            {t("search.title")}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            className="min-w-0 flex-1 rounded-md border-[0.5px] border-line bg-bg px-2 py-1.5 text-[13px] text-fg focus-visible:outline-2 focus-visible:outline-accent"
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
          <span
            className="rounded-full border-[0.5px] border-line px-2 py-px text-[10px] whitespace-nowrap text-fg-dim"
            role="status"
          >
            {tier === "deep" ? t("search.tier.deep") : t("search.tier.fast")}
          </span>
          <button
            type="button"
            className="ms-auto cursor-pointer rounded-md border-[0.5px] border-line bg-transparent px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50"
            onClick={onClose}
          >
            Esc
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-2 pt-1.5 pb-2.5" role="listbox" aria-label={t("search.title")}>
          {state.kind === "idle" ? (
            <p className="mx-1.5 my-2.5 text-[11px] text-fg-dim" id={`${inputId}-hint`}>
              {t("search.hint")}
            </p>
          ) : null}
          {state.kind === "loading" ? (
            <p className="mx-1.5 my-2.5 text-[11px] text-fg-dim">{t("search.scanning")}</p>
          ) : null}
          {state.kind === "failed" ? (
            <p className="mx-1.5 my-2.5 text-[11px] text-err">
              {t("session.error", { detail: state.failure.detail ?? state.failure.error })}
            </p>
          ) : null}
          {state.kind === "ready" && hits.length === 0 ? (
            <p className="mx-1.5 my-2.5 text-[11px] text-fg-dim">{t("search.empty")}</p>
          ) : null}
          {grouped.map((group) => (
            <section className="mt-2" key={group.source} aria-label={group.source}>
              <h3 className="m-0 mb-1 flex items-center gap-2 px-2 py-1 text-[11px] font-medium text-fg-dim">
                <SourceIcon source={group.source} size={12} />
                <span>{SOURCE_MARKS[group.source].label.zh}</span>
                <span className="tabular-nums">{group.rows.length}</span>
              </h3>
              <ul className="m-0 list-none p-0">
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
          <footer className="flex items-center gap-3 border-t-[0.5px] border-line px-3 py-2 text-[10.5px] text-fg-dim">
            <span>
              {state.value.tier === "fast"
                ? t("search.fastMeta", { scanned: state.value.scanned })
                : state.value.truncated
                  ? t("search.truncated", { remaining: state.value.remaining })
                  : t("search.deepMeta", { scanned: state.value.scanned, remaining: state.value.remaining })}
            </span>
            <span className="my-1.5 text-[10.5px] text-fg-dim">
              {t("search.meta", { scanned: state.value.scanned, elapsed: state.value.elapsedMs })}
            </span>
            {state.value.tier === "fast" ? (
              <span className="my-1.5 text-[10.5px] text-fg-dim">{t("search.enterDeep")}</span>
            ) : null}
            {state.value.tier === "deep" && state.value.truncated ? (
              <button
                type="button"
                className="cursor-pointer rounded-md border-[0.5px] border-line bg-bg-2 px-2.5 py-1 font-[inherit] text-[11px] text-fg enabled:hover:border-accent disabled:cursor-default disabled:opacity-50"
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
