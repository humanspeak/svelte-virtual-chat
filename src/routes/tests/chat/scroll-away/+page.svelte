<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'

    type Message = { id: string; content: string }

    let messages: Message[] = $state(
        Array.from({ length: 50 }, (_, i) => ({
            id: String(i + 1),
            content: `Message #${i + 1} — scroll up and new messages should not snap you back to the bottom.`
        }))
    )

    let nextId = $state(51)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let newMessageCount = $state(0)
    let chat: ReturnType<typeof SvelteVirtualChat> | undefined = $state()

    function appendMessage() {
        messages.push({
            id: String(nextId++),
            content: `New message #${nextId - 1} (added while scrolled away)`
        })
        newMessageCount++
    }

    let intervalId: ReturnType<typeof setInterval> | null = null
    function startAutoAppend() {
        if (intervalId) return
        intervalId = setInterval(appendMessage, 500)
    }
    function stopAutoAppend() {
        if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
        }
    }
</script>

<div class="p-4">
    <h1 class="mb-4 text-lg font-semibold">Test: Append While Scrolled Away</h1>
    <p class="mb-3 text-sm text-gray-500">
        Scroll up first, then append messages. The viewport should NOT jump to bottom.
    </p>

    <div class="mb-3 flex gap-2">
        <button
            onclick={appendMessage}
            data-testid="append-one"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            Append 1
        </button>
        <button
            onclick={startAutoAppend}
            data-testid="auto-start"
            class="rounded bg-green-500 px-3 py-1 text-sm text-white"
        >
            Auto append
        </button>
        <button
            onclick={stopAutoAppend}
            data-testid="auto-stop"
            class="rounded bg-red-500 px-3 py-1 text-sm text-white"
        >
            Stop
        </button>
        <button
            onclick={() => chat?.scrollToBottom({ smooth: true })}
            data-testid="scroll-bottom"
            class="rounded bg-gray-500 px-3 py-1 text-sm text-white"
        >
            Return to bottom
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            measured={debugInfo.measuredCount}
            range={debugInfo.startIndex}-{debugInfo.endIndex}
            new={newMessageCount}
            following={debugInfo.isFollowingBottom}
            scroll={Math.round(debugInfo.scrollTop)}px viewport={Math.round(
                debugInfo.viewportHeight
            )}px
        </div>
    {/if}

    <div class="h-[400px] rounded-lg border-2 border-gray-300" data-testid="chat-wrapper">
        <SvelteVirtualChat
            bind:this={chat}
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={50}
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
