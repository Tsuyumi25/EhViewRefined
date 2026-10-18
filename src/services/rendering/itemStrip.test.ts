// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createItemStrip, PARKED_CLASS } from './itemStrip'

function setup(count: number) {
  const container = document.createElement('div')
  const strip = createItemStrip()
  const nodes: HTMLElement[] = []
  const add = () => {
    const node = document.createElement('div')
    container.append(node)
    strip.push(node)
    nodes.push(node)
  }
  for (let index = 0; index < count; index++) add()
  const drawn = () => nodes.flatMap((node, index) => (node.classList.contains(PARKED_CLASS) ? [] : [index]))
  return { container, strip, nodes, add, drawn }
}

const range = (start: number, end: number) => Array.from({ length: end - start }, (_, index) => start + index)

describe('createItemStrip', () => {
  it('draws exactly the range after any sequence of moves, and never moves a node', () => {
    const { strip, nodes, container, drawn } = setup(60)
    let seed = 7
    const random = (limit: number) => {
      seed = (seed * 48271) % 2147483647
      return seed % limit
    }
    for (let move = 0; move < 200; move++) {
      const start = random(60)
      const end = start + 1 + random(60 - start)
      strip.setRange(start, end)
      expect(drawn()).toEqual(range(start, end))
      expect(Array.from(container.children)).toEqual(nodes)
      for (let index = 0; index < 60; index++) {
        expect(strip.nodeAt(index)).toBe(index >= start && index < end ? nodes[index] : undefined)
      }
    }
  })

  it('brings back the same node, with whatever other scripts did to it', () => {
    const { strip, nodes } = setup(30)
    nodes[0].classList.add('touched-by-another-script')
    strip.setRange(10, 30)
    strip.setRange(0, 30)
    expect(strip.nodeAt(0)).toBe(nodes[0])
    expect(nodes[0].classList.contains('touched-by-another-script')).toBe(true)
  })

  it('parks items that arrive while the tail is hidden, and draws them once the tail returns', () => {
    const { strip, add, drawn } = setup(20)
    strip.setRange(0, 10)
    add()
    add()
    expect(drawn()).toEqual(range(0, 10))
    strip.setRange(0, strip.count)
    expect(drawn()).toEqual(range(0, 22))
  })
})
