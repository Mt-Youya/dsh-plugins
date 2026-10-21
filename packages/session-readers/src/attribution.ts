/**
 * Re-export of the shared calipers.
 *
 * The coefficients and the image projection moved to ./calipers.ts so this
 * module can stay the stable import path every adapter already uses. Nothing
 * else lives here on purpose: a caliper is a measurement claim, and keeping all
 * of them in one file is what makes them reviewable together.
 *
 * @see ./calipers.ts
 * @see docs/IR.md (精度、估算口径)
 */

export * from "./calipers.ts"
