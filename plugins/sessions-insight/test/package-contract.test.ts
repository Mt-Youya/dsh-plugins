import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

/**
 * What the two published manifests promise an installer.
 *
 * Both packages are installed from a registry or a Git checkout and loaded by
 * the DSH Host, so the contract is entirely manifest-shaped: which files travel,
 * which dependencies are needed at runtime, and which Host the plugin requires.
 * Asserting it here keeps a build-time decision (inlined UI dependencies, shipped
 * artifacts) from silently regressing into a heavier install.
 *
 * The file list is read from `npm pack --dry-run --json` rather than from
 * `files` directly: only the packer knows how a pattern resolves.
 */
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url))

interface Manifest {
  files?: string[]
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  dsh?: { engines?: { dsh?: string } }
}

function manifest(path: string): Manifest {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as Manifest
}

const member = manifest("plugins/sessions-insight/package.json")
const collection = manifest("package.json")

/** UI libraries inlined into the client bundle; a runtime dependency only bloats installs. */
const INLINED_UI = ["@base-ui/react", "@hugeicons/core-free-icons", "@hugeicons/react", "cn"]

function packedFiles(cwd: string): string[] {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  return (JSON.parse(out) as { files: { path: string }[] }[])[0]!.files.map((file) => file.path)
}

describe("published package contract", () => {
  it("keeps inlined UI libraries out of the member's runtime dependencies", () => {
    for (const name of INLINED_UI) {
      expect({ name, runtime: member.dependencies?.[name] }).toEqual({ name, runtime: undefined })
      expect({ name, dev: typeof member.devDependencies?.[name] }).toEqual({ name, dev: "string" })
    }
    // The Host bundle imports schemastery at runtime, so that one must stay installable.
    expect(Object.keys(member.dependencies ?? {})).toContain("@deepseek-ai/schemastery")
  })

  it("ships build artifacts, not the member source tree", () => {
    expect(member.files ?? []).not.toContain("src")
  })

  it("keeps both install channels on one DSH engine floor", () => {
    expect(member.dsh?.engines?.dsh).toBe(collection.dsh?.engines?.dsh)
  })

  it("keeps the collection tarball to the collection's own files", () => {
    const files = packedFiles(repoRoot)
    expect(files).toContain("cordis.patch.yml")
    // The member ships its own docs and loader patch; the collection carries the
    // source inlined in lib/ and must not duplicate the member's package files.
    expect(files.filter((path) => path.startsWith("plugins/"))).toEqual([])
  })
})
