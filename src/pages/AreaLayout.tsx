import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import SessionButton from './SessionButton.tsx'
import CalendarPreview from './CalendarPreview.tsx'
import { useProfile } from '../lib/profile.ts'
import { MAP_SHAPES } from '../estados/mapShapes.ts'
import styles from './AreaLayout.module.css'

/** Which page is open, so the column can mark it */
export type AreaPage = 'novedades' | 'expediente' | 'comunidad' | 'chat' | 'contacto'

/** The client area's frame, shared by Novedades, Mi expediente, Comunidad,
    Chat and Contacto: the dark column on the left (on a phone, a bar with "Menú"),
    the page's own content on the right, and on a phone a floating link to
    the chat.

    Column order (DECISIONS.md, 18 Nov 2026, afternoon; Contacto added by
    Ivan on 20 Nov 2026, Mi expediente on 21 Nov 2026): Mi perfil,
    Novedades, Mi expediente, Comunidad MNL, Chat de <Bundesland>, Administración (admins
    only), Calendario, Contacto, Cerrar sesión. The current page is
    marked. */
export default function AreaLayout({ current, children }: { current: AreaPage; children: ReactNode }) {
  const { profile } = useProfile()
  const firstName = profile?.first_name?.trim().split(/\s+/)[0] ?? ''
  /* German name of the user's own state, '' when none is chosen yet */
  const name = MAP_SHAPES.find((s) => s.id === profile?.main_state)?.name ?? ''

  /* The menu: open or closed on a phone (it starts closed). On larger
     screens the column is always open and the button is hidden. Each page
     has its own copy of this frame, so the menu is closed again after
     moving to another page. */
  const [menuOpen, setMenuOpen] = useState(false)

  /* The link to the state's chat: "Chat de Bayern", or just "Chat" */
  const chatLabel = name ? <>Chat de <span lang="de">{name}</span></> : 'Chat'
  /* The floating chat link: not on the chat itself */
  const showFab = current !== 'chat'

  /* A row of the column; the current page's row is marked */
  function row(page: AreaPage, to: string, label: ReactNode) {
    const isCurrent = page === current
    return (
      <Link
        className={styles.row + (isCurrent ? ' ' + styles.isCurrent : '')}
        to={to} aria-current={isCurrent ? 'page' : undefined}
      >
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <div className={styles.layout}>

      {/* Left: the column (on a phone, a bar with the menu below it) */}
      <nav className={styles.column + (menuOpen ? ' ' + styles.isOpen : '')} aria-label="Menú">
        <div className={styles.bar}>
          <Link className={styles.profile} to="/perfil">
            <span className={styles.label}>Mi perfil</span>
            <span className={styles.profileName}>{firstName}</span>
          </Link>
          <button
            type="button" className={styles.menuBtn}
            aria-expanded={menuOpen} aria-controls="area-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span>Menú</span>
            <span className={styles.menuBtnIcon} aria-hidden="true"></span>
          </button>
        </div>

        <div className={styles.menuBody} id="area-menu">
          {row('novedades', '/novedades', 'Novedades')}
          {row('expediente', '/expediente', 'Mi expediente')}
          {row('comunidad', '/comunidad', 'Comunidad MNL')}
          {row('chat', '/chat', chatLabel)}

          {/* Admins only. Hiding the link is not the protection: the admin
              pages check again, and the database decides (RLS). */}
          {profile?.is_admin === true && (
            <Link className={styles.row} to="/admin">Administración</Link>
          )}

          {/* Calendar: preview only, it doesn't work yet */}
          <CalendarPreview />

          {row('contacto', '/contacto', 'Contacto')}

          <div className={styles.session}>
            <SessionButton />
          </div>
        </div>
      </nav>

      {/* Right: the page itself (its own <main>) */}
      <div className={styles.content + (showFab ? ' ' + styles.hasFab : '')}>
        {children}
      </div>

      {/* Phone only: floating link to the state's chat */}
      {showFab && (
        <Link className={styles.chatFab} to="/chat">
          <span className={styles.chatFabLabel}>{chatLabel}</span>
        </Link>
      )}
    </div>
  )
}
