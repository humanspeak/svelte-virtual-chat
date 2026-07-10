import { expect, test } from '@playwright/test'
import { VIEWPORT, getScrollState, isFollowing, rafWait, waitForMount } from '../helpers.js'

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
        await page.waitForFunction(
            (selector) => {
                const viewport = document.querySelector(selector)
                if (!viewport) return false

                const snapshot = {
                    scrollTop: Math.round(viewport.scrollTop),
                    scrollHeight: Math.round(viewport.scrollHeight),
                    clientHeight: Math.round(viewport.clientHeight)
                }
                const stateKey = '__lateTableGrowthStableScroll'
                const win = window as typeof window & {
                    [stateKey]?: typeof snapshot & { stableSince: number }
                }
                const previous = win[stateKey]
                const now = performance.now()
                const changed =
                    !previous ||
                    previous.scrollTop !== snapshot.scrollTop ||
                    previous.scrollHeight !== snapshot.scrollHeight ||
                    previous.clientHeight !== snapshot.clientHeight

                if (changed) {
                    win[stateKey] = { ...snapshot, stableSince: now }
                    return false
                }

                const gap = snapshot.scrollHeight - snapshot.clientHeight - snapshot.scrollTop
                return gap <= 2 && now - previous.stableSince >= 80
            },
            VIEWPORT,
            { timeout: 1000, polling: 'raf' }
        )

        const scroll = await getScrollState(page)
        expect(scroll.gapFromBottom).toBeLessThanOrEqual(2)
        expect(await isFollowing(page)).toBe(true)
        await expect(page.locator('[data-testid="msg-5"]')).toBeVisible()
    })
})
