/**
 * Stage the page for a documentation screenshot (`?shot=<scene>`).
 *
 * Headless Chrome can only photograph what is on screen, so the page arranges
 * itself: it waits for real data, performs the clicks or keystrokes the scene
 * needs, waits again for the answer, and only then sets `document.title` to
 * `shot:ready` (or `shot:failed:<why>`), which `scripts/screenshots.mjs`
 * waits for. Kept in the preview app, never shipped.
 *
 * @module @cyrus/dsh-sessions-insight/preview/shot
 */

/** Scenes the docs use; `tree` is the page as it opens. */
export type Scene = "tree" | "session" | "search"

/** Query typed into the palette for the search scene. */
const SEARCH_QUERY = "上下文"

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Poll until `probe` returns something truthy.
 * @param probe - the condition, re-evaluated every 100 ms.
 * @param what - name used in the failure title.
 * @param timeoutMs - give up after this long.
 * @returns the truthy value.
 */
async function until<T>(probe: () => T | null | undefined | false, what: string, timeoutMs = 20_000): Promise<T> {
  const started = Date.now()
  for (;;) {
    const value = probe()
    if (value) return value
    if (Date.now() - started > timeoutMs) throw new Error(what)
    await sleep(100)
  }
}

const panel = (): HTMLElement | null => document.querySelector<HTMLElement>(".ci-panel")

/** The open session's title, once its pane has rendered turn rows. */
function openSession(): string | undefined {
  const root = panel()
  const title = root?.querySelector("article h2")?.textContent ?? undefined
  return title !== undefined && root?.querySelector("[data-turn-row]") !== null ? title : undefined
}

/** Open the first DSH session in the tree and wait for its turns. */
async function stageSession(): Promise<void> {
  const before = await until(openSession, "first session never rendered")
  const row = await until(
    () => panel()?.querySelector<HTMLButtonElement>('button.ci-row[data-key^="dsh:"]'),
    "no DSH session in the tree"
  )
  row.click()
  await until(() => {
    const now = openSession()
    return now !== undefined && now !== before && row.dataset["selected"] === "true"
  }, "DSH session never opened")
}

/** Open the ⌘K palette, type the query, wait for hits. */
async function stageSearch(): Promise<void> {
  await until(openSession, "first session never rendered")
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))
  // Scoped to the dialog: the project filter is an input[type=search] too.
  const input = await until(
    () => document.querySelector<HTMLInputElement>('[role="dialog"] input[type="search"]'),
    "palette never opened"
  )
  // React tracks the value through the native setter; assigning `.value`
  // directly would be invisible to its onChange.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, SEARCH_QUERY)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  await until(
    () => document.querySelectorAll('[role="dialog"] [role="listbox"] li').length >= 3,
    "search found fewer than 3 hits"
  )
}

/**
 * Run one scene and report through the document title.
 * @param scene - which arrangement to stage.
 */
export function stageShot(scene: string): void {
  const run = async (): Promise<void> => {
    if (scene === "session") await stageSession()
    else if (scene === "search") await stageSearch()
    else await until(openSession, "first session never rendered")
    // Let transitions and the chart settle before the camera fires.
    await sleep(600)
  }
  run().then(
    () => {
      document.title = "shot:ready"
    },
    (error: unknown) => {
      document.title = "shot:failed:" + (error instanceof Error ? error.message : String(error))
    }
  )
}
