<script lang="ts">
    import { Header, Footer, getBreadcrumbContext } from '@humanspeak/docs-kit'
    import { docsConfig } from '$lib/docs-config'
    import favicon from '$lib/assets/logo.svg'
    import {
        ArrowRight,
        MessageSquare,
        Zap,
        History,
        Gauge,
        ScrollText,
        Code
    } from '@lucide/svelte'

    const breadcrumbContext = getBreadcrumbContext()
    if (breadcrumbContext) {
        breadcrumbContext.breadcrumbs = []
    }

    const features = [
        {
            title: 'Follow-Bottom',
            description:
                'Viewport stays pinned to the newest message. New messages auto-scroll into view. Scroll away and it stops following.',
            icon: ArrowRight
        },
        {
            title: 'LLM Streaming',
            description:
                'Height changes from token-by-token streaming are batched per animation frame. No jitter, no jumps.',
            icon: Zap
        },
        {
            title: 'Virtualized Rendering',
            description:
                'Only visible messages exist in the DOM. 10,000 messages? Still ~20 DOM nodes.',
            icon: Gauge
        },
        {
            title: 'History Prepend',
            description:
                "Load older messages at the top without yanking the user's scroll position. Anchor preservation built in.",
            icon: History
        },
        {
            title: 'Message-Aware',
            description:
                'Uses message IDs for identity — not array indices. Height caching, scroll-to-message, and keyed rendering.',
            icon: MessageSquare
        },
        {
            title: 'TypeScript + Svelte 5',
            description:
                'Full type safety with generics. Built on runes ($state, $derived, $effect) and snippets.',
            icon: Code
        }
    ]

    const installCmd = 'pnpm add @humanspeak/svelte-virtual-chat'

    const usageCode =
        `<script lang="ts">
  import SvelteVirtualChat from '@humanspeak/svelte-virtual-chat'
  let messages = $state([...])
</` +
        `script>

<SvelteVirtualChat
  {messages}
  getMessageId={(msg) => msg.id}
  estimatedMessageHeight={72}
  containerClass="h-[600px]"
  viewportClass="h-full"
>
  {#snippet renderMessage(message, index)}
    <div class="p-4">{message.content}</div>
  {/snippet}
</SvelteVirtualChat>`
</script>

