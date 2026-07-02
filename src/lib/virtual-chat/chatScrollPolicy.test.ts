import { describe, expect, it } from 'vitest'
import {
    decideFollowBottomAfterScroll,
    didMoveAwayFromBottom,
    getMaxScroll,
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

describe('didMoveAwayFromBottom', () => {
    it('ignores small upward deltas within threshold', () => {
        expect(
            didMoveAwayFromBottom({
                previousScrollTop: 400,
                scrollTop: 370,
                followBottomThresholdPx: 48
            })
        ).toBe(false)
    })

    it('detects meaningful upward movement', () => {
        expect(
            didMoveAwayFromBottom({
                previousScrollTop: 400,
                scrollTop: 330,
                followBottomThresholdPx: 48
            })
        ).toBe(true)
    })

    it('does not treat exactly-threshold movement as moving away', () => {
        expect(
            didMoveAwayFromBottom({
                previousScrollTop: 400,
                scrollTop: 352,
                followBottomThresholdPx: 48
            })
        ).toBe(false)
    })
})

describe('decideFollowBottomAfterScroll', () => {
    it('keeps following and ends layout preservation when viewport is at bottom', () => {
        expect(
            decideFollowBottomAfterScroll({
                atBottom: true,
                wasFollowingBottom: true,
                preservingLayout: true,
                userScrolling: false,
                previousScrollTop: 400,
                scrollTop: 400,
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
                userScrolling: false,
                previousScrollTop: 400,
                scrollTop: 430,
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
                userScrolling: true,
                previousScrollTop: 400,
                scrollTop: 398,
                followBottomThresholdPx: 48,
                upwardTravelPx: 2
            })
        ).toEqual({
            nextFollowingBottom: true,
            shouldEndLayoutPreservation: false,
            shouldScheduleSnapToBottom: true
        })
    })

    it('stops following when scrollTop moves meaningfully away in one event', () => {
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: true,
                userScrolling: true,
                previousScrollTop: 400,
                scrollTop: 320,
                followBottomThresholdPx: 48,
                upwardTravelPx: 80
            })
        ).toEqual({
            nextFollowingBottom: false,
            shouldEndLayoutPreservation: true,
            shouldScheduleSnapToBottom: false
        })
    })

    it('stops following when accumulated upward travel exceeds the threshold', () => {
        // A slow deliberate drag: no single event crosses the threshold, but
        // the accumulated displacement does.
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: false,
                userScrolling: true,
                previousScrollTop: 400,
                scrollTop: 394,
                followBottomThresholdPx: 48,
                upwardTravelPx: 54
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
                userScrolling: true,
                previousScrollTop: 400,
                scrollTop: 398,
                followBottomThresholdPx: 48,
                upwardTravelPx: 48
            })
        ).toEqual({
            nextFollowingBottom: true,
            shouldEndLayoutPreservation: false,
            shouldScheduleSnapToBottom: true
        })
    })

    it('keeps an already unfollowed viewport unfollowed', () => {
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: false,
                preservingLayout: true,
                userScrolling: false,
                previousScrollTop: 200,
                scrollTop: 220,
                followBottomThresholdPx: 48,
                upwardTravelPx: 0
            })
        ).toEqual({
            nextFollowingBottom: false,
            shouldEndLayoutPreservation: true,
            shouldScheduleSnapToBottom: false
        })
    })
    it('ignores browser-driven movement during layout turbulence (no user input)', () => {
        // A mid-transition snap write can bounce through a momentarily
        // zero-scrollable boundary; the browser clamp looks like a large
        // upward move, but no input is active and layout preservation is —
        // attribute it to layout and stay attached.
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: true,
                userScrolling: false,
                previousScrollTop: 55,
                scrollTop: 0,
                followBottomThresholdPx: 48,
                upwardTravelPx: 0
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
                userScrolling: false,
                previousScrollTop: 400,
                scrollTop: 320,
                followBottomThresholdPx: 48,
                upwardTravelPx: 80
            })
        ).toEqual({
            nextFollowingBottom: false,
            shouldEndLayoutPreservation: true,
            shouldScheduleSnapToBottom: false
        })
    })
})
