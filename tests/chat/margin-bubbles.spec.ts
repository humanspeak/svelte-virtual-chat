import { expect, test } from '@playwright/test'
import { SETTLE_MS, getStats, waitForMount, waitForStat } from '../helpers.js'

/**
 * Bubble margins must not escape the geometry math (#47). The contract has
 * two halves: the height accounting must cover each message's full visual
 * pitch (marginLossPx = 0), and constant-rate scrolling must paint no
 * range-boundary jumps. Fixture mechanics and the live numbers
 * (marginLossPx, jumps / maxJumpPx / totalJumpPx) live in
 * src/routes/tests/chat/margin-bubbles/+page.svelte; estimates there equal
 * measured heights exactly, so margins are the only variable.
 */

test.describe('Margin bubbles (margins escape measurement)', () => {
    test('geometry accounts for the full visual pitch of margin-styled bubbles', async ({
        page
    }) => {
        await page.goto('/tests/chat/margin-bubbles', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
        await page.waitForTimeout(SETTLE_MS)

        // Preconditions: pinned and the pitch probe has real data.
        const before = await getStats(page)
        expect(before['following']).toBe('true')
        expect(Number(before['realPitchPx'])).toBeGreaterThan(0)

        // The direct measurement contract: the recorded height must cover
        // the bubble's full visual pitch, margins included. Today the 12px
        // collapsed margin escapes (measuredPx=200, realPitchPx=212).
        expect(Number(before['marginLossPx'])).toBe(0)

        await page.locator('[data-testid="start-sweep"]').click()
        await waitForStat(page, 'sweep', 'done', 20000)

        const after = await getStats(page)

        // Sanity: the sweep really scrolled through the list.
        expect(after['following']).toBe('false')
        expect(Number(after['sweepFrames'])).toBeGreaterThan(100)

        // While scrolling at a constant rate, no painted frame may move
        // content by anything other than the scroll delta. Today the slice
        // shifts by the lost margin at every render-range boundary.
        expect({
            jumps: Number(after['jumps']),
            maxJumpPx: Number(after['maxJumpPx']),
            totalJumpPx: Number(after['totalJumpPx'])
        }).toEqual({ jumps: 0, maxJumpPx: 0, totalJumpPx: 0 })
    })
})
