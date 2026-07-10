import { describe, expect, it } from 'vitest'
import { captureScrollAnchor, restoreScrollAnchor } from './chatAnchoring.js'
import { ChatHeightCache } from './chatMeasurement.svelte.js'

type Msg = { id: string }
const getId = (m: Msg) => m.id
const msgs = (ids: string[]): Msg[] => ids.map((id) => ({ id }))

describe('captureScrollAnchor', () => {
    it('returns null for empty messages', () => {
        const cache = new ChatHeightCache()
        expect(captureScrollAnchor([], getId, cache, 40, 0)).toBeNull()
    })

    it('captures the first visible message at scrollTop=0', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 50)
        cache.set('2', 50)
        cache.set('3', 50)
        const m = msgs(['1', '2', '3'])

        const anchor = captureScrollAnchor(m, getId, cache, 50, 0)
        expect(anchor).not.toBeNull()
        expect(anchor!.messageId).toBe('1')
        expect(anchor!.offsetFromViewportTop).toBe(0)
    })

    it('captures correct message when scrolled partway', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 50)
        cache.set('2', 50)
        cache.set('3', 50)
        const m = msgs(['1', '2', '3'])

        // scrollTop=60 means message 1 (0-50) is above viewport,
        // message 2 (50-100) is the first visible
        const anchor = captureScrollAnchor(m, getId, cache, 50, 60)
        expect(anchor!.messageId).toBe('2')
        // message 2 starts at offset 50, scrollTop=60, so offset from viewport top = 50 - 60 = -10
        expect(anchor!.offsetFromViewportTop).toBe(-10)
    })

    it('uses estimated height for unmeasured messages', () => {
        const cache = new ChatHeightCache()
        const m = msgs(['1', '2', '3'])

        // All unmeasured at estimated=40. scrollTop=50 means:
        // msg 1 (0-40) fully above, msg 2 (40-80) is first visible
        const anchor = captureScrollAnchor(m, getId, cache, 40, 50)
        expect(anchor!.messageId).toBe('2')
        expect(anchor!.offsetFromViewportTop).toBe(40 - 50)
    })

    it('falls back to last message if scrolled past all', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 50)
        cache.set('2', 50)
        const m = msgs(['1', '2'])

        // scrollTop=200 is past all content (total = 100)
        const anchor = captureScrollAnchor(m, getId, cache, 50, 200)
        expect(anchor!.messageId).toBe('2')
    })
})

describe('restoreScrollAnchor', () => {
    it('returns 0 if anchor message is not found', () => {
        const cache = new ChatHeightCache()
        const anchor = { messageId: 'nonexistent', offsetFromViewportTop: 0 }
        const m = msgs(['1', '2'])

        expect(restoreScrollAnchor(anchor, m, getId, cache, 40)).toBe(0)
    })

    it('restores exact scrollTop for anchor at top of viewport', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 50)
        cache.set('2', 50)
        cache.set('3', 50)
        const m = msgs(['1', '2', '3'])

        // Anchor: message 2 was at offset 0 from viewport top
        const anchor = { messageId: '2', offsetFromViewportTop: 0 }
        // Message 2 is at offset 50 (after message 1)
        // scrollTop = 50 - 0 = 50
        expect(restoreScrollAnchor(anchor, m, getId, cache, 50)).toBe(50)
    })

    it('accounts for offsetFromViewportTop', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 50)
        cache.set('2', 50)
        cache.set('3', 50)
        const m = msgs(['1', '2', '3'])

        // Anchor: message 2 was 10px below the viewport top
        const anchor = { messageId: '2', offsetFromViewportTop: 10 }
        // Message 2 is at offset 50. scrollTop = 50 - 10 = 40
        expect(restoreScrollAnchor(anchor, m, getId, cache, 50)).toBe(40)
    })

    it('restores correctly after prepending messages', () => {
        const cache = new ChatHeightCache()
        // Original: messages 3, 4, 5 with measured heights
        cache.set('3', 60)
        cache.set('4', 60)
        cache.set('5', 60)

        // Before prepend: anchor was message 3 at viewport top
        const anchor = { messageId: '3', offsetFromViewportTop: 0 }

        // After prepend: messages 1, 2, 3, 4, 5
        cache.set('1', 50)
        cache.set('2', 50)
        const afterPrepend = msgs(['1', '2', '3', '4', '5'])

        // Message 3 is now at offset 50 + 50 = 100
        // scrollTop = 100 - 0 = 100
        expect(restoreScrollAnchor(anchor, afterPrepend, getId, cache, 40)).toBe(100)
    })

    it('handles negative offsetFromViewportTop', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 50)
        cache.set('2', 50)
        const m = msgs(['1', '2'])

        // Message 1 was partially scrolled out: its top was 10px above viewport
        const anchor = { messageId: '1', offsetFromViewportTop: -10 }
        // Message 1 is at offset 0. scrollTop = 0 - (-10) = 10
        expect(restoreScrollAnchor(anchor, m, getId, cache, 50)).toBe(10)
    })
})

