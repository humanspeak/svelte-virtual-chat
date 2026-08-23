<script lang="ts">
    import { CompareIndexV2 } from '@humanspeak/docs-kit'
    import { competitors, ours } from '$lib/compare-data'
</script>

<CompareIndexV2
    {competitors}
    {ours}
    introHtml="Honest comparisons of <b>@humanspeak/svelte-virtual-chat</b> with <b>svelte-tiny-virtual-list</b> and <b>TanStack Virtual</b>, focused on the behavior that makes virtualized chat different from generic list windowing."
/>
