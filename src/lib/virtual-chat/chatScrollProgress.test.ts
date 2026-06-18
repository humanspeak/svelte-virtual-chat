import { describe, expect, it } from 'vitest'
import {
    ChatScrollProgressPreserver,
    getGapFromBottom,
    getScrollProgress,
    preserveDirectionalScrollProgressTarget,
    preserveMinimumScrollProgressTarget
} from './chatScrollProgress.js'

describe('getGapFromBottom', () => {
    it('returns the remaining distance to the bottom', () => {
        expect(getGapFromBottom({ scrollTop: 300, scrollHeight: 1200, clientHeight: 500 })).toBe(
            400
        )
    })
})

describe('getScrollProgress', () => {
    it('returns one when content does not overflow', () => {
        expect(getScrollProgress({ scrollTop: 0, scrollHeight: 400, clientHeight: 500 })).toBe(1)
    })

    it('returns normalized progress through the scrollable range', () => {
        expect(getScrollProgress({ scrollTop: 250, scrollHeight: 1000, clientHeight: 500 })).toBe(
            0.5
        )
    })
})

describe('preserveMinimumScrollProgressTarget', () => {
    it('returns the scrollTop needed to keep prior progress after growth', () => {
        expect(
            preserveMinimumScrollProgressTarget({
                previous: { scrollTop: 500, scrollHeight: 1500, clientHeight: 500 },
                current: { scrollTop: 500, scrollHeight: 1900, clientHeight: 500 }
            })
        ).toBe(700)
    })

    it('does not adjust when content did not grow', () => {
        expect(
            preserveMinimumScrollProgressTarget({
                previous: { scrollTop: 500, scrollHeight: 1500, clientHeight: 500 },
                current: { scrollTop: 500, scrollHeight: 1500, clientHeight: 500 }
            })
        ).toBeNull()
    })

    it('does not move when current scrollTop already preserves progress', () => {
        expect(
            preserveMinimumScrollProgressTarget({
                previous: { scrollTop: 500, scrollHeight: 1500, clientHeight: 500 },
                current: { scrollTop: 710, scrollHeight: 1900, clientHeight: 500 }
            })
        ).toBeNull()
    })
})

describe('preserveDirectionalScrollProgressTarget', () => {
    it('keeps downward scrolling from moving farther away from bottom after growth', () => {
        expect(
            preserveDirectionalScrollProgressTarget({
                direction: 'down',
                previous: { scrollTop: 500, scrollHeight: 1500, clientHeight: 500 },
                current: { scrollTop: 500, scrollHeight: 1900, clientHeight: 500 }
            })
        ).toBe(700)
    })

    it('keeps upward scrolling from moving closer to bottom after layout adjustment', () => {
        expect(
            preserveDirectionalScrollProgressTarget({
                direction: 'up',
                previous: { scrollTop: 1200, scrollHeight: 1900, clientHeight: 500 },
                current: { scrollTop: 1320, scrollHeight: 1900, clientHeight: 500 }
            })
        ).toBe(1200)
    })

    it('does not adjust when the viewport already moved in the intended direction', () => {
        expect(
            preserveDirectionalScrollProgressTarget({
                direction: 'up',
                previous: { scrollTop: 1200, scrollHeight: 1700, clientHeight: 500 },
                current: { scrollTop: 1100, scrollHeight: 1900, clientHeight: 500 }
            })
        ).toBeNull()
    })
})

