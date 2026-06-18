import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    ChatScrollIntent,
    getKeyScrollDirection,
    getTouchScrollDirection,
    getWheelScrollDirection,
    isScrollIntentKey,
    trackScrollIntent
} from './chatScrollIntent.js'

describe('isScrollIntentKey', () => {
    it.each(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])(
        'treats %s as scroll intent',
        (key) => {
            expect(isScrollIntentKey(key)).toBe(true)
        }
    )

    it.each(['Enter', 'Escape', 'Tab', 'a'])('ignores %s', (key) => {
        expect(isScrollIntentKey(key)).toBe(false)
    })
})

describe('getWheelScrollDirection', () => {
    it('reads vertical wheel direction', () => {
        expect(getWheelScrollDirection(new WheelEvent('wheel', { deltaY: 12 }))).toBe('down')
        expect(getWheelScrollDirection(new WheelEvent('wheel', { deltaY: -12 }))).toBe('up')
        expect(getWheelScrollDirection(new WheelEvent('wheel', { deltaY: 0 }))).toBeNull()
    })
})

const createTouchEvent = (type: string, clientY: number | null) => {
    const event = new Event(type, { bubbles: true })
    Object.defineProperty(event, 'touches', {
        value: clientY === null ? [] : [{ clientY }]
    })
    return event as TouchEvent
}

describe('getTouchScrollDirection', () => {
    it('maps finger movement to scroll direction', () => {
        expect(getTouchScrollDirection(120, createTouchEvent('touchmove', 80))).toBe('down')
        expect(getTouchScrollDirection(80, createTouchEvent('touchmove', 120))).toBe('up')
        expect(getTouchScrollDirection(120, createTouchEvent('touchmove', 120))).toBeNull()
    })

    it('ignores touch movement without a baseline or active touch', () => {
        expect(getTouchScrollDirection(null, createTouchEvent('touchmove', 80))).toBeNull()
        expect(getTouchScrollDirection(120, createTouchEvent('touchmove', null))).toBeNull()
    })
})

describe('getKeyScrollDirection', () => {
    it.each(['ArrowUp', 'PageUp', 'Home'])('maps %s to upward intent', (key) => {
        expect(getKeyScrollDirection(new KeyboardEvent('keydown', { key }))).toBe('up')
    })

    it.each(['ArrowDown', 'PageDown', 'End', ' '])('maps %s to downward intent', (key) => {
        expect(getKeyScrollDirection(new KeyboardEvent('keydown', { key }))).toBe('down')
    })

    it('maps shift-space to upward intent', () => {
        expect(
            getKeyScrollDirection(new KeyboardEvent('keydown', { key: ' ', shiftKey: true }))
        ).toBe('up')
    })

    it('ignores non-scroll keys', () => {
        expect(getKeyScrollDirection(new KeyboardEvent('keydown', { key: 'Enter' }))).toBeNull()
    })
})

describe('ChatScrollIntent', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('marks intent active until the quiet timeout expires', () => {
        const onIntentStart = vi.fn()
        const onIntentEnd = vi.fn()
        const intent = new ChatScrollIntent({ timeoutMs: 150, onIntentStart, onIntentEnd })

        intent.mark()
        expect(intent.isActive).toBe(true)
        expect(onIntentStart).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(149)
        expect(intent.isActive).toBe(true)
        expect(onIntentEnd).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(intent.isActive).toBe(false)
        expect(onIntentEnd).toHaveBeenCalledTimes(1)
    })

    it('extends active intent when more input arrives', () => {
        const onIntentStart = vi.fn()
        const onIntentEnd = vi.fn()
        const intent = new ChatScrollIntent({ timeoutMs: 150, onIntentStart, onIntentEnd })

        intent.mark()
        vi.advanceTimersByTime(100)
        intent.mark()
        vi.advanceTimersByTime(100)

        expect(intent.isActive).toBe(true)
        expect(onIntentStart).toHaveBeenCalledTimes(1)
        expect(onIntentEnd).not.toHaveBeenCalled()

        vi.advanceTimersByTime(50)
        expect(intent.isActive).toBe(false)
        expect(onIntentEnd).toHaveBeenCalledTimes(1)
    })

    it('ends active intent when destroyed', () => {
        const onIntentEnd = vi.fn()
        const intent = new ChatScrollIntent({ timeoutMs: 150, onIntentEnd })

        intent.mark()
        intent.destroy()

        expect(intent.isActive).toBe(false)
        expect(onIntentEnd).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(150)
        expect(onIntentEnd).toHaveBeenCalledTimes(1)
    })

    it('does not end inactive intent when destroyed', () => {
        const onIntentEnd = vi.fn()
        const intent = new ChatScrollIntent({ timeoutMs: 150, onIntentEnd })

        intent.destroy()

        expect(intent.isActive).toBe(false)
        expect(onIntentEnd).not.toHaveBeenCalled()
    })
})

describe('trackScrollIntent', () => {
    it('fires directional events for wheel, touchmove, and scroll keyboard events', () => {
        const onIntent = vi.fn()
        const node = document.createElement('div')
        const action = trackScrollIntent(node, onIntent)

        node.dispatchEvent(new WheelEvent('wheel', { deltaY: 10 }))
        node.dispatchEvent(createTouchEvent('touchstart', 120))
        node.dispatchEvent(createTouchEvent('touchmove', 80))
        node.dispatchEvent(createTouchEvent('touchmove', 100))
        node.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }))
        node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

        expect(onIntent).toHaveBeenCalledTimes(4)
        expect(onIntent).toHaveBeenNthCalledWith(1, { direction: 'down' })
        expect(onIntent).toHaveBeenNthCalledWith(2, { direction: 'down' })
        expect(onIntent).toHaveBeenNthCalledWith(3, { direction: 'up' })
        expect(onIntent).toHaveBeenNthCalledWith(4, { direction: 'down' })

        action.destroy()
        node.dispatchEvent(new WheelEvent('wheel', { deltaY: 10 }))
        node.dispatchEvent(createTouchEvent('touchmove', 40))

        expect(onIntent).toHaveBeenCalledTimes(4)
    })
})
