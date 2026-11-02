import { createServer } from "node:http"
import type { AddressInfo } from "node:net"

import { afterEach, describe, expect, it, vi } from "vitest"

import { handleAiTitleSuggest } from "../src/host/http/ai-title-route.ts"
import { AiTitleGenerator, type AiTitleHost } from "../src/host/management/ai-title.ts"
import type { SessionSource } from "../src/host/sources/source.ts"
import { isAiTitleValue, SESSION_AI_TITLE_PATH } from "../src/protocol/ai-title.ts"

const ref = { source: "claude", id: "session-1" } as const
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

async function fixture(available = true) {
  const session = {
    ...ref,
    title: "Original",
    workdir: "/work",
    createdAt: 1,
    updatedAt: 2,
    segments: [],
    dataQuality: [],
    turns: [
      {
        index: 0,
        startedAt: 1,
        userInput: ["Fix cache"],
        assistantText: [],
        toolCalls: [],
        compactions: [],
        subagents: [],
        attribution: { total: { tokens: 0, precision: "exact" as const, basis: "usage" as const }, parts: [] },
      },
    ],
  }
  const source: SessionSource = {
    id: "claude",
    status: async () => ({ source: "claude", available: true }),
    workdirs: async () => [],
    list: async () => [],
    candidates: async () => [],
    segmentInfo: async () => [],
    invalidate: vi.fn(),
    detail: vi.fn(async (id: string) =>
      id === ref.id
        ? { ok: true as const, session, bytes: 1, elapsedMs: 0, cached: true }
        : { ok: false as const, error: "not-found" as const, detail: "missing" },
    ),
  }
  const stream = vi.fn(async function* () {
    yield { type: "text-delta", index: 0, text: "Cache repair" }
    yield { type: "finish", reason: { kind: "stop" } }
  })
  const host: AiTitleHost = {
    agentDefaultModel: { currentSelection: () => ({ provider: "configured", model: "current" }) },
    llm: { prepareCall: vi.fn(async (config) => ({ config, stream })) },
  }
  const metadata = { read: vi.fn(async () => ({ entries: [] })), patch: vi.fn(), remove: vi.fn() }
  const generator = new AiTitleGenerator(() => host)
  const handler = handleAiTitleSuggest({
    sources: [source],
    version: "test",
    metadata,
    ...(available ? { aiTitles: generator } : {}),
  })
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  cleanup.push(async () => {
    generator.dispose()
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  })
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${SESSION_AI_TITLE_PATH}`
  const post = (body: unknown = ref, headers: Record<string, string> = {}) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  return { url, post, source, metadata, session, host, stream }
}

describe("AI title HTTP", () => {
  it("returns a suggestion only, without modifying metadata, logs or reader state", async () => {
    const { post, metadata, session, source, stream } = await fixture()
    expect(stream).not.toHaveBeenCalled()
    const response = await post()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(isAiTitleValue(body.value)).toBe(true)
    expect(body.value).toEqual({ ...ref, title: "Cache repair", provider: "configured", model: "current" })
    expect(session.title).toBe("Original")
    expect(metadata.patch).not.toHaveBeenCalled()
    expect(metadata.read).not.toHaveBeenCalled()
    expect(source.invalidate).not.toHaveBeenCalled()
  })

  it("guards method, origin, content type, strict references and missing sources before generation", async () => {
    const { url, post, host } = await fixture()
    expect((await fetch(url)).status).toBe(405)
    expect((await fetch(url, { method: "HEAD" })).status).toBe(405)
    expect((await post(ref, { origin: "https://evil.example" })).status).toBe(403)
    expect((await post(ref, { "sec-fetch-site": "cross-site" })).status).toBe(403)
    expect((await post(ref, { "content-type": "text/plain" })).status).toBe(400)
    for (const body of [
      { ...ref, id: "../escape" },
      { ...ref, id: "" },
      { ...ref, model: "fake" },
      { ...ref, source: "other" },
    ]) {
      expect((await post(body)).status).toBe(400)
    }
    expect((await post({ ...ref, id: "missing" })).status).toBe(404)
    expect((await post({ ...ref, source: "codex" })).status).toBe(503)
    expect(host.llm.prepareCall).not.toHaveBeenCalled()
  })

  it("reports absent capability honestly", async () => {
    const { post } = await fixture(false)
    expect(await (await post()).json()).toEqual({
      ok: false,
      error: "source-unavailable",
      detail: "ai-naming-unavailable",
    })
  })

  it("does not expose provider exception text or turn a partial stream into success", async () => {
    const { post, host, stream } = await fixture()
    vi.mocked(host.llm.prepareCall).mockRejectedValueOnce(new Error("credential=secret"))
    expect(await (await post()).json()).toEqual({
      ok: false,
      error: "source-unavailable",
      detail: "ai-naming-unavailable",
    })
    stream.mockImplementationOnce(async function* () {
      yield { type: "text-delta", index: 0, text: "partial" }
    })
    expect(await (await post()).json()).toEqual({
      ok: false,
      error: "source-unavailable",
      detail: "ai-naming-incomplete",
    })
    expect((await post()).status).toBe(200)
  })
})
