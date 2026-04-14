import type { Locator, Page, TestInfo } from '@playwright/test'

/** CSS selector for the scrollable viewport inside the chat component. */
export const VIEWPORT = '[data-testid="chat-viewport"]'

/** CSS selector for the debug stats element. */
export const STATS = '[data-testid="debug-stats"]'

/**
 * Wait for N requestAnimationFrame double-cycles to settle.
 * Ensures ResizeObserver + layout measurements propagate.
 */
export async function rafWait(page: Page, cycles = 1): Promise<void> {
    for (let i = 0; i < cycles; i++) {
        await page.evaluate(
            () =>
                new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
                )
        )
    }
}

/**
 * Wait for the chat component to mount and render at least one message.
 */
export async function waitForMount(page: Page): Promise<void> {
    await page.waitForSelector(VIEWPORT, { timeout: 5000 })
    await rafWait(page, 2)
}

/**
 * Parse the debug stats text into a structured object.
 */
export async function getStats(page: Page): Promise<Record<string, string>> {
    const text = await page.locator(STATS).textContent()
    if (!text) return {}
    const pairs: Record<string, string> = {}
    for (const token of text.trim().split(/\s+/)) {
        const eqIdx = token.indexOf('=')
        if (eqIdx > 0) {
            pairs[token.slice(0, eqIdx)] = token.slice(eqIdx + 1)
        }
    }
    return pairs
}

/**
 * Get a specific numeric stat value.
 */
export async function getStat(page: Page, key: string): Promise<number> {
    const stats = await getStats(page)
    return parseInt(stats[key] ?? '0', 10)
}

/**
 * Get the boolean follow state.
 */
export async function isFollowing(page: Page): Promise<boolean> {
    const stats = await getStats(page)
    return stats['following'] === 'true'
}

/**
 * Get the count of message elements currently in the DOM.
 */
export async function domMessageCount(page: Page): Promise<number> {
    return page.locator('[data-message-id]').count()
}

/**
 * Check if a specific message ID is present in the DOM.
 */
export async function messageInDom(page: Page, id: string): Promise<boolean> {
    return (await page.locator(`[data-testid="msg-${id}"]`).count()) > 0
}

/**
 * Get the viewport scroll state.
 */
export async function getScrollState(page: Page): Promise<{
    scrollTop: number
    scrollHeight: number
    clientHeight: number
    maxScroll: number
    gapFromBottom: number
}> {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement
        const maxScroll = el.scrollHeight - el.clientHeight
        return {
            scrollTop: Math.round(el.scrollTop),
            scrollHeight: Math.round(el.scrollHeight),
            clientHeight: Math.round(el.clientHeight),
            maxScroll: Math.round(maxScroll),
            gapFromBottom: Math.round(maxScroll - el.scrollTop)
        }
    }, VIEWPORT)
}

/**
 * Scroll the viewport to a specific scrollTop value.
 */
export async function scrollTo(page: Page, top: number): Promise<void> {
    await page.evaluate(
        ([sel, t]) => {
            const el = document.querySelector(sel) as HTMLElement
            el.scrollTo({ top: t, behavior: 'instant' })
        },
        [VIEWPORT, top] as const
    )
    await rafWait(page, 2)
}

/**
 * Scroll the viewport to the very top.
 */
export async function scrollToTop(page: Page): Promise<void> {
    await scrollTo(page, 0)
}

/**
 * Scroll the viewport to the very bottom.
 */
export async function scrollToBottom(page: Page): Promise<void> {
    await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement
        el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
    }, VIEWPORT)
    await rafWait(page, 2)
}

/**
 * Scroll by a delta using mouse wheel (more realistic user interaction).
 * Falls back to direct scrollTop manipulation on mobile/Firefox.
 */
export async function scrollByWheel(
    page: Page,
    locator: Locator,
    deltaY: number,
    testInfo?: TestInfo
): Promise<void> {
    const isMobile = testInfo?.project.name.startsWith('mobile')
    const isFirefox = testInfo?.project.name === 'firefox'

    if (isMobile || isFirefox) {
        await page.evaluate(
            ([sel, dy]) => {
                const el = document.querySelector(sel) as HTMLElement
                el.scrollTop += dy
                el.dispatchEvent(new Event('scroll', { bubbles: true }))
            },
            [VIEWPORT, deltaY] as const
        )
    } else {
        const box = await locator.boundingBox()
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
            await page.mouse.wheel(0, deltaY)
        }
    }
    await rafWait(page, 2)
}

/**
 * Wait for the following state to reach a specific value.
 */
export async function waitForFollowing(page: Page, expected: boolean): Promise<void> {
    await page.waitForFunction(
        ([sel, exp]) => {
            const el = document.querySelector(sel)
            const text = el?.textContent ?? ''
            return text.includes(`following=${exp}`)
        },
        [STATS, String(expected)] as const,
        { timeout: 5000 }
    )
}

/**
 * Get all rendered message IDs currently in the DOM.
 */
export async function getRenderedIds(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-message-id]'))
            .map((el) => el.getAttribute('data-message-id') ?? '')
            .filter(Boolean)
    })
}

/** Full pipeline settle time (ms) — ResizeObserver + scroll correction + layout */
export const SETTLE_MS = 250
