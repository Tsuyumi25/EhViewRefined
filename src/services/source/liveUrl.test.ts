// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ListingPipeline } from '../listingPipeline'
import { pagesByGid, positionUrl, startLiveUrl } from './liveUrl'

/** The site's two search bars, in document order; the end the reader cannot go to is a bare span. */
function nav(prev: string | null, next: string | null): ParentNode {
  const link = (id: string, href: string | null) => (href ? `<a id="${id}" href="${href}">` : `<span id="${id}">`)
  const doc = new DOMParser().parseFromString(
    `<div class="searchnav"><span id="ufirst"></span>${link('uprev', prev)}${link('unext', next)}</div>
     <div class="searchnav"><span id="dfirst"></span>${link('dprev', prev)}${link('dnext', next)}</div>`,
    'text/html',
  )
  return doc
}

describe('pagesByGid', () => {
  it('accepts the gid cursor the front page, searches and watched use, on the first page too', () => {
    expect(pagesByGid(nav(null, 'https://e-hentai.org/?next=2999973'))).toBe(true)
    expect(pagesByGid(nav('https://exhentai.org/watched?f_search=a&prev=200', 'https://exhentai.org/watched?f_search=a&next=123'))).toBe(true)
    expect(pagesByGid(nav('https://e-hentai.org/?prev=2999973', null))).toBe(true)
  })

  it('refuses listings whose cursor is not a gid, or that have none', () => {
    expect(pagesByGid(nav(null, 'https://e-hentai.org/favorites.php?next=1700000000-2999973'))).toBe(false)
    expect(pagesByGid(nav(null, 'https://e-hentai.org/toplist.php?tl=11&p=1'))).toBe(false)
    expect(pagesByGid(nav(null, null))).toBe(false)
  })
})

describe('positionUrl', () => {
  it('starts the listing at the gallery and keeps the search', () => {
    const url = new URL(positionUrl('https://e-hentai.org/?f_search=some+parody&f_cats=1017', '2999950'))
    expect(url.searchParams.get('next')).toBe('2999951')
    expect(url.searchParams.get('f_search')).toBe('some parody')
    expect(url.searchParams.get('f_cats')).toBe('1017')
  })

  it('drops every other way the address picked its place, which would fight the cursor', () => {
    const url = new URL(positionUrl('https://e-hentai.org/tag/x?prev=3000000&jump=1w&seek=2024-01-01&range=5&inline_set=dm_e', '2999950'))
    expect([...url.searchParams.keys()]).toEqual(['next'])
    expect(url.pathname).toBe('/tag/x')
  })
})

describe('startLiveUrl', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  // 關掉再打開無限滾動時，history 已經是上一輪留下的 manual
  it('hands the browser its own scroll restoration back at the first gallery, even after a restart', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<a id="unext" href="/?next=500"></a>'
    const href = location.href
    history.replaceState(null, '', '/?next=101')
    history.scrollRestoration = 'manual'
    const first = { getBoundingClientRect: () => ({ bottom: 10 }) } as HTMLElement
    const presentation = { element: document.body, strip: { start: 0, end: 1, nodeAt: () => first } } as unknown as ListingPipeline

    const stop = startLiveUrl(presentation, { href, scrollRestoration: 'auto' })
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(250)
    stop()

    expect(location.href).toBe(href)
    expect(history.scrollRestoration).toBe('auto')
  })
})
