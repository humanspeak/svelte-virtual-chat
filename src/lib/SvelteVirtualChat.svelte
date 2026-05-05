<script lang="ts" generics="TMessage">
    import type { SvelteVirtualChatProps, SvelteVirtualChatDebugInfo } from './types.js'
    import {
        ChatHeightCache,
        calculateOffsetForIndex,
        calculateTotalHeight,
        calculateVisibleRange
    } from './virtual-chat/chatMeasurement.svelte.js'

    let {
        messages,
        getMessageId,
        estimatedMessageHeight = 72,
        followBottomThresholdPx = 48,
        overscan = 6,
        renderMessage,
        header,
        footer,
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
    let headerHeight = $state(0)
    let footerHeight = $state(0)
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
    const topGap = $derived(Math.max(0, viewportHeight - totalHeight - headerHeight - footerHeight))

    // ── Derived: visible range ──────────────────────────────────────
    // Touching `heightCache.version` keeps this reactive to per-message
    // height changes. `totalHeight` is reused from the derivation above so
    // we don't walk the message list twice per update.
    const visibleRange = $derived.by(() => {
        void heightCache.version
        return calculateVisibleRange({
            messages,
            getMessageId,
            heightCache,
            estimatedHeight: estimatedMessageHeight,
            totalHeight,
            scrollTop,
            viewportHeight,
            headerHeight,
            footerHeight,
            overscan
        })
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
    // `messages.slice(...)` allocates a fresh array on every reactive update,
    // including pure-scroll deltas where the visible range hasn't moved. At
    // 60fps that's a throwaway array per frame. Memoize the slice and reuse
    // it when the messages reference, both bounds, AND the head/tail still
    // point at the same message instances — that catches append, prepend,
    // whole-array-replace, and consumer-side immutable mid-replace
    // (`messages = [...slice(0,i), newMsg, ...slice(i+1)]` invalidates via
    // the reference check). The remaining gap is in-place mid-replace via
    // `$state` proxy (`messages[i] = newObj` without array reassignment) —
    // catching that would require a per-index walk or a content version,
    // both of which would defeat the optimization on the scroll hot path.
    const EMPTY_SLICE: TMessage[] = []
    let cachedSlice: TMessage[] = []
    let cachedStart = -1
    let cachedEnd = -1
    let cachedMessagesRef: TMessage[] | null = null
    const renderedMessages = $derived.by(() => {
        if (messages.length === 0) return EMPTY_SLICE
        const { start, end } = visibleRange
        const length = end - start + 1
        if (
            messages === cachedMessagesRef &&
            start === cachedStart &&
            end === cachedEnd &&
            cachedSlice.length === length &&
            cachedSlice[0] === messages[start] &&
            cachedSlice[length - 1] === messages[end]
        ) {
            return cachedSlice
        }
        cachedMessagesRef = messages
        cachedStart = start
        cachedEnd = end
        cachedSlice = messages.slice(start, end + 1)
        return cachedSlice
    })

    // ── Scroll event handler ────────────────────────────────────────
    const handleScroll = () => {
        if (!viewportEl) return
        scrollTop = viewportEl.scrollTop

        // Suppress programmatic snaps while the user is actively scrolling
        userScrolling = true
        if (userScrollTimer) clearTimeout(userScrollTimer)
        userScrollTimer = setTimeout(() => {
            userScrolling = false
            // If we're still following bottom after the suppression window,
            // catch up any height changes that arrived while suppressed
            // (e.g. ResizeObserver measurements after a programmatic snap).
            if (isFollowingBottom) scheduleSnapToBottom()
        }, 150)

        const maxScroll = viewportEl.scrollHeight - viewportEl.clientHeight
        const wasFollowing = isFollowingBottom
        isFollowingBottom = maxScroll <= 0 || maxScroll - scrollTop <= followBottomThresholdPx

        if (wasFollowing !== isFollowingBottom) {
            onFollowBottomChange?.(isFollowingBottom)
        }

        if (onNeedHistory && scrollTop - topGap < viewportHeight * 0.5) {
            onNeedHistory()
        }
    }

    // ── Snap scheduling ─────────────────────────────────────────────
    /** Batches snap-to-bottom into a single rAF, respecting user-scroll suppression. */
    const scheduleSnapToBottom = () => {
        if (!isFollowingBottom || !viewportEl || userScrolling) return
        if (pendingSnapToBottom) return
        pendingSnapToBottom = true
        requestAnimationFrame(() => {
            pendingSnapToBottom = false
            if (isFollowingBottom && !userScrolling) {
                snapToBottom()
            }
        })
    }

    // ── Measurement action ──────────────────────────────────────────
    /** Svelte action: attaches a ResizeObserver to track message height changes. */
    const measureMessage = (node: HTMLElement, messageId: string) => {
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

    // ── Element measurement action (header/footer) ───────────────────
    /** Svelte action: attaches a ResizeObserver to track an element's height. */
    const measureElement = (node: HTMLElement, setter: (_h: number) => void) => {
        let prev = 0
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
                if (height !== prev) {
                    prev = height
                    setter(height)
                    scheduleSnapToBottom()
                }
            }
        })
        observer.observe(node)
        return {
            destroy() {
                observer.disconnect()
                setter(0)
            }
        }
    }

    // ── Snap to bottom helper ───────────────────────────────────────
    /** Instantly scrolls viewport to bottom and syncs follow state. */
    const snapToBottom = () => {
        if (!viewportEl) return
        const maxScroll = viewportEl.scrollHeight - viewportEl.clientHeight
        if (maxScroll > 0) {
            viewportEl.scrollTop = viewportEl.scrollHeight
        }
        scrollTop = viewportEl.scrollTop
        isFollowingBottom = true
    }

    // ── Follow-bottom on new messages ───────────────────────────────
    $effect(() => {
        void messages.length
        if (isFollowingBottom && viewportEl) {
            requestAnimationFrame(() => {
                if (isFollowingBottom) snapToBottom()
            })
        }
    })

    // ── Follow-bottom on height changes ─────────────────────────────
    // Height changes during scroll (e.g. newly measured items) respect user-scroll suppression
    $effect(() => {
        void totalHeight
        scheduleSnapToBottom()
    })

    // ── Cleanup user-scroll timer on destroy ────────────────────────
    $effect(() => {
        return () => {
            if (userScrollTimer) clearTimeout(userScrollTimer)
        }
    })

    // ── Viewport resize tracking ────────────────────────────────────
    $effect(() => {
        if (!viewportEl) return
        viewportHeight = viewportEl.clientHeight

        const observer = new ResizeObserver(() => {
            if (viewportEl) {
                viewportHeight = viewportEl.clientHeight
                if (isFollowingBottom) {
                    requestAnimationFrame(() => snapToBottom())
                }
            }
        })
        observer.observe(viewportEl)
        return () => observer.disconnect()
    })

    // ── Debug info ──────────────────────────────────────────────────
    const buildDebugInfo = (): SvelteVirtualChatDebugInfo => {
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
                    : estimatedMessageHeight,
            heightCacheVersion: heightCache.version
        }
    }

    $effect(() => {
        void renderedMessages.length
        void heightCache.version
        void scrollTop
        void isFollowingBottom

        const info = buildDebugInfo()
        onDebugInfo?.(info)
    })

    // ── Public API ──────────────────────────────────────────────────

    /**
     * Scroll the viewport to the bottom.
     *
     * @param options - Optional configuration
     * @param options.smooth - Use smooth scrolling animation (default: false)
     *
     * @example
     * ```ts
     * chat.scrollToBottom()
     * chat.scrollToBottom({ smooth: true })
     * ```
     */
    export const scrollToBottom = (options?: { smooth?: boolean }) => {
        if (!viewportEl) return
        viewportEl.scrollTo({
            top: viewportEl.scrollHeight,
            behavior: options?.smooth ? 'smooth' : 'instant'
        })
    }

    /**
     * Scroll to a specific message by its ID.
     *
     * If the message ID is not found in the messages array, this is a no-op.
     *
     * @param id - The message ID as returned by `getMessageId`
     * @param options - Optional configuration
     * @param options.smooth - Use smooth scrolling animation (default: false)
     *
     * @example
     * ```ts
     * chat.scrollToMessage('msg-42')
     * chat.scrollToMessage('msg-42', { smooth: true })
     * ```
     */
    export const scrollToMessage = (id: string, options?: { smooth?: boolean }) => {
        const index = messages.findIndex((m) => getMessageId(m) === id)
        if (index === -1) return

        const offset =
            topGap +
            headerHeight +
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

    /**
     * Check if the viewport is currently following bottom.
     *
     * Returns `true` when the viewport is within `followBottomThresholdPx`
     * of the bottom, meaning new messages will auto-scroll into view.
     *
     * @returns Whether the viewport is pinned to the bottom
     *
     * @example
     * ```ts
     * if (chat.isAtBottom()) {
     *     // User sees the latest message
     * }
     * ```
     */
    export const isAtBottom = (): boolean => {
        return isFollowingBottom
    }

    /**
     * Get a snapshot of the current internal state.
     *
     * Returns debug information including total messages, rendered DOM count,
     * measured heights, visible range, scroll position, and follow state.
     *
     * @returns Current debug info snapshot
     *
     * @example
     * ```ts
     * const info = chat.getDebugInfo()
     * console.log(`${info.renderedCount}/${info.totalMessages} in DOM`)
     * ```
     */
    export const getDebugInfo = (): SvelteVirtualChatDebugInfo => {
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
            {#if header}
                <div
                    use:measureElement={(h) => (headerHeight = h)}
                    style="flex-shrink: 0;"
                    data-testid={testId ? `${testId}-header` : undefined}
                >
                    {@render header()}
                </div>
            {/if}
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
            {#if footer}
                <div
                    use:measureElement={(h) => (footerHeight = h)}
                    style="flex-shrink: 0;"
                    data-testid={testId ? `${testId}-footer` : undefined}
                >
                    {@render footer()}
                </div>
            {/if}
        </div>
    </div>
</div>
