import { expect, test } from '@playwright/test'
import { STATS, VIEWPORT, rafWait, waitForMount } from '../helpers.js'

// Temporary instrumentation for the remaining keyboard failures.

async function installTracer(page: import('@playwright/test').Page) {
    await page.evaluate((sel) => {
        const viewport = document.querySelector(sel) as HTMLElement
        const events: string[] = []
        ;(window as unknown as { __evts: string[] }).__evts = events
        const t0 = performance.now()
        const stamp = () => (performance.now() - t0).toFixed(0)
        const geo = () => {
            const max = viewport.scrollHeight - viewport.clientHeight
            const stats = document.querySelector('[data-testid="debug-stats"]')?.textContent ?? ''
            const following = stats.includes('following=true')
            return `top=${Math.round(viewport.scrollTop)} max=${Math.round(max)} gap=${Math.round(max - viewport.scrollTop)} fol=${following}`
        }
        ;(window as unknown as { __geo: () => string }).__geo = geo
        const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')!
        Object.defineProperty(viewport, 'scrollTop', {
            configurable: true,
            get() {
                return desc.get!.call(this)
            },
            set(v: number) {
                const stack = (new Error().stack ?? '')
                    .split('\n')
                    .slice(2, 4)
                    .map((l) => l.trim().replace(/https?:\/\/[^)]+\//, ''))
                    .join('<-')
                events.push(`[${stamp()}] W${Math.round(v)} (${geo()}) ${stack}`)
                desc.set!.call(this, v)
            }
        })
        viewport.addEventListener('keydown', (e) =>
            events.push(`[${stamp()}] KEY ${(e as KeyboardEvent).key} ${geo()}`)
        )
    }, VIEWPORT)
}

test('debug: End key in persist mode', async ({ page }) => {
    await page.goto('/tests/chat/wheel-scroll-jump?growth=persist', {
        waitUntil: 'domcontentloaded'
    })
    await waitForMount(page)
    await expect(page.locator(STATS)).toBeVisible()
    await rafWait(page, 3)
    const viewport = page.getByRole('region', { name: 'Chat messages' })
    await viewport.focus()
    await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement
        el.scrollTop = (el.scrollHeight - el.clientHeight) * 0.35
    }, VIEWPORT)
    await page.waitForTimeout(2000) // generous growth settle

    await installTracer(page)
    await viewport.press('End')
    await page.waitForTimeout(1200)

    const out = await page.evaluate(() => ({
        evts: (window as unknown as { __evts: string[] }).__evts,
        geo: (window as unknown as { __geo: () => string }).__geo()
    }))
    console.log('END TRACE:\n' + out.evts.join('\n') + '\nFINAL: ' + out.geo)
})

test('debug: PageUp x3 from bottom in remount mode', async ({ page }) => {
    await page.goto('/tests/chat/wheel-scroll-jump?growth=remount', {
        waitUntil: 'domcontentloaded'
    })
    await waitForMount(page)
    await rafWait(page, 3)
    const viewport = page.getByRole('region', { name: 'Chat messages' })
    await viewport.focus()
    await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement
        el.scrollTop = el.scrollHeight
    }, VIEWPORT)
    await rafWait(page, 2)

    await installTracer(page)
    for (let i = 0; i < 3; i++) {
        await viewport.press('PageUp')
        await page.waitForTimeout(350)
        const snap = await page.evaluate(() =>
            (window as unknown as { __geo: () => string }).__geo()
        )
        console.log(`after PageUp#${i + 1}: ${snap}`)
    }
    const out = await page.evaluate(() => ({
        evts: (window as unknown as { __evts: string[] }).__evts.slice(0, 40)
    }))
    console.log('PAGEUP TRACE (first 40):\n' + out.evts.join('\n'))
})
