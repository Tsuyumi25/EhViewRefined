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
