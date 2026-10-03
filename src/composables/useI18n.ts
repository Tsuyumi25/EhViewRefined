import en from '@/locales/en'
import zhTW from '@/locales/zh-TW'
import zhCN from '@/locales/zh-CN'
import ja from '@/locales/ja'
import ko from '@/locales/ko'
import { detectLocale, type Locale } from '@/services/locale'

type MessageKey = keyof typeof en
const messages = {
  en,
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  ja,
  ko,
} satisfies Record<Locale, Record<MessageKey, string>>

const locale = detectLocale(navigator.languages)

export function t(key: MessageKey): string {
  return messages[locale][key]
}
