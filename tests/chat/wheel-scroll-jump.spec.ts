import { expect, test, type Page } from '@playwright/test'
import {
    STATS,
    VIEWPORT,
    getScrollState,
    rafWait,
    sampleViewportFrames,
    waitForMount
} from '../helpers.js'

type ScrollSample = {
    tick: number
    phase: number
    scrollTop: number
    scrollHeight: number
    maxScroll: number
    scrollProgress: number
    gapFromBottom: number
    measured: string
    growths: string
}

const INPUT_SAMPLE_FRAMES = 18
const GROWTH_SETTLE_TIMEOUT_MS = 1500
const STABLE_GROWTH_FRAMES = 6

function parseStatsText(stats: string | null | undefined) {
    return Object.fromEntries(
        (stats ?? '')
            .trim()
            .split(/\s+/)
            .map((token) => token.split('='))
            .filter(([key, value]) => key && value)
    )
}

async function captureScrollSample(page: Page, tick: number, phase: number) {
    const scroll = await getScrollState(page)
    const parsedStats = parseStatsText(await page.locator(STATS).textContent())

    return {
        tick,
        phase,
        scrollTop: scroll.scrollTop,
        scrollHeight: scroll.scrollHeight,
        maxScroll: scroll.maxScroll,
        scrollProgress: scroll.maxScroll > 0 ? scroll.scrollTop / scroll.maxScroll : 1,
        gapFromBottom: scroll.gapFromBottom,
        measured: parsedStats['measured'] ?? '0',
        growths: parsedStats['growths'] ?? '0'
    } satisfies ScrollSample
}

async function captureScrollSamplesForFrames(
    page: Page,
    tick: number,
    frames = INPUT_SAMPLE_FRAMES
) {
    const samples = await sampleViewportFrames(page, {
        viewportSelector: VIEWPORT,
        frames,
        textSelector: STATS
    })

    return samples.map((sample) => {
        const parsedStats = parseStatsText(sample.text)
        return {
            tick,
            phase: sample.phase,
            scrollTop: sample.scrollTop,
            scrollHeight: sample.scrollHeight,
            maxScroll: sample.maxScroll,
            scrollProgress: sample.scrollProgress,
            gapFromBottom: sample.gapFromBottom,
            measured: parsedStats['measured'] ?? '0',
            growths: parsedStats['growths'] ?? '0'
        } satisfies ScrollSample
    })
}

async function waitForGrowthToSettle(page: Page) {
    await page.waitForFunction(
        ([statsSelector, stableFrames]) => {
            const growthNodesExpanded = () => {
                // Persist-mode fixtures should render late-growth nodes; zero nodes means the
                // test setup has not reached the state we intend to sample.
                const nodes = Array.from(document.querySelectorAll('[data-testid^="late-growth-"]'))
                return (
                    nodes.length > 0 &&
                    nodes.every((node) => (node as HTMLElement).dataset.state === 'expanded')
                )
            }

            const readGrowths = () => {
                const stats = document.querySelector(statsSelector)?.textContent ?? ''
                const match = stats.match(/(?:^|\s)growths=(\d+)/)
                return match ? Number(match[1]) : null
            }

            return new Promise<boolean>((resolve) => {
                let lastGrowths = readGrowths()
                let stableCount = 0

                const poll = () => {
                    const growths = readGrowths()
                    if (growths === null) {
                        resolve(false)
                        return
                    }

                    if (growthNodesExpanded() && growths === lastGrowths) {
                        stableCount += 1
                    } else {
                        lastGrowths = growths
                        stableCount = 0
                    }

                    if (stableCount >= stableFrames) {
                        resolve(true)
                        return
                    }

                    requestAnimationFrame(poll)
                }

                requestAnimationFrame(poll)
            })
        },
        [STATS, STABLE_GROWTH_FRAMES] as const,
        { timeout: GROWTH_SETTLE_TIMEOUT_MS }
    )
}

async function openWheelJumpPage(page: Page, growthMode: 'remount' | 'persist' = 'remount') {
    await page.goto(`/tests/chat/wheel-scroll-jump?growth=${growthMode}`, {
        waitUntil: 'domcontentloaded'
    })
    await waitForMount(page)
    await expect(page.locator(STATS)).toBeVisible()
}

