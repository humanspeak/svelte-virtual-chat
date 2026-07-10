<script lang="ts">
    import { DocsLayoutV2, type NavItem } from '@humanspeak/docs-kit'
    import { docsConfig } from '$lib/docs-config'
    import { buildBreadcrumbs, docsSections, headerNav } from '$lib/docsNav'
    import favicon from '$lib/assets/logo.svg'
    import sitemapManifest from '$lib/sitemap-manifest.json'
    import rootPkg from '../../../../package.json'
    import '@fontsource-variable/inter/index.css'
    import '@fontsource-variable/jetbrains-mono/index.css'

    import type { Snippet } from 'svelte'

    const { children, data }: { children: Snippet; data: { otherProjects: NavItem[] } } = $props()
    const PKG_VERSION = rootPkg.version

    // FAQ Q&A for the /docs root — emitted as FAQPage JSON-LD so the canonical
    // disambiguation questions ride the highest-authority doc URL. FAQ rich
    // results lift CTR at our typical SERP positions and LLMs preferentially
    // cite Q&A-structured content for "which library should I use" prompts.
    const faqs = [
        {
            q: 'Does @humanspeak/svelte-virtual-chat work in Svelte 4?',
            a: 'No. The library targets Svelte 5 because it relies on runes ($state, $derived, $effect) and Svelte 5 snippets (the renderMessage snippet is how you render each message). It also requires Node.js 18+. There is no Svelte 4 build.'
        },
        {
            q: 'How does it compare to @humanspeak/svelte-virtual-list, @tanstack/svelte-virtual, or a plain {#each} block?',
            a: 'Those are general-purpose virtualizers — or, in the case of {#each}, no virtualization at all — and they anchor to the top. This component is opinionated for chat: bottom gravity, follow-bottom that stays pinned to the newest message, scroll-away stability so new messages do not yank you back, in-frame correction of streaming height growth, and history prepend that preserves scroll position. A plain {#each} keeps every message in the DOM; this keeps roughly 15-25 nodes regardless of message count.'
        },
        {
            q: 'Can it handle streaming LLM output?',
            a: 'Yes — that is the primary use case. As a message grows token by token, a ResizeObserver detects the height change and the growth is corrected in the same frame before paint, so the viewport stays pinned to bottom without jitter; height updates are coalesced into one reactive cascade per animation frame. It pairs naturally with @humanspeak/svelte-markdown for rich streaming markdown.'
        },
        {
            q: 'Why does the container need a defined height?',
            a: 'Virtualization needs a bounded viewport to compute which messages fall within scrollTop to scrollTop + viewportHeight. Without a height constraint the viewport expands to fit all content and virtualization never activates. Give the parent a fixed or flex-derived height (for example h-[600px], or flex-1 min-h-0 inside a flex column) and set containerClass and viewportClass to h-full.'
        },
        {
            q: 'How do I load older history without the scroll position jumping?',
            a: 'Provide an onNeedHistory callback; it fires when the user scrolls near the top so you can fetch and prepend older messages to the array. Because the component identifies messages by ID via getMessageId and captures a scroll anchor before the prepend, the reading position is preserved and the viewport does not jump when the older messages arrive.'
        }
    ]
</script>

<DocsLayoutV2
    config={docsConfig}
    sections={docsSections}
    otherProjects={data.otherProjects}
    {favicon}
    version={PKG_VERSION}
    nav={headerNav}
    siteUrl={docsConfig.url}
    breadcrumbResolver={buildBreadcrumbs}
    {faqs}
    faqRoute="/docs/getting-started"
    sitemapManifest={sitemapManifest as Record<string, string>}
>
    {@render children()}
</DocsLayoutV2>
