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

    // Generate a batch of historical messages
    function generateHistory(beforeId: number, count: number): Message[] {
        const batch: Message[] = []
        for (let i = 0; i < count; i++) {
            const id = beforeId - count + i
            if (id < 1) continue
            batch.push({
                id: String(id),
                role: id % 2 === 0 ? 'user' : 'assistant',
                content:
                    id % 2 === 0
                        ? `Historical user message #${id}. This is an older message that was loaded when scrolling up.`
                        : `Historical assistant response #${id}. The viewport should maintain your scroll position when these messages are prepended.`,
                timestamp: Date.now() - (beforeId - id) * 60000
            })
        }
        return batch
    }

    // Start with messages 80-100
    const INITIAL_START = 80
    const TOTAL_HISTORY = 100

    let messages: Message[] = $state(
        generateHistory(TOTAL_HISTORY + 1, TOTAL_HISTORY - INITIAL_START + 1).map((m, i) => ({
            ...m,
            id: String(INITIAL_START + i),
            content:
                (INITIAL_START + i) % 2 === 0
                    ? `User message #${INITIAL_START + i}. Scroll up to load more history.`
                    : `Assistant response #${INITIAL_START + i}. The chat starts with the most recent messages loaded.`
        }))
    )

    let oldestLoadedId = $state(INITIAL_START)
    let isLoadingHistory = $state(false)
    let hasMoreHistory = $state(true)
    let loadCount = $state(0)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let chat: ReturnType<typeof SvelteVirtualChat> | undefined = $state()

    async function loadOlderMessages() {
        if (isLoadingHistory || !hasMoreHistory) return
        isLoadingHistory = true
        loadCount++

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500))

        const batchSize = 20
        const newMessages = generateHistory(oldestLoadedId, batchSize)

        if (newMessages.length > 0) {
            messages = [...newMessages, ...messages]
            oldestLoadedId = Math.max(1, oldestLoadedId - batchSize)
        }

        if (oldestLoadedId <= 1) {
            hasMoreHistory = false
        }

        isLoadingHistory = false
    }

    function formatTime(ts: number): string {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
</script>

<div class="hl">
    <!-- ── Brut bar (file · messages · oldest · loads · status) ──── -->
    <div class="hl-bar">
        <span><span class="lbl">file</span> · <span class="v">HistoryLoading.svelte</span></span>
        <span><span class="lbl">messages</span> <span class="v">{messages.length}</span></span>
        <span><span class="lbl">oldest</span> <span class="v">#{oldestLoadedId}</span></span>
        <span><span class="lbl">loads</span> <span class="v">{loadCount}</span></span>
        <span class="status" class:loading={isLoadingHistory}>
            {#if isLoadingHistory}● loading history{:else if !hasMoreHistory}○ all history loaded{:else}·
                scroll up to load more{/if}
        </span>
    </div>

    <!-- ── Controls strip ───────────────────────────────────────── -->
    <div class="hl-controls">
        <button
            class="hl-btn hl-btn-primary"
            onclick={() => chat?.scrollToBottom({ smooth: true })}
        >
            ▸ scroll bottom
        </button>
        <button
            class="hl-btn"
            onclick={loadOlderMessages}
            disabled={isLoadingHistory || !hasMoreHistory}
        >
            ↻ load history
        </button>
    </div>

    <!-- ── Chat viewport ────────────────────────────────────────── -->
    <div class="hl-surface">
        <SvelteVirtualChat
            bind:this={chat}
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={72}
            followBottomThresholdPx={48}
            overscan={8}
            onNeedHistory={loadOlderMessages}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (debugInfo = info)}
            containerClass="h-[500px]"
            viewportClass="h-full"
            testId="history-chat"
        >
            {#snippet renderMessage(message: Message)}
                <div class="hl-msg" data-role={message.role}>
                    <div class="hl-msg-head">
                        <span class="hl-msg-role">
                            {message.role === 'user' ? 'you' : 'assistant'}
                        </span>
                        <span class="hl-msg-time">{formatTime(message.timestamp)}</span>
                        <span class="hl-msg-id">#{message.id}</span>
                    </div>
                    <div class="hl-msg-body">{message.content}</div>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>

    <!-- ── Footer metrics (virtualization) ──────────────────────── -->
    {#if debugInfo}
        <div class="hl-footer">
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
                <span class="v">{Math.round(debugInfo.scrollTop)}px</span>
            </div>
        </div>
    {/if}
</div>

<style>
    .hl {
        display: flex;
        flex-direction: column;
        width: 100%;
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        color: var(--brut-ink, currentColor);
        background: var(--brut-bg);
    }

    /* ── Brut bar ───────────────────────────────────────────────── */
    .hl-bar {
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
    .hl-bar .lbl {
        color: var(--brut-ink-3);
    }
    .hl-bar .v {
        color: var(--brut-ink);
        font-variant-numeric: tabular-nums;
    }
    .hl-bar .status {
        margin-left: auto;
        letter-spacing: 0.06em;
    }
    .hl-bar .status.loading {
        color: var(--brut-accent);
        font-weight: 600;
    }

    /* ── Controls ───────────────────────────────────────────────── */
    .hl-controls {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 12px 14px;
        border-bottom: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }
    .hl-btn {
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
    .hl-btn:hover:not(:disabled) {
        color: var(--brut-accent);
        border-color: var(--brut-accent);
    }
    .hl-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .hl-btn-primary {
        background: var(--brut-accent);
        color: var(--brut-accent-ink);
        border-color: var(--brut-accent);
        font-weight: 600;
    }
    .hl-btn-primary:hover:not(:disabled) {
        background: var(--brut-accent-hover);
        border-color: var(--brut-accent-hover);
        color: var(--brut-accent-ink);
    }

    /* ── Chat surface ───────────────────────────────────────────── */
    .hl-surface {
        border-bottom: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }

    /* Message rows (rendered via snippet — parent style scope) */
    .hl-msg {
        padding: 12px 16px;
        border-bottom: 1px solid var(--brut-rule);
        border-left: 2px solid transparent;
    }
    .hl-msg[data-role='user'] {
        border-left-color: var(--brut-accent);
        background: var(--brut-accent-soft);
    }
    .hl-msg-head {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 5px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }
    .hl-msg-role {
        color: var(--brut-ink-2);
        font-weight: 600;
    }
    .hl-msg[data-role='user'] .hl-msg-role {
        color: var(--brut-accent);
    }
    .hl-msg-time {
        color: var(--brut-ink-3);
    }
    .hl-msg-id {
        margin-left: auto;
        color: var(--brut-ink-3);
        font-variant-numeric: tabular-nums;
    }
    .hl-msg-body {
        font-size: 13px;
        line-height: 1.6;
        color: var(--brut-ink);
    }

    /* ── Footer metrics ─────────────────────────────────────────── */
    .hl-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 18px;
        padding: 8px 14px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: var(--brut-ink-3);
    }
    .hl-footer .lbl {
        color: var(--brut-ink-3);
    }
    .hl-footer .v {
        color: var(--brut-ink);
        font-variant-numeric: tabular-nums;
    }
    .hl-footer .v.accent {
        color: var(--brut-accent);
    }
</style>
