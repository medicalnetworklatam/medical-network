import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../lib/auth.ts'
import { needsName, useProfile } from '../lib/profile.ts'
import AuthLayout from './AuthLayout.tsx'
import Loading from './Loading.tsx'
import SessionButton from './SessionButton.tsx'
import styles from './Auth.module.css'

/** Wraps every page that needs a login. Logged-out visitors go to the login
    screen, which remembers where they wanted to go. Logged-in users wait for
    their profile; without a first name they do the name step (/perfil) first,
    which then sends them on to where they were going. */
export default function RequireLogin() {
  const { session, loading } = useAuth()
  const { status, profile } = useProfile()
  const location = useLocation()
  // Was someone logged in while this page was open? Then the login just
  // ended ("Cerrar sesión", or it ran out), and the login screen says so.
  const [hadSession, setHadSession] = useState(false)
  if (session && !hadSession) setHadSession(true)

  if (loading) return <Loading />
  const from = location.pathname + location.search + location.hash
  if (!session) {
    return <Navigate to="/iniciar-sesion" replace state={{ from, signedOut: hadSession }} />
  }

  if (status === 'loading' || status === 'none') return <Loading />
  if (status === 'error') return <ProfileError />
  if (status === 'missing' || !profile) {
    return (
      <AuthLayout title="Tu cuenta" headerAction={<SessionButton redesign />}>
        <p className={styles.error} role="alert">Tu cuenta no está lista. Contáctanos.</p>
      </AuthLayout>
    )
  }

  if (needsName(profile) && location.pathname !== '/perfil') {
    return <Navigate to="/perfil" replace state={{ from }} />
  }
  return <Outlet />
}

/** The profile couldn't be loaded (e.g. no internet): say so, offer to retry */
function ProfileError() {
  const { error, reload } = useProfile()
  const [busy, setBusy] = useState(false)

  async function retry() {
    setBusy(true)
    await reload()
    setBusy(false)
  }

  return (
    <AuthLayout title="Tu cuenta" headerAction={<SessionButton redesign />}>
      <p className={styles.intro}>No pudimos cargar tus datos.</p>
      <div aria-live="assertive">
        <p className={styles.error}>{error}</p>
      </div>
      <button type="button" className={styles.submit} onClick={retry} disabled={busy}>
        {busy ? 'Cargando…' : 'Reintentar'}
      </button>
    </AuthLayout>
  )
}
