import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ClaudeSource } from "../src/host/sources/claude.ts"
import { CodexSource } from "../src/host/sources/codex.ts"
import { DshSource } from "../src/host/sources/dsh.ts"
import { deleteLogs } from "../src/host/sources/delete.ts"
import { createRoutes } from "../src/host/http/routes.ts"
import { createApi } from "../src/client/api.ts"
import { SESSION_DELETE_PATH, SESSIONS_PATH, WORKDIRS_PATH, type ContextSource } from "../src/protocol.ts"

const ID = "01a00000-0000-7000-8000-000000000001"
const WORKDIR = "/tmp/delete-session-fixture"
const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

async function fixture(kind: ContextSource) {
  const home = await mkdtemp(join(tmpdir(), "insight-delete-"))
  cleanup.push(() => rm(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }))
  const root = join(home, "sessions")
  const path =
    kind === "dsh"
      ? join(root, "--tmp-fixture--", `session-${ID}`, "session.v4.jsonl.zstd")
      : kind === "claude"
        ? join(root, "-tmp-fixture", `${ID}.jsonl`)
        : join(root, `rollout-2026-10-23T01-00-00-${ID}.jsonl`)
  await mkdir(join(path, ".."), { recursive: true })
  const content =
    kind === "codex"
      ? { type: "session_meta", payload: { id: ID, session_id: ID, cwd: WORKDIR } }
      : { type: "user", sessionId: ID, cwd: WORKDIR, message: { role: "user", content: "fixture" } }
  await writeFile(path, JSON.stringify(content) + "\n")
  const indexPath = join(home, "index.json")
  const source =
    kind === "claude"
      ? new ClaudeSource({ root })
      : kind === "codex"
        ? new CodexSource({ root, indexPath })
        : new DshSource({
            root,
            indexPath,
            readMeta: async () => ({
              id: ID,
              cwd: WORKDIR,
              delegationDepth: 0,
              createdAt: 1,
              bytes: 10,
              bytesRead: 10,
              framesRead: 1,
            }),
          })
  return { home, root, path, source }
}

