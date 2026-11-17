/* TEMPORARY: the palette switcher, until the owner chooses a palette
   (DECISIONS.md, 17 Nov 2026 evening). Once one is chosen: make it the
   :root default in src/styles/redesign.css, delete the other palettes
   there, delete this file and src/pages/home/PaletteMenu.tsx, remove the
   applySavedPalette() call in main.tsx, and give "Menú" back its job as
   a menu.

   The choice is set as data-palette on <html> (only the redesigned
   screens use the colours it changes) and remembered in this browser
   only (localStorage), so it carries over to every redesigned page. */

export interface Palette {
  id: string
  name: string
}

/** The five candidates, in the order "Menú" cycles them. The first is the
    default: it has no data-palette attribute. */
export const PALETTES: readonly Palette[] = [
  { id: 'negativo', name: 'Negativo' },
  { id: 'bello', name: 'Bello' },
  { id: 'impasto', name: 'Impasto' },
  { id: 'mnl', name: 'MNL actual' },
  { id: 'flatline', name: 'Flatline' },
]

const KEY = 'mnl-palette'

/** Position in PALETTES of the saved choice. Anything that isn't one of the
    five known ids (nothing saved, an old value, a hand-edited value, storage
    blocked) counts as the default, 0. */
export function savedPaletteIndex(): number {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(KEY)
  } catch {
    /* storage blocked (e.g. private mode): use the default */
  }
  const i = PALETTES.findIndex((p) => p.id === saved)
  return i < 0 ? 0 : i
}

/** Shows the page in PALETTES[i]. Only ever writes one of the known ids. */
function setOnPage(i: number): void {
  const root = document.documentElement
  const p = PALETTES[i] ?? PALETTES[0]
  if (p.id === PALETTES[0].id) root.removeAttribute('data-palette')
  else root.setAttribute('data-palette', p.id)
}

/** At start-up (main.tsx): show the saved palette. Nothing is written back. */
export function applySavedPalette(): void {
  setOnPage(savedPaletteIndex())
}

/** "Menú" was pressed with PALETTES[i] chosen: show it and remember it. */
export function choosePalette(i: number): void {
  setOnPage(i)
  try {
    localStorage.setItem(KEY, PALETTES[i].id)
  } catch {
    /* storage blocked: the choice lasts until the page is reloaded */
  }
}
