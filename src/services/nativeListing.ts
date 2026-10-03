import { coverGeometry } from './coverGeometry'
import { installNativeThumbnailStyles } from './nativeThumbnailStyles'
import { galleryTagData } from './galleryTags'

export type NativeView = 'm' | 'p' | 'l' | 't'

export interface NativeLabels {
  published: string
  title: string
  uploader: string
}

export interface NativeListing {
  /** The listing root the site's own stylesheet and scripts expect. */
  readonly element: HTMLElement
  append(row: HTMLTableRowElement): boolean
}

const GALLERY_PATH = /\/g\/(\d+)\/[^/?#]+/
const CATEGORY_TONE = /^ct[0-9a-f]+$/
const TAG_LIMIT = 12
const PANE_FOOTER = 46

interface SourceRow {
  gid: string
  href: string
  frame: HTMLElement | null
  cover: HTMLImageElement | null
  category: HTMLElement | null
  posted: HTMLElement | null
  rating: HTMLElement | null
  uploader: HTMLElement | null
  pages: HTMLElement | null
  download: HTMLElement | null
  favorited: HTMLElement | null
  title: HTMLElement
  tags: HTMLElement[]
  note: HTMLElement | null
  selection: HTMLElement | null
  fresh: string | null
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

function parseGalleryRow(row: HTMLTableRowElement): SourceRow | null {
  const cover = childByClass(row, 'gl1e')
  const body = childByClass(row, 'gl2e')
  if (!body) return null

  const name = body.querySelector<HTMLElement>('.gl4e')
  const title = name?.querySelector<HTMLElement>('.glink')
  const href = galleryHref(body) || galleryHref(cover)
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
      if (cell === cover || cell === body) continue
      if (cell.querySelector('input')) selection = cell as HTMLElement
    }
  }

  return {
    gid,
    href,
    frame: cover?.querySelector<HTMLElement>('div') ?? null,
    cover: cover?.querySelector<HTMLImageElement>('img') ?? null,
    category,
    posted,
    rating,
    uploader,
    pages,
    download,
    favorited: rest.find(slot => slots.indexOf(slot) > downloadAt) ?? null,
    title,
    tags: Array.from(name.querySelectorAll<HTMLElement>('.gt, .gtl, .gtw')),
    note: row.querySelector<HTMLElement>('.glfnote'),
    selection,
    fresh: row.getAttribute('data-new'),
  }
}

function copy<T extends Element>(node: T): T {
  const clone = node.cloneNode(true) as T
  const sources = node.querySelectorAll('input, select, textarea')
  const clones = clone.querySelectorAll('input, select, textarea')
  for (let index = 0; index < sources.length; index++) {
    pair(sources[index] as HTMLInputElement, clones[index] as HTMLInputElement)
  }
  return clone
}

function coverOf(parts: SourceRow): HTMLImageElement | null {
  if (!parts.cover) return null
  const image = copy(parts.cover)
  const deferred = image.getAttribute('data-src')
  if (deferred) {
    image.setAttribute('src', deferred)
    image.removeAttribute('data-src')
  }
  const width = parts.cover.naturalWidth || pixels(parts.cover, 'width') || Number(parts.cover.getAttribute('width'))
  const height = parts.cover.naturalHeight || pixels(parts.cover, 'height') || Number(parts.cover.getAttribute('height'))
  const geometry = coverGeometry(width, height)
  if (geometry) {
    image.style.width = `${geometry.width}px`
    image.style.height = `${geometry.height}px`
    image.style.top = `${geometry.top}px`
  }
  return image
}

// 勾選狀態只活在 source 的 property 上，換檢視時重建的節點得接回同一份狀態
function pair(origin: HTMLInputElement, clone: HTMLInputElement) {
  clone.checked = origin.checked
  clone.value = origin.value
  clone.addEventListener('change', () => {
    origin.checked = clone.checked
    origin.value = clone.value
  })
}

function element(doc: Document, tag: string, className?: string): HTMLElement {
  const node = doc.createElement(tag)
  if (className) node.className = className
  return node
}

function categoryOf(parts: SourceRow, shape: 'cs' | 'cn'): HTMLElement | null {
  if (!parts.category) return null
  const clone = copy(parts.category)
  const tone = Array.from(parts.category.classList).find(name => CATEGORY_TONE.test(name))
  clone.className = tone ? `${shape} ${tone}` : shape
  return clone
}

function postedOf(parts: SourceRow, id: string): HTMLElement | null {
  if (!parts.posted) return null
  const clone = copy(parts.posted)
  clone.id = id
  return clone
}

function downloadOf(doc: Document, parts: SourceRow): HTMLElement {
  return parts.download ? copy(parts.download) : element(doc, 'div', 'gldown')
}

