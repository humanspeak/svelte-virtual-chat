import { describe, expect, it } from 'vitest'
import {
    accumulateUpwardTravel,
    decideFollowBottomAfterScroll,
    getMaxScroll,
    isMovementAttributableToUser,
    isViewportAtBottom
} from './chatScrollPolicy.js'

describe('getMaxScroll', () => {
    it('clamps negative scrollable space to zero', () => {
        expect(getMaxScroll({ scrollHeight: 300, clientHeight: 500 })).toBe(0)
    })

    it('returns scrollable overflow', () => {
        expect(getMaxScroll({ scrollHeight: 900, clientHeight: 500 })).toBe(400)
    })
})

describe('isViewportAtBottom', () => {
    it('returns true when content fits without scrolling', () => {
        expect(isViewportAtBottom({ scrollTop: 0, scrollHeight: 300, clientHeight: 500 }, 48)).toBe(
            true
        )
    })

    it('returns true within the follow-bottom threshold', () => {
        expect(
            isViewportAtBottom({ scrollTop: 360, scrollHeight: 900, clientHeight: 500 }, 48)
        ).toBe(true)
    })

    it('returns false outside the follow-bottom threshold', () => {
        expect(
            isViewportAtBottom({ scrollTop: 300, scrollHeight: 900, clientHeight: 500 }, 48)
        ).toBe(false)
    })
})

describe('isMovementAttributableToUser', () => {
    it('attributes movement to the user while input is active', () => {
        expect(
            isMovementAttributableToUser({
                userScrolling: true,
                preservingLayout: true,
                landedOnClampBoundary: true
            })
        ).toBe(true)
    })

    it('attributes movement to the user when no layout change is in flight', () => {
        expect(
            isMovementAttributableToUser({
                userScrolling: false,
                preservingLayout: false,
                landedOnClampBoundary: true
            })
        ).toBe(true)
    })

    it('attributes mid-list landings to the user even during turbulence', () => {
        // Browser clamps can only land on a boundary (0 or maxScroll); a
        // programmatic scrollTo into the middle of the list during layout
        // turbulence is user navigation and must not be yanked back.
        expect(
            isMovementAttributableToUser({
                userScrolling: false,
                preservingLayout: true,
                landedOnClampBoundary: false
            })
        ).toBe(true)
    })

    it('attributes movement to layout during turbulence without input', () => {
        expect(
            isMovementAttributableToUser({
                userScrolling: false,
                preservingLayout: true,
                landedOnClampBoundary: true
            })
        ).toBe(false)
    })
})

describe('accumulateUpwardTravel', () => {
    it('accumulates upward attributable movement even inside the follow threshold', () => {
        // The #45 quadrant: resetting at-bottom let the component's own
        // snap-backs erase the trail of a sustained slow programmatic scroll.
        expect(
            accumulateUpwardTravel({
                userScrolling: false,
                preservingLayout: false,
                landedOnClampBoundary: true,
                previousScrollTop: 400,
                scrollTop: 370,
                atBottom: true,
                upwardTravelPx: 10
            })
        ).toBe(40)
    })

    it('accumulates upward attributable movement outside the threshold', () => {
        expect(
            accumulateUpwardTravel({
                userScrolling: true,
                preservingLayout: true,
                landedOnClampBoundary: true,
                previousScrollTop: 400,
                scrollTop: 398,
                atBottom: false,
                upwardTravelPx: 0
            })
        ).toBe(2)
    })

    it('ignores upward movement during layout turbulence without input', () => {
        // Browser clamps mid-relayout look like up-scrolls; not the user.
        expect(
            accumulateUpwardTravel({
                userScrolling: false,
                preservingLayout: true,
                landedOnClampBoundary: true,
                previousScrollTop: 55,
                scrollTop: 0,
                atBottom: false,
                upwardTravelPx: 7
            })
        ).toBe(7)
    })

    it('resets on a non-upward arrival at the bottom (snap-backs, downward scrolls)', () => {
        expect(
            accumulateUpwardTravel({
                userScrolling: false,
                preservingLayout: false,
                landedOnClampBoundary: true,
                previousScrollTop: 370,
                scrollTop: 400,
                atBottom: true,
                upwardTravelPx: 30
            })
        ).toBe(0)
    })

    it('preserves travel on non-upward movement away from the bottom', () => {
        expect(
            accumulateUpwardTravel({
                userScrolling: true,
                preservingLayout: false,
                landedOnClampBoundary: true,
                previousScrollTop: 300,
                scrollTop: 310,
                atBottom: false,
                upwardTravelPx: 60
            })
        ).toBe(60)
    })
})

