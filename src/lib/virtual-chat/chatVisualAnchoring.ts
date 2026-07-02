import { type ChatHeightCache, calculateOffsetForIndex } from './chatMeasurement.svelte.js'
import type { ScrollAnchor } from './chatTypes.js'

export type VisualAnchor = ScrollAnchor

export type CaptureVisualAnchorArgs<T> = {
    messages: T[]
    getMessageId: (_message: T) => string
    heightCache: ChatHeightCache
    estimatedHeight: number
    visibleStart: number
    topGap: number
    headerHeight: number
    scrollTop: number
}

export type RestoreVisualAnchorArgs<T> = {
    anchor: VisualAnchor
    messages: T[]
    getMessageId: (_message: T) => string
    heightCache: ChatHeightCache
    estimatedHeight: number
    topGap: number
    headerHeight: number
}

/**
 * Capture the first visible message as a visual anchor before late layout
 * growth, so users scrolled away from bottom keep the same content in view.
 */
export const captureVisualAnchor = <T>(args: CaptureVisualAnchorArgs<T>): VisualAnchor | null => {
    const {
        messages,
        getMessageId,
        heightCache,
        estimatedHeight,
        visibleStart,
        topGap,
        headerHeight,
        scrollTop
    } = args

    if (messages.length === 0) return null

    const index = Math.min(Math.max(visibleStart, 0), messages.length - 1)
    const messageId = getMessageId(messages[index])
    const messageTop =
        topGap +
        headerHeight +
        calculateOffsetForIndex(messages, index, getMessageId, heightCache, estimatedHeight)

    return {
        messageId,
        offsetFromViewportTop: messageTop - scrollTop
    }
}

/**
 * Calculate the scrollTop that restores a captured visual anchor.
 */
export const restoreVisualAnchor = <T>(args: RestoreVisualAnchorArgs<T>): number | null => {
    const { anchor, messages, getMessageId, heightCache, estimatedHeight, topGap, headerHeight } =
        args
    // O(1) via the height cache's id→index map — this runs synchronously in
    // the per-measurement path, where an O(messages) scan would compound.
    heightCache.sync(messages, getMessageId, estimatedHeight)
    const index = heightCache.getIndexForId(anchor.messageId)
    if (index === -1) return null

    const messageTop =
        topGap +
        headerHeight +
        calculateOffsetForIndex(messages, index, getMessageId, heightCache, estimatedHeight)

    return Math.max(0, messageTop - anchor.offsetFromViewportTop)
}
