import { t } from '@/composables/useI18n'
import type { ExtendedGallery } from '../gallerySnapshot'
import { copy } from './galleryCompatibility'
import { categoryOf, coverOf, downloadOf, element, postedOf, tagsOf, titleOf } from './galleryFragments'
import type { NativeItem, NativeLayout } from './nativeLayouts'
import type { TagSelection } from './nativeTagSelection'

interface Column {
  className: string
  header?: Parameters<typeof t>[0]
  headerClassName?: string
  render: (context: RowContext) => HTMLElement
}

interface TableStructure {
  rootClassName: string
  categoryClassName: string
  columns: readonly Column[]
  favouriteClassName: string
}

interface TableDefinition extends TableStructure {
  tags: TagSelection
  titleTagsClassName?: string
}

interface RowContext {
  doc: Document
  gallery: ExtendedGallery
  definition: TableDefinition
  preview: HTMLElement
  hover: HTMLElement | null
}

const PANE_FOOTER = 46

function paneOf(doc: Document, gallery: ExtendedGallery, categoryClassName: string): HTMLElement {
  const pane = element(doc, 'div', 'glthumb')
  pane.id = `it${gallery.snapshot.gid}`
  const picture = element(doc, 'div')
  const cover = coverOf(gallery)
  if (cover.image) picture.append(cover.image)
  pane.append(picture)

  const footer = element(doc, 'div')
  const left = element(doc, 'div')
  const category = categoryOf(gallery, categoryClassName)
  if (category) left.append(category)
  const posted = postedOf(gallery, `postedpop_${gallery.snapshot.gid}`)
  if (posted) left.append(posted)
  const right = element(doc, 'div')
  if (gallery.bindings.rating) right.append(copy(gallery.bindings.rating))
  right.append(gallery.bindings.pages ? copy(gallery.bindings.pages) : element(doc, 'div'))
  footer.append(left, right)
  pane.append(footer)
  pane.style.height = `${(cover.height || gallery.snapshot.frameHeight) + PANE_FOOTER}px`
  return pane
}

function categoryCell({ doc, gallery, definition }: RowContext): HTMLElement {
  const cell = element(doc, 'td')
  const category = categoryOf(gallery, definition.categoryClassName)
  if (category) cell.append(category)
  return cell
}

function publishedCell({ gallery, preview }: RowContext): HTMLElement {
  const posted = postedOf(gallery, `posted_${gallery.snapshot.gid}`)
  if (posted) preview.append(posted)
  return preview
}

function metadataCell({ doc, gallery, preview }: RowContext): HTMLElement {
  const stack = element(doc, 'div')
  const posted = postedOf(gallery, `posted_${gallery.snapshot.gid}`)
  if (posted) stack.append(posted)
  if (gallery.bindings.rating) stack.append(copy(gallery.bindings.rating))
  stack.append(downloadOf(doc, gallery))
  preview.append(stack)
  return preview
}

function downloadCell({ doc, gallery }: RowContext): HTMLElement {
  const cell = element(doc, 'td')
  cell.append(downloadOf(doc, gallery))
  return cell
}

function titleCell(context: RowContext): HTMLElement {
  const { doc, gallery, definition } = context
  const cell = element(doc, 'td')
  const title = titleOf(doc, gallery, 'glink')
  const tags = tagsOf(gallery, definition.tags, 'gt')
  if (tags.length > 0) {
    const holder = element(doc, 'div', definition.titleTagsClassName)
    holder.append(...tags)
    title.append(holder)
  }
  cell.append(title)
  if (gallery.bindings.note) cell.append(copy(gallery.bindings.note))
  context.hover = cell
  return cell
}

function ratingCell({ doc, gallery }: RowContext): HTMLElement {
  const cell = element(doc, 'td')
  if (gallery.bindings.rating) cell.append(copy(gallery.bindings.rating))
  return cell
}

function uploaderCell({ doc, gallery }: RowContext): HTMLElement {
  const cell = element(doc, 'td')
  cell.append(gallery.bindings.uploader ? copy(gallery.bindings.uploader) : element(doc, 'div'))
  return cell
}

