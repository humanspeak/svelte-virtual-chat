import type { Snippet } from 'svelte'

/**
 * Configuration properties for the SvelteVirtualChat component.
 */
/* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
export type SvelteVirtualChatProps<TMessage = any> = {
    /**
     * Array of messages in chronological order (oldest first).
     */
    messages: TMessage[]

    /**
     * Extract a unique, stable identifier from a message.
     * Used for height caching, keyed rendering, and scroll-to-message.
     */
    getMessageId: (_message: TMessage) => string

    /**
     * Estimated height in pixels for messages not yet measured.
     * @default 72
     */
    estimatedMessageHeight?: number

    /**
     * Distance in pixels from the bottom at which the viewport
     * is considered "at bottom" for follow-bottom behavior.
     * @default 48
     */
    followBottomThresholdPx?: number

    /**
     * Number of extra messages to render above and below the visible area.
     * @default 6
     */
    overscan?: number

    /**
     * Snippet that renders a single message.
     * Receives the message object and its index in the messages array.
     */
    renderMessage: Snippet<[message: TMessage, index: number]>

    /**
     * Called when the user scrolls near the top, signaling that older
     * history should be loaded.
     */
    onNeedHistory?: () => void | Promise<void>

    /**
     * Called when the follow-bottom state changes.
     */
    onFollowBottomChange?: (_isFollowing: boolean) => void

    /**
     * Called whenever debug info updates (on scroll, height changes, message changes).
     * Use this to display live stats in your UI.
     */
    onDebugInfo?: (_info: SvelteVirtualChatDebugInfo) => void

    /**
     * Snippet rendered at the top of the scrollable content, above all messages.
     * Always in the DOM (not virtualized). Scrolls with content.
     */
    header?: Snippet

    /**
     * Snippet rendered at the bottom of the scrollable content, below all messages.
     * Always in the DOM (not virtualized). Scrolls with content.
     */
    footer?: Snippet

    /**
     * CSS class for the outermost container element.
     */
    containerClass?: string

    /**
     * CSS class for the scrollable viewport element.
     */
    viewportClass?: string

    /**
     * Enable debug logging and stats.
     * @default false
     */
    debug?: boolean

    /**
     * Base test ID for E2E testing attributes.
     */
    testId?: string
}

/**
 * Debug information emitted by the chat viewport.
 */
export type SvelteVirtualChatDebugInfo = {
    totalMessages: number
    renderedCount: number
    measuredCount: number
    startIndex: number
    endIndex: number
    totalHeight: number
    scrollTop: number
    viewportHeight: number
    isFollowingBottom: boolean
    averageHeight: number
    /**
     * Monotonically-increasing counter of internal height-cache mutations
     * (each measurement, removal, or clear bumps it by exactly 1). Sample
     * the delta over a window to count reactive cascade triggers — the
     * difference between two readings is the number of cache changes in
     * between, useful for benchmarking optimizations that aim to coalesce
     * those changes.
     */
    heightCacheVersion: number
}

/**
 * Options for the scrollToBottom imperative method.
 */
export type ScrollToBottomOptions = {
    /** Use smooth scrolling animation. @default false */
    smooth?: boolean
}

/**
 * Options for the scrollToMessage imperative method.
 */
export type ScrollToMessageOptions = {
    /** Use smooth scrolling animation. @default false */
    smooth?: boolean
}
