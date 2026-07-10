import { expect, test, type Page } from '@playwright/test'
import {
    getRenderedIds,
    getStat,
    isFollowing,
    messageInDom,
    rafWait,
    scrollTo,
    SETTLE_MS,
    VIEWPORT,
    waitForMount
} from '../helpers.js'

/**
 * The message currently at the top of the viewport plus its viewport-relative
 * top offset — the "reading anchor" a history prepend must preserve.
 */
async function topVisibleMessage(page: Page): Promise<{ id: string; top: number } | null> {
    return page.evaluate((vpSel) => {
        const vp = document.querySelector(vpSel)
        if (!vp) return null
        const vpTop = vp.getBoundingClientRect().top
        for (const el of Array.from(document.querySelectorAll('[data-message-id]'))) {
            const rect = el.getBoundingClientRect()
            if (rect.bottom > vpTop + 1) {
                const id = el.getAttribute('data-message-id')
                if (id) return { id, top: rect.top - vpTop }
            }
        }
        return null
    }, VIEWPORT)
}

/** Viewport-relative top of a message by id, or null if it is not in the DOM. */
async function messageTop(page: Page, id: string): Promise<number | null> {
    return page.evaluate(
        ([vpSel, messageId]) => {
            const vp = document.querySelector(vpSel)
            const el = document.querySelector(`[data-message-id="${messageId}"]`)
            if (!vp || !el) return null
            return el.getBoundingClientRect().top - vp.getBoundingClientRect().top
        },
        [VIEWPORT, id] as const
    )
}

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

    test('manual load keeps the reading message pinned', async ({ page }) => {
        await page.waitForTimeout(SETTLE_MS)

        // Scroll ~250px up from the bottom: enough to unfollow, but not far
        // enough to trip the onNeedHistory auto-load (which would prepend
        // before we get to click the button and invalidate the precondition).
        const maxScroll = await page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLElement
            return el.scrollHeight - el.clientHeight
        }, VIEWPORT)
        await scrollTo(page, Math.max(0, maxScroll - 250))
        await page.waitForTimeout(SETTLE_MS)

        expect(await isFollowing(page)).toBe(false)
        expect(await getStat(page, 'prepended')).toBe(0)

        const anchor = await topVisibleMessage(page)
        expect(anchor).not.toBeNull()
        const anchorId = anchor!.id

        await page.locator('[data-testid="load-history"]').click()
        await page.waitForTimeout(300 + SETTLE_MS) // 300ms simulated latency
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        expect(await getStat(page, 'prepended')).toBe(20)
        expect(await messageInDom(page, anchorId)).toBe(true)

        const after = await messageTop(page, anchorId)
        expect(after).not.toBeNull()
        expect(Math.abs(after! - anchor!.top)).toBeLessThanOrEqual(4)
    })

    test('auto load (onNeedHistory) keeps the reading message pinned', async ({ page }) => {
        await page.waitForTimeout(SETTLE_MS)

        // Scroll near the top so scrollTop - topGap < viewportHeight * 0.5,
        // tripping the auto-load threshold.
        await scrollTo(page, 100)

        // Sample the reading anchor at the moment the auto-load fires but
        // before the 300ms-latency prepend lands.
        const ref = await topVisibleMessage(page)
        expect(ref).not.toBeNull()
        const refId = ref!.id

        // Wait for the prepend to complete and layout to settle.
        await page.waitForFunction(
            () => {
                const stats = document.querySelector('[data-testid="debug-stats"]')?.textContent
                return !!stats && !stats.includes('prepended=0')
            },
            undefined,
            { timeout: 5000 }
        )
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        expect(await getStat(page, 'prepended')).toBeGreaterThan(0)

        // The reference message must not have teleported: still rendered, and
        // displaced by well under one viewport height (no eviction into the
        // prepended region).
        expect(await messageInDom(page, refId)).toBe(true)
        const after = await messageTop(page, refId)
        expect(after).not.toBeNull()
        expect(Math.abs(after! - ref!.top)).toBeLessThan(400)
    })
})
