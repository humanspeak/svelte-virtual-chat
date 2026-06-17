import {
    docMirrorsPlugin,
    llmsFullPlugin,
    llmsPlugin,
    sitemapManifestPlugin,
    socialCardsPlugin
} from '@humanspeak/docs-kit/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { docsConfig } from './src/lib/docs-config'

export default defineConfig({
    plugins: [
        sitemapManifestPlugin({ blogDir: false }),
        docMirrorsPlugin({ siteUrl: docsConfig.url }),
        llmsPlugin({
            siteUrl: docsConfig.url,
            pkgName: docsConfig.npmPackage,
            description: docsConfig.description,
            prepend: 'llms-positioning.md'
        }),
        llmsFullPlugin({
            siteUrl: docsConfig.url,
            pkgName: docsConfig.npmPackage,
            prepend: 'llms-positioning.md'
        }),
        socialCardsPlugin({
            npmPackage: docsConfig.npmPackage,
            defaultTitle: docsConfig.name,
            defaultDescription:
                'A high-performance virtual chat viewport for Svelte 5. Follow-bottom, streaming-stable, history-aware.',
            defaultFeatures: docsConfig.defaultFeatures
        }),
        tailwindcss(),
        sveltekit()
    ],
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
                    if (id.includes('node_modules/shiki')) {
                        return 'shiki'
                    }
                    if (id.includes('node_modules/marked')) {
                        return 'marked'
                    }
                }
            }
        }
    }
})
