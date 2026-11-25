/**
 * The harness sources, one per family badge.
 *
 * Each family is a {@link HarnessSource} over one or more corpora: Cursor has a
 * single global database, pi has one sessions tree, Antigravity has up to three
 * data folders, and the VS Code and Cline families span several applications
 * that share one format. The source id is the badge the panel shows; the app a
 * row actually came from is the corpus's own name.
 *
 * @see docs/adr/0011-storage-family-sources.md
 * @module @cyrusdoyle/dsh-sessions-insight/host/harness
 */

import type { SessionSource } from "../source.ts"
import { AntigravityCorpus } from "./antigravity.ts"
import { ClineCorpus } from "./cline.ts"
import { CursorCorpus } from "./cursor.ts"
import { PiCorpus } from "./pi.ts"
import { harnessRootsFrom } from "./roots.ts"
import { HarnessSource } from "./store.ts"
import { VscodeChatCorpus } from "./vscode.ts"

/**
 * Build the harness sources for one environment.
 * @param env - process environment; every family root can be relocated.
 * @returns one reader per harness source, in the panel's announcement order.
 */
export function harnessSourcesFrom(env: NodeJS.ProcessEnv = process.env): SessionSource[] {
  const roots = harnessRootsFrom(env)
  return [
    new HarnessSource({ id: "cursor", corpora: [new CursorCorpus(roots.cursorUser)] }),
    new HarnessSource({ id: "pi", corpora: [new PiCorpus(roots.piSessions)] }),
    new HarnessSource({
      id: "antigravity",
      corpora: roots.antigravity.map((dir) => new AntigravityCorpus(dir)),
    }),
    new HarnessSource({
      id: "vscode",
      corpora: roots.vscodeUsers.map((entry) => new VscodeChatCorpus(entry.app, entry.user)),
    }),
    new HarnessSource({
      id: "cline",
      corpora: roots.taskRoots.map((entry) => new ClineCorpus(entry.app, entry.dir)),
    }),
  ]
}

export { AntigravityCorpus, ClineCorpus, CursorCorpus, PiCorpus, VscodeChatCorpus }
export { HarnessSource } from "./store.ts"
export type { HarnessCorpus, HarnessRow, HarnessScan } from "./store.ts"
