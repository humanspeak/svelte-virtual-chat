<script lang="ts">
    import { browser } from '$app/environment'
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'
    import { onDestroy } from 'svelte'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        title: string
        content: string
        growable?: boolean
    }

    const topics = [
        'housing market analysis with amenity premiums and price drivers',
        'property segmentation by bedroom count and furnishing status',
        'raw premium comparison with table-like summaries',
        'quality checks for data completeness and skew',
        'follow-up question suggestions and generated trace rows'
    ]

    const messages: Message[] = Array.from({ length: 90 }, (_, i) => {
        const index = i + 1
        const role = index % 5 === 0 ? 'user' : 'assistant'
        const topic = topics[index % topics.length]
        return {
            id: String(index),
            role,
            title: role === 'user' ? `Question ${index}` : `Analysis block ${index}`,
            // Most assistant blocks carry a growable region so, wherever the
            // reading window sits, there are always compact blocks mounted
            // just above it to displace.
            growable: role === 'assistant' && index > 4,
            content:
                `This block discusses ${topic}. ` +
                'It intentionally resembles a rich chat answer with several measured regions. '.repeat(
                    (index % 3) + 1
                )
        }
    })

    // Referee knobs — driven from the spec via query params so the Step 4 gate
    // variants (larger growth, shorter delay, per-tick scheduling) can be
    // explored without editing this fixture.
    const params = browser ? new URLSearchParams(window.location.search) : new URLSearchParams()
    const GROW_PX = Number(params.get('grow')) || 220
    const GROW_DELAY_MS = Number(params.get('delay')) || 350
    const GROW_BLOCKS = Number(params.get('blocks')) || 3
    // `every=0` schedules a single growth pass on the first armed wheel; the
    // default schedules a pass on every wheel tick (only compact blocks still
    // above the viewport actually grow, so it self-limits).
    const GROW_EVERY = params.get('every') !== '0'

    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let growthCount = $state(0)
    let wheelCount = $state(0)
    let armed = $state(false)

    // Non-reactive DOM-node cache read only in event/timer handlers — plain Map
    // is correct; SvelteMap would add pointless reactivity overhead.
    // trunk-ignore(eslint/svelte/prefer-svelte-reactivity)
    const blockNodes = new Map<string, HTMLElement>()
    // Non-reactive timer bookkeeping touched only in handlers and onDestroy —
    // plain Set is correct; SvelteSet would add pointless reactivity overhead.
    // trunk-ignore(eslint/svelte/prefer-svelte-reactivity)
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>()
    let scheduledOnce = false

    /** Register a compact, pre-populated block. Growth is attribute-only
     * (`style.height`) — the rows already exist, so no childList records fire. */
    function registerBlock(node: HTMLElement, messageId: string) {
        node.dataset.state = 'compact'
        node.style.height = '18px'
        blockNodes.set(messageId, node)
        return {
            destroy() {
                blockNodes.delete(messageId)
            }
        }
    }

    function viewportTopEdge(): number | null {
        if (!browser) return null
        const viewport = document.querySelector('[data-testid="chat-viewport"]')
        return viewport ? viewport.getBoundingClientRect().top : null
    }

    /** Grow the compact blocks currently mounted ABOVE the visible range,
     * nearest the viewport top first — the growth lands inside the reading
     * backlog and displaces content above the reading position. */
    function growBlocksAboveViewport() {
        const top = viewportTopEdge()
        if (top === null) return

        const candidates = [...blockNodes.values()]
            .filter(
                (node) =>
                    node.dataset.state === 'compact' && node.getBoundingClientRect().bottom <= top
            )
            .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)
            .slice(0, GROW_BLOCKS)

        for (const node of candidates) {
            node.dataset.state = 'expanded'
            node.style.height = `${GROW_PX}px`
            growthCount++
        }
    }

    function handleWheel() {
        wheelCount++
        if (!armed) return
        if (!GROW_EVERY && scheduledOnce) return
        scheduledOnce = true

        const timer = setTimeout(() => {
            pendingTimers.delete(timer)
            growBlocksAboveViewport()
        }, GROW_DELAY_MS)
        pendingTimers.add(timer)
    }

    onDestroy(() => {
        for (const timer of pendingTimers) clearTimeout(timer)
        pendingTimers.clear()
    })
