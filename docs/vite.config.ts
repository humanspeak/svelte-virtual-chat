import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
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
