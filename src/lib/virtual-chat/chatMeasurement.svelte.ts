import type { VisibleRange } from './chatTypes.js'

/**
 * Reactive height cache for chat messages, backed by a prefix-sum array.
 *
 * Heights are stored in a plain object keyed by message ID; a parallel
 * prefix-sum array indexed by message position lets total/offset/range
 * queries stay O(1) and O(log n) at any list size. The cache is kept in
 * sync with the messages array via `sync(messages, getMessageId, est)`,
 * which the public functions below call before each query.
 *
 * A version counter triggers Svelte derivations whenever heights change.
 */
export class ChatHeightCache {
    #heights: Record<string, number> = $state({})
    #version = $state(0)

    // Position-indexed scaffolding kept in sync with the most recent
    // messages array passed to `sync()`. Plain class fields — making
    // these reactive would force re-derivation on every per-frame
    // measurement, defeating the point.
    #orderedIds: string[] = []
    #idToIndex: Record<string, number> = Object.create(null) as Record<string, number>
    #prefixSum: number[] = [0]
    #dirtyFromIndex = Number.POSITIVE_INFINITY
    #lastSyncedMessages: unknown = null
    #estimatedHeight = 0

    /** Get the measured height for a message, or undefined if not yet measured. */
    get(id: string): number | undefined {
        return this.#heights[id]
    }

