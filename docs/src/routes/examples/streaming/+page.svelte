<script lang="ts">
    import { getSeoContext } from '@humanspeak/docs-kit'
    import Example from '$lib/components/general/Example.svelte'
    import StreamingChat from '$lib/examples/StreamingChat.svelte'

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
</script>

<Example
    title="LLM Streaming"
    sourceUrl="https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/StreamingChat.svelte"
>
    <StreamingChat />
</Example>
