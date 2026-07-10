<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        content: string
    }
    type ChatApi = {
        scrollToBottom: () => void
    }

    const initialMessages: Message[] = Array.from({ length: 60 }, (_, i) => {
        const id = String(i + 1)
        return {
            id,
            role: i % 2 === 0 ? 'assistant' : 'user',
            content: `Message ${id} with an interactive control.`
        }
    })

    let messages: Message[] = $state(initialMessages)

    let nextId = $state(61)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let chat: ChatApi | undefined = $state()

    function addMessage() {
        const id = String(nextId++)
        messages.push({
            id,
            role: 'assistant',
            content: `Message ${id} with an interactive control.`
        })
    }
</script>

<div class="p-4">
    <h1 class="mb-4 text-lg font-semibold">Test: Focus Controls</h1>

    <div class="mb-3 flex gap-2">
        <button
            onclick={addMessage}
            data-testid="add-message"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            Add message
        </button>
        <button
            onclick={() => chat?.scrollToBottom()}
            data-testid="scroll-bottom"
            class="rounded bg-gray-500 px-3 py-1 text-sm text-white"
        >
            Scroll to bottom
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            measured={debugInfo.measuredCount}
            range={debugInfo.startIndex}-{debugInfo.endIndex}
            following={debugInfo.isFollowingBottom}
            viewport={Math.round(debugInfo.viewportHeight)}px
        </div>
    {/if}

    <div class="h-[400px] rounded-lg border-2 border-gray-300" data-testid="chat-wrapper">
        <SvelteVirtualChat
            bind:this={chat}
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
                    </div>
                    <div class="mt-1 text-sm">{message.content}</div>
                    <div class="mt-1 flex items-center gap-2">
                        <button
                            data-testid="msg-btn-{message.id}"
                            class="rounded bg-indigo-500 px-2 py-0.5 text-xs text-white"
                        >
                            Action {message.id}
                        </button>
                        {#if Number(message.id) % 2 === 0}
                            <input
                                data-testid="msg-input-{message.id}"
                                class="rounded border border-gray-300 px-2 py-0.5 text-xs"
                                placeholder="Reply {message.id}"
                            />
                        {/if}
                    </div>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
