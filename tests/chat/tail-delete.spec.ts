import { expect, test, type Page } from '@playwright/test'
import { SETTLE_MS, waitForFollowing, waitForMount, waitForStat } from '../helpers.js'

/**
 * The tail-swap reserve holds a removed message's measured height so the bottom
 * stays put during a remove-then-add (see `stream-swap`). When the replacement
 * never arrives, the reserve must clear — otherwise the removed height is
 * painted as permanent phantom space and `scrollHeight` stays inflated.
 *
 * `scrollHeight` is the discriminator, and it has to be: a leaked reserve keeps
 * the scrollable extent constant (`totalHeight` drops by the removed message,
 * the reserve adds the same amount back), while the viewport still looks pinned.
 * The leak this guards against was invisible to every unit test and every
 * browser project for exactly that reason.
 */

const geometry = async (page: Page) =>
    page.evaluate(() => {
        const viewport = document.querySelector('[data-testid="chat-viewport"]')
        if (!(viewport instanceof HTMLElement)) throw new Error('viewport not found')
        const messageEls = viewport.querySelectorAll('[data-message-id]')
        const tail = messageEls.item(messageEls.length - 1)
        if (!(tail instanceof HTMLElement)) throw new Error('tail message not found')

        const viewportRect = viewport.getBoundingClientRect()
        const tailRect = tail.getBoundingClientRect()
        // Where the rendered content actually ends, in scroll coordinates.
        const contentBottom = tailRect.bottom - viewportRect.top + viewport.scrollTop

        return {
            scrollHeight: viewport.scrollHeight,
            // Scrollable extent below the last message. The anchor sentinel adds
            // a pixel or two; a leaked reserve would not show up here, which is
            // why scrollHeight is asserted separately.
            deadSpaceBelowTail: Math.round(viewport.scrollHeight - contentBottom) + 0,
            gapFromBottom:
                Math.round(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop) + 0
        }
    })

test.describe('Permanent tail deletion', () => {
    test('clears the tail-swap reserve instead of stranding phantom space', async ({ page }) => {
        await page.goto('/tests/chat/tail-delete', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
        await waitForFollowing(page, true)
        await waitForStat(page, 'total', '12')

        const before = await geometry(page)

        await page.locator('[data-testid="delete-tail"]').click()
        await waitForStat(page, 'total', '11')

        // While the reserve is held the extent is intentionally *not* smaller —
        // that is what keeps the bottom still during a remove-then-add.
        const held = await geometry(page)

        // The reserve's clear is bounded; wait comfortably past its window, then
        // assert the absence of a change (a fixed wait is right here — we are
        // proving that nothing lingers).
        await page.waitForTimeout(SETTLE_MS + 600)

        const after = await geometry(page)

        // Deleting a message must shrink the scrollable extent. A leaked reserve
        // keeps it flat or larger: `totalHeight` drops by the removed message and
        // the reserve adds the same amount straight back. Asserted as a strict
        // inequality rather than an exact delta, because virtualization pulls a
        // previously-estimated message into the measured window at the same time.
        expect(
            after.scrollHeight,
            'scrollHeight must shrink after deleting the tail (a leaked reserve keeps it flat)'
        ).toBeLessThan(before.scrollHeight)
        expect(after.scrollHeight, 'the held reserve must be released').toBeLessThan(
            held.scrollHeight
        )

        // No stranded space below the tail, and still pinned.
        expect(after.deadSpaceBelowTail).toBeLessThanOrEqual(4)
        expect(after.gapFromBottom).toBeLessThanOrEqual(2)
        await waitForFollowing(page, true)
    })
})
