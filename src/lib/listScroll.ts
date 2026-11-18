/* Going back from a full news post to the Novedades list returns the reader
   to where they were in the list.

   The list saves how far down the page it was (window.scrollY) just before
   a post is opened, keyed by the list's own history entry (React Router's
   location.key), in sessionStorage: the browser keeps it for this tab only,
   and forgets it when the tab is closed. When the reader comes back to that
   same entry (Back), the list scrolls there again once its posts are on
   screen.

   sessionStorage can be missing or refuse to work (e.g. Safari's private
   mode, or storage blocked by the browser's settings). Every read and write
   is wrapped in try/catch: without it, the list simply opens at the top. */

const PREFIX = 'mnl-novedades-scroll:'

/** Remembers the list's scroll position for its history entry */
export function saveListScroll(key: string, y: number): void {
  try {
    sessionStorage.setItem(PREFIX + key, String(Math.max(0, Math.round(y))))
  } catch {
    /* storage not available: going back opens the list at the top */
  }
}

/** The saved scroll position for this history entry, or null */
export function readListScroll(key: string): number | null {
  try {
    const value = sessionStorage.getItem(PREFIX + key)
    if (value === null) return null
    const y = Number(value)
    return Number.isFinite(y) && y >= 0 ? y : null
  } catch {
    return null
  }
}

/** What a post opened from the list carries in its history entry
    (React Router's location state): "the page before this one, in this
    tab, is the list". Opening a shared link or a new tab carries nothing. */
export interface FromList {
  fromList: true
}

export function cameFromList(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as Partial<FromList>).fromList === true
}
