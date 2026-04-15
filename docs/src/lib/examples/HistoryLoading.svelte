<script lang="ts">
    import SvelteVirtualChat, {
        type SvelteVirtualChatDebugInfo
    } from '@humanspeak/svelte-virtual-chat'

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
    <div class="border-border bg-card mb-4 flex items-center gap-4 rounded-xl border p-4 shadow-sm">
        <div>
            <div class="text-muted-foreground text-xs font-medium uppercase">Messages</div>
            <div class="text-foreground font-mono text-lg font-semibold">{messages.length}</div>
        </div>
        <div>
            <div class="text-muted-foreground text-xs font-medium uppercase">Oldest Loaded</div>
            <div class="text-foreground font-mono text-lg font-semibold">#{oldestLoadedId}</div>
        </div>
        <div>
            <div class="text-muted-foreground text-xs font-medium uppercase">History Loads</div>
            <div class="text-foreground font-mono text-lg font-semibold">{loadCount}</div>
        </div>
        <div class="ml-auto">
            {#if isLoadingHistory}
                <span
                    class="text-brand-600 dark:text-brand-400 flex items-center gap-1.5 text-sm font-medium"
                >
                    <span class="bg-brand-500 inline-block h-2 w-2 animate-pulse rounded-full"
                    ></span>
                    Loading history...
                </span>
            {:else if !hasMoreHistory}
                <span class="text-muted-foreground text-sm">All history loaded</span>
            {:else}
                <span class="text-muted-foreground text-sm">Scroll up to load more</span>
            {/if}
        </div>
    </div>

    <!-- Virtualization Stats -->
    {#if debugInfo}
        <div class="border-border bg-card mb-4 rounded-xl border p-4 shadow-sm">
            <h3 class="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                Virtualization Stats
            </h3>
            <div class="grid grid-cols-3 gap-3 sm:grid-cols-6">
                <div class="bg-muted/50 rounded-lg p-2.5">
                    <div class="text-muted-foreground text-xs">Total</div>
                    <div class="text-foreground font-mono text-lg font-semibold">
                        {debugInfo.totalMessages}
                    </div>
                </div>
                <div class="bg-brand-500/10 rounded-lg p-2.5">
                    <div class="text-brand-500 text-xs">In DOM</div>
                    <div class="text-brand-600 dark:text-brand-400 font-mono text-lg font-semibold">
                        {debugInfo.renderedCount}
                    </div>
                </div>
                <div class="bg-muted/50 rounded-lg p-2.5">
                    <div class="text-muted-foreground text-xs">Measured</div>
                    <div class="text-foreground font-mono text-lg font-semibold">
                        {debugInfo.measuredCount}
                    </div>
                </div>
                <div class="bg-muted/50 rounded-lg p-2.5">
                    <div class="text-muted-foreground text-xs">Range</div>
                    <div class="text-foreground font-mono text-sm font-semibold">
                        {debugInfo.startIndex}–{debugInfo.endIndex}
                    </div>
                </div>
                <div class="bg-muted/50 rounded-lg p-2.5">
                    <div class="text-muted-foreground text-xs">Height</div>
                    <div class="text-foreground font-mono text-sm font-semibold">
                        {Math.round(debugInfo.totalHeight)}px
                    </div>
                </div>
                <div class="bg-muted/50 rounded-lg p-2.5">
                    <div class="text-muted-foreground text-xs">Scroll</div>
                    <div class="text-foreground font-mono text-sm font-semibold">
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
            class="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors"
        >
            Scroll to bottom
        </button>
        <button
            onclick={loadOlderMessages}
            disabled={isLoadingHistory || !hasMoreHistory}
            class="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
        >
            Load history manually
        </button>
    </div>

    <!-- Chat viewport -->
    <div class="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
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
                    class="border-border border-b px-5 py-3 {message.role === 'user'
                        ? 'bg-brand-500/5'
                        : ''}"
                >
                    <div class="mb-1 flex items-center gap-2">
                        <span
                            class="text-xs font-semibold {message.role === 'user'
                                ? 'text-brand-600 dark:text-brand-400'
                                : 'text-muted-foreground'}"
                        >
                            {message.role === 'user' ? 'You' : 'Assistant'}
                        </span>
                        <span class="text-muted-foreground text-xs">
                            {formatTime(message.timestamp)}
                        </span>
                        <span class="text-muted-foreground/50 font-mono text-xs">
                            #{message.id}
                        </span>
                    </div>
                    <div class="text-foreground text-sm leading-relaxed">
                        {message.content}
                    </div>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
