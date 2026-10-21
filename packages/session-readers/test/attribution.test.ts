import { describe, expect, it } from "vitest"
import {
  addSchema,
  addText,
  CHARS_PER_TOKEN_CJK,
  CHARS_PER_TOKEN_SCHEMA,
  CHARS_PER_TOKEN_TEXT,
  emptyCharCounts,
  estimateImageTokens,
  measureOf,
  PIXELS_PER_TOKEN,
  tokensOf,
} from "@cyrus/dsh-session-readers"
import { estimateMeasure, exactMeasure, sumMeasures } from "@cyrus/dsh-session-contract"

describe("estimation calipers", () => {
  it("marks every character-derived number as an estimate", () => {
    const counts = emptyCharCounts()
    addText(counts, "hello world")
    const measure = measureOf(counts)
    expect(measure.precision).toBe("estimate")
    expect(measure.basis).toBe("chars-per-token")
  })

  it("converts latin text with the text caliper", () => {
    const counts = emptyCharCounts()
    addText(counts, "x".repeat(Math.round(CHARS_PER_TOKEN_TEXT * 100)))
    expect(tokensOf(counts)).toBe(100)
  })

  it("converts CJK text with the CJK caliper, not the latin one", () => {
    const counts = emptyCharCounts()
    addText(counts, "中".repeat(Math.round(CHARS_PER_TOKEN_CJK * 100)))
    expect(counts.cjk).toBe(Math.round(CHARS_PER_TOKEN_CJK * 100))
    expect(tokensOf(counts)).toBe(100)
  })

  it("mixes both scripts inside one payload without one caliper eating the other", () => {
    const counts = emptyCharCounts()
    addText(counts, "abc" + "中".repeat(10))
    expect(counts.text).toBe(3)
    expect(counts.cjk).toBe(10)
    expect(tokensOf(counts)).toBeGreaterThan(Math.round(13 / CHARS_PER_TOKEN_TEXT) - 1)
  })

  it("converts structured payloads with the schema caliper", () => {
    const value = { type: "object", properties: { a: { type: "string" } } }
    const counts = emptyCharCounts()
    addSchema(counts, value)
    expect(counts.schema).toBe(JSON.stringify(value).length)
    expect(tokensOf(counts)).toBe(Math.round(counts.schema / CHARS_PER_TOKEN_SCHEMA))
  })

  it("keeps exact and estimated measures distinguishable when summed", () => {
    expect(sumMeasures([exactMeasure(10), exactMeasure(5)])).toEqual({ tokens: 15, precision: "exact", basis: "usage" })
    expect(sumMeasures([exactMeasure(10), estimateMeasure(5)])).toEqual({
      tokens: 15,
      precision: "estimate",
      basis: "chars-per-token",
    })
  })
})

describe("image projection", () => {
  /** Minimal PNG header carrying only the two dimensions. */
  function png(width: number, height: number): string {
    const bytes = Buffer.alloc(33)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0)
    bytes.write("IHDR", 12, "ascii")
    bytes.writeUInt32BE(width, 16)
    bytes.writeUInt32BE(height, 20)
    return bytes.toString("base64")
  }

  it("costs a pixel-grid share of the image, not a share of its base64", () => {
    expect(estimateImageTokens(png(750, 750))).toBe(750)
    expect(estimateImageTokens(png(1500, 1500))).toBe(3000)
  })

  it("downscales anything past the max edge before pricing it", () => {
    const small = estimateImageTokens(png(3136, 3136))
    expect(small).toBe(Math.round((1568 * 1568) / PIXELS_PER_TOKEN))
  })

  it("falls back to a stated constant when the header is unreadable", () => {
    expect(estimateImageTokens(Buffer.from("not an image").toString("base64"))).toBe(1500)
  })
})
