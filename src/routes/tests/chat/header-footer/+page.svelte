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
    let showHeader = $state(true)
    let showFooter = $state(true)
    let showTypingIndicator = $state(false)
    let needHistoryFired = $state(false)

    const addMessage = () => {
        const role = messages.length % 2 === 0 ? 'user' : 'assistant'
        messages.push({
            id: String(nextId++),
            role,
            content: `${role === 'user' ? 'User' : 'Assistant'} message #${nextId - 1}`
        })
    }

    const addManyMessages = () => {
        for (let i = 0; i < 50; i++) {
            const role = (messages.length + i) % 2 === 0 ? 'user' : 'assistant'
            messages.push({
                id: String(nextId++),
                role,
                content: `${role === 'user' ? 'User' : 'Assistant'} message #${nextId - 1}. Extra text to add height variation for testing virtual scroll behavior.`
            })
        }
    }
</script>

<div class="p-4">
    <h1 class="mb-4 text-lg font-semibold">Test: Header & Footer</h1>

    <div class="mb-3 flex flex-wrap gap-2">
        <button
            onclick={addMessage}
            data-testid="add-message"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            Add message
        </button>
        <button
            onclick={addManyMessages}
            data-testid="add-many"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            Add 50 messages
        </button>
        <button
            onclick={() => (showHeader = !showHeader)}
            data-testid="toggle-header"
            class="rounded bg-purple-500 px-3 py-1 text-sm text-white"
        >
            {showHeader ? 'Hide' : 'Show'} header
        </button>
        <button
            onclick={() => (showFooter = !showFooter)}
            data-testid="toggle-footer"
            class="rounded bg-purple-500 px-3 py-1 text-sm text-white"
        >
            {showFooter ? 'Hide' : 'Show'} footer
        </button>
        <button
            onclick={() => (showTypingIndicator = !showTypingIndicator)}
            data-testid="toggle-typing"
            class="rounded bg-orange-500 px-3 py-1 text-sm text-white"
        >
            {showTypingIndicator ? 'Hide' : 'Show'} typing indicator
        </button>
        <button
            onclick={() => chat?.scrollToMessage('2')}
            data-testid="scroll-to-msg-2"
            class="rounded bg-gray-500 px-3 py-1 text-sm text-white"
        >
            Scroll to msg 2
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            following={debugInfo.isFollowingBottom}
        </div>
    {/if}

    <div data-testid="need-history-fired" class="mb-3 font-mono text-xs">
        needHistory={needHistoryFired}
    </div>

    <div class="h-[400px] rounded-lg border-2 border-gray-300" data-testid="chat-wrapper">
        <SvelteVirtualChat
            bind:this={chat}
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={60}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (debugInfo = info)}
            onNeedHistory={() => {
                needHistoryFired = true
            }}
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
            {#snippet header()}
                {#if showHeader}
                    <div
                        class="border-b border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm text-blue-600"
                        data-testid="header-content"
                    >
                        Load older messages
                    </div>
                {/if}
            {/snippet}
            {#snippet footer()}
                {#if showFooter}
                    <div data-testid="footer-content">
                        {#if showTypingIndicator}
                            <div
                                class="border-t border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-600"
                                data-testid="typing-indicator"
                            >
                                Assistant is typing...
                            </div>
                        {/if}
                        <div
                            class="border-t border-gray-200 bg-gray-50 px-4 py-1 text-center text-xs text-gray-400"
                        >
                            End of conversation
                        </div>
                    </div>
                {/if}
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
