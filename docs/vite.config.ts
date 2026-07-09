import {
    docMirrorsPlugin,
    exampleMirrorsPlugin,
    indexNowPlugin,
    llmsFullPlugin,
    llmsPlugin,
    sitemapManifestPlugin,
    socialCardsPlugin
} from '@humanspeak/docs-kit/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { docsConfig } from './src/lib/docs-config'

const indexNowKey = '3ffcb05f-e81d-415c-b5d3-446fa6ec612d'
const docsSourceBaseUrl = `https://github.com/${docsConfig.repo}/blob/main/docs`

export default defineConfig({
    // Keep docs-kit filesystem generators together and before SvelteKit.
    // They regenerate sitemap, Markdown mirrors, LLM discovery files, and
    // social cards during builds without separate package.json scripts.
    plugins: [
        sitemapManifestPlugin({ blogDir: false }),
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
            prepend: 'llms-positioning.md'
        }),
        socialCardsPlugin({
            npmPackage: docsConfig.npmPackage,
            defaultTitle: docsConfig.name,
            defaultDescription:
                'A high-performance virtual chat viewport for Svelte 5. Follow-bottom, streaming-stable, history-aware.',
            defaultFeatures: docsConfig.defaultFeatures
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
        sveltekit()
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
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    // Isolate heavy optional docs dependencies so they only
                    // load on pages that actually need them.
                    if (id.includes('node_modules/shiki')) {
                        return 'shiki'
                    }
                    if (id.includes('node_modules/marked')) {
                        return 'marked'
                    }
                    if (id.includes('node_modules/@humanspeak/svelte-motion')) {
                        return 'svelte-motion'
                    }
                }
            }
        }
    }
})
