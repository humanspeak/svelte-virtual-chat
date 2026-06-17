<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'
    import { onMount } from 'svelte'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        kind?: 'table'
        content: string
    }

    const rows = Array.from({ length: 18 }, (_, i) => ({
        id: i + 1,
        price: `$${(245000 + i * 18750).toLocaleString()}`,
        area: `${920 + i * 85} sqft`,
        beds: (i % 4) + 1,
        baths: i % 3 === 0 ? 1.5 : 2,
        status: i % 2 === 0 ? 'Active' : 'Pending'
    }))

    let expanded = $state(false)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let bottomGap = $state(0)

    const messages: Message[] = [
        {
            id: '1',
            role: 'user',
            content: 'Can you compare the current housing results and show the table?'
        },
        {
            id: '2',
            role: 'assistant',
            content:
                'Yes. I will start with the highest level summary, then lay out the rows in a table.'
        },
        {
            id: '3',
            role: 'assistant',
            content:
                'The relevant listings vary most by floor area and current status. The table below intentionally expands after initial paint to mimic a rich table finishing layout.'
        },
        {
            id: '4',
            role: 'assistant',
            kind: 'table',
            content: 'Housing comparison table'
        },
        {
            id: '5',
            role: 'assistant',
            content:
                'Bottom sentinel: this should remain visible after the delayed table growth finishes.'
        }
    ]

    function updateBottomGap() {
        const viewport = document.querySelector(
            '[data-testid="chat-viewport"]'
        ) as HTMLElement | null
        if (!viewport) return
        bottomGap = Math.round(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop)
    }

    onMount(() => {
        updateBottomGap()
        const expandTimer = setTimeout(() => {
            expanded = true
            requestAnimationFrame(() => requestAnimationFrame(updateBottomGap))
        }, 80)
        const pollTimer = setInterval(updateBottomGap, 50)

        return () => {
            clearTimeout(expandTimer)
            clearInterval(pollTimer)
        }
    })
</script>

<svelte:head>
    <title>Test: Late table growth</title>
</svelte:head>

<div class="p-4">
    <h1 class="mb-2 text-lg font-semibold">Test: Late table growth</h1>
    <p class="mb-3 text-sm text-gray-500">
        Reproduces an initially bottom-pinned chat where a table expands after mount.
    </p>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages} dom={debugInfo.renderedCount}
            measured={debugInfo.measuredCount} following={debugInfo.isFollowingBottom}
            height={Math.round(debugInfo.totalHeight)}px viewport={Math.round(
                debugInfo.viewportHeight
            )}px gap={bottomGap}px
        </div>
    {/if}

    <div class="h-[520px] rounded-lg border-2 border-gray-300" data-testid="chat-wrapper">
        <SvelteVirtualChat
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={96}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => {
                debugInfo = info
                updateBottomGap()
            }}
            containerClass="h-full"
            viewportClass="h-full"
            testId="chat"
        >
            {#snippet renderMessage(message: Message)}
                <div class="px-6 py-2" data-testid="msg-{message.id}">
                    <div
                        class="max-w-[860px] rounded-lg px-4 py-3 text-sm {message.role === 'user'
                            ? 'ml-auto bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'}"
                    >
                        {#if message.kind === 'table'}
                            <div class="mb-2 flex items-center justify-between gap-4">
                                <strong>{message.content}</strong>
                                <span class="font-mono text-xs" data-testid="table-state">
                                    {expanded ? 'expanded' : 'collapsed'}
                                </span>
                            </div>
                            <div
                                class="overflow-hidden rounded border border-gray-300 bg-white transition-[max-height] duration-150"
                                class:max-h-32={!expanded}
                                class:max-h-[720px]={expanded}
                                data-testid="delayed-table"
                            >
                                <table class="w-full border-collapse text-left text-xs">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="border-b px-3 py-2">#</th>
                                            <th class="border-b px-3 py-2">Price</th>
                                            <th class="border-b px-3 py-2">Area</th>
                                            <th class="border-b px-3 py-2">Beds</th>
                                            <th class="border-b px-3 py-2">Baths</th>
                                            <th class="border-b px-3 py-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each rows as row (row.id)}
                                            <tr>
                                                <td class="border-b px-3 py-2">{row.id}</td>
                                                <td class="border-b px-3 py-2">{row.price}</td>
                                                <td class="border-b px-3 py-2">{row.area}</td>
                                                <td class="border-b px-3 py-2">{row.beds}</td>
                                                <td class="border-b px-3 py-2">{row.baths}</td>
                                                <td class="border-b px-3 py-2">{row.status}</td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        {:else}
                            <p>{message.content}</p>
                        {/if}
                    </div>
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
