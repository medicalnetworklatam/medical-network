import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import AdminClientPage, { RefreshRow, type ClientPage } from './AdminClientPage.tsx'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage, NOT_ALLOWED } from '../lib/dataErrors.ts'
import { CLIENT_COLUMNS, clientName, stateName, STATES, type Client } from '../lib/adminData.ts'
import styles from './Admin.module.css'

/** The one column a save may send. Never is_admin, email, id or created_at. */
type Change =
  | { main_state: string | null }
  | { route: string | null }
  | { plan: 'free' | 'paid' }

/** Spanish message when the database refuses a change */
function saveErrorMessage(error: unknown): string {
  if ((error as { code?: string } | null)?.code === NOT_ALLOWED) {
    return 'No tienes permiso para hacer este cambio.'
  }
  return dataErrorMessage(error)
}

/** /admin/clientes/<id>/estado: the three things an admin may change
    (Bundesland, route and plan), each with a confirmation inside the page.
    Drawn only once the client is loaded (AdminClientPage.tsx). */
export default function AdminClienteEstado() {
  return (
    <AdminClientPage section={{ title: 'Estado, ruta y plan' }} withRoutes>
      {(page) => <EstadoScreen {...page} />}
    </AdminClientPage>
  )
}

function EstadoScreen({ clientId, client, setClient, routes, loading, reload }: ClientPage) {
  /* ---------- Saving: one change at a time ---------- */
  const [saving, setSaving] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  /** Sends ONE column, then shows the row exactly as the database returned
      it. Gives back a Spanish error message, or '' when it was saved. On an
      error nothing on screen changes: the old value stays. */
  async function save(change: Change, done: (saved: Client) => string): Promise<string> {
    if (!supabase) return dataErrorMessage(null)
    if (saving) return 'Espera a que termine el otro cambio.'
    setSaving(true)
    setAnnouncement('')
    let message = ''
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(change)
        .eq('id', clientId)
        .eq('is_admin', false) // never an admin account
        .select(CLIENT_COLUMNS) // read the changed row back
        .maybeSingle<Client>()
      if (error) message = saveErrorMessage(error)
      // Refused by the database's rules, or the account is gone: nothing
      // changes and nothing comes back, without any error
      else if (!data) message = 'No se guardó el cambio. Puede que la cuenta ya no exista: pulsa «Actualizar».'
      else if (mounted.current) {
        setClient(data)
        setAnnouncement(done(data))
      }
    } catch (err) {
      message = saveErrorMessage(err)
    }
    if (mounted.current) setSaving(false)
    return message
  }

  const name = clientName(client)
  const who = name || 'este cliente'
  const currentState = stateName(client.main_state)
  const routeName = (code: string | null) => (code ? routes.find((r) => r.code === code)?.name ?? code : '')
  /* Routes that can be chosen: the active ones, plus the client's own if it
     has been archived since */
  const routeOptions = routes
    .filter((r) => !r.archived || r.code === client.route)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'es'))
    .map((r) => ({ value: r.code, label: r.name + (r.archived ? ' (archivada)' : '') }))
  const busy = saving || loading
  const keptProgress = currentState
    ? <> El progreso de <span lang="de">{currentState}</span> queda guardado, pero no se mostrará.</>
    : null

  return (
    <>
      <span className="sr-only" role="status">{announcement}</span>
      <RefreshRow loading={loading} disabled={busy} onClick={reload} />

      {/* The three things an admin may change */}
      <section className={styles.card} aria-labelledby="settings-heading">
        <h2 className={styles.sectionTitle} id="settings-heading">Estado, ruta y plan</h2>

        <Setting
          label="Estado (Bundesland)"
          selectLabel="Nuevo estado"
          current={currentState ? <span lang="de">{currentState}</span> : 'Sin estado'}
          value={client.main_state ?? ''}
          options={[{ value: '', label: 'Sin estado' }, ...STATES.map((s) => ({ value: s.id, label: s.name, lang: 'de' }))]}
          busy={busy}
          question={(value) => value
            ? <>¿Cambiar el estado de {who} a <span lang="de">{stateName(value)}</span>?{keptProgress}</>
            : <>¿Quitar el estado de {who}? Podrá elegirlo una vez más en el mapa.{keptProgress}</>}
          onSave={(value) => save(
            { main_state: value || null },
            (saved) => 'Estado guardado: ' + (stateName(saved.main_state) || 'sin estado') + '.',
          )}
        />

        {routes.length === 0 ? (
          <div className={styles.setting}>
            <h3 className={styles.settingLabel}>Ruta</h3>
            <p className={styles.settingValue}>Sin rutas todavía</p>
          </div>
        ) : (
          <Setting
            label="Ruta"
            selectLabel="Nueva ruta"
            current={routeName(client.route) || 'Sin ruta'}
            value={client.route ?? ''}
            options={[{ value: '', label: 'Sin ruta' }, ...routeOptions]}
            busy={busy}
            question={(value) => value
              ? <>¿Cambiar la ruta de {who} a «{routeName(value)}»?</>
              : <>¿Quitar la ruta de {who}?</>}
            onSave={(value) => save(
              { route: value || null },
              (saved) => 'Ruta guardada: ' + (saved.route ? routeName(saved.route) : 'sin ruta') + '.',
            )}
          />
        )}

        <Setting
          label="Plan"
          selectLabel="Nuevo plan"
          current={client.plan === 'paid' ? 'De pago' : 'Gratis'}
          value={client.plan}
          options={[{ value: 'paid', label: 'De pago' }, { value: 'free', label: 'Gratis' }]}
          busy={busy}
          question={(value) => value === 'paid'
            ? <>¿Cambiar el plan de {who} a «De pago»? Podrá ver su checklist y la comunidad.</>
            : <>¿Cambiar el plan de {who} a «Gratis»? Dejará de ver su checklist y la comunidad.</>}
          onSave={(value) => save(
            { plan: value === 'paid' ? 'paid' : 'free' },
            (saved) => 'Plan guardado: ' + (saved.plan === 'paid' ? 'de pago' : 'gratis') + '.',
          )}
        />
      </section>
    </>
  )
}

