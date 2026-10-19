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
    const stop = settings.subscribeAllOtherTags(value => seen.push(value))

    settings.setAllOtherTags(false)
    settings.setAllOtherTags(false)
    expect(settings.getAllOtherTags()).toBe(false)
    expect(seen).toEqual([false])
    expect(manager.values.get(settings.allOtherTagsKey)).toBe('false')
    stop()

    vi.resetModules()
    expect((await import('./settings')).getAllOtherTags()).toBe(false)
  })

  it('shares changes between script instances without duplicate notifications', async () => {
    const first = await import('./settings')
    const firstSeen: boolean[] = []
    const stopFirst = first.subscribeAllOtherTags(value => firstSeen.push(value))
    vi.resetModules()
    const second = await import('./settings')
    const secondSeen: boolean[] = []
    const stopSecond = second.subscribeAllOtherTags(value => secondSeen.push(value))

    second.setAllOtherTags(false)
    first.setAllOtherTags(true)
    expect(first.getAllOtherTags()).toBe(true)
    expect(second.getAllOtherTags()).toBe(true)
    expect(firstSeen).toEqual([false, true])
    expect(secondSeen).toEqual([false, true])

    stopFirst()
    second.setAllOtherTags(false)
    expect(firstSeen).toEqual([false, true])
    expect(secondSeen).toEqual([false, true, false])
    stopSecond()
  })

  it('restores all tags when the saved choice is deleted remotely', async () => {
    const settings = await import('./settings')
    settings.setAllOtherTags(false)
    const seen: boolean[] = []
    const stop = settings.subscribeAllOtherTags(value => seen.push(value))
    manager.values.delete(settings.allOtherTagsKey)
    for (const listener of manager.listeners.values()) {
      listener.callback(settings.allOtherTagsKey, 'false', undefined, true)
    }
    expect(settings.getAllOtherTags()).toBe(true)
    expect(seen).toEqual([true])
    stop()
  })

  it('refreshes a cached choice when observation resumes', async () => {
    const settings = await import('./settings')
    settings.setAllOtherTags(false)
    const stop = settings.subscribeAllOtherTags(() => {})
    stop()
    manager.values.set(settings.allOtherTagsKey, 'true')
    const seen: boolean[] = []
    const stopAgain = settings.subscribeAllOtherTags(value => seen.push(value))
    expect(settings.getAllOtherTags()).toBe(true)
    expect(seen).toEqual([true])
    stopAgain()
  })

  it('keeps the previous choice when script storage itself rejects a write', async () => {
    const settings = await import('./settings')
    const seen: boolean[] = []
    const stop = settings.subscribeAllOtherTags(value => seen.push(value))
    manager.failWrites = true
    expect(() => settings.setAllOtherTags(false)).toThrow('Script storage failed')
    expect(settings.getAllOtherTags()).toBe(true)
    expect(seen).toEqual([])
    stop()
  })

  it('persists independent tag and scrolling choices and synchronizes scrolling across instances', async () => {
    const first = await import('./settings')
    const tags: boolean[] = []
    const scrolling: boolean[] = []
    const stopTags = first.subscribeAllOtherTags(value => tags.push(value))
    const stopScrolling = first.subscribeInfiniteScroll(value => scrolling.push(value))

    first.setInfiniteScroll(false)
    expect(first.getAllOtherTags()).toBe(true)
    expect(tags).toEqual([])
    first.setAllOtherTags(false)
    first.setInfiniteScroll(true)
    expect(first.getAllOtherTags()).toBe(false)
    expect(tags).toEqual([false])
    expect(scrolling).toEqual([false, true])

    vi.resetModules()
    const second = await import('./settings')
    expect(second.getAllOtherTags()).toBe(false)
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
    settings.setAllOtherTags(false)
    settings.setInfiniteScroll(false)
    const seen: boolean[] = []
    const stop = settings.subscribeInfiniteScroll(value => seen.push(value))
    manager.values.delete(settings.infiniteScrollKey)
    for (const listener of manager.listeners.values()) {
      if (listener.key === settings.infiniteScrollKey)
        listener.callback(settings.infiniteScrollKey, 'false', undefined, true)
    }
    expect(settings.getInfiniteScroll()).toBe(true)
    expect(settings.getAllOtherTags()).toBe(false)
    expect(seen).toEqual([true])
    stop()
  })

  it('follows the browser until a language is picked, and ignores a language it does not know', async () => {
    vi.stubGlobal('navigator', { languages: ['ja-JP'] })
    const settings = await import('./settings')
    expect(settings.getLocaleChoice()).toBe('ja')
    settings.setLocaleChoice('ko')
    vi.resetModules()
    expect((await import('./settings')).getLocaleChoice()).toBe('ko')

    manager.values.set(settings.localeKey, 'fr')
    vi.resetModules()
    expect((await import('./settings')).getLocaleChoice()).toBe('ja')
  })
})
