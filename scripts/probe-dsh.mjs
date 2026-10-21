#!/usr/bin/env node
/**
 * Re-runnable evidence run for the DSH adapter.
 *
 * Prints, per session: the frame scan, the projection's freshness against the
 * log's last seq, the exact context size of every turn against the harness's
 * own request split, and which basis each slice used. `--corpus` does the same
 * over every log under `~/.dsh/sessions` and reports wall time, peak RSS and
 * failures.
 *
 *   node scripts/probe-dsh.mjs                     # 3 named samples
 *   node scripts/probe-dsh.mjs <file.zstd> ...     # explicit samples
 *   node scripts/probe-dsh.mjs --corpus            # every session on this machine
 *
 * Each sample is also decoded a second time through the `zstd` CLI and the two
 * results are compared by length and SHA-256; the CLI is a cross-check only and
 * is never needed at runtime.
 *
 * Read-only: nothing is written anywhere, and no session is ever appended to.
 */

import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { CHAR_CALIBRATION_NOTE } from "../src/core/attribution.ts"
import { readDshSession } from "../src/core/dsh/index.ts"

const SESSIONS = join(homedir(), ".dsh", "sessions")

/** The three samples the milestone names: subagents+team, largest, ordinary. */
const DEFAULT_SAMPLES = [
  {
    label: "subagents+team",
    path: join(
      SESSIONS,
      "--Users-yonjay-codes-hubs-postgraduate--",
      "session-22cfe277-a1ba-4da3-a4b4-8cc8e25f829d",
      "session.v4.jsonl.zstd"
    ),
  },
  {
    label: "largest",
    path: join(
      SESSIONS,
      "--Users-yonjay-codes-hubs-postgraduate--",
      "session-32db0ba3-4c7b-4b92-86ff-8a699e7bb3c8",
      "session.v4.jsonl.zstd"
    ),
  },
  {
    label: "ordinary",
    path: join(
      SESSIONS,
      "--Users-yonjay-codes-ClaudeCode-dsh-claude-context--",
      "session-c086b68b-7c3c-4565-90fc-bc023ae81c1c",
      "session.v4.jsonl.zstd"
    ),
  },
].map((sample) => ({ ...sample, size: statSync(sample.path).size }))

