<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'
    import { onMount } from 'svelte'

    /**
     * Performance baseline fixture for the optimization tier work.
     * Captures longtask + rAF + MutationObserver metrics over a rolling
     * 10s window so each Tier 1/2 change can be attributed to a specific
     * before/after delta.
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

    const ROLLING_WINDOW_MS = 10_000
    const LONG_TASK_THRESHOLD_MS = 50

    let messages: Message[] = $state([])
    let counter = $state(0)
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let isStreaming = $state(false)
    let longTaskSupported = $state(true)

    let displayLongestTaskMs = $state(0)
    let displayLongTaskCount = $state(0)
    let displayRafP95Ms = $state(0)
    let displayMutationCount = $state(0)

    let longTaskEntries: { time: number; duration: number }[] = []
    let rafIntervals: { time: number; delta: number }[] = []
    let mutationEvents: { time: number; count: number }[] = []

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
        longTaskEntries = []
        rafIntervals = []
        mutationEvents = []
        displayLongestTaskMs = 0
        displayLongTaskCount = 0
        displayRafP95Ms = 0
        displayMutationCount = 0
    }

    const startStreamSim = () => {
        if (isStreaming) return
        isStreaming = true
        counter++
        const id = String(counter)
        messages = [...messages, { id, role: 'assistant', content: 'Streaming…' }]
        const start = performance.now()
        let line = 0
        const handle = setInterval(() => {
            const elapsed = performance.now() - start
            if (elapsed >= 5000) {
                clearInterval(handle)
                isStreaming = false
                return
            }
            line++
            const target = messages[messages.length - 1]
            if (target && target.id === id) {
                target.content = `${target.content}\nline ${line}`
            }
        }, 16)
    }

    onMount(() => {
        const cleanups: Array<() => void> = []

        try {
            const po = new PerformanceObserver((list) => {
                const now = performance.now()
                for (const entry of list.getEntries()) {
                    longTaskEntries.push({ time: now, duration: entry.duration })
                }
            })
            po.observe({ entryTypes: ['longtask'] })
            cleanups.push(() => po.disconnect())
        } catch {
            longTaskSupported = false
        }

        const wrapper = document.querySelector('[data-testid="chat-wrapper"]')
        if (wrapper) {
            const mo = new MutationObserver((records) => {
                mutationEvents.push({ time: performance.now(), count: records.length })
            })
            mo.observe(wrapper, { childList: true, subtree: true, characterData: true })
            cleanups.push(() => mo.disconnect())
        }

        let rafId = 0
        let lastRaf = performance.now()
        let firstSampleSeen = false
        const tick = (now: number) => {
            const delta = now - lastRaf
            lastRaf = now
            if (firstSampleSeen) {
                rafIntervals.push({ time: now, delta })
            } else {
                firstSampleSeen = true
            }
            rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)
        cleanups.push(() => cancelAnimationFrame(rafId))

        const refreshHandle = setInterval(() => {
            const now = performance.now()
            const cutoff = now - ROLLING_WINDOW_MS

            longTaskEntries = longTaskEntries.filter((e) => e.time >= cutoff)
            rafIntervals = rafIntervals.filter((e) => e.time >= cutoff)
            mutationEvents = mutationEvents.filter((e) => e.time >= cutoff)

            let longest = 0
            let longCount = 0
            for (const e of longTaskEntries) {
                if (e.duration > longest) longest = e.duration
                if (e.duration > LONG_TASK_THRESHOLD_MS) longCount++
            }
            displayLongestTaskMs = Math.round(longest)
            displayLongTaskCount = longCount

            if (rafIntervals.length > 0) {
                const sorted = rafIntervals.map((e) => e.delta).sort((a, b) => a - b)
                const idx = Math.floor(0.95 * sorted.length)
                displayRafP95Ms = Math.round(sorted[Math.min(idx, sorted.length - 1)] * 10) / 10
            } else {
                displayRafP95Ms = 0
            }

            let mutCount = 0
            for (const e of mutationEvents) mutCount += e.count
            displayMutationCount = mutCount
        }, 250)
        cleanups.push(() => clearInterval(refreshHandle))

        return () => {
            for (const fn of cleanups) fn()
        }
    })
</script>

<svelte:head>
    <title>Test: Performance baseline</title>
</svelte:head>

<div class="flex h-screen flex-col p-4">
    <h1 class="mb-2 text-lg font-semibold">Test: Performance baseline</h1>
    <p class="mb-3 text-sm text-gray-500">
        Captures rolling-10s metrics — longtask, rAF interval p95, MutationObserver churn — for the
        optimization tier work. The first ~1s after a Load click is warmup (the synchronous batch is
        itself a longtask spike); steady-state numbers are what to compare across changes.
    </p>

    <div class="mb-3 flex flex-wrap gap-2">
        <button
            onclick={() => load(500)}
            data-testid="load-500"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            Load 500
        </button>
        <button
            onclick={() => load(2000)}
            data-testid="load-2000"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            Load 2,000
        </button>
        <button
            onclick={() => load(5000)}
            data-testid="load-5000"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
        >
            Load 5,000
        </button>
        <button
            onclick={startStreamSim}
            disabled={isStreaming}
            data-testid="stream-sim"
            class="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
            {isStreaming ? 'Streaming…' : 'Stream simulation (5s)'}
        </button>
        <button
            onclick={clear}
            data-testid="clear"
            class="rounded bg-gray-500 px-3 py-1 text-sm text-white"
        >
            Clear
        </button>
    </div>

    <div class="mb-2 font-mono text-xs text-gray-600" data-testid="debug-stats">
        {#if debugInfo}
            total={debugInfo.totalMessages} dom={debugInfo.renderedCount} measured={debugInfo.measuredCount}
            following={debugInfo.isFollowingBottom}
        {:else}
            total=0 dom=0
        {/if}
        · longestTaskMs={longTaskSupported ? displayLongestTaskMs : 'n/a'}
        longTasks10s={longTaskSupported ? displayLongTaskCount : 'n/a'}
        rafP95={displayRafP95Ms}ms mutations10s={displayMutationCount}
    </div>

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
        </SvelteVirtualChat>
    </div>
</div>
