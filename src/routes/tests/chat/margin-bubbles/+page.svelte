<script lang="ts">
    import SvelteVirtualChat from '$lib/index.js'
    import type { SvelteVirtualChatDebugInfo } from '$lib/types.js'
    import { onMount } from 'svelte'
    import { SweepMonitor } from '../sweepMonitor.svelte.js'

    /**
     * Margin-bubbles fixture: every message is a fixed 200px bubble with
     * `margin: 12px 0` — the near-universal chat-bubble spacing style. The
     * real visual pitch is 212px (adjacent 12px margins collapse), while a
     * border-box measurement of the wrapper reads 200px: pre-fix (#47) the
     * margins collapsed through the unstyled wrappers and escaped the
     * geometry math entirely.
     *
     * `estimatedMessageHeight` is set to exactly the border-box height
     * (200), so estimate-vs-measured corrections (#44) are fully out of
     * play: any drift or painted jump here is caused by margins alone.
     *
     * The stats line reports:
     * - realPitchPx vs cachePitchPx: offsetTop delta between adjacent
     *   rendered wrappers vs the height the cache recorded, derived from
     *   totalHeight (marginLossPx = the gap).
     * - The shared SweepMonitor's jump accounting (see sweepMonitor.svelte.ts
     *   for the paint-aligned technique).
     * - scrollHeightDriftPx: the known bounded leading-margin error — the
     *   first wrapper's collapsed top margin belongs to no pitch, so
     *   totalHeight runs short by at most one margin, a constant.
     */

    type Message = {
        id: string
        role: 'user' | 'assistant'
    }

    const BUBBLE_PX = 200
    const BUBBLE_MARGIN_PX = 12
    const SEED_COUNT = 50
    const VIEWPORT_SELECTOR = '[data-testid="chat-viewport"]'

    const messages: Message[] = Array.from({ length: SEED_COUNT }, (_, i) => ({
        id: String(i + 1),
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const)
    }))

    const sweep = new SweepMonitor()
    let debugInfo: SvelteVirtualChatDebugInfo | null = $state(null)
    let realPitchPx = $state(0)
    let cachePitchPx = $state(0)
    let scrollHeightDriftPx = $state(0)

    const getViewport = () => document.querySelector(VIEWPORT_SELECTOR) as HTMLElement | null

    /** Compare the real rendered pitch against what the height cache sees. */
    function measurePitch() {
        const viewport = getViewport()
        if (!viewport || !debugInfo) return
        const wrappers = [...viewport.querySelectorAll('[data-message-id]')] as HTMLElement[]
        if (wrappers.length >= 2) {
            realPitchPx = Math.round(
                wrappers[1].getBoundingClientRect().top - wrappers[0].getBoundingClientRect().top
            )
        }
        if (debugInfo.measuredCount > 0) {
            // The cache's average recorded height for measured messages —
            // unmeasured ones sit at the estimate (BUBBLE_PX) by definition,
            // so subtract them out of totalHeight first. All bubbles are
            // identical, so this equals the per-message recorded pitch.
            const unmeasured = debugInfo.totalMessages - debugInfo.measuredCount
            cachePitchPx = Math.round(
                (debugInfo.totalHeight - unmeasured * BUBBLE_PX) / debugInfo.measuredCount
            )
        }
        scrollHeightDriftPx = Math.round(
            viewport.scrollHeight - Math.max(viewport.clientHeight, debugInfo.totalHeight)
        )
    }

    onMount(() => () => sweep.destroy())
</script>

<div class="p-4">
    <h1 class="mb-2 text-lg font-semibold">
        Test: Margin bubbles ({BUBBLE_PX}px bubbles, {BUBBLE_MARGIN_PX}px margins)
    </h1>
    <p class="mb-3 text-sm text-gray-500">
        Real visual pitch is {BUBBLE_PX + BUBBLE_MARGIN_PX}px; a border-box read of the wrapper
        gives {BUBBLE_PX}px — pre-fix the collapsed margins escaped measurement. Estimates match the
        border box exactly, so every number below is margin accounting only.
    </p>

    <div class="mb-3 flex gap-2">
        <button
            onclick={() => sweep.start('up', { onDone: measurePitch })}
            data-testid="start-sweep"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
            disabled={sweep.state === 'running'}
        >
            Scroll-up sweep
        </button>
        <button
            onclick={() => sweep.start('down', { onDone: measurePitch })}
            data-testid="start-sweep-down"
            class="rounded bg-blue-500 px-3 py-1 text-sm text-white"
            disabled={sweep.state === 'running'}
        >
            Scroll-down sweep
        </button>
    </div>

    {#if debugInfo}
        <div class="mb-3 font-mono text-xs text-gray-600" data-testid="debug-stats">
            total={debugInfo.totalMessages}
            dom={debugInfo.renderedCount}
            measured={debugInfo.measuredCount}
            following={debugInfo.isFollowingBottom}
            height={Math.round(debugInfo.totalHeight)}px cachePitchPx={cachePitchPx}
            realPitchPx={realPitchPx}
            marginLossPx={realPitchPx > 0 && cachePitchPx > 0 ? realPitchPx - cachePitchPx : 0}
            scrollHeightDriftPx={scrollHeightDriftPx}
            sweep={sweep.state}
            sweepFrames={sweep.frames}
            jumps={sweep.jumps}
            maxJumpPx={sweep.maxJumpPx}
            totalJumpPx={sweep.totalJumpPx}
        </div>
    {/if}

    <div
        class="rounded-lg border-2 border-gray-300"
        style="height: 480px;"
        data-testid="chat-wrapper"
    >
        <SvelteVirtualChat
            {messages}
            getMessageId={(msg: Message) => msg.id}
            estimatedMessageHeight={BUBBLE_PX}
            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => {
                debugInfo = info
                // Keep the pitch probe live off every meaningful component
                // update — no timers to race the specs against. Deferred to
                // a microtask: this callback runs inside the component's
                // debug $effect, and synchronously reading the just-written
                // debugInfo state there makes the effect depend on state it
                // writes — an infinite update loop.
                queueMicrotask(measurePitch)
            }}
            containerClass="h-full"
            viewportClass="h-full"
            testId="chat"
        >
            {#snippet renderMessage(message: Message, index: number)}
                <div
                    class="rounded-2xl px-4 py-2 font-mono text-xs {message.role === 'user'
                        ? 'ml-auto bg-blue-100 text-blue-900'
                        : 'bg-gray-100 text-gray-700'}"
                    style="height: {BUBBLE_PX}px; margin: {BUBBLE_MARGIN_PX}px 0; max-width: 75%; overflow: hidden; box-sizing: border-box;"
                    data-testid="msg-{message.id}"
                >
                    [{index}] id={message.id} · {message.role}
                </div>
            {/snippet}
        </SvelteVirtualChat>
    </div>
</div>
