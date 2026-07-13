import { expect, test, type Page } from '@playwright/test'
import {
    getRenderedIds,
    getScrollState,
    getStat,
    isFollowing,
    messageInDom,
    rafWait,
    scrollByWheel,
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

type FrameRead = { kind: 'gapFromBottom' } | { kind: 'messageTop'; id: string }

/**
 * Start an in-page per-frame rAF sampler. Settle-based assertions cannot see
 * a transient that a later correction converges back before a post-settle
 * read — recording every frame captures any painted excursion. Records the
 * viewport's distance from bottom, or a message's viewport-relative top
 * (`null` when the message is not in the DOM).
 */
async function startFrameSampler(page: Page, read: FrameRead): Promise<void> {
    await page.evaluate(
        ([vpSel, kind, messageId]) => {
            const w = window as unknown as {
                __frameSamples: (number | null)[]
                __frameSamplerStop: boolean
            }
            w.__frameSamples = []
            w.__frameSamplerStop = false
            const sample = () => {
                const vp = document.querySelector(vpSel)
                let value: number | null = null
                if (vp && kind === 'gapFromBottom') {
                    value = vp.scrollHeight - vp.scrollTop - vp.clientHeight
                } else if (vp) {
                    const el = document.querySelector(`[data-message-id="${messageId}"]`)
                    if (el) {
                        value = el.getBoundingClientRect().top - vp.getBoundingClientRect().top
                    }
                }
                w.__frameSamples.push(value)
                if (!w.__frameSamplerStop) requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
        },
        [VIEWPORT, read.kind, read.kind === 'messageTop' ? read.id : ''] as const
    )
}

/**
 * Wait on the sampler's frame count rather than wall time: CPU throttling
 * slows frame delivery, and the >= 60 frame contract must hold regardless.
 */
async function waitForFrames(page: Page, frames: number, timeout: number): Promise<void> {
    await page.waitForFunction(
        (min) =>
            (window as unknown as { __frameSamples: (number | null)[] }).__frameSamples.length >=
            min,
        frames,
        { timeout }
    )
}

/** Stop the sampler and return everything it recorded. */
async function collectFrames(page: Page): Promise<(number | null)[]> {
    return page.evaluate(() => {
        const w = window as unknown as {
            __frameSamples: (number | null)[]
            __frameSamplerStop: boolean
        }
        w.__frameSamplerStop = true
        return w.__frameSamples
    })
}

/**
 * Scroll ~250px up from the bottom: enough to unfollow, but not far enough
 * to trip the onNeedHistory auto-load (which would prepend before the test
 * clicks the button and invalidate its precondition). Returns the reading
 * anchor a prepend must preserve.
 */
async function unfollowNearBottom(page: Page): Promise<{ id: string; top: number }> {
    await page.waitForTimeout(SETTLE_MS)
    const { maxScroll } = await getScrollState(page)
    await scrollTo(page, Math.max(0, maxScroll - 250))
    await page.waitForTimeout(SETTLE_MS)

    expect(await isFollowing(page)).toBe(false)
    expect(await getStat(page, 'prepended')).toBe(0)

    const anchor = await topVisibleMessage(page)
    expect(anchor).not.toBeNull()
    return anchor!
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
        const anchor = await unfollowNearBottom(page)

        await page.locator('[data-testid="load-history"]').click()
        await page.waitForTimeout(300 + SETTLE_MS) // 300ms simulated latency
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        expect(await getStat(page, 'prepended')).toBe(20)
        expect(await messageInDom(page, anchor.id)).toBe(true)

        const after = await messageTop(page, anchor.id)
        expect(after).not.toBeNull()
        expect(Math.abs(after! - anchor.top)).toBeLessThanOrEqual(4)
    })

    test('manual load does not visibly scroll during the prepend', async ({
        page,
        browserName
    }) => {
        // CDP CPU throttling is chromium-only; the transient this test pins
        // only manifests when a main-thread stall lets a frame paint between
        // the prepended DOM landing and the anchor restore.
        test.skip(browserName !== 'chromium', 'CDP CPU throttling is chromium-only')

        const anchor = await unfollowNearBottom(page)
        await startFrameSampler(page, { kind: 'messageTop', id: anchor.id })

        // Rate 8: plan's escalation ceiling (4 and 6 also tried); no rate
        // reproduced the red on 9a0b5a3 — see the Step 1c stop report.
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 })

        await page.locator('[data-testid="load-history"]').click()
        // Sample through the 300ms simulated latency plus restore and settle.
        await waitForFrames(page, 60, 30000)

        const samples = await collectFrames(page)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

        expect(await getStat(page, 'prepended')).toBe(20)
        expect(samples.length).toBeGreaterThanOrEqual(60)

        const nullFrames = samples.filter((s) => s === null).length
        const maxDeviation = samples
            .filter((s): s is number => s !== null)
            .reduce((max, s) => Math.max(max, Math.abs(s - anchor.top)), 0)
        const signature =
            `anchor=${anchor.id} frames=${samples.length} nullFrames=${nullFrames} ` +
            `maxDeviation=${maxDeviation.toFixed(1)}px baseline=${anchor.top.toFixed(1)}px`

        // Every painted frame must show the anchor within 8px of where the
        // user was reading — "one frame, no visible flicker" is the contract.
        expect(nullFrames, `anchor left the DOM mid-prepend (${signature})`).toBe(0)
        expect(
            maxDeviation,
            `anchor visibly moved during the prepend (${signature})`
        ).toBeLessThanOrEqual(8)
    })

    test('prepend while following bottom stays pinned to the bottom', async ({ page }) => {
        await page.waitForTimeout(SETTLE_MS)

        // No scrolling at all: the user is reading the live bottom. A prepend
        // grows content ABOVE them, so their view must not move.
        expect(await isFollowing(page)).toBe(true)
        expect(await getStat(page, 'prepended')).toBe(0)

        await startFrameSampler(page, { kind: 'gapFromBottom' })

        await page.locator('[data-testid="load-history"]').click()
        // Sample through the 300ms simulated latency plus settle (>= 60 frames).
        await waitForFrames(page, 60, 15000)

        const samples = await collectFrames(page)

        expect(await getStat(page, 'prepended')).toBe(20)
        expect(samples.length).toBeGreaterThanOrEqual(60)

        const distances = samples.filter((s): s is number => s !== null)
        const maxDistance = distances.reduce((max, s) => Math.max(max, s), 0)
        const framesOffBottom = distances.filter((s) => s > 8).length
        const signature =
            `frames=${samples.length} framesOffBottom=${framesOffBottom} ` +
            `maxDistance=${maxDistance.toFixed(1)}px`

        // No painted frame may show the viewport off the bottom while the
        // user is following — content growing above must not displace them.
        expect(
            maxDistance,
            `viewport fell off the bottom during the prepend (${signature})`
        ).toBeLessThanOrEqual(8)
        expect(await isFollowing(page), `follow state lost after prepend (${signature})`).toBe(true)
    })

    test('prepend inside the follow re-engage window stays pinned to the bottom', async ({
        page
    }, testInfo) => {
        await page.waitForTimeout(SETTLE_MS)

        // Real wheel input, not scrollTo: the scroll-progress preservation
        // window only opens on user intent, and this test targets a prepend
        // landing inside that window right after the user flicks back to the
        // bottom (following re-engaged, preservation still active).
        const viewport = page.locator(VIEWPORT)
        await scrollByWheel(page, viewport, -250, testInfo)
        expect(await isFollowing(page)).toBe(false)

        await scrollByWheel(page, viewport, 600, testInfo)
        expect(await isFollowing(page)).toBe(true)
        expect(await getStat(page, 'prepended')).toBe(0)

        await startFrameSampler(page, { kind: 'gapFromBottom' })

        // No settle here: the click must land while the window is still open.
        await page.locator('[data-testid="load-history"]').click()
        await waitForFrames(page, 60, 15000)

        const samples = await collectFrames(page)

        expect(await getStat(page, 'prepended')).toBe(20)
        expect(samples.length).toBeGreaterThanOrEqual(60)

        const distances = samples.filter((s): s is number => s !== null)
        const maxDistance = distances.reduce((max, s) => Math.max(max, s), 0)
        const framesOffBottom = distances.filter((s) => s > 8).length
        const signature =
            `frames=${samples.length} framesOffBottom=${framesOffBottom} ` +
            `maxDistance=${maxDistance.toFixed(1)}px`

        expect(
            maxDistance,
            `viewport fell off the bottom during the prepend (${signature})`
        ).toBeLessThanOrEqual(8)
        expect(await isFollowing(page), `follow state lost after prepend (${signature})`).toBe(true)
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
        await expect.poll(() => getStat(page, 'prepended'), { timeout: 5000 }).toBeGreaterThan(0)
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
