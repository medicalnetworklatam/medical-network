import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../lib/auth.ts'
import { authErrorMessage, MISSING_CONFIG } from '../lib/authErrors.ts'
import { safeInternalPath } from '../lib/safePath.ts'
import { usePageTitle } from '../lib/usePageTitle.ts'
import AuthLayout from './AuthLayout.tsx'
import Loading from './Loading.tsx'
import styles from './Auth.module.css'

/** Log in with email and password */
export default function IniciarSesion() {
  usePageTitle('Iniciar sesión · Medical Network')
  const { session, loading } = useAuth()
  const location = useLocation()
  const came = location.state as { from?: unknown; signedOut?: unknown } | null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(supabase ? '' : MISSING_CONFIG)
  const [invalid, setInvalid] = useState<'email' | 'password' | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  if (loading) return <Loading />
  // Logged in (already, or just now): go to the page they wanted, but only
  // if it's an address on this site; otherwise to Novedades.
  if (session) return <Navigate to={safeInternalPath(came?.from) ?? '/novedades'} replace />

  function fail(message: string, field: 'email' | 'password', ref: RefObject<HTMLInputElement | null>) {
    setError(message)
    setInvalid(field)
    ref.current?.focus()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return setError(MISSING_CONFIG)
    const address = email.trim()
    if (!address) return fail('Escribe tu correo electrónico.', 'email', emailRef)
    if (!/^[^\s@]+@[^\s@]+$/.test(address)) return fail('Revisa la dirección de correo.', 'email', emailRef)
    if (!password) return fail('Escribe tu contraseña.', 'password', passwordRef)

    setBusy(true)
    setError('')
    setInvalid(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: address, password })
      // On success the login above notices the new session and moves on
      if (error) fail(authErrorMessage(error), 'password', passwordRef)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Iniciar sesión">
      <div role="status">
        {came?.signedOut === true && !error && (
          <p className={styles.notice}>Tu sesión se ha cerrado.</p>
        )}
      </div>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">Correo electrónico</label>
          <input
            ref={emailRef} id="email" className={styles.input}
            type="email" autoComplete="username" inputMode="email" spellCheck={false}
            value={email} onChange={(e) => setEmail(e.target.value)}
            aria-invalid={invalid === 'email'} aria-describedby={error ? 'form-error' : undefined}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">Contraseña</label>
          <input
            ref={passwordRef} id="password" className={styles.input}
            type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            aria-invalid={invalid === 'password'} aria-describedby={error ? 'form-error' : undefined}
          />
        </div>

        <div aria-live="assertive">
          {error && <p className={styles.error} id="form-error">{error}</p>}
        </div>

        <button className={styles.submit} type="submit" disabled={busy || !supabase}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className={styles.links}>
        <Link className={styles.link} to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link>
      </p>
    </AuthLayout>
  )
}