function uploaderWithPagesCell(context: RowContext): HTMLElement {
  const cell = uploaderCell(context)
  const pages = context.gallery.bindings.pages
  cell.append(pages ? copy(pages) : element(context.doc, 'div'))
  return cell
}

function favouriteCell(doc: Document, gallery: ExtendedGallery, className: string): HTMLElement | null {
  const { favorited, selection } = gallery.bindings
  if (!favorited && !selection) return null
  const cell = element(doc, 'td', className)
  if (favorited) {
    const line = element(doc, 'p')
    line.append(...copy(favorited).childNodes)
    cell.append(line)
  }
  if (selection) cell.append(...copy(selection).childNodes)
  return cell
}

function tableItem(doc: Document, gallery: ExtendedGallery, definition: TableDefinition): NativeItem {
  const row = doc.createElement('tr')
  if (gallery.snapshot.fresh !== null) row.setAttribute('data-new', gallery.snapshot.fresh)
  const preview = element(doc, 'td')
  const cut = element(doc, 'div', 'glcut')
  cut.id = `ic${gallery.snapshot.gid}`
  const pane = paneOf(doc, gallery, definition.categoryClassName)
  preview.append(cut, pane)
  const context: RowContext = { doc, gallery, definition, preview, hover: null }
  for (const column of definition.columns) {
    const cell = column.render(context)
    cell.className = column.className
    row.append(cell)
  }
  context.hover?.addEventListener('mouseover', () => {
    const top = preview.getBoundingClientRect().top
    const height = pane.getBoundingClientRect().height
    const bottom = (doc.defaultView?.innerHeight ?? height) - top - height
    pane.style.top = `${Math.max(-top, Math.min(0, bottom))}px`
  })
  const favourite = favouriteCell(doc, gallery, definition.favouriteClassName)
  if (favourite) row.append(favourite)
  return { node: row, hover: context.hover }
}

function tableLayout(definition: TableDefinition): NativeLayout {
  return {
    root: { tag: 'table', className: definition.rootClassName },
    createContainer(root) {
      const doc = root.ownerDocument
      const body = doc.createElement('tbody')
      const header = doc.createElement('tr')
      for (const column of definition.columns) {
        const cell = element(doc, 'th', column.headerClassName)
        cell.textContent = column.header ? t(column.header) : ''
        header.append(cell)
      }
      root.append(body)
      body.append(header)
      return body
    },
    renderItem: (doc, gallery) => tableItem(doc, gallery, definition),
  }
}

const minimalStructure: TableStructure = {
  rootClassName: 'itg gltm',
  categoryClassName: 'cs',
  columns: [
    { className: 'gl1m glcat', render: categoryCell },
    { className: 'gl2m', header: 'columns.published', render: publishedCell },
    { className: 'gl6m', render: downloadCell },
    { className: 'gl3m glname', header: 'columns.title', render: titleCell },
    { className: 'gl4m', render: ratingCell },
    { className: 'gl5m glhide', header: 'columns.uploader', headerClassName: 'glhide', render: uploaderCell },
  ],
  favouriteClassName: 'glfav',
}

export const minimalLayout = tableLayout({ ...minimalStructure, tags: 'none' })

export const minimalPlusLayout = tableLayout({
  ...minimalStructure,
  tags: 'styled',
  titleTagsClassName: 'gltm',
})

export const compactLayout = tableLayout({
  rootClassName: 'itg gltc',
  categoryClassName: 'cn',
  columns: [
    { className: 'gl1c glcat', render: categoryCell },
    { className: 'gl2c', header: 'columns.published', render: metadataCell },
    { className: 'gl3c glname', header: 'columns.title', render: titleCell },
    { className: 'gl4c glhide', header: 'columns.uploader', headerClassName: 'glhide', render: uploaderWithPagesCell },
  ],
  favouriteClassName: 'glfav glfc',
  tags: 'styled-first',
})
