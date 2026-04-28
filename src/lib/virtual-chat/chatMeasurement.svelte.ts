import type { VisibleRange } from './chatTypes.js'

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

/**
 * Arguments for `calculateVisibleRange`.
 *
 * `totalHeight` is taken as an input so the caller can reuse the value it
 * already derives elsewhere; recomputing it here would walk the message
 * list a second time on every reactive update.
 */
export interface CalculateVisibleRangeArgs<T> {
    messages: T[]
    getMessageId: (_message: T) => string
    heightCache: ChatHeightCache
    estimatedHeight: number
    totalHeight: number
    scrollTop: number
    viewportHeight: number
    headerHeight: number
    footerHeight: number
    overscan: number
}

/**
 * Calculate the visible message range for a virtual chat viewport.
 *
 * Translates `scrollTop` from content-local coordinates (which include the
 * header, messages container, and footer) into messages-local coordinates,
 * then walks the message list to find which items overlap the viewport.
 * Adds `overscan` items on each side to keep DOM stable while scrolling.
 *
 * Layout assumed by this function (matches `SvelteVirtualChat.svelte`):
 *
 *     ┌─ scroll container (scrollTop) ───────────┐
 *     │  optional empty space (topGap, when      │
 *     │  content fits and bottom-gravity pushes  │
 *     │  everything down)                        │
 *     │  ── header (headerHeight) ──             │
 *     │  ── messages container (totalHeight) ──  │
 *     │  ── footer (footerHeight) ──             │
 *     └──────────────────────────────────────────┘
 *
 * The fix vs a naïve implementation: subtract `headerHeight` (and `topGap`)
 * from `scrollTop` so the loop walks message offsets in the same coordinate
 * space, and anchor the fallback to `messages.length - 1` when the viewport
 * has scrolled past every message (e.g. into a tall footer).
 *
 * @param args - See `CalculateVisibleRangeArgs`.
 * @returns The render range, plus the inner visible range without overscan.
 *
 * @example
 * ```ts
 * const range = calculateVisibleRange({
 *     messages, getMessageId: (m) => m.id, heightCache: cache,
 *     estimatedHeight: 72, scrollTop, viewportHeight,
 *     headerHeight, footerHeight, overscan: 6
 * })
 * const slice = messages.slice(range.start, range.end + 1)
 * ```
 */
export const calculateVisibleRange = <T>(args: CalculateVisibleRangeArgs<T>): VisibleRange => {
    const {
        messages,
        getMessageId,
        heightCache,
        estimatedHeight,
        totalHeight,
        scrollTop,
        viewportHeight,
        headerHeight,
        footerHeight,
        overscan
    } = args

    if (messages.length === 0 || viewportHeight === 0) {
        return { start: 0, end: 0, visibleStart: 0, visibleEnd: 0 }
    }

    const topGap = Math.max(0, viewportHeight - totalHeight - headerHeight - footerHeight)

    // Translate scrollTop into messages-local coordinates by stripping out
    // the bottom-gravity gap and the header above the messages container.
    // We let `viewTop` go negative on purpose: when the viewport sits partly
    // (or entirely) inside the header, `viewBottom` then correctly falls
    // *below* messages-local 0 and the loop won't mark items as visible
    // that are actually occluded by the header.
    const viewTop = scrollTop - topGap - headerHeight
    const viewBottom = viewTop + viewportHeight

    let offsetY = 0
    let visibleStart = -1
    let visibleEnd = -1

    for (let i = 0; i < messages.length; i++) {
        const id = getMessageId(messages[i])
        const h = heightCache.get(id) ?? estimatedHeight
        const itemTop = offsetY
        const itemBottom = offsetY + h

        if (itemBottom > viewTop && visibleStart === -1) {
            visibleStart = i
        }
        if (itemTop < viewBottom) {
            visibleEnd = i
        }

        offsetY += h

        // Once we've found the first visible item and walked past viewBottom,
        // every subsequent item is below the viewport — no need to keep going.
        if (visibleStart !== -1 && offsetY >= viewBottom) break
    }

    // Fallbacks for the edge case where the viewport sits entirely outside
    // the messages container — anchor to the closer end so we render at most
    // a couple of items, never the whole list.
    if (visibleStart === -1) {
        // Viewport is below the last message (e.g. user scrolled into a tall
        // footer). Anchor at the end so overscan walks backwards from there.
        visibleStart = messages.length - 1
    }
    if (visibleEnd === -1) {
        // Viewport is above the first message (only reachable with negative
        // scrollTop / odd layouts). Anchor at the beginning.
        visibleEnd = 0
    }

    const start = Math.max(0, visibleStart - overscan)
    const end = Math.min(messages.length - 1, visibleEnd + overscan)

    return { start, end, visibleStart, visibleEnd }
}
