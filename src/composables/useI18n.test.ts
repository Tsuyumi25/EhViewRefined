// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { localizeLabel, localizeText, setLocale, t } from './useI18n'

describe('switching languages', () => {
  it('rewrites text already written into the page', () => {
    setLocale('en')
    const select = document.createElement('select')
    const group = document.createElement('optgroup')
    const option = document.createElement('option')
    localizeLabel(group, 'select.group')
    localizeText(option, 'views.t')
    group.append(option)
    select.append(group)
    document.body.append(select)
    const english = option.textContent

    setLocale('zh-TW')
    expect(group.label).toBe(t('select.group'))
    expect(option.textContent).toBe(t('views.t'))
    expect(option.textContent).not.toBe(english)
  })
})