function findForwardJumps(samples: ScrollSample[]) {
    const forwardProgressJumps = samples.slice(1).flatMap((sample, index) => {
        const previous = samples[index]
        const delta = sample.scrollProgress - previous.scrollProgress
        return delta > 0.004 ? [{ previous, sample, delta }] : []
    })
    const forwardGapJumps = samples.slice(1).flatMap((sample, index) => {
        const previous = samples[index]
        const delta = sample.gapFromBottom - previous.gapFromBottom
        return delta < -12 ? [{ previous, sample, delta }] : []
    })

    return { forwardProgressJumps, forwardGapJumps }
}

async function setupAtBottom(page: Page) {
    await rafWait(page, 3)

    const viewport = page.locator(VIEWPORT)
    const box = await viewport.boundingBox()
    expect(box).not.toBeNull()
    if (!box) throw new Error(`Missing viewport ${VIEWPORT}`)

    const didScrollToBottom = await page.evaluate((selector) => {
        const el = document.querySelector(selector) as HTMLElement | null
        if (!el) return false
        el.scrollTop = el.scrollHeight
        return true
    }, VIEWPORT)
    expect(didScrollToBottom).toBe(true)
    await rafWait(page, 2)

    return box
}

async function setupWheelAtBottom(page: Page) {
    const box = await setupAtBottom(page)

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
}

async function setupTouchAtBottom(page: Page) {
    await setupAtBottom(page)
}

async function touchScroll(page: Page, deltaY: number) {
    const didScroll = await page.evaluate(
        ([selector, dy]) => {
            const el = document.querySelector(selector) as HTMLElement | null
            if (!el) return false

            const rect = el.getBoundingClientRect()
            const distance = Math.min(Math.abs(dy), rect.height * 0.4)
            const startY = rect.top + rect.height / 2
            const endY = startY - Math.sign(dy) * distance
            const createTouchEvent = (type: string, clientY: number | null) => {
                const event = new Event(type, { bubbles: true, cancelable: true })
                Object.defineProperty(event, 'touches', {
                    value: clientY === null ? [] : [{ clientY }]
                })
                return event
            }

            el.dispatchEvent(createTouchEvent('touchstart', startY))
            el.dispatchEvent(createTouchEvent('touchmove', endY))
            el.scrollTop += dy
            el.dispatchEvent(new Event('scroll', { bubbles: true }))
            el.dispatchEvent(createTouchEvent('touchend', null))
            return true
        },
        [VIEWPORT, deltaY] as const
    )
    expect(didScroll).toBe(true)
}

