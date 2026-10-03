import { t } from '@/composables/useI18n'
import { createNativeListing, type NativeLabels, type NativeView } from './nativeListing'
import { galleryTagData } from './galleryTags'

export const listViews = ['m', 'p', 'l', 'e', 't'] as const

export type ListView = (typeof listViews)[number]

export interface ExtendedView {
  /** The node currently standing in the listing's place. */
  readonly element: HTMLElement
  setView(view: ListView): void
  /** Converts every source row the parser has finished, synchronously. */
  flush(): void
  appendPage(doc: Document): number
  dispose(): void
}

export const sourceSelector = 'table.itg.glte'

const sectionTags: Record<string, true> = { TBODY: true, THEAD: true, TFOOT: true }

interface Listing {
  root: HTMLElement
  append(row: HTMLTableRowElement): boolean
  fed: number
}

/** Gallery rows carry tables of their own, so only direct children count. */
function outerRows(table: Element): HTMLTableRowElement[] {
  const rows: HTMLTableRowElement[] = []
  for (const child of table.children) {
    if (child.tagName === 'TR') rows.push(child as HTMLTableRowElement)
    else if (sectionTags[child.tagName]) {
      for (const row of child.children) {
        if (row.tagName === 'TR') rows.push(row as HTMLTableRowElement)
      }
    }
  }
  return rows
}

function galleryKey(row: Element): string | null {
  const link = row.querySelector('a[href*="/g/"]')
  const match = /\/g\/(\d+)\/([^/?#]+)/.exec(link?.getAttribute('href') ?? '')
  return match ? `${match[1]}/${match[2]}` : null
}

function syncSelection(from: HTMLElement, to: HTMLElement) {
  if (from === to) return
  const states = new Map<string, boolean>()
  const key = (input: HTMLInputElement) => input.id || `${input.name}:${input.value}`
  for (const input of from.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    states.set(key(input), input.checked)
  }
  for (const input of to.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    const checked = states.get(key(input))
    if (checked !== undefined) input.checked = checked
  }
}

export function createExtendedView(source: HTMLTableElement): ExtendedView {
  const doc = source.ownerDocument
  const wrapper = source.closest<HTMLElement>('.ido')
  const originalWidth = wrapper?.style.getPropertyValue('max-width') ?? ''
  const originalWidthPriority = wrapper?.style.getPropertyPriority('max-width') ?? ''
  const start = doc.createComment('evr')
  source.before(start)

  const canonical: HTMLTableRowElement[] = []
  const known = new Set<string>()
  const listings = new Map<NativeView, Listing>()
  let view: ListView = 'e'
  let mounted: HTMLElement = source
  let scanned = 0
  let parsed = false
  let disposed = false

  function restoreWidth() {
    if (!wrapper || wrapper.style.maxWidth !== '1370px') return
    if (originalWidth) wrapper.style.setProperty('max-width', originalWidth, originalWidthPriority)
    else wrapper.style.removeProperty('max-width')
  }

  /**
   * The parser keeps filling the detached source. Following siblings may belong
   * to other scripts, so the last row waits until document parsing is complete.
   */
  function sourceParsed(): boolean {
    if (!parsed && doc.readyState !== 'loading') parsed = true
    return parsed
  }

  function collect() {
    const rows = outerRows(source)
    const limit = sourceParsed() ? rows.length : rows.length - 1
    while (scanned < limit) {
      const row = rows[scanned++]
      const key = galleryKey(row)
      if (!key || known.has(key)) continue
      galleryTagData(row)
      known.add(key)
      canonical.push(row)
    }
  }

  function feed(listing: Listing) {
    while (listing.fed < canonical.length) listing.append(canonical[listing.fed++])
  }

  function publish() {
    const listing = view === 'e' ? undefined : listings.get(view)
    if (listing) feed(listing)
  }

  function open(next: NativeView): Listing {
    const labels: NativeLabels | undefined =
      next === 't'
        ? undefined
        : {
            published: t('columns.published'),
            title: t('columns.title'),
            uploader: t('columns.uploader'),
          }
    const native = createNativeListing(source, next, labels)
    const listing: Listing = { root: native.element, append: native.append, fed: 0 }
    listings.set(next, listing)
    return listing
  }

  function mount(node: HTMLElement) {
    if (node === mounted && node.parentNode) return
    if (mounted !== node && mounted.parentNode) mounted.replaceWith(node)
    else if (start.parentNode) start.after(node)
    mounted = node
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
    publish()
  })

  function watch() {
    observer.observe(source, { childList: true })
    for (const child of source.children) {
      if (sectionTags[child.tagName]) observer.observe(child, { childList: true })
    }
  }

  function flush() {
    if (disposed) return
    collect()
    publish()
  }

  watch()
  collect()
  doc.addEventListener('DOMContentLoaded', flush)

  return {
    get element() {
      return mounted
    },
    flush,
    setView(next) {
      if (disposed) return
      syncSelection(mounted, source)
      view = next
      if (next === 't' && wrapper) wrapper.style.setProperty('max-width', '1370px')
      else restoreWidth()
      if (next === 'e') {
        mount(source)
        return
      }
      const listing = listings.get(next) ?? open(next)
      mount(listing.root)
      feed(listing)
      syncSelection(source, listing.root)
    },
    appendPage(page) {
      if (disposed) return 0
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
      publish()
      return added
    },
    dispose() {
      if (disposed) return
      disposed = true
      observer.disconnect()
      doc.removeEventListener('DOMContentLoaded', flush)
      syncSelection(mounted, source)
      restoreWidth()
      mount(source)
      start.remove()
    },
  }
}
