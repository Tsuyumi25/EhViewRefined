/** Extended responses omit the native Thumbnail page's inline grid rules. */
export function installNativeThumbnailStyles(doc: Document): void {
  if (doc.getElementById('evr-native-thumbnail-style')) return
  const style = doc.createElement('style')
  style.id = 'evr-native-thumbnail-style'
  style.textContent = `
@supports (display: grid) {
  .gld { display: grid; grid-template-columns: repeat(5, 1fr); }
  .gl1t { min-width: 250px; max-width: 400px; }
  @media screen and (max-width: 1360px) { .gld { grid-template-columns: repeat(4, 1fr); } }
  @media screen and (max-width: 1090px) { .gld { grid-template-columns: repeat(3, 1fr); } }
  @media screen and (max-width: 820px) { .gld { grid-template-columns: repeat(2, 1fr); } }
}`
  ;(doc.head ?? doc.documentElement).append(style)
}
