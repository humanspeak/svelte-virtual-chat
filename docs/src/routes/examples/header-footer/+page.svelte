<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        formatSheetLabel,
        getSeoContext,
        type ExampleSection
    } from '@humanspeak/docs-kit'
    import { demoCodeSample } from '$lib/demo-loaders'
    import HeaderFooterChat from '$lib/examples/header-footer/demos/HeaderFooterChat.svelte'
    import { ArrowDownToLine, PanelTop, Pin, Sparkles } from '@lucide/svelte'

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'Header & Footer | Examples | Svelte Virtual Chat'
        seo.h1 = { title: 'Header & Footer' }
        seo.description =
            'Persistent header and footer snippets that render above and below all messages — typing indicators, channel banners, and more without fake message injection.'
        seo.ogTitle = 'Header & Footer Demo'
        seo.ogTagline = 'Persistent content above and below messages.'
        seo.ogFeatures = ['Header Snippet', 'Footer Snippet', 'Typing Indicator', 'Always in DOM']
        seo.ogSlug = 'examples-header-footer'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/'
    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'SNIPPETS',
            title: { prefix: 'header & ', accent: 'footer', end: '.' },
            description:
                'Persistent header and footer snippets render above and below all messages without injecting fake chat rows.',
            snippet: headerFooterSection,
            codeSnippet: headerFooterCode,
            notes: headerFooterNotes,
            barCells: [{ k: 'slots', v: 'header · footer' }],
            sourceUrl: `${SOURCE_URL}header-footer/demos/HeaderFooterChat.svelte`
        }
    ]
</script>

{#snippet headerFooterSection()}
    <HeaderFooterChat />
{/snippet}

{#snippet headerFooterNotes()}
    <ul>
        <li>
            <PanelTop />
            <span>
                The <code>header</code> and <code>footer</code> snippets render persistent content above
                and below messages — no fake entries injected into the messages array.
            </span>
        </li>
        <li>
            <Pin />
            <span>
                Both live outside the virtual scroll machinery — always in the DOM, never
                virtualized away. Omit them and the component behaves exactly as before.
            </span>
        </li>
        <li>
            <ArrowDownToLine />
            <span>
                Footer height changes are tracked via ResizeObserver. When a typing indicator
                appears, the viewport snaps to bottom automatically if you were following.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                Headers suit "load more" buttons, date separators, or channel banners. With few
                messages the bottom-gravity layout still pushes everything — header included — down.
            </span>
        </li>
    </ul>
{/snippet}

{#snippet headerFooterCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'header-footer/demos/HeaderFooterChat.svelte',
                'header-footer',
                'HeaderFooterChat.svelte'
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
