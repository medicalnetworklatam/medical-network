import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../lib/auth.ts'
import styles from './SessionButton.module.css'

/** The "Entrar" / "Cerrar sesión" pill. `onGreen` = inside the green sidebar. */
export default function SessionButton({ onGreen = false }: { onGreen?: boolean }) {
  const { session, loading } = useAuth()
  const [busy, setBusy] = useState(false)
  const [justSignedOut, setJustSignedOut] = useState(false)
  const className = styles.pill + (onGreen ? ' ' + styles.onGreen : '')

  async function signOut() {
    if (!supabase) return
    setBusy(true)
    // "local" = log out this device only (a phone and a PC stay separate).
    // The login is removed from the browser even without internet.
    await supabase.auth.signOut({ scope: 'local' })
    setBusy(false)
    setJustSignedOut(true)
  }

  return (
    <>
      {/* Spoken by screen readers; pages that need a login go to the
          login screen instead, which says it too */}
      <span className="sr-only" role="status">{justSignedOut && !session ? 'Has cerrado sesión.' : ''}</span>
      {loading ? null : session ? (
        <button type="button" className={className} onClick={signOut} disabled={busy}>
          <span className={styles.long}>Cerrar sesión</span>
          <span className={styles.short}>Salir</span>
        </button>
      ) : (
        <Link className={className} to="/iniciar-sesion">Entrar</Link>
      )}
    </>
  )
}
