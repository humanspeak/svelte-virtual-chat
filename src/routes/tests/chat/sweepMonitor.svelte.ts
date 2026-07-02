/**
 * Shared paint-aligned sweep monitor for chat test fixtures.
 *
 * Drives a constant-rate scroll (`stepPx` per frame, applied in the rAF
 * phase) and samples every rendered message's viewport position just AFTER
 * each paint (rAF → MessageChannel task). While scrolling by exactly N px
 * per frame, every on-screen message must move by exactly N px per painted
 * frame — any deviation is a jump the user saw, counted and sized in the
 * reactive fields below for fixtures to render into their stats line.
 *
 * Downward sweeps stop short of the follow threshold (`stopGapPx`) —
 * re-engaging follow-bottom snaps to the bottom by design, which would read
 * as a (legitimate) jump.
 */

export type SweepDirection = 'up' | 'down'

export type SweepMonitorOptions = {
    stepPx?: number
    maxFrames?: number
    tolerancePx?: number
    viewportSelector?: string
}

export type SweepRunOptions = {
    /** Downward sweeps stop when the bottom gap falls to this (default 120). */
    stopGapPx?: number
    /** Runs after the sweep loop, before `state` flips to 'done'. */
    onDone?: () => void
}

/** Resolve just after the next paint; `beforePaint` runs in the rAF phase. */
export const afterPaint = (beforePaint?: () => void) =>
    new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
            beforePaint?.()
            const channel = new MessageChannel()
            channel.port1.onmessage = () => resolve()
            channel.port2.postMessage(null)
        })
    })

export class SweepMonitor {
    state: 'idle' | 'running' | 'done' = $state('idle')
    frames = $state(0)
    jumps = $state(0)
    maxJumpPx = $state(0)
    totalJumpPx = $state(0)

    readonly #stepPx: number
    readonly #maxFrames: number
    readonly #tolerancePx: number
    readonly #viewportSelector: string
    #destroyed = false

    constructor(options: SweepMonitorOptions = {}) {
        this.#stepPx = options.stepPx ?? 30
        this.#maxFrames = options.maxFrames ?? 200
        this.#tolerancePx = options.tolerancePx ?? 2
        this.#viewportSelector = options.viewportSelector ?? '[data-testid="chat-viewport"]'
    }

    /** Stop an in-flight sweep (e.g. on fixture unmount). */
    destroy(): void {
        this.#destroyed = true
    }

    async start(direction: SweepDirection, runOptions: SweepRunOptions = {}): Promise<void> {
        if (this.state === 'running') return
        this.state = 'running'
        this.frames = 0
        this.jumps = 0
        this.maxJumpPx = 0
        this.totalJumpPx = 0

        const viewport = document.querySelector(this.#viewportSelector) as HTMLElement | null
        if (!viewport) {
            this.state = 'idle'
            return
        }

        const readTops = () => {
            // Relative to the viewport's own rect, not the page: fixture
            // chrome above the chat (e.g. the stats line re-wrapping on
            // narrow screens as its numbers change width) shifts the whole
            // scroller in page coordinates, and that must not read as
            // scroller-internal motion.
            const viewportTop = viewport.getBoundingClientRect().top
            const tops: Record<string, number> = {}
            for (const el of viewport.querySelectorAll('[data-message-id]')) {
                tops[(el as HTMLElement).dataset.messageId!] =
                    el.getBoundingClientRect().top - viewportTop
            }
            return tops
        }
        const gapFromBottom = () =>
            viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
        const step = direction === 'up' ? -this.#stepPx : this.#stepPx
        const stopGapPx = runOptions.stopGapPx ?? 120

        // Disengage follow-bottom with one deliberate jump, then settle:
        // upward sweeps start just above the bottom, downward ones at the top.
        viewport.scrollTop = direction === 'up' ? viewport.scrollTop - 600 : 0
        await afterPaint()
        await afterPaint()

        let previousTops = readTops()
        for (let frame = 0; frame < this.#maxFrames; frame++) {
            if (this.#destroyed) return
            if (direction === 'up' && viewport.scrollTop <= 0) break
            if (direction === 'down' && gapFromBottom() <= stopGapPx) break

            let scrolled = 0
            await afterPaint(() => {
                const before = viewport.scrollTop
                viewport.scrollTop = Math.max(0, before + step)
                scrolled = before - viewport.scrollTop
            })

            const tops = readTops()
            for (const [id, top] of Object.entries(tops)) {
                const previous = previousTops[id]
                if (previous === undefined) continue
                const deviation = Math.abs(top - previous - scrolled)
                if (deviation > this.#tolerancePx) {
                    this.jumps += 1
                    this.totalJumpPx += Math.round(deviation)
                    this.maxJumpPx = Math.max(this.maxJumpPx, Math.round(deviation))
                    break // one jump per frame, not per message
                }
            }
            previousTops = tops
            this.frames = frame + 1
        }
        runOptions.onDone?.()
        this.state = 'done'
    }
}
