import { expect, test } from '@playwright/test'
import {
    getScrollState,
    getStats,
    waitForFollowing,
    waitForMount,
    waitForStat
} from '../helpers.js'

test.describe('Stream-then-swap keeps follow-bottom', () => {
    for (const variant of ['same-id', 'new-id', 'new-id-two-tick', 'new-id-regrow'] as const) {
        test(`${variant}: viewport stays locked to the bottom through the swap`, async ({
            page
        }) => {
            await page.goto(`/tests/chat/stream-swap?variant=${variant}`, {
                waitUntil: 'domcontentloaded'
            })
            await waitForMount(page)
            await waitForFollowing(page, true)

            await page.locator('[data-testid="run-scenario"]').click()
            await waitForStat(page, 'scenario', 'done', 20000)

            const stats = await getStats(page)
            expect(stats['following']).toBe('true')

            const { gapFromBottom } = await getScrollState(page)
            expect(gapFromBottom).toBeLessThanOrEqual(2)

            expect(Number(stats['maxGapPx'])).toBeLessThanOrEqual(48)
        })
    }
})
