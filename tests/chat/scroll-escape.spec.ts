import { expect, test, type Page } from '@playwright/test'
import {
    SETTLE_MS,
    VIEWPORT,
    getScrollState,
    isFollowing,
    waitForFollowing,
    waitForMount
} from '../helpers.js'

/**
 * Sustained upward movement must disengage follow-bottom regardless of how
 * it arrives — wheel events or programmatic writes (#45).
 *
 * Real wheel/touch input escapes because scroll intent suppresses
 * snap-to-bottom while displacement accumulates past the threshold. A
 * programmatic slow scroll (a consumer's scroll animation, an a11y tool,
 * repeated scrollBy calls) has no intent to suppress the snap: pre-fix,
 * each small step was answered by a snap-back that also erased the
 * accumulated travel evidence — a livelock where the viewport could never
 * leave the bottom no matter how long the scroll continued.
 *
 * The magnet within the follow threshold is intended behavior and guarded
 * by the control test: a single sub-threshold nudge must NOT unfollow.
 */

/** Scroll up `stepPx` per frame for `frames` frames, in the rAF phase. */
async function programmaticUpwardScroll(page: Page, frames: number, stepPx: number) {
    await page.evaluate(
        ([sel, frameCount, step]) =>
            new Promise<void>((resolve) => {
                const viewport = document.querySelector(sel) as HTMLElement
                let n = 0
                const tick = () => {
                    viewport.scrollTop -= step
                    n += 1
                    if (n >= frameCount || viewport.scrollTop <= 0) {
                        resolve()
                        return
                    }
                    requestAnimationFrame(tick)
                }
                requestAnimationFrame(tick)
            }),
        [VIEWPORT, frames, stepPx] as const
    )
}

test.describe('Programmatic scroll escape (#45)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/fill-in', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
        await waitForFollowing(page, true)
    })

    test('a sustained slow programmatic upward scroll leaves the bottom', async ({ page }) => {
        await expect
            .poll(async () => (await getScrollState(page)).gapFromBottom, { timeout: 5000 })
            .toBeLessThanOrEqual(2)
        const before = await getScrollState(page)

        // 80 frames × 30px — the shape of a consumer scroll animation
        // (regression coverage for #45).
        await programmaticUpwardScroll(page, 80, 30)

        await waitForFollowing(page, false)
        const after = await getScrollState(page)
        expect(before.scrollTop - after.scrollTop).toBeGreaterThan(500)
    })

    test('a programmatic jump into the list sticks during streaming growth', async ({ page }) => {
        // With growth in flight, layout preservation is hot on every frame —
        // and movement without input events used to be attributed to layout
        // wholesale, so a scrollTo() into the list (a jump-to-message button,
        // an a11y tool) was snapped straight back to the bottom. Clamps can
        // only land on boundaries; a mid-list landing is the user's.
        await page.locator('[data-testid="start-fill"]').click()
        await page.waitForTimeout(400)
        expect(await isFollowing(page)).toBe(true)

        const target = await page.evaluate((sel) => {
            const viewport = document.querySelector(sel) as HTMLElement
            const to = Math.round((viewport.scrollHeight - viewport.clientHeight) * 0.4)
            viewport.scrollTop = to
            return to
        }, VIEWPORT)

        await waitForFollowing(page, false)
        await page
            .locator('[data-testid="stop-fill"]')
            .click({ timeout: 1000 })
            .catch(() => {})
        await page.waitForTimeout(SETTLE_MS)

        expect(await isFollowing(page)).toBe(false)
        const { scrollTop } = await getScrollState(page)
        // Anchored near the jump target (growth above may shift it slightly),
        // nowhere near the bottom it was yanked back to pre-fix.
        expect(Math.abs(scrollTop - target)).toBeLessThan(600)
    })

    test('control: a single sub-threshold nudge stays within the follow magnet', async ({
        page
    }) => {
        // One 30px nudge — inside followBottomThresholdPx (48). The magnet
        // keeps following; this must hold before AND after the #45 fix.
        // Asserting the absence of a state change needs a fixed window.
        await programmaticUpwardScroll(page, 1, 30)
        await page.waitForTimeout(SETTLE_MS)

        expect(await isFollowing(page)).toBe(true)
        const { gapFromBottom } = await getScrollState(page)
        expect(gapFromBottom).toBeLessThanOrEqual(48)
    })
})
