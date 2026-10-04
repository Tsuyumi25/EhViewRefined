import { t } from '@/composables/useI18n'
import { listViews, type ListView } from './listingModes'
import { simulatedPrefix } from './viewRouting'

const navSelector = '.searchnav'
const groupAttribute = 'data-evr-modes'

/**
 * Translation userscripts hide the server rendered select and show a clone, so
 * the markup cannot be trusted; the five native display values can.
 */
export function isModeSelect(node: EventTarget | null): node is HTMLSelectElement {
  if (!(node instanceof HTMLSelectElement) || !node.closest(navSelector)) return false
  const values = new Set(Array.from(node.options, option => option.value))
  return listViews.every(view => values.has(view))
}

export function findModeSelects(root: ParentNode): HTMLSelectElement[] {
  return Array.from(root.querySelectorAll<HTMLSelectElement>(`${navSelector} select`)).filter(
    isModeSelect,
  )
}

export function decorateModeSelect(select: HTMLSelectElement): void {
  const existing = select.querySelectorAll(`optgroup[${groupAttribute}]`)
  if (existing.length === 1) return
  for (const stale of existing) stale.remove()

  const group = document.createElement('optgroup')
  group.setAttribute(groupAttribute, '')
  group.setAttribute('translate', 'no')
  group.label = t('select.group')
  for (const view of listViews) {
    if (view === 'e') continue
    const option = document.createElement('option')
    // LOLICON reads select.value at startup; the optgroup identifies simulated choices.
    option.value = view
    option.textContent = t(`views.${view}`)
    group.append(option)
  }
  select.append(group)
}

export function undecorateModeSelect(select: HTMLSelectElement): void {
  for (const group of select.querySelectorAll(`optgroup[${groupAttribute}]`)) group.remove()
}

export function readModeChoice(select: HTMLSelectElement): string {
  for (const option of select.options) {
    if (!option.selected) continue
    return option.closest(`optgroup[${groupAttribute}]`)
      ? `${simulatedPrefix}${option.value}`
      : option.value
  }
  return select.value
}

export function syncModeSelect(select: HTMLSelectElement, view: ListView): void {
  const selected = Array.from(select.options).find(option =>
    option.value === view
    && Boolean(option.closest(`optgroup[${groupAttribute}]`)) === (view !== 'e'),
  )
  if (!selected) return
  for (const option of select.options) option.toggleAttribute('selected', option === selected)
  selected.selected = true
}

/**
 * Bars are parsed one at a time and translation userscripts clone them later,
 * so discovery watches the document only while it loads, then narrows to the
 * bars themselves. Records queued by our own options are dropped on the way out.
 */
export function observeModeSelects(root: ParentNode, onMutate: () => void): () => void {
  const watched = new WeakSet<Element>()
  const scoped = new MutationObserver(() => {
    onMutate()
    scoped.takeRecords()
  })

  function watch(nav: Element) {
    if (watched.has(nav)) return
    watched.add(nav)
    scoped.observe(nav, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
    })
  }

  function scan() {
    for (const nav of root.querySelectorAll(navSelector)) watch(nav)
  }

  const bootstrap = new MutationObserver(records => {
    let found = false
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        if (node.matches(navSelector)) {
          watch(node)
          found = true
        } else if (node.firstElementChild) {
          for (const nav of node.querySelectorAll(navSelector)) {
            watch(nav)
            found = true
          }
        }
      }
    }
    if (found) onMutate()
  })

  function settle() {
    bootstrap.disconnect()
    document.removeEventListener('DOMContentLoaded', settle)
    scan()
    onMutate()
  }

  scan()
  if (document.readyState === 'loading') {
    bootstrap.observe(document, { childList: true, subtree: true })
    document.addEventListener('DOMContentLoaded', settle)
  }

  return () => {
    bootstrap.disconnect()
    scoped.disconnect()
    document.removeEventListener('DOMContentLoaded', settle)
  }
}
