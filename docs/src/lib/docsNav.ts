import type { Breadcrumb, NavSection } from '@humanspeak/docs-kit'
import {
    BookOpen,
    Box,
    Code,
    Gauge,
    History,
    MessageSquare,
    Play,
    Rocket,
    Settings,
    Zap
} from '@lucide/svelte'

export function buildBreadcrumbs(pathname: string): Breadcrumb[] {
    if (pathname === '/docs') return [{ title: 'Docs' }]
    if (pathname === '/examples') return [{ title: 'Examples' }]

    for (const section of docsSections) {
        for (const item of section.items) {
            if (item.href !== pathname) continue
            const itemTitle = item.title

            if (pathname.startsWith('/examples/')) {
                return [{ title: 'Examples', href: '/examples' }, { title: itemTitle }]
            }

            if (pathname.startsWith('/docs/')) {
                const depth = pathname.replace('/docs/', '').split('/').length
                if (depth === 1) {
                    return [{ title: 'Docs', href: '/docs/getting-started' }, { title: itemTitle }]
                }
                return [
                    { title: 'Docs', href: '/docs/getting-started' },
                    { title: section.title },
                    { title: itemTitle }
                ]
            }
        }
    }

    return [{ title: 'Docs' }]
}

export const docsSections: NavSection[] = [
    {
        title: 'Get Started',
        icon: Rocket,
        items: [
            { title: 'Getting Started', href: '/docs/getting-started', icon: Rocket },
            { title: 'Installation', href: '/docs/installation', icon: Box }
        ]
    },
    {
        title: 'API Reference',
        icon: BookOpen,
        items: [
            {
                title: 'SvelteVirtualChat',
                href: '/docs/api/svelte-virtual-chat',
                icon: MessageSquare
            },
            { title: 'Props', href: '/docs/api/props', icon: Settings },
            { title: 'Imperative API', href: '/docs/api/imperative', icon: Code }
        ]
    },
    {
        title: 'Guides',
        icon: Settings,
        items: [
            { title: 'LLM Streaming', href: '/docs/guides/llm-streaming', icon: Zap },
            { title: 'History Loading', href: '/docs/guides/history-loading', icon: History },
            { title: 'Scroll Behavior', href: '/docs/guides/scroll-behavior', icon: Gauge }
        ]
    },
    {
        title: 'Interactive Demos',
        icon: Play,
        items: [
            { title: 'All Examples', href: '/examples', icon: Play },
            { title: 'Basic Chat', href: '/examples/basic-chat', icon: MessageSquare },
            { title: 'LLM Streaming', href: '/examples/streaming', icon: Zap },
            { title: 'History Loading', href: '/examples/history-loading', icon: History }
        ]
    }
]
