import { expect, test } from '@playwright/test'
import { VIEWPORT, getScrollState, rafWait, waitForMount } from '../helpers.js'

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

async function captureScrollSample(
    page: import('@playwright/test').Page,
    tick: number,
    phase: number
) {
    const scroll = await getScrollState(page)
    const stats = await page.locator('[data-testid="debug-stats"]').textContent()
    const parsedStats = Object.fromEntries(
        (stats ?? '')
            .trim()
            .split(/\s+/)
            .map((token) => token.split('='))
            .filter(([key, value]) => key && value)
    )

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

async function openWheelJumpPage(
    page: import('@playwright/test').Page,
    growthMode: 'remount' | 'persist' = 'remount'
) {
    await page.goto(`/tests/chat/wheel-scroll-jump?growth=${growthMode}`, {
        waitUntil: 'domcontentloaded'
    })
    await waitForMount(page)
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

async function setupAtBottom(page: import('@playwright/test').Page) {
    await rafWait(page, 3)

    const viewport = page.locator(VIEWPORT)
    const box = await viewport.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return null

    await page.evaluate((selector) => {
        const el = document.querySelector(selector) as HTMLElement
        el.scrollTop = el.scrollHeight
    }, VIEWPORT)
    await rafWait(page, 2)

    return box
}

async function setupWheelAtBottom(page: import('@playwright/test').Page) {
    const box = await setupAtBottom(page)
    if (!box) return false

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    return true
}

async function setupTouchAtBottom(page: import('@playwright/test').Page) {
    return !!(await setupAtBottom(page))
}

async function touchScroll(page: import('@playwright/test').Page, deltaY: number) {
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
        if (!box) return

        await page.evaluate((selector) => {
            const el = document.querySelector(selector) as HTMLElement
            el.scrollTop = 0
        }, VIEWPORT)
        await rafWait(page, 2)

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

        const samples: ScrollSample[] = []
        for (let tick = 0; tick < 18; tick++) {
            await page.mouse.wheel(0, 520)
            for (let phase = 0; phase < 5; phase++) {
                await page.waitForTimeout(60)
                samples.push(await captureScrollSample(page, tick, phase))
            }
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
        if (!(await setupWheelAtBottom(page))) return

        const samples: ScrollSample[] = []
        for (let tick = 0; tick < 10; tick++) {
            await page.mouse.wheel(0, -650)
            for (let phase = 0; phase < 5; phase++) {
                await page.waitForTimeout(60)
                samples.push(await captureScrollSample(page, tick, phase))
            }
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
        if (!(await setupWheelAtBottom(page))) return

        for (let tick = 0; tick < 8; tick++) {
            await page.mouse.wheel(0, -650)
            await page.waitForTimeout(120)
        }
        await page.waitForTimeout(700)

        const firstPassTop = await captureScrollSample(page, 0, 0)

        for (let tick = 0; tick < 4; tick++) {
            await page.mouse.wheel(0, 650)
            await page.waitForTimeout(120)
        }
        await page.waitForTimeout(350)

        const beforeSecondPass = await captureScrollSample(page, 0, 0)
        const growthsBeforeSecondPass = Number(beforeSecondPass.growths)

        const samples: ScrollSample[] = []
        for (let tick = 0; tick < 3; tick++) {
            await page.mouse.wheel(0, -650)
            for (let phase = 0; phase < 5; phase++) {
                await page.waitForTimeout(60)
                samples.push(await captureScrollSample(page, tick, phase))
            }
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
        if (!(await setupTouchAtBottom(page))) return

        const samples: ScrollSample[] = []
        for (let tick = 0; tick < 10; tick++) {
            await touchScroll(page, -650)
            for (let phase = 0; phase < 5; phase++) {
                await page.waitForTimeout(60)
                samples.push(await captureScrollSample(page, tick, phase))
            }
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
        if (!(await setupTouchAtBottom(page))) return

        for (let tick = 0; tick < 8; tick++) {
            await touchScroll(page, -650)
            await page.waitForTimeout(120)
        }
        await page.waitForTimeout(700)

        const firstPassTop = await captureScrollSample(page, 0, 0)

        for (let tick = 0; tick < 4; tick++) {
            await touchScroll(page, 650)
            await page.waitForTimeout(120)
        }
        await page.waitForTimeout(350)

        const beforeSecondPass = await captureScrollSample(page, 0, 0)
        const growthsBeforeSecondPass = Number(beforeSecondPass.growths)

        const samples: ScrollSample[] = []
        for (let tick = 0; tick < 3; tick++) {
            await touchScroll(page, -650)
            for (let phase = 0; phase < 5; phase++) {
                await page.waitForTimeout(60)
                samples.push(await captureScrollSample(page, tick, phase))
            }
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
