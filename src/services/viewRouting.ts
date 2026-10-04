import { listViews, type ListView } from './listingModes'

export const simulatedPrefix = 'evr-'
export const storageKey = 'ehe:view'
const inlineSetParameter = 'inline_set'
const nativeExtendedMode = 'dm_e'

export type ModeChoice = { kind: 'simulated'; view: ListView } | { kind: 'native'; mode: ListView }

export type ViewTransition =
  | { kind: 'ignore' }
  | { kind: 'native'; mode: ListView }
  | { kind: 'apply'; view: ListView }
  | { kind: 'navigate'; view: ListView; url: string }

export interface ViewStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function isListView(value: string): value is ListView {
  return (listViews as readonly string[]).includes(value)
}

export function parseModeValue(value: string): ModeChoice | null {
  if (value.startsWith(simulatedPrefix)) {
    const view = value.slice(simulatedPrefix.length)
    return isListView(view) ? { kind: 'simulated', view } : null
  }
  return isListView(value) ? { kind: 'native', mode: value } : null
}

export function nativeExtendedUrl(href: string): string {
  const url = new URL(href)
  url.searchParams.set(inlineSetParameter, nativeExtendedMode)
  return url.toString()
}

export function planModeChange(
  value: string,
  context: { extended: boolean; href: string },
): ViewTransition {
  const choice = parseModeValue(value)
  if (!choice) return { kind: 'ignore' }
  if (choice.kind === 'native') return { kind: 'native', mode: choice.mode }
  if (context.extended) return { kind: 'apply', view: choice.view }
  return { kind: 'navigate', view: choice.view, url: nativeExtendedUrl(context.href) }
}

/** A fresh Extended page opens in Thumbnail; only a stored choice overrides it. */
export function initialView(stored: ListView | null, extended: boolean): ListView {
  if (!extended) return 'e'
  return stored ?? 't'
}

export function readStoredView(storage: ViewStorage): ListView | null {
  const stored = storage.getItem(storageKey)
  return stored && isListView(stored) ? stored : null
}

export function storeView(storage: ViewStorage, view: ListView | null): void {
  if (view === null) storage.removeItem(storageKey)
  else storage.setItem(storageKey, view)
}
