<script lang="ts">
    import { resolve } from '$app/paths'

    type Link = { href: string; label: string }
    type Section = { title: string; links: Link[] }

    const sections: Section[] = [
        {
            title: 'Tests — Basic',
            links: [
                { href: resolve('/tests/chat/basic'), label: 'Basic chat' },
                { href: resolve('/tests/chat/append'), label: 'Append while following' },
                { href: resolve('/tests/chat/scroll-away'), label: 'Append while scrolled away' },
                { href: resolve('/tests/chat/header-footer'), label: 'Header & footer' }
            ]
        },
        {
            title: 'Tests — Streaming',
            links: [{ href: resolve('/tests/chat/streaming'), label: 'Streaming growth' }]
        },
        {
            title: 'Tests — History',
            links: [{ href: resolve('/tests/chat/history'), label: 'Prepend history' }]
        },
        {
            title: 'Tests — Performance',
            links: [
                { href: resolve('/tests/chat/bulk'), label: 'Bulk messages (1000+)' },
                {
                    href: resolve('/tests/chat/genai-like'),
                    label: 'Genai-like layout (header + tall footer)'
                },
                {
                    href: resolve('/tests/chat/perf-bench'),
                    label: 'Performance baseline (longtask + rAF p95)'
                }
            ]
        }
    ]
</script>

<svelte:head>
    <title>@humanspeak/svelte-virtual-chat — Tests</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
    <h1 class="mb-6 text-2xl font-semibold">@humanspeak/svelte-virtual-chat — Tests</h1>
    <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
        {#each sections as section (section.title)}
            <div>
                <h2 class="mb-3 text-xl font-medium">{section.title}</h2>
                <ul class="list-disc space-y-2 pl-5">
                    {#each section.links as { href, label } (href)}
                        <li>
                            <a class="text-blue-600 hover:underline" {href}>{label}</a>
                        </li>
                    {/each}
                </ul>
            </div>
        {/each}
    </div>
</div>
