<script lang="ts">
    import { page } from '$app/state'
    import OG from '$lib/components/shared-link/OG.svelte'

    const cardType: 'og' | 'twitter' = $derived(
        (page.url.searchParams.get('type') as 'og' | 'twitter') || 'og'
    )
</script>

<OG type={cardType} url={page.url.origin} />
