import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import SessionButton from './SessionButton.tsx'
import styles from './Admin.module.css'

/** Where the page's one back link goes, and its words */
export interface Back {
  to: string
  label: string
}

/** How the page's cells are laid out:
    - wide: across the whole width (tables, forms, a client's pages)
    - hub: the big link-buttons, filling the rest of the screen */
export type AdminBody = 'wide' | 'hub'

/** The frame of the admin pages (DECISIONS.md, 21 Nov 2026, night, later):
    a dark top bar with the page's one back link and "Cerrar sesión", then
    the title cell (a small label over a big title, "ADMINISTRACIÓN" over
    "clientes."). Titles are lowercase with a full stop, except a client's
    name or a post's title (`nameTitle`), which keeps its own capitals and
    has no full stop; `nameLabel` does the same for the small label.
    `compact`: a low title cell (a section page), with room on the right for
    `action` ("Actualizar"). */
export default function AdminLayout({
  title, label = 'administración', nameLabel = false, nameTitle = false, clientTitle = false, titleNote,
  compact = false, action, back = { to: '/novedades', label: 'Novedades' }, body = 'wide', children,
}: {
  title: string
  /** null: no label */
  label?: string | null
  nameLabel?: boolean
  nameTitle?: boolean
  /** A client's hub: a smaller title, for long names */
  clientTitle?: boolean
  /** Small text under the title (the email of a client without a name) */
  titleNote?: ReactNode
  compact?: boolean
  /** A button in the title cell, on the right ("Actualizar") */
  action?: ReactNode
  back?: Back
  body?: AdminBody
  children: ReactNode
}) {
  /* The title's size comes from its longest word (plus the full stop), set
     from code (React's style prop): the site's CSP blocks style="..." */
  const titleChars = Math.max(...title.split(' ').map((w) => w.length)) + 1
  const titleStyle = { '--title-chars': titleChars } as CSSProperties
  const bodyClass = body === 'hub' ? ' ' + styles.isHub : ''

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.pill} to={back.to}>
          <span aria-hidden="true">←</span> <span className={styles.pillText}>{back.label}</span>
        </Link>
        <SessionButton />
      </header>

      <main className={styles.main}>
        <div className={styles.head + (compact ? ' ' + styles.isCompact : '')}>
          {label !== null && (
            <p className={styles.headLabel + (nameLabel ? ' ' + styles.isName : '')}>{label}</p>
          )}
          <h1
            className={styles.pageTitle + (clientTitle ? ' ' + styles.isClient : '')
              + (compact ? ' ' + styles.isCompact : '') + (nameTitle ? ' ' + styles.isName : '')}
            style={titleStyle}
          >
            {title}{!nameTitle && <span aria-hidden="true">.</span>}
          </h1>
          {titleNote && <p className={styles.titleNote}>{titleNote}</p>}
          {action && <div className={styles.headAction}>{action}</div>}
        </div>
        <div className={styles.body + bodyClass}>
          {children}
        </div>
      </main>
    </div>
  )
}

/** One big link-button of a hub page: a filled black cell (Alerta when an
    admin has to act), its name, and a one-line status under it. The whole
    cell is the link. */
export interface BigLinkItem {
  to: string
  title: string
  /** Plain text (or text with lang="de" spans); nothing = no status line */
  status?: ReactNode
  alerta?: boolean
}

export function BigLinks({ label, items, low = false }: {
  label: string
  items: BigLinkItem[]
  /** A single low button at the top of a list page ("Nueva novedad") */
  low?: boolean
}) {
  return (
    <nav className={styles.bigNav + (low ? ' ' + styles.isLow : '')} aria-label={label}>
      <ul className={styles.bigList}>
        {items.map((item) => (
          <li key={item.to} className={styles.bigItem}>
            <Link className={styles.bigLink + (item.alerta ? ' ' + styles.isAlerta : '')} to={item.to}>
              <span className={styles.bigTitle}>{item.title}</span>
              {item.status && <span className={styles.bigStatus}>{item.status}</span>}
              <span className={styles.bigArrow} aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
