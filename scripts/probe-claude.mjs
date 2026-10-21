#!/usr/bin/env node
/**
 * Re-runnable evidence run for the Claude adapter.
 *
 * Prints, per session: turns, the exact context size of every turn against the
 * logged `usage`, the attribution total against it, de-duplication counters,
 * the naive-vs-normalized usage comparison (the ~3.3x trap), and the parse
 * cost. `--corpus <dir>` does the same over every transcript under a directory
 * and reports wall time, peak RSS and failures.
 *
 *   node scripts/probe-claude.mjs                     # 3 known samples
 *   node scripts/probe-claude.mjs <file.jsonl> ...    # explicit samples
 *   node scripts/probe-claude.mjs --corpus ~/.claude/projects
 *
 * Read-only: nothing is written anywhere.
 */

import { readdirSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { readClaudeSession } from "../src/core/claude/index.ts"
import { CHAR_CALIBRATION_NOTE } from "../src/core/attribution.ts"

const PROJECTS = join(homedir(), ".claude", "projects")

/** A single request cannot carry more context than this in any Claude model. */
const PLAUSIBLE_CONTEXT = 1_000_000

/** The three samples the milestone names: compaction, subagents, largest. */
const DEFAULT_SAMPLES = [
  {
    label: "compaction",
    file: join(PROJECTS, "-Users-yonjay-codes-hubs-auto-chat", "18729bd6-268b-4fd0-aa4a-f583e06b8e24.jsonl"),
  },
  {
    label: "subagents",
    file: join(PROJECTS, "-Users-yonjay-codes-hubs-portfolio", "bb877db6-b85a-4ab6-afef-e5a4c4f274f9.jsonl"),
  },
  {
    label: "largest",
    file: join(PROJECTS, "-Users-yonjay-codes-hubs-auto-chat", "681f8ece-4282-4eb4-966d-48918bd107d2.jsonl"),
  },
]

const number = (value) => value.toLocaleString("en-US")
const percent = (value) => `${(value * 100).toFixed(1)}%`
const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

function collectTranscripts(root) {
  const files = []
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith(".jsonl")) files.push(path)
    }
  }
  walk(root)
  return files.sort()
}

async function probeOne(file, label) {
  const size = statSync(file).size
  const started = process.hrtime.bigint()
  const { session, stats } = await readClaudeSession(file)
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6

  const rows = session.turns.map((turn) => {
    const raw = stats.rawByTurn[turn.index - 1] ?? 0
    const exact = turn.attribution.total.tokens
    const summed = turn.attribution.parts.reduce((total, slice) => total + slice.measure.tokens, 0)
    const usage = turn.usage
    return {
      index: turn.index,
      // `usage.totalContext` is the peak request of the turn; summing every
      // request's counters here would count the same carried window N times.
      usageContext: usage === undefined ? 0 : usage.totalContext,
      requests: usage === undefined ? 0 : usage.input + usage.cacheRead + usage.cacheWrite,
      exact,
      summed,
      raw,
      rawDeviation: exact === 0 ? 0 : (raw - exact) / exact,
      finalDeviation: exact === 0 ? 0 : (summed - exact) / exact,
      residual: turn.attribution.residual?.tokens ?? 0,
      factor: turn.attribution.reconciled?.factor,
      identity: summed + (turn.attribution.residual?.tokens ?? 0) === exact,
      parts: turn.attribution.parts.length,
    }
  })

  let exactTotal = 0
  let rawTotal = 0
  let summedTotal = 0
  let residualTotal = 0
  let scaled = 0
  let keptResidual = 0
  let identities = 0
  for (const row of rows) {
    exactTotal += row.exact
    rawTotal += row.raw
    summedTotal += row.summed
    residualTotal += row.residual
    if (row.factor !== undefined) scaled += 1
    else keptResidual += 1
    if (row.identity) identities += 1
  }

  return {
    file,
    label,
    size,
    elapsedMs,
    session,
    stats,
    rows,
    exactTotal,
    rawTotal,
    summedTotal,
    residualTotal,
    scaled,
    keptResidual,
    identities,
    parseMs: elapsedMs,
  }
}

