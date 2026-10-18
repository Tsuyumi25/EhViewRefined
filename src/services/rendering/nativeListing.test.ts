// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import extended from '../../../tests/fixtures/native-listing/extended.html?raw'
import minimal from '../../../tests/fixtures/native-listing/minimal.html?raw'
import minimalPlus from '../../../tests/fixtures/native-listing/minimal-plus.html?raw'
import compact from '../../../tests/fixtures/native-listing/compact.html?raw'
import thumbnail from '../../../tests/fixtures/native-listing/thumbnail.html?raw'
import { adaptExtendedGallery, outerRows } from '../source/extendedAdapter'
import { createNativeListing } from './nativeListing'

const fixtures = { e: extended, m: minimal, p: minimalPlus, l: compact, t: thumbnail }
const fixtureDirectory = process.env.EVR_NATIVE_FIXTURE_DIR
if (fixtureDirectory) {
  for (const view of ['e', 'm', 'p', 'l', 't'] as const) {
    fixtures[view] = readFileSync(resolve(fixtureDirectory, `${view}.html`), 'utf8')
  }
}

function parseListing(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const listing = doc.querySelector<HTMLElement>('.itg')
  if (!listing) throw new Error('Fixture has no native listing')
  return listing
}

function structure(element: Element, depth = 0): string[] {
  const classes = Array.from(element.classList).sort().join('.')
  return [
    `${'  '.repeat(depth)}${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`,
    ...Array.from(element.children).flatMap(child => structure(child, depth + 1)),
  ]
}

function galleryHref(item: Element): string | null {
  return item.querySelector('a[href*="/g/"]')?.getAttribute('href') ?? null
}

function omitNativeAdvertisements(listing: Element): void {
  for (const row of outerRows(listing)) {
    if (row.children.length === 1 && row.firstElementChild?.className === 'itd'
      && row.querySelector('ins') && row.querySelector('script')) row.remove()
  }
}

function addCompleteThumbnailTags(native: Element, source: Element): void {
  const rows = new Map(outerRows(source).map(row => [galleryHref(row), row]))
  for (const card of native.children) {
    const sourceRow = rows.get(galleryHref(card))
    if (!sourceRow) throw new Error('Native thumbnail has no matching Extended gallery')
    const tags = native.ownerDocument.createElement('div')
    tags.className = 'gl6t'
    tags.append(...Array.from(sourceRow.querySelectorAll('.gl4e .gt, .gl4e .gtl, .gl4e .gtw'), tag => tag.cloneNode(true)))
    card.insertBefore(tags, card.querySelector(':scope > .gl5t'))
  }
}

function galleryLinks(listing: Element): (string | null)[] {
  return Array.from(listing.querySelectorAll('a[href*="/g/"]'), link => link.getAttribute('href'))
}

describe('native listing DOM compatibility', () => {
  it.each(['m', 'p', 'l', 't'] as const)('preserves the native %s element hierarchy, order and classes', view => {
    const source = parseListing(fixtures.e)
    const native = parseListing(fixtures[view])
    const rendered = createNativeListing(source.ownerDocument, view)

    omitNativeAdvertisements(native)
    if (view === 't') addCompleteThumbnailTags(native, source)

    for (const row of outerRows(source)) {
      const gallery = adaptExtendedGallery(row)
      if (gallery) rendered.append(gallery)
    }

    expect(galleryLinks(rendered.element)).toEqual(galleryLinks(native))
    expect(structure(rendered.element)).toEqual(structure(native))
  })
})

describe('public tag metadata', () => {
  it('passes on each tag name with the site class for its tier', () => {
    const source = parseListing(fixtures.e)
    const row = outerRows(source).find(candidate => candidate.querySelector('.gl4e .gtl'))!
    const gallery = adaptExtendedGallery(row)!
    const expected = Array.from(row.querySelectorAll<HTMLElement>('.gl4e .gt, .gl4e .gtl, .gl4e .gtw'), tag => ({
      name: tag.title,
      tier: ['gt', 'gtl', 'gtw'].find(tier => tag.classList.contains(tier)),
    }))
    expect(expected.some(tag => tag.tier === 'gtl')).toBe(true)
    expect(JSON.parse(gallery.snapshot.tagData)).toEqual(expected)
  })
})

