import { describe, expect, it } from 'vitest'
import { chunkSize, createWindowMemory, planWindow, spacers, type WindowRange } from './windowPlan'

interface Listing {
  count: number
  columns: number
  viewport: number
  reach: number
  /** Room above the listing, like the site's search bar. */
  header: number
  height: (line: number) => number
}

/**
 * A page laid out as header, spacer, mounted lines, spacer. The anchoring the
 * controller performs is applied here too: the visible item keeps its spot, or
 * after a jump the planned item lands where the plan said.
 */
function simulate(listing: Listing) {
  const line = (index: number) => Math.floor(index / listing.columns)
  const lines = Math.ceil(listing.count / listing.columns)
  const memory = createWindowMemory()
  let range: WindowRange = { start: 0, end: listing.count }
  let scroll = 0

  const room = () => spacers(memory, listing.count, range)
  function documentTop(index: number): number {
    let y = listing.header + room().above
    for (let current = line(range.start); current < line(index); current++) y += listing.height(current)
    return y
  }
  const documentHeight = () => {
    let mounted = 0
    for (let current = line(range.start); current <= line(range.end - 1); current++) mounted += listing.height(current)
    return listing.header + room().above + mounted + room().below
  }
  const clamp = () => {
    scroll = Math.max(0, Math.min(scroll, documentHeight() - listing.viewport))
  }
  const top = (index: number) => documentTop(index) - scroll
  const bottom = (index: number) => top(index) + listing.height(line(index))

  function step(): boolean {
    const plan = planWindow({ ...listing, ...range, top, bottom }, memory)
    if (!plan) return false
    let anchor = -1
    if (!plan.target) {
      for (let index = range.start; index < range.end; index++) {
        if (bottom(index) > 0) {
          anchor = index
          break
        }
      }
    }
    const before = anchor >= 0 ? documentTop(anchor) : 0
    range = { start: plan.start, end: plan.end }
    if (plan.target) scroll += top(plan.target.index) - plan.target.top
    else if (anchor >= 0) scroll += documentTop(anchor) - before
    clamp()
    return true
  }

  function settle(): number {
    for (let steps = 0; steps < 10_000; steps++) if (!step()) return steps
    throw new Error('the window never settled')
  }

  /** The mounted item under the viewport's top edge and how far above that edge it starts. */
  function reading() {
    for (let index = range.start; index < range.end; index++) {
      if (bottom(index) > 0) return { index: line(index), offset: top(index) }
    }
    return null
  }

  function trueTop(index: number): number {
    let y = listing.header
    for (let current = 0; current < line(index); current++) y += listing.height(current)
    return y
  }

  return {
    get range() {
      return range
    },
    get scroll() {
      return scroll
    },
    scrollTo(value: number) {
      scroll = value
      clamp()
    },
    lines,
    memory,
    settle,
    reading,
    top,
    bottom,
    trueTop,
    documentHeight,
    covered() {
      if (range.start > 0) expect(top(range.start)).toBeLessThanOrEqual(0)
      if (range.end < listing.count) expect(bottom(range.end - 1)).toBeGreaterThanOrEqual(listing.viewport)
    },
  }
}

const extended: Listing = { count: 500, columns: 1, viewport: 900, reach: 1350, header: 300, height: () => 200 }
const thumbnail: Listing = { count: 500, columns: 6, viewport: 900, reach: 1350, header: 300, height: () => 400 }
const uneven: Listing = { ...extended, height: current => 120 + ((current * 37) % 160) }

describe('planWindow', () => {
  for (const [name, listing] of [['one item a line', extended], ['a grid', thumbnail], ['uneven rows', uneven]] as const) {
    describe(name, () => {
      it('keeps what the reader sees in place while scrolling down and back up', () => {
        const sim = simulate(listing)
        sim.settle()
        const total = sim.documentHeight()
        for (const direction of [1, -1]) {
          for (let moves = 0; moves < 400; moves++) {
            const target = sim.scroll + direction * 333
            if (target < 0 || target > total - listing.viewport) break
            sim.scrollTo(target)
            const seen = sim.reading()
            sim.settle()
            expect(sim.reading()).toEqual(seen)
            sim.covered()
          }
        }
      })

      it('keeps the page as tall as the whole list, so the scrollbar and the top stay true', () => {
        const sim = simulate(listing)
        const total = sim.documentHeight()
        for (let scroll = 0; scroll < total - listing.viewport; scroll += 2_000) {
          sim.scrollTo(scroll)
          sim.settle()
          expect(Math.abs(sim.documentHeight() - total)).toBeLessThan(1)
        }
      })

      it('lands where a dragged scrollbar or Home points, with the right galleries there', () => {
        const sim = simulate(listing)
        const total = sim.documentHeight()
        sim.scrollTo(total)
        sim.settle()
        for (const spot of [total * 0.4, 0, total * 0.75, total * 0.1]) {
          sim.scrollTo(spot)
          sim.settle()
          sim.covered()
          const { index, offset } = sim.reading()!
          expect(offset).toBeCloseTo(sim.trueTop(index * listing.columns) - sim.scroll)
        }
        sim.scrollTo(0)
        sim.settle()
        expect(sim.range.start).toBe(0)
        expect(sim.top(0)).toBe(listing.header)
      })

      it('moves in whole lines and stays put while the reader wiggles at an edge', () => {
        const sim = simulate(listing)
        sim.scrollTo(sim.documentHeight() / 2)
        sim.settle()
        const step = chunkSize(listing.columns)
        expect(sim.range.start % step).toBe(0)
        const middle = sim.scroll
        // The first swing may cross a threshold the settled spot sat just short of; after that nothing toggles
        for (let wiggle = 0; wiggle < 20; wiggle++) {
          sim.scrollTo(middle + (wiggle % 2 ? 150 : -150))
          const steps = sim.settle()
          if (wiggle >= 2) expect(steps).toBe(0)
        }
      })
    })
  }

  it('absorbs heights that went stale while chunks were away, without moving what the reader sees', () => {
    let grown = false
    const listing: Listing = { ...extended, height: () => (grown ? 260 : 200) }
    const sim = simulate(listing)
    sim.scrollTo(sim.documentHeight() - listing.viewport)
    sim.settle()
    grown = true
    for (let moves = 0; moves < 2_000 && (sim.scroll > 0 || sim.range.start > 0); moves++) {
      sim.scrollTo(sim.scroll - 333)
      const seen = sim.reading()
      sim.settle()
      expect(sim.reading()).toEqual(seen)
      sim.covered()
    }
    expect(sim.range.start).toBe(0)
    expect(sim.top(0)).toBe(listing.header)
  })

  it('regroups the chunks when the grid changes its column count, keeping the room above', () => {
    const listing = { ...thumbnail }
    const sim = simulate(listing)
    sim.scrollTo(20_000)
    sim.settle()
    const above = spacers(sim.memory, listing.count, sim.range).above
    listing.columns = 4
    const plan = planWindow(
      { ...listing, ...sim.range, top: sim.top, bottom: sim.bottom },
      sim.memory,
    )!
    expect(plan.start % chunkSize(4)).toBe(0)
    expect(spacers(sim.memory, listing.count, plan).above).toBeCloseTo((above * plan.start) / sim.range.start)
  })
})