function renderSample(result) {
  const lines = []
  lines.push(`### ${result.label} — ${result.file}`)
  lines.push("")
  lines.push(
    `- size ${mb(result.size)}, parsed in ${result.parseMs.toFixed(0)} ms, ${result.session.turns.length} turns, ${result.session.segments.length} segments`
  )
  lines.push(
    `- rows: ${number(result.stats.lines)} raw → ${number(result.stats.deduped)} after uuid dedupe (${number(result.stats.duplicates)} copies, ${number(result.stats.invalid)} invalid)`
  )
  lines.push(
    `- unique message.id: ${number(result.stats.messageIds)} (usage inconsistent on ${number(result.stats.inconsistentUsage)})`
  )
  const ratio =
    result.stats.normalizedContextTokens === 0
      ? 0
      : result.stats.naiveContextTokens / result.stats.normalizedContextTokens
  lines.push(
    `- naive usage sum ${number(result.stats.naiveContextTokens)} vs normalized ${number(result.stats.normalizedContextTokens)} = ${ratio.toFixed(2)}x inflation if summed per record`
  )
  lines.push(
    `- tool calls paired ${number(result.stats.pairedToolCalls)}, orphan results ${number(result.stats.orphanToolResults)}, compactions ${number(result.stats.compactions)}, subagent files ${number(result.stats.subagentFiles.length)}`
  )
  lines.push(
    `- attribution: exact ${number(result.exactTotal)}, raw estimate ${number(result.rawTotal)} (${percent((result.rawTotal - result.exactTotal) / (result.exactTotal || 1))}), parts ${number(result.summedTotal)}, residual ${number(result.residualTotal)}`
  )
  lines.push(
    `- turns scaled ${result.scaled}, turns keeping a residual ${result.keptResidual}, structural gaps ${result.stats.structuralGapTurns}, negative residual without gap ${result.stats.overCountedWithoutGap}, identity Σparts+residual=total on ${result.identities}/${result.rows.length}`
  )
  lines.push(`- dataQuality: ${result.session.dataQuality.join(", ") || "(none)"}`)
  lines.push("")
  lines.push(
    "| turn | usage.totalContext | attribution.total | match | parts sum | residual | factor | Σparts+residual | raw vs ctx |"
  )
  lines.push("| ---: | ---: | ---: | :---: | ---: | ---: | ---: | :---: | ---: |")
  for (const row of result.rows) {
    const match = row.usageContext === row.exact ? "exact" : `DRIFT ${number(row.usageContext - row.exact)}`
    lines.push(
      `| ${row.index} | ${number(row.usageContext)} | ${number(row.exact)} | ${match} | ${number(row.summed)} | ${number(row.residual)} | ${row.factor === undefined ? "—" : row.factor.toFixed(3)} | ${row.identity ? "ok" : "BROKEN"} | ${percent(row.rawDeviation)} |`
    )
  }
  lines.push("")
  return lines.join("\n")
}

async function runSamples(samples) {
  const out = ["# Claude context probe", "", `calibration: ${CHAR_CALIBRATION_NOTE}`, ""]
  for (const sample of samples) {
    try {
      const result = await probeOne(sample.file, sample.label)
      out.push(renderSample(result))
    } catch (error) {
      out.push(
        `### ${sample.label} — ${sample.file}`,
        "",
        `FAILED: ${error instanceof Error ? error.message : String(error)}`,
        ""
      )
    }
  }
  return out.join("\n")
}

