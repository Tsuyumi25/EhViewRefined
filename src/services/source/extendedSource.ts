import { captureGalleryTags, galleryKey, outerRows, sourceSelector } from './extendedAdapter'

const sectionTags: Record<string, true> = { TBODY: true, THEAD: true, TFOOT: true }

export function createExtendedSource(source: HTMLTableElement, onRows: () => void) {
  const doc = source.ownerDocument
  const rows: HTMLTableRowElement[] = []
  const known = new Set<string>()
  let scanned = 0
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
    while (scanned < limit) {
      const row = candidates[scanned++]
      const key = galleryKey(row)
      if (!key || known.has(key)) continue
      captureGalleryTags(row)
      known.add(key)
      rows.push(row)
    }
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
    rows: rows as readonly HTMLTableRowElement[],
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
