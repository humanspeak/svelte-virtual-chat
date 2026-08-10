import { expect, test, type Page } from '@playwright/test'
import { STATS, VIEWPORT, rafWait, waitForMount } from '../helpers.js'

/**
 * Landmark referee for the "slowly scroll up while content grows → view
 * jumps above" report: the user is pinned to the bottom of a chat whose
 * messages contain late-growing regions (loading tables), starts slowly
 * wheeling upward, and the viewport suddenly shows content from much
 * earlier in the conversation.
 *
 * Mechanism under test: while a user-scroll preservation window is open,
 * anchor preservation is gated off and growth is handled by the
 * scroll-progress preserver — which, for upward input, only corrects when
 * the user would GAIN progress. Growth landing ABOVE the viewport makes
 * progress drop, so it returns null and the growth goes uncompensated:
 * everything below the grown block (including the message being read) is
 * pushed down by the full growth height in a single painted frame. A second
 * shape of the same jump: a correction near the bottom clamps against the
 * not-yet-grown spacer and the shortfall paints.
 *
 * Why the existing detectors miss it: the scroll-progress/gap detectors in
 * wheel-scroll-jump.spec.ts and scroll-window-attr-growth.spec.ts skip any
 * frame where maxScroll changed — and this jump happens exactly on the
 * growth frame. A landmark referee has no such blind spot: while scrolling
 * at a constant per-frame step, every on-screen message must move by
 * exactly that step per painted frame, growth frames included.
 *
 * The sweep runs in-page (rAF-phase scrollTop steps, post-paint sampling —
 * see sweepMonitor.svelte.ts for the technique) with a synthetic upward
 * wheel event dispatched before each step so the component attributes the
 * movement to a real user and keeps its intent/preservation windows open,
 * exactly as a slow trackpad scroll does. Growth is driven from inside the
 * rAF phase rather than the fixture's timers — timer-driven growth races
 * the post-paint sampler (a timer can land between paint and sample and
 * read as a jump no user ever saw).
 */

type LandmarkFrame = {
    scrollTop: number
    maxScroll: number
    growths: number
    tops: Record<string, number>
}

/** Per-frame step (px). Small on purpose — this is a *slow* scroll-up. */
const STEP_PX = 12
const MAX_FRAMES = 240
/** Grow one compact block above the fold every N frames. The first pass
 * lands while the bottom gap is still smaller than the growth, exercising
 * the clamped-correction shape of the jump. */
const GROW_EVERY_FRAMES = 10
const GROW_TO_PX = 220
/** Generous slack for sub-pixel rounding and the known bounded
 * leading-margin residual; the uncompensated growth jump is 200px+. */
const JUMP_TOLERANCE_PX = 24

async function runSlowUpscrollSweep(page: Page): Promise<LandmarkFrame[]> {
    return page.evaluate(
        async ({ viewportSelector, stepPx, maxFrames, growEveryFrames, growToPx }) => {
            const viewport = document.querySelector<HTMLElement>(viewportSelector)
            if (!viewport) throw new Error(`Missing viewport ${viewportSelector}`)

            const afterPaint = (beforePaint?: () => void) =>
                new Promise<void>((resolve) => {
                    requestAnimationFrame(() => {
                        beforePaint?.()
                        const channel = new MessageChannel()
                        channel.port1.onmessage = () => resolve()
                        channel.port2.postMessage(null)
                    })
                })

            let growths = 0

            /** The fixture's compact loading-table block nearest above the
             * fold, expanded via the same attribute-only mutation its own
             * timers would apply — but synchronously in the rAF phase. */
            const growNearestBlockAboveViewport = () => {
                const viewportTop = viewport.getBoundingClientRect().top
                const candidates = Array.from(
                    viewport.querySelectorAll<HTMLElement>('[data-testid^="growth-block-"]')
                )
                    .filter(
                        (node) =>
                            node.dataset.state === 'compact' &&
                            node.getBoundingClientRect().bottom <= viewportTop
                    )
                    .sort(
                        (a, b) =>
                            b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom
                    )
                const target = candidates[0]
                if (!target) return
                target.dataset.state = 'expanded'
                target.style.height = `${growToPx}px`
                growths++
            }

            const readFrame = (): LandmarkFrame => {
                // Viewport-relative tops (see sweepMonitor.svelte.ts for why
                // page coordinates are unusable here).
                const viewportTop = viewport.getBoundingClientRect().top
                const tops: Record<string, number> = {}
                for (const el of viewport.querySelectorAll<HTMLElement>('[data-message-id]')) {
                    tops[el.dataset.messageId!] = el.getBoundingClientRect().top - viewportTop
                }
                return {
                    scrollTop: viewport.scrollTop,
                    maxScroll: viewport.scrollHeight - viewport.clientHeight,
                    growths,
                    tops
                }
            }

            const dispatchUpwardWheel = () => {
                // Dispatched on a message element so it bubbles through the
                // component's intent tracker on the viewport — the same path
                // a real trackpad wheel takes.
                const target =
                    viewport.querySelector<HTMLElement>('[data-testid^="msg-"]') ?? viewport
                target.dispatchEvent(
                    new WheelEvent('wheel', { deltaY: -stepPx, bubbles: true, cancelable: true })
                )
            }

            const frames: LandmarkFrame[] = []
            await afterPaint()
            frames.push(readFrame())

            for (let frame = 0; frame < maxFrames; frame++) {
                if (viewport.scrollTop <= 400) break
                await afterPaint(() => {
                    dispatchUpwardWheel()
                    viewport.scrollTop = Math.max(0, viewport.scrollTop - stepPx)
                    if ((frame + 1) % growEveryFrames === 0) growNearestBlockAboveViewport()
                })
                frames.push(readFrame())
            }
            return frames
        },
        {
            viewportSelector: VIEWPORT,
            stepPx: STEP_PX,
            maxFrames: MAX_FRAMES,
            growEveryFrames: GROW_EVERY_FRAMES,
            growToPx: GROW_TO_PX
        }
    )
}

