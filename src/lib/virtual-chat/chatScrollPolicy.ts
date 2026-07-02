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
     * Cumulative upward scrollTop travel (px) since the viewport was last
     * within the follow threshold, counting only user-attributable movement
     * (see `isMovementAttributableToUser`). This — not the distance from the
     * bottom — is the user's actual displacement: content growth can
     * manufacture an arbitrarily large bottom gap out of a trivial (or
     * nonexistent) gesture.
     */
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
