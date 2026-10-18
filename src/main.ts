import { announcePresence } from '@/services/presence'
import { startEarlyListing } from '@/services/startup'
import { startPagination } from '@/services/source/pagination'
import { startLiveUrl } from '@/services/source/liveUrl'
import { startListingWindow } from '@/services/rendering/listingWindow'
import { startTagVisibility } from '@/services/rendering/tagVisibility'
import { startSettingsUi } from '@/services/settingsUi'
import { getInfiniteScroll, subscribeInfiniteScroll } from '@/services/settings'

announcePresence(document, __APP_VERSION__)
// Read before anything rewrites the address, so turning infinite scroll off and on still knows where the page began
const origin = location.href

let stopPagination: (() => void) | undefined
let stopWindow: (() => void) | undefined
let stopLiveUrl: (() => void) | undefined
let stopSettingsUi: (() => void) | undefined
let stopObservingPagination: (() => void) | undefined
const stopTagVisibility = startTagVisibility(document)
const startup = startEarlyListing(switcher => {
  const presentation = switcher.presentation
  if (presentation) {
    // Only an endless listing grows long enough to need a window, and turning it off puts every gallery back
    const syncPagination = (enabled: boolean) => {
      stopPagination?.()
      stopWindow?.()
      stopLiveUrl?.()
      stopPagination = enabled ? startPagination(presentation) : undefined
      stopWindow = enabled ? startListingWindow(presentation) : undefined
      stopLiveUrl = enabled ? startLiveUrl(presentation, origin) : undefined
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
  stopWindow?.()
  stopLiveUrl?.()
  stopSettingsUi?.()
  stopTagVisibility()
  startup.dispose()
})
