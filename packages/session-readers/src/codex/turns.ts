/**
 * Deciding what counts as one turn, and what counts as a human.
 *
 * A turn is a turn_id, not a record type: turn_context, response_item.message
 * and token_usage_record all state it, and 92,258 of 97,074 response items carry
 * it in internal_chat_message_metadata_passthrough. Records that state no turn
 * id (world_state, compacted, session_meta) belong to whatever turn is open.
 *
 * Codex writes a lot of non-human text into user messages: the environment
 * block, AGENTS.md instructions, skill bodies, plugin and browser context, and
 * file listings. Those are context, and only the remainder is a person typing.
 */

import { isObject, objectField, stringField, type Envelope, type JsonObject } from "./records.ts"

/** Where an injected user-message block belongs in the attribution. */
export type InjectedKind =
  | "environment"
  | "instructions"
  | "skills"
  | "plugins"
  | "files"
  | "browser"
  | "apps"
  | "documentation"

/** A user message split into the human part and the injected blocks. */
export interface UserBlocks {
  /** What a person typed, with injected blocks cut out. */
  human?: string
  injected: Array<{ kind: InjectedKind; text: string }>
}

/** Blocks that close with a tag, so they can be cut out anywhere in a message. */
const CLOSED_BLOCKS: Array<{ kind: InjectedKind; pattern: RegExp }> = [
  { kind: "environment", pattern: /<environment_context>[\s\S]*?<\/environment_context>/g },
  { kind: "skills", pattern: /<skill>[\s\S]*?<\/skill>/g },
  { kind: "instructions", pattern: /<user_instructions>[\s\S]*?<\/user_instructions>/g },
  { kind: "instructions", pattern: /<INSTRUCTIONS>[\s\S]*?<\/INSTRUCTIONS>/g },
]

/**
 * Markers that are never closed.
 *
 * They always start their own message, so a message beginning with one is an
 * injection in full rather than a wrapper around a human request.
 */
const OPEN_MARKERS: Array<{ kind: InjectedKind; prefix: string }> = [
  { kind: "browser", prefix: "<in-app-browser-context" },
  { kind: "apps", prefix: "<external_codex_apps_open" },
  { kind: "plugins", prefix: "<recommended_plugins>" },
  { kind: "environment", prefix: "<environment_context>" },
  { kind: "files", prefix: "# Files mentioned by the user" },
  { kind: "files", prefix: "# Files pasted by the user" },
  { kind: "instructions", prefix: "# AGENTS.md instructions" },
  { kind: "browser", prefix: "# Browser comments" },
  { kind: "browser", prefix: "# Response annotations" },
  { kind: "browser", prefix: "# In app browser" },
  { kind: "documentation", prefix: "The following is the Codex" },
]

/**
 * Split one user message.
 *
 * World state duplicates the AGENTS.md text verbatim (115 of 115 files that
 * carry both), so the message form is the one that is counted and the state
 * snapshot is only a fallback; counting both would double the memory block.
 * @param text - the message's text content, blocks concatenated.
 */
export function classifyUserMessage(text: string): UserBlocks {
  const injected: Array<{ kind: InjectedKind; text: string }> = []
  let rest = text
  for (const block of CLOSED_BLOCKS) {
    rest = rest.replace(block.pattern, (match: string) => {
      injected.push({ kind: block.kind, text: match })
      return " "
    })
  }
  const trimmed = rest.trim()
  for (const marker of OPEN_MARKERS) {
    if (!trimmed.startsWith(marker.prefix)) continue
    injected.push({ kind: marker.kind, text: trimmed })
    return { injected }
  }
  return trimmed.length === 0 ? { injected } : { human: trimmed, injected }
}

/** Concatenate the text blocks of a message, ignoring images. */
export function messageText(payload: JsonObject): string {
  const content = payload["content"]
  if (!Array.isArray(content)) return ""
  let text = ""
  for (const block of content) {
    if (!isObject(block)) continue
    const value = stringField(block, "text")
    if (value !== undefined) text += value
  }
  return text
}

/** The turn a record belongs to, when the record says. */
export function turnIdOf(envelope: Envelope): string | undefined {
  const payload = envelope.payload
  const passthrough = objectField(payload, "internal_chat_message_metadata_passthrough")
  const fromPayload = passthrough === undefined ? undefined : stringField(passthrough, "turn_id")
  if (fromPayload !== undefined) return fromPayload
  const direct = stringField(payload, "turn_id")
  if (direct !== undefined) return direct
  const metadata = objectField(envelope.record, "metadata")
  const retained = metadata === undefined ? undefined : objectField(metadata, "retained_source")
  const id = retained === undefined ? undefined : objectField(retained, "id")
  return id === undefined ? undefined : stringField(id, "turn_id")
}
