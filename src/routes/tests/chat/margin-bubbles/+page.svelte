<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'
    import { onMount } from 'svelte'

    /**
     * Margin-bubbles fixture: every message is a fixed 200px bubble with
     * `margin: 12px 0` — the near-universal chat-bubble spacing style. The
     * component measures each wrapper's border box, which EXCLUDES the
     * bubble's margins (they collapse through the unstyled wrapper), so the
     * geometry math sees 200px per message while the real visual pitch is
     * 212px (adjacent 12px margins collapse).
     *
     * `estimatedMessageHeight` is set to exactly the measured border-box
     * height (200), so estimate-vs-measured corrections (#44) are fully out
     * of play: any drift or painted jump here is caused by margins alone.
     *
     * The built-in monitor reports two things in the stats line:
     * - realPitchPx vs cachePitchPx: offsetTop delta between adjacent
     *   rendered wrappers vs the height the cache recorded, derived from
     *   totalHeight (marginLossPx = the gap).
     * - The sweep (same technique as the estimate-miss fixture): scroll up
     *   SWEEP_STEP_PX per frame, sample message positions after each paint;
     *   while scrolling by exactly N px per frame every on-screen message
     *   must move by exactly N px per painted frame — deviations are jumps
     *   the user saw. With margins under-counted, the whole slice shifts by
     *   the lost margin every time the render range advances a message.
     */

    type Message = {
        id: string
        role: 'user' | 'assistant'
    }

    const BUBBLE_PX = 200
    const BUBBLE_MARGIN_PX = 12
    const SEED_COUNT = 50
    const SWEEP_STEP_PX = 30
    const SWEEP_FRAMES = 200
    const JUMP_TOLERANCE_PX = 2

    const messages: Message[] = Array.from({ length: SEED_COUNT }, (_, i) => ({
        id: String(i + 1),
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const)
    }))

    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let sweepState: 'idle' | 'running' | 'done' = $state('idle')
    let sweepFrame = $state(0)
    let jumpCount = $state(0)
    let maxJumpPx = $state(0)
    let totalJumpPx = $state(0)
    let realPitchPx = $state(0)
    let cachePitchPx = $state(0)
    let scrollHeightDriftPx = $state(0)
    let unmounted = false

    /** Resolve just after the next paint; `beforePaint` runs in the rAF phase. */
    const afterPaint = (beforePaint?: () => void) =>
        new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                beforePaint?.()
                const channel = new MessageChannel()
                channel.port1.onmessage = () => resolve()
                channel.port2.postMessage(null)
            })
        })

    /** Compare the real rendered pitch against what the height cache sees. */
    function measurePitch() {
        const viewport = document.querySelector(
            '[data-testid="chat-viewport"]'
        ) as HTMLElement | null
        if (!viewport) return
        const wrappers = [...viewport.querySelectorAll('[data-message-id]')] as HTMLElement[]
        if (wrappers.length >= 2) {
            realPitchPx = Math.round(
                wrappers[1].getBoundingClientRect().top - wrappers[0].getBoundingClientRect().top
            )
        }
        if (debugInfo && debugInfo.measuredCount > 0) {
            // The cache's average recorded height for measured messages —
            // unmeasured ones sit at the estimate (BUBBLE_PX) by definition,
            // so subtract them out of totalHeight first. All bubbles are
            // identical, so this equals the per-message recorded pitch.
            const unmeasured = debugInfo.totalMessages - debugInfo.measuredCount
            cachePitchPx = Math.round(
                (debugInfo.totalHeight - unmeasured * BUBBLE_PX) / debugInfo.measuredCount
            )
        }
        if (debugInfo) {
            scrollHeightDriftPx = Math.round(
                viewport.scrollHeight - Math.max(viewport.clientHeight, debugInfo.totalHeight)
            )
        }
    }

    /**
     * Constant-rate sweep in either direction. Downward sweeps stop well
     * above the follow threshold — re-engaging follow-bottom snaps to the
     * bottom by design, which would read as a (legitimate) jump.
     */
    async function startSweep(direction: 'up' | 'down') {
        if (sweepState === 'running') return
        sweepState = 'running'
        sweepFrame = 0
        jumpCount = 0
        maxJumpPx = 0
        totalJumpPx = 0

        const viewport = document.querySelector(
            '[data-testid="chat-viewport"]'
        ) as HTMLElement | null
        if (!viewport) {
            sweepState = 'idle'
            return
        }

        const readTops = () => {
            const tops: Record<string, number> = {}
            for (const el of viewport.querySelectorAll('[data-message-id]')) {
                tops[(el as HTMLElement).dataset.messageId!] = el.getBoundingClientRect().top
            }
            return tops
        }
        const gapFromBottom = () =>
            viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
        const step = direction === 'up' ? -SWEEP_STEP_PX : SWEEP_STEP_PX

        // Disengage follow-bottom with one deliberate jump, then settle:
        // upward sweeps start just above the bottom, downward sweeps at the top.
        viewport.scrollTop = direction === 'up' ? viewport.scrollTop - 600 : 0
        await afterPaint()
        await afterPaint()

        let previousTops = readTops()
        for (let frame = 0; frame < SWEEP_FRAMES; frame++) {
            if (unmounted) return
            if (direction === 'up' && viewport.scrollTop <= 0) break
            if (direction === 'down' && gapFromBottom() <= 120) break

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
                if (deviation > JUMP_TOLERANCE_PX) {
                    jumpCount += 1
                    totalJumpPx += Math.round(deviation)
                    maxJumpPx = Math.max(maxJumpPx, Math.round(deviation))
                    break // one jump per frame, not per message
                }
            }
            previousTops = tops
            sweepFrame = frame + 1
        }
        measurePitch()
        sweepState = 'done'
    }

    onMount(() => () => {
        unmounted = true
    })
