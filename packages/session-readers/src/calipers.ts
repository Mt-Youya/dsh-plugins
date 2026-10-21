/**
 * Character-to-token conversion, shared by every adapter that has to estimate
 * a slice from text instead of reading a usage field.
 *
 * One coefficient cannot serve both dense JSON and prose, and Chinese costs
 * roughly twice as many tokens per character as English, so the calipers are
 * split by payload kind. Every constant below was fitted on this machine's
 * Claude corpus: 214 turns across the 33 session files that carry a
 * `prompt_snapshot`, minimising per-turn |estimate − usage| / usage against
 * the exact `input + cache_creation + cache_read` total. `node
 * scripts/probe-claude.mjs --corpus ~/.claude/projects` re-reports the fit on
 * demand; the numbers are measurements, not conventions.
 *
 * @see docs/IR.md (precision, basis)
 */

import type { Measure } from "@cyrus/dsh-session-contract"

/**
 * Compact JSON tool schemas: 2.26 characters per token.
 *
 * Why it is denser than prose: a schema is `{"type":"object","properties":…}`
 * — short quoted keys, punctuation between every token boundary. Feeding the
 * model 315 tools costs ~952 KB of characters ≈ 421 K tokens on this corpus,
 * which is why tool definitions dominate a Claude window.
 */
export const CHARS_PER_TOKEN_SCHEMA = 2.26

/**
 * Latin-script text as it actually appears in agent transcripts: 2.6 characters
 * per token.
 *
 * This is below the ~4 chars/token rule of thumb for English prose because
 * session content is mostly code, diffs, paths and file contents, all of which
 * tokenize far denser than prose. A dedicated prose-only caliper would
 * overestimate every code-heavy session.
 */
export const CHARS_PER_TOKEN_TEXT = 2.6

/**
 * CJK text: 1.24 characters per token.
 *
 * Chinese has no whitespace token boundaries and each ideograph is roughly one
 * token, so a mixed-language session drifts by ~10% per 10 points of CJK share
 * if it is folded into {@link CHARS_PER_TOKEN_TEXT}. Measured on sessions whose
 * CJK share ranges from 1% to 16%.
 */
export const CHARS_PER_TOKEN_CJK = 1.24

/**
 * Pixels per token for an image the model receives.
 *
 * An image is billed by its patch grid, not by the length of its base64: a
 * 190 KB screenshot costs ~1.5 K tokens, which is 127 characters per token.
 * Estimating from base64 length therefore overstates a screenshot session by
 * two orders of magnitude, so images take the `harness-projection` path and are
 * measured from the dimensions in their own header instead.
 */
export const PIXELS_PER_TOKEN = 750

/** Longest edge the harness keeps when downscaling an oversized image. */
export const MAX_IMAGE_EDGE = 1568

/** Tokens assumed when an image header cannot be decoded. */
export const IMAGE_TOKENS_FALLBACK = 1_500

/** Human-readable provenance of the calipers, for the panel and the probe report. */
export const CHAR_CALIBRATION_NOTE =
  `chars-per-token: schema ${CHARS_PER_TOKEN_SCHEMA}, text ${CHARS_PER_TOKEN_TEXT}, ` +
  `cjk ${CHARS_PER_TOKEN_CJK}; images: ${PIXELS_PER_TOKEN} px/token, ` +
  `${MAX_IMAGE_EDGE} px max edge`

const NON_ASCII = /[^\u0000-\u007f]/

/** Character counts separated by the caliper each one is converted with. */
export interface CharCounts {
  /** Latin-script text: prose, code, transcripts. */
  text: number
  /** CJK characters inside that same text. */
  cjk: number
  /** Serialized tool schemas and tool inputs. */
  schema: number
  /** Tokens already projected by the harness rule for images, not characters. */
  projected: number
}

/** A zeroed accumulator. Adapters mutate these while streaming a session. */
export function emptyCharCounts(): CharCounts {
  return { text: 0, cjk: 0, schema: 0, projected: 0 }
}

/** True when nothing was counted, so the part can be left out of `parts`. */
export function isEmptyCounts(counts: CharCounts): boolean {
  return counts.text === 0 && counts.cjk === 0 && counts.schema === 0 && counts.projected === 0
}

/**
 * Add one string to the text calipers.
 *
 * The ASCII fast path matters: a 490 MB corpus would otherwise pay a
 * per-character loop on every byte. Non-ASCII spans are rare enough that the
 * precise count there costs nothing measurable.
 * @param counts - accumulator to mutate.
 * @param value - text as it was sent to the model.
 */
