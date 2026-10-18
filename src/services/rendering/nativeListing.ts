import type { ExtendedGallery } from '../gallerySnapshot'
import type { NativeView } from '../listingModes'
import { insertItems } from './galleryCompatibility'
import { createItemStrip, type ItemStrip } from './itemStrip'
import { nativeLayouts } from './nativeLayouts'
import { installTagAreaStyles, type TagOptions } from './tagArea'

export interface NativeListing {
  /** The listing root the site's own stylesheet and scripts expect. */
  readonly element: HTMLElement
  readonly strip: ItemStrip
  /** Draws the galleries not drawn yet and inserts them in one go; returns how many were new. */
  append(galleries: readonly ExtendedGallery[]): number
}

export function createNativeListing(doc: Document, view: NativeView, tagOptions: TagOptions): NativeListing {
  const layout = nativeLayouts[view]
  layout.initialize?.(doc)
  installTagAreaStyles(doc)
  const root = doc.createElement(layout.root.tag)
  root.className = layout.root.className
  root.setAttribute('data-evr-view', view)
  const container = layout.createContainer?.(root) ?? root
  const seen = new Set<string>()
  const strip = createItemStrip()

  function render(gallery: ExtendedGallery): HTMLElement {
    const { snapshot } = gallery
    const item = layout.renderItem(doc, gallery, tagOptions)
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
    return item.node
  }

  return {
    element: root,
    strip,
    append(galleries) {
      const nodes: HTMLElement[] = []
      for (const gallery of galleries) {
        if (seen.has(gallery.snapshot.gid)) continue
        seen.add(gallery.snapshot.gid)
        nodes.push(render(gallery))
      }
      if (!nodes.length) return 0
      // Parked before they arrive, so a batch landing under a hidden tail is never drawn for a frame
      for (const node of nodes) strip.push(node)
      insertItems(container, nodes)
      return nodes.length
    },
  }
}
