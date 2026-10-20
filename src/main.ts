import { announcePresence } from '@/services/presence'
import { startEarlyListing } from '@/services/startup'
import { startPagination } from '@/services/source/pagination'
import { startLiveUrl } from '@/services/source/liveUrl'
import { startListingWindow } from '@/services/rendering/listingWindow'
import { startSettingsHook, startSettingsLaunchers } from '@/services/settingsUi'
import { startSettingsMenu } from '@/services/settingsMenu'
import {
  getInfiniteScroll, getLocaleChoice, subscribeAllMyTags, subscribeAllOtherTags, subscribeGroupTags, subscribeInfiniteScroll,
  subscribeLocaleChoice, subscribeUploaderTag,
} from '@/services/settings'
import { setLocale } from '@/composables/useI18n'

announcePresence(document, __APP_VERSION__)
// Before anything writes text into the page, so the first render is already in the chosen language
setLocale(getLocaleChoice())
const stopObservingLocale = subscribeLocaleChoice(next => setLocale(next))
const stopSettingsHook = startSettingsHook()
const stopSettingsMenu = startSettingsMenu()
// Read before anything rewrites the address or the scroll restoration, so turning infinite scroll off and on
// still knows where the page began and how the browser restored it
const origin = { href: location.href, scrollRestoration: history.scrollRestoration }

let stopPagination: (() => void) | undefined
let stopWindow: (() => void) | undefined
let stopLiveUrl: (() => void) | undefined
let stopSettingsLaunchers: (() => void) | undefined
let stopObservingPagination: (() => void) | undefined
let stopObservingTags: (() => void)[] = []
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
    stopObservingTags = [subscribeGroupTags, subscribeUploaderTag, subscribeAllMyTags, subscribeAllOtherTags]
      .map(subscribe => subscribe(() => presentation.refreshTags()))
  }
  stopSettingsLaunchers = startSettingsLaunchers()
})

window.addEventListener('pagehide', event => {
  if (event.persisted) return
  stopObservingLocale()
  stopObservingPagination?.()
  for (const stop of stopObservingTags) stop()
  stopPagination?.()
  stopWindow?.()
  stopLiveUrl?.()
  stopSettingsLaunchers?.()
  stopSettingsHook()
  stopSettingsMenu()
  startup.dispose()
})
