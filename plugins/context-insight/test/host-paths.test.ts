import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  claudeRootFrom,
  decodeProjectDirName,
  isWithin,
  resolveInside,
  CLAUDE_ROOT_ENV,
} from "../src/host/sources/paths.ts"
import { isSafeId } from "../src/protocol.ts"

describe("claude root resolution", () => {
  it("honours the configured root and otherwise falls back to ~/.claude/projects", () => {
    expect(claudeRootFrom({ [CLAUDE_ROOT_ENV]: "/tmp/corpus" })).toBe("/tmp/corpus")
    expect(claudeRootFrom({ [CLAUDE_ROOT_ENV]: "   " })).toMatch(/\.claude[/\\]projects$/)
    expect(claudeRootFrom({})).toMatch(/\.claude[/\\]projects$/)
  })
})

describe("project directory decoding", () => {
  it("decodes the separator encoding and refuses names that carry none", () => {
    expect(decodeProjectDirName("-Users-me-codes-app")).toBe("/Users/me/codes/app")
    expect(decodeProjectDirName("Users-me-codes-app")).toBe("")
    expect(decodeProjectDirName("-")).toBe("/")
  })
})

describe("containment", () => {
  it("accepts the root and its descendants, rejects siblings and escapes", () => {
    expect(isWithin("/a/b", "/a/b")).toBe(true)
    expect(isWithin("/a/b", "/a/b/c.jsonl")).toBe(true)
    expect(isWithin("/a/b", "/a/bc/d.jsonl")).toBe(false)
    expect(isWithin("/a/b", "/a")).toBe(false)
    expect(isWithin("/a/b", "/a/b/../etc/passwd")).toBe(false)
  })

  it("rejects a dot-dot path that escaped before realpath ran", async () => {
    const root = await mkdtemp(join(tmpdir(), "m5-root-"))
    const project = join(root, "proj")
    await mkdir(project)
    await writeFile(join(project, "ok.jsonl"), "{}\n")
    // Inside the root: admitted.
    expect(await resolveInside(root, join(project, "ok.jsonl"))).toBeDefined()
    // Walked out of the root: refused even though the path exists.
    expect(await resolveInside(root, join(project, "..", "..", "etc", "passwd"))).toBeUndefined()
    // Missing: not admitted either.
    expect(await resolveInside(root, join(project, "missing.jsonl"))).toBeUndefined()
  })

  it("refuses a symlink whose target lives outside the root", async () => {
    const root = await mkdtemp(join(tmpdir(), "m5-sym-"))
    const outside = await mkdtemp(join(tmpdir(), "m5-out-"))
    const target = join(outside, "passwd")
    await writeFile(target, "root:x:0:0\n")
    await symlink(target, join(root, "escape.jsonl"))
    expect(await resolveInside(root, join(root, "escape.jsonl"))).toBeUndefined()
  })
})

describe("session id whitelist", () => {
  it("admits uuids and refuses anything that could be a path", () => {
    expect(isSafeId("184d3a05-6c0d-4d68-a379-d4c1de581472")).toBe(true)
    expect(isSafeId("agent-a0614083fc2b4600f")).toBe(true)
    expect(isSafeId("../../etc/passwd")).toBe(false)
    expect(isSafeId("..")).toBe(false)
    expect(isSafeId(".")).toBe(false)
    expect(isSafeId("a/b")).toBe(false)
    expect(isSafeId("a\\b")).toBe(false)
    expect(isSafeId("%2e%2e%2fetc")).toBe(false)
    expect(isSafeId("")).toBe(false)
    expect(isSafeId("x".repeat(129))).toBe(false)
  })
})
