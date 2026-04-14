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
