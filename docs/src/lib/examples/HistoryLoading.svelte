<script lang="ts">
    import SvelteVirtualChat from '@humanspeak/svelte-virtual-chat'
    import type { SvelteVirtualChatDebugInfo } from '@humanspeak/svelte-virtual-chat'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        content: string
        timestamp: number
    }

    // Generate a batch of historical messages
    function generateHistory(beforeId: number, count: number): Message[] {
        const batch: Message[] = []
        for (let i = 0; i < count; i++) {
            const id = beforeId - count + i
            if (id < 1) continue
            batch.push({
                id: String(id),
                role: id % 2 === 0 ? 'user' : 'assistant',
                content:
                    id % 2 === 0
                        ? `Historical user message #${id}. This is an older message that was loaded when scrolling up.`
                        : `Historical assistant response #${id}. The viewport should maintain your scroll position when these messages are prepended.`,
                timestamp: Date.now() - (beforeId - id) * 60000
            })
        }
        return batch
    }

    // Start with messages 80-100
    const INITIAL_START = 80
    const TOTAL_HISTORY = 100

    let messages: Message[] = $state(
        generateHistory(TOTAL_HISTORY + 1, TOTAL_HISTORY - INITIAL_START + 1).map((m, i) => ({
            ...m,
            id: String(INITIAL_START + i),
            content:
                (INITIAL_START + i) % 2 === 0
                    ? `User message #${INITIAL_START + i}. Scroll up to load more history.`
                    : `Assistant response #${INITIAL_START + i}. The chat starts with the most recent messages loaded.`
        }))
    )

    let oldestLoadedId = $state(INITIAL_START)
    let isLoadingHistory = $state(false)
    let hasMoreHistory = $state(true)
    let loadCount = $state(0)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let chat: ReturnType<typeof SvelteVirtualChat> | undefined = $state()

    async function loadOlderMessages() {
        if (isLoadingHistory || !hasMoreHistory) return
        isLoadingHistory = true
        loadCount++

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500))

        const batchSize = 20
        const newMessages = generateHistory(oldestLoadedId, batchSize)

        if (newMessages.length > 0) {
            messages = [...newMessages, ...messages]
            oldestLoadedId = Math.max(1, oldestLoadedId - batchSize)
        }

        if (oldestLoadedId <= 1) {
            hasMoreHistory = false
        }

        isLoadingHistory = false
    }

    function formatTime(ts: number): string {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
</script>

<div class="mx-auto w-full max-w-4xl">
    <!-- Info bar -->
    <div class="mb-4 flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
            <div class="text-xs font-medium uppercase text-gray-400">Messages</div>
            <div class="font-mono text-lg font-semibold text-gray-900">{messages.length}</div>
        </div>
        <div>
            <div class="text-xs font-medium uppercase text-gray-400">Oldest Loaded</div>
            <div class="font-mono text-lg font-semibold text-gray-900">#{oldestLoadedId}</div>
        </div>
        <div>
            <div class="text-xs font-medium uppercase text-gray-400">History Loads</div>
            <div class="font-mono text-lg font-semibold text-gray-900">{loadCount}</div>
        </div>
        <div class="ml-auto">
            {#if isLoadingHistory}
                <span class="flex items-center gap-1.5 text-sm font-medium text-indigo-600">
                    <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500"></span>
                    Loading history...
                </span>
            {:else if !hasMoreHistory}
                <span class="text-sm text-gray-400">All history loaded</span>
            {:else}
                <span class="text-sm text-gray-500">Scroll up to load more</span>
            {/if}
        </div>
    </div>

    <!-- Virtualization Stats -->
    {#if debugInfo}
        <div class="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Virtualization Stats
            </h3>
            <div class="grid grid-cols-3 gap-3 sm:grid-cols-6">
                <div class="rounded-lg bg-gray-50 p-2.5">
                    <div class="text-xs text-gray-400">Total</div>
                    <div class="font-mono text-lg font-semibold text-gray-900">
                        {debugInfo.totalMessages}
                    </div>
                </div>
                <div class="rounded-lg bg-indigo-50 p-2.5">
                    <div class="text-xs text-indigo-400">In DOM</div>
                    <div class="font-mono text-lg font-semibold text-indigo-700">
                        {debugInfo.renderedCount}
                    </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-2.5">
                    <div class="text-xs text-gray-400">Measured</div>
                    <div class="font-mono text-lg font-semibold text-gray-900">
                        {debugInfo.measuredCount}
                    </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-2.5">
                    <div class="text-xs text-gray-400">Range</div>
                    <div class="font-mono text-sm font-semibold text-gray-900">
                        {debugInfo.startIndex}–{debugInfo.endIndex}
                    </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-2.5">
                    <div class="text-xs text-gray-400">Height</div>
                    <div class="font-mono text-sm font-semibold text-gray-900">
                        {Math.round(debugInfo.totalHeight)}px
                    </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-2.5">
                    <div class="text-xs text-gray-400">Scroll</div>
                    <div class="font-mono text-sm font-semibold text-gray-900">
                        {Math.round(debugInfo.scrollTop)}px
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <!-- Controls -->
    <div class="mb-4 flex items-center gap-3">
        <button
            onclick={() => chat?.scrollToBottom({ smooth: true })}
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
            Scroll to bottom
        </button>
        <button
            onclick={loadOlderMessages}
            disabled={isLoadingHistory || !hasMoreHistory}
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
            Load history manually
        </button>
    </div>

    <!-- Chat viewport -->
    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <SvelteVirtualChat
            bind:this={chat}
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={72}
            followBottomThresholdPx={48}
            overscan={8}
            onNeedHistory={loadOlderMessages}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (debugInfo = info)}
            containerClass="h-[500px]"
            viewportClass="h-full"
            testId="history-chat"
        >
            {#snippet renderMessage(message: Message)}
                <div
                    class="border-b border-gray-100 px-5 py-3 {message.role === 'user'
                        ? 'bg-indigo-50/50'
                        : 'bg-white'}"
                >
                    <div class="mb-1 flex items-center gap-2">
                        <span
                            class="text-xs font-semibold {message.role === 'user'
                                ? 'text-indigo-600'
                                : 'text-gray-500'}"
                        >
                            {message.role === 'user' ? 'You' : 'Assistant'}
                        </span>
                        <span class="text-xs text-gray-400">
                            {formatTime(message.timestamp)}
                        </span>
                        <span class="font-mono text-xs text-gray-300">
                            #{message.id}
                        </span>
                    </div>
                    <div class="text-sm leading-relaxed text-gray-800">
                        {message.content}
                    </div>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
