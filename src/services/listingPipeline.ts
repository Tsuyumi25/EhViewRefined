import { adaptExtendedGallery } from './source/extendedAdapter'
import { createExtendedSource } from './source/extendedSource'
import { createListingHost, syncSelection } from './rendering/galleryCompatibility'
import { createNativeListing, type NativeListing } from './rendering/nativeListing'
import type { ListView, NativeView } from './listingModes'

export interface ListingPipeline {
  readonly element: HTMLElement
  setView(view: ListView): void
  flush(): void
  appendPage(doc: Document): number
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

  function feed(listing: CachedListing) {
    while (listing.fed < input.rows.length) {
      const gallery = adaptExtendedGallery(input.rows[listing.fed++])
      if (gallery) listing.native.append(gallery)
    }
  }

  function publish() {
    const listing = view === 'e' ? undefined : listings.get(view)
    if (listing) feed(listing)
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
    flush,
    setView(next) {
      if (disposed) return
      syncSelection(host.element, source)
      view = next
      if (next === 'e') {
        host.mount(source, next)
        return
      }
      const listing = listings.get(next) ?? open(next)
      host.mount(listing.native.element, next)
      feed(listing)
      syncSelection(source, listing.native.element)
    },
    appendPage(page) {
      if (disposed) return 0
      const added = input.appendPage(page)
      publish()
      return added
    },
    dispose() {
      if (disposed) return
      disposed = true
      input.dispose()
      doc.removeEventListener('DOMContentLoaded', flush)
      syncSelection(host.element, source)
      host.dispose()
    },
  }
}
