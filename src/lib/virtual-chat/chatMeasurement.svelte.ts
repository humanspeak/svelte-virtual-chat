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
        // Access version to establish reactive dependency
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
 */
export function calculateTotalHeight<T>(
    messages: T[],
    getMessageId: (message: T) => string,
    heightCache: ChatHeightCache,
    estimatedHeight: number
): number {
    let total = 0
    for (const msg of messages) {
        const id = getMessageId(msg)
        total += heightCache.get(id) ?? estimatedHeight
    }
    return total
}

/**
 * Calculate the Y offset for a message at a given index.
 */
export function calculateOffsetForIndex<T>(
    messages: T[],
    index: number,
    getMessageId: (message: T) => string,
    heightCache: ChatHeightCache,
    estimatedHeight: number
): number {
    let offset = 0
    for (let i = 0; i < index && i < messages.length; i++) {
        const id = getMessageId(messages[i])
        offset += heightCache.get(id) ?? estimatedHeight
    }
    return offset
}
