<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'

    type Message = { id: string; content: string }

    let oldestId = $state(100)
    let messages: Message[] = $state(
        Array.from({ length: 20 }, (_, i) => ({
            id: String(oldestId + i),
            content: `Message #${oldestId + i}`
        }))
    )

    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let isLoading = $state(false)
    let prependCount = $state(0)

    async function loadHistory() {
        if (isLoading) return
        isLoading = true

        await new Promise((r) => setTimeout(r, 300))

        const batch = 20
        const newMessages: Message[] = []
        for (let i = batch; i > 0; i--) {
            const id = oldestId - i
            if (id < 1) continue
            newMessages.push({ id: String(id), content: `Historical message #${id}` })
        }

        if (newMessages.length > 0) {
            messages = [...newMessages, ...messages]
            oldestId = Math.max(1, oldestId - batch)
            prependCount += newMessages.length
        }

        isLoading = false
    }
</script>

<div class="p-4">
    <h1 class="mb-4 text-lg font-semibold">Test: Prepend History</h1>
    <p class="mb-3 text-sm text-gray-500">
        Scroll up and load older messages. Your scroll position should be preserved.
    </p>

    <div class="mb-3 flex gap-2">
        <button
            onclick={loadHistory}
            data-testid="load-history"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
            disabled={isLoading || oldestId <= 1}
        >
            Load 20 older
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            measured={debugInfo.measuredCount}
            range={debugInfo.startIndex}-{debugInfo.endIndex}
            prepended={prependCount}
            oldest={oldestId}
            following={debugInfo.isFollowingBottom}
            viewport={Math.round(debugInfo.viewportHeight)}px
        </div>
    {/if}

    <div class="h-[400px] rounded-lg border-2 border-gray-300" data-testid="chat-wrapper">
        <SvelteVirtualChat
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={40}
            onNeedHistory={loadHistory}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (debugInfo = info)}
            containerClass="h-full"
            viewportClass="h-full"
            testId="chat"
        >
            {#snippet renderMessage(message: Message, index: number)}
                <div class="border-b border-gray-200 px-4 py-2" data-testid="msg-{message.id}">
                    <div class="flex items-center gap-2">
                        <span
                            class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500"
                            >[{index}]</span
                        >
                        <span class="font-mono text-xs text-gray-400">id={message.id}</span>
                    </div>
                    <div class="mt-0.5 text-sm">{message.content}</div>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