interface Option {
  value: string
  label: string
  lang?: string
}

/** One thing to change: shows the value the database has, a list to choose a
    new one, and "Cambiar". "Cambiar" asks for confirmation right here in the
    page (never the browser's own pop-up, so every word stays in Spanish).
    While any save runs (`busy`), every button and list is disabled. */
function Setting({ label, selectLabel, current, value, options, busy, question, onSave }: {
  label: string
  selectLabel: string
  /** The saved value, as text */
  current: ReactNode
  /** The saved value, as the option's value ('' = none) */
  value: string
  options: Option[]
  busy: boolean
  question: (value: string) => ReactNode
  /** Saves; gives back a Spanish error message, or '' when saved */
  onSave: (value: string) => Promise<string>
}) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  // The saved value changed (a save, or "Actualizar"): the list follows it
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setDraft(value)
    setConfirming(false)
  }

  const selectRef = useRef<HTMLSelectElement>(null)
  const changeRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Move the focus only after a click here, not when the page first appears
  const moved = useRef(false)
  useEffect(() => {
    if (!moved.current) return
    if (confirming) cancelRef.current?.focus()
    // After a save "Cambiar" is switched off (nothing new is chosen), and a
    // switched-off button can't take the focus: the list takes it instead
    else if (changeRef.current && !changeRef.current.disabled) changeRef.current.focus()
    else selectRef.current?.focus()
  }, [confirming])

  function ask() {
    moved.current = true
    setError('')
    setConfirming(true)
  }
  function cancel() {
    moved.current = true
    setError('')
    setConfirming(false)
  }
  async function confirm() {
    if (busy) return
    moved.current = true
    setError('')
    setSending(true)
    const message = await onSave(draft)
    setSending(false)
    // Saved: the new `value` closes the question (above). Not saved: the
    // question stays, with the error, and "Actual" still shows the old value.
    if (message) setError(message)
    else setConfirming(false)
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !busy) cancel()
  }

  return (
    <div className={styles.setting} role="group" aria-labelledby={id + '-label'}>
      <h3 className={styles.settingLabel} id={id + '-label'}>{label}</h3>
      <p className={styles.settingValue}>Actual: <strong>{current}</strong></p>

      {confirming ? (
        <div className={styles.confirm} role="group" aria-label="Confirmar cambio" onKeyDown={onKeyDown}>
          <p className={styles.confirmText}>{question(draft)}</p>
          <div className={styles.confirmBtns}>
            <button type="button" className={styles.primaryBtn} onClick={() => void confirm()} disabled={busy}>
              {sending ? 'Guardando…' : 'Sí, cambiar'}
            </button>
            <button type="button" className={styles.smallBtn} ref={cancelRef} onClick={cancel} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.settingRow}>
          <label className="sr-only" htmlFor={id + '-select'}>{selectLabel}</label>
          <select
            ref={selectRef} id={id + '-select'} className={styles.select}
            value={draft} onChange={(e) => { setDraft(e.target.value); setError('') }}
            disabled={busy}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} lang={option.lang}>{option.label}</option>
            ))}
          </select>
          <button
            type="button" className={styles.smallBtn} ref={changeRef}
            onClick={ask} disabled={busy || draft === value}
          >
            Cambiar
          </button>
        </div>
      )}
      <div className={styles.live} aria-live="assertive">
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  )
}
