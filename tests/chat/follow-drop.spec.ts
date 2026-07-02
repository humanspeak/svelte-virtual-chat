import { expect, test, type Page } from '@playwright/test'
import { SETTLE_MS, VIEWPORT, getScrollState, isFollowing, waitForMount } from '../helpers.js'

/**
 * Follow-bottom must survive incidental input during streaming.
 *
 * Trackpads emit tiny wheel deltas constantly — inertia tails, resting
 * fingers, 1-3px drifts. Today a single REAL 2px upward wheel tick while
 * content is streaming permanently kills follow-bottom:
 *
 *   1. The tick marks upward scroll intent (ChatScrollIntent) and records an
 *      upward direction in ChatScrollProgressPreserver.
 *   2. Snap-to-bottom is suppressed while intent/preservation are active, and
 *      the preserver maintains the user's *progress ratio* through growth —
 *      which converts a 2px displacement into an ever-growing absolute gap
 *      as maxScroll increases.
 *   3. Within ~150ms the gap exceeds followBottomThresholdPx (48), and the
 *      next scroll event's decideFollowBottomAfterScroll sees
 *      atBottom=false + userScrolling=true → follow drops. Permanently.
 *
 * The user made a 2px gesture and lost follow forever — while a deliberate
 * 2px tick with NO growth in flight leaves follow intact (the gap stays
 * within the 48px threshold). The unfollow decision is amplified by content
 * growth instead of being based on the user's actual displacement.
 *
 * Contract asserted here: input displacement far below
 * followBottomThresholdPx must never flip follow state, streaming or not.
 * A deliberate multi-hundred-px scroll away must still unfollow (covered by
 * scroll-away.spec.ts).
 */

/**
 * One real 2px upward wheel tick over the viewport — trackpad noise, 24×
 * smaller than the 48px follow threshold. Real input on purpose: a synthetic
 * WheelEvent marks intent without actually scrolling, which is a different
 * (weaker) scenario. `scrollByWheel` from helpers is not used because its
 * firefox/mobile fallback bypasses real wheel events.
 */
async function wheelDriftUp(page: Page): Promise<void> {
    const box = await page.locator(VIEWPORT).boundingBox()
    if (!box) throw new Error(`Missing viewport ${VIEWPORT}`)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, -2)
}

test.describe('Follow-bottom survives incidental input during streaming', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(
            testInfo.project.name === 'mobile-safari',
            'Playwright does not support mouse.wheel in mobile WebKit'
        )
        await page.goto('/tests/chat/fill-in', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
        await page.waitForTimeout(SETTLE_MS)
    })

    test('a 2px upward wheel drift while streaming does not permanently unfollow', async ({
        page
    }) => {
        expect(await isFollowing(page)).toBe(true)

        // The fixture's own token-stream fill: +24px every 20ms for ~2.4s.
        await page.locator('[data-testid="start-fill"]').click()
        try {
            // Sanity: streaming alone keeps following.
            await page.waitForTimeout(500)
            expect(await isFollowing(page)).toBe(true)

            await wheelDriftUp(page)

            // Let the stream keep running past every suppression window
            // (scroll intent 150ms, progress preserver 700ms).
            await page.waitForTimeout(1500)
        } finally {
            // If the fill already ran out (extreme timer drift), the button
            // is disabled and there is nothing left to stop.
            await page
                .locator('[data-testid="stop-fill"]')
                .click({ timeout: 1000 })
                .catch(() => {})
        }
        await page.waitForTimeout(SETTLE_MS)

        // Today this fails: following=false and the viewport is stranded
        // thousands of px above a stream that is still growing.
        expect(await isFollowing(page)).toBe(true)
        const { gapFromBottom } = await getScrollState(page)
        expect(gapFromBottom).toBeLessThanOrEqual(2)
    })

    test('control: the same 2px drift with no growth in flight keeps following', async ({
        page
    }) => {
        expect(await isFollowing(page)).toBe(true)

        await wheelDriftUp(page)
        await page.waitForTimeout(SETTLE_MS)

        // 2px is inside followBottomThresholdPx — still following.
        expect(await isFollowing(page)).toBe(true)
    })
})
