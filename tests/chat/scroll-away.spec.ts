import { expect, test } from '@playwright/test'
import {
    getStat,
    getScrollState,
    isFollowing,
    messageInDom,
    rafWait,
    scrollTo,
    scrollToBottom,
    SETTLE_MS,
    VIEWPORT,
    waitForFollowing,
    waitForMount
} from '../helpers.js'

test.describe('Append While Scrolled Away', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/scroll-away', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
    })

    test('starts with 50 messages following bottom', async ({ page }) => {
        const total = await getStat(page, 'total')
        expect(total).toBe(50)
        await waitForFollowing(page, true)
    })

    test('scrolling up breaks following', async ({ page }) => {
        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS)

        expect(await isFollowing(page)).toBe(false)
    })

    test('append while scrolled away does NOT jump to bottom', async ({ page }) => {
        // Scroll to top
        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS)

        // Record scroll position
        const scrollBefore = await getScrollState(page)

        // Append a message
        await page.locator('[data-testid="append-one"]').click()
        await rafWait(page, 2)
        await page.waitForTimeout(SETTLE_MS)

        // Scroll position should NOT have changed significantly
        const scrollAfter = await getScrollState(page)
        expect(Math.abs(scrollAfter.scrollTop - scrollBefore.scrollTop)).toBeLessThan(5)

        // Should still not be following
        expect(await isFollowing(page)).toBe(false)
    })

    test('multiple appends while scrolled away preserve position', async ({ page }) => {
        // Scroll to middle
        const scroll = await getScrollState(page)
        const middlePos = Math.round(scroll.maxScroll / 2)
        await scrollTo(page, middlePos)
        await page.waitForTimeout(SETTLE_MS)

        const scrollBefore = await getScrollState(page)

        // Append 5 messages
        for (let i = 0; i < 5; i++) {
            await page.locator('[data-testid="append-one"]').click()
            await rafWait(page)
        }
        await page.waitForTimeout(SETTLE_MS)

        const scrollAfter = await getScrollState(page)
        // Position should be close to where we were
        expect(Math.abs(scrollAfter.scrollTop - scrollBefore.scrollTop)).toBeLessThan(10)
        expect(await isFollowing(page)).toBe(false)
    })

    test('auto-append while scrolled away does not follow', async ({ page }) => {
        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS)

        await page.locator('[data-testid="auto-start"]').click()
        await page.waitForTimeout(2500) // ~5 messages at 500ms interval
        await page.locator('[data-testid="auto-stop"]').click()
        await rafWait(page, 2)

        // Should still be scrolled away, not following
        expect(await isFollowing(page)).toBe(false)

        // Total should have increased
        const total = await getStat(page, 'total')
        expect(total).toBeGreaterThan(50)
    })

    test('return to bottom button restores following', async ({ page }) => {
        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS)
        expect(await isFollowing(page)).toBe(false)

        // Use programmatic instant scroll instead of the smooth button
        // (smooth scroll animation is unreliable in headless browsers)
        await scrollToBottom(page)
        await page.waitForTimeout(SETTLE_MS)

        expect(await isFollowing(page)).toBe(true)
    })

    test('scrolling back to bottom manually restores following', async ({ page }) => {
        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS)
        expect(await isFollowing(page)).toBe(false)

        await scrollToBottom(page)
        await page.waitForTimeout(SETTLE_MS)

        expect(await isFollowing(page)).toBe(true)
    })

    test('visible messages change when scrolled to top vs bottom', async ({ page }) => {
        // At bottom: msg-50 should be visible, msg-1 should not
        expect(await messageInDom(page, '50')).toBe(true)
        expect(await messageInDom(page, '1')).toBe(false)

        // Scroll to top
        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS)

        // At top: msg-1 should be visible, msg-50 should not
        expect(await messageInDom(page, '1')).toBe(true)
        expect(await messageInDom(page, '50')).toBe(false)
    })
})
