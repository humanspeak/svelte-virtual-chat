<script lang="ts">
    import { page } from '$app/state'
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'

    type MessageKind = 'seed' | 'stream' | 'final'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        blocks: number
        kind: MessageKind
    }

    type Variant = 'same-id' | 'new-id' | 'new-id-two-tick' | 'new-id-regrow'
    type ScenarioState = 'idle' | 'running' | 'done'

    const BLOCK_PX = 24
    const SEED_COUNT = 25
    const STREAM_BLOCKS = 20
    const STREAM_INTERVAL_MS = 40
    const POST_MUTATION_MONITOR_MS = 800
    const OFF_BOTTOM_THRESHOLD_PX = 48

    const VARIANTS = ['same-id', 'new-id', 'new-id-two-tick', 'new-id-regrow'] as const

    function isVariant(value: string | null): value is Variant {
        return VARIANTS.includes(value as Variant)
    }

    const variantParam = page.url.searchParams.get('variant')
    const variant: Variant = isVariant(variantParam) ? variantParam : 'new-id'

    const makeSeedMessages = (): Message[] =>
        Array.from({ length: SEED_COUNT }, (_, i) => ({
            id: String(i + 1),
            role: i % 2 === 0 ? 'user' : 'assistant',
            blocks: 4,
            kind: 'seed'
        }))

    let messages: Message[] = $state(makeSeedMessages())
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let scenario: ScenarioState = $state('idle')
    let offBottomPaints = $state(0)
    let maxGapPx = $state(0)
    let currentGapPx = $state(0)
    let paintFrames = $state(0)
    let runSession = 0
    let monitorUntilMs = 0

    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

    const afterPaint = () =>
        new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                const channel = new MessageChannel()
                channel.port1.onmessage = () => resolve()
                channel.port2.postMessage(null)
            })
        })

    function viewport(): HTMLElement | null {
        return document.querySelector('[data-testid="chat-viewport"]')
    }

    async function monitorPaintedBottomGap(session: number) {
        while (session === runSession && performance.now() < monitorUntilMs) {
            await afterPaint()
            const el = viewport()
            if (!el) continue

            const gap = Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop)
            const roundedGap = Math.round(gap)
            paintFrames += 1
            currentGapPx = roundedGap
            if (gap > OFF_BOTTOM_THRESHOLD_PX) offBottomPaints += 1
            maxGapPx = Math.max(maxGapPx, roundedGap)
        }
    }

    function appendStreamingMessage() {
        messages.push({
            id: 'streaming-1',
            role: 'assistant',
            blocks: 1,
            kind: 'stream'
        })
    }

    function replaceLast(message: Message) {
        messages[messages.length - 1] = message
    }

    async function runScenario(selectedVariant: Variant) {
        if (scenario === 'running') return

        const session = ++runSession
        scenario = 'running'
        offBottomPaints = 0
        maxGapPx = 0
        currentGapPx = 0
        paintFrames = 0
        monitorUntilMs = Number.POSITIVE_INFINITY

        appendStreamingMessage()
        const monitorPromise = monitorPaintedBottomGap(session)

        for (let blocks = 2; blocks <= STREAM_BLOCKS; blocks += 1) {
            await delay(STREAM_INTERVAL_MS)
            if (session !== runSession) return
            messages[messages.length - 1].blocks = blocks
        }

        if (selectedVariant === 'same-id') {
            replaceLast({
                id: 'streaming-1',
                role: 'assistant',
                blocks: STREAM_BLOCKS,
                kind: 'final'
            })
        } else if (selectedVariant === 'new-id') {
            replaceLast({
                id: 'convex-1',
                role: 'assistant',
                blocks: STREAM_BLOCKS,
                kind: 'final'
            })
        } else if (selectedVariant === 'new-id-two-tick') {
            messages.pop()
            await delay(50)
            if (session !== runSession) return
            messages.push({
                id: 'convex-1',
                role: 'assistant',
                blocks: STREAM_BLOCKS,
                kind: 'final'
            })
        } else {
            replaceLast({
                id: 'convex-1',
                role: 'assistant',
                blocks: 3,
                kind: 'final'
            })
            await delay(100)
            if (session !== runSession) return
            messages[messages.length - 1].blocks = STREAM_BLOCKS
        }

        monitorUntilMs = performance.now() + POST_MUTATION_MONITOR_MS
        await monitorPromise
        if (session === runSession) scenario = 'done'
    }
