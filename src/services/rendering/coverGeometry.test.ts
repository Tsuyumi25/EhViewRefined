import { describe, expect, it } from 'vitest'
import { coverGeometry } from './coverGeometry'

describe('native cover framing', () => {
  it('scales a small Extended portrait and centers its crop', () => {
    expect(coverGeometry(100, 150)).toEqual({ width: 250, height: 375, frameHeight: 340, top: -17 })
  })

  it('keeps landscape and square images uncropped', () => {
    expect(coverGeometry(200, 100)).toEqual({ width: 250, height: 125, frameHeight: 125, top: 0 })
    expect(coverGeometry(100, 100)).toEqual({ width: 250, height: 250, frameHeight: 250, top: 0 })
  })

  it('declines unavailable image dimensions rather than emitting invalid CSS', () => {
    expect(coverGeometry(0, 100)).toBeNull()
    expect(coverGeometry(100, 0)).toBeNull()
    expect(coverGeometry(Number.NaN, 100)).toBeNull()
    expect(coverGeometry(100, Infinity)).toBeNull()
  })
})
