/**
 * Public surface of the Claude Code adapter.
 *
 * The streaming pass lives in ./read.ts and the IR assembly in ./session.ts;
 * this module only re-exports, so every importer keeps using one path.
 *
 * @see docs/IR.md
 * @see docs/PLAN.md (各来源的归一化红线 · Claude)
 */

export { readClaudeSession } from "./session.ts"
export type { ClaudeReadOptions, ClaudeReadResult, ClaudeReadStats } from "./session.ts"
