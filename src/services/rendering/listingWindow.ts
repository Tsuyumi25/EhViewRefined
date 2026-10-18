import type { ListingPipeline } from '../listingPipeline'
import { PARKED_CLASS, type ItemStrip } from './itemStrip'
import { createWindowMemory, planWindow, spacers, type WindowMemory } from './windowPlan'

function rendered(node: HTMLElement | undefined): node is HTMLElement {
  return !!node && node.getClientRects().length > 0
}

/**
 * Draws only the galleries near the viewport. Hidden by a rule or parked, an
 * item without a box borrows the edge of its nearest drawn neighbour,
 * otherwise it would read as sitting at the viewport and pull the window open.
 */
export function startListingWindow(presentation: ListingPipeline): () => void {
  const win = presentation.element.ownerDocument.defaultView!
  const doc = win.document
  const memories = new WeakMap<ItemStrip, WindowMemory>()
  // Siblings of the listing rather than rows in it, so selectors for the site's rows never meet them
  const spacerAbove = createSpacer()
  const spacerBelow = createSpacer()
  // Important, so a rule from another script that shows the row cannot draw a parked item into the runway
  const parkedStyle = doc.createElement('style')
  parkedStyle.textContent = `.${PARKED_CLASS} { display: none !important; }`
  ;(doc.head ?? doc.documentElement).append(parkedStyle)

  function createSpacer(): HTMLElement {
    const spacer = doc.createElement('div')
    spacer.className = 'evr-window-spacer'
    spacer.setAttribute('aria-hidden', 'true')
    // The browser must anchor on a gallery: a spacer only changes height, so anchoring on it would let the galleries slide
    spacer.style.overflowAnchor = 'none'
    return spacer
  }

  function memoryOf(strip: ItemStrip): WindowMemory {
    let memory = memories.get(strip)
    if (!memory) memories.set(strip, (memory = createWindowMemory()))
    return memory
  }

  function fitSpacers(strip: ItemStrip, memory: WindowMemory) {
    const listing = presentation.element
    if (listing.previousSibling !== spacerAbove) listing.before(spacerAbove)
    if (listing.nextSibling !== spacerBelow) listing.after(spacerBelow)
    const room = spacers(memory, strip.count, strip)
    const above = `${Math.round(room.above)}px`
    const below = `${Math.round(room.below)}px`
    if (spacerAbove.style.height !== above) spacerAbove.style.height = above
    if (spacerBelow.style.height !== below) spacerBelow.style.height = below
  }

  let frame = 0
  let stopped = false

  function schedule() {
    if (!stopped && !frame) frame = win.requestAnimationFrame(update)
  }

  function top(strip: ItemStrip, index: number): number {
    for (let next = index; next < strip.end; next++) {
      const node = strip.nodeAt(next)
      if (rendered(node)) return node.getBoundingClientRect().top
    }
    return presentation.element.getBoundingClientRect().bottom
  }

  function bottom(strip: ItemStrip, index: number): number {
    for (let previous = index; previous >= strip.start; previous--) {
      const node = strip.nodeAt(previous)
      if (rendered(node)) return node.getBoundingClientRect().bottom
    }
    return presentation.element.getBoundingClientRect().top
  }

  function columnsOf(strip: ItemStrip): number {
    let first: number | null = null
    let columns = 0
    for (let index = strip.start; index < strip.end && columns < 64; index++) {
      const node = strip.nodeAt(index)
      if (!rendered(node)) continue
      const edge = node.getBoundingClientRect().top
      if (first === null) first = edge
      else if (Math.abs(edge - first) > 1) break
      columns++
    }
    return Math.max(1, columns)
  }

  function visible(strip: ItemStrip): HTMLElement | null {
    for (let index = strip.start; index < strip.end; index++) {
      const node = strip.nodeAt(index)
      if (rendered(node) && node.getBoundingClientRect().bottom > 0) return node
    }
    return null
  }

  function update() {
    frame = 0
    if (stopped || !presentation.element.isConnected) return
    const strip = presentation.strip
    const memory = memoryOf(strip)
    const viewport = win.innerHeight
    const next = planWindow({
      count: strip.count,
      start: strip.start,
      end: strip.end,
      columns: columnsOf(strip),
      viewport,
      reach: Math.max(viewport * 1.5, 1200),
      top: index => top(strip, index),
      bottom: index => bottom(strip, index),
    }, memory)
    if (!next) {
      fitSpacers(strip, memory)
      return
    }
    // The browser's own anchoring covers other scripts resizing rows later, but it is suppressed while the scroll
    // offset is zero and never sees a jump; measuring after the change only finds what it left uncorrected,
    // since its adjustment runs before getBoundingClientRect answers
    const anchor = next.target ? null : visible(strip)
    const before = anchor?.getBoundingClientRect().top ?? 0
    strip.setRange(next.start, next.end)
    fitSpacers(strip, memory)
    const drift = next.target
      ? top(strip, next.target.index) - next.target.top
      : anchor ? anchor.getBoundingClientRect().top - before : 0
    if (Math.abs(drift) >= 1) win.scrollBy(0, drift)
    // One chunk a frame: the next measurement then sees the layout the browser has already re-anchored
    schedule()
  }

  const unwatch = presentation.watch(schedule)
  win.addEventListener('scroll', schedule, { passive: true })
  win.addEventListener('resize', schedule)
  schedule()

  return () => {
    stopped = true
    if (frame) win.cancelAnimationFrame(frame)
    frame = 0
    unwatch()
    win.removeEventListener('scroll', schedule)
    win.removeEventListener('resize', schedule)
    presentation.revealAll()
    spacerAbove.remove()
    spacerBelow.remove()
    parkedStyle.remove()
  }
}
