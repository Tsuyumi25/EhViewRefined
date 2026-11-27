/** Whether the element is laid out at all; checkVisibility is missing before Safari 17.4 and in jsdom */
export function isVisible(element: HTMLElement): boolean {
  return typeof element.checkVisibility === 'function'
    ? element.checkVisibility()
    : element.offsetParent !== null
}