<div class="bg-background relative flex min-h-screen flex-col">
    <Header config={docsConfig} {favicon} />

    <main class="flex-1">
        <!-- Hero -->
        <section class="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24">
            <div
                class="orb-a-bg pointer-events-none absolute top-0 -left-32 h-[500px] w-[500px] rounded-full opacity-60 blur-3xl"
            ></div>
            <div
                class="orb-b-bg pointer-events-none absolute -right-32 bottom-0 h-[400px] w-[400px] rounded-full opacity-40 blur-3xl"
            ></div>

            <div class="relative mx-auto max-w-5xl px-6 text-center">
                <div
                    class="border-brand-500/20 bg-brand-500/10 text-brand-600 dark:text-brand-400 mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
                >
                    <ScrollText class="size-4" />
                    Virtual chat viewport for Svelte 5
                </div>

                <h1 class="text-foreground mb-6 text-4xl font-bold tracking-tight md:text-6xl">
                    Chat UIs that
                    <span
                        class="sheen-gradient from-brand-500 via-brand-400 to-brand-600 bg-gradient-to-r bg-clip-text text-transparent"
                    >
                        actually work
                    </span>
                </h1>

                <p class="text-muted-foreground mx-auto mb-10 max-w-2xl text-lg md:text-xl">
                    Stop fighting generic virtual lists. SvelteVirtualChat is purpose-built for LLM
                    conversations, support chat, and any message-based UI. Follow-bottom,
                    streaming-stable, history-aware.
                </p>

                <div class="flex flex-wrap justify-center gap-4">
                    <a
                        href="/examples/basic-chat"
                        class="bg-brand-600 hover:bg-brand-700 shadow-brand-500/25 hover:shadow-brand-500/40 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white shadow-lg transition-all"
                    >
                        Try the demo
                        <ArrowRight class="size-4" />
                    </a>
                    <a
                        href="https://github.com/humanspeak/svelte-virtual-chat"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="border-border text-foreground hover:border-brand-500/50 hover:bg-muted/50 inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium transition-all"
                    >
                        View on GitHub
                    </a>
                </div>
            </div>
        </section>

        <!-- Install -->
        <section class="border-border border-y py-6">
            <div class="mx-auto max-w-3xl px-6">
                <pre
                    class="bg-card border-border overflow-x-auto rounded-lg border p-4 text-sm"><code
                        class="text-foreground">{installCmd}</code
                    ></pre>
            </div>
        </section>

        <!-- Features -->
        <section class="py-20">
            <div class="mx-auto max-w-6xl px-6">
                <h2 class="text-foreground mb-4 text-center text-3xl font-bold">
                    Built for chat, not lists
                </h2>
                <p class="text-muted-foreground mx-auto mb-12 max-w-2xl text-center text-lg">
                    Every feature is a direct response to a real problem in chat UI development.
                </p>

                <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {#each features as feature (feature.title)}
                        <div
                            class="border-border bg-card group rounded-xl border p-6 transition-shadow hover:shadow-md"
                        >
                            <div
                                class="bg-brand-500/10 text-brand-600 dark:text-brand-400 mb-4 inline-flex rounded-lg p-2.5"
                            >
                                <feature.icon class="size-5" />
                            </div>
                            <h3 class="text-foreground mb-2 text-lg font-semibold">
                                {feature.title}
                            </h3>
                            <p class="text-muted-foreground text-sm leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <!-- Code example -->
        <section class="border-border border-t py-20">
            <div class="mx-auto max-w-4xl px-6">
                <h2 class="text-foreground mb-4 text-center text-3xl font-bold">
                    Drop-in component
                </h2>
                <p class="text-muted-foreground mx-auto mb-10 max-w-2xl text-center text-lg">
                    One component, one snippet, done. Pair with
                    <a
                        href="https://www.npmjs.com/package/@humanspeak/svelte-markdown"
                        class="text-brand-500 hover:underline">@humanspeak/svelte-markdown</a
                    >
                    for rich LLM output.
                </p>

                <pre
                    class="bg-card border-border overflow-x-auto rounded-xl border p-6 text-sm leading-relaxed"><code
                        class="text-foreground">{usageCode}</code
                    ></pre>
            </div>
        </section>

        <!-- Examples CTA -->
        <section class="border-border border-t py-20">
            <div class="mx-auto max-w-5xl px-6">
                <h2 class="text-foreground mb-10 text-center text-3xl font-bold">
                    See it in action
                </h2>
                <div class="grid gap-6 md:grid-cols-3">
                    <a
                        href="/examples/basic-chat"
                        class="border-border bg-card hover:border-brand-500/50 group rounded-xl border p-6 transition-all hover:shadow-md"
                    >
                        <MessageSquare class="text-brand-500 mb-3 size-6" />
                        <h3 class="text-foreground group-hover:text-brand-500 mb-1 font-semibold">
                            Basic Chat
                        </h3>
                        <p class="text-muted-foreground text-sm">
                            Send messages, follow-bottom, scroll away detection, virtualization
                            stats.
                        </p>
                    </a>
                    <a
                        href="/examples/streaming"
                        class="border-border bg-card hover:border-brand-500/50 group rounded-xl border p-6 transition-all hover:shadow-md"
                    >
                        <Zap class="text-brand-500 mb-3 size-6" />
                        <h3 class="text-foreground group-hover:text-brand-500 mb-1 font-semibold">
                            LLM Streaming
                        </h3>
                        <p class="text-muted-foreground text-sm">
                            Token-by-token streaming with markdown rendering and live metrics.
                        </p>
                    </a>
                    <a
                        href="/examples/history-loading"
                        class="border-border bg-card hover:border-brand-500/50 group rounded-xl border p-6 transition-all hover:shadow-md"
                    >
                        <History class="text-brand-500 mb-3 size-6" />
                        <h3 class="text-foreground group-hover:text-brand-500 mb-1 font-semibold">
                            History Loading
                        </h3>
                        <p class="text-muted-foreground text-sm">
                            Scroll up to load older messages with anchor preservation.
                        </p>
                    </a>
                </div>
            </div>
        </section>
    </main>

    <Footer />
</div>
