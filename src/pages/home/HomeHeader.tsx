import type { Ref } from 'react'
import { Link } from 'react-router'
import SessionButton from '../SessionButton.tsx'
import { useAuth } from '../../lib/auth.ts'
import { home, sections } from '../../content/home.ts'
import { Rich } from './Rich.tsx'
import CallLink from './CallLink.tsx'
import HomeMenu from './HomeMenu.tsx'
import styles from '../Home.module.css'

/** The home page's fixed dark header (DECISIONS.md, 24 Nov 2026).
    - From 1024px: the name, the links to the sections, "Entrar" (or
      "Mi área" and "Cerrar sesión") and, from 1280px, the Calendly pill.
    - From 768px to 1023px: the name, the Calendly pill and "Menú".
    - Phones: the name and "Menú" (HomeMenu.tsx), which holds everything.
    The section links are real anchors (#historias…): they work without
    any script, and scroll smoothly only when "reduce motion" is off. */
export default function HomeHeader({ ref }: { ref?: Ref<HTMLElement> }) {
  const { session, loading } = useAuth()

  return (
    <header className={styles.header} ref={ref}>
      <div className={styles.headerInner}>
        <a className={styles.brand} href="#inicio">{home.header.name}</a>

        <nav className={styles.nav} aria-label={home.header.navLabel}>
          <ul className={styles.navList}>
            {sections.map((s) => (
              <li key={s.id}>
                <a className={styles.navLink} href={`#${s.id}`}><span><Rich text={s.label} /></span></a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.headerSession}>
          {loading ? null : session ? (
            <>
              <Link className={styles.navLink} to="/novedades">{home.header.myArea}</Link>
              <SessionButton className={styles.navLink} />
            </>
          ) : (
            <Link className={styles.navLink} to="/iniciar-sesion">{home.header.login}</Link>
          )}
        </div>

        <CallLink className={`${styles.btn} ${styles.btnPrimary} ${styles.headerPill}`} />

        <HomeMenu />
      </div>
    </header>
  )
}
