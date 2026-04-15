import type { DocsKitConfig } from '@humanspeak/docs-kit'

export const docsConfig: DocsKitConfig = {
    name: 'Svelte Virtual Chat',
    slug: 'virtual-chat',
    npmPackage: '@humanspeak/svelte-virtual-chat',
    repo: 'humanspeak/svelte-virtual-chat',
    url: 'https://virtualchat.svelte.page',
    description:
        'A high-performance virtual chat viewport for Svelte 5. Purpose-built for LLM conversations, support chat, and any message-based UI with follow-bottom, streaming stability, and history prepend.',
    keywords: [
        'svelte',
        'virtual-chat',
        'chat-ui',
        'llm',
        'virtual-scroll',
        'streaming',
        'svelte-5',
        'typescript',
        'chat-viewport',
        'ai-chat'
    ],
    defaultFeatures: ['Follow-Bottom', 'LLM Streaming', 'Virtualized', 'History Prepend'],
    fallbackStars: 0
}
