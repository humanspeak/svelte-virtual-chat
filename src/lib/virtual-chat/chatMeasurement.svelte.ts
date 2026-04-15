/**
 * Reactive height cache for chat messages.
 *
 * Uses Svelte 5 runes for fine-grained reactivity. Heights are stored
 * in a plain object keyed by message ID, and a version counter triggers
 * derived recalculations when any height changes.
 */
export class ChatHeightCache {
    #heights: Record<string, number> = $state({})
    #version = $state(0)

    /** Get the measured height for a message, or undefined if not yet measured. */
    get(id: string): number | undefined {
        return this.#heights[id]
    }

    /** Set the measured height for a message. Returns true if the value changed. */
    set(id: string, height: number): boolean {
        if (this.#heights[id] === height) return false
        this.#heights[id] = height
        this.#version++
        return true
    }

    /** Remove a message from the cache (e.g. when messages are pruned). */
    delete(id: string): void {
        if (id in this.#heights) {
            delete this.#heights[id]
            this.#version++
        }
    }

    /** Check if a message has been measured. */
    has(id: string): boolean {
        return id in this.#heights
    }

    /** Number of measured entries. */
    get size(): number {
        void this.#version
        return Object.keys(this.#heights).length
    }

    /** Current version — use this to establish reactive dependencies on any height change. */
    get version(): number {
        return this.#version
    }

    /** Clear all cached heights. */
    clear(): void {
        this.#heights = {}
        this.#version++
    }
}

/**
 * Calculate the total content height given messages and a height cache.
 *
 * Sums measured heights for known messages and uses the estimated height
 * for any messages not yet measured by ResizeObserver.
 *
 * @param messages - Array of message objects
 * @param getMessageId - Function to extract a unique ID from a message
 * @param heightCache - The reactive height cache instance
 * @param estimatedHeight - Fallback height in pixels for unmeasured messages
 * @returns Total content height in pixels
 *
 * @example
 * ```ts
 * const total = calculateTotalHeight(messages, (m) => m.id, cache, 72)
 * ```
 */
export const calculateTotalHeight = <T>(
    messages: T[],
    getMessageId: (_message: T) => string,
    heightCache: ChatHeightCache,
    estimatedHeight: number
): number => {
    let total = 0
    for (const msg of messages) {
        const id = getMessageId(msg)
        total += heightCache.get(id) ?? estimatedHeight
    }
    return total
}

/**
 * Calculate the Y offset for a message at a given index.
 *
 * Sums the heights of all messages before the target index to determine
 * the pixel offset from the top of the content area.
 *
 * @param messages - Array of message objects
 * @param index - Target index to calculate offset for
 * @param getMessageId - Function to extract a unique ID from a message
 * @param heightCache - The reactive height cache instance
 * @param estimatedHeight - Fallback height in pixels for unmeasured messages
 * @returns Pixel offset from the top of the content area
 *
 * @example
 * ```ts
 * const offset = calculateOffsetForIndex(messages, 5, (m) => m.id, cache, 72)
 * ```
 */
export const calculateOffsetForIndex = <T>(
    messages: T[],
    index: number,
    getMessageId: (_message: T) => string,
    heightCache: ChatHeightCache,
    estimatedHeight: number
): number => {
    let offset = 0
    for (let i = 0; i < index && i < messages.length; i++) {
        const id = getMessageId(messages[i])
        offset += heightCache.get(id) ?? estimatedHeight
    }
    return offset
}
