import { createApp, type App } from 'vue'
import SettingsButton from '@/components/SettingsButton.vue'
import SettingsPopup from '@/components/SettingsPopup.vue'
import styles from '@/styles/settings.css?inline'
import { findModeSelects, observeModeSelects } from './modeSelects'

const styleId = 'evr-settings-style'
const hostAttribute = 'data-evr-settings'

function installStyles(doc: Document): void {
  if (doc.getElementById(styleId)) return
  const style = doc.createElement('style')
  style.id = styleId
  style.textContent = styles
  ;(doc.head ?? doc.documentElement).append(style)
}

function isVisible(select: HTMLSelectElement): boolean {
  return typeof select.checkVisibility === 'function'
    ? select.checkVisibility()
    : select.offsetParent !== null
}

export function startSettingsUi(): () => void {
  installStyles(document)
  const scopeClass =
    location.hostname === 'exhentai.org' ? 'evr-scope evr-scope--dark' : 'evr-scope'

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
  let overlay: HTMLElement | null = null
  let overlayApp: App | null = null
  let trigger: HTMLElement | null = null

  function closePopup() {
    if (!overlay) return
    overlayApp?.unmount()
    overlay.remove()
    overlayApp = null
    overlay = null
    const returnTo = trigger
    trigger = null
    if (returnTo?.isConnected) returnTo.focus()
  }

  function openPopup(source: HTMLElement | null) {
    if (overlay) return
    trigger = source
    overlay = document.createElement('div')
    overlay.className = scopeClass
    overlay.setAttribute('translate', 'no')
    document.body.append(overlay)
    overlayApp = createApp(SettingsPopup, { onClose: closePopup })
    overlayApp.mount(overlay)
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
      const host = document.createElement('span')
      host.className = `${scopeClass} evr-settings-host`
      host.setAttribute(hostAttribute, '')
      host.setAttribute('translate', 'no')
      const app = createApp(SettingsButton, {
        onOpen: () => openPopup(host.querySelector('button')),
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
    closePopup()
    for (const select of [...launchers.keys()]) release(select)
    document.getElementById(styleId)?.remove()
  }
}
