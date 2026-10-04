export type TagSelection = 'none' | 'styled' | 'styled-first' | 'all'

const TAG_LIMIT = 12

export interface SelectableTag {
  styled: boolean
}

export function selectTagIndexes(tags: readonly SelectableTag[], selection: TagSelection): number[] {
  const selected: number[] = []
  if (selection === 'none') return selected
  if (selection === 'all') {
    for (let index = 0; index < tags.length; index++) selected.push(index)
    return selected
  }
  for (let index = 0; index < tags.length && selected.length < TAG_LIMIT; index++) {
    if (tags[index].styled) selected.push(index)
  }
  if (selection === 'styled-first') {
    for (let index = 0; index < tags.length && selected.length < TAG_LIMIT; index++) {
      if (!tags[index].styled) selected.push(index)
    }
  }
  return selected
}
