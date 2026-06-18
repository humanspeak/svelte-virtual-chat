import { describe, expect, it } from 'vitest'
import { ChatHeightCache } from './chatMeasurement.svelte.js'
import { captureVisualAnchor, restoreVisualAnchor } from './chatVisualAnchoring.js'

type Msg = { id: string }
const getId = (m: Msg) => m.id
const msgs = (ids: string[]): Msg[] => ids.map((id) => ({ id }))

const measuredCache = (heights: Record<string, number>) => {
    const cache = new ChatHeightCache()
    for (const [id, height] of Object.entries(heights)) {
        cache.set(id, height)
    }
    return cache
}

describe('captureVisualAnchor', () => {
    it('returns null for empty messages', () => {
        const cache = new ChatHeightCache()

        expect(
            captureVisualAnchor({
                messages: [],
                getMessageId: getId,
                heightCache: cache,
                estimatedHeight: 50,
                visibleStart: 0,
                topGap: 0,
                headerHeight: 0,
                scrollTop: 0
            })
        ).toBeNull()
    })

    it('captures visibleStart with layout offsets included', () => {
        const m = msgs(['1', '2', '3'])
        const cache = measuredCache({ '1': 50, '2': 70, '3': 80 })

        expect(
            captureVisualAnchor({
                messages: m,
                getMessageId: getId,
                heightCache: cache,
                estimatedHeight: 50,
                visibleStart: 1,
                topGap: 20,
                headerHeight: 30,
                scrollTop: 80
            })
        ).toEqual({
            messageId: '2',
            offsetFromViewportTop: 20
        })
    })

    it('clamps visibleStart to available messages', () => {
        const m = msgs(['1', '2'])
        const cache = measuredCache({ '1': 50, '2': 70 })

        expect(
            captureVisualAnchor({
                messages: m,
                getMessageId: getId,
                heightCache: cache,
                estimatedHeight: 50,
                visibleStart: 10,
                topGap: 0,
                headerHeight: 0,
                scrollTop: 0
            })?.messageId
        ).toBe('2')
    })
})

describe('restoreVisualAnchor', () => {
    it('returns null when the anchor message is gone', () => {
        const cache = new ChatHeightCache()

        expect(
            restoreVisualAnchor({
                anchor: { messageId: 'missing', offsetFromViewportTop: 0 },
                messages: msgs(['1', '2']),
                getMessageId: getId,
                heightCache: cache,
                estimatedHeight: 50,
                topGap: 0,
                headerHeight: 0
            })
        ).toBeNull()
    })

    it('returns scrollTop that restores the same visual offset', () => {
        const m = msgs(['1', '2', '3'])
        const cache = measuredCache({ '1': 50, '2': 70, '3': 80 })

        expect(
            restoreVisualAnchor({
                anchor: { messageId: '3', offsetFromViewportTop: 40 },
                messages: m,
                getMessageId: getId,
                heightCache: cache,
                estimatedHeight: 50,
                topGap: 20,
                headerHeight: 30
            })
        ).toBe(130)
    })

    it('clamps restored scrollTop to zero', () => {
        const m = msgs(['1'])
        const cache = measuredCache({ '1': 50 })

        expect(
            restoreVisualAnchor({
                anchor: { messageId: '1', offsetFromViewportTop: 100 },
                messages: m,
                getMessageId: getId,
                heightCache: cache,
                estimatedHeight: 50,
                topGap: 0,
                headerHeight: 0
            })
        ).toBe(0)
    })
})
