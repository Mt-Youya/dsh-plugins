import { useEffect, useRef, useState } from "react"

import type { AiTitleValue } from "../../protocol/ai-title.ts"
import type { SessionMetadataValue } from "../../protocol/management.ts"
import { type Api, failureText } from "../api.ts"
import { t } from "../locale.ts"
import { type ManagementApi, type ManagementFailure, runSessionBatch } from "./management.ts"
import { emptySelection, removeSelection } from "./selection.ts"
import { sessionKey, type TreeSession } from "./tree.ts"

export interface ManagementDialog {
  serial: number
  kind: "rename" | "group"
  sessions: TreeSession[]
  ai?: boolean
  skipped: number
}

export function useSessionManagement(
  api: Api,
  onDeleted: (session: TreeSession) => void,
  onMetadataChanged?: (value: SessionMetadataValue) => void,
) {
  const managementApi = api as Api & Partial<ManagementApi>
  const [editing, setEditing] = useState(false)
  const [selection, setSelection] = useState(emptySelection)
  const [metadata, setMetadata] = useState(new Map<string, SessionMetadataValue>())
  const [groupFilter, setGroupFilter] = useState("")
  const [dialog, setDialog] = useState<ManagementDialog | null>(null)
  const [busy, setBusy] = useState(false)
  const [failures, setFailures] = useState<ManagementFailure[]>([])
  const [metadataError, setMetadataError] = useState("")
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [drafts, setDrafts] = useState(new Map<string, string | null>())
  const [suggestions, setSuggestions] = useState(new Map<string, AiTitleValue>())
  const [aiErrors, setAiErrors] = useState(new Map<string, string>())
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const loaded = useRef(false)
  const pending = useRef<Promise<boolean> | null>(null)
  const lock = useRef(false)
  const controller = useRef(new AbortController())
  const generation = useRef<AbortController | null>(null)
  const currentDialog = useRef<ManagementDialog | null>(null)
  const serial = useRef(0)
  useEffect(() => {
    const lifetime = new AbortController()
    controller.current = lifetime
    return () => {
      lifetime.abort()
      generation.current?.abort()
      currentDialog.current = null
    }
  }, [])

  function stopGeneration(): void {
    generation.current?.abort()
    generation.current = null
    setGenerating(false)
  }

  function closeDialog(): void {
    if (lock.current) return
    stopGeneration()
    currentDialog.current = null
    setDialog(null)
  }

  function clearSelection(): void {
    setSelection(emptySelection())
    setFailures([])
  }

  function deleted(session: TreeSession): void {
    if (!controller.current.signal.aborted)
      setSelection((current) => removeSelection(current, sessionKey(session.source, session.id)))
    onDeleted(session)
  }

  async function ensureMetadata(): Promise<boolean> {
    if (controller.current.signal.aborted) return false
    if (loaded.current) return true
    if (pending.current !== null) return pending.current
    if (managementApi.metadata === undefined) {
      setMetadataError(t("management.unavailable"))
      return false
    }
    const signal = controller.current.signal
    setMetadataLoading(true)
    setMetadataError("")
    pending.current = (async () => {
      try {
        const result = await managementApi.metadata!(signal)
        if (signal.aborted) return false
        if (!result.ok) {
          setMetadataError(failureText(result))
          return false
        }
        setMetadata((current) => {
          const next = new Map(
            result.value.entries.map((entry) => [sessionKey(entry.source, entry.id), { metadata: entry }]),
          )
          for (const [key, value] of current) next.set(key, value)
          return next
        })
        loaded.current = true
        return true
      } catch (error) {
        if (!signal.aborted) setMetadataError(error instanceof Error ? error.message : String(error))
        return false
      } finally {
        if (!signal.aborted) setMetadataLoading(false)
        pending.current = null
      }
    })()
    return pending.current
  }

  function toggleEditing(): void {
    if (lock.current) return
    setEditing(!editing)
    clearSelection()
    if (!editing) void ensureMetadata()
  }

  function newDialog(kind: ManagementDialog["kind"], sessions: readonly TreeSession[], ai = false, skipped = 0) {
    if (lock.current || controller.current.signal.aborted) return null
    stopGeneration()
    const target = { serial: ++serial.current, kind, sessions: [...sessions], ai, skipped }
    currentDialog.current = target
    setFailures([])
    setDrafts(new Map())
    setSuggestions(new Map())
    setAiErrors(new Map())
    setProgress({ done: 0, total: 0 })
    setDialog(target)
    void ensureMetadata()
    return target
  }

  async function openDialog(kind: ManagementDialog["kind"], sessions: readonly TreeSession[]): Promise<void> {
    if (sessions.length > 0) newDialog(kind, sessions)
  }

  async function generateTitles(sessions: readonly TreeSession[], target = currentDialog.current): Promise<void> {
    if (
      target === null ||
      currentDialog.current !== target ||
      controller.current.signal.aborted ||
      target.kind !== "rename" ||
      lock.current ||
      generation.current !== null ||
      sessions.length === 0
    )
      return
    if (!window.confirm(t("management.aiConfirm", { count: sessions.length }))) return
    const request = new AbortController()
    generation.current = request
    setGenerating(true)
    setProgress({ done: 0, total: sessions.length })
    const valid = () =>
      !request.signal.aborted && !controller.current.signal.aborted && currentDialog.current === target
    try {
      for (const session of sessions) {
        if (!valid()) break
        const key = sessionKey(session.source, session.id)
        setAiErrors((current) => {
          const next = new Map(current)
          next.delete(key)
          return next
        })
        try {
          if (managementApi.suggestTitle === undefined) throw new Error(t("management.aiUnavailable"))
          // One model request at a time keeps this user-confirmed batch's cost predictable.
          // eslint-disable-next-line no-await-in-loop
          const result = await managementApi.suggestTitle(session.source, session.id, request.signal)
          if (!valid()) break
          if (!result.ok) throw new Error(failureText(result))
          setSuggestions((current) => new Map(current).set(key, result.value))
          setDrafts((current) => new Map(current).set(key, result.value.title))
        } catch (error) {
          if (!valid()) break
          setAiErrors((current) => new Map(current).set(key, error instanceof Error ? error.message : String(error)))
        }
        if (valid()) setProgress((current) => ({ ...current, done: current.done + 1 }))
      }
    } finally {
      if (generation.current === request) {
        generation.current = null
        if (!controller.current.signal.aborted) setGenerating(false)
      }
    }
  }

  async function openAiDialog(sessions: readonly TreeSession[], skipNamed = true): Promise<void> {
    if (sessions.length === 0) return
    const eligible = sessions.filter(
      (session) => !skipNamed || (session as TreeSession & { named?: boolean }).named !== true,
    )
    const target = newDialog("rename", eligible, true, sessions.length - eligible.length)
    if (target !== null) await generateTitles(eligible, target)
  }

  function editDraft(key: string, title: string | null): void {
    setDrafts((current) => new Map(current).set(key, title))
  }

  async function deleteSessions(sessions: readonly TreeSession[]): Promise<void> {
    if (
      lock.current ||
      controller.current.signal.aborted ||
      sessions.length === 0 ||
      !window.confirm(t("management.deleteConfirm", { count: sessions.length }))
    )
      return
    stopGeneration()
    const signal = controller.current.signal
    lock.current = true
    setBusy(true)
    setFailures([])
    try {
      const failed = await runSessionBatch(
        sessions,
        (session) => api.deleteSession(session.source, session.id),
        deleted,
        signal,
      )
      if (!signal.aborted) setFailures(failed)
    } finally {
      if (!signal.aborted) setBusy(false)
      lock.current = false
    }
  }

  async function save(names: ReadonlyMap<string, string | null>, group: string | null): Promise<void> {
    const target = currentDialog.current
    if (
      lock.current ||
      generation.current !== null ||
      target === null ||
      managementApi.updateMetadata === undefined ||
      controller.current.signal.aborted
    )
      return
    const sessions =
      target.kind === "rename"
        ? target.sessions.filter((session) => names.has(sessionKey(session.source, session.id)))
        : target.sessions
    if (sessions.length === 0) return
    const signal = controller.current.signal
    lock.current = true
    setBusy(true)
    setFailures([])
    try {
      const failed = await runSessionBatch(
        sessions,
        (session) =>
          managementApi.updateMetadata!({
            source: session.source,
            id: session.id,
            ...(target.kind === "rename" ? { title: names.get(sessionKey(session.source, session.id))! } : { group }),
          }),
        (session, value) => {
          if (!signal.aborted)
            setMetadata((current) => new Map(current).set(sessionKey(session.source, session.id), value))
          onMetadataChanged?.(value)
        },
        signal,
      )
      if (signal.aborted) return
      setFailures(failed)
      const failedKeys = new Set(failed.map(({ session }) => sessionKey(session.source, session.id)))
      const remaining = target.sessions.filter(
        (session) =>
          (!names.has(sessionKey(session.source, session.id)) && target.kind === "rename") ||
          failedKeys.has(sessionKey(session.source, session.id)),
      )
      const next = remaining.length === 0 ? null : { ...target, sessions: remaining }
      currentDialog.current = next
      setDialog(next)
    } finally {
      if (!signal.aborted) setBusy(false)
      lock.current = false
    }
  }

  const groups = [
    ...new Set([...metadata.values()].flatMap((value) => (value.metadata.group ? [value.metadata.group] : []))),
  ].sort()
  return {
    editing,
    selection,
    setSelection,
    clearSelection,
    toggleEditing,
    metadata,
    metadataError,
    metadataLoading,
    ensureMetadata,
    groups,
    groupFilter,
    setGroupFilter: (value: string) => {
      setGroupFilter(value)
      clearSelection()
    },
    dialog,
    openDialog,
    openAiDialog,
    closeDialog,
    busy,
    failures,
    deleteSessions,
    deleted,
    save,
    drafts,
    editDraft,
    suggestions,
    aiErrors,
    generating,
    progress,
    generateTitles,
    stopGeneration,
  }
}

export type SessionManagementState = ReturnType<typeof useSessionManagement>
