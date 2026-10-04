/**
 * Source nodes the output reuses verbatim; cloning them keeps nested markup and
 * attributes other scripts rely on.
 */
export interface GalleryBindings {
  cover: HTMLImageElement | null
  category: HTMLElement | null
  posted: HTMLElement | null
  rating: HTMLElement | null
  uploader: HTMLElement | null
  pages: HTMLElement | null
  download: HTMLElement | null
  favorited: HTMLElement | null
  note: HTMLElement | null
  selection: HTMLElement | null
  title: HTMLElement
  tags: HTMLElement[]
}

export interface GalleryCoverSnapshot {
  width: number
  height: number
  /** Declared height of the source image, used when the ratio is unknown. */
  sourceHeight: number
  deferredSource: string | null
}

export interface GalleryTagSnapshot {
  text: string | null
  styled: boolean
}

export interface GallerySnapshot {
  gid: string
  href: string
  fresh: string | null
  categoryTone: string | null
  /** Null when the source carries no cover image; the frame can still exist. */
  cover: GalleryCoverSnapshot | null
  frameHeight: number
  frameStyle: string | null
  /** Aligned by index to the tag bindings. */
  tags: readonly GalleryTagSnapshot[]
  tagData: string
  previousGid: string
  nextGid: string
}

export interface ExtendedGallery {
  snapshot: GallerySnapshot
  bindings: GalleryBindings
}
