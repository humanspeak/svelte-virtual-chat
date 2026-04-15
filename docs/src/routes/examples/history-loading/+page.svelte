<script lang="ts">
    import { getSeoContext } from '@humanspeak/docs-kit'
    import Example from '$lib/components/general/Example.svelte'
    import HistoryLoading from '$lib/examples/HistoryLoading.svelte'

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'History Loading | Examples | Svelte Virtual Chat'
        seo.description =
            'Scroll up to load older messages with anchor preservation. Demonstrates prepend-history behavior without viewport jumping using @humanspeak/svelte-virtual-chat.'
        seo.ogTitle = 'History Loading Demo'
        seo.ogTagline = 'Load older messages without losing your scroll position.'
        seo.ogFeatures = ['History Prepend', 'Anchor Preservation', 'Infinite Scroll', 'No Jump']
        seo.ogSlug = 'examples-history-loading'
    }
</script>

<Example
    title="History Loading"
    sourceUrl="https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/HistoryLoading.svelte"
>
    <HistoryLoading />
</Example>
