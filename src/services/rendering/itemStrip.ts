import type { WindowRange } from './windowPlan'

export const PARKED_CLASS = 'evr-parked'

/**
 * The galleries of one listing, of which only a contiguous range is drawn.
 * The rest stay in the document under display: none, so other scripts keep
 * their nodes, references and form inputs: a class change wakes no observer
 * watching child lists, and the browser drops parked items from layout, paint
 * and hit testing all the same.
 */
export interface ItemStrip extends WindowRange {
  readonly count: number
  /** Only drawn indices have a node. */
  nodeAt(index: number): HTMLElement | undefined
  setRange(start: number, end: number): void
}

export interface ItemStripWriter extends ItemStrip {
  /** Registers the next item, already placed in the listing; parked at once while the tail is hidden. */
  push(node: HTMLElement): void
}

export function createItemStrip(): ItemStripWriter {
  const nodes: HTMLElement[] = []
  let start = 0
  let end = 0

  return {
    get count() {
      return nodes.length
    },
    get start() {
      return start
    },
    get end() {
      return end
    },
    nodeAt(index) {
      return index >= start && index < end ? nodes[index] : undefined
    },
    push(node) {
      if (end === nodes.length) end++
      else node.classList.add(PARKED_CLASS)
      nodes.push(node)
    },
    setRange(nextStart, nextEnd) {
      const lower = Math.max(0, Math.min(nextStart, nodes.length))
      const upper = Math.max(lower, Math.min(nextEnd, nodes.length))
      for (let index = start; index < end; index++) {
        if (index < lower || index >= upper) nodes[index].classList.add(PARKED_CLASS)
      }
      for (let index = lower; index < upper; index++) {
        if (index < start || index >= end) nodes[index].classList.remove(PARKED_CLASS)
      }
      start = lower
      end = upper
    },
  }
}
