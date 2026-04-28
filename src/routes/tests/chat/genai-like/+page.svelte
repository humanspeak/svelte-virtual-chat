<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'
    import { onMount } from 'svelte'

    /**
     * Genai-shaped fixture: header (~45px) + tall messages with markdown-y
     * content. The composer (textarea + send + AI disclaimer) lives **outside**
     * the chat's scroll box as a sibling element — the way real apps ship.
     * This still reproduces the headerHeight coordinate-space bug end-to-end
     * (scrolling to bottom with a header on top would render the entire list
     * pre-fix). The "viewport inside tall footer" math case is covered by the
     * `fix #2` unit test in chatMeasurement.svelte.test.ts.
     */

    type Role = 'user' | 'assistant'
    type Message = { id: string; role: Role; content: string; pre?: boolean }

    const longParagraphs = [
        'Virtual scrolling is a rendering optimization that only mounts items currently visible in the viewport. Instead of creating DOM nodes for every item in a long list, the renderer measures heights, tracks scroll position, and slices the array down to the items that overlap the visible window plus a small overscan buffer.',
        'For chat UIs the constraint is bottom-gravity: when the conversation is shorter than the viewport, the messages should stick to the bottom rather than the top, so the input box has somewhere natural to sit and short conversations do not float in space. Once content exceeds the viewport the layout flips to a normal scrollable region.',
        'The trickiest case is a tall footer: an input area with attachments, a send button, an AI disclaimer underneath. When you are scrolled to the absolute bottom of the conversation, the actual viewport may be sitting *inside* that footer, with no message rows visible at all. The visible-range loop has to anchor sensibly at the last item rather than falling back to the start of the list.',
        'Headers add the symmetric problem on the other end. With a small "load older messages" header above the messages container, scrollTop accumulates from the top of the scroll container, but message offsets are measured from the start of the messages section. Subtracting headerHeight is what keeps the two coordinate systems aligned.'
    ]

    const codeBlock = `function calculateVisibleRange(args) {
    const { scrollTop, viewportHeight, headerHeight, footerHeight } = args
    const topGap = Math.max(0, viewportHeight - totalHeight - headerHeight - footerHeight)
    const messageScrollTop = Math.max(0, scrollTop - topGap - headerHeight)
    // walk message offsets, find overlap…
    return { start, end, visibleStart, visibleEnd }
}`

    let messages: Message[] = $state([])
    let counter = $state(0)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let longestTaskMs = $state(0)

    const buildMessage = (role: Role, idx: number): Message => {
        const useCode = idx % 7 === 0
        const usePara = idx % 3 === 0
        if (useCode) {
            return { id: String(idx), role, content: codeBlock, pre: true }
        }
        if (usePara) {
            const para = longParagraphs[idx % longParagraphs.length]
            return { id: String(idx), role, content: `${para} ${para}` }
        }
        return {
            id: String(idx),
            role,
            content: `Message #${idx}: ${longParagraphs[idx % longParagraphs.length]}`
        }
    }

    const load = (n: number) => {
        const batch: Message[] = []
        for (let i = 0; i < n; i++) {
            counter++
            const role: Role = counter % 2 === 0 ? 'assistant' : 'user'
            batch.push(buildMessage(role, counter))
        }
        messages = [...messages, ...batch]
    }

    const clear = () => {
        messages = []
        counter = 0
        longestTaskMs = 0
    }

    onMount(() => {
        try {
            const po = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > longestTaskMs) longestTaskMs = Math.round(entry.duration)
                }
            })
            po.observe({ entryTypes: ['longtask'] })
            return () => po.disconnect()
        } catch {
            // Some browsers (older or test runners) lack longtask support — that's fine.
        }
    })
</script>

<svelte:head>
    <title>Test: Genai-like layout</title>
</svelte:head>

<div class="flex h-screen flex-col p-4">
    <h1 class="mb-2 text-lg font-semibold">Test: Genai-like layout</h1>
    <p class="mb-3 text-sm text-gray-500">
        Reproduces genai's chat layout: short header inside the scroll box, tall markdown-style
        messages, composer rendered as a sibling below the chat (not inside its viewport). Pre-fix
        the headerHeight coordinate-space bug rendered every message at once when scrolled to
        bottom; expect <code class="rounded bg-gray-100 px-1 font-mono text-xs">dom</code>
        to stay well under
        <code class="rounded bg-gray-100 px-1 font-mono text-xs">total</code>.
    </p>

    <div class="mb-3 flex flex-wrap gap-2">
        <button
            onclick={() => load(50)}
            data-testid="load-50"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            Load 50
        </button>
        <button
            onclick={() => load(200)}
            data-testid="load-200"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            Load 200
        </button>
        <button
            onclick={clear}
            data-testid="clear"
            class="rounded bg-gray-500 px-3 py-1 text-sm text-white"
        >
            Clear
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-2 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages} dom={debugInfo.renderedCount} following={debugInfo.isFollowingBottom}
            longestTaskMs={longestTaskMs}
        </div>
    {/if}

    <div class="min-h-0 flex-1 rounded-lg border-2 border-gray-300" data-testid="chat-wrapper">
        <SvelteVirtualChat
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={120}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (debugInfo = info)}
            containerClass="h-full"
            viewportClass="h-full"
            testId="chat"
        >
            {#snippet renderMessage(message: Message)}
                <div class="px-6 py-2">
                    <div
                        class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm {message.role === 'user'
                            ? 'ml-auto rounded-br-md bg-blue-500 text-white'
                            : 'rounded-bl-md bg-gray-100 text-gray-900'}"
                        data-testid="msg-{message.id}"
                    >
                        {#if message.pre}
                            <pre
                                class="overflow-x-auto rounded bg-black/10 p-2 font-mono text-xs whitespace-pre-wrap">{message.content}</pre>
                        {:else}
                            <p class="whitespace-pre-wrap">{message.content}</p>
                        {/if}
                    </div>
                    <div class="mt-1 px-1 text-[10px] text-gray-400">
                        id={message.id} · {message.role}
                    </div>
                </div>
            {/snippet}
            {#snippet header()}
                <div
                    class="border-b border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm text-blue-600"
                    data-testid="header-content"
                >
                    Conversation header — load older messages
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>

    <!-- Composer lives outside the chat's scroll box, as a sibling. -->
    <div
        class="mt-3 flex-shrink-0 rounded-lg border border-gray-200 bg-white"
        data-testid="composer"
    >
        <div class="space-y-2 px-4 py-3">
            <textarea
                class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                rows="6"
                placeholder="Type a message…"
                data-testid="composer-input"
            ></textarea>
            <div class="flex justify-end gap-2">
                <button class="rounded bg-gray-200 px-3 py-1 text-sm">Attach</button>
                <button class="rounded bg-blue-500 px-3 py-1 text-sm text-white">Send</button>
            </div>
        </div>
        <div
            class="border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500"
            data-testid="composer-disclaimer"
        >
            AI assistants can make mistakes. Verify important information before acting on it.
        </div>
    </div>
</div>
