import { useEffect, useState, type CSSProperties } from 'react'
import AreaLayout from './AreaLayout.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { useAuth } from '../lib/auth.ts'
import { useProfile } from '../lib/profile.ts'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import { formatBerlinDateTime } from '../lib/berlinTime.ts'
import {
  sortDocuments, BUCKET, DOCUMENT_COLUMNS, LINK_SECONDS, type ClientDocument,
} from '../lib/clientFiles.ts'
import board from './Comunidad.module.css'
import styles from './Documentos.module.css'

/** Signed links by file path (a file whose link couldn't be made is missing) */
type Links = Record<string, string>

type Loaded =
  | { key: string; ok: true; documents: ClientDocument[]; links: Links }
  | { key: string; ok: false; error: string }

/** "Mis documentos" (DECISIONS.md, 21 Nov 2026, night): the PDFs the MNL
    team uploaded for this client, newest first, each with its name, its
    date (German time) and "Abrir PDF" in a new tab.
    - free clients see one message, and the page asks for nothing (the
      database would refuse anyway)
    - the database (RLS, migration 8) decides which rows and files a client
      may read: only their own, and only while paid. The page also asks
      only for the logged-in user's own rows, because admins could read
      everyone's.
    - one request makes the signed links (valid 1 hour) for every file on
      the page
    File names are plain text, never HTML. */
export default function Documentos() {
  usePageTitle('Mis documentos · Medical Network')
  const { session } = useAuth()
  const { profile } = useProfile()
  const userId = session?.user.id ?? null
  // The database (RLS) decides in the end; this only avoids useless requests
  const canRead = profile?.plan === 'paid' || profile?.is_admin === true

  /* The title's size comes from its length ("documentos." = 11), set from
     code (React's style prop): the site's CSP blocks style="..." attributes */
  const titleStyle = { '--title-chars': 11 } as CSSProperties

  return (
    <AreaLayout current="documentos">
      <main className={board.main}>
        <div className={board.head}>
          <p className={board.label}>mis</p>
          <h1 className={board.pageTitle} style={titleStyle}>
            Documentos<span aria-hidden="true">.</span>
          </h1>
        </div>

        {canRead && userId ? (
          <DocumentList key={userId} userId={userId} />
        ) : (
          <p className={board.message}>Mis documentos es para miembros con el paquete completo.</p>
        )}
      </main>
    </AreaLayout>
  )
}

function DocumentList({ userId }: { userId: string }) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const key = userId + '|' + attempt

  useEffect(() => {
    if (!supabase) return
    const db = supabase
    const key = userId + '|' + attempt
    let cancelled = false
    async function load() {
      let next: Loaded
      try {
        const { data, error } = await db
          .from('client_documents')
          .select(DOCUMENT_COLUMNS)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .returns<ClientDocument[]>()
        if (error) throw error
        const documents = sortDocuments(data ?? [])
        next = { key, ok: true, documents, links: await fileLinks(db, documents) }
      } catch (err) {
        next = { key, ok: false, error: dataErrorMessage(err) }
      }
      if (!cancelled) setLoaded(next)
    }
    void load()
    return () => { cancelled = true }
  }, [userId, attempt])

  const current = loaded?.key === key ? loaded : null

  if (!supabase) {
    return <p className={board.message + ' ' + board.isError} role="alert">{dataErrorMessage(null)}</p>
  }
  if (!current) {
    return <p className={board.message} role="status">Cargando documentos…</p>
  }
  if (!current.ok) {
    return (
      <div className={board.message + ' ' + board.isError + ' ' + styles.errorCell} role="alert">
        <p>No se pudieron cargar tus documentos. {current.error}</p>
        <button type="button" className={styles.retryBtn} onClick={() => setAttempt((n) => n + 1)}>
          Reintentar
        </button>
      </div>
    )
  }
  if (current.documents.length === 0) {
    return <p className={board.message}>Todavía no hay documentos para ti.</p>
  }

  return (
    <ul className={styles.list} aria-label="Tus documentos">
      {current.documents.map((doc) => {
        const url = current.links[doc.path]
        return (
          <li key={doc.id} className={styles.item}>
            <div className={styles.info}>
              {/* Plain text only (never HTML) */}
              <p className={styles.name}>{doc.file_name}</p>
              <p className={styles.date}>
                <span className="sr-only">Subido el </span>
                <time dateTime={doc.created_at}>{formatBerlinDateTime(doc.created_at)}</time>
              </p>
            </div>
            {url ? (
              <a className={styles.openBtn} href={url} target="_blank" rel="noopener noreferrer">
                Abrir PDF
                <span className="sr-only"> «{doc.file_name}» (se abre en una pestaña nueva)</span>
              </a>
            ) : (
              <p className={styles.missing}>
                No se pudo cargar este PDF. Vuelve a cargar la página para intentarlo de nuevo.
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** One signed link for each document, in ONE request. The storage service
    makes a link only for a file the reader may read (migration 8). If the
    request fails, the list is still shown and each file says it couldn't
    be loaded. */
async function fileLinks(client: NonNullable<typeof supabase>, documents: ClientDocument[]): Promise<Links> {
  const paths = documents.map((d) => d.path)
  if (paths.length === 0) return {}
  try {
    const { data, error } = await client.storage.from(BUCKET).createSignedUrls(paths, LINK_SECONDS)
    if (error || !data) return {}
    const links: Links = {}
    for (const item of data) {
      if (item.path && item.signedUrl && !item.error) links[item.path] = item.signedUrl
    }
    return links
  } catch {
    return {}
  }
}
