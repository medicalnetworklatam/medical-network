import { useEffect, useState, type ReactNode } from 'react'
import AdminClientPage, { type ClientPage } from './AdminClientPage.tsx'
import { BigLinks } from './AdminLayout.tsx'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import {
  documentCountText, loadChecklist, loadItemSettings, loadRoutes, loadTicks, progressFor, progressText,
  setupMissing, stateName, type Progress,
} from '../lib/adminData.ts'
import styles from './Admin.module.css'

/** One status line's answer */
type Part<T> = { ok: true; value: T } | { ok: false; error: string }

/** The three status lines' answers. `key` says which client values they
    answer, so an old answer is never shown for newer values. */
interface Summary {
  key: string
  /** The route's name ('' = no route) */
  route: Part<string>
  /** null = "—" (also for a free client, whose line says "Plan gratis") */
  progress: Part<Progress | null>
  documents: Part<number>
}

/** Runs one read; a failure becomes that line's error, never the others' */
async function part<T>(read: () => Promise<T>): Promise<Part<T>> {
  try {
    return { ok: true, value: await read() }
  } catch (err) {
    return { ok: false, error: dataErrorMessage(err) }
  }
}

/** /admin/clientes/<id> (and any other address under it): the client's name
    as the title and three big buttons, each with a one-line status
    (DECISIONS.md, 21 Nov 2026, night, later). Drawn only once the client is
    loaded (AdminClientPage.tsx). */
export default function AdminCliente() {
  return (
    <AdminClientPage>
      {(page) => <ClientHub {...page} />}
    </AdminClientPage>
  )
}

function ClientHub({ clientId, client }: ClientPage) {
  const { main_state: state, route, plan } = client
  const key = [state, route, plan].join('|')
  const [summary, setSummary] = useState<Summary | null>(null)
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    let cancelled = false
    async function load() {
      const [routeName, progress, documents] = await Promise.all([
        // The route's name, from the routes table (its code is the fallback)
        part(async () => {
          if (!route) return ''
          const routes = await loadRoutes(db)
          return routes.find((r) => r.code === route)?.name ?? route
        }),
        // Progress exactly as the client overview works it out ("no aplica"
        // steps left out). Not read for a free client, or without a state
        // or route ("—").
        part(async () => {
          if (plan !== 'paid' || !state || !route) return null
          const [items, ticks, settings] = await Promise.all([
            loadChecklist(db, state, route),
            loadTicks(db, clientId),
            loadItemSettings(db, clientId),
          ])
          return progressFor(client, items, ticks, settings)
        }),
        // Only the number of documents: no file names, no signed links
        part(async () => {
          const { count, error } = await db.from('client_documents')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', clientId)
          if (error) throw error
          return count ?? 0
        }),
      ])
      if (!cancelled) setSummary({ key, route: routeName, progress, documents })
    }
    void load()
    return () => { cancelled = true }
  }, [clientId, client, state, route, plan, key])
  const current = summary?.key === key ? summary : null  // null = loading
  const error = current
    ? [current.route, current.progress, current.documents].find((p) => !p.ok)
    : undefined

  /** A line's text: "Cargando…" while loading, nothing after an error */
  function line<T>(p: Part<T> | undefined, text: (value: T) => ReactNode): ReactNode {
    if (!current) return 'Cargando…'
    return p && p.ok ? text(p.value) : undefined
  }
  const free = plan === 'free'
  const missing = setupMissing(client)
  const currentState = stateName(state)

  return (
    <>
      {error && !error.ok && (
        <div className={styles.message + ' ' + styles.isError} role="alert">
          <p>No se pudo cargar el resumen del cliente. {error.error}</p>
        </div>
      )}
      <BigLinks
        label="Secciones del cliente"
        items={[
          {
            to: `/admin/clientes/${clientId}/estado`,
            title: 'Estado, ruta y plan',
            // Everything from the database is plain text
            status: line(current?.route, (routeName) => (
              <>
                {currentState ? <span lang="de">{currentState}</span> : 'Sin estado'}
                {' · '}{routeName || 'Sin ruta'}
                {' · '}{free ? 'Gratis' : 'De pago'}
              </>
            )),
            // A paid client without a state or route: an admin has to act
            alerta: missing.state || missing.route,
          },
          {
            to: `/admin/clientes/${clientId}/expediente`,
            title: 'Expediente',
            status: free
              ? 'Plan gratis: el cliente no ve su expediente.'
              : line(current?.progress, (progress) => progressText(progress)),
          },
          {
            to: `/admin/clientes/${clientId}/documentos`,
            title: 'Documentos',
            status: line(current?.documents, (count) => documentCountText(count) + (free ? ' · Plan gratis' : '')),
          },
        ]}
      />
    </>
  )
}
