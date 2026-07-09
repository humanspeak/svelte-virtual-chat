<script lang="ts">
    import { CodeReferenceV2, getSeoContext } from '@humanspeak/docs-kit'
    import Example from '$lib/components/general/Example.svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import BasicChat from '$lib/examples/basic-chat/demos/BasicChat.svelte'

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

    const sections = [
        {
            figId: 'FIG-001',
            tag: 'BASIC',
            title: { accent: 'Basic Chat' },
            description:
                'Send and receive messages with follow-bottom behavior, scroll-away detection, bulk loading, and live virtualization stats.',
            codeSnippet: basicChatSource,
            barCells: [{ k: 'file', v: 'BasicChat.svelte' }]
        }
    ] as const

    const section = sections[0]
    const sourceUrl =
        'https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/basic-chat/demos/BasicChat.svelte'
</script>

{#snippet basicChatSource()}
    <CodeReferenceV2
        samples={[
            demoCodeSample('basic-chat/demos/BasicChat.svelte', 'basic-chat', 'BasicChat.svelte')
        ]}
        columns={1}
    />
{/snippet}

<Example title={section.title.accent} {sourceUrl}>
    <BasicChat />
</Example>