describe("deleting original session logs", () => {
  it.each(["claude", "codex", "dsh"] as const)(
    "deletes %s and invalidates lists, search candidates and details",
    async (kind) => {
      const { source, path, root } = await fixture(kind)
      const unrelated = join(root, "keep.txt")
      await writeFile(unrelated, "keep")
      expect(await source.list(WORKDIR)).toHaveLength(1)
      expect(await source.remove("../outside")).toMatchObject({ ok: false, error: "bad-request" })
      expect(await source.remove(ID)).toEqual({ ok: true })
      await expect(access(path)).rejects.toThrow()
      expect(await source.list(WORKDIR)).toEqual([])
      expect(await source.workdirs()).toEqual([])
      expect(await source.candidates()).toEqual([])
      expect(await source.detail(ID)).toMatchObject({ ok: false, error: "not-found" })
      expect(await source.remove(ID)).toMatchObject({ ok: false, error: "not-found" })
      expect(await readFile(unrelated, "utf8")).toBe("keep")
    }
  )

  it("removes copied Claude transcripts so they cannot reappear", async () => {
    const { source, root, path } = await fixture("claude")
    const copy = join(root, "-tmp-copy", "copy.jsonl")
    await mkdir(join(copy, ".."))
    await writeFile(copy, await readFile(path))
    expect(await source.remove(ID)).toEqual({ ok: true })
    expect(await source.list(WORKDIR)).toEqual([])
    await expect(access(copy)).rejects.toThrow()
  })

  it("refuses symlinks and escaped paths before deleting any file", async () => {
    const { root, path, home } = await fixture("claude")
    const outside = join(home, "outside.jsonl")
    await writeFile(outside, "keep")
    const link = join(root, "link.jsonl")
    await symlink(outside, link)
    expect(await deleteLogs(root, [path, outside])).toMatchObject({ ok: false, error: "forbidden" })
    expect(await deleteLogs(root, [path, link])).toMatchObject({ ok: false, error: "forbidden" })
    await access(path)
    expect(await readFile(outside, "utf8")).toBe("keep")
  })

  it("refuses shared Codex segments", async () => {
    const { source, path } = await fixture("codex")
    if (!(source instanceof CodexSource)) throw new Error("wrong fixture")
    const scan = await source.scan()
    const entry = scan.entries[0]!
    vi.spyOn(source, "scan").mockResolvedValue({ ...scan, entries: [entry, { ...entry, id: "other-session" }] })
    expect(await source.remove(ID)).toMatchObject({ ok: false, detail: "shared-session-logs" })
    await access(path)
  })

  it.each(["web-origin", "web-fetch-site", "desktop"] as const)(
    "guards HTTP deletion and refreshes caches (%s)",
    async (transport) => {
      const { source, path } = await fixture("claude")
      const deps = { sources: [source], version: "test", cacheTtlMs: 0 }
      const routes = createRoutes(deps)
      const server = createServer((req, res) => {
        const route = routes.find((item) => item.path === new URL(req.url!, "http://localhost").pathname)
        if (route === undefined) {
          res.writeHead(404)
          res.end()
          return
        }
        route.handler(req, res)
      })
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
      cleanup.push(
        () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      )
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      const endpoint = base + SESSION_DELETE_PATH
      const post = (body: unknown, origin: string | undefined = transport === "web-origin" ? base : undefined) =>
        fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(transport === "web-fetch-site" ? { "sec-fetch-site": "same-origin" } : {}),
            ...(origin === undefined ? {} : { origin }),
          },
          body: JSON.stringify(body),
        })
      const ref = { source: "claude", id: ID }
      expect((await fetch(endpoint)).status).toBe(405)
      expect((await post(ref, "https://attacker.example")).status).toBe(403)
      const preflight = await fetch(endpoint, {
        method: "OPTIONS",
        headers: {
          origin: "https://attacker.example",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type",
        },
      })
      expect(preflight.status).toBe(403)
      expect(preflight.headers.get("access-control-allow-origin")).toBeNull()
      expect((await fetch(endpoint, { method: "POST", body: JSON.stringify(ref) })).status).toBe(400)
      for (const [name, value] of [
        ["sec-fetch-site", "cross-site"],
        ["origin", "null"],
      ] as const) {
        expect(
          (
            await fetch(endpoint, {
              method: "POST",
              headers: { "content-type": "application/json", [name]: value },
              body: JSON.stringify(ref),
            })
          ).status
        ).toBe(403)
      }
      expect((await post({ source: "claude", id: "../outside" })).status).toBe(400)
      expect((await post({ source: "unknown", id: ID })).status).toBe(400)
      expect((await fetch(endpoint, { method: "POST", headers: { origin: base }, body: "{}" })).status).toBe(400)
      await access(path)
      const sessions = `${base}${SESSIONS_PATH}?workdir=${encodeURIComponent(WORKDIR)}`
      expect((await (await fetch(sessions)).json()).value.sessions).toHaveLength(1)
      await fetch(base + WORKDIRS_PATH)
      const oldRows = await source.list(WORKDIR)
      let finishRefresh!: (rows: typeof oldRows) => void
      const pendingRefresh = new Promise<typeof oldRows>((resolve) => {
        finishRefresh = resolve
      })
      const refresh = vi.spyOn(source, "list").mockImplementationOnce(() => pendingRefresh)
      // A revalidation started before deletion must not reinsert the old rows afterwards.
      await fetch(sessions)
      const response = await post(ref)
      expect(await response.json()).toEqual({ ok: true, value: ref })
      finishRefresh(oldRows)
      await new Promise<void>((resolve) => setImmediate(resolve))
      refresh.mockRestore()
      expect((await (await fetch(sessions)).json()).value.sessions).toEqual([])
      expect((await (await fetch(base + WORKDIRS_PATH)).json()).value.workdirs).toEqual([])
      expect((await post(ref)).status).toBe(404)
    }
  )

  it("sends a typed deletion request from the client", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, value: { source: "dsh", id: ID } })))
    try {
      expect(await createApi("/").deleteSession("dsh", ID)).toEqual({ ok: true, value: { source: "dsh", id: ID } })
      expect(fetcher).toHaveBeenCalledWith(
        "/api/dsh-sessions-insight/session/delete",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ source: "dsh", id: ID }),
          credentials: "same-origin",
        })
      )
    } finally {
      fetcher.mockRestore()
    }
  })
})
