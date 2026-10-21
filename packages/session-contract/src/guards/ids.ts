/**
 * Guards for values that arrive as strings but have to be an identifier.
 *
 * @module @cyrus/dsh-session-contract/guards/ids
 */

/**
 * Whether a value is an identifier this plugin hands to the filesystem.
 *
 * Deliberately a whitelist, not a "reject dots" check: a session id is a uuid,
 * and anything else (a path, an encoded separator, a dot segment) is refused
 * before it can reach `join`.
 * @param value - candidate id.
 * @returns true for `[A-Za-z0-9._-]` of length 1..128 that is not a dot segment.
 */
export function isSafeId(value: string): boolean {
  if (value.length === 0 || value.length > 128) return false
  if (!/^[A-Za-z0-9._-]+$/.test(value)) return false
  return value !== "." && value !== ".."
}

/**
 * Whether a string is an identifier rather than a title.
 *
 * Session titles reach the panel from three adapters; two of them can fall back
 * to the session's own id, and a raw uuid in a title cell reads as a bug. The
 * panel drops such a title and shows 未命名会话 plus the first input instead.
 * @param value - candidate title.
 * @returns true for a uuid, a `session-<uuid>`, or a bare long hex id.
 */
export function isIdShaped(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  const bare = trimmed.startsWith("session-") ? trimmed.slice("session-".length) : trimmed
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bare)) return true
  return /^[0-9a-f]{8,64}$/i.test(bare)
}
