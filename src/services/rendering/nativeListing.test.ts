// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import extended from '../../../tests/fixtures/native-listing/extended.html?raw'
import minimal from '../../../tests/fixtures/native-listing/minimal.html?raw'
import minimalPlus from '../../../tests/fixtures/native-listing/minimal-plus.html?raw'
import compact from '../../../tests/fixtures/native-listing/compact.html?raw'
import thumbnail from '../../../tests/fixtures/native-listing/thumbnail.html?raw'
import { adaptExtendedGallery, outerRows } from '../source/extendedAdapter'
import { createNativeListing } from './nativeListing'

const fixtures = { m: minimal, p: minimalPlus, l: compact, t: thumbnail }

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
    const source = parseListing(extended)
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
