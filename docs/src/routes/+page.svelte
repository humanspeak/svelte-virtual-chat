<script lang="ts">
    import { FooterV2, HeaderV2, getBreadcrumbContext, getSeoContext } from '@humanspeak/docs-kit'
    import { docsConfig } from '$lib/docs-config'
    import favicon from '$lib/assets/logo.svg'
    import { headerNav } from '$lib/docsNav'
    import SvelteVirtualChat, {
        type SvelteVirtualChatDebugInfo
    } from '@humanspeak/svelte-virtual-chat'
    import { AnimatePresence, MotionButton, MotionSpan } from '@humanspeak/svelte-motion'
    import rootPkg from '../../../package.json'
    import '@fontsource-variable/inter/index.css'
    import '@fontsource-variable/jetbrains-mono/index.css'
    import type { PageData } from './$types'

    const { data }: { data: PageData } = $props()
    const packageStats = $derived(data.packageStats)

    const PKG_NAME = rootPkg.name
    const PKG_VERSION = rootPkg.version

    // Packed tarball size comes from the npm registry via `+page.server.ts`
    // (cached ~1h at the edge). `null` when the registry was unreachable —
    // production renders `—` rather than a stale number.
    const TARBALL_KB = $derived(
        packageStats.tarballBytes !== null
            ? Math.round(packageStats.tarballBytes / 102.4) / 10
            : null
    )

    const breadcrumbContext = getBreadcrumbContext()
    if (breadcrumbContext) breadcrumbContext.breadcrumbs = []

    // Homepage-specific SEO copy. Mutated synchronously so SSR emits the
    // right <title>/<meta name="description"> in one pass — docs-kit's
    // SeoHead renders after children and reads these reactively.
    const seo = getSeoContext()
    if (seo) {
        seo.title = 'svelte-virtual-chat · high-performance virtual chat viewport for Svelte 5'
        seo.description =
            'A virtualized chat viewport for Svelte 5, purpose-built for LLM conversations — follow-bottom, in-frame streaming correction, and history prepend with scroll anchor preservation. ~20 DOM nodes at 10,000 messages.'
        seo.ogTitle = 'Svelte Virtual Chat'
        seo.ogTagline = 'A high-performance virtual chat viewport for Svelte 5.'
        seo.ogFeatures = [
            'Follow-Bottom',
            'LLM Streaming',
            'Virtualized',
            'History Prepend',
            'Message-Aware',
            'Svelte 5 + TypeScript'
        ]
        seo.ogSlug = ''
    }

    // ── Stat bar ─────────────────────────────────────────────────────
    interface StatItem {
        k: string
        v: string
        sup?: string
        n: string
        ac?: boolean
    }
    const stats: StatItem[] = $derived([
        { k: 'dom nodes', v: '~20', n: 'at 10,000 messages', ac: true },
        { k: 'messages', v: '10k+', n: 'still smooth' },
        {
            k: 'tarball',
            v: TARBALL_KB !== null ? String(TARBALL_KB) : '—',
            sup: TARBALL_KB !== null ? 'kB' : undefined,
            n: 'packed (npm gz)'
        },
        { k: 'dependencies', v: '1', n: 'micro dep · esm-env' },
        {
            k: 'streaming',
            v: '1',
            sup: 'frame',
            n: 'correction, before paint',
            ac: true
        },
        { k: 'licence', v: 'MIT', n: 'on GitHub' }
    ])

    // ── Capabilities ─────────────────────────────────────────────────
    const features = [
        {
            title: 'Follow-Bottom',
            body: 'Viewport stays pinned to the newest message. Scroll away and it stops. Return and it resumes.'
        },
        {
            title: 'LLM Streaming',
            body: 'Height changes from token streaming are batched per frame. No jitter, no jumps, no workarounds.'
        },
        {
            title: 'Virtualized',
            body: 'Only visible messages exist in the DOM. 10,000 messages renders ~20 DOM nodes.'
        },
        {
            title: 'History Prepend',
            body: "Load older messages at the top. Scroll anchor preservation keeps the user's position stable."
        },
        {
            title: 'Message-Aware',
            body: 'Uses message IDs for identity. Height caching, scroll-to-message, and keyed rendering built in.'
        },
        {
            title: 'Svelte 5 + TypeScript',
            body: 'Full generics, runes ($state, $derived, $effect), and snippets. One micro-dependency (esm-env).'
        }
    ]

    // ── Live streaming demo ──────────────────────────────────────────
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
            answer: 'As each token arrives, the message height grows. SvelteVirtualChat uses ResizeObserver to detect the change and corrects it in the same frame, before paint. The viewport stays pinned to bottom automatically — no jitter, no manual scroll management needed.'
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

            const next = () => {
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

            await new Promise((r) => {
                demoTimerId = setTimeout(r, i === 0 ? 800 : 1500)
            })
            if (sid !== streamSessionId) return

            demoMessages.push({ id: String(demoNextId++), role: 'user', content: question })

            await new Promise((r) => {
                demoTimerId = setTimeout(r, 600)
            })
            if (sid !== streamSessionId) return

            await streamAnswer(answer, sid)
            if (sid !== streamSessionId) return
        }

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
        runConversation()
    }

    // Auto-start the streaming demo shortly after landing.
    $effect(() => {
        if (typeof window === 'undefined') return
        const timer = setTimeout(() => runConversation(), 1000)
        return () => {
            clearTimeout(timer)
            stopDemo()
        }
    })

    // ── Interactive playground ───────────────────────────────────────
    const PLAY_RESPONSES = [
        "That's a great question! Virtual scrolling works by only rendering the items currently visible in the viewport, plus a small buffer for smooth scrolling.",
        "I'd be happy to help with that. The key insight is that you don't need DOM nodes for items the user can't see.",
        "Here's how it works: as you scroll, items entering the viewport are rendered while items leaving are removed. Height caching keeps positioning smooth.",
        'Follow-bottom is crucial for chat UIs. When you are at the bottom, new messages auto-scroll into view — but only while you are actually at the bottom.',
        'One of the trickiest parts is streaming content. As message heights change during token streaming, the viewport stays stable and pinned.',
        'History loading is another interesting challenge. When older messages prepend at the top, we preserve your scroll position so nothing jumps.',
        'For performance, measurements are batched per animation frame rather than reacting to every individual height change.',
        'The component uses ResizeObserver to track message heights — far more reliable than estimating heights from content alone.'
    ]

    let playMessages: DemoMessage[] = $state([
        {
            id: '1',
            role: 'assistant',
            content:
                'Welcome! Type a message below and watch follow-bottom and the virtualization stats react in real time.'
        }
    ])
    let playNextId = $state(2)
    let playInput = $state('')
    let playDebug: SvelteVirtualChatDebugInfo | null = $state(null)
    let playFollowing = $state(true)
    let playReplyTimer: ReturnType<typeof setTimeout> | null = null

    function sendPlayMessage() {
        const text = playInput.trim()
        if (!text) return
        playMessages.push({ id: String(playNextId++), role: 'user', content: text })
        playInput = ''
        playReplyTimer = setTimeout(
            () => {
                const reply = PLAY_RESPONSES[Math.floor(Math.random() * PLAY_RESPONSES.length)]
                playMessages.push({ id: String(playNextId++), role: 'assistant', content: reply })
            },
            300 + Math.random() * 600
        )
    }

    function resetPlayground() {
        if (playReplyTimer) {
            clearTimeout(playReplyTimer)
            playReplyTimer = null
        }
        playMessages = [
            {
                id: '1',
                role: 'assistant',
                content:
                    'Welcome! Type a message below and watch follow-bottom and the virtualization stats react in real time.'
            }
        ]
        playNextId = 2
        playInput = ''
    }

    // ── Featured examples (homepage tiles → /examples/<slug>) ────────
    const featuredExamples = [
        {
            slug: 'basic-chat',
            title: 'Basic Chat',
            body: 'Send and receive messages with follow-bottom behavior, scroll-away detection, bulk message loading, and live virtualization stats.'
        },
        {
            slug: 'streaming',
            title: 'LLM Streaming',
            body: 'Simulated token-by-token streaming with markdown rendering. Watch the viewport stay pinned as content grows with live performance metrics.'
        },
        {
            slug: 'history-loading',
            title: 'History Loading',
            body: 'Scroll up to trigger older message loading. The viewport preserves your scroll position as messages are prepended above.'
        },
        {
            slug: 'header-footer',
            title: 'Header & Footer',
            body: 'Persistent header and footer snippets that render above and below all messages. Includes a typing indicator that triggers follow-bottom.'
        }
    ]

    // ── Copy install command ─────────────────────────────────────────
    const installCmd = $derived(`npm i ${PKG_NAME}`)
    let copied = $state(false)
    const copyInstall = async () => {
        if (typeof navigator === 'undefined') return
        try {
            await navigator.clipboard.writeText(installCmd)
            copied = true
            setTimeout(() => (copied = false), 1500)
        } catch {
            /* clipboard blocked — fail quiet */
        }
    }

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

