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

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link className={styles.pill} to="/novedades">
            <span aria-hidden="true">←</span> Novedades
          </Link>
          <SessionButton />
        </header>

        <main className={styles.main}>
          <h1 className={styles.pageTitle}>COMUNIDAD</h1>

          {profile && !profile.main_state && (
            <p className={styles.reminder}>
              Aún no has elegido tu estado.{' '}
              <Link className={styles.reminderLink} to="/estados">Elegir mi estado</Link>
            </p>
          )}

          {canRead && userId && profile ? (
            <PostBoard
              key={userId}
              userId={userId}
              isAdmin={isAdmin}
              shownName={authorName(profile.first_name ?? '', profile.last_names ?? '')}
            />
          ) : (
            <p className={styles.message}>La comunidad es para miembros con el paquete completo.</p>
          )}
        </main>
      </div>
    </div>
  )
}
