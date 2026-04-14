import SvelteVirtualChat from '$lib/SvelteVirtualChat.svelte'

export type {
    SvelteVirtualChatProps,
    SvelteVirtualChatDebugInfo,
    ScrollToBottomOptions,
    ScrollToMessageOptions
} from '$lib/types.js'

export type { VisibleRange, ScrollAnchor } from '$lib/virtual-chat/chatTypes.js'

export { ChatHeightCache } from '$lib/virtual-chat/chatMeasurement.svelte.js'

export { captureScrollAnchor, restoreScrollAnchor } from '$lib/virtual-chat/chatAnchoring.js'

export default SvelteVirtualChat
