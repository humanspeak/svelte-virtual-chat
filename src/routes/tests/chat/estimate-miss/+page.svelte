<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'
    import { onMount } from 'svelte'

    /**
     * Estimate-miss fixture: `estimatedMessageHeight` is deliberately ~4.5×
     * smaller than the real message height (72 vs 320). Messages outside the
     * initial render window stay unmeasured, so scrolling up through the
     * backlog forces a ~248px totalHeight correction per message — the
     * estimate-vs-measured gap made visible.
     *
     * The built-in paint monitor drives a deterministic upward sweep
     * (SWEEP_STEP_PX per frame) and samples AFTER each paint (rAF →
     * MessageChannel). While scrolling by exactly N px per frame, every
     * on-screen message should move by exactly N px per painted frame; any
     * deviation is a correction the user saw as a jump. Counts and magnitudes
     * are rendered live into the stats line below.
     */

    type Message = {
        id: string
        role: 'user' | 'assistant'
        blocks: number
    }

    const BLOCK_PX = 24
    // 12 blocks + 24px header row + 8px padding + 1px border ≈ 321px real
    // height vs the 72px estimate.
    const BLOCKS_PER_MESSAGE = 12
    const SEED_COUNT = 60
    const SWEEP_STEP_PX = 30
    const SWEEP_FRAMES = 240
    const JUMP_TOLERANCE_PX = 2

    let messages: Message[] = $state(
        Array.from({ length: SEED_COUNT }, (_, i) => ({
            id: String(i + 1),
            role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
            blocks: BLOCKS_PER_MESSAGE
        }))
    )

    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let sweepState: 'idle' | 'running' | 'done' = $state('idle')
    let sweepFrame = $state(0)
    let jumpCount = $state(0)
    let maxJumpPx = $state(0)
    let totalJumpPx = $state(0)
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

    async function startSweep() {
        if (sweepState === 'running') return
        sweepState = 'running'
        sweepFrame = 0
        jumpCount = 0
        maxJumpPx = 0
        totalJumpPx = 0

        const viewport = document.querySelector(
            '[data-testid="chat-viewport"]'
        ) as HTMLElement | null
        if (!viewport) return

        const readTops = () => {
            const tops: Record<string, number> = {}
            for (const el of viewport.querySelectorAll('[data-message-id]')) {
                tops[(el as HTMLElement).dataset.messageId!] = el.getBoundingClientRect().top
            }
            return tops
        }

        // Leave the bottom with one deliberate jump (well past the follow
        // threshold, so follow-bottom disengages cleanly) and let it settle.
        // The sweep then measures pure scroll-through-backlog behavior with
        // no snap-to-bottom in play.
        viewport.scrollTop = viewport.scrollTop - 600
        await afterPaint()
        await afterPaint()

        let previousTops = readTops()
        for (let frame = 0; frame < SWEEP_FRAMES; frame++) {
            if (unmounted) return
            if (viewport.scrollTop <= 0) break

            let scrolled = 0
            await afterPaint(() => {
                const before = viewport.scrollTop
                viewport.scrollTop = Math.max(0, before - SWEEP_STEP_PX)
                scrolled = before - viewport.scrollTop
            })

            const tops = readTops()
            for (const [id, top] of Object.entries(tops)) {
                const previous = previousTops[id]
                if (previous === undefined) continue
                // Scrolling up by `scrolled` px moves content down by the same
                // amount. Anything else painted as a jump.
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
        sweepState = 'done'
    }

    onMount(() => () => {
        unmounted = true
    })
</script>

<div class="p-4">
    <h1 class="mb-2 text-lg font-semibold">Test: Estimate miss (72px estimate, ~320px real)</h1>
    <p class="mb-3 text-sm text-gray-500">
        Scrolling up through the unmeasured backlog corrects ~248px per message. During the sweep,
        content should move exactly {SWEEP_STEP_PX}px per painted frame — every deviation below is a
        jump the user saw.
    </p>

    <div class="mb-3 flex gap-2">
        <button
            onclick={startSweep}
            data-testid="start-sweep"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
            disabled={sweepState === 'running'}
        >
            Scroll-up sweep
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            measured={debugInfo.measuredCount}
            following={debugInfo.isFollowingBottom}
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
            estimatedMessageHeight={72}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (debugInfo = info)}
            containerClass="h-full"
            viewportClass="h-full"
            testId="chat"
        >
            {#snippet renderMessage(message: Message, index: number)}
                <div class="border-b border-gray-200 px-4 py-1" data-testid="msg-{message.id}">
                    <div
                        class="flex items-center gap-2 overflow-hidden"
                        style="height: {BLOCK_PX}px;"
                    >
                        <span
                            class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500"
                            >[{index}]</span
                        >
                        <span class="font-mono text-xs text-gray-400">id={message.id}</span>
                        <span
                            class="text-xs font-bold {message.role === 'user'
                                ? 'text-blue-500'
                                : 'text-green-500'}">{message.role}</span
                        >
                    </div>
                    {#each Array.from({ length: message.blocks }) as _, blockIndex (blockIndex)}
                        <div
                            class="overflow-hidden font-mono text-xs text-gray-400"
                            style="height: {BLOCK_PX}px; line-height: {BLOCK_PX}px;"
                        >
                            ▍block {blockIndex}
                        </div>
                    {/each}
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
