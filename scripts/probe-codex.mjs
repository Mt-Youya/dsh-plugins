#!/usr/bin/env node
/**
 * Re-runnable evidence run for the Codex adapter.
 *
 * Prints, per session: parsed segments, turns, the exact prompt size of every
 * turn against the attribution total, the four usage traps (cached added,
 * last_token_usage, thread and turn cumulative counters), tool pairing,
 * compaction drops, and the residual / reconciled.factor distribution.
 * `--corpus <dir>` does the same over every rollout and reports wall time,
 * peak RSS and failures, plus the plaintext subset that proves segment files
 * are not sessions.
 *
 *   node scripts/probe-codex.mjs                     # 3 samples: segmented, subagents, largest
 *   node scripts/probe-codex.mjs <file> ...          # explicit samples
 *   node scripts/probe-codex.mjs --corpus ~/.codex/sessions
 *
 * Read-only: nothing is written anywhere.
 */

import { statSync } from "node:fs"
import { defaultCodexRoot, indexCodexCorpus } from "../src/core/codex/segments.ts"
import { readCodexSession } from "../src/core/codex/index.ts"
import { CHAR_CALIBRATION_NOTE } from "../src/core/attribution.ts"
import { CODEX_CALIBRATION_NOTE, CODEX_CHARS_PER_TOKEN_TEXT } from "../src/core/codex/calibration.ts"

const number = (value) => value.toLocaleString("en-US")
const percent = (value) => (value === undefined || !Number.isFinite(value) ? "-" : (value * 100).toFixed(1) + "%")
const multiple = (value) => (Number.isFinite(value) ? value.toFixed(3) + "x" : "-")
/** A ratio whose denominator may be zero: no usage means no ratio, not infinity. */
const ratio = (numerator, denominator) => (denominator > 0 ? multiple(numerator / denominator) : "-")
const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1) + " MB"
const ms = (value) => value.toFixed(0) + " ms"

