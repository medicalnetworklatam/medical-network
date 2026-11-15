import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './Auth.module.css'

/** The frame of the login screens (and /perfil): header, then a white card
    with the title. `headerAction` goes at the right of the header, e.g. the
    "Cerrar sesión" pill. */
export default function AuthLayout({ title, headerAction, children }: {
  title: string
  headerAction?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.siteHeader}>
          <Link className={styles.brand} to="/">Medical Network</Link>
          {headerAction}
        </header>
        <main className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </main>
      </div>
    </div>
  )
}
