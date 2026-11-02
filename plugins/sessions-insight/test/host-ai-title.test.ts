import type { Session } from "@cyrusdoyle/dsh-session-contract"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AI_TITLE_INPUT_BYTES,
  AI_TITLE_TIMEOUT_MS,
  AiTitleGenerator,
  type AiTitleHost,
  aiTitleInput,
  type LlmTitleOptions,
} from "../src/host/management/ai-title.ts"
import {
  isAiTitleRequest,
  isAiTitleValue,
  SESSION_AI_TITLE_PATH,
  SESSION_AI_TITLE_URL,
} from "../src/protocol/ai-title.ts"

// Production imports Node timers because the Host VM has no timer globals.
vi.mock("node:timers", () => ({
  setTimeout: (callback: () => void, delay: number) => globalThis.setTimeout(callback, delay),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer),
}))

const ref = { source: "claude", id: "session-1" } as const
function session(inputs = ["Fix the cache"]): Session {
  return {
    ...ref,
    workdir: "/work",
    createdAt: 1,
    updatedAt: 2,
    segments: [],
    dataQuality: [],
    turns: inputs.map((text, index) => ({
      index,
      startedAt: index,
      userInput: [text],
      assistantText: ["SECRET OUTPUT"],
      toolCalls: [],
      compactions: [],
      subagents: [],
      attribution: { total: { tokens: 0, precision: "exact", basis: "usage" }, parts: [] },
    })),
  }
}
const text = (value: string) => ({ type: "text-delta", index: 0, text: value })
const finish = (kind = "stop") => ({ type: "finish", reason: { kind } })
function fixture(chunks: unknown[] = [text("Cache repair"), finish()]) {
  const stream = vi.fn(function (options: LlmTitleOptions) {
    void options
    return (async function* () {
      yield* chunks
    })()
  })
  const prepareCall: AiTitleHost["llm"]["prepareCall"] = vi.fn(async (config, signal, configure) => {
    signal.throwIfAborted()
    const { provider, model, ...controls } = config
    return {
      config: Object.freeze({
        ...configure(controls, { reasoning: { efforts: [{ id: "minimum" }] } }),
        provider,
        model,
      }),
      stream,
    }
  })
  const host: AiTitleHost = {
    llm: { prepareCall },
    agentDefaultModel: {
      currentSelection: vi.fn(() => ({ provider: "configured", model: "current", reasoningEffort: "high" })),
    },
  }
  return { host, stream, generator: new AiTitleGenerator(() => host) }
}

afterEach(() => vi.useRealTimers())

describe("AI title protocol", () => {
  it("uses browser-relative paths and strict references and result shapes", () => {
    expect(SESSION_AI_TITLE_PATH).toBe("/api/dsh-sessions-insight/session/title/suggest")
    expect(SESSION_AI_TITLE_URL).toBe(SESSION_AI_TITLE_PATH.slice(1))
    expect(isAiTitleRequest(ref)).toBe(true)
    for (const value of [
      { ...ref, id: "../escape" },
      { ...ref, tools: [] },
      { ...ref, source: "other" },
    ])
      expect(isAiTitleRequest(value)).toBe(false)
    const value = { ...ref, title: "Cache repair", provider: "configured", model: "current" }
    expect(isAiTitleValue(value)).toBe(true)
    for (const patch of [
      { title: " " },
      { title: "x\n" },
      { title: "x".repeat(81) },
      { model: "" },
      { provider: null },
      { extra: true },
    ]) {
      expect(isAiTitleValue({ ...value, ...patch })).toBe(false)
    }
  })
})

