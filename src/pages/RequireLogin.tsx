import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../lib/auth.ts'
import Loading from './Loading.tsx'

/** Wraps every page that needs a login. Logged-out visitors go to the login
    screen, which remembers where they wanted to go. */
export default function RequireLogin() {
  const { session, loading } = useAuth()
  const location = useLocation()
  // Was someone logged in while this page was open? Then the login just
  // ended ("Cerrar sesión", or it ran out), and the login screen says so.
  const [hadSession, setHadSession] = useState(false)
  if (session && !hadSession) setHadSession(true)

  if (loading) return <Loading />
  if (!session) {
    const state = {
      from: location.pathname + location.search + location.hash,
      signedOut: hadSession,
    }
    return <Navigate to="/iniciar-sesion" replace state={state} />
  }
  return <Outlet />
}
