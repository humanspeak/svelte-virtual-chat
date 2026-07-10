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

<div class="hf">
    <!-- ── Brut bar (file · messages · follow state) ────────────── -->
    <div class="hf-bar">
        <span><span class="lbl">file</span> · <span class="v">HeaderFooterChat.svelte</span></span>
        <span><span class="lbl">messages</span> <span class="v">{messages.length}</span></span>
        <span class="status" class:away={!isFollowing}>
            {#if isFollowing}● following{:else}○ scrolled away{/if}
        </span>
    </div>

    <!-- ── Controls strip ───────────────────────────────────────── -->
    <div class="hf-controls">
        <button class="hf-btn" onclick={addBulkMessages}>+ add 50</button>
        <button class="hf-btn" class:active={showTyping} onclick={() => (showTyping = !showTyping)}>
            {showTyping ? '● typing…' : '○ toggle typing'}
        </button>
        <button
            class="hf-btn hf-btn-primary"
            onclick={() => chat?.scrollToBottom({ smooth: true })}
        >
            ▸ scroll bottom
        </button>
    </div>

    <!-- ── Chat surface (header + footer snippet bands) ─────────── -->
    <div class="hf-surface">
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
                <div class="hf-band hf-band-header">
                    <span class="hf-band-tag">header</span>
                    <span class="hf-band-text">
                        beginning of conversation · {messages.length} message{messages.length !== 1
                            ? 's'
                            : ''}
                    </span>
                </div>
            {/snippet}
            {#snippet renderMessage(message: Message)}
                <div class="hf-msg" data-role={message.role}>
                    <div class="hf-msg-head">
                        <span class="hf-msg-role">
                            {message.role === 'user' ? 'you' : 'assistant'}
                        </span>
                        <span class="hf-msg-time">{formatTime(message.timestamp)}</span>
                    </div>
                    <div class="hf-msg-body">{message.content}</div>
                </div>
            {/snippet}
            {#snippet footer()}
                {#if showTyping}
                    <div class="hf-band hf-band-typing">
                        <span class="hf-dots">
                            <span></span><span></span><span></span>
                        </span>
                        <span class="hf-band-text">assistant is typing…</span>
                    </div>
                {/if}
                <div class="hf-band hf-band-footer">
                    <span class="hf-band-tag">footer</span>
                    <span class="hf-band-text">powered by <b>SvelteVirtualChat</b></span>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>

    <!-- ── Footer metrics (virtualization) ──────────────────────── -->
    {#if debugInfo}
        <div class="hf-footer">
            <div>
                <span class="lbl">total</span> · <span class="v">{debugInfo.totalMessages}</span>
            </div>
            <div>
                <span class="lbl">in dom</span> ·
                <span class="v accent">{debugInfo.renderedCount}</span>
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
                <span class="lbl">scroll</span> ·
                <span class="v" class:accent={debugInfo.isFollowingBottom}>
                    {debugInfo.isFollowingBottom
                        ? 'following'
                        : `${Math.round(debugInfo.scrollTop)}px`}
                </span>
            </div>
        </div>
    {/if}

    <!-- ── Composer (outside the scroll box) ────────────────────── -->
    <form
        class="hf-composer"
        onsubmit={(e) => {
            e.preventDefault()
            sendMessage()
        }}
    >
        <input bind:value={inputText} class="hf-input" placeholder="type a message…" />
        <button type="submit" class="hf-btn hf-btn-primary">▸ send</button>
    </form>
</div>

<style>
    .hf {
        display: flex;
        flex-direction: column;
        width: 100%;
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        color: var(--brut-ink, currentColor);
        background: var(--brut-bg);
    }

    /* ── Brut bar ───────────────────────────────────────────────── */
    .hf-bar {
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
    .hf-bar .lbl {
        color: var(--brut-ink-3);
    }
    .hf-bar .v {
        color: var(--brut-ink);
        font-variant-numeric: tabular-nums;
    }
    .hf-bar .status {
        margin-left: auto;
        letter-spacing: 0.06em;
        color: var(--brut-accent);
        font-weight: 600;
    }
    .hf-bar .status.away {
        color: var(--brut-ink-3);
        font-weight: 400;
    }

    /* ── Controls ───────────────────────────────────────────────── */
    .hf-controls {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 12px 14px;
        border-bottom: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }
    .hf-btn {
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
    .hf-btn:hover:not(:disabled) {
        color: var(--brut-accent);
        border-color: var(--brut-accent);
    }
    .hf-btn.active {
        color: var(--brut-accent);
        border-color: var(--brut-accent);
        background: var(--brut-accent-soft);
    }
    .hf-btn-primary {
        background: var(--brut-accent);
        color: var(--brut-accent-ink);
        border-color: var(--brut-accent);
        font-weight: 600;
    }
    .hf-btn-primary:hover:not(:disabled) {
        background: var(--brut-accent-hover);
        border-color: var(--brut-accent-hover);
        color: var(--brut-accent-ink);
    }

    /* ── Chat surface ───────────────────────────────────────────── */
    .hf-surface {
        border-bottom: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }

    /* Header / footer snippet bands — deliberately distinct from
       message rows so the feature reads clearly. */
    .hf-band {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 16px;
        background: var(--brut-bg-2);
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: var(--brut-ink-2);
    }
    .hf-band-header {
        border-bottom: 1px solid var(--brut-rule);
    }
    .hf-band-footer {
        border-top: 1px solid var(--brut-rule);
    }
    .hf-band-tag {
        padding: 2px 7px;
        border: 1px solid var(--brut-accent);
        color: var(--brut-accent);
        font-size: 9.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        font-weight: 600;
    }
    .hf-band-text b {
        color: var(--brut-accent);
        font-weight: 600;
    }
    .hf-band-typing {
        border-top: 1px dashed var(--brut-rule);
    }
    .hf-dots {
        display: inline-flex;
        gap: 4px;
    }
    .hf-dots span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--brut-accent);
        animation: hf-bounce 1.2s ease-in-out infinite;
    }
    .hf-dots span:nth-child(2) {
        animation-delay: 0.15s;
    }
    .hf-dots span:nth-child(3) {
        animation-delay: 0.3s;
    }
    @keyframes hf-bounce {
        0%,
        60%,
        100% {
            opacity: 0.3;
            transform: translateY(0);
        }
        30% {
            opacity: 1;
            transform: translateY(-3px);
        }
    }

    /* Message rows */
    .hf-msg {
        padding: 12px 16px;
        border-bottom: 1px solid var(--brut-rule);
        border-left: 2px solid transparent;
    }
    .hf-msg[data-role='user'] {
        border-left-color: var(--brut-accent);
        background: var(--brut-accent-soft);
    }
    .hf-msg-head {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 5px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }
    .hf-msg-role {
        color: var(--brut-ink-2);
        font-weight: 600;
    }
    .hf-msg[data-role='user'] .hf-msg-role {
        color: var(--brut-accent);
    }
    .hf-msg-time {
        color: var(--brut-ink-3);
    }
    .hf-msg-body {
        font-size: 13px;
        line-height: 1.6;
        color: var(--brut-ink);
    }

    /* ── Footer metrics ─────────────────────────────────────────── */
    .hf-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 18px;
        padding: 8px 14px;
        border-bottom: 1px solid var(--brut-rule);
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: var(--brut-ink-3);
    }
    .hf-footer .lbl {
        color: var(--brut-ink-3);
    }
    .hf-footer .v {
        color: var(--brut-ink);
        font-variant-numeric: tabular-nums;
    }
    .hf-footer .v.accent {
        color: var(--brut-accent);
    }

    /* ── Composer ───────────────────────────────────────────────── */
    .hf-composer {
        display: flex;
        gap: 8px;
        padding: 12px 14px;
    }
    .hf-input {
        flex: 1;
        min-width: 0;
        appearance: none;
        background: var(--brut-bg);
        color: var(--brut-ink);
        border: 1px solid var(--brut-rule);
        padding: 8px 12px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 12px;
        outline: none;
        transition: border-color 0.15s;
    }
    .hf-input:focus {
        border-color: var(--brut-accent);
    }
    .hf-input::placeholder {
        color: var(--brut-ink-3);
    }
</style>
