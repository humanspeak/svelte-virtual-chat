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
                followBottomThresholdPx: 48
            })
        ).toEqual({
            nextFollowingBottom: true,
            shouldEndLayoutPreservation: true,
            shouldScheduleSnapToBottom: false
        })
    })

    it('keeps following and schedules a snap during late layout growth', () => {
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: true,
                userScrolling: false,
                previousScrollTop: 400,
                scrollTop: 430,
                followBottomThresholdPx: 48
            })
        ).toEqual({
            nextFollowingBottom: true,
            shouldEndLayoutPreservation: false,
            shouldScheduleSnapToBottom: true
        })
    })

    it('stops following when a real user scroll interrupts preservation', () => {
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: true,
                userScrolling: true,
                previousScrollTop: 400,
                scrollTop: 430,
                followBottomThresholdPx: 48
            })
        ).toEqual({
            nextFollowingBottom: false,
            shouldEndLayoutPreservation: true,
            shouldScheduleSnapToBottom: false
        })
    })

    it('stops following when scrollTop moves meaningfully away from bottom', () => {
        expect(
            decideFollowBottomAfterScroll({
                atBottom: false,
                wasFollowingBottom: true,
                preservingLayout: true,
                userScrolling: false,
                previousScrollTop: 400,
                scrollTop: 320,
                followBottomThresholdPx: 48
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
                previousScrollTop: 200,
                scrollTop: 220,
                followBottomThresholdPx: 48
            })
        ).toEqual({
            nextFollowingBottom: false,
            shouldEndLayoutPreservation: true,
            shouldScheduleSnapToBottom: false
        })
    })
})
