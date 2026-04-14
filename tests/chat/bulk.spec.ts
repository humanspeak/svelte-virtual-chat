import { expect, test } from '@playwright/test'
import {
    domMessageCount,
    getRenderedIds,
    getScrollState,
    getStat,
    isFollowing,
    messageInDom,
    rafWait,
    scrollTo,
    SETTLE_MS,
    waitForMount
} from '../helpers.js'

test.describe('Bulk Messages', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/bulk', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
    })

    test('starts empty', async ({ page }) => {
        const count = await domMessageCount(page)
        expect(count).toBe(0)
    })

    test('load 100 messages — dom is much less than total', async ({ page }) => {
        await page.locator('[data-testid="load-100"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        const total = await getStat(page, 'total')
        const dom = await getStat(page, 'dom')

        expect(total).toBe(100)
        expect(dom).toBeLessThan(50) // Should be well under half
        expect(dom).toBeGreaterThan(5) // But not zero
    })

    test('load 1000 messages — dom stays bounded', async ({ page }) => {
        await page.locator('[data-testid="load-1000"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        const total = await getStat(page, 'total')
        const dom = await getStat(page, 'dom')

        expect(total).toBe(1000)
        expect(dom).toBeLessThan(50)
    })

    test('load 5000 messages — dom stays bounded', async ({ page }) => {
        await page.locator('[data-testid="load-5000"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        const total = await getStat(page, 'total')
        const dom = await getStat(page, 'dom')

        expect(total).toBe(5000)
        expect(dom).toBeLessThan(50)
    })

    test('early messages absent, late messages present with 1000 items', async ({ page }) => {
        await page.locator('[data-testid="load-1000"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        // Following bottom — earliest messages should not be in DOM
        expect(await messageInDom(page, '1')).toBe(false)
        expect(await messageInDom(page, '10')).toBe(false)
        expect(await messageInDom(page, '100')).toBe(false)

        // Latest messages should be in DOM
        expect(await messageInDom(page, '1000')).toBe(true)
        expect(await messageInDom(page, '999')).toBe(true)
    })

    test('scrolling to top shows first messages, hides last', async ({ page }) => {
        await page.locator('[data-testid="load-1000"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS)

        expect(await messageInDom(page, '1')).toBe(true)
        expect(await messageInDom(page, '1000')).toBe(false)
    })

    test('dom count is consistent across scroll positions', async ({ page }) => {
        await page.locator('[data-testid="load-1000"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        const positions = [0, 5000, 15000, 30000]
        const domCounts: number[] = []

        for (const pos of positions) {
            await scrollTo(page, pos)
            await page.waitForTimeout(SETTLE_MS)
            domCounts.push(await getStat(page, 'dom'))
        }

        // DOM count should be roughly the same at all positions
        const min = Math.min(...domCounts)
        const max = Math.max(...domCounts)
        expect(max - min).toBeLessThan(15) // Allow some variation from variable heights
    })

    test('clear removes all messages', async ({ page }) => {
        await page.locator('[data-testid="load-100"]').click()
        await rafWait(page, 2)

        await page.locator('[data-testid="clear"]').click()
        await rafWait(page, 2)

        const total = await getStat(page, 'total')
        expect(total).toBe(0)

        const count = await domMessageCount(page)
        expect(count).toBe(0)
    })

    test('sequential loads accumulate', async ({ page }) => {
        await page.locator('[data-testid="load-100"]').click()
        await rafWait(page, 2)
        await page.locator('[data-testid="load-100"]').click()
        await rafWait(page, 2)
        await page.waitForTimeout(SETTLE_MS)

        const total = await getStat(page, 'total')
        expect(total).toBe(200)

        const dom = await getStat(page, 'dom')
        expect(dom).toBeLessThan(50)
    })

    test('following bottom after load', async ({ page }) => {
        await page.locator('[data-testid="load-1000"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        expect(await isFollowing(page)).toBe(true)

        const scroll = await getScrollState(page)
        expect(scroll.gapFromBottom).toBeLessThanOrEqual(2)
    })

    test('rendered IDs are sequential at any scroll position', async ({ page }) => {
        await page.locator('[data-testid="load-1000"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        // Check at middle scroll position
        await scrollTo(page, 15000)
        await page.waitForTimeout(SETTLE_MS)

        const ids = await getRenderedIds(page)
        const nums = ids.map(Number)

        for (let i = 1; i < nums.length; i++) {
            expect(nums[i]).toBe(nums[i - 1] + 1)
        }
    })
})
