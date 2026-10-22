/**
 * Tool-call detail: what the turn actually did to the filesystem.
 *
 * A call is only useful if it shows the thing the model saw: the command as it
 * ran, the real path it touched, the exact lines an edit replaced, and the error
 * text when it failed. Everything else (the raw JSON) is folded into a
 * disclosure so it never crowds the four facts above.
 *
 * @module @cyrus/dsh-sessions-insight/client/tool-detail
 */

import type { ReactElement } from "react"
import type { ToolCall } from "@cyrus/dsh-session-contract"
import { clip, formatDuration } from "../format.ts"
import { t } from "../locale.ts"
import { Glyph } from "./icons.tsx"

/** Statuses a chip can show; `running` is derived, not read from the IR. */
type ToolStatus = ToolCall["status"] | "running"

/**
 * Chip skin per status. Spelled out rather than interpolated, so no class name is
 * ever built at runtime.
 */
const STATUS_SKIN: Record<ToolStatus, string> = {
  ok: "ci-status ci-status--ok",
  error: "ci-status ci-status--error",
  unknown: "ci-status ci-status--unknown",
  running: "ci-status ci-status--running",
}

/** Calls rendered before the "show all" control appears. */
const VISIBLE_CALLS = 12

/** Characters of a block printed before it folds. */
const PREVIEW_CHARS = 600

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function stringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key]
  return typeof value === "string" ? value : undefined
}

/**
 * Flatten a tool result into text.
 * @param value - a string, a content-block array, or any JSON value.
 * @returns printable text (possibly empty).
 */
export function outputText(value: unknown): string {
  if (value === undefined) return ""
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") return entry
        const record = asRecord(entry)
        const text = stringField(record, "text")
        return text ?? (record === undefined ? "" : JSON.stringify(record))
      })
      .filter((part) => part !== "")
      .join("\n")
  }
  const record = asRecord(value)
  const text = stringField(record, "text")
  if (text !== undefined) return text
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

interface Fact {
  label: string
  body: string
  mono?: boolean
}

/**
 * The one fact a call is about, chosen by tool name.
 * @param call - the tool call.
 * @returns label and body, or undefined when the call carries no named input.
 */
function primaryFact(call: ToolCall): Fact | undefined {
  const input = asRecord(call.input)
  const command = stringField(input, "command")
  if (command !== undefined) return { label: t("tools.command"), body: command, mono: true }
  const path = stringField(input, "file_path") ?? stringField(input, "path") ?? stringField(input, "notebook_path")
  if (path !== undefined) return { label: t("tools.path"), body: path, mono: true }
  const url = stringField(input, "url")
  if (url !== undefined) return { label: "url", body: url, mono: true }
  const query = stringField(input, "query")
  if (query !== undefined) return { label: "query", body: query }
  if (call.input === undefined) return undefined
  return { label: t("tools.input"), body: clip(outputText(call.input), PREVIEW_CHARS), mono: true }
}

/**
 * A replaced/inserted pair, printed line by line.
 * @param props.before - text the edit removed.
 * @param props.after - text the edit inserted.
 * @returns the diff block.
 */
function DiffBlock({ before, after }: { before: string; after: string }): ReactElement {
  const removed = before === "" ? [] : before.split("\n")
  const added = after === "" ? [] : after.split("\n")
  return (
    <div>
      <span className="block mb-1 text-[10.5px] text-fg-dim">{t("tools.diff")}</span>
      <pre className="ci-pre max-h-55">
        {removed.map((line, index) => (
          <span
            className="block bg-[color-mix(in_oklch,var(--color-err)_8%,transparent)] text-err"
            key={`d${String(index)}`}
          >
            {line}
            {"\n"}
          </span>
        ))}
        {added.map((line, index) => (
          <span
            className="block bg-[color-mix(in_oklch,var(--color-ok)_8%,transparent)] text-ok"
            key={`a${String(index)}`}
          >
            {line}
            {"\n"}
          </span>
        ))}
      </pre>
    </div>
  )
}