</script>

<div class="p-4">
    <h1 class="mb-2 text-lg font-semibold">
        Test: Margin bubbles ({BUBBLE_PX}px bubbles, {BUBBLE_MARGIN_PX}px margins)
    </h1>
    <p class="mb-3 text-sm text-gray-500">
        The wrapper border-box measures {BUBBLE_PX}px but the real visual pitch is {BUBBLE_PX +
            BUBBLE_MARGIN_PX}px — margins collapse through the wrapper and escape measurement.
        Estimates match measurements exactly, so every number below is margin damage only.
    </p>

    <div class="mb-3 flex gap-2">
        <button
            onclick={() => startSweep('up')}
            data-testid="start-sweep"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
            disabled={sweepState === 'running'}
        >
            Scroll-up sweep
        </button>
        <button
            onclick={() => startSweep('down')}
            data-testid="start-sweep-down"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
            disabled={sweepState === 'running'}
        >
            Scroll-down sweep
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            measured={debugInfo.measuredCount}
            following={debugInfo.isFollowingBottom}
            height={Math.round(debugInfo.totalHeight)}px cachePitchPx={cachePitchPx}
            realPitchPx={realPitchPx}
            marginLossPx={realPitchPx > 0 && cachePitchPx > 0 ? realPitchPx - cachePitchPx : 0}
            scrollHeightDriftPx={scrollHeightDriftPx}
            sweep={sweepState}
            sweepFrames={sweepFrame}
            jumps={jumpCount}
            maxJumpPx={maxJumpPx}
            totalJumpPx={totalJumpPx}
        </div>
    {/if}

    <div
        class="rounded-lg border-2 border-gray-300"
        style="height: 480px;"
        data-testid="chat-wrapper"
    >
        <SvelteVirtualChat
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={BUBBLE_PX}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => {
                debugInfo = info
                // Keep the pitch probe live off every meaningful component
                // update — no timers to race the specs against. Deferred to
                // a microtask: this callback runs inside the component's
                // debug $effect, and synchronously reading the just-written
                // debugInfo state there makes the effect depend on state it
                // writes — an infinite update loop.
                queueMicrotask(measurePitch)
            }}
            containerClass="h-full"
            viewportClass="h-full"
            testId="chat"
        >
            {#snippet renderMessage(message: Message, index: number)}
                <div
                    class="rounded-2xl px-4 py-2 font-mono text-xs {message.role === 'user'
                        ? 'ml-auto bg-blue-100 text-blue-900'
                        : 'bg-gray-100 text-gray-700'}"
                    style="height: {BUBBLE_PX}px; margin: {BUBBLE_MARGIN_PX}px 0; max-width: 75%; overflow: hidden; box-sizing: border-box;"
                    data-testid="msg-{message.id}"
                >
                    [{index}] id={message.id} · {message.role}
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