const number = (value) => value.toLocaleString("en-US")
const percent = (value) => `${(value * 100).toFixed(1)}%`
const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`

/** Every `session.v4.jsonl.zstd` under the DSH session root. */
function collectSessions(root) {
  const files = []
  for (const bucket of readdirSync(root)) {
    let entries
    try {
      entries = readdirSync(join(root, bucket))
    } catch {
      continue
    }
    for (const directory of entries) {
      const path = join(root, bucket, directory, "session.v4.jsonl.zstd")
      try {
        files.push({ path, size: statSync(path).size })
      } catch {
        // A directory without a log is a session that never wrote one.
      }
    }
  }
  return files.sort((a, b) => b.size - a.size)
}

/** Decode the same bytes with the `zstd` CLI, or report why we could not. */
function zstdCrossCheck(file) {
  try {
    const output = execFileSync("zstd", ["-dc", file], { maxBuffer: 1 << 30 })
    return {
      bytes: output.length,
      sha256: createHash("sha256").update(output).digest("hex"),
    }
  } catch (error) {
    return { unavailable: error instanceof Error ? error.message : String(error) }
  }
}

/** Decode in-process the same way the adapter does, for the comparison. */
async function inProcessDigest(file) {
  const { decodeSessionLog } = await import("../src/core/dsh/frames.ts")
  const decoded = decodeSessionLog(readFileSync(file))
  return {
    text: decoded.text,
    bytes: Buffer.byteLength(decoded.text, "utf8"),
    sha256: createHash("sha256").update(Buffer.from(decoded.text, "utf8")).digest("hex"),
    frames: decoded.frames,
    badFrames: decoded.badFrames,
  }
}

function basisLabel(turn) {
  const bases = new Set(turn.attribution.parts.map((slice) => slice.measure.basis))
  if (bases.size === 0) return "none"
  return bases.has("harness-projection") ? "projection" : "log"
}

async function probeOne(entry) {
  const started = process.hrtime.bigint()
  const before = process.memoryUsage().rss
  const { session, stats } = await readDshSession(entry.path)
  const rss = Math.max(before, process.memoryUsage().rss)
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6

  const rows = session.turns.map((turn) => {
    const summed = turn.attribution.parts.reduce((total, slice) => total + slice.measure.tokens, 0)
    const exact = turn.attribution.total.tokens
    const residual = turn.attribution.residual?.tokens ?? 0
    return {
      index: turn.index,
      source: basisLabel(turn),
      usageContext: turn.usage?.totalContext ?? 0,
      exact,
      summed,
      residual,
      factor: turn.attribution.reconciled?.factor,
      identity: summed + residual === exact,
      coverage: exact === 0 ? 0 : summed / exact,
      parts: turn.attribution.parts.length,
      tools: turn.toolCalls.length,
      subagents: turn.subagents.length,
    }
  })

  return { entry, session, stats, rows, elapsedMs, rss }
}

function renderSample(result) {
  const { entry, session, stats, rows } = result
  const lines = []
  lines.push(`### ${entry.label} — ${entry.path}`)
  lines.push("")
  lines.push(
    `- size ${mb(entry.size)}, parsed in ${result.elapsedMs.toFixed(0)} ms, ${session.turns.length} turns, ${stats.requests} model requests`
  )
  lines.push(
    `- frames ${number(stats.frames)}, bad ${stats.badFrames}, torn tail ${stats.tornTail ? "yes" : "no"}, leading bytes ${stats.leadingBytes}`
  )
  lines.push(`- lines ${number(stats.lines)} → parsed ${number(stats.parsed)} (${number(stats.invalid)} invalid)`)
  lines.push(
    `- projection: ${stats.projectionStatus}, checkpoint seq ${stats.projectionMaxSeq} vs log seq ${stats.lastLogSeq}, ${number(stats.projectionRequests)} request records`
  )
  lines.push(
    `- tool calls paired ${number(stats.pairedToolCalls)}, orphan results ${number(stats.orphanToolResults)}, compactions ${number(stats.compactions)}, subagent links ${number(stats.subagentLinks)}`
  )
  lines.push(
    `- attribution basis: projection turns ${number(stats.projectionTurns)}, log-estimate turns ${number(stats.estimateTurns)}, residual turns ${number(stats.residualTurns)}`
  )
  if (result.crossCheck !== undefined) {
    const check = result.crossCheck
    if (check.available === false) {
      lines.push(`- zstd cross-check: unavailable (${check.reason})`)
    } else {
      lines.push(
        `- zstd cross-check: in-process ${number(check.inProcess.bytes)} B sha256 ${check.inProcess.sha256.slice(0, 16)}… vs zstd-cli ${number(check.cli.bytes)} B sha256 ${check.cli.sha256.slice(0, 16)}… → ${check.match ? "identical" : "MISMATCH"}`
      )
    }
  }
  lines.push(`- dataQuality: ${session.dataQuality.join(", ") || "(none)"}`)
  lines.push("")
  lines.push(
    "| turn | source | usage.totalContext | attribution.total | match | parts sum | residual | reconciled.factor | Σparts+residual | coverage |"
  )
  lines.push("| ---: | :--- | ---: | ---: | :---: | ---: | ---: | ---: | :---: | ---: |")
  for (const row of rows) {
    const match = row.usageContext === row.exact ? "exact" : `DRIFT ${number(row.usageContext - row.exact)}`
    lines.push(
      `| ${row.index} | ${row.source} | ${number(row.usageContext)} | ${number(row.exact)} | ${match} | ${number(row.summed)} | ${number(row.residual)} | ${row.factor === undefined ? "—" : row.factor.toFixed(3)} | ${row.identity ? "ok" : "BROKEN"} | ${percent(row.coverage)} |`
    )
  }
  lines.push("")
  return lines.join("\n")
}

async function runSamples(entries) {
  const out = ["# DSH context probe", "", `calibration: ${CHAR_CALIBRATION_NOTE}`, ""]
  const totals = { turns: 0, projection: 0, estimate: 0, residual: 0, exact: 0, summed: 0, identities: 0 }
  for (const entry of entries) {
    const result = await probeOne(entry)
    const cross = zstdCrossCheck(entry.path)
    const mine = await inProcessDigest(entry.path)
    result.crossCheck =
      "unavailable" in cross
        ? { available: false, reason: cross.unavailable }
        : {
            available: true,
            inProcess: mine,
            cli: cross,
            match: cross.sha256 === mine.sha256 && cross.bytes === mine.bytes,
          }
    for (const row of result.rows) {
      totals.turns += 1
      if (row.source === "projection") totals.projection += 1
      else if (row.source === "log") totals.estimate += 1
      if (row.residual !== 0) totals.residual += 1
      totals.exact += row.exact
      totals.summed += row.summed
      if (row.identity) totals.identities += 1
    }
    out.push(renderSample(result))
  }
  out.push("## totals")
  out.push("")
  out.push(
    `- turns ${number(totals.turns)} (${number(totals.projection)} projection-based, ${number(totals.estimate)} log-estimated, ${number(totals.residual)} with a residual)`
  )
  out.push(
    `- slices total ${number(totals.summed)} against exact ${number(totals.exact)} = ${percent(totals.exact === 0 ? 0 : totals.summed / totals.exact)} coverage`
  )
  out.push(`- identity Σparts+residual=total holds on ${totals.identities}/${totals.turns} turns`)
  out.push("")
  return out.join("\n")
}

