import { type ReactElement, useEffect, useId, useRef, useState } from "react"

import { t } from "../../locale/index.ts"
import { sessionKey, type TreeSession } from "../../model/tree.ts"
import type { SessionManagementState } from "../../state/use-session-management.ts"

export function ManagementControls({
  state,
  visible,
}: {
  state: SessionManagementState
  visible: () => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      {state.editing ? (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className="ci-btn ci-btn--quiet active:bg-hover"
            disabled={state.busy}
            onClick={visible}
          >
            {t("management.selectVisible")}
          </button>
          <button
            type="button"
            className="ci-btn ci-btn--quiet active:bg-hover"
            disabled={state.busy}
            onClick={state.clearSelection}
          >
            {t("management.clear")}
          </button>
        </div>
      ) : null}
      {state.editing || state.groupFilter !== "" ? (
        <select
          aria-label={t("management.groupFilter")}
          className="min-w-0 rounded border border-line bg-bg px-2 py-1 text-[12px] text-fg focus-visible:outline-2 focus-visible:outline-accent"
          value={state.groupFilter}
          disabled={state.busy || state.metadataLoading}
          onChange={(event) => state.setGroupFilter(event.currentTarget.value)}
        >
          <option value="">{t("management.allGroups")}</option>
          <option value="ungrouped">{t("management.ungrouped")}</option>
          {state.groups.map((group) => (
            <option key={group} value={`group:${group}`}>
              {group}
            </option>
          ))}
        </select>
      ) : null}
      {state.metadataLoading ? (
        <p role="status" className="m-0 text-[11px] text-fg-dim">
          {t("management.loading")}
        </p>
      ) : null}
      {state.metadataError !== "" ? (
        <div role="alert" className="text-[11px] text-err">
          {state.metadataError}
          <button
            type="button"
            className="ci-btn ci-btn--quiet active:bg-hover"
            onClick={() => void state.ensureMetadata()}
          >
            {t("management.retry")}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function SessionManagement({
  state,
  selected,
}: {
  state: SessionManagementState
  selected: readonly TreeSession[]
}): ReactElement {
  return (
    <>
      {state.editing ? (
        <footer
          className="flex shrink-0 flex-col gap-2 border-bs border-line bg-bg-1 p-3"
          aria-label={t("sessions.actions")}
        >
          <span role="status" className="text-[12px] tabular-nums">
            {t("management.selected", { count: selected.length })}
          </span>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="ci-btn active:bg-hover"
              disabled={state.busy || selected.length === 0}
              onClick={() => void state.openDialog("rename", selected)}
            >
              {t("management.rename")}
            </button>
            <button
              type="button"
              className="ci-btn active:bg-hover"
              disabled={state.busy || state.generating || selected.length === 0}
              onClick={() => void state.openAiDialog(selected)}
            >
              {t("management.aiRename")}
            </button>
            <button
              type="button"
              className="ci-btn active:bg-hover"
              disabled={state.busy || selected.length === 0}
              onClick={() => void state.openDialog("group", selected)}
            >
              {t("management.move")}
            </button>
            <button
              type="button"
              className="ci-btn text-err active:bg-hover"
              disabled={state.busy || selected.length === 0}
              onClick={() => void state.deleteSessions(selected)}
            >
              {t(state.busy ? "management.saving" : "management.delete")}
            </button>
          </div>
          {state.dialog === null && state.failures.length > 0 ? (
            <div className="max-bs-32 overflow-y-auto" role="alert">
              {state.failures.map(({ session, reason }) => (
                <p key={sessionKey(session.source, session.id)} className="m-0 text-[11px] text-err">
                  {t("management.failure", { title: session.title, reason })}
                </p>
              ))}
              <button
                type="button"
                className="ci-btn active:bg-hover"
                disabled={state.busy}
                onClick={() => void state.deleteSessions(state.failures.map((failure) => failure.session))}
              >
                {t("management.retry")}
              </button>
            </div>
          ) : null}
        </footer>
      ) : null}
      {state.dialog !== null ? <MetadataDialog key={state.dialog.serial} state={state} /> : null}
    </>
  )
}

function MetadataDialog({ state }: { state: SessionManagementState }): ReactElement | null {
  const target = state.dialog
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const groupsId = useId()
  const [restored, setRestored] = useState(new Set<string>())
  const [group, setGroup] = useState("")
  const [ungroup, setUngroup] = useState(false)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    dialog?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus()
    return () => dialog?.close()
  }, [])
  if (target === null) return null
  const renaming = target.kind === "rename"
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="ci-panel max-bs-[80dvh] rounded-xl border border-line bg-bg-1 p-0 text-fg shadow-lg backdrop:bg-black/40"
      style={{ inlineSize: "min(34rem, calc(100% - 2rem))" }}
      onCancel={(event) => {
        event.preventDefault()
        state.closeDialog()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          state.closeDialog()
      }}
    >
      <form
        className="max-bs-[80dvh] flex flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          const values = new Map<string, string | null>()
          for (const session of target.sessions) {
            const key = sessionKey(session.source, session.id)
            if (restored.has(key)) values.set(key, null)
            else if (state.drafts.has(key)) values.set(key, state.drafts.get(key)?.trim() ?? null)
            else if (
              !target.ai &&
              !state.aiErrors.has(key) &&
              !state.suggestions.has(key) &&
              state.progress.total === 0
            )
              values.set(key, session.title)
          }
          void state.save(values, ungroup ? null : group.trim())
        }}
      >
        <h2 id={titleId} className="m-0 shrink-0 p-4 text-[15px] font-semibold">
          {t(renaming ? "management.rename" : "management.move")} · {target.sessions.length}
        </h2>
        <div className="ci-scroll min-bs-0 flex-1 overflow-y-auto overscroll-contain px-4">
          {target.ai || state.progress.total > 0 ? (
            <div className="flex flex-col gap-1 text-[11px] text-fg-dim" role="status">
              <p className="m-0">{t("management.aiHint")}</p>
              <p className="m-0">{t("management.aiSkipped", { count: target.skipped })}</p>
              <p className="m-0">{t("management.aiProgress", state.progress)}</p>
              {state.generating ? (
                <button type="button" className="ci-btn active:bg-hover" onClick={state.stopGeneration}>
                  {t("management.aiStop")}
                </button>
              ) : null}
            </div>
          ) : null}
          {renaming ? (
            target.sessions.map((session) => {
              const key = sessionKey(session.source, session.id)
              return (
                <div key={key} className="mbs-2 flex flex-col gap-1 text-[12px]">
                  <span className="wrap-break-word">{session.title}</span>
                  <span className="text-[10px] break-all text-fg-dim">
                    {session.source} · {session.workdir} · {session.id}
                  </span>
                  <input
                    aria-label={t("management.name", { title: session.title })}
                    className="min-w-0 rounded border border-line bg-bg px-2 py-1.5 text-fg focus-visible:outline-2 focus-visible:outline-accent"
                    value={state.drafts.get(key) ?? session.title}
                    maxLength={80}
                    disabled={state.busy || state.generating || restored.has(key)}
                    required={!restored.has(key)}
                    onChange={(event) => state.editDraft(key, event.currentTarget.value)}
                  />
                  <button
                    type="button"
                    className="ci-btn active:bg-hover"
                    disabled={state.busy || state.generating || restored.has(key)}
                    onClick={() => void state.generateTitles([session])}
                  >
                    {t(state.aiErrors.has(key) ? "management.retry" : "management.aiSuggest")}
                  </button>
                  {state.suggestions.has(key) ? (
                    <span
                      className="text-[10px] text-fg-dim"
                      title={`${state.suggestions.get(key)!.provider} · ${state.suggestions.get(key)!.model}`}
                    >
                      {state.suggestions.get(key)!.provider} · {state.suggestions.get(key)!.model}
                    </span>
                  ) : null}
                  {state.aiErrors.has(key) ? (
                    <span role="alert" className="text-[11px] text-err">
                      {state.aiErrors.get(key)}
                    </span>
                  ) : null}
                  {(target.ai || state.progress.total > 0) && !state.drafts.has(key) && !restored.has(key) ? (
                    <span className="text-[11px] text-fg-dim">{t("management.aiPending")}</span>
                  ) : null}
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={restored.has(key)}
                      disabled={state.busy || state.generating}
                      onChange={(event) => {
                        const next = new Set(restored)
                        if (event.currentTarget.checked) next.add(key)
                        else next.delete(key)
                        setRestored(next)
                      }}
                    />
                    {t("management.restore")}
                  </label>
                </div>
              )
            })
          ) : (
            <div className="flex flex-col gap-2 text-[12px]">
              <p className="m-0 text-fg-dim">{t("management.groupHint")}</p>
              <label className="flex flex-col gap-1">
                {t("management.group")}
                <input
                  className="rounded border border-line bg-bg px-2 py-1.5 text-fg focus-visible:outline-2 focus-visible:outline-accent"
                  list={groupsId}
                  maxLength={80}
                  value={group}
                  disabled={state.busy || ungroup}
                  required={!ungroup}
                  onChange={(event) => setGroup(event.currentTarget.value)}
                />
              </label>
              <datalist id={groupsId}>
                {state.groups.map((name) => (
                  <option value={name} key={name} />
                ))}
              </datalist>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={ungroup}
                  disabled={state.busy}
                  onChange={(event) => setUngroup(event.currentTarget.checked)}
                />
                {t("management.ungroup")}
              </label>
              {target.sessions.map((session) => (
                <p key={sessionKey(session.source, session.id)} className="m-0 wrap-break-word text-fg-dim">
                  {session.title} · {session.workdir}
                </p>
              ))}
            </div>
          )}
          {state.failures.length > 0 ? (
            <div role="alert" className="mbs-2 text-[11px] text-err">
              {state.failures.map(({ session, reason }) => (
                <p key={sessionKey(session.source, session.id)}>
                  {t("management.failure", { title: session.title, reason })}
                </p>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 p-4">
          <button type="button" className="ci-btn active:bg-hover" disabled={state.busy} onClick={state.closeDialog}>
            {t("management.cancel")}
          </button>
          <button
            type="submit"
            className="ci-btn active:bg-hover"
            disabled={
              state.busy ||
              state.generating ||
              target.sessions.length === 0 ||
              ((target.ai || state.progress.total > 0) &&
                !target.sessions.some(
                  (session) =>
                    restored.has(sessionKey(session.source, session.id)) ||
                    state.drafts.has(sessionKey(session.source, session.id)),
                )) ||
              state.metadataLoading ||
              state.metadataError !== "" ||
              (!renaming && !ungroup && group.trim() === "") ||
              (renaming &&
                target.sessions.some((session) => {
                  const key = sessionKey(session.source, session.id)
                  return !restored.has(key) && (state.drafts.get(key) ?? session.title).trim() === ""
                }))
            }
          >
            {t(state.busy ? "management.saving" : state.failures.length > 0 ? "management.retry" : "management.save")}
          </button>
        </div>
      </form>
    </dialog>
  )
}
