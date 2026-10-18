import type { ListingPipeline } from '../listingPipeline'
import { galleryKey } from './extendedAdapter'

/** Pages that jump elsewhere in the listing; the cursor alone has to decide where a reload starts. */
const POSITION_PARAMETERS = ['prev', 'next', 'jump', 'seek', 'range', 'inline_set']
const GID_CURSOR = /^\d+$/
/** Safari throws once a page replaces its URL a hundred times in thirty seconds, so only a settled scroll writes */
const SETTLE_MS = 250

/**
 * Whether the listing pages by gid: next=X then lists the galleries below gid X
 * (checked against the site), so next=gid+1 starts at that gallery. Favourites
 * page by when a gallery was added and carry another cursor.
 */
export function pagesByGid(root: ParentNode): boolean {
  // The end the reader cannot go to is a bare span with no href, and on the first page that span (#uprev)
  // comes first in the document, so only links count
  const cursorHref = root.querySelector('#unext[href], #dnext[href], #uprev[href], #dprev[href]')?.getAttribute('href')
  if (!cursorHref) return false
  const url = new URL(cursorHref, 'https://e-hentai.org/')
  const cursor = url.searchParams.get('next') ?? url.searchParams.get('prev')
  return cursor !== null && GID_CURSOR.test(cursor)
}

export function positionUrl(href: string, gid: string): string {
  const url = new URL(href)
  for (const name of POSITION_PARAMETERS) url.searchParams.delete(name)
  url.searchParams.set('next', String(Number(gid) + 1))
  return url.toString()
}

/**
 * Keeps the address on the gallery at the top of the viewport, so a reload,
 * a shared link or a return to an evicted page starts there. Back at the first
 * gallery the original address returns, which still lists what was posted since.
 */
export function startLiveUrl(presentation: ListingPipeline, origin: string): () => void {
  const doc = presentation.element.ownerDocument
  const win = doc.defaultView!
  if (!pagesByGid(doc)) return () => {}
  const restoration = win.history.scrollRestoration
  let written = win.location.href
  let timer = 0

  function topGallery(): { index: number; node: HTMLElement } | null {
    const strip = presentation.strip
    for (let index = strip.start; index < strip.end; index++) {
      const node = strip.nodeAt(index)
      if (node && node.getBoundingClientRect().bottom > 0) return { index, node }
    }
    return null
  }

  function write() {
    timer = 0
    const top = topGallery()
    if (!top) return
    const key = top.index === 0 ? null : galleryKey(top.node)
    const next = key ? positionUrl(origin, key.split('/')[0]) : origin
    if (next === written) return
    // The saved offset belongs to the whole endless listing; a reload of the new address starts with this gallery,
    // so the browser restoring that offset would land far below it
    win.history.scrollRestoration = next === origin ? restoration : 'manual'
    win.history.replaceState(win.history.state, '', next)
    written = next
  }

  function schedule() {
    if (timer) win.clearTimeout(timer)
    timer = win.setTimeout(write, SETTLE_MS)
  }

  win.addEventListener('scroll', schedule, { passive: true })
  return () => {
    if (timer) win.clearTimeout(timer)
    win.removeEventListener('scroll', schedule)
  }
}
