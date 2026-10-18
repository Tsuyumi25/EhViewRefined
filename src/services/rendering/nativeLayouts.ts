import type { ExtendedGallery } from '../gallerySnapshot'
import type { NativeView } from '../listingModes'
import type { TagOptions } from './tagArea'
import { compactLayout, minimalLayout, minimalPlusLayout } from './tableLayout'
import { thumbnailLayout } from './thumbnailLayout'

export interface NativeItem {
  node: HTMLElement
  hover: HTMLElement | null
}

export interface NativeLayout {
  root: { tag: 'table' | 'div'; className: string }
  initialize?: (doc: Document) => void
  createContainer?: (root: HTMLElement) => HTMLElement
  renderItem: (doc: Document, gallery: ExtendedGallery, tags: TagOptions) => NativeItem
}

export const nativeLayouts: Record<NativeView, NativeLayout> = {
  m: minimalLayout,
  p: minimalPlusLayout,
  l: compactLayout,
  t: thumbnailLayout,
}
