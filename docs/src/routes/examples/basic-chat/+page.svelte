<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        formatSheetLabel,
        getSeoContext,
        type ExampleSection
    } from '@humanspeak/docs-kit'
    import { demoCodeSample } from '$lib/demo-loaders'
    import BasicChat from '$lib/examples/basic-chat/demos/BasicChat.svelte'
    import { ArrowDownToLine, Gauge, Layers, MessageSquare } from '@lucide/svelte'

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'Basic Chat | Examples | Svelte Virtual Chat'
        seo.h1 = { title: 'Basic Chat' }
        seo.description =
            'Interactive basic chat example with follow-bottom behavior, scroll-away detection, and virtualized message rendering powered by @humanspeak/svelte-virtual-chat.'
        seo.ogTitle = 'Basic Chat Demo'
        seo.ogTagline = 'Follow-bottom, scroll-away, and virtualization in action.'
        seo.ogFeatures = ['Follow-Bottom', 'Scroll-Away', 'Virtualized', 'Debug Stats']
        seo.ogSlug = 'examples-basic-chat'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/'
    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'CHAT',
            title: { prefix: 'basic ', accent: 'chat', end: '.' },
            description:
                'Send and receive messages with follow-bottom behavior, scroll-away detection, bulk loading, and live virtualization stats.',
            snippet: basicChatSection,
            codeSnippet: basicChatCode,
            notes: basicChatNotes,
            barCells: [{ k: 'mode', v: 'follow-bottom' }],
            sourceUrl: `${SOURCE_URL}basic-chat/demos/BasicChat.svelte`
        }
    ]
</script>

{#snippet basicChatSection()}
    <BasicChat />
{/snippet}

{#snippet basicChatNotes()}
    <ul>
        <li>
            <MessageSquare />
            <span>
                Messages are stored oldest-first and rendered top-to-bottom — normal chronological
                order, no inverted geometry. Identity comes from <code>getMessageId</code>, not
                array indices.
            </span>
        </li>
        <li>
            <ArrowDownToLine />
            <span>
                Two states only: following the bottom, or scrolled away. Send a message while pinned
                and the viewport tracks it; scroll up and it holds your position.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                Only the messages inside the viewport (plus overscan) live in the DOM. Add 100
                messages and watch In-DOM stay small while Total climbs.
            </span>
        </li>
        <li>
            <Gauge />
            <span>
                Heights are measured with ResizeObserver and cached as prefix sums, so scroll
                positioning stays smooth even across hundreds of variable-height rows.
            </span>
        </li>
    </ul>
{/snippet}

{#snippet basicChatCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample('basic-chat/demos/BasicChat.svelte', 'basic-chat', 'BasicChat.svelte')
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
