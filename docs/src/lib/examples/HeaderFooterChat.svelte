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
        "That's a great question! The header and footer snippets let you render persistent content above and below messages without injecting fake entries into the messages array.",
        "The key insight is that header and footer live outside the virtual scroll machinery — they're always in the DOM, never virtualized away.",
        'Footer height changes are tracked via ResizeObserver. When a typing indicator appears, the viewport automatically snaps to bottom if you were following.',
        'Headers are perfect for "load more" buttons, date separators, or channel info banners. They scroll with the content naturally.',
        'The bottom-gravity layout still works — with few messages, everything pushes to the bottom including the header.',
        'Both snippets are completely optional. If you omit them, the component behaves exactly as before.'
    ]

    let messages: Message[] = $state([
        {
            id: '1',
            role: 'assistant',
            content:
                'Welcome! This demo shows the header and footer snippet props. Try toggling the typing indicator and watch the viewport stay pinned.',
            timestamp: Date.now() - 60000
        }
    ])

    let inputText = $state('')
    let nextId = $state(2)
    let isFollowing = $state(true)
    let showTyping = $state(false)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let chat: ReturnType<typeof SvelteVirtualChat> | undefined = $state()

    const sendMessage = () => {
        if (!inputText.trim()) return

        messages.push({
            id: String(nextId++),
            role: 'user',
            content: inputText.trim(),
            timestamp: Date.now()
        })

        inputText = ''
        showTyping = true

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
                showTyping = false
            },
            800 + Math.random() * 1200
        )
    }

    const addBulkMessages = () => {
        for (let i = 0; i < 50; i++) {
            messages.push({
                id: String(nextId++),
                role: i % 2 === 0 ? 'user' : 'assistant',
                content:
                    i % 2 === 0
                        ? `User message #${nextId - 1}. Scroll up to see the header above all messages.`
                        : `Assistant response #${nextId - 1}. The footer stays below the last message at all times.`,
                timestamp: Date.now() + i
            })
        }
    }

    const formatTime = (ts: number): string => {
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
            Add 50 messages
        </button>
        <button
            onclick={() => (showTyping = !showTyping)}
            class="rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors {showTyping
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'border-border bg-card text-foreground hover:bg-muted border'}"
        >
            {showTyping ? 'Typing...' : 'Toggle typing'}
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
            testId="header-footer-chat"
        >
            {#snippet header()}
                <div
                    class="border-border bg-muted/30 flex items-center gap-2 border-b px-5 py-3 text-sm"
                >
                    <span
                        class="bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-md px-2 py-0.5 text-xs font-semibold"
                    >
                        Header
                    </span>
                    <span class="text-muted-foreground">
                        Beginning of conversation &mdash; {messages.length} message{messages.length !==
                        1
                            ? 's'
                            : ''}
                    </span>
                </div>
            {/snippet}
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
            {#snippet footer()}
                {#if showTyping}
                    <div
                        class="border-border bg-muted/20 flex items-center gap-3 border-t px-5 py-3"
                    >
                        <div class="flex gap-1">
                            <span
                                class="bg-muted-foreground/40 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:0ms]"
                            ></span>
                            <span
                                class="bg-muted-foreground/40 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:150ms]"
                            ></span>
                            <span
                                class="bg-muted-foreground/40 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:300ms]"
                            ></span>
                        </div>
                        <span class="text-muted-foreground text-sm">Assistant is typing...</span>
                    </div>
                {/if}
                <div class="border-border bg-muted/10 border-t px-5 py-2 text-center text-xs">
                    <span class="text-muted-foreground">
                        Powered by
                        <span class="text-brand-500 font-medium">SvelteVirtualChat</span>
                    </span>
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
