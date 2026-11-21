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
import {
  DETAILS_COLUMNS, DUDAS_COLUMNS, TEMPLATE_COLUMNS, loadClientSettings, readBlocks,
  type ClientDetails, type ClientItemSetting, type Dudas, type TemplateRow,
} from '../lib/expediente.ts'
import { DetailsForm, StepLayer } from './AdminExpediente.tsx'
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
  | {
      key: string
      ok: true
      items: ChecklistItem[]
      ticks: Tick[]
      /** The client layer, as the database last gave it */
      settings: ClientItemSetting[]
      template: Pick<TemplateRow, 'blocks'> | null
    }
  | { key: string; ok: false; error: string }

/** The client's details and dudas (loaded with the client, whatever their
    state and route) */
type Extra =
  | { attempt: number; ok: true; details: ClientDetails | null; dudas: Dudas | null }
  | { attempt: number; ok: false; error: string }

/** Spanish message when the database refuses a change */
function saveErrorMessage(error: unknown): string {
  if ((error as { code?: string } | null)?.code === NOT_ALLOWED) {
    return 'No tienes permiso para hacer este cambio.'
  }
  return dataErrorMessage(error)
}

/** One client's screen: the three things an admin may change (Bundesland,
    route and plan, each with a confirmation), and "Expediente": the
    client's country and header line, and per step the client layer
    ("Según la plantilla / Aplica / No aplica", reason, note), each saved
    with its own "Guardar" and no confirmation (DECISIONS.md, 21 Nov 2026).
    The client's ticks and their dudas are shown read-only. */
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
        const [items, ticks, settings, template] = await Promise.all([
          loadChecklist(db, state!, route!),
          loadTicks(db, clientId),
          loadClientSettings(db, clientId),
          db.from('checklist_templates').select(TEMPLATE_COLUMNS)
            .eq('state', state!).eq('route', route!).maybeSingle<TemplateRow>(),
        ])
        if (template.error) throw template.error
        next = { key, ok: true, items, ticks, settings, template: template.data }
      } catch (err) {
        next = { key, ok: false, error: dataErrorMessage(err) }
      }
      if (!cancelled) setChecklist(next)
    }
    void load()
    return () => { cancelled = true }
  }, [clientId, state, route, attempt])
  const currentChecklist = checklist?.key === checklistKey ? checklist : null  // null = loading

  /* ---------- Their country, header line and dudas ---------- */
  const [extra, setExtra] = useState<Extra | null>(null)
  /* The details as the database last gave them: from the load, or a save */
  const [details, setDetails] = useState<ClientDetails | null>(null)
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    let cancelled = false
    async function load() {
      let next: Extra
      try {
        const [d, q] = await Promise.all([
          db.from('client_details').select(DETAILS_COLUMNS).eq('user_id', clientId).maybeSingle<ClientDetails>(),
          db.from('client_dudas').select(DUDAS_COLUMNS).eq('user_id', clientId).maybeSingle<Dudas>(),
        ])
        if (d.error) throw d.error
        if (q.error) throw q.error
        next = { attempt, ok: true, details: d.data, dudas: q.data }
      } catch (err) {
        next = { attempt, ok: false, error: dataErrorMessage(err) }
      }
      if (cancelled) return
      setExtra(next)
      if (next.ok) setDetails(next.details)
    }
    void load()
    return () => { cancelled = true }
  }, [clientId, attempt])
  const currentExtra = extra?.attempt === attempt ? extra : null  // null = loading

  /** A step's client layer was saved: use the row the database returned */
  function settingSaved(row: ClientItemSetting) {
    setChecklist((c) => {
      if (!c || !c.ok) return c
      return { ...c, settings: [...c.settings.filter((s) => s.item_id !== row.item_id), row] }
    })
  }

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
  const progress = currentChecklist?.ok
    ? progressFor(client, currentChecklist.items, currentChecklist.ticks, currentChecklist.settings)
    : null
  /** Fills the template's placeholders for this client (src/lib/placeholders.ts) */
  const placeholderValues = { pais: details?.country, nombre: name, perfil: details?.header_line }
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

      {/* Expediente: country and header line, the client's dudas, and per
          step their tick (read-only) and the client layer */}
      <section className={styles.card + ' ' + styles.checklistCard} aria-labelledby="checklist-heading" aria-busy={(!!state && !!route && !currentChecklist) || !currentExtra}>
        <h2 className={styles.sectionTitle} id="checklist-heading">Expediente</h2>

        {!currentExtra ? (
          <p className={styles.note} role="status">Cargando datos del expediente…</p>
        ) : !currentExtra.ok ? (
          <p className={styles.error} role="alert">No se pudieron cargar el país, la línea de encabezado y las dudas. {currentExtra.error}</p>
        ) : (
          <>
            <DetailsForm
              key={'details-' + attempt} clientId={clientId} details={details}
              disabled={loading} onSaved={setDetails}
            />
            <div className={styles.setting} role="group" aria-labelledby="dudas-heading">
              <h3 className={styles.settingLabel} id="dudas-heading">Dudas del cliente (solo lectura)</h3>
              {currentExtra.dudas && currentExtra.dudas.body ? (
                <>
                  <p className={styles.checkText}>{currentExtra.dudas.body}</p>
                  <p className={styles.hint}>
                    Guardadas el <time dateTime={currentExtra.dudas.updated_at}>{formatBerlinDateTime(currentExtra.dudas.updated_at)}</time> (hora de Alemania)
                  </p>
                </>
              ) : (
                <p className={styles.note}>Sin dudas escritas.</p>
              )}
            </div>
          </>
        )}

        <div className={styles.setting} role="group" aria-labelledby="steps-heading">
          <h3 className={styles.settingLabel} id="steps-heading">Pasos</h3>
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
              <p className={styles.hint}>
                Los pasos que no aplican no cuentan en el progreso, aunque estén marcados. Cada paso se guarda con su
                propio «Guardar»; para deshacer un cambio, vuelve a «Según la plantilla».
              </p>
              <ChecklistView
                items={currentChecklist.items}
                ticks={currentChecklist.ticks}
                settings={currentChecklist.settings}
                blockTitles={readBlocks(currentChecklist.template?.blocks)}
                clientId={clientId}
                placeholderValues={placeholderValues}
                onSaved={settingSaved}
              />
            </>
          )}
        </div>
      </section>
    </>
  )
}

