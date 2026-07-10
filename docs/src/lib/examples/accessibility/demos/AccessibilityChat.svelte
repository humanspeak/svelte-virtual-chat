<script lang="ts">
    import SvelteVirtualChat from '@humanspeak/svelte-virtual-chat'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        content: string
    }

    const SNIPPETS = [
        'Keyboard users can reach this viewport with Tab.',
        'Arrow keys scroll one line, PageUp/PageDown scroll by pages.',
        'End jumps to the newest message and re-engages follow-bottom.',
        'Home jumps to the oldest message and lets go of the bottom.',
        'Scrolling up with the keyboard disengages follow — same as a wheel.',
        'Holding ArrowDown at the bottom never breaks follow.'
    ]

    const messages: Message[] = Array.from({ length: 40 }, (_, i) => ({
        id: String(i + 1),
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `Message ${i + 1} — ${SNIPPETS[i % SNIPPETS.length]}`
    }))

    const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '])

    let lastKey = $state<string | null>(null)
    let focused = $state(false)
    let following = $state(true)

    function describeKey(event: KeyboardEvent) {
        if (!SCROLL_KEYS.has(event.key)) return
        lastKey = event.key === ' ' ? (event.shiftKey ? 'Shift+Space' : 'Space') : event.key
    }

    const KEY_REFERENCE: Array<[string, string]> = [
        ['↑ / ↓', 'one line'],
        ['PageUp / PageDn', 'one page'],
        ['Space / ⇧Space', 'one page'],
        ['Home', 'oldest · unfollow'],
        ['End', 'newest · re-follow']
    ]
</script>

<div class="ak">
    <!-- ── Chat surface (keyboard-focusable) ────────────────────── -->
    <div
        class="ak-surface"
        onkeydowncapture={describeKey}
        onfocusin={() => (focused = true)}
        onfocusout={() => (focused = false)}
    >
        <SvelteVirtualChat
            {messages}
            getMessageId={(msg: Message) => msg.id}
            viewportLabel="Keyboard demo conversation"
            onFollowBottomChange={(isFollowing) => (following = isFollowing)}
            containerClass="h-full"
            viewportClass="h-full"
        >
            {#snippet renderMessage(message)}
                <div class="ak-msg" data-role={message.role}>
                    <span class="ak-bubble">{message.content}</span>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>

    <!-- ── Spec panel (readout + key reference) ─────────────────── -->
    <div class="ak-panel">
        <div class="ak-label">keyboard · readout</div>
        <div class="ak-hint">tab to focus, then scroll keys — watch <b>following</b></div>

        <dl class="ak-rows">
            <div>
                <dt>focused</dt>
                <dd class:on={focused}>{focused ? 'yes' : 'no'}</dd>
            </div>
            <div>
                <dt>last key</dt>
                <dd>{lastKey ?? '—'}</dd>
            </div>
            <div>
                <dt>following</dt>
                <dd class:on={following}>{following ? 'yes' : 'no'}</dd>
            </div>
        </dl>

        <div class="ak-label">key · action</div>
        <dl class="ak-rows">
            {#each KEY_REFERENCE as [key, action] (key)}
                <div>
                    <dt>{key}</dt>
                    <dd class="muted">{action}</dd>
                </div>
            {/each}
        </dl>
    </div>
</div>

<style>
    .ak {
        display: flex;
        width: 100%;
        gap: 1px;
        background: var(--brut-rule);
        border: 1px solid var(--brut-rule);
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        color: var(--brut-ink, currentColor);
        flex-direction: column;
    }
    @media (min-width: 768px) {
        .ak {
            flex-direction: row;
        }
    }

    /* ── Chat surface ───────────────────────────────────────────── */
    .ak-surface {
        flex: 1;
        min-width: 0;
        height: 340px;
        background: var(--brut-bg);
        transition: box-shadow 0.15s;
    }
    /* Clearly visible keyboard focus — the whole point of this demo. */
    .ak-surface:focus-within {
        box-shadow: inset 0 0 0 2px var(--brut-accent);
    }
    .ak-surface :global(:focus-visible) {
        outline: 2px solid var(--brut-accent);
        outline-offset: -2px;
    }

    .ak-msg {
        display: flex;
        padding: 4px 12px;
    }
    .ak-msg[data-role='user'] {
        justify-content: flex-end;
    }
    .ak-bubble {
        max-width: 85%;
        padding: 7px 10px;
        border: 1px solid var(--brut-rule);
        font-size: 12px;
        line-height: 1.5;
        color: var(--brut-ink);
        background: var(--brut-bg-2);
    }
    .ak-msg[data-role='user'] .ak-bubble {
        border-color: var(--brut-accent);
        background: var(--brut-accent-soft);
    }

    /* ── Spec panel ─────────────────────────────────────────────── */
    .ak-panel {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px 16px;
        background: var(--brut-bg);
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
    }
    .ak-label {
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--brut-ink-3);
    }
    .ak-label:not(:first-child) {
        margin-top: 8px;
    }
    .ak-hint {
        font-size: 11px;
        line-height: 1.5;
        color: var(--brut-ink-2);
    }
    .ak-hint b {
        color: var(--brut-accent);
        font-weight: 600;
    }
    .ak-rows {
        margin: 0;
        display: flex;
        flex-direction: column;
    }
    .ak-rows div {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 5px 0;
        border-bottom: 1px dashed var(--brut-rule);
    }
    .ak-rows div:last-child {
        border-bottom: 0;
    }
    .ak-rows dt {
        font-size: 11.5px;
        color: var(--brut-ink-2);
    }
    .ak-rows dd {
        margin: 0;
        font-size: 11.5px;
        color: var(--brut-ink);
        font-variant-numeric: tabular-nums;
        text-align: right;
    }
    .ak-rows dd.on {
        color: var(--brut-accent);
        font-weight: 600;
    }
    .ak-rows dd.muted {
        color: var(--brut-ink-3);
    }
</style>