async function runCorpus(root) {
  const files = collectTranscripts(root)
  const started = process.hrtime.bigint()
  let bytes = 0
  let turns = 0
  let exact = 0
  let raw = 0
  let naive = 0
  let normalized = 0
  const withSnapshot = { files: 0, exact: 0, raw: 0 }
  const withoutSnapshot = { files: 0, exact: 0, raw: 0 }
  let implausible = 0
  let implausibleTokens = 0
  let scaledTurns = 0
  let residualTurns = 0
  let underAttributed = 0
  let overAttributed = 0
  let structuralGapTurns = 0
  let overCountedWithoutGap = 0
  let identities = 0
  let checkedTurns = 0
  const factors = []
  const failures = []
  const anomalies = []
  for (const file of files) {
    bytes += statSync(file).size
    try {
      const { session, stats } = await readClaudeSession(file)
      turns += session.turns.length
      naive += stats.naiveContextTokens
      normalized += stats.normalizedContextTokens
      structuralGapTurns += stats.structuralGapTurns
      overCountedWithoutGap += stats.overCountedWithoutGap
      // A handful of subagent transcripts log a single request with millions of
      // cached tokens. They are counted, then excluded from the accuracy figure,
      // because a >1M-token prompt is not a context this model can have had.
      let fileExact = 0
      let fileRaw = 0
      for (const turn of session.turns) {
        const attribution = turn.attribution
        const total = attribution.total.tokens
        let summed = 0
        for (const slice of attribution.parts) summed += slice.measure.tokens
        const residual = attribution.residual?.tokens ?? 0
        // The identity is what a view relies on to draw a closed bar.
        checkedTurns += 1
        if (summed + residual === total) identities += 1
        if (attribution.reconciled === undefined) {
          residualTurns += 1
          if (residual >= 0) underAttributed += 1
          else overAttributed += 1
        } else {
          scaledTurns += 1
          factors.push(attribution.reconciled.factor)
        }
        if (total > PLAUSIBLE_CONTEXT) {
          implausible += 1
          implausibleTokens += total
          continue
        }
        fileExact += total
        fileRaw += stats.rawByTurn[turn.index - 1] ?? 0
      }
      exact += fileExact
      raw += fileRaw
      // A transcript with no `prompt_snapshot` never records the tool schemas,
      // which are ~95% of a Claude window; its raw attribution can only cover
      // the messages, so the two groups are reported apart.
      const bucket = session.dataQuality.includes("prompt-snapshot-missing") ? withoutSnapshot : withSnapshot
      bucket.files += 1
      bucket.exact += fileExact
      bucket.raw += fileRaw
      for (const entry of session.dataQuality) {
        if (entry.startsWith("attribution-reconciled") || entry.startsWith("compaction-window-not-lowered")) {
          anomalies.push({ file, entry })
        }
      }
    } catch (error) {
      failures.push({ file, error: error instanceof Error ? error.message : String(error) })
    }
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
  const rss = process.resourceUsage().maxRSS * 1024
  const lines = []
  lines.push("## Corpus run")
  lines.push("")
  lines.push(`- files ${number(files.length)}, bytes ${mb(bytes)}, failures ${failures.length}`)
  lines.push(
    `- wall time ${(elapsedMs / 1000).toFixed(2)} s, peak RSS ${mb(rss)} (${(bytes / (1024 * 1024) / (elapsedMs / 1000)).toFixed(0)} MB/s)`
  )
  lines.push(
    `- turns ${number(turns)}, exact context ${number(exact)}, raw attribution ${number(raw)} (${percent((raw - exact) / (exact || 1))})`
  )
  lines.push(
    `- excluded ${number(implausible)} turns logging more than ${number(PLAUSIBLE_CONTEXT)} tokens (${number(implausibleTokens)} tokens) as context-above-model-window`
  )
  factors.sort((left, right) => left - right)
  const pick = (quantile) => {
    if (factors.length === 0) return "—"
    const index = Math.min(factors.length - 1, Math.max(0, Math.round((factors.length - 1) * quantile)))
    return factors[index].toFixed(3)
  }
  lines.push(
    `- reconcile: scaled ${number(scaledTurns)} turns, residual kept on ${number(residualTurns)} turns (under-attributed ${number(underAttributed)}, over-attributed ${number(overAttributed)}), factor p50/p95/max = ${pick(0.5)}/${pick(0.95)}/${pick(1)}`
  )
  lines.push(
    `- structural gaps ${number(structuralGapTurns)} turns; negative residual without a gap ${number(overCountedWithoutGap)} (must be 0)`
  )
  lines.push(`- identity Σparts + residual === total on ${number(identities)}/${number(checkedTurns)} turns`)
  lines.push(
    `- naive usage sum ${number(naive)} vs normalized ${number(normalized)} = ${(naive / (normalized || 1)).toFixed(2)}x`
  )
  lines.push(
    `- with prompt_snapshot: ${withSnapshot.files} files, exact ${number(withSnapshot.exact)}, raw ${number(withSnapshot.raw)} (${percent((withSnapshot.raw - withSnapshot.exact) / (withSnapshot.exact || 1))})`
  )
  lines.push(
    `- without prompt_snapshot: ${withoutSnapshot.files} files, exact ${number(withoutSnapshot.exact)}, raw ${number(withoutSnapshot.raw)} (${percent((withoutSnapshot.raw - withoutSnapshot.exact) / (withoutSnapshot.exact || 1))})`
  )
  for (const failure of failures.slice(0, 10)) lines.push(`- FAILED ${failure.file}: ${failure.error}`)
  for (const anomaly of anomalies.slice(0, 12))
    lines.push(`- anomaly ${anomaly.file.split("/").slice(-2).join("/")}: ${anomaly.entry}`)
  return lines.join("\n")
}

const argv = process.argv.slice(2)
if (argv[0] === "--corpus") {
  console.log(await runCorpus(argv[1] ?? PROJECTS))
} else if (argv.length > 0) {
  console.log(await runSamples(argv.map((file) => ({ label: "sample", file }))))
} else {
  console.log(await runSamples(DEFAULT_SAMPLES))
}
