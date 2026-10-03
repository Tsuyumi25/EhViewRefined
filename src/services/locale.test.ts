import { describe, expect, it } from 'vitest'
import { detectLocale } from './locale'

describe('locale negotiation', () => {
  it('uses the first supported language in browser preference order', () => {
    expect(detectLocale(['fr-FR', 'ja-JP', 'zh-TW'])).toBe('ja')
    expect(detectLocale(['ko-KR', 'en-US'])).toBe('ko')
    expect(detectLocale(['en-GB', 'zh-TW'])).toBe('en')
  })

  it('prefers explicit Chinese script over the region', () => {
    expect(detectLocale(['zh-Hans-TW'])).toBe('zh-CN')
    expect(detectLocale(['zh-Hant-CN'])).toBe('zh-TW')
  })

  it('recognizes Traditional Chinese regions and Simplified Chinese without a script', () => {
    expect(detectLocale(['zh-TW'])).toBe('zh-TW')
    expect(detectLocale(['zh-HK'])).toBe('zh-TW')
    expect(detectLocale(['zh-MO'])).toBe('zh-TW')
    expect(detectLocale(['zh-CN'])).toBe('zh-CN')
    expect(detectLocale(['zh'])).toBe('zh-CN')
  })

  it('falls back to English when no preference is supported', () => {
    expect(detectLocale(['fr-FR', 'de-DE'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})