<div class="brut-wrap flex min-h-svh flex-col">
    <HeaderV2 config={docsConfig} {favicon} version={PKG_VERSION} nav={headerNav} />

    <main class="brut">
        <!-- ── Coordinate strip (decorative grid markers) ────────────── -->
        <div class="brut-coord" aria-hidden="true">
            {#each Array(12) as _, i (i)}
                <div>{pad2(i + 1)}</div>
            {/each}
        </div>

        <!-- ── FIG-001 · MASTHEAD ─────────────────────────────────── -->
        <section class="brut-hero">
            <div class="corner tr">FIG-001 · MASTHEAD</div>
            <aside class="meta">
                <div><span class="k">pkg</span> · <span class="v">{PKG_NAME}</span></div>
                <div><span class="k">version</span> · <span class="v">{PKG_VERSION}</span></div>
                <div>
                    <span class="k">tarball</span> ·
                    <span class="v">{TARBALL_KB !== null ? `${TARBALL_KB} kB gz` : '—'}</span>
                </div>
                <div><span class="k">deps</span> · <span class="v">1 · esm-env</span></div>
                <div><span class="k">licence</span> · <span class="v">MIT</span></div>
                <hr />
                <div><span class="k">dom nodes</span> · <span class="v">~20</span></div>
                <div>
                    <span class="k">streaming</span> ·
                    <span class="v accent">in-frame correction</span>
                </div>
                <div><span class="k">history</span> · <span class="v">anchor-preserved</span></div>
                <hr />
                <div class="k">// scroll for full spec</div>
            </aside>
            <div class="hero-body">
                <h1>
                    <span>svelte</span><span class="slash">/</span><span>virtual chat</span><span
                        class="end">.</span
                    >
                </h1>
                <p class="sub">
                    A <b>high-performance</b> virtual chat viewport for Svelte 5 — purpose-built for
                    <b>LLM conversations</b>, support chat, and any message-based UI. Only visible
                    messages hit the DOM, with follow-bottom, in-frame streaming correction, and
                    history prepend that never jumps the scroll.
                </p>
                <div class="cta-row">
                    <a class="pri" href="/docs/getting-started">get started ↗</a>
                    <a href="/docs/api/svelte-virtual-chat">api reference</a>
                    <a href="/examples">examples</a>
                    <MotionButton
                        class="inst"
                        type="button"
                        onclick={copyInstall}
                        aria-label="Copy install command"
                        whileTap={{ scale: 0.97 }}
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                    >
                        <span class="inst-prompt">$</span>
                        <span class="inst-cmd">npm i <span class="pkg">{PKG_NAME}</span></span>
                        <span class="inst-copy {copied ? 'is-copied' : ''}">
                            <AnimatePresence initial={false}>
                                <MotionSpan
                                    key={copied ? 'copied' : 'idle'}
                                    class="inst-copy-label"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.18, ease: 'easeOut' }}
                                >
                                    {copied ? '✓ copied' : 'copy'}
                                </MotionSpan>
                            </AnimatePresence>
                        </span>
                    </MotionButton>
                </div>
            </div>
            <div class="corner bl">FIG-001</div>
            <div class="corner br">SHEET 01 / 06</div>
        </section>

        <!-- ── Stats row ───────────────────────────────────────────── -->
        <section class="brut-stats">
            {#each stats as s, i (s.k)}
                <div class="s {s.ac ? 'ac' : ''}" data-idx="/0{i + 1}">
                    <div class="k">{s.k}</div>
                    <div class="v">
                        <span class="v-num">{s.v}</span>{#if s.sup}<span class="v-unit"
                                >{s.sup}</span
                            >{/if}
                    </div>
                    <div class="note">{s.n}</div>
                </div>
            {/each}
        </section>

        <!-- ── FIG-002 · STREAMING DEMO ────────────────────────────── -->
        <section class="brut-stream">
            <div class="lede">
                <div class="k">FIG-002 / STREAMING</div>
                <h2>stream <span>ai responses</span> in real-time.</h2>
                <p>
                    A live SvelteVirtualChat instance. Assistant replies stream in token-by-token
                    while the viewport stays pinned to bottom — corrected in the same frame the
                    height grows, before paint.
                </p>
            </div>
            <div class="panel">
                <div class="bar">
                    <span
                        ><span class="lbl">file</span> ·
                        <span class="v">live-chat.svelte</span></span
                    >
                    <span>
                        <span class="lbl">dom</span>
                        <span class="v"
                            >{demoDebug ? demoDebug.renderedCount : '—'}/{demoDebug
                                ? demoDebug.totalMessages
                                : 0}</span
                        >
                    </span>
                    <span>
                        <span class="lbl">tokens</span>
                        <span class="v">{streamIndex}/{streamTotal || '—'}</span>
                    </span>
                    <span class="live">
                        {#if isStreaming}● LIVE{:else}○ IDLE{/if}
                    </span>
                    <button class="ctrl" type="button" onclick={resetDemo}>↻ restart</button>
                    <button class="ctrl" type="button" onclick={stopDemo} disabled={!demoRunning}
                        >□ stop</button
                    >
                </div>
                <div class="stream-host">
                    <SvelteVirtualChat
                        messages={demoMessages}
                        getMessageId={(msg: DemoMessage) => msg.id}
                        estimatedMessageHeight={72}
                        onDebugInfo={(info: SvelteVirtualChatDebugInfo) => (demoDebug = info)}
                        containerClass="h-full"
                        viewportClass="h-full"
                    >
                        {#snippet renderMessage(message: DemoMessage, _index: number)}
                            <div class="msg" data-role={message.role}>
                                <div class="who">
                                    {message.role === 'user' ? 'you' : 'assistant'}
                                </div>
                                <div class="body">{message.content}</div>
                            </div>
                        {/snippet}
                    </SvelteVirtualChat>
                </div>
                <div class="footer">
                    <div>
                        dom · <span class="v">{demoDebug ? demoDebug.renderedCount : '—'}</span>
                    </div>
                    <div>
                        total · <span class="v">{demoDebug ? demoDebug.totalMessages : 0}</span>
                    </div>
                    <div>
                        measured · <span class="v">{demoDebug ? demoDebug.measuredCount : '—'}</span
                        >
                    </div>
                    <div>tokens · <span class="v">{streamIndex}/{streamTotal || '—'}</span></div>
                    <div>
                        follow · <span class="v accent"
                            >{demoDebug?.isFollowingBottom ? 'bottom' : 'scrolled'}</span
                        >
                    </div>
                </div>
            </div>
        </section>

        <!-- ── FIG-003 · CAPABILITIES ──────────────────────────────── -->
        <section class="brut-feat">
            <div class="lede">
                <div class="k">FIG-003 / CAPABILITIES</div>
                <h2>built for <span>chat</span>, not lists.</h2>
                <p>Every feature is a direct response to a real problem in chat UI development.</p>
            </div>
            <div class="grid">
                {#each features as f, i (f.title)}
                    <div class="cell">
                        <div class="id">№ {pad2(i + 1)} / {pad2(features.length)}</div>
                        <div class="corner">▢</div>
                        <h3>{f.title}</h3>
                        <p>{f.body}</p>
                        <div class="marker"></div>
                    </div>
                {/each}
            </div>
        </section>

        <!-- ── FIG-004 · PLAYGROUND ────────────────────────────────── -->
        <section class="brut-play" id="playground">
            <div class="lede">
                <div class="k">FIG-004 / PLAYGROUND</div>
                <h2>live <span>playground</span>.</h2>
                <p>
                    Type a message and send it. Watch follow-bottom re-engage and the virtualization
                    stats update as the conversation grows.
                </p>
            </div>
            <div class="panel">
                <div class="bar">
                    <span
                        ><span class="lbl">file</span> ·
                        <span class="v">playground.svelte</span></span
                    >
                    <span>
                        <span class="lbl">messages</span>
                        <span class="v">{playMessages.length}</span>
                    </span>
                    <span>
                        <span class="lbl">dom</span>
                        <span class="v"
                            >{playDebug ? playDebug.renderedCount : '—'}/{playDebug
                                ? playDebug.totalMessages
                                : 0}</span
                        >
                    </span>
                    <span class="live">
                        {#if playFollowing}● FOLLOWING{:else}○ SCROLLED{/if}
                    </span>
                    <button class="ctrl" type="button" onclick={resetPlayground}>⟲ reset</button>
                </div>
                <div class="play-body">
                    <div class="play-main">
                        <div class="play-host">
                            <SvelteVirtualChat
                                messages={playMessages}
                                getMessageId={(msg: DemoMessage) => msg.id}
                                estimatedMessageHeight={72}
                                followBottomThresholdPx={48}
                                onFollowBottomChange={(f: boolean) => (playFollowing = f)}
                                onDebugInfo={(info: SvelteVirtualChatDebugInfo) =>
                                    (playDebug = info)}
                                containerClass="h-full"
                                viewportClass="h-full"
                            >
                                {#snippet renderMessage(message: DemoMessage, _index: number)}
                                    <div class="msg" data-role={message.role}>
                                        <div class="who">
                                            {message.role === 'user' ? 'you' : 'assistant'}
                                        </div>
                                        <div class="body">{message.content}</div>
                                    </div>
                                {/snippet}
                            </SvelteVirtualChat>
                        </div>
                        <form
                            class="play-input"
                            onsubmit={(e) => {
                                e.preventDefault()
                                sendPlayMessage()
                            }}
                        >
                            <input
                                bind:value={playInput}
                                placeholder="type a message…"
                                spellcheck="false"
                                aria-label="Chat message"
                            />
                            <button type="submit">send</button>
                        </form>
                    </div>
                    <div class="play-side">
                        <div class="side-k">// virtualization</div>
                        <div class="stat">
                            <span class="sk">total</span>
                            <span class="sv"
                                >{playDebug ? playDebug.totalMessages : playMessages.length}</span
                            >
                        </div>
                        <div class="stat">
                            <span class="sk">in dom</span>
                            <span class="sv accent"
                                >{playDebug ? playDebug.renderedCount : '—'}</span
                            >
                        </div>
                        <div class="stat">
                            <span class="sk">measured</span>
                            <span class="sv">{playDebug ? playDebug.measuredCount : '—'}</span>
                        </div>
                        <div class="stat">
                            <span class="sk">range</span>
                            <span class="sv"
                                >{playDebug
                                    ? `${playDebug.startIndex}–${playDebug.endIndex}`
                                    : '—'}</span
                            >
                        </div>
                        <div class="stat">
                            <span class="sk">follow</span>
                            <span class="sv accent">{playFollowing ? 'bottom' : 'scrolled'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── FIG-005 · AI-READY DOCS ─────────────────────────────── -->
        <section class="brut-ai" id="ai-ready">
            <div class="lede">
                <div class="k">FIG-005 / AI-READY</div>
                <h2>built for <span>ai-assisted</span> code.</h2>
                <p>
                    Point Cursor, Claude Code, or any LLM at the manifests below and they know the
                    full svelte-virtual-chat API — every prop, the debug-info schema, follow-bottom
                    and streaming semantics, and history-prepend anchoring.
                </p>
            </div>
            <div class="ai-panel">
                <div class="ai-head">
                    <span class="ai-tab on">llms.txt</span>
                    <span class="ai-tab">llms-full.txt</span>
                    <span class="grow"></span>
                    <span class="ai-meta">/llmstxt.org</span>
                </div>
                <div class="ai-grid">
                    <a class="ai-cell" href="/llms.txt" target="_blank" rel="noopener">
                        <div class="ai-cell-k">01 · index</div>
                        <h3><code>/llms.txt</code></h3>
                        <p>
                            Compact map. Component overview, follow-bottom + streaming behavior,
                            full props and imperative API, and doc URLs. Drop into any agent for
                            ground-truth lookup.
                        </p>
                        <div class="ai-cell-foot">~5 kB · open ↗</div>
                    </a>
                    <a class="ai-cell" href="/llms-full.txt" target="_blank" rel="noopener">
                        <div class="ai-cell-k">02 · full</div>
                        <h3><code>/llms-full.txt</code></h3>
                        <p>
                            Full reference. Every prop, the debug-info schema, virtualization
                            internals, streaming and history-prepend semantics — with code.
                            Optimised for LLM context windows.
                        </p>
                        <div class="ai-cell-foot">~29 kB · open ↗</div>
                    </a>
                    <a
                        class="ai-cell"
                        href="/docs/getting-started.md"
                        target="_blank"
                        rel="noopener"
                    >
                        <div class="ai-cell-k">03 · per-page mirrors</div>
                        <h3><code>/docs/&lt;slug&gt;.md</code></h3>
                        <p>
                            Every doc page mirrored as raw markdown — getting started, API, and the
                            LLM-streaming, history, scroll, and accessibility guides. The citation
                            surface LLMs prefer.
                        </p>
                        <div class="ai-cell-foot">13 docs · open ↗</div>
                    </a>
                </div>
                <div class="ai-prompt">
                    <span class="ai-prompt-k">// example prompt</span>
                    <code>
                        Use https://virtualchat.svelte.page/llms.txt as the source for
                        <em>@humanspeak/svelte-virtual-chat</em>. Build a Svelte 5 chat UI that
                        streams a Claude API response token-by-token with
                        <em>SvelteVirtualChat</em>, keeping the viewport pinned to bottom via
                        follow-bottom.
                    </code>
                </div>
            </div>
        </section>

        <!-- ── FIG-006 · EXAMPLES ──────────────────────────────────── -->
        <section class="brut-ex">
            <div class="lede">
                <div class="k">FIG-006 / EXAMPLES</div>
                <h2>explore <span>interactive examples</span>.</h2>
                <p>
                    See basic chat, LLM streaming, history loading, and persistent header / footer
                    snippets — all self-contained live demos with copyable source.
                </p>
            </div>
            <div>
                <div class="grid">
                    {#each featuredExamples as ex, i (ex.slug)}
                        <a class="cell" href="/examples/{ex.slug}">
                            <div class="id">№ {pad2(i + 1)} / {pad2(featuredExamples.length)}</div>
                            <div class="corner">↗</div>
                            <h3>{ex.title}</h3>
                            <p>{ex.body}</p>
                            <div class="marker"></div>
                        </a>
                    {/each}
                </div>
                <a class="ex-all" href="/examples">view all examples →</a>
            </div>
        </section>

        <!-- ── Big-type footer ─────────────────────────────────────── -->
        <section class="brut-foot">
            <div class="info">
                <div>SET / JETBRAINS MONO + INTER</div>
                <div>HUMANSPEAK · 2026</div>
                <div>MIT LICENCE</div>
                <div class="v">● {PKG_VERSION}</div>
            </div>
            <MotionButton
                class="big"
                type="button"
                onclick={copyInstall}
                aria-label="Copy install command"
                whileTap={{ scale: 0.985 }}
                whileHover={{ scale: 1.005 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            >
                npm&nbsp;i&nbsp;<span>@humanspeak/</span><br />svelte-virtual-chat
                <span class="copy-hint">
                    <AnimatePresence initial={false}>
                        <MotionSpan
                            key={copied ? 'copied' : 'idle'}
                            class="copy-hint-label"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                        >
                            {copied ? '✓ copied to clipboard' : 'click to copy'}
                        </MotionSpan>
                    </AnimatePresence>
                </span>
            </MotionButton>
            <div class="info right">
                <div>SHEET 06 / 06</div>
                <div>END OF DOCUMENT</div>
                <a class="v" href="#top">↩ TO TOP</a>
            </div>
        </section>
    </main>

    <FooterV2 version={PKG_VERSION} />
</div>

<style>
    /* Brutalist tokens + .brut / .brut-wrap base styles live in
       @humanspeak/docs-kit/styles/brutalist.css (imported via app.css). */

    /* ── Coordinate strip ─────────────────────────────────────────── */
    .brut-coord {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        border-bottom: 1px solid var(--brut-rule);
        font-size: 10px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-coord div {
        padding: 6px 8px;
        border-right: 1px solid var(--brut-rule);
    }
    .brut-coord div:last-child {
        border-right: 0;
    }

    /* ── Hero ─────────────────────────────────────────────────────── */
    .brut-hero {
        padding: 80px 24px 32px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
        position: relative;
    }
    .brut-hero .meta {
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 11px;
        color: var(--brut-ink-3);
        margin: 0;
    }
    .brut-hero .meta .k {
        color: var(--brut-ink-3);
    }
    .brut-hero .meta .v {
        color: var(--brut-ink);
    }
    .brut-hero .meta .v.accent {
        color: var(--brut-accent);
    }
    .brut-hero .meta hr {
        border: 0;
        border-top: 1px dashed var(--brut-rule);
        margin: 8px 0;
    }
    .brut-hero h1 {
        margin: 0;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: clamp(56px, 11vw, 152px);
        line-height: 0.88;
        font-weight: 500;
        letter-spacing: -0.06em;
        text-transform: lowercase;
    }
    .brut-hero h1 .slash {
        color: var(--brut-accent);
    }
    .brut-hero h1 .end {
        color: var(--brut-ink-3);
    }
    .brut-hero .sub {
        margin: 28px 0 0;
        max-width: 720px;
        font-size: 17px;
        line-height: 1.5;
        color: var(--brut-ink-2);
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        letter-spacing: -0.01em;
    }
    .brut-hero .sub b {
        color: var(--brut-ink);
        font-weight: 600;
    }
    .brut-hero .cta-row {
        margin-top: 28px;
        display: flex;
        flex-wrap: wrap;
        gap: 0;
        align-items: stretch;
        width: fit-content;
        max-width: 100%;
    }
    /* Each cell owns its border (so MotionButton transforms stay visible
       inside their own outline). Adjacent cells share a seam via
       `margin-left: -1px` so the row reads as one continuous strip. On
       hover, `z-index: 2` lifts the scaled button above neighbours. */
    .brut-hero .cta-row > * {
        padding: 10px 14px;
        border: 1px solid var(--brut-rule);
        background: var(--brut-bg);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--brut-ink);
        cursor: pointer;
        font-family: inherit;
        text-decoration: none;
        position: relative;
        z-index: 1;
        transition:
            background 0.15s,
            border-color 0.15s;
    }
    .brut-hero .cta-row > * + * {
        margin-left: -1px;
    }
    .brut-hero .cta-row > *:hover {
        z-index: 2;
    }
    .brut-hero .cta-row .pri {
        background: var(--brut-accent);
        color: var(--brut-accent-ink);
        font-weight: 600;
        border-color: var(--brut-accent);
    }
    .brut-hero .cta-row .pri:hover {
        background: var(--brut-accent-hover);
        border-color: var(--brut-accent-hover);
    }
    /* Scope the muted hover to non-primary anchors only, so it never
       clobbers the primary CTA's accent surface. */
    .brut-hero .cta-row a:not(.pri):hover,
    .brut-hero .cta-row :global(.inst:hover) {
        background: var(--brut-bg-2);
        border-color: var(--brut-rule-2);
    }
    /* MotionButton renders into a plain <button> without our scoped
       Svelte hash, so re-state the shared box styles through :global()
       so the install cell matches the surrounding anchors. */
    .brut-hero .cta-row :global(.inst) {
        padding: 10px 18px;
        border: 1px solid var(--brut-rule);
        background: var(--brut-bg-2);
        color: var(--brut-ink-2);
        font-family: inherit;
        font-size: 13px;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        position: relative;
        z-index: 1;
        margin-left: -1px;
        transition:
            background 0.15s,
            border-color 0.15s;
    }
    .brut-hero .cta-row :global(.inst:hover) {
        z-index: 2;
    }
    .brut-hero .cta-row :global(.inst .inst-prompt) {
        color: var(--brut-ink-3);
    }
    .brut-hero .cta-row :global(.inst .inst-cmd) {
        color: var(--brut-ink-2);
    }
    .brut-hero .cta-row :global(.inst .inst-cmd .pkg) {
        color: var(--brut-ink);
    }
    .brut-hero .cta-row :global(.inst .inst-copy) {
        margin-left: 4px;
        padding: 2px 8px;
        font-size: 10.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--brut-accent);
        border: 1px solid var(--brut-rule);
        display: inline-grid;
        align-items: center;
        justify-items: center;
        /* Sized to hold the wider "✓ copied" label so the box does not
           resize when AnimatePresence cross-fades between states. */
        min-width: 84px;
        height: 20px;
        overflow: hidden;
        transition:
            border-color 0.2s,
            background 0.2s;
    }
    .brut-hero .cta-row :global(.inst .inst-copy.is-copied) {
        border-color: var(--brut-accent);
        background: var(--brut-accent-soft);
    }
    .brut-hero .cta-row :global(.inst .inst-copy-label) {
        grid-area: 1 / 1;
        display: inline-block;
        white-space: nowrap;
        will-change: transform, opacity;
    }
    .brut-hero .corner {
        position: absolute;
        font-size: 10px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-hero .corner.tr {
        top: 12px;
        right: 24px;
    }
    .brut-hero .corner.bl {
        bottom: 12px;
        left: 24px;
    }
    .brut-hero .corner.br {
        bottom: 12px;
        right: 24px;
    }

    /* ── Stats row ────────────────────────────────────────────────── */
    .brut-stats {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-stats .s {
        padding: 28px 24px;
        border-right: 1px solid var(--brut-rule);
        position: relative;
        min-height: 160px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .brut-stats .s:last-child {
        border-right: 0;
    }
    .brut-stats .s .k {
        font-size: 10.5px;
        letter-spacing: 0.14em;
        color: var(--brut-ink-3);
    }
    .brut-stats .s .v {
        font-size: 64px;
        line-height: 1;
        font-weight: 500;
        letter-spacing: -0.04em;
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        white-space: nowrap;
    }
    .brut-stats .s .v-num {
        line-height: 1;
    }
    .brut-stats .s .v-unit {
        font-size: 22px;
        letter-spacing: 0;
        font-weight: 500;
        color: inherit;
        line-height: 1;
    }
    .brut-stats .s .note {
        font-size: 11px;
        color: var(--brut-ink-2);
    }
    .brut-stats .s.ac .v {
        color: var(--brut-accent);
    }
    .brut-stats .s::after {
        content: attr(data-idx);
        position: absolute;
        top: 12px;
        right: 14px;
        font-size: 10px;
        color: var(--brut-ink-3);
    }

    /* ── Section lede (shared by stream/feat/play/ai) ─────────────── */
    .brut-stream .lede,
    .brut-feat .lede,
    .brut-play .lede,
    .brut-ai .lede {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-stream .lede h2,
    .brut-feat .lede h2,
    .brut-play .lede h2,
    .brut-ai .lede h2 {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 28px;
        color: var(--brut-ink);
        margin: 12px 0 0;
        letter-spacing: -0.02em;
        text-transform: lowercase;
        font-weight: 500;
    }
    .brut-stream .lede h2 span,
    .brut-feat .lede h2 span,
    .brut-play .lede h2 span,
    .brut-ai .lede h2 span {
        color: var(--brut-accent);
    }
    .brut-stream .lede p,
    .brut-feat .lede p,
    .brut-play .lede p,
    .brut-ai .lede p {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        color: var(--brut-ink-2);
        margin: 12px 0 0;
        font-size: 13px;
        line-height: 1.55;
        letter-spacing: 0;
    }

    /* ── Shared chat message styling (stream + play) ──────────────── */
    .brut-stream .msg,
    .brut-play .msg {
        padding: 14px 18px;
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-stream .msg[data-role='user'],
    .brut-play .msg[data-role='user'] {
        background: var(--brut-bg-2);
    }
    .brut-stream .msg .who,
    .brut-play .msg .who {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 10.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--brut-ink-3);
        margin-bottom: 6px;
    }
    .brut-stream .msg[data-role='user'] .who,
    .brut-play .msg[data-role='user'] .who {
        color: var(--brut-accent);
    }
    .brut-stream .msg .body,
    .brut-play .msg .body {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 13.5px;
        line-height: 1.55;
        color: var(--brut-ink-2);
    }

    /* ── Streaming demo ───────────────────────────────────────────── */
    .brut-stream {
        padding: 28px 24px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-stream .panel,
    .brut-play .panel {
        border: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }
    .brut-stream .panel .bar,
    .brut-play .panel .bar {
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 8px 14px;
        border-bottom: 1px solid var(--brut-rule);
        font-size: 11px;
        color: var(--brut-ink-2);
        background: var(--brut-bg-2);
        flex-wrap: wrap;
    }
    .brut-stream .panel .bar .lbl,
    .brut-play .panel .bar .lbl {
        color: var(--brut-ink-3);
    }
    .brut-stream .panel .bar .v,
    .brut-play .panel .bar .v {
        color: var(--brut-ink);
    }
    .brut-stream .panel .bar .live,
    .brut-play .panel .bar .live {
        margin-left: auto;
        color: var(--brut-accent);
    }
    .brut-stream .panel .ctrl,
    .brut-play .panel .ctrl {
        background: transparent;
        border: 1px solid var(--brut-rule);
        padding: 4px 10px;
        font-family: inherit;
        font-size: 11px;
        color: var(--brut-ink-2);
        cursor: pointer;
    }
    .brut-stream .panel .ctrl:hover,
    .brut-play .panel .ctrl:hover {
        background: var(--brut-bg);
        color: var(--brut-ink);
    }
    .brut-stream .panel .ctrl:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .brut-stream .stream-host {
        height: 460px;
        overflow: hidden;
    }
    .brut-stream .panel .footer {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        border-top: 1px solid var(--brut-rule);
        font-size: 11px;
        color: var(--brut-ink-2);
    }
    .brut-stream .panel .footer > div {
        padding: 8px 14px;
        border-right: 1px solid var(--brut-rule);
    }
    .brut-stream .panel .footer > div:last-child {
        border-right: 0;
    }
    .brut-stream .panel .footer .v {
        color: var(--brut-ink);
    }
    .brut-stream .panel .footer .v.accent {
        color: var(--brut-accent);
    }

    /* ── Features grid ────────────────────────────────────────────── */
    .brut-feat {
        padding: 28px 24px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-feat .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0;
        border-left: 1px solid var(--brut-rule);
        border-top: 1px solid var(--brut-rule);
    }
    .brut-feat .cell {
        border-right: 1px solid var(--brut-rule);
        border-bottom: 1px solid var(--brut-rule);
        padding: 20px 22px;
        min-height: 200px;
        position: relative;
    }
    .brut-feat .cell::after {
        content: '';
        position: absolute;
        inset: 8px;
        border: 1px solid transparent;
        pointer-events: none;
        transition: border-color 0.2s;
    }
    .brut-feat .cell:hover::after {
        border-color: var(--brut-accent);
    }
    .brut-feat .cell .id {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-feat .cell h3 {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 22px;
        font-weight: 500;
        letter-spacing: -0.02em;
        margin: 30px 0 8px;
        color: var(--brut-ink);
    }
    .brut-feat .cell p {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 13.5px;
        color: var(--brut-ink-2);
        line-height: 1.55;
        margin: 0;
        max-width: 320px;
    }
    .brut-feat .cell .corner {
        position: absolute;
        top: 14px;
        right: 16px;
        font-size: 10.5px;
        color: var(--brut-ink-3);
    }
    .brut-feat .cell .marker {
        width: 14px;
        height: 14px;
        border: 1px solid var(--brut-ink-3);
        position: absolute;
        bottom: 16px;
        right: 16px;
    }
    .brut-feat .cell:nth-child(3n + 1) .marker {
        background: var(--brut-accent);
        border-color: var(--brut-accent);
    }

    /* ── Playground ───────────────────────────────────────────────── */
    .brut-play {
        padding: 28px 24px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
        scroll-margin-top: 80px;
    }
    .brut-play .panel .play-body {
        display: grid;
        grid-template-columns: 1fr 220px;
        min-height: 420px;
    }
    .brut-play .panel .play-main {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }
    .brut-play .panel .play-host {
        height: 360px;
        overflow: hidden;
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-play .panel .play-input {
        display: flex;
        gap: 0;
        padding: 12px 14px;
    }
    .brut-play .panel .play-input input {
        flex: 1;
        min-width: 0;
        background: var(--brut-bg-2);
        color: var(--brut-ink);
        border: 1px solid var(--brut-rule);
        outline: none;
        padding: 8px 12px;
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 13px;
    }
    .brut-play .panel .play-input input:focus {
        border-color: var(--brut-accent);
    }
    .brut-play .panel .play-input button {
        border: 1px solid var(--brut-accent);
        background: var(--brut-accent);
        color: var(--brut-accent-ink);
        padding: 8px 18px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        margin-left: -1px;
        transition: background 0.15s;
    }
    .brut-play .panel .play-input button:hover {
        background: var(--brut-accent-hover);
    }
    .brut-play .panel .play-side {
        border-left: 1px solid var(--brut-rule);
        padding: 16px 18px;
        background: var(--brut-bg-2);
        display: flex;
        flex-direction: column;
        gap: 14px;
    }
    .brut-play .panel .play-side .side-k {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
        text-transform: uppercase;
    }
    .brut-play .panel .play-side .stat {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        border-bottom: 1px dashed var(--brut-rule);
        padding-bottom: 8px;
    }
    .brut-play .panel .play-side .stat .sk {
        font-size: 11px;
        color: var(--brut-ink-3);
        letter-spacing: 0.06em;
    }
    .brut-play .panel .play-side .stat .sv {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 18px;
        font-weight: 500;
        color: var(--brut-ink);
        letter-spacing: -0.02em;
    }
    .brut-play .panel .play-side .stat .sv.accent {
        color: var(--brut-accent);
    }

    /* ── Examples grid (mirrors FIG-003 features) ─────────────────── */
    .brut-ex {
        padding: 28px 24px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-ex .lede .k {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-ex .lede h2 {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 28px;
        color: var(--brut-ink);
        margin: 12px 0 0;
        letter-spacing: -0.02em;
        text-transform: lowercase;
        font-weight: 500;
    }
    .brut-ex .lede h2 span {
        color: var(--brut-accent);
    }
    .brut-ex .lede p {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        color: var(--brut-ink-2);
        margin: 12px 0 0;
        font-size: 13px;
        line-height: 1.55;
        max-width: 640px;
    }
    .brut-ex .grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        border-left: 1px solid var(--brut-rule);
        border-top: 1px solid var(--brut-rule);
    }
    .brut-ex .cell {
        display: block;
        border-right: 1px solid var(--brut-rule);
        border-bottom: 1px solid var(--brut-rule);
        padding: 20px 22px;
        min-height: 200px;
        position: relative;
        color: var(--brut-ink);
        text-decoration: none;
    }
    .brut-ex .cell::after {
        content: '';
        position: absolute;
        inset: 8px;
        border: 1px solid transparent;
        pointer-events: none;
        transition: border-color 0.2s;
    }
    .brut-ex .cell:hover::after {
        border-color: var(--brut-accent);
    }
    .brut-ex .cell .id {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-ex .cell h3 {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 22px;
        font-weight: 500;
        letter-spacing: -0.02em;
        margin: 30px 0 8px;
        color: var(--brut-ink);
    }
    .brut-ex .cell p {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 13.5px;
        color: var(--brut-ink-2);
        line-height: 1.55;
        margin: 0;
        max-width: 320px;
    }
    .brut-ex .cell .corner {
        position: absolute;
        top: 14px;
        right: 16px;
        font-size: 14px;
        color: var(--brut-ink-3);
        transition: color 0.2s;
    }
    .brut-ex .cell:hover .corner {
        color: var(--brut-accent);
    }
    .brut-ex .cell .marker {
        width: 14px;
        height: 14px;
        border: 1px solid var(--brut-ink-3);
        position: absolute;
        bottom: 16px;
        right: 16px;
    }
    .brut-ex .cell:nth-child(2n + 1) .marker {
        background: var(--brut-accent);
        border-color: var(--brut-accent);
    }
    .brut-ex .ex-all {
        display: inline-block;
        margin-top: 18px;
        color: var(--brut-accent);
        text-decoration: none;
        font-size: 12px;
        letter-spacing: 0.08em;
    }
    .brut-ex .ex-all:hover {
        text-decoration: underline;
    }

    /* ── AI-ready docs section ────────────────────────────────────── */
    .brut-ai {
        padding: 28px 24px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-ai .ai-panel {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }
    .brut-ai .ai-head {
        display: flex;
        align-items: center;
        gap: 0;
        border-bottom: 1px solid var(--brut-rule);
        background: var(--brut-bg-2);
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        letter-spacing: 0.14em;
        color: var(--brut-ink-3);
        text-transform: uppercase;
    }
    .brut-ai .ai-tab {
        padding: 9px 14px;
        border-right: 1px solid var(--brut-rule);
    }
    .brut-ai .ai-tab.on {
        background: var(--brut-bg);
        color: var(--brut-ink);
    }
    .brut-ai .grow {
        flex: 1;
    }
    .brut-ai .ai-meta {
        padding: 9px 14px;
        border-left: 1px solid var(--brut-rule);
    }
    .brut-ai .ai-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
    }
    .brut-ai .ai-cell {
        position: relative;
        padding: 20px 22px 56px;
        min-height: 200px;
        border-right: 1px solid var(--brut-rule);
        color: var(--brut-ink);
        text-decoration: none;
        transition: background-color 0.15s;
    }
    .brut-ai .ai-cell:last-child {
        border-right: 0;
    }
    .brut-ai .ai-cell:hover {
        background: color-mix(in oklab, var(--brut-accent) 6%, transparent);
    }
    .brut-ai .ai-cell-k {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
        text-transform: uppercase;
    }
    .brut-ai .ai-cell h3 {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 22px;
        font-weight: 500;
        letter-spacing: -0.02em;
        margin: 22px 0 10px;
        color: var(--brut-ink);
    }
    .brut-ai .ai-cell h3 code {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        background: transparent;
        padding: 0;
        font-size: 0.85em;
        color: var(--brut-accent);
    }
    .brut-ai .ai-cell p {
        font-size: 13.5px;
        line-height: 1.55;
        color: var(--brut-ink-2);
        margin: 0;
    }
    .brut-ai .ai-cell-foot {
        position: absolute;
        left: 22px;
        bottom: 18px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: var(--brut-ink-3);
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .brut-ai .ai-prompt {
        padding: 16px 22px;
        border-top: 1px solid var(--brut-rule);
        background: var(--brut-bg-2);
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 13px;
        line-height: 1.6;
        color: var(--brut-ink-2);
    }
    .brut-ai .ai-prompt-k {
        display: block;
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-bottom: 6px;
    }
    .brut-ai .ai-prompt code {
        background: transparent;
        padding: 0;
        color: var(--brut-ink);
    }
    .brut-ai .ai-prompt em {
        color: var(--brut-accent);
        font-style: normal;
    }

    /* ── Footer big-type ──────────────────────────────────────────── */
    .brut-foot {
        padding: 60px 24px 36px;
        display: grid;
        grid-template-columns: 200px 1fr 200px;
        gap: 24px;
        border-top: 1px solid var(--brut-rule);
        align-items: end;
    }
    .brut-foot :global(.big) {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: clamp(36px, 6vw, 88px);
        line-height: 0.9;
        letter-spacing: -0.06em;
        text-transform: lowercase;
        background: transparent;
        border: 0;
        color: var(--brut-ink);
        text-align: left;
        cursor: pointer;
        padding: 0;
        position: relative;
    }
    .brut-foot :global(.big span) {
        color: var(--brut-accent);
    }
    .brut-foot :global(.big .copy-hint) {
        display: inline-grid;
        align-items: center;
        justify-items: start;
        margin-top: 16px;
        height: 16px;
        font-size: 11px;
        letter-spacing: 0.14em;
        color: var(--brut-ink-3);
        text-transform: uppercase;
        overflow: hidden;
        min-width: 200px;
    }
    .brut-foot :global(.big .copy-hint-label) {
        grid-area: 1 / 1;
        display: inline-block;
        white-space: nowrap;
        will-change: transform, opacity;
    }
    .brut-foot :global(.big:hover .copy-hint) {
        color: var(--brut-accent);
    }
    .brut-foot .info {
        font-size: 11px;
        color: var(--brut-ink-3);
        letter-spacing: 0.12em;
        line-height: 1.8;
    }
    .brut-foot .info.right {
        text-align: right;
    }
    .brut-foot .info .v,
    .brut-foot .info a.v {
        color: var(--brut-ink);
        text-decoration: none;
        display: block;
        margin-top: 12px;
    }
    .brut-foot .info a.v:hover {
        color: var(--brut-accent);
    }

    /* ── Responsive collapse ─────────────────────────────────────── */
    @media (max-width: 1024px) {
        .brut-stats {
            grid-template-columns: repeat(3, 1fr);
        }
        .brut-stats .s:nth-child(3n) {
            border-right: 0;
        }
        .brut-stats .s:nth-child(-n + 3) {
            border-bottom: 1px solid var(--brut-rule);
        }
        .brut-feat .grid {
            grid-template-columns: repeat(2, 1fr);
        }
        .brut-play .panel .play-body {
            grid-template-columns: 1fr;
        }
        .brut-play .panel .play-side {
            border-left: 0;
            border-top: 1px solid var(--brut-rule);
            flex-direction: row;
            flex-wrap: wrap;
            gap: 20px;
        }
        .brut-play .panel .play-side .side-k {
            flex-basis: 100%;
        }
        .brut-play .panel .play-side .stat {
            border-bottom: 0;
            flex-direction: column;
            gap: 2px;
            padding-bottom: 0;
        }
        .brut-ai .ai-grid {
            grid-template-columns: 1fr;
        }
        .brut-ai .ai-cell {
            border-right: 0;
            border-bottom: 1px solid var(--brut-rule);
        }
        .brut-ai .ai-cell:last-child {
            border-bottom: 0;
        }
        .brut-ex,
        .brut-ai {
            grid-template-columns: 1fr;
        }
    }
    @media (max-width: 720px) {
        .brut-coord {
            display: none;
        }
        .brut-hero,
        .brut-stream,
        .brut-feat,
        .brut-play,
        .brut-ai,
        .brut-ex {
            grid-template-columns: 1fr;
            padding-left: 16px;
            padding-right: 16px;
        }
        .brut-hero {
            padding-top: 56px;
        }
        .brut-stats {
            grid-template-columns: repeat(2, 1fr);
        }
        .brut-stats .s {
            min-height: 130px;
            padding: 20px 16px;
        }
        .brut-stats .s .v {
            font-size: 44px;
        }
        .brut-stats .s:nth-child(2n) {
            border-right: 0;
        }
        .brut-stats .s:not(:nth-last-child(-n + 2)) {
            border-bottom: 1px solid var(--brut-rule);
        }
        .brut-feat .grid,
        .brut-ex .grid {
            grid-template-columns: 1fr;
        }
        .brut-stream .stream-host {
            height: 360px;
        }
        .brut-foot {
            grid-template-columns: 1fr;
            padding: 40px 16px 28px;
        }
        .brut-foot .info.right {
            text-align: left;
        }
    }
</style>
