import { describe, expect, it } from 'vitest'
import {
    ChatHeightCache,
    calculateOffsetForIndex,
    calculateTotalHeight,
    calculateVisibleRange
} from './chatMeasurement.svelte.js'

type Msg = { id: string }
const getId = (m: Msg) => m.id
const msgs = (ids: string[]): Msg[] => ids.map((id) => ({ id }))

/** Build a cache pre-populated with per-id heights. */
const cacheWith = (heights: Record<string, number>): ChatHeightCache => {
    const cache = new ChatHeightCache()
    for (const [id, h] of Object.entries(heights)) cache.set(id, h)
    return cache
}

/** Sum the per-id heights, falling back to `estimated` for unmeasured ids. */
const totalFromHeights = (
    messages: Msg[],
    heights: Record<string, number>,
    estimated: number
): number => messages.reduce((sum, m) => sum + (heights[m.id] ?? estimated), 0)

describe('ChatHeightCache', () => {
    it('returns undefined for unmeasured messages', () => {
        const cache = new ChatHeightCache()
        expect(cache.get('a')).toBeUndefined()
    })

    it('stores and retrieves heights', () => {
        const cache = new ChatHeightCache()
        cache.set('a', 100)
        expect(cache.get('a')).toBe(100)
    })

    it('returns true when height changes', () => {
        const cache = new ChatHeightCache()
        expect(cache.set('a', 100)).toBe(true)
        expect(cache.set('a', 200)).toBe(true)
    })

    it('returns false when height is the same', () => {
        const cache = new ChatHeightCache()
        cache.set('a', 100)
        expect(cache.set('a', 100)).toBe(false)
    })

    it('tracks size correctly', () => {
        const cache = new ChatHeightCache()
        expect(cache.size).toBe(0)
        cache.set('a', 50)
        expect(cache.size).toBe(1)
        cache.set('b', 60)
        expect(cache.size).toBe(2)
    })

    it('has() works correctly', () => {
        const cache = new ChatHeightCache()
        expect(cache.has('a')).toBe(false)
        cache.set('a', 50)
        expect(cache.has('a')).toBe(true)
    })

    it('delete removes an entry', () => {
        const cache = new ChatHeightCache()
        cache.set('a', 50)
        cache.set('b', 60)
        cache.delete('a')
        expect(cache.has('a')).toBe(false)
        expect(cache.get('a')).toBeUndefined()
        expect(cache.size).toBe(1)
    })

    it('delete on nonexistent key is a no-op', () => {
        const cache = new ChatHeightCache()
        const vBefore = cache.version
        cache.delete('nonexistent')
        expect(cache.version).toBe(vBefore)
    })

    it('clear removes all entries', () => {
        const cache = new ChatHeightCache()
        cache.set('a', 50)
        cache.set('b', 60)
        cache.clear()
        expect(cache.size).toBe(0)
        expect(cache.has('a')).toBe(false)
        expect(cache.has('b')).toBe(false)
    })

    it('version increments on set, delete, clear', () => {
        const cache = new ChatHeightCache()
        const v0 = cache.version
        cache.set('a', 50)
        expect(cache.version).toBe(v0 + 1)
        cache.set('a', 60)
        expect(cache.version).toBe(v0 + 2)
        cache.delete('a')
        expect(cache.version).toBe(v0 + 3)
        cache.set('b', 70)
        cache.clear()
        expect(cache.version).toBe(v0 + 5)
    })

    it('version does not increment on no-op set', () => {
        const cache = new ChatHeightCache()
        cache.set('a', 50)
        const v = cache.version
        cache.set('a', 50)
        expect(cache.version).toBe(v)
    })
})

describe('calculateTotalHeight', () => {
    it('returns 0 for empty messages', () => {
        const cache = new ChatHeightCache()
        expect(calculateTotalHeight([], getId, cache, 40)).toBe(0)
    })

    it('uses estimated height for unmeasured messages', () => {
        const cache = new ChatHeightCache()
        const m = msgs(['1', '2', '3'])
        expect(calculateTotalHeight(m, getId, cache, 40)).toBe(120)
    })

    it('uses measured height when available', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 100)
        cache.set('2', 50)
        const m = msgs(['1', '2', '3'])
        // 100 + 50 + 40(estimated)
        expect(calculateTotalHeight(m, getId, cache, 40)).toBe(190)
    })

    it('uses all measured heights when fully measured', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 80)
        cache.set('2', 60)
        cache.set('3', 100)
        const m = msgs(['1', '2', '3'])
        expect(calculateTotalHeight(m, getId, cache, 40)).toBe(240)
    })
})

