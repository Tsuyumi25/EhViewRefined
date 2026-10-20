import { createApp, type App } from 'vue'
import SettingsButton from '@/components/SettingsButton.vue'
import SettingsPopup from '@/components/SettingsPopup.vue'
import styles from '@/styles/settings.css?inline'
import { findModeSelects, observeModeSelects } from './modeSelects'

/**
 * Other scripts open the settings with document.dispatchEvent(new Event(openSettingsEvent)).
 * A plain event carries nothing across sandboxes, so it reaches us from any script manager
 * without touching the page's globals.
 */
export const openSettingsEvent = 'evr:open-settings'

const styleId = 'evr-settings-style'
const hostAttribute = 'data-evr-settings'

function installStyles(doc: Document): void {
  if (doc.getElementById(styleId)) return
  const style = doc.createElement('style')
  style.id = styleId
  style.textContent = styles
  ;(doc.head ?? doc.documentElement).append(style)
}

function scopeClass(): string {
  return location.hostname === 'exhentai.org' ? 'evr-scope evr-scope--dark' : 'evr-scope'
}

function isVisible(select: HTMLSelectElement): boolean {
  return typeof select.checkVisibility === 'function'
    ? select.checkVisibility()
    : select.offsetParent !== null
}

let overlay: HTMLElement | null = null
let overlayApp: App | null = null
let trigger: HTMLElement | null = null

function closeSettings() {
  if (!overlay) return
  overlayApp?.unmount()
  overlay.remove()
  overlayApp = null
  overlay = null
  const returnTo = trigger
  trigger = null
  if (returnTo?.isConnected) returnTo.focus()
}

/** source gets the focus back when the popup closes */
function openSettings(source: Element | null) {
  if (overlay) return
  installStyles(document)
  trigger = source instanceof HTMLElement ? source : null
  overlay = document.createElement('div')
  overlay.className = scopeClass()
  overlay.setAttribute('translate', 'no')
  ;(document.body ?? document.documentElement).append(overlay)
  overlayApp = createApp(SettingsPopup, { onClose: closeSettings })
  overlayApp.mount(overlay)
}

/**
 * Runs on every page from document-start, so a script that loads later always finds the listener in place.
 * The root element may not exist yet at that point, so the styles wait for the first thing that draws.
 */
export function startSettingsHook(): () => void {
  // The caller's own button still has the focus while its click handler dispatches
  const onOpen = () => openSettings(document.activeElement)
  document.addEventListener(openSettingsEvent, onOpen)
  return () => {
    document.removeEventListener(openSettingsEvent, onOpen)
    closeSettings()
    document.getElementById(styleId)?.remove()
  }
}

export function startSettingsLaunchers(): () => void {
  const launchers = new Map<HTMLSelectElement, { host: HTMLElement; app: App }>()
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const select = entry.target as HTMLSelectElement
      const launcher = launchers.get(select)
      if (launcher) syncSize(select, launcher.host)
    }
  })

  function syncSize(select: HTMLSelectElement, host: HTMLElement) {
    const height = select.getBoundingClientRect().height
    const value = `${height}px`
    if (height > 0 && host.style.getPropertyValue('--evr-ctrl-h') !== value)
      host.style.setProperty('--evr-ctrl-h', value)
    const style = getComputedStyle(select)
    if (host.style.verticalAlign !== style.verticalAlign) host.style.verticalAlign = style.verticalAlign
    if (host.style.font !== style.font) host.style.font = style.font
  }

  function release(select: HTMLSelectElement) {
    const launcher = launchers.get(select)
    if (!launcher) return
    launchers.delete(select)
    resizeObserver.unobserve(select)
    launcher.app.unmount()
    launcher.host.remove()
  }

  function sync() {
    const visible = findModeSelects(document).filter(isVisible)
    const wanted = new Set(visible)
    for (const select of [...launchers.keys()]) {
      if (!wanted.has(select) || !select.isConnected) release(select)
    }

    for (const select of visible) {
      const launcher = launchers.get(select)
      if (launcher) {
        if (select.nextElementSibling !== launcher.host) select.after(launcher.host)
        syncSize(select, launcher.host)
        continue
      }
      installStyles(document)
      const host = document.createElement('span')
      host.className = `${scopeClass()} evr-settings-host`
      host.setAttribute(hostAttribute, '')
      host.setAttribute('translate', 'no')
      const app = createApp(SettingsButton, {
        onOpen: () => openSettings(host.querySelector('button')),
      })
      select.after(host)
      app.mount(host)
      launchers.set(select, { host, app })
      syncSize(select, host)
      resizeObserver.observe(select, { box: 'border-box' })
    }

    const live = new Set([...launchers.values()].map(launcher => launcher.host))
    for (const stale of document.querySelectorAll<HTMLElement>(`[${hostAttribute}]`)) {
      if (!live.has(stale)) stale.remove()
    }
  }

  const stopObserving = observeModeSelects(document, sync)
  sync()

  return () => {
    stopObserving()
    resizeObserver.disconnect()
    for (const select of [...launchers.keys()]) release(select)
  }
}