function tagsOf(parts: SourceRow, view: NativeView): HTMLElement[] {
  if (view === 'm') return []
  let picked = parts.tags
  if (view !== 't') {
    const styled = parts.tags.filter(tag => (tag.getAttribute('style') ?? '') !== '')
    picked = (view === 'l' ? [...styled, ...parts.tags.filter(tag => !styled.includes(tag))] : styled)
      .slice(0, TAG_LIMIT)
  }
  return picked.map(tag => {
    const clone = tag.cloneNode(false) as HTMLElement
    if (view !== 't') clone.className = 'gt'
    clone.removeAttribute('ehs-tag')
    clone.textContent = tag.getAttribute('ehs-tag') ?? tag.textContent
    return clone
  })
}


function paneOf(doc: Document, parts: SourceRow, shape: 'cs' | 'cn'): HTMLElement {
  const pane = element(doc, 'div', 'glthumb')
  pane.id = `it${parts.gid}`

  const picture = element(doc, 'div')
  const image = coverOf(parts)
  if (image) picture.append(image)
  pane.append(picture)

  const footer = element(doc, 'div')
  const left = element(doc, 'div')
  const category = categoryOf(parts, shape)
  if (category) left.append(category)
  const posted = postedOf(parts, `postedpop_${parts.gid}`)
  if (posted) left.append(posted)
  const right = element(doc, 'div')
  if (parts.rating) right.append(copy(parts.rating))
  right.append(parts.pages ? copy(parts.pages) : element(doc, 'div'))
  footer.append(left, right)
  pane.append(footer)

  const height = (pixels(image, 'height') || pixels(parts.frame, 'height')) + PANE_FOOTER
  pane.style.height = `${height}px`
  return pane
}

function titleOf(doc: Document, parts: SourceRow, view: NativeView): HTMLElement {
  const link = element(doc, 'a')
  link.setAttribute('href', parts.href)
  const title = copy(parts.title)
  if (view === 't') {
    title.className = 'gl4t glname glink'
    link.append(title)
    return link
  }
  title.className = 'glink'
  link.append(title)
  const tags = tagsOf(parts, view)
  if (tags.length > 0) {
    const holder = element(doc, 'div', view === 'p' ? 'gltm' : undefined)
    holder.append(...tags)
    link.append(holder)
  }
  return link
}

function favouriteCell(doc: Document, parts: SourceRow, view: NativeView): HTMLElement | null {
  if (!parts.favorited && !parts.selection) return null
  if (view === 't') {
    const holder = element(doc, 'div', 'glft')
    const date = element(doc, 'div')
    if (parts.favorited) date.append(...copy(parts.favorited).childNodes)
    const select = element(doc, 'div')
    if (parts.selection) select.append(...copy(parts.selection).childNodes)
    holder.append(date, select)
    return holder
  }
  const cell = element(doc, 'td', view === 'l' ? 'glfav glfc' : 'glfav')
  if (parts.favorited) {
    const line = element(doc, 'p')
    line.append(...copy(parts.favorited).childNodes)
    cell.append(line)
  }
  if (parts.selection) cell.append(...copy(parts.selection).childNodes)
  return cell
}

function headerRow(doc: Document, view: NativeView, labels?: NativeLabels): HTMLTableRowElement {
  const row = doc.createElement('tr')
  const columns = view === 'l'
    ? ['', labels?.published ?? '', labels?.title ?? '', labels?.uploader ?? '']
    : ['', labels?.published ?? '', '', labels?.title ?? '', '', labels?.uploader ?? '']
  columns.forEach((label, index) => {
    const cell = doc.createElement('th')
    if (index === columns.length - 1) cell.className = 'glhide'
    cell.textContent = label
    row.append(cell)
  })
  return row
}

interface Item {
  node: HTMLElement
  hover: HTMLElement | null
}

