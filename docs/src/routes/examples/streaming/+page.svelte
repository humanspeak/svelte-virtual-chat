<script lang="ts">
    import { CodeReferenceV2, getSeoContext } from '@humanspeak/docs-kit'
    import Example from '$lib/components/general/Example.svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import StreamingChat from '$lib/examples/streaming/demos/StreamingChat.svelte'

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'LLM Streaming | Examples | Svelte Virtual Chat'
        seo.description =
            'Simulated LLM token streaming with markdown rendering inside a virtual chat viewport — height stability during message growth in Svelte 5.'
        seo.ogTitle = 'LLM Streaming Demo'
        seo.ogTagline = 'Token-by-token streaming with real-time markdown rendering.'
        seo.ogFeatures = ['Token Streaming', 'Markdown', 'Height Stability', 'Live Metrics']
        seo.ogSlug = 'examples-streaming'
    }

    const sections = [
        {
            figId: 'FIG-001',
            tag: 'STREAMING',
            title: { accent: 'LLM Streaming' },
            description:
                'Simulated token-by-token streaming with markdown rendering and a virtualized viewport that stays pinned as message content grows.',
            codeSnippet: streamingChatSource,
            barCells: [{ k: 'file', v: 'StreamingChat.svelte' }]
        }
    ] as const

    const section = sections[0]
    const sourceUrl =
        'https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/streaming/demos/StreamingChat.svelte'
</script>

{#snippet streamingChatSource()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'streaming/demos/StreamingChat.svelte',
                'streaming-chat',
                'StreamingChat.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

<Example title={section.title.accent} {sourceUrl}>
    <StreamingChat />
</Example>