describe('prefix-sum cache paths', () => {
    it('round-trips a 5,000-message list with mixed heights across a prepend', () => {
        const cache = new ChatHeightCache()
        const est = 40
        const original = msgs(Array.from({ length: 5000 }, (_, i) => `m${i}`))
        // Measure every third message; leave the rest at the estimate so the
        // list has genuinely mixed measured/unmeasured heights.
        for (let i = 0; i < original.length; i += 3) {
            cache.set(`m${i}`, 55 + (i % 7))
        }

        // Capture at a mid-list scrollTop.
        const scrollTop = 90000
        const anchor = captureScrollAnchor(original, getId, cache, est, scrollTop)
        expect(anchor).not.toBeNull()

        // Prepend 500 older (unmeasured) messages.
        const prepended = msgs(Array.from({ length: 500 }, (_, i) => `p${i}`))
        const afterPrepend = [...prepended, ...original]

        const newScrollTop = restoreScrollAnchor(anchor!, afterPrepend, getId, cache, est)

        // The anchor message must sit at the same offset from the viewport top
        // as when it was captured (compute expected offset with the same cache).
        cache.sync(afterPrepend, getId, est)
        const idx = cache.getIndexForId(anchor!.messageId)
        expect(idx).toBeGreaterThanOrEqual(0)
        const offsetAfter = cache.getOffsetForIndex(idx)
        expect(offsetAfter - newScrollTop).toBeCloseTo(anchor!.offsetFromViewportTop)
    })

    it('captures the last message when scrollTop is past the end', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 50)
        cache.set('2', 50)
        cache.set('3', 50)
        const m = msgs(['1', '2', '3'])

        // Total height = 150; scrollTop=500 is well past the end.
        const scrollTop = 500
        const anchor = captureScrollAnchor(m, getId, cache, 50, scrollTop)
        expect(anchor!.messageId).toBe('3')
        // Fallback semantics: offsetFromViewportTop = offset(last) - scrollTop.
        // offset('3') = 100, so 100 - 500 = -400.
        expect(anchor!.offsetFromViewportTop).toBe(100 - scrollTop)
    })

    it('syncs a fresh cache the array has never been seen by before querying', () => {
        // Fresh cache, no set() calls and never synced to this array. If the
        // internal sync were missing, the queries would read stale/empty state.
        const cache = new ChatHeightCache()
        const m = msgs(['a', 'b', 'c', 'd'])

        // All unmeasured at est=30: a(0-30) b(30-60) c(60-90) d(90-120).
        // scrollTop=75 → first visible is 'c'.
        const anchor = captureScrollAnchor(m, getId, cache, 30, 75)
        expect(anchor!.messageId).toBe('c')
        expect(anchor!.offsetFromViewportTop).toBe(60 - 75)
    })
})
