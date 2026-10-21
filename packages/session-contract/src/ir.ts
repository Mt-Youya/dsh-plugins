/**
 * The one IR every adapter produces and every view reads.
 *
 * Field-for-field the contract in docs/IR.md; changing a field is an ADR, not
 * an edit, because three adapters and five views depend on these names.
 *
 * @see docs/IR.md
 * @see docs/adr/0001-turn-as-first-class.md
 */

/** Which host produced a session. */
export type Source = "claude" | "dsh" | "codex"

/** Whether a token number was logged or derived. */
export type Precision = "exact" | "estimate"

/**
 * Where a token number came from.
 *
 * `usage` is the only exact basis: it is a number the host recorded after the
 * request. `chars-per-token` is our only estimate basis for text; the other
 * two exist so later adapters do not have to invent a token count where they
 * only have bytes.
 */
export type Basis = "usage" | "harness-projection" | "chars-per-token" | "byte-length" | "unattributed"

/** A token count that never travels without its measurement basis. */
export interface Measure {
  tokens: number
  precision: Precision
  basis: Basis
}

/**
 * The attribution buckets. The list is deliberately closed: a byte we cannot
 * place in one of these stays outside `parts` and is reported in
 * `Session.dataQuality` instead of being spread over the others.
 */
export type ContextPart =
  | "system-prompt"
  | "tool-definitions"
  | "memory-instructions"
  | "referenced-files"
  | "history"
  | "tool-results"
  | "images"
  | "user-input"
  | "assistant-output"
  | "thinking"

/** Every part in the order views render them: fixed overhead, then carried, then new. */
export const CONTEXT_PARTS: readonly ContextPart[] = [
  "system-prompt",
  "tool-definitions",
  "memory-instructions",
  "referenced-files",
  "history",
  "tool-results",
  "images",
  "thinking",
  "user-input",
  "assistant-output",
]

/** One classified slice of a turn's context. */
export interface ContextSlice {
  part: ContextPart
  measure: Measure
}

/** What a single turn actually fed the model, split into slices. */
export interface Attribution {
  /** Context window size, only when the log states it; never inferred. */
  windowSize?: number
  /** Always the logged usage value; slices are estimates around this anchor. */
  total: Measure
  parts: ContextSlice[]
  /**
   * The share that could not be attributed: `total − Σparts`.
   *
   * Present when the slices were deliberately *not* scaled — a whole category is
   * missing (no prompt snapshot, a stale one, no usage at all) or the gap is
   * larger than measurement error. Views must draw it as an explicit unknown
   * slice, never spread it over the known ones.
   */
  residual?: Measure
  /**
   * Present only when the slices were scaled to fit the total.
   *
   * The factor is bounded to [0.8, 1.25]: beyond that the difference is a
   * missing category rather than measurement noise.
   */
  reconciled?: { factor: number }
}

/** Token accounting for one turn, normalized by the adapter's own rules. */
export interface Usage {
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
  /** The adapter's normalized context size; Claude uses input+cacheRead+cacheWrite. */
  totalContext: number
}

/** One tool invocation and, when it came back, its result. */
export interface ToolCall {
  id: string
  name: string
  input: unknown
  output?: unknown
  status: "ok" | "error" | "unknown"
  startedAt: number
  endedAt?: number
}

/** A point where the carried context was replaced or summarized. */
export interface CompactionPoint {
  at: number
  before: Measure
  after: Measure
  trigger?: string
  /** Codex substitutes stored history; Claude continues from a summary. */
  replacedHistory: boolean
}

/**
 * One turn: a single user input plus everything the model did in response.
 * Subagent sessions are never turns here; they hang off `subagents`.
 */
export interface Turn {
  /** 1-based, because the panel shows it as "第 N 轮". */
  index: number
  startedAt: number
  endedAt?: number
  /** Only real human input; injected wrappers are stripped by the adapter. */
  userInput: string[]
  assistantText: string[]
  thinking?: string[]
  toolCalls: ToolCall[]
  usage?: Usage
  attribution: Attribution
  compactions: CompactionPoint[]
  /** Ids of subagent sessions this turn spawned. */
  subagents: string[]
  model?: { provider: string; model: string }
}

/** One openable timeline. */
export interface Session {
  id: string
  source: Source
  workdir: string
  title?: string
  createdAt: number
  updatedAt: number
  turns: Turn[]
  /** Physical files behind one logical session (Claude: subagent files). */
  segments: string[]
  /** Machine-readable reason tokens for everything this IR could not say. */
  dataQuality: string[]
}

/** A token count logged by the host. The only exact basis an adapter may use. */
export function exactMeasure(tokens: number): Measure {
  return { tokens, precision: "exact", basis: "usage" }
}

/**
 * A token count that could not be attributed to any category.
 *
 * Always an estimate: it is the arithmetic difference between an exact total
 * and a set of estimates, not a logged number.
 */
export function residualMeasure(tokens: number): Measure {
  return { tokens, precision: "estimate", basis: "unattributed" }
}

/** A token count this plugin derived. Callers must not pass it off as exact. */
export function estimateMeasure(tokens: number, basis: Basis = "chars-per-token"): Measure {
  return { tokens, precision: "estimate", basis }
}

/** Sum of a measure list, keeping the weakest precision and mixed basis honest. */
export function sumMeasures(measures: readonly Measure[]): Measure {
  let tokens = 0
  let exact = true
  for (const measure of measures) {
    tokens += measure.tokens
    if (measure.precision !== "exact") exact = false
  }
  return {
    tokens,
    precision: exact ? "exact" : "estimate",
    basis: exact ? "usage" : "chars-per-token",
  }
}
