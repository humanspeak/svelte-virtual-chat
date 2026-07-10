<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'
    import { onMount } from 'svelte'
    import { SweepMonitor } from '../sweepMonitor.svelte.js'

    /**
     * Estimate-miss fixture: `estimatedMessageHeight` is deliberately ~4.5×
     * smaller than the real message height (72 vs 320). Messages outside the
     * initial render window stay unmeasured, so scrolling up through the
     * backlog forces a ~248px totalHeight correction per message — the
     * estimate-vs-measured gap made visible. Jump accounting comes from the
     * shared SweepMonitor (see sweepMonitor.svelte.ts for the paint-aligned
     * technique) and renders live into the stats line below.
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

    let messages: Message[] = $state(
        Array.from({ length: SEED_COUNT }, (_, i) => ({
            id: String(i + 1),
            role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
            blocks: BLOCKS_PER_MESSAGE
        }))
    )

    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    const sweep = new SweepMonitor({ maxFrames: 240 })

    onMount(() => () => sweep.destroy())
</script>

<div class="p-4">
    <h1 class="mb-2 text-lg font-semibold">Test: Estimate miss (72px estimate, ~320px real)</h1>
    <p class="mb-3 text-sm text-gray-500">
        Scrolling up through the unmeasured backlog corrects ~248px per message. During the sweep,
        content should move exactly 30px per painted frame — every deviation below is a jump the
        user saw.
    </p>

    <div class="mb-3 flex gap-2">
        <button
            onclick={() => {
                // Svelte event attributes do not lint returned promises; sweeps are fire-and-forget.
                void sweep.start('up')
            }}
            data-testid="start-sweep"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
            disabled={sweep.state === 'running'}
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
            sweep={sweep.state}
            sweepFrames={sweep.frames}
            jumps={sweep.jumps}
            maxJumpPx={sweep.maxJumpPx}
            totalJumpPx={sweep.totalJumpPx}
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
