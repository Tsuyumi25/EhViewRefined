import {
  GM_getValue,
  GM_setValue,
  GM_addValueChangeListener,
  GM_removeValueChangeListener,
} from '$'
import type { GmValueListenerId } from '$'
import { detectLocale, isLocale, type Locale } from './locale'

/** parse turns whatever is stored (nothing, or a value from another version) into a usable value */
function createSetting<T extends string | boolean>(key: string, parse: (raw: unknown) => T) {
  type Listener = (value: T) => void
  const listeners = new Set<Listener>()
  let current: T | null = null
  let listenerId: GmValueListenerId | undefined

  function stored(): T {
    return parse(GM_getValue<string | null>(key, null))
  }

  function update(value: T) {
    if (value === current) return
    current = value
    for (const listener of [...listeners]) listener(value)
  }

  function get(): T {
    return (current ??= stored())
  }

  function set(value: T): void {
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

function createBooleanSetting(key: string, defaultValue: boolean) {
  return createSetting<boolean>(key, raw => raw === 'true' ? true : raw === 'false' ? false : defaultValue)
}

export const showAllTagsKey = 'ehe:show-all-tags'
export const {
  get: getShowAllTags,
  set: setShowAllTags,
  subscribe: subscribeShowAllTags,
} = createBooleanSetting(showAllTagsKey, true)

export const groupTagsKey = 'ehe:group-tags'
export const {
  get: getGroupTags,
  set: setGroupTags,
  subscribe: subscribeGroupTags,
} = createBooleanSetting(groupTagsKey, false)

export const uploaderTagKey = 'ehe:uploader-tag'
export const {
  get: getUploaderTag,
  set: setUploaderTag,
  subscribe: subscribeUploaderTag,
} = createBooleanSetting(uploaderTagKey, true)

export const infiniteScrollKey = 'ehe:infinite-scroll'
export const {
  get: getInfiniteScroll,
  set: setInfiniteScroll,
  subscribe: subscribeInfiniteScroll,
} = createBooleanSetting(infiniteScrollKey, true)

// Until a language is picked the browser's preference decides, so it can still change with the browser
export const localeKey = 'ehe:locale'
export const {
  get: getLocaleChoice,
  set: setLocaleChoice,
  subscribe: subscribeLocaleChoice,
} = createSetting<Locale>(localeKey, raw => isLocale(raw) ? raw : detectLocale(navigator.languages))
