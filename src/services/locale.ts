export const locales = ['zh-TW', 'zh-CN', 'en', 'ja', 'ko'] as const
export type Locale = (typeof locales)[number]

export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale)
}

/** A language the reader picked, or 'auto' to follow the browser's preference. */
export type LocaleChoice = Locale | 'auto'

export function isLocaleChoice(value: unknown): value is LocaleChoice {
  return value === 'auto' || isLocale(value)
}

export function resolveLocale(choice: LocaleChoice, languages: readonly string[]): Locale {
  return choice === 'auto' ? detectLocale(languages) : choice
}

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
