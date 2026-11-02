import type { ReactElement, ReactNode } from "react"

import type { SessionInsights } from "../../protocol/insights.ts"
import { compactTokens, formatDuration, formatShare, formatTime } from "../format.ts"
import { insightLabel as label } from "../insight-labels.ts"
import { t } from "../locale.ts"
import type { OverviewState } from "../state/session-insights.ts"
import { MeasureValue } from "./precision.tsx"
import { Card as Surface } from "./primitives.tsx"
import { partColor, PartLegend, StackedBar } from "./stacked-bar.tsx"

function Card({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <Surface label={title}>
      <div className="flex min-w-0 flex-col gap-2.5">
        <h3 className="m-0 text-[12px] font-semibold">{title}</h3>
        {children}
      </div>
    </Surface>
  )
}

/** SVG charts use existing identity colors, and do not interpolate missing values. */
function Ring({
  slices,
  center,
  name,
}: {
  slices: { value: number; color: string }[]
  center: ReactNode
  name: string
}): ReactElement {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  let offset = 0
  return (
    <div className="grid w-full min-w-0 place-items-center">
      <svg viewBox="0 0 120 120" className="col-start-1 row-start-1 h-32 w-32 max-w-full" role="img" aria-label={name}>
        <circle cx="60" cy="60" r="48" fill="none" stroke="var(--color-bg-3)" strokeWidth="9" />
        {total <= 0
          ? null
          : slices.map((slice, index) => {
              const share = (slice.value / total) * 100
              const start = offset
              offset += share
              return (
                <circle
                  key={index}
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="9"
                  pathLength="100"
                  strokeDasharray={`${share} ${100 - share}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 60 60)"
                />
              )
            })}
      </svg>
      <div className="col-start-1 row-start-1 flex max-w-[16ch] flex-col items-center gap-1 text-center text-[12px]">
        {center}
      </div>
    </div>
  )
}

function Unknown(): ReactElement {
  return <span className="text-[12px] text-fg-dim">{label("insights.unrecorded")}</span>
}

export function SessionOverview({
  insights: hostInsights,
  overview,
  onJumpTurn,
  onLoadMore,
  loadingMore = false,
  pagingFailure,
}: {
  insights?: SessionInsights
  overview?: OverviewState
  onJumpTurn?: (index: number) => void
  onLoadMore?: () => void
  loadingMore?: boolean
  pagingFailure?: ReactNode
}): ReactElement {
  const insights = hostInsights ?? overview?.report
  const partial = hostInsights === undefined && overview?.source === "client-partial"
  const currentTitle = label(partial ? "insights.loadedContext" : "insights.current")
  const usageTitle = label(partial && overview?.usageSource !== "cost" ? "insights.loadedUsage" : "insights.usage")
  if (insights === undefined)
    return (
      <div className="p-5">
        <Unknown />
      </div>
    )
  const current = insights.currentAttribution
  const attribution = current?.attribution
  const window = attribution?.windowSize
  const share =
    attribution !== undefined && window !== undefined && window > 0 ? attribution.total.tokens / window : undefined
  const usage = insights.usage
  const buckets = [
    { key: "input", color: partColor("user-input") },
    { key: "cacheRead", color: partColor("history") },
    { key: "cacheWrite", color: partColor("memory-instructions") },
    { key: "output", color: partColor("assistant-output") },
  ] as const
  const usageTotal =
    usage.coveredTurns === 0 && overview?.usageSource !== "cost"
      ? null
      : buckets.reduce((sum, bucket) => sum + (usage[bucket.key] ?? 0), 0)
  const timing = insights.timing
  return (
    <div className="flex min-w-0 flex-col gap-3 p-4">
      <Surface label={label("insights.summary")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-[12px] font-semibold">{label("insights.summary")}</h3>
          <span className="text-[11px] text-fg-dim tabular-nums">
            {label("insights.turnCount")} · {overview?.totalTurns ?? insights.turnCount}
          </span>
        </div>
        {hostInsights === undefined && overview !== undefined && overview.source !== "host" ? (
          <p className="m-0 mbs-2 text-[11px] text-fg-dim" role="status">
            {partial
              ? label("insights.partial", { loaded: overview.loadedTurns, total: overview.totalTurns })
              : label("insights.fallback")}
          </p>
        ) : null}
        {partial ? (
          <div className="mbs-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-fg-dim">{label("insights.loadedNote")}</span>
            <button
              type="button"
              className="ci-btn min-h-9 active:bg-bg-3"
              disabled={loadingMore || onLoadMore === undefined}
              onClick={onLoadMore}
            >
              {loadingMore ? t("session.loadingMore") : t("session.loadMore")}
            </button>
          </div>
        ) : null}
        {pagingFailure}
        <dl className="m-0 mbs-3 flex flex-wrap gap-x-6 gap-y-2 text-[11px]">
          <div>
            <dt className="text-fg-dim">{label("insights.toolCalls")}</dt>
            <dd className="m-0 font-semibold tabular-nums">{insights.toolCalls}</dd>
          </div>
          <div>
            <dt className="text-fg-dim">{label("insights.compactions")}</dt>
            <dd className="m-0 font-semibold tabular-nums">{insights.compactions}</dd>
          </div>
          <div>
            <dt className="text-fg-dim">{label("insights.span")}</dt>
            <dd className="m-0 font-semibold tabular-nums">
              {timing.spanMs === null ? <Unknown /> : formatDuration(1, timing.spanMs + 1)}
            </dd>
          </div>
          <div>
            <dt className="text-fg-dim">{label("insights.peak")}</dt>
            <dd className="m-0 font-semibold tabular-nums">
              {insights.peak === null ? <Unknown /> : <MeasureValue measure={insights.peak.measure} dense />}
            </dd>
          </div>
        </dl>
      </Surface>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] items-start gap-3">
        <Card title={currentTitle}>
          <Ring
            name={currentTitle}
            slices={
              share === undefined
                ? []
                : [
                    { value: Math.min(share, 1), color: "var(--color-accent)" },
                    { value: Math.max(1 - share, 0), color: "var(--color-bg-3)" },
                  ]
            }
            center={
              attribution === undefined ? (
                <Unknown />
              ) : (
                <>
                  <strong className="text-[24px] tabular-nums">{compactTokens(attribution.total.tokens)}</strong>
                  <span className="text-fg-dim">tokens</span>
                </>
              )
            }
          />
          {attribution === undefined ? null : <MeasureValue measure={attribution.total} />}
          <p className="m-0 text-[11px] text-fg-dim">
            {share === undefined
              ? label("insights.windowUnknown")
              : label("insights.window", { share: formatShare(attribution!.total.tokens, window!) })}
          </p>
          {current === null || partial ? null : (
            <p className="m-0 text-[11px] text-fg-dim">{label("insights.currentNote", { index: current.turnIndex })}</p>
          )}
        </Card>
        <Card title={usageTitle}>
          <Ring
            name={usageTitle}
            slices={
              usageTotal === null
                ? []
                : buckets.map((bucket) => ({
                    value: usage[bucket.key] ?? 0,
                    color: bucket.color,
                  }))
            }
            center={
              usageTotal === null ? (
                <Unknown />
              ) : (
                <>
                  <strong className="text-[24px] tabular-nums">{compactTokens(usageTotal)}</strong>
                  <span className="text-fg-dim">tokens</span>
                </>
              )
            }
          />
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2 p-0">
            {buckets.map((bucket) => (
              <li key={bucket.key} className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: bucket.color }}
                  aria-hidden="true"
                />
                <span>{label(`insights.${bucket.key}`)}</span>
                {usage[bucket.key] === null ? (
                  <Unknown />
                ) : (
                  <MeasureValue measure={{ tokens: usage[bucket.key]!, precision: "exact", basis: "usage" }} dense />
                )}
              </li>
            ))}
          </ul>
          <p className="m-0 text-[11px] text-fg-dim">
            {label(
              overview?.usageSource === "cost" && hostInsights === undefined
                ? "insights.costUsage"
                : "insights.usageNote",
            )}
          </p>
          <p className="m-0 text-[11px] text-fg-dim">
            {label("insights.coverage", { covered: usage.coveredTurns, missing: usage.missingTurns })}
          </p>
        </Card>
      </div>
      <Card title={label("insights.composition")}>
        {attribution === undefined ? (
          <Unknown />
        ) : (
          <>
            <StackedBar attribution={attribution} label={label("insights.composition")} />
            <PartLegend attribution={attribution} />
          </>
        )}
      </Card>
      <Surface label={label("insights.completedDuration")}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-[12px] font-semibold">{label("insights.completedDuration")}</h3>
            <p className="m-0 text-[16px] tabular-nums">
              {timing.completedTurnMs === null ? <Unknown /> : formatDuration(1, timing.completedTurnMs + 1)}
            </p>
            <p className="m-0 text-[11px] text-fg-dim">
              {label("insights.durationCoverage", {
                covered: timing.completedTurns,
                missing: timing.missingTurnDurations,
              })}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-[12px] font-semibold">{label("insights.toolDuration")}</h3>
            <p className="m-0 text-[16px] tabular-nums">
              {timing.toolUnionMs === null ? <Unknown /> : formatDuration(1, timing.toolUnionMs + 1)}
            </p>
            <p className="m-0 text-[11px] text-fg-dim">
              {label("insights.durationCoverage", {
                covered: timing.timedToolCalls,
                missing: timing.missingToolDurations,
              })}
            </p>
          </div>
        </div>
        <p className="m-0 mbs-2 text-[11px] text-fg-dim">{label("insights.durationNote")}</p>
      </Surface>
      <Card title={label(partial ? "insights.loadedMessage" : "insights.lastMessage")}>
        {insights.lastMessage === null ? (
          <Unknown />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-dim">
              <span>{label(`insights.${insights.lastMessage.role}`)}</span>
              {insights.lastMessage.time === undefined ? (
                <Unknown />
              ) : (
                <time>{formatTime(insights.lastMessage.time)}</time>
              )}
              <button
                type="button"
                className="ci-btn min-h-9 active:bg-bg-3"
                disabled={onJumpTurn === undefined}
                onClick={() => onJumpTurn?.(insights.lastMessage!.turnIndex)}
              >
                {label("insights.jump", { index: insights.lastMessage.turnIndex })}
              </button>
            </div>
            <p className="m-0 max-h-64 overflow-y-auto text-[12px] leading-relaxed wrap-anywhere whitespace-pre-wrap">
              {insights.lastMessage.text}
            </p>
          </>
        )}
      </Card>
    </div>
  )
}
