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
</script>

<div class="flex w-full grow flex-col gap-4 md:flex-row">
    <div
        class="border-border h-[340px] flex-1 rounded border"
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
                <div class="px-3 py-1.5">
                    <div
                        class="max-w-[85%] rounded-xl px-3 py-2 text-xs {message.role === 'user'
                            ? 'bg-brand-500/10 ml-auto'
                            : 'bg-muted'}"
                    >
                        {message.content}
                    </div>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
    <div class="border-border bg-muted/50 flex-1 rounded border p-4">
        <h3 class="mb-3 text-sm font-medium">Try it with your keyboard</h3>
        <p class="text-muted-foreground mb-3 text-xs">
            Press <kbd class="rounded border px-1">Tab</kbd> until the conversation has a focus
            ring, then use the scroll keys. Watch <em>Following bottom</em> as you press
            <kbd class="rounded border px-1">PageUp</kbd> and then
            <kbd class="rounded border px-1">End</kbd>.
        </p>
        <div class="space-y-2 text-xs">
            <div class="flex justify-between">
                <span class="text-muted-foreground">Conversation focused:</span>
                <span class="font-mono">{focused ? 'yes' : 'no'}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Last scroll key:</span>
                <span class="font-mono">{lastKey ?? '—'}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Following bottom:</span>
                <span class="font-mono">{following ? 'yes' : 'no'}</span>
            </div>
        </div>
        <table class="mt-4 w-full text-xs">
            <tbody>
                <tr>
                    <td class="text-muted-foreground py-1">↑ / ↓</td>
                    <td class="text-right">one line</td>
                </tr>
                <tr>
                    <td class="text-muted-foreground py-1">PageUp / PageDown</td>
                    <td class="text-right">one page</td>
                </tr>
                <tr>
                    <td class="text-muted-foreground py-1">Space / Shift+Space</td>
                    <td class="text-right">one page</td>
                </tr>
                <tr>
                    <td class="text-muted-foreground py-1">Home</td>
                    <td class="text-right">oldest message, unfollow</td>
                </tr>
                <tr>
                    <td class="text-muted-foreground py-1">End</td>
                    <td class="text-right">newest message, re-follow</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
