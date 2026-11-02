import { describe, expect, it, vi } from "vitest"

import type { Api, ApiResult } from "../src/client/api.ts"
import { applySessionMetadata, PAGE_SIZE, readTurnPrefix, sameSession } from "../src/client/state/use-session-detail.ts"
import type { TurnPrefix } from "../src/client/state/use-session-detail.ts"
import type { InsightSessionDetail, Turn } from "../src/protocol.ts"

const ref = { source: "codex", id: "session" } as const
function turn(index: number): Turn {
  return { index } as Turn
}
function page(turns: Turn[]): ApiResult<InsightSessionDetail> {
  return { ok: true, value: { session: { ...ref, turns }, turnCount: 500 } as InsightSessionDetail }
}
function prefix(turns: Turn[] = [], offset = turns.length, total = 500): TurnPrefix {
  return { turns, offset, total }
}

function pagingApi(session: Api["session"]): Api {
  return { session } as Api
}

describe("panel metadata overlay", () => {
  it("renames only the source:id and explicitly deletes a restored title", () => {
    const original = { ...ref, title: "old" }
    const value = { metadata: ref, displayTitle: "new" }
    expect(applySessionMetadata(original, value)).toEqual({ ...ref, title: "new" })
    expect(original.title).toBe("old")
    expect(applySessionMetadata(original, { metadata: ref })).not.toHaveProperty("title")
    expect(applySessionMetadata(original, { metadata: { ...ref, source: "claude" }, displayTitle: "other" })).toBe(
      original,
    )
    expect(applySessionMetadata(original, undefined)).toBe(original)
  })

  it("uses the latest overlay when a delayed first page resolves", async () => {
    let latest = { metadata: ref, displayTitle: "first rename" } as { metadata: typeof ref; displayTitle?: string }
    let resolve!: (value: { title: string } & typeof ref) => void
    const pending = new Promise<{ title: string } & typeof ref>((done) => {
      resolve = done
    })
    const loaded = pending.then((session) => applySessionMetadata(session, latest))
    latest = { metadata: ref }
    resolve({ ...ref, title: "stale host title" })
    expect(await loaded).not.toHaveProperty("title")
    expect(sameSession(ref, { ...ref, source: "claude" })).toBe(false)
  })
})

describe("continuous turn prefix", () => {
  it("finds a far non-consecutive index across capped pages and continues from the source offset", async () => {
    const all = Array.from({ length: 500 }, (_, index) => turn(index * 3 + 7))
    const session = vi.fn<Api["session"]>(async (_id, offset, limit) => page(all.slice(offset, offset + limit)))
    let loaded = prefix(all.slice(0, PAGE_SIZE))
    const publish = (next: TurnPrefix): void => {
      loaded = next
    }
    const controller = new AbortController()
    await readTurnPrefix(pagingApi(session), ref, loaded, controller.signal, () => true, publish, all[350]!.index)
    expect(session.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      [40, 200],
      [240, 200],
    ])
    expect(loaded.offset).toBe(440)
    expect(loaded.turns).toEqual(all.slice(0, 440))
    await readTurnPrefix(pagingApi(session), ref, loaded, controller.signal, () => true, publish)
    expect(session.mock.calls[2]!.slice(1, 3)).toEqual([440, 40])
    expect(loaded.turns).toEqual(all.slice(0, 480))
  })

  it("does not fetch for an already loaded target", async () => {
    const session = vi.fn<Api["session"]>()
    await readTurnPrefix(
      pagingApi(session),
      ref,
      prefix([turn(900)]),
      new AbortController().signal,
      () => true,
      vi.fn(),
      900,
    )
    expect(session).not.toHaveBeenCalled()
  })

  it("deduplicates and sorts without deriving the next offset from unique turns", async () => {
    const session = vi.fn<Api["session"]>().mockResolvedValueOnce(page([turn(30), turn(10), turn(50)]))
    let loaded = prefix([turn(10)], 1, 4)
    await readTurnPrefix(
      pagingApi(session),
      ref,
      loaded,
      new AbortController().signal,
      () => true,
      (next) => {
        loaded = next
      },
    )
    expect(loaded.turns.map((entry) => entry.index)).toEqual([10, 30, 50])
    expect(loaded.offset).toBe(4)
  })

  it.each(["abort", "identity"])("does not publish a late page after %s changes", async (reason) => {
    let resolve!: (result: ApiResult<InsightSessionDetail>) => void
    const session = vi.fn<Api["session"]>(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const controller = new AbortController()
    let current = true
    const publish = vi.fn()
    const request = readTurnPrefix(pagingApi(session), ref, prefix(), controller.signal, () => current, publish, 300)
    if (reason === "abort") controller.abort()
    else current = false
    resolve(page([turn(300)]))
    await request
    expect(publish).not.toHaveBeenCalled()
    expect(session).toHaveBeenCalledTimes(1)
  })

  it("stops on failure or an empty page without looping or losing the prefix", async () => {
    const failure = { ok: false, error: "network" } as const
    const session = vi.fn<Api["session"]>().mockResolvedValueOnce(failure).mockResolvedValueOnce(page([]))
    const loaded = prefix([turn(1)])
    const publish = vi.fn()
    expect(
      await readTurnPrefix(pagingApi(session), ref, loaded, new AbortController().signal, () => true, publish, 999),
    ).toEqual(failure)
    await readTurnPrefix(pagingApi(session), ref, loaded, new AbortController().signal, () => true, publish, 999)
    expect(publish).not.toHaveBeenCalled()
    expect(session).toHaveBeenCalledTimes(2)
    expect(loaded.turns).toEqual([turn(1)])
  })
})
