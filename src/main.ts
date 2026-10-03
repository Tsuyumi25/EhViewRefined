import { startEarlyListing } from '@/services/startup'
import { startPagination } from '@/services/pagination'
import { startTagVisibility } from '@/services/tagVisibility'
import { startSettingsUi } from '@/services/settingsUi'
import { getInfiniteScroll, subscribeInfiniteScroll } from '@/services/settings'

let stopPagination: (() => void) | undefined
let stopSettingsUi: (() => void) | undefined
let stopObservingPagination: (() => void) | undefined
const stopTagVisibility = startTagVisibility(document)
const startup = startEarlyListing(switcher => {
  const presentation = switcher.presentation
  if (presentation) {
    const syncPagination = (enabled: boolean) => {
      stopPagination?.()
      stopPagination = enabled ? startPagination(presentation) : undefined
    }
    syncPagination(getInfiniteScroll())
    stopObservingPagination = subscribeInfiniteScroll(syncPagination)
  }
  stopSettingsUi = startSettingsUi()
})

window.addEventListener('pagehide', event => {
  if (event.persisted) return
  stopObservingPagination?.()
  stopPagination?.()
  stopSettingsUi?.()
  stopTagVisibility()
  startup.dispose()
})
