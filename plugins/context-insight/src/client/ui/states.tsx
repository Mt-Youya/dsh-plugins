/**
 * The four states the panel must always be able to show: loading, empty,
 * one-source-failed, and parsed-but-empty. Keeping them in one module is the
 * cheapest way to make sure none of them is a blank rectangle.
 *
 * The skeletons mirror the layout they stand in for — tree rows in the tree,
 * header, tiles, chart and rows in the session pane — so the page does not jump
 * when the answer lands, and nothing is left as an empty black field.
 *
 * @module @cyrus/dsh-context-insight/client/states
 */

import type { ReactElement, ReactNode } from "react"
import { t } from "../locale.ts"

/** The shimmer shared by every skeleton block. */
const SHIMMER =
  "bg-[linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))] bg-[length:200%_100%] motion-safe:animate-[ci-skel_1.4s_var(--ease-in-out)_infinite]"

/**
 * One skeleton block.
 * @param props.className - size and shape utilities.
 * @returns the block.
 */
export function Skeleton({ className }: { className: string }): ReactElement {
  return <div className={`${SHIMMER} ${className}`} aria-hidden="true" />
}

/**
 * Skeleton for the project tree.
 * @param props.label - what is being read, printed once.
 * @returns the rows.
 */
export function TreeSkeleton({ label }: { label: string }): ReactElement {
  return (
    <div className="flex flex-col gap-1 px-2 py-2" aria-busy="true" role="status">
      <p className="m-0 px-1.5 pb-1 text-[11.5px] text-fg-dim">{label}</p>
      {[0, 1, 2].map((group) => (
        <div className="flex flex-col gap-1.5 py-1" key={group}>
          <Skeleton className="h-9 w-[86%] rounded-[8px]" />
          {group === 0
            ? [72, 64, 70, 58].map((width) => <Skeleton className="ms-5 h-8 rounded-[8px]" key={width} />)
            : null}
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for the session pane: header, tiles, chart, then rows beside a
 * detail column.
 * @param props.label - what is being read, printed once.
 * @returns the skeleton, filling the pane.
 */
export function SessionSkeleton({ label }: { label: string }): ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy="true" role="status">
      <div className="flex flex-col gap-3 px-5 pt-4 pb-4 border-b border-line-soft">
        <p className="m-0 flex items-center gap-2 text-[11.5px] text-fg-dim">
          <span className="inline-block size-1.5 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden="true" />
          {label}
        </p>
        <Skeleton className="h-5 w-[46%] rounded-[5px]" />
        <Skeleton className="h-3.5 w-[68%] rounded-[4px]" />
        <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((tile) => (
            <Skeleton className="h-[74px] rounded-[10px]" key={tile} />
          ))}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 @3xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2 p-3 @3xl:border-e border-line-soft">
          <Skeleton className="h-28 rounded-[10px]" />
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <Skeleton className="h-14 rounded-[8px]" key={row} />
          ))}
        </div>
        <div className="hidden @3xl:flex flex-col gap-3 p-4">
          <Skeleton className="h-5 w-32 rounded-[5px]" />
          <Skeleton className="h-20 rounded-[10px]" />
          <Skeleton className="h-44 rounded-[10px]" />
          <Skeleton className="h-36 rounded-[10px]" />
        </div>
      </div>
    </div>
  )
}

/**
 * Empty placeholder: a fact plus the next step, never a bare "no data".
 * @param props.title - what is missing.
 * @param props.hint - what the reader can do or expect.
 * @param props.center - centre it in the available space (pane-level states).
 * @returns the block.
 */
export function EmptyBlock({
  title,
  hint,
  center = false,
}: {
  title: string
  hint?: string
  center?: boolean
}): ReactElement {
  return (
    <div
      className={
        center
          ? "flex h-full min-h-40 flex-col items-center justify-center gap-1.5 p-6 text-center text-[12.5px] text-fg-dim"
          : "flex flex-col items-start gap-1.5 px-4 py-4 text-[12.5px] text-fg-dim"
      }
      role="status"
    >
      <p className="m-0 font-medium text-fg">{title}</p>
      {hint === undefined ? null : <p className="m-0 max-w-[44ch] text-[11.5px]">{hint}</p>}
    </div>
  )
}

/**
 * Failure placeholder with a retry.
 * @param props.title - what failed.
 * @param props.detail - the classified failure detail.
 * @param props.onRetry - retry callback.
 * @returns the block.
 */
export function ErrorBlock({
  title,
  detail,
  onRetry,
}: {
  title: string
  detail?: string
  onRetry: () => void
}): ReactElement {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 p-6 text-center" role="alert">
      <p className="m-0 max-w-[60ch] text-[12.5px] text-err">{title}</p>
      {detail === undefined ? null : <p className="m-0 text-[11.5px] text-fg-dim">{detail}</p>}
      <button type="button" className="ci-btn" onClick={onRetry}>
        {t("panel.retry")}
      </button>
    </div>
  )
}

/**
 * Inline notice used for per-source failures, so one source never blanks the
 * others.
 * @param props.children - sentence.
 * @returns the notice.
 */
export function Notice({ children }: { children: ReactNode }): ReactElement {
  return (
    <p className="m-0 rounded-[8px] border border-warn/40 bg-warn/8 px-3 py-2 text-[11.5px] text-warn" role="note">
      {children}
    </p>
  )
}