describe('ChatScrollProgressPreserver', () => {
    it('preserves progress after recent downward user scroll', () => {
        const preserver = new ChatScrollProgressPreserver()
        preserver.recordScrollIntent({
            direction: 'down',
            current: { scrollTop: 480, scrollHeight: 1500, clientHeight: 500 },
            now: 990
        })
        preserver.recordUserScroll({
            previousScrollTop: 480,
            current: { scrollTop: 500, scrollHeight: 1500, clientHeight: 500 },
            now: 1000
        })

        expect(
            preserver.getPreservationTarget({
                current: { scrollTop: 500, scrollHeight: 1900, clientHeight: 500 },
                now: 1300
            })
        ).toBe(700)
    })

    it('preserves upward progress after recent upward user scroll', () => {
        const preserver = new ChatScrollProgressPreserver()
        preserver.recordScrollIntent({
            direction: 'up',
            current: { scrollTop: 1400, scrollHeight: 1900, clientHeight: 500 },
            now: 990
        })
        preserver.recordUserScroll({
            previousScrollTop: 1400,
            current: { scrollTop: 1200, scrollHeight: 1900, clientHeight: 500 },
            now: 1000
        })

        expect(
            preserver.getPreservationTarget({
                current: { scrollTop: 1320, scrollHeight: 1900, clientHeight: 500 },
                now: 1100
            })
        ).toBe(1200)
    })

    it('ignores expired directional scrolls', () => {
        const preserver = new ChatScrollProgressPreserver({ activeWindowMs: 200 })
        preserver.recordScrollIntent({
            direction: 'down',
            current: { scrollTop: 480, scrollHeight: 1500, clientHeight: 500 },
            now: 990
        })
        preserver.recordUserScroll({
            previousScrollTop: 480,
            current: { scrollTop: 500, scrollHeight: 1500, clientHeight: 500 },
            now: 1000
        })

        expect(
            preserver.getPreservationTarget({
                current: { scrollTop: 500, scrollHeight: 1900, clientHeight: 500 },
                now: 1201
            })
        ).toBeNull()
    })

    it('reports whether preservation is still active', () => {
        const preserver = new ChatScrollProgressPreserver({ activeWindowMs: 200 })
        preserver.recordScrollIntent({
            direction: 'down',
            current: { scrollTop: 480, scrollHeight: 1500, clientHeight: 500 },
            now: 1000
        })

        expect(preserver.isActive(1200)).toBe(true)
        expect(preserver.isActive(1201)).toBe(false)
    })

    it('replaces a provisional intent baseline after matching movement', () => {
        const preserver = new ChatScrollProgressPreserver()
        preserver.recordScrollIntent({
            direction: 'up',
            current: { scrollTop: 1400, scrollHeight: 1900, clientHeight: 500 },
            now: 1000
        })

        preserver.recordUserScroll({
            previousScrollTop: 1400,
            current: { scrollTop: 1200, scrollHeight: 1900, clientHeight: 500 },
            now: 1040
        })

        expect(
            preserver.getPreservationTarget({
                current: { scrollTop: 1320, scrollHeight: 1900, clientHeight: 500 },
                now: 1060
            })
        ).toBe(1200)
    })

    it('keeps the strongest progress baseline while direction stays the same', () => {
        const preserver = new ChatScrollProgressPreserver()
        preserver.recordScrollIntent({
            direction: 'down',
            current: { scrollTop: 600, scrollHeight: 1500, clientHeight: 500 },
            now: 1000
        })
        preserver.recordScrollIntent({
            direction: 'down',
            current: { scrollTop: 560, scrollHeight: 1500, clientHeight: 500 },
            now: 1040
        })

        expect(
            preserver.getPreservationTarget({
                current: { scrollTop: 560, scrollHeight: 1900, clientHeight: 500 },
                now: 1080
            })
        ).toBe(840)
    })

    it('does not let opposite layout movement replace the user-direction baseline', () => {
        const preserver = new ChatScrollProgressPreserver()
        preserver.recordScrollIntent({
            direction: 'up',
            current: { scrollTop: 1400, scrollHeight: 1900, clientHeight: 500 },
            now: 990
        })
        preserver.recordUserScroll({
            previousScrollTop: 1400,
            current: { scrollTop: 1200, scrollHeight: 1900, clientHeight: 500 },
            now: 1000
        })
        preserver.recordUserScroll({
            previousScrollTop: 1200,
            current: { scrollTop: 1320, scrollHeight: 1900, clientHeight: 500 },
            now: 1020
        })

        expect(
            preserver.getPreservationTarget({
                current: { scrollTop: 1320, scrollHeight: 1900, clientHeight: 500 },
                now: 1100
            })
        ).toBe(1200)
    })

    it('commits an adjustment as the next preservation baseline', () => {
        const preserver = new ChatScrollProgressPreserver()
        preserver.recordScrollIntent({
            direction: 'down',
            current: { scrollTop: 480, scrollHeight: 1500, clientHeight: 500 },
            now: 990
        })
        preserver.recordUserScroll({
            previousScrollTop: 480,
            current: { scrollTop: 500, scrollHeight: 1500, clientHeight: 500 },
            now: 1000
        })
        preserver.commitAdjustment({ scrollTop: 700, scrollHeight: 1900, clientHeight: 500 }, 1200)

        expect(
            preserver.getPreservationTarget({
                current: { scrollTop: 700, scrollHeight: 2100, clientHeight: 500 },
                now: 1300
            })
        ).toBe(800)
    })
})
