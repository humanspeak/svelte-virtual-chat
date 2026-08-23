import type { Breadcrumb, NavSection } from '@humanspeak/docs-kit'
import {
    Accessibility,
    BookOpen,
    Code,
    Gauge,
    History,
    LayoutTemplate,
    MessageSquare,
    Play,
    Rocket,
    Settings,
    Zap
} from '@lucide/svelte'

export const headerNav: { label: string; href: string }[] = [
    { label: 'docs', href: '/docs' },
    { label: 'examples', href: '/examples' },
    { label: 'compare', href: '/compare' },
    { label: 'blog', href: '/blog' }
]

const blogPostTitles: Record<string, string> = {
    'building-a-chatbot-ui-in-svelte': 'Building a Chatbot UI in Svelte 5'
}

export function buildBreadcrumbs(pathname: string): Breadcrumb[] {
    if (pathname === '/docs') return [{ title: 'Docs' }]
    if (pathname === '/examples') return [{ title: 'Examples' }]
    if (pathname === '/blog' || pathname === '/blog/') return [{ title: 'Blog' }]
    if (pathname.startsWith('/blog/')) {
        const slug = pathname.replace('/blog/', '').replace(/\/$/, '')
        const title =
            blogPostTitles[slug] ??
            slug
                .split('-')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
        return [{ title: 'Blog', href: '/blog' }, { title }]
    }

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
        items: [{ title: 'Getting Started', href: '/docs/getting-started', icon: Rocket }]
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
            { title: 'Scroll Behavior', href: '/docs/guides/scroll-behavior', icon: Gauge },
            { title: 'Accessibility', href: '/docs/guides/accessibility', icon: Accessibility }
        ]
    },
    {
        title: 'Interactive Demos',
        icon: Play,
        items: [
            { title: 'All Examples', href: '/examples', icon: Play },
            { title: 'Basic Chat', href: '/examples/basic-chat', icon: MessageSquare },
            { title: 'LLM Streaming', href: '/examples/streaming', icon: Zap },
            { title: 'History Loading', href: '/examples/history-loading', icon: History },
            { title: 'Header & Footer', href: '/examples/header-footer', icon: LayoutTemplate }
        ]
    }
]
