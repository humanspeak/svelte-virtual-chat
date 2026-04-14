<script>
    import '../app.css'

    let { children } = $props()
</script>

<div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white">
        <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <a href="/" class="text-lg font-bold text-indigo-600">SvelteVirtualChat</a>
            <nav class="flex gap-6 text-sm">
                <a href="/examples/basic-chat" class="hover:text-indigo-600">Basic Chat</a>
                <a href="/examples/streaming" class="hover:text-indigo-600">Streaming</a>
                <a href="/examples/history-loading" class="hover:text-indigo-600">History Loading</a
                >
                <a
                    href="https://github.com/humanspeak/svelte-virtual-chat"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-indigo-600"
                >
                    GitHub
                </a>
            </nav>
        </div>
    </header>

    <main>
        {@render children()}
    </main>
</div>
