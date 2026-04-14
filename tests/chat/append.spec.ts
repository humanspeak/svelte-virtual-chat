import { expect, test } from '@playwright/test'
import {
    getRenderedIds,
    getScrollState,
    getStat,
    isFollowing,
    rafWait,
    SETTLE_MS,
    waitForFollowing,
    waitForMount
} from '../helpers.js'

test.describe('Append While Following', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/append', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
        await page.waitForTimeout(SETTLE_MS)
    })

    test('starts with 20 initial messages', async ({ page }) => {
        const total = await getStat(page, 'total')
        expect(total).toBe(20)
    })

    test('starts in following state', async ({ page }) => {
        await waitForFollowing(page, true)
        expect(await isFollowing(page)).toBe(true)
    })

    test('append one keeps following', async ({ page }) => {
        await page.locator('[data-testid="append-one"]').click()
        await rafWait(page, 2)
        await page.waitForTimeout(SETTLE_MS)

        await waitForFollowing(page, true)
        const total = await getStat(page, 'total')
        expect(total).toBe(21)
    })

    test('append ten keeps following', async ({ page }) => {
        await page.locator('[data-testid="append-ten"]').click()

        // Batch append triggers many ResizeObserver callbacks.
        // Wait for all measurements to settle, then check.
        await page.waitForTimeout(1000)
        await rafWait(page, 3)

        const total = await getStat(page, 'total')
        expect(total).toBe(30)

        // Viewport should be at or near bottom after batch
        const scroll = await getScrollState(page)
        expect(scroll.gapFromBottom).toBeLessThanOrEqual(50)
    })

    test('newest message is always visible while following', async ({ page }) => {
        for (let i = 0; i < 5; i++) {
            await page.locator('[data-testid="append-one"]').click()
            await rafWait(page)
        }
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        // Message id=25 should be the latest and attached to DOM
        await expect(page.locator('[data-testid="msg-25"]')).toBeAttached()
    })

    test('viewport stays at bottom during rapid appends', async ({ page }) => {
        // Rapid-fire 20 appends
        for (let i = 0; i < 20; i++) {
            await page.locator('[data-testid="append-one"]').click()
        }
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        const scroll = await getScrollState(page)
        expect(scroll.gapFromBottom).toBeLessThanOrEqual(5)
        await waitForFollowing(page, true)
    })

    test('dom count stays bounded during appends', async ({ page }) => {
        // Add 50 more messages (total 70)
        for (let i = 0; i < 5; i++) {
            await page.locator('[data-testid="append-ten"]').click()
        }
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        const total = await getStat(page, 'total')
        const dom = await getStat(page, 'dom')

        expect(total).toBe(70)
        expect(dom).toBeLessThan(total)
        expect(dom).toBeLessThan(40) // Reasonable upper bound for 400px viewport
    })

    test('old messages get virtualized during appends', async ({ page }) => {
        for (let i = 0; i < 5; i++) {
            await page.locator('[data-testid="append-ten"]').click()
            await rafWait(page)
        }
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS * 3)

        const dom = await getStat(page, 'dom')
        const total = await getStat(page, 'total')
        expect(total).toBe(70)
        expect(dom).toBeLessThan(total)
    })

    test('auto-append keeps following over time', async ({ page }) => {
        await page.locator('[data-testid="auto-start"]').click()

        // Let it run for ~2 seconds (about 10 messages at 200ms interval)
        await page.waitForTimeout(2000)

        await page.locator('[data-testid="auto-stop"]').click()
        await rafWait(page, 2)

        await waitForFollowing(page, true)

        const total = await getStat(page, 'total')
        expect(total).toBeGreaterThan(25)
    })

    test('rendered IDs are sequential', async ({ page }) => {
        await rafWait(page, 2)
        const ids = await getRenderedIds(page)
        const nums = ids.map(Number)

        // Each consecutive ID should be exactly 1 more than the previous
        for (let i = 1; i < nums.length; i++) {
            expect(nums[i]).toBe(nums[i - 1] + 1)
        }
    })
})
