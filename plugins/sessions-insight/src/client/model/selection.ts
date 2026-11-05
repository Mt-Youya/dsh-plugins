import { sessionKey, type TreeRow, type TreeSession } from "./tree.ts"

export interface SessionSelection {
  keys: ReadonlySet<string>
  anchor: string | null
}

export function emptySelection(): SessionSelection {
  return { keys: new Set(), anchor: null }
}

/** Only painted session rows participate in Shift ranges and select-visible. */
export function visibleSessions(rows: readonly TreeRow[]): TreeSession[] {
  return rows.flatMap((row) => (row.kind === "session" ? [row.session] : []))
}

export function toggleSelection(
  current: SessionSelection,
  key: string,
  visible: readonly TreeSession[],
  shift = false,
): SessionSelection {
  const order = visible.map((session) => sessionKey(session.source, session.id))
  const end = order.indexOf(key)
  if (end < 0) return current
  const start = current.anchor === null ? -1 : order.indexOf(current.anchor)
  const keys = new Set(current.keys)
  if (shift && start >= 0) {
    const range = order.slice(Math.min(start, end), Math.max(start, end) + 1)
    for (const item of range) {
      if (current.keys.has(key)) keys.delete(item)
      else keys.add(item)
    }
    return { keys, anchor: current.anchor }
  }
  if (keys.has(key)) keys.delete(key)
  else keys.add(key)
  return { keys, anchor: key }
}

/** Add an explicitly labelled scope; never infer hidden rows from visible ones. */
export function selectSessions(current: SessionSelection, sessions: readonly TreeSession[]): SessionSelection {
  const keys = new Set(current.keys)
  for (const session of sessions) keys.add(sessionKey(session.source, session.id))
  return { keys, anchor: null }
}

export function removeSelection(current: SessionSelection, key: string): SessionSelection {
  const keys = new Set(current.keys)
  keys.delete(key)
  return { keys, anchor: current.anchor === key ? null : current.anchor }
}

export function selectedSessions(
  selection: SessionSelection,
  sessions: ReadonlyMap<string, readonly TreeSession[]>,
): TreeSession[] {
  const unique = new Map<string, TreeSession>()
  for (const list of sessions.values())
    for (const session of list) {
      const key = sessionKey(session.source, session.id)
      if (selection.keys.has(key)) unique.set(key, session)
    }
  return [...unique.values()]
}