function quantile(values, q) {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

function distribution(values) {
  return {
    n: values.length,
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    max: values.length === 0 ? undefined : Math.max(...values),
    mean: values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length,
  }
}

function describe(name, values, format = multiple) {
  const stats = distribution(values)
  if (stats.n === 0) return name + ": (none)"
  return (
    name + ": n=" + stats.n + " p50=" + format(stats.p50) + " p95=" + format(stats.p95) + " max=" + format(stats.max)
  )
}

/** Pick one sample per scenario the milestone names. */
function pickSamples(index) {
  const sessions = [...index.sessions.values()]
  const segmented = [...sessions].sort((a, b) => b.root.files.length - a.root.files.length)[0]
  const withChildren = [...sessions].sort((a, b) => b.children.length - a.children.length)[0]
  const largest = [...index.files].sort((a, b) => b.size - a.size)[0]
  const samples = []
  if (segmented !== undefined) samples.push({ label: "segmented", file: segmented.root.files[0]?.path })
  if (withChildren !== undefined) samples.push({ label: "subagents", file: withChildren.root.files[0]?.path })
  if (largest !== undefined) samples.push({ label: "largest", file: largest.path })
  return samples.filter((sample) => typeof sample.file === "string")
}

/** One turn's naive readings, next to the exact one. */
function turnRows(session) {
  return session.turns.map((turn) => {
    const parts = turn.attribution.parts.reduce((sum, slice) => sum + slice.measure.tokens, 0)
    const residual = turn.attribution.residual?.tokens ?? 0
    const factor = turn.attribution.reconciled?.factor ?? 1
    const usage = turn.usage
    const promptPerRequest = usage === undefined ? 0 : usage.input + usage.cacheRead + usage.cacheWrite
    const cachedAdded = usage === undefined ? 0 : usage.input + usage.cacheRead * 2 + usage.cacheWrite
    return {
      index: turn.index,
      exact: turn.attribution.total.tokens,
      context: usage?.totalContext ?? 0,
      requests: usage === undefined ? 0 : promptPerRequest,
      cachedAdded,
      cachedTrap: usage === undefined || usage.input + usage.cacheRead === 0 ? 1 : cachedAdded / promptPerRequest,
      parts,
      residual,
      factor,
      tools: turn.toolCalls.length,
      compactions: turn.compactions.length,
      residualShare: turn.attribution.total.tokens === 0 ? 0 : residual / turn.attribution.total.tokens,
    }
  })
}

function renderTurnTable(rows, limit = 12) {
  const lines = []
  const start = rows.findIndex((row) => row.exact > 0)
  const window = start < 0 ? rows.slice(0, limit) : rows.slice(start, start + limit)
  if (start > 0)
    lines.push("_first " + start + " turns carry no usage (inherited history or aborted), skipped in this table_", "")
  lines.push(
    "| turn | usage.totalContext | attribution.total | match | Σ prompt/requests | cached+sum | cached trap | Σ parts | residual | residual share | factor | tools |"
  )
  lines.push("| ---: | ---: | ---: | :---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
  for (const row of window) {
    // A turn with no usage has an estimated total, not a drifting exact one.
    const match =
      row.requests === 0 && row.cachedAdded === 0
        ? "estimate (no usage)"
        : row.context === row.exact
          ? "exact"
          : "DRIFT " + number(row.context - row.exact)
    lines.push(
      "| " +
        row.index +
        " | " +
        number(row.context) +
        " | " +
        number(row.exact) +
        " | " +
        match +
        " | " +
        number(row.requests) +
        " | " +
        number(row.cachedAdded) +
        " | " +
        multiple(row.cachedTrap) +
        " | " +
        number(row.parts) +
        " | " +
        number(row.residual) +
        " | " +
        percent(row.residualShare) +
        " | " +
        row.factor.toFixed(3) +
        " | " +
        row.tools +
        " |"
    )
  }
  if (rows.length > window.length)
    lines.push("| …" + (rows.length - window.length) + " more turns | | | | | | | | | | | |")
  return lines
}

/** The turn with the most requests, which is the one the milestone asks to hand-check. */
function renderHighlight(session) {
  const turns = session.turns.filter((turn) => turn.usage !== undefined)
  if (turns.length === 0) return ["- hand-check: no turn carries usage in this session"]
  const pick = turns.sort((a, b) => (b.usage?.totalContext ?? 0) - (a.usage?.totalContext ?? 0))[0]
  const usage = pick.usage
  if (usage === undefined) return ["- hand-check: no turn carries usage in this session"]
  const prompt = usage.input + usage.cacheRead + usage.cacheWrite
  const cachedAdded = usage.input + usage.cacheRead * 2 + usage.cacheWrite
  const lines = []
  lines.push(
    "- hand-check turn " +
      pick.index +
      ": usage.totalContext = " +
      number(usage.totalContext) +
      ", attribution.total = " +
      number(pick.attribution.total.tokens) +
      " (" +
      (usage.totalContext === pick.attribution.total.tokens ? "identical" : "DRIFT") +
      ")"
  )
  lines.push(
    "- hand-check turn " +
      pick.index +
      " traps: Σ prompt over its requests " +
      number(prompt) +
      "; if cached is added " +
      number(cachedAdded) +
      " = " +
      ratio(cachedAdded, prompt) +
      "; its usage is one record per response, so reading token_count too doubles it (2.000x); thread_token_usage at the last request is cumulative (see the session trap above)"
  )
  return lines
}

/** Calls with no result record, grouped by tool: web_search reports inline. */
function unpairedByTool(session) {
  const counts = new Map()
  for (const turn of session.turns) {
    for (const call of turn.toolCalls) {
      if (call.endedAt !== undefined) continue
      counts.set(call.name, (counts.get(call.name) ?? 0) + 1)
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])
}

function renderCompactions(session) {
  const points = []
  for (const turn of session.turns) for (const point of turn.compactions) points.push({ turn: turn.index, ...point })
  if (points.length === 0) return ["- compactions: none"]
  const lines = [
    "- compactions: " + points.length,
    "",
    "| turn | at | before | after | drop | replacedHistory | trigger |",
    "| ---: | ---: | ---: | ---: | ---: | :---: | :--- |",
  ]
  for (const point of points) {
    const drop = point.before.tokens === 0 ? "-" : multiple(point.before.tokens / point.after.tokens)
    lines.push(
      "| " +
        point.turn +
        " | " +
        new Date(point.at).toISOString() +
        " | " +
        number(point.before.tokens) +
        " | " +
        number(point.after.tokens) +
        " | " +
        drop +
        " | " +
        String(point.replacedHistory) +
        " | " +
        (point.trigger ?? "-") +
        " |"
    )
  }
  return lines
}

function renderUsageTraps(stats) {
  const lines = []
  const exact = stats.exactInputTokens || 1
  lines.push(
    "- usage records: " +
      number(stats.requests) +
      " distinct responses, " +
      number(stats.duplicateResponseIds) +
      " duplicate response ids" +
      (stats.requests === 0 ? " — this session logs no token_usage_record, so there is no exact anchor" : "")
  )
  lines.push(
    "- exact Σ input_tokens = " +
      number(stats.exactInputTokens) +
      " (cached " +
      number(stats.cachedInputTokens) +
      " is a subset; non-cached " +
      number(stats.nonCachedInputTokens) +
      ")"
  )
  lines.push(
    "- trap 1 cached added: Σ(input + cached) = " +
      number(stats.naiveCachedAddedTokens) +
      " = " +
      ratio(stats.naiveCachedAddedTokens, stats.exactInputTokens) +
      " if the subset is summed"
  )
  lines.push(
    "- trap 2 last_token_usage: Σ = " +
      number(stats.lastTokenUsageTokens) +
      " = " +
      ratio(stats.lastTokenUsageTokens, stats.exactInputTokens) +
      " if it is read as well (" +
      number(stats.lastTokenUsageEchoes) +
      "/" +
      number(stats.tokenCounts) +
      " token_count events repeat a usage object verbatim)"
  )
  lines.push(
    "- trap 3 thread_token_usage: Σ = " +
      number(stats.threadCumulativeTokens) +
      " = " +
      ratio(stats.threadCumulativeTokens, stats.exactInputTokens) +
      " if the cumulative counter is summed"
  )
  lines.push(
    "- trap 4 turn_token_usage: Σ = " +
      number(stats.turnCumulativeTokens) +
      " = " +
      ratio(stats.turnCumulativeTokens, stats.exactInputTokens) +
      " if the cumulative counter is summed"
  )
  return lines
}

function renderAttribution(stats, session) {
  const rows = turnRows(session)
  const residual = rows.filter((row) => row.residual !== 0).map((row) => row.residual)
  const positive = residual.filter((value) => value > 0)
  const negative = residual.filter((value) => value < 0)
  const shares = rows.filter((row) => row.residual > 0).map((row) => row.residualShare)
  const overShares = rows.filter((row) => row.residual < 0).map((row) => -row.residualShare)
  const factors = rows.filter((row) => row.factor !== 1).map((row) => row.factor)
  const lines = []
  lines.push("- attribution raw estimate: " + number(stats.rawAttributionTokens))
  lines.push("- " + describe("residual tokens (unknown mass)", positive, number))
  lines.push("- " + describe("residual tokens (over-counted)", negative, number))
  lines.push("- " + describe("residual share (unknown mass)", shares, percent))
  lines.push("- " + describe("residual share (over-counted)", overShares, percent))
  lines.push("- " + describe("reconciled.factor", factors, (value) => value.toFixed(3)))
  lines.push(
    "- turns: " +
      stats.turns +
      ", reconciled " +
      stats.reconciledTurns +
      ", residual " +
      stats.residualTurns +
      ", tool-results above the whole window " +
      stats.toolResultsAboveWindow
  )
  return lines
}

async function probeOne(sample, index) {
  const started = process.hrtime.bigint()
  const result = await readCodexSession(sample.file, { index })
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
  const size = statSync(sample.file).size
  const { session, stats } = result
  const lines = []
  lines.push("### " + sample.label + " — " + sample.file)
  lines.push("")
  lines.push(
    "- size " +
      mb(size) +
      ", parsed in " +
      ms(elapsedMs) +
      ", " +
      stats.turns +
      " turns, " +
      stats.segmentFiles.length +
      " segment files, " +
      stats.childFiles.length +
      " subagent files"
  )
  lines.push(
    "- lines " +
      number(stats.lines) +
      " (invalid " +
      number(stats.invalid) +
      "), zstd frames " +
      number(stats.frames) +
      ", " +
      mb(stats.bytes) +
      " decompressed"
  )
  lines.push(
    "- window " +
      number(stats.windowSize ?? 0) +
      ", tool schemas " +
      (stats.sawToolSchemas ? "logged (partial set)" : "not logged") +
      ", reasoning " +
      number(stats.encryptedReasoningRecords) +
      "/" +
      number(stats.reasoningRecords) +
      " encrypted"
  )
  const unpaired = unpairedByTool(session)
  lines.push(
    "- tool calls " +
      number(stats.toolCalls) +
      ", paired " +
      number(stats.pairedToolCalls) +
      ", orphan results " +
      number(stats.orphanToolResults) +
      ", subagent threads " +
      stats.subagentThreads.length +
      (unpaired.length === 0
        ? ""
        : ", unpaired by tool: " + unpaired.map(([name, count]) => name + "=" + count).join(", "))
  )
  lines.push(...renderUsageTraps(stats))
  lines.push(...renderAttribution(stats, session))
  lines.push(...renderHighlight(session))
  lines.push("- dataQuality: " + (session.dataQuality.join(", ") || "(none)"))
  lines.push("")
  lines.push(...renderCompactions(session))
  lines.push("")
  lines.push(...renderTurnTable(turnRows(session)))
  lines.push("")
  return lines.join("\n")
}

async function runSamples(samples) {
  const index = indexCodexCorpus(defaultCodexRoot())
  const out = [
    "# Codex context probe",
    "",
    "shared table: " + CHAR_CALIBRATION_NOTE,
    "codex override: " + CODEX_CALIBRATION_NOTE,
    "",
    "corpus: " +
      index.root +
      " (" +
      index.files.length +
      " rollout files, " +
      index.sessions.size +
      " logical sessions)",
    "",
  ]
  for (const sample of samples) {
    try {
      out.push(await probeOne(sample, index))
    } catch (error) {
      out.push(
        "### " + sample.label + " — " + sample.file,
        "",
        "FAILED: " + (error instanceof Error ? error.message : String(error)),
        ""
      )
    }
  }
  return out.join("\n")
}

async function runCorpus(root) {
  const index = indexCodexCorpus(root)
  const started = process.hrtime.bigint()
  let bytes = 0
  let decompressed = 0
  let frames = 0
  let lines = 0
  let invalid = 0
  let turns = 0
  let requests = 0
  let exact = 0
  let cached = 0
  let naiveCached = 0
  let lastToken = 0
  let threadCumulative = 0
  let turnCumulative = 0
  let toolCalls = 0
  let paired = 0
  let orphans = 0
  let compactions = 0
  let drops = 0
  let raw = 0
  let toolAboveWindow = 0
  const residual = []
  const shares = []
  const overShares = []
  const factors = []
  const residualWithoutTools = { turns: 0, tokens: 0 }
  const residualWithTools = { turns: 0, tokens: 0 }
  const quality = new Map()
  const failures = []
  const parsedFiles = new Set()
  let noUsageSessions = 0
  let turnsWithoutUsage = 0
  // Every rollout is parsed exactly once: a parent read covers its root segment
  // chain, and a subagent thread is read on its own (its turns never merge into
  // the parent). That is how 260 files are covered by 108 + 16 reads.
  const reads = []
  for (const session of index.sessions.values()) {
    const first = session.root.files[0]
    if (first === undefined) failures.push({ id: session.id, error: "no root segment files" })
    else reads.push({ id: session.id, path: first.path, kind: "root" })
    for (const child of session.children) {
      const childFirst = child.files[0]
      if (childFirst !== undefined) reads.push({ id: child.threadId, path: childFirst.path, kind: "child" })
    }
  }
  const usageByKind = { root: { reads: 0, withUsage: 0 }, child: { reads: 0, withUsage: 0 } }
  const unpairedCalls = new Map()
  let peakHeap = 0
  let peakHeapId = "-"
  for (const read of reads) {
    usageByKind[read.kind].reads += 1
    const heapBefore = process.memoryUsage().heapUsed
    try {
      const { session: parsed, stats } = await readCodexSession(read.path, { index })
      if (stats.requests === 0 && stats.turns > 0) noUsageSessions += 1
      if (stats.requests > 0) usageByKind[read.kind].withUsage += 1
      const heap = process.memoryUsage().heapUsed
      if (heap > peakHeap && heap > heapBefore) {
        peakHeap = heap
        peakHeapId = read.id + " " + (heap / (1024 * 1024)).toFixed(0) + " MB"
      }
      for (const [name, count] of unpairedByTool(parsed))
        unpairedCalls.set(name, (unpairedCalls.get(name) ?? 0) + count)
      turnsWithoutUsage += stats.turnsWithoutUsage
      for (const file of stats.segmentFiles) {
        if (parsedFiles.has(file)) continue
        parsedFiles.add(file)
        bytes += statSync(file).size
      }
      decompressed += stats.bytes
      frames += stats.frames
      lines += stats.lines
      invalid += stats.invalid
      turns += stats.turns
      requests += stats.requests
      exact += stats.exactInputTokens
      cached += stats.cachedInputTokens
      naiveCached += stats.naiveCachedAddedTokens
      lastToken += stats.lastTokenUsageTokens
      threadCumulative += stats.threadCumulativeTokens
      turnCumulative += stats.turnCumulativeTokens
      toolCalls += stats.toolCalls
      paired += stats.pairedToolCalls
      orphans += stats.orphanToolResults
      compactions += stats.compactions
      drops += stats.compactionDrops
      raw += stats.rawAttributionTokens
      toolAboveWindow += stats.toolResultsAboveWindow
      for (const turn of parsed.turns) {
        const gap = turn.attribution.residual?.tokens
        if (gap !== undefined) {
          residual.push(gap)
          if (turn.attribution.total.tokens > 0) {
            if (gap >= 0) shares.push(gap / turn.attribution.total.tokens)
            else overShares.push(-gap / turn.attribution.total.tokens)
          }
          const hasTools = turn.attribution.parts.some((slice) => slice.part === "tool-definitions")
          if (hasTools) {
            residualWithTools.turns += 1
            residualWithTools.tokens += Math.max(0, gap)
          } else {
            residualWithoutTools.turns += 1
            residualWithoutTools.tokens += Math.max(0, gap)
          }
        }
        const factor = turn.attribution.reconciled?.factor
        if (factor !== undefined) factors.push(factor)
      }
      for (const entry of parsed.dataQuality) {
        const key = entry.split(":")[0]
        quality.set(key, (quality.get(key) ?? 0) + 1)
      }
    } catch (error) {
      failures.push({ id: session.id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
  const rss = process.resourceUsage().maxRSS * 1024
  const missing = index.files.filter((file) => !parsedFiles.has(file.path))
  const out = []
  out.push("## Corpus run")
  out.push("")
  out.push("- root " + index.root)
  out.push(
    "- rollout files " +
      number(index.files.length) +
      " (" +
      number(index.skipped.length) +
      " skipped as non-session), logical sessions " +
      number(index.sessions.size) +
      ", failures " +
      failures.length
  )
  out.push(
    "- parsed " +
      number(parsedFiles.size) +
      "/" +
      number(index.files.length) +
      " rollout files in " +
      number(reads.length) +
      " reads, " +
      number(missing.length) +
      " never reached"
  )
  out.push(
    "- read " + mb(bytes) + " compressed, " + mb(decompressed) + " decompressed in " + number(frames) + " zstd frames"
  )
  out.push("- lines " + number(lines) + ", invalid " + number(invalid))
  out.push(
    "- wall time " +
      (elapsedMs / 1000).toFixed(2) +
      " s, peak RSS " +
      mb(rss) +
      " (" +
      (bytes / (1024 * 1024) / (elapsedMs / 1000)).toFixed(0) +
      " MB/s)"
  )
  out.push("")
  out.push(
    "- turns " +
      number(turns) +
      " (" +
      number(turnsWithoutUsage) +
      " without usage), usage records " +
      number(requests) +
      ", exact Σ input_tokens " +
      number(exact) +
      ", cached " +
      number(cached) +
      " (subset, not added)"
  )
  out.push(
    "- sessions that log no token_usage_record at all: " +
      number(noUsageSessions) +
      " (their turns have no exact anchor)"
  )
  out.push(
    "- roots " +
      number(usageByKind.root.reads) +
      " reads (" +
      number(usageByKind.root.withUsage) +
      " with usage), subagent threads " +
      number(usageByKind.child.reads) +
      " (" +
      number(usageByKind.child.withUsage) +
      " with usage)"
  )
  out.push("- largest retained heap after one read: " + peakHeapId)
  out.push("- trap 1 cached added: " + number(naiveCached) + " = " + ratio(naiveCached, exact))
  out.push("- trap 2 last_token_usage: " + number(lastToken) + " = " + ratio(lastToken, exact))
  out.push("- trap 3 thread_token_usage: " + number(threadCumulative) + " = " + ratio(threadCumulative, exact))
  out.push("- trap 4 turn_token_usage: " + number(turnCumulative) + " = " + ratio(turnCumulative, exact))
  out.push(
    "- tool calls " +
      number(toolCalls) +
      ", paired " +
      number(paired) +
      " (" +
      percent(paired / (toolCalls || 1)) +
      "), orphan results " +
      number(orphans) +
      (unpairedCalls.size === 0
        ? ""
        : ", unpaired by tool: " + [...unpairedCalls].map(([name, count]) => name + "=" + count).join(", "))
  )
  out.push("- compactions " + number(compactions) + ", measured drops " + number(drops))
  out.push(
    "- attribution raw estimate " +
      number(raw) +
      ", exact " +
      number(exact) +
      " (raw is a fraction of the prompt: the tool schemas are not in the log)"
  )
  const positive = residual.filter((value) => value > 0)
  const negative = residual.filter((value) => value < 0)
  out.push("- " + describe("residual tokens (unknown mass)", positive, number))
  out.push("- " + describe("residual tokens (over-counted)", negative, number))
  out.push("- " + describe("residual share (unknown mass)", shares, percent))
  out.push("- " + describe("residual share (over-counted)", overShares, percent))
  out.push("- " + describe("reconciled.factor", factors, (value) => value.toFixed(3)))
  out.push(
    "- turns whose tool-results estimate alone exceeds the whole window (logged output is far larger than what was sent): " +
      number(toolAboveWindow)
  )
  const residualTotal = residualWithoutTools.tokens + residualWithTools.tokens
  out.push(
    "- residual source: without a tool-definitions slice " +
      number(residualWithoutTools.turns) +
      " turns / " +
      number(residualWithoutTools.tokens) +
      " tokens (" +
      percent(residualWithoutTools.tokens / (residualTotal || 1)) +
      "); with one " +
      number(residualWithTools.turns) +
      " turns / " +
      number(residualWithTools.tokens) +
      " tokens"
  )
  out.push("")
  out.push("### dataQuality tokens")
  out.push("")
  out.push("| token | sessions |")
  out.push("| --- | ---: |")
  for (const [key, count] of [...quality].sort((a, b) => b[1] - a[1]).slice(0, 16))
    out.push("| " + key + " | " + count + " |")
  out.push("")
  out.push("### plaintext subset: files are segments, not sessions")
  out.push("")
  const plaintext = index.files.filter((file) => file.path.endsWith(".jsonl"))
  const groups = new Map()
  for (const file of plaintext) {
    const list = groups.get(file.meta.sessionId) ?? []
    list.push(file)
    groups.set(file.meta.sessionId, list)
  }
  out.push(
    "- plaintext rollout files " +
      number(plaintext.length) +
      " → logical sessions " +
      number(groups.size) +
      " (all rollout files: " +
      number(index.files.length) +
      " → " +
      number(index.sessions.size) +
      ")"
  )
  out.push("")
  out.push("| session | plaintext files | segments | subagent threads | workdir |")
  out.push("| --- | ---: | ---: | ---: | --- |")
  for (const [id, files] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const plan = index.sessions.get(id)
    const segments = plan === undefined ? files.length : plan.root.files.length
    const children = plan === undefined ? 0 : plan.children.length
    out.push(
      "| " +
        id +
        " | " +
        files.length +
        " | " +
        segments +
        " | " +
        children +
        " | …" +
        String(plan?.workdir ?? "").slice(-28) +
        " |"
    )
  }
  out.push("")
  if (failures.length > 0) {
    out.push("### failures")
    out.push("")
    for (const failure of failures.slice(0, 20)) out.push("- " + failure.id + ": " + failure.error)
  }
  return out.join("\n")
}

const argv = process.argv.slice(2)
if (argv[0] === "--corpus") {
  console.log(await runCorpus(argv[1] ?? defaultCodexRoot()))
} else if (argv.length > 0) {
  console.log(await runSamples(argv.map((file) => ({ label: "sample", file }))))
} else {
  const index = indexCodexCorpus(defaultCodexRoot())
  console.log(await runSamples(pickSamples(index)))
}
