<script lang="ts" generics="TMessage">
    import { untrack } from 'svelte'
    import type { SvelteVirtualChatProps, SvelteVirtualChatDebugInfo } from './types.js'
    import {
        ChatHeightCache,
        calculateOffsetForIndex,
        calculateTotalHeight,
        calculateVisibleRange
    } from './virtual-chat/chatMeasurement.svelte.js'
    import { ChatLayoutPreservation } from './virtual-chat/chatLayoutPreservation.js'
    import {
        ChatScrollIntent,
        trackScrollIntent,
        type ChatScrollIntentEvent
    } from './virtual-chat/chatScrollIntent.js'
    import {
        decideFollowBottomAfterScroll,
        isViewportAtBottom,
        type ScrollGeometry
    } from './virtual-chat/chatScrollPolicy.js'
    import { ChatScrollProgressPreserver } from './virtual-chat/chatScrollProgress.js'
    import {
        captureVisualAnchor,
        restoreVisualAnchor,
        type VisualAnchor
    } from './virtual-chat/chatVisualAnchoring.js'

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
        viewportLabel = 'Chat messages',
        testId
    }: SvelteVirtualChatProps<TMessage> = $props()

    // ── DOM refs ────────────────────────────────────────────────────
    let viewportEl: HTMLDivElement | undefined = $state()
    let contentEl: HTMLDivElement | undefined = $state()

    // ── Core state ──────────────────────────────────────────────────
    const heightCache = new ChatHeightCache()
    const layoutPreservation = new ChatLayoutPreservation()
    const scrollProgressPreserver = new ChatScrollProgressPreserver()
    const scrollIntent = new ChatScrollIntent({
        onIntentStart: () => layoutPreservation.end(),
        onIntentEnd: () => {
            if (isFollowingBottom) scheduleSnapToBottom()
        }
    })
    let scrollTop = $state(0)
    let viewportHeight = $state(0)
    let headerHeight = $state(0)
    let footerHeight = $state(0)
    let isFollowingBottom = $state(true)
    let pendingSnapToBottom = $state(false)
    let pendingAnchor: VisualAnchor | null = null
    let pendingProgressPreservation = false
    let explicitKeyboardFollowBottom = false
    let scrollMutationObserver: MutationObserver | null = null

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

    // ── Scroll state + anchor adapters ─────────────────────────────
    const setFollowingBottom = (next: boolean) => {
        const wasFollowing = isFollowingBottom
        isFollowingBottom = next
        if (next) {
            scrollProgressPreserver.reset()
            stopScrollMutationObserver()
        }
        if (wasFollowing !== next) {
            onFollowBottomChange?.(next)
        }
    }

    const captureViewportGeometry = (): ScrollGeometry | null => {
        if (!viewportEl) return null
        return {
            scrollTop: viewportEl.scrollTop,
            scrollHeight: viewportEl.scrollHeight,
            clientHeight: viewportEl.clientHeight
        }
    }

    const isUserScrollPreservationActive = () =>
        scrollIntent.isActive || scrollProgressPreserver.isActive(performance.now())

    const isAtViewportBottom = (geometry: ScrollGeometry | null = captureViewportGeometry()) => {
        if (!geometry) return true
        return isViewportAtBottom(geometry, followBottomThresholdPx)
    }

    const captureCurrentVisualAnchor = (): VisualAnchor | null => {
        if (!viewportEl || messages.length === 0) return null
        return captureVisualAnchor({
            messages,
            getMessageId,
            heightCache,
            estimatedHeight: estimatedMessageHeight,
            visibleStart: visibleRange.visibleStart,
            topGap,
            headerHeight,
            scrollTop: viewportEl.scrollTop
        })
    }

    const handleViewportScrollIntent = (event: ChatScrollIntentEvent) => {
        scrollIntent.mark()
        if (event.direction === 'up') explicitKeyboardFollowBottom = false
        if (!event.direction) return

        const currentGeometry = captureViewportGeometry()
        if (!currentGeometry) return

        scrollProgressPreserver.recordScrollIntent({
            direction: event.direction,
            current: currentGeometry,
            now: performance.now()
        })
        scheduleScrollProgressPreservation()
    }

    const trackViewportScrollIntent = (node: HTMLElement) =>
        trackScrollIntent(node, handleViewportScrollIntent)

    const restoreCurrentVisualAnchor = (anchor: VisualAnchor) => {
        if (!viewportEl) return
        const targetScrollTop = restoreVisualAnchor({
            anchor,
            messages,
            getMessageId,
            heightCache,
            estimatedHeight: estimatedMessageHeight,
            topGap,
            headerHeight
        })
        if (targetScrollTop === null) return
        viewportEl.scrollTop = targetScrollTop
        scrollTop = viewportEl.scrollTop
        setFollowingBottom(isAtViewportBottom())
    }

    const scheduleAnchorRestore = (anchor: VisualAnchor | null) => {
        if (!anchor || !viewportEl || isFollowingBottom || isUserScrollPreservationActive()) return
        // A rAF is in flight iff an anchor is pending; the first anchor wins.
        if (pendingAnchor) return
        pendingAnchor = anchor
        layoutPreservation.begin()
        requestAnimationFrame(() => {
            const anchorToRestore = pendingAnchor
            pendingAnchor = null
            layoutPreservation.end()
            if (anchorToRestore && !isFollowingBottom && !isUserScrollPreservationActive()) {
                restoreCurrentVisualAnchor(anchorToRestore)
            }
        })
    }

    const restoreScrollProgressIfNeeded = (now: number): ScrollGeometry | null => {
        if (!viewportEl) return null

        const currentGeometry = captureViewportGeometry()
        if (!currentGeometry) return null

        const targetScrollTop = scrollProgressPreserver.getPreservationTarget({
            current: currentGeometry,
            now
        })
        if (targetScrollTop === null) return null

        viewportEl.scrollTop = targetScrollTop
        scrollTop = viewportEl.scrollTop

        const adjustedGeometry = captureViewportGeometry()
        if (adjustedGeometry) {
            scrollProgressPreserver.commitAdjustment(adjustedGeometry, now)
        }

        return adjustedGeometry
    }

    /** Snap progress back if needed, then sync follow state off the adjusted geometry. */
    const restoreProgressAndSyncFollow = (now: number) => {
        const adjusted = restoreScrollProgressIfNeeded(now)
        if (adjusted) setFollowingBottom(isAtViewportBottom(adjusted))
    }

    const stopScrollMutationObserver = () => {
        scrollMutationObserver?.disconnect()
        scrollMutationObserver = null
    }

    const startScrollMutationObserver = () => {
        if (!contentEl || scrollMutationObserver) return

        scrollMutationObserver = new MutationObserver(() => {
            if (!isUserScrollPreservationActive()) {
                stopScrollMutationObserver()
                return
            }

            restoreProgressAndSyncFollow(performance.now())
            scheduleScrollProgressPreservation()
        })
        scrollMutationObserver.observe(contentEl, {
            attributes: true,
            childList: true,
            subtree: true
        })
    }

    const scheduleScrollProgressPreservation = () => {
        if (
            !viewportEl ||
            pendingProgressPreservation ||
            (isFollowingBottom && !isUserScrollPreservationActive())
        ) {
            return
        }
        startScrollMutationObserver()
        pendingProgressPreservation = true
        requestAnimationFrame(() => {
            pendingProgressPreservation = false
            if (!viewportEl || (isFollowingBottom && !isUserScrollPreservationActive())) return

            const now = performance.now()
            restoreProgressAndSyncFollow(now)

            if (scrollProgressPreserver.isActive(now)) {
                scheduleScrollProgressPreservation()
            } else {
                stopScrollMutationObserver()
            }
        })
    }

    /** Anchor the first visible message before a layout change, unless pinned to bottom. */
    const captureLayoutAnchor = (): VisualAnchor | null =>
        !isFollowingBottom && !isUserScrollPreservationActive()
            ? captureCurrentVisualAnchor()
            : null

    const handleLayoutHeightChange = (anchor: VisualAnchor | null) => {
        if (explicitKeyboardFollowBottom) {
            setFollowingBottom(true)
            layoutPreservation.begin()
            requestAnimationFrame(() => {
                if (explicitKeyboardFollowBottom) snapToBottom()
            })
            return
        }

        if (isUserScrollPreservationActive()) {
            restoreProgressAndSyncFollow(performance.now())
        }

        if (isFollowingBottom) {
            if (isUserScrollPreservationActive()) {
                scheduleScrollProgressPreservation()
            } else {
                layoutPreservation.begin()
                scheduleSnapToBottom()
            }
            return
        }
        scheduleAnchorRestore(anchor)
        scheduleScrollProgressPreservation()
    }

    // ── Scroll event handler ────────────────────────────────────────
    const handleScroll = () => {
        if (!viewportEl) return
        const previousScrollTop = scrollTop
        const currentGeometry = captureViewportGeometry()
        if (!currentGeometry) return
        scrollTop = currentGeometry.scrollTop

        const now = performance.now()
        if (scrollIntent.isActive) {
            scrollProgressPreserver.recordUserScroll({
                previousScrollTop,
                current: currentGeometry,
                now
            })
        }

        restoreScrollProgressIfNeeded(now)

        const decision = decideFollowBottomAfterScroll({
            atBottom: isAtViewportBottom(),
            wasFollowingBottom: isFollowingBottom,
            preservingLayout: layoutPreservation.isActive,
            userScrolling: scrollIntent.isActive && !explicitKeyboardFollowBottom,
            previousScrollTop,
            scrollTop,
            followBottomThresholdPx
        })

        if (decision.shouldEndLayoutPreservation) {
            layoutPreservation.end()
        }
        setFollowingBottom(decision.nextFollowingBottom)
        if (decision.shouldScheduleSnapToBottom) {
            scheduleSnapToBottom()
        }
        scheduleScrollProgressPreservation()

        if (onNeedHistory && scrollTop - topGap < viewportHeight * 0.5) {
            onNeedHistory()
        }
    }

    const handleViewportKeydown = (event: KeyboardEvent) => {
        if (
            !viewportEl ||
            event.defaultPrevented ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
        ) {
            return
        }

        if (event.target !== viewportEl) return

        const isHomeKey = event.key === 'Home' || event.code === 'Home'
        const isEndKey = event.key === 'End' || event.code === 'End'
        const isSpaceKey =
            event.key === ' ' ||
            event.key === 'Space' ||
            event.key === 'Spacebar' ||
            event.code === 'Space'

        const scrollByKeyboard = (delta: number, direction: 'up' | 'down') => {
            const viewport = viewportEl
            if (!viewport) return

            event.preventDefault()
            event.stopImmediatePropagation()
            if (direction === 'up') explicitKeyboardFollowBottom = false
            handleViewportScrollIntent({ direction })
            viewport.scrollTop += delta
            scrollTop = viewport.scrollTop
        }

        if (event.key === 'ArrowUp' || event.code === 'ArrowUp') {
            scrollByKeyboard(-40, 'up')
            return
        }

        if (event.key === 'ArrowDown' || event.code === 'ArrowDown') {
            scrollByKeyboard(40, 'down')
            return
        }

        if (event.key === 'PageUp' || event.code === 'PageUp') {
            scrollByKeyboard(-viewportEl.clientHeight * 0.85, 'up')
            return
        }

        if (event.key === 'PageDown' || event.code === 'PageDown') {
            scrollByKeyboard(viewportEl.clientHeight * 0.85, 'down')
            return
        }

        if (isSpaceKey) {
            scrollByKeyboard(
                viewportEl.clientHeight * 0.85 * (event.shiftKey ? -1 : 1),
                event.shiftKey ? 'up' : 'down'
            )
            return
        }

        if (isHomeKey) {
            event.preventDefault()
            event.stopImmediatePropagation()
            explicitKeyboardFollowBottom = false
            handleViewportScrollIntent({ direction: 'up' })
            viewportEl.scrollTop = 0
            scrollTop = viewportEl.scrollTop
            setFollowingBottom(false)
            scheduleScrollProgressPreservation()
            return
        }

        if (isEndKey) {
            event.preventDefault()
            event.stopImmediatePropagation()
            explicitKeyboardFollowBottom = true
            layoutPreservation.begin()
            handleViewportScrollIntent({ direction: 'down' })
            snapToBottom()
        }
    }

    const handleViewportKeyboard = (node: HTMLElement) => {
        node.addEventListener('keydown', handleViewportKeydown)

        return {
            destroy() {
                node.removeEventListener('keydown', handleViewportKeydown)
            }
        }
    }

    // ── Snap scheduling ─────────────────────────────────────────────
    /** Batches snap-to-bottom into a single rAF, respecting real user scroll intent. */
    const scheduleSnapToBottom = () => {
        if (!isFollowingBottom || !viewportEl || isUserScrollPreservationActive()) return
        if (pendingSnapToBottom) return
        pendingSnapToBottom = true
        requestAnimationFrame(() => {
            pendingSnapToBottom = false
            layoutPreservation.end()
            if (isFollowingBottom && !isUserScrollPreservationActive()) {
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
                if (height > 0 && heightCache.get(messageId) !== height) {
                    // Capture against pre-growth offsets, before `set` dirties the cache.
                    const anchor = captureLayoutAnchor()
                    heightCache.set(messageId, height)
                    handleLayoutHeightChange(anchor)
                }
            }
        })
        observer.observe(node)

        return {
            update(newMessageId: string) {
                // Svelte's keyed `{#each}` block doesn't recycle DOM nodes
                // across different keys, so this path almost never fires in
                // practice. Defensively keep the closed-over `messageId` in
                // sync (the ResizeObserver callback reads it) but skip the
                // sync `getBoundingClientRect()` — the next ResizeObserver
                // fire after layout will re-measure correctly. Sync DOM reads
                // here would force a reflow in any edge case Svelte does
                // recycle a node.
                messageId = newMessageId
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
                    const anchor = captureLayoutAnchor()
                    prev = height
                    setter(height)
                    handleLayoutHeightChange(anchor)
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
        setFollowingBottom(true)
    }

    // ── Follow-bottom on new messages ───────────────────────────────
    $effect(() => {
        void messages.length
        if (isFollowingBottom && viewportEl && !isUserScrollPreservationActive()) {
            layoutPreservation.begin()
            scheduleSnapToBottom()
        }
    })

    // ── Follow-bottom on height changes ─────────────────────────────
    // Height changes during scroll (e.g. newly measured items) respect user-scroll suppression
    $effect(() => {
        void totalHeight
        scheduleSnapToBottom()
    })

    // ── Cleanup scroll timers on destroy ────────────────────────────
    $effect(() => {
        return () => {
            scrollIntent.destroy()
            layoutPreservation.destroy()
            stopScrollMutationObserver()
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

    // Debug-info effect — narrowed to fire only on user-meaningful changes:
    // visible-range crossings, follow-bottom flips, and per-message height
    // mutations (via `heightCache.version`). The 60 Hz scrollTop signal is
    // intentionally excluded — consumers wanting per-pixel scroll updates
    // can poll `getDebugInfo()` directly or wire a separate handler in a
    // future API.
    //
    // `untrack()` keeps `buildDebugInfo()`'s internal reads (scrollTop,
    // totalHeight, etc.) from creating implicit dependencies — without it,
    // narrowing the explicit deps wouldn't matter because the snapshot call
    // would still pick them up.
    // `messages.length` is in the key so consumers using in-place mutation
    // (e.g. `messages.push(...)`) still get an `onDebugInfo` fire — the
    // slice cache from the rendered-messages memoization can otherwise
    // return the same slice across an append, leaving `renderedMessages.length`
    // and `visibleRange` unchanged.
    const debugShape = $derived(
        `${messages.length}|${renderedMessages.length}|${visibleRange.start}|${visibleRange.end}|${isFollowingBottom}|${heightCache.version}`
    )
    $effect(() => {
        void debugShape
        const info = untrack(() => buildDebugInfo())
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
        setFollowingBottom(true)
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

        explicitKeyboardFollowBottom = false
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

        scrollProgressPreserver.reset()
        setFollowingBottom(false)
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
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
        bind:this={viewportEl}
        class={viewportClass}
        onscroll={handleScroll}
        use:handleViewportKeyboard
        use:trackViewportScrollIntent
        style="overflow-y: auto; overflow-anchor: none; flex: 1 1 0%; min-height: 0;"
        data-testid={testId ? `${testId}-viewport` : undefined}
        role="region"
        aria-label={viewportLabel}
        tabindex="0"
    >
        <div
            bind:this={contentEl}
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
