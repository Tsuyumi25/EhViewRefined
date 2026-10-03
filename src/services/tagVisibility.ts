import { getShowAllTags, subscribeShowAllTags } from './settings'

const styleId = 'evr-tag-visibility-style'
const filterMark = 'data-evr-tag-filter'
const plainMark = 'data-evr-tag-plain'
const rootSelector = '[data-evr-view="t"]'
const tagSelector = '.gl6t > :is(.gt, .gtl, .gtw)'

const uncoloured: Record<string, true> = {
  '': true,
  none: true,
  transparent: true,
  currentcolor: true,
  inherit: true,
  initial: true,
  unset: true,
  revert: true,
  'revert-layer': true,
  auto: true,
}

function alphaOf(value: string): number | null {
  const body = /^[a-z]+\(([^()]*)\)$/.exec(value)?.[1]
  if (body === undefined) return null
  const slash = body.lastIndexOf('/')
  const parts = body.split(',')
  const raw = slash >= 0 ? body.slice(slash + 1) : parts.length === 4 ? parts[3] : null
  if (raw === null) return null
  const text = raw.trim()
  const percent = text.endsWith('%')
  const alpha = Number.parseFloat(percent ? text.slice(0, -1) : text)
  return Number.isNaN(alpha) ? null : percent ? alpha / 100 : alpha
}

export function isColourValue(value: string): boolean {
  const normalised = value.trim().toLowerCase()
  if (uncoloured[normalised]) return false
  return alphaOf(normalised) !== 0
}

export interface TagPaint {
  color: string
  backgroundColor: string
  backgroundImage: string
}

export function isHighlighted(paint: TagPaint): boolean {
  return (
    isColourValue(paint.color) ||
    isColourValue(paint.backgroundColor) ||
    isColourValue(paint.backgroundImage)
  )
}

export function startTagVisibility(doc: Document): () => void {
  const roots = new Map<HTMLElement, MutationObserver>()
  let showAll = getShowAllTags()
  let disposed = false

  function classify(tag: HTMLElement) {
    const paint = tag.style
    const plain = !isHighlighted(paint)
    if (plain === tag.hasAttribute(plainMark)) return
    if (plain) tag.setAttribute(plainMark, '')
    else tag.removeAttribute(plainMark)
  }

  function classifyWithin(node: Element) {
    if (node.matches(tagSelector)) classify(node as HTMLElement)
    for (const tag of node.querySelectorAll<HTMLElement>(tagSelector)) classify(tag)
  }

  function attach(root: HTMLElement) {
    if (roots.has(root) || !root.isConnected) return
    if (!style.isConnected) (doc.head ?? doc.documentElement).append(style)
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') {
          const tag = record.target as HTMLElement
          if (tag.matches(tagSelector)) classify(tag)
          else tag.removeAttribute(plainMark)
          continue
        }
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) classifyWithin(node as Element)
        }
      }
    })
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    })
    roots.set(root, observer)
    classifyWithin(root)
    root.toggleAttribute(filterMark, !showAll)
  }

  function detach(removed: Element) {
    for (const [root, observer] of roots) {
      if (removed !== root && !removed.contains(root)) continue
      observer.disconnect()
      root.removeAttribute(filterMark)
      for (const tag of root.querySelectorAll(`[${plainMark}]`)) tag.removeAttribute(plainMark)
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
  style.textContent = `[${filterMark}] [${plainMark}] { display: none !important; }`

  finder.observe(doc, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-evr-view'],
  })
  if (doc.documentElement) consider(doc.documentElement)

  const unsubscribe = subscribeShowAllTags(value => {
    showAll = value
    for (const root of roots.keys()) {
      if (showAll) root.removeAttribute(filterMark)
      else root.setAttribute(filterMark, '')
    }
  })

  return () => {
    if (disposed) return
    disposed = true
    unsubscribe()
    finder.disconnect()
    for (const [root, observer] of roots) {
      observer.disconnect()
      root.removeAttribute(filterMark)
      for (const tag of root.querySelectorAll(`[${plainMark}]`)) tag.removeAttribute(plainMark)
    }
    roots.clear()
    style.remove()
  }
}
