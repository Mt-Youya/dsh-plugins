/**
 * Resolving one rollout path into the files that must be parsed.
 *
 * A Codex session is a chain: the root thread's segments linked by
 * history_base, plus the subagent rollouts it spawned. This module answers, for
 * a path the caller named: which thread owns it, which segment files to read in
 * which order, and what the session-level facts (id, workdir, segments) are.
 * Reading is session.ts's job; this is only the orchestration around
 * segments.ts's index.
 *
 * @see docs/PLAN.md (Codex 归一化红线：分段不是分叉)
 */

import { basename } from "node:path"
import {
  defaultCodexRoot,
  fileThreadId,
  indexCodexCorpus,
  planForFile,
  readMetaOnly,
  type CodexCorpusIndex,
  type CodexFile,
  type CodexSessionPlan,
  type CodexThread,
} from "./segments.ts"

/** Options for readCodexSession. */
export interface CodexReadOptions {
  /** Corpus root used to resolve sibling segments; default ~/.codex/sessions. */
  root?: string
  /** Prebuilt index, so a corpus run indexes once instead of per session. */
  index?: CodexCorpusIndex
  /** Link subagent rollout files into Session.segments. Default true. */
  includeSubagents?: boolean
}

/** What the plan resolution produced for this read. */
export interface Planned {
  id: string
  workdir: string
  segments: string[]
  childFiles: string[]
  childThreadIds: string[]
  meta?: CodexFile["meta"]
  forkedFrom?: string
}

/** One read: the thread to parse and the files that belong to the session. */
export interface ResolvedRead {
  planned: Planned
  files: readonly CodexFile[]
  thread: CodexThread
}

/**
 * Resolve the path the caller named into a thread and its file chain.
 * @param path - any rollout file of the session.
 * @param options - corpus root or a prebuilt index.
 */
export function resolveRead(path: string, options: CodexReadOptions = {}): ResolvedRead {
  const index = options.index ?? indexCodexCorpus(options.root ?? defaultCodexRoot())
  const located = planForFile(index, path)
  const thread = located?.thread ?? fallbackThread(path)
  const files = thread.chain.ordered.length > 0 ? thread.chain.ordered : [fallbackFile(path)]
  return { planned: planForThread(located?.plan, thread, files), files, thread }
}

/** The session-level facts of one thread, with its subagent files when it is a root. */
function planForThread(plan: CodexSessionPlan | undefined, thread: CodexThread, files: readonly CodexFile[]): Planned {
  const first = files[0]
  const meta = first?.meta
  const children = plan?.children ?? []
  const includeChildren = thread.parentThreadId === undefined
  const childFiles = includeChildren ? children.flatMap((child) => child.files.map((file) => file.path)) : []
  const segments = [...files.map((file) => file.path), ...childFiles]
  const planned: Planned = {
    id: thread.threadId.length > 0 ? thread.threadId : (plan?.id ?? "codex"),
    workdir: plan?.workdir ?? meta?.workdir ?? "",
    segments,
    childFiles,
    childThreadIds: includeChildren ? children.map((child) => child.threadId) : [],
  }
  if (meta !== undefined) planned.meta = meta
  if (meta?.forkedFromId !== undefined) planned.forkedFrom = meta.forkedFromId
  return planned
}

/** A thread built from one file, for a rollout outside any corpus root. */
function fallbackThread(path: string): CodexThread {
  const file = fallbackFile(path)
  return { threadId: file.threadId, files: [file], chain: { ordered: [file], broken: 0, missingBase: 0 } }
}

function fallbackFile(path: string): CodexFile {
  const meta = readMetaOnly(path)
  const threadId = fileThreadId(path) ?? meta?.threadId ?? basename(path)
  return {
    path,
    threadId,
    size: 0,
    meta: meta ?? { sessionId: threadId, threadId },
  }
}
