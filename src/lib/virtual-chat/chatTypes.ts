/**
 * Internal height cache entry for a single message.
 */
export type HeightCacheEntry = {
    /** Measured pixel height, or undefined if not yet measured */
    measured: number | undefined
    /** Whether the measurement is stale and needs re-measure */
    dirty: boolean
}

/**
 * Visible range result from the range calculation.
 */
export type VisibleRange = {
    /** First rendered index (including overscan) */
    start: number
    /** Last rendered index (including overscan) */
    end: number
    /** First truly visible index (no overscan) */
    visibleStart: number
    /** Last truly visible index (no overscan) */
    visibleEnd: number
}

/**
 * Scroll anchor for preserving position during history prepend.
 */
export type ScrollAnchor = {
    /** Message ID of the anchor */
    messageId: string
    /** Pixel offset from viewport top to the anchor message top */
    offsetFromViewportTop: number
}
