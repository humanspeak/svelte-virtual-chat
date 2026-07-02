import { expect, test, type Page } from '@playwright/test'
import {
    expectNoPaintedJumps,
    getStats,
    runSweep,
    waitForFollowing,
    waitForMount
} from '../helpers.js'

/**
 * Bubble margins must not escape the geometry math (#47). The contract has
 * two halves: the height accounting must cover each message's full visual
 * pitch (marginLossPx = 0), and constant-rate scrolling must paint no
 * range-boundary jumps — in either direction. Fixture mechanics and the
 * live numbers (marginLossPx, jumps / maxJumpPx / totalJumpPx) live in
 * src/routes/tests/chat/margin-bubbles/+page.svelte; estimates there equal
 * the bubbles' border-box height exactly, so margins are the only variable.
 */

const BUBBLE_MARGIN_PX = 12

async function openSettled(page: Page) {
    await page.goto('/tests/chat/margin-bubbles', { waitUntil: 'domcontentloaded' })
    await waitForMount(page)
    await waitForFollowing(page, true)
    // Condition-based settle: the pitch probes run off component updates;
    // poll them instead of sleeping a fixed interval. marginLossPx reads 0
    // (unknown) while either probe is 0, so both must have real data.
    await expect
        .poll(
            async () => {
                const stats = await getStats(page)
                return Math.min(Number(stats['realPitchPx']), Number(stats['cachePitchPx']))
            },
            { timeout: 5000 }
        )
        .toBeGreaterThan(0)
}

test.describe('Margin bubbles (margins escape measurement)', () => {
    test('geometry accounts for the full visual pitch of margin-styled bubbles', async ({
        page
    }) => {
        await openSettled(page)

        const before = await getStats(page)

        // The direct measurement contract: the recorded height must cover
        // the bubble's full visual pitch, margins included. Pre-fix the 12px
        // collapsed margin escaped (cachePitchPx=200, realPitchPx=212).
        expect(Number(before['marginLossPx'])).toBe(0)

        // Known bounded error, asserted so it stays bounded: the leading
        // collapsed margin belongs to no pitch, so totalHeight may run short
        // by at most one margin — a constant, invisible to scrolling.
        expect(Number(before['scrollHeightDriftPx'])).toBeLessThanOrEqual(BUBBLE_MARGIN_PX)

        const after = await runSweep(page, '[data-testid="start-sweep"]')

        // Sanity: the sweep really scrolled up through the list.
        expect(after['following']).toBe('false')
        expect(Number(after['sweepFrames'])).toBeGreaterThan(100)

        // Pre-fix the slice shifted by the lost margin at every
        // render-range boundary.
        expectNoPaintedJumps(after)
    })

    test('downward sweep paints no range-boundary jumps either', async ({ page }) => {
        await openSettled(page)

        const after = await runSweep(page, '[data-testid="start-sweep-down"]')

        // Sanity: swept a meaningful distance down from the top (the sweep
        // stops short of the follow threshold, where snapping to the bottom
        // is intended behavior, not a jump).
        expect(Number(after['sweepFrames'])).toBeGreaterThan(100)

        expectNoPaintedJumps(after)
    })
})
