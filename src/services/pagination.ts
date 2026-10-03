import { t } from '@/composables/useI18n'
import type { ExtendedView } from './listViews'
import { nativeExtendedUrl } from './viewRouting'

export function startPagination(presentation: ExtendedView): () => void {
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
        const response = await win.fetch(nativeExtendedUrl(url), { signal: abort.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const html = await response.text()
        if (disposed) return
        const page = new win.DOMParser().parseFromString(html, 'text/html')
        presentation.appendPage(page)
        visited.add(url)
        next = nextUrl(page, response.url || url)
        updateNextLinks(page)
      } while (next && !disposed && bottom.getBoundingClientRect().top <= win.innerHeight + 400)
      if (!next) observer.disconnect()
    } catch (error) {
      if (!disposed) {
        observer.disconnect()
        errorNotice.textContent = t('pagination.error')
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
