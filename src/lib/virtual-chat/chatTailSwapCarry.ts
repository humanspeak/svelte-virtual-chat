export type TailSwapCarryAssignment = {
    id: string
    height: number
}

export type TailSwapCarryResult = {
    carriedHeights: TailSwapCarryAssignment[]
    reserveHeight: number
    shouldClearReserve: boolean
    shouldSnapAfterClear: boolean
}

export type ObserveTailSwapArgs = {
    currentIds: readonly string[]
    getHeight: (_id: string) => number | undefined
    estimatedHeight: number
    canCarryTailRemoval: boolean
}

const NO_RESULT: TailSwapCarryResult = {
    carriedHeights: [],
    reserveHeight: 0,
    shouldClearReserve: false,
    shouldSnapAfterClear: false
}

export const startsWithIds = (ids: readonly string[], prefix: readonly string[]) => {
    if (ids.length < prefix.length) return false
    for (let i = 0; i < prefix.length; i++) {
        if (ids[i] !== prefix[i]) return false
    }
    return true
}

/**
 * Tracks the one timing-sensitive shape the height cache intentionally does
 * not own: `[...prefix, measured-tail] -> [...prefix] -> [...prefix, new-id]`.
 *
 * The component uses the returned reserve to keep bottom geometry stable
 * during the empty tick, then seeds the appended id with the removed height if
 * it arrives before the pending carry is cleared.
 */
export class ChatTailSwapCarry {
    #previousIds: string[] = []
    #pendingPrefix: string[] = []
    #pendingHeights: number[] = []

    clear(): void {
        this.#pendingPrefix = []
        this.#pendingHeights = []
    }

    observe({
        currentIds,
        getHeight,
        estimatedHeight,
        canCarryTailRemoval
    }: ObserveTailSwapArgs): TailSwapCarryResult {
        const previousIds = this.#previousIds
        let result = NO_RESULT

        if (this.#pendingHeights.length > 0) {
            if (
                currentIds.length > this.#pendingPrefix.length &&
                startsWithIds(currentIds, this.#pendingPrefix)
            ) {
                const appendStart = this.#pendingPrefix.length
                const carryCount = Math.min(
                    this.#pendingHeights.length,
                    currentIds.length - appendStart
                )
                const carriedHeights: TailSwapCarryAssignment[] = []
                for (let i = 0; i < carryCount; i++) {
                    const id = currentIds[appendStart + i]
                    if (getHeight(id) === undefined) {
                        carriedHeights.push({ id, height: this.#pendingHeights[i] })
                    }
                }
                this.clear()
                result = {
                    carriedHeights,
                    reserveHeight: 0,
                    shouldClearReserve: true,
                    shouldSnapAfterClear: false
                }
            } else if (!startsWithIds(currentIds, this.#pendingPrefix)) {
                this.clear()
                result = {
                    carriedHeights: [],
                    reserveHeight: 0,
                    shouldClearReserve: true,
                    shouldSnapAfterClear: true
                }
            }
        }

        if (
            previousIds.length > currentIds.length &&
            startsWithIds(previousIds, currentIds) &&
            canCarryTailRemoval
        ) {
            const removedIds = previousIds.slice(currentIds.length)
            const removedHeights = removedIds.map((id) => getHeight(id) ?? estimatedHeight)
            const reserveHeight = removedHeights.reduce((sum, height) => sum + height, 0)
            if (reserveHeight > 0) {
                this.#pendingPrefix = [...currentIds]
                this.#pendingHeights = removedHeights
                result = {
                    carriedHeights: [],
                    reserveHeight,
                    shouldClearReserve: false,
                    shouldSnapAfterClear: false
                }
            }
        }

        this.#previousIds = [...currentIds]
        return result
    }
}
