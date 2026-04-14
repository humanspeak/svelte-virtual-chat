<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'

    type Message = { id: string; content: string }

    let count = $state(0)
    let messages: Message[] = $state([])
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)

    function load(n: number) {
        const batch: Message[] = []
        for (let i = 0; i < n; i++) {
            count++
            batch.push({
                id: String(count),
                content: `Message #${count}. This message has enough content to demonstrate that the virtual chat viewport handles large datasets efficiently by only rendering visible items.`
            })
        }
        messages = [...messages, ...batch]
    }

    function clear() {
        messages = []
        count = 0
    }
</script>

<div class="p-4">
    <h1 class="mb-4 text-lg font-semibold">Test: Bulk Messages</h1>
    <p class="mb-3 text-sm text-gray-500">
        Load large batches and watch "dom" stay constant while "total" grows.
    </p>

    <div class="mb-3 flex gap-2">
        <button
            onclick={() => load(100)}
            data-testid="load-100"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            100
        </button>
        <button
            onclick={() => load(1000)}
            data-testid="load-1000"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            1,000
        </button>
        <button
            onclick={() => load(5000)}
            data-testid="load-5000"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            5,000
        </button>
        <button
            onclick={() => load(10000)}
            data-testid="load-10000"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            10,000
        </button>
        <button
            onclick={clear}
            data-testid="clear"
            class="rounded bg-red-500 px-3 py-1 text-sm text-white"
        >
            Clear
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            measured={debugInfo.measuredCount}
            range={debugInfo.startIndex}-{debugInfo.endIndex}
            height={Math.round(debugInfo.totalHeight)}px following={debugInfo.isFollowingBottom}
            viewport={Math.round(debugInfo.viewportHeight)}px
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
