/**
 * The three session readers, and the measurement helpers they share.
 *
 * One barrel rather than three: every adapter answers the same question with
 * the same vocabulary, and a consumer that reaches for `readClaudeSession`
 * should not have to know which directory it lives in.
 *
 * The adapters deliberately do not share their record/tool/usage helpers — each
 * log format has its own field names for the same idea — so this barrel names
 * the cross-adapter surface explicitly instead of re-exporting three colliding
 * `export *` globs.
 *
 * @module @cyrus/dsh-session-readers
 */

export * from "./calipers.ts"

export { readClaudeSession } from "./claude/index.ts"
export type { ClaudeReadOptions, ClaudeReadResult, ClaudeReadStats } from "./claude/index.ts"
export { humanText, isInjectedUserMessage } from "./claude/turns.ts"

export { readCodexSession } from "./codex/index.ts"
export type {
  CodexReadOptions,
  CodexReadResult,
  CodexReadStats,
  Planned,
  ResolvedRead,
  SessionFacts,
} from "./codex/index.ts"
export { MAX_RECONCILE_FACTOR, CodexWindow, reconcile, sumSlices } from "./codex/attribution.ts"
export type { AttributionReport, ReconcileDecision } from "./codex/attribution.ts"
export {
  CODEX_CALIBRATION_NOTE,
  CODEX_CALIPER_TOKEN,
  CODEX_CHARS_PER_TOKEN_TEXT,
  codexMeasureOf,
  codexProjectedMeasure,
  codexTokensOf,
} from "./codex/calibration.ts"
export { defaultCodexRoot, indexCodexCorpus } from "./codex/segments.ts"
export type {
  ChainOrder,
  CodexCorpusIndex,
  CodexFile,
  CodexSessionPlan,
  CodexThread,
  HistoryBase,
  SessionMeta,
} from "./codex/segments.ts"
export { classifyUserMessage, messageText, turnIdOf } from "./codex/turns.ts"
export type { InjectedKind, UserBlocks } from "./codex/turns.ts"
export { decompressFrames, frameOffsets } from "./codex/zstd.ts"

export { DEFAULT_PROJECTION_ROOT, readDshSession, SessionFold } from "./dsh/index.ts"
export type {
  DshReadOptions,
  DshReadResult,
  DshReadStats,
  DshProjection,
  FoldInput,
  JsonObject,
  ProjectionStatus,
} from "./dsh/index.ts"
export { decodeSessionLog, splitLogLines } from "./dsh/frames.ts"
export { parseLogLine } from "./dsh/records.ts"
export { LIST_META_BYTE_LIMIT, LIST_META_FRAME_LIMIT, readDshListMeta } from "./dsh/listmeta.ts"
export type { DshListMeta } from "./dsh/listmeta.ts"
export { isProjectionFresh, parseProjection } from "./dsh/projection.ts"
