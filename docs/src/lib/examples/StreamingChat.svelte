<script lang="ts">
    import SvelteVirtualChat from '@humanspeak/svelte-virtual-chat'
    import type { SvelteVirtualChatDebugInfo } from '@humanspeak/svelte-virtual-chat'
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
    <div class="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-6">
                <div>
                    <div class="text-xs font-medium uppercase text-gray-400">Progress</div>
                    <div class="font-mono text-lg font-semibold text-gray-900">{progress}%</div>
                </div>
                <div>
                    <div class="text-xs font-medium uppercase text-gray-400">Tokens</div>
                    <div class="font-mono text-lg font-semibold text-gray-900">
                        {tokenCount} / {totalTokens}
                    </div>
                </div>
                <div>
                    <div class="text-xs font-medium uppercase text-gray-400">Speed</div>
                    <div class="font-mono text-lg font-semibold text-gray-900">
                        {tokensPerSecond} tok/s
                    </div>
                </div>
            </div>

            {#if isStreaming}
                <span class="flex items-center gap-1.5 text-sm font-medium text-green-600">
                    <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500"
                    ></span>
                    Streaming...
                </span>
            {/if}
        </div>

        <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
                class="h-full rounded-full bg-indigo-500 transition-all duration-150"
                style="width: {progress}%"
            ></div>
        </div>
    </div>

    <!-- Controls -->
    <div class="mb-4 flex items-center gap-3">
        <button
            onclick={startStreaming}
            disabled={isStreaming}
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
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
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
            Reset
        </button>

        <div class="ml-auto flex items-center gap-2">
            <label class="text-sm text-gray-500">
                Speed:
                <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    bind:value={tokensPerSecond}
                    disabled={isStreaming}
                    class="w-32 accent-indigo-600"
                />
            </label>
        </div>
    </div>

    <!-- Virtualization Stats -->
    {#if debugInfo}
        <div class="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Virtualization Stats
            </h3>
            <div class="grid grid-cols-3 gap-3 sm:grid-cols-6">
                <div class="rounded-lg bg-gray-50 p-2.5">
                    <div class="text-xs text-gray-400">Total</div>
                    <div class="font-mono text-lg font-semibold text-gray-900">
                        {debugInfo.totalMessages}
                    </div>
                </div>
                <div class="rounded-lg bg-indigo-50 p-2.5">
                    <div class="text-xs text-indigo-400">In DOM</div>
                    <div class="font-mono text-lg font-semibold text-indigo-700">
                        {debugInfo.renderedCount}
                    </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-2.5">
                    <div class="text-xs text-gray-400">Measured</div>
                    <div class="font-mono text-lg font-semibold text-gray-900">
                        {debugInfo.measuredCount}
                    </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-2.5">
                    <div class="text-xs text-gray-400">Range</div>
                    <div class="font-mono text-sm font-semibold text-gray-900">
                        {debugInfo.startIndex}–{debugInfo.endIndex}
                    </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-2.5">
                    <div class="text-xs text-gray-400">Height</div>
                    <div class="font-mono text-sm font-semibold text-gray-900">
                        {Math.round(debugInfo.totalHeight)}px
                    </div>
                </div>
                <div class="rounded-lg {debugInfo.isFollowingBottom ? 'bg-green-50' : 'bg-amber-50'} p-2.5">
                    <div class="text-xs {debugInfo.isFollowingBottom ? 'text-green-500' : 'text-amber-500'}">
                        Bottom
                    </div>
                    <div class="font-mono text-sm font-semibold {debugInfo.isFollowingBottom ? 'text-green-700' : 'text-amber-700'}">
                        {debugInfo.isFollowingBottom ? 'Following' : 'Scrolled'}
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <!-- Chat viewport -->
    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
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
                    class="border-b border-gray-100 px-5 py-4 {message.role === 'user'
                        ? 'bg-indigo-50/50'
                        : 'bg-white'}"
                >
                    <div class="mb-1.5 flex items-center gap-2">
                        <span
                            class="text-xs font-semibold {message.role === 'user'
                                ? 'text-indigo-600'
                                : 'text-gray-500'}"
                        >
                            {message.role === 'user' ? 'You' : 'Assistant'}
                        </span>
                        <span class="text-xs text-gray-400">
                            {formatTime(message.timestamp)}
                        </span>
                        {#if message.isStreaming}
                            <span
                                class="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                            >
                                streaming
                            </span>
                        {/if}
                    </div>
                    {#if message.role === 'assistant' && message.content}
                        <div class="prose prose-sm max-w-none text-gray-800">
                            <SvelteMarkdown
                                source={message.content}
                                streaming={message.isStreaming ?? false}
                            />
                        </div>
                    {:else}
                        <div class="text-sm leading-relaxed text-gray-800">
                            {message.content}
                        </div>
                    {/if}
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
