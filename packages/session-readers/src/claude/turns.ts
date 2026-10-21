/**
 * Deciding what counts as one turn, and what counts as a human.
 *
 * A turn starts at a real user input, not at a record type: tool results and
 * attachment records are `user` records too, and Claude Code also writes its
 * own command wrappers into the transcript as user messages. Both are filtered
 * here so `Turn.userInput` only ever contains what a person typed.
 */

/** Opening tags of messages the harness writes on the user's behalf. */
const INJECTED_WRAPPERS: readonly string[] = [
  "<local-command-caveat>",
  "<local-command-stdout>",
  "<command-name>",
  "<command-message>",
  "<command-args>",
  "<bash-input>",
  "<bash-stdout>",
  "<task-notification>",
  "<system-reminder>",
  "<user-prompt-submit-hook>",
]

const SYSTEM_REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g

/**
 * Whether a user message is a harness injection rather than a human.
 * @param text - the record's string content, already trimmed of whitespace.
 */
export function isInjectedUserMessage(text: string): boolean {
  const head = text.trimStart()
  for (const wrapper of INJECTED_WRAPPERS) {
    if (head.startsWith(wrapper)) return true
  }
  return false
}

/**
 * The human part of a user message, or undefined when there is none.
 *
 * System reminders are injected *inside* otherwise real messages when the
 * harness updates context mid-turn, so they are cut out instead of causing the
 * whole message to be dropped.
 * @param text - raw string content of a `user` record.
 */
export function humanText(text: string): string | undefined {
  if (isInjectedUserMessage(text)) return undefined
  const stripped = text.replace(SYSTEM_REMINDER, "").trim()
  return stripped.length === 0 ? undefined : stripped
}
