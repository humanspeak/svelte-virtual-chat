import { test } from '@playwright/test'
import { waitForFollowing, waitForMount, waitForStat } from '../helpers.js'

/**
 * OPT-IN DEBUG TOOL — not part of the suite.
 *
 * The `.debug.ts` extension keeps this outside Playwright's `testMatch`
 * (`**\/*.@(spec|test).?(c|m)[jt]s?(x)`), so it never runs in CI and never
 * gates a merge. It is a diagnostic, not a test: it loops the `new-id-regrow`
 * scenario until it catches a failing run, then dumps a post-paint gap plus a
 * library-event timeline. Running it costs up to 40 page loads.
 *
 * Run it deliberately:
 *
 *     npx playwright test tests/chat/regrow-trace.debug.ts \
 *         --project=chromium --workers=1 --reporter=line
 *
 * It produced the timeline that root-caused the follow-bottom race
 * (`.agents/.plans/stream-swap-follow/002-overflow-anchor-follow-bottom.md`,
 * Evidence item 2). It patches the `scrollTop` setter globally on the page, so
 * do not import anything from it. Adapt it if you need to trace a real app —
 * the reported persistently-stranded Firefox viewport is still unexplained.
 */

type Ev = Record<string, unknown> & { t: number; kind: string }

test('trace regrow until failure', async ({ page }) => {
    test.setTimeout(600000)

    await page.addInitScript(() => {
        const w = window as unknown as {
            __trace: Ev[]
            __dbg: (_kind: string, _data: unknown) => void
        }
        type Ev = Record<string, unknown> & { t: number; kind: string }
        w.__trace = []

        w.__dbg = (kind, data) => {
            w.__trace.push({ t: Math.round(performance.now()), kind, ...(data as object) })
        }

        const proto = Element.prototype
        const desc = Object.getOwnPropertyDescriptor(proto, 'scrollTop')!
        Object.defineProperty(proto, 'scrollTop', {
            ...desc,
            set(this: Element, v: number) {
                if ((this as HTMLElement).dataset?.testid === 'chat-viewport') {
                    w.__trace.push({
                        t: Math.round(performance.now()),
                        kind: 'write',
                        v: Math.round(v)
                    })
                }
                desc.set!.call(this, v)
            }
        })

        // Post-paint sampling: rAF schedules a MessageChannel task, which the
        // event loop runs only after the frame has been painted.
        const pump = () => {
            requestAnimationFrame(() => {
                const ch = new MessageChannel()
                ch.port1.onmessage = () => {
                    const el = document.querySelector('[data-testid="chat-viewport"]')
                    if (el) {
                        const gap = Math.round(el.scrollHeight - el.clientHeight - el.scrollTop)
                        const last = w.__trace[w.__trace.length - 1]
                        if (!(last?.kind === 'painted' && last.gap === gap)) {
                            w.__trace.push({
                                t: Math.round(performance.now()),
                                kind: 'painted',
                                gap,
                                sh: el.scrollHeight,
                                st: Math.round(el.scrollTop)
                            })
                        }
                    }
                    pump()
                }
                ch.port2.postMessage(null)
            })
        }
        pump()
    })

    for (let attempt = 1; attempt <= 40; attempt++) {
        await page.goto('/tests/chat/stream-swap?variant=new-id-regrow', {
            waitUntil: 'domcontentloaded'
        })
        await waitForMount(page)
        await waitForFollowing(page, true)
        await page.evaluate(() => ((window as unknown as { __trace: Ev[] }).__trace = []))

        await page.locator('[data-testid="run-scenario"]').click()
        await waitForStat(page, 'scenario', 'done', 20000)

        const maxGap = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="debug-stats"]')!
            return Number(/maxGapPx=(\d+)/.exec(el.textContent ?? '')?.[1] ?? 0)
        })

        console.log(`attempt ${attempt}: maxGap=${maxGap}`)
        if (maxGap > 48) {
            const trace = await page.evaluate(
                () => (window as unknown as { __trace: Ev[] }).__trace
            )
            // Only the tail matters: the swap onward.
            const tail = trace.slice(-40)
            const t0 = tail[0].t
            console.log('=== FAILING TRACE (tail) ===')
            for (const e of tail) {
                const { t, kind, ...rest } = e
                console.log(
                    `+${String(t - t0).padStart(4)}ms ${kind.padEnd(10)} ${JSON.stringify(rest)}`
                )
            }
            return
        }
    }
    console.log('no failure caught in 40 attempts')
})
