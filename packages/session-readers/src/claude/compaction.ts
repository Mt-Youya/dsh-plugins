/**
 * Compaction boundaries.
 *
 * Claude writes the boundary as a *pair*: a `system/compact_boundary` record
 * carrying `compactMetadata{trigger,preTokens,postTokens,durationMs}`, followed
 * by a `user` record with `isCompactSummary: true` holding the summary that
 * replaces the history. Reading either half alone loses one of the two
 * numbers, so the adapter tracks the boundary and attaches the summary to it.
 */

import type { CompactionPoint, Measure } from "@cyrus/dsh-session-contract"
import { epochOf, numberField, objectField, stringField, type JsonObject } from "./records.ts"

/** The metadata half of a compaction event. */
export interface CompactionBoundary {
  at: number
  trigger?: string
  /** Context size the host recorded immediately before compacting. */
  preTokens: number
  /** Context size after the summary was written. */
  postTokens: number
  durationMs?: number
}

/**
 * Read a `system/compact_boundary` record.
 *
 * `preTokens`/`postTokens` are the only exact context sizes compaction ever
 * exposes, so they are copied verbatim and never derived from usage rows.
 * @returns undefined for any other record.
 */
export function readCompactionBoundary(record: JsonObject): CompactionBoundary | undefined {
  if (stringField(record, "type") !== "system") return undefined
  if (stringField(record, "subtype") !== "compact_boundary") return undefined
  const metadata = objectField(record, "compactMetadata")
  if (metadata === undefined) return undefined
  const preTokens = numberField(metadata, "preTokens")
  const postTokens = numberField(metadata, "postTokens")
  if (preTokens === undefined || postTokens === undefined) return undefined
  const boundary: CompactionBoundary = {
    at: epochOf(record) ?? 0,
    preTokens,
    postTokens,
  }
  const trigger = stringField(metadata, "trigger")
  if (trigger !== undefined) boundary.trigger = trigger
  const durationMs = numberField(metadata, "durationMs")
  if (durationMs !== undefined) boundary.durationMs = durationMs
  return boundary
}

/** Whether a user record is the summary that follows a boundary. */
export function isCompactSummary(record: JsonObject): boolean {
  return record["isCompactSummary"] === true
}

/**
 * Build the IR compaction point.
 *
 * `replacedHistory` is false: Claude continues the conversation from a summary
 * rather than substituting a stored history the way Codex does.
 * @param boundary - recorded boundary metadata.
 * @param before - the context size actually observed just before compacting.
 */
export function toCompactionPoint(boundary: CompactionBoundary, before: Measure): CompactionPoint {
  const after: Measure = { tokens: boundary.postTokens, precision: "exact", basis: "usage" }
  const point: CompactionPoint = {
    at: boundary.at,
    before,
    after,
    replacedHistory: false,
  }
  if (boundary.trigger !== undefined) point.trigger = boundary.trigger
  return point
}
