<script lang="ts" generics="TMessage">
    import type { SvelteVirtualChatProps, SvelteVirtualChatDebugInfo } from './types.js'
    import type { VisibleRange } from './virtual-chat/chatTypes.js'
    import {
        ChatHeightCache,
        calculateTotalHeight,
        calculateOffsetForIndex
    } from './virtual-chat/chatMeasurement.svelte.js'

    let {
        messages,
        getMessageId,
        estimatedMessageHeight = 72,
        followBottomThresholdPx = 48,
        overscan = 6,
        renderMessage,
        onNeedHistory,
        onFollowBottomChange,
        onDebugInfo,
        containerClass = '',
        viewportClass = '',
        testId
    }: SvelteVirtualChatProps<TMessage> = $props()

    // ── DOM refs ────────────────────────────────────────────────────
    let viewportEl: HTMLDivElement | undefined = $state()

    // ── Core state ──────────────────────────────────────────────────
    const heightCache = new ChatHeightCache()
    let scrollTop = $state(0)
    let viewportHeight = $state(0)
    let isFollowingBottom = $state(true)
    let pendingSnapToBottom = $state(false)
    let userScrolling = false
    let userScrollTimer: ReturnType<typeof setTimeout> | null = null

    // ── Derived: total content height ───────────────────────────────
    const totalHeight = $derived.by(() => {
        void heightCache.version
        return calculateTotalHeight(messages, getMessageId, heightCache, estimatedMessageHeight)
    })

    // ── Derived: top gap for bottom-gravity ─────────────────────────
    // When content is shorter than viewport, push messages to the bottom
    const topGap = $derived(Math.max(0, viewportHeight - totalHeight))

    // ── Derived: visible range ──────────────────────────────────────
    const visibleRange: VisibleRange = $derived.by(() => {
        void heightCache.version

        if (messages.length === 0 || viewportHeight === 0) {
            return { start: 0, end: 0, visibleStart: 0, visibleEnd: 0 }
        }

        // scrollTop is relative to the full content area (which includes topGap)
        // Adjust to get the scroll position relative to the message content
        const messageScrollTop = Math.max(0, scrollTop - topGap)
        const viewTop = messageScrollTop
        const viewBottom = messageScrollTop + viewportHeight

        let offsetY = 0
        let visibleStart = -1
        let visibleEnd = -1

        for (let i = 0; i < messages.length; i++) {
            const id = getMessageId(messages[i])
            const h = heightCache.get(id) ?? estimatedMessageHeight
            const itemTop = offsetY
            const itemBottom = offsetY + h

            if (itemBottom > viewTop && visibleStart === -1) {
                visibleStart = i
            }
            if (itemTop < viewBottom) {
                visibleEnd = i
            }

            offsetY += h
        }

        if (visibleStart === -1) visibleStart = 0
        if (visibleEnd === -1) visibleEnd = 0

        const start = Math.max(0, visibleStart - overscan)
        const end = Math.min(messages.length - 1, visibleEnd + overscan)

        return { start, end, visibleStart, visibleEnd }
    })

    // ── Derived: offset for the first rendered item ─────────────────
    const startOffset = $derived.by(() => {
        void heightCache.version
        return calculateOffsetForIndex(
            messages,
            visibleRange.start,
            getMessageId,
            heightCache,
            estimatedMessageHeight
        )
    })

    // ── Derived: slice of messages to render ────────────────────────
    const renderedMessages = $derived(
        messages.length === 0 ? [] : messages.slice(visibleRange.start, visibleRange.end + 1)
    )

    // ── Scroll event handler ────────────────────────────────────────
    function handleScroll() {
        if (!viewportEl) return
        scrollTop = viewportEl.scrollTop

        // Mark that the user is actively scrolling.
        // This suppresses programmatic snaps so they don't fight the user.
        userScrolling = true
        if (userScrollTimer) clearTimeout(userScrollTimer)
        userScrollTimer = setTimeout(() => {
            userScrolling = false
        }, 150)

        const maxScroll = viewportEl.scrollHeight - viewportEl.clientHeight
        const wasFollowing = isFollowingBottom
        isFollowingBottom = maxScroll <= 0 || maxScroll - scrollTop <= followBottomThresholdPx

        if (wasFollowing !== isFollowingBottom) {
            onFollowBottomChange?.(isFollowingBottom)
        }

        // Trigger history loading when near top
        if (onNeedHistory && scrollTop - topGap < viewportHeight * 0.5) {
            onNeedHistory()
        }
    }

    // ── Measurement action ──────────────────────────────────────────
    let snapNeeded = false

    function scheduleSnapToBottom() {
        if (!isFollowingBottom || !viewportEl) return
        // Don't fight the user — if they're actively scrolling, skip the snap.
        // The scroll handler will re-evaluate isFollowingBottom.
        if (userScrolling) return
        snapNeeded = true
        if (pendingSnapToBottom) return // rAF already scheduled, it will re-check
        pendingSnapToBottom = true
        requestAnimationFrame(() => {
            pendingSnapToBottom = false
            if (snapNeeded && isFollowingBottom && !userScrolling) {
                snapNeeded = false
                snapToBottom()
            }
        })
    }

    function measureMessage(node: HTMLElement, messageId: string) {
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
                if (height > 0) {
                    const changed = heightCache.set(messageId, height)
                    if (changed) {
                        scheduleSnapToBottom()
                    }
                }
            }
        })
        observer.observe(node)

        return {
            update(newMessageId: string) {
                if (newMessageId !== messageId) {
                    messageId = newMessageId
                    const height = node.getBoundingClientRect().height
                    if (height > 0) {
                        heightCache.set(messageId, height)
                    }
                }
            },
            destroy() {
                observer.disconnect()
            }
        }
    }

    // ── Snap to bottom helper ───────────────────────────────────────
    function snapToBottom() {
        if (!viewportEl) return
        const maxScroll = viewportEl.scrollHeight - viewportEl.clientHeight
        if (maxScroll > 0) {
            viewportEl.scrollTop = viewportEl.scrollHeight
        }
        // Sync the following state directly (don't wait for scroll event)
        scrollTop = viewportEl.scrollTop
        isFollowingBottom = true
    }

    // ── Follow-bottom on new messages ───────────────────────────────
    $effect(() => {
        void messages.length
        if (isFollowingBottom && viewportEl && !userScrolling) {
            requestAnimationFrame(() => {
                if (isFollowingBottom && !userScrolling) {
                    snapToBottom()
                }
            })
        }
    })

    // ── Follow-bottom on height changes ─────────────────────────────
    // When measurements arrive, totalHeight changes. If following, re-snap.
    $effect(() => {
        void totalHeight
        if (isFollowingBottom && viewportEl) {
            scheduleSnapToBottom()
        }
    })

    // ── Viewport resize tracking ────────────────────────────────────
    $effect(() => {
        if (!viewportEl) return
        viewportHeight = viewportEl.clientHeight

        const observer = new ResizeObserver(() => {
            if (viewportEl) {
                viewportHeight = viewportEl.clientHeight
                // On initial layout (or resize), snap to bottom if following
                if (isFollowingBottom) {
                    requestAnimationFrame(() => snapToBottom())
                }
            }
        })
        observer.observe(viewportEl)
        return () => observer.disconnect()
    })

    // ── Debug info builder ─────────────────────────────────────────
    function buildDebugInfo(): SvelteVirtualChatDebugInfo {
        const measuredCount = heightCache.size
        return {
            totalMessages: messages.length,
            renderedCount: renderedMessages.length,
            measuredCount,
            startIndex: visibleRange.start,
            endIndex: visibleRange.end,
            totalHeight,
            scrollTop,
            viewportHeight,
            isFollowingBottom,
            averageHeight:
                measuredCount > 0
                    ? Math.round(totalHeight / messages.length)
                    : estimatedMessageHeight
        }
    }

    // ── Debug effect: log + callback ────────────────────────────────
    $effect(() => {
        void renderedMessages.length
        void heightCache.version
        void scrollTop
        void isFollowingBottom

        const info = buildDebugInfo()
        onDebugInfo?.(info)
    })

    // ── Public API ──────────────────────────────────────────────────

    export function scrollToBottom(options?: { smooth?: boolean }) {
        if (!viewportEl) return
        viewportEl.scrollTo({
            top: viewportEl.scrollHeight,
            behavior: options?.smooth ? 'smooth' : 'instant'
        })
    }

    export function scrollToMessage(id: string, options?: { smooth?: boolean }) {
        const index = messages.findIndex((m) => getMessageId(m) === id)
        if (index === -1) return

        const offset =
            topGap +
            calculateOffsetForIndex(
                messages,
                index,
                getMessageId,
                heightCache,
                estimatedMessageHeight
            )

        viewportEl?.scrollTo({
            top: offset,
            behavior: options?.smooth ? 'smooth' : 'instant'
        })
    }

    export function isAtBottom(): boolean {
        return isFollowingBottom
    }

    export function getDebugInfo(): SvelteVirtualChatDebugInfo {
        return buildDebugInfo()
    }
</script>

<div
    class={containerClass}
    data-testid={testId ? `${testId}-container` : undefined}
    style="display: flex; flex-direction: column; overflow: hidden;"
>
    <div
        bind:this={viewportEl}
        class={viewportClass}
        onscroll={handleScroll}
        style="overflow-y: auto; flex: 1 1 0%; min-height: 0;"
        data-testid={testId ? `${testId}-viewport` : undefined}
    >
        <div
            style="min-height: 100%; position: relative; width: 100%; display: flex; flex-direction: column; justify-content: flex-end;"
            data-testid={testId ? `${testId}-content` : undefined}
        >
            <div style="height: {totalHeight}px; position: relative; flex-shrink: 0;">
                <div
                    style="position: absolute; top: 0; left: 0; right: 0; transform: translateY({startOffset}px);"
                >
                    {#each renderedMessages as message, i (getMessageId(message))}
                        {@const globalIndex = visibleRange.start + i}
                        <div
                            use:measureMessage={getMessageId(message)}
                            data-testid={testId ? `${testId}-item-${globalIndex}` : undefined}
                            data-message-id={getMessageId(message)}
                        >
                            {@render renderMessage(message, globalIndex)}
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    </div>
</div>
