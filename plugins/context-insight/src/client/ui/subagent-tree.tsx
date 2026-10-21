/**
 * Subagent sessions: a collapsed tree hanging off the session, with the turns
 * that spawned children marked under them.
 *
 * The IR keeps subagents out of `turns` on purpose (docs/IR.md rule 4), so the
 * panel must show them as an attached subtree rather than as extra turns. A
 * disclosure keeps a session with twenty attached files from burying the turn
 * view until it is asked for.
 *
 * @module @cyrus/dsh-context-insight/client/subagent-tree
 */

import type { ReactElement } from "react"
import type { SegmentInfo } from "../../protocol.ts"
import { basename, formatBytes } from "../format.ts"
import { t } from "../locale.ts"

/**
 * @param props.segments - the session's physical files, main first.
 * @param props.turnSubagents - subagent ids recorded on the open turn.
 * @returns the section.
 */
export function SubagentTree({
  segments,
  turnSubagents,
}: {
  segments: SegmentInfo[]
  turnSubagents: string[]
}): ReactElement {
  const attached = segments.slice(1)
  return (
    <section className="px-4 pt-3 pb-1 border-b-[0.5px] border-line-soft" aria-label={t("subagents.title")}>
      <h3 className="flex items-baseline gap-2 mt-0 mb-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-dim">{t("subagents.title")}</h3>
      {segments.length === 0 ? <p className="text-fg-dim text-[10.5px] my-1.5">{t("subagents.none")}</p> : null}
      {segments.length > 0 ? (
        <details className="mt-1 mb-2" open={attached.length > 0 && attached.length <= 3}>
          <summary className="text-[11px] text-fg-dim cursor-pointer">{t("subagents.files", { count: attached.length })}</summary>
          <ul className="mt-1.5 mb-0 p-0 list-none font-mono text-[11px]">
            <li className="flex items-baseline gap-1.5 py-0.5 ps-0">
              <span className="text-fg-dim" aria-hidden="true">
                ▸
              </span>
              <span className="truncate">{basename(segments[0]?.name ?? "")}</span>
              <span className="text-fg-dim text-[10px]">{formatBytes(segments[0]?.bytes ?? 0)}</span>
              <span className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-fg-dim border-[0.5px] border-line-soft">{t("subagents.main")}</span>
            </li>
            {attached.map((segment) => (
              <li className="flex items-baseline gap-1.5 py-0.5 ps-3" key={segment.name}>
                <span className="text-fg-dim" aria-hidden="true">
                  └
                </span>
                <span className="truncate">{segment.name}</span>
                <span className="text-fg-dim text-[10px]">{formatBytes(segment.bytes)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {turnSubagents.length === 0 ? (
        <p className="text-fg-dim text-[10.5px] my-1.5">{t("turns.noSubagents")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5 mt-1.5 mb-2 p-0 list-none">
          {turnSubagents.map((id) => (
            <li key={id} className="inline-flex items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-[17px] whitespace-nowrap bg-transparent text-fg-dim border-[0.5px] border-line-soft">
              {id}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
