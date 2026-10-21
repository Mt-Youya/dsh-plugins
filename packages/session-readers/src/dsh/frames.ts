/**
 * Splitting a DSH session log into its Zstandard frames.
 *
 * DSH appends one frame per durable write, so a single file is a *concatenation*
 * of frames. Node's `zstdDecompressSync` decodes the first frame and silently
 * ignores the rest (272-frame sample: 284 B returned for 955,090 B of real
 * content), and `createZstdDecompress` throws `Unknown frame descriptor` on the
 * second frame. Both failures are silent misses of ~99.97% of the log, so the
 * frame boundary has to be found here rather than delegated to zlib.
 *
 * @see docs/adr/0004-multiframe-zstd.md
 */

import { zstdDecompressSync } from "node:zlib"

/** Frame magic, little-endian `0xFD2FB528`. */
const ZSTD_MAGIC = Uint8Array.from([0x28, 0xb5, 0x2f, 0xfd])

/** What one log file decoded into, including everything that went wrong. */
export interface DecodedLog {
  /** Concatenated plaintext of every complete frame. */
  text: string
  /** Frames actually decoded, i.e. what `text` was built from. */
  frames: number
  /** Frames that were found but could not be decoded. A non-zero value is a defect. */
  badFrames: number
  /**
   * True when the last frame was incomplete.
   *
   * DSH appends without an fsync barrier, so a crash can leave a partial final
   * frame. That frame is dropped rather than failing the whole session: the
   * events it held were never acknowledged as committed.
   */
  tornTail: boolean
  /** Bytes before the first magic. Non-zero means the file is not a pure log. */
  leadingBytes: number
}

/** Bounds for {@link decodeSessionLog}. */
export interface DecodeOptions {
  /**
   * Stop after this many decoded frames.
   *
   * A caller that only needs the head of a large log hands in a byte prefix and
   * caps the frame count, so the rest of the file is never touched.
   */
  maxFrames?: number
}

/**
 * Offsets of every candidate frame start, in file order.
 *
 * The scan is a magic search, so a payload can theoretically contain the magic
 * itself; {@link decodeSessionLog} resolves that by merging forward when a
 * candidate does not decode.
 */
function frameOffsets(buffer: Uint8Array): number[] {
  const offsets: number[] = []
  const view = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let at = view.indexOf(ZSTD_MAGIC, 0)
  while (at >= 0) {
    offsets.push(at)
    at = view.indexOf(ZSTD_MAGIC, at + ZSTD_MAGIC.length)
  }
  return offsets
}

/**
 * Decode every frame of one session log.
 *
 * A middle frame that fails is counted and skipped: losing one write is better
 * than refusing to show a session, and the caller reports the loss through
 * `Session.dataQuality`. Only the final frame is allowed to be torn.
 * @param buffer - raw bytes of a `session.v4.jsonl.zstd` file, or a prefix of one.
 * @param options - see {@link DecodeOptions}.
 */
export function decodeSessionLog(buffer: Uint8Array, options: DecodeOptions = {}): DecodedLog {
  const limit = options.maxFrames ?? Number.POSITIVE_INFINITY
  const offsets = frameOffsets(buffer)
  if (offsets.length === 0) {
    return { text: "", frames: 0, badFrames: 0, tornTail: false, leadingBytes: buffer.length }
  }
  const pieces: Uint8Array[] = []
  let badFrames = 0
  let tornTail = false
  let index = 0
  let decoded = 0
  while (index < offsets.length && decoded < limit) {
    const start = offsets[index]
    if (start === undefined) break
    const direct = offsets[index + 1] ?? buffer.length
    try {
      pieces.push(zstdDecompressSync(buffer.subarray(start, direct)))
      index += 1
      decoded += 1
      continue
    } catch {
      // A magic inside a payload splits one frame in two; merging forward until
      // the bytes decode recovers the real boundary instead of losing both.
      let merged = false
      for (let probe = index + 2; probe <= offsets.length; probe += 1) {
        const end = offsets[probe] ?? buffer.length
        try {
          pieces.push(zstdDecompressSync(buffer.subarray(start, end)))
          index = probe
          merged = true
          decoded += 1
          break
        } catch {
          continue
        }
      }
      if (merged) continue
      // A head-only read always ends in the middle of a frame; that is not
      // corruption, so it is reported as a torn tail rather than a bad frame.
      if (index === offsets.length - 1) tornTail = true
      else badFrames += 1
      index += 1
    }
  }
  return {
    text: Buffer.concat(pieces).toString("utf8"),
    frames: decoded,
    badFrames,
    tornTail,
    leadingBytes: offsets[0] ?? 0,
  }
}

/** Split decoded plaintext into the JSON lines it contains. */
export function splitLogLines(text: string): string[] {
  const lines: string[] = []
  for (const line of text.split("\n")) {
    if (line.length > 0) lines.push(line)
  }
  return lines
}