describe('calculateOffsetForIndex', () => {
    it('returns 0 for index 0', () => {
        const cache = new ChatHeightCache()
        const m = msgs(['1', '2', '3'])
        expect(calculateOffsetForIndex(m, 0, getId, cache, 40)).toBe(0)
    })

    it('sums estimated heights for unmeasured messages', () => {
        const cache = new ChatHeightCache()
        const m = msgs(['1', '2', '3', '4'])
        // offset for index 2 = height[0] + height[1] = 40 + 40
        expect(calculateOffsetForIndex(m, 2, getId, cache, 40)).toBe(80)
    })

    it('uses measured heights when available', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 100)
        cache.set('2', 50)
        const m = msgs(['1', '2', '3'])
        // offset for index 2 = 100 + 50
        expect(calculateOffsetForIndex(m, 2, getId, cache, 40)).toBe(150)
    })

    it('mixes measured and estimated', () => {
        const cache = new ChatHeightCache()
        cache.set('2', 80)
        const m = msgs(['1', '2', '3', '4'])
        // offset for index 3 = 40(est) + 80(measured) + 40(est)
        expect(calculateOffsetForIndex(m, 3, getId, cache, 40)).toBe(160)
    })

    it('clamps to messages length', () => {
        const cache = new ChatHeightCache()
        const m = msgs(['1', '2'])
        // index 10 is beyond array — should sum all heights
        expect(calculateOffsetForIndex(m, 10, getId, cache, 40)).toBe(80)
    })

    it('returns 0 for empty messages', () => {
        const cache = new ChatHeightCache()
        expect(calculateOffsetForIndex([], 5, getId, cache, 40)).toBe(0)
    })
})