describe('public uploader metadata', () => {
  function uploaderNames(listing: Element): (string | null)[] {
    return outerRows(listing).filter(row => row.querySelector('a[href*="/g/"]')).map(row => {
      const href = row.querySelector('.gl3e a[href*="/uploader/"]')?.getAttribute('href')
      return href ? decodeURIComponent(href.split('/uploader/')[1].replace(/\+/g, ' ')) : null
    })
  }

  it.each(['m', 'p', 'l', 't'] as const)('every %s item carries the uploader of its Extended row', view => {
    const source = parseListing(fixtures.e)
    const rendered = createNativeListing(source.ownerDocument, view)
    for (const row of outerRows(source)) {
      const gallery = adaptExtendedGallery(row)
      if (gallery) rendered.append(gallery)
    }

    const items = Array.from(rendered.element.querySelectorAll('[data-evr-tags]'))
    expect(items.map(item => item.getAttribute('data-evr-uploader'))).toEqual(uploaderNames(source))
  })

  it('decodes the form-encoded link and leaves rows without an uploader link unmarked', () => {
    const source = parseListing(fixtures.e)
    const [named, unlinked] = outerRows(source).filter(row => row.querySelector('.gl3e a[href*="/uploader/"]'))
    named.querySelector('.gl3e a[href*="/uploader/"]')!.setAttribute('href', 'https://e-hentai.org/uploader/Some+Name%2B1')
    const link = unlinked.querySelector('.gl3e a[href*="/uploader/"]')!
    link.replaceWith(...link.childNodes)

    expect(adaptExtendedGallery(named)?.snapshot.uploader).toBe('Some Name+1')
    expect(named.getAttribute('data-evr-uploader')).toBe('Some Name+1')
    expect(adaptExtendedGallery(unlinked)?.snapshot.uploader).toBeNull()
    expect(unlinked.hasAttribute('data-evr-uploader')).toBe(false)
  })
})

describe('public rating metadata', () => {
  function rendered(source: HTMLElement, view: 'm' | 'p' | 'l' | 't') {
    const listing = createNativeListing(source.ownerDocument, view)
    for (const row of outerRows(source)) {
      const gallery = adaptExtendedGallery(row)
      if (gallery) listing.append(gallery)
    }
    return Array.from(listing.element.querySelectorAll('[data-evr-tags]'))
  }

  // The fixture uses two sprite positions: four and a half stars, and four full stars
  const SHOWN: Record<string, string> = { '0px -21px': '4.5', '-16px -1px': '4' }

  it.each(['m', 'p', 'l', 't'] as const)('every %s item carries the half-star rating its stars show', view => {
    const source = parseListing(fixtures.e)
    const expected = outerRows(source).filter(row => row.querySelector('a[href*="/g/"]')).map(row =>
      SHOWN[/background-position:([^;]+)/.exec(row.querySelector('.gl3e .ir')!.getAttribute('style')!)![1]])
    expect(expected).not.toContain(undefined)
    expect(rendered(source, view).map(item => item.getAttribute('data-evr-rating'))).toEqual(expected)
  })

  it('moves stars that show the user rating to data-evr-my-rating', () => {
    const source = parseListing(fixtures.e)
    const row = outerRows(source).find(candidate => candidate.querySelector('.gl3e .ir'))!
    const stars = row.querySelector('.gl3e .ir')!
    stars.classList.add('irg')
    stars.setAttribute('style', 'background-position:-32px -21px;opacity:1')

    expect(adaptExtendedGallery(row)?.snapshot).toMatchObject({ rating: null, myRating: 2.5 })
    expect(row.getAttribute('data-evr-my-rating')).toBe('2.5')
    expect(row.hasAttribute('data-evr-rating')).toBe(false)
    const item = rendered(source, 't').find(candidate => candidate.getAttribute('data-evr-my-rating') === '2.5')
    expect(item?.hasAttribute('data-evr-rating')).toBe(false)
  })
})
