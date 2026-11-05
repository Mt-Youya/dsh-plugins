/**
 * The panel shell's root box, as an inline style.
 *
 * The stylesheet is compiled inside `@scope (.ci-panel)`, and a scoped selector
 * only matches the root's descendants — so no class on the root element itself
 * ever applies (which is why an earlier `h-full` there seemed to do nothing).
 * The root fills the Host's main slot, a flex column with a definite height, the
 * same contract the task board and dsh-context panels rely on; it never sets a
 * pixel height of its own, and the inner columns scroll instead of the page.
 * `position: relative` is the containing block for the settings overlay.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/client/ui/panel-style
 */

export const PANEL_ROOT_STYLE = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  flex: "1 1 auto",
  inlineSize: "100%",
  blockSize: "100%",
  minBlockSize: 0,
  minInlineSize: 0,
  overflow: "hidden",
  position: "relative",
  containerType: "inline-size",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
  fontSize: "12.5px",
  lineHeight: 1.55,
} as const
