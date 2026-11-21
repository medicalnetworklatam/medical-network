import { useEffect, useState, type CSSProperties } from 'react'
import AdminClientPage, { type ClientPage } from './AdminClientPage.tsx'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import { formatBerlinDateTime } from '../lib/berlinTime.ts'
import {
  clientName, loadChecklist, loadTicks, progressFor, progressText, stateName,
  type ChecklistItem, type Tick,
} from '../lib/adminData.ts'
import {
  DETAILS_COLUMNS, DUDAS_COLUMNS, TEMPLATE_COLUMNS, loadClientSettings, readBlocks,
  type ClientDetails, type ClientItemSetting, type Dudas, type TemplateRow,
} from '../lib/expediente.ts'
import { DetailsForm, StepLayer } from './AdminExpediente.tsx'
import styles from './Admin.module.css'

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

/** /admin/clientes/<id>/expediente: the client's country and header line,
    their dudas (read-only), and per step their tick (read-only) and the
    client layer ("Según la plantilla / Aplica / No aplica", reason, note),
    each saved with its own "Guardar" and no confirmation (DECISIONS.md,
    21 Nov 2026). Drawn only once the client is loaded (AdminClientPage.tsx).
    On wide screens: progress, details and dudas in a column on the left
    that stays in view, the steps on the right; on a phone, stacked. */
export default function AdminClienteExpediente() {
  return (
    <AdminClientPage section={{ title: 'Expediente' }} withRoutes refresh>
      {(page) => <ExpedienteScreen {...page} />}
    </AdminClientPage>
  )
}

function ExpedienteScreen({ clientId, client, routes, attempt, loading }: ClientPage) {
  /* ---------- Their checklist: current state and route only ---------- */
  const state = client.main_state
  const route = client.route
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

  const name = clientName(client)
  const currentState = stateName(client.main_state)
  const routeName = (code: string | null) => (code ? routes.find((r) => r.code === code)?.name ?? code : '')
  const progress = currentChecklist?.ok
    ? progressFor(client, currentChecklist.items, currentChecklist.ticks, currentChecklist.settings)
    : null
  /** Fills the template's placeholders for this client (src/lib/placeholders.ts) */
  const placeholderValues = { pais: details?.country, nombre: name, perfil: details?.header_line }

  const hasSteps = !!currentChecklist?.ok && currentChecklist.items.length > 0

  return (
    /* Expediente: country and header line, the client's dudas, and per step
       their tick (read-only) and the client layer. The page title already
       says "expediente.": the heading is for screen readers only. */
    <section className={styles.expGrid} aria-labelledby="checklist-heading" aria-busy={(!!state && !!route && !currentChecklist) || !currentExtra}>
      <h2 className="sr-only" id="checklist-heading">Expediente</h2>

      <div className={styles.expSide}>
        {hasSteps && (
          <div className={styles.setting} role="group" aria-labelledby="progress-heading">
            <h3 className={styles.settingLabel} id="progress-heading">Progreso</h3>
            <p className={styles.progressBig}>
              <strong>{progressText(progress)}</strong>
              {/* The words already say it: the bar is only for the eye */}
              {progress && (
                <span className={styles.progressTrack} aria-hidden="true">
                  <span className={styles.progressFill} style={{ '--fill': progress.percent / 100 } as CSSProperties} />
                </span>
              )}
            </p>
            <p className={styles.note}>
              <span lang="de">{currentState}</span> · {routeName(route)}
              {client.plan === 'free' && <> · Con el plan gratis, el cliente no ve este checklist.</>}
            </p>
          </div>
        )}

        {!currentExtra ? (
          <p className={styles.sideNote} role="status">Cargando datos del expediente…</p>
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
      </div>

      <div className={styles.expSteps}>
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
      </div>
    </section>
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
