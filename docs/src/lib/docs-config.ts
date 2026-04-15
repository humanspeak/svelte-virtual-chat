import type { DocsKitConfig } from '@humanspeak/docs-kit'

export const docsConfig: DocsKitConfig = {
    name: 'Svelte Virtual Chat',
    slug: 'virtual-chat',
    npmPackage: '@humanspeak/svelte-virtual-chat',
    repo: 'humanspeak/svelte-virtual-chat',
    url: 'https://virtualchat.svelte.page',
    description:
        'A high-performance virtual chat viewport for Svelte 5 — built for LLM conversations and support chat with follow-bottom and streaming stability.',
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
