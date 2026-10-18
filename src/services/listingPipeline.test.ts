// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import extended from '../../tests/fixtures/native-listing/extended.html?raw'
import { createListingPipeline, type ListingPipeline } from './listingPipeline'
import { galleryKey, outerRows, sourceSelector } from './source/extendedAdapter'

const RELAY = ['data-evr-tags', 'data-evr-uploader', 'data-evr-rating', 'data-evr-my-rating']

function mountFixture(): HTMLTableElement {
  const page = new DOMParser().parseFromString(extended, 'text/html')
  const table = page.querySelector<HTMLTableElement>(sourceSelector)!
  // Favourites carry a selection cell; the fixture comes from the front page, so one is added
  for (const row of outerRows(table)) {
    const key = galleryKey(row)
    if (!key) continue
    const cell = page.createElement('td')
    cell.className = 'glfe'
    cell.innerHTML = `<input type="checkbox" name="modifygids[]" value="${key.split('/')[0]}">`
    row.append(cell)
  }
  const wrapper = document.createElement('div')
  wrapper.className = 'ido'
  wrapper.append(document.importNode(table, true))
  document.body.replaceChildren(wrapper)
  return wrapper.querySelector<HTMLTableElement>(sourceSelector)!
}

const gidOf = (node: Element) => /\/g\/(\d+)\//.exec(node.querySelector('a[href*="/g/"]')!.getAttribute('href')!)![1]
const relayed = (node: Element) => RELAY.map(name => node.getAttribute(name))

function shown(pipeline: ListingPipeline) {
  return Array.from({ length: pipeline.strip.count }, (_, index) => pipeline.strip.nodeAt(index)!)
}

describe('createListingPipeline', () => {
  let source: HTMLTableElement
  beforeEach(() => {
    source = mountFixture()
  })

  it('lets go of the source rows once another view has drawn them', () => {
    const before = outerRows(source).filter(row => galleryKey(row)).length
    const pipeline = createListingPipeline(source)
    pipeline.setView('t')
    expect(outerRows(source).filter(row => galleryKey(row))).toEqual([])
    expect(shown(pipeline)).toHaveLength(before)
  })

  it('keeps order, public data and selection through every switch, back to Extended', () => {
    const original = outerRows(source).filter(row => galleryKey(row))
    const order = original.map(gidOf)
    const pipeline = createListingPipeline(source)
    const data = original.map(relayed)
    expect(data.every(([tags]) => tags !== null)).toBe(true)

    pipeline.setView('t')
    shown(pipeline)[3].querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked = true

    for (const view of ['m', 'l', 'p', 'e', 't', 'e'] as const) {
      pipeline.setView(view)
      const nodes = shown(pipeline)
      expect(nodes.map(gidOf)).toEqual(order)
      expect(nodes.map(relayed)).toEqual(data)
      expect(nodes.map(node => node.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked))
        .toEqual(order.map((_, index) => index === 3))
    }
    expect(pipeline.element).toBe(source)
    expect(outerRows(source).filter(row => galleryKey(row)).map(gidOf)).toEqual(order)
  })

  it('puts every row back when it goes away while another view is shown', () => {
    const order = outerRows(source).filter(row => galleryKey(row)).map(gidOf)
    const pipeline = createListingPipeline(source)
    pipeline.setView('m')
    pipeline.dispose()
    expect(source.isConnected).toBe(true)
    expect(outerRows(source).filter(row => galleryKey(row)).map(gidOf)).toEqual(order)
  })

  it('keeps one uploader tag per gallery through view switches and follows the setting in every view', () => {
    const options = { group: false, uploader: true }
    const pipeline = createListingPipeline(source, () => options)
    const data = outerRows(source).filter(row => galleryKey(row)).map(row => row.getAttribute('data-evr-tags'))
    const uploaders = () => shown(pipeline).map(node => Array.from(
      node.querySelectorAll('.evr-uploader-tag'), tag => tag.getAttribute('data-evr-tag'),
    ))
    const expected = shown(pipeline).map(node => {
      const name = node.getAttribute('data-evr-uploader')
      return name === null ? [] : [`uploader:${name}`]
    })
    expect(expected.some(names => names.length)).toBe(true)

    for (const view of ['e', 't', 'e', 'm', 'e'] as const) {
      pipeline.setView(view)
      expect(uploaders()).toEqual(expected)
      expect(shown(pipeline).map(node => node.getAttribute('data-evr-tags'))).toEqual(data)
    }
    for (const view of ['e', 't'] as const) {
      pipeline.setView(view)
      options.uploader = false
      pipeline.refreshTags()
      expect(uploaders().flat()).toEqual([])
      options.uploader = true
      pipeline.refreshTags()
      expect(uploaders()).toEqual(expected)
    }
  })
})