/** The steps, grouped by block, each with "Hecho" or "Pendiente" (read-only:
    only the client ticks their own steps) and the client layer's controls.
    Titles and texts are plain text. */
function ChecklistView({ items, ticks, settings, blockTitles, clientId, placeholderValues, onSaved }: {
  items: ChecklistItem[]
  ticks: Tick[]
  settings: ClientItemSetting[]
  blockTitles: ReturnType<typeof readBlocks>
  clientId: string
  placeholderValues: Parameters<typeof StepLayer>[0]['placeholderValues']
  onSaved: (row: ClientItemSetting) => void
}) {
  const doneAt = new Map(ticks.map((tick) => [tick.item_id, tick.done_at]))
  const settingOf = new Map(settings.map((setting) => [setting.item_id, setting]))
  const groups: { key: string; title: string; items: ChecklistItem[] }[] = []
  for (const item of items) {
    const key = item.block === null ? 'otros' : String(item.block)
    let group = groups.find((g) => g.key === key)
    if (!group) {
      const info = item.block === null ? null : blockTitles[item.block - 1]
      const title = item.block === null ? 'Otros pasos' : `Bloque ${item.block}${info?.title ? ' · ' + info.title : ''}`
      group = { key, title, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return (
    <>
      {groups.map((group) => (
        <div key={group.key} className={styles.stepGroup}>
          <h4 className={styles.stepGroupTitle}>{group.title}</h4>
          <ul className={styles.checklist}>
            {group.items.map((item) => (
              <StepLayer
                key={item.id}
                item={item}
                doneAt={doneAt.get(item.id) ?? null}
                setting={settingOf.get(item.id) ?? null}
                clientId={clientId}
                placeholderValues={placeholderValues}
                onSaved={onSaved}
              />
            ))}
          </ul>
        </div>
      ))}
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
