import { describe, expect, it } from "vitest"

import type { ApiResult } from "../src/client/api.ts"
import type { TreeSession } from "../src/client/model/tree.ts"
import { applySessionMetadata, runSessionBatch } from "../src/client/state/management.ts"

const sessions: TreeSession[] = ["a", "b", "c"].map((id) => ({
  source: "claude",
  id,
  workdir: "/real/cwd",
  title: id,
  bytes: 1,
  updatedAt: 1,
}))

describe("serial session management", () => {
  it("publishes each successful deletion locally, retains reasons, and retries only failures", async () => {
    let active = 0
    let maximum = 0
    const events: string[] = []
    const failures = await runSessionBatch(
      sessions,
      async (session): Promise<ApiResult<string>> => {
        active += 1
        maximum = Math.max(maximum, active)
        events.push(`start:${session.id}`)
        await Promise.resolve()
        active -= 1
        return session.id === "b"
          ? { ok: false, error: "http", detail: "shared-session-logs" }
          : { ok: true, value: session.id }
      },
      (session) => events.push(`deleted:${session.id}`),
    )
    expect(maximum).toBe(1)
    expect(events).toEqual(["start:a", "deleted:a", "start:b", "start:c", "deleted:c"])
    expect(failures.map(({ session, reason }) => [session.id, reason])).toEqual([["b", "http: shared-session-logs"]])
    const retried: string[] = []
    expect(
      await runSessionBatch(
        failures.map((failure) => failure.session),
        async (session) => ({ ok: true, value: session.id }),
        (session) => retried.push(session.id),
      ),
    ).toEqual([])
    expect(retried).toEqual(["b"])
  })

  it("does not stop the batch on a rejected write", async () => {
    const updated: string[] = []
    const failures = await runSessionBatch(
      sessions,
      async (session) => {
        if (session.id === "b") throw new Error("offline")
        return { ok: true, value: session.id }
      },
      (session) => updated.push(session.id),
    )
    expect(updated).toEqual(["a", "c"])
    expect(failures[0]?.reason).toBe("offline")
  })
})

describe("local metadata projection", () => {
  const loaded = new Map([["/real/cwd", sessions]])
  it("updates only the relevant title and preserves actual cwd and unrelated row identity", () => {
    const metadata = new Map([
      ["claude:a", { metadata: { source: "claude" as const, id: "a", title: "New title", group: "Research" } }],
    ])
    const projected = applySessionMetadata(loaded, metadata, "").get("/real/cwd")!
    expect(projected[0]?.title).toBe("New title")
    expect(projected[0]).toMatchObject({ named: true })
    expect(projected[0]?.workdir).toBe("/real/cwd")
    expect(projected[1]).toBe(sessions[1])
    expect(sessions[0]?.title).toBe("a")
    expect(
      applySessionMetadata(loaded, metadata, "group:Research")
        .get("/real/cwd")
        ?.map((session) => session.id),
    ).toEqual(["a"])
    expect(
      applySessionMetadata(loaded, metadata, "ungrouped")
        .get("/real/cwd")
        ?.map((session) => session.id),
    ).toEqual(["b", "c"])
  })

  it("uses the host display title when restoring an original name or moving a group", () => {
    const metadata = new Map([
      ["claude:a", { metadata: { source: "claude" as const, id: "a" }, displayTitle: "Original" }],
    ])
    expect(applySessionMetadata(loaded, metadata, "").get("/real/cwd")?.[0]?.title).toBe("Original")
  })
})
