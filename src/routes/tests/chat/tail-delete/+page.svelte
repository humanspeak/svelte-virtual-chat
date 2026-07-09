<script lang="ts">
    /**
     * Permanent tail deletion: the last message is removed and never re-appended.
     *
     * The remove-then-add swap (see `stream-swap`) holds the removed tail's
     * measured height as a reserve so the bottom does not move during the empty
     * tick. That reserve MUST return to zero when the replacement never arrives —
     * otherwise the removed message's height is rendered as phantom space above
     * the list, forever. Deleting or regenerating the last assistant reply is a
     * first-class chat interaction, so this fixture guards it.
     */
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'

    type Message = { id: string; blocks: number }

    const BLOCK_PX = 24
    const BLOCKS_PER_MESSAGE = 4
    const SEED_COUNT = 12

    let messages: Message[] = $state(
        Array.from({ length: SEED_COUNT }, (_, i) => ({
            id: String(i + 1),
            blocks: BLOCKS_PER_MESSAGE
        }))
    )
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)

    function deleteTail() {
        messages.pop()
    }
</script>

<div class="p-4">
    <h1 class="mb-4 text-lg font-semibold">Test: Permanent Tail Deletion</h1>
    <p class="mb-3 text-sm text-gray-500">
        Removes the last message and never re-appends it. The tail-swap reserve must clear.
    </p>

    <button
        onclick={deleteTail}
        data-testid="delete-tail"
        class="mb-3 rounded bg-red-700 px-3 py-1 text-sm font-bold text-white"
    >
        delete tail
    </button>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            following={debugInfo.isFollowingBottom}
            height={Math.round(debugInfo.totalHeight)}px
        </div>
    {/if}

    <div
        style="height: 300px;"
        class="rounded-lg border border-gray-300"
        data-testid="chat-wrapper"
    >
        <SvelteVirtualChat
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={72}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (debugInfo = info)}
            containerClass="h-full"
            viewportClass="h-full"
            testId="chat"
        >
            {#snippet renderMessage(message: Message)}
                <div class="border-b border-gray-200" data-testid="msg-{message.id}">
                    {#each Array.from({ length: message.blocks }) as _, blockIndex (blockIndex)}
                        <div
                            class="overflow-hidden font-mono text-xs text-gray-600"
                            style="height: {BLOCK_PX}px; line-height: {BLOCK_PX}px;"
                        >
                            message {message.id} block {blockIndex}
                        </div>
                    {/each}
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
