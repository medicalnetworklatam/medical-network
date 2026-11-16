import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import SessionButton from './SessionButton.tsx'
import styles from './Admin.module.css'

/** The frame of the admin pages: back to Novedades, "Cerrar sesión", the two
    admin sections, then the big title. `wide` gives the client table more room. */
export default function AdminLayout({ title, wide = false, children }: {
  title: string
  wide?: boolean
  children: ReactNode
}) {
  const { pathname } = useLocation()
  const onNews = pathname.startsWith('/admin/novedades')

  return (
    <div className={styles.page}>
      <div className={styles.container + (wide ? ' ' + styles.isWide : '')}>
        <header className={styles.header}>
          <Link className={styles.pill} to="/novedades">
            <span aria-hidden="true">←</span> Novedades
          </Link>
          <SessionButton />
        </header>

        <nav className={styles.tabs} aria-label="Administración">
          <Link className={styles.tab} to="/admin" aria-current={onNews ? undefined : 'page'}>
            Clientes
          </Link>
          <Link className={styles.tab} to="/admin/novedades" aria-current={onNews ? 'page' : undefined}>
            Publicar novedades
          </Link>
        </nav>

        <main className={styles.main}>
          <h1 className={styles.pageTitle}>{title}</h1>
          {children}
        </main>
      </div>
    </div>
  )
}