describe("AI title generator", () => {
  it("dispatches one immutable, tool-free, session-free request using prepared controls", async () => {
    const { generator, host, stream } = fixture()
    expect(await generator.suggest(ref, session(["Fix cache", "Add tests", "Check behavior", "DO NOT SEND"]))).toEqual({
      ...ref,
      title: "Cache repair",
      provider: "configured",
      model: "current",
    })
    expect(host.llm.prepareCall).toHaveBeenCalledTimes(1)
    const options = stream.mock.calls[0]![0]
    expect(options.maxTokens).toBe(64)
    expect(options.reasoningEffort).toBe("minimum")
    expect(Object.isFrozen(options)).toBe(true)
    expect(Object.isFrozen(options.messages[0]!.content)).toBe(true)
    expect(JSON.parse(options.messages[0]!.content[0]!.text)).toEqual(["Fix cache", "Add tests", "Check behavior"])
    expect(options).not.toHaveProperty("sessionId")
    expect(options).not.toHaveProperty("tools")
    expect(JSON.stringify(options)).not.toContain("SECRET OUTPUT")
    expect(options.system).toContain("untrusted data")
  })

  it("bounds UTF-8 and JSON escaping without splitting Unicode", async () => {
    const original = '😀"\\\n'.repeat(4000)
    const input = aiTitleInput(session([original]))
    expect(Buffer.byteLength(input)).toBeLessThanOrEqual(AI_TITLE_INPUT_BYTES)
    expect(original.startsWith(JSON.parse(input)[0])).toBe(true)
    expect(input).not.toContain("�")
    const { generator, stream } = fixture()
    await generator.suggest(ref, session([original]))
    expect(Buffer.byteLength(stream.mock.calls[0]![0].messages[0]!.content[0]!.text)).toBeLessThanOrEqual(4096)
  })

  it("reports missing capabilities and never fabricates an AI fallback", async () => {
    await expect(new AiTitleGenerator(() => undefined).suggest(ref, session())).rejects.toMatchObject({
      detail: "ai-naming-unavailable",
    })
    const { generator, host } = fixture()
    await expect(generator.suggest(ref, session([" "]))).rejects.toMatchObject({ detail: "ai-naming-no-user-input" })
    expect(host.llm.prepareCall).not.toHaveBeenCalled()
    vi.mocked(host.llm.prepareCall).mockRejectedValueOnce(new Error("secret-api-key"))
    await expect(generator.suggest(ref, session())).rejects.toMatchObject({ message: "ai-naming-unavailable" })
    await expect(generator.suggest(ref, session())).resolves.toMatchObject({ title: "Cache repair" })
  })

  it.each([
    [text("Partial")],
    [text("Partial"), finish("max-tokens")],
    [text("Partial"), finish("error")],
    [text("Partial"), finish("aborted")],
    [text("Partial"), finish("tool-calls")],
    [{ type: "tool-call-delta", index: 0, id: "x", name: "exec", argumentsDelta: "{}" }, finish()],
    [{ type: "block-end", index: 0, block: { type: "tool-call", name: "exec" } }, finish()],
    [text("x"), finish(), text("after")],
  ])("rejects partial, failed and tool streams and releases the lock: %j", async (...chunks) => {
    const { generator, host } = fixture(chunks)
    await expect(generator.suggest(ref, session())).rejects.toBeInstanceOf(Error)
    const good = fixture()
    host.llm = good.host.llm
    await expect(generator.suggest(ref, session())).resolves.toMatchObject({ title: "Cache repair" })
  })

  it("takes authoritative block-end text, ignores reasoning and strips unsafe formatting", async () => {
    const { generator } = fixture([
      { type: "reasoning-delta", index: 1, text: "private reasoning" },
      text("wrong prefix"),
      { type: "block-end", index: 0, block: { type: "text", text: "\u001b[31m**缓存修复**\u001b[0m\nExplanation" } },
      { type: "usage", usage: {} },
      finish(),
    ])
    await expect(generator.suggest(ref, session())).resolves.toMatchObject({ title: "缓存修复" })
  })

  it.each(["", "session-1", "`execute()`", "<script>", "x".repeat(81), "\u200b"])(
    "rejects unusable titles %j",
    async (value) => {
      await expect(fixture([text(value), finish()]).generator.suggest(ref, session())).rejects.toMatchObject({
        detail: "ai-naming-invalid-title",
      })
    },
  )

  it("rejects routing or budget drift in prepared config", async () => {
    const { generator, host, stream } = fixture()
    vi.mocked(host.llm.prepareCall).mockResolvedValueOnce({
      config: { provider: "other", model: "current", maxTokens: 64 },
      stream,
    })
    await expect(generator.suggest(ref, session())).rejects.toMatchObject({ detail: "ai-naming-invalid-config" })
    expect(stream).not.toHaveBeenCalled()
  })

  it("times out preparation even when a provider ignores cancellation, then permits another request", async () => {
    vi.useFakeTimers()
    const { generator, host } = fixture()
    vi.mocked(host.llm.prepareCall).mockImplementationOnce(() => new Promise(() => {}))
    const pending = generator.suggest(ref, session())
    const rejected = expect(pending).rejects.toMatchObject({ detail: "ai-naming-timeout" })
    await expect(generator.suggest(ref, session())).rejects.toMatchObject({ detail: "ai-naming-busy" })
    await vi.advanceTimersByTimeAsync(AI_TITLE_TIMEOUT_MS)
    await rejected
    await expect(generator.suggest(ref, session())).resolves.toMatchObject({ title: "Cache repair" })
    expect(vi.getTimerCount()).toBe(0)
  })

  it("cancels a stalled partial stream without success or waiting for iterator cleanup", async () => {
    const { generator, host } = fixture()
    const release = vi.fn(async () => ({ done: true as const, value: undefined }))
    let nextStarted!: () => void
    const started = new Promise<void>((resolve) => {
      nextStarted = resolve
    })
    const next = vi
      .fn()
      .mockResolvedValueOnce({ value: text("Partial"), done: false })
      .mockImplementation(() => {
        nextStarted()
        return new Promise(() => {})
      })
    vi.mocked(host.llm.prepareCall).mockResolvedValueOnce({
      config: { provider: "configured", model: "current", maxTokens: 64 },
      stream: () => ({ [Symbol.asyncIterator]: () => ({ next, return: release }) }),
    })
    const controller = new AbortController()
    const pending = generator.suggest(ref, session(), controller.signal)
    const rejected = expect(pending).rejects.toMatchObject({ detail: "ai-naming-cancelled" })
    await started
    controller.abort()
    await rejected
    expect(release).toHaveBeenCalledTimes(1)
    await expect(generator.suggest(ref, session())).resolves.toMatchObject({ title: "Cache repair" })
  })

  it("times out a stalled stream and cancels active work on disposal", async () => {
    vi.useFakeTimers()
    const { generator, host } = fixture()
    let nextStarted!: () => void
    const started = new Promise<void>((resolve) => {
      nextStarted = resolve
    })
    const stalled = () => ({
      [Symbol.asyncIterator]: () => ({
        next: () => {
          nextStarted()
          return new Promise<IteratorResult<unknown>>(() => {})
        },
        return: async () => ({ done: true as const, value: undefined }),
      }),
    })
    vi.mocked(host.llm.prepareCall).mockResolvedValueOnce({
      config: { provider: "configured", model: "current", maxTokens: 64 },
      stream: stalled,
    })
    const timed = expect(generator.suggest(ref, session())).rejects.toMatchObject({ detail: "ai-naming-timeout" })
    await started
    await vi.advanceTimersByTimeAsync(AI_TITLE_TIMEOUT_MS)
    await timed
    vi.mocked(host.llm.prepareCall).mockImplementationOnce(() => new Promise(() => {}))
    const cancelled = expect(generator.suggest(ref, session())).rejects.toMatchObject({ detail: "ai-naming-cancelled" })
    generator.dispose()
    await cancelled
    expect(vi.getTimerCount()).toBe(0)
  })

  it("honors pre-cancel and disposal", async () => {
    const { generator, host } = fixture()
    await expect(generator.suggest(ref, session(), AbortSignal.abort())).rejects.toMatchObject({
      detail: "ai-naming-cancelled",
    })
    expect(host.llm.prepareCall).not.toHaveBeenCalled()
    generator.dispose()
    await expect(generator.suggest(ref, session())).rejects.toMatchObject({ detail: "ai-naming-unavailable" })
  })
})
