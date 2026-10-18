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
import { plainTagOptions, type TagOptions } from './tagArea'

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

function render(source: HTMLElement, view: 'm' | 'p' | 'l' | 't', options: TagOptions = plainTagOptions) {
  const listing = createNativeListing(source.ownerDocument, view, options)
  listing.append(outerRows(source).flatMap(row => adaptExtendedGallery(row) ?? []))
  return listing
}

function galleryLinks(listing: Element): (string | null)[] {
  return Array.from(listing.querySelectorAll('a[href*="/g/"]'), link => link.getAttribute('href'))
}

describe('native listing DOM compatibility', () => {
  it.each(['m', 'p', 'l', 't'] as const)('preserves the native %s element hierarchy, order and classes', view => {
    const source = parseListing(fixtures.e)
    const native = parseListing(fixtures[view])
    omitNativeAdvertisements(native)
    if (view === 't') addCompleteThumbnailTags(native, source)
    const rendered = render(source, view)

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
    const rendered = render(source, view)
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
    return Array.from(render(source, view).element.querySelectorAll('[data-evr-tags]'))
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

/** Each Extended row's namespace rows as [label, tag names], the way the site groups them. */
function sourceGroups(row: Element): [string, string[]][] {
  return Array.from(row.querySelectorAll('.gl4e tr'), (line): [string, string[]] => [
    `${line.querySelector('td.tc')!.textContent!.trim().toLowerCase().replace(/:$/, '')}:`,
    Array.from(line.querySelectorAll<HTMLElement>('.gt, .gtl, .gtw'), tag => tag.title),
  ])
}

function galleryRows(source: HTMLElement) {
  return outerRows(source).filter(row => row.querySelector('a[href*="/g/"]'))
}

describe('public per-tag metadata', () => {
  // The fixture styles no tag, so Minimal+ draws none and has nothing to check
  it.each(['l', 't'] as const)('every tag drawn in %s names itself and its namespace', view => {
    const source = parseListing(fixtures.e)
    const expected = new Map(galleryRows(source).flatMap(row => sourceGroups(row).flatMap(([label, names]) =>
      names.map(name => [name, label.slice(0, -1)] as const))))
    const tags = Array.from(render(source, view).element.querySelectorAll<HTMLElement>('.gt, .gtl, .gtw'))
    expect(tags.length).toBeGreaterThan(0)
    for (const tag of tags) {
      expect(tag.getAttribute('data-evr-tag')).toBe(tag.title)
      expect(tag.getAttribute('data-evr-ns')).toBe(expected.get(tag.title))
    }
  })
})

describe('tag options', () => {
  it('groups the tags of every gallery into the rows Extended shows, in the same order', () => {
    const source = parseListing(fixtures.e)
    const expected = galleryRows(source).map(sourceGroups)
    const cards = Array.from(render(source, 't', { group: true, uploader: false }).element.children)
    expect(cards.map(card => Array.from(card.querySelectorAll('.evr-tag-groups tr'), line => [
      line.querySelector('td.tc')!.textContent,
      Array.from(line.querySelectorAll<HTMLElement>('[data-evr-tag]'), tag => tag.title),
    ]))).toEqual(expected.map(groups => groups.filter(([, names]) => names.length)))
  })

  it.each([false, true])('adds the uploader as one more tag (grouped: %s) without touching the tag data', group => {
    const source = parseListing(fixtures.e)
    const plain = render(source, 't')
    const listing = render(source, 't', { group, uploader: true })
    const items = Array.from(listing.element.children)
    expect(items.map(item => item.getAttribute('data-evr-tags')))
      .toEqual(Array.from(plain.element.children, item => item.getAttribute('data-evr-tags')))
    expect(items.some(item => item.hasAttribute('data-evr-uploader'))).toBe(true)
    for (const item of items) {
      const uploader = item.getAttribute('data-evr-uploader')
      const shown = Array.from(item.querySelectorAll<HTMLElement>('.evr-uploader-tag'))
      expect(shown.map(tag => tag.getAttribute('data-evr-tag'))).toEqual(uploader === null ? [] : [`uploader:${uploader}`])
      if (group && uploader !== null) {
        const last = item.querySelector('.evr-tag-groups tr:last-child')!
        expect(last.querySelector('td.tc')!.textContent).toBe('uploader:')
        expect(last.contains(shown[0])).toBe(true)
      }
    }
  })

  it('shows the uploader even in Minimal, which draws no tags of its own', () => {
    const source = parseListing(fixtures.e)
    const listing = render(source, 'm', { group: false, uploader: true })
    const named = Array.from(listing.element.querySelectorAll('[data-evr-uploader]'))
    expect(named.length).toBeGreaterThan(0)
    for (const item of named) expect(item.querySelectorAll('.evr-uploader-tag')).toHaveLength(1)
    expect(listing.element.querySelectorAll('[data-evr-tag]:not(.evr-uploader-tag)')).toHaveLength(0)
  })
})

describe('batched insert', () => {
  it('inserts a whole batch as one mutation once the document has loaded', async () => {
    const source = parseListing(fixtures.e)
    const listing = createNativeListing(document, 't', plainTagOptions)
    document.body.append(listing.element)
    const records: MutationRecord[] = []
    const observer = new MutationObserver(found => records.push(...found))
    observer.observe(listing.element, { childList: true, subtree: true })
    const galleries = galleryRows(source).map(row => adaptExtendedGallery(row)!)
    expect(listing.append(galleries)).toBe(galleries.length)
    await Promise.resolve()
    observer.disconnect()
    listing.element.remove()
    expect(records).toHaveLength(1)
    expect(records[0].addedNodes).toHaveLength(galleries.length)
  })
})
