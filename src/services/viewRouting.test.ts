import { describe, expect, it } from 'vitest'
import {
  initialView,
  parseModeValue,
  planModeChange,
  readStoredView,
  storageKey,
  storeView,
  type ViewStorage,
} from './viewRouting'

function createStorage(initial: Record<string, string> = {}) {
  const entries = { ...initial }
  const storage: ViewStorage & { entries: Record<string, string> } = {
    entries,
    getItem: key => (key in entries ? entries[key] : null),
    setItem: (key, value) => {
      entries[key] = value
    },
    removeItem: key => {
      delete entries[key]
    },
  }
  return storage
}

const listingHref = 'https://e-hentai.org/?f_search=artist%3Afoo+bar&f_cats=1017&page=3#top'

describe('mode values', () => {
  it('tells our namespaced options apart from the native ones', () => {
    expect(parseModeValue('evr-t')).toEqual({ kind: 'simulated', view: 't' })
    expect(parseModeValue('t')).toEqual({ kind: 'native', mode: 't' })
  })

  it('ignores anything that is not a display mode', () => {
    for (const value of ['', 'evr-', 'evr-x', 'dm_t', 'x', 'evr-evr-t']) {
      expect(parseModeValue(value)).toBeNull()
    }
  })
})

describe('mode changes', () => {
  it('reloads native Extended from a native page, keeping search, filters and hash', () => {
    const transition = planModeChange('evr-l', { extended: false, href: listingHref })

    expect(transition).toMatchObject({ kind: 'navigate', view: 'l' })
    const url = new URL(transition.kind === 'navigate' ? transition.url : '')
    expect(url.searchParams.get('inline_set')).toBe('dm_e')
    expect(url.searchParams.get('f_search')).toBe('artist:foo bar')
    expect(url.searchParams.get('f_cats')).toBe('1017')
    expect(url.searchParams.get('page')).toBe('3')
    expect(url.hash).toBe('#top')
  })

  it('replaces an existing display switch instead of stacking another one', () => {
    const transition = planModeChange('evr-m', {
      extended: false,
      href: 'https://exhentai.org/?inline_set=dm_t&page=2',
    })

    expect(transition.kind).toBe('navigate')
    const url = transition.kind === 'navigate' ? new URL(transition.url) : null
    expect(url?.searchParams.getAll('inline_set')).toEqual(['dm_e'])
    expect(url?.searchParams.get('page')).toBe('2')
  })

  it('stays on the page when Extended is already rendered', () => {
    expect(planModeChange('evr-m', { extended: true, href: listingHref })).toEqual({
      kind: 'apply',
      view: 'm',
    })
    expect(planModeChange('evr-e', { extended: true, href: listingHref })).toEqual({
      kind: 'apply',
      view: 'e',
    })
  })

  it('leaves the site modes to the site, on both kinds of page', () => {
    expect(planModeChange('p', { extended: true, href: listingHref })).toEqual({
      kind: 'native',
      mode: 'p',
    })
    expect(planModeChange('e', { extended: false, href: listingHref })).toEqual({
      kind: 'native',
      mode: 'e',
    })
    expect(planModeChange('dm_p', { extended: true, href: listingHref })).toEqual({ kind: 'ignore' })
  })
})

describe('stored simulation', () => {
  it('survives the trip to native Extended and comes back on the next page', () => {
    const storage = createStorage()
    const transition = planModeChange('evr-t', { extended: false, href: listingHref })
    if (transition.kind === 'navigate') storeView(storage, transition.view)

    expect(storage.entries[storageKey]).toBe('t')
    expect(initialView(readStoredView(storage), true)).toBe('t')
  })

  it('never applies itself on a page without the Extended markup', () => {
    const storage = createStorage({ [storageKey]: 't' })

    expect(initialView(readStoredView(storage), false)).toBe('e')
  })

  it('opens an unvisited Extended page in Thumbnail', () => {
    expect(initialView(readStoredView(createStorage()), true)).toBe('t')
  })

  it('falls back to the default when a site mode drops the choice', () => {
    const storage = createStorage({ [storageKey]: 'l' })
    storeView(storage, null)

    expect(storage.entries).toEqual({})
    expect(initialView(readStoredView(storage), true)).toBe('t')
  })

  it('keeps the untouched Extended layout once it is chosen', () => {
    const storage = createStorage({ [storageKey]: 'l' })
    storeView(storage, 'e')

    expect(storage.entries[storageKey]).toBe('e')
    expect(initialView(readStoredView(storage), true)).toBe('e')
  })

  it('ignores an unknown stored mode', () => {
    expect(readStoredView(createStorage({ [storageKey]: 'x' }))).toBeNull()
  })
})
