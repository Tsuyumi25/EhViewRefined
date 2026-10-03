import {
  GM_getValue,
  GM_setValue,
  GM_addValueChangeListener,
  GM_removeValueChangeListener,
} from '$'
import type { GmValueListenerId } from '$'

type Listener = (value: boolean) => void

function createBooleanSetting(key: string, defaultValue: boolean) {
  const listeners = new Set<Listener>()
  let current: boolean | null = null
  let listenerId: GmValueListenerId | undefined

  function parse(raw: unknown): boolean {
    if (raw === 'true') return true
    if (raw === 'false') return false
    return defaultValue
  }

  function stored(): boolean {
    return parse(GM_getValue<string | null>(key, null))
  }

  function update(value: boolean) {
    if (value === current) return
    current = value
    for (const listener of [...listeners]) listener(value)
  }

  function get(): boolean {
    return (current ??= stored())
  }

  function set(value: boolean): void {
    if (get() === value) return
    GM_setValue(key, String(value))
    update(value)
  }

  function subscribe(listener: Listener): () => void {
    get()
    listeners.add(listener)
    if (listenerId === undefined) {
      listenerId = GM_addValueChangeListener<string>(key, (_key, _old, value) => {
        update(parse(value))
      })
      update(stored())
    }
    return () => {
      if (!listeners.delete(listener)) return
      if (listeners.size === 0 && listenerId !== undefined) {
        GM_removeValueChangeListener(listenerId)
        listenerId = undefined
      }
    }
  }

  return { get, set, subscribe }
}

export const showAllTagsKey = 'ehe:show-all-tags'
export const {
  get: getShowAllTags,
  set: setShowAllTags,
  subscribe: subscribeShowAllTags,
} = createBooleanSetting(showAllTagsKey, true)

export const infiniteScrollKey = 'ehe:infinite-scroll'
export const {
  get: getInfiniteScroll,
  set: setInfiniteScroll,
  subscribe: subscribeInfiniteScroll,
} = createBooleanSetting(infiniteScrollKey, true)
