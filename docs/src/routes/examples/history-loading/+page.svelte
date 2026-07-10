<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        formatSheetLabel,
        getSeoContext,
        type ExampleSection
    } from '@humanspeak/docs-kit'
    import { demoCodeSample } from '$lib/demo-loaders'
    import HistoryLoading from '$lib/examples/history-loading/demos/HistoryLoading.svelte'
    import { Anchor, History, Infinity as InfinityIcon, MoveVertical } from '@lucide/svelte'

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'History Loading | Examples | Svelte Virtual Chat'
        seo.h1 = { title: 'History Loading' }
        seo.description =
            'Scroll up to load older messages with anchor preservation. Demonstrates prepend-history behavior without viewport jumping using @humanspeak/svelte-virtual-chat.'
        seo.ogTitle = 'History Loading Demo'
        seo.ogTagline = 'Load older messages without losing your scroll position.'
        seo.ogFeatures = ['History Prepend', 'Anchor Preservation', 'Infinite Scroll', 'No Jump']
        seo.ogSlug = 'examples-history-loading'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/'
    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'HISTORY',
            title: { prefix: 'history ', accent: 'loading', end: '.' },
            description:
                'Scroll up to trigger older message loading while the viewport preserves its visible anchor as messages are prepended above.',
            snippet: historyLoadingSection,
            codeSnippet: historyLoadingCode,
            notes: historyLoadingNotes,
            barCells: [{ k: 'mode', v: 'prepend · anchored' }],
            sourceUrl: `${SOURCE_URL}history-loading/demos/HistoryLoading.svelte`
        }
    ]
</script>

{#snippet historyLoadingSection()}
    <HistoryLoading />
{/snippet}

{#snippet historyLoadingNotes()}
    <ul>
        <li>
            <History />
            <span>
                Scroll near the top and <code>onNeedHistory</code> fires, so you can fetch an older batch
                and prepend it to the messages array — the chat starts with the most recent messages loaded.
            </span>
        </li>
        <li>
            <Anchor />
            <span>
                As older messages are prepended above, the viewport preserves its visible anchor —
                the message you were reading stays exactly where it was, with no jump.
            </span>
        </li>
        <li>
            <MoveVertical />
            <span>
                Anchor preservation compensates for the height of the inserted batch, so scrollTop
                is corrected in the same frame the messages land.
            </span>
        </li>
        <li>
            <InfinityIcon />
            <span>
                Keep scrolling up to page through the full backlog. The scroll-away state means
                loading history never yanks you back to the bottom.
            </span>
        </li>
    </ul>
{/snippet}

{#snippet historyLoadingCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'history-loading/demos/HistoryLoading.svelte',
                'history-loading',
                'HistoryLoading.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#each sections as section, i (section.figId)}
    <ExampleV2
        figId={section.figId}
        tag={section.tag}
        title={section.title}
        description={section.description}
        mode={section.mode ?? 'live'}
        sheetLabel={formatSheetLabel(i, sections.length)}
        barCells={section.barCells}
        sourceUrl={section.sourceUrl}
        codeSnippet={section.codeSnippet}
        codeLabel="show code"
        notes={section.notes}
    >
        {@render section.snippet()}
    </ExampleV2>
{/each}
