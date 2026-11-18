import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../lib/auth.ts'
import styles from './SessionButton.module.css'

/** The "Entrar" / "Cerrar sesión" pill. `onGreen` = inside the green sidebar.
    `redesign` = the new look, on redesigned screens (the home page); it only
    changes the look, never what the button does. */
export default function SessionButton({
  onGreen = false,
  redesign = false,
  className,
}: {
  onGreen?: boolean
  redesign?: boolean
  /** Its own look instead of the pill or chip (e.g. a row of the home
      page's menu). Then it always says the full "Cerrar sesión". */
  className?: string
}) {
  const { session, loading } = useAuth()
  const [busy, setBusy] = useState(false)
  const [justSignedOut, setJustSignedOut] = useState(false)
  const look = className ??
    styles.pill + (onGreen ? ' ' + styles.onGreen : '') + (redesign ? ' ' + styles.redesign : '')

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
        <button type="button" className={look} onClick={signOut} disabled={busy}>
          {className ? 'Cerrar sesión' : (
            <>
              <span className={styles.long}>Cerrar sesión</span>
              <span className={styles.short}>Salir</span>
            </>
          )}
        </button>
      ) : (
        <Link className={look} to="/iniciar-sesion">Entrar</Link>
      )}
    </>
  )
}
