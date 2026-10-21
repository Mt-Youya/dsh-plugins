/**
 * Wire contract of the context-insight plugin.
 *
 * The plugin owns its route paths; everything else on the wire — the IR, the
 * payload types and their guards — is the shared session contract, re-exported
 * here so the Host, the browser half and the tests keep one import path.
 *
 * @module @cyrus/dsh-context-insight/protocol
 */

export * from "./protocol/paths.ts"
export * from "@cyrus/dsh-session-contract"
