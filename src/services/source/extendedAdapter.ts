import type { ExtendedGallery, GalleryBindings, GalleryTagSnapshot } from '../gallerySnapshot'

export const sourceSelector = 'table.itg.glte'

/**
 * The site's own class for how settled a tag is, passed on as is: gt is confirmed,
 * gtl has many votes but is not confirmed, gtw carries little weight. Naming the
 * level instead of how the site draws it keeps the value true if the drawing changes.
 */
type TagTier = 'gt' | 'gtl' | 'gtw'

interface GalleryTagMetadata {
  name: string
  tier: TagTier
}

const GALLERY_PATH = /\/g\/(\d+)\/[^/?#]+/
const GALLERY_KEY = /\/g\/(\d+)\/([^/?#]+)/
const CATEGORY_TONE = /^ct[0-9a-f]+$/
const TAG_DATA = 'data-evr-tags'
const UPLOADER_DATA = 'data-evr-uploader'
const UPLOADER_PATH = /\/uploader\/([^/?#]+)/
const RATING_DATA = 'data-evr-rating'
const MY_RATING_DATA = 'data-evr-my-rating'
/** The star sprite switches to these colours once the user has rated the gallery; it then shows their own rating */
const MY_RATING_MARKS = ['irr', 'irg', 'irb']
const sectionTags: Record<string, true> = { TBODY: true, THEAD: true, TFOOT: true }

/** Gallery rows carry tables of their own, so only direct children count. */
export function outerRows(table: Element): HTMLTableRowElement[] {
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

export function galleryKey(row: Element): string | null {
  const link = row.querySelector('a[href*="/g/"]')
  const match = GALLERY_KEY.exec(link?.getAttribute('href') ?? '')
  return match ? `${match[1]}/${match[2]}` : null
}

function tagMetadata(tags: ArrayLike<HTMLElement>): string {
  return JSON.stringify(Array.from(tags, (tag): GalleryTagMetadata => ({
    name: tag.title,
    tier: tag.classList.contains('gtw') ? 'gtw' : tag.classList.contains('gtl') ? 'gtl' : 'gt',
  })))
}

/** Caches the public metadata on the row before translation scripts rewrite the tags. */
export function captureGalleryTags(row: HTMLTableRowElement): string {
  const cached = row.getAttribute(TAG_DATA)
  if (cached !== null) return cached
  const data = tagMetadata(row.querySelectorAll<HTMLElement>('.gl4e .gt, .gl4e .gtl, .gl4e .gtw'))
  row.setAttribute(TAG_DATA, data)
  return data
}

/**
 * The name comes from the uploader link, the site's own target for that user.
 * Rows without that link get no attribute.
 */
export function captureGalleryUploader(row: HTMLTableRowElement): string | null {
  const cached = row.getAttribute(UPLOADER_DATA)
  if (cached !== null) return cached
  const encoded = UPLOADER_PATH.exec(row.querySelector('.gl3e a[href*="/uploader/"]')?.getAttribute('href') ?? '')?.[1]
  if (!encoded) return null
  let name: string
  try {
    // The site form-encodes the path, so spaces arrive as "+"
    name = decodeURIComponent(encoded.replace(/\+/g, ' '))
  } catch {
    return null
  }
  row.setAttribute(UPLOADER_DATA, name)
  return name
}

export interface GalleryRating {
  /** The site's average, in the half-star steps the listing shows; null when the stars show the user's own rating */
  rating: number | null
  /** The user's own rating when they have rated the gallery */
  myRating: number | null
}

/**
 * The stars are one sprite: each step of -16px across removes a star and the row
 * at -21px down is the half-star row, so the precision is 0.5.
 */
function starsOf(stars: Element): number | null {
  const [x, y] = Array.from((stars.getAttribute('style') ?? '').matchAll(/(-?\d+)px/g), match => Math.abs(Number(match[1])))
  if (x === undefined || y === undefined) return null
  const value = 5 - x / 16 - (y === 21 ? 0.5 : 0)
  return value >= 0 && value <= 5 ? value : null
}

export function captureGalleryRating(row: HTMLTableRowElement): GalleryRating {
  const cachedRating = row.getAttribute(RATING_DATA)
  const cachedMine = row.getAttribute(MY_RATING_DATA)
  if (cachedRating !== null || cachedMine !== null) {
    return { rating: cachedRating === null ? null : Number(cachedRating), myRating: cachedMine === null ? null : Number(cachedMine) }
  }
  const stars = row.querySelector('.gl3e .ir')
  const value = stars ? starsOf(stars) : null
  if (value === null) return { rating: null, myRating: null }
  const mine = MY_RATING_MARKS.some(mark => stars!.classList.contains(mark))
  row.setAttribute(mine ? MY_RATING_DATA : RATING_DATA, String(value))
  return mine ? { rating: null, myRating: value } : { rating: value, myRating: null }
}

function childByClass(parent: Element | null, name: string): HTMLElement | null {
  if (!parent) return null
  for (const child of parent.children) {
    if (child.classList.contains(name)) return child as HTMLElement
  }
  return null
}

function galleryHref(scope: Element | null): string {
  if (!scope) return ''
  for (const link of scope.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') ?? ''
    if (GALLERY_PATH.test(href)) return href
  }
  return ''
}

function pixels(el: Element | null, property: string): number {
  if (!el) return 0
  for (const declaration of (el.getAttribute('style') ?? '').split(';')) {
    const colon = declaration.indexOf(':')
    if (colon < 0) continue
    if (declaration.slice(0, colon).trim() !== property) continue
    return Math.round(Number.parseFloat(declaration.slice(colon + 1)) || 0)
  }
  return 0
}

export function adaptExtendedGallery(row: HTMLTableRowElement): ExtendedGallery | null {
  const coverCell = childByClass(row, 'gl1e')
  const body = childByClass(row, 'gl2e')
  if (!body) return null

  const name = body.querySelector<HTMLElement>('.gl4e')
  const title = name?.querySelector<HTMLElement>('.glink')
  const href = galleryHref(body) || galleryHref(coverCell)
  const gid = GALLERY_PATH.exec(href)?.[1] ?? ''
  if (!gid || !name || !title) return null

  const meta = body.querySelector<HTMLElement>('.gl3e')
  const slots = meta ? (Array.from(meta.children) as HTMLElement[]) : []
  const category = slots.find(slot => ['cn', 'cs', 'cw'].some(mark => slot.classList.contains(mark))) ?? null
  const posted = slots.find(slot => slot.id.startsWith('posted_')) ?? null
  const rating = slots.find(slot => slot.classList.contains('ir')) ?? null
  const download = slots.find(slot => slot.classList.contains('gldown')) ?? null

  const named = [category, posted, rating, download]
  const downloadAt = download ? slots.indexOf(download) : slots.length
  const rest = slots.filter(slot => !named.includes(slot))
  const before = rest.filter(slot => slots.indexOf(slot) < downloadAt)
  const uploader = before.find(slot => slot.querySelector('a[href*="/uploader/"]')) ?? before[0] ?? null
  const pages = before.find(slot => slot !== uploader) ?? null

  let selection: HTMLElement | null = childByClass(row, 'glfe')
  if (!selection) {
    for (const cell of row.children) {
      if (cell === coverCell || cell === body) continue
      if (cell.querySelector('input')) selection = cell as HTMLElement
    }
  }

  const frame = coverCell?.querySelector<HTMLElement>('div') ?? null
  const cover = coverCell?.querySelector<HTMLImageElement>('img') ?? null
  const tags = Array.from(name.querySelectorAll<HTMLElement>('.gt, .gtl, .gtw'))

  const tagData = captureGalleryTags(row)
  const uploaderName = captureGalleryUploader(row)
  const { rating: averageRating, myRating } = captureGalleryRating(row)

  const bindings: GalleryBindings = {
    cover,
    category,
    posted,
    rating,
    uploader,
    pages,
    download,
    favorited: rest.find(slot => slots.indexOf(slot) > downloadAt) ?? null,
    note: row.querySelector<HTMLElement>('.glfnote'),
    selection,
    title,
    tags,
  }

  return {
    snapshot: {
      gid,
      href,
      fresh: row.getAttribute('data-new'),
      categoryTone: category
        ? Array.from(category.classList).find(mark => CATEGORY_TONE.test(mark)) ?? null
        : null,
      cover: cover
        ? {
            width: cover.naturalWidth || pixels(cover, 'width') || Number(cover.getAttribute('width')),
            height: cover.naturalHeight || pixels(cover, 'height') || Number(cover.getAttribute('height')),
            sourceHeight: pixels(cover, 'height'),
            deferredSource: cover.getAttribute('data-src'),
          }
        : null,
      frameHeight: pixels(frame, 'height'),
      frameStyle: frame?.getAttribute('style') ?? null,
      tags: tags.map((tag): GalleryTagSnapshot => ({
        text: tag.getAttribute('ehs-tag') ?? tag.textContent,
        styled: (tag.getAttribute('style') ?? '') !== '',
      })),
      tagData,
      uploader: uploaderName,
      rating: averageRating,
      myRating,
      previousGid: GALLERY_PATH.exec(galleryHref(row.previousElementSibling))?.[1] ?? '0',
      nextGid: GALLERY_PATH.exec(galleryHref(row.nextElementSibling))?.[1] ?? '0',
    },
    bindings,
  }
}
