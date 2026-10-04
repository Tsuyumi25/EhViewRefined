import type { ExtendedGallery } from '../gallerySnapshot'
import { coverGeometry } from './coverGeometry'
import { cloneTag, copy } from './galleryCompatibility'
import { selectTagIndexes, type TagSelection } from './nativeTagSelection'

export function element(doc: Document, tag: string, className?: string): HTMLElement {
  const node = doc.createElement(tag)
  if (className) node.className = className
  return node
}

interface Cover {
  image: HTMLImageElement | null
  height: number
}

export function coverOf(gallery: ExtendedGallery): Cover {
  const { cover } = gallery.snapshot
  const source = gallery.bindings.cover
  if (!cover || !source) return { image: null, height: 0 }
  const image = copy(source)
  if (cover.deferredSource) {
    image.setAttribute('src', cover.deferredSource)
    image.removeAttribute('data-src')
  }
  const geometry = coverGeometry(cover.width, cover.height)
  if (geometry) {
    image.style.width = `${geometry.width}px`
    image.style.height = `${geometry.height}px`
    image.style.top = `${geometry.top}px`
  }
  return { image, height: geometry ? geometry.height : cover.sourceHeight }
}

export function categoryOf(gallery: ExtendedGallery, className: string): HTMLElement | null {
  const source = gallery.bindings.category
  if (!source) return null
  const clone = copy(source)
  const tone = gallery.snapshot.categoryTone
  clone.className = tone ? `${className} ${tone}` : className
  return clone
}

export function postedOf(gallery: ExtendedGallery, id: string): HTMLElement | null {
  const source = gallery.bindings.posted
  if (!source) return null
  const clone = copy(source)
  clone.id = id
  return clone
}

export function downloadOf(doc: Document, gallery: ExtendedGallery): HTMLElement {
  const source = gallery.bindings.download
  return source ? copy(source) : element(doc, 'div', 'gldown')
}

export function tagsOf(gallery: ExtendedGallery, selection: TagSelection, className?: string): HTMLElement[] {
  const { tags } = gallery.snapshot
  return selectTagIndexes(tags, selection).map(index => {
    const clone = cloneTag(gallery.bindings.tags[index], tags[index].text)
    if (className !== undefined) clone.className = className
    return clone
  })
}

export function titleOf(doc: Document, gallery: ExtendedGallery, className: string): HTMLElement {
  const link = element(doc, 'a')
  link.setAttribute('href', gallery.snapshot.href)
  const title = copy(gallery.bindings.title)
  title.className = className
  link.append(title)
  return link
}
