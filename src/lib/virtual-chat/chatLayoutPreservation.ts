/**
 * Short-lived guard for scroll events caused by layout growth rather than a
 * user's deliberate attempt to leave the bottom.
 */
export class ChatLayoutPreservation {
    #active = false
    #timer: ReturnType<typeof setTimeout> | null = null
    readonly #timeoutMs: number

    constructor(timeoutMs = 120) {
        this.#timeoutMs = timeoutMs
    }

    get isActive(): boolean {
        return this.#active
    }

    begin(): void {
        this.#active = true
        if (this.#timer) clearTimeout(this.#timer)
        this.#timer = setTimeout(() => {
            this.#active = false
            this.#timer = null
        }, this.#timeoutMs)
    }

    end(): void {
        this.#active = false
        if (this.#timer) {
            clearTimeout(this.#timer)
            this.#timer = null
        }
    }

    destroy(): void {
        this.end()
    }
}
