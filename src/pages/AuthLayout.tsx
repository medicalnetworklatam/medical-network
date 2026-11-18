import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './Auth.module.css'

/** The frame of the login screens, /perfil and the "Tu cuenta" screens, in
    the new look: a dark cell with the header and the title, and a light cell
    with the content (on a phone, one above the other). `headerAction` goes
    at the right of the header, e.g. the "Cerrar sesión" chip.

    The title is shown as a small label over a big lowercase word with a full
    stop: "Iniciar sesión" → INICIAR / sesión. Screen readers hear the
    heading's words as they are. */
export default function AuthLayout({ title, headerAction, children }: {
  title: string
  headerAction?: ReactNode
  children: ReactNode
}) {
  const words = title.split(' ')
  const word = words.pop() ?? ''
  const label = words.join(' ')
  /* The big word's size comes from its length (plus the full stop), so the
     longest ("contraseña.") still fits a phone. Set from code (React's style
     prop), never as a style="..." attribute: the site's CSP blocks those. */
  const titleStyle = { '--title-chars': word.length + 1 } as CSSProperties

  return (
    <div className={styles.page}>
      <header className={styles.siteHeader}>
        <Link className={styles.brand} to="/">Medical Network</Link>
        {headerAction}
      </header>
      <main className={styles.main}>
        <div className={styles.head}>
          <h1 className={styles.title} style={titleStyle}>
            {label && <><span className={styles.titleLabel}>{label}</span>{' '}</>}
            <span className={styles.titleWord}>{word}<span aria-hidden="true">.</span></span>
          </h1>
        </div>
        <div className={styles.card}>
          {children}
        </div>
      </main>
    </div>
  )
}
