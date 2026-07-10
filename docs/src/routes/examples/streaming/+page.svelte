<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        formatSheetLabel,
        getSeoContext,
        type ExampleSection
    } from '@humanspeak/docs-kit'
    import { demoCodeSample } from '$lib/demo-loaders'
    import StreamingChat from '$lib/examples/streaming/demos/StreamingChat.svelte'
    import { Activity, DollarSign, Lightbulb, Zap } from '@lucide/svelte'

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'LLM Streaming | Examples | Svelte Virtual Chat'
        seo.h1 = { title: 'LLM Streaming' }
        seo.description =
            'Simulated LLM token streaming with markdown rendering inside a virtual chat viewport — height stability during message growth in Svelte 5.'
        seo.ogTitle = 'LLM Streaming Demo'
        seo.ogTagline = 'Token-by-token streaming with real-time markdown rendering.'
        seo.ogFeatures = ['Token Streaming', 'Markdown', 'Height Stability', 'Live Metrics']
        seo.ogSlug = 'examples-streaming'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/'
    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'STREAMING',
            title: { prefix: 'llm ', accent: 'streaming', end: '.' },
            description:
                'Simulated token-by-token streaming with markdown rendering and a virtualized viewport that stays pinned as message content grows.',
            snippet: streamingSection,
            codeSnippet: streamingCode,
            notes: streamingNotes,
            barCells: [{ k: 'mode', v: 'follow-bottom' }],
            sourceUrl: `${SOURCE_URL}streaming/demos/StreamingChat.svelte`
        }
    ]
</script>

{#snippet streamingSection()}
    <StreamingChat />
{/snippet}

{#snippet streamingNotes()}
    <ul>
        <li>
            <Zap />
            <span>
                LLMs stream tokens via SSE. As each token arrives, the message content grows and
                ResizeObserver detects the height change automatically.
            </span>
        </li>
        <li>
            <Activity />
            <span>
                Height corrections are batched per animation frame — not per token. The viewport
                stays pinned to bottom with zero jitter.
            </span>
        </li>
        <li>
            <Lightbulb />
            <span>
                Markdown rendering is powered by
                <a href="https://markdown.svelte.page" target="_blank" rel="noopener noreferrer">
                    @humanspeak/svelte-markdown
                </a>
                in streaming mode (~1.6ms avg per update) — code blocks, tables, and lists all render
                live without scroll disruption.
            </span>
        </li>
        <li>
            <DollarSign />
            <span>
                Track token costs across providers with
                <a href="https://modelpricing.ai" target="_blank" rel="noopener noreferrer">
                    ModelPricing.ai
                </a>. Need a general-purpose virtual list? Try
                <a href="https://virtuallist.svelte.page" target="_blank" rel="noopener noreferrer">
                    @humanspeak/svelte-virtual-list
                </a>.
            </span>
        </li>
    </ul>
{/snippet}

{#snippet streamingCode()}
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
