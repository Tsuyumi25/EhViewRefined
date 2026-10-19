import { readonly, ref } from 'vue'
import en from '@/locales/en'
import zhTW from '@/locales/zh-TW'
import zhCN from '@/locales/zh-CN'
import ja from '@/locales/ja'
import ko from '@/locales/ko'
import { detectLocale, type Locale } from '@/services/locale'

export type MessageKey = keyof typeof en
const messages = {
  en,
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  ja,
  ko,
} satisfies Record<Locale, Record<MessageKey, string>>

// Text written straight into the page remembers its key, so switching languages can rewrite it in place
const textAttribute = 'data-evr-text'
const labelAttribute = 'data-evr-label'

const current = ref<Locale>(detectLocale(navigator.languages))
export const locale = readonly(current)

export function t(key: MessageKey): string {
  return messages[current.value][key]
}

export function localizeText(node: Element, key: MessageKey): void {
  node.setAttribute(textAttribute, key)
  node.textContent = t(key)
}

export function localizeLabel(node: HTMLOptGroupElement, key: MessageKey): void {
  node.setAttribute(labelAttribute, key)
  node.label = t(key)
}

export function setLocale(next: Locale, root: ParentNode = document): void {
  if (current.value === next) return
  current.value = next
  for (const node of root.querySelectorAll(`[${textAttribute}]`))
    node.textContent = t(node.getAttribute(textAttribute) as MessageKey)
  for (const node of root.querySelectorAll<HTMLOptGroupElement>(`optgroup[${labelAttribute}]`))
    node.label = t(node.getAttribute(labelAttribute) as MessageKey)
}
