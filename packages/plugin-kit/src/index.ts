/**
 * Plugin-agnostic wire primitives.
 *
 * Zero dependencies and browser-safe: the Host half, the browser half and any
 * future plugin share this module rather than one of them owning it.
 *
 * @module @cyrus/dsh-plugin-kit
 */

export * from "./envelope.ts"
export * from "./url.ts"
