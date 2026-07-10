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

<div class="bc">
    <!-- ── Brut bar (file · messages · following) ───────────────── -->
    <div class="bc-bar">
        <span><span class="lbl">file</span> · <span class="v">BasicChat.svelte</span></span>
        <span><span class="lbl">messages</span> <span class="v">{messages.length}</span></span>
        <span class="live">
            {#if isFollowing}● FOLLOWING{:else}○ SCROLLED{/if}
        </span>
    </div>

    <!-- ── Chat viewport ────────────────────────────────────────── -->
    <div class="bc-viewport">
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
                <div class="bc-msg" class:bc-msg-user={message.role === 'user'}>
                    <div class="bc-msg-head">
                        <span class="bc-role" class:bc-role-user={message.role === 'user'}>
                            {message.role === 'user' ? 'you' : 'assistant'}
                        </span>
                        <span class="bc-time">{formatTime(message.timestamp)}</span>
                    </div>
                    <div class="bc-body">{message.content}</div>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>

    <!-- ── Controls strip ───────────────────────────────────────── -->
    <div class="bc-controls">
        <button class="bc-btn" type="button" onclick={addBulkMessages}>＋ add 100</button>
        <button class="bc-btn" type="button" onclick={() => chat?.scrollToBottom({ smooth: true })}>
            ↓ scroll to bottom
        </button>

        <form
            class="bc-composer"
            onsubmit={(e) => {
                e.preventDefault()
                sendMessage()
            }}
        >
            <input
                bind:value={inputText}
                placeholder="type a message…"
                class="bc-input"
                spellcheck="false"
            />
            <button type="submit" class="bc-btn bc-btn-primary">▸ send</button>
        </form>
    </div>

    <!-- ── Footer metrics strip ─────────────────────────────────── -->
    {#if debugInfo}
        <div class="bc-footer">
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
                    {debugInfo.isFollowingBottom ? 'yes' : `${Math.round(debugInfo.scrollTop)}px`}
                </span>
            </div>
        </div>
    {/if}
</div>

<style>
    .bc {
        display: flex;
        flex-direction: column;
        width: 100%;
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        color: var(--brut-ink, currentColor);
        background: var(--brut-bg);
    }

    /* ── Brut bar (file · messages · following) ────────────────── */
    .bc-bar {
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
    .bc-bar .lbl {
        color: var(--brut-ink-3);
    }
    .bc-bar .v {
        color: var(--brut-ink);
        font-variant-numeric: tabular-nums;
    }
    .bc-bar .live {
        margin-left: auto;
        color: var(--brut-accent);
        letter-spacing: 0.1em;
        font-weight: 600;
    }

    /* ── Chat viewport ─────────────────────────────────────────── */
    .bc-viewport {
        border-bottom: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }

    /* ── Message rows (rendered inside the snippet) ────────────── */
    .bc-msg {
        padding: 12px 14px;
        border-bottom: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }
    .bc-msg-user {
        background: var(--brut-accent-soft);
    }
    .bc-msg-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 5px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .bc-role {
        font-weight: 600;
        color: var(--brut-ink-3);
    }
    .bc-role-user {
        color: var(--brut-accent);
    }
    .bc-time {
        color: var(--brut-ink-3);
        text-transform: none;
        letter-spacing: 0.02em;
    }
    .bc-body {
        font-size: 13px;
        line-height: 1.6;
        color: var(--brut-ink-2);
    }

    /* ── Controls strip ────────────────────────────────────────── */
    .bc-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 14px;
        border-bottom: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }
    .bc-btn {
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
        white-space: nowrap;
        transition:
            color 0.15s,
            border-color 0.15s,
            background 0.15s;
    }
    .bc-btn:hover:not(:disabled) {
        color: var(--brut-accent);
        border-color: var(--brut-accent);
    }
    .bc-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .bc-btn-primary {
        background: var(--brut-accent);
        color: var(--brut-accent-ink);
        border-color: var(--brut-accent);
        font-weight: 600;
    }
    .bc-btn-primary:hover:not(:disabled) {
        background: var(--brut-accent-hover);
        border-color: var(--brut-accent-hover);
        color: var(--brut-accent-ink);
    }
    .bc-composer {
        display: flex;
        gap: 8px;
        flex: 1;
        min-width: 220px;
        margin-left: auto;
    }
    .bc-input {
        flex: 1;
        min-width: 0;
        appearance: none;
        background: var(--brut-bg);
        color: var(--brut-ink);
        border: 1px solid var(--brut-rule);
        padding: 7px 12px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 12px;
        outline: none;
        transition:
            border-color 0.15s,
            background 0.15s;
    }
    .bc-input::placeholder {
        color: var(--brut-ink-3);
    }
    .bc-input:focus {
        border-color: var(--brut-accent);
        background: var(--brut-bg-2);
    }

    /* ── Footer metrics strip ──────────────────────────────────── */
    .bc-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 18px;
        padding: 8px 14px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: var(--brut-ink-3);
    }
    .bc-footer .lbl {
        color: var(--brut-ink-3);
    }
    .bc-footer .v {
        color: var(--brut-ink);
        font-variant-numeric: tabular-nums;
    }
    .bc-footer .v.accent {
        color: var(--brut-accent);
    }

    @media (max-width: 640px) {
        .bc-composer {
            margin-left: 0;
            width: 100%;
        }
    }
</style>
