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

    const sections = [
        {
            figId: 'FIG-001',
            tag: 'HISTORY',
            title: { accent: 'History Loading' },
            description:
                'Scroll up to trigger older message loading while the viewport preserves its visible anchor as messages are prepended above.',
            codeSnippet: historyLoadingSource,
            barCells: [{ k: 'file', v: 'HistoryLoading.svelte' }]
        }
    ] as const

    const section = sections[0]
    const sourceUrl =
        'https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/HistoryLoading.svelte'
</script>

{#snippet historyLoadingSource()}
    <!-- demoCodeSample('HistoryLoading.svelte', 'history-loading', 'HistoryLoading.svelte') -->
{/snippet}

<Example title={section.title.accent} {sourceUrl}>
    <HistoryLoading />
</Example>
