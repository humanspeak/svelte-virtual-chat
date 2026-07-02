import { expect, test, type Page } from '@playwright/test'
import { SETTLE_MS, VIEWPORT, getScrollState, isFollowing, waitForMount } from '../helpers.js'

/**
 * These tests pin down the fill-in sawtooth: when content at the bottom grows
 * while the viewport is following, the catch-up scroll is deferred to a
 * `requestAnimationFrame` (SvelteVirtualChat.svelte, scheduleSnapToBottom),
 * so the frame in which the content grows PAINTS with the taller content and
 * the stale scrollTop. The correction only lands on the next frame's rAF.
 *
 * During streaming that becomes a persistent per-frame bounce at the bottom.
 * ResizeObserver callbacks run after layout but BEFORE paint, so a
 * synchronous scrollTop write in the measurement path would keep every
 * painted frame pinned. That is the contract asserted here: while following,
 * no painted frame may show a gap from the bottom.
 *
 * Measurement design notes (this is easy to get wrong):
 *
 * - A plain rAF sampler cannot see the bug: rAF callbacks run before the
 *   frame's rendering steps, and reading `scrollHeight` there forces layout
 *   early. We sample just AFTER paint instead — an rAF callback posts a
 *   MessageChannel message, and that task runs after the rendering update
 *   commits. Geometry read there is what the user actually saw.
 *
 * - Growth is driven from inside our own rAF callback (one click per frame),
 *   NOT from fixture timers. A setTimeout-driven stream can fire between
 *   paint and the post-paint sample, contaminating the read with growth the
 *   user never saw painted. With rAF-phase growth the frame pipeline is
 *   deterministic: any pending component snap rAF runs first (it was
 *   scheduled during the previous frame), then we grow, then Svelte flushes,
 *   then layout + ResizeObserver + paint — nothing else can interleave
 *   before the sample.
 *
 * - This phase relationship (correction runs just before the next growth
 *   lands) is not an artificial trick: it is exactly where a real token
 *   stream sits whenever a chunk arrives after the previous frame's catch-up
 *   — which at streaming cadence is most frames.
 */

type PaintedFrame = {
    frame: number
    scrollTop: number
    scrollHeight: number
    maxScroll: number
    gap: number
}

/**
 * Grow the bottom message once per frame (via the fixture's grow button,
 * clicked inside the rAF phase) and record viewport geometry after each
 * paint. Returns one sample per painted frame; `gap` is the distance the
 * user saw between the viewport bottom and the content bottom.
 */
async function recordFillFrames(page: Page, frames: number): Promise<PaintedFrame[]> {
    return page.evaluate(
        ([viewportSel, frameCount]) => {
            const viewport = document.querySelector(viewportSel) as HTMLElement | null
            const trigger = document.querySelector(
                '[data-testid="grow-once"]'
            ) as HTMLElement | null
            if (!viewport) throw new Error(`Missing viewport ${viewportSel}`)
            if (!trigger) throw new Error('Missing trigger [data-testid="grow-once"]')

            const read = (frame: number): PaintedFrame => {
                const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
                return {
                    frame,
                    scrollTop: Math.round(viewport.scrollTop),
                    scrollHeight: Math.round(viewport.scrollHeight),
                    maxScroll: Math.round(maxScroll),
                    gap: Math.round(maxScroll - viewport.scrollTop)
                }
            }

            return (async () => {
                const samples: PaintedFrame[] = []
                for (let frame = 0; frame < frameCount; frame++) {
                    await new Promise<void>((resolve) => {
                        requestAnimationFrame(() => {
                            // Grow inside the rAF phase: flushes to the DOM in
                            // the microtask checkpoint right after this
                            // callback, i.e. before this frame's layout,
                            // ResizeObserver delivery, and paint.
                            trigger.click()
                            const channel = new MessageChannel()
                            channel.port1.onmessage = () => resolve()
                            channel.port2.postMessage(null)
                        })
                    })
                    samples.push(read(frame))
                }
                return samples
            })()
        },
        [VIEWPORT, frames] as const
    )
}

test.describe('Fill-in sawtooth (catch-up must land in the growth frame)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/fill-in', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
        await page.waitForTimeout(SETTLE_MS)
    })

    test('per-frame fill-in never paints a frame off the bottom', async ({ page }) => {
        // Precondition: pinned to the bottom and following.
        expect(await isFollowing(page)).toBe(true)
        const before = await getScrollState(page)
        expect(before.gapFromBottom).toBeLessThanOrEqual(2)

        // 24 frames of streaming-cadence growth: +48px per frame, each well
        // under the smooth-easing threshold — this is the instant catch-up
        // path, so there is no legitimate multi-frame animation here.
        const frames = await recordFillFrames(page, 24)

        // Sanity: the fill really ran, and once it stops we settle pinned.
        const last = frames[frames.length - 1]
        expect(last.scrollHeight).toBeGreaterThanOrEqual(before.scrollHeight + 20 * 48)
        await page.waitForTimeout(SETTLE_MS)
        const after = await getScrollState(page)
        expect(after.gapFromBottom).toBeLessThanOrEqual(2)
        expect(await isFollowing(page)).toBe(true)

        // The contract under test: while following the bottom, the catch-up
        // scroll must land in the same frame as the growth. ResizeObserver
        // fires after layout and before paint, so this is achievable — but
        // today the snap is deferred to the NEXT frame's rAF, so every
        // painted frame here shows the bottom pushed away by one growth step
        // (gap ≈ 48). That per-frame bounce is the fill-in sawtooth.
        const offBottomPaints = frames.filter((f) => f.gap > 2)
        expect(offBottomPaints).toEqual([])
    })
})
