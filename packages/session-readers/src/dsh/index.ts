/**
 * The DSH adapter's public surface.
 *
 * A barrel, deliberately: the entry points live in sibling modules by concern —
 * {@link readDshSession} owns provenance (file → frames → events → checkpoint),
 * {@link SessionFold} owns meaning (events → turns → attribution), and
 * {@link readDshListMeta} owns the cheap list row. Importers keep addressing
 * `core/dsh/index.ts` and never need to know which file a symbol moved to.
 *
 * @see docs/IR.md
 * @see docs/adr/0004-multiframe-zstd.md
 */

export { DEFAULT_PROJECTION_ROOT, readDshSession } from "./session.ts"
export type { DshReadOptions, DshReadResult, DshReadStats, ProjectionStatus } from "./session.ts"
export { SessionFold } from "./fold.ts"
export type { FoldInput } from "./fold.ts"

/** Re-exported so the probe can print them without importing ir.ts twice. */
export { exactMeasure } from "@cyrus/dsh-session-contract"
export type { DshProjection } from "./projection.ts"
export type { JsonObject } from "./records.ts"
