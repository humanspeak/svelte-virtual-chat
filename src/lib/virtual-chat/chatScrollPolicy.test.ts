import { describe, expect, it } from 'vitest'
import {
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
        expect(isMovementAttributableToUser({ userScrolling: true, preservingLayout: true })).toBe(
            true
        )
    })

    it('attributes movement to the user when no layout change is in flight', () => {
        expect(
            isMovementAttributableToUser({ userScrolling: false, preservingLayout: false })
        ).toBe(true)
    })

    it('attributes movement to layout during turbulence without input', () => {
        expect(isMovementAttributableToUser({ userScrolling: false, preservingLayout: true })).toBe(
            false
        )
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
