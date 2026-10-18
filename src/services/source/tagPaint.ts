/**
 * Whether the site highlights a tag, read from the inline paint it served: the
 * site colours the tags in the user's My Tags with inline styles. Decided once,
 * when the row is collected, because other scripts restyle tags afterwards;
 * hiding a tag the moment its colours are switched off would empty the listing.
 */
export const PLAIN_TAG_MARK = 'data-evr-tag-plain'

const uncoloured: Record<string, true> = {
  '': true,
  none: true,
  transparent: true,
  currentcolor: true,
  inherit: true,
  initial: true,
  unset: true,
  revert: true,
  'revert-layer': true,
  auto: true,
}

function alphaOf(value: string): number | null {
  const body = /^[a-z]+\(([^()]*)\)$/.exec(value)?.[1]
  if (body === undefined) return null
  const slash = body.lastIndexOf('/')
  const parts = body.split(',')
  const raw = slash >= 0 ? body.slice(slash + 1) : parts.length === 4 ? parts[3] : null
  if (raw === null) return null
  const text = raw.trim()
  const percent = text.endsWith('%')
  const alpha = Number.parseFloat(percent ? text.slice(0, -1) : text)
  return Number.isNaN(alpha) ? null : percent ? alpha / 100 : alpha
}

export function isColourValue(value: string): boolean {
  const normalised = value.trim().toLowerCase()
  if (uncoloured[normalised]) return false
  return alphaOf(normalised) !== 0
}

export interface TagPaint {
  color: string
  backgroundColor: string
  backgroundImage: string
}

export function isHighlighted(paint: TagPaint): boolean {
  return (
    isColourValue(paint.color) ||
    isColourValue(paint.backgroundColor) ||
    isColourValue(paint.backgroundImage)
  )
}
