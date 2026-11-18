import { useLayoutEffect, type CSSProperties, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import SessionButton from './SessionButton.tsx'
import styles from './Admin.module.css'

/** The frame of the admin pages, in the new look: a dark top bar (back to
    Novedades, "Cerrar sesión"), the two admin sections as tab cells, then
    the title cell ("ADMINISTRACIÓN" over "clientes."). `wide` = one column
    across the whole width (the client table); otherwise the page's cells
    may sit in two columns on large screens. */
export default function AdminLayout({ title, wide = false, children }: {
  title: string
  wide?: boolean
  children: ReactNode
}) {
  const { pathname } = useLocation()
  const onNews = pathname.startsWith('/admin/novedades')

  // The page's own background, colour and font on <body>, only while it is open
  useLayoutEffect(() => {
    document.body.classList.add(styles.pageBody)
    return () => document.body.classList.remove(styles.pageBody)
  }, [])

  /* The title's size comes from its longest word (plus the full stop), set
     from code (React's style prop): the site's CSP blocks style="..." */
  const titleChars = Math.max(...title.split(' ').map((w) => w.length)) + 1
  const titleStyle = { '--title-chars': titleChars } as CSSProperties

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.pill} to="/novedades">
          <span aria-hidden="true">←</span> Novedades
        </Link>
        <SessionButton redesign />
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
        <div className={styles.head}>
          <p className={styles.headLabel}>administración</p>
          <h1 className={styles.pageTitle} style={titleStyle}>
            {title}<span aria-hidden="true">.</span>
          </h1>
        </div>
        <div className={styles.body + (wide ? ' ' + styles.isWide : '')}>
          {children}
        </div>
      </main>
    </div>
  )
}