async function runCorpus(entries, share) {
  const out = ["# DSH context probe — corpus", "", `calibration: ${CHAR_CALIBRATION_NOTE}`, ""]
  const started = process.hrtime.bigint()
  let peakRss = 0
  let ok = 0
  let failed = 0
  const failures = []
  const totals = {
    frames: 0,
    badFrames: 0,
    torn: 0,
    requests: 0,
    turns: 0,
    projectionTurns: 0,
    estimateTurns: 0,
    residualTurns: 0,
    projectionSlices: 0,
    estimateSlices: 0,
    projectionTokens: 0,
    estimateTokens: 0,
    paired: 0,
    orphans: 0,
    subagents: 0,
    stale: 0,
    missing: 0,
  }
  for (const entry of entries) {
    try {
      const { session, stats } = await readDshSession(entry.path)
      ok += 1
      totals.frames += stats.frames
      totals.badFrames += stats.badFrames
      if (stats.tornTail) totals.torn += 1
      totals.requests += stats.requests
      totals.turns += session.turns.length
      totals.projectionTurns += stats.projectionTurns
      totals.estimateTurns += stats.estimateTurns
      totals.residualTurns += stats.residualTurns
      totals.paired += stats.pairedToolCalls
      totals.orphans += stats.orphanToolResults
      totals.subagents += stats.subagentLinks
      if (stats.projectionStatus === "stale") totals.stale += 1
      if (stats.projectionStatus === "missing") totals.missing += 1
      for (const turn of session.turns) {
        for (const slice of turn.attribution.parts) {
          if (slice.measure.basis === "harness-projection") {
            totals.projectionSlices += 1
            totals.projectionTokens += slice.measure.tokens
          } else {
            totals.estimateSlices += 1
            totals.estimateTokens += slice.measure.tokens
          }
        }
      }
      const rss = process.memoryUsage().rss
      if (rss > peakRss) peakRss = rss
      if (share) process.stdout.write(".")
    } catch (error) {
      failed += 1
      failures.push({ path: entry.path, reason: error instanceof Error ? error.message : String(error) })
    }
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
  if (share) process.stdout.write("\n")

  const slices = totals.projectionSlices + totals.estimateSlices
  out.push("## corpus")
  out.push("")
  out.push(`- sessions ${number(entries.length)}: ${number(ok)} parsed, ${number(failed)} failed`)
  out.push(
    `- frames ${number(totals.frames)}, bad ${number(totals.badFrames)}, sessions with a torn tail ${number(totals.torn)}`
  )
  out.push(
    `- model requests ${number(totals.requests)}, turns ${number(totals.turns)}, turns with a residual ${number(totals.residualTurns)}`
  )
  out.push(
    `- projection fresh ${number(entries.length - totals.stale - totals.missing)}, stale ${number(totals.stale)}, missing ${number(totals.missing)}`
  )
  out.push(
    `- tool calls paired ${number(totals.paired)}, orphan results ${number(totals.orphans)}, subagent links ${number(totals.subagents)}`
  )
  out.push(
    `- slices by basis: harness-projection ${number(totals.projectionSlices)} (${percent(slices === 0 ? 0 : totals.projectionSlices / slices)}), chars-per-token ${number(totals.estimateSlices)} (${percent(slices === 0 ? 0 : totals.estimateSlices / slices)})`
  )
  out.push(
    `- tokens by basis: harness-projection ${number(totals.projectionTokens)}, chars-per-token ${number(totals.estimateTokens)}`
  )
  out.push(`- wall ${elapsedMs.toFixed(0)} ms, peak RSS ${mb(peakRss)}`)
  if (failures.length > 0) {
    out.push("")
    out.push("### failures")
    out.push("")
    for (const failure of failures) out.push(`- ${failure.path}: ${failure.reason}`)
  }
  out.push("")
  return out.join("\n")
}

const args = process.argv.slice(2)
const corpus = args.includes("--corpus")
const explicit = args.filter((argument) => !argument.startsWith("--"))

if (corpus) {
  const all = collectSessions(SESSIONS)
  process.stdout.write(`probing ${all.length} sessions`)
  process.stdout.write(await runCorpus(all, true))
} else {
  const samples =
    explicit.length > 0
      ? explicit.map((file) => ({ label: "explicit", path: file, size: statSync(file).size }))
      : DEFAULT_SAMPLES
  process.stdout.write(await runSamples(samples))
}
