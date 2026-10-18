// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { pagesByGid, positionUrl } from './liveUrl'

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
