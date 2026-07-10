import { expect, type Page, test } from '@playwright/test'
import {
    getRenderedIds,
    rafWait,
    scrollTo,
    scrollToBottom,
    SETTLE_MS,
    waitForFollowing,
    waitForMount
} from '../helpers.js'

/**
 * Characterization of focus behavior for interactive controls rendered inside
 * virtualized messages. See issue #35. The component intentionally does NOT
 * manage focus for message content — when a focused control is virtualized out
 * of the rendered range, the browser drops focus to `document.body`, and focus
 * is NOT restored when the message re-enters the range.
 */

/** Read the active element's tag + data-testid from the page. */
const activeElementInfo = (page: Page) =>
    page.evaluate(() => {
        const el = document.activeElement
        return {
            tag: el?.tagName ?? null,
            testid: el?.getAttribute('data-testid') ?? null
        }
    })

/** Settle the pipeline: RAF cycles + full settle timeout. */
const settle = async (page: Page): Promise<void> => {
    await rafWait(page, 3)
    await page.waitForTimeout(SETTLE_MS)
}

test.describe('Focus in virtualized messages', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/focus-controls', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
    })

    test('controls inside messages are focusable', async ({ page }) => {
        await scrollToBottom(page)
        await settle(page)

        // Use .focus() rather than .click(): WebKit/Safari do not move focus to
        // a <button> on click (their native input model), but the control is
        // still programmatically focusable — that is what we characterize here.
        await page.locator('[data-testid="msg-btn-60"]').focus()

        const active = await activeElementInfo(page)
        expect(active.testid).toBe('msg-btn-60')
    })

    test('focused control virtualized out drops focus to body', async ({ page }) => {
        await scrollToBottom(page)
        await settle(page)
        await page.locator('[data-testid="msg-btn-60"]').focus()
        expect((await activeElementInfo(page)).testid).toBe('msg-btn-60')

        await scrollTo(page, 0)
        await settle(page)

        // Message 60 must have virtualized out of the rendered DOM.
        expect(await getRenderedIds(page)).not.toContain('60')

        // Characterization (issue #35): the browser drops focus to <body>.
        const active = await activeElementInfo(page)
        expect(active.tag).toBe('BODY')
    })

    test('focus is not restored when the message re-enters the range', async ({ page }) => {
        await scrollToBottom(page)
        await settle(page)
        await page.locator('[data-testid="msg-btn-60"]').focus()
        expect((await activeElementInfo(page)).testid).toBe('msg-btn-60')

        // Virtualize it out.
        await scrollTo(page, 0)
        await settle(page)
        expect(await getRenderedIds(page)).not.toContain('60')

        // Bring it back into the rendered range.
        await scrollToBottom(page)
        await settle(page)
        expect(await getRenderedIds(page)).toContain('60')

        // Characterization (issue #35): focus is NOT restored to the button.
        expect((await activeElementInfo(page)).testid).not.toBe('msg-btn-60')

        // The re-mounted control is still interactive (programmatically
        // focusable — see the .focus() note above re: WebKit click focus).
        await page.locator('[data-testid="msg-btn-60"]').focus()
        expect((await activeElementInfo(page)).testid).toBe('msg-btn-60')
    })

    test('keyboard scrolling still works after focus drop', async ({ page }) => {
        await scrollToBottom(page)
        await settle(page)
        await page.locator('[data-testid="msg-btn-60"]').focus()
        expect((await activeElementInfo(page)).testid).toBe('msg-btn-60')

        // Virtualize the focused control out — focus drops.
        await scrollTo(page, 0)
        await settle(page)
        expect(await getRenderedIds(page)).not.toContain('60')

        // Focus the viewport and drive the keyboard path.
        await page.locator('[data-testid="chat-viewport"]').focus()
        await page.keyboard.press('End')
        await waitForFollowing(page, true)
    })
})
