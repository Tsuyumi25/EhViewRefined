import type { ExtendedGallery } from '../gallerySnapshot'
import type { NativeView } from '../listingModes'
import { appendTranslatedItem } from './galleryCompatibility'
import { createItemStrip, type ItemStrip } from './itemStrip'
import { nativeLayouts } from './nativeLayouts'

export interface NativeListing {
  /** The listing root the site's own stylesheet and scripts expect. */
  readonly element: HTMLElement
  readonly strip: ItemStrip
  append(gallery: ExtendedGallery): boolean
}

export function createNativeListing(doc: Document, view: NativeView): NativeListing {
  const layout = nativeLayouts[view]
  layout.initialize?.(doc)
  const root = doc.createElement(layout.root.tag)
  root.className = layout.root.className
  root.setAttribute('data-evr-view', view)
  const container = layout.createContainer?.(root) ?? root
  const seen = new Set<string>()
  const strip = createItemStrip()

  return {
    element: root,
    strip,
    append(gallery: ExtendedGallery): boolean {
      const { snapshot } = gallery
      if (seen.has(snapshot.gid)) return false
      seen.add(snapshot.gid)

      const item = layout.renderItem(doc, gallery)
      item.node.setAttribute('data-evr-tags', snapshot.tagData)
      if (snapshot.uploader !== null) item.node.setAttribute('data-evr-uploader', snapshot.uploader)
      if (snapshot.rating !== null) item.node.setAttribute('data-evr-rating', String(snapshot.rating))
      if (snapshot.myRating !== null) item.node.setAttribute('data-evr-my-rating', String(snapshot.myRating))
      if (item.hover) {
        item.hover.setAttribute(
          'onmouseover',
          `show_image_pane(${snapshot.gid});preload_pane_image(${snapshot.previousGid},${snapshot.nextGid})`,
        )
        item.hover.setAttribute('onmouseout', 'hide_image_pane()')
      }
      appendTranslatedItem(container, item.node)
      strip.push(item.node)
      return true
    },
  }
}
