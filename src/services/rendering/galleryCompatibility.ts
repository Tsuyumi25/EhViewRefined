import type { ListView } from '../listingModes'

export interface ListingHost {
  /** The node currently standing in the listing's place. */
  readonly element: HTMLElement
  mount(node: HTMLElement, view: ListView): void
  dispose(): void
}

const TAG_SELECTOR = '.gt, .gtl, .gtw'

// 勾選狀態只活在 property 上，複製當下帶過去；之後換檢視由 syncSelection 依 key 接回。
// 不留 change listener：它的 closure 會讓 source 整列一直活著，source 就丟不掉
function carry(origin: HTMLInputElement, clone: HTMLInputElement) {
  clone.checked = origin.checked
  clone.value = origin.value
}

export function copy<T extends Element>(node: T): T {
  const clone = node.cloneNode(true) as T
  const sources = node.querySelectorAll('input, select, textarea')
  const clones = clone.querySelectorAll('input, select, textarea')
  for (let index = 0; index < sources.length; index++) {
    carry(sources[index] as HTMLInputElement, clones[index] as HTMLInputElement)
  }
  return clone
}

export function syncSelection(from: HTMLElement, to: HTMLElement) {
  if (from === to) return
  const states = new Map<string, boolean>()
  const key = (input: HTMLInputElement) => input.id || `${input.name}:${input.value}`
  for (const input of from.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    states.set(key(input), input.checked)
  }
  for (const input of to.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    const checked = states.get(key(input))
    if (checked !== undefined) input.checked = checked
  }
}

export function cloneTag(node: HTMLElement, text: string | null): HTMLElement {
  const clone = node.cloneNode(false) as HTMLElement
  clone.removeAttribute('ehs-tag')
  clone.textContent = text
  return clone
}

/**
 * Inserts a whole batch at once, so scripts watching the listing see one
 * mutation instead of one per gallery. Translation scripts only walk into an
 * inserted node once the document has loaded; until then they translate what
 * is added itself, so each tag's text is added again after the insert.
 */
export function insertItems(container: HTMLElement, items: readonly HTMLElement[]): void {
  const batch = container.ownerDocument.createDocumentFragment()
  batch.append(...items)
  if (container.ownerDocument.readyState !== 'loading') {
    container.append(batch)
    return
  }
  const tags = Array.from(batch.querySelectorAll<HTMLElement>(TAG_SELECTOR))
  const texts = tags.map(tag => {
    const text = tag.firstChild
    text?.remove()
    return text
  })
  container.append(batch)
  texts.forEach((text, index) => {
    if (text) tags[index].append(text)
  })
}

export function createListingHost(source: HTMLTableElement): ListingHost {
  const doc = source.ownerDocument
  const wrapper = source.closest<HTMLElement>('.ido')
  const originalWidth = wrapper?.style.getPropertyValue('max-width') ?? ''
  const originalWidthPriority = wrapper?.style.getPropertyPriority('max-width') ?? ''
  const start = doc.createComment('evr')
  source.before(start)

  let mounted: HTMLElement = source

  function restoreWidth() {
    if (!wrapper || wrapper.style.maxWidth !== '1370px') return
    if (originalWidth) wrapper.style.setProperty('max-width', originalWidth, originalWidthPriority)
    else wrapper.style.removeProperty('max-width')
  }

  function place(node: HTMLElement) {
    if (node === mounted && node.parentNode) return
    if (mounted !== node && mounted.parentNode) mounted.replaceWith(node)
    else if (start.parentNode) start.after(node)
    mounted = node
  }

  return {
    get element() {
      return mounted
    },
    mount(node, view) {
      if (view === 't' && wrapper) wrapper.style.setProperty('max-width', '1370px')
      else restoreWidth()
      place(node)
    },
    dispose() {
      restoreWidth()
      place(source)
      start.remove()
    },
  }
}
