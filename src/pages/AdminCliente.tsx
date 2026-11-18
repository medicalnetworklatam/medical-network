import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import AdminLayout from './AdminLayout.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage, NOT_ALLOWED } from '../lib/dataErrors.ts'
import { formatBerlinDateTime } from '../lib/berlinTime.ts'
import {
  CLIENT_COLUMNS, clientName, loadChecklist, loadRoutes, loadTicks, progressFor, progressText,
  stateName, STATES,
  type ChecklistItem, type Client, type Route, type Tick,
} from '../lib/adminData.ts'
import styles from './Admin.module.css'

/* What a client ID looks like. Anything else in the address is not asked for. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The one column a save may send. Never is_admin, email, id or created_at. */
type Change =
  | { main_state: string | null }
  | { route: string | null }
  | { plan: 'free' | 'paid' }

type Loaded =
  | { attempt: number; ok: true; client: Client | null; routes: Route[] }
  | { attempt: number; ok: false; error: string }

type Checklist =
  | { key: string; ok: true; items: ChecklistItem[]; ticks: Tick[] }
  | { key: string; ok: false; error: string }

/** Spanish message when the database refuses a change */
function saveErrorMessage(error: unknown): string {
  if ((error as { code?: string } | null)?.code === NOT_ALLOWED) {
    return 'No tienes permiso para hacer este cambio.'
  }
  return dataErrorMessage(error)
}

/** One client's screen: their checklist (read-only), and the three things an
    admin may change: Bundesland, route and plan. */
export default function AdminCliente() {
  usePageTitle('Cliente · Administración · Medical Network')
  const { id = '' } = useParams()

  return (
    <AdminLayout title="Cliente">
      <p className={styles.back}>
        <Link className={styles.backLink} to="/admin">
          <span aria-hidden="true">←</span> Todos los clientes
        </Link>
      </p>
      {UUID.test(id)
        ? <ClientScreen key={id} clientId={id} />
        : <p className={styles.message}>Cliente no encontrado.</p>}
    </AdminLayout>
  )
}

