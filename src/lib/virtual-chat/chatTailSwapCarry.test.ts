import { describe, expect, it } from 'vitest'
import { ChatTailSwapCarry, startsWithIds } from './chatTailSwapCarry.js'

const getHeightFrom = (heights: Record<string, number>) => (id: string) => heights[id]

describe('startsWithIds', () => {
    it('returns true when ids begin with the prefix', () => {
        expect(startsWithIds(['a', 'b', 'c'], ['a', 'b'])).toBe(true)
    })

    it('returns false when the prefix is longer or mismatched', () => {
        expect(startsWithIds(['a'], ['a', 'b'])).toBe(false)
        expect(startsWithIds(['a', 'x'], ['a', 'b'])).toBe(false)
    })
})

describe('ChatTailSwapCarry', () => {
    it('reserves a measured tail suffix removed while bottom-following', () => {
        const carry = new ChatTailSwapCarry()
        const getHeight = getHeightFrom({ a: 100, b: 200, streaming: 700 })

        carry.observe({
            currentIds: ['a', 'b', 'streaming'],
            getHeight,
            estimatedHeight: 72,
            canCarryTailRemoval: true
        })

        expect(
            carry.observe({
                currentIds: ['a', 'b'],
                getHeight,
                estimatedHeight: 72,
                canCarryTailRemoval: true
            })
        ).toEqual({
            carriedHeights: [],
            reserveHeight: 700,
            shouldClearReserve: false,
            shouldSnapAfterClear: false
        })
    })

    it('carries removed tail height to newly appended ids', () => {
        const carry = new ChatTailSwapCarry()
        const getHeight = getHeightFrom({ a: 100, streaming: 700 })

        carry.observe({
            currentIds: ['a', 'streaming'],
            getHeight,
            estimatedHeight: 72,
            canCarryTailRemoval: true
        })
        carry.observe({
            currentIds: ['a'],
            getHeight,
            estimatedHeight: 72,
            canCarryTailRemoval: true
        })

        expect(
            carry.observe({
                currentIds: ['a', 'final'],
                getHeight,
                estimatedHeight: 72,
                canCarryTailRemoval: true
            })
        ).toEqual({
            carriedHeights: [{ id: 'final', height: 700 }],
            reserveHeight: 0,
            shouldClearReserve: true,
            shouldSnapAfterClear: false
        })
    })

    it('does not overwrite an already measured appended id', () => {
        const carry = new ChatTailSwapCarry()
        const getHeight = getHeightFrom({ a: 100, streaming: 700, final: 320 })

        carry.observe({
            currentIds: ['a', 'streaming'],
            getHeight,
            estimatedHeight: 72,
            canCarryTailRemoval: true
        })
        carry.observe({
            currentIds: ['a'],
            getHeight,
            estimatedHeight: 72,
            canCarryTailRemoval: true
        })

        expect(
            carry.observe({
                currentIds: ['a', 'final'],
                getHeight,
                estimatedHeight: 72,
                canCarryTailRemoval: true
            }).carriedHeights
        ).toEqual([])
    })

    it('clear drops pending removed height before a later append', () => {
        const carry = new ChatTailSwapCarry()
        const getHeight = getHeightFrom({ a: 100, streaming: 700 })

        carry.observe({
            currentIds: ['a', 'streaming'],
            getHeight,
            estimatedHeight: 72,
            canCarryTailRemoval: true
        })
        carry.observe({
            currentIds: ['a'],
            getHeight,
            estimatedHeight: 72,
            canCarryTailRemoval: true
        })

        carry.clear()

        expect(
            carry.observe({
                currentIds: ['a', 'final'],
                getHeight,
                estimatedHeight: 72,
                canCarryTailRemoval: true
            })
        ).toEqual({
            carriedHeights: [],
            reserveHeight: 0,
            shouldClearReserve: false,
            shouldSnapAfterClear: false
        })
    })

    it('clears and asks for a snap when the pending prefix is abandoned', () => {
        const carry = new ChatTailSwapCarry()
        const getHeight = getHeightFrom({ a: 100, streaming: 700 })

        carry.observe({
            currentIds: ['a', 'streaming'],
            getHeight,
            estimatedHeight: 72,
            canCarryTailRemoval: true
        })
        carry.observe({
            currentIds: ['a'],
            getHeight,
            estimatedHeight: 72,
            canCarryTailRemoval: true
        })

        expect(
            carry.observe({
                currentIds: ['z'],
                getHeight,
                estimatedHeight: 72,
                canCarryTailRemoval: true
            })
        ).toEqual({
            carriedHeights: [],
            reserveHeight: 0,
            shouldClearReserve: true,
            shouldSnapAfterClear: true
        })
    })

    it('does not reserve tail removals when carry is disabled', () => {
        const carry = new ChatTailSwapCarry()
        const getHeight = getHeightFrom({ a: 100, streaming: 700 })

        carry.observe({
            currentIds: ['a', 'streaming'],
            getHeight,
            estimatedHeight: 72,
            canCarryTailRemoval: true
        })

        expect(
            carry.observe({
                currentIds: ['a'],
                getHeight,
                estimatedHeight: 72,
                canCarryTailRemoval: false
            })
        ).toEqual({
            carriedHeights: [],
            reserveHeight: 0,
            shouldClearReserve: false,
            shouldSnapAfterClear: false
        })
    })
})
