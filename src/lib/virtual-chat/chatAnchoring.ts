import { type ChatHeightCache, calculateOffsetForIndex } from './chatMeasurement.svelte.js'
import type { ScrollAnchor } from './chatTypes.js'

/**
 * Capture a scroll anchor before a history prepend operation.
 *
 * Records the first visible message and its pixel offset from the
 * viewport top, so we can restore the same visual position after
 * new messages are inserted above.
 */
export function captureScrollAnchor<T>(
    messages: T[],
    getMessageId: (_message: T) => string,
    heightCache: ChatHeightCache,
    estimatedHeight: number,
    scrollTop: number
): ScrollAnchor | null {
    if (messages.length === 0) return null

    let offsetY = 0
    for (let i = 0; i < messages.length; i++) {
        const id = getMessageId(messages[i])
        const h = heightCache.get(id) ?? estimatedHeight
        const itemBottom = offsetY + h

        if (itemBottom > scrollTop) {
            return {
                messageId: id,
                offsetFromViewportTop: offsetY - scrollTop
            }
        }

        offsetY += h
    }

    // Fallback: anchor to last message
    const lastId = getMessageId(messages[messages.length - 1])
    return {
        messageId: lastId,
        offsetFromViewportTop: offsetY - scrollTop - (heightCache.get(lastId) ?? estimatedHeight)
    }
}

/**
 * Restore scroll position after a history prepend, using a previously captured anchor.
 *
 * Finds the anchor message in the (now larger) message array and sets scrollTop
 * so the anchor appears at the same visual offset from the viewport top.
 */
export function restoreScrollAnchor<T>(
    anchor: ScrollAnchor,
    messages: T[],
    getMessageId: (_message: T) => string,
    heightCache: ChatHeightCache,
    estimatedHeight: number
): number {
    const anchorIndex = messages.findIndex((m) => getMessageId(m) === anchor.messageId)
    if (anchorIndex === -1) return 0

    const anchorOffset = calculateOffsetForIndex(
        messages,
        anchorIndex,
        getMessageId,
        heightCache,
        estimatedHeight
    )

    return anchorOffset - anchor.offsetFromViewportTop
}