/**
 * One call: a one-line summary that folds open into the facts.
 *
 * The summary carries what a reader scans for — tool, status, the command or
 * path, duration — and a failed call opens itself, because its error text is
 * the reason to look.
 * @param props.call - the call.
 * @returns the entry.
 */
function ToolEntry({ call }: { call: ToolCall }): ReactElement {
  const fact = primaryFact(call)
  const input = asRecord(call.input)
  const before = stringField(input, "old_string")
  const after = stringField(input, "new_string")
  const output = outputText(call.output)
  const failed = call.status === "error"
  // A call that never closed is still running (or the session died mid-call);
  // either way it is in flight, not "no result".
  const running = call.endedAt === undefined && call.status !== "error"
  const status: ToolStatus = running ? "running" : call.status
  const statusLabel =
    status === "running"
      ? t("tools.status.running")
      : status === "ok"
        ? t("tools.status.ok")
        : status === "error"
          ? t("tools.status.error")
          : t("tools.status.unknown")
  return (
    <li className={failed ? "rounded-lg border border-err/40 bg-err/5" : "rounded-lg border border-line-soft bg-bg"}>
      <details className="ci-fold" open={failed}>
        <summary className="flex items-center gap-2 min-w-0 px-2.5 py-2 text-[12px]">
          <Glyph name="chevron" size={11} className="ci-chevron shrink-0 text-fg-3" />
          <span className="font-mono font-semibold shrink-0">{call.name}</span>
          <span className={STATUS_SKIN[status] + " shrink-0"}>{statusLabel}</span>
          {fact === undefined ? null : (
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-fg-dim" title={fact.body}>
              {fact.body.split("\n")[0]}
            </span>
          )}
          <span className="ms-auto shrink-0 text-[10.5px] text-fg-3 tabular-nums">
            {formatDuration(call.startedAt, call.endedAt)}
          </span>
        </summary>
        <div className="flex flex-col gap-2 px-2.5 pb-2.5">
          {fact === undefined ? null : (
            <div>
              <span className="block mb-1 text-[10.5px] text-fg-dim">{fact.label}</span>
              <pre className="ci-pre">{clip(fact.body, PREVIEW_CHARS)}</pre>
            </div>
          )}
          {before === undefined && after === undefined ? null : <DiffBlock before={before ?? ""} after={after ?? ""} />}
          {output === "" ? null : (
            <div>
              <span className={failed ? "block mb-1 text-[10.5px] text-err" : "block mb-1 text-[10.5px] text-fg-dim"}>
                {failed ? `${t("tools.output")} · ${t("tools.status.error")}` : t("tools.output")}
              </span>
              <pre className="ci-pre max-h-80">{clip(output, PREVIEW_CHARS * 4)}</pre>
            </div>
          )}
        </div>
      </details>
    </li>
  )
}

/**
 * The whole tool section for one turn.
 * @param props.calls - that turn's calls.
 * @param props.expanded - whether the caller lifted the visible cap.
 * @param props.onToggleExpanded - lift/lower the cap.
 * @returns the section body.
 */
export function ToolCalls({
  calls,
  expanded,
  onToggleExpanded,
}: {
  calls: ToolCall[]
  expanded: boolean
  onToggleExpanded: (next: boolean) => void
}): ReactElement {
  if (calls.length === 0) return <p className="m-0 text-[11.5px] text-fg-dim">{t("turns.noTools")}</p>
  const visible = expanded ? calls : calls.slice(0, VISIBLE_CALLS)
  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {visible.map((call) => (
          <ToolEntry key={call.id} call={call} />
        ))}
      </ul>
      {calls.length > VISIBLE_CALLS ? (
        <button type="button" className="ci-btn ci-btn--quiet mt-2" onClick={() => onToggleExpanded(!expanded)}>
          {expanded ? t("tools.showLess") : t("tools.showAll", { count: calls.length })}
        </button>
      ) : null}
    </>
  )
}
