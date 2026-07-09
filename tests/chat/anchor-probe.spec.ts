import { expect, test } from '@playwright/test'

type ProbeName = 'A' | 'B' | 'C'

type ProbeResult = {
    name: ProbeName
    firstFrameGap: number
    settledGap: number
}

test('probes overflow-anchor behavior for virtualized follow-bottom geometry', async ({
    page
}, testInfo) => {
    await page.setContent(`
        <!doctype html>
        <html>
            <head>
                <style>
                    body {
                        margin: 0;
                        padding: 24px;
                        font-family: sans-serif;
                    }

                    /*
                     * Do NOT add a border to this scroller. WebKit offsets its
                     * anchor-visibility test by the scroller's border-TOP width,
                     * so a bottom sentinel shorter than that border is judged
                     * outside the scrollport and no anchor is selected. Measured:
                     * webkit anchors iff sentinel height > border-top width
                     * (border 1px + 1px sentinel -> no anchor; 2px sentinel -> anchors).
                     * chromium and firefox are unaffected. An earlier revision of
                     * this probe carried a 1px solid border for looks and made the
                     * known-good control A fail in webkit only. Use outline instead.
                     */
                    .scroller {
                        width: 320px;
                        height: 200px;
                        margin-bottom: 24px;
                        overflow-y: auto;
                        overflow-anchor: auto;
                        outline: 1px solid #999;
                    }

                    .grow {
                        height: 500px;
                        overflow-anchor: none;
                        background: linear-gradient(#e7f0ff, #b9d1ff);
                    }

                    .sentinel {
                        height: 1px;
                        overflow-anchor: auto;
                    }

                    .sentinel-inside {
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        pointer-events: none;
                    }

                    .spacer {
                        height: 3500px;
                        position: relative;
                    }

                    .items {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        transform: translateY(3000px);
                    }
                </style>
            </head>
            <body>
                <div id="A" class="scroller">
                    <div id="A-grow" class="grow"></div>
                    <div class="sentinel"></div>
                </div>

                <div id="B" class="scroller">
                    <div class="spacer">
                        <div class="items">
                            <div id="B-grow" class="grow"></div>
                        </div>
                    </div>
                    <div class="sentinel"></div>
                </div>

                <div id="C" class="scroller">
                    <div class="spacer">
                        <div class="items">
                            <div class="sentinel sentinel-inside"></div>
                            <div id="C-grow" class="grow"></div>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `)

    const results = await page.evaluate(async () => {
        type ProbeName = 'A' | 'B' | 'C'

        const afterPaint = () =>
            new Promise<void>((resolve) => {
                requestAnimationFrame(() => {
                    const channel = new MessageChannel()
                    channel.port1.onmessage = () => resolve()
                    channel.port2.postMessage(null)
                })
            })

        const gap = (scroller: HTMLElement) =>
            Math.round(scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop)

        const measure = async (name: ProbeName) => {
            const scroller = document.getElementById(name) as HTMLElement | null
            const grow = document.getElementById(`${name}-grow`) as HTMLElement | null
            if (!scroller || !grow) throw new Error(`Missing probe ${name}`)

            scroller.scrollTop = scroller.scrollHeight
            await afterPaint()

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    grow.style.height = '800px'
                    resolve()
                }, 0)
            })

            await afterPaint()
            const firstFrameGap = gap(scroller)
            await afterPaint()
            await afterPaint()
            const settledGap = gap(scroller)

            return { name, firstFrameGap, settledGap }
        }

        return Promise.all([measure('A'), measure('B'), measure('C')])
    })

    for (const result of results as ProbeResult[]) {
        console.log(
            `PROBE ${testInfo.project.name} ${result.name} firstFrameGap=${result.firstFrameGap} settledGap=${result.settledGap}`
        )
    }

    const resultByName = new Map((results as ProbeResult[]).map((result) => [result.name, result]))
    const plainFlow = resultByName.get('A')
    expect(plainFlow?.firstFrameGap).toBe(0)
    expect(plainFlow?.settledGap).toBe(0)

    const transformedSubtree = resultByName.get('C')
    expect(transformedSubtree?.firstFrameGap).toBe(0)
    expect(transformedSubtree?.settledGap).toBe(0)
})
