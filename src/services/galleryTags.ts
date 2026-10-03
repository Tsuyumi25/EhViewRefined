export interface GalleryTag {
  name: string
  borderStyle: 'solid' | 'dashed' | 'dotted'
}

export function galleryTagData(row: HTMLTableRowElement): string {
  const cached = row.getAttribute('data-evr-tags')
  if (cached !== null) return cached
  const tags = row.querySelectorAll<HTMLElement>('.gl4e .gt, .gl4e .gtl, .gl4e .gtw')
  const data = JSON.stringify(Array.from(tags, (tag): GalleryTag => ({
    name: tag.title,
    borderStyle: tag.classList.contains('gtw')
      ? 'dotted'
      : tag.classList.contains('gtl') ? 'dashed' : 'solid',
  })))
  row.setAttribute('data-evr-tags', data)
  return data
}
