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

<div class="sc">
    <!-- ── Brut bar (file · progress · tokens · speed · LIVE) ────── -->
    <div class="sc-bar">
        <span><span class="lbl">file</span> · <span class="v">StreamingChat.svelte</span></span>
        <span><span class="lbl">progress</span> <span class="v">{progress}%</span></span>
        <span
            ><span class="lbl">tokens</span>
            <span class="v">{tokenCount}/{totalTokens || '—'}</span></span
        >
        <span><span class="lbl">speed</span> <span class="v">{tokensPerSecond} tok/s</span></span>
        <span class="live">
            {#if isStreaming}● LIVE{:else}○ IDLE{/if}
        </span>
    </div>

    <!-- ── Progress rail ────────────────────────────────────────── -->
    <div class="sc-progress">
        <div class="sc-progress-fill" style="width: {progress}%"></div>
    </div>

    <!-- ── Chat viewport ────────────────────────────────────────── -->
    <div class="sc-viewport">
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
                <div class="sc-msg" class:sc-msg-user={message.role === 'user'}>
                    <div class="sc-msg-head">
                        <span class="sc-role" class:sc-role-user={message.role === 'user'}>
                            {message.role === 'user' ? 'you' : 'assistant'}
                        </span>
                        <span class="sc-time">{formatTime(message.timestamp)}</span>
                        {#if message.isStreaming}
                            <span class="sc-streaming">● streaming</span>
                        {/if}
                    </div>
                    {#if message.role === 'assistant' && message.content}
                        <div class="sc-md prose prose-sm dark:prose-invert max-w-none">
                            <SvelteMarkdown
                                source={message.content}
                                streaming={message.isStreaming ?? false}
                            />
                        </div>
                    {:else}
                        <div class="sc-body">{message.content}</div>
                    {/if}
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>

    <!-- ── Controls strip ───────────────────────────────────────── -->
    <div class="sc-controls">
        <div class="sc-actions">
            <button class="sc-btn sc-btn-primary" onclick={startStreaming} disabled={isStreaming}>
                ▸ start
            </button>
            <button class="sc-btn" onclick={stopStreaming} disabled={!isStreaming}>■ stop</button>
            <button class="sc-btn" onclick={reset}>↻ reset</button>
        </div>

        <label class="sc-field">
            <span class="sc-field-k">speed</span>
            <input
                type="range"
                min="10"
                max="100"
                step="5"
                bind:value={tokensPerSecond}
                disabled={isStreaming}
            />
            <span class="sc-field-v">{tokensPerSecond}/s</span>
        </label>
    </div>

    <!-- ── Footer metrics strip ─────────────────────────────────── -->
    {#if debugInfo}
        <div class="sc-footer">
            <div>
                <span class="lbl">total</span> · <span class="v">{debugInfo.totalMessages}</span>
            </div>
            <div>
                <span class="lbl">in-dom</span> · <span class="v">{debugInfo.renderedCount}</span>
            </div>
            <div>
                <span class="lbl">measured</span> · <span class="v">{debugInfo.measuredCount}</span>
            </div>
            <div>
                <span class="lbl">range</span> ·
                <span class="v">{debugInfo.startIndex}–{debugInfo.endIndex}</span>
            </div>
            <div>
                <span class="lbl">height</span> ·
                <span class="v">{Math.round(debugInfo.totalHeight)}px</span>
            </div>
            <div>
                <span class="lbl">following</span> ·
                <span class="v" class:accent={debugInfo.isFollowingBottom}>
                    {debugInfo.isFollowingBottom ? 'yes' : 'no'}
                </span>
            </div>
        </div>
    {/if}
</div>

<style>
    .sc {
        display: flex;
        flex-direction: column;
        width: 100%;
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        color: var(--brut-ink, currentColor);
        background: var(--brut-bg);
    }

    /* ── Brut bar ──────────────────────────────────────────────── */
    .sc-bar {
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 8px 14px;
        border-bottom: 1px solid var(--brut-rule);
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: var(--brut-ink-3);
        flex-wrap: wrap;
    }
    .sc-bar .lbl {
        color: var(--brut-ink-3);
    }
    .sc-bar .v {
        color: var(--brut-ink);
        font-variant-numeric: tabular-nums;
    }
    .sc-bar .live {
        margin-left: auto;
        color: var(--brut-accent);
        letter-spacing: 0.1em;
        font-weight: 600;
    }

    /* ── Progress rail ─────────────────────────────────────────── */
    .sc-progress {
        height: 2px;
        width: 100%;
        background: var(--brut-bg-2);
        border-bottom: 1px solid var(--brut-rule);
    }
    .sc-progress-fill {
        height: 100%;
        background: var(--brut-accent);
        transition: width 0.15s linear;
    }

    /* ── Chat viewport ─────────────────────────────────────────── */
    .sc-viewport {
        border-bottom: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }

    /* ── Message rows (rendered inside the snippet) ────────────── */
    .sc-msg {
        padding: 12px 14px;
        border-bottom: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }
    .sc-msg-user {
        background: var(--brut-accent-soft);
    }
    .sc-msg-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .sc-role {
        font-weight: 600;
        color: var(--brut-ink-3);
    }
    .sc-role-user {
        color: var(--brut-accent);
    }
    .sc-time {
        color: var(--brut-ink-3);
        text-transform: none;
        letter-spacing: 0.02em;
    }
    .sc-streaming {
        color: var(--brut-accent);
        letter-spacing: 0.08em;
        animation: sc-pulse 1.2s ease-in-out infinite;
    }
    @keyframes sc-pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.35;
        }
    }
    .sc-body {
        font-size: 13px;
        line-height: 1.6;
        color: var(--brut-ink-2);
    }

    /* ── Markdown output (streamed assistant messages) ─────────── */
    .sc-md {
        font-size: 13px;
        line-height: 1.65;
        color: var(--brut-ink-2);
    }
    .sc-md :global(h1),
    .sc-md :global(h2),
    .sc-md :global(h3),
    .sc-md :global(h4) {
        color: var(--brut-ink);
        letter-spacing: -0.02em;
    }
    .sc-md :global(:not(pre) > code) {
        background: var(--brut-bg-2);
        border: 1px solid var(--brut-rule);
        padding: 0 4px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 12px;
    }
    .sc-md :global(pre) {
        margin: 12px 0;
        padding: 12px 14px;
        border: 1px solid var(--brut-rule);
        background: var(--brut-bg-2);
        overflow-x: auto;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 12px;
        line-height: 1.65;
        color: var(--brut-ink);
        border-radius: 0;
    }
    .sc-md :global(pre code) {
        background: transparent;
        border: 0;
        padding: 0;
    }
    .sc-md :global(blockquote) {
        border-left: 2px solid var(--brut-accent);
        padding-left: 12px;
        font-style: italic;
        color: var(--brut-ink-2);
    }
    .sc-md :global(table) {
        border-collapse: collapse;
        font-size: 12px;
    }
    .sc-md :global(th),
    .sc-md :global(td) {
        border: 1px solid var(--brut-rule);
        padding: 4px 8px;
    }

    /* ── Controls strip ────────────────────────────────────────── */
    .sc-controls {
        display: flex;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
        padding: 14px;
        border-bottom: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }
    .sc-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    .sc-btn {
        appearance: none;
        background: var(--brut-bg);
        color: var(--brut-ink-2);
        border: 1px solid var(--brut-rule);
        padding: 7px 14px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: lowercase;
        cursor: pointer;
        transition:
            color 0.15s,
            border-color 0.15s,
            background 0.15s;
    }
    .sc-btn:hover:not(:disabled) {
        color: var(--brut-accent);
        border-color: var(--brut-accent);
    }
    .sc-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .sc-btn-primary {
        background: var(--brut-accent);
        color: var(--brut-accent-ink);
        border-color: var(--brut-accent);
        font-weight: 600;
    }
    .sc-btn-primary:hover:not(:disabled) {
        background: var(--brut-accent-hover);
        border-color: var(--brut-accent-hover);
        color: var(--brut-accent-ink);
    }
    .sc-field {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: auto;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: var(--brut-ink-2);
    }
    .sc-field-k {
        color: var(--brut-ink-3);
        letter-spacing: 0.06em;
    }
    .sc-field input[type='range'] {
        width: 140px;
        accent-color: var(--brut-accent);
    }
    .sc-field-v {
        color: var(--brut-ink);
        font-variant-numeric: tabular-nums;
        min-width: 44px;
        text-align: right;
    }

    /* ── Footer metrics strip ──────────────────────────────────── */
    .sc-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 18px;
        padding: 8px 14px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: var(--brut-ink-3);
    }
    .sc-footer .lbl {
        color: var(--brut-ink-3);
    }
    .sc-footer .v {
        color: var(--brut-ink);
        font-variant-numeric: tabular-nums;
    }
    .sc-footer .v.accent {
        color: var(--brut-accent);
    }

    @media (max-width: 640px) {
        .sc-field {
            margin-left: 0;
        }
    }
</style>
