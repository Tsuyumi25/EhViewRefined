import { createExtendedView, type ExtendedView, type ListView } from './listViews'
import {
  decorateModeSelect,
  findModeSelects,
  isModeSelect,
  observeModeSelects,
  syncModeSelect,
  readModeChoice,
  undecorateModeSelect,
} from './modeSelects'
import {
  initialView,
  planModeChange,
  readStoredView,
  storeView,
  type ViewStorage,
} from './viewRouting'

export interface ViewSwitcher {
  /** Null on the site's other display modes, where nothing is simulated. */
  readonly presentation: ExtendedView | null
  dispose(): void
}

export interface ViewSwitcherOptions {
  /** The native Extended table, or null on the site's other display modes. */
  table: HTMLTableElement | null
  root?: ParentNode
  storage?: ViewStorage
  href?: () => string
  navigate?: (url: string) => void
}

export function startViewSwitcher(options: ViewSwitcherOptions): ViewSwitcher | null {
  const root = options.root ?? document
  const extended = options.table !== null
  if (!extended && findModeSelects(root).length === 0) return null

  const storage = options.storage ?? window.sessionStorage
  const href = options.href ?? (() => location.href)
  const navigate = options.navigate ?? (url => location.assign(url))
  const presentation = options.table ? createExtendedView(options.table) : null
  let view = initialView(readStoredView(storage), extended)

  function refresh() {
    for (const select of findModeSelects(root)) {
      decorateModeSelect(select)
      if (extended) syncModeSelect(select, view)
    }
  }

  function apply(next: ListView) {
    view = next
    presentation?.setView(next)
    refresh()
  }

  function onChange(event: Event) {
    if (!isModeSelect(event.target)) return
    const transition = planModeChange(readModeChoice(event.target), { extended, href: href() })
    if (transition.kind === 'ignore') return
    if (transition.kind === 'native') {
      // The site's own handler navigates; only its Extended keeps the opt-out.
      storeView(storage, transition.mode === 'e' ? 'e' : null)
      return
    }
    // Keep the native handler from navigating to a mode the server never saw.
    event.stopPropagation()
    event.stopImmediatePropagation()
    storeView(storage, transition.view)
    if (transition.kind === 'apply') apply(transition.view)
    else navigate(transition.url)
  }

  apply(view)
  document.addEventListener('change', onChange, true)
  const stopObserving = observeModeSelects(root, refresh)

  return {
    presentation,
    dispose() {
      stopObserving()
      document.removeEventListener('change', onChange, true)
      for (const select of findModeSelects(root)) undecorateModeSelect(select)
      presentation?.dispose()
    },
  }
}
