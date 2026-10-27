import { rehypeKeepCase } from '@humanspeak/docs-kit/mdsvex'
import {
    demoManifestPlugin,
    docMirrorsPlugin,
    exampleMirrorsPlugin,
    indexNowPlugin,
    llmsFullPlugin,
    llmsPlugin,
    sitemapManifestPlugin,
    socialCardsPlugin
} from '@humanspeak/docs-kit/vite'
import adapter from '@sveltejs/adapter-cloudflare'
import { sveltekit } from '@sveltejs/kit/vite'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { mdsvex } from 'mdsvex'
import { createHighlighter } from 'shiki'
import { defineConfig } from 'vite'

import { competitors, ours } from './src/lib/compare-data.js'
import { docsConfig } from './src/lib/docs-config.js'

const indexNowKey = '3ffcb05f-e81d-415c-b5d3-446fa6ec612d'
const docsSourceBaseUrl = `https://github.com/${docsConfig.repo}/blob/main/docs`

const highlighter = await createHighlighter({
    themes: ['github-light', 'one-dark-pro'],
    langs: [
        'javascript',
        'typescript',
        'html',
        'css',
        'json',
        'bash',
        'shell',
        'svelte',
        'markdown',
        'text'
    ]
})

export default defineConfig({
    // Keep docs-kit filesystem generators together and before SvelteKit.
    // They regenerate demo manifests, sitemap data, Markdown mirrors, LLM
    // discovery files, and social cards without separate package.json scripts.
    plugins: [
        sitemapManifestPlugin({
            blogDir: false,
            extraPages: competitors.map((competitor) => ({
                route: `/compare/${competitor.slug}`,
                source: 'src/lib/compare-data.ts'
            }))
        }),
        demoManifestPlugin({ split: true }),
        docMirrorsPlugin({ siteUrl: docsConfig.url }),
        exampleMirrorsPlugin({
            siteUrl: docsConfig.url,
            sourceBaseUrl: docsSourceBaseUrl
        }),
        llmsFullPlugin({
            siteUrl: docsConfig.url,
            pkgName: docsConfig.npmPackage,
            prepend: 'llms-positioning.md'
        }),
        llmsPlugin({
            siteUrl: docsConfig.url,
            pkgName: docsConfig.npmPackage,
            description: docsConfig.description,
            prepend: 'llms-positioning.md',
            comparisons: { ours, competitors }
        }),
        socialCardsPlugin({
            npmPackage: docsConfig.npmPackage,
            defaultTitle: docsConfig.name,
            defaultDescription:
                'A high-performance virtual chat viewport for Svelte 5. Follow-bottom, streaming-stable, history-aware.',
            defaultFeatures: docsConfig.defaultFeatures,
            extraPages: [
                {
                    ogSlug: 'compare',
                    ogTitle: 'Compare',
                    ogTagline: 'Chat-aware virtualization compared with generic list windowing.',
                    ogFeatures: [
                        'Chat Behavior',
                        'Feature Matrices',
                        'Pros & Cons',
                        'Honest Verdicts'
                    ]
                },
                ...competitors.map((competitor) => ({
                    ogSlug: `compare-${competitor.slug}`,
                    ogTitle: `vs ${competitor.name}`,
                    ogTagline: competitor.tagline,
                    ogFeatures: [
                        'Follow-Bottom',
                        'Streaming Stability',
                        'History Anchoring',
                        'Honest Verdict'
                    ]
                }))
            ]
        }),
        indexNowPlugin({
            siteUrl: docsConfig.url,
            key: indexNowKey,
            productionMode: 'indexnow',
            // Search-engine pings are best effort; do not block docs deploys
            // on transient IndexNow auth or availability failures.
            failOnError: false
        }),
        tailwindcss(),
        sveltekit({
            preprocess: [
                vitePreprocess(),
                mdsvex({
                    rehypePlugins: [rehypeKeepCase],
                    extensions: ['.md', '.svx'],
                    highlight: {
                        highlighter: async (code, lang) => {
                            lang ??= 'text'
                            const lightHtml = highlighter.codeToHtml(code, {
                                lang,
                                theme: 'github-light'
                            })
                            const darkHtml = highlighter.codeToHtml(code, {
                                lang,
                                theme: 'one-dark-pro'
                            })
                            const encoded = Buffer.from(code).toString('base64')

                            const combinedHtml = `
                        <div class="shiki-container" data-code="${encoded}" data-lang="${lang}">
                            <div class="shiki-light">${lightHtml}</div>
                            <div class="shiki-dark">${darkHtml}</div>
                        </div>
                    `

                            return `{@html ${JSON.stringify(combinedHtml)}}`
                        }
                    }
                })
            ],
            extensions: ['.svelte', '.svx'],
            adapter: adapter(),
            csp: {
                mode: 'hash',
                directives: {
                    'default-src': ['self'],
                    'script-src': [
                        'self',
                        'https://*.ahrefs.com',
                        'https://j.svelte.page',
                        'unsafe-inline',
                        'wasm-unsafe-eval'
                    ],
                    'style-src': ['self', 'unsafe-inline'],
                    'img-src': ['self', 'data:', 'https:'],
                    'font-src': ['self', 'data:'],
                    'worker-src': ['self', 'blob:'],
                    'connect-src': ['self', 'https:'],
                    'frame-ancestors': ['none'],
                    'form-action': ['self'],
                    'base-uri': ['self'],
                    'upgrade-insecure-requests': true
                }
            }
        })
    ],
    // docs-kit ships Svelte source so vite-plugin-svelte can preserve scoped
    // styles. The native social-card dependencies also need to stay out of
    // optimizeDeps because rolldown cannot prebundle .node bindings.
    optimizeDeps: {
        exclude: [
            '@humanspeak/docs-kit',
            '@humanspeak/svelte-satori-fix',
            '@resvg/resvg-js',
            'satori',
            'satori-html'
        ]
    },
    server: {
        port: 8026,
        fs: {
            allow: ['..']
        }
    }
})
