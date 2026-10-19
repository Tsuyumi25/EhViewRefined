import { localizeText } from '@/composables/useI18n'
import type { ListingPipeline } from '../listingPipeline'
import { sourceSelector } from './extendedAdapter'
import { nativeExtendedUrl } from '../viewRouting'

export function startPagination(presentation: ListingPipeline): () => void {
  const doc = presentation.element.ownerDocument
  const win = doc.defaultView!
  const bottom = doc.querySelectorAll<HTMLElement>('.searchnav')[1]
  if (!bottom) return () => {}

  function nextUrl(page: Document, base: string): string | null {
    const href = page.querySelector('#dnext')?.getAttribute('href')
    return href ? new URL(href, base).href : null
  }

  let next = nextUrl(doc, doc.URL)
  let loading = false
  let disposed = false
  const visited = new Set<string>([doc.URL])
  const abort = new AbortController()
  const errorNotice = doc.createElement('p')
  errorNotice.setAttribute('translate', 'no')

  function updateNextLinks(page: Document) {
    for (const id of ['unext', 'dnext']) {
      const current = doc.getElementById(id)
      const replacement = page.getElementById(id)
      if (current && replacement) current.replaceWith(doc.importNode(replacement, true))
      else current?.remove()
    }
  }

  /**
   * The page asks for the user's own display mode, which was Extended when this
   * listing loaded. Forcing it with inline_set costs a redirect on every page,
   * so that is kept for a mode changed in another tab since.
   */
  async function fetchPage(url: string): Promise<{ page: Document; base: string }> {
    for (const target of [url, nativeExtendedUrl(url)]) {
      const response = await win.fetch(target, { signal: abort.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const page = new win.DOMParser().parseFromString(await response.text(), 'text/html')
      if (page.querySelector(sourceSelector)) return { page, base: response.url || url }
    }
    throw new Error('eh-view-refined: the response carries no Extended listing')
  }

  // The sentinel sits below the bottom spacer, so it only comes near once the reader is at the true end,
  // even while the window still has the tail parked; it fires only on entering, so no call may be turned away
  async function load() {
    if (loading || disposed || !next) return
    loading = true
    try {
      do {
        const url = next
        if (visited.has(url)) {
          next = null
          break
        }
        const { page, base } = await fetchPage(url)
        if (disposed) return
        presentation.appendPage(page)
        visited.add(url)
        next = nextUrl(page, base)
        updateNextLinks(page)
      } while (next && !disposed && bottom.getBoundingClientRect().top <= win.innerHeight + 400)
      if (!next) observer.disconnect()
    } catch (error) {
      if (!disposed) {
        observer.disconnect()
        localizeText(errorNotice, 'pagination.error')
        bottom.after(errorNotice)
        console.error('[Eh View Refined] Pagination stopped:', error)
      }
    } finally {
      loading = false
    }
  }

  const observer = new win.IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) void load()
  }, { rootMargin: '400px' })
  if (next) observer.observe(bottom)

  return () => {
    disposed = true
    abort.abort()
    observer.disconnect()
    errorNotice.remove()
  }
}
