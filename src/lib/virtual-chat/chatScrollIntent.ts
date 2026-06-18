const SCROLL_INTENT_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'PageUp',
    'PageDown',
    'Home',
    'End',
    ' '
])

export type ChatScrollDirection = 'up' | 'down'

export type ChatScrollIntentEvent = {
    direction: ChatScrollDirection | null
}

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
        const wasActive = this.#active
        this.#active = false
        if (this.#timer) {
            clearTimeout(this.#timer)
            this.#timer = null
        }
        if (wasActive) this.#onIntentEnd?.()
    }
}

export const isScrollIntentKey = (key: string): boolean => SCROLL_INTENT_KEYS.has(key)

export const getWheelScrollDirection = (event: WheelEvent): ChatScrollDirection | null => {
    if (event.deltaY > 0) return 'down'
    if (event.deltaY < 0) return 'up'
    return null
}

export const getKeyScrollDirection = (event: KeyboardEvent): ChatScrollDirection | null => {
    if (!isScrollIntentKey(event.key)) return null

    if (event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'Home') return 'up'
    if (event.key === ' ' && event.shiftKey) return 'up'
    return 'down'
}

export const trackScrollIntent = (
    node: HTMLElement,
    onIntent: (_event: ChatScrollIntentEvent) => void
) => {
    const handleWheelIntent = (event: WheelEvent) =>
        onIntent({ direction: getWheelScrollDirection(event) })
    const handlePointerIntent = () => onIntent({ direction: null })
    const handleKeydown = (event: KeyboardEvent) => {
        const direction = getKeyScrollDirection(event)
        if (direction) onIntent({ direction })
    }

    node.addEventListener('wheel', handleWheelIntent, { passive: true })
    node.addEventListener('touchmove', handlePointerIntent, { passive: true })
    node.addEventListener('keydown', handleKeydown)

    return {
        destroy() {
            node.removeEventListener('wheel', handleWheelIntent)
            node.removeEventListener('touchmove', handlePointerIntent)
            node.removeEventListener('keydown', handleKeydown)
        }
    }
}
