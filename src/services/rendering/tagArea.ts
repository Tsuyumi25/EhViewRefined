import type { ExtendedGallery } from '../gallerySnapshot'
import { UPLOADER_TAG_CLASS } from '../source/extendedAdapter'
import { cloneTag } from './galleryCompatibility'
import { selectTagIndexes, type TagSelection } from './nativeTagSelection'

/** How the simulated views lay out tags; both are the reader's own choices in the settings. */
export interface TagOptions {
  /** One row per namespace, the way Extended and the gallery page show them. */
  group: boolean
  /** The uploader drawn as one more tag, under its own uploader: row when grouped. */
  uploader: boolean
}

/** The site's own layout with nothing added; the reader's defaults live in the settings. */
export const plainTagOptions: TagOptions = { group: false, uploader: false }

const UPLOADER_NAMESPACE = 'uploader'
const GROUPS_CLASS = 'evr-tag-groups'
const UPLOADER_ROW_CLASS = 'evr-uploader-row'
const STYLE_ID = 'evr-tag-area-style'

/**
 * Shaped like the site's tags so its stylesheet draws it, and marked so the
 * listing data never counts it as one; a user name is never translated.
 */
export function uploaderTag(doc: Document, name: string): HTMLElement {
  const tag = doc.createElement('div')
  const full = `${UPLOADER_NAMESPACE}:${name}`
  tag.className = `gt ${UPLOADER_TAG_CLASS}`
  tag.title = full
  tag.setAttribute('data-evr-tag', full)
  tag.setAttribute('data-evr-ns', UPLOADER_NAMESPACE)
  tag.setAttribute('translate', 'no')
  tag.textContent = name
  return tag
}

function groupRow(doc: Document, namespace: string | null, tags: readonly HTMLElement[]): HTMLTableRowElement {
  const row = doc.createElement('tr')
  const label = doc.createElement('td')
  label.className = 'tc'
  label.textContent = namespace ? `${namespace}:` : ''
  const cell = doc.createElement('td')
  cell.append(...tags)
  row.append(label, cell)
  return row
}

/** Rows in the order each namespace first appears, which keeps the site's own order. */
function groupTable(doc: Document, groups: Map<string | null, HTMLElement[]>): HTMLElement {
  const table = doc.createElement('table')
  table.className = GROUPS_CLASS
  const body = doc.createElement('tbody')
  for (const [namespace, tags] of groups) body.append(groupRow(doc, namespace, tags))
  table.append(body)
  return table
}

/** The nodes that go where a view shows its tags; empty when there is nothing to show. */
export function tagAreaOf(
  gallery: ExtendedGallery,
  selection: TagSelection,
  options: TagOptions,
  className?: string,
): HTMLElement[] {
  const doc = gallery.bindings.title.ownerDocument
  const { tags, uploader } = gallery.snapshot
  const groups = new Map<string | null, HTMLElement[]>()
  for (const index of selectTagIndexes(tags, selection)) {
    const clone = cloneTag(gallery.bindings.tags[index], tags[index].text)
    if (className !== undefined) clone.className = className
    const namespace = tags[index].namespace
    const members = groups.get(namespace)
    if (members) members.push(clone)
    else groups.set(namespace, [clone])
  }
  const shown = options.uploader && uploader !== null ? uploaderTag(doc, uploader) : null
  if (!options.group) {
    const flat = [...groups.values()].flat()
    return shown ? [...flat, shown] : flat
  }
  if (shown) groups.set(UPLOADER_NAMESPACE, [shown])
  return groups.size ? [groupTable(doc, groups)] : []
}

/**
 * Extended draws its own namespace rows, so the uploader tag joins them as one
 * more row; a row without tags gets the table Extended would have drawn.
 */
export function syncUploaderRow(row: HTMLTableRowElement, uploader: string | null, enabled: boolean): void {
  const existing = row.querySelector<HTMLTableRowElement>(`tr.${UPLOADER_ROW_CLASS}`)
  if (!enabled || uploader === null) {
    existing?.remove()
    return
  }
  if (existing) return
  const name = row.querySelector<HTMLElement>('.gl4e')
  if (!name) return
  const doc = row.ownerDocument
  const line = groupRow(doc, UPLOADER_NAMESPACE, [uploaderTag(doc, uploader)])
  line.className = UPLOADER_ROW_CLASS
  const body = name.querySelector('table')?.tBodies[0]
  if (body) {
    body.append(line)
    return
  }
  const table = doc.createElement('table')
  const created = doc.createElement('tbody')
  created.append(line)
  table.append(created)
  const holder = doc.createElement('div')
  holder.append(table)
  name.append(holder)
}

export function installTagAreaStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  // The site styles the namespace table only inside Extended's .gl4e; the simulated views get the same shape here.
  // Minimal+ caps its tag line at two lines (max-height: 36px), which would clip the rows into the next gallery
  style.textContent = `
.${GROUPS_CLASS} { border-collapse: collapse; border-spacing: 0; margin: 0; }
.${GROUPS_CLASS} td { padding: 0; border: none; vertical-align: top; }
.${GROUPS_CLASS} td.tc { padding: 2px 4px 0 0; white-space: nowrap; text-align: right; }
.gltm:has(> .${GROUPS_CLASS}) { max-height: none; }`
  ;(doc.head ?? doc.documentElement).append(style)
}