export function addText(counts: CharCounts, value: string): void {
  if (value.length === 0) return
  // eslint-disable-next-line no-control-regex -- the test is "any non-ASCII byte".
  if (!NON_ASCII.test(value)) {
    counts.text += value.length
    return
  }
  let cjk = 0
  for (let index = 0; index < value.length; index += 1) {
    if (isCjkCode(value.charCodeAt(index))) cjk += 1
  }
  counts.cjk += cjk
  counts.text += value.length - cjk
}

function isCjkCode(code: number): boolean {
  return (
    (code >= 0x2e80 && code <= 0x2fdf) || // radicals, kangxi
    (code >= 0x3000 && code <= 0x303f) || // CJK punctuation
    (code >= 0x3040 && code <= 0x30ff) || // hiragana, katakana
    (code >= 0x3400 && code <= 0x4dbf) || // CJK ext A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK unified
    (code >= 0xac00 && code <= 0xd7af) || // hangul syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK compatibility
    (code >= 0xff00 && code <= 0xffef) // fullwidth forms
  )
}

/**
 * Add a structured value using its serialized length.
 *
 * Serialization is what the model actually receives: counting keys and values
 * separately would drop the punctuation that carries many of the tokens.
 * @param counts - accumulator to mutate.
 * @param value - JSON-serializable value.
 */
export function addSchema(counts: CharCounts, value: unknown): void {
  if (value === undefined) return
  const serialized = JSON.stringify(value)
  if (serialized === undefined) return
  counts.schema += serialized.length
}

/** Add an image payload; the bytes are read for their header and dropped. */
export function addImage(counts: CharCounts, value: unknown, mediaType?: string): void {
  if (typeof value !== "string" || value.length === 0) return
  counts.projected += estimateImageTokens(value, mediaType)
}

/**
 * Tokens an image costs, from the dimensions in its own header.
 *
 * Only the first few kilobytes of base64 are decoded: enough for a PNG IHDR, a
 * JPEG SOF marker, or a GIF/WebP header. Anything unrecognisable falls back to
 * {@link IMAGE_TOKENS_FALLBACK} rather than pretending to know.
 * @param base64 - the `source.data` payload as logged.
 * @param mediaType - optional `source.media_type`, used only to disambiguate.
 */
export function estimateImageTokens(base64: string, mediaType?: string): number {
  const size = imageSize(base64, mediaType)
  if (size === undefined) return IMAGE_TOKENS_FALLBACK
  let { width, height } = size
  if (width <= 0 || height <= 0) return IMAGE_TOKENS_FALLBACK
  const longest = Math.max(width, height)
  if (longest > MAX_IMAGE_EDGE) {
    const scale = MAX_IMAGE_EDGE / longest
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }
  return Math.max(1, Math.round((width * height) / PIXELS_PER_TOKEN))
}

/** Decode just enough of a base64 image to read its dimensions. */
function imageSize(base64: string, mediaType?: string): { width: number; height: number } | undefined {
  const head = base64.slice(0, 4_096)
  const bytes = Buffer.from(head, "base64")
  if (bytes.length < 16) return undefined
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (isPng) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegSize(bytes)
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    if (bytes.toString("ascii", 12, 15) === "VP8") {
      const width = bytes.readUInt16LE(26) & 0x3fff
      const height = bytes.readUInt16LE(28) & 0x3fff
      return { width, height }
    }
    if (bytes.toString("ascii", 12, 16) === "VP8X") {
      const width = 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16)
      const height = 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16)
      return { width, height }
    }
  }
  void mediaType
  return undefined
}

/** Walk JPEG segments until a start-of-frame marker states the size. */
function jpegSize(bytes: Buffer): { width: number; height: number } | undefined {
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1] ?? 0
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrame) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) }
    }
    const length = bytes.readUInt16BE(offset + 2)
    if (length <= 0) return undefined
    offset += 2 + length
  }
  return undefined
}

/** Convert the accumulator to a token estimate. Always an estimate. */
export function tokensOf(counts: CharCounts): number {
  return Math.round(
    counts.text / CHARS_PER_TOKEN_TEXT +
      counts.cjk / CHARS_PER_TOKEN_CJK +
      counts.schema / CHARS_PER_TOKEN_SCHEMA +
      counts.projected
  )
}

/** Turn the accumulator into a `Measure` marked `estimate`/`chars-per-token`. */
export function measureOf(counts: CharCounts): Measure {
  return { tokens: tokensOf(counts), precision: "estimate", basis: "chars-per-token" }
}

/** Turn an image accumulator into a `Measure` marked `harness-projection`. */
export function projectedMeasure(counts: CharCounts): Measure {
  return { tokens: tokensOf(counts), precision: "estimate", basis: "harness-projection" }
}
