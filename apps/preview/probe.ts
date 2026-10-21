/**
 * Measurements the preview reports about itself (ticket 01).
 *
 * Kept in the preview app rather than in the smoke script: only the page can
 * ask the browser what it actually computed, and a plain headless dump of the
 * DOM cannot answer that.
 *
 * @module @cyrus/dsh-context-insight/preview/probe
 */

type Probe = {
  mounted: boolean
  rows: number
  rowBorder: string | null
  askFontSize: string | null
  chipDistinct: boolean | null
}

function measure(): Probe {
  const root = document.getElementById("root")
  const rows = document.querySelectorAll<HTMLElement>("[data-focus]")
  const first = rows[0]
  const ask = document.querySelector<HTMLElement>(".ci-ask__text")
  const chip = document.querySelector<HTMLElement>(".ci-src__word")
  const row = first
  const chipColor = chip === null ? null : getComputedStyle(chip).color
  const rowColor = row === undefined ? null : getComputedStyle(row).color
  return {
    mounted: (root?.childElementCount ?? 0) > 0,
    rows: rows.length,
    rowBorder: first === undefined ? null : getComputedStyle(first).borderTopWidth,
    askFontSize: ask === null ? null : getComputedStyle(ask).fontSize,
    chipDistinct: chipColor === null || rowColor === null ? null : chipColor !== rowColor,
  }
}

/**
 * Publish measurements on the document title once the panel has rendered rows.
 * @param timeoutMs - give up after this long and report what exists.
 */
export function reportProbe(timeoutMs = 6000): void {
  const started = Date.now()
  const tick = (): void => {
    const probe = measure()
    if (probe.rows > 0 || Date.now() - started > timeoutMs) {
      document.title = JSON.stringify(probe)
      return
    }
    setTimeout(tick, 100)
  }
  tick()
}
