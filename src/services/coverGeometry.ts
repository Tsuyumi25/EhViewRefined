export function coverGeometry(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  const scaledHeight = Math.round(height * 250 / width)
  const frameHeight = Math.min(340, scaledHeight)
  return {
    width: 250,
    height: scaledHeight,
    frameHeight,
    top: Math.trunc((frameHeight - scaledHeight) / 2),
  }
}
