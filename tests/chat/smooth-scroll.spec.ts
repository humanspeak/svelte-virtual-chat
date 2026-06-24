import { expect, test } from '@playwright/test'
import {
    getScrollState,
    isFollowing,
    rafWait,
    SETTLE_MS,
    VIEWPORT,
    waitForMount
} from '../helpers.js'

type FollowFrame = {
    scrollTop: number
    scrollHeight: number
    clientHeight: number
    maxScroll: number
    gap: number
}

/**
 * Trigger a discrete bottom growth and record viewport geometry once per
 * animation frame, frame-aligned with the growth.
 *
 * The recorder fires the trigger and then samples the same way the component
 * sees the world: one read per `requestAnimationFrame`. Aligning the trigger
 * with the sampler (both inside one `page.evaluate`) means frame 0 is the
 * pre-growth baseline and every subsequent frame captures the settle.
 */
async function recordGrowth(
    page: import('@playwright/test').Page,
    triggerSelector: string,
    frames = 45
): Promise<FollowFrame[]> {
    return page.evaluate(
        ([viewportSel, triggerSel, frameCount]) => {
            const viewport = document.querySelector(viewportSel as string) as HTMLElement | null
            const trigger = document.querySelector(triggerSel as string) as HTMLElement | null
            if (!viewport) throw new Error(`Missing viewport ${viewportSel}`)
            if (!trigger) throw new Error(`Missing trigger ${triggerSel}`)

            const read = (): FollowFrame => {
                const maxScroll = viewport.scrollHeight - viewport.clientHeight
                return {
                    scrollTop: Math.round(viewport.scrollTop),
                    scrollHeight: Math.round(viewport.scrollHeight),
                    clientHeight: Math.round(viewport.clientHeight),
                    maxScroll: Math.round(maxScroll),
                    gap: Math.round(maxScroll - viewport.scrollTop)
                }
            }

            return new Promise<FollowFrame[]>((resolve) => {
                const samples: FollowFrame[] = []
                samples.push(read()) // frame 0: pre-growth baseline
                trigger.click() // discrete content growth at the bottom
                let n = 0
                const loop = () => {
                    samples.push(read())
                    n += 1
                    if (n < (frameCount as number)) {
                        requestAnimationFrame(loop)
                    } else {
                        resolve(samples)
                    }
                }
                requestAnimationFrame(loop)
            })
        },
        [VIEWPORT, triggerSelector, frames] as const
    )
}

/**
 * Index of the first frame after which `scrollHeight` never changes again —
 * i.e. the moment the content has finished growing/measuring. Any scrollTop
 * motion after this index is the viewport scrolling, not the content resizing.
 */
function heightSettleIndex(frames: FollowFrame[]): number {
    const finalHeight = frames[frames.length - 1].scrollHeight
    for (let i = 0; i < frames.length; i++) {
        if (
            frames[i].scrollHeight === finalHeight &&
            frames.slice(i).every((f) => f.scrollHeight === finalHeight)
        ) {
            return i
        }
    }
    return frames.length - 1
}

test.describe('Smooth scroll to bottom on growth', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/append', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
        await page.waitForTimeout(SETTLE_MS)
    })

    test('eases to the bottom over multiple frames when content grows while following', async ({
        page
    }) => {
        // Precondition: pinned to the bottom and following.
        expect(await isFollowing(page)).toBe(true)
        const before = await getScrollState(page)
        expect(before.gapFromBottom).toBeLessThanOrEqual(2)

        // Discrete bottom growth: append 10 messages in one shot.
        const frames = await recordGrowth(page, '[data-testid="append-ten"]')

        // It must still end pinned to the bottom, still following.
        const last = frames[frames.length - 1]
        expect(last.gap).toBeLessThanOrEqual(2)
        expect(await isFollowing(page)).toBe(true)

        // The content grew — the new bottom is meaningfully further down than
        // where we started. (Sanity: the scenario actually exercised a jump.)
        const growth = last.maxScroll - frames[0].maxScroll
        expect(growth).toBeGreaterThan(100)

        // Smooth signature: after the content height has settled, scrollTop is
        // still climbing toward the bottom over several frames.
        //
        // A snap (`scrollTop = scrollHeight` in one frame) lands scrollTop at
        // the bottom on the same frame the height settles, so post-settle
        // motion is ~0. Easing keeps moving for many frames afterwards.
        const settle = heightSettleIndex(frames)
        const postSettle = frames.slice(settle)

        const postSettleMotion = last.scrollTop - frames[settle].scrollTop
        expect(postSettleMotion).toBeGreaterThan(20)

        const increasingSteps = postSettle.filter(
            (f, i) => i > 0 && f.scrollTop > postSettle[i - 1].scrollTop
        ).length
        expect(increasingSteps).toBeGreaterThanOrEqual(3)

        // And it should never overshoot past the bottom on any frame.
        for (const f of frames) {
            expect(f.scrollTop).toBeLessThanOrEqual(f.maxScroll + 2)
        }
    })

    test('does not animate when not following (user scrolled away stays put)', async ({ page }) => {
        // Scroll up so we are no longer following bottom.
        await page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLElement
            el.scrollTo({ top: 0, behavior: 'instant' })
        }, VIEWPORT)
        await rafWait(page, 2)
        expect(await isFollowing(page)).toBe(false)

        const before = await getScrollState(page)
        const frames = await recordGrowth(page, '[data-testid="append-ten"]')
        const last = frames[frames.length - 1]

        // Not following: growth must not drag the viewport toward the bottom.
        expect(await isFollowing(page)).toBe(false)
        expect(Math.abs(last.scrollTop - before.scrollTop)).toBeLessThanOrEqual(4)
    })
})
