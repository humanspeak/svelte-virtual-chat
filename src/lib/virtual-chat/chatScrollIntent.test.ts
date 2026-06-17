import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatScrollIntent, isScrollIntentKey, trackScrollIntent } from './chatScrollIntent.js'

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
    it('fires for wheel, touchmove, and scroll keyboard events', () => {
        const onIntent = vi.fn()
        const node = document.createElement('div')
        const action = trackScrollIntent(node, onIntent)

        node.dispatchEvent(new Event('wheel'))
        node.dispatchEvent(new Event('touchmove'))
        node.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }))
        node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

        expect(onIntent).toHaveBeenCalledTimes(3)

        action.destroy()
        node.dispatchEvent(new Event('wheel'))

        expect(onIntent).toHaveBeenCalledTimes(3)
    })
})
