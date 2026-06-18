<script lang="ts">
    import { browser } from '$app/environment'
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'
    import { SvelteSet } from 'svelte/reactivity'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        title: string
        content: string
        volatile?: boolean
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
            volatile: role === 'assistant' && index > 8,
            content:
                `This block discusses ${topic}. ` +
                'It intentionally resembles a rich chat answer with several measured regions. '.repeat(
                    (index % 3) + 1
                )
        }
    })

    const persistLoadedTables =
        browser && new URLSearchParams(window.location.search).get('growth') === 'persist'
    const growthMode = persistLoadedTables ? 'persist' : 'remount'
    const loadedTableIds = new SvelteSet<string>()

    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let growthCount = $state(0)
    let wheelCount = $state(0)

    function expandTable(node: HTMLElement, messageId: string, countGrowth: boolean) {
        node.dataset.state = 'expanded'
        node.style.height = '220px'

        if (countGrowth) growthCount++
        if (!loadedTableIds.has(messageId)) {
            loadedTableIds.add(messageId)
        }
    }

    function delayedGrowth(node: HTMLElement, messageId: string) {
        if (persistLoadedTables && loadedTableIds.has(messageId)) {
            expandTable(node, messageId, false)
            return
        }

        node.dataset.state = 'compact'
        node.style.height = '18px'
        const delay = 215 + (Number(messageId) % 4) * 30
        const timer = setTimeout(() => {
            expandTable(node, messageId, true)
        }, delay)

        return {
            destroy() {
                clearTimeout(timer)
            }
        }
    }

    function recordWheel() {
        wheelCount++
    }
</script>

<svelte:head>
    <title>Test: Wheel scroll jump</title>
</svelte:head>

<div class="flex h-screen flex-col p-4">
    <h1 class="mb-2 text-lg font-semibold">Test: Wheel scroll jump</h1>
    <p class="mb-3 max-w-4xl text-sm text-gray-500">
        Recreates wheel scrolling through app-shaped chat content while newly rendered blocks grow
        shortly after mount. Positive wheel deltas should not produce backward scrollbar progress.
    </p>

    <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
        total={debugInfo?.totalMessages ?? messages.length} dom={debugInfo?.renderedCount ?? 0}
        measured={debugInfo?.measuredCount ?? 0} range={debugInfo?.startIndex ??
            0}-{debugInfo?.endIndex ?? 0} following={debugInfo?.isFollowingBottom ?? false} scroll={Math.round(
            debugInfo?.scrollTop ?? 0
        )}px height={Math.round(debugInfo?.totalHeight ?? 0)}px mode={growthMode}
        growths={growthCount} loaded={loadedTableIds.size} wheels={wheelCount}
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
                <div class="px-8 py-1.5" data-testid="msg-{message.id}" onwheel={recordWheel}>
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

                        {#if message.volatile}
                            <div
                                class="mt-3 overflow-hidden rounded border border-gray-300 bg-white text-gray-700"
                                data-testid="volatile-{message.id}"
                            >
                                <div class="border-b bg-gray-50 px-3 py-2 font-mono text-xs">
                                    Generated table preview for row set {message.id}
                                </div>
                                <div
                                    use:delayedGrowth={message.id}
                                    class="h-[18px] bg-[repeating-linear-gradient(to_bottom,#fff_0,#fff_27px,#e5e7eb_28px,#e5e7eb_29px)]"
                                    data-testid="late-growth-{message.id}"
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
