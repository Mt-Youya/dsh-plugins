import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Api, ApiResult } from "../src/client/api.ts"
import { MANAGEMENT_EN, MANAGEMENT_ZH } from "../src/client/management-labels.ts"
import type { ManagementApi } from "../src/client/state/management.ts"
import type { TreeSession } from "../src/client/state/tree.ts"
import { useSessionManagement } from "../src/client/state/use-session-management.ts"
import type { AiTitleValue } from "../src/protocol/ai-title.ts"

// A small hook harness keeps these lifecycle tests independent of browser/DOM dependencies.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], index: 0, cleanups: [] as (() => void)[] }))
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const index = hooks.index++
    if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? initial() : initial
    return [
      hooks.slots[index],
      (next: unknown) => {
        hooks.slots[index] = typeof next === "function" ? next(hooks.slots[index]) : next
      },
    ]
  },
  useRef: (initial: unknown) => {
    const index = hooks.index++
    if (!(index in hooks.slots)) hooks.slots[index] = { current: initial }
    return hooks.slots[index]
  },
  useEffect: (effect: () => () => void) => {
    const index = hooks.index++
    if (!(index in hooks.slots)) {
      hooks.slots[index] = true
      hooks.cleanups.push(effect())
    }
  },
}))
vi.mock("../src/client/locale.ts", () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    const text = (MANAGEMENT_EN as Record<string, string>)[key] ?? key
    return text.replace(/\{(\w+)\}/g, (whole, name: string) => String(params?.[name] ?? whole))
  },
}))

const sessions: TreeSession[] = ["a", "b", "c"].map((id) => ({
  source: "claude",
  id,
  workdir: "/cwd",
  title: id,
  bytes: 1,
  updatedAt: 1,
}))
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function suggestion(id: string): ApiResult<AiTitleValue> {
  return {
    ok: true,
    value: { source: "claude", id, title: `AI ${id}`, provider: "test-provider", model: "test-model" },
  }
}
function setup() {
  const api = {
    metadata: vi.fn(async () => ({ ok: true, value: { entries: [] } })),
    updateMetadata: vi.fn(async (patch) => ({ ok: true, value: { metadata: patch } })),
    suggestTitle: vi.fn(async (_source: string, id: string, _signal?: AbortSignal) => suggestion(id)),
    deleteSession: vi.fn(async () => ({ ok: true, value: {} })),
  }
  const deleted = vi.fn()
  const changed = vi.fn()
  function render() {
    hooks.index = 0
    return useSessionManagement(api as unknown as Api & ManagementApi, deleted, changed)
  }
  return { api, deleted, changed, render }
}
function unmount() {
  for (const cleanup of hooks.cleanups) cleanup()
}

beforeEach(() => {
  hooks.slots = []
  hooks.index = 0
  hooks.cleanups = []
  vi.stubGlobal("window", { confirm: vi.fn(() => true) })
})
afterEach(() => {
  unmount()
  vi.unstubAllGlobals()
})

