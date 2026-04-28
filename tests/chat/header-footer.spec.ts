import { expect, test } from '@playwright/test'
import {
    domMessageCount,
    getStat,
    isFollowing,
    rafWait,
    scrollTo,
    scrollToBottom,
    SETTLE_MS,
    waitForMount
} from '../helpers.js'

test.describe('Header & Footer', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/header-footer', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
    })

    test('renders header above messages', async ({ page }) => {
        const header = page.locator('[data-testid="header-content"]')
        const firstMsg = page.locator('[data-testid="msg-1"]')

        await expect(header).toBeVisible()
        await expect(firstMsg).toBeVisible()

        const headerBox = await header.boundingBox()
        const msgBox = await firstMsg.boundingBox()
        expect(headerBox).toBeTruthy()
        expect(msgBox).toBeTruthy()
        expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(msgBox!.y + 1)
    })

    test('renders footer below messages', async ({ page }) => {
        const footer = page.locator('[data-testid="footer-content"]')
        const lastMsg = page.locator('[data-testid="msg-3"]')

        await expect(footer).toBeVisible()
        await expect(lastMsg).toBeVisible()

        const footerBox = await footer.boundingBox()
        const msgBox = await lastMsg.boundingBox()
        expect(footerBox).toBeTruthy()
        expect(msgBox).toBeTruthy()
        expect(msgBox!.y + msgBox!.height).toBeLessThanOrEqual(footerBox!.y + 1)
    })

    test('bottom gravity works with header and footer', async ({ page }) => {
        // With only 3 messages + header + footer in a 400px viewport,
        // content should be pushed to the bottom
        const header = page.locator('[data-testid="header-content"]')
        const viewportBox = await page.locator('[data-testid="chat-viewport"]').boundingBox()
        const headerBox = await header.boundingBox()

        expect(viewportBox).toBeTruthy()
        expect(headerBox).toBeTruthy()

        // Header should NOT be at the very top of the viewport (bottom gravity pushes down)
        const offsetFromTop = headerBox!.y - viewportBox!.y
        expect(offsetFromTop).toBeGreaterThan(20)
    })

    test('follow-bottom snaps when footer height changes', async ({ page }) => {
        // Add enough messages to make scrollable
        for (let i = 0; i < 20; i++) {
            await page.locator('[data-testid="add-message"]').click()
        }
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        expect(await isFollowing(page)).toBe(true)

        // Toggle typing indicator — footer grows
        await page.locator('[data-testid="toggle-typing"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        // Should still be following bottom
        expect(await isFollowing(page)).toBe(true)

        // Typing indicator should be visible
        await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible()
    })

    test('toggling header off and on preserves behavior', async ({ page }) => {
        const count = await domMessageCount(page)
        expect(count).toBe(3)

        // Hide header
        await page.locator('[data-testid="toggle-header"]').click()
        await rafWait(page, 2)

        await expect(page.locator('[data-testid="header-content"]')).not.toBeVisible()

        // Messages still render
        expect(await domMessageCount(page)).toBe(3)

        // Show header again
        await page.locator('[data-testid="toggle-header"]').click()
        await rafWait(page, 2)

        await expect(page.locator('[data-testid="header-content"]')).toBeVisible()
    })

    test('adding messages with footer keeps following', async ({ page }) => {
        // Toggle typing indicator on
        await page.locator('[data-testid="toggle-typing"]').click()
        await rafWait(page, 2)

        // Add messages
        for (let i = 0; i < 10; i++) {
            await page.locator('[data-testid="add-message"]').click()
            await rafWait(page)
        }
        await page.waitForTimeout(SETTLE_MS)

        expect(await isFollowing(page)).toBe(true)

        // Footer should still be visible at bottom
        await expect(page.locator('[data-testid="footer-content"]')).toBeVisible()
    })

    test('header is visible when scrolled to top', async ({ page }) => {
        // Add many messages
        await page.locator('[data-testid="add-many"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        // Scroll to top
        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS)

        // Header should be visible
        await expect(page.locator('[data-testid="header-content"]')).toBeVisible()
    })

    test('add-many with header keeps DOM bounded when scrolled to bottom', async ({ page }) => {
        // Regression for the visible-range bug where headerHeight wasn't subtracted
        // from scrollTop before walking the message offsets — every message would
        // mount at once when scrolled to the bottom.
        await page.locator('[data-testid="add-many"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        // Pin the viewport at the very bottom so we hit the regression case
        // deterministically, regardless of how the auto-snap raced with batch
        // height measurement.
        await scrollToBottom(page)
        await page.waitForTimeout(SETTLE_MS)

        const total = await getStat(page, 'total')
        const dom = await getStat(page, 'dom')

        // 3 starting + 50 added.
        expect(total).toBe(53)
        expect(dom).toBeLessThan(25)
    })

    test('scrollToMessage works correctly with header', async ({ page }) => {
        // Add many messages so message 2 is scrollable
        await page.locator('[data-testid="add-many"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        // Scroll to message 2
        await page.locator('[data-testid="scroll-to-msg-2"]').click()
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        // Message 2 should be visible
        await expect(page.locator('[data-testid="msg-2"]')).toBeVisible()
    })
})
