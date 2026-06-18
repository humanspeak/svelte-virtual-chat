import type { ChatScrollDirection } from './chatScrollIntent.js'
import { getMaxScroll, type ScrollGeometry } from './chatScrollPolicy.js'

export type DirectionalScrollGeometry = ScrollGeometry & {
    capturedAt: number
    direction: ChatScrollDirection
}

export type PendingScrollDirection = {
    capturedAt: number
    direction: ChatScrollDirection
}

export type RecordScrollIntentArgs = {
    direction: ChatScrollDirection
    current: ScrollGeometry
    now: number
}

export type RecordUserScrollArgs = {
    previousScrollTop: number
    current: ScrollGeometry
    now: number
}

export type GetProgressPreservationTargetArgs = {
    current: ScrollGeometry
    now: number
}

export type ChatScrollProgressPreserverOptions = {
    activeWindowMs?: number
    movementThresholdPx?: number
    minAdjustmentPx?: number
}

export type PreserveMinimumScrollProgressArgs = {
    previous: ScrollGeometry
    current: ScrollGeometry
    minAdjustmentPx?: number
}

export type PreserveDirectionalScrollProgressArgs = {
    direction: ChatScrollDirection
    previous: ScrollGeometry
    current: ScrollGeometry
    minAdjustmentPx?: number
}

const clampProgress = (progress: number): number => Math.min(1, Math.max(0, progress))
const clampScrollTop = (scrollTop: number, maxScroll: number): number =>
    Math.min(maxScroll, Math.max(0, scrollTop))

export const getGapFromBottom = (geometry: ScrollGeometry): number =>
    getMaxScroll(geometry) - geometry.scrollTop

export const getScrollProgress = (geometry: ScrollGeometry): number => {
    const maxScroll = getMaxScroll(geometry)
    if (maxScroll <= 0) return 1
    return clampProgress(geometry.scrollTop / maxScroll)
}

const didProgressMoveWithDirection = (
    direction: ChatScrollDirection,
    previous: ScrollGeometry,
    current: ScrollGeometry
): boolean => {
    const previousProgress = getScrollProgress(previous)
    const currentProgress = getScrollProgress(current)
    return direction === 'down'
        ? currentProgress >= previousProgress
        : currentProgress <= previousProgress
}

/**
 * When content grows under an actively downward-scrolling user, keep the
 * scrollbar from losing normalized progress through the now-taller viewport.
 */
export const preserveMinimumScrollProgressTarget = ({
    previous,
    current,
    minAdjustmentPx = 1
}: PreserveMinimumScrollProgressArgs): number | null => {
    const previousMaxScroll = getMaxScroll(previous)
    const currentMaxScroll = getMaxScroll(current)
    if (previousMaxScroll <= 0 || currentMaxScroll <= previousMaxScroll) return null

    const previousProgress = getScrollProgress(previous)
    const minimumScrollTop = previousProgress * currentMaxScroll
    if (minimumScrollTop <= current.scrollTop + minAdjustmentPx) return null

    return Math.min(currentMaxScroll, minimumScrollTop)
}

/**
 * Preserve the user's scrollbar trajectory through late layout growth.
 * - Downward input should not lose normalized scroll progress.
 * - Upward input should not gain normalized scroll progress.
 */
export const preserveDirectionalScrollProgressTarget = ({
    direction,
    previous,
    current,
    minAdjustmentPx = 1
}: PreserveDirectionalScrollProgressArgs): number | null => {
    const currentMaxScroll = getMaxScroll(current)
    if (currentMaxScroll <= 0) return null

    const targetScrollTop = getScrollProgress(previous) * currentMaxScroll

    if (direction === 'down' && targetScrollTop <= current.scrollTop + minAdjustmentPx) {
        return null
    }
    if (direction === 'up' && targetScrollTop >= current.scrollTop - minAdjustmentPx) {
        return null
    }

    return clampScrollTop(targetScrollTop, currentMaxScroll)
}

export class ChatScrollProgressPreserver {
    #lastDirectionalScroll: DirectionalScrollGeometry | null = null
    #pendingDirection: PendingScrollDirection | null = null
    readonly #activeWindowMs: number
    readonly #movementThresholdPx: number
    readonly #minAdjustmentPx: number

    constructor(options: ChatScrollProgressPreserverOptions = {}) {
        this.#activeWindowMs = options.activeWindowMs ?? 700
        this.#movementThresholdPx = options.movementThresholdPx ?? 1
        this.#minAdjustmentPx = options.minAdjustmentPx ?? 1
    }

    recordScrollIntent({ direction, current, now }: RecordScrollIntentArgs): void {
        this.#pendingDirection = { direction, capturedAt: now }
        const previous = this.#lastDirectionalScroll
        if (previous?.direction === direction && this.#isFresh(previous.capturedAt, now)) {
            this.#lastDirectionalScroll = didProgressMoveWithDirection(direction, previous, current)
                ? { ...current, direction, capturedAt: now }
                : { ...previous, capturedAt: now }
            return
        }

        this.#lastDirectionalScroll = { ...current, direction, capturedAt: now }
    }

    recordUserScroll({ previousScrollTop, current, now }: RecordUserScrollArgs): void {
        const direction =
            this.#pendingDirection?.direction ?? this.#lastDirectionalScroll?.direction
        if (!direction) return

        const previous = this.#lastDirectionalScroll
        const delta = current.scrollTop - previousScrollTop
        const baselineDelta = previous ? current.scrollTop - previous.scrollTop : delta
        const threshold = this.#movementThresholdPx
        const movedInDirection = (d: number) =>
            direction === 'down' ? d > threshold : d < -threshold
        const matchesDirection = movedInDirection(delta) || movedInDirection(baselineDelta)

        if (matchesDirection) {
            this.#lastDirectionalScroll =
                previous?.direction === direction &&
                !didProgressMoveWithDirection(direction, previous, current)
                    ? { ...previous, capturedAt: now }
                    : {
                          ...current,
                          direction,
                          capturedAt: now
                      }
            this.#pendingDirection = { direction, capturedAt: now }
        }
    }

    getPreservationTarget({ current, now }: GetProgressPreservationTargetArgs): number | null {
        const previous = this.#lastDirectionalScroll
        if (!previous) return null

        if (!this.#isFresh(previous.capturedAt, now)) {
            this.reset()
            return null
        }

        return preserveDirectionalScrollProgressTarget({
            direction: previous.direction,
            previous,
            current,
            minAdjustmentPx: this.#minAdjustmentPx
        })
    }

    isActive(now: number): boolean {
        return (
            (!!this.#lastDirectionalScroll &&
                this.#isFresh(this.#lastDirectionalScroll.capturedAt, now)) ||
            (!!this.#pendingDirection && this.#isFresh(this.#pendingDirection.capturedAt, now))
        )
    }

    #isFresh(capturedAt: number, now: number): boolean {
        return now - capturedAt <= this.#activeWindowMs
    }

    commitAdjustment(current: ScrollGeometry, now: number): void {
        if (!this.#lastDirectionalScroll) return
        this.#lastDirectionalScroll = {
            ...current,
            direction: this.#lastDirectionalScroll.direction,
            capturedAt: now
        }
        this.#pendingDirection = {
            direction: this.#lastDirectionalScroll.direction,
            capturedAt: now
        }
    }

    reset(): void {
        this.#lastDirectionalScroll = null
        this.#pendingDirection = null
    }
}