function ClientScreen({ clientId }: { clientId: string }) {
  /* ---------- The client and the routes ---------- */
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  /* The client as the database last gave it: from the load, or from a save */
  const [client, setClient] = useState<Client | null>(null)
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    let cancelled = false
    async function load() {
      let next: Loaded
      try {
        const [profile, routes] = await Promise.all([
          // Admin accounts are not clients: they are never loaded here, so
          // this screen can't be used on them
          db.from('profiles').select(CLIENT_COLUMNS)
            .eq('id', clientId).eq('is_admin', false)
            .maybeSingle<Client>(),
          loadRoutes(db),
        ])
        if (profile.error) throw profile.error
        next = { attempt, ok: true, client: profile.data, routes }
      } catch (err) {
        next = { attempt, ok: false, error: dataErrorMessage(err) }
      }
      if (cancelled) return
      setLoaded(next)
      if (next.ok) setClient(next.client)
    }
    void load()
    return () => { cancelled = true }
  }, [clientId, attempt])
  const loading = loaded?.attempt !== attempt

  /* ---------- Their checklist: current state and route only ---------- */
  const state = client?.main_state ?? null
  const route = client?.route ?? null
  const checklistKey = state + '|' + route + '|' + attempt
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  useEffect(() => {
    // No state or no route: there is no checklist to ask for
    if (!supabase || !state || !route) return
    const db = supabase
    const key = state + '|' + route + '|' + attempt
    let cancelled = false
    async function load() {
      let next: Checklist
      try {
        const [items, ticks] = await Promise.all([
          loadChecklist(db, state!, route!),
          loadTicks(db, clientId),
        ])
        next = { key, ok: true, items, ticks }
      } catch (err) {
        next = { key, ok: false, error: dataErrorMessage(err) }
      }
      if (!cancelled) setChecklist(next)
    }
    void load()
    return () => { cancelled = true }
  }, [clientId, state, route, attempt])
  const currentChecklist = checklist?.key === checklistKey ? checklist : null  // null = loading

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

  /* ---------- Loading, error, not found ---------- */
  if (!client) {
    if (loading) return <p className={styles.message} role="status">Cargando cliente…</p>
    if (loaded && !loaded.ok) {
      return (
        <div className={styles.message + ' ' + styles.isError} role="alert">
          <p>No se pudo cargar el cliente. {loaded.error}</p>
          <button type="button" className={styles.messageBtn} onClick={() => setAttempt((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )
    }
    return <p className={styles.message}>Cliente no encontrado.</p>
  }

  const name = clientName(client)
  const who = name || 'este cliente'
  const currentState = stateName(client.main_state)
  const routes = loaded?.ok ? loaded.routes : []
  const routeName = (code: string | null) => (code ? routes.find((r) => r.code === code)?.name ?? code : '')
  /* Routes that can be chosen: the active ones, plus the client's own if it
     has been archived since */
  const routeOptions = routes
    .filter((r) => !r.archived || r.code === client.route)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'es'))
    .map((r) => ({ value: r.code, label: r.name + (r.archived ? ' (archivada)' : '') }))
  const busy = saving || loading
  const progress = currentChecklist?.ok ? progressFor(client, currentChecklist.items, currentChecklist.ticks) : null
  const keptProgress = currentState
    ? <> El progreso de <span lang="de">{currentState}</span> queda guardado, pero no se mostrará.</>
    : null

  return (
    <>
      <span className="sr-only" role="status">{announcement}</span>

      {loaded && !loaded.ok && !loading && (
        <div className={styles.message + ' ' + styles.isError} role="alert">
          <p>No se pudo actualizar. {loaded.error}</p>
        </div>
      )}

      {/* Who it is. Everything from the database is plain text. */}
      <section className={styles.card + ' ' + styles.clientCard} aria-labelledby="client-heading">
        <div className={styles.listHead}>
          <h2 className={styles.clientTitle} id="client-heading">
            {name || 'Sin nombre'}
            {!name && client.email && <span className={styles.email}>{client.email}</span>}
          </h2>
          <button type="button" className={styles.smallBtn} onClick={() => setAttempt((n) => n + 1)} disabled={busy}>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </section>

      {/* The three things an admin may change */}
      <section className={styles.card + ' ' + styles.settingsCard} aria-labelledby="settings-heading">
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

      {/* Their checklist, read-only */}
      <section className={styles.card + ' ' + styles.checklistCard} aria-labelledby="checklist-heading" aria-busy={!!state && !!route && !currentChecklist}>
        <h2 className={styles.sectionTitle} id="checklist-heading">Checklist (solo lectura)</h2>

        {!state ? (
          <p className={styles.note}>Este cliente todavía no tiene estado, así que no hay checklist que mostrar.</p>
        ) : !route ? (
          <p className={styles.note}>Este cliente todavía no tiene ruta, así que no hay checklist que mostrar.</p>
        ) : !currentChecklist ? (
          <p className={styles.note} role="status">Cargando checklist…</p>
        ) : !currentChecklist.ok ? (
          <p className={styles.error} role="alert">No se pudo cargar el checklist. {currentChecklist.error}</p>
        ) : currentChecklist.items.length === 0 ? (
          <p className={styles.note}>
            Todavía no hay pasos para <span lang="de">{currentState}</span> con la ruta «{routeName(route)}».
          </p>
        ) : (
          <>
            <p className={styles.note}>
              <span lang="de">{currentState}</span> · {routeName(route)} · Progreso: <strong>{progressText(progress)}</strong>
              {client.plan === 'free' && <> · Con el plan gratis, el cliente no ve este checklist.</>}
            </p>
            <ChecklistView items={currentChecklist.items} ticks={currentChecklist.ticks} />
          </>
        )}
      </section>
    </>
  )
}

/** The items with "Hecho" or "Pendiente". Nothing here can be clicked: only
    the client ticks their own items. Titles and texts are plain text. */
function ChecklistView({ items, ticks }: { items: ChecklistItem[]; ticks: Tick[] }) {
  const doneAt = new Map(ticks.map((tick) => [tick.item_id, tick.done_at]))
  return (
    <ul className={styles.checklist}>
      {items.map((item) => {
        const done = doneAt.get(item.id)
        return (
          <li key={item.id} className={styles.checkItem + (done ? ' ' + styles.isDone : '')}>
            <span className={styles.checkMark} aria-hidden="true">{done ? '✓' : ''}</span>
            <div className={styles.checkBody}>
              <p className={styles.checkTitle}>{item.title}</p>
              {item.body && <p className={styles.checkText}>{item.body}</p>}
              <p className={styles.checkStatus}>
                {done
                  ? <>Hecho · <time dateTime={done}>{formatBerlinDateTime(done)}</time> (hora de Alemania)</>
                  : 'Pendiente'}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
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
