import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import { MAX_TURN_LIMIT } from "../../protocol.ts"
import type { ContextSource, CostValue, SessionMetadataValue, Turn } from "../../protocol.ts"
import type { Api, ApiFailure } from "../api.ts"
import type { LoadedSession } from "../ui/session-pane.tsx"

export const PAGE_SIZE = 40
export interface SessionRef {
  source: ContextSource
  id: string
  workdir?: string
}
export type DetailState =
  | { kind: "idle" }
  | { kind: "loading"; ref: SessionRef }
  | { kind: "failed"; ref: SessionRef; failure: ApiFailure }
  | ({ kind: "ready"; ref: SessionRef } & LoadedSession)

export function sameSession(a: SessionRef | null, b: SessionRef | null): boolean {
  return a?.source === b?.source && a?.id === b?.id
}
export function applySessionMetadata<T extends SessionRef & { title?: string }>(
  session: T,
  value: SessionMetadataValue | undefined,
): T {
  if (value === undefined || !sameSession(session, value.metadata)) return session
  const next = { ...session }
  if (value.displayTitle === undefined) delete next.title
  else next.title = value.displayTitle
  return next
}
export interface TurnPrefix {
  turns: Turn[]
  offset: number
  total: number
}
export async function readTurnPrefix(
  api: Api,
  ref: SessionRef,
  prefix: TurnPrefix,
  signal: AbortSignal,
  current: () => boolean,
  publish: (prefix: TurnPrefix) => void,
  target?: number,
): Promise<ApiFailure | undefined> {
  while (current() && !signal.aborted && prefix.offset < prefix.total) {
    if (target !== undefined && prefix.turns.some((turn) => turn.index === target)) break
    // oxlint-disable-next-line no-await-in-loop
    const result = await api.session(
      ref.id,
      prefix.offset,
      target === undefined ? PAGE_SIZE : MAX_TURN_LIMIT,
      ref.source,
      signal,
    )
    if (!current() || signal.aborted) return undefined
    if (!result.ok) return result
    const page = result.value.session.turns
    if (page.length === 0) break
    const turns = new Map(prefix.turns.map((turn) => [turn.index, turn]))
    for (const turn of page) if (!turns.has(turn.index)) turns.set(turn.index, turn)
    prefix = {
      turns: [...turns.values()].toSorted((a, b) => a.index - b.index),
      offset: prefix.offset + page.length,
      total: prefix.total,
    }
    publish(prefix)
    if (target === undefined) break
  }
  return undefined
}
interface Reading {
  ref: SessionRef
  controller: AbortController
  ready: boolean
  prefix: TurnPrefix
  paging?: Promise<void>
}

export function useSessionDetail(api: Api, selected: SessionRef | null) {
  const [detail, setDetail] = useState<DetailState>({ kind: "idle" })
  const [cost, setCost] = useState<CostValue | null>(null)
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null)
  const [toolsExpanded, setToolsExpanded] = useState(false)
  const reading = useRef<Reading | null>(null)
  const identity = useRef(selected)
  const metadata = useRef(new Map<string, SessionMetadataValue>())
  const jumpGeneration = useRef(0)
  const source = selected?.source
  const id = selected?.id
  useLayoutEffect(() => {
    identity.current = selected
    if (!sameSession(reading.current?.ref ?? null, selected)) reading.current?.controller.abort()
  }, [selected])
  const overlaySession = useCallback(
    <T extends SessionRef & { title?: string }>(session: T): T =>
      applySessionMetadata(session, metadata.current.get(`${session.source}:${session.id}`)),
    [],
  )
  const overlay = useCallback(
    <T extends LoadedSession["data"]>(data: T): T => {
      const session = overlaySession(data.session)
      return session === data.session ? data : { ...data, session }
    },
    [overlaySession],
  )
  useEffect(() => {
    setCost(null)
    setSelectedTurn(null)
    setToolsExpanded(false)
    if (source === undefined || id === undefined) {
      reading.current = null
      setDetail({ kind: "idle" })
      return
    }
    const ref = { source, id }
    const controller = new AbortController()
    const active: Reading = { ref, controller, ready: false, prefix: { turns: [], offset: 0, total: 0 } }
    reading.current = active
    const current = (): boolean => reading.current === active && sameSession(identity.current, ref)
    setDetail({ kind: "loading", ref })
    void api.cost(source, id, controller.signal).then((result) => {
      if (!controller.signal.aborted && current()) setCost(result.ok ? result.value : null)
    })
    void api.session(id, 0, PAGE_SIZE, source, controller.signal).then((result) => {
      if (controller.signal.aborted || !current()) return
      if (!result.ok) {
        setDetail({ kind: "failed", ref, failure: result })
        return
      }
      const turns = result.value.session.turns
      active.ready = true
      active.prefix = { turns, offset: turns.length, total: result.value.turnCount }
      setDetail({ kind: "ready", ref, data: overlay(result.value), turns, loadingMore: false })
      setSelectedTurn(turns.find((turn) => turn.attribution.residual !== undefined)?.index ?? turns[0]?.index ?? null)
    })
    return () => controller.abort()
  }, [api, source, id, overlay])
  const page = useCallback(
    async (target?: number): Promise<void> => {
      const active = reading.current
      if (active === null || !active.ready) return
      const current = (): boolean =>
        reading.current === active && !active.controller.signal.aborted && sameSession(identity.current, active.ref)
      if (!current()) return
      while (active.paging !== undefined) {
        // oxlint-disable-next-line no-await-in-loop
        await active.paging
        if (!current() || target === undefined) return
      }
      if (target !== undefined && active.prefix.turns.some((turn) => turn.index === target)) return
      const update = (failure?: ApiFailure, loadingMore = false): void => {
        if (!current()) return
        setDetail((previous) => {
          if (!current() || previous.kind !== "ready" || !sameSession(previous.ref, active.ref)) return previous
          const next = { ...previous, data: overlay(previous.data), turns: active.prefix.turns, loadingMore }
          delete next.moreFailure
          if (failure !== undefined) next.moreFailure = failure
          return next
        })
      }
      update(undefined, true)
      const request = readTurnPrefix(
        api,
        active.ref,
        active.prefix,
        active.controller.signal,
        current,
        (prefix) => {
          active.prefix = prefix
          update(undefined, true)
        },
        target,
      ).then((failure) => {
        update(failure)
      })
      active.paging = request
      await request
      if (active.paging === request) delete active.paging
    },
    [api, overlay],
  )
  const loadMore = useCallback(() => {
    void page()
  }, [page])
  const jumpTurn = useCallback(
    async (index: number): Promise<void> => {
      const generation = ++jumpGeneration.current
      const active = reading.current
      await page(index)
      if (
        generation !== jumpGeneration.current ||
        active === null ||
        reading.current !== active ||
        active.controller.signal.aborted ||
        !sameSession(identity.current, active.ref)
      )
        return
      if (active.prefix.turns.some((turn) => turn.index === index)) setSelectedTurn(index)
    },
    [page],
  )
  const onMetadataChanged = useCallback(
    (value: SessionMetadataValue): void => {
      const ref = value.metadata
      metadata.current.set(`${ref.source}:${ref.id}`, value)
      setDetail((previous) =>
        previous.kind !== "ready" || !sameSession(previous.ref, ref)
          ? previous
          : { ...previous, data: overlay(previous.data) },
      )
    },
    [overlay],
  )
  return {
    detail,
    cost,
    selectedTurn,
    setSelectedTurn,
    toolsExpanded,
    setToolsExpanded,
    loadMore,
    jumpTurn,
    onMetadataChanged,
    overlaySession,
  }
}
