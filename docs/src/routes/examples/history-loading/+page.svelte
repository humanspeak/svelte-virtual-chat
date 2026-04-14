<script lang="ts">
    import HistoryLoading from '$lib/examples/HistoryLoading.svelte'
</script>

<svelte:head>
    <title>History Loading | Examples | SvelteVirtualChat</title>
    <meta
        name="description"
        content="Scroll up to load older messages with anchor preservation. Demonstrates prepend-history behavior without viewport jumping."
    />
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-8">
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">History Loading</h1>
        <p class="mt-1 text-sm text-gray-500">
            Scroll to the top to trigger history loading. The viewport preserves your scroll
            position as older messages are prepended. Source:
            <a
                href="https://github.com/humanspeak/svelte-virtual-chat/blob/main/docs/src/lib/examples/HistoryLoading.svelte"
                target="_blank"
                rel="noopener noreferrer"
                class="text-indigo-600 hover:underline"
            >
                HistoryLoading.svelte
            </a>
        </p>
    </div>

    <HistoryLoading />
</div>
