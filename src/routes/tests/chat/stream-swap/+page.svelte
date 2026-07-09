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
    const initialVariant: Variant = isVariant(variantParam) ? variantParam : 'new-id'

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
    let selectedVariant: Variant = $state(initialVariant)
    let runSession = 0
    let nextRunNumber = 1
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

    function paintedBottomOffsetPx(el: HTMLElement): number {
        const anchor = document.querySelector('[data-testid="chat-anchor"]')
        if (anchor instanceof HTMLElement) {
            const viewportRect = el.getBoundingClientRect()
            const anchorRect = anchor.getBoundingClientRect()
            return anchorRect.bottom - viewportRect.bottom
        }

        const messages = el.querySelectorAll('[data-message-id]')
        const tail = messages.item(messages.length - 1)
        if (tail instanceof HTMLElement) {
            const viewportRect = el.getBoundingClientRect()
            const tailRect = tail.getBoundingClientRect()
            return tailRect.bottom - viewportRect.bottom
        }

        return el.scrollHeight - el.clientHeight - el.scrollTop
    }

    async function monitorPaintedBottomGap(session: number) {
        while (session === runSession && performance.now() < monitorUntilMs) {
            await afterPaint()
            const el = viewport()
            if (!el) continue

            const gap = Math.abs(paintedBottomOffsetPx(el))
            const roundedGap = Math.round(gap)
            paintFrames += 1
            currentGapPx = roundedGap
            if (gap > OFF_BOTTOM_THRESHOLD_PX) offBottomPaints += 1
            maxGapPx = Math.max(maxGapPx, roundedGap)
        }
    }

    function appendStreamingMessage(id: string) {
        messages.push({
            id,
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
        const runNumber = nextRunNumber++
        const streamingId = `streaming-${runNumber}`
        const finalId = `convex-${runNumber}`
        scenario = 'running'
        offBottomPaints = 0
        maxGapPx = 0
        currentGapPx = 0
        paintFrames = 0
        monitorUntilMs = Number.POSITIVE_INFINITY

        appendStreamingMessage(streamingId)
        const monitorPromise = monitorPaintedBottomGap(session)

        for (let blocks = 2; blocks <= STREAM_BLOCKS; blocks += 1) {
            await delay(STREAM_INTERVAL_MS)
            if (session !== runSession) return
            messages[messages.length - 1].blocks = blocks
        }

        if (selectedVariant === 'same-id') {
            replaceLast({
                id: streamingId,
                role: 'assistant',
                blocks: STREAM_BLOCKS,
                kind: 'final'
            })
        } else if (selectedVariant === 'new-id') {
            replaceLast({
                id: finalId,
                role: 'assistant',
                blocks: STREAM_BLOCKS,
                kind: 'final'
            })
        } else if (selectedVariant === 'new-id-two-tick') {
            messages.pop()
            await delay(50)
            if (session !== runSession) return
            messages.push({
                id: finalId,
                role: 'assistant',
                blocks: STREAM_BLOCKS,
                kind: 'final'
            })
        } else {
            replaceLast({
                id: finalId,
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
            variant={selectedVariant} currentGapPx={currentGapPx} maxGapPx={maxGapPx}
            offBottomPaints={offBottomPaints} frames={paintFrames} tail={messages[
                messages.length - 1
            ]?.id}:{messages[messages.length - 1]?.kind}
        </div>
    </div>

    <div class="mb-3 flex flex-wrap gap-2">
        {#each VARIANTS as option (option)}
            <button
                onclick={() => (selectedVariant = option)}
                data-testid="variant-{option}"
                class="rounded px-3 py-1 text-sm font-semibold {selectedVariant === option
                    ? option === 'new-id-two-tick'
                        ? 'bg-red-700 text-white'
                        : 'bg-gray-900 text-white'
                    : 'bg-gray-200 text-gray-700'}"
                disabled={scenario === 'running'}
            >
                {option}
            </button>
        {/each}
        <button
            onclick={() => runScenario(selectedVariant)}
            data-testid="run-scenario"
            class="rounded px-3 py-1 text-sm font-bold text-white disabled:bg-gray-300 {selectedVariant ===
            'new-id-two-tick'
                ? 'bg-red-700'
                : 'bg-green-600'}"
            disabled={scenario === 'running'}
        >
            Run {selectedVariant}
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
            variant={selectedVariant}
            offBottomPaints={offBottomPaints}
            maxGapPx={maxGapPx}
            currentGapPx={currentGapPx}
            paintFrames={paintFrames}
            tail={messages[messages.length - 1]?.id}:{messages[messages.length - 1]?.kind}
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
                        <span
                            class="rounded px-1.5 py-0.5 font-mono text-xs font-bold {message.kind ===
                            'stream'
                                ? 'bg-green-700 text-white'
                                : message.kind === 'final'
                                  ? 'bg-blue-700 text-white'
                                  : 'bg-gray-200 text-gray-700'}">kind={message.kind}</span
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
