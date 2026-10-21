/**
 * A tiny process-local LRU.
 *
 * A plugin that re-reads files shallowly needs a cache but must keep no
 * on-disk index, so this is the whole cache: a Map re-inserted on every hit,
 * evicting its oldest entry past capacity. Callers embed `mtimeMs` and `size`
 * in the key, so a rewritten file can never be served from a stale slot.
 *
 * @module @cyrus/dsh-plugin-kit-host/lru
 */

/** Bounded least-recently-used map. */
export class Lru<V> {
  readonly #capacity: number
  readonly #entries = new Map<string, V>()

  /**
   * @param capacity - maximum live entries; must be positive.
   */
  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error("lru: capacity must be a positive integer")
    this.#capacity = capacity
  }

  /** Entries currently held. */
  get size(): number {
    return this.#entries.size
  }

  /**
   * Read a value and mark it most recently used.
   * @param key - cache key.
   * @returns the value, or undefined when absent.
   */
  get(key: string): V | undefined {
    const value = this.#entries.get(key)
    if (value === undefined) return undefined
    this.#entries.delete(key)
    this.#entries.set(key, value)
    return value
  }

  /**
   * Insert or refresh a value, evicting the oldest entry past capacity.
   * @param key - cache key.
   * @param value - value to hold.
   */
  set(key: string, value: V): void {
    this.#entries.delete(key)
    this.#entries.set(key, value)
    while (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next()
      if (oldest.done === true) break
      this.#entries.delete(oldest.value)
    }
  }

  /**
   * Drop one entry.
   * @param key - cache key.
   */
  delete(key: string): void {
    this.#entries.delete(key)
  }

  /** Drop everything. */
  clear(): void {
    this.#entries.clear()
  }
}
