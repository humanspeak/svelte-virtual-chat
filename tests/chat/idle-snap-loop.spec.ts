import { expect, test } from '@playwright/test'
import { SETTLE_MS, VIEWPORT, isFollowing, waitForMount } from '../helpers.js'

/**
 * Regression guard for the standing snap loop (#41).
 *
 * `pendingSnapToBottom` was reactive (`$state`) and read inside
 * `scheduleSnapToBottom`, which the message-count and totalHeight effects
 * call — so the rAF resetting the flag re-triggered those effects, which
 * re-scheduled the snap. The result: `scrollTop = scrollHeight` executed
 * every animation frame while following, even at complete idle. Reading
 * `scrollHeight` forces a synchronous layout, so this was a forced reflow at
 * 60Hz on top of normal rendering.
 *
 * Contract: with the page fully settled — no growth, no input, pinned to the
 * bottom — there must be no per-frame scrollTop writes.
 */

test.describe('Idle snap loop', () => {
    test('no scrollTop writes while idle at the bottom', async ({ page }) => {
        await page.goto('/tests/chat/fill-in', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
        await page.waitForTimeout(SETTLE_MS)
        expect(await isFollowing(page)).toBe(true)

        const writes = await page.evaluate(
            ([viewportSel, frames]) => {
                const viewport = document.querySelector(viewportSel) as HTMLElement
                const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')!
                let count = 0
                Object.defineProperty(viewport, 'scrollTop', {
                    configurable: true,
                    get() {
                        const value: unknown = desc.get!.call(this)
                        return typeof value === 'number' ? value : 0
                    },
                    set(v: number) {
                        count++
                        desc.set!.call(this, v)
                    }
                })

                return new Promise<number>((resolve) => {
                    let n = 0
                    const tick = () => {
                        n++
                        if (n >= (frames as number)) {
                            // restore the native accessor before resolving
                            delete (viewport as unknown as Record<string, unknown>)['scrollTop']
                            resolve(count)
                            return
                        }
                        requestAnimationFrame(tick)
                    }
                    requestAnimationFrame(tick)
                })
            },
            [VIEWPORT, 40] as const
        )

        // A frame-paced loop produces ~1 write per frame (≈40 here). Allow a
        // stray straggler from mount settling, nothing more.
        expect(writes).toBeLessThanOrEqual(1)
    })
})
