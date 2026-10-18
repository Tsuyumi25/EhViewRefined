/** The site serves 25 galleries a page; the window moves in about that much at a time. */
const PAGE_SIZE = 25

export interface WindowRange {
  start: number
  end: number
}

export interface WindowGeometry extends WindowRange {
  count: number
  /** Items sharing a visual line; a chunk is always whole lines, or the grid would reflow under the reader. */
  columns: number
  viewport: number
  /** How far ahead of the viewport items must already exist; hiding waits for twice this, so a reader at the edge does not toggle a chunk. */
  reach: number
  /** Viewport-relative edges, asked only for items currently mounted. */
  top(index: number): number
  bottom(index: number): number
}

/**
 * What a hidden chunk is known to take up. The spacers keep that room, so the
 * scrollbar stays true and scroll offset zero is the real start of the list.
 * A height may go stale once other scripts restyle the rows; the chunk is then
 * remeasured on its way back and the difference absorbed by anchoring.
 */
export interface WindowMemory {
  step: number
  heights: number[]
  /** Stand-in for chunks never measured, taken from what is mounted. */
  fallback: number
}

export interface WindowPlan extends WindowRange {
  /** After a jump nothing visible survives, so the item to land on and its spot are given; otherwise the visible item stays put. */
  target: { index: number; top: number } | null
}

export function createWindowMemory(): WindowMemory {
  return { step: 0, heights: [], fallback: 0 }
}

export function chunkSize(columns: number): number {
  const lines = Math.max(1, Math.floor(columns))
  return lines * Math.ceil(PAGE_SIZE / lines)
}

function estimate(memory: WindowMemory, chunk: number): number {
  return memory.heights[chunk] ?? memory.fallback
}

function itemsIn(chunk: number, step: number, count: number): number {
  return Math.max(0, Math.min(step, count - chunk * step))
}

export function spacers(memory: WindowMemory, count: number, range: WindowRange): { above: number; below: number } {
  const step = memory.step
  if (!step) return { above: 0, below: 0 }
  let above = 0
  for (let chunk = 0; chunk < range.start / step; chunk++) above += estimate(memory, chunk)
  let below = 0
  if (range.end < count) {
    for (let chunk = range.end / step; chunk * step < count; chunk++) {
      below += memory.heights[chunk] ?? (memory.fallback * itemsIn(chunk, step, count)) / step
    }
  }
  return { above, below }
}

/** Keeps the room each side takes up when the column count changes how items fall into chunks. */
function regroup(geometry: WindowGeometry, memory: WindowMemory, step: number): WindowPlan {
  const { count, start, end } = geometry
  const before = spacers(memory, count, geometry)
  const perAbove = start ? before.above / start : memory.fallback / step
  const perBelow = end < count ? before.below / (count - end) : memory.fallback / step
  const nextStart = start - (start % step)
  const nextEnd = end >= count ? count : Math.min(count, Math.ceil(end / step) * step)
  const heights: number[] = []
  for (let chunk = 0; chunk * step < count; chunk++) {
    const items = itemsIn(chunk, step, count)
    heights.push((chunk * step < nextStart ? perAbove : perBelow) * items)
  }
  memory.step = step
  memory.heights = heights
  return { start: nextStart, end: nextEnd, target: null }
}

/**
 * One step towards the wanted window, or null once it holds. Each call moves a
 * single chunk, or jumps when the reader landed in a spacer (Home, a dragged
 * scrollbar); the caller measures again after layout, so no step builds on a
 * height the browser has not settled yet.
 */
export function planWindow(geometry: WindowGeometry, memory: WindowMemory): WindowPlan | null {
  const { count, start, end, viewport, reach } = geometry
  if (count === 0) return null
  const step = chunkSize(geometry.columns)
  if (start >= end) {
    memory.step = step
    return { start: 0, end: Math.min(count, step), target: null }
  }
  if (memory.step === 0) memory.step = step
  else if (memory.step !== step) return regroup(geometry, memory, step)

  const top = geometry.top(start)
  const bottom = geometry.bottom(end - 1)
  memory.fallback = (bottom - top) / Math.ceil((end - start) / step)
  const far = reach * 2
  const first = start / step
  const after = Math.ceil(end / step)

  const lostAbove = start > 0 && top > viewport + reach
  const lostBelow = end < count && bottom < -reach
  if (lostAbove || lostBelow) {
    for (let chunk = first; chunk < after; chunk++) {
      const next = (chunk + 1) * step
      memory.heights[chunk] = (next < end ? geometry.top(next) : bottom) - geometry.top(chunk * step)
    }
    let chunk: number
    let edge: number
    if (lostAbove) {
      chunk = first
      edge = top
      while (chunk > 0 && edge > 0) edge -= estimate(memory, --chunk)
    } else {
      chunk = after
      edge = bottom
      while ((chunk + 1) * step < count && edge + estimate(memory, chunk) < 0) edge += estimate(memory, chunk++)
    }
    return { start: chunk * step, end: Math.min(count, (chunk + 1) * step), target: { index: chunk * step, top: edge } }
  }

  if (start > 0 && top > -reach) return { start: start - step, end, target: null }
  if (end < count && bottom < viewport + reach) return { start, end: Math.min(count, end + step), target: null }

  if (start + step < end && geometry.bottom(start + step - 1) < -far) {
    memory.heights[first] = geometry.top(start + step) - top
    return { start: start + step, end, target: null }
  }
  const cut = end % step ? end - (end % step) : end - step
  if (cut > start && geometry.top(cut) > viewport + far) {
    memory.heights[cut / step] = bottom - geometry.top(cut)
    return { start, end: cut, target: null }
  }
  return null
}
