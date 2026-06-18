import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatLayoutPreservation } from './chatLayoutPreservation.js'

describe('ChatLayoutPreservation', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('is active until its timeout expires', () => {
        const preservation = new ChatLayoutPreservation(120)

        preservation.begin()
        expect(preservation.isActive).toBe(true)

        vi.advanceTimersByTime(119)
        expect(preservation.isActive).toBe(true)

        vi.advanceTimersByTime(1)
        expect(preservation.isActive).toBe(false)
    })

    it('extends preservation when begin is called again', () => {
        const preservation = new ChatLayoutPreservation(120)

        preservation.begin()
        vi.advanceTimersByTime(100)
        preservation.begin()
        vi.advanceTimersByTime(100)

        expect(preservation.isActive).toBe(true)

        vi.advanceTimersByTime(20)
        expect(preservation.isActive).toBe(false)
    })

    it('can end preservation immediately', () => {
        const preservation = new ChatLayoutPreservation(120)

        preservation.begin()
        preservation.end()

        expect(preservation.isActive).toBe(false)
        vi.advanceTimersByTime(120)
        expect(preservation.isActive).toBe(false)
    })

    it('cleans up via destroy', () => {
        const preservation = new ChatLayoutPreservation(120)

        preservation.begin()
        preservation.destroy()

        expect(preservation.isActive).toBe(false)
        vi.advanceTimersByTime(120)
        expect(preservation.isActive).toBe(false)
    })
})
