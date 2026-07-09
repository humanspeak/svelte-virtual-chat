<script lang="ts">
    import { getSeoContext } from '@humanspeak/docs-kit'
    import Example from '$lib/components/general/Example.svelte'
    import HeaderFooterChat from '$lib/examples/HeaderFooterChat.svelte'

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'Header & Footer | Examples | Svelte Virtual Chat'
        seo.description =
            'Persistent header and footer snippets that render above and below all messages — typing indicators, channel banners, and more without fake message injection.'
        seo.ogTitle = 'Header & Footer Demo'
        seo.ogTagline = 'Persistent content above and below messages.'
        seo.ogFeatures = ['Header Snippet', 'Footer Snippet', 'Typing Indicator', 'Always in DOM']
        seo.ogSlug = 'examples-header-footer'
    }

    const sections = [
        {
            figId: 'FIG-001',
            tag: 'LAYOUT',
            title: { accent: 'Header & Footer' },
            description:
                'Persistent header and footer snippets render above and below all messages without injecting fake chat rows.',
            codeSnippet: headerFooterSource,
            barCells: [{ k: 'file', v: 'HeaderFooterChat.svelte' }]
        }
    ] as const

    const section = sections[0]
    const sourceUrl =
        'https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/HeaderFooterChat.svelte'
</script>

{#snippet headerFooterSource()}
    <!-- demoCodeSample('HeaderFooterChat.svelte', 'header-footer', 'HeaderFooterChat.svelte') -->
{/snippet}

<Example title={section.title.accent} {sourceUrl}>
    <HeaderFooterChat />
</Example>
