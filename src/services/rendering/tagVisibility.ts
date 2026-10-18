import { getShowAllTags, subscribeShowAllTags } from '../settings'
import { PLAIN_TAG_MARK } from '../source/tagPaint'

const styleId = 'evr-tag-visibility-style'
const filterMark = 'data-evr-tag-filter'
const rootSelector = '[data-evr-view="t"]'

/** Thumbnail shows only the tags the site highlights unless the reader asks for all of them. */
export function startTagVisibility(doc: Document): () => void {
  const roots = new Set<HTMLElement>()
  let showAll = getShowAllTags()
  let disposed = false

  function attach(root: HTMLElement) {
    if (roots.has(root) || !root.isConnected) return
    if (!style.isConnected) (doc.head ?? doc.documentElement).append(style)
    roots.add(root)
    root.toggleAttribute(filterMark, !showAll)
  }

  function detach(removed: Element) {
    for (const root of roots) {
      if (removed !== root && !removed.contains(root)) continue
      root.removeAttribute(filterMark)
      roots.delete(root)
    }
  }

  function consider(node: Element) {
    if (node.matches(rootSelector)) attach(node as HTMLElement)
    for (const root of node.querySelectorAll<HTMLElement>(rootSelector)) attach(root)
  }

  const finder = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        const root = record.target as HTMLElement
        if (roots.has(root) && !root.matches(rootSelector)) detach(root)
        else consider(root)
        continue
      }
      for (const node of record.removedNodes) {
        if (node.nodeType === 1) detach(node as Element)
      }
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) consider(node as Element)
      }
    }
  })

  const style = doc.createElement('style')
  style.id = styleId
  // A namespace row left with only plain tags would show a label with nothing after it
  style.textContent = `[${filterMark}] .gl6t [${PLAIN_TAG_MARK}] { display: none !important; }
[${filterMark}] .evr-tag-groups tr:not(:has([data-evr-tag]:not([${PLAIN_TAG_MARK}]))) { display: none !important; }`

  finder.observe(doc, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-evr-view'],
  })
  if (doc.documentElement) consider(doc.documentElement)

  const unsubscribe = subscribeShowAllTags(value => {
    showAll = value
    for (const root of roots) root.toggleAttribute(filterMark, !showAll)
  })

  return () => {
    if (disposed) return
    disposed = true
    unsubscribe()
    finder.disconnect()
    for (const root of roots) root.removeAttribute(filterMark)
    roots.clear()
    style.remove()
  }
}
