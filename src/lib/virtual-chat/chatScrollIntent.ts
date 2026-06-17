const SCROLL_INTENT_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'PageUp',
    'PageDown',
    'Home',
    'End',
    ' '
])

export type ChatScrollIntentOptions = {
    timeoutMs?: number
    onIntentStart?: () => void
    onIntentEnd?: () => void
}

export class ChatScrollIntent {
    #active = false
    #timer: ReturnType<typeof setTimeout> | null = null
    readonly #timeoutMs: number
    readonly #onIntentStart: (() => void) | undefined
    readonly #onIntentEnd: (() => void) | undefined

    constructor(options: ChatScrollIntentOptions = {}) {
        this.#timeoutMs = options.timeoutMs ?? 150
        this.#onIntentStart = options.onIntentStart
        this.#onIntentEnd = options.onIntentEnd
    }

    get isActive(): boolean {
        return this.#active
    }

    mark(): void {
        const wasActive = this.#active
        this.#active = true
        if (!wasActive) this.#onIntentStart?.()
        if (this.#timer) clearTimeout(this.#timer)
        this.#timer = setTimeout(() => {
            this.#active = false
            this.#timer = null
            this.#onIntentEnd?.()
        }, this.#timeoutMs)
    }

    destroy(): void {
        this.#active = false
        if (this.#timer) {
            clearTimeout(this.#timer)
            this.#timer = null
        }
    }
}

export const isScrollIntentKey = (key: string): boolean => SCROLL_INTENT_KEYS.has(key)

export const trackScrollIntent = (node: HTMLElement, onIntent: () => void) => {
    const handlePointerIntent = () => onIntent()
    const handleKeydown = (event: KeyboardEvent) => {
        if (isScrollIntentKey(event.key)) onIntent()
    }

    node.addEventListener('wheel', handlePointerIntent, { passive: true })
    node.addEventListener('touchmove', handlePointerIntent, { passive: true })
    node.addEventListener('keydown', handleKeydown)

    return {
        destroy() {
            node.removeEventListener('wheel', handlePointerIntent)
            node.removeEventListener('touchmove', handlePointerIntent)
            node.removeEventListener('keydown', handleKeydown)
        }
    }
}
