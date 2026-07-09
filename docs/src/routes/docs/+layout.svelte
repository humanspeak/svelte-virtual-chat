<script lang="ts">
    import { DocsLayoutV2, type NavItem } from '@humanspeak/docs-kit'
    import { docsConfig } from '$lib/docs-config'
    import { buildBreadcrumbs, docsSections, headerNav } from '$lib/docsNav'
    import favicon from '$lib/assets/logo.svg'
    import rootPkg from '../../../../package.json'

    import type { Snippet } from 'svelte'

    const { children, data }: { children: Snippet; data: { otherProjects: NavItem[] } } = $props()
    const PKG_VERSION = rootPkg.version
</script>

<DocsLayoutV2
    config={docsConfig}
    sections={docsSections}
    otherProjects={data.otherProjects}
    {favicon}
    version={PKG_VERSION}
    nav={headerNav}
    siteUrl={docsConfig.url}
    breadcrumbResolver={buildBreadcrumbs}
>
    {@render children()}
</DocsLayoutV2>
