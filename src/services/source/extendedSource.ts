import type { ExtendedGallery } from '../gallerySnapshot'
import { createItemStrip, type ItemStrip, type ItemStripWriter } from '../rendering/itemStrip'
import {
  adaptExtendedGallery,
  captureGalleryRating,
  captureGalleryTags,
  captureGalleryUploader,
  galleryKey,
  outerRows,
  sourceSelector,
} from './extendedAdapter'

const sectionTags: Record<string, true> = { TBODY: true, THEAD: true, TFOOT: true }

interface Entry {
  gid: string
  /** Present while the row lives in the source; a released row keeps only its markup. */
  row: HTMLTableRowElement | null
  html: string | null
}

export interface ExtendedSource {
  /** Every gallery seen so far, whether its row is live or released. */
  readonly count: number
  /** The live rows, which the Extended view draws. */
  readonly strip: ItemStrip
  gallery(index: number): ExtendedGallery | null
  /**
   * Drops the live rows once another view has drawn them, keeping each row's
   * markup: the source otherwise holds a second, heavier copy of every gallery.
   */
  release(): void
  /** Rebuilds released rows from their markup, in order, so the source can be shown again. */
  restore(): void
  collect(): void
  appendPage(page: Document): number
  dispose(): void
}

export function createExtendedSource(source: HTMLTableElement, onRows: () => void): ExtendedSource {
  const doc = source.ownerDocument
  const entries: Entry[] = []
  let strip: ItemStripWriter = createItemStrip()
  const known = new Set<string>()
  // Released rows leave the table, so a position in it says nothing about what was already collected
  const visited = new WeakSet<Element>()
  const parser = doc.createElement('template')
  let parsed = false
  let disposed = false

  /**
   * The parser keeps filling the detached source. Following siblings may belong
   * to other scripts, so the last row waits until document parsing is complete.
   */
  function sourceParsed(): boolean {
    if (!parsed && doc.readyState !== 'loading') parsed = true
    return parsed
  }

  function collect() {
    const candidates = outerRows(source)
    const limit = sourceParsed() ? candidates.length : candidates.length - 1
    for (let index = 0; index < limit; index++) {
      const row = candidates[index]
      if (visited.has(row)) continue
      visited.add(row)
      const key = galleryKey(row)
      if (!key || known.has(key)) continue
      captureGalleryTags(row)
      captureGalleryUploader(row)
      captureGalleryRating(row)
      known.add(key)
      entries.push({ gid: key.split('/')[0], row, html: null })
      strip.push(row)
    }
  }

  /** Built in the template's inert document, so its images load only once a copy reaches the page. */
  function parse(html: string): HTMLTableRowElement {
    parser.innerHTML = html
    const row = parser.content.firstElementChild as HTMLTableRowElement
    row.remove()
    return row
  }

  function section(): Element {
    for (let index = source.children.length - 1; index >= 0; index--) {
      const child = source.children[index]
      if (sectionTags[child.tagName]) return child
    }
    return source
  }

  const observer = new MutationObserver(() => {
    if (disposed) return
    watch()
    collect()
    onRows()
  })

  function watch() {
    observer.observe(source, { childList: true })
    for (const child of source.children) {
      if (sectionTags[child.tagName]) observer.observe(child, { childList: true })
    }
  }

  watch()
  collect()

  return {
    get count() {
      return entries.length
    },
    get strip() {
      return strip
    },
    gallery(index) {
      const entry = entries[index]
      if (!entry) return null
      const gallery = adaptExtendedGallery(entry.row ?? parse(entry.html!))
      if (!gallery) return null
      // Released rows have no siblings left, so the neighbours for the hover preload come from the order instead
      gallery.snapshot.previousGid = entries[index - 1]?.gid ?? '0'
      gallery.snapshot.nextGid = entries[index + 1]?.gid ?? '0'
      return gallery
    },
    release() {
      let released = false
      for (const entry of entries) {
        if (!entry.row) continue
        entry.html = entry.row.outerHTML
        entry.row.remove()
        entry.row = null
        released = true
      }
      // The strip would otherwise keep every released row alive
      if (released) strip = createItemStrip()
    },
    restore() {
      const rebuilt = doc.createDocumentFragment()
      let anchor: Element | null = null
      for (const entry of entries) {
        if (entry.row) {
          anchor ??= entry.row
          continue
        }
        const row = parse(entry.html!)
        visited.add(row)
        entry.row = row
        entry.html = null
        rebuilt.append(row)
      }
      if (!rebuilt.firstChild) return
      // Released rows are always the leading part: release takes every live row, and later rows arrive after it.
      // With none live, a row the parser is still filling is the one they go before
      anchor ??= outerRows(source).find(row => !visited.has(row)) ?? null
      if (anchor) anchor.before(rebuilt)
      else section().append(rebuilt)
      strip = createItemStrip()
      for (const entry of entries) strip.push(entry.row!)
    },
    collect,
    appendPage(page: Document): number {
      const table = page.querySelector(sourceSelector)
      if (!table) throw new Error('eh-view-refined: the response carries no Extended listing')
      const host = section()
      const incoming = new Set<string>()
      let added = 0
      for (const row of outerRows(table)) {
        const key = galleryKey(row)
        if (!key || known.has(key) || incoming.has(key)) continue
        incoming.add(key)
        host.append(row)
        added++
      }
      collect()
      return added
    },
    dispose() {
      disposed = true
      observer.disconnect()
    },
  }
}
