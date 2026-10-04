import type { ExtendedGallery, GalleryBindings, GalleryTagSnapshot } from '../gallerySnapshot'

export const sourceSelector = 'table.itg.glte'

interface GalleryTagMetadata {
  name: string
  borderStyle: 'solid' | 'dashed' | 'dotted'
}

const GALLERY_PATH = /\/g\/(\d+)\/[^/?#]+/
const GALLERY_KEY = /\/g\/(\d+)\/([^/?#]+)/
const CATEGORY_TONE = /^ct[0-9a-f]+$/
const TAG_DATA = 'data-evr-tags'
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
    borderStyle: tag.classList.contains('gtw')
      ? 'dotted'
      : tag.classList.contains('gtl') ? 'dashed' : 'solid',
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
      previousGid: GALLERY_PATH.exec(galleryHref(row.previousElementSibling))?.[1] ?? '0',
      nextGid: GALLERY_PATH.exec(galleryHref(row.nextElementSibling))?.[1] ?? '0',
    },
    bindings,
  }
}
