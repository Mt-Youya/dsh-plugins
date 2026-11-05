import { useId, useState } from "react"

import type { SkillInsight } from "../../../protocol/insights.ts"
import { t } from "../../locale/index.ts"
import { insightLabel as label } from "../../locale/insights.ts"
import { formatTime } from "../../model/format.ts"
import { Card } from "../shared/primitives.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../shared/select.tsx"

export function visibleSkills(
  skills: readonly SkillInsight[],
  query: string,
  sort: "count" | "recent",
): SkillInsight[] {
  const needle = query.trim().toLowerCase()
  return skills
    .filter((skill) => `${skill.name}\n${skill.path ?? ""}`.toLowerCase().includes(needle))
    .toSorted(
      (a, b) =>
        (sort === "count" ? b.count - a.count : b.lastTurnIndex - a.lastTurnIndex) ||
        b.lastTurnIndex - a.lastTurnIndex ||
        a.id.localeCompare(b.id),
    )
}

export function SkillUsage({
  skills,
  onJumpTurn,
  loadedTurns,
  totalTurns,
  onLoadMore,
  loadingMore = false,
}: {
  skills?: readonly SkillInsight[]
  onJumpTurn?: (index: number) => void
  loadedTurns?: number
  totalTurns?: number
  onLoadMore?: () => void
  loadingMore?: boolean
}) {
  const id = useId()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"count" | "recent">("count")
  const visible = visibleSkills(skills ?? [], query, sort)
  const maximum = Math.max(1, ...visible.map((skill) => skill.count))
  return (
    <div className="flex min-w-0 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-[13px] font-semibold">{label("insights.skills")}</h3>
        <span className="text-[11px] text-fg-dim tabular-nums">
          {label("insights.skillSummary", {
            count: skills?.length ?? 0,
            uses: (skills ?? []).reduce((sum, skill) => sum + skill.count, 0),
          })}
        </span>
      </div>
      {loadedTurns !== undefined && totalTurns !== undefined && loadedTurns < totalTurns ? (
        <Card label={label("insights.skills")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-[11px] text-fg-dim">
              {label("insights.partialSkills", { loaded: loadedTurns, total: totalTurns })}
            </p>
            <button
              type="button"
              className="ci-btn min-h-9"
              disabled={loadingMore || onLoadMore === undefined}
              onClick={onLoadMore}
            >
              {t(loadingMore ? "session.loadingMore" : "session.loadMore")}
            </button>
          </div>
        </Card>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 basis-64 flex-col gap-1 text-[11px]">
          {label("insights.searchSkills")}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 w-full rounded-md border border-line bg-bg-1 px-3 text-[12px] shadow-sm"
          />
        </label>
        <div className="flex min-w-0 flex-col gap-1 text-[11px]">
          <label id={`${id}-sort`}>{label("insights.sortSkills")}</label>
          <Select value={sort} onValueChange={(value) => setSort(value === "recent" ? "recent" : "count")}>
            <SelectTrigger aria-labelledby={`${id}-sort`}>
              <SelectValue>{label(sort === "count" ? "insights.byCount" : "insights.byRecent")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count">{label("insights.byCount")}</SelectItem>
              <SelectItem value="recent">{label("insights.byRecent")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {skills === undefined ? (
        <p className="m-0 text-fg-dim">{label("insights.unrecorded")}</p>
      ) : visible.length === 0 ? (
        <Card label={label("insights.skills")}>
          <p className="m-0 text-[12px] text-fg-dim">
            {label(query.trim() === "" ? "insights.noSkills" : "insights.noMatchingSkills")}
          </p>
        </Card>
      ) : (
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-3 p-0">
          {visible.map((skill, rank) => (
            <li key={skill.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-line-soft bg-bg-1 p-4">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="font-mono text-[11px] text-fg-dim">{rank + 1}</span>
                <h3 className="m-0 min-w-0 flex-1 text-[13px] font-semibold wrap-anywhere">{skill.name}</h3>
                <span className="shrink-0 text-[11px] tabular-nums">
                  {label("insights.skillCount", { count: skill.count })}
                </span>
              </div>
              {skill.path === undefined ? null : (
                <p className="m-0 font-mono text-[10px] wrap-anywhere text-fg-dim">{skill.path}</p>
              )}
              <div
                role="meter"
                aria-valuemin={0}
                aria-valuemax={maximum}
                aria-valuenow={skill.count}
                aria-label={`${skill.name}: ${skill.count}`}
                className="h-1.5 overflow-clip rounded-full bg-bg-3"
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${(skill.count / maximum) * 100}%` }} />
              </div>
              <button
                type="button"
                className="ci-btn min-h-9 self-start active:bg-bg-3"
                disabled={onJumpTurn === undefined}
                onClick={() => onJumpTurn?.(skill.lastTurnIndex)}
              >
                {label("insights.jump", { index: skill.lastTurnIndex })}
              </button>
              <details>
                <summary className="cursor-pointer rounded-md py-2 text-[11px] active:bg-bg-3">
                  {label("insights.evidence")} ({skill.evidence.length})
                </summary>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {skill.evidence.map((evidence) => (
                    <li key={evidence.toolCallId} className="min-w-0 rounded-md bg-bg-2 p-2 text-[11px]">
                      <button
                        type="button"
                        className="ci-btn min-h-9 max-w-full active:bg-bg-3"
                        disabled={onJumpTurn === undefined}
                        onClick={() => onJumpTurn?.(evidence.turnIndex)}
                      >
                        {label("insights.jump", { index: evidence.turnIndex })}
                      </button>
                      <p className="m-0 py-1">{label(`insights.${evidence.kind}`)}</p>
                      <p className="m-0 font-mono wrap-anywhere text-fg-dim">{evidence.toolCallId}</p>
                      <p className="m-0 text-fg-dim">
                        {evidence.time === undefined ? label("insights.unrecorded") : formatTime(evidence.time)}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ol>
      )}
      <p className="m-0 text-[11px] leading-relaxed text-fg-dim">{label("insights.skillNote")}</p>
    </div>
  )
}
