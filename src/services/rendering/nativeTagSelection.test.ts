import { describe, expect, it } from 'vitest'
import { selectTagIndexes, type SelectableTag } from './nativeTagSelection'

const tags = (pattern: string): SelectableTag[] =>
  Array.from(pattern, mark => ({ styled: mark === 's' }))

describe('native tag selection', () => {
  it('omits tags for the none strategy', () => {
    expect(selectTagIndexes(tags('sususu'), 'none')).toEqual([])
  })

  it('keeps only styled tags for the styled strategy', () => {
    expect(selectTagIndexes(tags('usuus'), 'styled')).toEqual([1, 4])
  })

  it('promotes styled tags ahead of the rest for styled-first', () => {
    expect(selectTagIndexes(tags('usuus'), 'styled-first')).toEqual([1, 4, 0, 2, 3])
  })

  it('caps both filtered strategies at twelve tags', () => {
    const many = tags('u'.repeat(10) + 's'.repeat(10))
    expect(selectTagIndexes(many, 'styled-first')).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 0, 1])
    expect(selectTagIndexes(many, 'styled')).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    expect(selectTagIndexes(tags('s'.repeat(20)), 'styled')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('keeps every tag in source order for the all strategy', () => {
    const many = tags('usu'.repeat(6))
    expect(selectTagIndexes(many, 'all')).toEqual(many.map((_, index) => index))
  })

  it('reports nothing for galleries without tags', () => {
    expect(selectTagIndexes([], 'styled-first')).toEqual([])
    expect(selectTagIndexes([], 'all')).toEqual([])
  })
})
