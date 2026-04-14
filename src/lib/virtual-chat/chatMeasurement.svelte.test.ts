import { describe, expect, it } from 'vitest'
import {
    ChatHeightCache,
    calculateOffsetForIndex,
    calculateTotalHeight
} from './chatMeasurement.svelte.js'

type Msg = { id: string }
const getId = (m: Msg) => m.id
const msgs = (ids: string[]): Msg[] => ids.map((id) => ({ id }))

describe('ChatHeightCache', () => {
    it('returns undefined for unmeasured messages', () => {
        const cache = new ChatHeightCache()
        expect(cache.get('a')).toBeUndefined()
    })

    it('stores and retrieves heights', () => {
        const cache = new ChatHeightCache()
        cache.set('a', 100)
        expect(cache.get('a')).toBe(100)
    })

    it('returns true when height changes', () => {
        const cache = new ChatHeightCache()
        expect(cache.set('a', 100)).toBe(true)
        expect(cache.set('a', 200)).toBe(true)
    })

    it('returns false when height is the same', () => {
        const cache = new ChatHeightCache()
        cache.set('a', 100)
        expect(cache.set('a', 100)).toBe(false)
    })

    it('tracks size correctly', () => {
        const cache = new ChatHeightCache()
        expect(cache.size).toBe(0)
        cache.set('a', 50)
        expect(cache.size).toBe(1)
        cache.set('b', 60)
        expect(cache.size).toBe(2)
    })

    it('has() works correctly', () => {
        const cache = new ChatHeightCache()
        expect(cache.has('a')).toBe(false)
        cache.set('a', 50)
        expect(cache.has('a')).toBe(true)
    })

    it('delete removes an entry', () => {
        const cache = new ChatHeightCache()
        cache.set('a', 50)
        cache.set('b', 60)
        cache.delete('a')
        expect(cache.has('a')).toBe(false)
        expect(cache.get('a')).toBeUndefined()
        expect(cache.size).toBe(1)
    })

    it('delete on nonexistent key is a no-op', () => {
        const cache = new ChatHeightCache()
        const vBefore = cache.version
        cache.delete('nonexistent')
        expect(cache.version).toBe(vBefore)
    })

    it('clear removes all entries', () => {
        const cache = new ChatHeightCache()
        cache.set('a', 50)
        cache.set('b', 60)
        cache.clear()
        expect(cache.size).toBe(0)
        expect(cache.has('a')).toBe(false)
        expect(cache.has('b')).toBe(false)
    })

    it('version increments on set, delete, clear', () => {
        const cache = new ChatHeightCache()
        const v0 = cache.version
        cache.set('a', 50)
        expect(cache.version).toBe(v0 + 1)
        cache.set('a', 60)
        expect(cache.version).toBe(v0 + 2)
        cache.delete('a')
        expect(cache.version).toBe(v0 + 3)
        cache.set('b', 70)
        cache.clear()
        expect(cache.version).toBe(v0 + 5)
    })

    it('version does not increment on no-op set', () => {
        const cache = new ChatHeightCache()
        cache.set('a', 50)
        const v = cache.version
        cache.set('a', 50)
        expect(cache.version).toBe(v)
    })
})

describe('calculateTotalHeight', () => {
    it('returns 0 for empty messages', () => {
        const cache = new ChatHeightCache()
        expect(calculateTotalHeight([], getId, cache, 40)).toBe(0)
    })

    it('uses estimated height for unmeasured messages', () => {
        const cache = new ChatHeightCache()
        const m = msgs(['1', '2', '3'])
        expect(calculateTotalHeight(m, getId, cache, 40)).toBe(120)
    })

    it('uses measured height when available', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 100)
        cache.set('2', 50)
        const m = msgs(['1', '2', '3'])
        // 100 + 50 + 40(estimated)
        expect(calculateTotalHeight(m, getId, cache, 40)).toBe(190)
    })

    it('uses all measured heights when fully measured', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 80)
        cache.set('2', 60)
        cache.set('3', 100)
        const m = msgs(['1', '2', '3'])
        expect(calculateTotalHeight(m, getId, cache, 40)).toBe(240)
    })
})

describe('calculateOffsetForIndex', () => {
    it('returns 0 for index 0', () => {
        const cache = new ChatHeightCache()
        const m = msgs(['1', '2', '3'])
        expect(calculateOffsetForIndex(m, 0, getId, cache, 40)).toBe(0)
    })

    it('sums estimated heights for unmeasured messages', () => {
        const cache = new ChatHeightCache()
        const m = msgs(['1', '2', '3', '4'])
        // offset for index 2 = height[0] + height[1] = 40 + 40
        expect(calculateOffsetForIndex(m, 2, getId, cache, 40)).toBe(80)
    })

    it('uses measured heights when available', () => {
        const cache = new ChatHeightCache()
        cache.set('1', 100)
        cache.set('2', 50)
        const m = msgs(['1', '2', '3'])
        // offset for index 2 = 100 + 50
        expect(calculateOffsetForIndex(m, 2, getId, cache, 40)).toBe(150)
    })

    it('mixes measured and estimated', () => {
        const cache = new ChatHeightCache()
        cache.set('2', 80)
        const m = msgs(['1', '2', '3', '4'])
        // offset for index 3 = 40(est) + 80(measured) + 40(est)
        expect(calculateOffsetForIndex(m, 3, getId, cache, 40)).toBe(160)
    })

    it('clamps to messages length', () => {
        const cache = new ChatHeightCache()
        const m = msgs(['1', '2'])
        // index 10 is beyond array — should sum all heights
        expect(calculateOffsetForIndex(m, 10, getId, cache, 40)).toBe(80)
    })

    it('returns 0 for empty messages', () => {
        const cache = new ChatHeightCache()
        expect(calculateOffsetForIndex([], 5, getId, cache, 40)).toBe(0)
    })
})
