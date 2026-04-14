<script lang="ts">
    import BasicChat from '$lib/examples/BasicChat.svelte'
</script>

<svelte:head>
    <title>Basic Chat | Examples | SvelteVirtualChat</title>
    <meta
        name="description"
        content="Interactive basic chat example with follow-bottom behavior, scroll-away detection, and virtualized message rendering."
    />
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-8">
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Basic Chat</h1>
        <p class="mt-1 text-sm text-gray-500">
            Send messages, watch follow-bottom behavior, and scroll away to see the unread
            indicator. Source:
            <a
                href="https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/BasicChat.svelte"
                target="_blank"
                rel="noopener noreferrer"
                class="text-indigo-600 hover:underline"
            >
                BasicChat.svelte
            </a>
        </p>
    </div>

    <BasicChat />
</div>
