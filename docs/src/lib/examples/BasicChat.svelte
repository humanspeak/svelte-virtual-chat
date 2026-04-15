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

    const SAMPLE_RESPONSES = [
        "That's a great question! Virtual scrolling works by only rendering the items that are currently visible in the viewport, plus a small buffer for smooth scrolling.",
        "I'd be happy to help with that. The key insight is that you don't need DOM nodes for items the user can't see.",
        "Here's how it works: as the user scrolls, items entering the viewport are rendered while items leaving are removed. Height caching ensures smooth positioning.",
        'The follow-bottom behavior is crucial for chat UIs. When the user is at the bottom, new messages should automatically scroll into view.',
        'One of the trickiest parts is handling streaming content. As message heights change during token streaming, the viewport needs to stay stable.',
        "History loading is another interesting challenge. When older messages are prepended at the top, we need to preserve the user's scroll position.",
        'For optimal performance, measurements are batched per animation frame rather than reacting to every individual height change.',
        'The component uses ResizeObserver to track message heights, which is much more reliable than calculating heights from content alone.'
    ]

    let messages: Message[] = $state([
        {
            id: '1',
            role: 'assistant',
            content:
                'Welcome to the SvelteVirtualChat demo! Try sending messages, scrolling up, and watching the follow-bottom behavior.',
            timestamp: Date.now() - 60000
        }
    ])

    let inputText = $state('')
    let nextId = $state(2)
    let isFollowing = $state(true)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let chat: ReturnType<typeof SvelteVirtualChat> | undefined = $state()

    function sendMessage() {
        if (!inputText.trim()) return

        messages.push({
            id: String(nextId++),
            role: 'user',
            content: inputText.trim(),
            timestamp: Date.now()
        })

        inputText = ''

        setTimeout(
            () => {
                const response =
                    SAMPLE_RESPONSES[Math.floor(Math.random() * SAMPLE_RESPONSES.length)]
                messages.push({
                    id: String(nextId++),
                    role: 'assistant',
                    content: response,
                    timestamp: Date.now()
                })
            },
            300 + Math.random() * 700
        )
    }

    function addBulkMessages() {
        const count = 100
        for (let i = 0; i < count; i++) {
            messages.push({
                id: String(nextId++),
                role: i % 2 === 0 ? 'user' : 'assistant',
                content:
                    i % 2 === 0
                        ? `User message #${nextId - 1}. This demonstrates that the virtual chat viewport efficiently handles large message counts.`
                        : `Assistant response #${nextId - 1}. Only the visible messages are rendered to the DOM, keeping performance smooth even with hundreds of messages.`,
                timestamp: Date.now() + i
            })
        }
    }

    function formatTime(ts: number): string {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
</script>

<div class="mx-auto w-full max-w-4xl">
    <!-- Controls -->
    <div class="mb-4 flex items-center gap-3">
        <button
            onclick={addBulkMessages}
            class="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors"
        >
            Add 100 messages
        </button>
        <button
            onclick={() => chat?.scrollToBottom({ smooth: true })}
            class="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors"
        >
            Scroll to bottom
        </button>
        <div class="text-muted-foreground ml-auto flex items-center gap-2 text-sm">
            <span class="font-mono">{messages.length}</span> messages
            <span class="text-border mx-1">|</span>
            {#if isFollowing}
                <span class="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>
                    Following
                </span>
            {:else}
                <span class="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <span class="inline-block h-2 w-2 rounded-full bg-amber-500"></span>
                    Scrolled away
                </span>
            {/if}
        </div>
    </div>

    <!-- Virtualization Stats -->
    {#if debugInfo}
        <div class="border-border bg-card mb-4 rounded-xl border p-4 shadow-sm">
            <h3 class="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                Virtualization Stats
            </h3>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
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
                    <div class="text-muted-foreground text-xs">Visible Range</div>
                    <div class="text-foreground font-mono text-sm font-semibold">
                        {debugInfo.startIndex}–{debugInfo.endIndex}
                    </div>
                </div>
                <div class="bg-muted/50 rounded-lg p-2.5">
                    <div class="text-muted-foreground text-xs">Content Height</div>
                    <div class="text-foreground font-mono text-sm font-semibold">
                        {Math.round(debugInfo.totalHeight)}px
                    </div>
                </div>
                <div
                    class="rounded-lg p-2.5 {debugInfo.isFollowingBottom
                        ? 'bg-green-500/10'
                        : 'bg-amber-500/10'}"
                >
                    <div
                        class="text-xs {debugInfo.isFollowingBottom
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-amber-600 dark:text-amber-400'}"
                    >
                        Scroll
                    </div>
                    <div
                        class="font-mono text-sm font-semibold {debugInfo.isFollowingBottom
                            ? 'text-green-700 dark:text-green-300'
                            : 'text-amber-700 dark:text-amber-300'}"
                    >
                        {debugInfo.isFollowingBottom
                            ? 'Following'
                            : `${Math.round(debugInfo.scrollTop)}px`}
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <!-- Chat viewport -->
    <div class="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
        <SvelteVirtualChat
            bind:this={chat}
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={80}
            followBottomThresholdPx={48}
            overscan={6}
            onFollowBottomChange={(following: boolean) => (isFollowing = following)}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (debugInfo = info)}
            containerClass="h-[500px]"
            viewportClass="h-full"
            testId="basic-chat"
        >
            {#snippet renderMessage(message: Message)}
                <div
                    class="border-border border-b px-5 py-4 {message.role === 'user'
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
                    </div>
                    <div class="text-foreground text-sm leading-relaxed">
                        {message.content}
                    </div>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>

    <!-- Input -->
    <form
        onsubmit={(e) => {
            e.preventDefault()
            sendMessage()
        }}
        class="mt-3 flex gap-2"
    >
        <input
            bind:value={inputText}
            placeholder="Type a message..."
            class="border-border bg-card text-foreground focus:border-brand-500 focus:ring-brand-500 flex-1 rounded-lg border px-4 py-2.5 text-sm shadow-sm focus:ring-1 focus:outline-none"
        />
        <button
            type="submit"
            class="bg-brand-600 hover:bg-brand-700 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors"
        >
            Send
        </button>
    </form>
</div>
