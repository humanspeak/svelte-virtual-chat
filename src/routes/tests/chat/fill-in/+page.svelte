<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        blocks: number
    }

    // Fixed-height blocks keep growth deterministic across browsers and
    // viewport widths — no dependence on font metrics or text wrapping.
    const BLOCK_PX = 24
    const SEED_COUNT = 30
    // Long enough that specs can interact mid-fill (follow-drop wheels at
    // ~0.5s, observes through ~2s, then clicks stop) without the fill running
    // out first — even under CI timer drift.
    const FILL_STEPS = 200
    const FILL_INTERVAL_MS = 20

    let messages: Message[] = $state(
        Array.from({ length: SEED_COUNT }, (_, i) => ({
            id: String(i + 1),
            role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
            blocks: 2
        }))
    )

    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let isFilling = $state(false)
    let fillSteps = $state(0)
    let fillSession = 0

    /** Grow the last message by 2 blocks (48px) in one shot — a single mid-stream burst. */
    function growOnce() {
        messages[messages.length - 1].blocks += 2
    }

    /**
     * Timer-driven fill-in like a real token stream: each growth lands in a
     * macrotask between frames (never inside the rAF phase), which is how
     * network chunks and setTimeout-batched tokens actually arrive.
     */
    function startFill() {
        if (isFilling) return
        isFilling = true
        const session = ++fillSession
        let steps = 0
        const tick = () => {
            if (session !== fillSession || steps >= FILL_STEPS) {
                isFilling = false
                return
            }
            messages[messages.length - 1].blocks += 1
            steps += 1
            fillSteps = steps
            setTimeout(tick, FILL_INTERVAL_MS)
        }
        setTimeout(tick, FILL_INTERVAL_MS)
    }

    function stopFill() {
        fillSession++
        isFilling = false
    }
</script>

<div class="p-4">
    <h1 class="mb-4 text-lg font-semibold">Test: Fill-in Growth (bottom-pinned)</h1>
    <p class="mb-3 text-sm text-gray-500">
        The last message grows in fixed-height steps while the viewport follows the bottom. Every
        painted frame should show the viewport pinned to the bottom — no sawtooth.
    </p>

    <div class="mb-3 flex gap-2">
        <button
            onclick={growOnce}
            data-testid="grow-once"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            Grow once (+{BLOCK_PX * 2}px)
        </button>
        <button
            onclick={startFill}
            data-testid="start-fill"
            class="rounded bg-green-500 px-3 py-1 text-sm text-white"
            disabled={isFilling}
        >
            Start fill
        </button>
        <button
            onclick={stopFill}
            data-testid="stop-fill"
            class="rounded bg-red-500 px-3 py-1 text-sm text-white"
            disabled={!isFilling}
        >
            Stop
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            measured={debugInfo.measuredCount}
            range={debugInfo.startIndex}-{debugInfo.endIndex}
            steps={fillSteps}
            filling={isFilling}
            following={debugInfo.isFollowingBottom}
            height={Math.round(debugInfo.totalHeight)}px viewport={Math.round(
                debugInfo.viewportHeight
            )}px
        </div>
    {/if}

    <div class="h-[400px] rounded-lg border-2 border-gray-300" data-testid="chat-wrapper">
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
                <div class="border-b border-gray-200 px-4 py-2" data-testid="msg-{message.id}">
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
