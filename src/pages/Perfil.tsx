import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../lib/auth.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import { authorName, needsName, PROFILE_COLUMNS, useProfile, type Profile } from '../lib/profile.ts'
import { safeInternalPath } from '../lib/safePath.ts'
import { usePageTitle } from '../lib/usePageTitle.ts'
import AuthLayout from './AuthLayout.tsx'
import SessionButton from './SessionButton.tsx'
import styles from './Auth.module.css'

const MAX = 100 // the database allows at most 100 characters per field

/** "Completa tu perfil": the first-login name step. Also used later to change
    the name. Saves only first_name and last_names. */
export default function Perfil() {
  const { session } = useAuth()
  const { profile, replace } = useProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const came = location.state as { from?: unknown } | null

  // Decided once when the page opens, so the title doesn't change on save
  const [firstTime] = useState(() => !profile || needsName(profile))
  const title = firstTime ? 'Completa tu perfil' : 'Tu perfil'
  usePageTitle(title + ' · Medical Network')

  const [first, setFirst] = useState(profile?.first_name ?? '')
  const [last, setLast] = useState(profile?.last_names ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<'first' | 'last' | null>(null)
  const [saved, setSaved] = useState(false)
  const firstRef = useRef<HTMLInputElement>(null)
  const lastRef = useRef<HTMLInputElement>(null)

  function fail(message: string, field: 'first' | 'last', ref: RefObject<HTMLInputElement | null>) {
    setError(message)
    setInvalid(field)
    ref.current?.focus()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy || !supabase || !session) return
    setSaved(false)
    const firstName = first.trim()
    const lastNames = last.trim()
    if (!firstName) return fail('Escribe tu nombre o tus nombres.', 'first', firstRef)
    if (firstName.length > MAX) return fail('El nombre puede tener como máximo 100 caracteres.', 'first', firstRef)
    if (!lastNames) return fail('Escribe tus apellidos.', 'last', lastRef)
    if (lastNames.length > MAX) return fail('Los apellidos pueden tener como máximo 100 caracteres.', 'last', lastRef)

    setBusy(true)
    setError('')
    setInvalid(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ first_name: firstName, last_names: lastNames })
        .eq('id', session.user.id)
        .select(PROFILE_COLUMNS)
        .maybeSingle<Profile>()
      if (error || !data) {
        setError(error ? dataErrorMessage(error) : 'No se pudo guardar. Inténtalo de nuevo.')
        return
      }
      replace(data)
      setFirst(data.first_name ?? '')
      setLast(data.last_names ?? '')

      // Sent here by the name step: go on to where they were going (only an
      // address on this site). First time without one: Novedades. Changing
      // the name later: stay here.
      const wanted = safeInternalPath(came?.from)
      const next = wanted && !wanted.startsWith('/perfil') ? wanted : firstTime ? '/novedades' : null
      if (next) navigate(next, { replace: true })
      else setSaved(true)
    } catch (err) {
      setError(dataErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const preview = first.trim() ? authorName(first, last) : ''

  return (
    <AuthLayout title={title} headerAction={<SessionButton redesign />}>
      <p className={styles.intro}>
        En las publicaciones de la comunidad, los demás miembros verán solo tu primer nombre
        y la inicial de tu primer apellido: «Nombre I.». Nunca verán tu correo ni tus apellidos completos.
      </p>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="first-name">Nombre(s)</label>
          <input
            ref={firstRef} id="first-name" className={styles.input}
            type="text" autoComplete="given-name" maxLength={MAX} required
            value={first} onChange={(e) => { setFirst(e.target.value); setSaved(false) }}
            aria-invalid={invalid === 'first'} aria-describedby={error ? 'form-error' : undefined}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="last-names">Apellidos</label>
          <input
            ref={lastRef} id="last-names" className={styles.input}
            type="text" autoComplete="family-name" maxLength={MAX} required
            value={last} onChange={(e) => { setLast(e.target.value); setSaved(false) }}
            aria-invalid={invalid === 'last'} aria-describedby={error ? 'form-error' : undefined}
          />
        </div>

        <p className={styles.notice + ' ' + styles.preview}>
          {preview
            ? <>Así te verán los demás miembros: <strong>{preview}</strong></>
            : <>Por ejemplo, «María Fernanda» y «García López» se verá como <strong>María G.</strong></>}
        </p>

        <div aria-live="assertive">
          {error && <p className={styles.error} id="form-error">{error}</p>}
        </div>
        <div role="status">
          {saved && <p className={styles.notice}>Cambios guardados.</p>}
        </div>

        <button className={styles.submit} type="submit" disabled={busy || !supabase}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      {!firstTime && (
        <p className={styles.links}>
          <Link className={styles.link} to="/novedades">Volver a novedades</Link>
        </p>
      )}
    </AuthLayout>
  )
}