/**
 * Frames where an on-screen message moved DOWN by more than the sweep's own
 * constant step — content shifted under the reader so the viewport shows
 * earlier conversation ("jumped above"). The expected on-screen movement per
 * painted frame is exactly the user's step (the SweepMonitor invariant);
 * comparing against the raw scrollTop delta instead would reduce to the
 * message's document-offset change and flag legitimate compensation writes
 * (which move scrollTop precisely so the on-screen position stays put).
 */
function findUpwardViewJumps(frames: LandmarkFrame[]) {
    const jumps: Array<{
        frame: number
        messageId: string
        deviationPx: number
        growthsDelta: number
    }> = []

    for (let i = 1; i < frames.length; i++) {
        const previous = frames[i - 1]
        const current = frames[i]

        for (const [messageId, top] of Object.entries(current.tops)) {
            const previousTop = previous.tops[messageId]
            if (previousTop === undefined) continue

            const deviation = top - previousTop - STEP_PX
            if (deviation > JUMP_TOLERANCE_PX) {
                jumps.push({
                    frame: i,
                    messageId,
                    deviationPx: Math.round(deviation),
                    growthsDelta: current.growths - previous.growths
                })
                break // one jump per frame, not per message
            }
        }
    }
    return jumps
}

test.describe('Slow upward scroll with above-viewport growth', () => {
    test('keeps the reading position stable when blocks grow above the viewport mid-scroll', async ({
        page
    }) => {
        await page.goto('/tests/chat/scroll-window-attr-growth', {
            waitUntil: 'domcontentloaded'
        })
        await waitForMount(page)
        await expect(page.locator(STATS)).toBeVisible()
        await rafWait(page, 3)

        // Pin to the bottom (follow-bottom engaged) before the slow scroll.
        await page.evaluate((selector) => {
            const el = document.querySelector(selector)
            if (el) el.scrollTop = el.scrollHeight
        }, VIEWPORT)
        await rafWait(page, 2)

        const frames = await runSlowUpscrollSweep(page)

        // Sanity: growth landed mid-sweep, repeatedly, with frames left to
        // observe the consequences.
        const growthValues = frames.map((frame) => frame.growths)
        const firstGrowthFrame = growthValues.findIndex((value) => value > 0)
        expect(Math.max(...growthValues)).toBeGreaterThanOrEqual(5)
        expect(firstGrowthFrame).toBeGreaterThan(0)
        expect(firstGrowthFrame).toBeLessThan(frames.length - 10)

        // Sanity: the sweep really moved the reader up through the backlog.
        // Measured as bottom-gap growth, not raw scrollTop: correct
        // compensation for above-viewport growth adds the grown height back
        // to scrollTop, so the gap is the compensation-invariant record of
        // the user's own travel.
        const first = frames[0]
        const last = frames.at(-1)!
        expect(last.maxScroll - last.scrollTop).toBeGreaterThan(
            first.maxScroll - first.scrollTop + 1000
        )

        // The reported bug: on the growth frame, content shifts down under
        // the reader and the viewport "jumps above" by the growth height.
        expect(findUpwardViewJumps(frames)).toEqual([])
    })
})
