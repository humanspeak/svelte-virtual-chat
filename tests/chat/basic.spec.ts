import { expect, test } from '@playwright/test'
import {
    domMessageCount,
    getStat,
    isFollowing,
    messageInDom,
    rafWait,
    scrollTo,
    SETTLE_MS,
    waitForMount
} from '../helpers.js'

test.describe('Basic Chat', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/chat/basic', { waitUntil: 'domcontentloaded' })
        await waitForMount(page)
    })

    test('renders initial messages', async ({ page }) => {
        // Should have 3 initial messages
        const count = await domMessageCount(page)
        expect(count).toBe(3)

        // All three should be visible
        await expect(page.locator('[data-testid="msg-1"]')).toBeVisible()
        await expect(page.locator('[data-testid="msg-2"]')).toBeVisible()
        await expect(page.locator('[data-testid="msg-3"]')).toBeVisible()
    })

    test('messages display correct index and id', async ({ page }) => {
        // First message should show [0] and id=1
        const firstMsg = page.locator('[data-testid="msg-1"]')
        await expect(firstMsg).toContainText('[0]')
        await expect(firstMsg).toContainText('id=1')

        // Third message should show [2] and id=3
        const thirdMsg = page.locator('[data-testid="msg-3"]')
        await expect(thirdMsg).toContainText('[2]')
        await expect(thirdMsg).toContainText('id=3')
    })

    test('viewport height is constrained to ~400px', async ({ page }) => {
        const vpHeight = await getStat(page, 'viewport')
        expect(vpHeight).toBeGreaterThan(350)
        expect(vpHeight).toBeLessThanOrEqual(400)
    })

    test('starts in following-bottom state', async ({ page }) => {
        expect(await isFollowing(page)).toBe(true)
    })

    test('bottom gravity — few messages sit at the bottom', async ({ page }) => {
        // With only 3 messages in a 400px viewport, content is shorter than viewport.
        // Messages should be at the bottom, not the top.
        const firstMsgBox = await page.locator('[data-testid="msg-1"]').boundingBox()
        const viewportBox = await page.locator('[data-testid="chat-viewport"]').boundingBox()
        if (firstMsgBox && viewportBox) {
            // First message should NOT be at the top of the viewport
            const offsetFromTop = firstMsgBox.y - viewportBox.y
            expect(offsetFromTop).toBeGreaterThan(50) // Some gap above messages
        }
    })

    test('adding messages keeps following state', async ({ page }) => {
        // Add several messages
        for (let i = 0; i < 5; i++) {
            await page.locator('[data-testid="add-user"]').click()
            await rafWait(page)
        }

        expect(await isFollowing(page)).toBe(true)

        // Total should now be 8
        const total = await getStat(page, 'total')
        expect(total).toBe(8)
    })

    test('newest message is visible after append', async ({ page }) => {
        await page.locator('[data-testid="add-assistant"]').click()
        await rafWait(page, 2)

        // Message with id=4 should exist and be visible
        await expect(page.locator('[data-testid="msg-4"]')).toBeVisible()
    })

    test('virtualization — dom < total with many messages', async ({ page }) => {
        // Add enough messages to exceed the viewport
        for (let i = 0; i < 30; i++) {
            await page.locator('[data-testid="add-user"]').click()
        }
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        const total = await getStat(page, 'total')
        const dom = await getStat(page, 'dom')

        expect(total).toBe(33) // 3 initial + 30 added
        expect(dom).toBeLessThan(total)
    })

    test('virtualized-away messages are not in the DOM', async ({ page }) => {
        // Add many messages so early ones get virtualized
        for (let i = 0; i < 40; i++) {
            await page.locator('[data-testid="add-user"]').click()
        }
        await rafWait(page, 3)
        await page.waitForTimeout(SETTLE_MS)

        // We're following bottom, so the first messages should NOT be in DOM
        expect(await messageInDom(page, '1')).toBe(false)
        expect(await messageInDom(page, '2')).toBe(false)

        // The most recent messages SHOULD be in DOM
        expect(await messageInDom(page, '43')).toBe(true)
    })

    test('scroll away sets following to false', async ({ page }) => {
        // Add enough messages to make content scrollable
        for (let i = 0; i < 20; i++) {
            await page.locator('[data-testid="add-user"]').click()
        }
        await rafWait(page, 2)

        // Scroll to top
        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS)

        expect(await isFollowing(page)).toBe(false)
    })

    test('scroll to bottom button restores following', async ({ page }) => {
        // Add messages, scroll away, then return
        for (let i = 0; i < 20; i++) {
            await page.locator('[data-testid="add-user"]').click()
        }
        await rafWait(page, 2)

        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS)
        expect(await isFollowing(page)).toBe(false)

        await page.locator('[data-testid="scroll-bottom"]').click()
        await rafWait(page, 2)
        await page.waitForTimeout(SETTLE_MS)

        expect(await isFollowing(page)).toBe(true)
    })

    test('visible range updates on scroll', async ({ page }) => {
        // Add many messages
        for (let i = 0; i < 40; i++) {
            await page.locator('[data-testid="add-user"]').click()
        }
        await rafWait(page, 2)

        // Scroll to top
        await scrollTo(page, 0)
        await page.waitForTimeout(SETTLE_MS)

        // First messages should now be in DOM
        expect(await messageInDom(page, '1')).toBe(true)
        expect(await messageInDom(page, '2')).toBe(true)

        // Last messages should NOT be in DOM
        expect(await messageInDom(page, '43')).toBe(false)
    })
})
