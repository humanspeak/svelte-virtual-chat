/**
 * Headless-Chromium runner for the perf-bench fixture
 * (`src/routes/tests/chat/perf-bench/+page.svelte`).
 *
 * For each scenario (Load 500/2k/5k, smooth scroll on 5k, stream sim 5s),
 * runs once cold (first navigation) and once warm (after reload), then
 * dumps a JSON blob of the rolling-10s metrics emitted by the page's
 * debug strip. Use this to capture baselines before each Tier 1/2 commit
 * and to produce before/after comparisons in PR descriptions.
 *
 * Usage:
 *     pnpm dev                            # in another shell — note the port
 *     PERF_BENCH_URL=http://localhost:8028 \
 *         node scripts/perf-bench.mjs     # default port is 8028
 *
 * Override the URL via PERF_BENCH_URL when Vite picks a different port.
 *
 * Caveat: headless Chromium is not a DevTools session — absolute numbers
 * differ from a manual capture. The deltas between commits stay valid.
 */

import { chromium } from 'playwright'

const URL = process.env.PERF_BENCH_URL ?? 'http://localhost:8028/tests/chat/perf-bench'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function readStats(page) {
    return await page.$eval('[data-testid="debug-stats"]', (el) =>
        el.textContent.replace(/\s+/g, ' ').trim()
    )
}

function parseStats(s) {
    const grab = (key) => {
        const m = s.match(new RegExp(`${key}=([^\\s·]+)`))
        return m ? m[1] : null
    }
    return {
        total: Number(grab('total')),
        dom: Number(grab('dom')),
        measured: Number(grab('measured')),
        following: grab('following'),
        longestTaskMs: grab('longestTaskMs'),
        longTasks10s: grab('longTasks10s'),
        rafP95Ms: parseFloat(grab('rafP95')),
        mutations10s: Number(grab('mutations10s')),
        loaf10s: grab('loaf10s'),
        loafScriptMaxMs: grab('loafScriptMaxMs')
    }
}

async function runScenarioLoad(page, n) {
    await page.locator('[data-testid="clear"]').click()
    await sleep(11_000) // drain the rolling-10s window
    const t0 = Date.now()
    await page.locator(`[data-testid="load-${n}"]`).click()
    const loadElapsed = Date.now() - t0
    await sleep(3_500) // window still holds the spike; refresh tick has fired
    const stats = parseStats(await readStats(page))
    return { ...stats, loadActionMs: loadElapsed }
}

async function runScenarioStream(page) {
    await page.locator('[data-testid="clear"]').click()
    await sleep(11_000)
    await page.locator('[data-testid="stream-sim"]').click()
    await sleep(3_000)
    const mid = parseStats(await readStats(page))
    await sleep(2_500) // total elapsed > 5s — stream has finished
    const final = parseStats(await readStats(page))
    return { mid, final }
}

async function runScenarioSmoothScroll(page) {
    await page.locator('[data-testid="clear"]').click()
    await sleep(11_000)
    await page.locator('[data-testid="load-5000"]').click()
    await sleep(2_000)

    const scrollResult = await page.evaluate(async () => {
        const wrapper = document.querySelector('[data-testid="chat-wrapper"]')
        const scroller = Array.from(wrapper.querySelectorAll('*')).find(
            (el) => el.scrollHeight > el.clientHeight
        )
        if (!scroller) return { ok: false, reason: 'no scroller' }

        let pos = scroller.scrollHeight - scroller.clientHeight
        scroller.scrollTop = pos
        await new Promise((r) => setTimeout(r, 50))

        return await new Promise((resolve) => {
            const start = performance.now()
            let dir = 1
            let frames = 0
            function step(now) {
                frames++
                pos += dir * 80
                if (pos > scroller.scrollHeight - scroller.clientHeight - 50) dir = -1
                if (pos < 50) dir = 1
                scroller.scrollTop = pos
                if (now - start < 5000) requestAnimationFrame(step)
                else resolve({ ok: true, frames })
            }
            requestAnimationFrame(step)
        })
    })

    await sleep(500)
    const stats = parseStats(await readStats(page))
    return { ...stats, scrollFrames: scrollResult.frames, scrollOk: scrollResult.ok }
}

async function runAll(label, page) {
    console.log(`\n=== ${label} run ===`)
    const out = {}

    console.log('  → Load 500…')
    out.load500 = await runScenarioLoad(page, 500)
    console.log('   ', JSON.stringify(out.load500))

    console.log('  → Load 2000…')
    out.load2000 = await runScenarioLoad(page, 2000)
    console.log('   ', JSON.stringify(out.load2000))

    console.log('  → Load 5000…')
    out.load5000 = await runScenarioLoad(page, 5000)
    console.log('   ', JSON.stringify(out.load5000))

    console.log('  → Smooth scroll (5s on 5k fixture)…')
    out.smoothScroll = await runScenarioSmoothScroll(page)
    console.log('   ', JSON.stringify(out.smoothScroll))

    console.log('  → Stream simulation (5s)…')
    out.stream = await runScenarioStream(page)
    console.log('   ', JSON.stringify(out.stream))

    return out
}

;(async () => {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()

    page.on('console', (msg) => {
        if (msg.type() === 'error') console.log('  [browser error]', msg.text())
    })

    await page.goto(URL, { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="debug-stats"]')
    await sleep(1000)
    const cold = await runAll('COLD', page)

    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[data-testid="debug-stats"]')
    await sleep(1000)
    const warm = await runAll('WARM', page)

    await browser.close()

    const allResults = { cold, warm, capturedAt: new Date().toISOString() }
    console.log('\n=== JSON ===')
    console.log(JSON.stringify(allResults, null, 2))
})()
