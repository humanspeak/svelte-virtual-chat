<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        content: string
        isStreaming?: boolean
    }

    const STREAM_TEXT =
        'Virtual scrolling renders only visible items. Instead of creating DOM nodes for every message in a conversation, the component calculates which messages are currently visible in the viewport and renders only those, plus a small buffer above and below. This dramatically reduces memory usage and improves performance for long conversations. The key challenge is maintaining stable scroll position as message heights change during streaming — each new token can cause the message to grow, and the viewport needs to compensate without jittering.'

    let messages: Message[] = $state([
        { id: '1', role: 'user', content: 'Tell me about virtual scrolling.' }
    ])

    let nextId = $state(2)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let isStreaming = $state(false)
    let sessionId = $state(0)
    let tokenCount = $state(0)

    function startStream() {
        if (isStreaming) return
        sessionId++
        const currentSession = sessionId

        const msgId = String(nextId++)
        messages.push({ id: msgId, role: 'assistant', content: '', isStreaming: true })
        isStreaming = true
        tokenCount = 0

        const words = STREAM_TEXT.split(/(\s+)/)
        let i = 0

        function tick() {
            if (currentSession !== sessionId || i >= words.length) {
                const msg = messages.find((m) => m.id === msgId)
                if (msg) msg.isStreaming = false
                isStreaming = false
                return
            }
            const msg = messages.find((m) => m.id === msgId)
            if (msg) {
                msg.content += words[i]
                i++
                tokenCount = i
            }
            setTimeout(tick, 20 + Math.random() * 40)
        }
        tick()
    }

    function stopStream() {
        sessionId++
        isStreaming = false
        for (const msg of messages) {
            if (msg.isStreaming) msg.isStreaming = false
        }
    }

    function reset() {
        stopStream()
        messages = [{ id: '1', role: 'user', content: 'Tell me about virtual scrolling.' }]
        nextId = 2
        tokenCount = 0
    }
</script>

<div class="p-4">
    <h1 class="mb-4 text-lg font-semibold">Test: Streaming Growth</h1>
    <p class="mb-3 text-sm text-gray-500">
        Message grows token by token. Viewport should stay pinned to bottom without jitter.
    </p>

    <div class="mb-3 flex gap-2">
        <button
            onclick={startStream}
            data-testid="start-stream"
            class="rounded bg-green-500 px-3 py-1 text-sm text-white"
            disabled={isStreaming}
        >
            Start stream
        </button>
        <button
            onclick={stopStream}
            data-testid="stop-stream"
            class="rounded bg-red-500 px-3 py-1 text-sm text-white"
            disabled={!isStreaming}
        >
            Stop
        </button>
        <button
            onclick={reset}
            data-testid="reset"
            class="rounded bg-gray-500 px-3 py-1 text-sm text-white"
        >
            Reset
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            measured={debugInfo.measuredCount}
            range={debugInfo.startIndex}-{debugInfo.endIndex}
            tokens={tokenCount}
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
            estimatedMessageHeight={60}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (debugInfo = info)}
            containerClass="h-full"
            viewportClass="h-full"
            testId="chat"
        >
            {#snippet renderMessage(message: Message, index: number)}
                <div class="border-b border-gray-200 px-4 py-3" data-testid="msg-{message.id}">
                    <div class="flex items-center gap-2">
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
                        {#if message.isStreaming}
                            <span class="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700"
                                >streaming</span
                            >
                        {/if}
                    </div>
                    <div class="mt-1 text-sm">
                        {message.content}{#if message.isStreaming}<span class="animate-pulse"
                                >|</span
                            >{/if}
                    </div>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
