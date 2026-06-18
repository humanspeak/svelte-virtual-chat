# SvelteVirtualChat

## Overview

SvelteVirtualChat is a Svelte 5 component that virtualizes chat message rendering.
Only visible messages exist in the DOM. The component handles follow-bottom
behavior, LLM token streaming stability, and history prepend with scroll anchor
preservation.

## Key Features

- Bottom gravity: messages sit at the bottom of the viewport
- Follow-bottom: viewport stays pinned to newest message
- Scroll-away: new messages do not snap back when scrolled up
- Virtualized: about 20 DOM nodes regardless of message count
- Streaming-native: height changes batched per animation frame
- History prepend: load older messages without viewport jump
- Message-aware: uses IDs, not array indices
- TypeScript with generics
- Svelte 5 runes and snippets

## Installation

```sh
pnpm add @humanspeak/svelte-virtual-chat
```

## Basic Usage

```svelte
<script lang="ts">
    import SvelteVirtualChat from '@humanspeak/svelte-virtual-chat'

    type Message = { id: string; content: string }

    const messages: Message[] = [
        { id: '1', content: 'Hello' },
        { id: '2', content: 'How can I help?' }
    ]
</script>

<SvelteVirtualChat
    {messages}
    getMessageId={(msg) => msg.id}
    estimatedMessageHeight={72}
    containerClass="h-[600px]"
    viewportClass="h-full"
>
    {#snippet renderMessage(message, index)}
        <div class="p-4">{message.content}</div>
    {/snippet}
</SvelteVirtualChat>
```

## Props

- messages: TMessage[] - chronological message array
- getMessageId: (msg) => string - unique ID extractor
- renderMessage: Snippet - message renderer
- estimatedMessageHeight: number, default 72
- followBottomThresholdPx: number, default 48
- overscan: number, default 6
- onNeedHistory: () => void - called near top for history loading
- onFollowBottomChange: (following) => void
- onDebugInfo: (info) => void - live virtualization stats
- containerClass, viewportClass: string
- testId: string

## Imperative API

- scrollToBottom({ smooth?: boolean })
- scrollToMessage(id, { smooth?: boolean })
- isAtBottom(): boolean
- getDebugInfo(): SvelteVirtualChatDebugInfo

## Companion Libraries

- @humanspeak/svelte-markdown - Markdown renderer with LLM streaming mode
- @humanspeak/svelte-virtual-list - General-purpose virtual list

## Package Links

- npm: [@humanspeak/svelte-virtual-chat](https://www.npmjs.com/package/@humanspeak/svelte-virtual-chat)
- GitHub: [humanspeak/svelte-virtual-chat](https://github.com/humanspeak/svelte-virtual-chat)
- Docs: [virtualchat.svelte.page](https://virtualchat.svelte.page)
