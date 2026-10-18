import type { ItemStrip } from './rendering/itemStrip'
import { adaptExtendedGallery } from './source/extendedAdapter'
import { createExtendedSource } from './source/extendedSource'
import { createListingHost, syncSelection } from './rendering/galleryCompatibility'
import { createNativeListing, type NativeListing } from './rendering/nativeListing'
import type { ListView, NativeView } from './listingModes'

export interface ListingPipeline {
  readonly element: HTMLElement
  /** The galleries of the listing on screen, whichever view it is. */
  readonly strip: ItemStrip
  setView(view: ListView): void
  flush(): void
  appendPage(doc: Document): number
  /** Called after the listing on screen gained items or was swapped for another view. */
  watch(listener: () => void): () => void
  revealAll(): void
  dispose(): void
}

interface CachedListing {
  native: NativeListing
  fed: number
}

export function createListingPipeline(source: HTMLTableElement): ListingPipeline {
  const doc = source.ownerDocument
  const host = createListingHost(source)
  const listings = new Map<NativeView, CachedListing>()
  let view: ListView = 'e'
  let disposed = false
  const input = createExtendedSource(source, publish)
  const listeners = new Set<() => void>()

  function notify() {
    for (const listener of listeners) listener()
  }

  function feed(listing: CachedListing) {
    while (listing.fed < input.rows.length) {
      const gallery = adaptExtendedGallery(input.rows[listing.fed++])
      if (gallery) listing.native.append(gallery)
    }
  }

  function publish() {
    const listing = view === 'e' ? undefined : listings.get(view)
    if (listing) feed(listing)
    notify()
  }

  function open(next: NativeView): CachedListing {
    const native = createNativeListing(doc, next)
    const listing = { native, fed: 0 }
    listings.set(next, listing)
    return listing
  }

  function flush() {
    if (disposed) return
    input.collect()
    publish()
  }

  doc.addEventListener('DOMContentLoaded', flush)

  return {
    get element() {
      return host.element
    },
    get strip() {
      return view === 'e' ? input.strip : listings.get(view)!.native.strip
    },
    flush,
    setView(next) {
      if (disposed) return
      syncSelection(host.element, source)
      view = next
      if (next === 'e') {
        host.mount(source, next)
        notify()
        return
      }
      const listing = listings.get(next) ?? open(next)
      host.mount(listing.native.element, next)
      feed(listing)
      syncSelection(source, listing.native.element)
      notify()
    },
    appendPage(page) {
      if (disposed) return 0
      const added = input.appendPage(page)
      publish()
      return added
    },
    watch(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    revealAll() {
      input.strip.setRange(0, input.strip.count)
      for (const { native } of listings.values()) native.strip.setRange(0, native.strip.count)
    },
    dispose() {
      if (disposed) return
      disposed = true
      listeners.clear()
      input.dispose()
      doc.removeEventListener('DOMContentLoaded', flush)
      syncSelection(host.element, source)
      host.dispose()
    },
  }
}
