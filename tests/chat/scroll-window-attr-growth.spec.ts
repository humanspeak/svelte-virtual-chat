import { expect, test, type Page } from '@playwright/test'
import {
    STATS,
    VIEWPORT,
    parseStatsText,
    rafWait,
    sampleViewportFrames,
    waitForMount
} from '../helpers.js'

type ScrollSample = {
    tick: number
    phase: number
    scrollTop: number
    scrollHeight: number
    maxScroll: number
    scrollProgress: number
    gapFromBottom: number
    growths: string
    following: string
}

const INPUT_SAMPLE_FRAMES = 18
const STABLE_SCROLL_RANGE_PX = 1

async function captureScrollSamplesForFrames(
    page: Page,
    tick: number,
    frames = INPUT_SAMPLE_FRAMES
): Promise<ScrollSample[]> {
    const samples = await sampleViewportFrames(page, {
        viewportSelector: VIEWPORT,
        frames,
        textSelector: STATS
    })

    return samples.map((sample) => {
        const parsedStats = parseStatsText(sample.text)
        return {
            tick,
            phase: sample.phase,
            scrollTop: sample.scrollTop,
            scrollHeight: sample.scrollHeight,
            maxScroll: sample.maxScroll,
            scrollProgress: sample.scrollProgress,
            gapFromBottom: sample.gapFromBottom,
            growths: parsedStats['growths'] ?? '0',
            following: parsedStats['following'] ?? 'false'
        } satisfies ScrollSample
    })
}

/**
 * Frame-to-frame anomalies during upward scrolling, on frames where the
 * scroll range is stable (so a real growth frame — where maxScroll changed —
 * is not mistaken for a correction glitch). A forward progress/gap jump on a
 * stable-geometry frame is the correction snapping back a frame after an
 * uncorrected growth displaced the reading position — exactly what the
 * scroll-preservation observer's immediate restore is meant to prevent.
 *
 * Local copy of wheel-scroll-jump.spec.ts's detector (helpers.ts is out of
 * scope). Tolerances match that exemplar.
 */
function findForwardJumps(samples: ScrollSample[]) {
    const forwardProgressJumps = samples.slice(1).flatMap((sample, index) => {
        const previous = samples[index]
        const scrollRangeChanged = Math.abs(sample.maxScroll - previous.maxScroll)
        if (scrollRangeChanged > STABLE_SCROLL_RANGE_PX) return []

        const delta = sample.scrollProgress - previous.scrollProgress
        return delta > 0.004 ? [{ previous, sample, delta }] : []
    })
    const forwardGapJumps = samples.slice(1).flatMap((sample, index) => {
        const previous = samples[index]
        const scrollRangeChanged = Math.abs(sample.maxScroll - previous.maxScroll)
        if (scrollRangeChanged > STABLE_SCROLL_RANGE_PX) return []

        const delta = sample.gapFromBottom - previous.gapFromBottom
        return delta < -12 ? [{ previous, sample, delta }] : []
    })

    return { forwardProgressJumps, forwardGapJumps }
}

async function openPage(page: Page, query = '') {
    await page.goto(`/tests/chat/scroll-window-attr-growth${query}`, {
        waitUntil: 'domcontentloaded'
    })
    await waitForMount(page)
    await expect(page.locator(STATS)).toBeVisible()
}

async function armAndPositionAtBottom(page: Page) {
    await rafWait(page, 3)

    const viewport = page.locator(VIEWPORT)
    const box = await viewport.boundingBox()
    expect(box).not.toBeNull()
    if (!box) throw new Error(`Missing viewport ${VIEWPORT}`)

    const didScrollToBottom = await page.evaluate((selector) => {
        const el = document.querySelector(selector)
        if (!el) return false
        el.scrollTop = el.scrollHeight
        return true
    }, VIEWPORT)
    expect(didScrollToBottom).toBe(true)
    await rafWait(page, 2)

    // Arm only after positioning: the setup scrollTop write fires no wheel
    // event, so growth stays dormant until the referee scroll begins.
    await page.locator('[data-testid="arm-growth"]').check()

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
}

test.describe('Scroll window attribute growth referee', () => {
    test.beforeEach(({ page: _page }, testInfo) => {
        test.skip(
            testInfo.project.name === 'mobile-safari',
            'Playwright does not support mouse.wheel in mobile WebKit'
        )
    })

    test('preserves frame-level scroll stability when above-viewport blocks grow mid-scroll', async ({
        page
    }) => {
        await openPage(page)
        await armAndPositionAtBottom(page)

        const samples: ScrollSample[] = []
        for (let tick = 0; tick < 14; tick++) {
            await page.mouse.wheel(0, -650)
            samples.push(...(await captureScrollSamplesForFrames(page, tick)))
        }

        // 1. The referee actually fired: an attribute-only growth landed while
        //    the user was scrolling (not after settle). A referee that never
        //    grows is the 003 no-op bug all over again.
        const growthValues = samples.map((sample) => Number(sample.growths))
        const maxGrowths = Math.max(...growthValues)
        expect(maxGrowths).toBeGreaterThan(0)

        const firstGrowthIndex = growthValues.findIndex((value) => value > 0)
        // Growth landed with scroll ticks still to come — mid-scroll, not at the
        // final settle.
        expect(firstGrowthIndex).toBeGreaterThanOrEqual(0)
        expect(firstGrowthIndex).toBeLessThan(samples.length - INPUT_SAMPLE_FRAMES)

        // 2. Frame-level stability: no forward progress/gap jump on a
        //    stable-geometry frame while the user is scrolling upward.
        expect(findForwardJumps(samples)).toEqual({
            forwardProgressJumps: [],
            forwardGapJumps: []
        })
    })
})
