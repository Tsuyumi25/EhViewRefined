// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { openSettingsEvent, startSettingsHook } from './settingsUi'

vi.mock('$', () => ({
  GM_getValue: (_key: string, fallback: unknown) => fallback,
  GM_setValue: () => {},
  GM_addValueChangeListener: () => 0,
  GM_removeValueChangeListener: () => {},
}))

let stop: (() => void) | undefined

afterEach(() => {
  stop?.()
  document.body.replaceChildren()
})

describe('opening the settings from another script', () => {
  it('opens on the event and hands the focus back to the sender when closed', () => {
    stop = startSettingsHook()
    const sender = document.createElement('button')
    document.body.append(sender)
    sender.focus()

    document.dispatchEvent(new Event(openSettingsEvent))
    document.dispatchEvent(new Event(openSettingsEvent))
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(sender)
  })

  it('stops listening once the script shuts down', () => {
    startSettingsHook()()
    document.dispatchEvent(new Event(openSettingsEvent))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})

// 管理器可能在 <html> 建立之前就注入，這時 head 與 documentElement 都還是 null
describe('starting before the root element exists', () => {
  it('keeps the listener and draws its styles once the settings open', () => {
    const root = document.documentElement
    root.remove()
    try {
      stop = startSettingsHook()
    } finally {
      document.append(root)
    }
    document.dispatchEvent(new Event(openSettingsEvent))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.getElementById('evr-settings-style')).not.toBeNull()
  })
})

// The lock itself is a settings.css rule, which vitest does not load; what matters here is that body's inline style stays someone else's
describe('locking the page while the settings are open', () => {
  it('never writes body’s inline overflow, whichever side closes first', () => {
    stop = startSettingsHook()
    const { body, documentElement: root } = document
    body.style.overflow = 'hidden'
    document.dispatchEvent(new Event(openSettingsEvent))
    expect(root.hasAttribute('data-evr-scroll-locked')).toBe(true)
    body.style.overflow = ''

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(root.hasAttribute('data-evr-scroll-locked')).toBe(false)
    expect(body.style.overflow).toBe('')

    document.dispatchEvent(new Event(openSettingsEvent))
    body.style.overflow = 'hidden'
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(body.style.overflow).toBe('hidden')
  })
})
