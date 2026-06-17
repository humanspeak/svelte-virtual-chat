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

export type DecideFollowBottomAfterScrollArgs = {
    atBottom: boolean
    wasFollowingBottom: boolean
    preservingLayout: boolean
    userScrolling: boolean
    previousScrollTop: number
    scrollTop: number
    followBottomThresholdPx: number
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

export const didMoveAwayFromBottom = ({
    previousScrollTop,
    scrollTop,
    followBottomThresholdPx
}: Pick<
    DecideFollowBottomAfterScrollArgs,
    'previousScrollTop' | 'scrollTop' | 'followBottomThresholdPx'
>): boolean => scrollTop < previousScrollTop - followBottomThresholdPx

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

    if (
        args.wasFollowingBottom &&
        args.preservingLayout &&
        !args.userScrolling &&
        !didMoveAwayFromBottom(args)
    ) {
        return {
            nextFollowingBottom: true,
            shouldEndLayoutPreservation: false,
            shouldScheduleSnapToBottom: true
        }
    }

    return {
        nextFollowingBottom: false,
        shouldEndLayoutPreservation: true,
        shouldScheduleSnapToBottom: false
    }
}
