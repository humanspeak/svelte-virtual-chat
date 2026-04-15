<script lang="ts">
    import { Header, Footer, getBreadcrumbContext } from '@humanspeak/docs-kit'
    import { docsConfig } from '$lib/docs-config'
    import favicon from '$lib/assets/logo.svg'
    import SvelteVirtualChat, {
        type SvelteVirtualChatDebugInfo
    } from '@humanspeak/svelte-virtual-chat'
    import {
        ArrowRight,
        MessageSquare,
        Zap,
        History,
        Gauge,
        Code,
        Play,
        Square,
        RotateCw,
        FlaskConical,
        BookOpen,
        Rocket
    } from '@lucide/svelte'

    const breadcrumbContext = getBreadcrumbContext()
    if (breadcrumbContext) {
        breadcrumbContext.breadcrumbs = []
    }

    // --- Live chat demo ---
    type DemoMessage = {
        id: string
        role: 'user' | 'assistant'
        content: string
    }

    const conversation: { question: string; answer: string }[] = [
        {
            question: 'How does virtual scrolling work in a chat UI?',
            answer: 'Virtual scrolling renders only the messages visible in your viewport. Instead of creating DOM nodes for every message, the component calculates which are visible and renders only those — plus a small buffer for smooth scrolling. 10,000 messages? Still ~20 DOM nodes.'
        },
        {
            question: 'What happens when a message streams in token by token?',
            answer: 'As each token arrives, the message height grows. SvelteVirtualChat uses ResizeObserver to detect the change and batches corrections per animation frame. The viewport stays pinned to bottom automatically — no jitter, no manual scroll management needed.'
        },
        {
            question: 'How do you load older messages without jumping?',
            answer: 'When you prepend history at the top, the component captures a scroll anchor — the currently visible message and its offset from the viewport. After the new messages render, it restores scrollTop so that anchor stays in the same visual position. The user sees no jump.'
        },
        {
            question: 'Does this work with markdown rendering?',
            answer: 'Pair it with @humanspeak/svelte-markdown and set streaming={true} on assistant messages. As tokens stream, markdown re-renders incrementally while the chat viewport keeps everything stable. Code blocks, tables, lists — all rendered live without scroll disruption.'
        },
        {
            question: 'How do I know virtualization is actually working?',
            answer: 'Use the onDebugInfo callback — it fires on every scroll and render update with live stats: totalMessages, renderedCount (DOM nodes), measuredCount, visible range, scroll position, and isFollowingBottom. You can see the proof right here in this demo toolbar.'
        }
    ]

    let demoMessages: DemoMessage[] = $state([])
    let demoNextId = $state(1)
    let demoDebug: SvelteVirtualChatDebugInfo | null = $state(null)
    let isStreaming = $state(false)
    let demoRunning = $state(false)
    let streamSessionId = $state(0)
    let streamIndex = $state(0)
    let streamTotal = $state(0)
    let streamTimerId: ReturnType<typeof setTimeout> | null = null
    let demoTimerId: ReturnType<typeof setTimeout> | null = null

    function streamAnswer(answer: string, sid: number): Promise<void> {
        return new Promise((resolve) => {
            const msgId = String(demoNextId++)
            demoMessages.push({ id: msgId, role: 'assistant', content: '' })
            isStreaming = true
            const words = answer.match(/\S+\s*/g) ?? []
            streamTotal = words.length
            streamIndex = 0

            function next() {
                if (sid !== streamSessionId || streamIndex >= words.length) {
                    isStreaming = false
                    resolve()
                    return
                }
                const msg = demoMessages.find((m) => m.id === msgId)
                if (msg) {
                    msg.content += words[streamIndex]
                    streamIndex++
                }
                streamTimerId = setTimeout(next, 20 + Math.random() * 25)
            }
            next()
        })
    }

    async function runConversation() {
        if (demoRunning) return
        demoRunning = true
        streamSessionId++
        const sid = streamSessionId

        for (let i = 0; i < conversation.length; i++) {
            if (sid !== streamSessionId) return
            const { question, answer } = conversation[i]

            // Add user message with a typing delay
            await new Promise((r) => {
                demoTimerId = setTimeout(r, i === 0 ? 800 : 1500)
            })
            if (sid !== streamSessionId) return

            demoMessages.push({ id: String(demoNextId++), role: 'user', content: question })

            // Brief pause before assistant starts
            await new Promise((r) => {
                demoTimerId = setTimeout(r, 600)
            })
            if (sid !== streamSessionId) return

            await streamAnswer(answer, sid)
            if (sid !== streamSessionId) return
        }

        // Loop: wait then restart
        await new Promise((r) => {
            demoTimerId = setTimeout(r, 4000)
        })
        if (sid !== streamSessionId) return
        demoMessages = []
        demoNextId = 1
        demoRunning = false
        runConversation()
    }

    function stopDemo() {
        streamSessionId++
        isStreaming = false
        demoRunning = false
        if (streamTimerId) {
            clearTimeout(streamTimerId)
            streamTimerId = null
        }
        if (demoTimerId) {
            clearTimeout(demoTimerId)
            demoTimerId = null
        }
    }

    function resetDemo() {
        stopDemo()
        demoMessages = []
        demoNextId = 1
        streamIndex = 0
        streamTotal = 0
        // Restart
        runConversation()
    }

    // Auto-start
    $effect(() => {
        if (typeof window === 'undefined') return
        const timer = setTimeout(() => runConversation(), 1000)
        return () => {
            clearTimeout(timer)
            stopDemo()
        }
    })

    const features = [
        {
            title: 'Follow-Bottom',
            description:
                'Viewport stays pinned to the newest message. Scroll away and it stops. Return and it resumes.',
            icon: ArrowRight
        },
        {
            title: 'LLM Streaming',
            description:
                'Height changes from token streaming are batched per frame. No jitter, no jumps, no workarounds.',
            icon: Zap
        },
        {
            title: 'Virtualized',
            description:
                'Only visible messages exist in the DOM. 10,000 messages renders ~20 DOM nodes.',
            icon: Gauge
        },
        {
            title: 'History Prepend',
            description:
                "Load older messages at the top. Scroll anchor preservation keeps the user's position stable.",
            icon: History
        },
        {
            title: 'Message-Aware',
            description:
                'Uses message IDs for identity. Height caching, scroll-to-message, and keyed rendering built in.',
            icon: MessageSquare
        },
        {
            title: 'Svelte 5 + TypeScript',
            description:
                'Full generics, runes ($state, $derived, $effect), and snippets. Zero dependencies.',
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

<div class="flex min-h-svh flex-col">
    <Header config={docsConfig} {favicon} />

    <div class="relative flex flex-1 flex-col overflow-hidden">
        <!-- Background layers -->
        <div class="bg-grid pointer-events-none absolute inset-0 -z-20"></div>
        <div class="bg-glow pointer-events-none absolute inset-0 -z-10"></div>
        <div
            class="orb-a-bg pointer-events-none absolute bottom-[-80px] left-[-80px] h-[320px] w-[320px] rounded-full opacity-50 blur-[30px]"
        ></div>
        <div
            class="orb-b-bg pointer-events-none absolute top-[20%] right-[-60px] h-[260px] w-[260px] rounded-full opacity-50 blur-[30px]"
        ></div>

        <!-- Hero -->
        <section class="relative flex flex-1">
            <div
                class="relative mx-auto flex w-full max-w-7xl items-center justify-center px-6 py-8 md:py-12"
            >
                <div class="mx-auto max-w-4xl text-center">
                    <h1
                        class="text-foreground text-5xl leading-tight font-semibold text-balance md:text-7xl"
                    >
                        <span class="block">Svelte Virtual</span>
                        <span class="text-brand-500 block">Chat</span>
                    </h1>
                    <p
                        class="text-muted-foreground mt-6 text-base leading-7 text-pretty md:text-lg"
                    >
                        A high-performance virtual chat viewport for Svelte 5.<br />
                        Purpose-built for LLM conversations, support chat, and any message-based UI.
                    </p>
                    <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <a
                            href="/examples/basic-chat"
                            class="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-600/30 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow transition-colors focus:outline-none focus-visible:ring-2"
                        >
                            Get Started
                            <Rocket class="ml-2 size-3" />
                        </a>
                        <a
                            href="/docs/api/svelte-virtual-chat"
                            class="border-border bg-card text-foreground hover:border-brand-500/50 focus-visible:ring-brand-600/20 inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2"
                        >
                            API Reference
                            <BookOpen class="ml-2 size-3" />
                        </a>
                        <a
                            href="/examples"
                            class="border-border bg-card text-foreground hover:border-brand-500/50 focus-visible:ring-brand-600/20 inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2"
                        >
                            Examples
                            <FlaskConical class="ml-2 size-3" />
                        </a>
                    </div>
                    <ul
                        class="text-muted-foreground mt-10 flex flex-wrap justify-center gap-2 text-xs"
                    >
                        <li class="border-border-muted rounded-full border px-3 py-1">Svelte 5</li>
                        <li class="border-border-muted rounded-full border px-3 py-1">
                            TypeScript
                        </li>
                        <li class="border-border-muted rounded-full border px-3 py-1">
                            Follow-Bottom
                        </li>
                        <li class="border-border-muted rounded-full border px-3 py-1">
                            LLM Streaming
                        </li>
                        <li class="border-border-muted rounded-full border px-3 py-1">Zero Deps</li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- Live Chat Demo -->
        <section class="relative px-6 py-10">
            <div class="container mx-auto max-w-5xl">
                <div class="mb-8 text-center">
                    <h2
                        class="from-brand-500 to-brand-600 mb-4 bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent md:text-4xl"
                    >
                        Watch It Stream in Real-Time
                    </h2>
                    <p class="text-muted-foreground mx-auto max-w-2xl">
                        This is a live SvelteVirtualChat component. Messages stream token-by-token
                        while the viewport stays pinned to bottom — no jitter.
                    </p>
                </div>
                <div class="border-border overflow-hidden rounded-xl border">
                    <!-- Toolbar -->
                    <div
                        class="border-border bg-card/80 flex items-center justify-between border-b px-4 py-2"
                    >
                        <div class="flex items-center gap-3">
                            <div class="flex gap-1.5">
                                <div class="h-3 w-3 rounded-full bg-red-400/60"></div>
                                <div class="h-3 w-3 rounded-full bg-yellow-400/60"></div>
                                <div class="h-3 w-3 rounded-full bg-green-400/60"></div>
                            </div>
                            <span class="text-muted-foreground text-xs font-medium"
                                >Live chat demo</span
                            >
                        </div>
                        <div class="flex items-center gap-3">
                            {#if demoDebug}
                                <div
                                    class="text-muted-foreground hidden items-center gap-3 font-mono text-xs sm:flex"
                                >
                                    <span>
                                        DOM: <span class="text-brand-500 font-semibold"
                                            >{demoDebug.renderedCount}</span
                                        >/{demoDebug.totalMessages}
                                    </span>
                                    {#if streamTotal > 0}
                                        <span>
                                            {streamIndex}/{streamTotal} tokens
                                        </span>
                                    {/if}
                                </div>
                            {/if}
                            <div class="flex items-center gap-1.5">
                                <button
                                    onclick={resetDemo}
                                    class="text-muted-foreground hover:text-foreground inline-flex items-center text-xs transition-colors"
                                >
                                    <Play class="mr-1 size-3" />
                                    Restart
                                </button>
                                <button
                                    onclick={stopDemo}
                                    disabled={!isStreaming}
                                    class="text-muted-foreground hover:text-foreground inline-flex items-center text-xs transition-colors disabled:opacity-40"
                                >
                                    <Square class="mr-1 size-3" />
                                    Stop
                                </button>
                                <button
                                    onclick={resetDemo}
                                    class="text-muted-foreground hover:text-foreground inline-flex items-center text-xs transition-colors"
                                >
                                    <RotateCw class="mr-1 size-3" />
                                    Reset
                                </button>
                            </div>
                            <a
                                href="/examples/streaming"
                                class="text-brand-600 hover:text-brand-700 inline-flex items-center text-xs font-medium transition-colors"
                            >
                                Full Demo
                                <ArrowRight class="ml-1 size-3" />
                            </a>
                        </div>
                    </div>
                    <!-- Chat viewport -->
                    <div class="bg-card h-[320px]">
                        <SvelteVirtualChat
                            messages={demoMessages}
                            getMessageId={(msg: DemoMessage) => msg.id}
                            estimatedMessageHeight={60}
                            onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (demoDebug = info)}
                            containerClass="h-full"
                            viewportClass="h-full"
                        >
                            {#snippet renderMessage(message: DemoMessage, _index: number)}
                                <div
                                    class="border-border border-b px-5 py-4 {message.role === 'user'
                                        ? 'bg-muted/30'
                                        : ''}"
                                >
                                    <div
                                        class="mb-1.5 text-xs font-semibold {message.role === 'user'
                                            ? 'text-brand-500'
                                            : 'text-muted-foreground'}"
                                    >
                                        {message.role === 'user' ? 'You' : 'Assistant'}
                                    </div>
                                    <div class="text-foreground text-sm leading-relaxed">
                                        {message.content}
                                    </div>
                                </div>
                            {/snippet}
                        </SvelteVirtualChat>
                    </div>
                </div>
            </div>
        </section>

        <!-- Features -->
        <section class="relative py-20">
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
        <section class="border-border relative border-t py-20">
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
                <div class="border-border overflow-hidden rounded-xl border">
                    <div class="border-border bg-card/80 flex items-center border-b px-4 py-2">
                        <div class="flex gap-1.5">
                            <div class="h-3 w-3 rounded-full bg-red-400/60"></div>
                            <div class="h-3 w-3 rounded-full bg-yellow-400/60"></div>
                            <div class="h-3 w-3 rounded-full bg-green-400/60"></div>
                        </div>
                        <span class="text-muted-foreground ml-3 text-xs font-medium"
                            >+page.svelte</span
                        >
                    </div>
                    <pre class="bg-card overflow-x-auto p-6 text-sm leading-relaxed"><code
                            class="text-foreground">{usageCode}</code
                        ></pre>
                </div>

                <div class="border-border mt-6 overflow-hidden rounded-xl border">
                    <div class="border-border bg-card/80 flex items-center border-b px-4 py-2">
                        <span class="text-muted-foreground text-xs font-medium">Install</span>
                    </div>
                    <pre class="bg-card overflow-x-auto p-4 text-sm"><code class="text-foreground"
                            >{installCmd}</code
                        ></pre>
                </div>
            </div>
        </section>

        <!-- Examples CTA -->
        <section class="border-border relative border-t py-20">
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
    </div>

    <Footer />
</div>
