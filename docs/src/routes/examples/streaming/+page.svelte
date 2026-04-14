<script lang="ts">
    import StreamingChat from '$lib/examples/StreamingChat.svelte'
</script>

<svelte:head>
    <title>LLM Streaming | Examples | SvelteVirtualChat</title>
    <meta
        name="description"
        content="Simulated LLM token streaming with markdown rendering inside a virtual chat viewport. Demonstrates height stability during message growth."
    />
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-8">
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">LLM Streaming</h1>
        <p class="mt-1 text-sm text-gray-500">
            Simulated token-by-token streaming with markdown rendering. The viewport stays pinned to
            bottom as content grows. Source:
            <a
                href="https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/StreamingChat.svelte"
                target="_blank"
                rel="noopener noreferrer"
                class="text-indigo-600 hover:underline"
            >
                StreamingChat.svelte
            </a>
        </p>
    </div>

    <StreamingChat />
</div>
