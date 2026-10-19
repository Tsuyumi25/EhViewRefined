import { watch } from 'vue'
import { GM_registerMenuCommand, GM_unregisterMenuCommand } from '$'
import { locale, t } from '@/composables/useI18n'
import { openSettingsEvent } from './settingsUi'

/**
 * The script manager's menu opens the settings the same way another script does.
 * A label is fixed once registered, so a language switch registers it again.
 */
export function startSettingsMenu(): () => void {
  let id: ReturnType<typeof GM_registerMenuCommand> | undefined
  const stopWatching = watch(locale, () => {
    if (id !== undefined) GM_unregisterMenuCommand(id)
    id = GM_registerMenuCommand(t('settings.button'), () => document.dispatchEvent(new Event(openSettingsEvent)))
  }, { immediate: true })
  return () => {
    stopWatching()
    if (id !== undefined) GM_unregisterMenuCommand(id)
    id = undefined
  }
}
