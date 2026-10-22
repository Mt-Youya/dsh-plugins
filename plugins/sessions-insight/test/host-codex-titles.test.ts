import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { CodexSource } from "../src/host/sources/codex.ts"
import { fingerprintOf, walkFingerprint, writeSnapshot } from "../src/host/sources/snapshot.ts"

const ID = "01a00000-0000-7000-8000-000000000001"
const WORKDIR = "/tmp/skills"
const scratch: string[] = []

afterEach(async () => {
  await Promise.all(scratch.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "codex-titles-"))
  scratch.push(home)
  const root = join(home, "sessions")
  await mkdir(root)
  await writeFile(
    join(root, `rollout-2026-10-22T15-19-00-${ID}.jsonl`),
    JSON.stringify({ type: "session_meta", payload: { id: ID, session_id: ID, cwd: WORKDIR } }) + "\n"
  )
  const names = join(home, "session_index.jsonl")
  const indexPath = join(home, "snapshot.json")
  const source = new CodexSource({ root, indexPath, scanTtlMs: 0 })
  return { root, names, indexPath, source }
}

function name(title: string, id = ID): string {
  return JSON.stringify({ id, thread_name: title, updated_at: "2026-10-22T07:19:00Z" }) + "\n"
}

describe("Codex display names", () => {
  it("uses the name index in unparsed lists, search candidates and details", async () => {
    const { source, names } = await fixture()
    await writeFile(names, name("优化 gen-commit skill"))
    expect(await source.list(WORKDIR)).toMatchObject([{ id: ID, title: "优化 gen-commit skill" }])
    expect(await source.candidates()).toMatchObject([{ id: ID, title: "优化 gen-commit skill" }])
    expect(await source.detail(ID)).toMatchObject({ ok: true, session: { title: "优化 gen-commit skill" } })
  })

  it("refreshes renamed titles even when rollouts and the parsed cache are unchanged", async () => {
    const { source, names } = await fixture()
    await writeFile(names, name("旧标题"))
    expect(await source.detail(ID)).toMatchObject({ ok: true, cached: false, session: { title: "旧标题" } })
    await appendFile(names, name("新标题"))
    expect(await source.list(WORKDIR)).toMatchObject([{ title: "新标题" }])
    expect(await source.candidates()).toMatchObject([{ title: "新标题" }])
    expect(await source.detail(ID)).toMatchObject({ ok: true, cached: true, session: { title: "新标题" } })
    await rm(names)
    const result = await source.detail(ID)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.session.title).toBeUndefined()
  })

  it("loads names independently of a rollout snapshot", async () => {
    const { root, source, names, indexPath } = await fixture()
    const scan = await source.scan()
    const files = await walkFingerprint(root, (file) => file.endsWith(".jsonl") || file.startsWith("rollout-"))
    await writeSnapshot(indexPath, "codex", fingerprintOf(files), scan.entries)
    await writeFile(names, name("索引更新的标题"))
    source.invalidate()
    expect((await source.scan()).index).toBeUndefined()
    expect(await source.list(WORKDIR)).toMatchObject([{ title: "索引更新的标题" }])
  })

  it("tolerates absent, malformed and invalid name records", async () => {
    const { source, names } = await fixture()
    expect((await source.list(WORKDIR))[0]?.title).toBeUndefined()
    await writeFile(
      names,
      [
        "null\n[]\n",
        name(ID),
        name("   "),
        name("其他会话", "other"),
        '{"id":3,"thread_name":4}\n',
        '{"id":"unfinished"',
      ].join("")
    )
    expect((await source.list(WORKDIR))[0]?.title).toBeUndefined()
    await writeFile(names, name("有效标题") + "not json\n" + name(" "))
    expect(await source.list(WORKDIR)).toMatchObject([{ title: "有效标题" }])
  })
})
