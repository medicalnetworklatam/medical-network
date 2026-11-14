import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase.ts'
import { authErrorMessage, MISSING_CONFIG } from '../lib/authErrors.ts'
import { usePageTitle } from '../lib/usePageTitle.ts'
import AuthLayout from './AuthLayout.tsx'
import styles from './Auth.module.css'

/** Forgot password: sends an email with a link to /nueva-contrasena */
export default function RecuperarContrasena() {
  usePageTitle('Recuperar contraseña · Medical Network')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(supabase ? '' : MISSING_CONFIG)
  const [invalid, setInvalid] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return setError(MISSING_CONFIG)
    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+$/.test(address)) {
      setError(address ? 'Revisa la dirección de correo.' : 'Escribe tu correo electrónico.')
      setInvalid(true)
      emailRef.current?.focus()
      return
    }

    setBusy(true)
    setError('')
    setInvalid(false)
    try {
      // The link in the email comes back to this same site (production,
      // a preview or your PC), as long as Supabase's Redirect URLs allow it.
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: window.location.origin + '/nueva-contrasena',
      })
      if (error) setError(authErrorMessage(error))
      else setSent(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Recuperar contraseña">
      {/* Same answer whether the account exists or not, so this form can't
          be used to find out who has an account */}
      <div role="status">
        {sent && (
          <p className={styles.notice}>
            Si existe una cuenta con el correo <strong>{email.trim()}</strong>, te hemos enviado
            un enlace para crear una contraseña nueva. El enlace vale 24 horas.
            Si no lo ves en unos minutos, revisa la carpeta de spam.
          </p>
        )}
      </div>

      {!sent && (
        <>
          <p className={styles.intro}>
            Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.
          </p>
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Correo electrónico</label>
              <input
                ref={emailRef} id="email" className={styles.input}
                type="email" autoComplete="username" inputMode="email" spellCheck={false}
                value={email} onChange={(e) => setEmail(e.target.value)}
                aria-invalid={invalid} aria-describedby={error ? 'form-error' : undefined}
              />
            </div>

            <div aria-live="assertive">
              {error && <p className={styles.error} id="form-error">{error}</p>}
            </div>

            <button className={styles.submit} type="submit" disabled={busy || !supabase}>
              {busy ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        </>
      )}

      <p className={styles.links}>
        <Link className={styles.link} to="/iniciar-sesion">Volver a iniciar sesión</Link>
      </p>
    </AuthLayout>
  )
}
