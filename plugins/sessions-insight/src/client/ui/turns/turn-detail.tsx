/**
 * The open turn: what the human asked, what the model was fed, and what it did.
 *
 * One card per question, in reading order — the user's words, the composition
 * of the context, the compaction boundaries (only when there are any), the tool
 * calls, then the subagent files.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/client/turn-detail
 */

import type { Turn } from "@cyrusdoyle/dsh-session-contract"
import type { ReactElement } from "react"

import type { SegmentInfo } from "../../../protocol.ts"
import { t } from "../../locale/index.ts"
import { compactTokens, formatFactor, formatShare, formatTime } from "../../model/format.ts"
import { PartLegend, StackedBar } from "../charts/stacked-bar.tsx"
import { SubagentTree } from "../session/subagent-tree.tsx"
import { MeasureValue } from "../shared/precision.tsx"
import { Card, Chip, SectionTitle } from "../shared/primitives.tsx"
import { ToolCalls } from "./tool-detail.tsx"

/**
 * @param props.turn - the open turn.
 * @param props.segments - session files, for the subagent tree.
 * @param props.expandedTools - whether the tool cap is lifted.
 * @param props.onToggleTools - lift/lower the tool cap.
 * @returns the column body.
 */
export function TurnDetail({
  turn,
  segments,
  expandedTools,
  onToggleTools,
}: {
  turn: Turn
  segments: SegmentInfo[]
  expandedTools: boolean
  onToggleTools: (next: boolean) => void
}): ReactElement {
  const attribution = turn.attribution
  const total = attribution.total.tokens
  return (
    <div className="flex min-w-0 flex-col">
      {/* Pinned: which turn this is and what the human asked stay in view while
          the cards below scroll. */}
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-line-soft bg-bg px-4 pt-4 pb-3">
        <div className="flex min-w-0 items-end gap-3">
          <div className="flex min-w-0 flex-col">
            <h3 className="m-0 text-[15px] font-semibold">{t("turns.selected", { index: turn.index })}</h3>
            <span className="text-[11px] text-fg-dim tabular-nums">{formatTime(turn.startedAt)}</span>
          </div>
          <div className="ms-auto flex items-baseline gap-2">
            <span className="text-[20px] font-semibold tracking-[-0.01em] tabular-nums">{compactTokens(total)}</span>
            {attribution.windowSize === undefined ? null : (
              <Chip tone="soft">
                {t("stats.windowShare", {
                  share: formatShare(total, attribution.windowSize),
                  size: compactTokens(attribution.windowSize),
                })}
              </Chip>
            )}
          </div>
        </div>
        {turn.userInput.length === 0 ? null : (
          <div className="ci-ask">
            <span className="ci-ask__label">{t("detail.userInput")}</span>
            <p className="ci-ask__text">{turn.userInput.join("\n")}</p>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3 p-4">
        <Card label={t("detail.composition")}>
          <SectionTitle
            end={
              attribution.reconciled === undefined ? undefined : (
                <Chip tone="mono" title={t("turns.reconciled", { factor: attribution.reconciled.factor.toFixed(3) })}>
                  {formatFactor(attribution.reconciled.factor)}
                </Chip>
              )
            }
          >
            {t("detail.composition")}
          </SectionTitle>
          <StackedBar attribution={attribution} label={t("turns.selected", { index: turn.index })} />
          <PartLegend attribution={attribution} />
        </Card>

        {turn.compactions.length === 0 ? null : (
          <Card label={t("turns.compaction")}>
            <SectionTitle count={turn.compactions.length}>{t("turns.compaction")}</SectionTitle>
            <ul className="m-0 list-none p-0">
              {turn.compactions.map((point, order) => (
                <li
                  className="flex flex-wrap items-baseline gap-2 border-t border-line-soft py-1.5 text-[11.5px] first:border-t-0"
                  key={`${String(point.at)}-${String(order)}`}
                >
                  <span className="font-mono text-[10.5px] text-fg-dim">{formatTime(point.at)}</span>
                  <MeasureValue measure={point.before} dense />
                  <span aria-hidden="true" className="text-warn">
                    →
                  </span>
                  <MeasureValue measure={point.after} dense />
                  <span className="text-fg-dim">
                    {point.replacedHistory ? t("turns.compactionReplaced") : t("turns.compactionContinued")}
                  </span>
                  {point.trigger === undefined ? null : <Chip tone="soft">{point.trigger}</Chip>}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card label={t("turns.tools")}>
          <SectionTitle count={turn.toolCalls.length}>{t("turns.tools")}</SectionTitle>
          <ToolCalls calls={turn.toolCalls} expanded={expandedTools} onToggleExpanded={onToggleTools} />
        </Card>

        <SubagentTree segments={segments} turnSubagents={turn.subagents} />
      </div>
    </div>
  )
}
