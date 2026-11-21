import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import AdminLayout, { BigLinks } from './AdminLayout.tsx'
import { STATUS_CLASS } from './adminNewsStatus.ts'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import { formatBerlinDateTime } from '../lib/berlinTime.ts'
import { loadNews, NEWS_STATUS_LABEL, newsStatus, stateName, type NewsPost } from '../lib/adminData.ts'
import styles from './Admin.module.css'

type ListResult =
  | { attempt: number; ok: true }
  | { attempt: number; ok: false; error: string }

/** /admin/novedades: "Nueva novedad", then every news post (drafts,
    scheduled and published), newest first, as a table like the client
    overview. A post's title opens its screen (/admin/novedades/<id>).
    Posts are never deleted; unpublish instead. */
export default function AdminNovedades() {
  usePageTitle('Novedades · Administración · Medical Network')

  const [posts, setPosts] = useState<NewsPost[] | null>(null)  // null = not loaded yet
  const [attempt, setAttempt] = useState(0)
  const [listResult, setListResult] = useState<ListResult | null>(null)
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    let cancelled = false
    async function load() {
      try {
        const rows = await loadNews(db)
        if (cancelled) return
        setPosts(rows)
        setListResult({ attempt, ok: true })
      } catch (err) {
        if (!cancelled) setListResult({ attempt, ok: false, error: dataErrorMessage(err) })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [attempt])
  const listLoading = listResult?.attempt !== attempt
  const listError = listResult && !listResult.ok && !listLoading ? listResult.error : ''

  /* The time used for "Programada" / "Publicada": kept fresh, so a scheduled
     post turns into "Publicada" by itself when its moment comes */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <AdminLayout title="Novedades" back={{ to: '/admin', label: 'Administración' }}>
      <BigLinks label="Publicar" low items={[{ to: '/admin/novedades/nueva', title: 'Nueva novedad' }]} />

      <section className={styles.list} aria-labelledby="news-list-heading" aria-busy={listLoading}>
        <div className={styles.listHead}>
          <h2 className={styles.sectionTitle} id="news-list-heading">
            {posts ? `Todas las novedades (${posts.length})` : 'Todas las novedades'}
          </h2>
          <button
            type="button" className={styles.smallBtn}
            onClick={() => setAttempt((n) => n + 1)} disabled={listLoading}
          >
            {listLoading && posts ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {listError && (
          <div className={styles.message + ' ' + styles.isError} role="alert">
            <p>No se pudieron cargar las novedades. {listError}</p>
          </div>
        )}

        {!posts ? (
          listLoading && <p className={styles.message} role="status">Cargando novedades…</p>
        ) : posts.length === 0 ? (
          <p className={styles.message}>Todavía no hay novedades.</p>
        ) : (
          /* The roles keep this a table for screen readers on a phone too,
             where CSS turns every row into a block */
          <table className={styles.table} role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">Título</th>
                <th role="columnheader" scope="col">Situación</th>
                <th role="columnheader" scope="col">Fecha</th>
                <th role="columnheader" scope="col">Para</th>
                <th role="columnheader" scope="col">Plan</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {posts.map((post) => {
                const status = newsStatus(post, now)
                return (
                  <tr key={post.id} role="row">
                    {/* Plain text only (never HTML) */}
                    <td role="cell" className={styles.nameCell}>
                      <Link className={styles.clientLink} to={'/admin/novedades/' + post.id}>
                        <span className={styles.clientName}>{post.title}</span>
                      </Link>
                    </td>
                    <td role="cell" data-label="Situación" className={styles.nowrapCell}>
                      <span className={styles.status + ' ' + STATUS_CLASS[status]}>{NEWS_STATUS_LABEL[status]}</span>
                    </td>
                    <td role="cell" data-label="Fecha" className={styles.nowrapCell}>
                      <time dateTime={post.published_at}>{formatBerlinDateTime(post.published_at)}</time>
                    </td>
                    {/* A state's post: Para ti; all states: Para todos */}
                    <td role="cell" data-label="Para">
                      {post.state
                        ? <span className={styles.newsTag + ' ' + styles.isParaTi} lang="de">{stateName(post.state) || post.state}</span>
                        : <span className={styles.newsTag + ' ' + styles.isParaTodos}>Todos los estados</span>}
                    </td>
                    <td role="cell" data-label="Plan" className={styles.nowrapCell}>
                      {post.paid_only ? 'Solo de pago' : 'También gratis'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </AdminLayout>
  )
}
