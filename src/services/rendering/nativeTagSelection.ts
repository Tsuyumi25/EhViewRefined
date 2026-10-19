/** Which tags a native view draws: none, My Tags only, or My Tags followed by the others. */
export type TagSelection = 'none' | 'styled' | 'styled-first'

/** Each kind of tag the reader asked to see in full, whatever the view's own rule leaves out. */
export interface TagCompleteness {
  styled: boolean
  plain: boolean
}

const TAG_LIMIT = 12

export interface SelectableTag {
  styled: boolean
}

/**
 * The site's rule for each view caps what it draws at twelve tags; a kind of
 * tag asked for in full is drawn without that rule. Views that put My Tags
 * first keep that order, the rest keep the source order.
 */
export function selectTagIndexes(
  tags: readonly SelectableTag[],
  selection: TagSelection,
  complete: TagCompleteness,
): number[] {
  const styled: number[] = []
  const plain: number[] = []
  for (let index = 0; index < tags.length; index++) (tags[index].styled ? styled : plain).push(index)

  const shownStyled = complete.styled ? styled : selection === 'none' ? [] : styled.slice(0, TAG_LIMIT)
  const room = Math.max(0, TAG_LIMIT - shownStyled.length)
  const shownPlain = complete.plain ? plain : selection === 'styled-first' ? plain.slice(0, room) : []
  if (selection === 'styled-first') return [...shownStyled, ...shownPlain]
  return [...shownStyled, ...shownPlain].sort((a, b) => a - b)
}