describe("AI management drafts", () => {
  it("confirms cost once, skips explicitly named rows, and never saves automatically", async () => {
    const { api, render } = setup()
    const named = { ...sessions[0]!, named: true }
    await render().openAiDialog([named, sessions[1]!])
    const state = render()
    expect(window.confirm).toHaveBeenCalledOnce()
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("incur charges"))
    expect(api.suggestTitle).toHaveBeenCalledTimes(1)
    expect(state.dialog?.skipped).toBe(1)
    expect(state.drafts.get("claude:b")).toBe("AI b")
    expect(state.suggestions.get("claude:b")?.model).toBe("test-model")
    expect(api.updateMetadata).not.toHaveBeenCalled()
  })

  it("counts an all-named selection without confirmation or requests", async () => {
    const { api, render } = setup()
    await render().openAiDialog(sessions.map((session) => ({ ...session, named: true })))
    expect(render().dialog?.skipped).toBe(3)
    expect(render().dialog?.sessions).toEqual([])
    expect(window.confirm).not.toHaveBeenCalled()
    expect(api.suggestTitle).not.toHaveBeenCalled()
    await render().save(new Map(), null)
    expect(api.updateMetadata).not.toHaveBeenCalled()
  })

  it("allows explicit single-row regeneration and declined confirmation sends nothing", async () => {
    const { api, render } = setup()
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    await render().openAiDialog(sessions)
    expect(api.suggestTitle).not.toHaveBeenCalled()
    expect(render().drafts.size).toBe(0)
    const named = { ...sessions[0]!, named: true }
    await render().openAiDialog([named], false)
    expect(api.suggestTitle).toHaveBeenCalledTimes(1)
  })

  it("runs sequentially and saves only successful or explicitly edited drafts after partial failure", async () => {
    const { api, render } = setup()
    const first = deferred<ApiResult<AiTitleValue>>()
    api.suggestTitle.mockImplementationOnce(() => first.promise)
    api.suggestTitle.mockResolvedValueOnce({ ok: false, error: "http", detail: "offline" })
    const task = render().openAiDialog(sessions)
    expect(api.suggestTitle).toHaveBeenCalledTimes(1)
    expect(render().progress).toEqual({ done: 0, total: 3 })
    first.resolve(suggestion("a"))
    await task
    expect(render().progress).toEqual({ done: 3, total: 3 })
    expect(render().aiErrors.get("claude:b")).toContain("offline")
    expect(render().drafts.has("claude:b")).toBe(false)
    await render().save(render().drafts, null)
    expect(api.updateMetadata.mock.calls.map(([patch]) => patch.id)).toEqual(["a", "c"])
    expect(render().dialog?.sessions.map((session) => session.id)).toEqual(["b"])
    render().editDraft("claude:b", "Manual name")
    await render().save(render().drafts, null)
    expect(api.updateMetadata.mock.calls.at(-1)?.[0].title).toBe("Manual name")
    expect(render().dialog).toBeNull()
  })

  it("retries an individual failure without discarding successful drafts", async () => {
    const { api, render } = setup()
    api.suggestTitle.mockResolvedValueOnce({ ok: false, error: "http", detail: "offline" })
    await render().openAiDialog(sessions.slice(0, 2))
    await render().generateTitles([sessions[0]!])
    expect(render().drafts.get("claude:a")).toBe("AI a")
    expect(render().drafts.get("claude:b")).toBe("AI b")
    expect(render().aiErrors.size).toBe(0)
    expect(window.confirm).toHaveBeenCalledTimes(2)
  })

  it("stops generation, aborts the active request and ignores its late result", async () => {
    const { api, render } = setup()
    const first = deferred<ApiResult<AiTitleValue>>()
    api.suggestTitle.mockImplementationOnce(() => first.promise)
    const task = render().openAiDialog(sessions)
    const signal = api.suggestTitle.mock.calls[0]![2]!
    await render().save(new Map([["claude:a", "Unsafe"]]), null)
    expect(api.updateMetadata).not.toHaveBeenCalled()
    render().stopGeneration()
    expect(signal.aborted).toBe(true)
    first.resolve(suggestion("a"))
    await task
    expect(render().drafts.size).toBe(0)
    expect(api.suggestTitle).toHaveBeenCalledTimes(1)
    expect(render().generating).toBe(false)
  })

  it("closing and opening another dialog prevents an old result overwriting its draft", async () => {
    const { api, render } = setup()
    const first = deferred<ApiResult<AiTitleValue>>()
    api.suggestTitle.mockImplementationOnce(() => first.promise)
    const task = render().openAiDialog([sessions[0]!])
    const oldSerial = render().dialog!.serial
    render().closeDialog()
    await render().openAiDialog([sessions[1]!])
    first.resolve(suggestion("a"))
    await task
    expect(render().dialog!.serial).not.toBe(oldSerial)
    expect([...render().drafts]).toEqual([["claude:b", "AI b"]])
    expect(render().generating).toBe(false)
  })

  it("unmount aborts AI and prevents further queued generation", async () => {
    const { api, render } = setup()
    const first = deferred<ApiResult<AiTitleValue>>()
    api.suggestTitle.mockImplementationOnce(() => first.promise)
    const task = render().openAiDialog(sessions)
    unmount()
    expect(api.suggestTitle.mock.calls[0]![2]!.aborted).toBe(true)
    first.resolve(suggestion("a"))
    await task
    expect(api.suggestTitle).toHaveBeenCalledTimes(1)
    expect(render().drafts.size).toBe(0)
  })
})

describe("mutation lifecycle", () => {
  it("locks dialog closure during metadata saves and publishes sent writes after unmount", async () => {
    const { api, render, changed } = setup()
    const first = deferred<Awaited<ReturnType<typeof api.updateMetadata>>>()
    api.updateMetadata.mockImplementationOnce(() => first.promise)
    await render().openDialog("rename", sessions)
    const target = render().dialog
    const task = render().save(new Map(sessions.map((session) => [`claude:${session.id}`, `New ${session.id}`])), null)
    render().closeDialog()
    expect(render().dialog).toBe(target)
    unmount()
    first.resolve({ ok: true, value: { metadata: { source: "claude", id: "a", title: "New a" } } })
    await task
    expect(changed).toHaveBeenCalledOnce()
    expect(api.updateMetadata).toHaveBeenCalledTimes(1)
  })

  it("publishes a sent deletion after unmount without continuing the batch", async () => {
    const { api, render, deleted } = setup()
    const first = deferred<Awaited<ReturnType<typeof api.deleteSession>>>()
    api.deleteSession.mockImplementationOnce(() => first.promise)
    const task = render().deleteSessions(sessions)
    unmount()
    first.resolve({ ok: true, value: {} })
    await task
    expect(deleted).toHaveBeenCalledWith(sessions[0])
    expect(api.deleteSession).toHaveBeenCalledTimes(1)
  })

  it("never publishes a failed mutation as success", async () => {
    const { api, render, deleted } = setup()
    api.deleteSession.mockRejectedValueOnce(new Error("offline"))
    await render().deleteSessions([sessions[0]!])
    expect(deleted).not.toHaveBeenCalled()
    expect(render().failures[0]?.reason).toBe("offline")
  })
})

it("AI labels have matching language keys and explicit privacy/cost wording", () => {
  expect(Object.keys(MANAGEMENT_EN).toSorted()).toEqual(Object.keys(MANAGEMENT_ZH).toSorted())
  expect(MANAGEMENT_ZH["management.aiConfirm"]).toContain("少量用户输入")
  expect(MANAGEMENT_ZH["management.aiConfirm"]).toContain("当前默认模型")
  expect(MANAGEMENT_ZH["management.aiConfirm"]).toContain("费用")
})