function tableItem(doc: Document, parts: SourceRow, view: NativeView): Item {
  const compact = view === 'l'
  const shape = compact ? 'cn' : 'cs'
  const row = doc.createElement('tr')
  if (parts.fresh !== null) row.setAttribute('data-new', parts.fresh)

  const categoryCell = element(doc, 'td', compact ? 'gl1c glcat' : 'gl1m glcat')
  const category = categoryOf(parts, shape)
  if (category) categoryCell.append(category)

  const previewCell = element(doc, 'td', compact ? 'gl2c' : 'gl2m')
  const cut = element(doc, 'div', 'glcut')
  cut.id = `ic${parts.gid}`
  const pane = paneOf(doc, parts, shape)
  previewCell.append(cut, pane)
  const posted = postedOf(parts, `posted_${parts.gid}`)
  if (compact) {
    const stack = element(doc, 'div')
    if (posted) stack.append(posted)
    if (parts.rating) stack.append(copy(parts.rating))
    stack.append(downloadOf(doc, parts))
    previewCell.append(stack)
  } else if (posted) {
    previewCell.append(posted)
  }

  const titleCell = element(doc, 'td', compact ? 'gl3c glname' : 'gl3m glname')
  titleCell.addEventListener('mouseover', () => {
    const top = previewCell.getBoundingClientRect().top
    const height = pane.getBoundingClientRect().height
    const bottom = (doc.defaultView?.innerHeight ?? height) - top - height
    pane.style.top = `${Math.max(-top, Math.min(0, bottom))}px`
  })
  titleCell.append(titleOf(doc, parts, view))
  if (parts.note) titleCell.append(copy(parts.note))

  row.append(categoryCell, previewCell)
  if (!compact) {
    const downloadCell = element(doc, 'td', 'gl6m')
    downloadCell.append(downloadOf(doc, parts))
    row.append(downloadCell)
  }
  row.append(titleCell)
  if (!compact) {
    const ratingCell = element(doc, 'td', 'gl4m')
    if (parts.rating) ratingCell.append(copy(parts.rating))
    row.append(ratingCell)
  }

  const uploaderCell = element(doc, 'td', compact ? 'gl4c glhide' : 'gl5m glhide')
  uploaderCell.append(parts.uploader ? copy(parts.uploader) : element(doc, 'div'))
  if (compact) uploaderCell.append(parts.pages ? copy(parts.pages) : element(doc, 'div'))
  row.append(uploaderCell)

  const favourite = favouriteCell(doc, parts, view)
  if (favourite) row.append(favourite)

  return { node: row, hover: titleCell }
}

function thumbnailItem(doc: Document, parts: SourceRow): Item {
  const card = element(doc, 'div', 'gl1t')
  if (parts.fresh !== null) card.setAttribute('data-new', parts.fresh)
  card.append(titleOf(doc, parts, 't'))

  const frame = element(doc, 'div', 'gl3t')
  const frameStyle = parts.frame?.getAttribute('style')
  if (frameStyle) frame.setAttribute('style', frameStyle)
  const cover = element(doc, 'a')
  cover.setAttribute('href', parts.href)
  const image = coverOf(parts)
  if (image) {
    cover.append(image)
    const height = pixels(image, 'height')
    if (height > 0) {
      frame.style.width = '250px'
      frame.style.height = `${Math.min(340, height)}px`
    }
  }
  frame.append(cover)
  card.append(frame)

  const tags = element(doc, 'div', 'gl6t')
  tags.append(...tagsOf(parts, 't'))
  card.append(tags)

  const footer = element(doc, 'div', 'gl5t')
  const left = element(doc, 'div')
  const category = categoryOf(parts, 'cs')
  if (category) left.append(category)
  const posted = postedOf(parts, `posted_${parts.gid}`)
  if (posted) left.append(posted)
  const right = element(doc, 'div')
  if (parts.rating) right.append(copy(parts.rating))
  right.append(parts.pages ? copy(parts.pages) : element(doc, 'div'))
  right.append(downloadOf(doc, parts))
  footer.append(left, right)
  card.append(footer)

  const favourite = favouriteCell(doc, parts, 't')
  if (favourite) card.append(favourite)
  if (parts.note) card.append(copy(parts.note))

  return { node: card, hover: null }
}

export function createNativeListing(
  source: HTMLTableElement,
  view: NativeView,
  labels?: NativeLabels,
): NativeListing {
  const doc = source.ownerDocument
  if (view === 't') installNativeThumbnailStyles(doc)
  const tabular = view !== 't'
  const root = doc.createElement(tabular ? 'table' : 'div')
  root.className = view === 't' ? 'itg gld' : view === 'l' ? 'itg gltc' : 'itg gltm'
  root.setAttribute('data-evr-view', view)

  let container: HTMLElement = root
  if (tabular) {
    container = doc.createElement('tbody')
    root.append(container)
    container.append(headerRow(doc, view, labels))
  }

  const seen = new Set<string>()

  return {
    element: root,
    append(row: HTMLTableRowElement): boolean {
      const parts = parseGalleryRow(row)
      if (!parts || seen.has(parts.gid)) return false
      seen.add(parts.gid)

      const item = tabular ? tableItem(doc, parts, view) : thumbnailItem(doc, parts)
      item.node.setAttribute('data-evr-tags', galleryTagData(row))
      if (item.hover) {
        const previous = GALLERY_PATH.exec(galleryHref(row.previousElementSibling))?.[1] ?? '0'
        const next = GALLERY_PATH.exec(galleryHref(row.nextElementSibling))?.[1] ?? '0'
        item.hover.setAttribute(
          'onmouseover',
          `show_image_pane(${parts.gid});preload_pane_image(${previous},${next})`,
        )
        item.hover.setAttribute('onmouseout', 'hide_image_pane()')
      }
      const tags = item.node.querySelectorAll<HTMLElement>('.gt, .gtl, .gtw')
      const texts = Array.from(tags, tag => {
        const text = tag.firstChild
        text?.remove()
        return text
      })
      container.append(item.node)
      texts.forEach((text, index) => {
        if (text) tags[index].append(text)
      })
      return true
    },
  }
}
