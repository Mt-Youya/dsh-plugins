/**
 * Browser-side plumbing a DSH plugin's panel is built from.
 *
 * The envelope-decoding fetch, the one-shot style injection and the two slot
 * registrations. Nothing here knows which plugin is calling it: the codes, the
 * style element id and the panel identity are arguments.
 *
 * @module @cyrus/dsh-plugin-kit-client
 */

export * from "./fetch.ts"
export * from "./register.ts"
export * from "./styles.ts"
