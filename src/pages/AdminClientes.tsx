import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import AdminLayout from './AdminLayout.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import { formatBerlinDateTime } from '../lib/berlinTime.ts'
import {
  clientName, loadOverview, progressText, sortClients, stateName, summarise, type Overview,
} from '../lib/adminData.ts'
import styles from './Admin.module.css'

/* The answer of one load. `attempt` says which load it answers, so an old
   answer arriving late is never shown for a newer one. */
type Result =
  | { attempt: number; ok: true; data: Overview }
  | { attempt: number; ok: false; error: string }

/** Admin overview: one row per client account (admins are not listed), with
    their Bundesland, route, plan, progress % and last activity.

    Four reads in total (profiles, routes, checklist items, progress), all
    with the admin's own login; the percentages are worked out here. */
export default function AdminClientes() {
  usePageTitle('Clientes · Administración · Medical Network')

  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    let cancelled = false
    async function load() {
      let next: Result
      try {
        next = { attempt, ok: true, data: await loadOverview(db) }
      } catch (err) {
        next = { attempt, ok: false, error: dataErrorMessage(err) }
      }
      if (!cancelled) setResult(next)
    }
    void load()
    return () => { cancelled = true }
  }, [attempt])
  const loading = result?.attempt !== attempt
  // While "Actualizar" runs, the list already on screen stays
  const shown = result?.ok ? result.data : null
  const error = result && !result.ok && !loading ? result.error : ''

  const rows = useMemo(() => {
    if (!shown) return []
    const summary = summarise(shown.clients, shown.items, shown.ticks)
    const routeNames = new Map(shown.routes.map((route) => [route.code, route.name]))
    return sortClients(shown.clients).map((client) => ({
      client,
      name: clientName(client),
      state: stateName(client.main_state),
      // A route always exists in the routes table; its code is the fallback
      route: client.route ? routeNames.get(client.route) ?? client.route : '',
      progress: progressText(summary.get(client.id)?.progress ?? null),
      lastActivity: summary.get(client.id)?.lastActivity ?? null,
    }))
  }, [shown])

  return (
    <AdminLayout title="CLIENTES" wide>
      <section className={styles.list} aria-labelledby="clients-heading" aria-busy={loading}>
        <div className={styles.listHead}>
          <h2 className={styles.sectionTitle} id="clients-heading">
            {shown ? `Cuentas de clientes (${rows.length})` : 'Cuentas de clientes'}
          </h2>
          <button
            type="button" className={styles.smallBtn}
            onClick={() => setAttempt((n) => n + 1)} disabled={loading}
          >
            {loading && shown ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {error && (
          <div className={styles.message + ' ' + styles.isError} role="alert">
            <p>No se pudieron cargar los clientes. {error}</p>
          </div>
        )}

        {!shown ? (
          loading && <p className={styles.message} role="status">Cargando clientes…</p>
        ) : rows.length === 0 ? (
          <p className={styles.message}>Todavía no hay cuentas de clientes.</p>
        ) : (
          <>
            <p className={styles.note}>
              El progreso cuenta los pasos marcados del estado y la ruta actuales del cliente.
              La última actividad es la última vez que marcó un paso, en hora de Alemania.
            </p>
            {/* The roles keep this a table for screen readers on a phone too,
                where CSS turns every row into a card */}
            <table className={styles.table} role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader" scope="col">Nombre</th>
                  <th role="columnheader" scope="col">Estado</th>
                  <th role="columnheader" scope="col">Ruta</th>
                  <th role="columnheader" scope="col">Plan</th>
                  <th role="columnheader" scope="col">Progreso</th>
                  <th role="columnheader" scope="col">Última actividad</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {rows.map(({ client, name, state, route, progress, lastActivity }) => (
                  <tr key={client.id} role="row">
                    {/* Everything from the database is plain text */}
                    <td role="cell" className={styles.nameCell}>
                      <Link className={styles.clientLink} to={'/admin/clientes/' + client.id}>
                        <span className={styles.clientName}>{name || 'Sin nombre'}</span>
                        {!name && client.email && <span className={styles.email}>{client.email}</span>}
                      </Link>
                    </td>
                    <td role="cell" data-label="Estado">
                      {state ? <span lang="de">{state}</span> : <span className={styles.none}>Sin estado</span>}
                    </td>
                    <td role="cell" data-label="Ruta" className={styles.wrapCell}>
                      {route || <span className={styles.none}>Sin ruta</span>}
                    </td>
                    <td role="cell" data-label="Plan" className={styles.nowrapCell}>
                      {client.plan === 'paid' ? 'De pago' : <span className={styles.tag}>Gratis</span>}
                    </td>
                    <td role="cell" data-label="Progreso" className={styles.nowrapCell}>{progress}</td>
                    <td role="cell" data-label="Última actividad" className={styles.nowrapCell}>
                      {lastActivity
                        ? <time dateTime={lastActivity}>{formatBerlinDateTime(lastActivity)}</time>
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </AdminLayout>
  )
}
