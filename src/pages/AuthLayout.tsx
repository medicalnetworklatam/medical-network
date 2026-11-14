import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './Auth.module.css'

/** The frame of the login screens: header, then a white card with the title */
export default function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.siteHeader}>
          <Link className={styles.brand} to="/">Medical Network</Link>
        </header>
        <main className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </main>
      </div>
    </div>
  )
}
