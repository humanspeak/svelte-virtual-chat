/**
 * Geometry snapshot for a scrollable chat viewport.
 */
export type ScrollGeometry = {
    scrollTop: number
    scrollHeight: number
    clientHeight: number
}

/**
 * The decision a scroll event implies for follow-bottom state.
 */
export type FollowBottomScrollDecision = {
    nextFollowingBottom: boolean
    shouldEndLayoutPreservation: boolean
    shouldScheduleSnapToBottom: boolean
}

export type MovementAttributionArgs = {
    userScrolling: boolean
    preservingLayout: boolean
}

export type DecideFollowBottomAfterScrollArgs = MovementAttributionArgs & {
    atBottom: boolean
    wasFollowingBottom: boolean
    followBottomThresholdPx: number
    /**
     * Cumulative upward scrollTop travel (px) since the last non-upward
     * arrival at the bottom, counting only user-attributable movement — see
     * `accumulateUpwardTravel`, which owns the transition rule. This — not
     * the distance from the bottom — is the user's actual displacement:
     * content growth can manufacture an arbitrarily large bottom gap out of
     * a trivial (or nonexistent) gesture.
     */
    upwardTravelPx: number
}

export type AccumulateUpwardTravelArgs = MovementAttributionArgs & {
    previousScrollTop: number
    scrollTop: number
    atBottom: boolean
    upwardTravelPx: number
}

export const getMaxScroll = (geometry: Pick<ScrollGeometry, 'scrollHeight' | 'clientHeight'>) =>
    Math.max(0, geometry.scrollHeight - geometry.clientHeight)

export const isViewportAtBottom = (
    geometry: ScrollGeometry,
    followBottomThresholdPx: number
): boolean => {
    const maxScroll = getMaxScroll(geometry)
    return maxScroll <= 0 || maxScroll - geometry.scrollTop <= followBottomThresholdPx
}

/**
 * Attribute scroll movement to the user only when they are actually giving
 * input, or when no layout change is in flight. During layout turbulence the
 * browser moves scrollTop on its own — e.g. a snap write bouncing through a
 * momentarily zero-scrollable boundary while a CSS transition grows a
 * message — and that must not read as "the user scrolled".
 *
 * The caller accumulating `upwardTravelPx` and this module's unfollow
 * decision must share this predicate, so it lives here, once.
 */
export const isMovementAttributableToUser = ({
    userScrolling,
    preservingLayout
}: MovementAttributionArgs): boolean => userScrolling || !preservingLayout

/**
 * Advance the upward-travel accumulator for one scroll event.
 *
 * Upward user-attributable movement always accumulates, inside or outside
 * the follow threshold: resetting within the threshold let the component's
 * own snap-backs erase the trail, so a sustained slow programmatic scroll
 * (no scroll intent to suppress the snap) could never accumulate past the
 * threshold and unfollow — a livelock at the bottom (#45).
 *
 * Only a non-upward arrival at the bottom wipes the slate: the component's
 * snap-backs, downward user scrolls, and clamps. Layout-turbulence movement
 * (see `isMovementAttributableToUser`) never accumulates.
 */
export const accumulateUpwardTravel = (args: AccumulateUpwardTravelArgs): number => {
    if (isMovementAttributableToUser(args) && args.scrollTop < args.previousScrollTop) {
        return args.upwardTravelPx + (args.previousScrollTop - args.scrollTop)
    }
    return args.atBottom ? 0 : args.upwardTravelPx
}

const UNFOLLOW_DECISION: FollowBottomScrollDecision = {
    nextFollowingBottom: false,
    shouldEndLayoutPreservation: true,
    shouldScheduleSnapToBottom: false
}

export const decideFollowBottomAfterScroll = (
    args: DecideFollowBottomAfterScrollArgs
): FollowBottomScrollDecision => {
    if (args.atBottom) {
        return {
            nextFollowingBottom: true,
            shouldEndLayoutPreservation: true,
            shouldScheduleSnapToBottom: false
        }
    }

    if (!args.wasFollowingBottom) {
        return UNFOLLOW_DECISION
    }

    // Unfollow only on a deliberate departure: accumulated user-attributable
    // upward travel beyond the threshold (a single large flick lands here
    // too — the caller folds each event's delta in before deciding). Being
    // far from the bottom is NOT a departure signal by itself — during
    // streaming, content growth turns a 1-2px trackpad drift into a large
    // gap, and unfollowing on that gap strands the viewport permanently (#40).
    if (isMovementAttributableToUser(args) && args.upwardTravelPx > args.followBottomThresholdPx) {
        return UNFOLLOW_DECISION
    }

    // Off the bottom while following, without meaningful user displacement:
    // growth outran the viewport. Stay attached and catch back up.
    return {
        nextFollowingBottom: true,
        shouldEndLayoutPreservation: false,
        shouldScheduleSnapToBottom: true
    }
}
