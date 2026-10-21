/**
 * The four states the panel must always be able to show: loading, empty,
 * one-source-failed, and parsed-but-empty. Keeping them in one module is the
 * cheapest way to make sure none of them is a blank rectangle.
 *
 * @module @cyrus/dsh-context-insight/client/states
 */

import type { ReactElement, ReactNode } from "react"
import { t } from "../locale.ts"

/**
 * One skeleton bar. All six are identical today: the four named variants
 * (--title/--line/--short/--block) never had a rule, so they stay equal.
 */
const SKEL_BAR =
  "rounded-md h-6 bg-[linear-gradient(90deg,var(--color-bg-1),var(--color-bg-2),var(--color-bg-1))] bg-[length:200%_100%] motion-safe:animate-[ci-skel_1.4s_var(--ease-in-out)_infinite]"

/**
 * Loading placeholder.
 * @param props.label - what is being read.
 * @returns the block.
 */
/**
 * Skeleton for the detail pane: a title bar, then paragraph-shaped blocks.
 *
 * The old block left the pane blank with a spinner in the corner, which reads as
 * "nothing happened"; the skeleton at least shows where the answer will appear.
 * @param props.label - what is being read, printed once.
 * @returns the skeleton.
 */
export function SkeletonDetail({ label }: { label: string }): ReactElement {
  return (
    <div aria-busy="true" role="status">
      <p>{label}</p>
      <div className={SKEL_BAR} />
      <div className={SKEL_BAR} />
      <div className={SKEL_BAR} />
      <div className={SKEL_BAR} />
      <div className={SKEL_BAR} />
      <div className={SKEL_BAR} />
    </div>
  )
}

/**
 * Empty placeholder: a fact plus the next step, never a bare "no data".
 * @param props.title - what is missing.
 * @param props.hint - what the reader can do or expect.
 * @returns the block.
 */
export function EmptyBlock({ title, hint }: { title: string; hint?: string }): ReactElement {
  return (
    <div className="flex flex-col items-start gap-2 py-4.5 px-4 text-[12px] text-fg-dim" role="status">
      <p className="m-0 text-fg">{title}</p>
      {hint === undefined ? null : <p className="m-0 text-[11px]">{hint}</p>}
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
    <div className="flex flex-col items-start gap-2 py-4.5 px-4 text-[12px] text-fg-dim" role="alert">
      <p className="m-0 text-err">{title}</p>
      {detail === undefined ? null : <p className="m-0 text-[11px]">{detail}</p>}
      <button type="button" className="px-2.5 py-1 rounded-md border-[0.5px] border-line bg-bg-2 text-fg font-[inherit] text-[11px] cursor-pointer enabled:hover:border-accent disabled:opacity-50 disabled:cursor-default" onClick={onRetry}>
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
    <p className="mx-4 my-2 px-2.5 py-1.5 border-s-2 border-warn bg-bg-1 text-warn text-[11px]" role="note">
      {children}
    </p>
  )
}
