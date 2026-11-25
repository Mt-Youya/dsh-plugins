/**
 * A minimal protobuf wire reader for Antigravity's on-disk steps.
 *
 * Antigravity's storage schema is closed source: each conversation is a SQLite
 * database whose `steps.step_payload` and `steps.metadata` columns hold protobuf
 * blobs with no published `.proto`. The field numbers used here were recovered
 * from the `agy` binary's embedded descriptors and cross-checked against real
 * databases (see the module's citations in `session.ts`); unknown fields are
 * skipped by wire type, so a future build that adds fields keeps decoding.
 *
 * Only the wire format is implemented — varint, 64-bit, 32-bit and
 * length-delimited — because that is all these payloads use. Groups are skipped
 * as unsupported proto2 remnants.
 *
 * @module @cyrusdoyle/dsh-session-readers/harness/antigravity/proto
 */

/** One decoded field. Exactly one of `value`/`bytes` is meaningful. */
export interface ProtoField {
  number: number
  wire: number
  value: number
  bytes: Uint8Array
}

const WIRE_VARINT = 0
const WIRE_FIXED64 = 1
const WIRE_LENGTH = 2
const WIRE_FIXED32 = 5

/** Decode a varint; answers `undefined` when the buffer ends mid-value. */
function readVarint(buffer: Uint8Array, offset: number): { value: number; next: number } | undefined {
  let result = 0
  let scale = 1
  let cursor = offset
  while (cursor < buffer.length && cursor - offset < 10) {
    const byte = buffer[cursor] ?? 0
    cursor += 1
    result += (byte & 0x7f) * scale
    if ((byte & 0x80) === 0) return { value: result, next: cursor }
    scale *= 128
  }
  return undefined
}

/**
 * Decode one message into its top-level fields.
 *
 * A malformed tail stops decoding and returns what was read so far: a partially
 * written step is common while the tool is still appending.
 * @param buffer - raw protobuf bytes.
 * @returns the decoded fields, in wire order.
 */
export function parseFields(buffer: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = []
  let cursor = 0
  while (cursor < buffer.length) {
    const tag = readVarint(buffer, cursor)
    if (tag === undefined) break
    cursor = tag.next
    const number = Math.floor(tag.value / 8)
    const wire = tag.value % 8
    if (wire === WIRE_VARINT) {
      const value = readVarint(buffer, cursor)
      if (value === undefined) break
      cursor = value.next
      fields.push({ number, wire, value: value.value, bytes: EMPTY })
      continue
    }
    if (wire === WIRE_LENGTH) {
      const length = readVarint(buffer, cursor)
      if (length === undefined) break
      cursor = length.next
      const end = cursor + length.value
      if (end > buffer.length || end < cursor) break
      fields.push({ number, wire, value: 0, bytes: buffer.subarray(cursor, end) })
      cursor = end
      continue
    }
    if (wire === WIRE_FIXED64) {
      if (cursor + 8 > buffer.length) break
      cursor += 8
      fields.push({ number, wire, value: 0, bytes: buffer.subarray(cursor - 8, cursor) })
      continue
    }
    if (wire === WIRE_FIXED32) {
      if (cursor + 4 > buffer.length) break
      cursor += 4
      fields.push({ number, wire, value: 0, bytes: buffer.subarray(cursor - 4, cursor) })
      continue
    }
    // Groups and reserved wire types: nothing in these payloads uses them.
    break
  }
  return fields
}

const EMPTY = new Uint8Array(0)

/**
 * First field with the given number.
 * @param fields - decoded fields.
 * @param number - protobuf field number.
 * @returns the field, or undefined.
 */
export function findField(fields: readonly ProtoField[], number: number): ProtoField | undefined {
  return fields.find((field) => field.number === number)
}

/** True when the bytes are valid UTF-8 with no control characters beyond tab/newline. */
export function isPrintable(bytes: Uint8Array): boolean {
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return false
  }
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    if (code === 9 || code === 10 || code === 13) continue
    if (code < 32) return false
  }
  return true
}

/** UTF-8 string when printable, else undefined. */
export function printableOf(bytes: Uint8Array): string | undefined {
  return isPrintable(bytes) ? new TextDecoder().decode(bytes) : undefined
}

/**
 * Milliseconds of a `google.protobuf.Timestamp` blob.
 * @param bytes - `{1: seconds, 2: nanos}`.
 * @returns epoch milliseconds, or undefined when the blob is not a timestamp.
 */
export function timestampOf(bytes: Uint8Array): number | undefined {
  const fields = parseFields(bytes)
  const seconds = findField(fields, 1)
  if (seconds === undefined || seconds.wire !== WIRE_VARINT || seconds.value <= 0) return undefined
  const nanos = findField(fields, 2)
  const fraction = nanos === undefined || nanos.wire !== WIRE_VARINT ? 0 : nanos.value / 1_000_000
  return Math.round(seconds.value * 1000 + fraction)
}

/** Longest string the scanner will report, so a giant blob is not one "text". */
const MAX_SCAN_STRING = 64 * 1024

/**
 * Visit every printable length-delimited string, depth-first.
 *
 * Antigravity puts tool names and their JSON arguments in adjacent string
 * fields whose numbers differ per step type, so the tool reader looks for the
 * pair instead of trusting one path.
 * @param buffer - raw protobuf bytes.
 * @param visit - return false to stop the walk.
 */
export function scanStrings(buffer: Uint8Array, visit: (text: string) => boolean): void {
  let stopped = false
  const walk = (bytes: Uint8Array, depth: number): void => {
    if (stopped || depth > 6) return
    for (const field of parseFields(bytes)) {
      if (field.wire !== WIRE_LENGTH) continue
      if (field.bytes.length > MAX_SCAN_STRING) continue
      const text = printableOf(field.bytes)
      if (text !== undefined && text !== "") {
        if (!visit(text)) {
          stopped = true
          return
        }
      }
      // Nested message: recurse, but only when the bytes are not text.
      if (text === undefined) walk(field.bytes, depth + 1)
    }
  }
  walk(buffer, 0)
}

/** JSON payloads Antigravity embeds for a tool call. */
const TOOL_SIGNATURES = [
  '{"toolAction"',
  '{"toolSummary"',
  '{"AbsolutePath"',
  '{"CommandLine"',
  '{"Cwd"',
  '{"FilePath"',
  '{"Query"',
  '{"Pattern"',
]

/** True for the bareword identifier that names the tool just before its JSON. */
function isBareword(text: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_.-]{1,63}$/.test(text) && !text.includes(" ")
}

function isToolJson(text: string): boolean {
  return TOOL_SIGNATURES.some((signature) => text.startsWith(signature))
}

/**
 * Find the first tool call in a step payload.
 * @param buffer - step payload bytes.
 * @returns tool name, its raw JSON arguments, and the JSON string.
 */
export function scanToolCall(buffer: Uint8Array): { name: string; args: string } | undefined {
  let previous = ""
  let found: { name: string; args: string } | undefined
  scanStrings(buffer, (text) => {
    if (isToolJson(text)) {
      found = { name: previous, args: text }
      return false
    }
    if (isBareword(text)) previous = text
    return true
  })
  return found
}
