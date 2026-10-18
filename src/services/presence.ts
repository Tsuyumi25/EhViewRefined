export const PRESENCE_ATTRIBUTE = 'data-evr-version'

/**
 * Marks the document so other scripts can tell Eh View Refined is running. A DOM
 * attribute is readable from every userscript sandbox and is state rather than
 * an event, so a script that starts later still sees it. At document-start the
 * root element may not exist yet; the mark then waits for it.
 */
export function announcePresence(doc: Document, version: string): void {
  if (doc.documentElement) {
    doc.documentElement.setAttribute(PRESENCE_ATTRIBUTE, version)
    return
  }
  const observer = new MutationObserver(() => {
    if (!doc.documentElement) return
    observer.disconnect()
    doc.documentElement.setAttribute(PRESENCE_ATTRIBUTE, version)
  })
  observer.observe(doc, { childList: true })
}
