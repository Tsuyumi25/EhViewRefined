import { sourceSelector } from './source/extendedAdapter'
import { startViewSwitcher, type ViewSwitcher } from './viewSwitcher'

/**
 * Runs at document-start, where neither the body nor the listing exists yet:
 * the observer goes up before the first look, so a table parsed in between is
 * still caught, and the switcher takes it over while the rows keep arriving.
 */
export function startEarlyListing(onReady?: (switcher: ViewSwitcher) => void): {
  dispose(): void
} {
  let switcher: ViewSwitcher | null = null
  let started = false
  let disposed = false

  function start(table: HTMLTableElement | null) {
    if (started || disposed) return
    started = true
    observer.disconnect()
    switcher = startViewSwitcher({ table })
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        const table = node.matches(sourceSelector)
          ? node
          : node.firstElementChild && node.querySelector(sourceSelector)
        if (table) {
          start(table as HTMLTableElement)
          return
        }
      }
    }
  })

  /**
   * The source may still owe its last row here, and listener order against the
   * presentation's own handler is not guaranteed, so it is flushed by hand.
   */
  function ready() {
    document.removeEventListener('DOMContentLoaded', ready)
    if (disposed) return
    start(null)
    if (!switcher) return
    switcher.presentation?.flush()
    onReady?.(switcher)
  }

  observer.observe(document, { childList: true, subtree: true })
  const parsed = document.querySelector<HTMLTableElement>(sourceSelector)
  if (parsed) start(parsed)

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready)
  else ready()

  return {
    dispose() {
      if (disposed) return
      disposed = true
      observer.disconnect()
      document.removeEventListener('DOMContentLoaded', ready)
      switcher?.dispose()
    },
  }
}
