import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../lib/auth.ts'
import { authErrorMessage, MISSING_CONFIG } from '../lib/authErrors.ts'
import { usePageTitle } from '../lib/usePageTitle.ts'
import AuthLayout from './AuthLayout.tsx'
import Loading from './Loading.tsx'
import styles from './Auth.module.css'

const MIN_LENGTH = 8 // also set in Supabase, so the server enforces it too

/** Set a password. Invite links (?type=invite) and reset links
    (?type=recovery) from the emails land here, with a one-time code
    (token_hash). A logged-in person can also come here to change it. */
export default function NuevaContrasena() {
  const [params, setParams] = useSearchParams()
  // Read once: the code is removed from the address after it's used
  const [tokenHash] = useState(() => params.get('token_hash'))
  const [isInvite] = useState(() => params.get('type') === 'invite')
  const title = isInvite ? 'Crea tu contraseña' : 'Nueva contraseña'
  usePageTitle(title + ' · Medical Network')

  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [verified, setVerified] = useState(false)
  const [linkFailed, setLinkFailed] = useState(false)
  const [error, setError] = useState(supabase ? '' : MISSING_CONFIG)
  const [invalid, setInvalid] = useState<'password' | 'confirm' | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  function fail(message: string, field: 'password' | 'confirm', ref: RefObject<HTMLInputElement | null>) {
    setError(message)
    setInvalid(field)
    ref.current?.focus()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return setError(MISSING_CONFIG)
    if (password.length < MIN_LENGTH) {
      return fail(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`, 'password', passwordRef)
    }
    if (password !== confirm) return fail('Las dos contraseñas no coinciden.', 'confirm', confirmRef)

    setBusy(true)
    setError('')
    setInvalid(null)
    try {
      // The one-time code is only used now, when the person presses the
      // button. Email programs that open links to scan them can't use it up.
      if (tokenHash && !verified) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: isInvite ? 'invite' : 'recovery',
        })
        if (error) {
          setLinkFailed(true)
          setError(isInvite
            ? 'Esta invitación ha caducado o ya se usó. Si ya creaste tu contraseña, inicia sesión. Si no, pide a Medical Network una invitación nueva.'
            : authErrorMessage(error))
          return
        }
        setVerified(true) // now logged in; a retry only needs the step below
        setParams({}, { replace: true })
      }

      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        if (error.code === 'same_password' || error.code === 'weak_password') {
          fail(authErrorMessage(error), 'password', passwordRef)
        } else {
          setError(authErrorMessage(error))
        }
        return
      }
      setDone(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  if (done) {
    return (
      <AuthLayout title="Contraseña guardada">
        <p className={styles.notice} role="status">
          Listo. A partir de ahora entras con tu correo y esta contraseña.
        </p>
        <Link className={styles.submit} to="/novedades">Continuar</Link>
      </AuthLayout>
    )
  }

  // No code in the address and not logged in: an incomplete or old link
  if (!tokenHash && !session) {
    return (
      <AuthLayout title="Enlace no válido">
        <p className={styles.intro}>
          Este enlace no es válido o está incompleto. Abre el enlace del correo
          más reciente que te enviamos, o pide uno nuevo.
        </p>
        <p className={styles.links}>
          <Link className={styles.link} to="/recuperar-contrasena">Pedir un enlace nuevo</Link>
          <Link className={styles.link} to="/iniciar-sesion">Iniciar sesión</Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={title}>
      <p className={styles.intro}>
        {isInvite
          ? 'Te damos la bienvenida a Medical Network. Elige una contraseña para entrar a tu cuenta.'
          : 'Elige una contraseña nueva para tu cuenta.'}
      </p>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">Contraseña nueva</label>
          <p className={styles.hint} id="password-hint">Al menos {MIN_LENGTH} caracteres.</p>
          <input
            ref={passwordRef} id="password" className={styles.input}
            type="password" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            aria-invalid={invalid === 'password'}
            aria-describedby={'password-hint' + (error ? ' form-error' : '')}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="confirm">Repite la contraseña</label>
          <input
            ref={confirmRef} id="confirm" className={styles.input}
            type="password" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={invalid === 'confirm'} aria-describedby={error ? 'form-error' : undefined}
          />
        </div>

        <div aria-live="assertive">
          {error && <p className={styles.error} id="form-error">{error}</p>}
        </div>

        <button className={styles.submit} type="submit" disabled={busy || !supabase}>
          {busy ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>

      {linkFailed && (
        <p className={styles.links}>
          <Link className={styles.link} to="/recuperar-contrasena">Pedir un enlace nuevo</Link>
          <Link className={styles.link} to="/iniciar-sesion">Iniciar sesión</Link>
        </p>
      )}
    </AuthLayout>
  )
}
