import { expect, test } from '@playwright/test'
import { SETTLE_MS, getStats, waitForMount } from '../helpers.js'

/**
 * Estimate-vs-measured corrections while scrolling through an unmeasured
 * backlog.
 *
 * The fixture renders messages ~321px tall against a 72px
 * `estimatedMessageHeight`. Messages outside the initial render window stay
 * unmeasured, so scrolling up through the backlog re-measures each one as it
 * enters the overscan — a ~249px totalHeight correction per message. The
 * correction shifts everything below the measured item, and the anchor
 * restore that should hide the shift is deferred to the next rAF
 * (scheduleAnchorRestore), so the user sees the content lurch by the full
 * miss and bounce back, once per message, for the entire scroll.
 *
 * The fixture's built-in sweep makes this measurable from the UI: it scrolls
 * up a fixed step per frame and samples message positions after each paint
 * (rAF → MessageChannel). While scrolling by exactly N px per frame, every
 * on-screen message must move by exactly N px per painted frame — any
 * deviation is a jump the user saw, counted and sized in the stats line
 * (jumps / maxJumpPx / totalJumpPx).
 *
 * Contract: zero painted correction jumps. Today this fails with jumps in
 * the dozens and maxJumpPx equal to the full estimate miss (~249px).
 */

test.describe('Estimate miss (unmeasured backlog corrections)', () => {
    test('scrolling up through the unmeasured backlog paints no correction jumps', async ({
        page
    }) => {
        await page.goto('/tests/chat/estimate-miss', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
        await page.waitForTimeout(SETTLE_MS)

        // Preconditions: pinned to the bottom with the backlog unmeasured —
        // only the initially rendered window has real heights.
        const before = await getStats(page)
        expect(before['following']).toBe('true')
        expect(Number(before['measured'])).toBeLessThan(20)

        await page.locator('[data-testid="start-sweep"]').click()
        await page.waitForFunction(
            () =>
                document
                    .querySelector('[data-testid="debug-stats"]')
                    ?.textContent?.includes('sweep=done'),
            { timeout: 20000 }
        )

        const after = await getStats(page)

        // Sanity: the sweep genuinely traversed unmeasured territory (it
        // disengaged follow with one deliberate jump, then measured a
        // meaningful slice of the backlog on the way up).
        expect(after['following']).toBe('false')
        expect(Number(after['sweepFrames'])).toBeGreaterThan(100)
        expect(Number(after['measured'])).toBeGreaterThan(Number(before['measured']) + 10)

        // The contract under test: while the user scrolls at a constant rate,
        // no painted frame may show content moving by anything other than the
        // scroll delta. Every jump here is an estimate-miss correction the
        // user saw as a lurch (maxJumpPx ≈ the 249px per-message miss).
        expect({
            jumps: Number(after['jumps']),
            maxJumpPx: Number(after['maxJumpPx']),
            totalJumpPx: Number(after['totalJumpPx'])
        }).toEqual({ jumps: 0, maxJumpPx: 0, totalJumpPx: 0 })
    })
})
