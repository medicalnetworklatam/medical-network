import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import AdminLayout from './AdminLayout.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import { CLIENT_COLUMNS, clientName, loadRoutes, type Client, type Route } from '../lib/adminData.ts'
import styles from './Admin.module.css'

/* What a client ID looks like. Anything else in the address is not asked for. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** One of the three pages under a client's screen */
export interface ClientSection {
  /** The page title ("Estado, ruta y plan"), also in the browser tab */
  title: string
}

/** What a client page gets once the client is loaded */
export interface ClientPage {
  clientId: string
  /** The client as the database last gave it: from the load, or a save */
  client: Client
  /** A save returned the changed row: show it */
  setClient: (client: Client) => void
  /** Every route ([] unless the page asked for them with `withRoutes`) */
  routes: Route[]
  /** Goes up by one with every "Actualizar" */
  attempt: number
  /** "Actualizar" is running */
  loading: boolean
  reload: () => void
  /** The page is saving: "Actualizar" waits */
  setBusy: (busy: boolean) => void
}

type Loaded =
  | { attempt: number; ok: true; client: Client | null; routes: Route[] }
  | { attempt: number; ok: false; error: string }

/** The one way the client pages (/admin/clientes/<id> and its three pages)
    load their client:
    - the address must hold a valid ID, otherwise "Cliente no encontrado."
      and nothing is asked for;
    - the same query as always: CLIENT_COLUMNS, and only an account that
      isn't an admin (.eq('is_admin', false)), so an admin account can never
      be opened as a client;
    - `children` (the page's own section) is drawn ONLY once that query
      has returned a client. While loading, after an error, or for a
      missing or admin account, the page shows a message instead.
    It also draws the frame: the back link, the title and the browser tab's
    title, which never holds the client's name (DECISIONS.md, 21 Nov 2026,
    night, later). */
export default function AdminClientPage({ section = null, withRoutes = false, refresh = false, children }: {
  /** null: the client's hub page */
  section?: ClientSection | null
  /** Also load every route, in the same request as the client (as before) */
  withRoutes?: boolean
  /** "Actualizar" in the title cell, once the client is loaded */
  refresh?: boolean
  children: (page: ClientPage) => ReactNode
}) {
  usePageTitle((section ? section.title + ' · ' : '') + 'Cliente · Administración · Medical Network')
  const { id = '' } = useParams()

  if (!UUID.test(id)) {
    return (
      <Frame section={section} clientId={id} client={null}>
        <p className={styles.message}>Cliente no encontrado.</p>
      </Frame>
    )
  }
  return (
    <Loader key={id} clientId={id} section={section} withRoutes={withRoutes} refresh={refresh}>
      {children}
    </Loader>
  )
}

function Loader({ clientId, section, withRoutes, refresh, children }: {
  clientId: string
  section: ClientSection | null
  withRoutes: boolean
  refresh: boolean
  children: (page: ClientPage) => ReactNode
}) {
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
          // these screens can't be used on them
          db.from('profiles').select(CLIENT_COLUMNS)
            .eq('id', clientId).eq('is_admin', false)
            .maybeSingle<Client>(),
          withRoutes ? loadRoutes(db) : Promise.resolve([]),
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
  }, [clientId, withRoutes, attempt])
  const loading = loaded?.attempt !== attempt
  const reload = () => setAttempt((n) => n + 1)
  /* The page is saving (Estado): "Actualizar" waits, as it always has */
  const [busy, setBusy] = useState(false)

  /* ---------- Loading, error, not found: never the page's section ---------- */
  if (!client) {
    let message: ReactNode
    if (loading) {
      message = <p className={styles.message} role="status">Cargando cliente…</p>
    } else if (loaded && !loaded.ok) {
      message = (
        <div className={styles.message + ' ' + styles.isError} role="alert">
          <p>No se pudo cargar el cliente. {loaded.error}</p>
          <button type="button" className={styles.messageBtn} onClick={reload}>
            Reintentar
          </button>
        </div>
      )
    } else {
      message = <p className={styles.message}>Cliente no encontrado.</p>
    }
    return <Frame section={section} clientId={clientId} client={null}>{message}</Frame>
  }

  const action = refresh && (
    <button type="button" className={styles.smallBtn} onClick={reload} disabled={loading || busy}>
      {loading ? 'Actualizando…' : 'Actualizar'}
    </button>
  )
  return (
    <Frame section={section} clientId={clientId} client={client} action={action}>
      {loaded && !loaded.ok && !loading && (
        <div className={styles.message + ' ' + styles.isError} role="alert">
          <p>No se pudo actualizar. {loaded.error}</p>
        </div>
      )}
      {children({
        clientId, client, setClient, routes: loaded?.ok ? loaded.routes : [],
        attempt, loading, reload, setBusy,
      })}
    </Frame>
  )
}

/** The frame: on the hub, the client's name as the title (or "sin nombre."
    with the email) and "← Clientes"; on a section page, the section as the
    title, the client's name as the small label and "← <name>". Names keep
    their own capitals. Everything from the database is plain text. */
function Frame({ section, clientId, client, action, children }: {
  section: ClientSection | null
  clientId: string
  /** null: not loaded (yet), or not found */
  client: Client | null
  /** "Actualizar", on a section page with a loaded client */
  action?: ReactNode
  children: ReactNode
}) {
  const name = client ? clientName(client) : ''
  const email = client && !name ? client.email : null

  if (!section) {
    return (
      <AdminLayout
        title={client ? name || 'Sin nombre' : 'Cliente'}
        nameTitle={!!name}
        clientTitle
        titleNote={email}
        back={{ to: '/admin/clientes', label: 'Clientes' }}
        body="hub"
      >
        {children}
      </AdminLayout>
    )
  }
  return (
    <AdminLayout
      title={section.title}
      label={client ? (name || 'Sin nombre' + (email ? ' · ' + email : '')) : 'administración'}
      nameLabel={!!client}
      compact
      action={action}
      back={UUID.test(clientId)
        ? { to: '/admin/clientes/' + clientId, label: name || 'Cliente' }
        // Not a client ID: its hub would only say "not found" too
        : { to: '/admin/clientes', label: 'Clientes' }}
    >
      {children}
    </AdminLayout>
  )
}
