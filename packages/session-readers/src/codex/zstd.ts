/**
 * Reading a Codex rollout as lines, whatever container it arrived in.
 *
 * Codex writes plain .jsonl, and .jsonl.zst as a single zstd frame. Even a
 * single frame is decompressed frame-by-frame rather than through a stream
 * decompressor: on this runtime node:zlib returns only the first frame and
 * reports success, so an appended frame would be lost without an error
 * (docs/adr/0004-multiframe-zstd.md). The compressed bytes are held once
 * (<= 36 MB per file in this corpus) and released per frame, so peak memory
 * tracks the largest decompressed frame, never the whole session.
 */

import { createReadStream, readFileSync } from "node:fs"
import { StringDecoder } from "node:string_decoder"
import { zstdDecompressSync } from "node:zlib"

/** Frame magic of the zstd container; every frame starts with these bytes. */
const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

/** Bytes handed to the line splitter at a time; keeps one 74 MB frame splittable. */
const CHUNK_BYTES = 1 << 20

/** Offsets of every frame start found by scanning for the frame magic. */
export function frameOffsets(compressed: Buffer): number[] {
  const offsets: number[] = []
  let index = compressed.indexOf(ZSTD_MAGIC, 0)
  while (index >= 0) {
    offsets.push(index)
    index = compressed.indexOf(ZSTD_MAGIC, index + ZSTD_MAGIC.length)
  }
  return offsets
}

/**
 * Decompress every frame and concatenate, which is what a streaming decoder
 * would do if it did not stop after the first frame.
 * @param compressed - raw file bytes.
 */
export function decompressFrames(compressed: Buffer): { data: Buffer; frames: number } {
  const offsets = frameOffsets(compressed)
  if (offsets.length === 0) throw new Error("not a zstd stream: no frame magic")
  const frames: Buffer[] = []
  for (let index = 0; index < offsets.length; index += 1) {
    const start = offsets[index] ?? 0
    const end = offsets[index + 1] ?? compressed.length
    frames.push(zstdDecompressSync(compressed.subarray(start, end)))
  }
  return { data: Buffer.concat(frames), frames: offsets.length }
}

/**
 * Turns decoded chunks into lines without holding the decoded text.
 *
 * Appends only the tail that has no newline yet, so a record split across
 * chunks is stitched while a file of ordinary 2 KB lines copies nothing.
 */
export class LineSplitter {
  private rest = ""

  /** Emit every complete line inside the chunk, keeping the trailing fragment. */
  feed(chunk: string, emit: (line: string) => void): void {
    if (chunk.length === 0) return
    let start = 0
    for (;;) {
      const newline = chunk.indexOf("\n", start)
      if (newline < 0) break
      const head = chunk.slice(start, newline)
      emit(stripCarriage(this.rest.length === 0 ? head : this.rest + head))
      this.rest = ""
      start = newline + 1
    }
    if (start < chunk.length) this.rest += chunk.slice(start)
  }

  /** Emit a final line that had no terminating newline. */
  end(emit: (line: string) => void): void {
    if (this.rest.length > 0) emit(stripCarriage(this.rest))
    this.rest = ""
  }
}

function stripCarriage(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line
}

/** What a line stream cost, for the probe report. */
export interface LineStreamStats {
  /** Non-empty lines emitted. */
  lines: number
  /** Payload bytes: decompressed bytes for zstd, raw bytes for plain files. */
  bytes: number
  /** zstd frames decompressed; 0 for a plain file. */
  frames: number
}

/**
 * Stream one rollout file, plain or zstd, line by line.
 * @param path - rollout file.
 * @param onLine - called with each non-empty line, in file order.
 */
export async function streamLines(path: string, onLine: (line: string) => void): Promise<LineStreamStats> {
  const stats: LineStreamStats = { lines: 0, bytes: 0, frames: 0 }
  const splitter = new LineSplitter()
  const emit = (line: string): void => {
    if (line.length === 0) return
    stats.lines += 1
    onLine(line)
  }

  if (path.endsWith(".zst")) {
    const compressed = readFileSync(path)
    const offsets = frameOffsets(compressed)
    if (offsets.length === 0) throw new Error("no zstd frame in " + path)
    for (let index = 0; index < offsets.length; index += 1) {
      const start = offsets[index] ?? 0
      const end = offsets[index + 1] ?? compressed.length
      const frame = zstdDecompressSync(compressed.subarray(start, end))
      stats.frames += 1
      stats.bytes += frame.length
      feedBytes(frame, splitter, emit)
    }
    splitter.end(emit)
    return stats
  }

  const decoder = new StringDecoder("utf8")
  for await (const chunk of createReadStream(path)) {
    const buffer = chunk as Buffer
    stats.bytes += buffer.length
    splitter.feed(decoder.write(buffer), emit)
  }
  splitter.feed(decoder.end(), emit)
  splitter.end(emit)
  return stats
}

/** Decode a decompressed frame in fixed-size chunks, honouring UTF-8 boundaries. */
function feedBytes(frame: Buffer, splitter: LineSplitter, emit: (line: string) => void): void {
  if (frame.length === 0) return
  const decoder = new StringDecoder("utf8")
  for (let offset = 0; offset < frame.length; offset += CHUNK_BYTES) {
    const end = Math.min(offset + CHUNK_BYTES, frame.length)
    splitter.feed(decoder.write(frame.subarray(offset, end)), emit)
  }
  splitter.feed(decoder.end(), emit)
}
