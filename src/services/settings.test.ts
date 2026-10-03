import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Reimports give each userscript instance independent module state while sharing manager storage.
type ChangeListener = (key: string, oldValue: string | undefined, value: string | undefined, remote: boolean) => void

const manager = vi.hoisted(() => ({
  values: new Map<string, string>(),
  listeners: new Map<number, { key: string; callback: ChangeListener }>(),
  nextId: 0,
  failWrites: false,
}))

vi.mock('$', () => ({
  GM_getValue: (key: string, fallback: unknown) => manager.values.get(key) ?? fallback,
  GM_setValue: (key: string, value: string) => {
    if (manager.failWrites) throw new Error('Script storage failed')
    const oldValue = manager.values.get(key)
    manager.values.set(key, value)
    for (const listener of manager.listeners.values()) {
      if (listener.key === key) listener.callback(key, oldValue, value, false)
    }
  },
  GM_addValueChangeListener: (key: string, callback: ChangeListener) => {
    const id = manager.nextId++
    manager.listeners.set(id, { key, callback })
    return id
  },
  GM_removeValueChangeListener: (id: number) => manager.listeners.delete(id),
}))

beforeEach(() => {
  vi.resetModules()
  manager.values.clear()
  manager.listeners.clear()
  manager.nextId = 0
  manager.failWrites = false
})

afterEach(() => vi.unstubAllGlobals())

describe('script-owned settings', () => {
  it('saves and reloads the choice even when website storage is full', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError') },
    })
    const settings = await import('./settings')
    const seen: boolean[] = []
    const stop = settings.subscribeShowAllTags(value => seen.push(value))

    settings.setShowAllTags(false)
    settings.setShowAllTags(false)
    expect(settings.getShowAllTags()).toBe(false)
    expect(seen).toEqual([false])
    expect(manager.values.get(settings.showAllTagsKey)).toBe('false')
    stop()

    vi.resetModules()
    expect((await import('./settings')).getShowAllTags()).toBe(false)
  })

  it('shares changes between script instances without duplicate notifications', async () => {
    const first = await import('./settings')
    const firstSeen: boolean[] = []
    const stopFirst = first.subscribeShowAllTags(value => firstSeen.push(value))
    vi.resetModules()
    const second = await import('./settings')
    const secondSeen: boolean[] = []
    const stopSecond = second.subscribeShowAllTags(value => secondSeen.push(value))

    second.setShowAllTags(false)
    first.setShowAllTags(true)
    expect(first.getShowAllTags()).toBe(true)
    expect(second.getShowAllTags()).toBe(true)
    expect(firstSeen).toEqual([false, true])
    expect(secondSeen).toEqual([false, true])

    stopFirst()
    second.setShowAllTags(false)
    expect(firstSeen).toEqual([false, true])
    expect(secondSeen).toEqual([false, true, false])
    stopSecond()
  })

  it('restores all tags when the saved choice is deleted remotely', async () => {
    const settings = await import('./settings')
    settings.setShowAllTags(false)
    const seen: boolean[] = []
    const stop = settings.subscribeShowAllTags(value => seen.push(value))
    manager.values.delete(settings.showAllTagsKey)
    for (const listener of manager.listeners.values()) {
      listener.callback(settings.showAllTagsKey, 'false', undefined, true)
    }
    expect(settings.getShowAllTags()).toBe(true)
    expect(seen).toEqual([true])
    stop()
  })

  it('refreshes a cached choice when observation resumes', async () => {
    const settings = await import('./settings')
    settings.setShowAllTags(false)
    const stop = settings.subscribeShowAllTags(() => {})
    stop()
    manager.values.set(settings.showAllTagsKey, 'true')
    const seen: boolean[] = []
    const stopAgain = settings.subscribeShowAllTags(value => seen.push(value))
    expect(settings.getShowAllTags()).toBe(true)
    expect(seen).toEqual([true])
    stopAgain()
  })

  it('keeps the previous choice when script storage itself rejects a write', async () => {
    const settings = await import('./settings')
    const seen: boolean[] = []
    const stop = settings.subscribeShowAllTags(value => seen.push(value))
    manager.failWrites = true
    expect(() => settings.setShowAllTags(false)).toThrow('Script storage failed')
    expect(settings.getShowAllTags()).toBe(true)
    expect(seen).toEqual([])
    stop()
  })

  it('persists independent tag and scrolling choices and synchronizes scrolling across instances', async () => {
    const first = await import('./settings')
    const tags: boolean[] = []
    const scrolling: boolean[] = []
    const stopTags = first.subscribeShowAllTags(value => tags.push(value))
    const stopScrolling = first.subscribeInfiniteScroll(value => scrolling.push(value))

    first.setInfiniteScroll(false)
    expect(first.getShowAllTags()).toBe(true)
    expect(tags).toEqual([])
    first.setShowAllTags(false)
    first.setInfiniteScroll(true)
    expect(first.getShowAllTags()).toBe(false)
    expect(tags).toEqual([false])
    expect(scrolling).toEqual([false, true])

    vi.resetModules()
    const second = await import('./settings')
    expect(second.getShowAllTags()).toBe(false)
    expect(second.getInfiniteScroll()).toBe(true)
    const remote: boolean[] = []
    const stopRemote = second.subscribeInfiniteScroll(value => remote.push(value))
    second.setInfiniteScroll(false)
    expect(first.getInfiniteScroll()).toBe(false)
    expect(scrolling).toEqual([false, true, false])
    expect(remote).toEqual([false])
    expect(tags).toEqual([false])

    stopRemote()
    stopScrolling()
    stopTags()
  })

  it('resets a deleted scrolling preference without resetting the tag preference', async () => {
    const settings = await import('./settings')
    settings.setShowAllTags(false)
    settings.setInfiniteScroll(false)
    const seen: boolean[] = []
    const stop = settings.subscribeInfiniteScroll(value => seen.push(value))
    manager.values.delete(settings.infiniteScrollKey)
    for (const listener of manager.listeners.values()) {
      if (listener.key === settings.infiniteScrollKey)
        listener.callback(settings.infiniteScrollKey, 'false', undefined, true)
    }
    expect(settings.getInfiniteScroll()).toBe(true)
    expect(settings.getShowAllTags()).toBe(false)
    expect(seen).toEqual([true])
    stop()
  })
})
