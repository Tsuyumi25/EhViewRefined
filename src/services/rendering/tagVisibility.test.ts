import { describe, expect, it, vi } from 'vitest'
import { isColourValue, isHighlighted } from './tagVisibility'

vi.mock('../settings', () => ({}))

describe('colour values', () => {
  it('takes any opaque colour the browser serialised', () => {
    expect(isColourValue('rgb(255, 0, 0)')).toBe(true)
    expect(isColourValue('rgba(68, 85, 102, 0.5)')).toBe(true)
    expect(isColourValue('RGB(0, 0, 0)')).toBe(true)
  })

  it('reads a fully transparent colour as no colour at all', () => {
    expect(isColourValue('rgba(0, 0, 0, 0)')).toBe(false)
    expect(isColourValue('rgb(0 0 0 / 0%)')).toBe(false)
    expect(isColourValue('transparent')).toBe(false)
  })

  it('leaves the resets and the empty declaration alone', () => {
    expect(isColourValue('')).toBe(false)
    expect(isColourValue('  ')).toBe(false)
    expect(isColourValue('none')).toBe(false)
    expect(isColourValue('inherit')).toBe(false)
    expect(isColourValue('initial')).toBe(false)
    expect(isColourValue('currentcolor')).toBe(false)
  })

  it('counts a picture or a gradient as a background of its own', () => {
    expect(isColourValue('url("https://example.test/a.png")')).toBe(true)
    expect(isColourValue('linear-gradient(rgb(1, 2, 3), rgb(4, 5, 6))')).toBe(true)
  })
})

describe('highlighted tags', () => {
  const plain = { color: '', backgroundColor: '', backgroundImage: 'none' }

  it('needs text or background, not the sizing a listing writes anyway', () => {
    expect(isHighlighted(plain)).toBe(false)
    expect(isHighlighted({ ...plain, color: 'rgb(255, 255, 255)' })).toBe(true)
    expect(isHighlighted({ ...plain, backgroundColor: 'rgb(68, 85, 102)' })).toBe(true)
    expect(isHighlighted({ ...plain, backgroundImage: 'url("a.png")' })).toBe(true)
  })

  it('stays plain when the inline colours are only resets', () => {
    expect(
      isHighlighted({ color: 'inherit', backgroundColor: 'transparent', backgroundImage: 'none' }),
    ).toBe(false)
  })
})
