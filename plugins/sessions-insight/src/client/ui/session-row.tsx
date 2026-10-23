import { useEffect, useRef, useState, type ReactElement } from "react"
import { type Api, failureText } from "../api.ts"
import { formatBytes, formatShortTime } from "../format.ts"
import { t } from "../locale.ts"
import type { TreeRow, TreeSession } from "../state/tree.ts"
import { Glyph, SourceIcon, SOURCE_MARKS } from "./icons.tsx"

/** A session row, hung under its project by a guide line. */
export function SessionRow({
  row,
  index,
  onOpen,
  onFocus,
  api,
  onDeleted,
}: {
  row: Extract<TreeRow, { kind: "session" }>
  index: number
  onOpen: () => void
  onFocus: () => void
  api: Api
  onDeleted: (session: TreeSession) => void
}): ReactElement {
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  // Ignore the release of the opening right-click; dismiss on the next outside press.
  useEffect(() => {
    if (!menuOpen) return
    function dismiss(event: PointerEvent): void {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) menu.current?.hidePopover()
    }
    document.addEventListener("pointerdown", dismiss, true)
    return () => document.removeEventListener("pointerdown", dismiss, true)
  }, [menuOpen])

  function closeMenu(): void {
    menu.current?.hidePopover()
    trigger.current?.focus()
  }

  function openMenu(x: number, y: number): void {
    const popup = menu.current
    if (popup === null || deleting) return
    for (const other of popup.ownerDocument.querySelectorAll<HTMLElement>("[data-session-menu]:popover-open")) {
      if (other !== popup) other.hidePopover()
    }
    popup.showPopover()
    const bounds = popup.getBoundingClientRect()
    popup.style.left = `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`
    popup.style.top = `${Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8))}px`
    popup.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true })
  }

  async function remove(): Promise<void> {
    closeMenu()
    if (deleting || !window.confirm(t("sessions.deleteConfirm", { title: row.session.title }))) return
    setDeleting(true)
    setError("")
    const result = await api.deleteSession(row.session.source, row.session.id)
    setDeleting(false)
    if (result.ok) onDeleted(row.session)
    else
      setError(
        result.detail === "shared-session-logs"
          ? t("sessions.deleteShared")
          : t("sessions.deleteFailed", { detail: failureText(result) })
      )
  }

  const mark = SOURCE_MARKS[row.session.source]
  return (
    <div className="ms-3.25 border-s border-line-soft ps-1.5">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-busy={deleting}
        disabled={deleting}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          openMenu(event.clientX, event.clientY)
        }}
        onKeyDown={(event) => {
          if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return
          event.preventDefault()
          event.stopPropagation()
          const bounds = event.currentTarget.getBoundingClientRect()
          openMenu(bounds.left, bounds.bottom)
        }}
        className="ci-row px-2 py-1.5"
        data-key={row.key}
        data-selected={row.selected}
        data-focus={index}
        aria-current={row.selected}
        onClick={onOpen}
        onFocus={onFocus}
        title={row.session.title}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="inline-flex w-3.5 shrink-0 justify-center">
            <SourceIcon source={row.session.source} size={12} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px]">{row.session.title}</span>
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 ps-5 text-[10.5px] text-fg-3 tabular-nums">
          <span style={{ color: mark.text }} className="ci-src__word">
            {mark.label.zh}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatShortTime(row.session.updatedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(row.session.bytes)}</span>
        </span>
      </button>
      {error === "" ? null : (
        <p role="alert" className="m-0 px-2 py-1 text-[11px] text-err">
          {error}
        </p>
      )}
      <div
        ref={menu}
        popover="manual"
        data-session-menu=""
        onBeforeToggle={(event) => setMenuOpen(event.newState === "open")}
        role="menu"
        aria-label={t("sessions.actions")}
        className="fixed m-0 min-w-36 rounded-lg border border-line bg-bg-1 p-1 text-[12.5px] text-fg shadow-lg"
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === "Escape" || event.key === "Tab") {
            if (event.key === "Escape") event.preventDefault()
            closeMenu()
          } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault()
            event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus()
          }
        }}
      >
        <button
          type="button"
          role="menuitem"
          className="flex w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 py-1.5 text-err hover:bg-hover focus:bg-hover"
          onClick={() => void remove()}
        >
          <Glyph name="trash" size={14} />
          {t("sessions.delete")}
        </button>
      </div>
    </div>
  )
}
