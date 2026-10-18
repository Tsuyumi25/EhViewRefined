// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { announcePresence, PRESENCE_ATTRIBUTE } from './presence'

describe('announcePresence', () => {
  it('marks the root element with the running version', () => {
    const doc = document.implementation.createHTMLDocument()
    announcePresence(doc, '1.2.3')
    expect(doc.documentElement.getAttribute(PRESENCE_ATTRIBUTE)).toBe('1.2.3')
  })

  it('waits for the root element when the document has none yet', async () => {
    const doc = document.implementation.createDocument(null, null, null)
    announcePresence(doc, '1.2.3')
    doc.append(doc.createElement('html'))
    await Promise.resolve()
    expect(doc.documentElement.getAttribute(PRESENCE_ATTRIBUTE)).toBe('1.2.3')
  })
})
