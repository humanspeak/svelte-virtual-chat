import { expect, test, type Page } from '@playwright/test'
import { getStats, waitForFollowing, waitForMount, waitForStat } from '../helpers.js'

/**
 * Bubble margins must not escape the geometry math (#47). The contract has
 * two halves: the height accounting must cover each message's full visual
 * pitch (marginLossPx = 0), and constant-rate scrolling must paint no
 * range-boundary jumps — in either direction. Fixture mechanics and the
 * live numbers (marginLossPx, jumps / maxJumpPx / totalJumpPx) live in
 * src/routes/tests/chat/margin-bubbles/+page.svelte; estimates there equal
 * measured heights exactly, so margins are the only variable.
 */

async function openSettled(page: Page) {
    await page.goto('/tests/chat/margin-bubbles', { waitUntil: 'domcontentloaded' })
    await waitForMount(page)
    await waitForFollowing(page, true)
    // Condition-based settle: the pitch probe runs off component updates;
    // poll it instead of sleeping a fixed interval. Both probes must have
    // real data — marginLossPx reads 0 (unknown) while either is 0.
    await expect
        .poll(async () => Number((await getStats(page))['realPitchPx']), { timeout: 5000 })
        .toBeGreaterThan(0)
    await expect
        .poll(async () => Number((await getStats(page))['cachePitchPx']), { timeout: 5000 })
        .toBeGreaterThan(0)
}

async function runSweep(page: Page, trigger: string) {
    await page.locator(trigger).click()
    await waitForStat(page, 'sweep', 'done', 20000)
    return getStats(page)
}

function paintedJumps(stats: Record<string, string>) {
    return {
        jumps: Number(stats['jumps']),
        maxJumpPx: Number(stats['maxJumpPx']),
        totalJumpPx: Number(stats['totalJumpPx'])
    }
}

test.describe('Margin bubbles (margins escape measurement)', () => {
    test('geometry accounts for the full visual pitch of margin-styled bubbles', async ({
        page
    }) => {
        await openSettled(page)

        // The direct measurement contract: the recorded height must cover
        // the bubble's full visual pitch, margins included. Pre-fix the 12px
        // collapsed margin escaped (cachePitchPx=200, realPitchPx=212).
        expect(Number((await getStats(page))['marginLossPx'])).toBe(0)

        const after = await runSweep(page, '[data-testid="start-sweep"]')

        // Sanity: the sweep really scrolled up through the list.
        expect(after['following']).toBe('false')
        expect(Number(after['sweepFrames'])).toBeGreaterThan(100)

        // While scrolling at a constant rate, no painted frame may move
        // content by anything other than the scroll delta. Pre-fix the slice
        // shifted by the lost margin at every render-range boundary.
        expect(paintedJumps(after)).toEqual({ jumps: 0, maxJumpPx: 0, totalJumpPx: 0 })
    })

    test('downward sweep paints no range-boundary jumps either', async ({ page }) => {
        await openSettled(page)

        const after = await runSweep(page, '[data-testid="start-sweep-down"]')

        // Sanity: swept a meaningful distance down from the top (the sweep
        // stops short of the follow threshold, where snapping to the bottom
        // is intended behavior, not a jump).
        expect(Number(after['sweepFrames'])).toBeGreaterThan(100)

        expect(paintedJumps(after)).toEqual({ jumps: 0, maxJumpPx: 0, totalJumpPx: 0 })
    })
})
