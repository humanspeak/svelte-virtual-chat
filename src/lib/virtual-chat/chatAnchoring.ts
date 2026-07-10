import type { ChatHeightCache } from './chatMeasurement.svelte.js'
import type { ScrollAnchor } from './chatTypes.js'

/**
 * Capture a scroll anchor before a history prepend operation.
 *
 * Records the first visible message and its pixel offset from the
 * viewport top, so the same visual position can be restored after
 * new messages are inserted above.
 *
 * @param messages - Current array of message objects
 * @param getMessageId - Function to extract a unique ID from a message
 * @param heightCache - The reactive height cache instance
 * @param estimatedHeight - Fallback height in pixels for unmeasured messages
 * @param scrollTop - Current scrollTop of the viewport
 * @returns A scroll anchor object, or null if messages is empty
 *
 * @example
 * ```ts
 * const anchor = captureScrollAnchor(messages, (m) => m.id, cache, 72, viewport.scrollTop)
 * // ... prepend older messages ...
 * const newScrollTop = restoreScrollAnchor(anchor, messages, (m) => m.id, cache, 72)
 * ```
 */
export const captureScrollAnchor = <T>(
    messages: T[],
    getMessageId: (_message: T) => string,
    heightCache: ChatHeightCache,
    estimatedHeight: number,
    scrollTop: number
): ScrollAnchor | null => {
    if (messages.length === 0) return null

    heightCache.sync(messages, getMessageId, estimatedHeight)

    const visibleStart = heightCache.findVisibleStart(scrollTop)
    // -1 means scrollTop is past all content — anchor to the last message,
    // matching the previous linear-walk fallback.
    const anchorIndex = visibleStart === -1 ? messages.length - 1 : visibleStart

    return {
        messageId: getMessageId(messages[anchorIndex]),
        offsetFromViewportTop: heightCache.getOffsetForIndex(anchorIndex) - scrollTop
    }
}

/**
 * Restore scroll position after a history prepend using a previously captured anchor.
 *
 * Finds the anchor message in the (now larger) message array and calculates
 * the scrollTop value that places it at the same visual offset from the
 * viewport top as when the anchor was captured.
 *
 * @param anchor - The scroll anchor captured before prepend
 * @param messages - Updated message array (with prepended messages)
 * @param getMessageId - Function to extract a unique ID from a message
 * @param heightCache - The reactive height cache instance
 * @param estimatedHeight - Fallback height in pixels for unmeasured messages
 * @returns The scrollTop value to restore the visual position, or 0 if anchor not found
 *
 * @example
 * ```ts
 * const scrollTop = restoreScrollAnchor(anchor, messages, (m) => m.id, cache, 72)
 * viewport.scrollTop = scrollTop
 * ```
 */
export const restoreScrollAnchor = <T>(
    anchor: ScrollAnchor,
    messages: T[],
    getMessageId: (_message: T) => string,
    heightCache: ChatHeightCache,
    estimatedHeight: number
): number => {
    heightCache.sync(messages, getMessageId, estimatedHeight)

    const anchorIndex = heightCache.getIndexForId(anchor.messageId)
    if (anchorIndex === -1) return 0

    return heightCache.getOffsetForIndex(anchorIndex) - anchor.offsetFromViewportTop
}
