/**
 * How a session names itself in the panel.
 *
 * Two rules: a raw identifier is never a title (the Host already drops
 * id-shaped titles, and this is the second line), and an untitled session still
 * has to be distinguishable from its neighbours — so it is labelled 未命名会话
 * and carries the first human input instead of a uuid.
 *
 * @module @cyrus/dsh-sessions-insight/client/labels
 */

import { clip } from "./format.ts"
import { t } from "./locale.ts"

/** The two lines a session row prints for its identity. */
export interface SessionLabel {
  /** Main line: the real title, or 未命名会话. */
  title: string
  /** Second line: the first human input, when there is no real title. */
  detail?: string
}

/** Longest first-input excerpt a row shows. */
export const FIRST_INPUT_CHARS = 60

/**
 * Compose a session's label from its metadata.
 * @param row - a list row, a search hit, or a session header.
 * @returns the label lines.
 */
export function sessionLabel(row: { title?: string; firstInput?: string }): SessionLabel {
  const title = row.title?.trim()
  if (title !== undefined && title !== "") return { title }
  const first = row.firstInput?.trim()
  if (first !== undefined && first !== "") {
    return { title: t("session.untitled"), detail: clip(first, FIRST_INPUT_CHARS) }
  }
  return { title: t("session.untitled") }
}
