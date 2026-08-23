import type { ComparisonOurs, Competitor } from '@humanspeak/docs-kit'

export const ours: ComparisonOurs = {
    name: 'Svelte Virtual Chat',
    npmPackage: '@humanspeak/svelte-virtual-chat',
    slug: 'svelte-virtual-chat',
    url: 'https://virtualchat.svelte.page'
}

const shared = {
    prosUs: [
        'Follow-bottom stays pinned while new messages and streaming tokens arrive',
        'Scrolling away releases follow-bottom without new content pulling the reader back',
        'Prepending older history preserves the visible message and its viewport offset',
        'In-frame height correction keeps growing messages stable before paint',
        'getMessageId tracks conversation identity instead of array position',
        'Automatic variable-height measurement for rendered message content',
        'Svelte 5 snippets, runes, TypeScript generics, and an imperative chat API'
    ],
    consUs: [
        'Purpose-built for vertical message timelines rather than generic lists, grids, or tables',
        'Does not currently support sticky indices or document-window scrolling',
        'Newer package with a smaller user community and ecosystem'
    ]
}

export const competitors: Competitor[] = [
    {
        slug: 'svelte-tiny-virtual-list',
        name: 'svelte-tiny-virtual-list',
        seoTitle: 'Svelte Virtual Chat vs svelte-tiny-virtual-list',
        tagline: 'A chat-aware Svelte viewport compared with a compact generic virtual list.',
        description:
            'Compare @humanspeak/svelte-virtual-chat with svelte-tiny-virtual-list for Svelte 5 chat interfaces. Both virtualize long lists, but Svelte Virtual Chat includes streaming-safe follow-bottom, anchored history prepends, message identity, and automatic measurement for growing conversation content.',
        website: 'https://github.com/jonasgeiler/svelte-tiny-virtual-list#readme',
        github: 'https://github.com/jonasgeiler/svelte-tiny-virtual-list',
        npm: 'svelte-tiny-virtual-list',
        type: 'Svelte Virtual List Component',
        approach: 'Generic windowing with explicit item-size inputs',
        features: [
            { name: 'Svelte 5 support', us: true, them: true },
            { name: 'Chat-aware follow-bottom', us: true, them: false },
            { name: 'Streaming height correction', us: 'Same-frame correction', them: false },
            { name: 'History prepend anchoring', us: true, them: false },
            { name: 'Message identity', us: 'getMessageId', them: 'Array index' },
            { name: 'Automatic variable-height measurement', us: true, them: false },
            { name: 'Sticky indices', us: false, them: true },
            { name: 'Horizontal virtualization', us: false, them: true },
            { name: 'Programmatic scrolling', us: 'Message ID or bottom', them: 'Index' }
        ],
        prosUs: [
            ...shared.prosUs,
            'Chat behavior is part of the component contract instead of application wiring'
        ],
        prosThem: [
            'Compact, dependency-free generic virtual-list component',
            'Supports vertical and horizontal layouts',
            'Supports sticky indices for pinned rows such as date separators',
            'Accepts fixed, array-based, or function-based item sizes'
        ],
        consUs: [...shared.consUs],
        consThem: [
            'Follow-bottom and scroll-away behavior must be implemented by the application',
            'History prepends require application-level anchor capture and restoration',
            'Growing streaming messages require manual measurement and scroll correction',
            'Variable heights rely on supplied sizes or explicit recomputation'
        ],
        verdict:
            'Choose svelte-tiny-virtual-list for a small generic Svelte 5 virtual list, especially when horizontal layouts or sticky indices matter. Choose @humanspeak/svelte-virtual-chat when the list is a conversation and stable streaming, follow-bottom, history loading, and message identity should work as one component contract.',
        keywords: [
            'svelte-tiny-virtual-list alternative',
            'svelte virtual chat vs svelte-tiny-virtual-list',
            'svelte 5 chatbot virtual list'
        ]
    },
    {
        slug: 'tanstack-svelte-virtual',
        name: 'TanStack Virtual',
        seoTitle: 'Svelte Virtual Chat vs TanStack Virtual for Chat UIs',
        tagline:
            'A purpose-built Svelte chat viewport compared with a powerful headless virtualizer.',
        description:
            'Compare @humanspeak/svelte-virtual-chat with @tanstack/svelte-virtual for Svelte chat and LLM interfaces. TanStack Virtual offers flexible headless primitives for many layouts; Svelte Virtual Chat packages the conversation-specific scrolling behavior needed for streaming replies and bidirectional history.',
        website: 'https://tanstack.com/virtual/latest/docs/framework/svelte',
        github: 'https://github.com/TanStack/virtual',
        npm: '@tanstack/svelte-virtual',
        type: 'Headless Multi-framework Virtualizer',
        approach: 'Svelte adapter around framework-agnostic virtualizer primitives',
        features: [
            { name: 'Svelte 5 support', us: true, them: true },
            { name: 'Chat-aware follow-bottom', us: true, them: 'User-land behavior' },
            {
                name: 'Streaming height correction',
                us: 'Same-frame chat correction',
                them: 'Generic resize adjustment'
            },
            { name: 'History prepend anchoring', us: true, them: 'User-land behavior' },
            { name: 'Message identity', us: 'getMessageId', them: 'Index/key configuration' },
            { name: 'Automatic variable-height measurement', us: true, them: true },
            { name: 'Window scrolling', us: false, them: true },
            { name: 'Grid and horizontal virtualization', us: false, them: true },
            { name: 'Measurement cache access', us: 'Internal', them: 'Configurable primitives' }
        ],
        prosUs: [
            ...shared.prosUs,
            'Smaller chat-shaped API with fewer scroll-state edge cases left to application code'
        ],
        prosThem: [
            'Mature headless engine with broad framework support',
            'Window, element, horizontal, grid, table, and sticky virtualization patterns',
            'Fine-grained control over measurement, overscan, margins, and scroll adjustment',
            'Large ecosystem and extensive examples'
        ],
        consUs: [...shared.consUs],
        consThem: [
            'Chat follow state and scroll-away intent remain application responsibilities',
            'History loading requires custom anchor and restoration logic',
            'More primitives and integration code for a conventional message timeline',
            'A generic resize correction does not provide a complete streaming-chat contract'
        ],
        verdict:
            'Choose TanStack Virtual when you need headless control, window scrolling, grids, tables, or a virtualization strategy shared across frameworks. Choose @humanspeak/svelte-virtual-chat when you want a Svelte 5 conversation viewport whose follow-bottom, streaming growth, history prepend, and message identity behavior is already integrated and tested.',
        keywords: [
            'tanstack virtual svelte chat',
            '@tanstack/svelte-virtual alternative',
            'svelte virtual chat vs tanstack virtual'
        ]
    }
]

export function getCompetitor(slug: string): Competitor | undefined {
    return competitors.find((competitor) => competitor.slug === slug)
}
