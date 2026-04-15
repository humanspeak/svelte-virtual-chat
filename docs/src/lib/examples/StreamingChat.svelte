<script lang="ts">
    import SvelteVirtualChat, {
        type SvelteVirtualChatDebugInfo
    } from '@humanspeak/svelte-virtual-chat'
    import SvelteMarkdown from '@humanspeak/svelte-markdown'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        content: string
        timestamp: number
        isStreaming?: boolean
    }

    const LLM_RESPONSE = `## Understanding Reactive Systems

Reactive programming is a **declarative paradigm** concerned with _data streams_ and the propagation of change. Let's explore the key concepts.

### Core Principles

There are three fundamental ideas:

1. **Observables** — represent a stream of data over time
2. **Operators** — transform, filter, and combine streams
3. **Subscribers** — consume the final output

> "The best way to predict the future is to invent it." — Alan Kay

### A Simple Example

Here's a basic reactive counter in JavaScript:

\`\`\`javascript
import { writable } from 'svelte/store'

const count = writable(0)

count.subscribe(value => {
    console.log(\`Count is now: \${value}\`)
})

count.update(n => n + 1)
\`\`\`

### Comparison Table

| Feature | Svelte | React | Vue |
|---------|--------|-------|-----|
| Reactivity | Compile-time | Runtime | Runtime |
| Bundle Size | Small | Medium | Medium |
| Performance | Excellent | Good | Good |

### Advanced Patterns

- User types in a search box
- Each keystroke triggers an API call
- Results should be **debounced** and *deduplicated*
- Errors must be handled gracefully

---

*Thanks for reading!*`

    const PROMPTS = [
        'Explain reactive programming to me',
        'How does virtual scrolling work?',
        'What are the benefits of Svelte 5 runes?',
        'Compare different state management approaches'
    ]

    let messages: Message[] = $state([
        {
            id: '1',
            role: 'assistant',
            content:
                'Welcome! Click "Start Streaming" to see a simulated LLM response stream token-by-token with markdown rendering.',
            timestamp: Date.now() - 10000
        }
    ])

    let nextId = $state(2)
    let isStreaming = $state(false)
    let tokensPerSecond = $state(40)
    let tokenCount = $state(0)
    let totalTokens = $state(0)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let chat: ReturnType<typeof SvelteVirtualChat> | undefined = $state()
    let sessionId = $state(0)
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    function splitIntoWords(text: string): string[] {
        const result: string[] = []
        const regex = /\S+\s*/g
        let match
        while ((match = regex.exec(text)) !== null) {
            result.push(match[0])
        }
        return result
    }

    function startStreaming() {
        if (isStreaming) return

        // Add user message
        const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]
        messages.push({
            id: String(nextId++),
            role: 'user',
            content: prompt,
            timestamp: Date.now()
        })

        // Add empty assistant message that will be streamed into
        const assistantId = String(nextId++)
        messages.push({
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true
        })

        const words = splitIntoWords(LLM_RESPONSE)
        totalTokens = words.length
        tokenCount = 0
        sessionId++
        isStreaming = true

        const currentSession = sessionId
        let wordIndex = 0

        function streamNext() {
            if (currentSession !== sessionId || wordIndex >= words.length) {
                // Done streaming
                const msg = messages.find((m) => m.id === assistantId)
                if (msg) msg.isStreaming = false
                isStreaming = false
                return
            }

            const msg = messages.find((m) => m.id === assistantId)
            if (msg) {
                msg.content += words[wordIndex]
                wordIndex++
                tokenCount = wordIndex
            }

            const baseDelay = 1000 / tokensPerSecond
            const jitter = baseDelay * 0.3 * (Math.random() * 2 - 1)
            timeoutId = setTimeout(streamNext, Math.max(5, baseDelay + jitter))
        }

        streamNext()
    }

    function stopStreaming() {
        sessionId++
        isStreaming = false
        if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
        }

        // Mark any streaming message as complete
        for (const msg of messages) {
            if (msg.isStreaming) msg.isStreaming = false
        }
    }

    function reset() {
        stopStreaming()
        messages = [
            {
                id: '1',
                role: 'assistant',
                content:
                    'Welcome! Click "Start Streaming" to see a simulated LLM response stream token-by-token with markdown rendering.',
                timestamp: Date.now()
            }
        ]
        nextId = 2
        tokenCount = 0
        totalTokens = 0
    }

    const progress = $derived(totalTokens > 0 ? Math.round((tokenCount / totalTokens) * 100) : 0)

    function formatTime(ts: number): string {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
</script>

<div class="mx-auto w-full max-w-5xl">
    <!-- Metrics bar -->
    <div class="border-border bg-card mb-4 rounded-xl border p-4 shadow-sm">
        <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-6">
                <div>
                    <div class="text-muted-foreground text-xs font-medium uppercase">Progress</div>
                    <div class="text-foreground font-mono text-lg font-semibold">{progress}%</div>
                </div>
                <div>
                    <div class="text-muted-foreground text-xs font-medium uppercase">Tokens</div>
                    <div class="text-foreground font-mono text-lg font-semibold">
                        {tokenCount} / {totalTokens}
                    </div>
                </div>
                <div>
                    <div class="text-muted-foreground text-xs font-medium uppercase">Speed</div>
                    <div class="text-foreground font-mono text-lg font-semibold">
                        {tokensPerSecond} tok/s
                    </div>
                </div>
            </div>

            {#if isStreaming}
                <span
                    class="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400"
                >
                    <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500"
                    ></span>
                    Streaming...
                </span>
            {/if}
        </div>

        <div class="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full">
            <div
                class="bg-brand-500 h-full rounded-full transition-all duration-150"
                style="width: {progress}%"
            ></div>
        </div>
    </div>

    <!-- Controls -->
    <div class="mb-4 flex items-center gap-3">
        <button
            onclick={startStreaming}
            disabled={isStreaming}
            class="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50"
        >
            Start Streaming
        </button>
        <button
            onclick={stopStreaming}
            disabled={!isStreaming}
            class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
        >
            Stop
        </button>
        <button
            onclick={reset}
            class="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors"
        >
            Reset
        </button>

        <div class="ml-auto flex items-center gap-2">
            <label class="text-muted-foreground text-sm">
                Speed:
                <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    bind:value={tokensPerSecond}
                    disabled={isStreaming}
                    class="accent-brand-500 w-32"
                />
            </label>
        </div>
    </div>

    <!-- How it works -->
    <div
        class="border-brand-500/20 from-brand-500/5 to-brand-600/5 mb-4 rounded-xl border bg-gradient-to-r p-5"
    >
        <h3 class="text-foreground mb-2 text-sm font-semibold">How LLM Streaming Works</h3>
        <ul class="text-muted-foreground space-y-1.5 text-sm">
            <li class="flex items-start gap-2">
                <span class="text-brand-500 mt-0.5 shrink-0">&#9889;</span>
                <span>
                    LLMs stream tokens via SSE. As each token arrives, the message content grows and
                    ResizeObserver detects the height change automatically.
                </span>
            </li>
            <li class="flex items-start gap-2">
                <span class="text-brand-500 mt-0.5 shrink-0">&#9889;</span>
                <span>
                    Height corrections are batched per animation frame — not per token. The viewport
                    stays pinned to bottom with zero jitter.
                </span>
            </li>
            <li class="flex items-start gap-2">
                <span class="text-brand-500 mt-0.5 shrink-0">&#9889;</span>
                <span>
                    Markdown rendering powered by
                    <a
                        href="https://markdown.svelte.page"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-brand-500 hover:text-brand-400 underline"
                    >
                        @humanspeak/svelte-markdown
                    </a>
                    with streaming mode (~1.6ms avg per update). Code blocks, tables, lists — all rendered
                    live without scroll disruption.
                </span>
            </li>
            <li class="flex items-start gap-2">
                <span class="mt-0.5 shrink-0 text-amber-500">&#128161;</span>
                <span>
                    Track token costs across providers with
                    <a
                        href="https://modelpricing.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-brand-500 hover:text-brand-400 underline"
                    >
                        ModelPricing.ai
                    </a>. Need a general-purpose virtual list? Try
                    <a
                        href="https://virtuallist.svelte.page"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-brand-500 hover:text-brand-400 underline"
                    >
                        @humanspeak/svelte-virtual-list
                    </a>.
                </span>
            </li>
        </ul>
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
                        Bottom
                    </div>
                    <div
                        class="font-mono text-sm font-semibold {debugInfo.isFollowingBottom
                            ? 'text-green-700 dark:text-green-300'
                            : 'text-amber-700 dark:text-amber-300'}"
                    >
                        {debugInfo.isFollowingBottom ? 'Following' : 'Scrolled'}
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
            estimatedMessageHeight={100}
            followBottomThresholdPx={64}
            overscan={4}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (debugInfo = info)}
            containerClass="h-[500px]"
            viewportClass="h-full"
            testId="streaming-chat"
        >
            {#snippet renderMessage(message: Message)}
                <div
                    class="border-border border-b px-5 py-4 {message.role === 'user'
                        ? 'bg-brand-500/5'
                        : ''}"
                >
                    <div class="mb-1.5 flex items-center gap-2">
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
                        {#if message.isStreaming}
                            <span
                                class="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-700 dark:text-green-300"
                            >
                                streaming
                            </span>
                        {/if}
                    </div>
                    {#if message.role === 'assistant' && message.content}
                        <div class="prose prose-sm dark:prose-invert max-w-none">
                            <SvelteMarkdown
                                source={message.content}
                                streaming={message.isStreaming ?? false}
                            />
                        </div>
                    {:else}
                        <div class="text-foreground text-sm leading-relaxed">
                            {message.content}
                        </div>
                    {/if}
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