test.describe('Wheel scroll jump', () => {
    test.beforeEach(({ page: _page }, testInfo) => {
        test.skip(
            testInfo.project.name === 'mobile-safari',
            'Playwright does not support mouse.wheel in mobile WebKit'
        )
    })

    test('does not move the outer viewport backward during positive wheel input', async ({
        page
    }) => {
        await openWheelJumpPage(page)
        await rafWait(page, 3)

        const viewport = page.locator(VIEWPORT)
        const box = await viewport.boundingBox()
        expect(box).not.toBeNull()
        if (!box) throw new Error(`Missing viewport ${VIEWPORT}`)

        const didScrollToTop = await page.evaluate((selector) => {
            const el = document.querySelector(selector) as HTMLElement | null
            if (!el) return false
            el.scrollTop = 0
            return true
        }, VIEWPORT)
        expect(didScrollToTop).toBe(true)
        await rafWait(page, 2)

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

        const samples: ScrollSample[] = []
        for (let tick = 0; tick < 18; tick++) {
            await page.mouse.wheel(0, 520)
            samples.push(...(await captureScrollSamplesForFrames(page, tick)))
        }

        const backwardScrollTopJumps = samples.slice(1).flatMap((sample, index) => {
            const previous = samples[index]
            const delta = sample.scrollTop - previous.scrollTop
            return delta < -12 ? [{ previous, sample, delta }] : []
        })
        const backwardProgressJumps = samples.slice(1).flatMap((sample, index) => {
            const previous = samples[index]
            const delta = sample.scrollProgress - previous.scrollProgress
            return delta < -0.006 ? [{ previous, sample, delta }] : []
        })

        expect({ backwardScrollTopJumps, backwardProgressJumps }).toEqual({
            backwardScrollTopJumps: [],
            backwardProgressJumps: []
        })
    })

    test('keeps moving away from bottom during first-time negative wheel input', async ({
        page
    }) => {
        await openWheelJumpPage(page)
        await setupWheelAtBottom(page)

        const samples: ScrollSample[] = []
        for (let tick = 0; tick < 10; tick++) {
            await page.mouse.wheel(0, -650)
            samples.push(...(await captureScrollSamplesForFrames(page, tick)))
        }

        const first = samples[0]
        const last = samples.at(-1)
        expect(last?.gapFromBottom).toBeGreaterThan(first.gapFromBottom + 1000)
        expect(last?.scrollTop).toBeLessThan(first.scrollTop - 1000)
    })

    test('does not re-grow already loaded tables when revisiting the same upward range', async ({
        page
    }) => {
        await openWheelJumpPage(page, 'persist')
        await setupWheelAtBottom(page)

        for (let tick = 0; tick < 8; tick++) {
            await page.mouse.wheel(0, -650)
            await captureScrollSamplesForFrames(page, tick, 8)
        }
        await waitForGrowthToSettle(page)

        const firstPassTop = await captureScrollSample(page, 0, 0)

        for (let tick = 0; tick < 4; tick++) {
            await page.mouse.wheel(0, 650)
            await captureScrollSamplesForFrames(page, tick, 8)
        }
        await waitForGrowthToSettle(page)

        const beforeSecondPass = await captureScrollSample(page, 0, 0)
        const growthsBeforeSecondPass = Number(beforeSecondPass.growths)

        const samples: ScrollSample[] = []
        for (let tick = 0; tick < 3; tick++) {
            await page.mouse.wheel(0, -650)
            samples.push(...(await captureScrollSamplesForFrames(page, tick)))
        }

        const afterSecondPass = samples.at(-1)
        expect(afterSecondPass?.scrollTop).toBeGreaterThan(firstPassTop.scrollTop)
        expect(
            samples.filter((sample) => Number(sample.growths) > growthsBeforeSecondPass)
        ).toEqual([])
        expect(findForwardJumps(samples)).toEqual({
            forwardProgressJumps: [],
            forwardGapJumps: []
        })
    })
})

test.describe('Touch scroll jump', () => {
    test.beforeEach(({ page: _page }, testInfo) => {
        test.skip(
            testInfo.project.name !== 'mobile-safari',
            'Touch gesture coverage targets the mobile Safari path'
        )
    })

    test('keeps moving away from bottom during first-time upward touch input', async ({ page }) => {
        await openWheelJumpPage(page)
        await setupTouchAtBottom(page)

        const samples: ScrollSample[] = []
        for (let tick = 0; tick < 10; tick++) {
            await touchScroll(page, -650)
            samples.push(...(await captureScrollSamplesForFrames(page, tick)))
        }

        const first = samples[0]
        const last = samples.at(-1)
        expect(last?.gapFromBottom).toBeGreaterThan(first.gapFromBottom + 1000)
        expect(last?.scrollTop).toBeLessThan(first.scrollTop - 1000)
    })

    test('does not re-grow already loaded tables when touch revisits an upward range', async ({
        page
    }) => {
        await openWheelJumpPage(page, 'persist')
        await setupTouchAtBottom(page)

        for (let tick = 0; tick < 8; tick++) {
            await touchScroll(page, -650)
            await captureScrollSamplesForFrames(page, tick, 8)
        }
        await waitForGrowthToSettle(page)

        const firstPassTop = await captureScrollSample(page, 0, 0)

        for (let tick = 0; tick < 4; tick++) {
            await touchScroll(page, 650)
            await captureScrollSamplesForFrames(page, tick, 8)
        }
        await waitForGrowthToSettle(page)

        const beforeSecondPass = await captureScrollSample(page, 0, 0)
        const growthsBeforeSecondPass = Number(beforeSecondPass.growths)

        const samples: ScrollSample[] = []
        for (let tick = 0; tick < 3; tick++) {
            await touchScroll(page, -650)
            samples.push(...(await captureScrollSamplesForFrames(page, tick)))
        }

        const afterSecondPass = samples.at(-1)
        expect(afterSecondPass?.scrollTop).toBeGreaterThan(firstPassTop.scrollTop)
        expect(
            samples.filter((sample) => Number(sample.growths) > growthsBeforeSecondPass)
        ).toEqual([])
        expect(findForwardJumps(samples)).toEqual({
            forwardProgressJumps: [],
            forwardGapJumps: []
        })
    })
})