describe('accumulateUpwardTravel', () => {
    it('accumulates upward attributable movement even inside the follow threshold', () => {
        // The #45 quadrant: resetting at-bottom let the component's own
        // snap-backs erase the trail of a sustained slow programmatic scroll.
        expect(
            accumulateUpwardTravel({
                userScrolling: false,
                preservingLayout: false,
                previousScrollTop: 400,
                scrollTop: 370,
                atBottom: true,
                upwardTravelPx: 10
            })
        ).toBe(40)
    })

    it('accumulates upward attributable movement outside the threshold', () => {
        expect(
            accumulateUpwardTravel({
                userScrolling: true,
                preservingLayout: true,
                previousScrollTop: 400,
                scrollTop: 398,
                atBottom: false,
                upwardTravelPx: 0
            })
        ).toBe(2)
    })

    it('ignores upward movement during layout turbulence without input', () => {
        // Browser clamps mid-relayout look like up-scrolls; not the user.
        expect(
            accumulateUpwardTravel({
                userScrolling: false,
                preservingLayout: true,
                previousScrollTop: 55,
                scrollTop: 0,
                atBottom: false,
                upwardTravelPx: 7
            })
        ).toBe(7)
    })

    it('resets on a non-upward arrival at the bottom (snap-backs, downward scrolls)', () => {
        expect(
            accumulateUpwardTravel({
                userScrolling: false,
                preservingLayout: false,
                previousScrollTop: 370,
                scrollTop: 400,
                atBottom: true,
                upwardTravelPx: 30
            })
        ).toBe(0)
    })

    it('preserves travel on non-upward movement away from the bottom', () => {
        expect(
            accumulateUpwardTravel({
                userScrolling: true,
                preservingLayout: false,
                previousScrollTop: 300,
                scrollTop: 310,
                atBottom: false,
                upwardTravelPx: 60
            })
        ).toBe(60)
    })
})

describe('decideFollowBottomAfterScroll', () => {
    it('keeps following and ends layout preservation when viewport is at bottom', () => {
        expect(
            decideFollowBottomAfterScroll({
                atBottom: true,
                wasFollowingBottom: true,
                preservingLayout: true,
                landedOnClampBoundary: true,
                userScrolling: false,
                followBottomThresholdPx: 48,
                upwardTravelPx: 0
            })
        ).toEqual({
            nextFollowingBottom: true,
            shouldEndLayoutPreservation: true,
            shouldScheduleSnapToBottom: false
        })
    })

    it('keeps following and schedules a snap when growth outruns the viewport', () => {
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: true,
                landedOnClampBoundary: true,
                userScrolling: false,
                followBottomThresholdPx: 48,
                upwardTravelPx: 0
            })
        ).toEqual({
            nextFollowingBottom: true,
            shouldEndLayoutPreservation: false,
            shouldScheduleSnapToBottom: true
        })
    })

    it('keeps following through a growth-inflated gap when user displacement is trivial', () => {
        // The #40 scenario: a 2px trackpad drift while streaming. The gap is
        // large (atBottom=false) but the user barely moved — stay attached.
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: true,
                landedOnClampBoundary: true,
                userScrolling: true,
                followBottomThresholdPx: 48,
                upwardTravelPx: 2
            })
        ).toEqual({
            nextFollowingBottom: true,
            shouldEndLayoutPreservation: false,
            shouldScheduleSnapToBottom: true
        })
    })

    it('stops following when accumulated upward travel exceeds the threshold', () => {
        // Covers both a single large flick (the caller folds each event's
        // delta into upwardTravelPx before deciding) and a slow drag.
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: false,
                landedOnClampBoundary: true,
                userScrolling: true,
                followBottomThresholdPx: 48,
                upwardTravelPx: 80
            })
        ).toEqual({
            nextFollowingBottom: false,
            shouldEndLayoutPreservation: true,
            shouldScheduleSnapToBottom: false
        })
    })

    it('does not unfollow at exactly-threshold accumulated travel', () => {
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: false,
                landedOnClampBoundary: true,
                userScrolling: true,
                followBottomThresholdPx: 48,
                upwardTravelPx: 48
            })
        ).toEqual({
            nextFollowingBottom: true,
            shouldEndLayoutPreservation: false,
            shouldScheduleSnapToBottom: true
        })
    })

    it('ignores browser-driven movement during layout turbulence (no user input)', () => {
        // A mid-transition snap write can bounce through a momentarily
        // zero-scrollable boundary; the browser clamp inflates travel-like
        // movement, but no input is active and layout preservation is —
        // attribute it to layout and stay attached.
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: true,
                landedOnClampBoundary: true,
                userScrolling: false,
                followBottomThresholdPx: 48,
                upwardTravelPx: 55
            })
        ).toEqual({
            nextFollowingBottom: true,
            shouldEndLayoutPreservation: false,
            shouldScheduleSnapToBottom: true
        })
    })

    it('unfollows on non-input movement when no layout change is in flight (scrollbar drag)', () => {
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: false,
                landedOnClampBoundary: true,
                userScrolling: false,
                followBottomThresholdPx: 48,
                upwardTravelPx: 80
            })
        ).toEqual({
            nextFollowingBottom: false,
            shouldEndLayoutPreservation: true,
            shouldScheduleSnapToBottom: false
        })
    })

    it('keeps an already unfollowed viewport unfollowed', () => {
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: false,
                preservingLayout: true,
                landedOnClampBoundary: true,
                userScrolling: false,
                followBottomThresholdPx: 48,
                upwardTravelPx: 0
            })
        ).toEqual({
            nextFollowingBottom: false,
            shouldEndLayoutPreservation: true,
            shouldScheduleSnapToBottom: false
        })
    })
})
