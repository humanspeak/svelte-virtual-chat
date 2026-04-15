<script lang="ts">
    import { getSeoContext } from '@humanspeak/docs-kit'
    import Example from '$lib/components/general/Example.svelte'
    import BasicChat from '$lib/examples/BasicChat.svelte'

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'Basic Chat | Examples | Svelte Virtual Chat'
        seo.description =
            'Interactive basic chat example with follow-bottom behavior, scroll-away detection, and virtualized message rendering powered by @humanspeak/svelte-virtual-chat.'
        seo.ogTitle = 'Basic Chat Demo'
        seo.ogTagline = 'Follow-bottom, scroll-away, and virtualization in action.'
        seo.ogFeatures = ['Follow-Bottom', 'Scroll-Away', 'Virtualized', 'Debug Stats']
        seo.ogSlug = 'examples-basic-chat'
    }
</script>

<Example
    title="Basic Chat"
    sourceUrl="https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/BasicChat.svelte"
>
    <BasicChat />
</Example>
