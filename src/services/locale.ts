export type Locale = 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko'

export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const parts = language.toLowerCase().split('-')
    const primary = parts[0]
    if (primary === 'zh') {
      if (parts.includes('hans')) return 'zh-CN'
      if (parts.includes('hant')) return 'zh-TW'
      if (parts.some(part => ['tw', 'hk', 'mo'].includes(part))) return 'zh-TW'
      return 'zh-CN'
    }
    if (primary === 'en') return 'en'
    if (primary === 'ja') return 'ja'
    if (primary === 'ko') return 'ko'
  }
  return 'en'
}
