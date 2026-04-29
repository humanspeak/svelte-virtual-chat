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

    it('version increments on set (deferred), delete (sync), clear (sync)', async () => {
        const cache = new ChatHeightCache()
        const v0 = cache.version
        cache.set('a', 50)
        expect(cache.version).toBe(v0) // not yet bumped — deferred to microtask
        await Promise.resolve()
        expect(cache.version).toBe(v0 + 1)
        cache.set('a', 60)
        await Promise.resolve()
        expect(cache.version).toBe(v0 + 2)
        cache.delete('a')
        expect(cache.version).toBe(v0 + 3) // delete bumps synchronously
        cache.set('b', 70)
        cache.clear()
        expect(cache.version).toBe(v0 + 4) // clear supersedes the pending set bump
        await Promise.resolve()
        expect(cache.version).toBe(v0 + 4) // pending microtask was canceled
    })

    it('version does not increment on no-op set', async () => {
        const cache = new ChatHeightCache()
        cache.set('a', 50)
        await Promise.resolve()
        const v = cache.version
        cache.set('a', 50) // no-op short-circuit
        await Promise.resolve()
        expect(cache.version).toBe(v)
    })

    it('multiple set() calls in the same task coalesce into one version bump', async () => {
        const cache = new ChatHeightCache()
        const v0 = cache.version
        cache.set('a', 50)
        cache.set('b', 60)
        cache.set('c', 70)
        expect(cache.version).toBe(v0) // not yet bumped
        await Promise.resolve()
        expect(cache.version).toBe(v0 + 1) // single bump for all three
    })

    it('delete supersedes a pending deferred bump', async () => {
        const cache = new ChatHeightCache()
        cache.set('a', 50)
        await Promise.resolve()
        const v = cache.version
        cache.set('a', 60) // schedules microtask
        cache.delete('a') // sync bump, supersedes pending
        expect(cache.version).toBe(v + 1) // delete fired sync
        await Promise.resolve()
        expect(cache.version).toBe(v + 1) // pending microtask was a no-op
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

    it('1000-message golden test: binary search picks the same range as a linear walk', () => {
        // Mixed measured (random 80–160px) and unmeasured (40px estimate) heights.
        const cache = new ChatHeightCache()
        const ids = Array.from({ length: 1000 }, (_v, i) => String(i))
        const messages = msgs(ids)
        const heightById: Record<string, number> = {}
        for (let i = 0; i < ids.length; i++) {
            // Every third id is measured; the rest fall through to the estimate.
            if (i % 3 !== 0) {
                const h = 80 + ((i * 17) % 81) // 80..160
                heightById[ids[i]] = h
                cache.set(ids[i], h)
            }
        }
        const estimated = 40
        const total = messages.reduce((sum, m) => sum + (heightById[m.id] ?? estimated), 0)

        // Reference walk that mirrors the pre-#13 logic exactly so we have an
        // independent ground truth to compare the binary-search version against.
        const referenceRange = (
            scrollTop: number,
            viewportHeight: number,
            headerHeight: number,
            footerHeight: number,
            overscan: number
        ) => {
            const topGap = Math.max(0, viewportHeight - total - headerHeight - footerHeight)
            const viewTop = scrollTop - topGap - headerHeight
            const viewBottom = viewTop + viewportHeight
            let offsetY = 0
            let visibleStart = -1
            let visibleEnd = -1
            for (let i = 0; i < messages.length; i++) {
                const h = heightById[messages[i].id] ?? estimated
                const itemTop = offsetY
                const itemBottom = offsetY + h
                if (itemBottom > viewTop && visibleStart === -1) visibleStart = i
                if (itemTop < viewBottom) visibleEnd = i
                offsetY += h
                if (visibleStart !== -1 && offsetY >= viewBottom) break
            }
            if (visibleStart === -1) visibleStart = messages.length - 1
            if (visibleEnd === -1) visibleEnd = 0
            return {
                start: Math.max(0, visibleStart - overscan),
                end: Math.min(messages.length - 1, visibleEnd + overscan),
                visibleStart,
                visibleEnd
            }
        }

        // Probe a few mid-list scroll positions and assert agreement.
        const probes = [0, 1234, 5678, 12_345, 30_000, total - 600, total - 200]
        for (const scrollTop of probes) {
            const expected = referenceRange(scrollTop, 600, 0, 0, 4)
            const actual = calculateVisibleRange({
                messages,
                getMessageId: getId,
                heightCache: cache,
                estimatedHeight: estimated,
                totalHeight: total,
                scrollTop,
                viewportHeight: 600,
                headerHeight: 0,
                footerHeight: 0,
                overscan: 4
            })
            expect(actual).toEqual(expected)
        }
    })
})