</script>

<svelte:head>
    <title>Test: Scroll-window attribute growth</title>
</svelte:head>

<div class="flex h-screen flex-col p-4">
    <h1 class="mb-2 text-lg font-semibold">Test: Scroll-window attribute growth</h1>
    <p class="mb-3 max-w-4xl text-sm text-gray-500">
        Referee for #32: already-mounted compact blocks above the viewport grow via a
        <code>style.height</code> attribute mutation that lands inside an active user-scroll preservation
        window. Upward wheel input should not produce forward scrollbar jumps.
    </p>

    <label class="mb-3 flex items-center gap-2 text-sm text-gray-700">
        <input
            type="checkbox"
            data-testid="arm-growth"
            onchange={(event) => (armed = event.currentTarget.checked)}
        />
        Arm growth on wheel
    </label>

    <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
        total={debugInfo?.totalMessages ?? messages.length} dom={debugInfo?.renderedCount ?? 0}
        measured={debugInfo?.measuredCount ?? 0} range={debugInfo?.startIndex ??
            0}-{debugInfo?.endIndex ?? 0} following={debugInfo?.isFollowingBottom ?? false} scroll={Math.round(
            debugInfo?.scrollTop ?? 0
        )}px height={Math.round(debugInfo?.totalHeight ?? 0)}px armed={armed}
        growths={growthCount} wheels={wheelCount}
    </div>

    <div class="min-h-0 flex-1 rounded-lg border-2 border-gray-300" data-testid="chat-wrapper">
        <SvelteVirtualChat
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={132}
            followBottomThresholdPx={24}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (debugInfo = info)}
            containerClass="h-full"
            viewportClass="h-full"
            testId="chat"
        >
            {#snippet renderMessage(message: Message, index: number)}
                <div class="px-8 py-1.5" data-testid="msg-{message.id}" onwheel={handleWheel}>
                    <div
                        class="max-w-[860px] rounded-2xl px-4 py-3 text-sm shadow-sm {message.role ===
                        'user'
                            ? 'ml-auto rounded-br-md bg-blue-600 text-white'
                            : 'rounded-bl-md bg-gray-100 text-gray-900'}"
                    >
                        <div class="mb-2 flex items-center justify-between gap-3">
                            <strong>{message.title}</strong>
                            <span class="font-mono text-[10px] opacity-60">idx={index}</span>
                        </div>
                        <p class="leading-relaxed">{message.content}</p>

                        {#if message.growable}
                            <div
                                class="mt-3 overflow-hidden rounded border border-gray-300 bg-white text-gray-700"
                                data-testid="growth-region-{message.id}"
                            >
                                <div class="border-b bg-gray-50 px-3 py-2 font-mono text-xs">
                                    Generated table preview for row set {message.id}
                                </div>
                                <div
                                    use:registerBlock={message.id}
                                    class="h-[18px] overflow-hidden bg-[repeating-linear-gradient(to_bottom,#fff_0,#fff_27px,#e5e7eb_28px,#e5e7eb_29px)]"
                                    data-testid="growth-block-{message.id}"
                                >
                                    {#each Array.from({ length: 8 }) as _, row (row)}
                                        <div class="grid grid-cols-4 gap-3 px-3 py-1.5 text-xs">
                                            <span>#{row + 1}</span>
                                            <span>${(245000 + row * 18750).toLocaleString()}</span>
                                            <span>{920 + row * 85} sqft</span>
                                            <span>{(row % 4) + 1} beds</span>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
