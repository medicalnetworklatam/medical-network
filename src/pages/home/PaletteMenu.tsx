import { useEffect, useRef, useState } from 'react'
import { PALETTES, choosePalette, savedPaletteIndex } from '../../lib/palette.ts'
import styles from '../Home.module.css'

/* TEMPORARY (see src/lib/palette.ts): for now the "Menú" button switches
   between the five colour palettes, to compare them on the real page.
   The note under it names the one shown, for 2.2 seconds.
   From design-hero/palette.js. */
export default function PaletteMenu() {
  const [index, setIndex] = useState(savedPaletteIndex)
  const [note, setNote] = useState('')
  const [shown, setShown] = useState(false)
  const hideTimer = useRef(0)

  // Leaving the page: no timer left running
  useEffect(() => () => clearTimeout(hideTimer.current), [])

  function next() {
    const i = (index + 1) % PALETTES.length
    setIndex(i)
    choosePalette(i)
    setNote(`Paleta ${i + 1}/${PALETTES.length} · ${PALETTES[i].name}`)
    setShown(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setShown(false), 2200)
  }

  return (
    <div className={styles.menu}>
      <button
        className={styles.menuBtn}
        type="button"
        aria-describedby="palette-note"
        title="Cambiar paleta de colores"
        onClick={next}
      >
        <span>Menú</span>
        <span className={styles.menuBtnIcon} aria-hidden="true"></span>
      </button>
      <p
        className={styles.paletteNote + (shown ? ' ' + styles.isShown : '')}
        id="palette-note"
        aria-live="polite"
      >
        {note}
      </p>
    </div>
  )
}
