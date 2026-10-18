import type { ItemStrip } from './rendering/itemStrip'
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

interface ActiveListing {
  view: NativeView
  native: NativeListing
  fed: number
}

/**
 * Only the view on screen holds nodes: once it has drawn a gallery the source
 * row is released to markup, and a view switched away from is dropped and
 * built again from that markup when it returns.
 */
export function createListingPipeline(source: HTMLTableElement): ListingPipeline {
  const doc = source.ownerDocument
  const host = createListingHost(source)
  let active: ActiveListing | null = null
  let disposed = false
  const input = createExtendedSource(source, publish)
  const listeners = new Set<() => void>()

  function notify() {
    for (const listener of listeners) listener()
  }

  function feed(listing: ActiveListing) {
    while (listing.fed < input.count) {
      const gallery = input.gallery(listing.fed++)
      if (gallery) listing.native.append(gallery)
    }
    input.release()
  }

  function publish() {
    if (active) feed(active)
    notify()
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
      return active ? active.native.strip : input.strip
    },
    flush,
    setView(next) {
      if (disposed) return
      const previous = host.element
      if (next === 'e') {
        input.restore()
        active = null
        host.mount(source, next)
        syncSelection(previous, source)
        notify()
        return
      }
      if (active?.view !== next) active = { view: next, native: createNativeListing(doc, next), fed: 0 }
      host.mount(active.native.element, next)
      feed(active)
      syncSelection(previous, active.native.element)
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
      const strip = active ? active.native.strip : input.strip
      strip.setRange(0, strip.count)
    },
    dispose() {
      if (disposed) return
      disposed = true
      listeners.clear()
      const shown = host.element
      input.restore()
      input.dispose()
      doc.removeEventListener('DOMContentLoaded', flush)
      syncSelection(shown, source)
      host.dispose()
    },
  }
}
