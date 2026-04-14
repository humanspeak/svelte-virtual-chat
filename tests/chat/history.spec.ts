import { expect, test } from '@playwright/test'
import { getRenderedIds, getStat, rafWait, scrollTo, SETTLE_MS, waitForMount } from '../helpers.js'

test.describe('Prepend History', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/history', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
    })

    test('starts with 20 messages (IDs 100-119)', async ({ page }) => {
        const total = await getStat(page, 'total')
        expect(total).toBe(20)
    })

    test('load history prepends 20 older messages', async ({ page }) => {
        await page.locator('[data-testid="load-history"]').click()
        await page.waitForTimeout(500) // Simulated network delay + rendering
        await rafWait(page, 2)

        const total = await getStat(page, 'total')
        expect(total).toBe(40)
    })

    test('prepended messages have lower IDs', async ({ page }) => {
        await page.locator('[data-testid="load-history"]').click()
        await page.waitForTimeout(600)
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        // Scroll to very top to see the new messages
        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS * 2)

        // After prepend, IDs 80-99 should now exist. Check one is in DOM at top.
        const ids = await getRenderedIds(page)
        const nums = ids.map(Number)
        const minId = Math.min(...nums)
        expect(minId).toBeLessThan(100)
    })

    test('multiple history loads accumulate correctly', async ({ page }) => {
        // Load 3 batches
        for (let i = 0; i < 3; i++) {
            await page.locator('[data-testid="load-history"]').click()
            await page.waitForTimeout(600) // Wait for simulated network delay
            await rafWait(page, 2)
        }

        const total = await getStat(page, 'total')
        expect(total).toBe(80) // 20 initial + 3 * 20 prepended
    })

    test('rendered IDs are in ascending order', async ({ page }) => {
        const ids = await getRenderedIds(page)
        const nums = ids.map(Number)

        for (let i = 1; i < nums.length; i++) {
            expect(nums[i]).toBeGreaterThan(nums[i - 1])
        }
    })

    test('prepend count tracks correctly', async ({ page }) => {
        await page.locator('[data-testid="load-history"]').click()
        await page.waitForTimeout(500)
        await rafWait(page, 2)

        const stats = await page.locator('[data-testid="debug-stats"]').textContent()
        expect(stats).toContain('prepended=20')
    })

    test('total count increases after prepend', async ({ page }) => {
        const totalBefore = await getStat(page, 'total')

        await page.locator('[data-testid="load-history"]').click()
        await page.waitForTimeout(600)
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        const totalAfter = await getStat(page, 'total')
        expect(totalAfter).toBeGreaterThan(totalBefore)
        expect(totalAfter).toBe(40)
    })

    test('dom count stays bounded after prepend', async ({ page }) => {
        // Load a lot of history
        for (let i = 0; i < 3; i++) {
            await page.locator('[data-testid="load-history"]').click()
            await page.waitForTimeout(600)
        }
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        const total = await getStat(page, 'total')
        const dom = await getStat(page, 'dom')

        expect(total).toBe(80)
        expect(dom).toBeLessThan(total)
    })
})
