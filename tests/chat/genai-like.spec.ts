import { expect, test } from '@playwright/test'
import {
    domMessageCount,
    getRenderedIds,
    getStat,
    rafWait,
    scrollToBottom,
    SETTLE_MS,
    waitForMount
} from '../helpers.js'

test.describe('Genai-like layout (header inside scroll box, composer outside)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/genai-like', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
    })

    test('starts empty', async ({ page }) => {
        expect(await getStat(page, 'total')).toBe(0)
        expect(await domMessageCount(page)).toBe(0)
    })

    test('50 messages scrolled to bottom keeps DOM bounded with header on top', async ({
        page
    }) => {
        await page.locator('[data-testid="load-50"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)
        // Force the worst case: viewport pinned at the very bottom of the
        // scroll container with a header above the messages. Pre-fix the
        // headerHeight coordinate-space bug rendered every message at once.
        await scrollToBottom(page)
        await page.waitForTimeout(SETTLE_MS)

        const total = await getStat(page, 'total')
        const dom = await getStat(page, 'dom')

        expect(total).toBe(50)
        expect(dom).toBeLessThan(20)
        expect(dom).toBeGreaterThan(0)
    })

    test('200 messages stay bounded too', async ({ page }) => {
        await page.locator('[data-testid="load-200"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)
        await scrollToBottom(page)
        await page.waitForTimeout(SETTLE_MS)

        expect(await getStat(page, 'total')).toBe(200)
        expect(await getStat(page, 'dom')).toBeLessThan(25)
    })

    test('rendered ids are sequential and anchored at the end when scrolled to bottom', async ({
        page
    }) => {
        await page.locator('[data-testid="load-50"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)
        await scrollToBottom(page)
        await page.waitForTimeout(SETTLE_MS)

        const ids = await getRenderedIds(page)
        const nums = ids.map(Number)
        expect(nums.length).toBeGreaterThan(0)

        // Sequential — no gaps, no reverse jumps.
        for (let i = 1; i < nums.length; i++) {
            expect(nums[i]).toBe(nums[i - 1] + 1)
        }
        // Anchor at the last message — pre-fix (with the headerHeight bug)
        // the slice started near id 1 and rendered every message.
        expect(nums[nums.length - 1]).toBe(50)
    })

    test('domMessageCount() matches getStat dom', async ({ page }) => {
        await page.locator('[data-testid="load-50"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)
        await scrollToBottom(page)
        await page.waitForTimeout(SETTLE_MS)
        expect(await domMessageCount(page)).toBe(await getStat(page, 'dom'))
    })
})
