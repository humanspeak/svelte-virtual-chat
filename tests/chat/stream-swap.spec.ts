import { expect, test, type Page } from '@playwright/test'
import {
    getScrollState,
    getStats,
    waitForFollowing,
    waitForMount,
    waitForStat
} from '../helpers.js'

async function runScenario(page: Page) {
    await page.locator('[data-testid="run-scenario"]').click()
    await waitForStat(page, 'scenario', 'running', 1000)
    await waitForStat(page, 'scenario', 'done', 20000)
}

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

            await runScenario(page)

            const stats = await getStats(page)
            expect(stats['following']).toBe('true')

            const { gapFromBottom } = await getScrollState(page)
            expect(gapFromBottom).toBeLessThanOrEqual(2)

            expect(Number(stats['maxGapPx'])).toBeLessThanOrEqual(48)
        })
    }

    test('new-id reruns append distinct final messages without resetting history', async ({
        page
    }) => {
        await page.goto('/tests/chat/stream-swap?variant=new-id', {
            waitUntil: 'domcontentloaded'
        })
        await waitForMount(page)
        await waitForFollowing(page, true)

        await runScenario(page)
        let stats = await getStats(page)
        expect(stats['total']).toBe('26')
        expect(stats['tail']).toBe('convex-1:final')

        await runScenario(page)
        stats = await getStats(page)
        expect(stats['total']).toBe('27')
        expect(stats['tail']).toBe('convex-2:final')
        expect(stats['following']).toBe('true')
    })
})