</script>

<div class="p-4">
    <h1 class="mb-4 text-lg font-semibold">Test: Stream Swap Follow Bottom</h1>
    <p class="mb-3 text-sm text-gray-500">
        A streaming placeholder grows, then is replaced by a final message document.
    </p>

    <div
        class="mb-3 border-4 p-4 text-center {maxGapPx > OFF_BOTTOM_THRESHOLD_PX
            ? 'border-red-700 bg-red-100 text-red-950'
            : scenario === 'running'
              ? 'border-yellow-500 bg-yellow-50 text-yellow-950'
              : 'border-green-600 bg-green-50 text-green-950'}"
        data-testid="loud-status"
    >
        <div class="text-4xl font-black">
            {#if maxGapPx > OFF_BOTTOM_THRESHOLD_PX}
                OFF BOTTOM: {maxGapPx}px
            {:else if scenario === 'running'}
                WATCHING BOTTOM LOCK
            {:else}
                BOTTOM LOCK OK
            {/if}
        </div>
        <div class="mt-2 font-mono text-sm">
            variant={variant} currentGapPx={currentGapPx} maxGapPx={maxGapPx}
            offBottomPaints={offBottomPaints} frames={paintFrames}
        </div>
    </div>

    <div class="mb-3 flex gap-2">
        <button
            onclick={() => runScenario(variant)}
            data-testid="run-scenario"
            class="rounded bg-green-500 px-3 py-1 text-sm text-white disabled:bg-gray-300"
            disabled={scenario === 'running'}
        >
            Run {variant}
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            measured={debugInfo.measuredCount}
            range={debugInfo.startIndex}-{debugInfo.endIndex}
            following={debugInfo.isFollowingBottom}
            scenario={scenario}
            offBottomPaints={offBottomPaints}
            maxGapPx={maxGapPx}
            currentGapPx={currentGapPx}
            paintFrames={paintFrames}
            height={Math.round(debugInfo.totalHeight)}px viewport={Math.round(
                debugInfo.viewportHeight
            )}px
        </div>
    {/if}

    <div
        style="height: 480px;"
        class="relative rounded-lg border-4 {currentGapPx > OFF_BOTTOM_THRESHOLD_PX
            ? 'border-red-700 ring-8 ring-red-300'
            : maxGapPx > OFF_BOTTOM_THRESHOLD_PX
              ? 'border-red-500 ring-4 ring-red-200'
              : 'border-gray-300'}"
        data-testid="chat-wrapper"
    >
        {#if currentGapPx > OFF_BOTTOM_THRESHOLD_PX || maxGapPx > OFF_BOTTOM_THRESHOLD_PX}
            <div
                class="pointer-events-none absolute inset-x-0 top-0 z-10 bg-red-700 px-4 py-2 text-center text-2xl font-black text-white"
                data-testid="off-bottom-banner"
            >
                {#if currentGapPx > OFF_BOTTOM_THRESHOLD_PX}
                    LIVE GAP {currentGapPx}px
                {:else}
                    RECORDED GAP {maxGapPx}px
                {/if}
            </div>
        {/if}

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

                    {#if message.kind === 'stream'}
                        <div class="bg-green-50">
                            {#each Array.from( { length: message.blocks } ) as _, blockIndex (blockIndex)}
                                <div
                                    class="overflow-hidden font-mono text-xs text-green-700"
                                    style="height: {BLOCK_PX}px; line-height: {BLOCK_PX}px;"
                                >
                                    stream block {blockIndex}
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class={message.kind === 'final' ? 'bg-blue-50' : 'bg-gray-50'}>
                            {#each Array.from( { length: message.blocks } ) as _, blockIndex (blockIndex)}
                                <div
                                    class="overflow-hidden font-mono text-xs text-gray-500"
                                    style="height: {BLOCK_PX}px; line-height: {BLOCK_PX}px;"
                                >
                                    final block {blockIndex}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
