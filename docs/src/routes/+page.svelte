<svelte:head>
    <title>SvelteVirtualChat — Examples</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
    <div class="mb-12">
        <h1 class="mb-4 text-4xl font-bold text-gray-900">SvelteVirtualChat</h1>
        <p class="text-lg text-gray-600">
            A high-performance virtual chat viewport for Svelte 5. Purpose-built for LLM
            conversations, support chat, and any message-based UI.
        </p>
    </div>

    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <a
            href="/examples/basic-chat"
            class="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
            <h2 class="mb-2 text-lg font-semibold group-hover:text-indigo-600">Basic Chat</h2>
            <p class="text-sm text-gray-500">
                Simple chat interface with send/receive, follow-bottom behavior, and scroll-away
                detection.
            </p>
        </a>

        <a
            href="/examples/streaming"
            class="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
            <h2 class="mb-2 text-lg font-semibold group-hover:text-indigo-600">LLM Streaming</h2>
            <p class="text-sm text-gray-500">
                Token-by-token streaming with markdown rendering. Demonstrates height stability
                during message growth.
            </p>
        </a>

        <a
            href="/examples/history-loading"
            class="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
            <h2 class="mb-2 text-lg font-semibold group-hover:text-indigo-600">History Loading</h2>
            <p class="text-sm text-gray-500">
                Scroll up to load older messages with anchor preservation. No viewport jump on
                prepend.
            </p>
        </a>
    </div>

    <div class="mt-12 rounded-xl border border-gray-200 bg-white p-6">
        <h2 class="mb-4 text-lg font-semibold">Quick Start</h2>
        <pre
            class="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"><code>{`npm install @humanspeak/svelte-virtual-chat`}</code></pre>

        <pre
            class="mt-4 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"><code>{`<script lang="ts">
  import SvelteVirtualChat from '@humanspeak/svelte-virtual-chat'

  let messages = $state([...])
<\/script>

<SvelteVirtualChat
  \{messages\}
  getMessageId=\{(msg) => msg.id\}
  estimatedMessageHeight=\{72\}
  containerClass="h-[600px]"
  viewportClass="h-full"
>
  \{#snippet renderMessage(message, index)\}
    <div class="p-4">\{message.content\}</div>
  \{/snippet\}
</SvelteVirtualChat>`}</code></pre>
    </div>
</div>
