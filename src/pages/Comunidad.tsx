import { useLayoutEffect, type CSSProperties } from 'react'
import { Link } from 'react-router'
import PostBoard from './PostBoard.tsx'
import SessionButton from './SessionButton.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { useAuth } from '../lib/auth.ts'
import { authorName, useProfile } from '../lib/profile.ts'
import styles from './Comunidad.module.css'

/** The community board: one board for all members (text only). Paid members
    and admins read and write; free users only see a short message. */
export default function Comunidad() {
  usePageTitle('Comunidad · Medical Network')
  const { session } = useAuth()
  const { profile } = useProfile()
  const userId = session?.user.id ?? null
  const isAdmin = profile?.is_admin === true
  // The database (RLS) decides in the end; this only avoids useless requests
  const canRead = profile?.plan === 'paid' || isAdmin

  // The page's own background, colour and font on <body>, only while it is open
  useLayoutEffect(() => {
    document.body.classList.add(styles.pageBody)
    return () => document.body.classList.remove(styles.pageBody)
  }, [])

  /* The title's size comes from its length ("comunidad." = 10), set from
     code (React's style prop): the site's CSP blocks style="..." attributes */
  const titleStyle = { '--title-chars': 10 } as CSSProperties

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.pill} to="/novedades">
          <span aria-hidden="true">←</span> Novedades
        </Link>
        <SessionButton redesign />
      </header>

      <main className={styles.main}>
        <div className={styles.head}>
          <p className={styles.label}>tu</p>
          <h1 className={styles.pageTitle} style={titleStyle}>
            Comunidad<span aria-hidden="true">.</span>
          </h1>
        </div>

        {profile && !profile.main_state && (
          <p className={styles.reminder}>
            Aún no has elegido tu estado.{' '}
            <Link className={styles.reminderLink} to="/estados">Elegir mi estado</Link>
          </p>
        )}

        {canRead && userId && profile ? (
          <div className={styles.board}>
            <PostBoard
              key={userId}
              userId={userId}
              isAdmin={isAdmin}
              shownName={authorName(profile.first_name ?? '', profile.last_names ?? '')}
            />
          </div>
        ) : (
          <p className={styles.message}>La comunidad es para miembros con el paquete completo.</p>
        )}
      </main>
    </div>
  )
}
