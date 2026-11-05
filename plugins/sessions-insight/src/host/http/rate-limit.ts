/**
 * In-process sliding-window limiter for the balance refresh.
 *
 * `/balance` is loopback-only but still unauthenticated: any local process could
 * otherwise drive the provider (and the user's account) as fast as it likes. The
 * window counts only calls that really reach the provider, so the route decides
 * cache hits and in-flight reuse before asking for a slot.
 *
 * The clock is injectable so the window can be tested without waiting a minute;
 * there is no user setting for the limit (docs/API.md).
 *
 * @module @cyrusdoyle/dsh-sessions-insight/host/http/rate-limit
 */

/** Provider-triggering balance calls allowed per window. */
export const BALANCE_RATE_LIMIT = 6

/** Length of the sliding window. */
export const BALANCE_RATE_WINDOW_MS = 60_000

/** The tiny surface the route needs; tests can supply their own. */
export interface RateLimiter {
  /** Take one slot for a call about to reach the provider; false when full. */
  take(): boolean
}

export interface RateLimiterOptions {
  /** Clock override; defaults to `Date.now`. */
  now?: () => number
}

/**
 * Build one limiter. Slots older than the window are dropped before each take,
 * so the limit applies to every rolling 60 s rather than to fixed buckets.
 * @param options - limit, window and clock overrides.
 * @returns a limiter whose `take()` answers whether one more call may proceed.
 */
export function createBalanceRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const now = options.now ?? Date.now
  const slots: number[] = []
  return {
    take(): boolean {
      const at = now()
      // A clock moved backwards leaves the future slot in place rather than
      // freeing the window; that is the safe direction for a limiter.
      while (slots.length > 0 && at - slots[0]! >= BALANCE_RATE_WINDOW_MS) slots.shift()
      if (slots.length >= BALANCE_RATE_LIMIT) return false
      slots.push(at)
      return true
    },
  }
}
