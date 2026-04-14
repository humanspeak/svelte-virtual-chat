import { docsConfig } from '$lib/docs-config'
import { fetchOtherProjects } from '@humanspeak/docs-kit'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async () => {
    try {
        return { otherProjects: await fetchOtherProjects(docsConfig.slug) }
    } catch {
        return { otherProjects: [] }
    }
}
