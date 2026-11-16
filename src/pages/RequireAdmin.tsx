import { Navigate, Outlet } from 'react-router'
import { useProfile } from '../lib/profile.ts'

/** Wraps the admin pages (inside RequireLogin, so the profile is already
    loaded). They are only drawn when the loaded profile says is_admin = true;
    everyone else is sent to Novedades.

    This only hides the pages. What actually protects the data is the
    database (Row Level Security): a non-admin who got past this would still
    only be given their own rows, and their changes would be refused. */
export default function RequireAdmin() {
  const { profile } = useProfile()
  if (profile?.is_admin !== true) return <Navigate to="/novedades" replace />
  return <Outlet />
}
