# @humanspeak/svelte-virtual-chat

A high-performance virtual chat viewport for Svelte 5. Purpose-built for LLM conversations, support chat, and any message-based UI. Renders only visible messages to the DOM while maintaining smooth follow-bottom behavior, streaming stability, and history prepend with anchor preservation.

[![NPM version](https://img.shields.io/npm/v/@humanspeak/svelte-virtual-chat.svg)](https://www.npmjs.com/package/@humanspeak/svelte-virtual-chat)
[![Build Status](https://github.com/humanspeak/svelte-virtual-chat/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/humanspeak/svelte-virtual-chat/actions/workflows/npm-publish.yml)
[![License](https://img.shields.io/npm/l/@humanspeak/svelte-virtual-chat.svg)](https://github.com/humanspeak/svelte-virtual-chat/blob/main/LICENSE)
[![Downloads](https://img.shields.io/npm/dm/@humanspeak/svelte-virtual-chat.svg)](https://www.npmjs.com/package/@humanspeak/svelte-virtual-chat)
[![Install size](https://packagephobia.com/badge?p=@humanspeak/svelte-virtual-chat)](https://packagephobia.com/result?p=@humanspeak/svelte-virtual-chat)
[![Code Style: Trunk](https://img.shields.io/badge/code%20style-trunk-blue.svg)](https://trunk.io)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![Types](https://img.shields.io/npm/types/@humanspeak/svelte-virtual-chat.svg)](https://www.npmjs.com/package/@humanspeak/svelte-virtual-chat)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/humanspeak/svelte-virtual-chat/graphs/commit-activity)

## Why This Exists

Chat UIs are not generic lists. They have specific behaviors that general-purpose virtual list components handle poorly:

- Messages anchor to the **bottom**, not the top
- New messages should **auto-scroll** when you're at the bottom
- Scrolling away should **not snap you back** when new messages arrive
- LLM token streaming causes messages to **grow in height** mid-render
- Loading older history should **preserve your scroll position**

`@humanspeak/svelte-virtual-chat` is opinionated about these behaviors so you don't have to fight a generic abstraction.

## Features

- **Bottom gravity** — messages sit at the bottom of the viewport, like every chat app
- **Follow-bottom** — viewport stays pinned to the newest message while at bottom
- **Scroll-away stability** — new messages don't yank you back when you've scrolled up
- **Virtualized rendering** — only visible messages exist in the DOM (handles 10,000+ messages)
- **Streaming-native** — height changes from LLM token streaming are batched per frame
- **History prepend** — load older messages at the top without viewport jumping
- **Message-aware** — uses message IDs for identity, not array indices
- **Full TypeScript** — strict types, generics, and exported type definitions
- **Svelte 5 runes** — built with `$state`, `$derived`, `$effect`, and snippets
- **Debug info** — real-time stats via `onDebugInfo` callback (total, DOM count, measured, range, following state)
- **E2E tested** — 57 Playwright tests across 6 test suites
- **Zero dependencies** — only `esm-env` for SSR detection

## Requirements

- Svelte 5
- Node.js 18+

## Installation

```bash
# Using pnpm (recommended)
pnpm add @humanspeak/svelte-virtual-chat

# Using npm
npm install @humanspeak/svelte-virtual-chat

# Using yarn
yarn add @humanspeak/svelte-virtual-chat
```

## Basic Usage

```svelte
<script lang="ts">
    import SvelteVirtualChat from '@humanspeak/svelte-virtual-chat'

    type Message = { id: string; role: string; content: string }

    let messages: Message[] = $state([
        { id: '1', role: 'assistant', content: 'Hello! How can I help?' },
        { id: '2', role: 'user', content: 'Tell me about Svelte.' }
    ])
</script>

<div class="h-[600px]">
    <SvelteVirtualChat
        {messages}
        getMessageId={(msg) => msg.id}
        estimatedMessageHeight={72}
        containerClass="h-full"
        viewportClass="h-full"
    >
        {#snippet renderMessage(message, index)}
            <div class="p-4 border-b">
                <strong>{message.role}</strong>
                <p>{message.content}</p>
            </div>
        {/snippet}
    </SvelteVirtualChat>
</div>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `messages` | `TMessage[]` | Required | Array of messages in chronological order (oldest first) |
| `getMessageId` | `(msg: TMessage) => string` | Required | Extract a unique, stable ID from a message |
| `renderMessage` | `Snippet<[TMessage, number]>` | Required | Snippet that renders a single message |
| `estimatedMessageHeight` | `number` | `72` | Height estimate in pixels for unmeasured messages |
| `followBottomThresholdPx` | `number` | `48` | Distance from bottom to consider "at bottom" |
| `overscan` | `number` | `6` | Extra messages rendered above/below the viewport |
| `onNeedHistory` | `() => void \| Promise<void>` | - | Called when user scrolls near top (load older messages) |
| `onFollowBottomChange` | `(isFollowing: boolean) => void` | - | Called when follow-bottom state changes |
| `onDebugInfo` | `(info: SvelteVirtualChatDebugInfo) => void` | - | Called with live stats on every scroll/render update |
| `containerClass` | `string` | `''` | CSS class for the outermost container |
| `viewportClass` | `string` | `''` | CSS class for the scrollable viewport |
| `debug` | `boolean` | `false` | Enable console debug logging |
| `testId` | `string` | - | Base test ID for `data-testid` attributes |

## Imperative API

Bind the component to access these methods:

```svelte
<script lang="ts">
    let chat: ReturnType<typeof SvelteVirtualChat>
</script>

<SvelteVirtualChat bind:this={chat} ... />

<button onclick={() => chat.scrollToBottom({ smooth: true })}>
    Scroll to bottom
</button>
```

| Method | Signature | Description |
| --- | --- | --- |
| `scrollToBottom` | `(options?: { smooth?: boolean }) => void` | Scroll the viewport to the bottom |
| `scrollToMessage` | `(id: string, options?: { smooth?: boolean }) => void` | Scroll to a specific message by its ID |
| `isAtBottom` | `() => boolean` | Check if the viewport is currently following bottom |
| `getDebugInfo` | `() => SvelteVirtualChatDebugInfo` | Get a snapshot of current debug stats |

## LLM Streaming

The component handles streaming natively. As a message grows token by token, ResizeObserver detects the height change and the viewport stays pinned to bottom without jitter.

Pair with [@humanspeak/svelte-markdown](https://www.npmjs.com/package/@humanspeak/svelte-markdown) for rich markdown rendering with streaming support:

```svelte
<script lang="ts">
    import SvelteVirtualChat from '@humanspeak/svelte-virtual-chat'
    import SvelteMarkdown from '@humanspeak/svelte-markdown'

    type Message = {
        id: string
        role: 'user' | 'assistant'
        content: string
        isStreaming?: boolean
    }

    let messages: Message[] = $state([...])
</script>

<SvelteVirtualChat
    {messages}
    getMessageId={(msg) => msg.id}
    containerClass="h-[600px]"
    viewportClass="h-full"
>
    {#snippet renderMessage(message, index)}
        <div class="p-4 border-b">
            {#if message.role === 'assistant'}
                <SvelteMarkdown
                    source={message.content}
                    streaming={message.isStreaming ?? false}
                />
            {:else}
                <p>{message.content}</p>
            {/if}
        </div>
    {/snippet}
</SvelteVirtualChat>
```

## History Loading

Load older messages when the user scrolls near the top. The component preserves the user's scroll position during prepend operations.

```svelte
<script lang="ts">
    import SvelteVirtualChat from '@humanspeak/svelte-virtual-chat'

    let messages = $state([...recentMessages])
    let isLoading = false

    async function loadHistory() {
        if (isLoading) return
        isLoading = true
        const older = await fetchOlderMessages()
        messages = [...older, ...messages]
        isLoading = false
    }
</script>

<SvelteVirtualChat
    {messages}
    getMessageId={(msg) => msg.id}
    onNeedHistory={loadHistory}
    containerClass="h-[600px]"
    viewportClass="h-full"
>
    {#snippet renderMessage(message, index)}
        <div class="p-4">{message.content}</div>
    {/snippet}
</SvelteVirtualChat>
```

## Debug Info

The `onDebugInfo` callback provides real-time visibility into the component's internal state:

```svelte
<script lang="ts">
    import SvelteVirtualChat from '@humanspeak/svelte-virtual-chat'
    import type { SvelteVirtualChatDebugInfo } from '@humanspeak/svelte-virtual-chat'

    let stats: SvelteVirtualChatDebugInfo | null = $state(null)
</script>

<SvelteVirtualChat
    {messages}
    getMessageId={(msg) => msg.id}
    onDebugInfo={(info) => (stats = info)}
    ...
/>

{#if stats}
    <div>
        Total: {stats.totalMessages} |
        In DOM: {stats.renderedCount} |
        Following: {stats.isFollowingBottom}
    </div>
{/if}
```

| Field | Type | Description |
| --- | --- | --- |
| `totalMessages` | `number` | Total messages in the array |
| `renderedCount` | `number` | Messages currently in the DOM |
| `measuredCount` | `number` | Messages with measured heights |
| `startIndex` | `number` | First rendered index |
| `endIndex` | `number` | Last rendered index |
| `totalHeight` | `number` | Calculated total content height (px) |
| `scrollTop` | `number` | Current scroll position (px) |
| `viewportHeight` | `number` | Viewport height (px) |
| `isFollowingBottom` | `boolean` | Whether the viewport is pinned to bottom |
| `averageHeight` | `number` | Average measured message height (px) |

## TypeScript

Full type exports for building typed wrappers and extensions:

```typescript
import type {
    SvelteVirtualChatProps,
    SvelteVirtualChatDebugInfo,
    ScrollToBottomOptions,
    ScrollToMessageOptions,
    VisibleRange,
    ScrollAnchor
} from '@humanspeak/svelte-virtual-chat'

// Utility exports
import { ChatHeightCache, captureScrollAnchor, restoreScrollAnchor } from '@humanspeak/svelte-virtual-chat'
```

## How Virtualization Works

The component uses standard top-to-bottom geometry (no inverted lists):

1. **Height caching** — Each message's height is measured via ResizeObserver and cached by ID
2. **Visible range** — On every scroll, the component calculates which messages fall within `scrollTop` to `scrollTop + viewportHeight`, plus an overscan buffer
3. **Absolute positioning** — Only visible messages are rendered, positioned via `transform: translateY()` inside a content div sized to the total calculated height
4. **Follow-bottom** — When at bottom, new messages and height changes trigger an automatic snap to `scrollHeight`
5. **Bottom gravity** — When messages don't fill the viewport, `flex-direction: column; justify-content: flex-end` pushes them to the bottom

With 10,000 messages, the DOM contains ~15-25 elements instead of 10,000.

## Performance

| Metric | Value |
| --- | --- |
| DOM nodes with 1,000 messages | ~15-25 (viewport + overscan) |
| DOM nodes with 10,000 messages | ~15-25 (same) |
| Follow-bottom snap | Single `requestAnimationFrame` per batch |
| Height measurement | ResizeObserver (no polling) |
| Streaming height updates | Batched per animation frame |

## Companion Libraries

| Package | Description |
| --- | --- |
| [@humanspeak/svelte-markdown](https://www.npmjs.com/package/@humanspeak/svelte-markdown) | Markdown renderer with LLM streaming mode (~1.6ms per update) |
| [@humanspeak/svelte-virtual-list](https://www.npmjs.com/package/@humanspeak/svelte-virtual-list) | General-purpose virtual list for non-chat use cases |

## License

MIT © [Humanspeak, Inc.](LICENSE)

## Credits

Made with ❤️ by [Humanspeak](https://humanspeak.com)
