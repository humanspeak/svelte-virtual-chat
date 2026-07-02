import { expect, test } from '@playwright/test'
import { SETTLE_MS, expectNoPaintedJumps, getStats, runSweep, waitForMount } from '../helpers.js'

/**
 * Estimate-vs-measured corrections while scrolling through an unmeasured
 * backlog (#44). The contract: while the user scrolls at a constant rate,
 * no painted frame may move on-screen content by anything other than the
 * scroll delta — measurement corrections must be invisible. The sweep
 * mechanics and jump accounting live in the fixture
 * (src/routes/tests/chat/estimate-miss/+page.svelte), which reports
 * jumps / maxJumpPx / totalJumpPx in its stats line.
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

        const after = await runSweep(page)

        // Sanity: the sweep genuinely traversed unmeasured territory (it
        // disengaged follow with one deliberate jump, then measured a
        // meaningful slice of the backlog on the way up).
        expect(after['following']).toBe('false')
        expect(Number(after['sweepFrames'])).toBeGreaterThan(100)
        expect(Number(after['measured'])).toBeGreaterThan(Number(before['measured']) + 10)

        // Every jump here is an estimate-miss correction the user saw as a
        // lurch (when failing, maxJumpPx ≈ the 249px per-message miss).
        expectNoPaintedJumps(after)
    })
})
