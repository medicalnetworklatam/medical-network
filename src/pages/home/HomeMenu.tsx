import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import SessionButton from '../SessionButton.tsx'
import { useAuth } from '../../lib/auth.ts'
import styles from '../Home.module.css'

const CALENDLY = 'https://calendly.com/ivan-ab89/ruta-approbation'

/** The home page's "Menú": a button that opens a short list of links under
    it (DECISIONS.md, 18 Nov 2026):
    - logged out: "Aplicar a Ruta Approbation" (Calendly, new tab), "Entrar"
    - logged in:  "Aplicar a Ruta Approbation", "Mi área", "Cerrar sesión"
    Keyboard: Enter/Space opens and closes it, Up/Down move between the
    links, Escape closes it and puts the focus back on the button. Clicking
    outside, tabbing out or choosing a link also closes it. */
export default function HomeMenu() {
  const { session, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // While open: a click or tap anywhere outside the menu closes it
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // "Cerrar sesión" pressed in the menu: once the login has ended, close the
  // menu, give the focus back to "Menú" (the pressed button is gone) and say
  // so to screen readers. Worked out while drawing, like RequireLogin does.
  const [hadSession, setHadSession] = useState(false)
  if (session && !hadSession) setHadSession(true)
  if (!session && !loading && hadSession) {
    setHadSession(false)
    if (open) {
      setOpen(false)
      setAnnouncement('Has cerrado sesión.')
    }
  }
  // (the announcement is only ever set here, so it marks that moment)
  useEffect(() => {
    if (announcement) btnRef.current?.focus()
  }, [announcement])

  function close(focusButton: boolean) {
    setOpen(false)
    if (focusButton) btnRef.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) return
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('a, button') ?? [])
    if (items.length === 0) return
    e.preventDefault()
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown'
      ? (i < 0 ? 0 : (i + 1) % items.length)
      : (i < 0 ? items.length - 1 : (i - 1 + items.length) % items.length)
    items[next].focus()
  }

  // Tabbing out of the menu closes it
  function onBlur(e: FocusEvent) {
    if (open && !wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
  }

  return (
    <div className={styles.menu} ref={wrapRef} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={btnRef}
        className={styles.menuBtn}
        type="button"
        aria-expanded={open}
        aria-controls="home-menu"
        onClick={() => { setAnnouncement(''); setOpen((o) => !o) }}
      >
        <span>Menú</span>
        <span className={styles.menuBtnIcon} aria-hidden="true"></span>
      </button>

      <ul className={styles.menuList} id="home-menu" ref={listRef} hidden={!open}>
        <li>
          <a
            className={styles.menuItem} href={CALENDLY}
            target="_blank" rel="noopener noreferrer"
            onClick={() => close(false)}
          >
            <span>Aplicar a Ruta <span lang="de">Approbation</span></span>
            <span className={styles.menuItemArrow} aria-hidden="true">↗</span>
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
        </li>
        {loading ? null : session ? (
          <>
            <li>
              <Link className={styles.menuItem} to="/novedades" onClick={() => close(false)}>Mi área</Link>
            </li>
            <li>
              <SessionButton className={styles.menuItem} />
            </li>
          </>
        ) : (
          <li>
            <Link className={styles.menuItem} to="/iniciar-sesion" onClick={() => close(false)}>Entrar</Link>
          </li>
        )}
      </ul>

      <span className="sr-only" role="status">{announcement}</span>
    </div>
  )
}
