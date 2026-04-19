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
</script>

<Example
    title="Header & Footer"
    sourceUrl="https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/HeaderFooterChat.svelte"
>
    <HeaderFooterChat />
</Example>