describe('ChatHeightCache.sync (prefix sums)', () => {
    it('append fast path extends prefix sum without rebuild', () => {
        const cache = new ChatHeightCache()
        const a = msgs(['1', '2', '3'])
        cache.set('1', 100)
        cache.set('2', 100)
        cache.set('3', 100)
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(300)

        const b = [...a, ...msgs(['4', '5'])]
        cache.set('4', 50)
        cache.set('5', 50)
        // After append the offsets of pre-existing items must remain identical.
        expect(calculateOffsetForIndex(b, 3, getId, cache, 40)).toBe(300)
        expect(calculateTotalHeight(b, getId, cache, 40)).toBe(400)
    })

    it('prepend fast path rebuilds from index 0 and reuses prior heights', () => {
        const cache = new ChatHeightCache()
        const original = msgs(['10', '11', '12'])
        cache.set('10', 100)
        cache.set('11', 100)
        cache.set('12', 100)
        expect(calculateTotalHeight(original, getId, cache, 40)).toBe(300)

        // Prepend two older messages — their heights aren't measured yet.
        const prepended = [...msgs(['8', '9']), ...original]
        expect(calculateTotalHeight(prepended, getId, cache, 40)).toBe(380) // 40+40+300

        // Measuring the new ones just bumps their slot via dirty marker.
        cache.set('8', 60)
        cache.set('9', 60)
        expect(calculateTotalHeight(prepended, getId, cache, 40)).toBe(420)
        // Original messages now sit at indices 2..4 — offset of '10' is 120.
        expect(calculateOffsetForIndex(prepended, 2, getId, cache, 40)).toBe(120)
    })

    it('full rebuild on splice/random reorder', () => {
        const cache = new ChatHeightCache()
        const a = msgs(['1', '2', '3', '4'])
        cache.set('1', 50)
        cache.set('2', 50)
        cache.set('3', 50)
        cache.set('4', 50)
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(200)

        // Replace middle element with a distinct height so the assertion fails
        // if sync wrongly reuses the old ordering.
        const b = msgs(['1', '99', '3', '4'])
        cache.set('99', 500)
        expect(calculateTotalHeight(b, getId, cache, 40)).toBe(650)
        expect(calculateOffsetForIndex(b, 2, getId, cache, 40)).toBe(550)
    })

    it('append-shape with replaced head falls through to full rebuild', () => {
        // Endpoint-only guards would treat `[1,2,3] -> [9,2,3,4]` as a clean
        // append because `messages[oldN-1] === orderedIds[oldN-1]`. The
        // strengthened guard (head + tail) catches the replaced head.
        const cache = new ChatHeightCache()
        const a = msgs(['1', '2', '3'])
        cache.set('1', 50)
        cache.set('2', 50)
        cache.set('3', 50)
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(150)

        const b = msgs(['9', '2', '3', '4'])
        cache.set('9', 100)
        cache.set('4', 70)
        expect(calculateTotalHeight(b, getId, cache, 40)).toBe(270) // 100+50+50+70
        // Index 1's offset must reflect the new head height (100), not the
        // stale '1' height (50). A wrongly-taken append path leaves orderedIds
        // = [1,2,3,4] and would compute offset=50 here.
        expect(calculateOffsetForIndex(b, 1, getId, cache, 40)).toBe(100)
    })

    it('same-length mid-replace falls through to full rebuild', () => {
        // Endpoint-only no-op check would treat `[1,2,3,4] -> [1,99,3,4]` as
        // unchanged because head and tail match. The full id walk catches the
        // mid-array replacement.
        const cache = new ChatHeightCache()
        const a = msgs(['1', '2', '3', '4'])
        cache.set('1', 50)
        cache.set('2', 50)
        cache.set('3', 50)
        cache.set('4', 50)
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(200)

        const b = msgs(['1', '99', '3', '4'])
        cache.set('99', 200)
        // Total reflects '99' replacing '2': 50+200+50+50 = 350.
        expect(calculateTotalHeight(b, getId, cache, 40)).toBe(350)
        expect(calculateOffsetForIndex(b, 2, getId, cache, 40)).toBe(250)
    })

    it('measurement of an id absent from the current ordering is silently ignored', () => {
        const cache = new ChatHeightCache()
        const a = msgs(['1', '2', '3'])
        cache.set('1', 100)
        cache.set('2', 100)
        cache.set('3', 100)
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(300)

        // ResizeObserver fires for an id that has been removed from the array
        // but is still in the height map — must not corrupt the prefix sum.
        cache.set('999', 9999)
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(300)
        expect(calculateOffsetForIndex(a, 2, getId, cache, 40)).toBe(200)
    })

    it('cache.delete on a mid-array id invalidates the prefix sum from that index', () => {
        const cache = new ChatHeightCache()
        const a = msgs(['1', '2', '3', '4'])
        cache.set('1', 100)
        cache.set('2', 100)
        cache.set('3', 100)
        cache.set('4', 100)
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(400)

        // Drop the measurement of '2' → its slot falls back to estimate (40).
        cache.delete('2')
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(340)
        // Offset of index 3 should reflect the dropped measurement: 100+40+100.
        expect(calculateOffsetForIndex(a, 3, getId, cache, 40)).toBe(240)
    })

    it('clear resets ordering and prefix sum', () => {
        const cache = new ChatHeightCache()
        const a = msgs(['1', '2'])
        cache.set('1', 100)
        cache.set('2', 100)
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(200)
        cache.clear()
        expect(cache.size).toBe(0)
        // After clear the next call to a public function must rebuild via sync.
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(80) // both unmeasured
    })

    it('two consecutive prepends without intervening reads', () => {
        const cache = new ChatHeightCache()
        const tail = msgs(['100', '101'])
        cache.set('100', 100)
        cache.set('101', 100)
        // Prime the cache with the original tail.
        expect(calculateTotalHeight(tail, getId, cache, 40)).toBe(200)

        const first = [...msgs(['98', '99']), ...tail]
        const second = [...msgs(['96', '97']), ...first]
        // Skip directly to the second prepend — no read between the two
        // sync calls. The internal #lastSyncedMessages tracks `first` was
        // never observed, so the second sync still has to discover the
        // shape from scratch.
        cache.set('96', 60)
        cache.set('97', 60)
        cache.set('98', 60)
        cache.set('99', 60)
        expect(calculateTotalHeight(second, getId, cache, 40)).toBe(440) // 60*4 + 100*2
        // Tail items still sit at the end.
        expect(calculateOffsetForIndex(second, 4, getId, cache, 40)).toBe(240)
    })

    it('append after prepend in the same tick keeps both ends correct', () => {
        const cache = new ChatHeightCache()
        const orig = msgs(['10', '11'])
        cache.set('10', 100)
        cache.set('11', 100)
        expect(calculateTotalHeight(orig, getId, cache, 40)).toBe(200)

        const prepended = [...msgs(['8', '9']), ...orig]
        cache.set('8', 50)
        cache.set('9', 50)
        expect(calculateTotalHeight(prepended, getId, cache, 40)).toBe(300)

        const both = [...prepended, ...msgs(['12', '13'])]
        cache.set('12', 75)
        cache.set('13', 75)
        expect(calculateTotalHeight(both, getId, cache, 40)).toBe(450)
        // Original '10' now sits at index 2 with offset 50+50.
        expect(calculateOffsetForIndex(both, 2, getId, cache, 40)).toBe(100)
        // First appended '12' sits at index 4 with offset 50+50+100+100.
        expect(calculateOffsetForIndex(both, 4, getId, cache, 40)).toBe(300)
    })

    it('changing estimatedHeight without touching messages invalidates the prefix sum', () => {
        const cache = new ChatHeightCache()
        const a = msgs(['1', '2', '3'])
        // No measurements — every slot falls through to the estimate.
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(120)
        // Same array reference, new estimate — prefix sum must rebuild.
        expect(calculateTotalHeight(a, getId, cache, 100)).toBe(300)
    })

    it('shrink to empty resets ordering', () => {
        const cache = new ChatHeightCache()
        const a = msgs(['1', '2', '3'])
        cache.set('1', 100)
        cache.set('2', 100)
        cache.set('3', 100)
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(300)
        expect(calculateTotalHeight([], getId, cache, 40)).toBe(0)
        // After empty-sync, repopulating through a fresh array must work.
        expect(calculateTotalHeight(a, getId, cache, 40)).toBe(300)
    })
})
