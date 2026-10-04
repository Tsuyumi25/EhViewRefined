import type { ExtendedGallery } from '../gallerySnapshot'
import { copy } from './galleryCompatibility'
import { categoryOf, coverOf, downloadOf, element, postedOf, tagsOf, titleOf } from './galleryFragments'
import type { NativeItem, NativeLayout } from './nativeLayouts'

/** Extended responses omit the native Thumbnail page's inline grid rules. */
function installNativeThumbnailStyles(doc: Document): void {
  if (doc.getElementById('evr-native-thumbnail-style')) return
  const style = doc.createElement('style')
  style.id = 'evr-native-thumbnail-style'
  style.textContent = `
@supports (display: grid) {
  .gld { display: grid; grid-template-columns: repeat(5, 1fr); }
  .gl1t { min-width: 250px; max-width: 400px; }
  @media screen and (max-width: 1360px) { .gld { grid-template-columns: repeat(4, 1fr); } }
  @media screen and (max-width: 1090px) { .gld { grid-template-columns: repeat(3, 1fr); } }
  @media screen and (max-width: 820px) { .gld { grid-template-columns: repeat(2, 1fr); } }
}`
  ;(doc.head ?? doc.documentElement).append(style)
}

function favouritePanel(doc: Document, gallery: ExtendedGallery): HTMLElement | null {
  const { favorited, selection } = gallery.bindings
  if (!favorited && !selection) return null
  const holder = element(doc, 'div', 'glft')
  const date = element(doc, 'div')
  if (favorited) date.append(...copy(favorited).childNodes)
  const select = element(doc, 'div')
  if (selection) select.append(...copy(selection).childNodes)
  holder.append(date, select)
  return holder
}

function thumbnailItem(doc: Document, gallery: ExtendedGallery): NativeItem {
  const { snapshot, bindings } = gallery
  const card = element(doc, 'div', 'gl1t')
  if (snapshot.fresh !== null) card.setAttribute('data-new', snapshot.fresh)
  card.append(titleOf(doc, gallery, 'gl4t glname glink'))

  const frame = element(doc, 'div', 'gl3t')
  if (snapshot.frameStyle) frame.setAttribute('style', snapshot.frameStyle)
  const link = element(doc, 'a')
  link.setAttribute('href', snapshot.href)
  const cover = coverOf(gallery)
  if (cover.image) {
    link.append(cover.image)
    if (cover.height > 0) {
      frame.style.width = '250px'
      frame.style.height = `${Math.min(340, cover.height)}px`
    }
  }
  frame.append(link)
  card.append(frame)

  const tags = element(doc, 'div', 'gl6t')
  tags.append(...tagsOf(gallery, 'all'))
  card.append(tags)

  const footer = element(doc, 'div', 'gl5t')
  const left = element(doc, 'div')
  const category = categoryOf(gallery, 'cs')
  if (category) left.append(category)
  const posted = postedOf(gallery, `posted_${snapshot.gid}`)
  if (posted) left.append(posted)
  const right = element(doc, 'div')
  if (bindings.rating) right.append(copy(bindings.rating))
  right.append(bindings.pages ? copy(bindings.pages) : element(doc, 'div'))
  right.append(downloadOf(doc, gallery))
  footer.append(left, right)
  card.append(footer)

  const favourite = favouritePanel(doc, gallery)
  if (favourite) card.append(favourite)
  if (bindings.note) card.append(copy(bindings.note))
  return { node: card, hover: null }
}

export const thumbnailLayout: NativeLayout = {
  root: { tag: 'div', className: 'itg gld' },
  initialize: installNativeThumbnailStyles,
  renderItem: thumbnailItem,
}
