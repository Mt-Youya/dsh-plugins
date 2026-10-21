/**
 * Who wrote a `user/message`, and what text it carried.
 *
 * DSH writes several kinds of user-role message. Only `source.kind === 'user'`
 * is a human typing; approvals, subagent settlement notices and relayed agent
 * messages are the harness talking to itself through the same surface event.
 * Counting those as human input would inflate every turn's "you asked" column
 * and, worse, invent turn boundaries where nobody spoke.
 */

import { arrayField, isObject, objectField, stringField, type JsonObject } from "./records.ts"

/** Source kinds that represent a person, not the harness. */
const HUMAN_SOURCE_KINDS = new Set(["user"])

/**
 * Whether one `user/message` came from a human.
 * @param data - the event's `data`.
 */
export function isHumanUserMessage(data: JsonObject): boolean {
  const source = objectField(data, "source")
  const kind = stringField(source, "kind")
  return kind !== undefined && HUMAN_SOURCE_KINDS.has(kind)
}

/** One text block, and whether it is prose or a reasoning trace. */
export interface ContentText {
  text: string
  reasoning: boolean
}

/**
 * Extract the text of a content block array.
 *
 * Blocks are `{ type: 'text', text }` or `{ type: 'reasoning', text }`; an
 * image block carries bytes rather than text and is returned separately.
 * @param blocks - a `message.content` array.
 */
export function contentTexts(blocks: readonly unknown[]): ContentText[] {
  const out: ContentText[] = []
  for (const block of blocks) {
    if (!isObject(block)) continue
    const type = stringField(block, "type")
    if (type !== "text" && type !== "reasoning") continue
    const text = stringField(block, "text")
    if (text !== undefined && text.length > 0) out.push({ text, reasoning: type === "reasoning" })
  }
  return out
}

/** One image block's inline payload. */
export interface ContentImage {
  data: string
  mediaType?: string
}

/** Extract the image blocks of a content array. */
export function contentImages(blocks: readonly unknown[]): ContentImage[] {
  const out: ContentImage[] = []
  for (const block of blocks) {
    if (!isObject(block)) continue
    if (stringField(block, "type") !== "image") continue
    const source = objectField(block, "source")
    const data = stringField(source, "data") ?? stringField(block, "data")
    if (data === undefined || data.length === 0) continue
    const mediaType = stringField(source, "media_type") ?? stringField(block, "mediaType")
    out.push(mediaType === undefined ? { data } : { data, mediaType })
  }
  return out
}

/** Read the content array of a message object. */
export function messageContent(message: JsonObject | undefined): readonly unknown[] {
  return arrayField(message, "content") ?? []
}