    /** Set the measured height for a message. Returns true if the value changed. */
    set(id: string, height: number): boolean {
        if (this.#heights[id] === height) return false
        this.#heights[id] = height
        this.#version++
        const i = this.#idToIndex[id]
        if (i !== undefined && i < this.#dirtyFromIndex) this.#dirtyFromIndex = i
        return true
    }

    /** Remove a message from the cache (e.g. when messages are pruned). */
    delete(id: string): void {
        if (id in this.#heights) {
            delete this.#heights[id]
            this.#version++
            const i = this.#idToIndex[id]
            if (i !== undefined && i < this.#dirtyFromIndex) this.#dirtyFromIndex = i
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
        this.#orderedIds = []
        this.#idToIndex = Object.create(null) as Record<string, number>
        this.#prefixSum = [0]
        this.#dirtyFromIndex = Number.POSITIVE_INFINITY
        this.#lastSyncedMessages = null
        this.#version++
    }

    /**
     * Reconcile internal position state with a new messages array.
     *
     * Fast paths:
     * - No-op when the array reference is unchanged AND length matches.
     * - Append: tail-extends `#orderedIds` and `#prefixSum` in place.
     * - Prepend: rebuilds order and marks the prefix sum dirty from 0.
     * Otherwise: full rebuild + dirty=0.
     */
    sync<T>(
        messages: readonly T[],
        getMessageId: (_message: T) => string,
        estimatedHeight: number
    ): void {
        // A change in `estimatedHeight` invalidates every unmeasured slot in
        // the prefix sum, even when the messages array is identical.
        if (estimatedHeight !== this.#estimatedHeight) {
            this.#estimatedHeight = estimatedHeight
            this.#dirtyFromIndex = 0
        }

        const newN = messages.length
        const oldN = this.#orderedIds.length

        if (messages === this.#lastSyncedMessages && newN === oldN) return

        if (newN === 0) {
            this.#orderedIds = []
            this.#idToIndex = Object.create(null) as Record<string, number>
            this.#prefixSum = [0]
            this.#dirtyFromIndex = Number.POSITIVE_INFINITY
            this.#lastSyncedMessages = messages
            return
        }

        // Append fast path: every old id stays at its index; new ids tack on the
        // end. Sample head and tail of the old range — a single endpoint match
        // would treat `[1,2,3] -> [9,2,3,4]` as a clean append.
        if (
            oldN > 0 &&
            newN > oldN &&
            getMessageId(messages[0]) === this.#orderedIds[0] &&
            getMessageId(messages[oldN - 1]) === this.#orderedIds[oldN - 1]
        ) {
            for (let i = oldN; i < newN; i++) {
                const id = getMessageId(messages[i])
                this.#orderedIds.push(id)
                this.#idToIndex[id] = i
                const h = this.#heights[id] ?? this.#estimatedHeight
                this.#prefixSum.push(this.#prefixSum[i] + h)
            }
            this.#lastSyncedMessages = messages
            return
        }

        // Prepend fast path: every old id reappears, shifted by `newN - oldN`.
        // Sample both endpoints of the old range in their new positions.
        if (
            oldN > 0 &&
            newN > oldN &&
            getMessageId(messages[newN - oldN]) === this.#orderedIds[0] &&
            getMessageId(messages[newN - 1]) === this.#orderedIds[oldN - 1]
        ) {
            this.#rebuildOrdering(messages, getMessageId)
            this.#dirtyFromIndex = 0
            this.#lastSyncedMessages = messages
            this.#flushDirty()
            return
        }

        // Same-length no-op path — handles Svelte's `$state` proxy producing a
        // new reference for the same logical array. A full id walk is correct
        // and bounded: the alternative (falling through to rebuild) is also
        // O(n), so checking is never slower than rebuilding.
        if (newN === oldN) {
            let allMatch = true
            for (let i = 0; i < newN; i++) {
                if (getMessageId(messages[i]) !== this.#orderedIds[i]) {
                    allMatch = false
                    break
                }
            }
            if (allMatch) {
                this.#lastSyncedMessages = messages
                return
            }
        }

        // Full rebuild (splice/random reorder/length-shrink/etc).
        this.#rebuildOrdering(messages, getMessageId)
        this.#dirtyFromIndex = 0
        this.#lastSyncedMessages = messages
        this.#flushDirty()
    }

    /** Total content height — O(1) after dirty flush. */
    getTotalHeight(): number {
        this.#flushDirty()
        return this.#prefixSum[this.#orderedIds.length]
    }

    /** Pixel offset of message at `index` from the start of the messages section — O(1). */
    getOffsetForIndex(index: number): number {
        if (index <= 0) return 0
        const n = this.#orderedIds.length
        const clamped = index >= n ? n : index
        this.#flushDirty()
        return this.#prefixSum[clamped]
    }

    /**
     * Smallest index `i` whose message overlaps the viewport from below
     * (i.e. `prefixSum[i+1] > viewTop`). Returns -1 when every message is
     * above `viewTop` (viewport scrolled past the end).
     */
    findVisibleStart(viewTop: number): number {
        const n = this.#orderedIds.length
        if (n === 0) return -1
        this.#flushDirty()
        if (this.#prefixSum[n] <= viewTop) return -1
        let lo = 0
        let hi = n - 1
        while (lo < hi) {
            const mid = (lo + hi) >>> 1
            if (this.#prefixSum[mid + 1] > viewTop) hi = mid
            else lo = mid + 1
        }
        return lo
    }

    /**
     * Largest index `i` whose top sits above `viewBottom`
     * (i.e. `prefixSum[i] < viewBottom`). Returns -1 when every message is
     * at or below `viewBottom` (viewport scrolled past the start).
     */
    findVisibleEnd(viewBottom: number): number {
        const n = this.#orderedIds.length
        if (n === 0) return -1
        this.#flushDirty()
        if (this.#prefixSum[0] >= viewBottom) return -1
        let lo = 0
        let hi = n - 1
        while (lo < hi) {
            const mid = (lo + hi + 1) >>> 1
            if (this.#prefixSum[mid] < viewBottom) lo = mid
            else hi = mid - 1
        }
        return lo
    }

    #rebuildOrdering<T>(messages: readonly T[], getMessageId: (_message: T) => string): void {
        const n = messages.length
        const ids: string[] = new Array(n)
        const idx: Record<string, number> = Object.create(null) as Record<string, number>
        for (let i = 0; i < n; i++) {
            const id = getMessageId(messages[i])
            ids[i] = id
            idx[id] = i
        }
        this.#orderedIds = ids
        this.#idToIndex = idx
        this.#prefixSum = new Array(n + 1)
        this.#prefixSum[0] = 0
    }

    #flushDirty(): void {
        if (this.#dirtyFromIndex === Number.POSITIVE_INFINITY) return
        const n = this.#orderedIds.length
        const start = this.#dirtyFromIndex
        for (let i = start; i < n; i++) {
            const h = this.#heights[this.#orderedIds[i]] ?? this.#estimatedHeight
            this.#prefixSum[i + 1] = this.#prefixSum[i] + h
        }
        this.#prefixSum.length = n + 1
        this.#dirtyFromIndex = Number.POSITIVE_INFINITY
    }
}

/**
 * Calculate the total content height given messages and a height cache.
 *
 * @param messages - Array of message objects
 * @param getMessageId - Function to extract a unique ID from a message
 * @param heightCache - The reactive height cache instance
 * @param estimatedHeight - Fallback height in pixels for unmeasured messages
 * @returns Total content height in pixels
 */
export const calculateTotalHeight = <T>(
    messages: T[],
    getMessageId: (_message: T) => string,
    heightCache: ChatHeightCache,
    estimatedHeight: number
): number => {
    heightCache.sync(messages, getMessageId, estimatedHeight)
    return heightCache.getTotalHeight()
}

/**
 * Calculate the Y offset for a message at a given index.
 *
 * @param messages - Array of message objects
 * @param index - Target index to calculate offset for
 * @param getMessageId - Function to extract a unique ID from a message
 * @param heightCache - The reactive height cache instance
 * @param estimatedHeight - Fallback height in pixels for unmeasured messages
 * @returns Pixel offset from the top of the content area
 */
export const calculateOffsetForIndex = <T>(
    messages: T[],
    index: number,
    getMessageId: (_message: T) => string,
    heightCache: ChatHeightCache,
    estimatedHeight: number
): number => {
    heightCache.sync(messages, getMessageId, estimatedHeight)
    return heightCache.getOffsetForIndex(index)
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
 * Translates `scrollTop` from content-local coordinates (header + messages
 * + footer) into messages-local coordinates, then binary-searches the
 * cached prefix sum to locate the first/last messages that overlap the
 * viewport. Adds `overscan` items on each side to keep DOM stable while
 * scrolling.
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
 * from `scrollTop` so the search runs in the same coordinate space as the
 * cached prefix sum, and anchor the fallback to `messages.length - 1` when
 * the viewport has scrolled past every message (e.g. into a tall footer).
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

    heightCache.sync(messages, getMessageId, estimatedHeight)

    const topGap = Math.max(0, viewportHeight - totalHeight - headerHeight - footerHeight)

    // Translate scrollTop into messages-local coordinates by stripping out
    // the bottom-gravity gap and the header above the messages container.
    // We let `viewTop` go negative on purpose: when the viewport sits partly
    // (or entirely) inside the header, `viewBottom` then correctly falls
    // *below* messages-local 0 and the binary searches won't mark items as
    // visible that are actually occluded by the header.
    const viewTop = scrollTop - topGap - headerHeight
    const viewBottom = viewTop + viewportHeight

    let visibleStart = heightCache.findVisibleStart(viewTop)
    let visibleEnd = heightCache.findVisibleEnd(viewBottom)

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