describe('calculateVisibleRange', () => {
    // Default: 10 messages, all measured at 100px → totalHeight=1000.
    // Tight overscan keeps assertions meaningful.
    const ids10 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
    const m10 = msgs(ids10)
    const heights10 = Object.fromEntries(ids10.map((id) => [id, 100]))

    it('returns zeros when there are no messages', () => {
        expect(
            calculateVisibleRange({
                messages: [] as Msg[],
                getMessageId: getId,
                heightCache: new ChatHeightCache(),
                estimatedHeight: 40,
                totalHeight: 0,
                scrollTop: 0,
                viewportHeight: 200,
                headerHeight: 0,
                footerHeight: 0,
                overscan: 1
            })
        ).toEqual({ start: 0, end: 0, visibleStart: 0, visibleEnd: 0 })
    })

    it('returns zeros when viewport has zero height', () => {
        expect(
            calculateVisibleRange({
                messages: m10,
                getMessageId: getId,
                heightCache: cacheWith(heights10),
                estimatedHeight: 40,
                totalHeight: 1000,
                scrollTop: 0,
                viewportHeight: 0,
                headerHeight: 0,
                footerHeight: 0,
                overscan: 1
            })
        ).toEqual({ start: 0, end: 0, visibleStart: 0, visibleEnd: 0 })
    })

    // The most important table: each row has a description, the args, and
    // the expected range. Column-aligned for at-a-glance review.
    it.each<
        [
            string,
            {
                messages: Msg[]
                heights: Record<string, number>
                scrollTop: number
                viewportHeight: number
                headerHeight: number
                footerHeight: number
                overscan: number
            },
            { start: number; end: number; visibleStart: number; visibleEnd: number }
        ]
    >([
        [
            'content fits in viewport with no header — all visible',
            {
                messages: msgs(['1', '2']),
                heights: { '1': 50, '2': 50 },
                scrollTop: 0,
                viewportHeight: 500,
                headerHeight: 0,
                footerHeight: 0,
                overscan: 1
            },
            { start: 0, end: 1, visibleStart: 0, visibleEnd: 1 }
        ],
        [
            'overflowing content with no header, scrolled to top',
            {
                messages: m10,
                heights: heights10,
                scrollTop: 0,
                viewportHeight: 200,
                headerHeight: 0,
                footerHeight: 0,
                overscan: 1
            },
            // Items 0..1 visible; overscan extends end by 1.
            { start: 0, end: 2, visibleStart: 0, visibleEnd: 1 }
        ],
        [
            'overflowing content with no header, scrolled to bottom',
            {
                messages: m10,
                heights: heights10,
                scrollTop: 800, // scrollHeight - viewportHeight = 1000 - 200
                viewportHeight: 200,
                headerHeight: 0,
                footerHeight: 0,
                overscan: 1
            },
            // Items 8..9 visible (item 7 ends exactly at viewTop=800,
            // strict `>` excludes it); overscan extends start by 1.
            { start: 7, end: 9, visibleStart: 8, visibleEnd: 9 }
        ],
        [
            'overflowing content with header, scrolled to top of scroll container',
            {
                messages: m10,
                heights: heights10,
                scrollTop: 0,
                viewportHeight: 200,
                headerHeight: 50,
                footerHeight: 0,
                overscan: 1
            },
            // The header is on screen, viewport sees only the first
            // ~150px of the messages container.
            { start: 0, end: 2, visibleStart: 0, visibleEnd: 1 }
        ],
        [
            'overflowing content with header, scrolled until messages top aligns with viewport top',
            {
                messages: m10,
                heights: heights10,
                scrollTop: 50, // exactly past the header
                viewportHeight: 200,
                headerHeight: 50,
                footerHeight: 0,
                overscan: 1
            },
            // messageScrollTop should clamp to 0 here, NOT 50.
            { start: 0, end: 2, visibleStart: 0, visibleEnd: 1 }
        ],
        [
            'overflowing content with header, scrolled to bottom of messages',
            {
                messages: m10,
                heights: heights10,
                // scrollHeight = headerHeight + totalHeight = 1050.
                // Max scrollTop = 1050 - viewportHeight = 850.
                scrollTop: 850,
                viewportHeight: 200,
                headerHeight: 50,
                footerHeight: 0,
                overscan: 1
            },
            // Without the headerHeight subtraction, messageScrollTop would
            // have been 850 (past totalHeight=1000? no, 850 < 1000, but
            // the visible region would shift one item up, missing item 9).
            // With it: messageScrollTop = 800, last two items visible.
            { start: 7, end: 9, visibleStart: 8, visibleEnd: 9 }
        ],
        [
            'header + tall footer, scrolled to absolute bottom (viewport sits inside footer)',
            {
                messages: m10,
                heights: heights10,
                // scrollHeight = 50(header) + 1000(messages) + 200(footer) = 1250.
                // Max scrollTop = 1250 - 200 = 1050. Viewport 1050..1250
                // is entirely inside footer — past the messages container.
                scrollTop: 1050,
                viewportHeight: 200,
                headerHeight: 50,
                footerHeight: 200,
                overscan: 1
            },
            // Without the end-anchored fallback, visibleStart would fall
            // back to 0 and the whole list would render. With it,
            // visibleStart anchors at messages.length - 1 = 9, so only the
            // last item (plus overscan toward the start) renders.
            { start: 8, end: 9, visibleStart: 9, visibleEnd: 9 }
        ],
        [
            'header taller than viewport (viewport entirely inside header)',
            {
                messages: m10,
                heights: heights10,
                // scrollTop=0 with a 300px header and a 200px viewport: the
                // viewport sees only header pixels. No message rows are
                // actually visible.
                scrollTop: 0,
                viewportHeight: 200,
                headerHeight: 300,
                footerHeight: 0,
                overscan: 1
            },
            // viewTop=-300, viewBottom=-100. itemBottom > -300 always, so
            // visibleStart=0; itemTop < -100 never, so visibleEnd falls back
            // to 0. Pre-fix the clamp produced viewBottom=200 and we'd
            // wrongly mark items 0..1 as visible behind the header.
            { start: 0, end: 1, visibleStart: 0, visibleEnd: 0 }
        ],
        [
            'variable measured + unmeasured heights mid-scroll',
            {
                // Heights: 80, 40(est), 120, 40(est), 40(est) → total 320.
                messages: msgs(['a', 'b', 'c', 'd', 'e']),
                heights: { a: 80, c: 120 },
                scrollTop: 100,
                viewportHeight: 100,
                headerHeight: 0,
                footerHeight: 0,
                overscan: 1
            },
            // viewTop=100, viewBottom=200.
            // Walk: a(0..80) bottom not >100 → not visibleStart;
            //       b(80..120) bottom 120>100 → visibleStart=1; top<200 → visibleEnd=1;
            //       c(120..240) bottom>100 (already set); top<200 → visibleEnd=2;
            //       d(240..280): top>=200, no further visibleEnd update.
            { start: 0, end: 3, visibleStart: 1, visibleEnd: 2 }
        ]
    ])('%s', (_desc, args, expected) => {
        const estimated = 40
        const result = calculateVisibleRange({
            messages: args.messages,
            getMessageId: getId,
            heightCache: cacheWith(args.heights),
            estimatedHeight: estimated,
            totalHeight: totalFromHeights(args.messages, args.heights, estimated),
            scrollTop: args.scrollTop,
            viewportHeight: args.viewportHeight,
            headerHeight: args.headerHeight,
            footerHeight: args.footerHeight,
            overscan: args.overscan
        })
        expect(result).toEqual(expected)
    })

    it('overscan clamps to messages bounds', () => {
        const result = calculateVisibleRange({
            messages: m10,
            getMessageId: getId,
            heightCache: cacheWith(heights10),
            estimatedHeight: 40,
            totalHeight: 1000,
            scrollTop: 0,
            viewportHeight: 200,
            headerHeight: 0,
            footerHeight: 0,
            overscan: 100 // way beyond array length
        })
        expect(result.start).toBe(0)
        expect(result.end).toBe(9)
    })
})
