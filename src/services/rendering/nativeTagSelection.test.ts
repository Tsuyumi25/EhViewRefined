import { describe, expect, it } from 'vitest'
import { selectTagIndexes, type SelectableTag } from './nativeTagSelection'

const tags = (pattern: string): SelectableTag[] =>
  Array.from(pattern, mark => ({ styled: mark === 's' }))

const native = { styled: false, plain: false }
const allStyled = { styled: true, plain: false }
const allPlain = { styled: false, plain: true }
const everything = { styled: true, plain: true }

describe('native tag selection', () => {
  it('omits tags for the none strategy', () => {
    expect(selectTagIndexes(tags('sususu'), 'none', native)).toEqual([])
  })

  it('keeps only styled tags for the styled strategy', () => {
    expect(selectTagIndexes(tags('usuus'), 'styled', native)).toEqual([1, 4])
  })

  it('promotes styled tags ahead of the rest for styled-first', () => {
    expect(selectTagIndexes(tags('usuus'), 'styled-first', native)).toEqual([1, 4, 0, 2, 3])
  })

  it('caps both filtered strategies at twelve tags', () => {
    const many = tags('u'.repeat(10) + 's'.repeat(10))
    expect(selectTagIndexes(many, 'styled-first', native)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 0, 1])
    expect(selectTagIndexes(many, 'styled', native)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    expect(selectTagIndexes(tags('s'.repeat(20)), 'styled', native)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('reports nothing for galleries without tags', () => {
    expect(selectTagIndexes([], 'styled-first', everything)).toEqual([])
    expect(selectTagIndexes([], 'none', everything)).toEqual([])
  })
})

describe('complete tags', () => {
  const many = tags('su'.repeat(10))
  const styledIndexes = many.flatMap((tag, index) => tag.styled ? [index] : [])
  const plainIndexes = many.flatMap((tag, index) => tag.styled ? [] : [index])

  it.each(['none', 'styled', 'styled-first'] as const)('draws every tag in %s once both kinds are complete', selection => {
    const shown = selectTagIndexes(many, selection, everything)
    expect([...shown].sort((a, b) => a - b)).toEqual(many.map((_, index) => index))
  })

  it.each(['none', 'styled', 'styled-first'] as const)('draws every My Tags tag in %s without the twelve-tag cap', selection => {
    expect(selectTagIndexes(many, selection, allStyled).filter(index => many[index].styled)).toEqual(styledIndexes)
  })

  it.each(['none', 'styled', 'styled-first'] as const)('draws every other tag in %s, even where the site draws none', selection => {
    expect(selectTagIndexes(many, selection, allPlain).filter(index => !many[index].styled)).toEqual(plainIndexes)
  })

  it('keeps My Tags first in styled-first and the source order elsewhere', () => {
    expect(selectTagIndexes(tags('usus'), 'styled-first', everything)).toEqual([1, 3, 0, 2])
    expect(selectTagIndexes(tags('usus'), 'styled', everything)).toEqual([0, 1, 2, 3])
  })

  it('fills styled-first up to twelve with other tags after every My Tags tag', () => {
    const shown = selectTagIndexes(tags('s'.repeat(10) + 'u'.repeat(10)), 'styled-first', allStyled)
    expect(shown).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(selectTagIndexes(tags('s'.repeat(14) + 'u'), 'styled-first', allStyled)).toHaveLength(14)
  })
})
