<script lang="ts">
    import { getSeoContext } from '@humanspeak/docs-kit'
    import { MessageSquare, Zap, History, LayoutTemplate } from '@lucide/svelte'

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'Examples | Svelte Virtual Chat'
        seo.description =
            'Interactive examples demonstrating @humanspeak/svelte-virtual-chat features: basic chat, LLM streaming, and history loading with scroll anchor preservation.'
        seo.ogTitle = 'Interactive Examples'
        seo.ogTagline = 'See SvelteVirtualChat in action with live demos.'
        seo.ogFeatures = ['Basic Chat', 'LLM Streaming', 'History Loading', 'Live Demos']
        seo.ogSlug = 'examples'
    }

    const examples = [
        {
            title: 'Basic Chat',
            href: '/examples/basic-chat',
            description:
                'Send and receive messages with follow-bottom behavior, scroll-away detection, bulk message loading, and live virtualization stats.',
            icon: MessageSquare
        },
        {
            title: 'LLM Streaming',
            href: '/examples/streaming',
            description:
                'Simulated token-by-token streaming with markdown rendering. Watch the viewport stay pinned as content grows with live performance metrics.',
            icon: Zap
        },
        {
            title: 'History Loading',
            href: '/examples/history-loading',
            description:
                'Scroll up to trigger older message loading. The viewport preserves your scroll position as messages are prepended above.',
            icon: History
        },
        {
            title: 'Header & Footer',
            href: '/examples/header-footer',
            description:
                'Persistent header and footer snippets that render above and below all messages. Includes a typing indicator that triggers follow-bottom.',
            icon: LayoutTemplate
        }
    ]
</script>

<div class="mx-auto max-w-5xl px-6 py-12">
    <div class="mb-10">
        <h1 class="text-foreground text-3xl font-bold">Examples</h1>
        <p class="text-muted-foreground mt-2 text-lg">
            Interactive demos showcasing SvelteVirtualChat's core behaviors. Each example is a live
            component you can interact with.
        </p>
    </div>

    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {#each examples as example (example.title)}
            <a
                href={example.href}
                class="border-border bg-card hover:border-brand-500/50 group rounded-xl border p-6 transition-all hover:shadow-md"
            >
                <div
                    class="bg-brand-500/10 text-brand-600 dark:text-brand-400 mb-4 inline-flex rounded-lg p-3"
                >
                    <example.icon class="size-6" />
                </div>
                <h2 class="text-foreground group-hover:text-brand-500 mb-2 text-lg font-semibold">
                    {example.title}
                </h2>
                <p class="text-muted-foreground text-sm leading-relaxed">{example.description}</p>
            </a>
        {/each}
    </div>
</div>
