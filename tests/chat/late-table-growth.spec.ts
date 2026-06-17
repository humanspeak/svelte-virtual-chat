import { expect, test } from '@playwright/test'
import { getScrollState, isFollowing, rafWait, waitForMount } from '../helpers.js'

test.describe('Late table growth', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/late-table-growth', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
    })

    test('stays pinned to bottom when an initially rendered table expands after mount', async ({
        page
    }) => {
        await expect(page.locator('[data-testid="table-state"]')).toHaveText('expanded')
        await rafWait(page, 3)
        await page.waitForTimeout(350)

        const scroll = await getScrollState(page)
        expect(scroll.gapFromBottom).toBeLessThanOrEqual(2)
        expect(await isFollowing(page)).toBe(true)
        await expect(page.locator('[data-testid="msg-5"]')).toBeVisible()
    })
})
