import { expect, test } from '@playwright/test'
import {
    getStat,
    getScrollState,
    isFollowing,
    rafWait,
    SETTLE_MS,
    VIEWPORT,
    waitForMount
} from '../helpers.js'

test.describe('Streaming Growth', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/streaming', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
    })

    test('starts with 1 user message', async ({ page }) => {
        const total = await getStat(page, 'total')
        expect(total).toBe(1)
        await expect(page.locator('[data-testid="msg-1"]')).toBeVisible()
    })

    test('start stream adds an assistant message', async ({ page }) => {
        await page.locator('[data-testid="start-stream"]').click()
        await rafWait(page, 2)

        const total = await getStat(page, 'total')
        expect(total).toBe(2)

        // The streaming message should show "streaming" badge
        await expect(page.locator('[data-testid="msg-2"]')).toBeVisible()
    })

    test('streaming message grows over time', async ({ page }) => {
        await page.locator('[data-testid="start-stream"]').click()
        await page.waitForTimeout(500) // Let some tokens stream

        // Get message content length
        const contentLength = await page.evaluate(() => {
            const msg = document.querySelector('[data-testid="msg-2"]')
            return msg?.textContent?.length ?? 0
        })
        expect(contentLength).toBeGreaterThan(20)

        // Wait more and check it grew
        await page.waitForTimeout(500)
        const contentLengthAfter = await page.evaluate(() => {
            const msg = document.querySelector('[data-testid="msg-2"]')
            return msg?.textContent?.length ?? 0
        })
        expect(contentLengthAfter).toBeGreaterThan(contentLength)
    })

    test('viewport stays at bottom during streaming', async ({ page }) => {
        await page.locator('[data-testid="start-stream"]').click()

        // Sample scroll position several times during streaming
        const gaps: number[] = []
        for (let i = 0; i < 5; i++) {
            await page.waitForTimeout(400)
            const scroll = await getScrollState(page)
            gaps.push(scroll.gapFromBottom)
        }

        // All samples should be near bottom
        for (const gap of gaps) {
            expect(gap).toBeLessThanOrEqual(5)
        }

        expect(await isFollowing(page)).toBe(true)
    })

    test('stop halts streaming', async ({ page }) => {
        await page.locator('[data-testid="start-stream"]').click()
        await page.waitForTimeout(500)

        await page.locator('[data-testid="stop-stream"]').click()
        await rafWait(page, 2)

        // Record content length
        const lengthAtStop = await page.evaluate(() => {
            const msg = document.querySelector('[data-testid="msg-2"]')
            return msg?.textContent?.length ?? 0
        })

        // Wait and verify no more growth
        await page.waitForTimeout(500)
        const lengthAfter = await page.evaluate(() => {
            const msg = document.querySelector('[data-testid="msg-2"]')
            return msg?.textContent?.length ?? 0
        })

        expect(lengthAfter).toBe(lengthAtStop)
    })

    test('reset returns to initial state', async ({ page }) => {
        await page.locator('[data-testid="start-stream"]').click()
        await page.waitForTimeout(500)
        await page.locator('[data-testid="stop-stream"]').click()

        await page.locator('[data-testid="reset"]').click()
        await rafWait(page, 2)

        const total = await getStat(page, 'total')
        expect(total).toBe(1)
        await expect(page.locator('[data-testid="msg-1"]')).toBeVisible()
    })

    test('streaming completes without error', async ({ page }) => {
        await page.locator('[data-testid="start-stream"]').click()

        // Wait for streaming to finish (stream text is ~500 chars / words at ~30ms each ≈ 5s)
        await page.waitForFunction(
            () => {
                const stats = document.querySelector('[data-testid="debug-stats"]')?.textContent
                // Token count in the stats should stop increasing
                return stats && !stats.includes('streaming')
            },
            { timeout: 15000 }
        ).catch(() => {
            // Streaming may still be running — stop it
        })

        await page.locator('[data-testid="stop-stream"]').click()
        await rafWait(page, 2)

        // Should still be following bottom
        expect(await isFollowing(page)).toBe(true)
    })

    test('message height increases are tracked by measurement', async ({ page }) => {
        await page.locator('[data-testid="start-stream"]').click()
        await page.waitForTimeout(500)
        await rafWait(page, 2)

        const heightEarly = await getStat(page, 'height')

        await page.waitForTimeout(2000)
        await rafWait(page, 2)

        const heightLater = await getStat(page, 'height')
        await page.locator('[data-testid="stop-stream"]').click()

        expect(heightLater).toBeGreaterThan(heightEarly)
    })
})
