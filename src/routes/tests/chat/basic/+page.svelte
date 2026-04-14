<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        content: string
    }

    let messages: Message[] = $state([
        { id: '1', role: 'assistant', content: 'Hello! How can I help you today?' },
        { id: '2', role: 'user', content: 'Can you explain virtual scrolling?' },
        {
            id: '3',
            role: 'assistant',
            content:
                'Virtual scrolling renders only visible items in the viewport. Instead of creating DOM nodes for every item, you calculate which items are visible and render only those plus a buffer.'
        }
    ])

    let nextId = $state(4)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let chat: ReturnType<typeof SvelteVirtualChat> | undefined = $state()

    function addUserMessage() {
        messages.push({
            id: String(nextId++),
            role: 'user',
            content: `User message #${nextId - 1}`
        })
    }

    function addAssistantMessage() {
        messages.push({
            id: String(nextId++),
            role: 'assistant',
            content: `Assistant response #${nextId - 1}. This is a longer message to demonstrate variable height rendering in the virtual chat viewport.`
        })
    }
</script>

<div class="p-4">
    <h1 class="mb-4 text-lg font-semibold">Test: Basic Chat</h1>

    <div class="mb-3 flex gap-2">
        <button
            onclick={addUserMessage}
            data-testid="add-user"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            Add user message
        </button>
        <button
            onclick={addAssistantMessage}
            data-testid="add-assistant"
            class="rounded bg-green-500 px-3 py-1 text-sm text-white"
        >
            Add assistant message
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
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
