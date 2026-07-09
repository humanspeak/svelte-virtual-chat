<script lang="ts">
    import { BrutIndexV2, getSeoContext } from '@humanspeak/docs-kit'
    import rootPkg from '../../../../package.json'

    const PKG_NAME = rootPkg.name

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'Interactive Examples | Svelte Virtual Chat'
        seo.description =
            'Interactive examples demonstrating @humanspeak/svelte-virtual-chat features: basic chat, LLM streaming, history loading, and header/footer snippets.'
        seo.ogTitle = 'Interactive Examples'
        seo.ogTagline = 'See SvelteVirtualChat in action with live demos.'
        seo.ogFeatures = ['Basic Chat', 'LLM Streaming', 'History Loading', 'Header & Footer']
        seo.ogSlug = 'examples'
    }

    type ExampleTag = 'DEMO' | 'STREAMING' | 'HISTORY' | 'LAYOUT'

    type Example = {
        slug: string
        title: string
        tag: ExampleTag
        description: string
    }

    const examples: Example[] = [
        {
            slug: 'basic-chat',
            title: 'Basic Chat',
            tag: 'DEMO',
            description:
                'Send and receive messages with follow-bottom behavior, scroll-away detection, bulk message loading, and live virtualization stats.'
        },
        {
            slug: 'streaming',
            title: 'LLM Streaming',
            tag: 'STREAMING',
            description:
                'Simulated token-by-token streaming with markdown rendering. Watch the viewport stay pinned as content grows with live performance metrics.'
        },
        {
            slug: 'history-loading',
            title: 'History Loading',
            tag: 'HISTORY',
            description:
                'Scroll up to trigger older message loading. The viewport preserves your scroll position as messages are prepended above.'
        },
        {
            slug: 'header-footer',
            title: 'Header & Footer',
            tag: 'LAYOUT',
            description:
                'Persistent header and footer snippets that render above and below all messages. Includes a typing indicator that triggers follow-bottom.'
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')

    const items = examples.map((e, i) => ({
        href: `/examples/${e.slug}`,
        id: `№ ${pad2(i + 1)} / ${pad2(examples.length)}`,
        title: `${e.title.toLowerCase()}.`,
        tag: e.tag,
        line: e.description
    }))
</script>

<BrutIndexV2
    hero={{
        figLabel: 'FIG-001 · EXAMPLES INDEX',
        figId: 'FIG-001',
        sheetLabel: 'SHEET 01 / 02',
        meta: [
            { k: 'demos', v: String(examples.length) },
            { k: 'format', v: 'live chat' },
            { k: 'tone', v: 'interactive' },
            { rule: 'dashed' },
            { k: 'library', v: PKG_NAME },
            { k: 'framework', v: 'svelte 5', accent: true }
        ],
        metaFooter: '// scroll for demos',
        kicker: '// examples / live demos',
        title: { accent: 'examples', end: '.' },
        subHtml:
            'Hands-on demos of <b>@humanspeak/svelte-virtual-chat</b> — follow-bottom behavior, LLM streaming stability, history prepend anchoring, and persistent header / footer snippets. Run it, inspect it, ship it.',
        ctas: [
            { label: 'open basic chat ↗', href: '/examples/basic-chat', primary: true },
            { label: 'get started', href: '/docs/getting-started' },
            { label: 'api reference', href: '/docs/api/svelte-virtual-chat' }
        ]
    }}
    lede={{
        kicker: 'FIG-002 / DEMOS',
        title: { prefix: 'pick a ', accent: 'demo', suffix: '.' },
        body: 'Each page is a self-contained live example with the source you need to copy into your own project.'
    }}
    {items}
    footer={{
        big: {
            prefix: 'try ',
            accent: 'basic chat',
            href: '/examples/basic-chat',
            hint: 'send messages live'
        }
    }}
/>
