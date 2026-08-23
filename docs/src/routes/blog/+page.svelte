<script lang="ts">
    import { getSeoContext } from '@humanspeak/docs-kit'
    import { BlogIndexV2, loadBlogPostsMdsvex } from '@humanspeak/docs-kit/blog'

    type MdsvexModule = {
        metadata?: Record<string, unknown>
        default?: unknown
    }

    const modules = import.meta.glob('/src/routes/blog/*/+page.svx', { eager: true })
    const posts = loadBlogPostsMdsvex(modules as Record<string, MdsvexModule>)

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'Svelte Chat UI Guides | VirtualChat Blog'
        seo.description =
            'Practical Svelte 5 guides for building virtualized chatbot and LLM interfaces with stable streaming, follow-bottom, and history loading.'
        seo.ogTitle = 'VirtualChat Blog'
        seo.ogTagline = 'Build stable chatbot and LLM interfaces in Svelte 5.'
        seo.ogFeatures = ['Svelte Chat', 'LLM Streaming', 'Virtualization', 'Svelte 5']
        seo.ogSlug = 'blog'
    }
</script>

<BlogIndexV2 {posts} />
